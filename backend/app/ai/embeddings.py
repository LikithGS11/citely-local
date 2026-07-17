import hashlib
import logging
from typing import List
import numpy as np
from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False


class EmbeddingService:
    """
    Handles vector embeddings generation using local SentenceTransformers (all-MiniLM-L6-v2)
    or OpenAI Embeddings API.
    """
    def __init__(self):
        self.model_name = settings.EMBEDDING_MODEL
        self.model = None
        # Embeddings are independent of the chat LLM provider — always prefer
        # the real sentence-transformers model when the package is available.
        if HAS_SENTENCE_TRANSFORMERS:
            try:
                logger.info(f"Loading local embedding model: {self.model_name}...")
                self.model = SentenceTransformer(self.model_name)
                logger.info("Successfully loaded local SentenceTransformers model.")
            except Exception as e:
                logger.error(f"Could not load local embedding model: {e}")

    def encode(self, text: str) -> List[float]:
        """
        Encodes a single text string into a float vector.
        """
        return self.encode_batch([text])[0]

    def encode_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Encodes a batch of texts into float vectors.
        """
        if not texts:
            return []

        if self.model is not None:
            try:
                embeddings = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
                return [emb.tolist() for emb in embeddings]
            except Exception as e:
                logger.error(f"Local embedding encode failed: {e}")

        # Fallback / Simulation vector generation for local testing without downloading heavy models if failed
        logger.info(f"Using deterministic hash-based mock embeddings ({settings.EMBEDDING_DIMENSION} dimensions)...")
        dim = settings.EMBEDDING_DIMENSION
        mock_embeddings = []
        for text in texts:
            # Deterministic pseudo-random vector from a stable hash (built-in hash()
            # is randomized per process, which would break cross-process consistency)
            seed = int(hashlib.md5(text.encode("utf-8")).hexdigest()[:8], 16)
            rng = np.random.RandomState(seed)
            vec = rng.randn(dim)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            mock_embeddings.append(vec.tolist())
        return mock_embeddings


embedding_service = EmbeddingService()
