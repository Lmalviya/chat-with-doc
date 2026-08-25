import os
from urllib.parse import quote_plus
from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    environment: str = os.getenv("APP_ENVIRONMENT", "development")

    model_config = SettingsConfigDict(
        env_file=(".env", str(ENV_PATH)),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    DATABASE_PROJECT_REF: str = ""
    DATABASE_PASSWORD: str = ""
    DATABASE_REGION: str = ""
    DATABASE_HOST: str = ""
    DATABASE_PORT: int = 5432
    DATABASE_NAME: str = ""

    # ── S3-Compatible Object Storage (Supabase S3, Cloudflare R2, AWS S3, MinIO) ──
    STORAGE_ENDPOINT_URL: str | None = None
    STORAGE_ACCESS_KEY_ID: str | None = None
    STORAGE_SECRET_ACCESS_KEY: str | None = None
    STORAGE_BUCKET_NAME: str = "chat-with-docs"
    STORAGE_REGION: str = "auto"

    # Backward compatibility aliases for R2 if set
    R2_ACCOUNT_ID: str | None = None
    R2_ACCESS_KEY_ID: str | None = None
    R2_SECRET_ACCESS_KEY: str | None = None
    R2_BUCKET_NAME: str | None = None

    # ── LLM APIs ───────────────────────────────────────────────────────────────
    NVIDIA_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None

    # ── LangSmith ──────────────────────────────────────────────────────────────
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_API_KEY: str | None = None
    LANGCHAIN_PROJECT: str = "chat_with_doc"
    LANGCHAIN_ENDPOINT: str = "https://api.smith.langchain.com"
    LANGCHAIN_WORKSPACE_ID: str | None = None
    LANGSMITH_WORKSPACE_ID: str | None = None
    LANGCHAIN_HUB_OWNER: str | None = None
    LANGSMITH_HUB_OWNER: str | None = None

    # ── Supabase Configuration & JWT Authentication ───────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"

    @computed_field
    @property
    def S3_ENDPOINT_URL(self) -> str:
        """Resolves the S3 endpoint URL for Supabase S3, Cloudflare R2, or custom S3."""
        if self.STORAGE_ENDPOINT_URL:
            return self.STORAGE_ENDPOINT_URL.rstrip("/")
        if self.R2_ACCOUNT_ID:
            return f"https://{self.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        if self.DATABASE_PROJECT_REF:
            return f"https://{self.DATABASE_PROJECT_REF}.storage.supabase.co/s3"
        return ""

    @computed_field
    @property
    def S3_ACCESS_KEY_ID(self) -> str:
        return self.STORAGE_ACCESS_KEY_ID or self.R2_ACCESS_KEY_ID or ""

    @computed_field
    @property
    def S3_SECRET_ACCESS_KEY(self) -> str:
        return self.STORAGE_SECRET_ACCESS_KEY or self.R2_SECRET_ACCESS_KEY or ""

    @computed_field
    @property
    def S3_BUCKET_NAME(self) -> str:
        return self.STORAGE_BUCKET_NAME or self.R2_BUCKET_NAME or "chat-with-docs"

    @computed_field
    @property
    def S3_REGION_NAME(self) -> str:
        return self.STORAGE_REGION if self.STORAGE_REGION != "auto" else (self.DATABASE_REGION or "auto")

    @computed_field
    @property
    def SUPABASE_PROJECT_URL(self) -> str:
        if self.SUPABASE_URL:
            return self.SUPABASE_URL.rstrip("/")
        if self.DATABASE_PROJECT_REF:
            return f"https://{self.DATABASE_PROJECT_REF}.supabase.co"
        return ""

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        safe_password = quote_plus(self.DATABASE_PASSWORD)
        user = f"postgres.{self.DATABASE_PROJECT_REF}"
        host = f"aws-0-{self.DATABASE_REGION}.{self.DATABASE_HOST}:{self.DATABASE_PORT}"
        return f"postgresql+asyncpg://{user}:{safe_password}@{host}/{self.DATABASE_NAME}"

    def model_post_init(self, __context) -> None:
        """Propagate settings into os.environ for LangChain & LangSmith SDKs."""
        if self.LANGCHAIN_TRACING_V2:
            os.environ["LANGCHAIN_TRACING_V2"] = "true"
        if self.LANGCHAIN_API_KEY:
            os.environ["LANGCHAIN_API_KEY"] = self.LANGCHAIN_API_KEY
        if self.LANGCHAIN_PROJECT:
            os.environ["LANGCHAIN_PROJECT"] = self.LANGCHAIN_PROJECT
        if self.LANGCHAIN_ENDPOINT:
            os.environ["LANGCHAIN_ENDPOINT"] = self.LANGCHAIN_ENDPOINT
        workspace_id = self.LANGCHAIN_WORKSPACE_ID or self.LANGSMITH_WORKSPACE_ID
        if workspace_id:
            os.environ["LANGCHAIN_WORKSPACE_ID"] = workspace_id
            os.environ["LANGSMITH_WORKSPACE_ID"] = workspace_id
        if self.GEMINI_API_KEY:
            os.environ["GEMINI_API_KEY"] = self.GEMINI_API_KEY
        if self.NVIDIA_API_KEY:
            os.environ["NVIDIA_API_KEY"] = self.NVIDIA_API_KEY


settings = Settings()
