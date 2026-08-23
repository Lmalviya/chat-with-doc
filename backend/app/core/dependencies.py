import uuid
from fastapi import Request, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal


# ── Database session ───────────────────────────────────────────────────────────
async def get_db() -> AsyncSession:
    session = AsyncSessionLocal()
    try:
        yield session
    finally:
        await session.aclose()


async def get_anon_id(request: Request) -> uuid.UUID:
    # 1. Retrieve session ID created/loaded by session_middleware in request.state
    anon_id = getattr(request.state, "anon_id", None)
    if anon_id is not None:
        if isinstance(anon_id, uuid.UUID):
            return anon_id
        try:
            return uuid.UUID(str(anon_id))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid session id format")

    # 2. Check X-Anon-Id or X-Session-Id header (fallback for non-cookie clients)
    header_anon = request.headers.get("x-anon-id") or request.headers.get("x-session-id")
    if header_anon:
        try:
            return uuid.UUID(header_anon)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid session id format")

    # 3. Fallback to cookie if state is not set
    cookie_anon = request.cookies.get("anon_id")
    if cookie_anon:
        try:
            return uuid.UUID(cookie_anon)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid session id format")

    raise HTTPException(status_code=401, detail="Missing session")


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
