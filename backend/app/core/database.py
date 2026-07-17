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


async def init_db() -> None:
    """
    Initialize database tables and required PostgreSQL extensions (like pgvector).
    """
    try:
        async with engine.begin() as conn:
            # Enable pgvector extension inside PostgreSQL
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            logger.info("Checked/created 'vector' extension in PostgreSQL.")
            
            # Import models to register them with Base before creating tables
            from app.models.all_models import Base as ModelsBase
            await conn.run_sync(ModelsBase.metadata.create_all)

            # HNSW index so pgvector cosine search doesn't scan the whole table
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding "
                "ON document_chunks USING hnsw (embedding vector_cosine_ops);"
            ))
            logger.info("Successfully initialized all database tables.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        # We don't raise here so that local tests or mock modes without a live DB can still boot if desired
