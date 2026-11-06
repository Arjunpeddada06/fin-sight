"""Gemini chat-completion client using Google's official Gen AI SDK."""
import logging
from typing import Any, Protocol

from google import genai
from google.genai import types

from app.config import Settings, get_settings

log = logging.getLogger(__name__)


class LLMError(Exception):
    """User-readable LLM failure (missing config, bad key, quota, network...)."""


class LLM(Protocol):
    async def complete(self, messages: list[dict[str, str]], *, temperature: float = 0.0) -> str: ...


class GeminiLLM:
    def __init__(self, settings: Settings | None = None, client: Any | None = None) -> None:
        self.settings = settings or get_settings()
        self._client = client

    def _get_client(self) -> Any:
        s = self.settings
        if not s.llm_model:
            raise LLMError("LLM_MODEL is not set. Add the Gemini chat model name to .env and restart the backend.")
        if not s.gemini_api_key:
            raise LLMError("GEMINI_API_KEY is not set. Add it to .env and restart the backend.")
        if self._client is None:
            self._client = genai.Client(api_key=s.gemini_api_key)
        return self._client

    async def complete(self, messages: list[dict[str, str]], *, temperature: float = 0.0) -> str:
        client = self._get_client()
        system_parts: list[str] = []
        contents: list[types.Content] = []

        for message in messages:
            role = (message.get("role") or "user").lower()
            content = (message.get("content") or "").strip()
            if not content:
                continue
            if role == "system":
                system_parts.append(content)
                continue
            gemini_role = "model" if role in {"assistant", "model"} else "user"
            contents.append(types.Content(role=gemini_role, parts=[types.Part.from_text(text=content)]))

        if not contents:
            raise LLMError("No user or assistant message was provided to the LLM.")

        config_kwargs: dict[str, Any] = {"temperature": temperature}
        if system_parts:
            config_kwargs["system_instruction"] = "\n\n".join(system_parts)

        try:
            response = await client.aio.models.generate_content(
                model=self.settings.llm_model,
                contents=contents,
                config=types.GenerateContentConfig(**config_kwargs),
            )
        except Exception as exc:
            status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
            detail = str(exc)[:200]
            if status in (401, 403) or "api key" in detail.lower() or "unauthorized" in detail.lower():
                raise LLMError("Gemini rejected the API key. Check GEMINI_API_KEY and its API access.") from exc
            if status == 429 or "quota" in detail.lower() or "rate limit" in detail.lower():
                raise LLMError("The Gemini API rate limit or quota was reached. Wait and retry, or check your Google AI plan.") from exc
            if status == 404 or "not found" in detail.lower():
                raise LLMError(f"Gemini model '{self.settings.llm_model}' was not found. Check LLM_MODEL.") from exc
            if any(term in detail.lower() for term in ("connection", "connect", "timeout", "timed out")):
                raise LLMError("Could not reach the Gemini API. Check the server's internet connection.") from exc
            log.warning("Gemini API error: %s", detail)
            raise LLMError(f"The Gemini API returned an error: {detail}") from exc

        answer = (getattr(response, "text", None) or "").strip()
        if not answer:
            raise LLMError("Gemini returned an empty answer. Try again.")
        return answer


_llm: LLM | None = None


def get_llm() -> LLM:
    global _llm
    if _llm is None:
        _llm = GeminiLLM()
    return _llm


def set_llm(llm: LLM | None) -> None:
    """Replace the process-wide LLM (used by tests; pass None to reset)."""
    global _llm
    _llm = llm
