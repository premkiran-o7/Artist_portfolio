"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = { src: string; poster: string; youtubeUrl?: string };

/**
 * Full-bleed background reel for the hero.
 *
 * Renders three sibling layers into the nearest positioned ancestor (the hero
 * <section>, which must be `relative isolate`):
 *   1. the video + scrim, at -z-10, decorative and aria-hidden
 *   2. the controls cluster, at z-20, above the hero content so it stays clickable
 *
 * Owns the video, the scrim and the controls. It never reaches into the hero's
 * content, and the hero never reaches in here.
 */
export default function ShowReel({ src, poster, youtubeUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);

  // Every play() call site swallows rejection: a browser that refuses playback
  // must leave the poster + "Play reel" control up, not raise an unhandled rejection.
  const start = useCallback(() => {
    videoRef.current?.play().then(() => setStarted(true)).catch(() => {});
  }, []);

  // Start 2s after mount — unless the visitor asked for less motion or less data.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData === true;
    if (reduced || saveData) return;

    const t = setTimeout(start, 2000);
    return () => clearTimeout(t);
  }, [start]);

  // Never let it play off-screen — that is pure wasted mobile data.
  // Threshold 0.1: a partly-scrolled hero is still largely visible.
  useEffect(() => {
    const el = layerRef.current;
    const v = videoRef.current;
    if (!el || !v) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { if (started) v.play().catch(() => {}); }
        else v.pause();
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [started]);

  return (
    <>
      <div ref={layerRef} aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        {/*
          Scrim. Must hold >=4.5:1 for --ink against the brightest possible frame
          (measured against pure white, so it holds for any footage).

          Below lg the text spans nearly the full width, so the floor has to be
          everywhere: flat 65% -> 5.49:1 over white. A left-dense gradient was measured
          at 768px and FAILED (4.15:1) at the right end of the text, because the text
          runs to 93.8% of the viewport there — hence the lg gate, not md.

          At lg+ the text is a genuine left column (<=63% of viewport at 1440), so the
          base drops to 45% and a left-dense gradient carries the text column at
          >=8.2:1 while the right side stays light and the footage still reads as
          moving footage.
        */}
        <div className="absolute inset-0 bg-[var(--ground)]/65 lg:bg-[var(--ground)]/45" />
        <div className="absolute inset-0 hidden lg:block bg-linear-to-r from-[var(--ground)]/85 via-[var(--ground)]/70 to-[var(--ground)]/15" />
      </div>

      {/*
        Controls sit ABOVE the hero content (z-20) so the content wrapper can never
        swallow their clicks. --rule composites to roughly #1A1A1A and would be
        invisible over footage, so these use --ink at low alpha instead.
      */}
      <div className="absolute bottom-5 right-5 z-20 flex flex-wrap items-center justify-end gap-2 md:bottom-6 md:right-6 md:gap-3">
        {!started && (
          <button
            onClick={start}
            className="rounded-full border border-[var(--ink)]/40 bg-[var(--ground)]/70 px-4 py-2 text-sm backdrop-blur hover:border-[var(--ink)]/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Play reel
          </button>
        )}
        <button
          onClick={() => {
            const v = videoRef.current; if (!v) return;
            v.muted = !v.muted; setMuted(v.muted);
          }}
          aria-pressed={!muted}
          aria-label={muted ? "Unmute showreel" : "Mute showreel"}
          className="rounded-full border border-[var(--ink)]/20 bg-[var(--ground)]/70 px-4 py-2 text-sm backdrop-blur hover:border-[var(--ink)]/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <span aria-hidden>{muted ? "🔇" : "🔊"}</span>{" "}
          {muted ? "Unmute" : "Mute"}
        </button>
        {youtubeUrl && (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-[var(--ink)]/20 bg-[var(--ground)]/70 px-4 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)] backdrop-blur hover:border-[var(--ink)]/50 hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Watch full reel ↗
          </a>
        )}
      </div>
    </>
  );
}
