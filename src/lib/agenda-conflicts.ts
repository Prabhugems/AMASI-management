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
  | "parallel_use"
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

/** Enough of a hall to know where it sits in the venue tree. */
export interface HallRef {
  id: string
  name?: string | null
  parent_id?: string | null
}

/**
 * Do two sessions compete for the same physical space?
 *
 * Not simply "same hall_id", because a hall can be split into screens:
 *   same location                      -> yes
 *   two different screens of one hall  -> NO, that is what screens are for
 *   the parent hall and one of its own screens -> yes, the room is taken
 */
function sharesSpace(
  a: ConflictSession,
  b: ConflictSession,
  parentOf: Map<string, string | null>
): boolean {
  if (!a.hall_id || !b.hall_id) return false
  if (a.hall_id === b.hall_id) return true
  return parentOf.get(a.hall_id) === b.hall_id || parentOf.get(b.hall_id) === a.hall_id
}

/**
 * Clashes over physical space.
 *
 * WHY THIS IS NOT "ANY TWO OVERLAPPING SESSIONS IN ONE HALL"
 *
 * That rule reported 174 blocking clashes on AMASICON 2026 and every one but
 * three was wrong. HALL 2 runs a hands-on workshop: "Lap TAPP", "IPOM Plus",
 * "Proctology-Laser" and three more, all 09:00-11:00 on 28 Aug, delegates
 * rotating between stations. The hall is not double-booked; it is being used
 * exactly as designed. And because blocking conflicts gate submit-for-approval,
 * that programme could never have been submitted.
 *
 * The data separates the two cases cleanly: of those 174 pairs, 171 shared an
 * IDENTICAL start and end, and 3 overlapped only partially. Sessions given the
 * very same slot in the same room are a deliberate parallel block. Sessions
 * that merely run into each other are the shape a scheduling mistake takes —
 * the three real ones here are talks starting at 15:30 while the Presidential
 * Oration runs to 15:40 in the same hall.
 *
 * So:
 *   identical times, same location -> ONE `parallel_use` warning for the group,
 *                                     naming it, suggesting screens if it was
 *                                     not intended. Never blocking.
 *   partial overlap                -> `hall_double_booking`, blocking.
 *
 * Reporting the parallel case once per group rather than once per pair also
 * turns 171 findings into 1: six stations produce fifteen pairs, and fifteen
 * copies of the same fact is not information.
 */
export function findHallDoubleBookings(
  sessions: ConflictSession[],
  halls: readonly HallRef[] = []
): Conflict[] {
  const parentOf = new Map<string, string | null>(
    halls.map((h) => [h.id, h.parent_id ?? null])
  )
  const hallName = new Map<string, string>(
    halls.filter((h) => h.name).map((h) => [h.id, h.name as string])
  )

  const withHall = sessions.filter((s) => s.hall_id && s.session_date)
  const conflicts: Conflict[] = []

  // 1. Groups sharing one exact slot in one location — parallel by design.
  const slots = new Map<string, ConflictSession[]>()
  for (const s of withHall) {
    if (!s.start_time || !s.end_time) continue
    const key = `${s.hall_id}::${s.session_date}::${s.start_time}::${s.end_time}`
    slots.set(key, [...(slots.get(key) ?? []), s])
  }

  const inParallelGroup = new Set<string>()
  for (const group of slots.values()) {
    if (group.length < 2) continue
    for (const s of group) inParallelGroup.add(s.id)
    const first = group[0]
    const where = hallName.get(first.hall_id!) ?? "the same hall"
    conflicts.push({
      type: "parallel_use",
      severity: "warning",
      session_ids: group.map((s) => s.id),
      message:
        `${group.length} sessions run at the same time in ${where} ` +
        `(${first.start_time?.slice(0, 5)}–${first.end_time?.slice(0, 5)}). ` +
        `If they run in parallel that is fine — give each one its own screen to make it explicit.`,
    })
  }

  // 2. Everything else that competes for the same space — a real clash.
  for (let i = 0; i < withHall.length; i++) {
    for (let j = i + 1; j < withHall.length; j++) {
      const a = withHall[i]
      const b = withHall[j]
      if (!sharesSpace(a, b, parentOf)) continue
      if (!sessionsOverlap(a, b)) continue

      // Already reported once, as a group.
      const sameSlot =
        a.hall_id === b.hall_id && a.start_time === b.start_time && a.end_time === b.end_time
      if (sameSlot && inParallelGroup.has(a.id) && inParallelGroup.has(b.id)) continue

      conflicts.push({
        type: "hall_double_booking",
        severity: "blocking",
        session_ids: [a.id, b.id],
        message:
          a.hall_id === b.hall_id
            ? `"${a.session_name}" and "${b.session_name}" overlap in the same hall`
            : `"${a.session_name}" and "${b.session_name}" overlap — one is in a hall, the other on a screen inside it`,
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
  /** Set on a screen, naming the hall that contains it. */
  parent_id?: string | null
  name?: string | null
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
    ...findHallDoubleBookings(input.sessions, input.halls),
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
