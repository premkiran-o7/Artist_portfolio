const inputClass =
  "border border-[var(--rule)] bg-transparent px-3 py-2 text-[var(--ink)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const labelClass =
  "font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]";

/**
 * Shared "thumbnail upload isn't wired up yet" field for ClientForm.tsx and
 * ComingSoonForm.tsx — the same disabled-input-plus-TODO pattern
 * VideoForm.tsx established in Task 16, factored out so the (identical)
 * reasoning isn't triplicated across three forms.
 *
 * Still no storage provider is configured (see api/_lib/r2.py /
 * routes_uploads.py — the signing route exists server-side, but there is no
 * live R2 account/bucket to point it at). When one exists, wiring this up
 * means, for whichever form renders it:
 *   1. POST /api/py/uploads/sign { filename, contentType, category, sizeBytes }
 *      via adminFetch, to get back { uploadUrl, publicUrl }.
 *   2. PUT the file's bytes directly to `uploadUrl` — NOT through adminFetch
 *      (no cookie/CSRF header; R2 would reject headers it wasn't asked to
 *      sign for — see adminFetch.ts's own doc comment), with a Content-Type
 *      header matching EXACTLY the contentType that was signed.
 *   3. Send the resulting `publicUrl` as `thumb_url` in the create/patch
 *      body, in place of the current omission.
 * Until then, clients and coming-soon items are created without a
 * `thumb_url`; clients fall back to no image, coming-soon items likewise
 * (neither has a YouTube-derived fallback the way videos do).
 *
 * `id` must be unique per form instance (two of these can be on the same
 * page across different tabs' forms).
 */
export default function DisabledThumbField({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        Thumbnail (optional)
      </label>
      <input
        id={id}
        name={id}
        type="file"
        accept="image/*"
        disabled
        title="Upload isn't set up yet — no storage provider is configured."
        className={`${inputClass} cursor-not-allowed opacity-50`}
      />
      <p className="text-xs text-[var(--ink-dim)]">
        Upload isn&rsquo;t set up yet — no storage provider is configured.
      </p>
    </div>
  );
}
