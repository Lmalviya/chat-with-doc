import uuid
from typing import Annotated
from fastapi import Request, Header, HTTPException, Depends, Path, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.users import Users
from app.auth.security import decode_supabase_token
from app.conversations.models import Conversations

security_scheme = HTTPBearer(auto_error=False)


# ── Database session ───────────────────────────────────────────────────────────
async def get_db() -> AsyncSession:
    session = AsyncSessionLocal()
    try:
        yield session
    finally:
        await session.aclose()


# ── Authenticated Supabase User Dependency ─────────────────────────────────────
async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Users:
    token: str | None = None

    # 1. Extract Bearer token from Authorization header
    if credentials and credentials.credentials:
        token = credentials.credentials
    elif request.headers.get("Authorization"):
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    # 2. Fallback to query parameter (useful for event streams / media URLs)
    if not token and request.query_params.get("token"):
        token = request.query_params.get("token")

    # 3. Fallback to cookie
    if not token and request.cookies.get("sb-access-token"):
        token = request.cookies.get("sb-access-token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_supabase_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = uuid.UUID(payload["sub"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Auto-sync / verify user in public.users table
    email = payload.get("email")
    user_metadata = payload.get("user_metadata") or {}
    name = user_metadata.get("full_name") or user_metadata.get("name") or user_metadata.get("user_name")

    stmt = select(Users).where(Users.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        # First-time sync: create public.users record linked to Supabase auth.users
        user = Users(
            id=user_id,
            email=email,
            name=name,
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except Exception:
            await db.rollback()
            # If concurrent insert happened, re-fetch
            result = await db.execute(select(Users).where(Users.id == user_id))
            user = result.scalar_one_or_none()
            if not user:
                # Return in-memory user instance
                user = Users(id=user_id, email=email, name=name)

    return user


async def get_current_user_id(
    user: Users = Depends(get_current_user),
) -> uuid.UUID:
    return user.id


# ── Conversation Validation Dependency (Tenant Security) ───────────────────────
async def get_validated_conversation(
    conversation_id: Annotated[uuid.UUID, Path()],
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Conversations:
    """
    Verifies that the conversation exists AND belongs to the requesting user.
    Raises 404 if not found or 403 if it belongs to another tenant.
    """
    from app.conversations.service import ConversationRepository
    repo = ConversationRepository(db)
    return await repo.get_by_id(conversation_id, user_id)


# Backward compatibility alias
async def get_anon_id(
    user: Users = Depends(get_current_user),
) -> uuid.UUID:
    return user.id


# ── Per-request idempotency key (sent by client as X-Request-ID header) ───────
async def get_request_id(
    x_request_id: str | None = Header(default=None),
) -> uuid.UUID | None:
    if x_request_id is None:
        return None
    try:
        return uuid.UUID(x_request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request id format")
