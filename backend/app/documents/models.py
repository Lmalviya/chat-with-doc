import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import String, Text, Integer, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class FileStatus(str, Enum):
    UPLOADING = "uploading"
    READY     = "ready"
    FAILED    = "failed"


class FileIngestionStatus(str, Enum):
    INCONTEXT = "incontext"
    EMBEDDING = "embedding"


class Documents(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_path:   Mapped[str] = mapped_column(Text, nullable=False)
    file_name:   Mapped[str] = mapped_column(Text, nullable=False)
    file_bytes:  Mapped[int] = mapped_column(Integer, nullable=False)
    file_type:   Mapped[str] = mapped_column(Text, nullable=False)

    file_status:          Mapped[str] = mapped_column(
        String, nullable=False, default=FileStatus.UPLOADING.value
    )
    file_ingestion_status: Mapped[str] = mapped_column(
        String, nullable=False, default=FileIngestionStatus.INCONTEXT.value
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "file_status IN ('uploading', 'ready', 'failed')",
            name="ck_documents_file_status",
        ),
        CheckConstraint(
            "file_ingestion_status IN ('incontext', 'embedding')",
            name="ck_documents_ingestion_status",  # also fixed typo: ingession → ingestion
        ),
    )
