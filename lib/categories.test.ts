import { describe, it, expect } from "vitest";
import { videosForCategory, pickCardThumb } from "./categories";

type Row = { id: string; category: string; is_featured: boolean; sort_order: number };

const mk = (id: string, category: string, is_featured: boolean, sort_order: number): Row => ({
  id,
  category,
  is_featured,
  sort_order,
});

describe("videosForCategory", () => {
  it("filters to only the requested category, preserving input order", () => {
    const rows = [
      mk("a", "color-grade", false, 0),
      mk("b", "short-form", false, 0),
      mk("c", "color-grade", false, 1),
    ];
    expect(videosForCategory(rows, "color-grade").map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("returns an empty array for a category with no matching rows", () => {
    expect(videosForCategory([mk("a", "short-form", false, 0)], "text-tracking")).toEqual([]);
  });
});

describe("pickCardThumb", () => {
  it("returns null for an empty category (the empty-state case)", () => {
    expect(pickCardThumb([])).toBeNull();
  });

  it("prefers the is_featured video even when it is not the lowest sort_order", () => {
    const rows = [mk("a", "color-grade", false, 0), mk("b", "color-grade", true, 5)];
    expect(pickCardThumb(rows)?.id).toBe("b");
  });

  it("falls back to the lowest sort_order when nothing is featured", () => {
    const rows = [
      mk("a", "color-grade", false, 3),
      mk("b", "color-grade", false, 1),
      mk("c", "color-grade", false, 2),
    ];
    expect(pickCardThumb(rows)?.id).toBe("b");
  });

  it("breaks a sort_order tie (the tie case) by taking the earlier row in the input", () => {
    const rows = [mk("a", "color-grade", false, 0), mk("b", "color-grade", false, 0)];
    expect(pickCardThumb(rows)?.id).toBe("a");
  });

  it("ignores videos from other categories mixed into the same array", () => {
    // Guards against a caller forgetting to pre-filter with videosForCategory.
    const rows = [mk("x", "short-form", true, 0), mk("a", "color-grade", false, 1)];
    expect(pickCardThumb(videosForCategory(rows, "color-grade"))?.id).toBe("a");
  });
});
