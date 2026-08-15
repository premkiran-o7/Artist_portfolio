import asyncio
import os
from datetime import datetime, timedelta, timezone

import asyncpg
from fastapi.testclient import TestClient

from api.index import app

# The login cookie is Secure (see api/_lib/auth.py), so it is only ever sent back
# over https. The default TestClient base_url is http://testserver, which makes
# httpx's cookie jar silently drop it on the next request — matching real browser
# behavior for a Secure cookie on plain HTTP. Use an https base_url so the client
# round-trips the cookie the way it will in production.
client = TestClient(app, base_url="https://testserver")


def _seed_login_attempt(ip: str, failures: int, locked_until: datetime | None) -> None:
    """Directly write a login_attempts row, bypassing the API, so lockout-expiry
    behaviour can be tested without waiting 15 real minutes."""

    async def _seed() -> None:
        conn = await asyncpg.connect(os.environ["DATABASE_URL"])
        try:
            await conn.execute(
                "INSERT INTO login_attempts (ip, failures, locked_until) VALUES ($1, $2, $3)",
                ip, failures, locked_until,
            )
        finally:
            await conn.close()

    asyncio.run(_seed())


def test_login_with_correct_credentials_sets_httponly_cookie():
    r = client.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert r.status_code == 200
    cookie = r.headers["set-cookie"]
    assert "HttpOnly" in cookie
    assert "Secure" in cookie
    assert "samesite=lax" in cookie.lower()


def test_login_with_wrong_password_is_rejected():
    r = client.post("/api/py/login", json={"username": "manish", "password": "wrong"})
    assert r.status_code == 401


def test_me_without_cookie_is_rejected():
    fresh = TestClient(app, base_url="https://testserver")
    assert fresh.get("/api/py/me").status_code == 401


def test_me_with_cookie_succeeds():
    c = TestClient(app, base_url="https://testserver")
    c.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert c.get("/api/py/me").status_code == 200


def test_write_without_csrf_header_is_rejected(admin_client_no_csrf):
    r = admin_client_no_csrf.post("/api/py/videos", json={
        "title": "X", "category": "short-form",
        "youtube_url": "https://youtu.be/dQw4w9WgXcQ"})
    assert r.status_code == 403


def test_logout_requires_auth():
    fresh = TestClient(app, base_url="https://testserver")
    r = fresh.post("/api/py/logout", headers={"x-requested-with": "fetch"})
    assert r.status_code == 401


def test_logout_with_valid_session_succeeds():
    c = TestClient(app, base_url="https://testserver", headers={"x-requested-with": "fetch"})
    c.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    r = c.post("/api/py/logout")
    assert r.status_code == 200


def test_locks_out_after_ten_failures(client_no_cookie):
    for _ in range(10):
        client_no_cookie.post("/api/py/login", json={"username": "manish", "password": "x"})
    r = client_no_cookie.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert r.status_code == 429


def test_failed_attempts_below_threshold_do_not_lock_out(client_no_cookie):
    for _ in range(9):
        client_no_cookie.post("/api/py/login", json={"username": "manish", "password": "x"})
    r = client_no_cookie.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert r.status_code == 200


def test_successful_login_resets_failure_count(client_no_cookie):
    for _ in range(5):
        client_no_cookie.post("/api/py/login", json={"username": "manish", "password": "x"})
    ok = client_no_cookie.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert ok.status_code == 200
    for _ in range(9):
        client_no_cookie.post("/api/py/login", json={"username": "manish", "password": "x"})
    r = client_no_cookie.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert r.status_code == 200


def test_different_ip_is_unaffected_by_lockout():
    # Two clients keyed off different x-real-ip values are two different lockout buckets.
    attacker = TestClient(app, base_url="https://testserver", headers={"x-real-ip": "203.0.113.5"})
    for _ in range(10):
        attacker.post("/api/py/login", json={"username": "manish", "password": "x"})
    locked = attacker.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert locked.status_code == 429

    manish = TestClient(app, base_url="https://testserver", headers={"x-real-ip": "198.51.100.9"})
    r = manish.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert r.status_code == 200


def test_lock_lifts_after_expiry():
    ip = "203.0.113.77"
    _seed_login_attempt(ip, failures=10, locked_until=datetime.now(timezone.utc) - timedelta(seconds=1))
    c = TestClient(app, base_url="https://testserver", headers={"x-real-ip": ip})
    r = c.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert r.status_code == 200


def test_failures_reset_when_lock_has_expired():
    ip = "203.0.113.88"
    _seed_login_attempt(ip, failures=10, locked_until=datetime.now(timezone.utc) - timedelta(seconds=1))
    c = TestClient(app, base_url="https://testserver", headers={"x-real-ip": ip})
    # If the counter did NOT reset, this single failure would push it from 10 to 11 and
    # re-lock immediately (setting a fresh locked_until), and the next request — even
    # with the correct password — would come back 429 instead of 200.
    c.post("/api/py/login", json={"username": "manish", "password": "wrong"})
    r = c.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert r.status_code == 200
