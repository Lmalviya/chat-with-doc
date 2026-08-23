import asyncio
import logging
from typing import AsyncIterator
import aioboto3
from botocore.config import Config
from app.core.config import settings

logger = logging.getLogger("app.core.storage")


class StorageService:
    """Async client for Cloudflare R2 (S3-compatible) object storage."""

    def __init__(self) -> None:
        self.session = aioboto3.Session()
        self.bucket_name = settings.R2_BUCKET_NAME
        self.endpoint_url = settings.R2_ENDPOINT_URL
        self.access_key = settings.R2_ACCESS_KEY_ID
        self.secret_key = settings.R2_SECRET_ACCESS_KEY

    def _get_client(self):
        return self.session.client(
            service_name="s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )

    # ── Presigned URLs (Direct Browser ➔ R2) ──────────────────────────

    async def generate_presigned_upload_url(
        self,
        key: str,
        content_type: str = "application/octet-stream",
        expires_in: int = 900,  # 15 minutes
    ) -> str:
        """
        Generates a presigned PUT URL allowing the browser to upload
        directly to Cloudflare R2 without passing through the backend.
        """
        async with self._get_client() as s3:
            return await s3.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )

    async def generate_presigned_download_url(
        self,
        key: str,
        expires_in: int = 3600,  # 1 hour
    ) -> str:
        """
        Generates a presigned GET URL allowing the browser to download
        or preview a file directly from Cloudflare R2.
        """
        async with self._get_client() as s3:
            return await s3.generate_presigned_url(
                ClientMethod="get_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": key,
                },
                ExpiresIn=expires_in,
            )

    # ── Backend Ingestion & File Retrieval ─────────────────────────────

    async def download_file(self, key: str) -> bytes:
        """Downloads full file bytes from R2 (used by RAG text extraction/parsing)."""
        async with self._get_client() as s3:
            result = await s3.get_object(Bucket=self.bucket_name, Key=key)
            async with result["Body"] as stream:
                return await stream.read()

    async def download_file_stream(
        self,
        key: str,
        chunk_size: int = 1024 * 64,  # 64 KB chunks
    ) -> AsyncIterator[bytes]:
        """Streams file content chunk-by-chunk for memory-efficient processing."""
        async with self._get_client() as s3:
            result = await s3.get_object(Bucket=self.bucket_name, Key=key)
            async with result["Body"] as stream:
                while chunk := await stream.read(chunk_size):
                    yield chunk

    # ── Deletion Operations ────────────────────────────────────────────

    async def delete_file(self, key: str) -> None:
        """Deletes a single object from R2."""
        async with self._get_client() as s3:
            await s3.delete_object(Bucket=self.bucket_name, Key=key)
            logger.info(f"Deleted object from R2: {key}")

    async def delete_file_batch(self, keys: list[str]) -> None:
        """Deletes multiple objects from R2 in a single atomic call."""
        if not keys:
            return

        delete_object = {"Objects": [{"Key": k} for k in keys]}
        async with self._get_client() as s3:
            await s3.delete_objects(
                Bucket=self.bucket_name,
                Delete=delete_object,
            )
            logger.info(f"Deleted {len(keys)} objects from R2.")

storage = StorageService()