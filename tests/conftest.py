"""Shared pytest fixtures.

api/_lib/db.py reads DATABASE_URL from the environment at *import time*, and every test
module that touches a route eventually imports it (transitively, via api.index). Nothing
before this file loaded .env.local, so the whole suite failed on collection.

Fix: load .env.local here, before anything imports api.index / api._lib.db. But
tests/test_auth.py deliberately sets throwaway admin credentials with
os.environ.setdefault(...) so it never authenticates against the real admin account. If we
bulk-loaded .env.local into the environment first, those setdefault calls would be no-ops
and test_auth.py (and the new admin_client fixture below) would start running against
Manish's real password hash.

Resolution: pull *only* DATABASE_URL out of .env.local — that's the one value the DB-backed
tests actually need. We also set the same throwaway ADMIN_USERNAME / ADMIN_PASSWORD_HASH /
JWT_SECRET here (via setdefault, mirroring test_auth.py) so a solo run of
`pytest tests/test_videos.py` — which never imports test_auth.py — still has a working
admin login. REVALIDATE_SECRET and SITE_URL are deliberately never loaded either, so
api/_lib/revalidate.py's bust_cache() stays a silent no-op during tests (no real outbound
HTTP call, no test flakiness).

Never read, print, or log the *values* of .env.local beyond piping DATABASE_URL into
os.environ — see the task brief.
"""

import asyncio
import os
from pathlib import Path

import asyncpg
import pytest
from argon2 import PasswordHasher
from dotenv import dotenv_values
from fastapi.testclient import TestClient

# Throwaway admin credentials — set first, via setdefault, so real .env.local values
# (loaded below) can never override them.
os.environ.setdefault("ADMIN_USERNAME", "manish")
ADMIN_PASSWORD = "correct-horse"
os.environ.setdefault("ADMIN_PASSWORD_HASH", PasswordHasher().hash(ADMIN_PASSWORD))
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")

# Load only DATABASE_URL from .env.local. dotenv_values() returns a dict without touching
# os.environ itself, so we control exactly what leaks through.
_dotenv_path = Path(__file__).resolve().parent.parent / ".env.local"
_dotenv = dotenv_values(_dotenv_path)
if _dotenv.get("DATABASE_URL"):
    os.environ.setdefault("DATABASE_URL", _dotenv["DATABASE_URL"])

# Import the app only after the environment above is in place — api.index imports
# api._lib.db (transitively), which reads DATABASE_URL at import time.
from api.index import app  # noqa: E402

_TABLES = "videos, playlists, clients, coming_soon, login_attempts"


async def _truncate_all() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        await conn.execute(f"TRUNCATE {_TABLES} RESTART IDENTITY CASCADE")
    finally:
        await conn.close()


@pytest.fixture(autouse=True)
def _clean_database():
    """Every test starts and ends with empty tables, so no test leaks state into another.

    Uses a standalone asyncpg connection (not the app's SQLAlchemy engine) so cleanup never
    depends on which event loop the app happened to run requests on during the test.
    """
    asyncio.run(_truncate_all())
    yield
    asyncio.run(_truncate_all())


@pytest.fixture
def client_no_cookie(_clean_database) -> TestClient:
    """An unauthenticated client. https base_url so Secure cookies would round-trip like a
    real browser if one were ever set (see tests/test_auth.py for why this matters)."""
    return TestClient(app, base_url="https://testserver")


@pytest.fixture
def admin_client(_clean_database) -> TestClient:
    """Logged-in client that also sends X-Requested-With on every request, satisfying
    require_admin's CSRF check on mutating routes."""
    c = TestClient(app, base_url="https://testserver", headers={"x-requested-with": "fetch"})
    r = c.post(
        "/api/py/login",
        json={"username": os.environ["ADMIN_USERNAME"], "password": ADMIN_PASSWORD},
    )
    assert r.status_code == 200, r.text
    return c


@pytest.fixture
def admin_client_no_csrf(_clean_database) -> TestClient:
    """Logged-in client that deliberately omits X-Requested-With, for the CSRF test."""
    c = TestClient(app, base_url="https://testserver")
    r = c.post(
        "/api/py/login",
        json={"username": os.environ["ADMIN_USERNAME"], "password": ADMIN_PASSWORD},
    )
    assert r.status_code == 200, r.text
    return c
