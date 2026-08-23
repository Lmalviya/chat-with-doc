import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.core.users import Users
from app.core.storage import storage
from app.conversations.service import ConversationRepository
from app.documents.doc_verifier import file_verify
from app.documents.service import DocumentService
from app.documents.models import FileStatus, FileIngestionStatus
from app.documents.schemas import (
    DocumentPresignRequest,
    DocumentPresignResponse,
)

document_router = APIRouter(
    prefix="/{conversation_id}/documents",
    tags=["Document"],
)


@document_router.post("/presign", response_model=DocumentPresignResponse)
async def request_presigned_upload(
    conversation_id: Annotated[uuid.UUID, Path()],
    payload: DocumentPresignRequest,
    user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Verify user owns this conversation
    conv_repo = ConversationRepository(db)
    await conv_repo.get_by_id(conversation_id, user.id)

    # 2. Verify file constraints (size & allowed mime type)
    file_verify(
        file_size=payload.file_bytes,
        file_type=payload.file_type,
        file_hash=payload.file_hash,
    )

    # 3. Generate deterministic S3/R2 key & presigned PUT upload URL
    new_doc_id = uuid.uuid4()
    r2_key = f"documents/{user.id}/{conversation_id}/{new_doc_id}/{payload.file_name}"
    upload_url = await storage.generate_presigned_upload_url(
        key=r2_key,
        content_type=payload.file_type,
    )

    # 4. Save document record in PostgreSQL with status 'uploading'
    doc_service = DocumentService(db)
    doc = await doc_service.repo.add(
        conversation_id=conversation_id,
        doc_id=new_doc_id,
        file_path=r2_key,
        file_name=payload.file_name,
        file_bytes=payload.file_bytes,
        file_type=payload.file_type,
        file_status=FileStatus.UPLOADING.value,
        file_ingestion_status=FileIngestionStatus.INCONTEXT.value,
    )

    return DocumentPresignResponse(
        document_id=doc.id,
        upload_url=upload_url,
        file_path=r2_key,
        is_duplicate=False,
        file_status=doc.file_status,
    )