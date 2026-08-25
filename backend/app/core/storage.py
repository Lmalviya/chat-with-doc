import asyncio
import logging
from typing import AsyncIterator
import aioboto3
from botocore.config import Config
from app.core.config import settings

logger = logging.getLogger("app.core.storage")


class StorageService:
    """
    Universal S3-Compatible Object Storage Service.
    Seamlessly works with Supabase S3, Cloudflare R2, AWS S3, MinIO, or Wasabi
    without modifying code.
    """

    def __init__(self) -> None:
        self.session = aioboto3.Session()
        self.bucket_name = settings.S3_BUCKET_NAME
        self.endpoint_url = settings.S3_ENDPOINT_URL
        self.access_key = settings.S3_ACCESS_KEY_ID
        self.secret_key = settings.S3_SECRET_ACCESS_KEY
        self.region_name = settings.S3_REGION_NAME

    def _get_client(self):
        return self.session.client(
            service_name="s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region_name,
            config=Config(signature_version="s3v4"),
        )

    # ── Presigned URLs (Direct Browser ➔ Object Storage) ───────────────

    async def generate_presigned_upload_url(
        self,
        key: str,
        content_type: str = "application/octet-stream",
        expires_in: int = 900,  # 15 minutes
    ) -> str:
        """
        Generates a presigned PUT URL allowing the browser to upload
        directly to Object Storage (Supabase S3 / R2 / AWS) without passing through the backend.
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
        or preview a file directly from Object Storage.
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
        """Downloads full file bytes from Object Storage (used by RAG text extraction/parsing)."""
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
        """Deletes a single object from Object Storage."""
        async with self._get_client() as s3:
            await s3.delete_object(Bucket=self.bucket_name, Key=key)
            logger.info(f"Deleted object from storage: {key}")

    async def delete_file_batch(self, keys: list[str]) -> None:
        """Deletes multiple objects from Object Storage concurrently."""
        if not keys:
            return

        async with self._get_client() as s3:
            tasks = [s3.delete_object(Bucket=self.bucket_name, Key=k) for k in keys]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for k, res in zip(keys, results):
                if isinstance(res, Exception):
                    logger.warning(f"Failed to delete {k} from storage: {res}")
                else:
                    logger.info(f"Deleted object from storage: {k}")


storage = StorageService()