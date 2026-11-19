from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.all_models import User
from app.schemas.all_schemas import SearchRequest, SearchResponse
from app.ai.retriever import hybrid_retriever
from app.ai.embeddings import EmbeddingUnavailableError
from app.services.analytics_service import log_search
import time

router = APIRouter(prefix="/search", tags=["Direct Semantic & Hybrid Search API"])


@router.post("/semantic", response_model=SearchResponse)
async def perform_semantic_search(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Performs direct hybrid search (Dense Vector + BM25 keyword + RRF + Reranking) without chatbot interaction.
    Allows users to filter by department and confidentiality clearance.
    """
    start_t = time.time()
    try:
        citations = await hybrid_retriever.retrieve(
            db=db,
            query=request.query,
            current_user=current_user,
            department_filter=request.department_filter,
            confidentiality_filter=request.confidentiality_filter,
            top_k=request.top_k
        )
    except EmbeddingUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    latency = (time.time() - start_t) * 1000
    await log_search(db, current_user.id, request.query, "Search: Hybrid", citations, latency)

    return SearchResponse(
        query=request.query,
        results=citations,
        total_results=len(citations),
        retrieval_method="Hybrid (pgvector dense + BM25 keyword, RRF fusion)",
        latency_ms=latency
    )
