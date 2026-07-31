import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { deriveAgendaStatus, getLastApprovalTimestamp, canSubmitForApproval, type ApprovalLogRow } from "@/lib/agenda-approval-state"
import { getAllConflicts } from "@/lib/agenda-conflicts"
import { fetchConflictInputs } from "@/lib/agenda-conflict-inputs"

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
    let conflicts
    try {
      const inputs = await fetchConflictInputs(supabase, eventId)
      conflicts = getAllConflicts(inputs).conflicts
    } catch {
      return NextResponse.json({ error: "Failed to check conflicts before submission" }, { status: 500 })
    }

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
