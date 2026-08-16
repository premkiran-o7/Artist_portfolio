import { describe, it, expect } from "vitest";
import { monogram, pendingTeasers } from "./clients";

describe("pendingTeasers", () => {
  const rows = [
    { id: "a", is_live: false },
    { id: "b", is_live: true },
    { id: "c", is_live: false },
  ];

  it("drops rows that are already live (they belong in the main grid)", () => {
    expect(pendingTeasers(rows).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("returns an empty array when every row is live (the omit-the-section case)", () => {
    expect(pendingTeasers([{ id: "b", is_live: true }])).toEqual([]);
  });

  it("preserves input order", () => {
    expect(pendingTeasers(rows)[0].id).toBe("a");
  });
});

describe("monogram", () => {
  it("takes the first letter of the first and last word", () => {
    expect(monogram("Radiant Films")).toBe("RF");
  });

  it("uses the FIRST and LAST word, not the first two", () => {
    // Would be "TB" if the implementation just took initials[0] + initials[1].
    expect(monogram("The Bombay Canteen")).toBe("TC");
  });

  it("returns a single letter for a one-word name", () => {
    expect(monogram("Nike")).toBe("N");
  });

  it("uppercases", () => {
    expect(monogram("acme studio")).toBe("AS");
  });

  it("skips leading punctuation so a handle-like name still reads", () => {
    expect(monogram("@nike")).toBe("N");
  });

  it("uses digits when a word starts with one", () => {
    expect(monogram("24 Frames")).toBe("2F");
  });

  it("tolerates extra and surrounding whitespace", () => {
    expect(monogram("  Radiant   Films  ")).toBe("RF");
  });

  it("returns an empty string when there is no letter or digit at all", () => {
    // The card renders a plain plate in this case rather than a "?" that
    // would read as an error.
    expect(monogram("!!! ---")).toBe("");
    expect(monogram("   ")).toBe("");
  });

  it("keeps a whole astral character instead of half a surrogate pair", () => {
    // "𝒜" is U+1D49C, outside the BMP: name[0] would return a lone high
    // surrogate and render as a replacement glyph.
    expect(monogram("𝒜cme")).toBe(Array.from("𝒜")[0].toUpperCase());
    expect(Array.from(monogram("𝒜cme"))).toHaveLength(1);
  });
});
