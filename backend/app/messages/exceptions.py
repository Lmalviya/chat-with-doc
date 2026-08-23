from app.core.exceptions import AppException, NotFoundError


class MessageNotFound(NotFoundError):
    def __init__(self) -> None:
        super().__init__("Message not found")


class DuplicateRequest(AppException):
    """Raised when the same X-Request-ID is received more than once."""
    def __init__(self) -> None:
        super().__init__(status_code=409, detail="Duplicate request — this message was already processed")
