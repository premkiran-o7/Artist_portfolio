"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import VideoForm from "@/components/admin/VideoForm";
import RowList, { type Video } from "@/components/admin/RowList";

/**
 * The videos tab (Task 16). Client component: it fetches its own data through
 * `adminFetch`, unlike the public pages, which never call the database from
 * the browser.
 *
 * Only the videos tab exists so far — clients/playlists/coming-soon tabs are
 * Task 17, which will turn this into a proper tabbed shell. For now the page
 * is just the one section.
 *
 * `GET /api/py/videos` itself carries no `require_admin` gate (it's the same
 * read the public site's build-time query effectively duplicates, and isn't
 * sensitive), so the list loads even if the session cookie has quietly
 * expired. Every *mutation* still goes through `require_admin` on the API,
 * and a 401 from any of them below bounces back to /admin — see
 * VideoForm.tsx and RowList.tsx.
 */
export default function AdminDashboardPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await adminFetch("/videos");
      if (res.status === 401) {
        window.location.href = "/admin";
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setVideos((await res.json()) as Video[]);
      setLoadError(null);
    } catch {
      setLoadError("Could not load videos. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSignOut = async () => {
    try {
      await adminFetch("/logout", { method: "POST" });
    } catch {
      // Ignore — hard-navigating to /admin either way drops all client
      // state, and a stale cookie left behind is harmless: every mutating
      // route re-checks it independently.
    }
    window.location.href = "/admin";
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 md:px-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-dim)]">Videos</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="border border-[var(--rule)] px-3 py-1.5 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)] hover:border-[var(--ink)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Sign out
        </button>
      </div>

      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
          Add a video
        </h2>
        <div className="mt-4">
          <VideoForm onCreated={refresh} />
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
          Existing videos
        </h2>
        <div className="mt-4">
          {loadError && (
            <p role="alert" className="mb-4 text-sm text-[var(--accent)]">
              {loadError}
            </p>
          )}
          <RowList videos={videos} loading={loading} onChanged={refresh} />
        </div>
      </section>
    </main>
  );
}
