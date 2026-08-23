import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.messages.models import MessageRole, MessageStatus


# ── Request bodies ─────────────────────────────────────────────────────────────

class FollowUpRequest(BaseModel):
    """Body for POST /conversations/{id}/messages"""
    content:   str
    parent_id: uuid.UUID | None = None


# ── Response ───────────────────────────────────────────────────────────────────

class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:              uuid.UUID
    conversation_id: uuid.UUID
    request_id:      uuid.UUID
    parent_id:       uuid.UUID | None
    role:            MessageRole
    content:         str
    status:          MessageStatus
    created_at:      datetime
