import uuid
from typing import Optional

from app.engine.core.llm.models import title_generator_chain
from app.engine.chat.schemas import TitleResponse
from app.engine.core.prompts import get_prompt, PromptName
from app.engine.core.tracing.callbacks import create_trace_config


async def generate_conversation_title(
    content: str,
    conversation_id: Optional[uuid.UUID] = None,
    request_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
) -> str:
    """
    Generates a concise 3-6 word summary title for a conversation using LLM.
    Falls back gracefully to a truncated content snippet if any error occurs.
    """
    try:
        prompt = get_prompt(PromptName.TITLE)
        chain = title_generator_chain(prompt)

        trace_config = create_trace_config(
            run_name="Title_Generator",
            conversation_id=conversation_id,
            request_id=request_id,
            user_id=user_id,
            tags=["title-generator", "chat"]
        )

        result: TitleResponse = await chain.ainvoke({"query": content}, config=trace_config)
        title = result.title.strip()
        if title:
            return title
    except Exception:
        pass

    # Fallback to truncated string
    return content[:30].strip() or "New Conversation"
