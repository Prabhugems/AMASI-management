import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

const ACTIONS = ["publish", "unpublish", "delete", "answer"] as const
type Action = (typeof ACTIONS)[number]

// GET /api/events/[eventId]/session-qa?session_id=...
// Admin list of Q&A for the event, both published and unpublished, ordered by asked_at DESC.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "speakers")
  if (authError) return authError

  const url = new URL(request.url)
  const sessionId = url.searchParams.get("session_id")

  try {
    const supabase = await createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("session_qa")
      .select(
        `id, session_id, event_id, session_speaker_id, asked_by_name, asked_by_email,
         question, answer, is_anonymous, is_published, upvotes, asked_at, answered_at,
         answered_by_faculty_id,
         session:sessions ( id, session_name, session_date, hall )`
      )
      .eq("event_id", eventId)
      .order("asked_at", { ascending: false })

    if (sessionId) query = query.eq("session_id", sessionId)

    const { data, error } = await query
    if (error) {
      console.error("admin session-qa list error", { eventId, error })
      return NextResponse.json({ error: "Failed to load Q&A" }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    console.error("admin session-qa GET error", { eventId, error: e })
    return NextResponse.json({ error: "Failed to load Q&A" }, { status: 500 })
  }
}

// PATCH /api/events/[eventId]/session-qa
// Bulk moderation. Body: { ids: string[], action, payload? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "speakers")
  if (authError) return authError

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const ids = body.ids
  const action = body.action as Action | undefined
  const payload = (body.payload as Record<string, unknown> | undefined) ?? {}

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((v) => typeof v === "string")) {
    return NextResponse.json({ error: "ids must be a non-empty array of strings" }, { status: 400 })
  }
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${ACTIONS.join(", ")}` },
      { status: 400 }
    )
  }

  try {
    const supabase = await createAdminClient()

    if (action === "delete") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("session_qa")
        .delete()
        .in("id", ids)
        .eq("event_id", eventId)
      if (error) {
        console.error("session-qa bulk delete error", { eventId, error })
        return NextResponse.json({ error: "Failed to delete Q&A" }, { status: 500 })
      }
      return NextResponse.json({ success: true, count: ids.length })
    }

    let update: Record<string, unknown> = {}
    if (action === "publish") update = { is_published: true }
    else if (action === "unpublish") update = { is_published: false }
    else if (action === "answer") {
      const answer = typeof payload.answer === "string" ? payload.answer.trim() : null
      if (!answer) {
        return NextResponse.json(
          { error: "payload.answer is required for answer action" },
          { status: 400 }
        )
      }
      update = {
        answer,
        answered_at: new Date().toISOString(),
        answered_by_faculty_id:
          typeof payload.answered_by_faculty_id === "string"
            ? payload.answered_by_faculty_id
            : null,
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("session_qa")
      .update(update)
      .in("id", ids)
      .eq("event_id", eventId)
      .select("id")

    if (error) {
      console.error("session-qa bulk update error", { eventId, action, error })
      return NextResponse.json({ error: "Failed to update Q&A" }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: (data ?? []).length })
  } catch (e) {
    console.error("session-qa PATCH error", { eventId, error: e })
    return NextResponse.json({ error: "Failed to update Q&A" }, { status: 500 })
  }
}
