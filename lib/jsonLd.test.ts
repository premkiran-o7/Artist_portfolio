import { describe, it, expect } from "vitest";
import { organizationName, personJsonLd, serializeJsonLd } from "./jsonLd";
import { getContent } from "./content";
import { SITE_URL } from "./site";

describe("organizationName", () => {
  it("drops the location that follows an em dash", () => {
    expect(organizationName("Movate (CSS Corp) — Hyderabad")).toBe("Movate (CSS Corp)");
  });

  it("leaves a company with no location untouched", () => {
    expect(organizationName("Movate")).toBe("Movate");
  });

  it("trims surrounding whitespace", () => {
    expect(organizationName("  Movate  ")).toBe("Movate");
  });
});

describe("serializeJsonLd", () => {
  it("escapes < so the payload cannot close the script tag early", () => {
    // The failure this guards: a "</script>" inside any string field ends the
    // block and dumps the rest of the JSON into the document as markup.
    const out = serializeJsonLd({ name: "</script><img onerror=alert(1)>" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    // Still valid JSON, and still the original string once parsed — the escape
    // must not corrupt the data it protects.
    expect(JSON.parse(out).name).toBe("</script><img onerror=alert(1)>");
  });

  it("round-trips ordinary content unchanged", () => {
    expect(JSON.parse(serializeJsonLd({ name: "Manish Ravalkol" }))).toEqual({
      name: "Manish Ravalkol",
    });
  });
});

describe("personJsonLd", () => {
  const ld = personJsonLd(getContent());
  const c = getContent();

  it("declares a schema.org Person", () => {
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Person");
  });

  it("lists every social profile in sameAs", () => {
    // sameAs is the field that makes a name search resolve to this page rather
    // than to a stranger — if a profile is missing here, that link is not made.
    expect(ld.sameAs).toEqual([
      c.socials.instagram,
      c.socials.youtube,
      c.socials.linkedin,
    ]);
  });

  it("uses absolute urls, which relative ones would silently break", () => {
    expect(ld.url).toBe(SITE_URL);
    expect(ld.image).toBe(`${SITE_URL}/portrait.jpg`);
  });

  it("omits the phone number", () => {
    // Deliberate: the number is already on the page as a tel: link, and putting
    // it in machine-readable markup only makes bulk harvesting easier without
    // helping the Person entity. See lib/jsonLd.ts.
    expect(ld).not.toHaveProperty("telephone");
  });

  it("carries the employer without its trailing location", () => {
    expect(ld.worksFor).toEqual({ "@type": "Organization", name: "Movate (CSS Corp)" });
  });

  it("serializes to valid JSON-LD", () => {
    expect(() => JSON.parse(serializeJsonLd(ld))).not.toThrow();
  });
});
