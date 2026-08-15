/**
 * True only if `url` is an absolute http(s) link whose host is
 * `instagram.com` or a subdomain of it (e.g. `www.instagram.com`).
 *
 * Used by ClientForm.tsx to validate the Instagram link before it's saved.
 * The brief calls this out explicitly: a wrong link here is invisible until
 * someone actually clicks it on the live site — there's no other feedback
 * loop, so client-side validation at entry time is the only defence.
 *
 * Hostname-based, not a substring/regex match on the whole URL: a check like
 * `url.includes("instagram.com")` would pass something like
 * `https://evil.example/?redirect=instagram.com`, which is not actually an
 * Instagram link at all. Comparing `new URL(url).hostname` closes that gap.
 * `endsWith(".instagram.com")` (with the leading dot) rather than a bare
 * `endsWith("instagram.com")` similarly refuses a host like
 * `evilinstagram.com`, which contains the string but isn't the domain.
 */
export function isInstagramUrl(url: string): boolean {
  if (!url?.trim()) return false;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return host === "instagram.com" || host.endsWith(".instagram.com");
}
