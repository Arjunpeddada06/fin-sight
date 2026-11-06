import pytest

from app.config import Settings
from app.rag.llm import GeminiLLM, LLMError


class _Response:
    def __init__(self, text):
        self.text = text


class _Models:
    def __init__(self, replies):
        self.replies, self.calls = list(replies), []

    async def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        result = self.replies.pop(0)
        if isinstance(result, Exception):
            raise result
        return _Response(result)


class _FakeClient:
    def __init__(self, replies):
        self.models = _Models(replies)
        self.aio = type("Async", (), {"models": self.models})()


def _settings(**kw):
    return Settings(_env_file=None, **{**dict(gemini_api_key="test-key", llm_model="gemini-test"), **kw})


async def test_missing_config_is_explained():
    with pytest.raises(LLMError, match="LLM_MODEL"):
        await GeminiLLM(_settings(llm_model="")).complete([{"role": "user", "content": "x"}])
    with pytest.raises(LLMError, match="GEMINI_API_KEY"):
        await GeminiLLM(_settings(gemini_api_key="")).complete([{"role": "user", "content": "x"}])


async def test_returns_trimmed_text_and_sends_temperature():
    client = _FakeClient(["  hello  "])
    messages = [{"role": "system", "content": "Be precise."}, {"role": "user", "content": "Hi"}]
    assert await GeminiLLM(_settings(), client).complete(messages) == "hello"
    call = client.models.calls[0]
    assert call["model"] == "gemini-test"
    assert call["config"].temperature == 0.0
    assert call["config"].system_instruction == "Be precise."
    assert call["contents"][0].role == "user"


async def test_assistant_role_maps_to_gemini_model_role():
    client = _FakeClient(["ok"])
    messages = [{"role": "assistant", "content": "Earlier answer"}, {"role": "user", "content": "Continue"}]
    await GeminiLLM(_settings(), client).complete(messages)
    assert client.models.calls[0]["contents"][0].role == "model"


async def test_api_errors_are_translated():
    class ApiError(Exception):
        code = 429

    with pytest.raises(LLMError, match="rate limit or quota"):
        await GeminiLLM(_settings(), _FakeClient([ApiError("quota exceeded")])).complete([{"role": "user", "content": "x"}])


async def test_empty_answer_is_an_error():
    with pytest.raises(LLMError, match="empty"):
        await GeminiLLM(_settings(), _FakeClient(["   "])).complete([{"role": "user", "content": "x"}])
