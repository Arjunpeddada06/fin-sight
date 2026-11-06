import pytest

from app.config import Settings
from app.rag.embeddings import EmbeddingError, GeminiEmbedder


class _Embedding:
    def __init__(self, values):
        self.values = values


class _Response:
    def __init__(self, embeddings):
        self.embeddings = embeddings


class _Models:
    def __init__(self, dim=8, error=None):
        self.dim, self.error, self.calls = dim, error, []

    async def embed_content(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return _Response([_Embedding([0.1] * self.dim) for _ in kwargs["contents"]])


class _FakeClient:
    def __init__(self, dim=8, error=None):
        self.models = _Models(dim, error)
        self.aio = type("Async", (), {"models": self.models})()


def _settings(**kw):
    base = dict(gemini_api_key="test-key", embedding_model="gemini-embedding-001", embedding_dimensions=8, embedding_batch_size=3)
    return Settings(_env_file=None, **{**base, **kw})


async def test_missing_model_and_key_give_readable_errors():
    with pytest.raises(EmbeddingError, match="EMBEDDING_MODEL"):
        await GeminiEmbedder(_settings(embedding_model="")).embed(["x"])
    with pytest.raises(EmbeddingError, match="GEMINI_API_KEY"):
        await GeminiEmbedder(_settings(gemini_api_key="")).embed(["x"])


async def test_batches_are_split_and_dimension_and_task_type_are_sent():
    client = _FakeClient()
    out = await GeminiEmbedder(_settings(), client).embed([str(i) for i in range(7)])
    assert len(out) == 7
    assert [len(call["contents"]) for call in client.models.calls] == [3, 3, 1]
    assert client.models.calls[0]["config"].output_dimensionality == 8
    assert client.models.calls[0]["config"].task_type == "RETRIEVAL_DOCUMENT"


async def test_query_task_type_is_supported():
    client = _FakeClient()
    await GeminiEmbedder(_settings(), client).embed(["revenue growth"], task_type="RETRIEVAL_QUERY")
    assert client.models.calls[0]["config"].task_type == "RETRIEVAL_QUERY"


async def test_dimension_mismatch_is_explained():
    with pytest.raises(EmbeddingError, match="PostgreSQL expects 8"):
        await GeminiEmbedder(_settings(), _FakeClient(dim=4)).embed(["a"])


async def test_api_errors_are_translated():
    class ApiError(Exception):
        code = 401

    with pytest.raises(EmbeddingError, match="rejected the API key"):
        await GeminiEmbedder(_settings(), _FakeClient(error=ApiError("unauthorized"))).embed(["a"])


async def test_empty_input_makes_no_call():
    client = _FakeClient()
    assert await GeminiEmbedder(_settings(), client).embed([]) == []
    assert client.models.calls == []
