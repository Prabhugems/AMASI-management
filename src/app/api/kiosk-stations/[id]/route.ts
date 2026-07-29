import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"

// PATCH /api/kiosk-stations/[id] -- rename and/or reassign the target list.
// Does NOT touch the access token -- see Task 3 for that.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error: findErr } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id")
    .eq("id", id)
    .maybeSingle()

  if (findErr || !station) {
    return NextResponse.json({ error: "Kiosk station not found." }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(station.event_id, "checkin")
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim()
  }
  if (typeof body.list_id === "string") {
    if (!isValidUUID(body.list_id)) {
      return NextResponse.json({ error: "Invalid list." }, { status: 400 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: list } = await (supabase as any)
      .from("checkin_lists")
      .select("id, event_id")
      .eq("id", body.list_id)
      .maybeSingle()
    if (!list || list.event_id !== station.event_id) {
      return NextResponse.json({ error: "Check-in list not found for this event." }, { status: 404 })
    }
    updates.list_id = body.list_id
  }
  if (typeof body.print_station_id === "string") {
    if (!isValidUUID(body.print_station_id)) {
      return NextResponse.json({ error: "Invalid print station." }, { status: 400 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: printStation } = await (supabase as any)
      .from("print_stations")
      .select("id, event_id, print_settings")
      .eq("id", body.print_station_id)
      .maybeSingle()
    if (!printStation || printStation.event_id !== station.event_id) {
      return NextResponse.json({ error: "Print Station not found for this event." }, { status: 404 })
    }
    if (printStation.print_settings?.printer_type !== "usb") {
      return NextResponse.json({ error: "Check-in + Print Badge stations require a USB-type Print Station." }, { status: 400 })
    }
    updates.print_station_id = body.print_station_id
  }
  if (typeof body.auto_print_badge === "boolean") {
    updates.auto_print_badge = body.auto_print_badge
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("kiosk_stations")
    .update(updates)
    .eq("id", id)
    .select("id, event_id, name, mode, list_id, print_station_id, auto_print_badge")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to update kiosk station." }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/kiosk-stations/[id] -- remove the station entirely. Distinct
// from revoking its token (Task 3): this deletes the admin-facing record,
// not just its credential.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error: findErr } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id")
    .eq("id", id)
    .maybeSingle()

  if (findErr || !station) {
    return NextResponse.json({ error: "Kiosk station not found." }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(station.event_id, "checkin")
  if (authError) return authError

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("kiosk_stations").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to delete kiosk station." }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
