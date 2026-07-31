// Shared data-fetching for conflict detection, consumed by both
// GET /api/events/[eventId]/conflicts (Task 14) and the "submitted" action
// of POST /api/events/[eventId]/agenda-approval (Task 15). Pure I/O wrapper
// around getAllConflicts's expected input shape (src/lib/agenda-conflicts.ts) --
// this file itself does the fetching; agenda-conflicts.ts stays I/O-free.

import type { ConflictSession, FacultyAssignmentRow, HallCapacity } from "./agenda-conflicts"

export interface ConflictInputs {
  sessions: (ConflictSession & { registeredCount: number })[]
  assignments: FacultyAssignmentRow[]
  halls: HallCapacity[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchConflictInputs(supabase: any, eventId: string): Promise<ConflictInputs> {
  const [sessionsResult, assignmentsResult, hallsResult, checkinCountsResult] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, session_name, session_date, start_time, end_time, hall_id")
      .eq("event_id", eventId),
    supabase
      .from("faculty_assignments")
      .select("session_id, faculty_id, faculty_name, status")
      .eq("event_id", eventId),
    supabase.from("halls").select("id, capacity").eq("event_id", eventId),
    supabase
      .from("checkin_records")
      .select("checkin_list_id, checkin_lists!inner(session_id)")
      .not("checkin_lists.session_id", "is", null)
      .eq("checkin_lists.event_id", eventId),
  ])

  if (sessionsResult.error) throw new Error(`Failed to fetch sessions: ${sessionsResult.error.message}`)
  if (assignmentsResult.error) throw new Error(`Failed to fetch faculty_assignments: ${assignmentsResult.error.message}`)
  if (hallsResult.error) throw new Error(`Failed to fetch halls: ${hallsResult.error.message}`)
  if (checkinCountsResult.error) throw new Error(`Failed to fetch checkin counts: ${checkinCountsResult.error.message}`)

  const registeredCountBySession = new Map<string, number>()
  for (const row of checkinCountsResult.data ?? []) {
    const sessionId = row.checkin_lists?.session_id
    if (!sessionId) continue
    registeredCountBySession.set(sessionId, (registeredCountBySession.get(sessionId) ?? 0) + 1)
  }

  const sessions: (ConflictSession & { registeredCount: number })[] = (sessionsResult.data ?? []).map((s: any) => ({
    id: s.id,
    session_name: s.session_name,
    session_date: s.session_date,
    start_time: s.start_time,
    end_time: s.end_time,
    hall_id: s.hall_id,
    registeredCount: registeredCountBySession.get(s.id) ?? 0,
  }))

  return {
    sessions,
    assignments: assignmentsResult.data ?? [],
    halls: hallsResult.data ?? [],
  }
}
