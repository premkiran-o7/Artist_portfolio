"""R2 presigned-upload signing (Task 13).

Vercel serverless functions cap request bodies at 4.5MB, but Manish's showreel is 5-8MB, so
the file must never pass through FastAPI. Instead the browser asks this route to sign a PUT
URL, then uploads the bytes straight to R2.

Security model:
- The object key is built entirely server-side: a folder derived from the enum-validated
  `category` plus a fresh UUID. The client's `filename` contributes *only* a sanitised
  extension (looked up from an allowlist keyed by contentType) -- never a path, never raw
  client text. A client sending `filename="../../evil.jpg"` cannot influence the key beyond
  its extension (see test_key_is_derived_from_category_not_client_input).
- `contentType` is checked against an allowlist (not a denylist).
- `sizeBytes` is capped at signing time. This is a *declared* size the client reports about
  itself -- boto3 presigning cannot enforce actual upload size, so a client could still PUT
  more bytes than it declared. That's a real limitation of presigned uploads, not something
  fixable at this layer (see task-13-report.md).

`category` here is intentionally NOT the `Category` enum used for videos (color-grade,
short-form, text-tracking, 3d-modeling). It's the wider set of upload destinations --
FOLDERS below also includes `clients`, `showreel`, and `profile`, which are folders for
client-logo thumbnails, Manish's showreel, and his portrait, not video categories.
Validating against `Category` would make it impossible to upload the showreel or the
portrait, which defeats the point of this route.
"""

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import require_admin
from .r2 import presign_put, public_url

router = APIRouter()

MAX_BYTES = 20 * 1024 * 1024

ALLOWED: dict[str, str] = {
    "video/mp4": ".mp4",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

FOLDERS: dict[str, str] = {
    "color-grade": "color-grade/thumbs",
    "short-form": "short-form/thumbs",
    "text-tracking": "text-tracking/thumbs",
    "3d-modeling": "3d-modeling/thumbs",
    "clients": "clients/thumbs",
    "coming-soon": "coming-soon/thumbs",
    "showreel": "showreel",
    "profile": "profile",
}


class SignRequest(BaseModel):
    filename: str = Field(min_length=1)
    contentType: str
    category: str
    sizeBytes: int = Field(ge=0)


class SignResponse(BaseModel):
    uploadUrl: str
    publicUrl: str
    key: str


@router.post("/api/py/uploads/sign", response_model=SignResponse)
async def sign_upload(
    body: SignRequest,
    _admin: str = Depends(require_admin),
) -> SignResponse:
    if body.contentType not in ALLOWED:
        raise HTTPException(422, "unsupported content type")
    if body.sizeBytes > MAX_BYTES:
        raise HTTPException(422, "file exceeds the 20MB upload limit")
    if body.category not in FOLDERS:
        raise HTTPException(422, "unknown upload category")

    # The key is built entirely from server-controlled values: the folder from FOLDERS
    # (looked up by the now-validated category) and a fresh UUID. body.filename is never
    # read again past this point -- it cannot reach the key.
    extension = ALLOWED[body.contentType]
    key = f"{FOLDERS[body.category]}/{uuid4().hex}{extension}"

    return SignResponse(
        uploadUrl=presign_put(key, body.contentType),
        publicUrl=public_url(key),
        key=key,
    )
