import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const eventId = request.nextUrl.searchParams.get("eventId")
  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 })
  }

  const supabase = await createAdminClient()

  const [eventRes, regsRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, short_name, start_date, end_date")
      .eq("id", eventId)
      .single(),
    supabase
      .from("registrations")
      .select("id, attendee_name, attendee_phone, custom_fields")
      .eq("event_id", eventId)
      .order("attendee_name"),
  ])

  if (eventRes.error) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  const guests = (regsRes.data || []).filter((g: any) =>
    g.custom_fields?.needs_travel ||
    g.custom_fields?.travel_details?.from_city ||
    g.custom_fields?.travel_details?.onward_from_city ||
    g.custom_fields?.booking?.onward_status
  )

  return NextResponse.json({ event: eventRes.data, guests })
}
