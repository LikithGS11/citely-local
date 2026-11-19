import pytest
from app.ai.embeddings import EmbeddingService, EmbeddingUnavailableError


def test_no_fake_vectors_when_model_missing():
    svc = EmbeddingService.__new__(EmbeddingService)
    svc.model = None
    svc.unavailable_reason = "test: model not loaded"
    with pytest.raises(EmbeddingUnavailableError):
        svc.encode("hello")
