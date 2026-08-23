from pydantic import BaseModel

class ModelConfig(BaseModel):
    model_name: str
    temperature: float
    top_p: float = 0.95
    max_retries: int = 0
    timeout: float = 30.0
    streaming: bool = False

REWRITER_PRIMARY_CONFIG = ModelConfig(
    model_name="gemini-3.6-flash",
    temperature=0.1
)

REWRITER_FALLBACK_CONFIG = ModelConfig(
    model_name="nvidia/nemotron-3.5-lightning-30b-a3b",
    temperature=0.1
)

GENERATOR_PRIMARY_CONFIG = ModelConfig(
    model_name="gemini-3.6-flash",
    temperature=0.3,
    streaming=True
)

GENERATOR_FALLBACK_CONFIG = ModelConfig(
    model_name="nvidia/nemotron-3.5-lightning-30b-a3b",
    temperature=0.3,
    streaming=True
)

TITLE_GENERATOR_PRIMARY_CONFIG = ModelConfig(
    model_name="gemini-3.6-flash",
    temperature=0.2
)

TITLE_GENERATOR_FALLBACK_CONFIG = ModelConfig(
    model_name="nvidia/nemotron-3.5-lightning-30b-a3b",
    temperature=0.2
)


