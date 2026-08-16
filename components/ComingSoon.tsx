import Reveal from "@/components/Reveal";
import { monogram, pendingTeasers, type ComingSoonCard } from "@/lib/clients";

type Props = {
  /** Raw `coming_soon` rows; live ones are filtered out here, not by the caller. */
  items: ComingSoonCard[];
};

/**
 * Section 7 of the wireframe: teaser cards, deliberately styled unfinished —
 * dashed border, faded media, a "Working on it" pill, and the wireframe's
 * View button.
 *
 * GENERIC, not "3D Modeling" (spec §9.7, decision revision 2026-08-16). This
 * card used to *be* the 3D Modeling card; 3D Modeling turned out to be
 * finished photo work and moved to its own section (§9.7a). What is left is
 * what the `coming_soon` table always was underneath: a teaser mechanism
 * Manish drives entirely from the admin panel. Nothing here may hardcode a
 * category name.
 *
 * Server Component — no state, no handlers, no "use client", and only a
 * type-only import from lib/db.ts (via lib/clients.ts), so the database
 * driver never reaches a bundle.
 */
export default function ComingSoon({ items }: Props) {
  const teasers = pendingTeasers(items);

  // Empty state: omit the whole section, heading included — a "Coming Soon"
  // heading over nothing looks broken, and this section is entirely optional
  // content. Note this also fires when every row is `is_live`.
  if (teasers.length === 0) return null;

  return (
    <section id="coming-soon" className="px-6 md:px-12 py-16 scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">Coming Soon</h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {teasers.map((item, index) => {
            const initials = monogram(item.title);
            return (
              <li key={item.id}>
                <Reveal delay={index * 60}>
                  {/* Dashed border + faded media are the "unfinished" signal.
                      The fade is applied to the MEDIA ONLY, never to the card
                      as a whole: --ink-dim body text at 70% opacity composites
                      to ~3.25:1 on --ground, under the 4.5:1 floor, while at
                      full strength it measures 5.54:1. Fading the plate costs
                      nothing — an image carries no text-contrast requirement. */}
                  <div className="h-full overflow-hidden rounded-xl border border-dashed border-[var(--rule)]">
                    <div className="relative aspect-video bg-black opacity-60">
                      {item.thumb_url ? (
                        // alt="": the title is printed directly beneath it, and
                        // the card is not a link, so there is nothing else for
                        // this image to name.
                        <img
                          src={item.thumb_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        // No storage provider is configured (spec §9.7a), so a
                        // teaser normally has no image at all. Same monogram
                        // plate as the client cards and the Skills tiles.
                        <div
                          aria-hidden="true"
                          className="grid h-full w-full place-items-center bg-[var(--rule)] font-[family-name:var(--font-display)] text-3xl text-[var(--ink-dim)]"
                        >
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <p className="inline-block rounded-full border border-dashed border-[var(--rule)] px-3 py-1 font-[family-name:var(--font-mono)] text-[0.65rem] uppercase tracking-widest text-[var(--ink-dim)]">
                        Working on it
                      </p>
                      <h3 className="mt-4 font-[family-name:var(--font-display)] text-xl">
                        {item.title}
                      </h3>
                      {item.blurb && (
                        <p className="mt-2 text-sm text-[var(--ink-dim)]">{item.blurb}</p>
                      )}
                      {/* The wireframe's View button. It is rendered DISABLED
                          because there is genuinely nowhere for it to go: the
                          `coming_soon` table has no URL column (see
                          migrations/001_init.sql — id, title, blurb, thumb_url,
                          is_live), and an unfinished piece has nothing to show
                          yet by definition. A disabled control is honest —
                          "this exists, not available yet" — whereas a live-
                          looking button that does nothing on click is the thing
                          CategoryCards.tsx deliberately refuses to ship. When
                          Manish flips `is_live`, the item leaves this section
                          for the main grid, where its card is a real control.
                          If a teaser should ever be clickable BEFORE it goes
                          live, that needs a URL column, not a change here. */}
                      <button
                        type="button"
                        disabled
                        className="mt-5 cursor-not-allowed rounded-lg border border-[var(--rule)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]"
                      >
                        View
                        <span className="sr-only"> — not available yet</span>
                      </button>
                    </div>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
