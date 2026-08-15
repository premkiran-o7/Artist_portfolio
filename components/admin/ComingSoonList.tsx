"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

// Mirrors api/_lib/routes_clients.py's ComingSoonOut response shape.
export type ComingSoonItem = {
  id: string;
  title: string;
  blurb: string | null;
  thumb_url: string | null;
  is_live: boolean;
};

type Props = {
  items: ComingSoonItem[];
  loading: boolean;
  /** Called after any mutation that changed server state. */
  onChanged: () => void | Promise<void>;
};

/**
 * List of existing "coming soon" teasers, each with two actions: toggle
 * `is_live` (labeled plainly, per the brief: "Live — show this in the main
 * work grid") and delete. Both PATCH/DELETE and then re-fetch — the same
 * re-fetch-not-optimistic pattern as RowList.tsx's featured toggle.
 *
 * No reorder arrows: the `coming_soon` table has no `sort_order` column (see
 * migrations/001_init.sql), so there is nothing to reorder. The original brief
 * also ruled out a delete button because the API had GET/POST/PATCH only, but
 * `DELETE /api/py/coming-soon/{id}` was added afterwards precisely so a
 * mistyped entry isn't permanent — `is_live` could only move an item between
 * the teaser and the main grid, never remove it.
 *
 * Title/blurb are not editable here — the brief's scope for this tab is
 * "title, blurb, thumbnail, and the is_live toggle" on the create form, plus
 * the toggle on existing rows; it does not ask for inline editing of
 * already-created items, so none was added. Deleting and re-adding covers the
 * typo case.
 */
export default function ComingSoonList({ items, loading, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Runs a mutation with that row's buttons disabled; never rejects. */
  function withBusy(item: ComingSoonItem, fn: () => Promise<void>) {
    if (busyId) return;
    setBusyId(item.id);
    setError(null);
    void (async () => {
      try {
        await fn();
      } catch {
        setError("Something went wrong. Refresh the page and try again.");
      } finally {
        setBusyId(null);
      }
    })();
  }

  function handleToggleLive(item: ComingSoonItem) {
    withBusy(item, async () => {
      const res = await adminFetch(`/coming-soon/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_live: !item.is_live }),
      });
      if (res.status === 401) {
        window.location.href = "/admin";
        return;
      }
      if (!res.ok) setError(`Could not update "${item.title}".`);
      await onChanged();
    });
  }

  function handleDelete(item: ComingSoonItem) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    withBusy(item, async () => {
      const res = await adminFetch(`/coming-soon/${item.id}`, { method: "DELETE" });
      if (res.status === 401) {
        window.location.href = "/admin";
        return;
      }
      if (!res.ok) setError(`Could not delete "${item.title}".`);
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

  if (items.length === 0) {
    return (
      <>
        {banner}
        <p className="text-sm text-[var(--ink-dim)]">No coming-soon items yet.</p>
      </>
    );
  }

  return (
    <div className="overflow-x-auto">
      {banner}
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--rule)] text-left text-[var(--ink-dim)]">
            <th className="py-2 pr-3 font-normal">Title</th>
            <th className="py-2 pr-3 font-normal">Blurb</th>
            <th className="py-2 pr-3 font-normal">Live</th>
            <th className="py-2 pr-3 font-normal">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-[var(--rule)] text-[var(--ink)]">
              <td className="py-2 pr-3">{item.title}</td>
              <td className="py-2 pr-3 max-w-xs truncate text-[var(--ink-dim)]" title={item.blurb ?? ""}>
                {item.blurb || "—"}
              </td>
              <td className="py-2 pr-3">
                <button
                  type="button"
                  onClick={() => handleToggleLive(item)}
                  disabled={busyId !== null}
                  aria-pressed={item.is_live}
                  title="Live — show this in the main work grid"
                  className="border border-[var(--rule)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink)] hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {item.is_live ? "Live" : "Not live"}
                </button>
              </td>
              <td className="py-2 pr-3">
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  disabled={busyId !== null}
                  className="border border-[var(--rule)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--accent)] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
