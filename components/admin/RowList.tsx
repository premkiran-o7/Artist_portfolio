"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { moveAndReindex, reindexDelta } from "@/lib/adminReorder";
import { thumbnailUrl } from "@/lib/youtube";

// Mirrors api/_lib/models.py's Category/Visibility enums exactly. There is no
// "private" Visibility — private YouTube videos cannot be embedded, so the
// backend only ever accepts "public" | "unlisted" (see VideoForm.tsx).
export type Category = "color-grade" | "short-form" | "text-tracking" | "3d-modeling";
export type Visibility = "public" | "unlisted";

// Mirrors api/_lib/routes_videos.py's VideoOut response shape.
export type Video = {
  id: string;
  title: string;
  category: Category;
  youtube_url: string;
  youtube_id: string;
  visibility: Visibility;
  thumb_url: string | null;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
};

// Shared with VideoForm.tsx's category <select> so the four categories and
// their display labels are declared in exactly one place.
export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "color-grade", label: "Color Grade" },
  { value: "short-form", label: "Short Form" },
  { value: "text-tracking", label: "Text Tracking" },
  { value: "3d-modeling", label: "3D Modeling" },
];

type Props = {
  videos: Video[];
  loading: boolean;
  /** Called after any mutation that changed server state. */
  onChanged: () => void | Promise<void>;
};

/**
 * Table of existing videos, grouped by category, with inline delete, a
 * featured toggle, and up/down arrows that adjust `sort_order`.
 *
 * Arrows, not drag-and-drop, per the brief: drag is fiddly on touch and this
 * list will only ever have a handful of rows per category.
 *
 * Every mutation here (toggle, move, delete) re-fetches the full list via
 * `onChanged` rather than patching local state optimistically. This matters
 * most for the featured toggle: `is_featured` is exclusive per category —
 * setting one clears every other featured video in that category server-side
 * (api/_lib/routes_videos.py) — so the only way to show the *other* row
 * flipping back to unfeatured is to ask the server what's true now, not
 * assume our own PATCH was the only thing that changed.
 *
 * Reordering re-indexes every row in the affected category to 0..N-1 on each
 * move, rather than swapping the two `sort_order` values in place. A swap
 * would be a visible no-op whenever both rows still carry the same default
 * `sort_order` (every video is created with `sort_order: 0` — see
 * VideoForm.tsx — so any two never-yet-reordered rows in a category start out
 * tied). Re-indexing always produces a distinct, strictly ordered sequence,
 * so the arrows never appear to do nothing. The position-swap-then-reindex
 * logic itself lives in lib/adminReorder.ts's `moveAndReindex`, shared with
 * the Clients tab's ClientList.tsx so that fix can't be silently reverted by
 * a second, naive reorder implementation elsewhere in the dashboard.
 */
export default function RowList({ videos, loading, onChanged }: Props) {
  // One flag for every action, not one per row: a move touches two rows at
  // once (three, after re-indexing everyone), so a per-row busy id can't
  // express "this whole category is mid-mutation" cleanly. Simpler to just
  // disable every action button in the list while anything is in flight.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Runs a mutation with the list disabled, and swallows *nothing* silently:
   * a rejection (adminFetch throws on a network failure, not just on a bad
   * status) surfaces as a message above the table.
   *
   * Fire-and-forget by design — it returns void, so the onClick handlers below
   * can call it without an `await` or a `.catch` and still never produce an
   * unhandled promise rejection.
   */
  function withBusy(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        await fn();
      } catch {
        setError("Something went wrong. Refresh the page and try again.");
      } finally {
        setBusy(false);
      }
    })();
  }

  /** PATCHes one video. Returns whether it succeeded; never throws. */
  async function patchVideo(id: string, body: Record<string, unknown>): Promise<boolean> {
    const res = await adminFetch(`/videos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      // Session expired/invalid mid-dashboard-use. adminFetch already sent the
      // cookie and CSRF header correctly — a 401 here means the JWT itself is
      // no longer good, so there is nothing left to do but send Manish back
      // to sign in again.
      window.location.href = "/admin";
      return false;
    }
    return res.ok;
  }

  function handleToggleFeatured(video: Video) {
    withBusy(async () => {
      const ok = await patchVideo(video.id, { is_featured: !video.is_featured });
      if (!ok) setError(`Could not update "${video.title}".`);
      await onChanged();
    });
  }

  function handleMove(rows: Video[], index: number, direction: -1 | 1) {
    const reordered = moveAndReindex(rows, index, direction);
    if (!reordered) return;

    // Only the rows whose sort_order actually changed — see reindexDelta.
    const changes = reindexDelta(reordered);
    if (changes.length === 0) return;

    withBusy(async () => {
      const results = await Promise.all(
        changes.map(({ row, sort_order }) => patchVideo(row.id, { sort_order }))
      );
      if (!results.every(Boolean)) {
        // A move is several PATCHes; if some land and some don't, the stored
        // order is now a mix of old and new. Say so rather than leaving the
        // arrows looking like they worked.
        setError("Some rows could not be reordered — the order below is what the server has now.");
      }
      // Re-fetch either way. On success it confirms the new order; on partial
      // failure it is the only way to show what actually got written.
      await onChanged();
    });
  }

  function handleDelete(video: Video) {
    if (!window.confirm(`Delete "${video.title}"? This cannot be undone.`)) return;
    withBusy(async () => {
      const res = await adminFetch(`/videos/${video.id}`, { method: "DELETE" });
      if (res.status === 401) {
        window.location.href = "/admin";
        return;
      }
      if (!res.ok) setError(`Could not delete "${video.title}".`);
      await onChanged();
    });
  }

  // Rendered in every branch, not just alongside the table: deleting the last
  // video empties the list, and the "couldn't delete" case has to stay visible
  // even when what's left to render is the empty state.
  const banner = error && (
    <p role="alert" className="mb-4 text-sm text-[var(--accent)]">
      {error}
    </p>
  );

  if (loading) {
    return <p className="text-sm text-[var(--ink-dim)]">Loading…</p>;
  }

  if (videos.length === 0) {
    return (
      <>
        {banner}
        <p className="text-sm text-[var(--ink-dim)]">No videos yet.</p>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {banner}
      {CATEGORIES.map(({ value, label }) => {
        const rows = videos
          .filter((v) => v.category === value)
          .slice()
          .sort(
            (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
          );

        if (rows.length === 0) return null;

        return (
          <div key={value}>
            <h3 className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
              {label}
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--rule)] text-left text-[var(--ink-dim)]">
                    <th className="py-2 pr-3 font-normal">Thumb</th>
                    <th className="py-2 pr-3 font-normal">Title</th>
                    <th className="py-2 pr-3 font-normal">Visibility</th>
                    <th className="py-2 pr-3 font-normal">Featured</th>
                    <th className="py-2 pr-3 font-normal">Order</th>
                    <th className="py-2 pr-3 font-normal">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((video, i) => (
                    <tr
                      key={video.id}
                      className="border-b border-[var(--rule)] text-[var(--ink)]"
                    >
                      <td className="py-2 pr-3">
                        {/* eslint-disable-next-line @next/next/no-img-element --
                            admin-only thumbnail from an arbitrary host
                            (i.ytimg.com or, once uploads are wired, R2's
                            bucket domain); no next/image remote pattern
                            configured for either. */}
                        <img
                          // `||`, not `??` — matches lib/db.ts's resolveThumb()
                          // fix (Task 17). An empty-string thumb_url means
                          // "no custom thumbnail" just as much as null does;
                          // `??` would render a broken image for it instead
                          // of falling back to YouTube's thumbnail.
                          src={video.thumb_url || thumbnailUrl(video.youtube_id)}
                          alt=""
                          className="h-10 w-16 object-cover"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <a
                          href={video.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline underline-offset-4"
                        >
                          {video.title}
                        </a>
                      </td>
                      <td className="py-2 pr-3 text-[var(--ink-dim)]">{video.visibility}</td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(video)}
                          disabled={busy}
                          aria-pressed={video.is_featured}
                          className="border border-[var(--rule)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink)] hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {video.is_featured ? "Featured" : "Feature"}
                        </button>
                      </td>
                      <td className="py-2 pr-3 text-[var(--ink-dim)]">{video.sort_order}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Move "${video.title}" up`}
                            onClick={() => handleMove(rows, i, -1)}
                            disabled={busy || i === 0}
                            className="border border-[var(--rule)] px-2 py-1 text-[var(--ink)] hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={`Move "${video.title}" down`}
                            onClick={() => handleMove(rows, i, 1)}
                            disabled={busy || i === rows.length - 1}
                            className="border border-[var(--rule)] px-2 py-1 text-[var(--ink)] hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(video)}
                            disabled={busy}
                            className="ml-2 border border-[var(--rule)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--accent)] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
