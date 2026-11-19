import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from app.core.config import settings

logger = logging.getLogger(__name__)

# Create Async Engine
engine = create_async_engine(
    settings.async_database_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Create Async Session Maker
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

Base = declarative_base()

# Set by init_db(); surfaced by the /health endpoint so a broken DB is visible.
db_init_error: str | None = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency generator for FastAPI endpoints to obtain an async database session.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            raise e
        finally:
            await session.close()


async def _upgrade_schema(conn) -> None:
    """
    Lightweight in-place upgrades for databases created before a column existed.
    create_all() only creates missing tables; it never alters existing ones.
    """
    has_version_status = (await conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'document_versions' AND column_name = 'status'"
    ))).first()
    if not has_version_status:
        await conn.execute(text(
            "ALTER TABLE document_versions ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'PENDING'"
        ))
        # Backfill: the version a document serves inherits the document's status;
        # older versions were READY when they were superseded.
        await conn.execute(text(
            "UPDATE document_versions v SET status = CASE "
            "WHEN v.version_number = d.current_version_number THEN d.status ELSE 'READY' END "
            "FROM documents d WHERE v.document_id = d.id"
        ))
        logger.info("Added document_versions.status column and backfilled it.")


async def _check_embedding_dimension(conn) -> None:
    dim = (await conn.execute(text(
        "SELECT atttypmod FROM pg_attribute "
        "WHERE attrelid = 'document_chunks'::regclass AND attname = 'embedding'"
    ))).scalar()
    if dim is not None and dim != settings.EMBEDDING_DIMENSION:
        raise RuntimeError(
            f"document_chunks.embedding is vector({dim}) but EMBEDDING_DIMENSION={settings.EMBEDDING_DIMENSION}. "
            "Changing the embedding model requires re-creating the chunks table and re-ingesting documents."
        )


async def init_db() -> None:
    """
    Initialize database tables and required PostgreSQL extensions (like pgvector).
    """
    global db_init_error
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

            # Import models to register them with Base before creating tables
            from app.models.all_models import Base as ModelsBase
            await conn.run_sync(ModelsBase.metadata.create_all)
            await _upgrade_schema(conn)
            await _check_embedding_dimension(conn)

            # HNSW index so pgvector cosine search doesn't scan the whole table
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding "
                "ON document_chunks USING hnsw (embedding vector_cosine_ops);"
            ))
        db_init_error = None
        logger.info("Database initialized.")
    except Exception as e:
        db_init_error = str(e)
        # Don't crash the server: /health reports the failure instead.
        logger.error(f"Failed to initialize database: {e}")


async def check_db() -> str | None:
    """Returns None if the database answers, otherwise the error message."""
    if db_init_error:
        return f"init failed: {db_init_error}"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return None
    except Exception as e:
        return str(e)
