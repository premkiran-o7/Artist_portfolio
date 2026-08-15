import os
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

COOKIE_NAME = "manish_admin"
TOKEN_DAYS = 7
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
async def login(body: LoginBody, response: Response) -> dict[str, bool]:
    if body.username != os.environ["ADMIN_USERNAME"]:
        raise HTTPException(401, "invalid credentials")
    try:
        _hasher.verify(os.environ["ADMIN_PASSWORD_HASH"], body.password)
    except VerifyMismatchError:
        raise HTTPException(401, "invalid credentials")

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
