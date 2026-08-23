import time
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import Request
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.users import Users
from app.core.logging import request_id_ctx, user_id_ctx

logger = logging.getLogger("app.http")

# Paths and methods that do not require session management
SKIP_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}
SESSION_TTL = timedelta(hours=24)
# Only extend session if less than 1 hour remains until expiration
EXTENSION_THRESHOLD = timedelta(hours=1)


async def get_or_create_session(db, anon_id: str | None) -> tuple[uuid.UUID, bool]:
    now = datetime.now(timezone.utc)

    if anon_id:
        try:
            uid = uuid.UUID(anon_id)
        except ValueError:
            uid = None

        if uid:
            result = await db.execute(select(Users).where(Users.id == uid))
            user = result.scalar_one_or_none()

            if user and user.expires_at > now:
                # Extend session by 24 hours only if less than 1 hour remains before expiration
                if user.expires_at - now < EXTENSION_THRESHOLD:
                    user.expires_at = now + SESSION_TTL
                    await db.commit()
                return uid, False

    new_id = uuid.uuid4()
    db.add(Users(id=new_id, expires_at=now + SESSION_TTL))
    await db.commit()
    return new_id, True


async def request_logging_middleware(request: Request, call_next):
    """Tracks correlation IDs and logs duration and status of HTTP requests."""
    req_id = (
        request.headers.get("x-request-id")
        or request.headers.get("x-correlation-id")
        or f"req_{uuid.uuid4().hex[:8]}"
    )
    req_token = request_id_ctx.set(req_id)
    start_time = time.perf_counter()

    if request.url.path not in SKIP_PATHS and request.method != "OPTIONS":
        logger.info(f"--> {request.method} {request.url.path}")

    try:
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000

        if request.url.path not in SKIP_PATHS and request.method != "OPTIONS":
            logger.info(f"<-- {request.method} {request.url.path} [{response.status_code}] ({duration_ms:.1f}ms)")

        response.headers["X-Request-Id"] = req_id
        return response
    except Exception as exc:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.exception(f"<-- {request.method} {request.url.path} [ERROR: {exc}] ({duration_ms:.1f}ms)")
        raise
    finally:
        request_id_ctx.reset(req_token)


async def session_middleware(request: Request, call_next):
    # Skip preflight OPTIONS requests and non-session endpoints
    if request.method == "OPTIONS" or request.url.path in SKIP_PATHS:
        return await call_next(request)

    # 1. Retrieve session ID from Cookie OR Header (X-Anon-Id / X-Session-Id)
    anon_id = (
        request.cookies.get("anon_id")
        or request.headers.get("x-anon-id")
        or request.headers.get("x-session-id")
    )
    async with AsyncSessionLocal() as db:
        session_id, is_new = await get_or_create_session(db, anon_id)

    request.state.anon_id = session_id
    user_token = user_id_ctx.set(str(session_id))

    try:
        response = await call_next(request)
        if is_new:
            response.set_cookie(
                "anon_id",
                value=str(session_id),
                httponly=True,
                samesite="lax",
                path="/",
                max_age=86400,  # 24h
            )
        # Always attach X-Anon-Id header so frontend can synchronize session ID in local storage
        response.headers["X-Anon-Id"] = str(session_id)
        return response
    finally:
        user_id_ctx.reset(user_token)

