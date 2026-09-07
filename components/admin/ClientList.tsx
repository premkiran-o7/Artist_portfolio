"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { isInstagramUrl } from "@/lib/instagram";
import { inputClass } from "@/lib/adminFormStyles";
import { moveAndReindex, reindexDelta } from "@/lib/adminReorder";

// Mirrors api/_lib/routes_clients.py's ClientOut response shape.
export type Client = {
  id: string;
  name: string;
  instagram_url: string;
  thumb_url: string | null;
  sort_order: number;
};

type Props = {
  clients: Client[];
  loading: boolean;
  /** Called after any mutation that changed server state. */
  onChanged: () => void | Promise<void>;
};

/**
 * Flat table of existing clients (no category grouping — unlike videos,
 * clients have no category), with inline delete and up/down reorder arrows.
 *
 * Same shape as RowList.tsx: every mutation re-fetches via `onChanged`
 * rather than patching local state, and reordering re-indexes the whole
 * list to 0..N-1 per move (via the shared `moveAndReindex` helper) rather
 * than swapping two `sort_order` values in place — a swap is a silent no-op
 * when both rows still carry the default `sort_order: 0`, which is true of
 * any two never-yet-reordered clients. See lib/adminReorder.ts.
 */
export default function ClientList({ clients, loading, onChanged }: Props) {
  // One flag for the whole list, not per-row: a move touches every row in
  // the list at once after re-indexing, so a per-row busy id can't express
  // "the whole list is mid-mutation" cleanly. Same reasoning as RowList.tsx.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Inline edit state: which row is open, and the working copies of its fields.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");

  /** Same contract as RowList.tsx's: disables the list, surfaces failures,
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

  /** PATCHes one client. Returns whether it succeeded; never throws. */
  async function patchClient(id: string, body: Record<string, unknown>): Promise<boolean> {
    const res = await adminFetch(`/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      window.location.href = "/admin";
      return false;
    }
    return res.ok;
  }

  function handleMove(rows: Client[], index: number, direction: -1 | 1) {
    const reordered = moveAndReindex(rows, index, direction);
    if (!reordered) return;

    // Only the rows whose sort_order actually changed — see reindexDelta.
    const changes = reindexDelta(reordered);
    if (changes.length === 0) return;

    withBusy(async () => {
      const results = await Promise.all(
        changes.map(({ row, sort_order }) => patchClient(row.id, { sort_order }))
      );
      if (!results.every(Boolean)) {
        setError("Some rows could not be reordered — the order below is what the server has now.");
      }
      await onChanged();
    });
  }

  function startEdit(client: Client) {
    setEditingId(client.id);
    setEditName(client.name);
    setEditUrl(client.instagram_url);
    setError(null);
  }

  function handleSaveEdit(client: Client) {
    const name = editName.trim();
    const url = editUrl.trim();
    if (!name) {
      setError("Name cannot be empty.");
      return;
    }
    if (!isInstagramUrl(url)) {
      setError("Enter a valid instagram.com URL.");
      return;
    }
    withBusy(async () => {
      const ok = await patchClient(client.id, { name, instagram_url: url });
      if (!ok) setError(`Could not update "${client.name}".`);
      setEditingId(null);
      await onChanged();
    });
  }

  function handleDelete(client: Client) {
    if (!window.confirm(`Delete "${client.name}"? This cannot be undone.`)) return;
    withBusy(async () => {
      const res = await adminFetch(`/clients/${client.id}`, { method: "DELETE" });
      if (res.status === 401) {
        window.location.href = "/admin";
        return;
      }
      if (!res.ok) setError(`Could not delete "${client.name}".`);
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

  if (clients.length === 0) {
    return (
      <>
        {banner}
        <p className="text-sm text-[var(--ink-dim)]">No clients yet.</p>
      </>
    );
  }

  const rows = clients
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  return (
    <div className="overflow-x-auto">
      {banner}
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--rule)] text-left text-[var(--ink-dim)]">
            <th className="py-2 pr-3 font-normal">Name</th>
            <th className="py-2 pr-3 font-normal">Instagram</th>
            <th className="py-2 pr-3 font-normal">Order</th>
            <th className="py-2 pr-3 font-normal">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((client, i) => (
            <tr key={client.id} className="border-b border-[var(--rule)] text-[var(--ink)]">
              {editingId === client.id ? (
                <>
                  <td className="py-2 pr-3">
                    <input
                      type="text"
                      required
                      maxLength={200}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={`${inputClass} max-w-[220px]`}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="url"
                      required
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      className={`${inputClass} max-w-[260px]`}
                    />
                  </td>
                  <td className="py-2 pr-3 text-[var(--ink-dim)]">{client.sort_order}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(client)}
                        disabled={busy}
                        className="border border-[var(--rule)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink)] hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={busy}
                        className="border border-[var(--rule)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)] hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td className="py-2 pr-3">{client.name}</td>
                  <td className="py-2 pr-3">
                    <a
                      href={client.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline underline-offset-4"
                    >
                      {client.instagram_url}
                    </a>
                  </td>
                  <td className="py-2 pr-3 text-[var(--ink-dim)]">{client.sort_order}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(client)}
                        disabled={busy}
                        className="border border-[var(--rule)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink)] hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label={`Move "${client.name}" up`}
                        onClick={() => handleMove(rows, i, -1)}
                        disabled={busy || i === 0}
                        className="border border-[var(--rule)] px-2 py-1 text-[var(--ink)] hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move "${client.name}" down`}
                        onClick={() => handleMove(rows, i, 1)}
                        disabled={busy || i === rows.length - 1}
                        className="border border-[var(--rule)] px-2 py-1 text-[var(--ink)] hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(client)}
                        disabled={busy}
                        className="ml-2 border border-[var(--rule)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--accent)] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
