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

    OBJECT_STORAGE_KEY_ID: str | None = None
    OBJECT_STORAGE_SECRET_KEY: str | None = None
    OBJECT_STORAGE_ENDPOINT_URL: str | None = None
    OBJECT_STORAGE_NAME: str | None = None

    NVIDIA_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None

    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_API_KEY: str | None = None
    LANGCHAIN_PROJECT: str = "chat_with_doc"
    LANGCHAIN_ENDPOINT: str = "https://api.smith.langchain.com"
    LANGCHAIN_WORKSPACE_ID: str | None = None
    LANGSMITH_WORKSPACE_ID: str | None = None
    LANGCHAIN_HUB_OWNER: str | None = None
    LANGSMITH_HUB_OWNER: str | None = None

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        # URL encode password so special characters like '@' don't break the URI
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
