from app.core.exceptions import BadRequestError

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/csv",
}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB limit


def file_verify(
    file_size:int,
    file_type:str,
    file_hash: str | None = None
):
    if file_size > MAX_FILE_SIZE_BYTES:
        raise BadRequestError(f"File size exceeds maximum allowed limit of 10MB.")
    if file_type not in ALLOWED_MIME_TYPES:
        raise BadRequestError(f"Unsupported file type '{file_type}'. Allowed: PDF, DOCX, TXT, MD, CSV.")

    return