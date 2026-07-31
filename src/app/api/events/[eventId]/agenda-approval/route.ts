import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { deriveAgendaStatus, getLastApprovalTimestamp, canSubmitForApproval, type ApprovalLogRow } from "@/lib/agenda-approval-state"
import { getAllConflicts, type ConflictSession, type FacultyAssignmentRow, type HallCapacity } from "@/lib/agenda-conflicts"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any

  const { data: log, error: logError } = await supabase
    .from("agenda_approval_log")
    .select("action, created_at, actor_user_id, comment")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })

  if (logError) return NextResponse.json({ error: "Failed to fetch approval log" }, { status: 500 })

  const status = deriveAgendaStatus(log as ApprovalLogRow[])
  const lastApprovedAt = getLastApprovalTimestamp(log as ApprovalLogRow[])

  const { data: changesSinceApproval } = lastApprovedAt
    ? await supabase
        .from("program_change_log")
        .select("*")
        .eq("event_id", eventId)
        .gt("created_at", lastApprovedAt)
        .order("created_at", { ascending: false })
    : { data: [] }

  return NextResponse.json({
    status,
    last_approved_at: lastApprovedAt,
    changes_since_approval: changesSinceApproval ?? [],
    log,
  })
}

const postSchema = z.object({
  action: z.enum(["submitted", "approved", "changes_requested", "published"]),
  comment: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError, user } = await requireEventAndPermission(eventId, "program")
  if (authError || !user) return authError ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any

  if (parsed.data.action === "submitted") {
    const [sessionsResult, assignmentsResult, hallsResult, checkinCountsResult] = await Promise.all([
      supabase.from("sessions").select("id, session_name, session_date, start_time, end_time, hall_id").eq("event_id", eventId),
      supabase.from("faculty_assignments").select("session_id, faculty_id, faculty_name, status").eq("event_id", eventId),
      supabase.from("halls").select("id, capacity").eq("event_id", eventId),
      supabase
        .from("checkin_records")
        .select("checkin_list_id, checkin_lists!inner(session_id)")
        .not("checkin_lists.session_id", "is", null)
        .eq("checkin_lists.event_id", eventId),
    ])

    // Mirrors the same registered-count computation as the GET /conflicts
    // route (Task 14) -- duplicated rather than imported because the two
    // routes have different auth/response shapes; both call the same
    // getAllConflicts() for the actual conflict logic.
    const registeredCountBySession = new Map<string, number>()
    for (const row of checkinCountsResult.data ?? []) {
      const sessionId = row.checkin_lists?.session_id
      if (!sessionId) continue
      registeredCountBySession.set(sessionId, (registeredCountBySession.get(sessionId) ?? 0) + 1)
    }

    const sessions: (ConflictSession & { registeredCount: number })[] = (sessionsResult.data ?? []).map((s: any) => ({
      ...s,
      registeredCount: registeredCountBySession.get(s.id) ?? 0,
    }))
    const assignments: FacultyAssignmentRow[] = assignmentsResult.data ?? []
    const halls: HallCapacity[] = hallsResult.data ?? []

    const { conflicts } = getAllConflicts({ sessions, assignments, halls })
    if (!canSubmitForApproval(conflicts)) {
      return NextResponse.json(
        { error: "Cannot submit for approval while blocking conflicts exist", conflicts: conflicts.filter((c) => c.severity === "blocking") },
        { status: 409 }
      )
    }
  }

  const { data, error } = await supabase
    .from("agenda_approval_log")
    .insert({
      event_id: eventId,
      action: parsed.data.action,
      actor_user_id: user.id,
      comment: parsed.data.comment ?? null,
    })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: "Failed to record approval action" }, { status: 500 })
  return NextResponse.json({ data, status: deriveAgendaStatus([{ action: parsed.data.action, created_at: data.created_at }]) })
}
