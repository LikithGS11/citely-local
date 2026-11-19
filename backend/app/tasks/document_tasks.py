import logging
import asyncio
from sqlalchemy import update, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.core.celery_app import celery_app
from app.core.config import settings
from app.models.all_models import Document, DocumentVersion, DocumentChunk, DocumentStatus, AuditLog
from app.services.ingestion_service import ingestion_service, IngestionError
from app.ai.embeddings import embedding_service

logger = logging.getLogger(__name__)

READY = DocumentStatus.READY.value


@celery_app.task(name="app.tasks.document_tasks.process_document_ingestion_task")
def process_document_ingestion_task(document_id: int, version_id: int, file_path: str, file_type: str, user_id: int):
    """
    Celery task: parse, chunk, embed, and index one document version.
    """
    logger.info(f"Starting Celery ingestion task for document_id={document_id}, version_id={version_id}")
    asyncio.run(_async_process_document(document_id, version_id, file_path, file_type, user_id))


async def _async_process_document(document_id: int, version_id: int, file_path: str, file_type: str, user_id: int):
    # A fresh engine per run: the module-global engine is bound to whichever event
    # loop first used it, which breaks inside Celery's per-task loops.
    engine = create_async_engine(settings.async_database_url, pool_pre_ping=True)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    try:
        await _process_with_session(session_factory, document_id, version_id, file_path, file_type, user_id)
    finally:
        await engine.dispose()


def _extract_and_embed(file_path: str, file_type: str):
    """CPU/IO-heavy, synchronous work. Runs in a worker thread so the API's event
    loop stays responsive when ingestion falls back to an in-process BackgroundTask."""
    sections = ingestion_service.parse_file(file_path, file_type)
    chunks_data = ingestion_service.chunk_sections(sections)
    if not chunks_data:
        raise IngestionError("The extracted text was too short to index")
    embeddings = embedding_service.encode_batch([c["content"] for c in chunks_data])
    return chunks_data, embeddings


async def _process_with_session(session_factory, document_id: int, version_id: int, file_path: str, file_type: str, user_id: int):
    async with session_factory() as db:
        try:
            # 1. Mark the version PROCESSING. The document itself only shows PROCESSING
            #    if it has no READY version serving search yet.
            await db.execute(
                update(DocumentVersion).where(DocumentVersion.id == version_id)
                .values(status=DocumentStatus.PROCESSING.value)
            )
            await db.execute(
                update(Document).where(Document.id == document_id, Document.status != READY)
                .values(status=DocumentStatus.PROCESSING.value)
            )
            await db.commit()

            # 2-3. Parse, chunk, embed (off the event loop)
            logger.info(f"Parsing file {file_path} of type {file_type}...")
            chunks_data, embeddings = await asyncio.to_thread(_extract_and_embed, file_path, file_type)

            # 4. Insert chunks into pgvector
            for c, emb in zip(chunks_data, embeddings):
                db.add(DocumentChunk(
                    document_id=document_id,
                    version_id=version_id,
                    chunk_index=c["chunk_index"],
                    content=c["content"],
                    section_title=c["section_title"],
                    page_number=c["page_number"],
                    token_count=c["token_count"],
                    embedding=emb,
                    metadata_json={"file_type": file_type},
                ))

            # 5. Version READY + summary
            first = chunks_data[0]["content"]
            version = (await db.execute(
                select(DocumentVersion).where(DocumentVersion.id == version_id)
            )).scalar_one()
            version.status = READY
            version.content_summary = first[:400] + ("..." if len(first) > 400 else "")

            # 6. Promote this version to "current" unless a newer one is already serving
            doc = (await db.execute(
                select(Document).where(Document.id == document_id).with_for_update()
            )).scalar_one()
            if doc.status != READY or version.version_number >= (doc.current_version_number or 0):
                doc.current_version_number = version.version_number
            doc.status = READY

            # 7. Audit
            db.add(AuditLog(
                user_id=user_id,
                action="INGEST_DOCUMENT",
                resource_type="Document",
                resource_id=str(document_id),
                details=f"Ingested v{version.version_number}: {len(chunks_data)} chunks indexed."
            ))

            await db.commit()
            logger.info(f"Completed ingestion for document_id={document_id} v{version.version_number} ({len(chunks_data)} chunks).")

        except Exception as e:
            await db.rollback()
            reason = str(e) if isinstance(e, IngestionError) else f"{type(e).__name__}: {e}"
            logger.error(f"Failed ingestion for document_id={document_id}, version_id={version_id}: {reason}")
            async with session_factory() as err_db:
                await err_db.execute(
                    update(DocumentVersion).where(DocumentVersion.id == version_id)
                    .values(status=DocumentStatus.FAILED.value, content_summary=f"Ingestion failed: {reason}"[:2000])
                )
                # Only fail the whole document if no earlier version is serving search
                await err_db.execute(
                    update(Document).where(Document.id == document_id, Document.status != READY)
                    .values(status=DocumentStatus.FAILED.value)
                )
                err_db.add(AuditLog(
                    user_id=user_id,
                    action="INGEST_FAILED",
                    resource_type="Document",
                    resource_id=str(document_id),
                    details=reason[:2000],
                ))
                await err_db.commit()
