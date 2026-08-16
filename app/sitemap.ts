import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Serves /sitemap.xml, which did not exist before (it 404'd).
 *
 * The public site is a single page — every section is an anchor on it, and
 * fragment URLs do not belong in a sitemap — so this has exactly one entry.
 * That is still worth serving: it is the discovery hint a crawler is pointed
 * at from robots.txt, and it is what Search Console asks for when the site is
 * eventually submitted.
 *
 * `lastModified` is build time, which for this site is genuinely when the page
 * last changed for content.json edits. Work added through the admin panel
 * revalidates the page without a deploy, so the date can lag by up to a
 * release in that case — a crawler treats it as a hint, not a promise, and the
 * alternative (tracking the newest row across four tables) would be a database
 * round trip inside a route that must never fail.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
