import { getContent } from "@/lib/content";
import CopyEmailButton from "@/components/CopyEmailButton";

/**
 * No form by design — a large mailto link converts better than a contact
 * form and has zero moving parts (no backend, no spam handling). Copy-to-
 * clipboard is a convenience alongside it, not a replacement.
 *
 * Sits on solid --ground, so --ink-dim is contrast-safe for the secondary
 * row (unlike over the hero's footage).
 *
 * SERVER COMPONENT — deliberately, and it must stay one. It calls
 * getContent(), which imports zod; when this file carried "use client" that
 * import shipped zod + content.json to the browser as a 305KB raw / ~72KB
 * gzipped chunk, the largest on the site, used by nothing at runtime. The only
 * thing here that ever needed state is the clipboard button, which now lives in
 * components/CopyEmailButton.tsx and receives the address as a plain prop.
 * Do not add "use client" to this file — put the interactive bit in its own
 * leaf component instead. Enforced by lib/content.noClientImport.test.ts.
 */
export default function Contact() {
  const c = getContent();

  const linkClass =
    "hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

  return (
    <section id="contact" className="px-6 md:px-12 py-24 scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">Contact</h2>

        <a
          href={`mailto:${c.email}`}
          className={`mt-8 block break-all font-[family-name:var(--font-display)] text-[clamp(1.75rem,6vw,4rem)] leading-tight hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]`}
        >
          {c.email}
        </a>

        <div className="mt-6 flex flex-wrap items-center gap-6 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
          <a href={`tel:${c.phone.replace(/\s/g, "")}`} className={linkClass}>
            {c.phone}
          </a>
          <CopyEmailButton email={c.email} className={linkClass} />
          <a href={c.socials.linkedin} target="_blank" rel="noopener noreferrer" className={linkClass}>
            LinkedIn
          </a>
        </div>
      </div>
    </section>
  );
}
