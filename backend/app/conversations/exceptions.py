from app.core.exceptions import NotFoundError, ForbiddenError, BadRequestError

class EmptyContentError(BadRequestError):
    def __init__(self) -> None:
        super().__init__("Content cannot be empty")

class ConversationNotFound(NotFoundError):
    def __init__(self) -> None:
        super().__init__("Conversation not found")


class ConversationForbidden(ForbiddenError):
    def __init__(self) -> None:
        super().__init__("You are not authorized to access this conversation")
