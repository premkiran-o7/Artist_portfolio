import { getContent } from "@/lib/content";

/**
 * Sits on solid --ground below Contact, so the plain --rule hairline (the
 * codebase's solid-ground border token) is fine here — no footage behind it.
 */
export default function SiteFooter() {
  const c = getContent();
  return (
    <footer className="border-t border-[var(--rule)] px-6 py-8 md:px-12">
      <p className="mx-auto max-w-6xl font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]">
        © {new Date().getFullYear()} {c.name}
      </p>
    </footer>
  );
}
