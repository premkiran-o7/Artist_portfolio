import { getContent } from "@/lib/content";

// Nav targets — only ids that actually exist in the rendered DOM today.
//
//   "Reel"    dropped: the show reel is no longer a standalone section, it's
//             the full-bleed background inside <Hero> (see ShowReel.tsx).
//             There is no #showreel element to land on.
//   "Work"    (#work) and "Clients" (#clients) are NOT here yet — those
//             sections ship in Tasks 18 and 19. Add them back to this list
//             once those sections exist, or every link below breaks the
//             "every nav link resolves" rule this file is built to satisfy.
const LINKS = [
  ["About", "#about"],
  ["Skills", "#skills"],
  ["Contact", "#contact"],
] as const;

/**
 * Fixed header over a full-viewport hero with video behind it. The bar needs
 * its own blurred backdrop so nav text stays legible against the brightest
 * frame of the reel, independent of ShowReel's own scrim (which is tuned for
 * the hero's content column, not for a bar pinned at y=0).
 *
 * Hero already reserves space for this bar via its own pt-24, so the header
 * never has to fight hero content for room — see components/Hero.tsx.
 *
 * Worked the same way Hero/ShowReel did: composite bg-[var(--ground)]/80
 * over worst-case pure white (brightest possible frame) and check contrast
 * from there.
 *   --ink     (#F4F1EC) on that composite -> ~9.9:1  (safe, big margin)
 *   --ink-dim (#8A8880) on that composite -> ~3.1:1  (FAILS 4.5:1 for text)
 *   --accent  (#E8552B) on that composite -> ~3.0:1  (fails 4.5:1 for text;
 *                                              barely clears the 3:1 floor
 *                                              for non-text UI, i.e. usable
 *                                              for an outline, not for text)
 * So unlike the rest of the site (solid --ground, --ink-dim is fine there),
 * this header cannot use --ink-dim or --accent as *text* colour. Hierarchy
 * between the name and the nav links comes from font/size/case/tracking
 * (same fix Hero.tsx used for its own over-footage text), and hover/focus
 * feedback comes from an underline + --ink outline rather than an accent
 * colour swap, so nothing here depends on a colour that can dip under 4.5:1.
 */
export default function SiteHeader() {
  const c = getContent();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--ink)]/10 bg-[var(--ground)]/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-12">
        <a
          href="#hero"
          className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)] hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
        >
          {c.name}
        </a>
        <ul className="hidden gap-6 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink)] md:flex">
          {LINKS.map(([label, href]) => (
            <li key={href}>
              <a
                href={href}
                className="hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
