import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
// POST /api/audio-devices/return — mark a device as returned
// Body: { event_id, device_code, performed_by? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id, device_code, performed_by } = body
    if (!event_id || !device_code) {
      return NextResponse.json({ error: "event_id and device_code are required" }, { status: 400 })
    }
    const cleanCode = String(device_code).trim().toUpperCase()

    const supabase = await createAdminClient()

    const { data: device } = await (supabase as any)
      .from("audio_devices")
      .select("*")
      .eq("event_id", event_id)
      .eq("device_code", cleanCode)
      .maybeSingle()

    if (!device) {
      return NextResponse.json({ error: `${cleanCode} is unknown — was it ever issued?` }, { status: 404 })
    }

    const { data: active } = await (supabase as any)
      .from("audio_device_assignments")
      .select("id, registration_id, assigned_at, registrations(id, registration_number, attendee_name)")
      .eq("device_id", device.id)
      .is("returned_at", null)
      .maybeSingle()

    if (!active) {
      return NextResponse.json({
        ok: true,
        already: true,
        device,
        message: `${cleanCode} was not currently issued (no active assignment).`,
      })
    }

    const now = new Date().toISOString()
    await (supabase as any)
      .from("audio_device_assignments")
      .update({ returned_at: now, returned_by: performed_by || null })
      .eq("id", active.id)

    await (supabase as any)
      .from("audio_devices")
      .update({ status: "available", updated_at: now })
      .eq("id", device.id)

    return NextResponse.json({
      ok: true,
      device: { ...device, status: "available" },
      registration: (active as any).registrations,
      returned_at: now,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to return device" }, { status: 500 })
  }
}
