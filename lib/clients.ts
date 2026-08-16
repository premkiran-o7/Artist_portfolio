import type { ClientRow, ComingSoonRow } from "./db";

/**
 * Pure helpers for the public "Client Work" (spec §9.6) and "Coming Soon"
 * (spec §9.7) sections — components/ClientGrid.tsx and
 * components/ComingSoon.tsx.
 *
 * Only *types* are imported from lib/db.ts, via `import type`, which
 * TypeScript erases at compile time. Both consumers are Server Components
 * today, but the same rule as lib/categories.ts applies: nothing here may
 * pull @neondatabase/serverless into a bundle, so keep this file free of
 * runtime imports from lib/db.ts.
 */

/**
 * The subset of a `clients` row a card actually renders. `ClientRow` is
 * assignable to this, so `app/page.tsx` can pass `getClients()`'s result
 * straight through without mapping.
 */
export type ClientCard = Pick<ClientRow, "id" | "name" | "instagram_url" | "thumb_url">;

/** Likewise for `coming_soon`; `is_live` is needed for the filter below. */
export type ComingSoonCard = Pick<
  ComingSoonRow,
  "id" | "title" | "blurb" | "thumb_url" | "is_live"
>;

/**
 * The teasers the Coming Soon section shows: everything NOT yet live.
 *
 * `is_live` is the admin's promote switch (migrations/001_init.sql: "flip to
 * promote into the main grid"), so a live row is by definition no longer a
 * teaser and must not appear here — otherwise flipping the switch would show
 * the same item twice.
 */
export function pendingTeasers<T extends { is_live: boolean }>(rows: T[]): T[] {
  return rows.filter((r) => !r.is_live);
}

/**
 * The exact complement of `pendingTeasers`: the rows that HAVE been promoted,
 * rendered as extra cards in the Work grid (components/CategoryCards.tsx).
 *
 * These two functions must stay complementary. Until this one existed,
 * `is_live` was a trapdoor: flipping it removed the item from the Coming Soon
 * section and nothing anywhere else consumed the flag, so the item silently
 * vanished from the entire site. Manish would have had no way to tell that
 * from "the save failed". Any future filter added to either function has to
 * be mirrored in the other, or that hole reopens — the test suite asserts the
 * partition explicitly for that reason.
 */
export function livePromotions<T extends { is_live: boolean }>(rows: T[]): T[] {
  return rows.filter((r) => r.is_live);
}

/**
 * Initials for the fallback plate on a client card with no `thumb_url`.
 *
 * No storage provider is configured (spec §9.7a), so `thumb_url` is null for
 * every client row today — the no-image path is the DEFAULT path, not an edge
 * case, and it has to look deliberate rather than broken. Same trick as
 * components/Skills.tsx's monogram tiles.
 *
 * First letter of the first word plus first letter of the last word, so
 * "Radiant Films" -> "RF" and "Nike" -> "N". Leading punctuation is skipped
 * (an Instagram-handle-ish "@nike" -> "N", not "@"), and `Array.from` is used
 * rather than `[0]` so a name starting with an astral character (an emoji, or
 * many non-BMP scripts) yields a whole character instead of half a surrogate
 * pair.
 *
 * Returns "" when the name has no letters or digits at all; the card then
 * renders a plain plate. That is deliberate — a placeholder glyph like "?"
 * reads as an error state, and the client's name is printed directly beneath
 * the plate anyway.
 */
export function monogram(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word).find((ch) => /[\p{L}\p{N}]/u.test(ch)))
    .filter((ch): ch is string => ch !== undefined);
  if (initials.length === 0) return "";
  const first = initials[0];
  const last = initials[initials.length - 1];
  return (initials.length === 1 ? first : first + last).toUpperCase();
}
