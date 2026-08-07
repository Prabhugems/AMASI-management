import { describe, it, expect } from "vitest"
import {
  buildHallLabels,
  getOpenSlots,
  sessionsMissingRequirements,
  summariseOpenSlots,
  type AssignmentRow,
  type OpenSlotSession,
  type OpenSlotTalk,
  type RoleRequirementRow,
} from "./agenda-open-slots"

const session = (over: Partial<OpenSlotSession> & { id: string }): OpenSlotSession => ({
  session_name: `Session ${over.id}`,
  session_date: "2026-08-27",
  start_time: "09:00",
  end_time: "10:00",
  hall_id: null,
  ...over,
})

const req = (
  session_id: string,
  role: RoleRequirementRow["role"],
  required_count = 1
): RoleRequirementRow => ({ session_id, role, required_count })

const assign = (
  session_id: string | null,
  role: string,
  status: string | null = "pending"
): AssignmentRow => ({ session_id, role, status })

describe("getOpenSlots", () => {
  it("reports the shortfall, not the requirement", () => {
    const slots = getOpenSlots({
      sessions: [session({ id: "s1" })],
      requirements: [req("s1", "speaker", 4)],
      assignments: [assign("s1", "speaker"), assign("s1", "speaker")],
    })
    expect(slots).toHaveLength(1)
    expect(slots[0]).toMatchObject({ required_count: 4, filled_count: 2, open_count: 2 })
  })

  it("omits a fully staffed role", () => {
    const slots = getOpenSlots({
      sessions: [session({ id: "s1" })],
      requirements: [req("s1", "chairperson", 1)],
      assignments: [assign("s1", "chairperson")],
    })
    expect(slots).toEqual([])
  })

  it("counts pending as filled", () => {
    // 95% of live assignments sit at `pending`. Treating those as open would
    // report nearly every booked slot as vacant.
    const slots = getOpenSlots({
      sessions: [session({ id: "s1" })],
      requirements: [req("s1", "speaker", 1)],
      assignments: [assign("s1", "speaker", "pending")],
    })
    expect(slots).toEqual([])
  })

  it("reopens a slot when the person declined", () => {
    const slots = getOpenSlots({
      sessions: [session({ id: "s1" })],
      requirements: [req("s1", "speaker", 1)],
      assignments: [assign("s1", "speaker", "declined")],
    })
    expect(slots[0].open_count).toBe(1)
  })

  it("reopens a slot when the assignment was cancelled or withdrawn", () => {
    for (const status of ["cancelled", "withdrawn"]) {
      const slots = getOpenSlots({
        sessions: [session({ id: "s1" })],
        requirements: [req("s1", "speaker", 1)],
        assignments: [assign("s1", "speaker", status)],
      })
      expect(slots[0]?.open_count).toBe(1)
    }
  })

  it("keeps roles separate within a session", () => {
    const slots = getOpenSlots({
      sessions: [session({ id: "s1" })],
      requirements: [req("s1", "speaker", 2), req("s1", "chairperson", 1)],
      assignments: [assign("s1", "speaker"), assign("s1", "speaker")],
    })
    expect(slots).toHaveLength(1)
    expect(slots[0].role).toBe("chairperson")
  })

  it("ignores orphaned assignments", () => {
    // 58 live rows have session_id null.
    const slots = getOpenSlots({
      sessions: [session({ id: "s1" })],
      requirements: [req("s1", "speaker", 1)],
      assignments: [assign(null, "speaker")],
    })
    expect(slots[0].open_count).toBe(1)
  })

  it("ignores requirements for sessions outside the given set", () => {
    const slots = getOpenSlots({
      sessions: [session({ id: "s1" })],
      requirements: [req("other-event", "speaker", 1)],
      assignments: [],
    })
    expect(slots).toEqual([])
  })
})

describe("the 1,242-session trap", () => {
  it("marks a text-only-staffed session unverified, never open", () => {
    // 54% of live sessions look exactly like this. Calling them `open` would
    // tell a coordinator to re-invite people who are already booked.
    const slots = getOpenSlots({
      sessions: [session({ id: "s1", speakers: "Dr. Anitha Ravindran, Dr. Meera Kulkarni" })],
      requirements: [req("s1", "speaker", 2)],
      assignments: [],
    })
    expect(slots[0].state).toBe("unverified")
  })

  it("treats a genuinely empty session as open", () => {
    const slots = getOpenSlots({
      sessions: [session({ id: "s1" })],
      requirements: [req("s1", "speaker", 2)],
      assignments: [],
    })
    expect(slots[0].state).toBe("open")
  })

  it("treats leftover text as stale once the session has any assignment", () => {
    // Someone has already reconciled this session; the text is a duplicate,
    // not an unreviewed roster.
    const slots = getOpenSlots({
      sessions: [session({ id: "s1", speakers: "Dr. Anitha Ravindran" })],
      requirements: [req("s1", "speaker", 3)],
      assignments: [assign("s1", "speaker")],
    })
    expect(slots[0].state).toBe("open")
  })

  it("counts unverified separately from open in the summary", () => {
    const slots = getOpenSlots({
      sessions: [
        session({ id: "s1", speakers: "Dr. Anitha Ravindran" }),
        session({ id: "s2" }),
      ],
      requirements: [req("s1", "speaker", 2), req("s2", "speaker", 3)],
      assignments: [],
    })
    const summary = summariseOpenSlots(slots)
    expect(summary.openCount).toBe(3)
    expect(summary.unverifiedCount).toBe(2)
  })

  it("recognises the _text columns as faculty text too", () => {
    const slots = getOpenSlots({
      sessions: [session({ id: "s1", chairpersons_text: "Dr. X (x@y.in, 999)" })],
      requirements: [req("s1", "chairperson", 1)],
      assignments: [],
    })
    expect(slots[0].state).toBe("unverified")
  })

  it("does not treat whitespace as faculty text", () => {
    const slots = getOpenSlots({
      sessions: [session({ id: "s1", speakers: "   " })],
      requirements: [req("s1", "speaker", 1)],
      assignments: [],
    })
    expect(slots[0].state).toBe("open")
  })
})

describe("two-level agenda — blocks and talks", () => {
  const block = session({ id: "b1", session_name: "GALL BLADDER", start_time: "09:30" })
  const talk = (id: string, over: Partial<OpenSlotTalk> = {}): OpenSlotTalk => ({
    id,
    session_id: "b1",
    title: `Talk ${id}`,
    start_time: null,
    ...over,
  })

  it("counts a block-level chair separately from a talk-level speaker", () => {
    // Same session, same count if the grain were ignored — the chair would be
    // cancelled out by the speaker.
    const slots = getOpenSlots({
      sessions: [block],
      talks: [talk("t1")],
      requirements: [
        { session_id: "b1", role: "chairperson", required_count: 1 },
        { session_id: "b1", talk_id: "t1", role: "speaker", required_count: 1 },
      ],
      assignments: [{ session_id: "b1", talk_id: "t1", role: "speaker", status: "pending" }],
    })
    expect(slots).toHaveLength(1)
    expect(slots[0]).toMatchObject({ role: "chairperson", talk_id: null, talk_title: null })
  })

  it("does not let a block-level assignment fill a talk-level slot", () => {
    const slots = getOpenSlots({
      sessions: [block],
      talks: [talk("t1")],
      requirements: [{ session_id: "b1", talk_id: "t1", role: "speaker", required_count: 1 }],
      assignments: [{ session_id: "b1", talk_id: null, role: "speaker", status: "pending" }],
    })
    expect(slots[0].open_count).toBe(1)
  })

  it("keeps two talks in one block independent", () => {
    const slots = getOpenSlots({
      sessions: [block],
      talks: [talk("t1"), talk("t2")],
      requirements: [
        { session_id: "b1", talk_id: "t1", role: "speaker", required_count: 1 },
        { session_id: "b1", talk_id: "t2", role: "speaker", required_count: 1 },
      ],
      assignments: [{ session_id: "b1", talk_id: "t1", role: "speaker", status: "pending" }],
    })
    expect(slots.map((s) => s.talk_id)).toEqual(["t2"])
  })

  it("carries block and talk names for the row label", () => {
    const slots = getOpenSlots({
      sessions: [block],
      talks: [talk("t1", { title: "Bile Duct Injury in 2025" })],
      requirements: [{ session_id: "b1", talk_id: "t1", role: "panelist", required_count: 6 }],
      assignments: [],
    })
    expect(slots[0]).toMatchObject({
      session_name: "GALL BLADDER",
      talk_title: "Bile Duct Injury in 2025",
      open_count: 6,
    })
  })

  it("reports empty panellist seats as a count, not one row each", () => {
    // The design shows "2 panellist seats open" on a single row.
    const slots = getOpenSlots({
      sessions: [block],
      talks: [talk("t1")],
      requirements: [{ session_id: "b1", talk_id: "t1", role: "panelist", required_count: 6 }],
      assignments: Array.from({ length: 4 }, () => ({
        session_id: "b1",
        talk_id: "t1",
        role: "panelist",
        status: "pending",
      })),
    })
    expect(slots).toHaveLength(1)
    expect(slots[0].open_count).toBe(2)
  })

  it("sorts a talk by its own time, not its block's", () => {
    // A talk at 16:00 inside a 09:30 block belongs at 16:00 in the to-do list.
    const slots = getOpenSlots({
      sessions: [
        block,
        session({ id: "b2", session_name: "HERNIA", start_time: "14:00" }),
      ],
      talks: [talk("t1", { start_time: "16:00" })],
      requirements: [
        { session_id: "b1", talk_id: "t1", role: "speaker", required_count: 1 },
        { session_id: "b2", role: "chairperson", required_count: 1 },
      ],
      assignments: [],
    })
    expect(slots.map((s) => s.session_id)).toEqual(["b2", "b1"])
  })

  it("falls back to the block's time when a talk is unscheduled", () => {
    const slots = getOpenSlots({
      sessions: [block],
      talks: [talk("t1", { start_time: null })],
      requirements: [{ session_id: "b1", talk_id: "t1", role: "speaker", required_count: 1 }],
      assignments: [],
    })
    expect(slots[0].start_time).toBe("09:30")
  })

  it("drops a requirement whose talk is missing rather than reporting it on the block", () => {
    // Reporting it at block level would double-count the block's own roles.
    const slots = getOpenSlots({
      sessions: [block],
      talks: [],
      requirements: [{ session_id: "b1", talk_id: "gone", role: "speaker", required_count: 1 }],
      assignments: [],
    })
    expect(slots).toEqual([])
  })

  it("judges unverified per block, so leftover text taints every talk in it", () => {
    // The free text sits on the session's columns and says nothing about which
    // talk it belongs to, so the whole block is unreconciled.
    const slots = getOpenSlots({
      sessions: [session({ id: "b1", speakers: "Dr. Anitha Ravindran" })],
      talks: [{ id: "t1", session_id: "b1", title: "Talk 1", start_time: null }],
      requirements: [{ session_id: "b1", talk_id: "t1", role: "speaker", required_count: 1 }],
      assignments: [],
    })
    expect(slots[0].state).toBe("unverified")
  })
})

describe("hall labels", () => {
  it("renders a nested screen under its hall", () => {
    const labels = buildHallLabels([
      { id: "h1", name: "Hall A", parent_id: null },
      { id: "sc1", name: "Screen 2", parent_id: "h1" },
    ])
    expect(labels.get("sc1")).toBe("Hall A › Screen 2")
    expect(labels.get("h1")).toBe("Hall A")
  })

  it("labels a slot with its resolved hall", () => {
    const slots = getOpenSlots({
      sessions: [session({ id: "s1", hall_id: "sc1" })],
      requirements: [req("s1", "speaker", 1)],
      assignments: [],
      halls: [
        { id: "h1", name: "Hall A", parent_id: null },
        { id: "sc1", name: "Screen 2", parent_id: "h1" },
      ],
    })
    expect(slots[0].hall_label).toBe("Hall A › Screen 2")
  })

  it("leaves the label null for an unscheduled session", () => {
    const slots = getOpenSlots({
      sessions: [session({ id: "s1", hall_id: null })],
      requirements: [req("s1", "speaker", 1)],
      assignments: [],
    })
    expect(slots[0].hall_label).toBeNull()
  })
})

describe("ordering", () => {
  it("reads in the order the conference runs", () => {
    const slots = getOpenSlots({
      sessions: [
        session({ id: "late", session_date: "2026-08-28", start_time: "09:00" }),
        session({ id: "early", session_date: "2026-08-27", start_time: "14:00" }),
        session({ id: "first", session_date: "2026-08-27", start_time: "09:00" }),
      ],
      requirements: [req("late", "speaker"), req("early", "speaker"), req("first", "speaker")],
      assignments: [],
    })
    expect(slots.map((s) => s.session_id)).toEqual(["first", "early", "late"])
  })

  it("sorts undated sessions last — they need scheduling before staffing", () => {
    const slots = getOpenSlots({
      sessions: [
        session({ id: "undated", session_date: null, start_time: null }),
        session({ id: "dated", session_date: "2026-08-27" }),
      ],
      requirements: [req("undated", "speaker"), req("dated", "speaker")],
      assignments: [],
    })
    expect(slots.map((s) => s.session_id)).toEqual(["dated", "undated"])
  })
})

describe("sessionsMissingRequirements", () => {
  it("surfaces sessions where no roster was ever declared", () => {
    // Without this, an event with nothing declared reads "0 open" — the most
    // dangerous possible false reassurance.
    const sessions = [session({ id: "s1" }), session({ id: "s2" })]
    const missing = sessionsMissingRequirements(sessions, [req("s1", "speaker")])
    expect(missing.map((s) => s.id)).toEqual(["s2"])
  })

  it("returns nothing once every session has a roster", () => {
    const sessions = [session({ id: "s1" })]
    expect(sessionsMissingRequirements(sessions, [req("s1", "speaker")])).toEqual([])
  })
})

describe("summariseOpenSlots", () => {
  it("ranks roles by how many people are still needed", () => {
    const slots = getOpenSlots({
      sessions: [session({ id: "s1" }), session({ id: "s2" })],
      requirements: [req("s1", "speaker", 4), req("s1", "chairperson", 2), req("s2", "speaker", 1)],
      assignments: [],
    })
    const summary = summariseOpenSlots(slots)
    expect(summary.byRole[0]).toMatchObject({ role: "speaker", open_count: 5 })
    expect(summary.byRole[1]).toMatchObject({ role: "chairperson", open_count: 2 })
    expect(summary.sessionsAffected).toBe(2)
  })

  it("is all zeroes for a fully staffed event", () => {
    expect(summariseOpenSlots([])).toMatchObject({
      openCount: 0,
      unverifiedCount: 0,
      sessionsAffected: 0,
      byRole: [],
    })
  })
})
