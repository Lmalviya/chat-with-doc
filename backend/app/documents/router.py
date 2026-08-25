import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user_id, get_validated_conversation
from app.core.storage import storage
from app.documents.doc_verifier import file_verify
from app.documents.service import DocumentService
from app.documents.models import FileStatus, FileIngestionStatus
from app.documents.schemas import (
    DocumentPresignRequest,
    DocumentPresignResponse,
    DocumentListResponse,
    DocumentSchema,
    DocumentUpdateSchema,
    DocumentBatchUpdateSchema,
    DocumentBatchDeleteSchema,
)

documents_router = APIRouter(
    prefix="/conversations/{conversation_id}/documents",
    tags=["documents"],
    dependencies=[Depends(get_validated_conversation)],  # 👈 Enforces ownership on ALL document endpoints
)


@documents_router.get("/", response_model=DocumentListResponse)
async def get_document_list(
    conversation_id: Annotated[uuid.UUID, Path()],
    db: AsyncSession = Depends(get_db),
):
    """List all documents attached to this conversation."""
    doc_service = DocumentService(db)
    return await doc_service.get_documents(conversation_id=conversation_id)


@documents_router.get("/{document_id}", response_model=DocumentSchema)
async def get_document_by_id(
    conversation_id: Annotated[uuid.UUID, Path()],
    document_id: Annotated[uuid.UUID, Path()],
    db: AsyncSession = Depends(get_db),
):
    """Retrieve metadata for a single document."""
    doc_service = DocumentService(db)
    return await doc_service.get_document_by_id(
        conversation_id=conversation_id,
        document_id=document_id,
    )


@documents_router.get("/{document_id}/download-url")
async def get_download_presigned_url(
    conversation_id: Annotated[uuid.UUID, Path()],
    document_id: Annotated[uuid.UUID, Path()],
    db: AsyncSession = Depends(get_db),
):
    """Generate a presigned GET URL for viewing or downloading the file directly from Cloudflare R2."""
    doc_service = DocumentService(db)
    doc = await doc_service.get_document_by_id(conversation_id, document_id)
    url = await storage.generate_presigned_download_url(key=doc.file_path)
    return {"download_url": url, "file_name": doc.file_name}


@documents_router.post("/presign", response_model=DocumentPresignResponse)
async def request_presigned_upload(
    conversation_id: Annotated[uuid.UUID, Path()],
    payload: DocumentPresignRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    1. Verify file constraints (size <= 10MB, allowed MIME types).
    2. Register document record in DB with status 'uploading'.
    3. Generate presigned PUT URL for direct browser ➔ Cloudflare R2 upload.
    """
    file_verify(
        file_size=payload.file_bytes,
        file_type=payload.file_type,
        file_hash=payload.file_hash,
    )

    new_doc_id = uuid.uuid4()
    r2_key = f"documents/{user_id}/{conversation_id}/{new_doc_id}/{payload.file_name}"
    upload_url = await storage.generate_presigned_upload_url(
        key=r2_key,
        content_type=payload.file_type,
    )

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


@documents_router.post("/{document_id}/confirm", response_model=DocumentSchema)
async def confirm_document_upload(
    conversation_id: Annotated[uuid.UUID, Path()],
    document_id: Annotated[uuid.UUID, Path()],
    db: AsyncSession = Depends(get_db),
):
    """
    Called by frontend after browser finishes uploading bytes directly to Cloudflare R2.
    Marks document status as 'ready' and prepares it for RAG ingestion.
    """
    doc_service = DocumentService(db)
    doc = await doc_service.update_document(
        conversation_id=conversation_id,
        document_id=document_id,
        payload=DocumentUpdateSchema(file_status=FileStatus.READY),
    )
    return doc


@documents_router.patch("/{document_id}", response_model=DocumentSchema)
async def update_document(
    conversation_id: Annotated[uuid.UUID, Path()],
    document_id: Annotated[uuid.UUID, Path()],
    payload: DocumentUpdateSchema,
    db: AsyncSession = Depends(get_db),
):
    """Update settings (e.g. file_ingestion_status) for a single document."""
    doc_service = DocumentService(db)
    return await doc_service.update_document(
        conversation_id=conversation_id,
        document_id=document_id,
        payload=payload,
    )


@documents_router.patch("/batch", response_model=list[DocumentSchema])
async def update_documents_batch(
    conversation_id: Annotated[uuid.UUID, Path()],
    payload: DocumentBatchUpdateSchema,
    db: AsyncSession = Depends(get_db),
):
    """Bulk update settings for multiple documents simultaneously."""
    doc_service = DocumentService(db)
    return await doc_service.update_documents_batch(
        conversation_id=conversation_id,
        payload=payload,
    )


@documents_router.delete("/{document_id}", response_model=DocumentSchema)
async def delete_document(
    conversation_id: Annotated[uuid.UUID, Path()],
    document_id: Annotated[uuid.UUID, Path()],
    db: AsyncSession = Depends(get_db),
):
    """Delete a document from PostgreSQL and delete its binary object from Cloudflare R2."""
    doc_service = DocumentService(db)
    doc = await doc_service.delete_document_by_id(
        conversation_id=conversation_id,
        document_id=document_id,
    )
    # Remove file from Cloudflare R2
    await storage.delete_file(doc.file_path)
    return doc


@documents_router.delete("/batch", response_model=list[uuid.UUID])
async def delete_documents_batch(
    conversation_id: Annotated[uuid.UUID, Path()],
    payload: DocumentBatchDeleteSchema,
    db: AsyncSession = Depends(get_db),
):
    """Bulk delete multiple documents."""
    doc_service = DocumentService(db)
    return await doc_service.delete_documents_batch(
        conversation_id=conversation_id,
        document_ids=payload.document_ids,
    )
