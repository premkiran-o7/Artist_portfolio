"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { moveAndReindex, reindexDelta } from "@/lib/adminReorder";

// Mirrors api/_lib/routes_photos.py's PhotoOut response shape.
export type Photo = {
  id: string;
  title: string;
  category: string;
  image_url: string;
  sort_order: number;
  created_at: string;
};

type Props = {
  photos: Photo[];
  loading: boolean;
  /** Called after any mutation that changed server state. */
  onChanged: () => void | Promise<void>;
};

/**
 * Flat table of existing 3D Modeling photos (no category grouping — this tab
 * only ever creates `3d-modeling` rows, see PhotoForm.tsx), with a thumbnail,
 * inline delete, and up/down reorder arrows.
 *
 * Structurally identical to ClientList.tsx, including its `withBusy`
 * contract (disables the list, surfaces failures, returns void so onClick
 * can't produce an unhandled rejection) and its reorder approach: a move
 * re-indexes the WHOLE list to 0..N-1 (via the shared `moveAndReindex` /
 * `reindexDelta` helpers, lib/adminReorder.ts) rather than swapping two
 * `sort_order` values in place — a swap is a silent no-op when both rows
 * still carry the default `sort_order: 0`, true of any two never-yet-
 * reordered photos.
 */
export default function PhotoList({ photos, loading, onChanged }: Props) {
  // One flag for the whole list, not per-row: a move touches every row in
  // the list at once after re-indexing, so a per-row busy id can't express
  // "the whole list is mid-mutation" cleanly. Same reasoning as ClientList.tsx.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Same contract as ClientList.tsx's: disables the list, surfaces failures,
   *  and returns void so onClick can call it without an unhandled rejection. */
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

  /** PATCHes one photo. Returns whether it succeeded; never throws. */
  async function patchPhoto(id: string, body: Record<string, unknown>): Promise<boolean> {
    const res = await adminFetch(`/photos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      // Identical to ClientList.tsx's patchClient/RowList.tsx's patchVideo
      // (one of this repo's 8 pre-existing eslint errors each); disabled
      // here rather than adding a 9th instance of the same known false
      // positive.
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = "/admin";
      return false;
    }
    return res.ok;
  }

  function handleMove(rows: Photo[], index: number, direction: -1 | 1) {
    const reordered = moveAndReindex(rows, index, direction);
    if (!reordered) return;

    // Only the rows whose sort_order actually changed — see reindexDelta.
    const changes = reindexDelta(reordered);
    if (changes.length === 0) return;

    withBusy(async () => {
      const results = await Promise.all(
        changes.map(({ row, sort_order }) => patchPhoto(row.id, { sort_order }))
      );
      if (!results.every(Boolean)) {
        setError("Some rows could not be reordered — the order below is what the server has now.");
      }
      await onChanged();
    });
  }

  function handleDelete(photo: Photo) {
    if (!window.confirm(`Delete "${photo.title}"? This cannot be undone.`)) return;
    withBusy(async () => {
      const res = await adminFetch(`/photos/${photo.id}`, { method: "DELETE" });
      if (res.status === 401) {
        window.location.href = "/admin";
        return;
      }
      if (!res.ok) setError(`Could not delete "${photo.title}".`);
      await onChanged();
    });
  }

  const banner = error && (
    <p role="alert" className="mb-4 text-sm text-[var(--accent)]">
      {error}
    </p>
  );

  if (loading) {
    return <p className="text-sm text-[var(--ink-dim)]">Loading…</p>;
  }

  if (photos.length === 0) {
    return (
      <>
        {banner}
        <p className="text-sm text-[var(--ink-dim)]">No photos yet.</p>
      </>
    );
  }

  const rows = photos
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));

  return (
    <div className="overflow-x-auto">
      {banner}
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--rule)] text-left text-[var(--ink-dim)]">
            <th className="py-2 pr-3 font-normal">Photo</th>
            <th className="py-2 pr-3 font-normal">Title</th>
            <th className="py-2 pr-3 font-normal">Order</th>
            <th className="py-2 pr-3 font-normal">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((photo, i) => (
            <tr key={photo.id} className="border-b border-[var(--rule)] text-[var(--ink)]">
              <td className="py-2 pr-3">
                {/* eslint-disable-next-line @next/next/no-img-element --
                    admin-only thumbnail from Supabase Storage's bucket
                    domain; no next/image remote pattern configured for it,
                    and next.config.ts already runs unoptimized site-wide. */}
                <img
                  src={photo.image_url}
                  alt=""
                  className="h-10 w-16 object-cover"
                />
              </td>
              <td className="py-2 pr-3">{photo.title}</td>
              <td className="py-2 pr-3 text-[var(--ink-dim)]">{photo.sort_order}</td>
              <td className="py-2 pr-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Move "${photo.title}" up`}
                    onClick={() => handleMove(rows, i, -1)}
                    disabled={busy || i === 0}
                    className="border border-[var(--rule)] px-2 py-1 text-[var(--ink)] hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move "${photo.title}" down`}
                    onClick={() => handleMove(rows, i, 1)}
                    disabled={busy || i === rows.length - 1}
                    className="border border-[var(--rule)] px-2 py-1 text-[var(--ink)] hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(photo)}
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
  );
}
