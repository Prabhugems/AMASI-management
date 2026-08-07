import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

const TALK_TYPES = ["talk", "panel", "discussion", "video", "break"] as const

const patchSchema = z.object({
  title: z.string().nullable().optional(),
  talk_type: z.enum(TALK_TYPES).optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  duration_minutes: z.number().int().positive().nullable().optional(),
  display_order: z.number().int().optional(),
  notes: z.string().nullable().optional(),
})
// `session_id` and `event_id` are deliberately not patchable. Moving a talk
// between blocks would carry its assignments and role requirements with it into
// a block that may not want them; the Session Builder offers no such action.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; talkId: string }> }
) {
  const { eventId, talkId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any
  const { data, error } = await supabase
    .from("talks")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", talkId)
    .eq("event_id", eventId)
    .select("*")
    .maybeSingle()

  if (error) return NextResponse.json({ error: "Failed to update talk" }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Talk not found" }, { status: 404 })
  return NextResponse.json({ data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; talkId: string }> }
) {
  const { eventId, talkId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any

  const { data: talk } = await supabase
    .from("talks")
    .select("id")
    .eq("id", talkId)
    .eq("event_id", eventId)
    .maybeSingle()

  if (!talk) return NextResponse.json({ error: "Talk not found" }, { status: 404 })

  // Both faculty_assignments.talk_id and session_role_requirements.talk_id are
  // ON DELETE CASCADE, so the people and the roster go with the talk. Counted
  // first so the caller can say what it removed rather than a bare "Deleted".
  const [{ count: assignmentCount }, { count: requirementCount }] = await Promise.all([
    supabase.from("faculty_assignments").select("id", { count: "exact", head: true }).eq("talk_id", talkId),
    supabase.from("session_role_requirements").select("id", { count: "exact", head: true }).eq("talk_id", talkId),
  ])

  const { error } = await supabase.from("talks").delete().eq("id", talkId).eq("event_id", eventId)
  if (error) return NextResponse.json({ error: "Failed to delete talk" }, { status: 500 })

  return NextResponse.json({
    success: true,
    removed: { assignments: assignmentCount ?? 0, requirements: requirementCount ?? 0 },
  })
}
