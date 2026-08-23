import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.messages.schemas import MessageOut


# ── Request bodies ─────────────────────────────────────────────────────────────

class CreateConversationRequest(BaseModel):
    """Body for POST /conversations — first message, creates the conversation."""
    content: str


class UpdateTitleRequest(BaseModel):
    title: str


class GenerateTitleRequest(BaseModel):
    content: str 


# ── Response bodies ────────────────────────────────────────────────────────────

class GenerateTitleResponse(BaseModel):
    title:           str
    conversation_id: uuid.UUID


class ConversationOut(BaseModel):
    """Lightweight conversation summary — used in sidebar list."""
    model_config = ConfigDict(from_attributes=True)

    id:         uuid.UUID
    title:      str | None
    updated_at: datetime


class ConversationDetailResponse(BaseModel):
    """Returned by GET /conversations/{id} — full conversation with paginated messages."""
    conversation: ConversationOut
    messages:     list[MessageOut]
