// Paging past PostgREST's response cap.
//
// A Supabase `.select()` returns at most `db.max-rows` (1000 by default) and
// says nothing about having stopped early. That silence has already cost this
// project once: the halls/tracks backfill scripts looked correct on every event
// under the cap and left exactly 195 sessions unlinked on the one archived
// AMASICON event with 1,195 rows — caught only by a DB-wide sanity query
// afterwards, not by the scripts' own reported totals (see CLAUDE.md,
// 2026-07-31).
//
// The same hazard applies to any list endpoint over a table that can exceed the
// cap for a single event: `sessions` (1,195 on one event today), `talks` and
// `session_role_requirements` (several per block, so they grow faster than
// blocks do). Reach for this rather than assuming an event is small.
//
// The equivalent helper already existed in four separate scripts. This is the
// one importable from application code.

const PAGE_SIZE = 1000

/**
 * Minimal shape of a PostgREST query builder — enough to page it, without
 * dragging in Supabase's generics. `.range()` returns a new builder, so the
 * query passed in is not consumed and can be built once by the caller.
 */
export interface RangeableQuery<T> {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }>
}

/**
 * Read every row a query matches, a page at a time, stopping on the first short
 * page.
 *
 * Throws on a query error rather than returning a partial list: a caller that
 * silently receives half a programme is exactly the failure this exists to
 * prevent.
 */
export async function fetchAllPages<T>(query: RangeableQuery<T>): Promise<T[]> {
  const out: T[] = []
  let from = 0

  // Bounded so a misbehaving query cannot spin forever. 100 pages is 100k rows,
  // far beyond any single event, and hitting it means something is wrong.
  for (let page = 0; page < 100; page++) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break

    out.push(...data)

    // A short page means this was the last one. A full page is ambiguous, so
    // we ask again — the extra round trip is the price of not guessing.
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return out
}
