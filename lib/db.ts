import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { thumbnailUrl } from "./youtube";

export type VideoRow = {
  id: string;
  title: string;
  category: string;
  youtube_url: string;
  youtube_id: string;
  visibility: string;
  thumb_url: string | null;
  is_featured: boolean;
  sort_order: number;
};

export type PlaylistRow = {
  category: string;
  youtube_playlist_url: string;
};

export type ClientRow = {
  id: string;
  name: string;
  instagram_url: string;
  thumb_url: string | null;
  sort_order: number;
};

export type ComingSoonRow = {
  id: string;
  title: string;
  blurb: string | null;
  thumb_url: string | null;
  is_live: boolean;
};

export type PhotoRow = {
  id: string;
  title: string;
  category: string;
  image_url: string;
  sort_order: number;
};

/**
 * Thumbnail precedence: Manish's upload wins; otherwise YouTube's own.
 *
 * `||`, not `??`: the admin PATCH endpoints silently ignore an explicit
 * `null` (see api/_lib/routes_videos.py / routes_clients.py — `if value is
 * None: continue`), so a dashboard control can never clear `thumb_url` back
 * to `NULL`. Sending `""` instead does get written, and falsy-coalescing
 * here is what makes that value actually fall back to the YouTube-derived
 * thumbnail instead of rendering a broken image. `??` would treat `""` as
 * "present" and never fall back — that was the bug. `""` is therefore the
 * one working way to clear a thumbnail from the admin UI; never send `null`.
 */
export function resolveThumb(v: VideoRow): string {
  return v.thumb_url || thumbnailUrl(v.youtube_id);
}

/**
 * Runs a build-time Postgres read and never throws.
 *
 * This site is statically generated: every `get*` below runs at *build* time,
 * and again hourly via the page's `revalidate` (plus on-demand via the
 * revalidation webhook). A missing `DATABASE_URL`, a network blip, or an empty
 * table must degrade to an empty section, not fail the deploy. `neon()` itself
 * throws synchronously on a missing/malformed connection string, so the guard
 * has to wrap construction of the client, not just the query call.
 */
async function safeQuery<T>(
  label: string,
  run: (sql: NeonQueryFunction<false, false>) => Promise<T[]>
): Promise<T[]> {
  const url = process.env.DATABASE_URL;
  if (!url) return [];
  try {
    const sql = neon(url);
    return await run(sql);
  } catch (err) {
    // Never rethrow — see the contract above — but never swallow silently
    // either. Without this line a SQL typo, a schema drift or an unreachable
    // database blanks an entire section of the live site and the build output
    // looks completely clean, so there is nothing to notice and nothing to
    // grep for. `label` is what makes it actionable: "getVideos failed" points
    // at one query, whereas a bare stack trace from inside a tagged-template
    // driver does not.
    //
    // This is not hypothetical. It cost real time during Task 20: `neon()`
    // speaks HTTPS, not the Postgres wire protocol, so it cannot talk to the
    // local Postgres container at all — every getter returned [] and every
    // data-driven section rendered empty, locally and identically to the
    // legitimate "no rows yet" state, with zero output to distinguish them.
    console.error(`[db] ${label} failed; section will render empty:`, err);
    return [];
  }
}

export async function getVideos(): Promise<VideoRow[]> {
  return safeQuery<VideoRow>("getVideos", async (sql) => {
    const rows = await sql`
      SELECT id::text, title, category::text, youtube_url, youtube_id,
             visibility::text, thumb_url, is_featured, sort_order
      FROM videos ORDER BY sort_order ASC, created_at DESC
    `;
    return rows as VideoRow[];
  });
}

export async function getPlaylists(): Promise<PlaylistRow[]> {
  return safeQuery<PlaylistRow>("getPlaylists", async (sql) => {
    const rows = await sql`
      SELECT category::text, youtube_playlist_url
      FROM playlists
    `;
    return rows as PlaylistRow[];
  });
}

export async function getClients(): Promise<ClientRow[]> {
  return safeQuery<ClientRow>("getClients", async (sql) => {
    const rows = await sql`
      SELECT id::text, name, instagram_url, thumb_url, sort_order
      FROM clients ORDER BY sort_order ASC
    `;
    return rows as ClientRow[];
  });
}

export async function getComingSoon(): Promise<ComingSoonRow[]> {
  return safeQuery<ComingSoonRow>("getComingSoon", async (sql) => {
    const rows = await sql`
      SELECT id::text, title, blurb, thumb_url, is_live
      FROM coming_soon
    `;
    return rows as ComingSoonRow[];
  });
}

export async function getPhotos(): Promise<PhotoRow[]> {
  return safeQuery<PhotoRow>("getPhotos", async (sql) => {
    const rows = await sql`
      SELECT id::text, title, category::text, image_url, sort_order
      FROM photos ORDER BY sort_order ASC
    `;
    return rows as PhotoRow[];
  });
}
