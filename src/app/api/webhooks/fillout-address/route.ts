import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// POST /api/webhooks/fillout-address?event_id=xxx&secret=xxx
// Real-time address sync from Fillout form submission webhook
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

    // Extract address from Fillout submission
    const getQ = (name: string) => body.questions?.find((q: any) => q.name === name)?.value || ""
    const address = {
      address_line1: [getQ("Flat/Door/Block No"), getQ("Road/Street/Lane")].filter(Boolean).join(", "),
      address_line2: getQ("Area/Locality"),
      city: getQ("City/District"),
      state: getQ("State"),
      pincode: String(getQ("POSTAL/PIN  CODE") || ""),
      country: "India",
    }

    if (!address.city) {
      return NextResponse.json({ error: "No city in submission, skipping" }, { status: 200 })
    }

    // Extract Airtable record ID from URL parameters
    const params = body.urlParameters || []
    const recId = params.find((p: any) => p.id === "id" || p.key === "id" || p.name === "id")?.value
    if (!recId) {
      return NextResponse.json({ error: "No record ID in submission" }, { status: 200 })
    }

    // Find registration by fillout_link containing this record ID
    const { data: regs } = await db
      .from("registrations")
      .select("id, exam_marks, convocation_address")
      .eq("event_id", eventId)
      .not("convocation_number", "is", null)

    const reg = (regs || []).find((r: any) => {
      const link = r.exam_marks?.fillout_link || ""
      return link.includes(recId)
    })

    if (!reg) {
      return NextResponse.json({ message: "No matching registration found" }, { status: 200 })
    }

    if (reg.convocation_address) {
      return NextResponse.json({ message: "Address already exists, skipping" }, { status: 200 })
    }

    // Build update
    const updateData: any = { convocation_address: address }
    const certificateName = getQ("Certificate Name")
    const attending = getQ("Are you available for the convocation at AMASICON kolkata 2026?")
    if (certificateName || attending) {
      const marks = { ...(reg.exam_marks || {}) }
      if (certificateName) marks.certificate_name = certificateName
      if (attending) marks.attending_convocation = attending
      updateData.exam_marks = marks
    }

    await db.from("registrations").update(updateData).eq("id", reg.id)

    console.log(`[webhook/fillout-address] Synced address for recId=${recId}, event=${eventId}`)
    return NextResponse.json({ success: true, registration_id: reg.id })
  } catch (error) {
    console.error("[webhook/fillout-address] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
