"use client";
import { useState } from "react";

/**
 * The clipboard button split out of Contact.tsx, and the ONLY interactive part
 * of that section.
 *
 * Why it is its own file: Contact used to be `"use client"` as a whole so that
 * this one `useState` would work. But Contact also calls `getContent()`, and
 * lib/content.ts imports zod at module scope — so marking the section a Client
 * Component shipped **zod plus content.json to every visitor**, 305KB raw /
 * ~72KB gzipped, on a page whose entire JS budget is 120KB. It was the single
 * largest chunk on the site and nothing in the browser ever used it: the schema
 * only exists to validate content.json at build time.
 *
 * This is the same hazard lib/categories.ts documents at length for
 * @neondatabase/serverless, one file over. The rule that catches both: a
 * `"use client"` module may not import lib/content.ts or lib/db.ts, not even
 * for one field. Push the boundary down to the smallest thing that genuinely
 * needs state — which is this button — and let the Server Component read the
 * content and hand down plain strings.
 *
 * lib/content.noClientImport.test.ts enforces that rule automatically.
 *
 * `email` arrives as a prop rather than being read here for exactly that
 * reason: a string crosses the server/client boundary, an import does not.
 */
export default function CopyEmailButton({
  email,
  className,
}: {
  email: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be denied or unavailable (permissions, insecure
      // context, unsupported browser) — the mailto link above is the primary
      // path and still works regardless.
    }
  };

  return (
    <>
      <button type="button" onClick={copyEmail} className={className}>
        {copied ? "Copied ✓" : "Copy email"}
      </button>
      {/* Rendered as a sibling of the button rather than back up in Contact,
          because the message is derived from state that only lives here.
          `sr-only` is position:absolute, so this is out of flow and cannot
          affect the flex row it now sits inside. */}
      <p aria-live="polite" className="sr-only">
        {copied ? "Email copied to clipboard" : ""}
      </p>
    </>
  );
}
