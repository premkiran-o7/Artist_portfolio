import os
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .models import LoginAttempt

COOKIE_NAME = "manish_admin"
TOKEN_DAYS = 7
MAX_LOGIN_FAILURES = 10
LOCKOUT_MINUTES = 15
_hasher = PasswordHasher()
router = APIRouter()


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
    ip = request.client.host if request.client else "unknown"
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
        if attempt is None:
            attempt = LoginAttempt(ip=ip, failures=0, locked_until=None)
            session.add(attempt)
        attempt.failures += 1
        if attempt.failures >= MAX_LOGIN_FAILURES:
            attempt.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
        await session.commit()
        raise HTTPException(401, "invalid credentials")

    if attempt is not None:
        await session.delete(attempt)
        await session.commit()

    response.set_cookie(
        COOKIE_NAME, _issue_token(body.username),
        httponly=True, secure=True, samesite="lax",
        max_age=TOKEN_DAYS * 86400, path="/",
    )
    return {"ok": True}


@router.post("/api/py/logout")
async def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/api/py/me")
async def me(username: str = Depends(require_admin)) -> dict[str, str]:
    return {"username": username}
