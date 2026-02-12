import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { event_id } = await request.json()

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get all speaker registrations for this event
    const { data: speakerTicket } = await (supabase as any)
      .from("ticket_types")
      .select("id")
      .eq("event_id", event_id)
      .or("name.ilike.%speaker%,name.ilike.%faculty%")
      .limit(1)
      .single()

    if (!speakerTicket) {
      return NextResponse.json({ error: "No speaker ticket found" }, { status: 400 })
    }

    // Get registrations with "Dr" prefix
    const { data: registrations } = await (supabase as any)
      .from("registrations")
      .select("id, attendee_name")
      .eq("event_id", event_id)
      .eq("ticket_type_id", speakerTicket.id)

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ message: "No registrations found" })
    }

    // Update names to remove Dr/Prof prefix
    let updated = 0
    for (const reg of registrations) {
      const newName = reg.attendee_name.replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Shri\.?)\s+/i, "").trim()

      if (newName !== reg.attendee_name) {
        await (supabase as any)
          .from("registrations")
          .update({ attendee_name: newName })
          .eq("id", reg.id)
        updated++
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      total: registrations.length,
    })
  } catch (_error: any) {
    return NextResponse.json({ error: "Failed to fix speaker names" }, { status: 500 })
  }
}
