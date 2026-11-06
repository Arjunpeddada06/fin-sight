"""Gemini embedding client using Google's official Gen AI SDK."""
import logging
from typing import Any, Protocol

from google import genai
from google.genai import types

from app.config import Settings, get_settings

log = logging.getLogger(__name__)


class EmbeddingError(Exception):
    """User-readable embedding failure (missing config, bad key, network, wrong dimension...)."""


class Embedder(Protocol):
    async def embed(self, texts: list[str], *, task_type: str = "RETRIEVAL_DOCUMENT") -> list[list[float]]: ...


class GeminiEmbedder:
    def __init__(self, settings: Settings | None = None, client: Any | None = None) -> None:
        self.settings = settings or get_settings()
        self._client = client

    def _get_client(self) -> Any:
        s = self.settings
        if not s.embedding_model:
            raise EmbeddingError("EMBEDDING_MODEL is not set. Add the Gemini embedding model name to .env and restart the backend.")
        if not s.gemini_api_key:
            raise EmbeddingError("GEMINI_API_KEY is not set. Add it to .env and restart the backend.")
        if self._client is None:
            self._client = genai.Client(api_key=s.gemini_api_key)
        return self._client

    async def embed(self, texts: list[str], *, task_type: str = "RETRIEVAL_DOCUMENT") -> list[list[float]]:
        if not texts:
            return []
        if task_type not in {"RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"}:
            raise EmbeddingError(f"Unsupported embedding task type: {task_type}")

        client = self._get_client()
        size = max(1, self.settings.embedding_batch_size)
        vectors: list[list[float]] = []
        for start in range(0, len(texts), size):
            batch = texts[start:start + size]
            vectors.extend(await self._embed_batch(client, batch, task_type))
        return vectors

    async def _embed_batch(self, client: Any, batch: list[str], task_type: str) -> list[list[float]]:
        s = self.settings
        try:
            response = await client.aio.models.embed_content(
                model=s.embedding_model,
                contents=batch,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=s.embedding_dimensions,
                ),
            )
        except Exception as exc:
            status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
            detail = str(exc)[:200]
            if status in (401, 403) or "api key" in detail.lower() or "unauthorized" in detail.lower():
                raise EmbeddingError("Gemini rejected the API key. Check GEMINI_API_KEY and its API access.") from exc
            if status == 429 or "quota" in detail.lower() or "rate limit" in detail.lower():
                raise EmbeddingError("The Gemini embedding API rate limit or quota was reached. Wait and retry.") from exc
            if status == 404 or "not found" in detail.lower():
                raise EmbeddingError(f"Embedding model '{s.embedding_model}' was not found. Check EMBEDDING_MODEL.") from exc
            if any(term in detail.lower() for term in ("connection", "connect", "timeout", "timed out")):
                raise EmbeddingError("Could not reach the Gemini embedding API. Check the server's internet connection.") from exc
            log.warning("Gemini embedding API error: %s", detail)
            raise EmbeddingError(f"The Gemini embedding API returned an error: {detail}") from exc

        items = getattr(response, "embeddings", None) or []
        if len(items) != len(batch):
            raise EmbeddingError("Gemini returned a different number of vectors than requested.")
        out: list[list[float]] = []
        for item in items:
            values = getattr(item, "values", None)
            if values is None:
                raise EmbeddingError("Gemini returned an embedding without vector values.")
            vector = [float(value) for value in values]
            if len(vector) != s.embedding_dimensions:
                raise EmbeddingError(
                    f"Gemini returned {len(vector)}-dimension vectors but PostgreSQL expects {s.embedding_dimensions}. "
                    "Keep EMBEDDING_DIMENSIONS aligned with the document_chunks vector column; do not drop the database."
                )
            out.append(vector)
        return out


_embedder: Embedder | None = None


def get_embedder() -> Embedder:
    global _embedder
    if _embedder is None:
        _embedder = GeminiEmbedder()
    return _embedder


def set_embedder(embedder: Embedder | None) -> None:
    """Replace the process-wide embedder (used by tests; pass None to reset)."""
    global _embedder
    _embedder = embedder
