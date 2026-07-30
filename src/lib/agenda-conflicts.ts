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
