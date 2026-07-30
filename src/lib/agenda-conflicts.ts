// Pure, framework-free conflict detection for the Agenda Builder's
// Conflicts & Readiness screen (see docs/superpowers/specs/2026-07-30-
// agenda-builder-data-model-design.md, section 6). No database access --
// callers (API routes) fetch sessions/assignments and pass plain data in.

export interface ConflictSession {
  id: string
  session_name: string
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall_id: string | null
}

export interface FacultyAssignmentRow {
  session_id: string
  faculty_id: string | null
  faculty_name: string | null
  status: string
}

export type ConflictType =
  | "hall_double_booking"
  | "faculty_double_booking"
  | "no_speaker"
  | "unconfirmed_speaker"
  | "over_capacity"
  | "unscheduled"

export type ConflictSeverity = "blocking" | "warning"

export interface Conflict {
  type: ConflictType
  severity: ConflictSeverity
  session_ids: string[]
  message: string
}

function toMinutes(time: string | null): number | null {
  if (!time || !time.includes(":")) return null
  const [h, m] = time.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

function sessionsOverlap(a: ConflictSession, b: ConflictSession): boolean {
  if (!a.session_date || !b.session_date || a.session_date !== b.session_date) return false
  const aStart = toMinutes(a.start_time)
  const aEnd = toMinutes(a.end_time)
  const bStart = toMinutes(b.start_time)
  const bEnd = toMinutes(b.end_time)
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd)
}

export function findHallDoubleBookings(sessions: ConflictSession[]): Conflict[] {
  const conflicts: Conflict[] = []
  const withHall = sessions.filter((s) => s.hall_id)
  for (let i = 0; i < withHall.length; i++) {
    for (let j = i + 1; j < withHall.length; j++) {
      const a = withHall[i]
      const b = withHall[j]
      if (a.hall_id !== b.hall_id) continue
      if (!sessionsOverlap(a, b)) continue
      conflicts.push({
        type: "hall_double_booking",
        severity: "blocking",
        session_ids: [a.id, b.id],
        message: `"${a.session_name}" and "${b.session_name}" overlap in the same hall`,
      })
    }
  }
  return conflicts
}

export function findFacultyDoubleBookings(
  sessions: ConflictSession[],
  assignments: FacultyAssignmentRow[]
): Conflict[] {
  const sessionsById = new Map(sessions.map((s) => [s.id, s]))
  const sessionsByFaculty = new Map<string, string[]>()

  for (const a of assignments) {
    if (!a.faculty_id) continue
    if (!sessionsById.has(a.session_id)) continue
    const list = sessionsByFaculty.get(a.faculty_id) ?? []
    list.push(a.session_id)
    sessionsByFaculty.set(a.faculty_id, list)
  }

  const conflicts: Conflict[] = []
  for (const [, sessionIds] of sessionsByFaculty) {
    for (let i = 0; i < sessionIds.length; i++) {
      for (let j = i + 1; j < sessionIds.length; j++) {
        const a = sessionsById.get(sessionIds[i])!
        const b = sessionsById.get(sessionIds[j])!
        if (!sessionsOverlap(a, b)) continue
        conflicts.push({
          type: "faculty_double_booking",
          severity: "warning",
          session_ids: [a.id, b.id],
          message: `A faculty member is scheduled in both "${a.session_name}" and "${b.session_name}" at overlapping times`,
        })
      }
    }
  }
  return conflicts
}

export function findUnassignedSessions(
  sessions: ConflictSession[],
  assignments: FacultyAssignmentRow[]
): Conflict[] {
  const sessionIdsWithAssignment = new Set(assignments.map((a) => a.session_id))
  return sessions
    .filter((s) => !sessionIdsWithAssignment.has(s.id))
    .map((s) => ({
      type: "no_speaker" as const,
      severity: "warning" as const,
      session_ids: [s.id],
      message: `"${s.session_name}" has no speaker assigned`,
    }))
}

export function findUnconfirmedSpeakers(
  sessions: ConflictSession[],
  assignments: FacultyAssignmentRow[]
): Conflict[] {
  const sessionsById = new Map(sessions.map((s) => [s.id, s]))
  const unconfirmedBySession = new Set(
    assignments.filter((a) => a.status !== "confirmed" && a.status !== "declined" && a.status !== "cancelled").map((a) => a.session_id)
  )
  return [...unconfirmedBySession]
    .filter((id) => sessionsById.has(id))
    .map((id) => ({
      type: "unconfirmed_speaker" as const,
      severity: "warning" as const,
      session_ids: [id],
      message: `"${sessionsById.get(id)!.session_name}" has a speaker who hasn't confirmed yet`,
    }))
}

export interface HallCapacity {
  id: string
  capacity: number | null
}

export function findOverCapacitySessions(
  sessions: (ConflictSession & { registeredCount: number })[],
  halls: HallCapacity[]
): Conflict[] {
  const capacityByHall = new Map(halls.map((h) => [h.id, h.capacity]))
  return sessions
    .filter((s) => {
      if (!s.hall_id) return false
      const capacity = capacityByHall.get(s.hall_id)
      return capacity != null && s.registeredCount > capacity
    })
    .map((s) => ({
      type: "over_capacity" as const,
      severity: "warning" as const,
      session_ids: [s.id],
      message: `"${s.session_name}" has ${s.registeredCount} registered against a hall capacity of ${capacityByHall.get(s.hall_id!)}`,
    }))
}

export function findUnscheduledSessions(sessions: ConflictSession[]): Conflict[] {
  return sessions
    .filter((s) => !s.hall_id || !s.session_date || !s.start_time || !s.end_time)
    .map((s) => ({
      type: "unscheduled" as const,
      severity: "warning" as const,
      session_ids: [s.id],
      message: `"${s.session_name}" is missing a hall, date, or time`,
    }))
}

export function getAllConflicts(input: {
  sessions: (ConflictSession & { registeredCount: number })[]
  assignments: FacultyAssignmentRow[]
  halls: HallCapacity[]
}): { conflicts: Conflict[]; blockingCount: number; warningCount: number } {
  const conflicts = [
    ...findHallDoubleBookings(input.sessions),
    ...findFacultyDoubleBookings(input.sessions, input.assignments),
    ...findUnassignedSessions(input.sessions, input.assignments),
    ...findUnconfirmedSpeakers(input.sessions, input.assignments),
    ...findOverCapacitySessions(input.sessions, input.halls),
    ...findUnscheduledSessions(input.sessions),
  ]
  return {
    conflicts,
    blockingCount: conflicts.filter((c) => c.severity === "blocking").length,
    warningCount: conflicts.filter((c) => c.severity === "warning").length,
  }
}
