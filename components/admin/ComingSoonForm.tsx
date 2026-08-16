"use client";

import { useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { inputClass, labelClass } from "@/lib/adminFormStyles";
import ThumbUploadField from "./ThumbUploadField";

type Status = "idle" | "pending";

type Props = {
  /** Called after a successful POST, so the dashboard can re-fetch the list. */
  onCreated: () => void | Promise<void>;
};

/**
 * Form for adding a single "coming soon" teaser (Section 7 — a dashed-border,
 * "Working on it"-pill card, generic and not bound to any one category per
 * the 2026-08-16 decision revision below, before `is_live` promotes it into
 * the main category grid). Mirrors VideoForm.tsx.
 *
 * `blurb` is optional (ComingSoonIn.blurb: str | None = None,
 * api/_lib/routes_clients.py) — an empty textarea omits the key from the
 * POST body entirely rather than sending `""`, so the backend's own None
 * default applies. (Sending `""` on create would also work here since it's
 * not the PATCH null-skip path, but omitting keeps create and "unset" the
 * same shape as VideoForm.tsx's thumb_url omission.)
 *
 * Thumbnail upload category: "coming-soon", filed under coming-soon/thumbs/.
 * `coming_soon` rows carry no category column at all — spec §9.7's 2026-08-16
 * revision made this section deliberately generic — so this needed a folder
 * of its own rather than borrowing another section's.
 *
 * It briefly borrowed "3d-modeling" instead, as the FOLDERS key least likely
 * to collide with real content. That reasoning held only while 3D Modeling
 * had no content of its own; the same revision that made this section generic
 * also carved 3D Modeling out as a real photo-gallery section (§7a), so that
 * folder would have ended up holding images belonging to neither. Object keys
 * are effectively permanent once files land on them, so the dedicated key was
 * added to routes_uploads.py before the first upload rather than after.
 */
export default function ComingSoonForm({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [blurb, setBlurb] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [thumbUrl, setThumbUrl] = useState("");
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbFieldKey, setThumbFieldKey] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "pending") return;

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setStatus("pending");
    setError(null);

    const body: Record<string, unknown> = {
      title: title.trim(),
      is_live: isLive,
      // Omitted (not sent as "") when no thumbnail was uploaded — see
      // lib/db.ts's resolveThumb doc comment for why "" vs omitted matters.
    };
    if (thumbUrl) body.thumb_url = thumbUrl;
    const trimmedBlurb = blurb.trim();
    if (trimmedBlurb) body.blurb = trimmedBlurb;

    let res: Response;
    try {
      res = await adminFetch("/coming-soon", { method: "POST", body: JSON.stringify(body) });
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("idle");
      return;
    }

    if (res.status === 401) {
      window.location.href = "/admin";
      return; // stay disabled through the navigation
    }

    if (res.ok) {
      setTitle("");
      setBlurb("");
      setIsLive(false);
      setThumbUrl("");
      setThumbFieldKey((k) => k + 1); // remounts ThumbUploadField, clearing its file/preview
      setStatus("idle");
      await onCreated();
      return;
    }

    setError(
      res.status === 422
        ? "Check the fields and try again."
        : "Something went wrong. Please try again."
    );
    setStatus("idle");
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="coming_soon_title" className={labelClass}>
          Title
        </label>
        <input
          id="coming_soon_title"
          name="coming_soon_title"
          type="text"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="coming_soon_blurb" className={labelClass}>
          Blurb (optional)
        </label>
        <textarea
          id="coming_soon_blurb"
          name="coming_soon_blurb"
          rows={3}
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          className={inputClass}
        />
      </div>

      <ThumbUploadField
        key={thumbFieldKey}
        id="coming_soon_thumb_file"
        category="coming-soon"
        onUploaded={setThumbUrl}
        onBusyChange={setThumbBusy}
      />

      <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
        <input type="checkbox" checked={isLive} onChange={(e) => setIsLive(e.target.checked)} />
        Live — show this in the main work grid
      </label>

      <p role="alert" className="min-h-5 text-sm text-[var(--accent)]">
        {error}
      </p>

      <button
        type="submit"
        disabled={status === "pending" || thumbBusy}
        className="mt-2 self-start border border-[var(--rule)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink)] hover:border-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "pending" ? "Adding…" : "Add item"}
      </button>
    </form>
  );
}
