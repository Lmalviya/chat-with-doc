import logging
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.core.config import settings

logger = logging.getLogger("app.rag.embedder")


EMBEDDING_MODEL_NAME: str = "models/gemini-embedding-001"
EMBEDDING_DIMENSION: int = 768

def get_embedding_model() -> GoogleGenerativeAIEmbeddings:
    """Returns a configured GoogleGenerativeAIEmbeddings instance."""
    return GoogleGenerativeAIEmbeddings(
        model=EMBEDDING_MODEL_NAME,
        google_api_key=settings.GEMINI_API_KEY
    )
