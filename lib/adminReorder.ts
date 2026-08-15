/**
 * Pure helper for admin list reordering, shared by the Videos tab
 * (components/admin/RowList.tsx) and the Clients tab
 * (components/admin/ClientList.tsx).
 *
 * Swapping just the two `sort_order` values in place looks correct but is a
 * silent no-op whenever the two rows being swapped already share the same
 * value — which is the common case, since every row is created with
 * `sort_order: 0` and nothing changes it until the first reorder. Task 16
 * hit this live: two freshly-added videos both at `sort_order: 0`, and
 * clicking "up" visibly did nothing.
 *
 * The fix, used everywhere in this dashboard that reorders a list: never
 * swap values — swap the two rows' *positions* in the array, then have the
 * caller re-index the WHOLE array to 0..N-1 before PATCHing. That always
 * produces a distinct, strictly increasing sequence regardless of what the
 * starting values were, so the arrows never appear to do nothing.
 *
 * Returns `null` when `index + direction` would move past either end of the
 * list — callers should treat that as a no-op (mirroring the disabled state
 * of the boundary arrow button) rather than firing any request.
 */
export function moveAndReindex<T>(rows: T[], index: number, direction: -1 | 1): T[] | null {
  const target = index + direction;
  if (target < 0 || target >= rows.length) return null;

  const reordered = rows.slice();
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return reordered;
}

/**
 * The subset of `moveAndReindex`'s output that actually needs a PATCH: rows
 * whose stored `sort_order` differs from the index they now sit at.
 *
 * Re-indexing the whole array is what makes reordering correct (see above),
 * but PATCHing the whole array is not — it fires N requests for a change that
 * moved two rows, so a category of a dozen videos costs a dozen round-trips
 * per arrow click, and each extra request is another chance to fail partway
 * and leave `sort_order` inconsistent.
 *
 * The first move in a never-reordered list genuinely does need to touch most
 * rows, because they all still sit at the default `sort_order: 0` and only
 * one of them can keep it. That cost is unavoidable and one-time: once the
 * list carries a distinct 0..N-1 sequence, every later arrow click resolves
 * to exactly the two rows that swapped.
 */
export function reindexDelta<T extends { sort_order: number }>(
  reordered: T[]
): { row: T; sort_order: number }[] {
  return reordered
    .map((row, sort_order) => ({ row, sort_order }))
    .filter(({ row, sort_order }) => row.sort_order !== sort_order);
}
