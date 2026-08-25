import uuid
import logging
from typing import List, Optional

from langchain_core.documents import Document
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.core.config import settings
from app.engine.rag.vector.embeddings import get_embedding_model, EMBEDDING_DIMENSION

logger = logging.getLogger("app.rag.vector_store")


class VectorService:
    """
    Manages indexing, multi-tenant filtered search, and deletion of document chunks in Qdrant.
    """

    def __init__(
        self,
        url: str = settings.QDRANT_URL,
        api_key: Optional[str] = settings.QDRANT_API_KEY,
        collection_name: str = settings.COLLECTION_NAME,
    ):
        self.collection_name = collection_name
        self.client = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
            timeout=2.0
        )
        self.embeddings = get_embedding_model()
        self._ensure_collection_exists()

        self.vector_store = QdrantVectorStore(
            client=self.client,
            collection_name=self.collection_name,
            embedding=self.embeddings,
        )

    def _ensure_collection_exists(self) -> None:
        """Ensures collection exists with cosine distance, 3072 dimensions, and multi-tenant payload indexes."""
        try:
            collections = [c.name for c in self.client.get_collections().collections]
        except Exception as e:
            logger.warning(f"Could not connect to Qdrant at startup (will retry on query): {e}")
            return

        # Check if existing collection has dimension mismatch (e.g. 768 vs 3072)
        if self.collection_name in collections:
            try:
                col_info = self.client.get_collection(self.collection_name)
                current_size = getattr(col_info.config.params.vectors, "size", None)
                if current_size and current_size != EMBEDDING_DIMENSION:
                    logger.warning(
                        f"Recreating collection '{self.collection_name}': existing size ({current_size}) != required ({EMBEDDING_DIMENSION})"
                    )
                    self.client.delete_collection(self.collection_name)
                    collections.remove(self.collection_name)
            except Exception as e:
                logger.warning(f"Could not inspect existing collection config: {e}")

        if self.collection_name not in collections:
            logger.info(f"Creating collection '{self.collection_name}' (dim={EMBEDDING_DIMENSION})")
            try:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=EMBEDDING_DIMENSION,
                        distance=models.Distance.COSINE,
                    ),
                )

                # 1. Tenant index for user isolation
                try:
                    self.client.create_payload_index(
                        collection_name=self.collection_name,
                        field_name="metadata.user_id",
                        field_schema=models.KeywordIndexParams(
                            type=models.KeywordIndexType.KEYWORD,
                            is_tenant=True,
                        ),
                    )
                except Exception:
                    self.client.create_payload_index(
                        collection_name=self.collection_name,
                        field_name="metadata.user_id",
                        field_schema=models.PayloadSchemaType.KEYWORD,
                    )

                # 2. Index for conversation isolation
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="metadata.conversation_id",
                    field_schema=models.PayloadSchemaType.KEYWORD,
                )

                # 3. Index for document deletion
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="metadata.document_id",
                    field_schema=models.PayloadSchemaType.KEYWORD,
                )
            except Exception as e:
                logger.warning(f"Collection setup skipped or already exists: {e}")

    async def add_documents(self, documents: List[Document]) -> List[str]:
        """Embeds and indexes document chunks into Qdrant."""
        if not documents:
            return []

        ids = await self.vector_store.aadd_documents(documents)
        logger.info(f"Indexed {len(documents)} chunks in collection '{self.collection_name}' with IDs: {ids}")
        return ids

    async def get_documents(
        self,
        query: str,
        user_id: str | uuid.UUID,
        conversation_id: str | uuid.UUID,
        top_k: int = 4,
    ) -> List[Document]:
        """
        Retrieves top_k chunks matching query strictly scoped to user_id and conversation_id.
        """
        search_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="metadata.user_id",
                    match=models.MatchValue(value=str(user_id)),
                ),
                models.FieldCondition(
                    key="metadata.conversation_id",
                    match=models.MatchValue(value=str(conversation_id)),
                ),
            ]
        )

        results = await self.vector_store.asimilarity_search(
            query=query,
            k=top_k,
            filter=search_filter,
        )
        return results

    async def delete_by_document_id(self, document_id: str | uuid.UUID) -> None:
        """Removes all vector chunks belonging to a deleted document."""
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="metadata.document_id",
                            match=models.MatchValue(value=str(document_id)),
                        )
                    ]
                )
            ),
        )
        logger.info(f"Deleted vector chunks for document_id={document_id}")

    async def delete_by_conversation_id(self, conversation_id: str | uuid.UUID) -> None:
        """Removes all vector chunks belonging to an entire conversation."""
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="metadata.conversation_id",
                            match=models.MatchValue(value=str(conversation_id)),
                        )
                    ]
                )
            ),
        )
        logger.info(f"Deleted vector chunks from Qdrant for conversation_id={conversation_id}")