"use client";

import { useRef, useState } from "react";
import Reveal from "@/components/Reveal";
import VideoLightbox from "@/components/VideoLightbox";
import {
  CARD_CATEGORIES,
  pickCardThumb,
  videosForCategory,
  type CardCategoryValue,
  type CategoryVideo,
} from "@/lib/categories";

type Props = {
  videos: CategoryVideo[];
  /** Only categories that actually have a row in `playlists` appear here —
   *  there is no guarantee all three do. */
  playlistUrls: Partial<Record<CardCategoryValue, string>>;
};

/**
 * Section 5 of the wireframe: three category cards (Colour Grade / Short
 * Form / Text Tracking — "3d-modeling" belongs to Task 19's Coming Soon
 * section instead). Each card's body opens a lightbox of that category's
 * videos; "Full Playlist" is a plain external link, rendered only when the
 * category has a playlist row.
 *
 * The card body and the playlist link are DELIBERATE SIBLINGS inside one
 * wrapping <div>, never one nested inside the other — a <button> containing
 * an <a> (or vice versa) is invalid interactive-content-in-interactive-
 * content HTML, and this project has already shipped two separate <dl>
 * content-model bugs from skipping this kind of structural check. Being
 * siblings also means a click on the link never bubbles into the card's own
 * onClick — there is nothing to stopPropagation() against.
 */
export default function CategoryCards({ videos, playlistUrls }: Props) {
  const [openCategory, setOpenCategory] = useState<CardCategoryValue | null>(null);
  const triggerRefs = useRef<Partial<Record<CardCategoryValue, HTMLButtonElement | null>>>({});

  const closeLightbox = () => {
    const justClosed = openCategory;
    setOpenCategory(null);
    // Restore focus to the card that opened the lightbox, not just "focus
    // moved somewhere reasonable" — the trigger is the one place that knows
    // which button that was.
    if (justClosed) triggerRefs.current[justClosed]?.focus();
  };

  const openVideos = openCategory ? videosForCategory(videos, openCategory) : [];
  const openLabel = CARD_CATEGORIES.find((c) => c.value === openCategory)?.label ?? "";

  return (
    <section id="work" className="px-6 md:px-12 py-16 scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">Work</h2>
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {CARD_CATEGORIES.map(({ value, label }, index) => {
            const categoryVideos = videosForCategory(videos, value);
            const cover = pickCardThumb(categoryVideos);
            const playlistUrl = playlistUrls[value];

            return (
              <li key={value}>
                <Reveal delay={index * 60}>
                  <div className="overflow-hidden rounded-xl border border-[var(--rule)]">
                    {cover ? (
                      <button
                        ref={(el) => {
                          triggerRefs.current[value] = el;
                        }}
                        type="button"
                        onClick={() => setOpenCategory(value)}
                        aria-haspopup="dialog"
                        className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      >
                        <div className="relative aspect-video bg-black">
                          <img
                            src={cover.thumb}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          {/* Decorative hover wash; the card title text below
                              already names the category, so this stays
                              aria-hidden and unlabelled. */}
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20"
                          />
                        </div>
                        <div className="p-5">
                          <h3 className="font-[family-name:var(--font-display)] text-xl">{label}</h3>
                        </div>
                      </button>
                    ) : (
                      // Empty state: a muted plate, NOT a disabled-looking
                      // button. There is nothing to click, so there is no
                      // <button> here at all — a button that does nothing on
                      // click is worse than no control.
                      <div>
                        <div className="relative aspect-video grid place-items-center bg-[var(--rule)]">
                          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
                            Coming soon
                          </p>
                        </div>
                        <div className="p-5">
                          <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink-dim)]">
                            {label}
                          </h3>
                        </div>
                      </div>
                    )}
                    {playlistUrl && (
                      <div className="border-t border-[var(--rule)] px-5 py-3">
                        <a
                          href={playlistUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                        >
                          Full Playlist ↗
                        </a>
                      </div>
                    )}
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>

      <VideoLightbox open={openCategory !== null} onClose={closeLightbox} title={openLabel} videos={openVideos} />
    </section>
  );
}
