import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * Serves /robots.txt, which did not exist before (it 404'd).
 *
 * /admin is deliberately NOT disallowed here, even though it is the one part
 * of the site that must never be indexed. It already sends
 * `robots: { index: false, follow: false }` from app/admin/layout.tsx, and the
 * two mechanisms actively conflict: a Disallow stops a crawler fetching the
 * page at all, which means it never reads the noindex, and the bare URL can
 * still surface in results from an external link. Letting it be crawled so the
 * noindex is actually seen is the combination that guarantees it stays out.
 *
 * /api/ IS disallowed, because a JSON response has nowhere to put a noindex
 * meta tag — a rule here is the only lever available for those routes.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
