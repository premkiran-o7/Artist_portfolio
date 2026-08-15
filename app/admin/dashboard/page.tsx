/**
 * Placeholder only — the real dashboard (videos/clients/playlists/coming-soon
 * tabs) is Task 16 onward. This exists so /admin's successful-login redirect and
 * proxy.ts's logged-out redirect both have a real route to land on.
 *
 * Deliberately a server component with no data fetching: it renders the same
 * for everyone who reaches it, logged in or not. That's fine — this route is UX
 * bait, not a security boundary. Reaching it proves nothing; every real
 * mutation still goes through require_admin on the API.
 */
export default function AdminDashboardPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
        Dashboard
      </h1>
      <p className="text-sm text-[var(--ink-dim)]">Coming in Task 16.</p>
    </main>
  );
}
