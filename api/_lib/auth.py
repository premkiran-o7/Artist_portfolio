import os
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .models import LoginAttempt

COOKIE_NAME = "manish_admin"
TOKEN_DAYS = 7
MAX_LOGIN_FAILURES = 10
LOCKOUT_MINUTES = 15
_hasher = PasswordHasher()
router = APIRouter()

# Atomic upsert for the failure counter. A plain read-modify-write (SELECT, then
# UPDATE/INSERT in Python) loses increments under concurrent brute-force requests — two
# requests can both read failures=9 and both write back 10, undercounting an attack that
# should have tripped the lock — and a first-ever failure from two concurrent requests
# races two INSERTs into an IntegrityError (500 instead of 401). ON CONFLICT DO UPDATE
# does the read, increment and write as one statement, serialized by Postgres on the (ip)
# primary key, so neither race is possible.
#
# The inner CASE also resets the counter server-side the moment a previously-expired lock
# is observed (la.locked_until <= now()) — otherwise `failures` sits at >= threshold
# forever, so the next single mistyped password re-locks for another full 15 minutes.
_UPSERT_LOGIN_FAILURE = text(
    """
    INSERT INTO login_attempts AS la (ip, failures, locked_until)
    VALUES (:ip, 1, NULL)
    ON CONFLICT (ip) DO UPDATE SET
        failures = CASE
            WHEN la.locked_until IS NOT NULL AND la.locked_until <= now() THEN 1
            ELSE la.failures + 1
        END,
        locked_until = CASE
            WHEN (
                CASE
                    WHEN la.locked_until IS NOT NULL AND la.locked_until <= now() THEN 1
                    ELSE la.failures + 1
                END
            ) >= :max_failures
            THEN now() + (:lockout_minutes * interval '1 minute')
            ELSE NULL
        END
    """
)


def _client_ip(request: Request) -> str:
    """Best-effort real client IP, safe to key a lockout table on.

    On Vercel, `x-forwarded-for` is set to the request's actual public IP and Vercel
    overwrites whatever a client sends before it reaches the function — a plain client
    cannot spoof it (Enterprise "trusted proxy" can opt out of this, which this project
    does not use). `x-real-ip` is documented as identical. Verified against
    https://vercel.com/docs/headers/request-headers (fetched 2026-08-15).

    `request.client.host` is the last resort: on Vercel it would just be Vercel's own
    edge IP (everyone would share one bucket), but it's the only thing available for the
    local dev server and the test suite, where neither header is present.
    """
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else "unknown"


class LoginBody(BaseModel):
    username: str
    password: str


def _issue_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")


async def require_admin(request: Request) -> str:
    """Gate for every mutating route. Returns the admin username."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(401, "not authenticated")
    try:
        claims = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid session")

    # CSRF defence (spec §8). SameSite=Lax already blocks cross-site POSTs in modern
    # browsers, but a custom header cannot be set by a plain cross-origin <form>, so
    # requiring one closes the gap for anything Lax misses. Safe methods are exempt.
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        if request.headers.get("x-requested-with") != "fetch":
            raise HTTPException(403, "missing X-Requested-With header")

    return claims["sub"]


@router.post("/api/py/login")
async def login(
    body: LoginBody,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    # Lockout is tracked in a table, not an in-memory counter, because serverless
    # functions share no memory between invocations (spec §8; deferred from Task 11).
    ip = _client_ip(request)
    now = datetime.now(timezone.utc)

    attempt = await session.get(LoginAttempt, ip)
    if attempt is not None and attempt.locked_until is not None and attempt.locked_until > now:
        raise HTTPException(429, "too many failed attempts, try again later")

    valid = body.username == os.environ["ADMIN_USERNAME"]
    if valid:
        try:
            _hasher.verify(os.environ["ADMIN_PASSWORD_HASH"], body.password)
        except VerifyMismatchError:
            valid = False

    if not valid:
        await session.execute(
            _UPSERT_LOGIN_FAILURE,
            {"ip": ip, "max_failures": MAX_LOGIN_FAILURES, "lockout_minutes": LOCKOUT_MINUTES},
        )
        await session.commit()
        raise HTTPException(401, "invalid credentials")

    await session.execute(delete(LoginAttempt).where(LoginAttempt.ip == ip))
    await session.commit()

    response.set_cookie(
        COOKIE_NAME, _issue_token(body.username),
        httponly=True, secure=True, samesite="lax",
        max_age=TOKEN_DAYS * 86400, path="/",
    )
    return {"ok": True}


@router.post("/api/py/logout")
async def logout(response: Response, _admin: str = Depends(require_admin)) -> dict[str, bool]:
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/api/py/me")
async def me(username: str = Depends(require_admin)) -> dict[str, str]:
    return {"username": username}
