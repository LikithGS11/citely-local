import os
import re
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.all_models import User, Document, DocumentVersion, DocumentChunk, DocumentStatus, AuditLog
from app.schemas.all_schemas import DocumentResponse, DocumentVersionResponse, VersionComparisonResponse
from app.services.ingestion_service import SUPPORTED_EXTENSIONS
from app.tasks.document_tasks import _async_process_document, process_document_ingestion_task

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["Document Management & Version Control"])


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    department: str = Form("General"),
    confidentiality_level: str = Form("Internal"),
    tags: str = Form(""),
    document_id: Optional[int] = Form(None),  # If updating existing document version
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads a new document or a new version of an existing document, then hands
    extraction + embedding to a Celery worker (or an in-process BackgroundTask if
    the broker is unreachable). A new version only replaces the searchable one
    once it has been ingested successfully.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name")

    file_ext = os.path.splitext(file.filename)[1].lower().lstrip(".")
    if file_ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{file_ext}'. Allowed: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    # Validate the target document BEFORE writing anything to disk, so a rejected
    # version upload never leaves an orphan file. The row lock prevents two
    # concurrent uploads from producing duplicate version numbers.
    doc: Optional[Document] = None
    if document_id:
        res = await db.execute(select(Document).where(Document.id == document_id).with_for_update())
        doc = res.scalar_one_or_none()
        if not doc:
            raise HTTPException(status_code=404, detail="Target document not found for version update")
        if current_user.role != "admin" and doc.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the document owner or an admin can upload new versions")

    # Save file to disk — sanitize the client-supplied filename to prevent path traversal
    base_name = os.path.basename(file.filename)
    base_name = re.sub(r"[^A-Za-z0-9._-]", "_", base_name).strip("._") or f"upload.{file_ext}"
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    file_path = os.path.join(settings.UPLOAD_DIR, f"{timestamp_str}_{base_name}")

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    written = 0
    try:
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > max_bytes:
                    break
                buffer.write(chunk)
    except Exception as e:
        _remove_quietly(file_path)
        logger.error(f"Failed to save uploaded file: {e}")
        raise HTTPException(status_code=500, detail="Could not save file on server")
    if written > max_bytes:
        _remove_quietly(file_path)
        raise HTTPException(status_code=413, detail=f"File exceeds the maximum upload size of {settings.MAX_UPLOAD_SIZE_MB} MB")
    if written == 0:
        _remove_quietly(file_path)
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        if doc is not None:
            max_ver = (await db.execute(
                select(func.max(DocumentVersion.version_number)).where(DocumentVersion.document_id == doc.id)
            )).scalar() or 0
            version_num = max_ver + 1
            doc.title = title
            doc.department = department
            doc.confidentiality_level = confidentiality_level
            doc.tags = tags
            # current_version_number and status stay as they are: the previous version
            # keeps serving search until this one finishes ingesting.
            if doc.status != DocumentStatus.READY.value:
                doc.status = DocumentStatus.PENDING.value
            doc.updated_at = datetime.now(timezone.utc)
        else:
            doc = Document(
                title=title,
                department=department,
                owner_id=current_user.id,
                confidentiality_level=confidentiality_level,
                tags=tags,
                current_version_number=1,
                status=DocumentStatus.PENDING.value
            )
            db.add(doc)
            await db.flush()
            version_num = 1

        doc_version = DocumentVersion(
            document_id=doc.id,
            version_number=version_num,
            file_path=file_path,
            file_name=file.filename,
            file_size_bytes=written,
            file_type=file_ext,
            status=DocumentStatus.PENDING.value,
            content_summary=None,
        )
        db.add(doc_version)
        db.add(AuditLog(
            user_id=current_user.id,
            action="UPLOAD_DOCUMENT" if version_num == 1 else "UPLOAD_NEW_VERSION",
            resource_type="Document",
            resource_id=str(doc.id),
            details=f"Uploaded '{file.filename}' (v{version_num}) to department '{department}' ({confidentiality_level})"
        ))
        await db.commit()
    except Exception:
        await db.rollback()
        _remove_quietly(file_path)
        raise

    doc_id, version_id = doc.id, doc_version.id

    # Trigger async ingestion
    try:
        process_document_ingestion_task.delay(doc_id, version_id, file_path, file_ext, current_user.id)
        logger.info(f"Dispatched Celery task for doc.id={doc_id}, v={version_num}")
    except Exception as celery_err:
        logger.warning(f"Celery broker unavailable, falling back to local async BackgroundTask: {celery_err}")
        background_tasks.add_task(_async_process_document, doc_id, version_id, file_path, file_ext, current_user.id)

    return await _fetch_document_with_versions(db, doc_id)


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    department: Optional[str] = None,
    confidentiality: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List documents with their versions (one query for documents, one for versions).
    """
    stmt = select(Document).options(selectinload(Document.versions)).order_by(desc(Document.updated_at))

    # Role/department filters. Auth is disabled, so the local user is an admin and sees everything.
    if current_user.role != "admin":
        stmt = stmt.where(Document.department.in_([current_user.department, "General"]))
        stmt = stmt.where(Document.confidentiality_level != "Restricted")

    if department:
        stmt = stmt.where(Document.department == department)
    if confidentiality:
        stmt = stmt.where(Document.confidentiality_level == confidentiality)

    docs = (await db.execute(stmt)).scalars().all()
    return [_to_response(d) for d in docs]


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = await _fetch_document_with_versions(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _enforce_doc_permission(current_user, doc)
    return doc


@router.get("/{document_id}/versions", response_model=List[DocumentVersionResponse])
async def get_document_versions(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = await _fetch_document_with_versions(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _enforce_doc_permission(current_user, doc)
    return doc.versions


@router.get("/{document_id}/compare-versions", response_model=VersionComparisonResponse)
async def compare_versions(
    document_id: int,
    v1: int,
    v2: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Compares two versions of a document by their section headers and chunk counts.
    """
    doc = await _fetch_document_with_versions(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _enforce_doc_permission(current_user, doc)

    res = await db.execute(select(DocumentVersion).where(DocumentVersion.document_id == document_id))
    versions = {v.version_number: v for v in res.scalars().all()}

    if v1 not in versions or v2 not in versions:
        raise HTTPException(status_code=400, detail="One or both specified version numbers do not exist for this document")
    not_ready = [v for v in (v1, v2) if versions[v].status != DocumentStatus.READY.value]
    if not_ready:
        raise HTTPException(status_code=409, detail=f"Version(s) {not_ready} have not been ingested successfully, so there is nothing to compare")

    chunks_v1 = (await db.execute(select(DocumentChunk).where(DocumentChunk.version_id == versions[v1].id))).scalars().all()
    chunks_v2 = (await db.execute(select(DocumentChunk).where(DocumentChunk.version_id == versions[v2].id))).scalars().all()

    sections_v1 = set(c.section_title or f"Page {c.page_number}" for c in chunks_v1)
    sections_v2 = set(c.section_title or f"Page {c.page_number}" for c in chunks_v2)

    added = sorted(sections_v2 - sections_v1)
    removed = sorted(sections_v1 - sections_v2)

    db.add(AuditLog(
        user_id=current_user.id,
        action="COMPARE_VERSIONS",
        resource_type="Document",
        resource_id=str(document_id),
        details=f"Compared version v{v1} vs v{v2} for '{doc.title}'"
    ))
    await db.commit()

    return VersionComparisonResponse(
        document_id=doc.id,
        document_title=doc.title,
        version_1=v1,
        version_2=v2,
        diff_summary=f"Compared Version {v1} ({len(chunks_v1)} chunks) against Version {v2} ({len(chunks_v2)} chunks). Found {len(added)} new section headers and {len(removed)} removed headers.",
        added_sections=added if added else ["No newly added section headers"],
        removed_sections=removed if removed else ["No removed section headers"],
        changed_metrics={
            f"v{v1}_size_bytes": versions[v1].file_size_bytes,
            f"v{v2}_size_bytes": versions[v2].file_size_bytes,
            "chunk_count_change": len(chunks_v2) - len(chunks_v1)
        }
    )


def _to_response(doc: Document) -> DocumentResponse:
    resp = DocumentResponse.model_validate(doc)
    versions = sorted(doc.versions, key=lambda v: v.version_number, reverse=True)
    resp.versions = [DocumentVersionResponse.model_validate(v) for v in versions]
    return resp


async def _fetch_document_with_versions(db: AsyncSession, doc_id: int) -> Optional[DocumentResponse]:
    # Eager-load versions: validating the ORM object otherwise triggers a lazy
    # load, which is illegal in async SQLAlchemy (MissingGreenlet).
    stmt = (
        select(Document)
        .options(selectinload(Document.versions))
        .where(Document.id == doc_id)
        .execution_options(populate_existing=True)
    )
    doc = (await db.execute(stmt)).scalar_one_or_none()
    return _to_response(doc) if doc else None


def _remove_quietly(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass


def _enforce_doc_permission(user: User, doc: DocumentResponse):
    if user.role == "admin":
        return
    if doc.department not in [user.department, "General"]:
        raise HTTPException(status_code=403, detail=f"Document restricted to department '{doc.department}'")
    if doc.confidentiality_level == "Restricted":
        raise HTTPException(status_code=403, detail="Restricted confidentiality clearance required")
