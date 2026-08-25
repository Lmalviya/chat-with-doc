from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app.core.database import database_engine, Base
from app.core.exceptions import AppException
from app.core.logging import setup_logging
from app.core.middleware import request_logging_middleware

# Initialize centralized logging
setup_logging()

# Import all models so SQLAlchemy registers them with Base.metadata
# Order matters: users first (no deps), then conversations, then messages/documents
import app.core.users                   # noqa: F401
import app.conversations.models         # noqa: F401
import app.messages.models              # noqa: F401
import app.documents.models             # noqa: F401

from app.auth.router import auth_router
from app.conversations.router import conversations_router
from app.messages.router import messages_router
from app.documents.router import documents_router


import asyncio
import logging

logger = logging.getLogger("app.main")


# ── Lifespan ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    max_retries = 5
    for attempt in range(1, max_retries + 1):
        try:
            async with database_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                try:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);"))
                    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);"))
                    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"))
                    await conn.execute(text("ALTER TABLE users ALTER COLUMN expires_at DROP NOT NULL;"))
                except Exception:
                    pass
            logger.info("Database schema initialized and verified.")
            break
        except Exception as exc:
            if attempt == max_retries:
                logger.error(f"Failed to connect to database after {max_retries} attempts: {exc}")
                raise exc
            logger.warning(f"Database connection attempt {attempt}/{max_retries} failed ({exc}). Retrying in 1s...")
            await asyncio.sleep(1.0)
    yield


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Q&A Bot With Docs",
    description="Chat application with document-aware AI responses and persistent Supabase user accounts",
    version="1.0.0",
    lifespan=lifespan,
)


# ── Middleware ─────────────────────────────────────────────────────────────────
# Request logging middleware runs inside CORS
app.add_middleware(BaseHTTPMiddleware, dispatch=request_logging_middleware)

# CORS middleware is outermost to allow cross-origin requests and preflights
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Authorization", "X-Request-Id"],
)


# ── Exception handlers ─────────────────────────────────────────────────────────
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(OperationalError)
async def db_connection_error_handler(request: Request, exc: OperationalError):
    return JSONResponse(
        status_code=503,
        content={"detail": "Database is unreachable. Try again shortly."},
    )


@app.exception_handler(SQLAlchemyError)
async def db_generic_error_handler(request: Request, exc: SQLAlchemyError):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error."},
    )


# ── Routes ─────────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1")
app.include_router(conversations_router, prefix="/api/v1")
app.include_router(messages_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


# ── Dev entrypoint ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)