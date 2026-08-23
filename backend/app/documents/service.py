import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete

from app.documents.exceptions import DocumentNotFound, DocumentForbidden
from app.documents.models import Documents, FileStatus, FileIngestionStatus
from app.documents.schemas import (
    DocumentSchema,
    DocumentCreateSchema,
    DocumentListResponse,
    DocumentUpdateSchema,
    DocumentBatchUpdateSchema,
    DocumentBatchUploadSchema,
)


class DocumentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(
        self,
        conversation_id: uuid.UUID,
        document_id: uuid.UUID,
    ) -> Documents:
        stmt = select(Documents).where(Documents.id == document_id)
        result = await self.db.execute(stmt)
        doc = result.scalar_one_or_none()

        if doc is None:
            raise DocumentNotFound(f"Document {document_id} not found")

        if doc.conversation_id != conversation_id:
            raise DocumentForbidden(f"Document {document_id} does not belong to conversation {conversation_id}")

        return doc

    async def get_by_conversation_id(
        self,
        conversation_id: uuid.UUID,
    ) -> list[Documents]:
        stmt = (
            select(Documents)
            .where(Documents.conversation_id == conversation_id)
            .order_by(Documents.updated_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def add(
        self,
        conversation_id: uuid.UUID,
        file_path: str,
        file_name: str,
        file_bytes: int,
        file_type: str,
        doc_id: uuid.UUID | None = None,
        file_status: str = FileStatus.UPLOADING.value,
        file_ingestion_status: str = FileIngestionStatus.INCONTEXT.value,
    ) -> Documents:
        effective_id = doc_id or uuid.uuid4()

        stmt = (
            insert(Documents)
            .values(
                id=effective_id,
                conversation_id=conversation_id,
                file_path=file_path,
                file_name=file_name,
                file_bytes=file_bytes,
                file_type=file_type,
                file_status=file_status,
                file_ingestion_status=file_ingestion_status,
            )
            .returning(Documents)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.scalar_one()

    async def add_batch(
        self,
        conversation_id: uuid.UUID,
        items: list[dict],
    ) -> list[Documents]:
        """Bulk insert multiple document records in a single atomic SQL query."""
        if not items:
            return []

        records = [
            {
                "id": item.get("id") or item.get("doc_id") or uuid.uuid4(),
                "conversation_id": conversation_id,
                "file_path": item.get("file_path") or item["file_name"],
                "file_name": item["file_name"],
                "file_bytes": item["file_bytes"],
                "file_type": item["file_type"],
                "file_status": item.get("file_status") or FileStatus.UPLOADING.value,
                "file_ingestion_status": item.get("file_ingestion_status") or FileIngestionStatus.INCONTEXT.value,
            }
            for item in items
        ]

        stmt = (
            insert(Documents)
            .values(records)
            .returning(Documents)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return list(result.scalars().all())

    async def update_by_id(
        self,
        conversation_id: uuid.UUID,
        document_id: uuid.UUID,
        file_path: str | None = None,
        file_name: str | None = None,
        file_bytes: int | None = None,
        file_type: str | None = None,
        file_status: str | None = None,
        file_ingestion_status: str | None = None,
    ) -> Documents:
        doc = await self.get_by_id(conversation_id, document_id)

        if file_path is not None:
            doc.file_path = file_path
        if file_name is not None:
            doc.file_name = file_name
        if file_bytes is not None:
            doc.file_bytes = file_bytes
        if file_type is not None:
            doc.file_type = file_type
        if file_status is not None:
            doc.file_status = file_status
        if file_ingestion_status is not None:
            doc.file_ingestion_status = file_ingestion_status

        await self.db.commit()
        return doc

    async def update_batch(
        self,
        conversation_id: uuid.UUID,
        document_ids: list[uuid.UUID],
        file_status: str | None = None,
        file_ingestion_status: str | None = None,
    ) -> list[Documents]:
        if not document_ids:
            return []

        values_to_update = {}
        if file_status is not None:
            values_to_update["file_status"] = file_status
        if file_ingestion_status is not None:
            values_to_update["file_ingestion_status"] = file_ingestion_status

        if not values_to_update:
            return await self.get_by_conversation_id(conversation_id)

        stmt = (
            update(Documents)
            .where(
                Documents.conversation_id == conversation_id,
                Documents.id.in_(document_ids),
            )
            .values(**values_to_update)
            .returning(Documents)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return list(result.scalars().all())

    async def delete_by_id(
        self,
        conversation_id: uuid.UUID,
        document_id: uuid.UUID,
    ) -> Documents:
        doc = await self.get_by_id(conversation_id, document_id)
        await self.db.delete(doc)
        await self.db.commit()
        return doc

    async def delete_batch(
        self,
        conversation_id: uuid.UUID,
        document_ids: list[uuid.UUID],
    ) -> list[uuid.UUID]:
        if not document_ids:
            return []

        stmt = (
            delete(Documents)
            .where(
                Documents.conversation_id == conversation_id,
                Documents.id.in_(document_ids),
            )
            .returning(Documents.id)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return list(result.scalars().all())

    async def delete_all(
        self,
        conversation_id: uuid.UUID,
    ) -> int:
        stmt = delete(Documents).where(Documents.conversation_id == conversation_id)
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount or 0


class DocumentService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = DocumentRepository(db)

    async def get_document_by_id(
        self,
        conversation_id: uuid.UUID,
        document_id: uuid.UUID,
    ) -> DocumentSchema:
        doc = await self.repo.get_by_id(conversation_id, document_id)
        return DocumentSchema.model_validate(doc)

    async def get_documents(
        self,
        conversation_id: uuid.UUID,
    ) -> DocumentListResponse:
        docs = await self.repo.get_by_conversation_id(conversation_id)
        return DocumentListResponse(
            conversation_id=conversation_id,
            documents=[DocumentSchema.model_validate(d) for d in docs],
        )

    async def upload_document(
        self,
        conversation_id: uuid.UUID,
        file_name: str,
        file_bytes: int,
        file_type: str,
        file_path: str | None = None,
    ) -> DocumentSchema:
        doc = await self.repo.add(
            conversation_id=conversation_id,
            doc_id=uuid.uuid4(),
            file_path=file_path or file_name,
            file_name=file_name,
            file_bytes=file_bytes,
            file_type=file_type,
            file_status=FileStatus.UPLOADING.value,
            file_ingestion_status=FileIngestionStatus.INCONTEXT.value,
        )
        return DocumentSchema.model_validate(doc)

    async def upload_documents_batch(
        self,
        conversation_id: uuid.UUID,
        files: list[DocumentCreateSchema],
    ) -> list[DocumentSchema]:
        """Upload and register multiple documents at once."""
        items = [
            {
                "file_name": f.file_name,
                "file_bytes": f.file_bytes,
                "file_type": f.file_type,
                "file_path": f.file_path or f.file_name,
                "file_status": f.file_status.value if isinstance(f.file_status, FileStatus) else f.file_status,
                "file_ingestion_status": f.file_ingestion_status.value if isinstance(f.file_ingestion_status, FileIngestionStatus) else f.file_ingestion_status,
            }
            for f in files
        ]
        docs = await self.repo.add_batch(conversation_id, items)
        return [DocumentSchema.model_validate(d) for d in docs]

    async def update_document(
        self,
        conversation_id: uuid.UUID,
        document_id: uuid.UUID,
        payload: DocumentUpdateSchema,
    ) -> DocumentSchema:
        doc = await self.repo.update_by_id(
            conversation_id=conversation_id,
            document_id=document_id,
            file_status=payload.file_status.value if payload.file_status else None,
            file_ingestion_status=payload.file_ingestion_status.value if payload.file_ingestion_status else None,
        )
        return DocumentSchema.model_validate(doc)

    async def update_documents_batch(
        self,
        conversation_id: uuid.UUID,
        payload: DocumentBatchUpdateSchema,
    ) -> list[DocumentSchema]:
        docs = await self.repo.update_batch(
            conversation_id=conversation_id,
            document_ids=payload.document_ids,
            file_status=payload.file_status.value if payload.file_status else None,
            file_ingestion_status=payload.file_ingestion_status.value if payload.file_ingestion_status else None,
        )
        return [DocumentSchema.model_validate(d) for d in docs]

    async def delete_document_by_id(
        self,
        conversation_id: uuid.UUID,
        document_id: uuid.UUID,
    ) -> DocumentSchema:
        doc = await self.repo.delete_by_id(conversation_id, document_id)
        return DocumentSchema.model_validate(doc)

    async def delete_documents_batch(
        self,
        conversation_id: uuid.UUID,
        document_ids: list[uuid.UUID],
    ) -> list[uuid.UUID]:
        return await self.repo.delete_batch(conversation_id, document_ids)

    async def delete_all_documents(
        self,
        conversation_id: uuid.UUID,
    ) -> int:
        return await self.repo.delete_all(conversation_id)