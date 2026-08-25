import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.documents.models import FileStatus, FileIngestionStatus


class DocumentSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    file_path: str
    file_name: str
    file_bytes: int
    file_type: str
    file_status: str
    file_ingestion_status: str
    created_at: datetime
    updated_at: datetime


class DocumentCreateSchema(BaseModel):
    file_name: str
    file_bytes: int
    file_type: str
    file_path: str | None = None
    file_status: FileStatus = FileStatus.UPLOADING
    file_ingestion_status: FileIngestionStatus = FileIngestionStatus.INCONTEXT


class DocumentListResponse(BaseModel):
    conversation_id: uuid.UUID
    documents: list[DocumentSchema]


class DocumentUpdateSchema(BaseModel):
    file_status: FileStatus | None = None
    file_ingestion_status: FileIngestionStatus | None = None


class DocumentBatchUploadSchema(BaseModel):
    files: list[DocumentCreateSchema]


class DocumentBatchDeleteSchema(BaseModel):
    document_ids: list[uuid.UUID] = []


class DocumentBatchUpdateSchema(BaseModel):
    document_ids: list[uuid.UUID]
    file_status: FileStatus | None = None
    file_ingestion_status: FileIngestionStatus | None = None


class DocumentPresignRequest(BaseModel):
    file_name: str
    file_bytes: int
    file_type: str
    file_hash: str | None = None

class DocumentPresignResponse(BaseModel):
    document_id: uuid.UUID
    upload_url: str
    file_path: str
    is_duplicate: bool
    file_status: str
    