import os
from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool


def _url() -> str:
    raw = os.environ["DATABASE_URL"]
    return raw.replace("postgresql://", "postgresql+asyncpg://", 1)


# The engine is built lazily, on first use, NOT at import time.
#
# This is deliberate and was found the hard way. `api/index.py` imports this module
# at module scope, so an eager engine made DATABASE_URL a hard requirement for the
# whole application to even load — a deployment with no database configured returned
# FUNCTION_INVOCATION_FAILED for *every* route, including /api/py/health, which is
# the one route you need working to diagnose the problem. Routes that never touch
# the database must not die because of it.
#
# NullPool: PgBouncer already pools. statement_cache_size=0 is mandatory behind
# PgBouncer in transaction mode, or asyncpg raises DuplicatePreparedStatementError.
@lru_cache(maxsize=1)
def get_engine():
    return create_async_engine(
        _url(), poolclass=NullPool, connect_args={"statement_cache_size": 0}
    )


@lru_cache(maxsize=1)
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session
