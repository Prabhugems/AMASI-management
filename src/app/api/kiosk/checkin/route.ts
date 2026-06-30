import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"

// POST /api/kiosk/checkin — public self check-in for the /kiosk/[eventId]/[listId]
// page. The kiosk runs as the anon browser client, but checkin_records has RLS
// enabled with no policy, so a direct browser insert is always denied. This
// route performs the lookup + insert server-side with the admin client (which
// bypasses RLS), mirroring every other check-in path in the app.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const eventId = body.event_id as string | undefined
    const checkinListId = body.checkin_list_id as string | undefined

    // Strip characters that have meaning in PostgREST's .or() filter so user
    // input can't break out of the ilike clauses.
    const searchTerm = (body.search ?? "").toString().replace(/[(),]/g, "").trim()

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json({ success: false, message: "Invalid event." }, { status: 400 })
    }
    if (!checkinListId || !isValidUUID(checkinListId)) {
      return NextResponse.json({ success: false, message: "Invalid check-in list." }, { status: 400 })
    }
    if (!searchTerm) {
      return NextResponse.json({ success: false, message: "Please enter a registration number." }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Validate the list and confirm it belongs to the event in the URL.
    const { data: list } = await (supabase as any)
      .from("checkin_lists")
      .select("id, event_id, allow_multiple_checkins")
      .eq("id", checkinListId)
      .maybeSingle()

    if (!list || list.event_id !== eventId) {
      return NextResponse.json({ success: false, message: "Check-in list not found." }, { status: 404 })
    }

    // Find the registration within this event by reg number / email / name / phone.
    const { data: registration } = await (supabase as any)
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        attendee_email,
        attendee_phone,
        attendee_designation,
        attendee_institution,
        ticket_type:ticket_types(name)
      `)
      .eq("event_id", eventId)
      .or(
        `registration_number.ilike.%${searchTerm}%,attendee_email.ilike.%${searchTerm}%,attendee_name.ilike.%${searchTerm}%,attendee_phone.ilike.%${searchTerm}%`
      )
      .limit(1)
      .maybeSingle()

    if (!registration) {
      return NextResponse.json({
        success: false,
        message: "Registration not found. Please check your registration number.",
      })
    }

    // Already checked in on this list? (active record = not checked out)
    if (!list.allow_multiple_checkins) {
      const { data: existing } = await (supabase as any)
        .from("checkin_records")
        .select("id")
        .eq("registration_id", registration.id)
        .eq("checkin_list_id", checkinListId)
        .is("checked_out_at", null)
        .limit(1)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({
          success: true,
          message: "You're already checked in!",
          registration,
          alreadyCheckedIn: true,
        })
      }
    }

    const now = new Date().toISOString()

    const { error: insertError } = await (supabase as any)
      .from("checkin_records")
      .insert({
        registration_id: registration.id,
        checkin_list_id: checkinListId,
        checked_in_at: now,
        checked_in_by: "Self check-in (kiosk)",
      })

    if (insertError) {
      console.error("Kiosk check-in insert failed:", insertError)
      return NextResponse.json(
        { success: false, message: "Failed to check in. Please try again." },
        { status: 500 }
      )
    }

    // Keep the registration's global flag in sync, like the other check-in paths.
    await (supabase as any)
      .from("registrations")
      .update({ checked_in: true, checked_in_at: now })
      .eq("id", registration.id)

    return NextResponse.json({ success: true, message: "Check-in successful!", registration })
  } catch (error: any) {
    console.error("Kiosk check-in error:", error)
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
