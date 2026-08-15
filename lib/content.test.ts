import { describe, it, expect } from "vitest";
import { ContentSchema, getContent } from "./content";

describe("content", () => {
  it("parses the real content.json", () => {
    const c = getContent();
    expect(c.name).toBe("Manish");
    expect(c.bio).toHaveLength(3);
    expect(c.skills.length).toBeGreaterThan(0);
  });

  it("rejects a percentage skill level", () => {
    const bad = { level: 85, name: "AE", icon: "ae" };
    expect(ContentSchema.shape.skills.safeParse([bad]).success).toBe(false);
  });

  it("rejects a bio that is not exactly three lines", () => {
    const r = ContentSchema.shape.bio.safeParse(["one", "two"]);
    expect(r.success).toBe(false);
  });
});
