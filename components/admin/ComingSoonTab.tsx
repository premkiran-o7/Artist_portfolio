"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import ComingSoonForm from "./ComingSoonForm";
import ComingSoonList, { type ComingSoonItem } from "./ComingSoonList";

/**
 * The Coming Soon tab (Task 17). Self-contained: fetches its own data
 * through `adminFetch`, same pattern as the Videos tab.
 *
 * `GET /api/py/coming-soon` carries no `require_admin` gate (same as
 * `/videos` and `/clients`), so the list loads even if the session cookie
 * has quietly expired. Every *mutation* still goes through `require_admin`,
 * and a 401 from any of them bounces back to /admin — see
 * ComingSoonForm.tsx and ComingSoonList.tsx.
 */
export default function ComingSoonTab() {
  const [items, setItems] = useState<ComingSoonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await adminFetch("/coming-soon");
      if (res.status === 401) {
        window.location.href = "/admin";
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setItems((await res.json()) as ComingSoonItem[]);
      setLoadError(null);
    } catch {
      setLoadError("Could not load coming-soon items. Refresh to try again.");
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
          Add a coming-soon item
        </h2>
        <div className="mt-4">
          <ComingSoonForm onCreated={refresh} />
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
          Existing items
        </h2>
        <div className="mt-4">
          {loadError && (
            <p role="alert" className="mb-4 text-sm text-[var(--accent)]">
              {loadError}
            </p>
          )}
          <ComingSoonList items={items} loading={loading} onChanged={refresh} />
        </div>
      </section>
    </div>
  );
}
