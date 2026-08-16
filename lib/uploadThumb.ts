import { adminFetch } from "./adminFetch";

/**
 * Mirrors api/_lib/routes_uploads.py's `ALLOWED` dict keys exactly. Keep the
 * two in sync by hand — there is no shared source of truth across the
 * TS/Python split (same situation as the cookie name noted in
 * proxy.ts/auth.py, per the Task 15 ledger entry).
 */
export const ALLOWED_CONTENT_TYPES = [
  "video/mp4",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

/** Mirrors api/_lib/routes_uploads.py's `MAX_BYTES` (20MB) exactly. */
export const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Mirrors api/_lib/routes_uploads.py's `FOLDERS` key set — NOT the video
 * `Category` enum (routes_uploads.py's own docstring is explicit about this:
 * validating against `Category` would make it impossible to upload the
 * showreel or the portrait). `Category` (components/admin/RowList.tsx) is a
 * strict subset of this type, so a `Category` value is always a valid
 * `UploadCategory`.
 */
export type UploadCategory =
  | "color-grade"
  | "short-form"
  | "text-tracking"
  | "3d-modeling"
  | "clients"
  | "showreel"
  | "profile";

type SignResponse = { uploadUrl: string; publicUrl: string; key: string };

/** The bits of a browser `File` this module actually reads — kept minimal so tests
 * can pass a plain object instead of constructing a real `File`/`Blob`. */
export type FileLike = { readonly type: string; readonly size: number };

/**
 * Client-side pre-flight check, deliberately mirroring
 * routes_uploads.py's own `sign_upload` validation (content-type allowlist,
 * size cap) so a bad pick fails immediately with a real message instead of:
 *   - after a round trip to /uploads/sign (wasted latency for an outcome we
 *     already know), or
 *   - as an opaque 403 from the storage host partway through a multi-MB PUT,
 *     which is the failure mode `sizeBytes` at signing time CANNOT prevent —
 *     a presigned PUT has no way to enforce true upload size server-side
 *     (routes_uploads.py's own docstring says so explicitly). This check at
 *     least catches the common case — an obviously-too-big file — before any
 *     bytes move, even though a client that lies about `file.size` itself
 *     could still slip past both checks; that residual gap is accepted and
 *     documented in api/_lib/routes_uploads.py, not something fixable here.
 */
export function validateFile(file: FileLike): string | null {
  if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return "Unsupported file type. Use MP4, JPEG, PNG, or WebP.";
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  if (file.size > MAX_BYTES) {
    return "File exceeds the 20MB upload limit.";
  }
  return null;
}

/**
 * Uploads `file` under `category` and resolves to its public URL, ready to
 * send as `thumb_url`. Three steps (the spec DisabledThumbField.tsx and
 * VideoForm.tsx's TODO both documented, now implemented):
 *
 *   1. POST /uploads/sign via `adminFetch` (cookie + CSRF header attached
 *      automatically) to get a presigned PUT URL.
 *   2. PUT the bytes straight to that URL with a BARE `fetch` — never
 *      `adminFetch`. adminFetch.ts's own doc comment scopes this out
 *      explicitly: the storage host would reject headers it wasn't asked to
 *      sign for, and sending our session cookie to a third-party host is
 *      wrong regardless of whether it would be rejected.
 *   3. Return `publicUrl` for the caller to send as `thumb_url`.
 *
 * The `Content-Type` header on the PUT is the *exact* string that was sent
 * to `/uploads/sign` as `contentType` — it is bound into the SigV4
 * signature, so any drift (even a case difference) fails the PUT with an
 * opaque 403 that looks nothing like a Content-Type mismatch.
 *
 * Every failure path is mapped to a message a non-technical user (Manish)
 * can act on, rather than surfacing a raw status code or "Failed to fetch".
 */
export async function uploadThumb(file: File, category: UploadCategory): Promise<string> {
  const validationError = validateFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  let signRes: Response;
  try {
    signRes = await adminFetch("/uploads/sign", {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        category,
        sizeBytes: file.size,
      }),
    });
  } catch {
    throw new Error("Couldn't reach the server to start the upload. Check your connection.");
  }

  if (signRes.status === 401) {
    throw new Error("Your session has expired. Reload the page and sign in again.");
  }
  if (!signRes.ok) {
    throw new Error("The server rejected this upload. Check the file and try again.");
  }

  const { uploadUrl, publicUrl } = (await signRes.json()) as SignResponse;

  let putRes: Response;
  try {
    putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      // Deliberately NOT adminFetch — see the doc comment above. `credentials:
      // "omit"` is explicit (not relying on the cross-origin default) so this
      // never sends our session cookie to the storage host.
      credentials: "omit",
      headers: { "Content-Type": file.type },
    });
  } catch {
    throw new Error("Upload failed partway through. Check your connection and try again.");
  }

  if (!putRes.ok) {
    throw new Error("Storage rejected the upload. Try again.");
  }

  return publicUrl;
}
