import logging
from typing import List
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.engine.rag.ingestion.ingesion_config import CHUNK_OVERLAP, CHUNK_SIZE

logger = logging.getLogger("app.rag.splitter")


class DocumentSplitter:
    def __init__(self):
        self.chunk_size = CHUNK_SIZE
        self.chunk_overlap = CHUNK_OVERLAP
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
            keep_separator=True,
        )

    def split_documents(self, documents: List[Document]) -> List[Document]:
        if not documents:
            logger.warning("No documents provided to split")
            return []

        raw_chunks = self.splitter.split_documents(documents)
        enriched_chunks = []

        for idx, chunk in enumerate(raw_chunks):
            doc_id = chunk.metadata.get("document_id") or chunk.metadata.get("doc_id", "doc")
            chunk.metadata["chunk_index"] = idx
            chunk.metadata["chunk_id"] = f"{doc_id}_chunk_{idx}"
            enriched_chunks.append(chunk)

        logger.info(f"Split {len(documents)} document pages into {len(enriched_chunks)} chunks")
        return enriched_chunks