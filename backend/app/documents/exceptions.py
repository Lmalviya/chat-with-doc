from app.core.exceptions import NotFoundError, ForbiddenError, BadRequestError


class DocumentNotFound(NotFoundError):
    def __init__(self, message: str = "Document not found") -> None:
        super().__init__(message)


class DocumentForbidden(ForbiddenError):
    def __init__(self, message: str = "You are not authorized to access this document") -> None:
        super().__init__(message)