"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { uploadThumb, validateFile, type UploadCategory } from "@/lib/uploadThumb";
import { inputClass, labelClass } from "@/lib/adminFormStyles";

type Props = {
  /** Must be unique per form instance — two of these can be on the same page
   * across different tabs' forms (mirrors DisabledThumbField.tsx's contract). */
  id: string;
  /** Storage folder this field's uploads land in — see lib/uploadThumb.ts's
   * `UploadCategory` doc comment for why this is NOT the video Category enum. */
  category: UploadCategory;
  /** Called with the uploaded file's public URL once a PUT succeeds, or with
   * "" whenever there is no successfully-uploaded file to send — cleared,
   * superseded by a second pick, or the upload failed. Callers should build
   * their POST body by OMITTING `thumb_url` entirely when this is "", the
   * same pattern every create form already used for "no thumbnail chosen". */
  onUploaded: (url: string) => void;
  /** Mirrors the upload's in-flight state so the parent form can disable its
   * own submit button — the same "no double submit" contract the forms
   * already apply to their own POST (see e.g. VideoForm.tsx's `status`). */
  onBusyChange: (busy: boolean) => void;
};

/**
 * Real thumbnail upload field, replacing DisabledThumbField.tsx now that
 * object storage is configured (Supabase Storage over its S3-compatible
 * API). Implements exactly the 3 steps DisabledThumbField.tsx's doc comment
 * specified, via lib/uploadThumb.ts:
 *   1. Validate the file client-side (type/size) before spending a round trip.
 *   2. POST /uploads/sign, then PUT the bytes straight to the returned URL.
 *   3. Report the resulting public URL up to the parent via `onUploaded`.
 *
 * Upload starts the moment a file is chosen (not deferred to form submit) —
 * that way the preview, progress, and any error are all resolved well before
 * the user reaches the Submit button, and the parent only ever needs to hold
 * a single string it already knows how to send.
 *
 * A local object URL drives the preview immediately on selection, before the
 * network round trip even starts, so "chosen" and "uploaded" are visibly
 * different states rather than one silent wait.
 *
 * `uploadToken` guards against two races: picking a second file while the
 * first is still uploading, and clicking "Clear" mid-upload. Either bumps
 * the token, so a stale upload's `.then`/`.catch` is a no-op when it
 * eventually resolves instead of clobbering newer state.
 */
export default function ThumbUploadField({ id, category, onUploaded, onBusyChange }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadToken = useRef(0);

  const clearPreview = () => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleClear = () => {
    uploadToken.current += 1; // invalidate any in-flight upload
    clearPreview();
    setFileName(null);
    setError(null);
    setUploading(false);
    onBusyChange(false);
    onUploaded("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = (uploadToken.current += 1);
    clearPreview();
    setFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    onUploaded(""); // the previously-uploaded URL (if any) no longer applies

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    onBusyChange(true);
    try {
      const url = await uploadThumb(file, category);
      if (uploadToken.current !== token) return; // superseded — drop this result
      onUploaded(url);
    } catch (err) {
      if (uploadToken.current !== token) return;
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      if (uploadToken.current === token) {
        setUploading(false);
        onBusyChange(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        Thumbnail (optional)
      </label>
      <input
        id={id}
        name={id}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        onChange={handleChange}
        className={`${inputClass} ${uploading ? "cursor-not-allowed opacity-50" : ""}`}
      />

      {previewUrl && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local
              blob: object URL preview of the just-picked file, not a remote/
              optimizable image; next/image cannot render blob: URLs. */}
          <img
            src={previewUrl}
            alt=""
            className="h-24 w-40 border border-[var(--rule)] object-cover"
          />
          <div className="flex flex-col items-start gap-1">
            <span className="max-w-40 truncate text-xs text-[var(--ink-dim)]">{fileName}</span>
            {uploading && (
              <span className="text-xs text-[var(--ink-dim)]">Uploading…</span>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-[var(--ink-dim)] underline hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <p role="alert" className="min-h-5 text-sm text-[var(--accent)]">
        {error}
      </p>
    </div>
  );
}
