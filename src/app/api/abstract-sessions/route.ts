import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// GET /api/abstract-sessions?event_id=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
    }

    const { error: authError } = await requireEventAndPermission(eventId, 'abstracts')
    if (authError) return authError

    const supabase = await createAdminClient()

    // Get sessions for this event
    const { data: sessions, error } = await (supabase as any)
      .from("sessions")
      .select(`
        id,
        title,
        session_name,
        session_type,
        session_date,
        start_time,
        end_time,
        duration_minutes,
        location,
        hall,
        specialty_track,
        chairpersons,
        moderators
      `)
      .eq("event_id", eventId)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true })

    if (error) {
      console.error("Error fetching sessions:", error)
      return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
    }

    // Get presentation slots with abstracts for each session
    const { data: slots, error: slotsError } = await (supabase as any)
      .from("abstract_presentation_slots")
      .select(`
        id,
        abstract_id,
        session_id,
        presentation_type,
        presentation_date,
        start_time,
        end_time,
        duration_minutes,
        hall_name,
        room_number,
        poster_board_number,
        slot_order,
        is_confirmed,
        abstract:abstracts(
          id,
          abstract_number,
          title,
          presenting_author_name,
          presenting_author_email,
          accepted_as,
          category:abstract_categories(name)
        )
      `)
      .eq("event_id", eventId)
      .order("presentation_date", { ascending: true })
      .order("start_time", { ascending: true })

    if (slotsError) {
      console.error("Error fetching slots:", slotsError)
    }

    // Group slots by session
    const sessionSlots: Record<string, any[]> = {}
    for (const slot of slots || []) {
      const key = slot.session_id || "unassigned"
      if (!sessionSlots[key]) {
        sessionSlots[key] = []
      }
      sessionSlots[key].push(slot)
    }

    // Add slots to sessions
    const sessionsWithSlots = (sessions || []).map((session: any) => ({
      ...session,
      slots: sessionSlots[session.id] || [],
      slot_count: (sessionSlots[session.id] || []).length,
    }))

    // Add unassigned slots
    const unassignedSlots = sessionSlots["unassigned"] || []

    return NextResponse.json({
      sessions: sessionsWithSlots,
      unassigned_slots: unassignedSlots,
    })
  } catch (error) {
    console.error("Error in GET sessions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/abstract-sessions - Create a new session for abstracts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      event_id,
      title,
      session_type = "abstract_session",
      session_date,
      start_time,
      end_time,
      location,
      hall,
      specialty_track,
      chairpersons,
      moderators,
      max_presentations = 10,
    } = body

    if (!event_id || !title || !session_date) {
      return NextResponse.json(
        { error: "Event ID, title, and date are required" },
        { status: 400 }
      )
    }

    const { error: authError } = await requireEventAndPermission(event_id, 'abstracts')
    if (authError) return authError

    const supabase = await createAdminClient()

    const { data: session, error } = await (supabase as any)
      .from("sessions")
      .insert({
        event_id,
        title,
        session_name: title,
        session_type,
        session_date,
        start_time,
        end_time,
        location,
        hall,
        specialty_track,
        chairpersons,
        moderators,
        max_presentations,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating session:", error)
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error("Error in POST session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
