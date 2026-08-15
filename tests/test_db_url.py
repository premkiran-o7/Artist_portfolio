"""Guards the libpq -> asyncpg connection-string translation.

This exists because of a production-only outage: Neon hands out a psycopg-style
DSN ending in `?sslmode=require`, SQLAlchemy passes unknown query params through
to the driver, and asyncpg rejects it with

    TypeError: connect() got an unexpected keyword argument 'sslmode'

Every database route 500'd while /api/py/health stayed green. It could not
reproduce locally: the Docker Postgres URL has no sslmode, so the offending
parameter simply wasn't there. These tests drive the translation directly from a
string, so they catch it regardless of which database is running.
"""

import pytest

from api._lib.db import _url_and_connect_args

NEON = (
    "postgresql://u:p@ep-restless-king-pooler.c-10.us-east-1.aws.neon.tech"
    "/neondb?sslmode=require"
)
LOCAL = "postgresql://manish:devpass@localhost:55432/manish_portfolio"


def test_strips_sslmode_and_converts_it_to_asyncpg_ssl(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", NEON)
    url, connect_args = _url_and_connect_args()

    # The parameter asyncpg chokes on must be gone from the URL...
    assert "sslmode" not in url.query
    assert "sslmode" not in str(url)
    # ...and re-expressed as the argument asyncpg does understand.
    assert connect_args["ssl"] is True


def test_uses_the_asyncpg_driver(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", NEON)
    url, _ = _url_and_connect_args()
    assert url.drivername == "postgresql+asyncpg"
    assert url.host.endswith("neon.tech")
    assert url.database == "neondb"


def test_local_url_is_untouched_and_gets_no_ssl(monkeypatch):
    """The exact case that hid the bug: no sslmode present, so nothing to strip."""
    monkeypatch.setenv("DATABASE_URL", LOCAL)
    url, connect_args = _url_and_connect_args()
    assert url.host == "localhost"
    assert url.port == 55432
    assert "ssl" not in connect_args


@pytest.mark.parametrize("param", ["channel_binding=require", "target_session_attrs=read-write"])
def test_other_libpq_only_params_are_stripped(monkeypatch, param):
    monkeypatch.setenv("DATABASE_URL", f"{NEON}&{param}")
    url, _ = _url_and_connect_args()
    assert param.split("=")[0] not in url.query


@pytest.mark.parametrize("dsn", [NEON, LOCAL])
def test_statement_cache_is_always_disabled(dsn, monkeypatch):
    """Mandatory behind PgBouncer in transaction mode, harmless elsewhere.

    Without it asyncpg raises DuplicatePreparedStatementError intermittently —
    the kind of failure that looks random and costs a day to trace.
    """
    monkeypatch.setenv("DATABASE_URL", dsn)
    _, connect_args = _url_and_connect_args()
    assert connect_args["statement_cache_size"] == 0


def test_sslmode_disable_does_not_request_ssl(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"{LOCAL}?sslmode=disable")
    url, connect_args = _url_and_connect_args()
    assert "sslmode" not in url.query
    assert "ssl" not in connect_args
