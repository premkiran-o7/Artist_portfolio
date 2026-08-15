"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import ClientForm from "./ClientForm";
import ClientList, { type Client } from "./ClientList";

/**
 * The Clients tab (Task 17). Self-contained: fetches its own data through
 * `adminFetch`, same pattern as the Videos tab (see VideosTab.tsx / the
 * doc comment that used to live on app/admin/dashboard/page.tsx before it
 * became a tabbed shell).
 *
 * `GET /api/py/clients` carries no `require_admin` gate (same as
 * `/videos`), so the list loads even if the session cookie has quietly
 * expired. Every *mutation* still goes through `require_admin`, and a 401
 * from any of them bounces back to /admin — see ClientForm.tsx and
 * ClientList.tsx.
 */
export default function ClientsTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await adminFetch("/clients");
      if (res.status === 401) {
        window.location.href = "/admin";
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setClients((await res.json()) as Client[]);
      setLoadError(null);
    } catch {
      setLoadError("Could not load clients. Refresh to try again.");
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
          Add a client
        </h2>
        <div className="mt-4">
          <ClientForm onCreated={refresh} />
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
          Existing clients
        </h2>
        <div className="mt-4">
          {loadError && (
            <p role="alert" className="mb-4 text-sm text-[var(--accent)]">
              {loadError}
            </p>
          )}
          <ClientList clients={clients} loading={loading} onChanged={refresh} />
        </div>
      </section>
    </div>
  );
}
