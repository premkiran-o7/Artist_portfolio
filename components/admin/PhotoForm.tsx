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
 * Form for adding a single 3D Modeling photo (section 7a). Mirrors
 * ClientForm.tsx's structure and styling.
 *
 * Two differences from ClientForm, both because of how `photos` differs from
 * `clients`:
 *
 *   - The uploaded image IS the record's content, not an optional logo —
 *     `photos.image_url` is `NOT NULL` (migrations/002_photos.sql), so unlike
 *     a client's `thumb_url` an upload here is required before Submit does
 *     anything, and ThumbUploadField's label is overridden to say so instead
 *     of its default "(optional)".
 *   - `category` is hardcoded to "3d-modeling" and never shown as a field.
 *     `Photo.category` is a real column (routes_photos.py's `PhotoIn`) kept
 *     for future flexibility — see migrations/002_photos.sql's doc comment —
 *     but this tab only ever creates rows for the 3D Modeling section, so
 *     there is nothing for an admin control to choose between yet.
 */
export default function PhotoForm({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [imageFieldKey, setImageFieldKey] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "pending") return;

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!imageUrl) {
      setError("Upload a photo first.");
      return;
    }

    setStatus("pending");
    setError(null);

    let res: Response;
    try {
      res = await adminFetch("/photos", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          category: "3d-modeling",
          image_url: imageUrl,
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
      setTitle("");
      setImageUrl("");
      setImageFieldKey((k) => k + 1); // remounts ThumbUploadField, clearing its file/preview
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
        <label htmlFor="photo_title" className={labelClass}>
          Title
        </label>
        <input
          id="photo_title"
          name="photo_title"
          type="text"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </div>

      <ThumbUploadField
        key={imageFieldKey}
        id="photo_image_file"
        category="3d-modeling"
        label="Photo"
        onUploaded={setImageUrl}
        onBusyChange={setImageBusy}
      />

      <p role="alert" className="min-h-5 text-sm text-[var(--accent)]">
        {error}
      </p>

      <button
        type="submit"
        disabled={status === "pending" || imageBusy}
        className="mt-2 self-start border border-[var(--rule)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink)] hover:border-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "pending" ? "Adding…" : "Add photo"}
      </button>
    </form>
  );
}
