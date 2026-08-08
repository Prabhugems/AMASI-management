import { describe, it, expect } from "vitest"
import {
  buildTimeline,
  computeFit,
  describeFit,
  distributeEvenly,
  durationOf,
  inRunningOrder,
  isAnchor,
  setDuration,
  setDuration as retime,
  toClock,
  toMinutes,
  type TimedTalk,
} from "./session-timeline"

// The live AMASI sheet this is designed against: 09:00–16:00, with LUNCH nailed
// to 13:00–13:45 and a 10:45–11:00 gap nobody had noticed.
const BLOCK = { start_time: "09:00", end_time: "16:00" }

const talk = (id: string, start: string | null, end: string | null, over: Partial<TimedTalk> = {}): TimedTalk => ({
  id,
  start_time: start,
  end_time: end,
  talk_type: "talk",
  display_order: 0,
  ...over,
})

const lunch = (over: Partial<TimedTalk> = {}) =>
  talk("lunch", "13:00", "13:45", { talk_type: "break", ...over })

describe("time helpers", () => {
  it("round-trips a clock time", () => {
    expect(toMinutes("09:30")).toBe(570)
    expect(toClock(570)).toBe("09:30")
    expect(toClock(0)).toBe("00:00")
  })

  it("wraps rather than emitting an impossible hour", () => {
    expect(toClock(1500)).toBe("01:00")
    expect(toClock(-30)).toBe("23:30")
  })

  it("treats a break as an anchor and a talk as not", () => {
    expect(isAnchor(lunch())).toBe(true)
    expect(isAnchor(talk("t", "09:00", "09:20"))).toBe(false)
  })

  it("gives no duration to an untimed or inverted row", () => {
    expect(durationOf(talk("t", null, null))).toBeNull()
    expect(durationOf(talk("t", "10:00", "09:00"))).toBeNull()
    expect(durationOf(talk("t", "09:00", "09:20"))).toBe(20)
  })
})

describe("inRunningOrder", () => {
  it("orders by display_order before time", () => {
    const out = inRunningOrder([
      talk("b", "09:00", "09:10", { display_order: 1 }),
      talk("a", "10:00", "10:10", { display_order: 0 }),
    ])
    expect(out.map((t) => t.id)).toEqual(["a", "b"])
  })

  it("puts untimed rows after timed ones at the same order", () => {
    const out = inRunningOrder([talk("none", null, null), talk("timed", "09:00", "09:10")])
    expect(out.map((t) => t.id)).toEqual(["timed", "none"])
  })
})

describe("computeFit", () => {
  it("measures a partly filled session", () => {
    const fit = computeFit(BLOCK, [talk("a", "09:00", "09:10"), talk("b", "09:10", "09:30")])
    expect(fit).toMatchObject({ blockMinutes: 420, plannedMinutes: 30, freeMinutes: 390, overflowMinutes: 0 })
  })

  it("counts two parallel talks once, not twice", () => {
    // Two screens running the same slot must not make the session look full.
    const fit = computeFit(BLOCK, [talk("a", "09:00", "10:00"), talk("b", "09:00", "10:00")])
    expect(fit.plannedMinutes).toBe(60)
    expect(fit.freeMinutes).toBe(360)
  })

  it("reports time running past the session's end", () => {
    const fit = computeFit(BLOCK, [talk("a", "15:30", "16:30")])
    expect(fit.overflowMinutes).toBe(30)
  })

  it("counts untimed rows separately from free time", () => {
    const fit = computeFit(BLOCK, [talk("a", null, null)])
    expect(fit.untimedCount).toBe(1)
    expect(fit.plannedMinutes).toBe(0)
  })

  it("copes with a session that has no times of its own", () => {
    const fit = computeFit({ start_time: null, end_time: null }, [talk("a", "09:00", "09:20")])
    expect(fit.blockMinutes).toBe(0)
    expect(describeFit(fit)).toBe("20m planned")
  })
})

describe("describeFit", () => {
  it("reads as a sentence a coordinator can act on", () => {
    const fit = computeFit(BLOCK, [talk("a", "09:00", "15:45")])
    expect(describeFit(fit)).toBe("6h 45m of 7h · 15m free")
  })

  it("names an overrun", () => {
    expect(describeFit(computeFit(BLOCK, [talk("a", "09:00", "16:30")]))).toContain("30m over")
  })

  it("says nothing about an untouched session", () => {
    expect(describeFit(computeFit({ start_time: null, end_time: null }, []))).toBe("")
  })
})

describe("buildTimeline", () => {
  it("makes an unaccounted gap a segment of its own", () => {
    // The 10:45–11:00 hole a table hides.
    const segs = buildTimeline({ start_time: "10:00", end_time: "11:00" }, [
      talk("a", "10:00", "10:45"),
    ])
    expect(segs.map((s) => [s.kind, s.start, s.end])).toEqual([
      ["talk", "10:00", "10:45"],
      ["gap", "10:45", "11:00"],
    ])
  })

  it("sizes segments proportionally so the bar reads at a glance", () => {
    const segs = buildTimeline({ start_time: "10:00", end_time: "11:00" }, [
      talk("a", "10:00", "10:30"),
      talk("b", "10:30", "11:00"),
    ])
    expect(segs.map((s) => s.widthPct)).toEqual([50, 50])
    expect(segs.map((s) => s.leftPct)).toEqual([0, 50])
  })

  it("marks a break distinctly from a talk", () => {
    const segs = buildTimeline({ start_time: "13:00", end_time: "13:45" }, [lunch()])
    expect(segs[0].kind).toBe("break")
  })

  it("shows an overrun rather than clipping it", () => {
    const segs = buildTimeline({ start_time: "15:00", end_time: "16:00" }, [
      talk("a", "15:00", "16:30"),
    ])
    expect(segs.map((s) => s.kind)).toEqual(["talk", "overflow"])
    expect(segs[1].minutes).toBe(30)
  })

  it("returns nothing for a session with no span", () => {
    expect(buildTimeline({ start_time: null, end_time: null }, [talk("a", "09:00", "10:00")])).toEqual([])
  })
})

describe("setDuration with ripple", () => {
  const run = [
    talk("t1", "09:00", "09:20", { display_order: 0 }),
    talk("t2", "09:20", "09:40", { display_order: 1 }),
    talk("t3", "09:40", "10:00", { display_order: 2 }),
  ]

  it("moves everything after the changed row", () => {
    // The operation used on every edit: a speaker asks for five more minutes.
    const { changes } = setDuration(BLOCK, run, "t1", 25)
    expect(changes).toEqual([
      { id: "t1", start_time: "09:00", end_time: "09:25" },
      { id: "t2", start_time: "09:25", end_time: "09:45" },
      { id: "t3", start_time: "09:45", end_time: "10:05" },
    ])
  })

  it("shortens and pulls the rest back", () => {
    const { changes } = setDuration(BLOCK, run, "t1", 10)
    expect(changes[1]).toEqual({ id: "t2", start_time: "09:10", end_time: "09:30" })
  })

  it("touches only the one row when ripple is off", () => {
    const { changes } = setDuration(BLOCK, run, "t1", 25, { ripple: false })
    expect(changes).toHaveLength(1)
  })

  it("refuses to move an anchor, and says how far it overshot", () => {
    // LUNCH must not drift to 13:12 because a morning talk grew. The
    // coordinator is told and decides.
    const withLunch = [
      talk("t1", "12:00", "12:30", { display_order: 0 }),
      lunch({ display_order: 1 }),
      talk("t3", "13:45", "14:05", { display_order: 2 }),
    ]
    const res = setDuration(BLOCK, withLunch, "t1", 72)
    expect(res.blockedBy).toBe("lunch")
    expect(res.overflowMinutes).toBe(12)
    expect(res.changes.map((c) => c.id)).toEqual(["t1"])
  })

  it("reports running past the session's end", () => {
    const late = [talk("t1", "15:00", "15:30", { display_order: 0 })]
    expect(setDuration(BLOCK, late, "t1", 90).overflowMinutes).toBe(30)
  })

  it("steps over an untimed row rather than inventing a time for it", () => {
    const mixed = [
      talk("t1", "09:00", "09:20", { display_order: 0 }),
      talk("blank", null, null, { display_order: 1 }),
      talk("t3", "09:40", "10:00", { display_order: 2 }),
    ]
    const { changes } = setDuration(BLOCK, mixed, "t1", 30)
    expect(changes.map((c) => c.id)).toEqual(["t1", "t3"])
    expect(changes[1].start_time).toBe("09:30")
  })

  it("ignores a nonsensical duration", () => {
    expect(retime(BLOCK, run, "t1", 0).changes).toEqual([])
    expect(retime(BLOCK, run, "missing", 20).changes).toEqual([])
  })
})

describe("distributeEvenly", () => {
  it("splits an empty session equally", () => {
    const three = [
      talk("a", null, null, { display_order: 0 }),
      talk("b", null, null, { display_order: 1 }),
      talk("c", null, null, { display_order: 2 }),
    ]
    const out = distributeEvenly({ start_time: "09:00", end_time: "10:00" }, three)
    expect(out).toEqual([
      { id: "a", start_time: "09:00", end_time: "09:20" },
      { id: "b", start_time: "09:20", end_time: "09:40" },
      { id: "c", start_time: "09:40", end_time: "10:00" },
    ])
  })

  it("splits each run between anchors, not across them", () => {
    // Splitting the whole session evenly would walk talks straight through
    // lunch — arithmetically simpler and operationally useless.
    const day = [
      talk("m1", null, null, { display_order: 0 }),
      talk("m2", null, null, { display_order: 1 }),
      lunch({ display_order: 2 }),
      talk("a1", null, null, { display_order: 3 }),
    ]
    const out = distributeEvenly({ start_time: "12:00", end_time: "14:45" }, day)
    expect(out).toEqual([
      { id: "m1", start_time: "12:00", end_time: "12:30" },
      { id: "m2", start_time: "12:30", end_time: "13:00" },
      { id: "a1", start_time: "13:45", end_time: "14:45" },
    ])
  })

  it("leaves the anchor's own times untouched", () => {
    const day = [talk("m1", null, null, { display_order: 0 }), lunch({ display_order: 1 })]
    const out = distributeEvenly({ start_time: "12:00", end_time: "13:45" }, day)
    expect(out.some((c) => c.id === "lunch")).toBe(false)
  })

  it("gives the remainder to the earliest rows so the run ends exactly", () => {
    // 60 minutes across 7 rows: 8,8,8,8,8,8,8 leaves 4 short.
    const seven = Array.from({ length: 7 }, (_, i) =>
      talk(`t${i}`, null, null, { display_order: i })
    )
    const out = distributeEvenly({ start_time: "09:00", end_time: "10:00" }, seven)
    expect(out.at(-1)!.end_time).toBe("10:00")
    expect(out[0].end_time).toBe("09:09")
    expect(out.at(-1)!.start_time).toBe("09:52")
  })

  it("treats an untimed break as an ordinary row rather than losing the run", () => {
    const day = [
      talk("a", null, null, { display_order: 0 }),
      talk("b", null, null, { display_order: 1, talk_type: "break" }),
    ]
    const out = distributeEvenly({ start_time: "09:00", end_time: "10:00" }, day)
    expect(out.map((c) => c.id)).toEqual(["a", "b"])
  })

  it("does nothing without a session span or rows", () => {
    expect(distributeEvenly({ start_time: null, end_time: null }, [talk("a", null, null)])).toEqual([])
    expect(distributeEvenly(BLOCK, [])).toEqual([])
  })
})
