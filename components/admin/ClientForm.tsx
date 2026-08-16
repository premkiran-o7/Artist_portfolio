"use client";

import { useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { isInstagramUrl } from "@/lib/instagram";
import { inputClass, labelClass } from "@/lib/adminFormStyles";
import ThumbUploadField from "./ThumbUploadField";

type Status = "idle" | "pending";

type Props = {
  /** Called after a successful POST, so the dashboard can re-fetch the list. */
  onCreated: () => void | Promise<void>;
};

/**
 * Form for adding a single client (Section 6, "Client work"). Mirrors
 * VideoForm.tsx's structure and styling.
 *
 * `instagram_url` is validated client-side with `isInstagramUrl` before
 * submit. The brief is explicit about why this matters here specifically: a
 * wrong link is invisible until someone actually clicks it on the live site
 * — there's no thumbnail-preview-style feedback loop the way a bad YouTube
 * URL at least fails to produce a thumbnail. The backend itself does not
 * validate the URL's shape (ClientIn.instagram_url is just
 * `Field(min_length=1)` — see api/_lib/routes_clients.py), so this check
 * only exists here.
 *
 * Thumbnail upload uses category "clients" (api/_lib/routes_uploads.py's
 * FOLDERS key for client-logo thumbnails specifically — see
 * lib/uploadThumb.ts's `UploadCategory` doc comment for why this is a wider
 * set than the video `Category` enum).
 */
export default function ClientForm({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbFieldKey, setThumbFieldKey] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "pending") return;

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!isInstagramUrl(instagramUrl)) {
      setError("Enter a valid instagram.com URL.");
      return;
    }

    setStatus("pending");
    setError(null);

    let res: Response;
    try {
      res = await adminFetch("/clients", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          instagram_url: instagramUrl.trim(),
          // Omit the key entirely when no thumbnail was uploaded (rather than
          // sending ""), so the backend's own default (None) applies on
          // create. This only matters for PATCH, where an explicit null is
          // silently ignored — see lib/db.ts's resolveThumb doc comment — but
          // the habit of never sending null for an unset optional field is
          // kept here too.
          ...(thumbUrl ? { thumb_url: thumbUrl } : {}),
        }),
      });
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
      setName("");
      setInstagramUrl("");
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
        <label htmlFor="client_name" className={labelClass}>
          Name
        </label>
        <input
          id="client_name"
          name="client_name"
          type="text"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="client_instagram_url" className={labelClass}>
          Instagram URL
        </label>
        <input
          id="client_instagram_url"
          name="client_instagram_url"
          type="url"
          required
          placeholder="https://instagram.com/…"
          value={instagramUrl}
          onChange={(e) => setInstagramUrl(e.target.value)}
          className={inputClass}
        />
      </div>

      <ThumbUploadField
        key={thumbFieldKey}
        id="client_thumb_file"
        category="clients"
        onUploaded={setThumbUrl}
        onBusyChange={setThumbBusy}
      />

      <p role="alert" className="min-h-5 text-sm text-[var(--accent)]">
        {error}
      </p>

      <button
        type="submit"
        disabled={status === "pending" || thumbBusy}
        className="mt-2 self-start border border-[var(--rule)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink)] hover:border-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "pending" ? "Adding…" : "Add client"}
      </button>
    </form>
  );
}
