-- Photo work, added 2026-08-16.
--
-- Every other piece of work on this site is a YouTube video, and the `videos`
-- table hard-requires `youtube_url`/`youtube_id`. Manish's 3D modelling work is
-- stills — renders, not footage — so it cannot be represented there at all.
--
-- This was originally specced as images committed to the repo under
-- public/work/3d/, purely because no object storage existed. Supabase Storage
-- is now configured and verified, so photos are uploaded and deleted from the
-- admin panel like everything else, and Manish is not dependent on a redeploy
-- to change his own portfolio.
--
-- Carries `category` rather than being a 3D-only table: the site already has a
-- category vocabulary, a photo belongs to one as naturally as a video does, and
-- a `photos_3d` table would have to be duplicated the first time he shoots
-- stills for anything else. The 3D section reads photos AND videos in
-- `3d-modeling`, so a turntable animation can sit beside the renders without
-- any schema change.
CREATE TABLE photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  category   category NOT NULL,
  image_url  text NOT NULL,          -- public URL in object storage; no local fallback
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The public page reads one category at a time and orders within it; matches
-- how videos are queried.
CREATE INDEX photos_category_sort_idx ON photos (category, sort_order);
