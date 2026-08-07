import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// Reordering the running order of talks within one block.
//
// Takes the block plus its complete, ordered list of talk ids rather than a
// pair of positions: the client already knows the order it wants after a drag,
// and sending the whole list makes the write idempotent and removes any
// question of what happens when two edits interleave.

const reorderSchema = z.object({
  session_id: z.string().uuid(),
  talk_ids: z.array(z.string().uuid()).min(1).max(200),
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

  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const { session_id, talk_ids } = parsed.data

  if (new Set(talk_ids).size !== talk_ids.length) {
    return NextResponse.json({ error: "Duplicate talk ids in the order" }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any

  const { data: existing, error: fetchError } = await supabase
    .from("talks")
    .select("id")
    .eq("session_id", session_id)
    .eq("event_id", eventId)

  if (fetchError) return NextResponse.json({ error: "Failed to load talks" }, { status: 500 })

  const existingIds = new Set(((existing ?? []) as Array<{ id: string }>).map((t) => t.id))

  // Every id must belong to this block in this event. Reordering a talk into a
  // block it is not part of would silently move it, and a partial list would
  // leave the unnamed talks with stale positions colliding against the new ones.
  if (talk_ids.length !== existingIds.size || talk_ids.some((id) => !existingIds.has(id))) {
    return NextResponse.json(
      { error: "The order must list exactly the talks in this block" },
      { status: 400 }
    )
  }

  // Sequential rather than batched: PostgREST has no multi-row update with
  // per-row values, and a block holds a handful of talks, not thousands.
  for (let i = 0; i < talk_ids.length; i++) {
    const { error } = await supabase
      .from("talks")
      .update({ display_order: i, updated_at: new Date().toISOString() })
      .eq("id", talk_ids[i])
      .eq("event_id", eventId)
    if (error) return NextResponse.json({ error: "Failed to reorder talks" }, { status: 500 })
  }

  return NextResponse.json({ success: true, order: talk_ids })
}
