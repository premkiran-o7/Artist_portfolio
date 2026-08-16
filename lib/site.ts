/**
 * The public origin of the site, with no trailing slash.
 *
 * Everything that has to be an ABSOLUTE url lives downstream of this constant:
 * Open Graph images (a relative og:image is ignored by every crawler),
 * JSON-LD `url`/`image`, the canonical link, robots.txt's Sitemap: line and
 * sitemap.xml's <loc>s. Getting it wrong doesn't break the build or the page —
 * it silently produces link previews that don't load and a canonical pointing
 * at the wrong host, which is exactly the kind of failure nobody notices.
 *
 * Overridable via NEXT_PUBLIC_SITE_URL so that pointing the site at a real
 * domain is one Vercel environment variable and a redeploy, with no code
 * change. The fallback is the current production host rather than
 * VERCEL_PROJECT_PRODUCTION_URL: that variable is also set on preview
 * deployments, where it still resolves to the production host, so relying on
 * it would make previews advertise production URLs as their own canonical.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://manish-portfolio-pied.vercel.app"
).replace(/\/+$/, "");

/** `path` resolved against SITE_URL. Leading slash optional. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}/${path.replace(/^\/+/, "")}`;
}
