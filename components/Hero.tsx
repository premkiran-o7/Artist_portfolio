import Image from "next/image";
import { getContent } from "@/lib/content";

export default function Hero() {
  const c = getContent();
  return (
    <section id="hero" className="min-h-[88vh] flex items-center px-6 md:px-12 pt-24 pb-12">
      <div className="mx-auto w-full max-w-6xl grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center">
        <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl border border-white/10">
          <Image
            src="/profile-placeholder.jpg"
            alt={`Portrait of ${c.name}`}
            fill
            priority
            sizes="(max-width: 768px) 80vw, 33vw"
            className="object-cover"
          />
        </div>

        <div>
          <h1 className="font-[family-name:var(--font-display)] font-semibold tracking-tight leading-[0.95] text-[clamp(3.5rem,9vw,7rem)]">
            {c.name}
          </h1>
          <p className="mt-3 text-[var(--ink-dim)] text-lg">{c.tagline}</p>

          <div className="mt-6 space-y-1.5 text-balance text-[clamp(1rem,1.6vw,1.25rem)] leading-relaxed">
            {c.bio.map((line) => <p key={line}>{line}</p>)}
          </div>

          <dl className="mt-8 border-t border-white/10 pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
            <div><dt className="sr-only">Date of birth</dt><dd>{c.dob}</dd></div>
            <span aria-hidden className="opacity-30">|</span>
            <div><dt className="sr-only">Phone</dt>
              <dd><a className="hover:text-[var(--ink)]" href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a></dd>
            </div>
            <span aria-hidden className="opacity-30">|</span>
            <div><dt className="sr-only">Email</dt>
              <dd><a className="hover:text-[var(--ink)]" href={`mailto:${c.email}`}>{c.email}</a></dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
