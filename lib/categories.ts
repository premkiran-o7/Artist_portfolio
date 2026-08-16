import type { VideoRow } from "./db";

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

// This task (18) renders exactly these three categories as cards.
// "3d-modeling" is deliberately excluded here — it is Task 19's Coming Soon
// section (spec section 9, item 7), not this one. Labels match
// components/admin/RowList.tsx's CATEGORIES verbatim so the vocabulary is
// identical between the admin dropdown and the public card titles.
export const CARD_CATEGORIES = [
  { value: "color-grade", label: "Color Grade" },
  { value: "short-form", label: "Short Form" },
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
