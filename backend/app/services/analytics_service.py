import logging
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.all_models import SearchAnalytics
from app.schemas.all_schemas import ChunkCitation

logger = logging.getLogger(__name__)


async def log_search(
    db: AsyncSession,
    user_id: int,
    query: str,
    method: str,
    citations: List[ChunkCitation],
    latency_ms: float,
) -> None:
    """
    Records one query for the analytics dashboard. Each document is counted once
    per query, however many of its chunks were returned. Never raises.
    """
    try:
        doc_ids = list(dict.fromkeys(c.document_id for c in citations))
        db.add(SearchAnalytics(
            user_id=user_id,
            query_text=query,
            retrieval_method=method[:50],
            top_document_ids=",".join(str(i) for i in doc_ids)[:255],
            latency_ms=latency_ms,
            result_count=len(citations),
        ))
        await db.commit()
    except Exception as e:
        logger.warning(f"Could not log search analytics: {e}")
        try:
            await db.rollback()
        except Exception:
            pass
