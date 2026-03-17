import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

// GET /api/examination/registrations?event_id=xxx
export async function GET(request: NextRequest) {
  try {
    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("registrations")
      .select("*")
      .eq("event_id", eventId)
      .in("status", ["confirmed", "attended", "completed", "checked_in"])
      .order("attendee_name")

    if (error) {
      console.error("Error fetching exam registrations:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch ticket types for this event
    const { data: ticketTypes } = await db
      .from("ticket_types")
      .select("id, name")
      .eq("event_id", eventId)

    const ticketMap = new Map((ticketTypes || []).map((t: any) => [t.id, t.name]))

    // Map to frontend-friendly field names
    const mapped = (data || []).map((r: any) => ({
      ...r,
      name: r.attendee_name,
      email: r.attendee_email,
      phone: r.attendee_phone,
      registration_id: r.registration_number,
      ticket_type_name: ticketMap.get(r.ticket_type_id) || null,
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    console.error("Error in GET /api/examination/registrations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/examination/registrations - Update exam marks/result
export async function PATCH(request: NextRequest) {
  try {
    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("registrations")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating registration:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PATCH /api/examination/registrations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
