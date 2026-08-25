import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user_id, get_request_id, get_validated_conversation
from app.conversations.service import ConversationService
from app.messages.service import MessageService
from app.messages.schemas import FollowUpRequest, MessageOut

messages_router = APIRouter(
    prefix="/conversations/{conversation_id}/messages",
    tags=["messages"],
    dependencies=[Depends(get_validated_conversation)],  # 👈 Enforces conversation ownership on all message endpoints
)


@messages_router.post("/")
async def send_message(
    payload:         FollowUpRequest,
    conversation_id: Annotated[uuid.UUID, Path()],
    user_id:         uuid.UUID = Depends(get_current_user_id),
    request_id:      uuid.UUID | None = Depends(get_request_id),
    db:              AsyncSession = Depends(get_db),
):
    """
    Send a follow-up message to an existing conversation and stream back the assistant response.
    SSE events:
      1. {"type": "chunk", "delta": "..."}
      2. {"type": "done", "message_id": "...", "conversation_id": "..."}
    """
    service = ConversationService(db)
    return StreamingResponse(
        service.send_follow_up_stream(
            conversation_id=conversation_id,
            user_id=user_id,
            request_id=request_id,
            content=payload.content,
            parent_id=payload.parent_id,
        ),
        media_type="text/event-stream",
    )


@messages_router.get("/", response_model=list[MessageOut])
async def get_messages(
    conversation_id: Annotated[uuid.UUID, Path()],
    limit:           int = Query(default=50, ge=1, le=100),
    before_id:       uuid.UUID | None = Query(default=None),
    db:              AsyncSession = Depends(get_db),
):
    """
    Load conversation history with cursor-based pagination.
    - First load: omit before_id → returns the 50 most recent messages
    - Load older: pass before_id=<oldest_message_id_on_screen>
    """
    msg_service = MessageService(db)
    return await msg_service.get_history(conversation_id, limit, before_id)
