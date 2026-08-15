"use client";

import { useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { parseYouTubeId, thumbnailUrl } from "@/lib/youtube";
import { CATEGORIES, type Category, type Visibility } from "./RowList";

type Status = "idle" | "pending";

const inputClass =
  "border border-[var(--rule)] bg-transparent px-3 py-2 text-[var(--ink)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const labelClass =
  "font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]";

type Props = {
  /** Called after a successful POST, so the dashboard can re-fetch the list. */
  onCreated: () => void | Promise<void>;
};

/**
 * Form for adding a single video. Mirrors app/admin/page.tsx's plain,
 * one-person-tool styling (--rule borders, --ink text, mono uppercase labels).
 *
 * Paste-to-autofill (brief Step 2): on URL blur, `parseYouTubeId` runs
 * locally. If it finds an id, the thumbnail preview is set immediately from
 * `thumbnailUrl(id)` — that always works, it's a pure string template, no
 * network call. A YouTube oEmbed request is then attempted to prefill the
 * title. oEmbed 401s/404s for unlisted videos (most of what Manish uploads,
 * per the backend's default `visibility: "unlisted"`), and that is expected,
 * not an error: any failure (non-OK status, network error, malformed JSON) is
 * swallowed silently and just leaves the title field for Manish to type.
 *
 * Upload wiring (brief Step 3) is deliberately NOT built here. No storage
 * provider is configured yet (see api/_lib/r2.py / routes_uploads.py — the
 * signing route exists server-side, but there is no live R2 account/bucket to
 * point it at). The file input below is disabled with a TODO documenting
 * exactly what Step 3 would do once that account exists. Until then, every
 * video is created without a `thumb_url`, and both the public site
 * (lib/db.ts's `resolveThumb()`) and this dashboard's own RowList fall back
 * to the YouTube-derived thumbnail automatically.
 */
export default function VideoForm({ onCreated }: Props) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>(CATEGORIES[0].value);
  const [visibility, setVisibility] = useState<Visibility>("unlisted");
  const [isFeatured, setIsFeatured] = useState(false);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleUrlBlur = async () => {
    const id = parseYouTubeId(youtubeUrl);
    if (!id) return;

    // Always works: derived from the id string alone, no network round trip.
    setThumbPreview(thumbnailUrl(id));

    // Best-effort only. See the doc comment above for why a failure here is
    // routine (unlisted videos) rather than exceptional.
    try {
      const r = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`
      );
      if (r.ok) {
        const data: unknown = await r.json();
        const oEmbedTitle =
          typeof data === "object" && data !== null && "title" in data
            ? (data as { title: unknown }).title
            : undefined;
        if (typeof oEmbedTitle === "string" && oEmbedTitle.length > 0) {
          setTitle(oEmbedTitle);
        }
      }
    } catch {
      // Network error / CORS / bad JSON — same "not an error" treatment.
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Guards against double-submit re-firing the request while one is
    // already in flight (same pattern as app/admin/page.tsx's login form).
    if (status === "pending") return;

    const youtubeId = parseYouTubeId(youtubeUrl);
    if (!youtubeId) {
      setError("Enter a valid YouTube URL.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setStatus("pending");
    setError(null);

    let res: Response;
    try {
      res = await adminFetch("/videos", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          category,
          youtube_url: youtubeUrl.trim(),
          visibility,
          is_featured: isFeatured,
          // thumb_url intentionally omitted — see the TODO near the disabled
          // file input below. Omitting the key (rather than sending null)
          // lets the backend's own default (None) apply cleanly on create;
          // this only matters for PATCH, where an explicit null is silently
          // ignored, but the habit of never sending null for an unset
          // optional field is kept here too for consistency.
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
      setYoutubeUrl("");
      setTitle("");
      setIsFeatured(false);
      setThumbPreview(null);
      setStatus("idle");
      await onCreated();
      return;
    }

    setError(
      res.status === 422
        ? "Check the YouTube URL and try again."
        : "Something went wrong. Please try again."
    );
    setStatus("idle");
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="youtube_url" className={labelClass}>
          YouTube URL
        </label>
        <input
          id="youtube_url"
          name="youtube_url"
          type="url"
          required
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          onBlur={handleUrlBlur}
          placeholder="https://youtu.be/…"
          className={inputClass}
        />
      </div>

      {thumbPreview && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-only
        // preview of a YouTube-hosted thumbnail; no next/image remote
        // pattern configured for i.ytimg.com.
        <img
          src={thumbPreview}
          alt=""
          className="h-24 w-40 border border-[var(--rule)] object-cover"
        />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className={labelClass}>
          Category
        </label>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className={inputClass}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className={labelClass}>Visibility</legend>
        {/* No "private" option: private YouTube videos cannot be embedded on
            the public site, so the backend's Visibility enum only defines
            public and unlisted (api/_lib/models.py). */}
        <div className="flex gap-4">
          {(["unlisted", "public"] as const).map((v) => (
            <label key={v} className="flex items-center gap-2 text-sm text-[var(--ink)]">
              <input
                type="radio"
                name="visibility"
                value={v}
                checked={visibility === v}
                onChange={() => setVisibility(v)}
              />
              {v === "unlisted" ? "Unlisted" : "Public"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="thumb_file" className={labelClass}>
          Thumbnail (optional)
        </label>
        {/*
          TODO(upload): wire this up once a storage provider is configured —
          no R2 account/bucket exists yet, only the signing route
          (api/_lib/routes_uploads.py). When it does, submit should:
            1. POST /api/py/uploads/sign { filename, contentType, category, sizeBytes }
               via adminFetch, to get back { uploadUrl, publicUrl }.
            2. PUT the file's bytes directly to `uploadUrl`, with a
               Content-Type header matching EXACTLY the contentType that was
               signed. This request must NOT go through adminFetch — it
               carries no cookie/CSRF header and R2 would reject headers it
               wasn't asked to sign for (see adminFetch.ts's own doc comment).
               Show upload progress; a multi-MB file on a slow connection is
               not instant.
            3. Send the resulting `publicUrl` as `thumb_url` in the POST body
               above, replacing the current omission.
          Until then this input stays disabled and every video is created
          without a thumb_url; the YouTube-derived thumbnail
          (lib/youtube.ts's thumbnailUrl(), applied via lib/db.ts's
          resolveThumb() on the public site and inline in RowList here) is
          used automatically.
        */}
        <input
          id="thumb_file"
          name="thumb_file"
          type="file"
          accept="image/*"
          disabled
          title="Upload isn't set up yet — no storage provider is configured."
          className={`${inputClass} cursor-not-allowed opacity-50`}
        />
        <p className="text-xs text-[var(--ink-dim)]">
          Upload isn&rsquo;t set up yet — the YouTube thumbnail is used automatically.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
        <input
          type="checkbox"
          checked={isFeatured}
          onChange={(e) => setIsFeatured(e.target.checked)}
        />
        Featured — becomes this category&rsquo;s cover, replacing any other featured video in it
      </label>

      <p role="alert" className="min-h-5 text-sm text-[var(--accent)]">
        {error}
      </p>

      <button
        type="submit"
        disabled={status === "pending"}
        className="mt-2 self-start border border-[var(--rule)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink)] hover:border-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "pending" ? "Adding…" : "Add video"}
      </button>
    </form>
  );
}
