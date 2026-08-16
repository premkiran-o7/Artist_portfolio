import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Category(str, enum.Enum):
    color_grade = "color-grade"
    short_form = "short-form"
    text_tracking = "text-tracking"
    three_d = "3d-modeling"


class Visibility(str, enum.Enum):
    public = "public"
    unlisted = "unlisted"


class Video(Base):
    __tablename__ = "videos"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[Category] = mapped_column(Enum(Category, name="category", values_callable=lambda e: [m.value for m in e]), nullable=False)
    youtube_url: Mapped[str] = mapped_column(String, nullable=False)
    youtube_id: Mapped[str] = mapped_column(String, nullable=False)
    visibility: Mapped[Visibility] = mapped_column(
        Enum(Visibility, name="visibility", values_callable=lambda e: [m.value for m in e]),
        nullable=False, default=Visibility.unlisted,
    )
    thumb_url: Mapped[str | None] = mapped_column(String)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Playlist(Base):
    __tablename__ = "playlists"
    category: Mapped[Category] = mapped_column(
        Enum(Category, name="category", values_callable=lambda e: [m.value for m in e]),
        primary_key=True,
    )
    youtube_playlist_url: Mapped[str] = mapped_column(String, nullable=False)


class Client(Base):
    __tablename__ = "clients"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    instagram_url: Mapped[str] = mapped_column(String, nullable=False)
    thumb_url: Mapped[str | None] = mapped_column(String)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class ComingSoon(Base):
    __tablename__ = "coming_soon"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    blurb: Mapped[str | None] = mapped_column(Text)
    thumb_url: Mapped[str | None] = mapped_column(String)
    is_live: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Photo(Base):
    __tablename__ = "photos"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[Category] = mapped_column(Enum(Category, name="category", values_callable=lambda e: [m.value for m in e]), nullable=False)
    image_url: Mapped[str] = mapped_column(String, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    ip: Mapped[str] = mapped_column(String, primary_key=True)
    failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
