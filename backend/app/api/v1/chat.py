from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, desc
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.all_models import User, ChatMessageRecord
from app.schemas.all_schemas import ChatRequest, ChatResponse, ChatMessage, ChatHistoryItem
from app.ai.agents import multi_agent_system
from app.ai.embeddings import EmbeddingUnavailableError

router = APIRouter(prefix="/chat", tags=["Chat Assistant"])

# How many stored messages are loaded as context when the client sends none
HISTORY_LOAD_LIMIT = 16


async def _load_history(db: AsyncSession, user_id: int, conversation_id: str, limit: int) -> List[ChatMessageRecord]:
    rows = (await db.execute(
        select(ChatMessageRecord)
        .where(ChatMessageRecord.user_id == user_id, ChatMessageRecord.conversation_id == conversation_id)
        .order_by(desc(ChatMessageRecord.created_at), desc(ChatMessageRecord.id))
        .limit(limit)
    )).scalars().all()
    return list(reversed(rows))


@router.post("/ask", response_model=ChatResponse)
async def ask_assistant(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Answers a question with retrieval + the local LLM. The conversation is stored
    in Postgres, so it survives restarts. If the client sends `history`, that is
    used as context; otherwise the stored conversation is.
    """
    conversation_id = request.conversation_id or "default"

    if request.history:
        history = request.history
    else:
        stored = await _load_history(db, current_user.id, conversation_id, HISTORY_LOAD_LIMIT)
        history = [ChatMessage(role=r.role, content=r.content) for r in stored]

    try:
        response = await multi_agent_system.process_chat(
            db=db,
            user=current_user,
            message=request.message,
            history=history
        )
    except EmbeddingUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))

    db.add(ChatMessageRecord(
        user_id=current_user.id, conversation_id=conversation_id, role="user", content=request.message
    ))
    db.add(ChatMessageRecord(
        user_id=current_user.id, conversation_id=conversation_id, role="assistant", content=response.answer,
        meta_json={
            "citations": [c.model_dump() for c in response.citations],
            "agent_steps": [s.model_dump() for s in response.agent_steps],
            "unified_data": response.unified_data,
            "latency_ms": response.latency_ms,
        },
    ))
    await db.commit()

    return response


@router.get("/history", response_model=List[ChatHistoryItem])
async def get_chat_history(
    conversation_id: str = "default",
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Stored messages for a conversation, oldest first (latest `limit` messages)."""
    rows = await _load_history(db, current_user.id, conversation_id, max(1, min(limit, 500)))
    out = []
    for r in rows:
        meta = r.meta_json or {}
        out.append(ChatHistoryItem(
            role=r.role,
            content=r.content,
            citations=meta.get("citations") or [],
            agent_steps=meta.get("agent_steps") or [],
            unified_data=meta.get("unified_data"),
            latency_ms=meta.get("latency_ms"),
            created_at=r.created_at,
        ))
    return out


@router.delete("/history")
async def clear_chat_history(
    conversation_id: str = "default",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        delete(ChatMessageRecord).where(
            ChatMessageRecord.user_id == current_user.id,
            ChatMessageRecord.conversation_id == conversation_id,
        )
    )
    await db.commit()
    return {"status": "success", "deleted": result.rowcount}
