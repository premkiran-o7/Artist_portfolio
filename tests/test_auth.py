import os
import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient

os.environ.setdefault("ADMIN_USERNAME", "manish")
os.environ.setdefault("ADMIN_PASSWORD_HASH", PasswordHasher().hash("correct-horse"))
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")

from api.index import app  # noqa: E402

# The login cookie is Secure (see api/_lib/auth.py), so it is only ever sent back
# over https. The default TestClient base_url is http://testserver, which makes
# httpx's cookie jar silently drop it on the next request — matching real browser
# behavior for a Secure cookie on plain HTTP. Use an https base_url so the client
# round-trips the cookie the way it will in production.
client = TestClient(app, base_url="https://testserver")


def test_login_with_correct_credentials_sets_httponly_cookie():
    r = client.post("/api/py/login", json={"username": "manish", "password": "correct-horse"})
    assert r.status_code == 200
    cookie = r.headers["set-cookie"]
    assert "HttpOnly" in cookie and "samesite=lax" in cookie.lower()


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


# The CSRF-header test (test_write_without_csrf_header_is_rejected) depends on
# Task 12's POST /api/py/videos route existing, and is deferred to that task.
# require_admin's X-Requested-With enforcement is implemented now regardless.
