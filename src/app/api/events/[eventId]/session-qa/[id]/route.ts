import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// Whitelisted updatable fields for single Q&A.
const ALLOWED_FIELDS = new Set([
  "answer",
  "answered_at",
  "answered_by_faculty_id",
  "is_published",
])

// PATCH /api/events/[eventId]/session-qa/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  const { eventId, id } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "speakers")
  if (authError) return authError

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      update[key] = body[key]
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 })
  }

  // If answer is being set and answered_at is not explicitly provided, set it.
  if (
    typeof update.answer === "string" &&
    update.answer.trim().length > 0 &&
    update.answered_at === undefined
  ) {
    update.answered_at = new Date().toISOString()
  }

  if (typeof update.answer === "string") {
    const trimmed = update.answer.trim()
    update.answer = trimmed.length === 0 ? null : trimmed
  }

  try {
    const supabase = await createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("session_qa")
      .update(update)
      .eq("id", id)
      .eq("event_id", eventId)
      .select()
      .single()

    if (error) {
      console.error("session-qa PATCH error", { eventId, id, error })
      return NextResponse.json({ error: "Failed to update Q&A" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Q&A not found" }, { status: 404 })
    }

    return NextResponse.json({ data, success: true })
  } catch (e) {
    console.error("session-qa PATCH error", { eventId, id, error: e })
    return NextResponse.json({ error: "Failed to update Q&A" }, { status: 500 })
  }
}

// DELETE /api/events/[eventId]/session-qa/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  const { eventId, id } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "speakers")
  if (authError) return authError

  try {
    const supabase = await createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("session_qa")
      .delete()
      .eq("id", id)
      .eq("event_id", eventId)

    if (error) {
      console.error("session-qa DELETE error", { eventId, id, error })
      return NextResponse.json({ error: "Failed to delete Q&A" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("session-qa DELETE error", { eventId, id, error: e })
    return NextResponse.json({ error: "Failed to delete Q&A" }, { status: 500 })
  }
}
