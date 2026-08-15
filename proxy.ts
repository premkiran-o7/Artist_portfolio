import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "manish_admin";

/**
 * Named proxy.ts, not middleware.ts: Next.js 16 deprecated the `middleware`
 * file convention and renamed it to `proxy` (same behaviour, new name/export —
 * see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * This project pins next@16.3.1, so this file is the current convention, not a
 * stylistic choice.
 *
 * Redirects a logged-out visitor away from /admin/dashboard back to /admin, so
 * they see the login form instead of a dashboard shell with nothing behind it.
 *
 * THIS IS UX ONLY, NOT SECURITY. Checking that a cookie merely exists proves
 * nothing about it — it could be expired, forged, or already revoked. The real
 * gate is `require_admin` in api/_lib/auth.py, which verifies the JWT's
 * signature and expiry on every mutating request. Nothing here should ever be
 * treated as a substitute for that check.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/admin/dashboard/:path*",
};
