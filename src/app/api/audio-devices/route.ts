import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

// POST /api/audio-devices — issue a device to an attendee
// Body: { event_id, device_code, registration_number?, registration_id?, performed_by?, notes? }
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  try {
    const body = await request.json()
    const { event_id, device_code, registration_number, registration_id, performed_by, notes } = body
    if (!event_id || !device_code || (!registration_number && !registration_id)) {
      return NextResponse.json({ error: "event_id, device_code and (registration_number or registration_id) are required" }, { status: 400 })
    }
    const cleanCode = String(device_code).trim().toUpperCase()

    const supabase = await createAdminClient()

    // 1. Find the registration
    let regQuery = (supabase as any).from("registrations").select("id, registration_number, attendee_name, attendee_phone, ticket_types(name)").eq("event_id", event_id)
    if (registration_id) regQuery = regQuery.eq("id", registration_id)
    else regQuery = regQuery.ilike("registration_number", registration_number)
    const { data: reg } = await regQuery.maybeSingle()
    if (!reg) return NextResponse.json({ error: "Registration not found" }, { status: 404 })

    // 2. Find or create the device
    let { data: device } = await (supabase as any)
      .from("audio_devices")
      .select("*")
      .eq("event_id", event_id)
      .eq("device_code", cleanCode)
      .maybeSingle()

    if (!device) {
      const { data: inserted, error: insErr } = await (supabase as any)
        .from("audio_devices")
        .insert({ event_id, device_code: cleanCode, status: "available" })
        .select()
        .single()
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
      device = inserted
    }

    // 3. Check device isn't currently issued to someone else
    const { data: activeForDevice } = await (supabase as any)
      .from("audio_device_assignments")
      .select("id, registration_id, registrations(attendee_name, registration_number)")
      .eq("device_id", device.id)
      .is("returned_at", null)
      .maybeSingle()

    if (activeForDevice) {
      if (activeForDevice.registration_id === reg.id) {
        return NextResponse.json({
          ok: true,
          already: true,
          device,
          assignment: activeForDevice,
          registration: reg,
          message: `${cleanCode} is already issued to ${reg.attendee_name}`,
        })
      }
      const holderName = (activeForDevice as any).registrations?.attendee_name || "another attendee"
      const holderReg = (activeForDevice as any).registrations?.registration_number || ""
      return NextResponse.json({
        error: `${cleanCode} is currently with ${holderName}${holderReg ? " (" + holderReg + ")" : ""}. Return it first.`,
        currentHolder: { name: holderName, registration_number: holderReg },
      }, { status: 409 })
    }

    // 4. Warn if attendee already has another device (strict mode: allow with warning)
    const { data: activeForReg } = await (supabase as any)
      .from("audio_device_assignments")
      .select("id, device_id, audio_devices(device_code)")
      .eq("registration_id", reg.id)
      .is("returned_at", null)

    const existingDevices = (activeForReg || []).map((a: any) => a.audio_devices?.device_code).filter(Boolean)

    // 5. Create assignment
    const { data: assignment, error: asErr } = await (supabase as any)
      .from("audio_device_assignments")
      .insert({
        event_id,
        device_id: device.id,
        registration_id: reg.id,
        assigned_by: performed_by || null,
        notes: notes || null,
      })
      .select()
      .single()
    if (asErr) return NextResponse.json({ error: asErr.message }, { status: 500 })

    // 6. Mark device issued
    await (supabase as any).from("audio_devices").update({ status: "issued", updated_at: new Date().toISOString() }).eq("id", device.id)

    return NextResponse.json({
      ok: true,
      device: { ...device, status: "issued" },
      assignment,
      registration: reg,
      warning: existingDevices.length > 0 ? `Attendee already holds: ${existingDevices.join(", ")}` : undefined,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to issue device" }, { status: 500 })
  }
}
