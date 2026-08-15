"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Animates its own width on scroll-into-view rather than fading opacity like
 * Reveal, so it needs its own IntersectionObserver — that's why this doesn't
 * reuse Reveal.
 *
 * Track uses --rule (not --ink at low alpha): this section sits on solid
 * --ground, and --rule is the codebase's established hairline token for solid
 * ground (see Timelines' rail border) — --ink-at-low-alpha is reserved for
 * compositing over footage, where --rule would vanish (see Hero/ShowReel).
 */
export default function SkillBar({ fill }: { fill: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--rule)]">
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-700 ease-out"
        style={{ width: shown ? fill : "0%" }}
      />
    </div>
  );
}
