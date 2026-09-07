import { describe, it, expect } from "vitest";
import { ContentSchema, getContent } from "./content";

describe("content", () => {
  it("parses the real content.json", () => {
    // Asserts structure, not content. An earlier version hardcoded the name, which broke
    // the moment real data landed — a schema test should not care what the name is.
    const c = getContent();
    expect(c.name.length).toBeGreaterThan(0);
    expect(c.email).toContain("@");
    expect(c.bio.length).toBeGreaterThan(0);
    expect(c.bio.length).toBeLessThanOrEqual(3);
    expect(c.skills.length).toBeGreaterThan(0);
  });

  it("accepts a skill without a proficiency level", () => {
    // Levels were removed at Manish's request — tools are listed plainly now.
    const ok = { name: "CapCut", icon: "capcut", mono: "CC" };
    expect(ContentSchema.shape.skills.safeParse([ok]).success).toBe(true);
  });

  it("rejects a skill missing its monogram", () => {
    const bad = { name: "After Effects", icon: "ae" };
    expect(ContentSchema.shape.skills.safeParse([bad]).success).toBe(false);
  });

  it("accepts a bio of one to three lines", () => {
    expect(ContentSchema.shape.bio.safeParse(["one"]).success).toBe(true);
    expect(ContentSchema.shape.bio.safeParse(["one", "two"]).success).toBe(true);
    expect(ContentSchema.shape.bio.safeParse(["one", "two", "three"]).success).toBe(true);
  });

  it("rejects an empty bio or one past the hero's three-line ceiling", () => {
    expect(ContentSchema.shape.bio.safeParse([]).success).toBe(false);
    expect(ContentSchema.shape.bio.safeParse(["a", "b", "c", "d"]).success).toBe(false);
  });
});
