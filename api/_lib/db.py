import os
from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Any

from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# libpq query parameters that asyncpg does not accept. Managed Postgres providers
# (Neon, Supabase, Railway) hand out connection strings written for psycopg, which
# speaks libpq; asyncpg has its own connect() signature and raises
# `TypeError: connect() got an unexpected keyword argument 'sslmode'` on these.
# SQLAlchemy passes unknown query params straight through to the driver, so they
# must be stripped here rather than left for the driver to reject.
_LIBPQ_ONLY_PARAMS = ("sslmode", "channel_binding", "target_session_attrs")

# sslmode values that mean "use TLS". asyncpg takes ssl=True instead.
_SSL_REQUIRED = {"require", "verify-ca", "verify-full", "prefer", "allow"}


def _url_and_connect_args() -> tuple[URL, dict[str, Any]]:
    """Translate a libpq-style DATABASE_URL into what asyncpg actually accepts.

    Returns the cleaned URL plus connect_args. Local Postgres URLs carry no
    sslmode, so they come back unchanged and without an ssl argument — which is
    why this bug could not reproduce against the Docker container.
    """
    raw = os.environ["DATABASE_URL"]
    url = make_url(raw.replace("postgresql://", "postgresql+asyncpg://", 1))

    query = dict(url.query)
    sslmode = query.pop("sslmode", None)
    for param in _LIBPQ_ONLY_PARAMS:
        query.pop(param, None)
    url = url.set(query=query)

    # statement_cache_size=0 is mandatory behind PgBouncer in transaction mode
    # (Neon's pooled endpoint), or asyncpg raises DuplicatePreparedStatementError.
    connect_args: dict[str, Any] = {"statement_cache_size": 0}
    if isinstance(sslmode, str) and sslmode in _SSL_REQUIRED:
        connect_args["ssl"] = True
    return url, connect_args


# The engine is built lazily, on first use, NOT at import time.
#
# This is deliberate and was found the hard way. `api/index.py` imports this module
# at module scope, so an eager engine made DATABASE_URL a hard requirement for the
# whole application to even load — a deployment with no database configured returned
# FUNCTION_INVOCATION_FAILED for *every* route, including /api/py/health, which is
# the one route you need working to diagnose the problem. Routes that never touch
# the database must not die because of it.
#
# NullPool: PgBouncer already pools, so SQLAlchemy must not pool on top of it.
@lru_cache(maxsize=1)
def get_engine():
    url, connect_args = _url_and_connect_args()
    return create_async_engine(url, poolclass=NullPool, connect_args=connect_args)


@lru_cache(maxsize=1)
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session
