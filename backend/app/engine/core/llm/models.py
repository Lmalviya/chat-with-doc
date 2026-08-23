import json
import re
from typing import Type, Any
from pydantic import BaseModel
from langchain_core.prompts import ChatPromptTemplate
# from langchain_core.messages import SystemMessage
# from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.messages import SystemMessage, BaseMessage
from langchain_core.output_parsers import BaseOutputParser
from langchain_core.exceptions import OutputParserException
from langchain_core.runnables import Runnable

from app.engine.core.llm.model_config import (
    REWRITER_PRIMARY_CONFIG,
    REWRITER_FALLBACK_CONFIG,
    GENERATOR_PRIMARY_CONFIG,
    GENERATOR_FALLBACK_CONFIG,
    TITLE_GENERATOR_PRIMARY_CONFIG,
    TITLE_GENERATOR_FALLBACK_CONFIG,
    ModelConfig,
)
from app.engine.core.llm.provider import get_chat_model
from app.engine.chat.schemas import RewriteDecision, TitleResponse


class RobustJsonPydanticParser(BaseOutputParser):
    pydantic_object: Any

    def parse(self, text: str | BaseMessage) -> Any:
        if isinstance(text, BaseMessage):
            text = text.content
        if not isinstance(text, str):
            text = str(text)

        # 1. Remove <think>...</think> tags if present
        clean_text = re.sub(r"<think>[\s\S]*?</think>", "", text).strip()

        # 2. Try markdown json block
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean_text)
        if match:
            json_str = match.group(1).strip()
        else:
            # 3. Try outermost JSON object {...}
            match_obj = re.search(r"(\{[\s\S]*\})", clean_text)
            if match_obj:
                json_str = match_obj.group(1).strip()
            else:
                json_str = clean_text

        try:
            data = json.loads(json_str)
            return self.pydantic_object.model_validate(data)
        except Exception:
            # Safe heuristics if JSON cannot be parsed
            if self.pydantic_object == RewriteDecision:
                return RewriteDecision(need_retrieval=True, retrieval_query=clean_text[:120])
            elif self.pydantic_object == TitleResponse:
                return TitleResponse(title=clean_text.split("\n")[0][:40] or "New Chat")
            raise OutputParserException(f"Failed to parse structured output from model", llm_output=text)


def get_structured_chain_with_fallback(
    prompt: ChatPromptTemplate,
    primary_config: ModelConfig,
    fallback_config: ModelConfig,
    schema: Type[BaseModel],
) -> Runnable:
    # 1. Primary Chain: Gemini with native structured output
    primary_llm = get_chat_model(primary_config, with_structured_output=True, schema=schema)
    primary_chain = prompt | primary_llm

    # 2. Fallback Chain: NVIDIA plain text + RobustJsonPydanticParser
    fallback_llm = get_chat_model(fallback_config, with_structured_output=False)
    parser = RobustJsonPydanticParser(pydantic_object=schema)
    # parser = PydanticOutputParser(pydantic_object=schema)
    fallback_prompt = ChatPromptTemplate.from_messages([
        *prompt.messages,
                # SystemMessage(content="Respond with valid JSON matching this schema. Do not output anything other than valid JSON:\n" + parser.get_format_instructions())
        HumanMessage(content="IMPORTANT: Respond ONLY with a valid JSON object matching this schema. Do not write any conversational text or explanation:\n" + json.dumps(schema.model_json_schema()))
    ])
    fallback_chain = fallback_prompt | fallback_llm | parser

    # 3. Fallback at the chain level
    return primary_chain.with_fallbacks([fallback_chain])


def rewriter_chain(prompt: ChatPromptTemplate) -> Runnable:
    return get_structured_chain_with_fallback(
        prompt=prompt,
        primary_config=REWRITER_PRIMARY_CONFIG,
        fallback_config=REWRITER_FALLBACK_CONFIG,
        schema=RewriteDecision,
    )


def title_generator_chain(prompt: ChatPromptTemplate) -> Runnable:
    return get_structured_chain_with_fallback(
        prompt=prompt,
        primary_config=TITLE_GENERATOR_PRIMARY_CONFIG,
        fallback_config=TITLE_GENERATOR_FALLBACK_CONFIG,
        schema=TitleResponse,
    )


def generator_llm():
    primary_llm = get_chat_model(GENERATOR_PRIMARY_CONFIG, with_structured_output=False)
    fallback_llm = get_chat_model(GENERATOR_FALLBACK_CONFIG, with_structured_output=False)
    return primary_llm.with_fallbacks([fallback_llm])

