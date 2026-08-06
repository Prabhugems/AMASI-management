import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"

// GET /api/kiosk-stations/[id] -- single station, including its assigned
// list_ids, for the per-station detail page. Same per-station shape the
// list endpoint (GET /api/kiosk-stations) already returns per row.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid station id." }, { status: 400 })
  }

  const supabase = await createAdminClient()

  const { data: station, error: findErr } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id, name, mode, print_station_id, auto_print_badge, attended, last_seen_at, revoked_at, created_at")
    .eq("id", id)
    .maybeSingle()

  if (findErr) {
    return NextResponse.json({ error: "Failed to load station." }, { status: 500 })
  }
  if (!station) {
    return NextResponse.json({ error: "Kiosk station not found." }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(station.event_id, "checkin")
  if (authError) return authError

  const { data: listRows, error: listErr } = await (supabase as any)
    .from("kiosk_station_lists")
    .select("checkin_list_id")
    .eq("station_id", id)

  if (listErr) {
    return NextResponse.json({ error: "Failed to load station's lists." }, { status: 500 })
  }

  return NextResponse.json({
    ...station,
    list_ids: (listRows || []).map((r: { checkin_list_id: string }) => r.checkin_list_id),
  })
}

// PATCH /api/kiosk-stations/[id] -- rename and/or reassign the target list.
// Does NOT touch the access token -- see Task 3 for that.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createAdminClient()

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
  if (typeof body.print_station_id === "string") {
    if (!isValidUUID(body.print_station_id)) {
      return NextResponse.json({ error: "Invalid print station." }, { status: 400 })
    }
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
  if (typeof body.attended === "boolean") {
    updates.attended = body.attended
  }

  // --- Validate list_ids BEFORE any mutation happens ----------------------
  // Moved ahead of the station's own `.update()` below on purpose: this used
  // to run AFTER that update had already committed, so a request with bad
  // list_ids returned a 400/404 to the client while the name/print-station/
  // auto-print changes had already silently landed -- a partial, inconsistent
  // update presented as a full failure. Now nothing is mutated until BOTH the
  // list_ids validation (if list_ids was even sent) and the station-field
  // update are ready to succeed together.
  let requestedListIds: string[] | undefined
  if (Array.isArray(body.list_ids)) {
    const requested = body.list_ids as string[]
    if (requested.length === 0 || !requested.every(isValidUUID)) {
      return NextResponse.json({ error: "At least one check-in list must be selected." }, { status: 400 })
    }
    const { data: lists } = await (supabase as any).from("checkin_lists").select("id, event_id").in("id", requested)
    const foundIds = new Set((lists || []).map((l: any) => l.id))
    if (requested.some((rid) => !foundIds.has(rid)) || (lists || []).some((l: any) => l.event_id !== station.event_id)) {
      return NextResponse.json({ error: "Check-in list not found for this event." }, { status: 404 })
    }
    requestedListIds = requested
  }

  const { data, error } = await (supabase as any)
    .from("kiosk_stations")
    .update(updates)
    .eq("id", id)
    .select("id, event_id, name, mode, print_station_id, auto_print_badge, attended")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to update kiosk station." }, { status: 500 })
  }

  let listIds: string[] | undefined
  if (requestedListIds) {
    // Swap the station's assigned lists WITHOUT a delete-then-insert: that
    // ordering left the station with ZERO assigned lists (bricked -- a live
    // tablet renders "Station Needs Reassignment") if the delete succeeded
    // but the insert then failed. Instead: read the current assignments,
    // insert only the genuinely NEW ones first, and only delete the ones
    // being dropped once that insert has succeeded. If the insert fails, no
    // delete has happened yet, so the station still has its ORIGINAL
    // assignments intact.
    const { data: existingRows, error: existingError } = await (supabase as any)
      .from("kiosk_station_lists")
      .select("checkin_list_id")
      .eq("station_id", id)
    if (existingError) {
      return NextResponse.json({ error: "Station updated but failed to reassign lists." }, { status: 500 })
    }
    const existingListIds = ((existingRows || []) as any[]).map((r) => r.checkin_list_id as string)
    const toAdd = requestedListIds.filter((lid) => !existingListIds.includes(lid))
    const toRemove = existingListIds.filter((lid) => !requestedListIds!.includes(lid))

    if (toAdd.length > 0) {
      const { error: insertError } = await (supabase as any)
        .from("kiosk_station_lists")
        .insert(toAdd.map((checkin_list_id) => ({ station_id: id, checkin_list_id })))
      if (insertError) {
        return NextResponse.json({ error: "Station updated but failed to reassign lists." }, { status: 500 })
      }
    }

    if (toRemove.length > 0) {
      const { error: deleteError } = await (supabase as any)
        .from("kiosk_station_lists")
        .delete()
        .eq("station_id", id)
        .in("checkin_list_id", toRemove)
      if (deleteError) {
        return NextResponse.json({ error: "Station updated but failed to remove old list assignments." }, { status: 500 })
      }
    }
    listIds = requestedListIds
  }

  return NextResponse.json({ ...data, ...(listIds && { list_ids: listIds }) })
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

  const { error } = await (supabase as any).from("kiosk_stations").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to delete kiosk station." }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
