import { describe, it, expect } from "vitest";
import { moveAndReindex, reindexDelta } from "./adminReorder";

type Row = { id: string; sort_order: number };

const ROWS: Row[] = [
  { id: "a", sort_order: 0 },
  { id: "b", sort_order: 0 }, // tied with "a" — the exact case that broke a naive swap
  { id: "c", sort_order: 2 },
];

describe("moveAndReindex", () => {
  it("returns null when moving the first row up (would go before index 0)", () => {
    expect(moveAndReindex(ROWS, 0, -1)).toBeNull();
  });

  it("returns null when moving the last row down (would go past the end)", () => {
    expect(moveAndReindex(ROWS, ROWS.length - 1, 1)).toBeNull();
  });

  it("swaps row position, not the sort_order field, on a valid move", () => {
    const result = moveAndReindex(ROWS, 1, -1);
    expect(result).not.toBeNull();
    // Positions swapped...
    expect(result!.map((r) => r.id)).toEqual(["b", "a", "c"]);
    // ...but the objects themselves are untouched; re-indexing sort_order is
    // the caller's job (mapping the returned array to 0..N-1), not this
    // function's. This is what makes the tied-sort_order case resolve: the
    // caller re-indexes ["b","a","c"] to sort_order 0,1,2 — a distinct
    // sequence — even though "a" and "b" started tied at 0.
    expect(result![0]).toBe(ROWS[1]);
    expect(result![1]).toBe(ROWS[0]);
  });

  it("does not mutate the input array", () => {
    const original = ROWS.map((r) => ({ ...r }));
    moveAndReindex(ROWS, 1, 1);
    expect(ROWS).toEqual(original);
  });
});

describe("reindexDelta", () => {
  it("returns only the rows whose sort_order no longer matches their index", () => {
    // An already-consecutive list where exactly two adjacent rows swapped:
    // only those two moved, so only those two should be PATCHed.
    const ordered: Row[] = [
      { id: "a", sort_order: 0 },
      { id: "b", sort_order: 1 },
      { id: "c", sort_order: 2 },
      { id: "d", sort_order: 3 },
    ];
    const moved = moveAndReindex(ordered, 2, -1)!; // a, c, b, d

    expect(reindexDelta(moved)).toEqual([
      { row: ordered[2], sort_order: 1 },
      { row: ordered[1], sort_order: 2 },
    ]);
  });

  it("returns every row that has to change on the first move of a tied list", () => {
    // The unavoidable case: three rows all at the default sort_order 0. Only
    // the one that lands at index 0 can keep its value; the other two must be
    // written. This is why the delta filter is a saving on *subsequent* moves,
    // not a claim that a move never touches more than two rows.
    const tied: Row[] = [
      { id: "a", sort_order: 0 },
      { id: "b", sort_order: 0 },
      { id: "c", sort_order: 0 },
    ];
    const moved = moveAndReindex(tied, 1, -1)!; // b, a, c

    expect(reindexDelta(moved)).toEqual([
      { row: tied[0], sort_order: 1 },
      { row: tied[2], sort_order: 2 },
    ]);
  });

  it("returns nothing when the list is already correctly indexed", () => {
    const ordered: Row[] = [
      { id: "a", sort_order: 0 },
      { id: "b", sort_order: 1 },
    ];
    expect(reindexDelta(ordered)).toEqual([]);
  });
});
