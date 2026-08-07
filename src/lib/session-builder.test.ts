import { describe, it, expect } from "vitest"
import {
  describeBlockSummary,
  describeRollup,
  describeTimeIssues,
  describeUnscheduled,
  findUnscheduledRanges,
  formatDuration,
  nextTalkOrder,
  rollupBlockRoles,
  sortTalks,
  toMinutes,
  validateBlockTimes,
  type BuilderAssignment,
  type BuilderBlock,
  type BuilderRequirement,
  type BuilderTalk,
} from "./session-builder"

// The design's own worked example: GALL BLADDER, Day 1, 09:30 – 11:30.
const BLOCK: BuilderBlock = {
  id: "b1",
  session_name: "GALL BLADDER",
  session_date: "2026-02-12",
  start_time: "09:30",
  end_time: "11:30",
}

const talk = (id: string, start: string | null, end: string | null, over: Partial<BuilderTalk> = {}): BuilderTalk => ({
  id,
  session_id: "b1",
  title: `Talk ${id}`,
  start_time: start,
  end_time: end,
  display_order: 0,
  ...over,
})

const req = (role: BuilderRequirement["role"], count: number, talk_id: string | null = null): BuilderRequirement => ({
  session_id: "b1",
  talk_id,
  role,
  required_count: count,
})

const assign = (role: string, talk_id: string | null = null, status = "pending"): BuilderAssignment => ({
  session_id: "b1",
  talk_id,
  role,
  status,
})

describe("time helpers", () => {
  it("parses a time to minutes", () => {
    expect(toMinutes("09:30")).toBe(570)
    expect(toMinutes("00:00")).toBe(0)
    expect(toMinutes(null)).toBeNull()
    expect(toMinutes("not a time")).toBeNull()
  })

  it("formats durations the way the design writes them", () => {
    expect(formatDuration(90)).toBe("1h 30m")
    expect(formatDuration(45)).toBe("45m")
    expect(formatDuration(120)).toBe("2h")
    expect(formatDuration(0)).toBe("0m")
  })
})

describe("validateBlockTimes", () => {
  it("says nothing about a clean block", () => {
    expect(validateBlockTimes(BLOCK, [talk("t1", "09:30", "09:45")])).toEqual([])
  })

  it("flags a talk outside the block's range", () => {
    // Design 2g: "Video session — GB perforation" at 11:45–12:00.
    const issues = validateBlockTimes(BLOCK, [talk("t1", "11:45", "12:00")])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ code: "outside_block", talk_id: "t1" })
    expect(issues[0].message).toBe("This talk's time falls outside the session block's range")
  })

  it("flags an overlap but hedges it, because parallel screens are legitimate", () => {
    // Design 2g verbatim: the warning sits on the 10:15 talk and names the
    // 10:30 panel it runs into.
    const issues = validateBlockTimes(BLOCK, [
      talk("chole", "10:15", "10:45", { title: "Lap subtotal reconstituting chole" }),
      talk("panel", "10:30", "11:00", { title: "Bile Duct Injury in 2025" }),
    ])
    const overlap = issues.find((i) => i.code === "overlaps_sibling")
    expect(overlap?.talk_id).toBe("chole")
    expect(overlap?.message).toBe(
      "Overlaps “Bile Duct Injury in 2025” (10:30 – 11:00) — fine if they run in parallel"
    )
  })

  it("reports each overlapping pair once, against the earlier talk", () => {
    const issues = validateBlockTimes(BLOCK, [
      talk("early", "10:00", "10:30"),
      talk("late", "10:15", "10:45"),
    ])
    const overlaps = issues.filter((i) => i.code === "overlaps_sibling")
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0].talk_id).toBe("early")
  })

  it("does not treat back-to-back talks as overlapping", () => {
    const issues = validateBlockTimes(BLOCK, [talk("t1", "09:30", "10:00"), talk("t2", "10:00", "10:30")])
    expect(issues).toEqual([])
  })

  it("flags a talk whose end precedes its start, and skips further checks on it", () => {
    const issues = validateBlockTimes(BLOCK, [talk("t1", "14:00", "13:30")])
    expect(issues).toEqual([
      { code: "end_before_start", talk_id: "t1", message: "End time should be after the start time" },
    ])
  })

  it("flags the block's own inverted range", () => {
    const issues = validateBlockTimes({ ...BLOCK, start_time: "14:00", end_time: "13:30" }, [])
    expect(issues[0].code).toBe("block_end_before_start")
    expect(issues[0].talk_id).toBeNull()
  })

  it("ignores unscheduled talks entirely", () => {
    expect(validateBlockTimes(BLOCK, [talk("t1", null, null)])).toEqual([])
  })

  it("cannot judge 'outside the block' before the block has a range", () => {
    const noRange = { ...BLOCK, start_time: null, end_time: null }
    expect(validateBlockTimes(noRange, [talk("t1", "11:45", "12:00")])).toEqual([])
  })

  it("never returns a blocking severity — time problems are always saveable", () => {
    // Design 2g: one talk outside the block's range, one overlapping a sibling.
    const issues = validateBlockTimes(BLOCK, [
      talk("outside", "11:45", "12:00"),
      talk("chole", "10:15", "10:45"),
      talk("panel", "10:30", "11:00"),
    ])
    expect(issues.map((i) => i.code).sort()).toEqual(["outside_block", "overlaps_sibling"])
    expect(describeTimeIssues(issues)).toBe("2 warnings — you can still save")
  })

  it("says nothing when there is nothing to warn about", () => {
    expect(describeTimeIssues([])).toBe("")
  })
})

describe("findUnscheduledRanges", () => {
  it("finds the tail of a block", () => {
    // Design 2c: talks run to 11:00, block ends 11:30.
    const ranges = findUnscheduledRanges(BLOCK, [talk("t1", "09:30", "11:00")])
    expect(ranges).toEqual([{ start: "11:00", end: "11:30", minutes: 30 }])
    expect(describeUnscheduled(ranges)).toBe("11:00 – 11:30 unscheduled")
  })

  it("finds a gap in the middle", () => {
    const ranges = findUnscheduledRanges(BLOCK, [
      talk("t1", "09:30", "10:00"),
      talk("t2", "10:30", "11:30"),
    ])
    expect(ranges).toEqual([{ start: "10:00", end: "10:30", minutes: 30 }])
  })

  it("gives a large remainder as a duration, not a range", () => {
    // Design 2b: two 15-minute talks in a two-hour block leave 90 minutes,
    // which the design writes as "1h 30m of the block still unscheduled"
    // rather than naming the range.
    const ranges = findUnscheduledRanges(BLOCK, [
      talk("t1", "09:30", "09:45"),
      talk("t2", "09:45", "10:00"),
    ])
    expect(ranges).toEqual([{ start: "10:00", end: "11:30", minutes: 90 }])
    expect(describeUnscheduled(ranges)).toBe("1h 30m of the block still unscheduled")
  })

  it("sums several gaps into one duration", () => {
    const ranges = findUnscheduledRanges(BLOCK, [
      talk("t1", "09:45", "10:00"),
      talk("t2", "10:30", "11:00"),
    ])
    expect(ranges).toHaveLength(3)
    expect(describeUnscheduled(ranges)).toBe("1h 15m of the block still unscheduled")
  })

  it("counts two parallel talks once rather than double-booking the block", () => {
    const ranges = findUnscheduledRanges(BLOCK, [
      talk("t1", "09:30", "10:30"),
      talk("t2", "09:30", "10:30"),
    ])
    expect(ranges).toEqual([{ start: "10:30", end: "11:30", minutes: 60 }])
  })

  it("merges overlapping talks before subtracting", () => {
    const ranges = findUnscheduledRanges(BLOCK, [
      talk("t1", "09:30", "10:30"),
      talk("t2", "10:00", "11:30"),
    ])
    expect(ranges).toEqual([])
  })

  it("clamps a talk that runs past the block, so it cannot subtract time the block lacks", () => {
    const ranges = findUnscheduledRanges(BLOCK, [talk("t1", "09:30", "13:00")])
    expect(ranges).toEqual([])
  })

  it("returns the whole block when nothing is scheduled", () => {
    expect(findUnscheduledRanges(BLOCK, [])).toEqual([
      { start: "09:30", end: "11:30", minutes: 120 },
    ])
  })

  it("says nothing about a block with no range of its own", () => {
    expect(findUnscheduledRanges({ ...BLOCK, start_time: null }, [])).toEqual([])
    expect(describeUnscheduled([])).toBe("")
  })
})

describe("rollupBlockRoles", () => {
  it("counts block-level and talk-level roles together", () => {
    // Design 2c: "12 of 13 roles filled".
    const requirements = [
      req("chairperson", 1),
      req("speaker", 1, "t1"),
      req("speaker", 1, "t2"),
      req("moderator", 1, "t5"),
      req("panelist", 6, "t5"),
      req("discussant", 3, "t3"),
    ]
    const assignments = [
      assign("chairperson"),
      assign("speaker", "t1"),
      assign("speaker", "t2"),
      assign("moderator", "t5"),
      ...Array.from({ length: 6 }, () => assign("panelist", "t5")),
      assign("discussant", "t3"),
      assign("discussant", "t3"),
    ]
    const rollup = rollupBlockRoles("b1", requirements, assignments)
    expect(rollup).toMatchObject({ required: 13, filled: 12, unfilled: 1 })
    expect(describeBlockSummary(5, rollup)).toBe("5 talks · 12 of 13 roles filled")
  })

  it("does not let extra people inflate the count past what was asked for", () => {
    const rollup = rollupBlockRoles("b1", [req("panelist", 6, "t1")], [
      ...Array.from({ length: 7 }, () => assign("panelist", "t1")),
    ])
    expect(rollup).toMatchObject({ required: 6, filled: 6, unfilled: 0 })
  })

  it("keeps a block-level chair separate from a talk-level speaker", () => {
    const rollup = rollupBlockRoles("b1", [req("chairperson", 1)], [assign("chairperson", "t1")])
    // The chair belongs to the block; an assignment on a talk does not fill it.
    expect(rollup).toMatchObject({ required: 1, filled: 0, unfilled: 1 })
  })

  it("reopens a slot when someone declined", () => {
    const rollup = rollupBlockRoles("b1", [req("speaker", 1, "t1")], [assign("speaker", "t1", "declined")])
    expect(rollup.unfilled).toBe(1)
  })

  it("ignores requirements and assignments from other blocks", () => {
    const rollup = rollupBlockRoles(
      "b1",
      [{ session_id: "other", role: "speaker", required_count: 5 }],
      [{ session_id: "other", talk_id: null, role: "speaker", status: "pending" }]
    )
    expect(rollup).toMatchObject({ required: 0, filled: 0, unfilled: 0 })
  })

  it("breaks the detail down per talk, with block roles under null", () => {
    const rollup = rollupBlockRoles(
      "b1",
      [req("chairperson", 1), req("moderator", 1, "t5"), req("panelist", 6, "t5")],
      [assign("moderator", "t5"), ...Array.from({ length: 4 }, () => assign("panelist", "t5"))]
    )
    expect(rollup.byTalk.get(null)).toEqual([
      { role: "chairperson", role_label: "Chair", required: 1, filled: 0 },
    ])
    // Design 2f: "Moderator 1 of 1 filled", "Panellists 4 of 6 filled".
    expect(rollup.byTalk.get("t5")).toEqual([
      { role: "moderator", role_label: "Moderator", required: 1, filled: 1 },
      { role: "panelist", role_label: "Panelist", required: 6, filled: 4 },
    ])
  })
})

describe("describeRollup", () => {
  const roll = (requirements: BuilderRequirement[], assignments: BuilderAssignment[]) =>
    describeRollup(rollupBlockRoles("b1", requirements, assignments))

  it("says all filled when nothing is outstanding", () => {
    expect(roll([req("speaker", 1, "t1")], [assign("speaker", "t1")])).toBe("All roles filled")
  })

  it("counts what is outstanding", () => {
    expect(roll([req("speaker", 2, "t1")], [assign("speaker", "t1")])).toBe("1 unfilled")
  })

  it("distinguishes 'nothing declared' from 'all filled'", () => {
    // A block with no roles set is not the same as a block that is fully
    // staffed — one is unstarted, the other is done.
    expect(roll([], [])).toBe("No roles set")
  })

  it("omits the role count for a block that needs nobody", () => {
    // LUNCH: "None — this block runs as a single stretch of time."
    expect(describeBlockSummary(0, rollupBlockRoles("b1", [], []))).toBe("0 talks")
  })
})

describe("sortTalks", () => {
  it("orders by display_order first", () => {
    const sorted = sortTalks([
      talk("b", "09:00", "09:30", { display_order: 1 }),
      talk("a", "10:00", "10:30", { display_order: 0 }),
    ])
    expect(sorted.map((t) => t.id)).toEqual(["a", "b"])
  })

  it("falls back to start time within the same order", () => {
    const sorted = sortTalks([talk("late", "10:00", "10:30"), talk("early", "09:00", "09:30")])
    expect(sorted.map((t) => t.id)).toEqual(["early", "late"])
  })

  it("keeps an unscheduled talk after scheduled ones at the same order", () => {
    const sorted = sortTalks([talk("none", null, null), talk("timed", "09:00", "09:30")])
    expect(sorted.map((t) => t.id)).toEqual(["timed", "none"])
  })

  it("does not mutate its input", () => {
    const input = [talk("b", "10:00", "10:30"), talk("a", "09:00", "09:30")]
    sortTalks(input)
    expect(input.map((t) => t.id)).toEqual(["b", "a"])
  })
})

describe("nextTalkOrder", () => {
  it("appends after the highest", () => {
    expect(nextTalkOrder([talk("a", null, null, { display_order: 0 }), talk("b", null, null, { display_order: 3 })])).toBe(4)
  })

  it("starts at zero on an empty block", () => {
    expect(nextTalkOrder([])).toBe(0)
  })
})
