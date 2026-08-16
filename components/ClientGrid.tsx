import Reveal from "@/components/Reveal";
import { monogram, type ClientCard } from "@/lib/clients";

type Props = {
  /** Already ordered by the query (`getClients()` sorts by sort_order ASC). */
  clients: ClientCard[];
};

/**
 * Instagram's camera glyph, hand-written as three primitives (rounded square,
 * lens circle, flash dot) rather than pulled from an icon package.
 *
 * Inline and hand-drawn on purpose: it costs no network request and no
 * dependency, and Task 6 already proved the icon-package route unreliable here
 * — five of seven brand marks were missing from Simple Icons entirely and
 * rendered as blank squares.
 *
 * aria-hidden because the client's name sits right next to it inside the same
 * link, and the link's own text already says "on Instagram" (visually hidden)
 * — labelling the glyph too would just repeat the word.
 */
function InstagramGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <rect x="3" y="3" width="18" height="18" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Section 6 of the wireframe: a grid of client cards, each opening that
 * client's Instagram post in a new tab.
 *
 * NO INSTAGRAM EMBED SCRIPT, by spec §9.6 — the wireframe says "links".
 * Embeds cannot autoplay, drag in Meta's chrome, are heavy, and break
 * whenever the embed API changes.
 *
 * Each card is ONE <a> wrapping the whole thing, per the brief. Everything
 * inside it is therefore non-interactive content only (img / span / h3 /
 * svg) — no nested button or second link, which would be invalid
 * interactive-content-in-interactive-content HTML. See
 * components/CategoryCards.tsx for the same structural rule stated from the
 * other direction.
 *
 * Server Component: no state, no handlers, so no "use client" and no JS
 * shipped for it. `ClientCard` is a type-only import, so lib/db.ts's
 * @neondatabase/serverless never reaches a bundle.
 */
export default function ClientGrid({ clients }: Props) {
  // Empty state: render NOTHING, heading included. A "Client Work" heading
  // over an empty grid reads as a broken page rather than an empty one.
  if (clients.length === 0) return null;

  return (
    <section id="clients" className="px-6 md:px-12 py-16 scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">Client Work</h2>
        <ul className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {clients.map((client, index) => {
            const initials = monogram(client.name);
            return (
              <li key={client.id}>
                <Reveal delay={index * 60}>
                  <a
                    href={client.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block overflow-hidden rounded-xl border border-[var(--rule)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    <div className="relative aspect-square bg-black">
                      {client.thumb_url ? (
                        // alt="" is correct, not a missing alt: the client's
                        // name is printed directly below inside the same link,
                        // so describing the image would make the link announce
                        // its name twice.
                        <img
                          src={client.thumb_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        // thumb_url is null for EVERY client today (no storage
                        // provider is configured — spec §9.7a), so this is the
                        // normal path. A monogram plate, same idiom as the
                        // Skills tiles, so a card with no upload still looks
                        // composed instead of broken.
                        <div
                          aria-hidden="true"
                          className="grid h-full w-full place-items-center bg-[var(--rule)] font-[family-name:var(--font-display)] text-3xl text-[var(--ink-dim)]"
                        >
                          {initials}
                        </div>
                      )}
                      {/* Decorative hover wash; nothing here is announced. */}
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-[var(--rule)] px-4 py-3">
                      <h3 className="truncate text-sm">{client.name}</h3>
                      <span className="text-[var(--ink-dim)] transition-colors group-hover:text-[var(--ink)]">
                        <InstagramGlyph />
                      </span>
                      {/* The visible card says only the client's name; this
                          tells a screen-reader user where the link goes and
                          that it leaves the page. */}
                      <span className="sr-only">on Instagram (opens in a new tab)</span>
                    </div>
                  </a>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
