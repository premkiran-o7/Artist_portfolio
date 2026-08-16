"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  /** Called when the dialog closes for ANY reason — Escape, backdrop click,
   *  the Close button, or a programmatic close from the parent. The parent
   *  (ThreeDGallery) owns which card triggered the open, so it — not this
   *  component — restores focus to that card after onClose fires. */
  onClose: () => void;
  title: string;
  /** The photo to show enlarged. Null while closing/closed (or if the id the
   *  parent tracked no longer matches a row after a refetch) — rendering is
   *  gated on `open && imageUrl` below, same as VideoLightbox gates on
   *  `open && videos.length`. */
  imageUrl: string | null;
};

/**
 * VideoLightbox.tsx's dialog/focus/scroll-lock solution, carried over for a
 * single enlarged photo instead of a grid of videos. Same native <dialog> +
 * showModal() approach, so Escape-to-close and focus containment come from
 * the platform; body scroll lock and the "close" event listener are the two
 * things handled explicitly below, exactly as VideoLightbox does it.
 *
 * `object-contain`, not `object-cover`: components/ThreeDGallery.tsx's grid
 * thumbnails already use `object-contain` inside a fixed-aspect box so mixed
 * portrait/landscape photos never crop or distort (see that file's doc
 * comment) — the enlarged view keeps the same rule, so the full photo is
 * always what a click reveals, never a crop of it.
 */
export default function PhotoLightbox({ open, onClose, title, imageUrl }: Props) {
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

  // Defensive unmount cleanup — PhotoLightbox itself is expected to stay
  // mounted for the page's lifetime (ThreeDGallery renders it once), but if
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
      aria-labelledby="photo-lightbox-title"
      onClick={(e) => {
        // Clicking the ::backdrop delivers a click whose target is the
        // <dialog> element itself (nothing else occupies that space) —
        // the standard way to detect "click outside" for a native dialog.
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="m-auto max-h-[85vh] w-[min(92vw,64rem)] overflow-y-auto rounded-2xl border border-[var(--rule)] bg-[var(--ground)] p-6 text-[var(--ink)] backdrop:bg-black/70"
    >
      {open && imageUrl && (
        <>
          <div className="flex items-center justify-between gap-4">
            <h3 id="photo-lightbox-title" className="font-[family-name:var(--font-display)] text-2xl">
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
          <div className="mt-6 flex items-center justify-center">
            {/* alt="": the title is already announced by the heading above,
                and this is the same photo already named on the grid card
                that opened it — see ThreeDGallery.tsx's alt="" reasoning. */}
            <img
              src={imageUrl}
              alt=""
              className="max-h-[70vh] w-auto max-w-full rounded-lg border border-[var(--rule)] object-contain"
            />
          </div>
        </>
      )}
    </dialog>
  );
}
