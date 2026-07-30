import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"

// GET /api/kiosk-stations/list-counts?event_id= -- event-wide checked-in
// count per check-in list, for the compact Kiosk Stations list view. This is
// deliberately separate from /api/kiosk/list-counts (station-token
// authenticated, scoped to one station's assigned lists) -- an admin viewing
// the whole station list needs every list's count in one call, with no
// per-station membership filtering.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Valid event_id is required." }, { status: 400 })
  }

  const { error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lists, error: listsErr } = await (supabase as any)
    .from("checkin_lists")
    .select("id")
    .eq("event_id", eventId)

  if (listsErr) {
    return NextResponse.json({ error: "Failed to load check-in lists." }, { status: 500 })
  }

  const counts: Record<string, number> = {}
  await Promise.all(
    ((lists || []) as { id: string }[]).map(async ({ id: listId }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, error } = await (supabase as any)
        .from("checkin_records")
        .select("id", { count: "exact", head: true })
        .eq("checkin_list_id", listId)
      if (error) return
      counts[listId] = count ?? 0
    })
  )

  return NextResponse.json({ counts })
}
