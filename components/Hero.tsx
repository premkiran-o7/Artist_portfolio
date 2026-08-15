import Image from "next/image";
import { getContent } from "@/lib/content";
import ShowReel from "@/components/ShowReel";

export default function Hero() {
  const c = getContent();
  return (
    // `isolate` keeps ShowReel's -z-10 layer inside this section's stacking context,
    // so it sits behind the content but still in front of the page background.
    // min-h-dvh (not vh) so mobile browser chrome cannot crop the hero.
    <section
      id="hero"
      className="relative isolate flex min-h-dvh items-center overflow-hidden px-6 pt-24 pb-32 md:px-12 md:pb-28"
    >
      <ShowReel
        src="/showreel-placeholder.mp4"
        poster="/showreel-poster.jpg"
        youtubeUrl={c.socials.youtube}
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        {/* Capped at max-w-3xl so the text stays inside the dense side of the scrim. */}
        <div className="grid max-w-3xl gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8">
          <div className="relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-xl border border-[var(--ink)]/15 sm:w-40 md:w-[17rem]">
            <Image
              src="/profile-placeholder.jpg"
              alt={`Portrait of ${c.name}`}
              fill
              priority
              sizes="(max-width: 768px) 40vw, 17rem"
              className="object-cover"
            />
          </div>

          <div>
            <h1 className="font-[family-name:var(--font-display)] font-semibold tracking-tight leading-[0.95] text-[clamp(3.5rem,9vw,7rem)]">
              {c.name}
            </h1>
            {/* Over footage --ink-dim only reaches 1.74:1, so tone cannot carry the
                hierarchy here: it comes from weight and tracking against the name instead. */}
            <p className="mt-3 text-[var(--ink)] text-lg font-light tracking-wide">{c.tagline}</p>
          </div>
        </div>

        <div className="mt-6 max-w-3xl space-y-1.5 text-balance text-[clamp(1rem,1.6vw,1.25rem)] leading-relaxed">
          {c.bio.map((line) => <p key={line}>{line}</p>)}
        </div>

        {/* --rule composites to roughly #1A1A1A over footage and would vanish, so this
            hairline uses --ink at low alpha instead.
            These are the contact details — the most functional characters on the page — so
            they run at full --ink. The smaller monospace face, uppercase and wide tracking
            already read as secondary without leaning on tone. */}
        {/* Every child <div> holds exactly one dt+dd pair, which is the only valid content
            model for a <dl> using div groups. The dividers are drawn as a left border on each
            group except the last, so no non-dt/dd element enters the list.
            Trailing edge rather than leading: when the row wraps on narrow screens the rule
            then sits at the end of the first line, exactly as the original markup rendered it,
            instead of dangling at the start of the second. */}
        <dl className="mt-8 max-w-3xl border-t border-[var(--ink)]/20 pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink)] [&>div:not(:last-child)]:border-r [&>div:not(:last-child)]:border-[var(--ink)]/30 [&>div:not(:last-child)]:pr-6">
          <div><dt className="sr-only">Date of birth</dt><dd>{c.dob}</dd></div>
          <div><dt className="sr-only">Phone</dt>
            <dd><a className="hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]" href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a></dd>
          </div>
          <div><dt className="sr-only">Email</dt>
            <dd><a className="hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]" href={`mailto:${c.email}`}>{c.email}</a></dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
