import { describe, it, expect } from "vitest"
import { findHallDoubleBookings, findFacultyDoubleBookings, type ConflictSession, type FacultyAssignmentRow } from "./agenda-conflicts"

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
