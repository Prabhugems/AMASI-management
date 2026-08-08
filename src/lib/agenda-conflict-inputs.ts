// Shared data-fetching for conflict detection, consumed by both
// GET /api/events/[eventId]/conflicts (Task 14) and the "submitted" action
// of POST /api/events/[eventId]/agenda-approval (Task 15). Pure I/O wrapper
// around getAllConflicts's expected input shape (src/lib/agenda-conflicts.ts) --
// this file itself does the fetching; agenda-conflicts.ts stays I/O-free.

import type { ConflictSession, FacultyAssignmentRow, HallCapacity } from "./agenda-conflicts"
import { fetchAllPages } from "./supabase/fetch-all-pages"

export interface ConflictInputs {
  sessions: (ConflictSession & { registeredCount: number })[]
  assignments: FacultyAssignmentRow[]
  halls: HallCapacity[]
}

export async function fetchConflictInputs(supabase: any, eventId: string): Promise<ConflictInputs> {
  // Every list is paged. Sessions reach 1,195 on one archived event and
  // assignments 885, so an unpaged read would silently return 1,000 and
  // under-report conflicts on exactly the largest programme — the same failure
  // that left 195 sessions unlinked in the halls backfill.
  const [sessions, assignments, halls, checkinRows] = await Promise.all([
    fetchAllPages<any>(
      supabase
        .from("sessions")
        .select("id, session_name, session_date, start_time, end_time, hall_id")
        .eq("event_id", eventId)
    ),
    fetchAllPages<FacultyAssignmentRow>(
      supabase
        .from("faculty_assignments")
        .select("session_id, faculty_id, faculty_name, status")
        .eq("event_id", eventId)
    ),
    // parent_id and name are needed by findHallDoubleBookings: without the
    // parent link it cannot tell two screens of one hall apart from one hall
    // booked twice, and without the name it cannot say which room.
    fetchAllPages<HallCapacity>(
      supabase.from("halls").select("id, capacity, parent_id, name").eq("event_id", eventId)
    ),
    fetchAllPages<any>(
      supabase
        .from("checkin_records")
        .select("checkin_list_id, checkin_lists!inner(session_id)")
        .not("checkin_lists.session_id", "is", null)
        .eq("checkin_lists.event_id", eventId)
    ),
  ])

  const registeredCountBySession = new Map<string, number>()
  for (const row of checkinRows) {
    const sessionId = row.checkin_lists?.session_id
    if (!sessionId) continue
    registeredCountBySession.set(sessionId, (registeredCountBySession.get(sessionId) ?? 0) + 1)
  }

  return {
    sessions: sessions.map((s: any) => ({
      id: s.id,
      session_name: s.session_name,
      session_date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      hall_id: s.hall_id,
      registeredCount: registeredCountBySession.get(s.id) ?? 0,
    })),
    assignments,
    halls,
  }
}
