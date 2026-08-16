import type { Content } from "./content";
import { SITE_URL, absoluteUrl } from "./site";

/**
 * schema.org `Person` JSON-LD for the home page.
 *
 * The goal is narrow and worth being honest about: this will not make the site
 * rank for "video editor hyderabad" — that query belongs to agencies and
 * freelance marketplaces with real backlink profiles. What it does is win the
 * one query that matters, "Manish Ravalkol", by telling a search engine that
 * this page, his Instagram, his YouTube channel and his LinkedIn are all the
 * same person. `sameAs` is the field that does that work; everything else is
 * supporting detail.
 *
 * Deliberately NOT included: `telephone`. The number is already on the page as
 * a tel: link, so this isn't hiding anything — but a phone number in JSON-LD is
 * markedly easier to harvest at scale than one in markup, and it buys nothing
 * a Person entity needs. Email is included because a mailto is how a client
 * actually starts a conversation.
 */
export type PersonJsonLd = Record<string, unknown>;

/**
 * Company strings in content.json carry their location after an em dash
 * ("Movate (CSS Corp) — Hyderabad") because that reads correctly in the
 * experience timeline. An Organization's `name` should be the organisation
 * alone, so the location is split off here rather than being duplicated into
 * content.json as a second field nobody would remember to keep in sync.
 */
export function organizationName(company: string): string {
  return company.split("—")[0].trim();
}

/**
 * JSON for embedding inside a <script type="application/ld+json">.
 *
 * The `<` escape is not optional. Anywhere a "<" appears in the data, a literal
 * "</script" in the output would close the tag early and drop the remainder of
 * the JSON into the document as markup. content.json is ours today, but this
 * function has no way to know that, and the escape costs nothing — "<" is
 * the same character to a JSON parser and inert to an HTML one.
 */
export function serializeJsonLd(data: PersonJsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function personJsonLd(c: Content): PersonJsonLd {
  const job = c.experience[0];
  const school = c.education[0];

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: c.name,
    jobTitle: c.tagline,
    description: c.bio.join(" "),
    url: SITE_URL,
    image: absoluteUrl("/portrait.jpg"),
    email: `mailto:${c.email}`,
    // The whole point of the markup — see the doc comment above.
    sameAs: [c.socials.instagram, c.socials.youtube, c.socials.linkedin],
    knowsAbout: c.skills.map((s) => s.name),
    ...(job && {
      worksFor: { "@type": "Organization", name: organizationName(job.company) },
    }),
    ...(school && {
      alumniOf: { "@type": "EducationalOrganization", name: school.institution },
    }),
  };
}
