"use client";
import { useState } from "react";
import { getContent } from "@/lib/content";

/**
 * No form by design — a large mailto link converts better than a contact
 * form and has zero moving parts (no backend, no spam handling). Copy-to-
 * clipboard is a convenience alongside it, not a replacement.
 *
 * Sits on solid --ground, so --ink-dim is contrast-safe for the secondary
 * row (unlike over the hero's footage).
 */
export default function Contact() {
  const c = getContent();
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(c.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be denied or unavailable (permissions, insecure
      // context, unsupported browser) — the mailto link above is the primary
      // path and still works regardless.
    }
  };

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
          <button type="button" onClick={copyEmail} className={linkClass}>
            {copied ? "Copied ✓" : "Copy email"}
          </button>
          <a href={c.socials.instagram} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Instagram
          </a>
          <a href={c.socials.youtube} target="_blank" rel="noopener noreferrer" className={linkClass}>
            YouTube
          </a>
          <a href={c.socials.linkedin} target="_blank" rel="noopener noreferrer" className={linkClass}>
            LinkedIn
          </a>
        </div>

        <p aria-live="polite" className="sr-only">
          {copied ? "Email copied to clipboard" : ""}
        </p>
      </div>
    </section>
  );
}
