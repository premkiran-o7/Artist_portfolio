"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import VideoForm from "./VideoForm";
import RowList, { type Video } from "./RowList";

/**
 * The Videos tab. Lifted out of app/admin/dashboard/page.tsx when that page
 * became a tabbed shell (Task 17) — the fetch/refresh logic is unchanged, it
 * just lives beside the other three tabs now instead of in the route file.
 *
 * `GET /api/py/videos` carries no `require_admin` gate (it's the same read the
 * public site's build-time query effectively duplicates, and isn't sensitive),
 * so the list loads even if the session cookie has quietly expired. Every
 * *mutation* still goes through `require_admin` on the API, and a 401 from any
 * of them bounces back to /admin — see VideoForm.tsx and RowList.tsx.
 */
export default function VideosTab() {
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

  return (
    <div>
      <section>
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
    </div>
  );
}
