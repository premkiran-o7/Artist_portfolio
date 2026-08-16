import type { PhotoRow, VideoRow } from "./db";

/**
 * Pure category-grouping helpers for the public "Work" section
 * (components/CategoryCards.tsx / VideoLightbox.tsx / YouTubeFacade.tsx).
 *
 * Deliberately independent of lib/db.ts's *runtime* exports — only
 * VideoRow's type is imported here, which TypeScript erases at compile
 * time (an `import type` never emits a JS import). That matters because
 * CategoryCards is a "use client" component: if it (transitively) imported
 * anything that executes `import { neon } from "@neondatabase/serverless"`
 * at module scope, that database driver would ship to the browser. Keeping
 * these functions here, operating on plain data, means the client bundle
 * never sees lib/db.ts at all — the server (app/page.tsx) calls getVideos()
 * and resolveThumb() and hands the client only plain, pre-resolved props.
 */

// The categories that get a card in the public Work grid. "3d-modeling" is
// deliberately excluded — it has its own photo gallery section
// (components/ThreeDGallery.tsx), not a card here. Labels match
// components/admin/RowList.tsx's CATEGORIES verbatim so the vocabulary is
// identical between the admin dropdown and the public card titles.
//
// This list is a SUBSET of the admin vocabulary, not a mirror of it: a category
// can exist for uploading and organising work without being shown publicly.
export const CARD_CATEGORIES = [
  { value: "color-grade", label: "Color Grade" },
  // Short Form is hidden from the public Work grid at Manish's request
  // (2026-08-16) — uncomment this line to bring the card back.
  //
  // Commented out rather than deleted, and left in place in the ADMIN
  // vocabulary (components/admin/RowList.tsx's CATEGORIES, api/_lib/models.py's
  // `category` enum, the `short-form` upload folder): short-form videos already
  // in the table stay editable and keep their rows, they simply have no card to
  // appear on. Deleting the value from the admin side instead would strand
  // those rows behind a dropdown that can no longer represent them.
  // { value: "short-form", label: "Short Form" },
  { value: "text-tracking", label: "Text Tracking" },
] as const;

export type CardCategoryValue = (typeof CARD_CATEGORIES)[number]["value"];

/**
 * The subset of VideoRow that ever needs to reach the browser: thumb_url,
 * youtube_url and visibility never leave the server. `thumb` is
 * resolveThumb()'s OUTPUT, resolved server-side (see app/page.tsx) so the
 * client never needs the raw thumb_url/youtube_id fallback logic itself —
 * just the already-decided URL.
 */
export type CategoryVideo = Pick<
  VideoRow,
  "id" | "title" | "category" | "youtube_id" | "is_featured" | "sort_order"
> & { thumb: string };

/**
 * The subset of a `photos` row components/ThreeDGallery.tsx needs. Same shape
 * as CategoryVideo: plain data, safe for a "use client" component, with
 * runtime imports from lib/db.ts kept out via `import type`.
 */
export type PhotoCard = Pick<PhotoRow, "id" | "title" | "category" | "image_url">;

type MinimalVideo = { category: string; is_featured: boolean; sort_order: number };

/**
 * Videos belonging to `category`, preserving input order. getVideos()
 * already orders by `sort_order ASC, created_at DESC` — callers should not
 * re-sort the result.
 */
export function videosForCategory<T extends MinimalVideo>(videos: T[], category: string): T[] {
  return videos.filter((v) => v.category === category);
}

/**
 * Generic category filter, preserving input order — the same filter as
 * `videosForCategory` above, minus its `is_featured`/`sort_order`
 * requirement. `videosForCategory` stays scoped to `CategoryVideo` because
 * that stricter `MinimalVideo` constraint is what lets `pickCardThumb` accept
 * its result; ThreeDGallery.tsx has no cover-thumbnail logic and needs to
 * filter both `CategoryVideo[]` and `PhotoCard[]` (photos carry no
 * `is_featured` at all — see migrations/002_photos.sql), so it uses this one
 * instead.
 */
export function byCategory<T extends { category: string }>(items: T[], category: string): T[] {
  return items.filter((item) => item.category === category);
}

/**
 * The video to use as a category card's cover thumbnail: the is_featured
 * video if one exists, otherwise the video with the lowest sort_order.
 *
 * Tie-break: when several videos share the lowest sort_order and none is
 * featured, the earliest one in `videos` wins. Since getVideos()'s own
 * tiebreaker is `created_at DESC`, "earliest in the array" among tied rows
 * already means "most recently added" — so this stays consistent with the
 * order the admin dashboard shows, without this function needing to know
 * anything about timestamps.
 *
 * Returns null for an empty list; the caller renders the "Coming soon"
 * empty state instead of a broken image.
 */
export function pickCardThumb<T extends MinimalVideo>(videos: T[]): T | null {
  if (videos.length === 0) return null;
  const featured = videos.find((v) => v.is_featured);
  if (featured) return featured;
  return videos.reduce((lowest, v) => (v.sort_order < lowest.sort_order ? v : lowest));
}
