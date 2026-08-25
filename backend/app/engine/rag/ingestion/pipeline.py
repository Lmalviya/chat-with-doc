import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import storage
from app.documents.service import DocumentService 
from app.documents.models import FileIngestionStatus
from app.engine.rag.ingestion.loader import DocumentLoader
from app.engine.rag.ingestion.splitters import DocumentSplitter
from app.engine.rag.vector.vector_store import VectorService

logger = logging.getLogger("app.rag.ingestion_pipeline")


class IngestionPipeline:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.doc_service = DocumentService(db)
        self.splitter = DocumentSplitter()
        self.vector_service = VectorService()

    async def ingest_document(
        self,
        document_id: uuid.UUID,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        """
        Runs the complete ingestion pipeline for a single document:
        1. Download file bytes from Object Storage
        2. Parse using DocumentLoader
        3. Chunk using DocumentSplitter
        4. Embed and index in Qdrant Vector DB
        5. Update PostgreSQL status to 'success'
        """
        logger.info(f"Starting RAG ingestion for document_id={document_id}")

        try:
            # 1. Fetch document metadata
            doc = await self.doc_service.get_document_by_id(conversation_id, document_id)
            logger.info(f"Downloading file from storage: {doc.file_path}")

            # 2. Download from S3/Supabase Storage
            file_bytes = await storage.download_file(doc.file_path)

            # 3. Parse into LangChain Document objects
            base_metadata = {
                "document_id": str(doc.id),
                "conversation_id": str(conversation_id),
                "user_id": str(user_id),
            }

            raw_docs = DocumentLoader.load(
                file_bytes=file_bytes,
                file_name=doc.file_name,
                file_type=doc.file_type,
                base_metadata=base_metadata,
            )

            if not raw_docs:
                logger.warning(f"No extractable text found in document_id={document_id}")
                await self.doc_service.repo.update_by_id(
                    document_id=doc.id,
                    conversation_id=conversation_id,
                    file_ingestion_status=FileIngestionStatus.FAILED.value,
                )
                await self.db.commit()
                return False

            # 4. Chunk text
            chunks = self.splitter.split_documents(raw_docs)

            # 5. Embed and index in Qdrant
            await self.vector_service.add_documents(chunks)

            # 6. Update database status to 'success'
            await self.doc_service.repo.update_by_id(
                document_id=doc.id,
                conversation_id=conversation_id,
                file_ingestion_status=FileIngestionStatus.SUCCESS.value,
            )
            await self.db.commit()

            logger.info(f"Successfully ingested document_id={document_id}, {len(chunks)} chunks indexed in Qdrant")
            return True

        except Exception as e:
            logger.exception(f"Ingestion failed for document_id={document_id}: {e}")
            try:
                await self.doc_service.repo.update_by_id(
                    document_id=document_id,
                    conversation_id=conversation_id,
                    file_ingestion_status=FileIngestionStatus.FAILED.value,
                )
                await self.db.commit()
            except Exception:
                pass
            return False
