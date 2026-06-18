import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

// GET /api/audio-devices/list?event_id=&status=active|returned|all&q=
// Returns the roster of currently-issued devices (or history if status=returned/all).
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const event_id = searchParams.get("event_id")
  const status = searchParams.get("status") || "active"
  const q = searchParams.get("q")?.trim()
  if (!event_id) return NextResponse.json({ error: "event_id required" }, { status: 400 })

  const supabase = await createAdminClient()

  let query = (supabase as any)
    .from("audio_device_assignments")
    .select(`
      id,
      assigned_at,
      returned_at,
      assigned_by,
      returned_by,
      audio_devices!inner(id, device_code, status),
      registrations!inner(id, registration_number, attendee_name, attendee_phone, ticket_types(name))
    `)
    .eq("event_id", event_id)
    .order("assigned_at", { ascending: false })

  if (status === "active") query = query.is("returned_at", null)
  else if (status === "returned") query = query.not("returned_at", "is", null)

  const { data, error } = await query.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let rows = data || []
  if (q) {
    const needle = q.toLowerCase()
    rows = rows.filter((r: any) =>
      (r.audio_devices?.device_code || "").toLowerCase().includes(needle) ||
      (r.registrations?.attendee_name || "").toLowerCase().includes(needle) ||
      (r.registrations?.registration_number || "").toLowerCase().includes(needle) ||
      (r.registrations?.attendee_phone || "").includes(needle)
    )
  }

  // Stats
  const [{ count: totalIssued }, { count: totalReturned }, { count: deviceCount }] = await Promise.all([
    (supabase as any).from("audio_device_assignments").select("id", { count: "exact", head: true }).eq("event_id", event_id).is("returned_at", null),
    (supabase as any).from("audio_device_assignments").select("id", { count: "exact", head: true }).eq("event_id", event_id).not("returned_at", "is", null),
    (supabase as any).from("audio_devices").select("id", { count: "exact", head: true }).eq("event_id", event_id),
  ])

  return NextResponse.json({
    data: rows,
    stats: {
      currentlyOut: totalIssued || 0,
      totalReturns: totalReturned || 0,
      knownDevices: deviceCount || 0,
    },
  })
}
