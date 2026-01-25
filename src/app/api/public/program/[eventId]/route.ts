import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/public/program/[eventId] - Fetch all program data in one request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch all data in parallel
    const [eventResult, sessionsResult, tracksResult] = await Promise.all([
      (supabase as any)
        .from("events")
        .select("id, name, short_name, tagline, start_date, end_date, venue_name, city, logo_url, settings")
        .eq("id", eventId)
        .single(),
      (supabase as any)
        .from("sessions")
        .select("id, session_name, session_type, session_date, start_time, end_time, duration_minutes, hall, description, specialty_track, speakers, chairpersons, moderators")
        .eq("event_id", eventId)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true }),
      (supabase as any)
        .from("tracks")
        .select("id, name, description, chairpersons, color")
        .eq("event_id", eventId)
        .order("name"),
    ])

    if (eventResult.error || !eventResult.data) {
      console.error("Event lookup error:", eventResult.error)
      return NextResponse.json({ error: "Event not found", details: eventResult.error?.message }, { status: 404 })
    }

    return NextResponse.json({
      event: eventResult.data,
      sessions: sessionsResult.data || [],
      tracks: tracksResult.data || [],
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (error: any) {
    console.error("Public program API error:", error)
    return NextResponse.json({ error: "Failed to fetch program" }, { status: 500 })
  }
}
