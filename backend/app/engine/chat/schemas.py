from pydantic import BaseModel, Field

class RewriteDecision(BaseModel):
    """Output schema for the query rewriter / router agent."""

    need_retrieval: bool = Field(description="True if external document retrieval is needed, False for greetings, small talk, or conversational meta-queries.")
    query: str = Field(default="", description="The rewritten standalone search query. Empty string if need_retrieval is False.")

class TitleResponse(BaseModel):
    """Output schema for the conversation title generator."""
    title: str = Field(description="Concise 3-6 word summary title for the chat")
