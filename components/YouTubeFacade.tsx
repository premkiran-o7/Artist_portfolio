"use client";

import { useState } from "react";
import { embedUrl } from "@/lib/youtube";

type Props = { id: string; thumb: string; title: string };

/**
 * The lazy-load facade: a static thumbnail + play button at rest, and the
 * real YouTube <iframe> only after an explicit click. Swapping the whole
 * subtree (rather than e.g. toggling a CSS class over a permanently-mounted
 * iframe) is what guarantees no `<iframe src="...youtube...">` exists in the
 * DOM before that click — YouTube's ~1MB of player JS is never requested
 * until someone actually chooses to watch.
 *
 * No hover-preview, no autoplay-on-mount, no `loop` — a click is the only
 * thing that can flip `active`.
 */
export default function YouTubeFacade({ id, thumb, title }: Props) {
  const [active, setActive] = useState(false);

  if (active) {
    return (
      <iframe
        className="absolute inset-0 h-full w-full"
        src={embedUrl(id)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      className="group absolute inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      aria-label={`Play ${title}`}
    >
      {/* alt="" is deliberate, not an oversight: the button's aria-label
          above already names this control ("Play <title>"), so the image
          is decorative from an AT's point of view — same reasoning Skills.tsx
          uses for its aria-hidden monogram glyphs. */}
      <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
      <span className="absolute inset-0 grid place-items-center bg-black/30 transition-colors group-hover:bg-black/20">
        {/*
          border-[var(--ink)]/60 rather than the --rule token: --rule is
          tuned for hairlines on solid --ground, and this ring sits over an
          arbitrary, unpredictably-bright video thumbnail instead — it needs
          to stay visible regardless of what's under it, the same reasoning
          SiteHeader.tsx used for text over the hero's footage. --ink is the
          site's off-white token rather than a raw `white`, so it still
          traces back to the design system.
        */}
        <span className="rounded-full border border-[var(--ink)]/60 bg-black/20 px-5 py-2.5 text-sm text-[var(--ink)] backdrop-blur">
          ▶ Play
        </span>
      </span>
    </button>
  );
}
