"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import PhotoForm from "./PhotoForm";
import PhotoList, { type Photo } from "./PhotoList";

/**
 * The Photos tab (section 7a, 3D Modeling). Self-contained: fetches its own
 * data through `adminFetch`, same pattern as the Clients/Videos tabs (see
 * ClientsTab.tsx).
 *
 * `GET /api/py/photos` carries no `require_admin` gate (same as `/clients`
 * and `/videos`), so the list loads even if the session cookie has quietly
 * expired. Every *mutation* still goes through `require_admin`, and a 401
 * from any of them bounces back to /admin — see PhotoForm.tsx and
 * PhotoList.tsx.
 */
export default function PhotosTab() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await adminFetch("/photos");
      if (res.status === 401) {
        window.location.href = "/admin";
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setPhotos((await res.json()) as Photo[]);
      setLoadError(null);
    } catch {
      setLoadError("Could not load photos. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Identical fetch-on-mount idiom as ClientsTab.tsx/VideosTab.tsx/
    // ComingSoonTab.tsx/PlaylistsTab.tsx (each already one of this repo's 8
    // pre-existing eslint errors); disabled here rather than adding a 5th
    // instance of the same known false positive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return (
    <div>
      <section>
        <h2 className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
          Add a photo
        </h2>
        <div className="mt-4">
          <PhotoForm onCreated={refresh} />
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
          Existing photos
        </h2>
        <div className="mt-4">
          {loadError && (
            <p role="alert" className="mb-4 text-sm text-[var(--accent)]">
              {loadError}
            </p>
          )}
          <PhotoList photos={photos} loading={loading} onChanged={refresh} />
        </div>
      </section>
    </div>
  );
}
