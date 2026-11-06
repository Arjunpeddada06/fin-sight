from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from environment variables (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str = ""
    llm_model: str = ""
    embedding_model: str = ""
    embedding_dimensions: int = 1536

    database_url: str = "postgresql+asyncpg://finsight:change-me@localhost:5432/finsight"
    frontend_url: str = "http://localhost:5173"
    upload_dir: str = "/data/uploads"
    max_upload_mb: int = 50

    # Question answering
    retrieval_top_k: int = 8
    history_messages: int = 6

    # Chunking (token counts are estimates, see rag/chunking.py)
    chunk_target_tokens: int = 800
    chunk_max_tokens: int = 1000
    chunk_min_tokens: int = 80
    chunk_overlap_tokens: int = 100
    embedding_batch_size: int = 64


@lru_cache
def get_settings() -> Settings:
    return Settings()
