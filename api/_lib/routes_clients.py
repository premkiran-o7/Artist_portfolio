from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import require_admin
from .db import get_session
from .models import Category, Client, ComingSoon, Playlist
from .revalidate import bust_cache

router = APIRouter()


# --- clients ---


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    instagram_url: str
    thumb_url: str | None
    sort_order: int


class ClientIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    instagram_url: str = Field(min_length=1)
    thumb_url: str | None = None
    sort_order: int = 0


class ClientPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    instagram_url: str | None = Field(default=None, min_length=1)
    thumb_url: str | None = None
    sort_order: int | None = None


@router.get("/api/py/clients", response_model=list[ClientOut])
async def list_clients(session: AsyncSession = Depends(get_session)) -> list[Client]:
    stmt = select(Client).order_by(Client.sort_order)
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("/api/py/clients", status_code=201, response_model=ClientOut)
async def create_client(
    body: ClientIn,
    _admin: str = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> Client:
    client = Client(**body.model_dump())
    session.add(client)
    await session.commit()
    await session.refresh(client)
    await bust_cache()
    return client


@router.patch("/api/py/clients/{client_id}", response_model=ClientOut)
async def update_client(
    client_id: UUID,
    body: ClientPatch,
    _admin: str = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> Client:
    client = await session.get(Client, client_id)
    if client is None:
        raise HTTPException(404, "client not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    await session.commit()
    await session.refresh(client)
    await bust_cache()
    return client


@router.delete("/api/py/clients/{client_id}", status_code=204)
async def delete_client(
    client_id: UUID,
    _admin: str = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> None:
    client = await session.get(Client, client_id)
    if client is None:
        raise HTTPException(404, "client not found")
    await session.delete(client)
    await session.commit()
    await bust_cache()


# --- coming-soon ---


class ComingSoonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    blurb: str | None
    thumb_url: str | None
    is_live: bool


class ComingSoonIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    blurb: str | None = None
    thumb_url: str | None = None
    is_live: bool = False


class ComingSoonPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    blurb: str | None = None
    thumb_url: str | None = None
    is_live: bool | None = None


@router.get("/api/py/coming-soon", response_model=list[ComingSoonOut])
async def list_coming_soon(session: AsyncSession = Depends(get_session)) -> list[ComingSoon]:
    result = await session.execute(select(ComingSoon))
    return list(result.scalars().all())


@router.post("/api/py/coming-soon", status_code=201, response_model=ComingSoonOut)
async def create_coming_soon(
    body: ComingSoonIn,
    _admin: str = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> ComingSoon:
    item = ComingSoon(**body.model_dump())
    session.add(item)
    await session.commit()
    await session.refresh(item)
    await bust_cache()
    return item


@router.patch("/api/py/coming-soon/{item_id}", response_model=ComingSoonOut)
async def update_coming_soon(
    item_id: UUID,
    body: ComingSoonPatch,
    _admin: str = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> ComingSoon:
    item = await session.get(ComingSoon, item_id)
    if item is None:
        raise HTTPException(404, "coming-soon item not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await session.commit()
    await session.refresh(item)
    await bust_cache()
    return item


# --- playlists ---


class PlaylistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category: Category
    youtube_playlist_url: str


class PlaylistIn(BaseModel):
    youtube_playlist_url: str = Field(min_length=1)


@router.put("/api/py/playlists/{category}", response_model=PlaylistOut)
async def upsert_playlist(
    category: Category,
    body: PlaylistIn,
    _admin: str = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> Playlist:
    playlist = await session.get(Playlist, category)
    if playlist is None:
        playlist = Playlist(category=category, youtube_playlist_url=body.youtube_playlist_url)
        session.add(playlist)
    else:
        playlist.youtube_playlist_url = body.youtube_playlist_url
    await session.commit()
    await session.refresh(playlist)
    await bust_cache()
    return playlist
