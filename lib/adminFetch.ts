/**
 * Single choke point for every request the admin panel makes to our own API.
 *
 * The backend requires two things that are trivial to forget at an individual call
 * site, each with an ugly failure mode:
 *
 *  - `credentials: "include"` — the admin session lives in the httpOnly
 *    `manish_admin` cookie. Without this, fetch() never attaches it and every
 *    "logged in" request looks logged out (401 from `require_admin`).
 *  - `X-Requested-With: fetch` — api/_lib/auth.py's `require_admin()` rejects any
 *    mutating request (anything but GET/HEAD/OPTIONS) missing this header with a
 *    403. It exists as CSRF defence: a forged cross-site <form> POST cannot set a
 *    custom header, so its presence proves the request came from this app's own
 *    JS, not a third-party page riding the visitor's cookie. Set unconditionally
 *    below (even on GETs, which the backend ignores it for) so there is no
 *    per-method branch that a future call site could get wrong.
 *
 * Every admin call site (Tasks 15-17, 23 — login, logout, and all dashboard CRUD)
 * should route through this function instead of calling fetch() directly, so both
 * requirements above live in exactly one place rather than being repeated, and
 * potentially forgotten, at every call site.
 *
 * `path` is relative to the API's fixed prefix: `adminFetch("/login", ...)` calls
 * `POST /api/py/login`.
 *
 * Scope: this wrapper talks to OUR backend only. The R2 upload flow (Task 16)
 * PUTs the file bytes directly to a presigned R2 URL — that request must NOT go
 * through adminFetch (no cookie, no CSRF header; R2 would reject the extra
 * headers it never signed for).
 */
export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-Requested-With", "fetch");
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`/api/py${path}`, { ...init, headers, credentials: "include" });
}
