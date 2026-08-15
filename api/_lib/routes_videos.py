from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import require_admin
from .db import get_session
from .models import Category, Video, Visibility
from .revalidate import bust_cache
from .youtube import parse_youtube_id

router = APIRouter()


class VideoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    category: Category
    youtube_url: str
    youtube_id: str
    visibility: Visibility
    thumb_url: str | None
    is_featured: bool
    sort_order: int
    created_at: datetime


class VideoIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: Category
    youtube_url: str
    visibility: Visibility = Visibility.unlisted
    thumb_url: str | None = None
    is_featured: bool = False
    sort_order: int = 0

    @field_validator("youtube_url")
    @classmethod
    def _must_parse(cls, v: str) -> str:
        parse_youtube_id(v)  # raises ValueError -> FastAPI returns 422
        return v


class VideoPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: Category | None = None
    youtube_url: str | None = None
    visibility: Visibility | None = None
    thumb_url: str | None = None
    is_featured: bool | None = None
    sort_order: int | None = None

    @field_validator("youtube_url")
    @classmethod
    def _must_parse(cls, v: str | None) -> str | None:
        if v is not None:
            parse_youtube_id(v)
        return v


@router.get("/api/py/videos", response_model=list[VideoOut])
async def list_videos(
    category: Category | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[Video]:
    stmt = select(Video)
    if category is not None:
        stmt = stmt.where(Video.category == category)
    stmt = stmt.order_by(Video.sort_order, Video.created_at)
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("/api/py/videos", status_code=201, response_model=VideoOut)
async def create_video(
    body: VideoIn,
    _admin: str = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> Video:
    youtube_id = parse_youtube_id(body.youtube_url)

    # is_featured is exclusive per category: the featured video's thumbnail becomes the
    # category card's cover, so there can only ever be one. Clear the previous holder in
    # the same transaction as the insert below.
    if body.is_featured:
        await session.execute(
            update(Video).where(Video.category == body.category).values(is_featured=False)
        )

    video = Video(
        title=body.title,
        category=body.category,
        youtube_url=body.youtube_url,
        youtube_id=youtube_id,
        visibility=body.visibility,
        thumb_url=body.thumb_url,
        is_featured=body.is_featured,
        sort_order=body.sort_order,
    )
    session.add(video)
    await session.commit()
    await session.refresh(video)
    await bust_cache()
    return video


@router.patch("/api/py/videos/{video_id}", response_model=VideoOut)
async def update_video(
    video_id: UUID,
    body: VideoPatch,
    _admin: str = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> Video:
    video = await session.get(Video, video_id)
    if video is None:
        raise HTTPException(404, "video not found")

    data = body.model_dump(exclude_unset=True)

    # Use *effective* values, not just submitted ones. A PATCH that changes only
    # `category` (leaving `is_featured` untouched) still moves an already-featured video
    # into its new category — if we only checked the submitted `is_featured`, that move
    # would land without clearing whatever was already featured there, leaving two
    # featured videos in the target category.
    effective_featured = data.get("is_featured", video.is_featured)
    target_category = data.get("category", video.category)
    if effective_featured:
        await session.execute(
            update(Video)
            .where(Video.category == target_category, Video.id != video.id)
            .values(is_featured=False)
        )

    if "youtube_url" in data and data["youtube_url"] is not None:
        video.youtube_id = parse_youtube_id(data["youtube_url"])

    for field, value in data.items():
        # Explicit `null` on a NOT NULL column (e.g. {"title": null}) would otherwise hit
        # the database as a raw IntegrityError -> 500. Silently ignoring an explicit null
        # is a deliberate simplification, not full nullable-field validation.
        if value is None:
            continue
        setattr(video, field, value)

    await session.commit()
    await session.refresh(video)
    await bust_cache()
    return video


@router.delete("/api/py/videos/{video_id}", status_code=204)
async def delete_video(
    video_id: UUID,
    _admin: str = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> None:
    video = await session.get(Video, video_id)
    if video is None:
        raise HTTPException(404, "video not found")
    await session.delete(video)
    await session.commit()
    await bust_cache()
