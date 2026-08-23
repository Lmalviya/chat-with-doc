from enum import Enum
import logging
from langsmith import Client
from langchain_core.prompts import ChatPromptTemplate

from app.core.config import settings
from app.engine.core.prompts.defaults import (
    DEFAULT_REWRITER_PROMPT,
    DEFAULT_TITLE_PROMPT,
    DEFAULT_GENERATOR_PROMPT
)

logger = logging.getLogger(__name__)


class PromptName(str, Enum):
    REWRITER = "rewrite_decision"
    TITLE = "title_generator"
    GENERATOR = "answer_generation"


_DEFAULT_MAP: dict[str, ChatPromptTemplate] = {
    PromptName.REWRITER.value: DEFAULT_REWRITER_PROMPT,
    PromptName.TITLE.value: DEFAULT_TITLE_PROMPT,
    PromptName.GENERATOR.value: DEFAULT_GENERATOR_PROMPT
}


def get_prompt(prompt_name: str | PromptName) -> ChatPromptTemplate:
    """Fetches prompt template from LangSmith Hub with fallback to local defaults."""
    name_str = prompt_name.value if isinstance(prompt_name, PromptName) else prompt_name
    if name_str not in _DEFAULT_MAP:
        raise ValueError(f"Prompt '{name_str}' not found. Available: {list(_DEFAULT_MAP.keys())}")
    
    fallback = _DEFAULT_MAP[name_str]

    try:
        client = Client()
        owner = settings.LANGCHAIN_HUB_OWNER or settings.LANGSMITH_HUB_OWNER
        prompt_identifier = f"{owner}/{name_str}" if owner else name_str
        pulled = client.pull_prompt(prompt_identifier)
        if hasattr(pulled, "messages"):
            return ChatPromptTemplate.from_messages(pulled.messages)
        return pulled
    except Exception as e:
        logger.warning(f"Failed to fetch prompt '{name_str}' from LangSmith Hub: {e}. Using local default template.")
        return fallback
