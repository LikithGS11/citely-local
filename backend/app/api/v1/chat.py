from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.all_models import User
from app.schemas.all_schemas import ChatRequest, ChatResponse, ChatMessage
from app.ai.agents import multi_agent_system

router = APIRouter(prefix="/chat", tags=["Multi-Agent AI Assistant & SQL+RAG"])

# In-memory session store for multi-turn conversation memory
# Key: (user_id, conversation_id) -> List[ChatMessage]
# NOTE: process-local — history resets on restart and is not shared across
# multiple uvicorn workers. Capped so it cannot grow without bound.
_conversation_memory = {}
MAX_CONVERSATIONS = 200


@router.post("/ask", response_model=ChatResponse)
async def ask_assistant(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Multi-turn AI Assistant endpoint.
    Orchestrates Coordinator, Retrieval, SQL, and Unified SQL+RAG agents.
    Returns exact source citations (Document Name, Page Number, Section) and live thought steps.
    """
    conv_key = (current_user.id, request.conversation_id or "default")
    
    # Load past memory
    existing_history = _conversation_memory.get(conv_key, [])
    if request.history:
        existing_history = request.history

    # Execute multi-agent system
    response = await multi_agent_system.process_chat(
        db=db,
        user=current_user,
        message=request.message,
        history=existing_history
    )

    # Append to memory
    existing_history.append(ChatMessage(role="user", content=request.message))
    existing_history.append(ChatMessage(role="assistant", content=response.answer))
    # Evict the oldest conversation when at capacity, keep last 16 turns per conversation
    if conv_key not in _conversation_memory and len(_conversation_memory) >= MAX_CONVERSATIONS:
        _conversation_memory.pop(next(iter(_conversation_memory)))
    _conversation_memory[conv_key] = existing_history[-16:]

    return response


@router.get("/history", response_model=List[ChatMessage])
async def get_chat_history(
    conversation_id: str = "default",
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve multi-turn conversation history for the current user and conversation session.
    """
    conv_key = (current_user.id, conversation_id)
    return _conversation_memory.get(conv_key, [])


@router.delete("/history")
async def clear_chat_history(
    conversation_id: str = "default",
    current_user: User = Depends(get_current_user)
):
    conv_key = (current_user.id, conversation_id)
    if conv_key in _conversation_memory:
        del _conversation_memory[conv_key]
    return {"status": "success", "message": f"Cleared history for conversation '{conversation_id}'"}
