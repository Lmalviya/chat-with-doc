from typing import Type, Optional
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_nvidia_ai_endpoints import ChatNVIDIA

from app.core.config import settings
from app.engine.core.llm.model_config import ModelConfig


def get_gemini_chat(model_config: ModelConfig):
    return ChatGoogleGenerativeAI(
        model=model_config.model_name,
        api_key=settings.GEMINI_API_KEY,
        temperature=model_config.temperature,
        top_p=model_config.top_p,
        max_retries=model_config.max_retries,
        timeout=model_config.timeout,
        streaming=model_config.streaming,
    )


def get_nvidia_chat(model_config: ModelConfig):
    return ChatNVIDIA(
        model=model_config.model_name,
        nvidia_api_key=settings.NVIDIA_API_KEY,
        temperature=model_config.temperature,
        top_p=model_config.top_p,
    )


def get_chat_model(
    model_config: ModelConfig,
    with_structured_output: bool = False,
    schema: Optional[Type[BaseModel]] = None,
): 
    if with_structured_output and schema is None:
        raise ValueError("Schema is required when with_structured_output is True")
    
    if "gemini" in model_config.model_name.lower():
        model = get_gemini_chat(model_config)
    elif "nvidia" in model_config.model_name:
        model = get_nvidia_chat(model_config)
    else:
        raise ValueError(f"Model {model_config.model_name} not found")

    if with_structured_output:
        model = model.with_structured_output(schema)
    
    return model



