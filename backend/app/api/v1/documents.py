import os
import re
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.all_models import User, Document, DocumentVersion, DocumentChunk, DocumentStatus, AuditLog
from app.schemas.all_schemas import DocumentResponse, DocumentVersionResponse, VersionComparisonResponse
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
    Uploads a new document or a new version of an existing document.
    Triggers asynchronous Celery worker (or FastAPI BackgroundTask) for OCR, extraction, and pgvector indexing.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name")

    file_ext = os.path.splitext(file.filename)[1].lower().lstrip(".")
    allowed_exts = {"pdf", "docx", "doc", "pptx", "xlsx", "xls", "csv", "txt", "md", "markdown", "png", "jpg", "jpeg"}
    if file_ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{file_ext}'. Allowed: {', '.join(sorted(allowed_exts))}"
        )

    # Save file to disk — sanitize the client-supplied filename to prevent path traversal
    base_name = os.path.basename(file.filename)
    base_name = re.sub(r"[^A-Za-z0-9._-]", "_", base_name).strip("._") or f"upload.{file_ext}"
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_name = f"{timestamp_str}_{base_name}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_name)

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    try:
        written = 0
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > max_bytes:
                    buffer.close()
                    os.remove(file_path)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds the maximum upload size of {settings.MAX_UPLOAD_SIZE_MB} MB"
                    )
                buffer.write(chunk)
        file_size = written
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save uploaded file: {e}")
        raise HTTPException(status_code=500, detail="Could not save file on server")

    if document_id:
        # Check if updating version of existing document.
        # Row lock prevents two concurrent uploads from producing duplicate version numbers.
        stmt = select(Document).where(Document.id == document_id).with_for_update()
        res = await db.execute(stmt)
        doc = res.scalar_one_or_none()
        if not doc:
            raise HTTPException(status_code=404, detail="Target document not found for version update")
        
        # Check ownership or admin
        if current_user.role != "admin" and doc.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the document owner or an admin can upload new versions")

        doc.current_version_number += 1
        doc.title = title
        doc.department = department
        doc.confidentiality_level = confidentiality_level
        doc.tags = tags
        doc.status = DocumentStatus.PENDING.value
        doc.updated_at = datetime.now(timezone.utc)
        version_num = doc.current_version_number
    else:
        # Create brand new document record
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

    # Create Version record
    doc_version = DocumentVersion(
        document_id=doc.id,
        version_number=version_num,
        file_path=file_path,
        file_name=file.filename,
        file_size_bytes=file_size,
        file_type=file_ext,
        content_summary="Processing document extraction and embedding index..."
    )
    db.add(doc_version)
    await db.commit()
    await db.refresh(doc)
    await db.refresh(doc_version)

    # Log Audit
    audit = AuditLog(
        user_id=current_user.id,
        action="UPLOAD_DOCUMENT" if version_num == 1 else "UPLOAD_NEW_VERSION",
        resource_type="Document",
        resource_id=str(doc.id),
        details=f"Uploaded '{file.filename}' (v{version_num}) to department '{department}' ({confidentiality_level})"
    )
    db.add(audit)
    await db.commit()

    # Trigger async ingestion
    try:
        process_document_ingestion_task.delay(doc.id, doc_version.id, file_path, file_ext, current_user.id)
        logger.info(f"Dispatched Celery task for doc.id={doc.id}, v={version_num}")
    except Exception as celery_err:
        logger.warning(f"Celery broker unavailable, falling back to local async BackgroundTask: {celery_err}")
        background_tasks.add_task(_async_process_document, doc.id, doc_version.id, file_path, file_ext, current_user.id)

    # Return refreshed document with versions
    return await _fetch_document_with_versions(db, doc.id)


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    department: Optional[str] = None,
    confidentiality: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List enterprise documents with strict RBAC filtering.
    """
    stmt = select(Document).order_by(desc(Document.updated_at))

    # Apply RBAC restrictions
    if current_user.role != "admin":
        stmt = stmt.where(Document.department.in_([current_user.department, "General"]))
        if current_user.role == "viewer":
            stmt = stmt.where(Document.confidentiality_level.in_(["Public", "Internal", "Confidential"]))

    if department:
        stmt = stmt.where(Document.department == department)
    if confidentiality:
        stmt = stmt.where(Document.confidentiality_level == confidentiality)

    res = await db.execute(stmt)
    docs = res.scalars().all()

    # Load versions for each
    out = []
    for d in docs:
        out.append(await _fetch_document_with_versions(db, d.id))
    return out


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
    Compares two versions of a document and returns added/removed sections and semantic summary.
    """
    doc = await _fetch_document_with_versions(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _enforce_doc_permission(current_user, doc)

    stmt = select(DocumentVersion).where(DocumentVersion.document_id == document_id)
    res = await db.execute(stmt)
    versions = {v.version_number: v for v in res.scalars().all()}

    if v1 not in versions or v2 not in versions:
        raise HTTPException(status_code=400, detail="One or both specified version numbers do not exist for this document")

    # Fetch chunks for v1 and v2
    stmt_v1 = select(DocumentChunk).where(DocumentChunk.version_id == versions[v1].id)
    stmt_v2 = select(DocumentChunk).where(DocumentChunk.version_id == versions[v2].id)
    chunks_v1 = (await db.execute(stmt_v1)).scalars().all()
    chunks_v2 = (await db.execute(stmt_v2)).scalars().all()

    sections_v1 = set(c.section_title or f"Page {c.page_number}" for c in chunks_v1)
    sections_v2 = set(c.section_title or f"Page {c.page_number}" for c in chunks_v2)

    added = sorted(list(sections_v2 - sections_v1))
    removed = sorted(list(sections_v1 - sections_v2))

    # Audit compare action
    audit = AuditLog(
        user_id=current_user.id,
        action="COMPARE_VERSIONS",
        resource_type="Document",
        resource_id=str(document_id),
        details=f"Compared version v{v1} vs v{v2} for '{doc.title}'"
    )
    db.add(audit)
    await db.commit()

    return VersionComparisonResponse(
        document_id=doc.id,
        document_title=doc.title,
        version_1=v1,
        version_2=v2,
        diff_summary=f"Compared Version {v1} ({len(chunks_v1)} vector chunks) against Version {v2} ({len(chunks_v2)} vector chunks). Found {len(added)} new section headers and {len(removed)} removed headers.",
        added_sections=added if added else ["No newly added section headers"],
        removed_sections=removed if removed else ["No removed section headers"],
        changed_metrics={
            f"v{v1}_size_bytes": versions[v1].file_size_bytes,
            f"v{v2}_size_bytes": versions[v2].file_size_bytes,
            "chunk_count_change": len(chunks_v2) - len(chunks_v1)
        }
    )


async def _fetch_document_with_versions(db: AsyncSession, doc_id: int) -> Optional[DocumentResponse]:
    stmt = select(Document).where(Document.id == doc_id)
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        return None

    stmt_v = select(DocumentVersion).where(DocumentVersion.document_id == doc_id).order_by(desc(DocumentVersion.version_number))
    res_v = await db.execute(stmt_v)
    versions = res_v.scalars().all()

    resp = DocumentResponse.model_validate(doc)
    resp.versions = [DocumentVersionResponse.model_validate(v) for v in versions]
    return resp


def _enforce_doc_permission(user: User, doc: DocumentResponse):
    if user.role == "admin":
        return
    if doc.department not in [user.department, "General"]:
        raise HTTPException(status_code=403, detail=f"Document restricted to department '{doc.department}'")
    if doc.confidentiality_level == "Restricted" and user.role != "admin":
        raise HTTPException(status_code=403, detail="Restricted confidentiality clearance required")
