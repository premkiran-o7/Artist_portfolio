"""Photo CRUD for the 3D Modeling section (migrations/002_photos.sql, Task 21).

Mirrors routes_clients.py's clients section almost exactly: GET carries no auth (same as
/videos and /clients — the public site's build-time getPhotos() reads this table with no
session), POST/PATCH/DELETE sit behind require_admin, and every mutation calls
bust_cache() so the public page's ISR cache doesn't wait out the hourly backstop.

Photo has no nullable column (title, category and image_url are all NOT NULL — see the
migration), so there is no field PhotoPatch can legitimately clear to "". The
`if value is None: continue` skip below still exists, for the same defensive reason it
exists on every other PATCH route in this codebase: an explicit `{"title": null}` must not
reach the database as a raw IntegrityError -> 500.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import require_admin
from .db import get_session
from .models import Category, Photo
from .revalidate import bust_cache

router = APIRouter()


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    category: Category
    image_url: str
    sort_order: int
    created_at: datetime


class PhotoIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: Category
    image_url: str = Field(min_length=1)
    sort_order: int = 0


class PhotoPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: Category | None = None
    image_url: str | None = Field(default=None, min_length=1)
    sort_order: int | None = None


@router.get("/api/py/photos", response_model=list[PhotoOut])
async def list_photos(session: AsyncSession = Depends(get_session)) -> list[Photo]:
    stmt = select(Photo).order_by(Photo.sort_order)
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("/api/py/photos", status_code=201, response_model=PhotoOut)
async def create_photo(
    body: PhotoIn,
    _admin: str = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> Photo:
    photo = Photo(**body.model_dump())
    session.add(photo)
    await session.commit()
    await session.refresh(photo)
    await bust_cache()
    return photo


@router.patch("/api/py/photos/{photo_id}", response_model=PhotoOut)
async def update_photo(
    photo_id: UUID,
    body: PhotoPatch,
    _admin: str = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> Photo:
    photo = await session.get(Photo, photo_id)
    if photo is None:
        raise HTTPException(404, "photo not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        # Explicit `null` on a NOT NULL column would otherwise hit the database as a raw
        # IntegrityError -> 500.
        if value is None:
            continue
        setattr(photo, field, value)
    await session.commit()
    await session.refresh(photo)
    await bust_cache()
    return photo


@router.delete("/api/py/photos/{photo_id}", status_code=204)
async def delete_photo(
    photo_id: UUID,
    _admin: str = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> None:
    photo = await session.get(Photo, photo_id)
    if photo is None:
        raise HTTPException(404, "photo not found")
    await session.delete(photo)
    await session.commit()
    await bust_cache()
