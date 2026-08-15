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

/** Thumbnail precedence: Manish's upload wins; otherwise YouTube's own. */
export function resolveThumb(v: VideoRow): string {
  return v.thumb_url ?? thumbnailUrl(v.youtube_id);
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
  run: (sql: NeonQueryFunction<false, false>) => Promise<T[]>
): Promise<T[]> {
  const url = process.env.DATABASE_URL;
  if (!url) return [];
  try {
    const sql = neon(url);
    return await run(sql);
  } catch {
    return [];
  }
}

export async function getVideos(): Promise<VideoRow[]> {
  return safeQuery<VideoRow>(async (sql) => {
    const rows = await sql`
      SELECT id::text, title, category::text, youtube_url, youtube_id,
             visibility::text, thumb_url, is_featured, sort_order
      FROM videos ORDER BY sort_order ASC, created_at DESC
    `;
    return rows as VideoRow[];
  });
}

export async function getPlaylists(): Promise<PlaylistRow[]> {
  return safeQuery<PlaylistRow>(async (sql) => {
    const rows = await sql`
      SELECT category::text, youtube_playlist_url
      FROM playlists
    `;
    return rows as PlaylistRow[];
  });
}

export async function getClients(): Promise<ClientRow[]> {
  return safeQuery<ClientRow>(async (sql) => {
    const rows = await sql`
      SELECT id::text, name, instagram_url, thumb_url, sort_order
      FROM clients ORDER BY sort_order ASC
    `;
    return rows as ClientRow[];
  });
}

export async function getComingSoon(): Promise<ComingSoonRow[]> {
  return safeQuery<ComingSoonRow>(async (sql) => {
    const rows = await sql`
      SELECT id::text, title, blurb, thumb_url, is_live
      FROM coming_soon
    `;
    return rows as ComingSoonRow[];
  });
}
