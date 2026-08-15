CREATE TYPE category   AS ENUM ('color-grade','short-form','text-tracking','3d-modeling');
CREATE TYPE visibility AS ENUM ('public','unlisted');

CREATE TABLE videos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  category    category NOT NULL,
  youtube_url text NOT NULL,
  youtube_id  text NOT NULL,          -- parsed on save
  visibility  visibility NOT NULL DEFAULT 'unlisted',
  thumb_url   text,                   -- R2 URL; falls back to YouTube's thumbnail
  is_featured boolean NOT NULL DEFAULT false,   -- this video's thumbnail becomes the
                                                -- category card cover in section 5.
                                                -- Exactly one per category; setting a new
                                                -- one clears the previous. If none is set,
                                                -- the lowest sort_order video is used.
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON videos (category, sort_order);

CREATE TABLE playlists (              -- the three "Full Playlist" links
  category             category PRIMARY KEY,
  youtube_playlist_url text NOT NULL
);

CREATE TABLE clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  instagram_url text NOT NULL,
  thumb_url     text,
  sort_order    integer NOT NULL DEFAULT 0
);

CREATE TABLE coming_soon (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,           -- e.g. "3D Modeling"
  blurb      text,
  thumb_url  text,
  is_live    boolean NOT NULL DEFAULT false   -- flip to promote into the main grid
);

CREATE TABLE login_attempts (         -- serverless has no shared memory; lockout needs a table
  ip           text PRIMARY KEY,
  failures     integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);
