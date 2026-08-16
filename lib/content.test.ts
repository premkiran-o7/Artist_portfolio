import { describe, it, expect } from "vitest";
import { ContentSchema, getContent } from "./content";
import type { SkillLevel } from "./content";

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

  it("accepts a percentage skill level", () => {
    const ok = { level: 85, name: "CapCut", icon: "capcut", mono: "CC" };
    expect(ContentSchema.shape.skills.safeParse([ok]).success).toBe(true);
  });

  it("rejects a non-numeric skill level", () => {
    // Guards the old design: levels used to be the strings Expert/Advanced/Working.
    const bad = { level: "Expert", name: "CapCut", icon: "capcut", mono: "CC" };
    expect(ContentSchema.shape.skills.safeParse([bad]).success).toBe(false);
  });

  it("rejects a skill level outside 0-100", () => {
    const mk = (level: number) => [{ level, name: "X", icon: "x", mono: "X" }];
    expect(ContentSchema.shape.skills.safeParse(mk(101)).success).toBe(false);
    expect(ContentSchema.shape.skills.safeParse(mk(-1)).success).toBe(false);
    expect(ContentSchema.shape.skills.safeParse(mk(0)).success).toBe(true);
    expect(ContentSchema.shape.skills.safeParse(mk(100)).success).toBe(true);
  });

  it("rejects a skill missing its monogram", () => {
    const bad = { level: "Expert", name: "After Effects", icon: "ae" };
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

  it("exports SkillLevel as a usable type", () => {
    const level: SkillLevel = 85;
    // @ts-expect-error a skill level is a number, not a string
    const bad: SkillLevel = "85";
    expect(level).toBe(85);
    expect(bad).toBe("85");
  });
});
