import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages"
import { FACULTY_ROLES } from "@/lib/agenda-roles"

// Role requirements — what a block or a talk NEEDS, per role.
//
// Edited as a SET rather than row by row, because that is how the design
// presents it: "Who does this session need?" is a list of role rows you add to
// and remove from, and a PUT that replaces the set for one owner keeps the API
// shaped like the screen. Row-level CRUD would mean the client orchestrating
// three calls to express one edit.

const roleEnum = z.enum(FACULTY_ROLES)

const putSchema = z.object({
  session_id: z.string().uuid(),
  /** Null or omitted addresses the block itself (a chairperson lives there). */
  talk_id: z.string().uuid().nullable().optional(),
  requirements: z
    .array(
      z.object({
        role: roleEnum,
        // 0 is legal and meaningful: an explicit "this needs no chair",
        // distinct from never having declared one.
        required_count: z.number().int().min(0).max(50),
        notes: z.string().nullable().optional(),
      })
    )
    .max(FACULTY_ROLES.length),
})

// GET /api/events/[eventId]/role-requirements[?session_id=...]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const sessionId = new URL(request.url).searchParams.get("session_id")
  const supabase = (await createAdminClient()) as any

  // session_role_requirements has no event_id of its own -- it hangs off the
  // session -- so scope through the event's sessions rather than trusting a
  // caller-supplied id. Both reads are paged: the session list alone reaches
  // 1,195 on one archived event, and requirements outnumber sessions because
  // every talk carries its own.
  try {
    const sessions = await fetchAllPages<{ id: string }>(
      supabase.from("sessions").select("id").eq("event_id", eventId)
    )
    const sessionIds = sessions.map((s) => s.id)
    if (sessionIds.length === 0) return NextResponse.json({ data: [] })

    let query = supabase.from("session_role_requirements").select("*").in("session_id", sessionIds)
    if (sessionId) query = query.eq("session_id", sessionId)

    return NextResponse.json({ data: await fetchAllPages(query) })
  } catch {
    return NextResponse.json({ error: "Failed to fetch role requirements" }, { status: 500 })
  }
}

/** Replace the whole requirement set for one block or one talk. */
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

  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const { session_id, requirements } = parsed.data
  const talkId = parsed.data.talk_id ?? null

  // A role may appear once per owner. Two "Speaker" rows on one talk is a
  // client bug, and the partial unique indexes would reject it anyway -- better
  // to say so plainly than to surface a 23505.
  const roles = requirements.map((r) => r.role)
  if (new Set(roles).size !== roles.length) {
    return NextResponse.json({ error: "Each role can only be listed once" }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any

  const { data: block } = await supabase
    .from("sessions")
    .select("id, event_id")
    .eq("id", session_id)
    .maybeSingle()

  if (!block || block.event_id !== eventId) {
    return NextResponse.json({ error: "Session not found for this event" }, { status: 404 })
  }

  if (talkId) {
    const { data: talk } = await supabase
      .from("talks")
      .select("id, session_id, event_id")
      .eq("id", talkId)
      .maybeSingle()

    // The talk must belong to this event AND to the block being addressed --
    // otherwise a requirement could be hung on a talk in a different block.
    if (!talk || talk.event_id !== eventId || talk.session_id !== session_id) {
      return NextResponse.json({ error: "Talk not found for this session" }, { status: 404 })
    }
  }

  // Replace rather than merge: the client sent the complete set it wants, and a
  // role it omitted is a role it removed.
  let del = supabase.from("session_role_requirements").delete().eq("session_id", session_id)
  del = talkId ? del.eq("talk_id", talkId) : del.is("talk_id", null)
  const { error: deleteError } = await del
  if (deleteError) {
    return NextResponse.json({ error: "Failed to update role requirements" }, { status: 500 })
  }

  if (requirements.length === 0) return NextResponse.json({ data: [] })

  const { data, error } = await supabase
    .from("session_role_requirements")
    .insert(
      requirements.map((r) => ({
        session_id,
        talk_id: talkId,
        role: r.role,
        required_count: r.required_count,
        notes: r.notes ?? null,
      }))
    )
    .select("*")

  if (error) return NextResponse.json({ error: "Failed to update role requirements" }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
