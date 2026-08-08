import { describe, it, expect } from "vitest"
import {
  findHallDoubleBookings,
  findFacultyDoubleBookings,
  findUnassignedSessions,
  findUnconfirmedSpeakers,
  findOverCapacitySessions,
  findUnscheduledSessions,
  getAllConflicts,
  type ConflictSession,
  type FacultyAssignmentRow,
  type HallCapacity,
} from "./agenda-conflicts"

const session = (overrides: Partial<ConflictSession>): ConflictSession => ({
  id: "s1",
  session_name: "Untitled",
  session_date: "2026-08-15",
  start_time: "09:00",
  end_time: "10:00",
  hall_id: "hall-a",
  ...overrides,
})

describe("findHallDoubleBookings", () => {
  it("flags two sessions overlapping in the same hall", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const s2 = session({ id: "s2", start_time: "09:30", end_time: "10:30", hall_id: "hall-a" })
    const conflicts = findHallDoubleBookings([s1, s2])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].type).toBe("hall_double_booking")
    expect(conflicts[0].severity).toBe("blocking")
    expect(conflicts[0].session_ids.sort()).toEqual(["s1", "s2"])
  })

  it("does not flag sessions in different halls at the same time", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const s2 = session({ id: "s2", start_time: "09:00", end_time: "10:00", hall_id: "hall-b" })
    expect(findHallDoubleBookings([s1, s2])).toHaveLength(0)
  })

  it("does not flag back-to-back sessions in the same hall", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const s2 = session({ id: "s2", start_time: "10:00", end_time: "11:00", hall_id: "hall-a" })
    expect(findHallDoubleBookings([s1, s2])).toHaveLength(0)
  })

  it("does not block a hall running parallel stations", () => {
    // AMASICON 2026, HALL 2, 28 Aug: six hands-on stations all 09:00-11:00
    // with delegates rotating between them. The old rule called that fifteen
    // blocking clashes and made the programme unsubmittable.
    const stations = ["Lap TAPP", "IPOM Plus", "Proctology-Laser", "Lap Sleeve"].map((n, i) =>
      session({ id: `st${i}`, session_name: n, start_time: "09:00", end_time: "11:00", hall_id: "hall-2" })
    )
    const out = findHallDoubleBookings(stations, [{ id: "hall-2", name: "HALL 2" }])

    expect(out.filter((c) => c.severity === "blocking")).toHaveLength(0)
    // Six stations make fifteen pairs; fifteen copies of one fact is not
    // information, so it is reported once for the group.
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ type: "parallel_use", severity: "warning" })
    expect(out[0].session_ids).toHaveLength(4)
    expect(out[0].message).toContain("HALL 2")
    expect(out[0].message).toContain("own screen")
  })

  it("still blocks a partial overlap, which is what a real mistake looks like", () => {
    // The three genuine ones on AMASICON: a talk starting 15:30 while the
    // Presidential Oration runs to 15:40 in the same hall.
    const out = findHallDoubleBookings(
      [
        session({ id: "oration", session_name: "Presidential Oration", start_time: "15:00", end_time: "15:40", hall_id: "hall-1" }),
        session({ id: "talk", session_name: "Lap whole layer chole", start_time: "15:30", end_time: "15:45", hall_id: "hall-1" }),
      ],
      [{ id: "hall-1", name: "HALL 1" }]
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ type: "hall_double_booking", severity: "blocking" })
  })

  it("does not clash two different screens of the same hall", () => {
    // The whole point of screens.
    const out = findHallDoubleBookings(
      [
        session({ id: "a", start_time: "09:00", end_time: "10:00", hall_id: "screen-1" }),
        session({ id: "b", start_time: "09:00", end_time: "10:00", hall_id: "screen-2" }),
      ],
      [
        { id: "hall-a", name: "Hall A" },
        { id: "screen-1", name: "Screen 1", parent_id: "hall-a" },
        { id: "screen-2", name: "Screen 2", parent_id: "hall-a" },
      ]
    )
    expect(out).toEqual([])
  })

  it("blocks a session in a hall against one on a screen inside it", () => {
    // The room as a whole is taken, so a screen inside it cannot also be used.
    const out = findHallDoubleBookings(
      [
        session({ id: "whole", session_name: "Plenary", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" }),
        session({ id: "part", session_name: "Workshop", start_time: "09:30", end_time: "10:30", hall_id: "screen-1" }),
      ],
      [
        { id: "hall-a", name: "Hall A" },
        { id: "screen-1", name: "Screen 1", parent_id: "hall-a" },
      ]
    )
    expect(out).toHaveLength(1)
    expect(out[0].severity).toBe("blocking")
    expect(out[0].message).toContain("screen inside it")
  })

  it("names the hall generically when no hall list is supplied", () => {
    const out = findHallDoubleBookings([
      session({ id: "a", start_time: "09:00", end_time: "10:00", hall_id: "h" }),
      session({ id: "b", start_time: "09:00", end_time: "10:00", hall_id: "h" }),
    ])
    expect(out[0].message).toContain("the same hall")
  })

  it("ignores sessions with no hall_id", () => {
    const s1 = session({ id: "s1", hall_id: null })
    const s2 = session({ id: "s2", hall_id: null })
    expect(findHallDoubleBookings([s1, s2])).toHaveLength(0)
  })

  it("ignores overlaps on different days", () => {
    const s1 = session({ id: "s1", session_date: "2026-08-15" })
    const s2 = session({ id: "s2", session_date: "2026-08-16" })
    expect(findHallDoubleBookings([s1, s2])).toHaveLength(0)
  })
})

describe("findFacultyDoubleBookings", () => {
  const assignment = (overrides: Partial<FacultyAssignmentRow>): FacultyAssignmentRow => ({
    session_id: "s1",
    faculty_id: "fac-1",
    faculty_name: "Dr. Test",
    status: "confirmed",
    ...overrides,
  })

  it("flags a faculty member double-booked across halls as a warning, not a block", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const s2 = session({ id: "s2", start_time: "09:30", end_time: "10:30", hall_id: "hall-b" })
    const assignments = [
      assignment({ session_id: "s1", faculty_id: "fac-1" }),
      assignment({ session_id: "s2", faculty_id: "fac-1" }),
    ]
    const conflicts = findFacultyDoubleBookings([s1, s2], assignments)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].type).toBe("faculty_double_booking")
    expect(conflicts[0].severity).toBe("warning")
  })

  it("does not flag two different faculty members in overlapping sessions", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const s2 = session({ id: "s2", start_time: "09:30", end_time: "10:30", hall_id: "hall-b" })
    const assignments = [
      assignment({ session_id: "s1", faculty_id: "fac-1" }),
      assignment({ session_id: "s2", faculty_id: "fac-2" }),
    ]
    expect(findFacultyDoubleBookings([s1, s2], assignments)).toHaveLength(0)
  })

  it("ignores assignments with no faculty_id (unresolved free-text speaker)", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00" })
    const s2 = session({ id: "s2", start_time: "09:30", end_time: "10:30" })
    const assignments = [
      assignment({ session_id: "s1", faculty_id: null }),
      assignment({ session_id: "s2", faculty_id: null }),
    ]
    expect(findFacultyDoubleBookings([s1, s2], assignments)).toHaveLength(0)
  })
})

describe("findUnassignedSessions", () => {
  it("flags a session with no faculty_assignments row at all", () => {
    const s1 = session({ id: "s1" })
    expect(findUnassignedSessions([s1], [])).toHaveLength(1)
  })

  it("does not flag a session with at least one assignment", () => {
    const s1 = session({ id: "s1" })
    const assignments = [{ session_id: "s1", faculty_id: "fac-1", faculty_name: "Dr. Test", status: "confirmed" }]
    expect(findUnassignedSessions([s1], assignments)).toHaveLength(0)
  })
})

describe("findUnconfirmedSpeakers", () => {
  it("flags a session whose only assignment is not confirmed", () => {
    const s1 = session({ id: "s1" })
    const assignments = [{ session_id: "s1", faculty_id: "fac-1", faculty_name: "Dr. Test", status: "invited" }]
    expect(findUnconfirmedSpeakers([s1], assignments)).toHaveLength(1)
  })

  it("does not flag a session where every assignment is confirmed", () => {
    const s1 = session({ id: "s1" })
    const assignments = [{ session_id: "s1", faculty_id: "fac-1", faculty_name: "Dr. Test", status: "confirmed" }]
    expect(findUnconfirmedSpeakers([s1], assignments)).toHaveLength(0)
  })
})

describe("findOverCapacitySessions", () => {
  it("flags a session whose registered count exceeds its hall's capacity", () => {
    const s1 = { ...session({ id: "s1", hall_id: "hall-a" }), registeredCount: 250 }
    const halls: HallCapacity[] = [{ id: "hall-a", capacity: 200 }]
    expect(findOverCapacitySessions([s1], halls)).toHaveLength(1)
  })

  it("does not flag when under capacity or capacity is unset", () => {
    const s1 = { ...session({ id: "s1", hall_id: "hall-a" }), registeredCount: 150 }
    const s2 = { ...session({ id: "s2", hall_id: "hall-b" }), registeredCount: 9999 }
    const halls: HallCapacity[] = [{ id: "hall-a", capacity: 200 }, { id: "hall-b", capacity: null }]
    expect(findOverCapacitySessions([s1, s2], halls)).toHaveLength(0)
  })
})

describe("findUnscheduledSessions", () => {
  it("flags a session missing a hall, date, or time", () => {
    const s1 = session({ id: "s1", hall_id: null })
    const s2 = session({ id: "s2", session_date: null })
    const s3 = session({ id: "s3", start_time: null })
    expect(findUnscheduledSessions([s1, s2, s3])).toHaveLength(3)
  })

  it("does not flag a fully scheduled session", () => {
    const s1 = session({ id: "s1" })
    expect(findUnscheduledSessions([s1])).toHaveLength(0)
  })
})

describe("getAllConflicts", () => {
  it("aggregates all conflict types and counts blocking vs warning", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const s2 = session({ id: "s2", start_time: "09:30", end_time: "10:30", hall_id: "hall-a" })
    const result = getAllConflicts({
      sessions: [s1, s2].map((s) => ({ ...s, registeredCount: 0 })),
      assignments: [],
      halls: [{ id: "hall-a", capacity: null }],
    })
    expect(result.blockingCount).toBeGreaterThanOrEqual(1)
    expect(result.conflicts.some((c) => c.type === "hall_double_booking")).toBe(true)
    expect(result.conflicts.some((c) => c.type === "no_speaker")).toBe(true)
  })

  it("returns zero conflicts for a clean, fully-staffed, non-overlapping schedule", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const result = getAllConflicts({
      sessions: [{ ...s1, registeredCount: 0 }],
      assignments: [{ session_id: "s1", faculty_id: "fac-1", faculty_name: "Dr. Test", status: "confirmed" }],
      halls: [{ id: "hall-a", capacity: null }],
    })
    expect(result.conflicts).toHaveLength(0)
    expect(result.blockingCount).toBe(0)
    expect(result.warningCount).toBe(0)
  })
})
