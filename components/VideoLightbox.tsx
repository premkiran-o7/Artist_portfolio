"use client";

import { useEffect, useRef } from "react";
import YouTubeFacade from "@/components/YouTubeFacade";
import type { CategoryVideo } from "@/lib/categories";

type Props = {
  open: boolean;
  /** Called when the dialog closes for ANY reason — Escape, backdrop click,
   *  the Close button, or a programmatic close from the parent. The parent
   *  (CategoryCards) owns which card triggered the open, so it — not this
   *  component — restores focus to that card after onClose fires. */
  onClose: () => void;
  title: string;
  videos: CategoryVideo[];
};

/**
 * A native <dialog> used via showModal(), so Escape-to-close and focus
 * containment come from the platform rather than hand-rolled key handlers.
 * Two things the platform does NOT give us for free, handled explicitly
 * below: body scroll lock, and restoring focus to the trigger (the second
 * half of that lives in CategoryCards, which is the one that knows which
 * button was clicked).
 *
 * Leak prevention: the video grid is only rendered while `open` is true
 * (`{open && (...)}`), not merely hidden. So every close unmounts every
 * YouTubeFacade underneath it, discarding their `active` state — the next
 * open is a genuinely fresh mount, not a facade that silently kept playing
 * an <iframe> from the previous session.
 */
export default function VideoLightbox({ open, onClose, title, videos }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Drive the imperative <dialog> API from the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  // The dialog's native "close" event fires for EVERY close path — Escape,
  // the Close button's dialog.close() call below, and backdrop clicks — so
  // this one listener is the single place scroll gets unlocked and the
  // parent gets told to update its `open` state.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      document.body.style.overflow = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  // Defensive unmount cleanup — VideoLightbox itself is expected to stay
  // mounted for the page's lifetime (CategoryCards renders it once), but if
  // that ever changes, an open dialog should not leave the page permanently
  // unscrollable.
  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="lightbox-title"
      onClick={(e) => {
        // Clicking the ::backdrop delivers a click whose target is the
        // <dialog> element itself (nothing else occupies that space) —
        // the standard way to detect "click outside" for a native dialog.
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="m-auto max-h-[85vh] w-[min(92vw,64rem)] overflow-y-auto rounded-2xl border border-[var(--rule)] bg-[var(--ground)] p-6 text-[var(--ink)] backdrop:bg-black/70"
    >
      {open && (
        <>
          <div className="flex items-center justify-between gap-4">
            <h3 id="lightbox-title" className="font-[family-name:var(--font-display)] text-2xl">
              {title}
            </h3>
            <button
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="shrink-0 rounded-full border border-[var(--rule)] px-3 py-1 text-sm text-[var(--ink-dim)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              ✕
            </button>
          </div>
          {videos.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {videos.map((v) => (
                <div
                  key={v.id}
                  className="relative aspect-video overflow-hidden rounded-lg border border-[var(--rule)] bg-black"
                >
                  <YouTubeFacade id={v.youtube_id} thumb={v.thumb} title={v.title} />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-[var(--ink-dim)]">No videos in this category yet.</p>
          )}
        </>
      )}
    </dialog>
  );
}
