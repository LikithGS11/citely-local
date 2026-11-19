import time
import logging
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.all_models import DocumentChunk, DocumentVersion, Document, User
from app.schemas.all_schemas import ChunkCitation
from app.ai.embeddings import embedding_service
from rank_bm25 import BM25Okapi

logger = logging.getLogger(__name__)

# How many chunks the vector index returns before BM25 reranking
CANDIDATE_POOL_SIZE = 50


class HybridRetriever:
    """
    Hybrid Retrieval Engine:
    1. Dense vector search executed IN the database via pgvector cosine distance
       (only the top candidates are pulled into memory, not the whole corpus).
    2. BM25 keyword scoring over that candidate pool.
    3. Reciprocal Rank Fusion (RRF) to merge both rankings.
    Only chunks belonging to each document's *current* version are searched.
    Note: no per-user access filtering happens here — auth is disabled, so every
    request runs as the local admin. Raises EmbeddingUnavailableError if the
    embedding model isn't loaded.
    """
    async def retrieve(
        self,
        db: AsyncSession,
        query: str,
        current_user: User,
        department_filter: Optional[str] = None,
        confidentiality_filter: Optional[str] = None,
        top_k: int = 5
    ) -> List[ChunkCitation]:
        start_time = time.time()
        logger.info(f"Executing hybrid retrieval for user={current_user.email}, query='{query}'")

        query_embedding = embedding_service.encode(query)
        distance = DocumentChunk.embedding.cosine_distance(query_embedding)

        stmt = (
            select(DocumentChunk, Document, distance.label("distance"))
            .join(Document, DocumentChunk.document_id == Document.id)
            .join(DocumentVersion, DocumentChunk.version_id == DocumentVersion.id)
            .where(DocumentVersion.version_number == Document.current_version_number)
            .where(Document.status == "READY")
            .where(DocumentVersion.status == "READY")
            .where(DocumentChunk.embedding.isnot(None))
        )
        if department_filter:
            stmt = stmt.where(Document.department == department_filter)
        if confidentiality_filter:
            stmt = stmt.where(Document.confidentiality_level == confidentiality_filter)

        stmt = stmt.order_by(distance).limit(CANDIDATE_POOL_SIZE)

        result = await db.execute(stmt)
        candidates = result.all()

        if not candidates:
            logger.warning("No candidate document chunks matched the query filters.")
            return []

        # Vector ranks come straight from the DB ordering (ascending distance)
        vector_ranks = {row.DocumentChunk.id: idx + 1 for idx, row in enumerate(candidates)}

        # BM25 keyword scoring over the candidate pool
        tokenized_query = query.lower().split()
        corpus_texts = [row.DocumentChunk.content.lower().split() for row in candidates]
        bm25 = BM25Okapi(corpus_texts)
        bm25_scores = bm25.get_scores(tokenized_query)
        bm25_order = sorted(range(len(candidates)), key=lambda i: bm25_scores[i], reverse=True)
        bm25_ranks = {candidates[i].DocumentChunk.id: rank + 1 for rank, i in enumerate(bm25_order)}

        # Reciprocal Rank Fusion
        k_rrf = 60
        rrf_scored = []
        for row in candidates:
            chunk, doc, dist = row.DocumentChunk, row.Document, row.distance
            v_rank = vector_ranks[chunk.id]
            b_rank = bm25_ranks[chunk.id]
            rrf_score = (1.0 / (k_rrf + v_rank)) + (1.0 / (k_rrf + b_rank))
            if any(
                w in doc.title.lower() or (chunk.section_title and w in chunk.section_title.lower())
                for w in tokenized_query
            ):
                rrf_score *= 1.25
            rrf_scored.append((chunk, doc, rrf_score, dist))

        rrf_scored.sort(key=lambda x: x[2], reverse=True)

        citations = []
        for chunk, doc, _, dist in rrf_scored[:top_k]:
            # Real cosine similarity as a percentage — no artificial floor
            similarity_pct = round(max(0.0, min(1.0, 1.0 - float(dist))) * 100, 1)
            citations.append(
                ChunkCitation(
                    chunk_id=chunk.id,
                    document_id=doc.id,
                    document_title=doc.title,
                    page_number=chunk.page_number or 1,
                    section_title=chunk.section_title or "General Section",
                    content_snippet=chunk.content.strip(),
                    similarity_score=similarity_pct,
                    confidentiality_level=doc.confidentiality_level
                )
            )

        latency = (time.time() - start_time) * 1000
        logger.info(f"Hybrid retrieval completed in {latency:.2f}ms yielding {len(citations)} top citations.")
        return citations


hybrid_retriever = HybridRetriever()
