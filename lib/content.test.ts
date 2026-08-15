import { describe, it, expect } from "vitest";
import { ContentSchema, getContent } from "./content";
import type { SkillLevel } from "./content";

describe("content", () => {
  it("parses the real content.json", () => {
    const c = getContent();
    expect(c.name).toBe("Manish");
    expect(c.bio).toHaveLength(3);
    expect(c.skills.length).toBeGreaterThan(0);
  });

  it("rejects a percentage skill level", () => {
    const bad = { level: 85, name: "AE", icon: "ae", mono: "AE" };
    expect(ContentSchema.shape.skills.safeParse([bad]).success).toBe(false);
  });

  it("rejects a skill missing its monogram", () => {
    const bad = { level: "Expert", name: "After Effects", icon: "ae" };
    expect(ContentSchema.shape.skills.safeParse([bad]).success).toBe(false);
  });

  it("rejects a bio that is not exactly three lines", () => {
    const r = ContentSchema.shape.bio.safeParse(["one", "two"]);
    expect(r.success).toBe(false);
  });

  it("exports SkillLevel as a usable type", () => {
    const level: SkillLevel = "Expert";
    // @ts-expect-error "Master" is not a valid skill level
    const bad: SkillLevel = "Master";
    expect(level).toBe("Expert");
    expect(bad).toBe("Master");
  });
});
