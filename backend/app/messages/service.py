import uuid
from sqlalchemy import select, insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.messages.models import Messages, MessageRole, MessageStatus
from app.messages.exceptions import DuplicateRequest


class MessageRepository:
    """Data access for the messages table. No business logic here."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_request_id(self, request_id: uuid.UUID) -> Messages | None:
        """Idempotency check — returns existing message if this request was already processed."""
        stmt = select(Messages).where(Messages.request_id == request_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def add(
        self,
        conversation_id: uuid.UUID,
        request_id:      uuid.UUID,
        role:            str,
        content:         str,
        parent_id:       uuid.UUID | None = None,
        status:          str = MessageStatus.COMPLETE.value,
    ) -> Messages:
        stmt = (
            insert(Messages)
            .values(
                conversation_id=conversation_id,
                request_id=request_id,
                role=role,
                content=content,
                parent_id=parent_id,
                status=status,
            )
            .returning(Messages)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.scalar_one()

    async def get_by_conversation(
        self,
        conversation_id: uuid.UUID,
        limit:           int = 50,
        before_id:       uuid.UUID | None = None,
    ) -> list[Messages]:
        """
        Cursor-based pagination — returns `limit` messages before `before_id`.
        If before_id is None, returns the most recent `limit` messages.
        """
        stmt = select(Messages).where(Messages.conversation_id == conversation_id)

        if before_id is not None:
            # Fetch the created_at of the cursor message, then filter
            cursor_stmt = select(Messages.created_at).where(Messages.id == before_id)
            cursor_result = await self.db.execute(cursor_stmt)
            cursor_time = cursor_result.scalar_one_or_none()
            if cursor_time:
                stmt = stmt.where(Messages.created_at < cursor_time)

        stmt = stmt.order_by(Messages.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        # Return in chronological order (oldest first)
        return list(reversed(result.scalars().all()))


class MessageService:
    """
    Business logic for messages.
    Orchestrates: idempotency check → save message → (AI call placeholder).
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = MessageRepository(db)

    async def save_user_message(
        self,
        conversation_id: uuid.UUID,
        request_id:      uuid.UUID | None,
        content:         str,
        parent_id:       uuid.UUID | None = None,
    ) -> Messages:
        # Idempotency guard
        if request_id is not None:
            existing = await self.repo.get_by_request_id(request_id)
            if existing is not None:
                raise DuplicateRequest()

        # Generate a request_id if the client didn't provide one
        effective_request_id = request_id or uuid.uuid4()

        return await self.repo.add(
            conversation_id=conversation_id,
            request_id=effective_request_id,
            role=MessageRole.USER.value,
            content=content,
            parent_id=parent_id,
        )

    async def save_assistant_message(
        self,
        conversation_id: uuid.UUID,
        content:         str,
        parent_id:       uuid.UUID | None = None,
        status:          str = MessageStatus.COMPLETE.value,
    ) -> Messages:
        return await self.repo.add(
            conversation_id=conversation_id,
            request_id=uuid.uuid4(),   # server-generated, no idempotency needed for AI responses
            role=MessageRole.ASSISTANT.value,
            content=content,
            parent_id=parent_id,
            status=status,
        )

    async def get_history(
        self,
        conversation_id: uuid.UUID,
        limit:           int = 50,
        before_id:       uuid.UUID | None = None,
    ) -> list[Messages]:
        return await self.repo.get_by_conversation(conversation_id, limit, before_id)
