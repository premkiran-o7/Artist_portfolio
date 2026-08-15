"use client";
import { useEffect, useRef, useState } from "react";

type Props = { src: string; poster: string; youtubeUrl?: string };

export default function ShowReel({ src, poster, youtubeUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);

  // Start 2s after mount — unless the visitor asked for less motion or less data.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData === true;
    if (reduced || saveData) return;

    const t = setTimeout(() => {
      videoRef.current?.play().then(() => setStarted(true)).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  // Never let it play off-screen — that is pure wasted mobile data.
  useEffect(() => {
    const el = sectionRef.current;
    const v = videoRef.current;
    if (!el || !v) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { if (started) v.play().catch(() => {}); }
        else v.pause();
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [started]);

  return (
    <section ref={sectionRef} id="showreel" className="px-6 md:px-12 py-16 scroll-mt-20">
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--ground)]">
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            muted={muted}
            loop
            playsInline
            preload="metadata"
            aria-label="Showreel"
            className="h-full w-full object-cover"
          />
          {!started && (
            <button
              onClick={() => videoRef.current?.play().then(() => setStarted(true))}
              className="absolute inset-0 grid place-items-center bg-[var(--ground)]/30 focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              aria-label="Play showreel"
            >
              <span className="rounded-full border border-[var(--ink)]/40 px-6 py-3 backdrop-blur">Play reel</span>
            </button>
          )}
          <button
            onClick={() => {
              const v = videoRef.current; if (!v) return;
              v.muted = !v.muted; setMuted(v.muted);
            }}
            aria-pressed={!muted}
            className="absolute bottom-4 right-4 rounded-full border border-[var(--ink)]/20 bg-[var(--ground)]/60 px-4 py-2 text-sm backdrop-blur hover:border-[var(--ink)]/50 focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            {muted ? "🔇 Unmute" : "🔊 Mute"}
          </button>
        </div>
        {youtubeUrl && (
          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer"
             className="mt-4 inline-block font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)] hover:text-[var(--ink)]">
            Watch full reel ↗
          </a>
        )}
      </div>
    </section>
  );
}
