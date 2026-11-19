import logging
from typing import List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False


class EmbeddingUnavailableError(RuntimeError):
    """Raised when no real embedding model is available. There is deliberately no
    fake/hash fallback: random vectors would silently poison the index."""


class EmbeddingService:
    """
    Generates vector embeddings with a local SentenceTransformers model.
    """
    def __init__(self):
        self.model_name = settings.EMBEDDING_MODEL
        self.model = None
        self.unavailable_reason: Optional[str] = None

        if not HAS_SENTENCE_TRANSFORMERS:
            self.unavailable_reason = "sentence-transformers is not installed"
            logger.error(f"Embeddings unavailable: {self.unavailable_reason}")
            return
        try:
            logger.info(f"Loading local embedding model: {self.model_name}...")
            model = SentenceTransformer(self.model_name)
            get_dim = getattr(model, "get_embedding_dimension", None) or model.get_sentence_embedding_dimension
            dim = get_dim()
            if dim != settings.EMBEDDING_DIMENSION:
                self.unavailable_reason = (
                    f"{self.model_name} produces {dim}-dim vectors but EMBEDDING_DIMENSION="
                    f"{settings.EMBEDDING_DIMENSION}"
                )
                logger.error(f"Embeddings unavailable: {self.unavailable_reason}")
                return
            self.model = model
            logger.info("Successfully loaded local SentenceTransformers model.")
        except Exception as e:
            self.unavailable_reason = f"could not load {self.model_name}: {e}"
            logger.error(f"Embeddings unavailable: {self.unavailable_reason}")

    def encode(self, text: str) -> List[float]:
        """Encodes a single text string into a float vector."""
        return self.encode_batch([text])[0]

    def encode_batch(self, texts: List[str]) -> List[List[float]]:
        """Encodes a batch of texts into float vectors. Raises EmbeddingUnavailableError."""
        if not texts:
            return []
        if self.model is None:
            raise EmbeddingUnavailableError(f"Embedding model unavailable: {self.unavailable_reason}")
        embeddings = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return [emb.tolist() for emb in embeddings]


embedding_service = EmbeddingService()
