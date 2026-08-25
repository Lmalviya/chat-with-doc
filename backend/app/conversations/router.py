import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user_id, get_request_id
from app.conversations.service import ConversationRepository, ConversationService
from app.conversations.schemas import (
    CreateConversationRequest,
    UpdateTitleRequest,
    ConversationOut,
    ConversationDetailResponse,
    GenerateTitleRequest,
    GenerateTitleResponse,
)
from app.messages.service import MessageService

conversations_router = APIRouter(
    prefix="/conversations",
    tags=["conversations"],
)


@conversations_router.post("/{conversation_id}/title/generate", response_model=GenerateTitleResponse)
async def generate_title(
    payload:         GenerateTitleRequest,
    conversation_id: Annotated[uuid.UUID, Path()],
    user_id:         uuid.UUID = Depends(get_current_user_id),
    request_id:      uuid.UUID | None = Depends(get_request_id),
    db:              AsyncSession = Depends(get_db),
):
    """
    Generate title using LLM in parallel with the first conversation message.
    Updates the conversation record in database and returns the generated title.
    """
    service = ConversationService(db)
    conv = await service.get_or_generate_title(
        conversation_id=conversation_id,
        user_id=user_id,
        request_id=request_id,
        first_message_content=payload.content,
    )

    return GenerateTitleResponse(
        title=conv.title or "",
        conversation_id=conv.id,
    )


@conversations_router.post("/draft", response_model=ConversationOut)
async def create_empty_conversation(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db:      AsyncSession = Depends(get_db),
):
    """
    Creates an empty conversation record in database so documents can be attached
    before sending the first message.
    """
    repo = ConversationRepository(db)
    conv = await repo.create(user_id)
    return ConversationOut.model_validate(conv)


@conversations_router.post("/")
async def start_conversation(
    payload:    CreateConversationRequest,
    user_id:    uuid.UUID = Depends(get_current_user_id),
    request_id: uuid.UUID | None = Depends(get_request_id),
    db:         AsyncSession = Depends(get_db),
):
    """
    Send the first message — creates the conversation and streams back the assistant response.
    SSE events:
      1. {"type": "meta", "conversation_id": "...", "user_message_id": "..."}
      2. {"type": "chunk", "delta": "..."}
      3. {"type": "done", "message_id": "...", "conversation_id": "..."}
    """
    service = ConversationService(db)
    return StreamingResponse(
        service.start_conversation_stream(
            user_id=user_id,
            request_id=request_id,
            content=payload.content,
        ),
        media_type="text/event-stream",
    )


@conversations_router.get("/", response_model=list[ConversationOut])
async def list_conversations(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db:      AsyncSession = Depends(get_db),
):
    """Return all conversations for the current user, newest first (for sidebar)."""
    repo = ConversationRepository(db)
    rows = await repo.list_by_user(user_id)
    return [ConversationOut.model_validate(r) for r in rows]


@conversations_router.get("/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: Annotated[uuid.UUID, Path()],
    user_id:         uuid.UUID = Depends(get_current_user_id),
    db:              AsyncSession = Depends(get_db),
):
    """Return conversation metadata + initial message history (50 most recent)."""
    repo = ConversationRepository(db)
    conv = await repo.get_by_id(conversation_id, user_id)

    msg_service = MessageService(db)
    messages = await msg_service.get_history(conversation_id)

    return ConversationDetailResponse(
        conversation=ConversationOut.model_validate(conv),
        messages=messages,
    )


@conversations_router.patch("/{conversation_id}", response_model=ConversationOut)
async def update_title(
    conversation_id: Annotated[uuid.UUID, Path()],
    payload:         UpdateTitleRequest,
    user_id:         uuid.UUID = Depends(get_current_user_id),
    db:              AsyncSession = Depends(get_db),
):
    """Rename a conversation manually."""
    repo = ConversationRepository(db)
    await repo.get_by_id(conversation_id, user_id)
    conv = await repo.update_title(conversation_id, payload.title)
    return ConversationOut.model_validate(conv)


@conversations_router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_conversation(
    conversation_id: Annotated[uuid.UUID, Path()],
    user_id:         uuid.UUID = Depends(get_current_user_id),
    db:              AsyncSession = Depends(get_db),
):
    """
    Delete a conversation and all its messages, documents, Object Storage files, and Qdrant vectors.
    """
    from app.core.storage import storage
    from app.documents.service import DocumentService
    from app.engine.rag.vector.vector_store import VectorService

    repo = ConversationRepository(db)
    await repo.get_by_id(conversation_id, user_id)

    # 1. Fetch attached document storage keys before DB cascade delete
    doc_service = DocumentService(db)
    doc_list = await doc_service.get_documents(conversation_id)
    storage_keys = [doc.file_path for doc in doc_list.documents if doc.file_path]

    # 2. Delete conversation from PostgreSQL (foreign key CASCADE removes messages and documents rows)
    await repo.delete(conversation_id)

    # 3. Clean up files from Object Storage (S3 / Supabase Storage)
    if storage_keys:
        try:
            await storage.delete_file_batch(storage_keys)
        except Exception as e:
            pass

    # 4. Clean up all vector embeddings from Qdrant for this conversation
    try:
        vector_service = VectorService()
        await vector_service.delete_by_conversation_id(conversation_id)
    except Exception as e:
        pass
