import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { getAllConflicts, type ConflictSession, type FacultyAssignmentRow, type HallCapacity } from "@/lib/agenda-conflicts"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any

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

  if (sessionsResult.error || assignmentsResult.error || hallsResult.error) {
    return NextResponse.json({ error: "Failed to fetch conflict inputs" }, { status: 500 })
  }

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

  const assignments: FacultyAssignmentRow[] = assignmentsResult.data ?? []
  const halls: HallCapacity[] = hallsResult.data ?? []

  const result = getAllConflicts({ sessions, assignments, halls })

  return NextResponse.json({
    success: true,
    summary: {
      total_conflicts: result.conflicts.length,
      blocking_count: result.blockingCount,
      warning_count: result.warningCount,
    },
    conflicts: result.conflicts,
  })
}
