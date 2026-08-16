import { describe, it, expect } from "vitest";
import { SITE_URL, absoluteUrl } from "./site";

describe("SITE_URL", () => {
  it("is an absolute origin with no trailing slash", () => {
    // A trailing slash here turns every absoluteUrl() into a double-slashed
    // path, which is a different URL to a crawler than the one being served.
    expect(SITE_URL).toMatch(/^https:\/\//);
    expect(SITE_URL.endsWith("/")).toBe(false);
  });
});

describe("absoluteUrl", () => {
  it("joins with exactly one slash whether or not the path has a leading one", () => {
    expect(absoluteUrl("/portrait.jpg")).toBe(`${SITE_URL}/portrait.jpg`);
    expect(absoluteUrl("portrait.jpg")).toBe(`${SITE_URL}/portrait.jpg`);
  });

  it("collapses a repeated leading slash rather than emitting a protocol-relative path", () => {
    expect(absoluteUrl("//sitemap.xml")).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
