import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages"
import { defaultRosterFor } from "@/lib/agenda-roles"

// Creating a session block.
//
// Only PATCH existed before this; blocks were created by the old Schedule page
// writing to `sessions` through the browser client. Going through an API route
// means the write is authorised server-side and the FK columns (hall_id,
// track_id) are the ones being set, rather than the legacy free text.

const createSchema = z.object({
  session_name: z.string().min(1),
  session_date: z.string().nullable().optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  session_type: z.string().nullable().optional(),
  hall_id: z.string().uuid().nullable().optional(),
  track_id: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  /**
   * Seed the block's roster from its session type. This is the mechanism that
   * makes each event cheaper to set up than the last — a symposium arrives
   * already asking for 2 chairs and 4 speakers, which the coordinator edits.
   * Opt-out because an imported block already knows its own roster.
   */
  seed_roster: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const date = new URL(request.url).searchParams.get("date")

  const supabase = (await createAdminClient()) as any
  let query = supabase
    .from("sessions")
    .select("id, session_name, session_type, session_date, start_time, end_time, hall, hall_id, track_id, specialty_track, description, speakers, chairpersons, moderators, speakers_text, chairpersons_text, moderators_text")
    .eq("event_id", eventId)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true })

  if (date) query = query.eq("session_date", date)

  // Paged: one archived event holds 1,195 sessions, so an unpaged read would
  // silently return 1,000 and the Session Builder would render a programme
  // missing 195 blocks with no indication anything was dropped.
  try {
    return NextResponse.json({ data: await fetchAllPages(query) })
  } catch {
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
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

  const { seed_roster = true, ...fields } = parsed.data
  const supabase = (await createAdminClient()) as any

  if (fields.hall_id) {
    const { data: hall } = await supabase
      .from("halls")
      .select("id, event_id")
      .eq("id", fields.hall_id)
      .maybeSingle()
    if (!hall || hall.event_id !== eventId) {
      return NextResponse.json({ error: "Location not found for this event" }, { status: 400 })
    }
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({ ...fields, event_id: eventId })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: "Failed to create session" }, { status: 500 })

  // Seeding is best-effort and deliberately non-fatal: a roster that failed to
  // seed is a minor inconvenience the coordinator can fix in the editor, but
  // losing the block they just created because of it would not be.
  let seeded = 0
  const roster = seed_roster ? defaultRosterFor(fields.session_type) : []
  if (roster.length > 0) {
    const { data: rows } = await supabase
      .from("session_role_requirements")
      .insert(
        roster.map((r) => ({
          session_id: session.id,
          talk_id: null,
          role: r.role,
          required_count: r.required_count,
        }))
      )
      .select("id")
    seeded = rows?.length ?? 0
  }

  return NextResponse.json({ data: session, seeded_requirements: seeded }, { status: 201 })
}
