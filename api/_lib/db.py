import os
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool


def _url() -> str:
    raw = os.environ["DATABASE_URL"]
    return raw.replace("postgresql://", "postgresql+asyncpg://", 1)


# NullPool: PgBouncer already pools. statement_cache_size=0 is mandatory behind
# PgBouncer in transaction mode, or asyncpg raises DuplicatePreparedStatementError.
engine = create_async_engine(
    _url(), poolclass=NullPool, connect_args={"statement_cache_size": 0}
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
