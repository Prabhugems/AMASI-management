import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

// GET /api/audio-devices/lookup?event_id=&device_code= — show current holder
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const event_id = searchParams.get("event_id")
  const device_code = searchParams.get("device_code")
  if (!event_id || !device_code) return NextResponse.json({ error: "event_id and device_code required" }, { status: 400 })
  const cleanCode = device_code.trim().toUpperCase()

  const supabase = await createAdminClient()
  const { data: device } = await (supabase as any)
    .from("audio_devices")
    .select("*")
    .eq("event_id", event_id)
    .eq("device_code", cleanCode)
    .maybeSingle()
  if (!device) return NextResponse.json({ device: null, active: null, history: [] })

  const { data: active } = await (supabase as any)
    .from("audio_device_assignments")
    .select("id, assigned_at, registrations(id, registration_number, attendee_name, attendee_phone, ticket_types(name))")
    .eq("device_id", device.id)
    .is("returned_at", null)
    .maybeSingle()

  const { data: history } = await (supabase as any)
    .from("audio_device_assignments")
    .select("id, assigned_at, returned_at, registrations(registration_number, attendee_name)")
    .eq("device_id", device.id)
    .order("assigned_at", { ascending: false })
    .limit(10)

  return NextResponse.json({ device, active, history })
}
