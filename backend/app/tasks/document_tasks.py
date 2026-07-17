import logging
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.core.celery_app import celery_app
from app.core.config import settings
from app.models.all_models import Document, DocumentVersion, DocumentChunk, DocumentStatus, AuditLog
from app.services.ingestion_service import ingestion_service
from app.ai.embeddings import embedding_service
from sqlalchemy import update

logger = logging.getLogger(__name__)


def run_async(coro):
    """Helper to execute async DB calls inside sync Celery worker process."""
    return asyncio.run(coro)


@celery_app.task(name="app.tasks.document_tasks.process_document_ingestion_task")
def process_document_ingestion_task(document_id: int, version_id: int, file_path: str, file_type: str, user_id: int):
    """
    Celery task that asynchronously processes document ingestion, embedding generation,
    vector DB insertion, and keyword indexing.
    """
    logger.info(f"Starting Celery ingestion task for document_id={document_id}, version_id={version_id}")
    run_async(_async_process_document(document_id, version_id, file_path, file_type, user_id))


async def _async_process_document(document_id: int, version_id: int, file_path: str, file_type: str, user_id: int):
    # A fresh engine per run: the module-global engine is bound to whichever event
    # loop first used it, which breaks inside Celery's per-task loops.
    engine = create_async_engine(settings.async_database_url, pool_pre_ping=True)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    try:
        await _process_with_session(session_factory, document_id, version_id, file_path, file_type, user_id)
    finally:
        await engine.dispose()


async def _process_with_session(session_factory, document_id: int, version_id: int, file_path: str, file_type: str, user_id: int):
    async with session_factory() as db:
        try:
            # 1. Update Document status to PROCESSING
            await db.execute(
                update(Document).where(Document.id == document_id).values(status=DocumentStatus.PROCESSING.value)
            )
            await db.commit()

            # 2. Parse file and split into semantic chunks
            logger.info(f"Parsing file {file_path} of type {file_type}...")
            sections = ingestion_service.parse_file(file_path, file_type)
            chunks_data = ingestion_service.chunk_sections(sections)

            if not chunks_data:
                logger.warning(f"No chunks produced for document {document_id}. Creating fallback summary chunk.")
                chunks_data = [{
                    "chunk_index": 0,
                    "content": f"Uploaded document {file_type.upper()} processed but yielded minimal text.",
                    "page_number": 1,
                    "section_title": "Overview",
                    "token_count": 10
                }]

            # 3. Generate embeddings
            logger.info(f"Generating embeddings for {len(chunks_data)} chunks...")
            texts_to_embed = [c["content"] for c in chunks_data]
            embeddings = embedding_service.encode_batch(texts_to_embed)

            # 4. Insert chunks into pgvector database
            db_chunks = []
            for idx, c in enumerate(chunks_data):
                chunk_obj = DocumentChunk(
                    document_id=document_id,
                    version_id=version_id,
                    chunk_index=c["chunk_index"],
                    content=c["content"],
                    section_title=c["section_title"],
                    page_number=c["page_number"],
                    token_count=c["token_count"],
                    embedding=embeddings[idx] if idx < len(embeddings) else None,
                    metadata_json={"file_type": file_type}
                )
                db.add(chunk_obj)
                db_chunks.append(chunk_obj)

            # 5. Update Version summary
            summary_snippet = chunks_data[0]["content"][:400] + ("..." if len(chunks_data[0]["content"]) > 400 else "")
            await db.execute(
                update(DocumentVersion).where(DocumentVersion.id == version_id).values(content_summary=summary_snippet)
            )

            # 6. Update Document status to READY
            await db.execute(
                update(Document).where(Document.id == document_id).values(status=DocumentStatus.READY.value)
            )

            # 7. Log Audit Event
            audit_entry = AuditLog(
                user_id=user_id,
                action="INGEST_DOCUMENT",
                resource_type="Document",
                resource_id=str(document_id),
                details=f"Successfully ingested {len(chunks_data)} chunks into pgvector index."
            )
            db.add(audit_entry)

            await db.commit()
            logger.info(f"Successfully completed ingestion for document_id={document_id} with {len(chunks_data)} vector chunks.")

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed ingestion for document_id={document_id}: {e}")
            async with session_factory() as err_db:
                await err_db.execute(
                    update(Document).where(Document.id == document_id).values(status=DocumentStatus.FAILED.value)
                )
                await err_db.commit()
