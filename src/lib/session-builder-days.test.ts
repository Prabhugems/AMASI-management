import { describe, it, expect } from "vitest"
import {
  buildDays,
  defaultDay,
  describeOutOfRange,
  eventDays,
  type DatedBlock,
} from "./session-builder-days"

// The event that produced the bug: two days, and a block created on 27 Aug.
const QA = { start_date: "2026-08-06", end_date: "2026-08-07" }

const block = (id: string, session_date: string | null): DatedBlock => ({ id, session_date })

describe("eventDays", () => {
  it("lists every day of the event inclusive", () => {
    expect(eventDays(QA)).toEqual(["2026-08-06", "2026-08-07"])
  })

  it("handles a single-day event", () => {
    expect(eventDays({ start_date: "2026-08-06", end_date: "2026-08-06" })).toEqual(["2026-08-06"])
  })

  it("returns nothing when the window is unusable", () => {
    expect(eventDays({ start_date: null, end_date: "2026-08-07" })).toEqual([])
    expect(eventDays({ start_date: "2026-08-09", end_date: "2026-08-07" })).toEqual([])
    expect(eventDays({ start_date: "nonsense", end_date: "2026-08-07" })).toEqual([])
  })

  it("refuses an absurd range rather than emitting thousands of tabs", () => {
    expect(eventDays({ start_date: "2026-01-01", end_date: "2027-01-01" })).toEqual([])
  })
})

describe("buildDays", () => {
  it("shows the event's days even when nothing is scheduled", () => {
    // The original bug: an empty event had no tabs at all, so the first block
    // had to be dated from memory.
    const days = buildDays(QA, [])
    expect(days.map((d) => [d.label, d.date, d.blockCount])).toEqual([
      ["Day 1", "2026-08-06", 0],
      ["Day 2", "2026-08-07", 0],
    ])
  })

  it("counts blocks per day", () => {
    const days = buildDays(QA, [block("a", "2026-08-06"), block("b", "2026-08-06")])
    expect(days[0].blockCount).toBe(2)
    expect(days[1].blockCount).toBe(0)
  })

  it("surfaces an out-of-range block instead of hiding it", () => {
    // Exactly the observed case: a block on 27 Aug in a 6-7 Aug event.
    const days = buildDays(QA, [block("a", "2026-08-06"), block("stray", "2026-08-27")])
    const stray = days.find((d) => d.date === "2026-08-27")
    expect(stray).toMatchObject({ label: "Outside the event", withinEvent: false, blockCount: 1 })
  })

  it("puts the event's own days before any stray", () => {
    // The stray sorted first alphabetically would otherwise become the default
    // tab and hide everything else — that is how the block appeared to vanish.
    const days = buildDays(QA, [block("stray", "2026-07-01"), block("a", "2026-08-06")])
    expect(days.map((d) => d.date)).toEqual(["2026-08-06", "2026-08-07", "2026-07-01"])
  })

  it("gives undated blocks somewhere to live", () => {
    const days = buildDays(QA, [block("a", null)])
    expect(days.at(-1)).toMatchObject({ date: null, label: "Unscheduled", blockCount: 1 })
  })

  it("adds no Unscheduled tab when nothing is undated", () => {
    expect(buildDays(QA, [block("a", "2026-08-06")]).some((d) => d.date === null)).toBe(false)
  })

  it("still shows blocks when the event has no dates of its own", () => {
    const days = buildDays({ start_date: null, end_date: null }, [block("a", "2026-08-06")])
    expect(days).toHaveLength(1)
    expect(days[0]).toMatchObject({ date: "2026-08-06", withinEvent: false })
  })
})

describe("defaultDay", () => {
  it("opens on the event's first day, not the earliest block", () => {
    const days = buildDays(QA, [block("stray", "2026-07-01")])
    expect(defaultDay(days)).toBe("2026-08-06")
  })

  it("falls back to the only tab there is when the event has no dates", () => {
    const days = buildDays({ start_date: null, end_date: null }, [block("a", "2026-09-09")])
    expect(defaultDay(days)).toBe("2026-09-09")
  })

  it("is null when there is nothing at all", () => {
    expect(defaultDay(buildDays({ start_date: null, end_date: null }, []))).toBeNull()
  })
})

describe("describeOutOfRange", () => {
  it("names the event's range when a block falls outside it", () => {
    expect(describeOutOfRange(QA, "2026-08-27")).toBe(
      "This is outside the event, which runs 6 Aug 2026 – 7 Aug 2026."
    )
  })

  it("says nothing for a date inside the event", () => {
    expect(describeOutOfRange(QA, "2026-08-06")).toBe("")
    expect(describeOutOfRange(QA, "2026-08-07")).toBe("")
  })

  it("says nothing when there is no date or no window to judge against", () => {
    expect(describeOutOfRange(QA, null)).toBe("")
    expect(describeOutOfRange({ start_date: null, end_date: null }, "2026-08-27")).toBe("")
  })
})
