"use client";

import { useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/adminFetch";
import DisabledThumbField from "./DisabledThumbField";

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
 * Form for adding a single "coming soon" teaser (Section 7 — e.g. the "3D
 * Modeling" card with a dashed border and "Working on it" pill, before
 * `is_live` promotes it into the main category grid). Mirrors VideoForm.tsx.
 *
 * `blurb` is optional (ComingSoonIn.blurb: str | None = None,
 * api/_lib/routes_clients.py) — an empty textarea omits the key from the
 * POST body entirely rather than sending `""`, so the backend's own None
 * default applies. (Sending `""` on create would also work here since it's
 * not the PATCH null-skip path, but omitting keeps create and "unset" the
 * same shape as VideoForm.tsx's thumb_url omission.)
 *
 * Upload wiring is deliberately NOT built — see DisabledThumbField.tsx.
 */
export default function ComingSoonForm({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [blurb, setBlurb] = useState("");
  const [isLive, setIsLive] = useState(false);
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
      // thumb_url intentionally omitted — see DisabledThumbField.tsx.
    };
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

      <DisabledThumbField id="coming_soon_thumb_file" />

      <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
        <input type="checkbox" checked={isLive} onChange={(e) => setIsLive(e.target.checked)} />
        Live — show this in the main work grid
      </label>

      <p role="alert" className="min-h-5 text-sm text-[var(--accent)]">
        {error}
      </p>

      <button
        type="submit"
        disabled={status === "pending"}
        className="mt-2 self-start border border-[var(--rule)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink)] hover:border-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "pending" ? "Adding…" : "Add item"}
      </button>
    </form>
  );
}
