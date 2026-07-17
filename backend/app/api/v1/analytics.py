from collections import Counter
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.all_models import User, Document, SearchAnalytics
from app.schemas.all_schemas import AnalyticsSummaryResponse

router = APIRouter(prefix="/analytics", tags=["Executive Intelligence & Analytics Dashboard"])


@router.get("/summary", response_model=AnalyticsSummaryResponse)
async def get_analytics_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Real aggregated metrics for the analytics dashboard. All values are computed
    from the database — nothing is fabricated. Empty tables yield zeros/empty lists.
    """
    total_docs = (await db.execute(select(func.count(Document.id)))).scalar_one() or 0
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one() or 0

    res_s = await db.execute(select(func.count(SearchAnalytics.id), func.avg(SearchAnalytics.latency_ms)))
    search_count, avg_lat = res_s.first() or (0, None)

    # Department distribution (real document counts)
    res_d = await db.execute(select(Document.department, func.count(Document.id)).group_by(Document.department))
    dept_usage = [{"department": row[0], "count": row[1]} for row in res_d.all()]

    # Top queried documents: count real hits from SearchAnalytics.top_document_ids
    res_ids = await db.execute(select(SearchAnalytics.top_document_ids))
    hit_counter: Counter = Counter()
    for (ids_str,) in res_ids.all():
        if ids_str:
            for doc_id in ids_str.split(","):
                if doc_id.strip().isdigit():
                    hit_counter[int(doc_id.strip())] += 1

    top_docs = []
    if hit_counter:
        top_ids = [doc_id for doc_id, _ in hit_counter.most_common(5)]
        res_top = await db.execute(
            select(Document.id, Document.title, Document.department).where(Document.id.in_(top_ids))
        )
        doc_meta = {row[0]: (row[1], row[2]) for row in res_top.all()}
        for doc_id in top_ids:
            if doc_id in doc_meta:
                title, department = doc_meta[doc_id]
                top_docs.append({
                    "id": doc_id,
                    "title": title,
                    "department": department,
                    "search_hits": hit_counter[doc_id],
                })

    # Recent queries (real)
    res_r = await db.execute(
        select(SearchAnalytics.query_text, SearchAnalytics.latency_ms, SearchAnalytics.timestamp)
        .order_by(desc(SearchAnalytics.timestamp))
        .limit(6)
    )
    recent_queries = [
        {
            "query": row[0],
            "latency_ms": round(row[1], 1) if row[1] is not None else None,
            "timestamp": row[2].isoformat() if row[2] else "",
        }
        for row in res_r.all()
    ]

    return AnalyticsSummaryResponse(
        total_documents=total_docs,
        total_users=total_users,
        total_search_queries=search_count or 0,
        average_latency_ms=round(avg_lat, 1) if avg_lat is not None else 0.0,
        retrieval_accuracy_rating=None,  # not measured — reported honestly as unavailable
        top_queried_documents=top_docs,
        department_usage=dept_usage,
        recent_queries=recent_queries,
    )
