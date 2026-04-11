import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET /api/convocation/[convocationNumber] - Public lookup by convocation number
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ convocationNumber: string }> }
) {
  try {
    const { convocationNumber } = await params

    if (!convocationNumber) {
      return NextResponse.json({ error: "Convocation number is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: reg, error } = await db
      .from("registrations")
      .select("attendee_name, attendee_email, attendee_phone, registration_number, convocation_number, exam_result, exam_total_marks, exam_marks, ticket_type_id, event_id")
      .eq("convocation_number", convocationNumber.toUpperCase())
      .single()

    if (error || !reg) {
      return NextResponse.json({ error: "Invalid convocation number" }, { status: 404 })
    }

    // Only allow pass or without_exam results
    if (reg.exam_result !== "pass" && reg.exam_result !== "without_exam") {
      return NextResponse.json({ error: "Result not declared" }, { status: 403 })
    }

    // Get ticket type name
    const { data: ticket } = await db
      .from("ticket_types")
      .select("name")
      .eq("id", reg.ticket_type_id)
      .single()

    // Get event details
    const { data: event } = await db
      .from("events")
      .select("title, settings, start_date, venue_name, city")
      .eq("id", reg.event_id)
      .single()

    const cleanName = reg.attendee_name?.replace(/^(dr\.?\s*)/i, "").trim()

    // Build venue string from venue_name and city
    const venueParts = [event?.venue_name, event?.city].filter(Boolean)
    const eventVenue = venueParts.length > 0 ? venueParts.join(", ") : null

    return NextResponse.json({
      name: cleanName,
      email: reg.attendee_email,
      phone: reg.attendee_phone,
      registration_number: reg.registration_number,
      convocation_number: reg.convocation_number,
      total_marks: reg.exam_total_marks,
      amasi_number: reg.exam_marks?.amasi_number || null,
      fillout_link: reg.exam_marks?.fillout_link || null,
      category: ticket?.name || null,
      event_title: event?.title || null,
      event_date: event?.start_date || null,
      event_venue: eventVenue,
    })
  } catch (error) {
    console.error("Error in convocation lookup:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
