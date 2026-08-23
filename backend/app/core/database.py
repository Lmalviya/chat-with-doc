from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# ── Engine ─────────────────────────────────────────────────────────────────────
# When using Supabase transaction pooler (port 6543 / PgBouncer), prepared statements
# must be disabled by setting statement_cache_size=0.
database_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    },
)

# ── Session factory ────────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=database_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ── Declarative base (shared across all domain models) ────────────────────────
class Base(DeclarativeBase):
    pass
