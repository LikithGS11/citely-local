import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from app.ai import retriever as retriever_module
from app.ai.retriever import HybridRetriever
from app.models.all_models import User, DocumentChunk, Document


def _make_row(chunk_id: int, content: str, distance: float, title: str = "Security Policy"):
    chunk = DocumentChunk(
        id=chunk_id,
        document_id=1,
        content=content,
        page_number=1,
        section_title="Introduction",
        embedding=[0.1] * 384,
    )
    doc = Document(id=1, title=title, confidentiality_level="Internal", department="General")
    return SimpleNamespace(DocumentChunk=chunk, Document=doc, distance=distance)


@pytest.mark.asyncio
async def test_retrieve_returns_ranked_citations(monkeypatch):
    retriever = HybridRetriever()
    user = User(id=1, email="admin@enterprise.ai", role="admin", department="General")

    monkeypatch.setattr(retriever_module.embedding_service, "encode", lambda text: [0.1] * 384)

    rows = [
        _make_row(101, "Security clearance rules outline access levels.", distance=0.20),
        _make_row(102, "Unrelated cafeteria menu content.", distance=0.60),
    ]
    mock_result = MagicMock()
    mock_result.all.return_value = rows
    mock_db = AsyncMock()
    mock_db.execute.return_value = mock_result

    citations = await retriever.retrieve(mock_db, query="security clearance", current_user=user, top_k=5)

    assert len(citations) == 2
    assert citations[0].chunk_id == 101  # closer vector + keyword match ranks first
    assert citations[0].document_title == "Security Policy"
    # Real similarity: 1 - 0.20 = 80% — no artificial score floor
    assert citations[0].similarity_score == pytest.approx(80.0)


@pytest.mark.asyncio
async def test_retrieve_empty_when_no_candidates(monkeypatch):
    retriever = HybridRetriever()
    user = User(id=1, email="admin@enterprise.ai", role="admin", department="General")

    monkeypatch.setattr(retriever_module.embedding_service, "encode", lambda text: [0.1] * 384)

    mock_result = MagicMock()
    mock_result.all.return_value = []
    mock_db = AsyncMock()
    mock_db.execute.return_value = mock_result

    citations = await retriever.retrieve(mock_db, query="anything", current_user=user)
    assert citations == []
