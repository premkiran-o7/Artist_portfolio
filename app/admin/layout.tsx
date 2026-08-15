import type { Metadata } from "next";

/**
 * Shared by every route under /admin (the login form and, from Task 16, the
 * dashboard): neither should ever be indexed. This is a courtesy to search
 * engines, not a security control — the real access gate is `require_admin` in
 * api/_lib/auth.py, which checks the session cookie's JWT signature on every
 * mutating request regardless of what any crawler sees.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
