import { describe, it, expect } from "vitest"
import { fetchAllPages, type RangeableQuery } from "./fetch-all-pages"

/** A fake PostgREST builder that caps each response at 1000, like the real one. */
function fakeQuery(totalRows: number, opts: { error?: unknown } = {}): {
  query: RangeableQuery<{ i: number }>
  calls: Array<[number, number]>
} {
  const calls: Array<[number, number]> = []
  const query: RangeableQuery<{ i: number }> = {
    range(from, to) {
      calls.push([from, to])
      if (opts.error) return Promise.resolve({ data: null, error: opts.error })
      const slice = Array.from({ length: Math.max(0, Math.min(to, totalRows - 1) - from + 1) }, (_, n) => ({
        i: from + n,
      }))
      return Promise.resolve({ data: slice, error: null })
    },
  }
  return { query, calls }
}

describe("fetchAllPages", () => {
  it("returns everything past the 1000-row cap", async () => {
    // The shape of the real incident: 1,195 rows on one event, of which a
    // single unpaged read would have returned 1,000 and said nothing.
    const { query } = fakeQuery(1195)
    const rows = await fetchAllPages(query)
    expect(rows).toHaveLength(1195)
    expect(rows[0].i).toBe(0)
    expect(rows[1194].i).toBe(1194)
  })

  it("stops on the first short page", async () => {
    const { query, calls } = fakeQuery(150)
    expect(await fetchAllPages(query)).toHaveLength(150)
    expect(calls).toEqual([[0, 999]])
  })

  it("asks again after an exactly-full page, because a full page is ambiguous", async () => {
    const { query, calls } = fakeQuery(1000)
    expect(await fetchAllPages(query)).toHaveLength(1000)
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it("handles an empty table", async () => {
    const { query } = fakeQuery(0)
    expect(await fetchAllPages(query)).toEqual([])
  })

  it("throws rather than returning a partial list", async () => {
    // Half a programme returned as if whole is the failure being prevented.
    const { query } = fakeQuery(500, { error: new Error("boom") })
    await expect(fetchAllPages(query)).rejects.toThrow("boom")
  })

  it("is bounded, so a misbehaving query cannot spin forever", async () => {
    // A builder that always returns a full page would otherwise never finish.
    let calls = 0
    const runaway: RangeableQuery<{ i: number }> = {
      range() {
        calls++
        return Promise.resolve({
          data: Array.from({ length: 1000 }, (_, n) => ({ i: n })),
          error: null,
        })
      },
    }
    const rows = await fetchAllPages(runaway)
    expect(calls).toBe(100)
    expect(rows).toHaveLength(100_000)
  })
})
