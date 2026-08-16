"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { inputClass, labelClass } from "@/lib/adminFormStyles";
import { CATEGORIES, type Category } from "./RowList";

type RowStatus = "idle" | "pending" | "saved";

// Mirrors api/_lib/routes_clients.py's PlaylistOut response shape (the
// playlist routes live in routes_clients.py alongside clients/coming-soon —
// see api/index.py's single include_router call for that file).
type Playlist = {
  category: Category;
  youtube_playlist_url: string;
};

/**
 * The Playlists tab (Task 17): one "Full Playlist" URL per category (Section
 * 5 of the design spec — the link beneath each category card that goes to
 * the real YouTube playlist).
 *
 * Unlike videos/clients/coming-soon, there is no create/delete here — a
 * category either has its one playlist row or it doesn't, and `PUT
 * /api/py/playlists/{category}` upserts either way (api/_lib/routes_clients.py's
 * `upsert_playlist`). So this renders exactly `CATEGORIES.length` (4) rows,
 * always, each independently saved.
 *
 * `GET /api/py/playlists` only returns categories that already have a row
 * (no `require_admin` gate on it either, matching the other GET list
 * routes) — a category with nothing saved yet is simply absent from the
 * response, not a 404 or an error. Rows for absent categories are rendered
 * with an empty input rather than any error state, per the brief.
 */
export default function PlaylistsTab() {
  const [urls, setUrls] = useState<Record<Category, string>>(
    () => Object.fromEntries(CATEGORIES.map((c) => [c.value, ""])) as Record<Category, string>
  );
  const [status, setStatus] = useState<Record<Category, RowStatus>>(
    () => Object.fromEntries(CATEGORIES.map((c) => [c.value, "idle"])) as Record<Category, RowStatus>
  );
  const [errors, setErrors] = useState<Record<Category, string | null>>(
    () => Object.fromEntries(CATEGORIES.map((c) => [c.value, null])) as Record<Category, string | null>
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await adminFetch("/playlists");
      if (res.status === 401) {
        window.location.href = "/admin";
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const rows = (await res.json()) as Playlist[];
      setUrls((prev) => {
        const next = { ...prev };
        for (const c of CATEGORIES) next[c.value] = ""; // categories with no row stay empty
        for (const row of rows) next[row.category] = row.youtube_playlist_url;
        return next;
      });
      setLoadError(null);
    } catch {
      setLoadError("Could not load playlists. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSubmit = (category: Category) => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status[category] === "pending") return;

    const url = urls[category].trim();
    if (!url) {
      setErrors((prev) => ({ ...prev, [category]: "Enter a playlist URL." }));
      return;
    }

    setStatus((prev) => ({ ...prev, [category]: "pending" }));
    setErrors((prev) => ({ ...prev, [category]: null }));

    let res: Response;
    try {
      res = await adminFetch(`/playlists/${category}`, {
        method: "PUT",
        body: JSON.stringify({ youtube_playlist_url: url }),
      });
    } catch {
      setErrors((prev) => ({ ...prev, [category]: "Something went wrong. Please try again." }));
      setStatus((prev) => ({ ...prev, [category]: "idle" }));
      return;
    }

    if (res.status === 401) {
      window.location.href = "/admin";
      return; // stay disabled through the navigation
    }

    if (res.ok) {
      setStatus((prev) => ({ ...prev, [category]: "saved" }));
      return;
    }

    setErrors((prev) => ({
      ...prev,
      [category]: res.status === 422 ? "Check the URL and try again." : "Something went wrong. Please try again.",
    }));
    setStatus((prev) => ({ ...prev, [category]: "idle" }));
  };

  if (loading) {
    return <p className="text-sm text-[var(--ink-dim)]">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {loadError && (
        <p role="alert" className="text-sm text-[var(--accent)]">
          {loadError}
        </p>
      )}
      {CATEGORIES.map(({ value, label }) => (
        <form
          key={value}
          onSubmit={handleSubmit(value)}
          noValidate
          className="flex max-w-xl flex-col gap-1.5"
        >
          <label htmlFor={`playlist_${value}`} className={labelClass}>
            {label} — Full Playlist URL
          </label>
          <div className="flex gap-2">
            <input
              id={`playlist_${value}`}
              name={`playlist_${value}`}
              type="url"
              placeholder="https://www.youtube.com/playlist?list=…"
              value={urls[value]}
              onChange={(e) => {
                const next = e.target.value;
                setUrls((prev) => ({ ...prev, [value]: next }));
                setStatus((prev) => ({ ...prev, [value]: "idle" }));
              }}
              className={`${inputClass} flex-1`}
            />
            <button
              type="submit"
              disabled={status[value] === "pending"}
              className="border border-[var(--rule)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink)] hover:border-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status[value] === "pending" ? "Saving…" : "Save"}
            </button>
          </div>
          <p role="alert" className="min-h-5 text-sm text-[var(--accent)]">
            {errors[value]}
          </p>
          {status[value] === "saved" && !errors[value] && (
            <p className="text-xs text-[var(--ink-dim)]">Saved.</p>
          )}
        </form>
      ))}
    </div>
  );
}
