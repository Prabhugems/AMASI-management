import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages"

// Talks — the second level of the agenda. A talk always belongs to a session
// block, and its event_id is derived from that block rather than taken from the
// caller: the two must never disagree, and a client that could set event_id
// independently could file a talk into another event's programme.

const TALK_TYPES = ["talk", "panel", "discussion", "video", "break"] as const

const createSchema = z.object({
  session_id: z.string().uuid(),
  title: z.string().nullable().optional(),
  talk_type: z.enum(TALK_TYPES).optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  duration_minutes: z.number().int().positive().nullable().optional(),
  display_order: z.number().int().optional(),
  notes: z.string().nullable().optional(),
})

// GET /api/events/[eventId]/talks?session_id=...
// Without session_id, returns every talk in the event — what the day view needs.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const sessionId = new URL(request.url).searchParams.get("session_id")

  const supabase = (await createAdminClient()) as any
  let query = supabase
    .from("talks")
    .select("*")
    .eq("event_id", eventId)
    .order("display_order", { ascending: true })

  if (sessionId) query = query.eq("session_id", sessionId)

  // Paged: talks outnumber blocks several times over, so an event large enough
  // to matter crosses PostgREST's 1,000-row cap well before its block count does.
  try {
    return NextResponse.json({ data: await fetchAllPages(query) })
  } catch {
    return NextResponse.json({ error: "Failed to fetch talks" }, { status: 500 })
  }
}

export async function POST(
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

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any

  // The block must exist AND belong to this event. Checking both in one query
  // means a talk can never be filed under another event's session.
  const { data: block } = await supabase
    .from("sessions")
    .select("id, event_id")
    .eq("id", parsed.data.session_id)
    .maybeSingle()

  if (!block || block.event_id !== eventId) {
    return NextResponse.json({ error: "Session not found for this event" }, { status: 404 })
  }

  // Append to the end unless told otherwise. Race-prone under concurrent
  // inserts; acceptable at single-coordinator scale, matching the same choice
  // already made in session-speakers.
  let displayOrder = parsed.data.display_order
  if (displayOrder === undefined) {
    const { data: last } = await supabase
      .from("talks")
      .select("display_order")
      .eq("session_id", parsed.data.session_id)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle()
    displayOrder = last ? (last.display_order as number) + 1 : 0
  }

  const { data, error } = await supabase
    .from("talks")
    .insert({
      ...parsed.data,
      event_id: eventId, // derived from the block, never from the caller
      display_order: displayOrder,
    })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: "Failed to create talk" }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
