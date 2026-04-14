import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// POST /api/webhooks/airtable-address?event_id=xxx&secret=xxx
// Real-time address sync from Airtable automation webhook
// Expected payload: { email, flat, road, area, city, state, pincode }
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const secret = searchParams.get("secret")

    if (!eventId || !secret) {
      return NextResponse.json({ error: "event_id and secret are required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    const db = supabase as any

    // Verify webhook secret
    const { data: event } = await db.from("events").select("settings").eq("id", eventId).single()
    const examConfig = event?.settings?.examination
    if (!examConfig?.webhook_secret || examConfig.webhook_secret !== secret) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 })
    }

    const body = await request.json()
    const email = (body.email || "").trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 })
    }

    const city = (body.city || body["City/District"] || "").trim()
    if (!city) {
      return NextResponse.json({ error: "city is required" }, { status: 400 })
    }

    const flat = (body.flat || body["Flat/Door/Block No"] || "").trim()
    const road = (body.road || body["Road/Street/Lane"] || "").trim()
    const area = (body.area || body["Area/Locality"] || "").trim()
    const state = (body.state || body["STATE"] || body["State"] || "").trim()
    const pincode = String(body.pincode || body["POSTAL/PIN  CODE"] || body["POSTAL/PIN CODE"] || "").trim()

    const address = {
      address_line1: [flat, road].filter(Boolean).join(", "),
      address_line2: area,
      city,
      state,
      pincode,
      country: "India",
    }

    // Find registration by email for this event
    const { data: reg } = await db
      .from("registrations")
      .select("id, convocation_address")
      .eq("event_id", eventId)
      .ilike("attendee_email", email)
      .not("convocation_number", "is", null)
      .is("convocation_address", null)
      .maybeSingle()

    if (!reg) {
      return NextResponse.json({ message: "No matching registration without address found" }, { status: 200 })
    }

    await db.from("registrations").update({ convocation_address: address }).eq("id", reg.id)

    console.log(`[webhook/airtable-address] Synced address for ${email}, event=${eventId}`)
    return NextResponse.json({ success: true, registration_id: reg.id })
  } catch (error) {
    console.error("[webhook/airtable-address] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
