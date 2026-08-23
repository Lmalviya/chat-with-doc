import uuid
import json
from typing import AsyncIterator
from sqlalchemy import select, insert, update
from sqlalchemy.ext.asyncio import AsyncSession

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from app.messages.models import Messages, MessageRole
from app.engine.chat.graph import stream_rag_chat
from app.engine.chat.title import generate_conversation_title

import logging
from app.core.logging import conversation_id_ctx
from app.conversations.models import Conversations
from app.conversations.exceptions import ConversationNotFound, ConversationForbidden, EmptyContentError
from app.messages.service import MessageService

logger = logging.getLogger("app.conversations.service")


def _to_langchain_message(db_messages: list[Messages]) -> list[BaseMessage]:
    lc_messages: list[BaseMessage] = []
    for msg in db_messages:
        if msg.role == MessageRole.USER.value or msg.role == "user":
            lc_messages.append(HumanMessage(content=msg.content))
        elif msg.role == MessageRole.ASSISTANT.value or msg.role == "assistant":
            lc_messages.append(AIMessage(content=msg.content))

    return lc_messages            

# ── Repository ─────────────────────────────────────────────────────────────────

class ConversationRepository:
    """Data access for the conversations table. No business logic here."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, user_id: uuid.UUID) -> Conversations:
        """Creates a conversation with title=None. Title is generated later by a background task/API."""
        stmt = (
            insert(Conversations)
            .values(user_id=user_id, title=None)
            .returning(Conversations)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.scalar_one()

    async def get_all(self, user_id: uuid.UUID) -> list[Conversations]:
        stmt = (
            select(Conversations)
            .where(Conversations.user_id == user_id)
            .order_by(Conversations.updated_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(
        self, conversation_id: uuid.UUID, user_id: uuid.UUID
    ) -> Conversations:
        stmt = select(Conversations).where(Conversations.id == conversation_id)
        result = await self.db.execute(stmt)
        conv = result.scalar_one_or_none()

        if conv is None:
            raise ConversationNotFound()
        if conv.user_id != user_id:
            raise ConversationForbidden()

        return conv

    async def update_title(
        self, conversation_id: uuid.UUID, title: str
    ) -> Conversations:
        stmt = (
            update(Conversations)
            .where(Conversations.id == conversation_id)
            .values(title=title)
            .returning(Conversations)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.scalar_one()

    async def delete(self, conv: Conversations) -> None:
        await self.db.delete(conv)
        await self.db.commit()


# ── Service ────────────────────────────────────────────────────────────────────

class ConversationService:
    """
    Orchestrates the full flow of starting and continuing conversations.
    Coordinates ConversationRepository and MessageService.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.conv_repo = ConversationRepository(db)
        self.msg_service = MessageService(db)
    
    async def generate_title(
        self, 
        user_id:         uuid.UUID, 
        conversation_id: uuid.UUID, 
        request_id:      uuid.UUID | None,
        content:         str
    ) -> Conversations:
        if not content or not content.strip():
            raise EmptyContentError()

        # Verify conversation exists and belongs to the user
        await self.conv_repo.get_by_id(conversation_id, user_id)

        # Generate title using the engine agent
        gen_title = await generate_conversation_title(
            content=content,
            conversation_id=conversation_id,
            request_id=request_id,
            user_id=user_id,
        )
        
        convo = await self.conv_repo.update_title(conversation_id, gen_title)
        return convo


    async def start_conversation_stream(
        self,
        user_id:    uuid.UUID,
        request_id: uuid.UUID | None,
        content:    str,
    ) -> AsyncIterator[str]:
        conv_token = None
        try:
            # 1. Create conversation & save user message
            conv = await self.conv_repo.create(user_id)
            conv_token = conversation_id_ctx.set(str(conv.id))
            logger.info(f"Created conversation {conv.id} for user {user_id}")

            user_msg = await self.msg_service.save_user_message(
                conversation_id=conv.id,
                request_id=request_id,
                content=content,
            )

            # 2. Emit conversation_id immediately
            meta_event = {
                "type": "meta",
                "conversation_id": str(conv.id),
                "user_message_id": str(user_msg.id)
            }
            yield f"data: {json.dumps(meta_event)}\n\n"

            # 3. Stream LLM chunks
            full_assistant_reply = ""
            lc_messages = [HumanMessage(content=content)]

            async for event in stream_rag_chat(
                messages=lc_messages,
                conversation_id=conv.id,
                request_id=request_id,
                user_id=user_id
            ):
                if event["type"] == "chunk":
                    full_assistant_reply += str(event.get("delta", ""))
                
                yield f"data: {json.dumps(event)}\n\n"
                
            
            # 4. Save assistant response to DB
            assistant_msg = await self.msg_service.save_assistant_message(
                conversation_id=conv.id,
                content=full_assistant_reply.strip(),
                parent_id=user_msg.id,
            )

            # 5. Emit done event
            done_event = {
                "type": "done",
                "message_id": str(assistant_msg.id),
                "conversation_id": str(conv.id)
            }
            yield f"data: {json.dumps(done_event)}\n\n"

        except Exception as exc:
            logger.exception("Error in start_conversation_stream: %s", exc)
            error_message = str(getattr(exc, "detail", None) or getattr(exc, "message", None) or "Failed to generate response. Please try again.")
            error_event = {
                "type": "error",
                "message": error_message,
            }
            yield f"data: {json.dumps(error_event)}\n\n"
        finally:
            if conv_token is not None:
                conversation_id_ctx.reset(conv_token)

    async def send_follow_up_stream(
        self,
        conversation_id: uuid.UUID,
        user_id:         uuid.UUID,
        request_id:      uuid.UUID | None,
        content:         str,
        parent_id:       uuid.UUID | None = None,
    ) -> AsyncIterator[str]:
        try:
            await self.conv_repo.get_by_id(conversation_id, user_id)

            user_msg = await self.msg_service.save_user_message(
                conversation_id=conversation_id,
                request_id=request_id,
                content=content,
                parent_id=parent_id,
            )

            db_history = await self.msg_service.get_history(
                conversation_id,
                limit=20,
            )
            lc_messages = _to_langchain_message(db_history)

            # Stream LLM chunks
            full_assistant_reply = ""
            async for event in stream_rag_chat(
                messages=lc_messages,
                conversation_id=conversation_id,
                request_id=request_id,
                user_id=user_id
            ):
                if event["type"] == "chunk":
                    full_assistant_reply += str(event.get("delta", ""))
                
                yield f"data: {json.dumps(event)}\n\n"

            # Save assistant message to DB
            assistant_msg = await self.msg_service.save_assistant_message(
                conversation_id=conversation_id,
                content=full_assistant_reply.strip(),
                parent_id=user_msg.id,
            )

            done_event = {
                "type": "done",
                "message_id": str(assistant_msg.id),
                "conversation_id": str(conversation_id)
            }
            yield f"data: {json.dumps(done_event)}\n\n"
        except Exception as exc:
            import logging
            logging.getLogger(__name__).exception("Error in send_follow_up_stream: %s", exc)
            error_message = str(getattr(exc, "detail", None) or getattr(exc, "message", None) or "Failed to generate response. Please try again.")
            error_event = {
                "type": "error",
                "message": error_message,
            }
            yield f"data: {json.dumps(error_event)}\n\n"
