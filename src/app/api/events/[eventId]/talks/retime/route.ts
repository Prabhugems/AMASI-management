import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// Re-timing several talks in one request.
//
// A ripple — change one duration, everything after it moves — touches most of a
// session at once. Twenty separate PATCHes would leave the programme visibly
// half-moved if one failed partway, and would make the page flicker through
// every intermediate state.
//
// Every id is verified to belong to the named block before anything is written,
// so a partial application cannot arise from an id the caller had no business
// sending.

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const retimeSchema = z.object({
  session_id: z.string().uuid(),
  changes: z
    .array(
      z.object({
        id: z.string().uuid(),
        start_time: z.string().regex(HHMM, "Expected HH:MM"),
        end_time: z.string().regex(HHMM, "Expected HH:MM"),
      })
    )
    .min(1)
    .max(200),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = retimeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const { session_id, changes } = parsed.data

  const ids = changes.map((c) => c.id)
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "The same talk appears twice" }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any

  const { data: owned, error: fetchError } = await supabase
    .from("talks")
    .select("id")
    .eq("session_id", session_id)
    .eq("event_id", eventId)

  if (fetchError) return NextResponse.json({ error: "Failed to load talks" }, { status: 500 })

  const ownedIds = new Set(((owned ?? []) as Array<{ id: string }>).map((t) => t.id))
  const stranger = ids.find((id) => !ownedIds.has(id))
  if (stranger) {
    return NextResponse.json(
      { error: "Every talk must belong to this session" },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  for (const c of changes) {
    const { error } = await supabase
      .from("talks")
      .update({ start_time: c.start_time, end_time: c.end_time, updated_at: now })
      .eq("id", c.id)
      .eq("event_id", eventId)
    if (error) {
      // Ownership was checked up front, so reaching here means a genuine write
      // failure rather than a bad id. Report how far it got.
      return NextResponse.json(
        { error: "Failed to re-time the session", applied: changes.indexOf(c) },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ success: true, applied: changes.length })
}
