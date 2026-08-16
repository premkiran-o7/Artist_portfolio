/**
 * Shared Tailwind class strings for every admin form field, extracted from
 * VideoForm.tsx / ClientForm.tsx / ComingSoonForm.tsx / PlaylistsTab.tsx /
 * app/admin/page.tsx, which had each declared byte-identical copies of both
 * constants (flagged in the Task 16/17 ledger as duplication worth fixing).
 *
 * Both class strings reference design tokens from app/globals.css
 * (--rule, --ink, --ink-dim, --accent) — never a hardcoded color or the
 * border-white/NN escape hatch.
 */
export const inputClass =
  "border border-[var(--rule)] bg-transparent px-3 py-2 text-[var(--ink)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export const labelClass =
  "font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]";
