"use client";

import { useRef, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import VideosTab from "@/components/admin/VideosTab";
import ClientsTab from "@/components/admin/ClientsTab";
import PlaylistsTab from "@/components/admin/PlaylistsTab";
import ComingSoonTab from "@/components/admin/ComingSoonTab";
import PhotosTab from "@/components/admin/PhotosTab";

/**
 * The admin dashboard shell: sign-out, plus the five tabs Manish edits the
 * site through. Each tab is a self-contained client component that fetches its
 * own data via `adminFetch` — the shell holds no data of its own, only which
 * tab is showing.
 *
 * Only the selected tab is mounted, so switching tabs re-fetches that tab's
 * list. That's deliberate: it costs one request on switch but guarantees the
 * list is never stale, which matters because these resources are not
 * independent — publishing a playlist or flipping a coming-soon item to live
 * changes what the public page renders alongside the videos, and photos
 * co-exist with 3d-modeling videos in the same public section
 * (components/ThreeDGallery.tsx).
 *
 * Keyboard behaviour follows the ARIA tabs pattern: Left/Right (and Home/End)
 * move between tabs, which is what a screen-reader user will expect from
 * `role="tablist"` — without it, the roving tabindex below would trap them on
 * the selected tab.
 */

const TABS = [
  { id: "videos", label: "Videos", render: () => <VideosTab /> },
  { id: "clients", label: "Clients", render: () => <ClientsTab /> },
  { id: "photos", label: "Photos", render: () => <PhotosTab /> },
  { id: "playlists", label: "Playlists", render: () => <PlaylistsTab /> },
  { id: "coming-soon", label: "Coming Soon", render: () => <ComingSoonTab /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminDashboardPage() {
  const [active, setActive] = useState<TabId>("videos");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeIndex = TABS.findIndex((t) => t.id === active);

  function focusTab(index: number) {
    const wrapped = (index + TABS.length) % TABS.length;
    const tab = TABS[wrapped];
    setActive(tab.id);
    tabRefs.current[tab.id]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusTab(activeIndex + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusTab(activeIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        focusTab(0);
        break;
      case "End":
        event.preventDefault();
        focusTab(TABS.length - 1);
        break;
    }
  }

  const handleSignOut = async () => {
    try {
      await adminFetch("/logout", { method: "POST" });
    } catch {
      // Ignore — hard-navigating to /admin either way drops all client state,
      // and a stale cookie left behind is harmless: every mutating route
      // re-checks it independently.
    }
    window.location.href = "/admin";
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 md:px-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Dashboard
        </h1>
        <button
          type="button"
          onClick={handleSignOut}
          className="border border-[var(--rule)] px-3 py-1.5 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)] hover:border-[var(--ink)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Sign out
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Site content"
        onKeyDown={handleKeyDown}
        className="mt-10 flex flex-wrap gap-2 border-b border-[var(--rule)]"
      >
        {TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              // Roving tabindex: only the selected tab is in the tab order, so
              // Tab moves past the tablist into the panel rather than through
              // all four tabs. Arrow keys move between them (see handleKeyDown).
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              className={`-mb-px border-b-2 px-3 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                selected
                  ? "border-[var(--ink)] text-[var(--ink)]"
                  : "border-transparent text-[var(--ink-dim)] hover:text-[var(--ink)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {TABS.map((tab) =>
        tab.id === active ? (
          <div
            key={tab.id}
            role="tabpanel"
            id={`panel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            tabIndex={0}
            className="mt-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {tab.render()}
          </div>
        ) : null
      )}
    </main>
  );
}
