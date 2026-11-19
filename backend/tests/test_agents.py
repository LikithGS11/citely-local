import pytest
from unittest.mock import AsyncMock, MagicMock
from app.ai import agents as agents_module
from app.ai.agents import MultiAgentSystem
from app.models.all_models import User, PaymentHistory
from app.schemas.all_schemas import ChunkCitation


def _make_user(department: str = "General") -> User:
    return User(id=1, email="admin@enterprise.ai", role="admin", department=department)


def _make_citation() -> ChunkCitation:
    return ChunkCitation(
        chunk_id=101,
        document_id=1,
        document_title="HR Policy",
        page_number=2,
        section_title="Section 2",
        content_snippet="Maternity leave full-time entitlement is 16 weeks.",
        similarity_score=88.5,
        confidentiality_level="Internal",
    )


@pytest.mark.asyncio
async def test_classify_intent_keyword_fallback_when_llm_down(monkeypatch):
    system = MultiAgentSystem()

    async def llm_down(*args, **kwargs):
        raise RuntimeError("LLM unreachable")

    monkeypatch.setattr(agents_module.llm_service, "generate_chat_response", llm_down)

    intent, source = await system._classify_intent("Which supplier has the highest delayed payment invoice?")
    assert intent == "SQL_RAG"
    assert source == "keyword fallback"

    intent, source = await system._classify_intent("What is the maternity leave policy?")
    assert intent == "RAG"
    assert source == "keyword fallback"


@pytest.mark.asyncio
async def test_rag_route_returns_citations(monkeypatch):
    system = MultiAgentSystem()
    replies = iter(["RAG", "According to HR Policy page 2, employees get 16 weeks paid leave."])

    async def fake_llm(system_prompt, user_prompt, history=None, **kwargs):
        return next(replies)

    async def fake_retrieve(db, query, current_user, top_k=5, **kwargs):
        return [_make_citation()]

    monkeypatch.setattr(agents_module.llm_service, "generate_chat_response", fake_llm)
    monkeypatch.setattr(agents_module.hybrid_retriever, "retrieve", fake_retrieve)

    mock_db = MagicMock()
    mock_db.commit = AsyncMock()

    resp = await system.process_chat(db=mock_db, user=_make_user(), message="How many paid maternity leave weeks?", history=[])

    assert "16 weeks" in resp.answer
    assert resp.citations[0].document_title == "HR Policy"
    assert resp.unified_data is None
    agent_names = [s.agent_name for s in resp.agent_steps]
    assert "Coordinator Agent" in agent_names
    assert "Retrieval Agent" in agent_names


@pytest.mark.asyncio
async def test_sql_rag_route_merges_structured_records(monkeypatch):
    system = MultiAgentSystem()
    replies = iter(["SQL_RAG", "Supplier ABC is 15 days late; contract imposes a 2.5% penalty."])

    async def fake_llm(system_prompt, user_prompt, history=None, **kwargs):
        return next(replies)

    async def fake_retrieve(db, query, current_user, top_k=5, **kwargs):
        return [_make_citation()]

    monkeypatch.setattr(agents_module.llm_service, "generate_chat_response", fake_llm)
    monkeypatch.setattr(agents_module.hybrid_retriever, "retrieve", fake_retrieve)

    payment = PaymentHistory(
        id=1, invoice_number="INV-2026-089", supplier_name="Supplier ABC",
        amount_usd=45000.0, delay_days=15, status="Delayed",
    )
    mock_res_payments = MagicMock()
    mock_res_payments.scalars.return_value.all.return_value = [payment]
    mock_db = MagicMock()
    mock_db.execute = AsyncMock(return_value=mock_res_payments)
    mock_db.commit = AsyncMock()

    resp = await system.process_chat(db=mock_db, user=_make_user("Finance"), message="Show delayed payments and penalties", history=[])

    assert resp.unified_data is not None
    records = resp.unified_data["sql_payment_records"]
    assert len(records) == 1
    assert records[0]["supplier_name"] == "Supplier ABC"
    agent_names = [s.agent_name for s in resp.agent_steps]
    assert "SQL Agent" in agent_names
    # Aggregation step reports the real worst offender, computed from the data
    agg = next(s for s in resp.agent_steps if s.action == "DATA_AGGREGATION")
    assert "Supplier ABC" in agg.details
    assert "15 days" in agg.details


def test_clean_history_drops_duplicate_question_and_caps_length():
    from app.schemas.all_schemas import ChatMessage
    history = [ChatMessage(role="assistant", content="welcome")]
    history += [ChatMessage(role="user" if i % 2 == 0 else "assistant", content=f"m{i}") for i in range(20)]
    history.append(ChatMessage(role="user", content="What is the leave policy?"))

    cleaned = MultiAgentSystem._clean_history(history, "What is the leave policy?")
    assert cleaned[-1].content != "What is the leave policy?"
    assert len(cleaned) == agents_module.MAX_HISTORY_MESSAGES


@pytest.mark.asyncio
async def test_classifier_ignores_words_merely_containing_rag(monkeypatch):
    system = MultiAgentSystem()

    async def chatty_llm(*args, **kwargs):
        return "STORAGE questions are not my thing"

    monkeypatch.setattr(agents_module.llm_service, "generate_chat_response", chatty_llm)
    intent, source = await system._classify_intent("Show me the invoice delays")
    assert source == "keyword fallback"
    assert intent == "SQL_RAG"
