import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.number().int().positive().nullable().optional(),
  floor: z.string().nullable().optional(),
  display_order: z.number().int().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; hallId: string }> }
) {
  const { eventId, hallId } = await params
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

  // `parent_id` and `kind` are deliberately not patchable. Re-parenting a room
  // mid-event would silently move every session placed in it, and the UI offers
  // no such action -- a screen is created under its hall and stays there.
  const supabase = (await createAdminClient()) as any
  const { data, error } = await supabase
    .from("halls")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", hallId)
    .eq("event_id", eventId)
    .select("*")
    .single()

  if (error) {
    // Renaming a room onto a sibling's name. The unique indexes in
    // 20260808_halls_unique_name.sql catch this regardless of client.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: `Another room here is already called ${parsed.data.name}.` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: "Failed to update hall" }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Hall not found" }, { status: 404 })
  return NextResponse.json({ data })
}

/**
 * Count what a delete is about to affect, so the confirm dialog can be specific
 * rather than vague. The mock warns "Sessions already placed there will need a
 * new location" -- this is what lets it say how many.
 *
 * Counts the hall and its screens together, because removing a hall removes its
 * screens with it (halls.parent_id is ON DELETE CASCADE).
 */
async function countImpact(supabase: any, eventId: string, hallId: string) {
  const { data: children } = await supabase
    .from("halls")
    .select("id")
    .eq("event_id", eventId)
    .eq("parent_id", hallId)

  const ids = [hallId, ...((children ?? []) as Array<{ id: string }>).map((c) => c.id)]

  const { count: sessionCount } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .in("hall_id", ids)

  const { count: coordinatorCount } = await supabase
    .from("hall_coordinators")
    .select("id", { count: "exact", head: true })
    .in("hall_id", ids)

  return {
    screens: ids.length - 1,
    sessions: sessionCount ?? 0,
    coordinators: coordinatorCount ?? 0,
  }
}

// GET /api/events/[eventId]/halls/[hallId]?impact=1
// Returns what a delete would affect, without deleting anything.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; hallId: string }> }
) {
  const { eventId, hallId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any
  const { data: hall } = await supabase
    .from("halls")
    .select("id, name")
    .eq("id", hallId)
    .eq("event_id", eventId)
    .maybeSingle()

  if (!hall) return NextResponse.json({ error: "Hall not found" }, { status: 404 })

  return NextResponse.json({ data: { ...hall, impact: await countImpact(supabase, eventId, hallId) } })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; hallId: string }> }
) {
  const { eventId, hallId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any

  // Scope the existence check to the event first, so a hall belonging to another
  // event returns 404 rather than silently succeeding against zero rows.
  const { data: hall } = await supabase
    .from("halls")
    .select("id")
    .eq("id", hallId)
    .eq("event_id", eventId)
    .maybeSingle()

  if (!hall) return NextResponse.json({ error: "Hall not found" }, { status: 404 })

  // Measured before the delete -- afterwards the hall_id values are already null.
  const impact = await countImpact(supabase, eventId, hallId)

  const { error } = await supabase.from("halls").delete().eq("id", hallId).eq("event_id", eventId)

  if (error) return NextResponse.json({ error: "Failed to delete hall" }, { status: 500 })

  // Sessions and coordinators survive with hall_id set to null; they are not
  // deleted. Reported so the caller can tell the coordinator what now needs
  // re-placing.
  return NextResponse.json({ success: true, unlinked: impact })
}
