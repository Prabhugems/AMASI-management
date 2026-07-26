import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { isValidUUID } from "@/lib/validation"

// GET /api/kiosk-launcher/[eventId]
// Public, no login — same trust model as /checkin/access/[accessToken] and
// /print/[token]: knowing this event's URL is the access boundary, same as
// every other tablet-facing page in this app. Lists this event's active
// check-in lists and print stations so a volunteer can pick one from a
// single menu instead of an admin having to hand out each list/station's
// own share link individually. It hands back the same access_token that
// the existing "Share with Staff" modal already exposes — no new secret,
// no new exposure beyond what's already shared today.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`kiosk-launcher:${clientIp}`, "public")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  const { eventId } = await params

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 })
  }

  const supabase = await createAdminClient()

  const { data: event, error: eventError } = await (supabase as any)
    .from("events")
    .select("id, name, short_name")
    .eq("id", eventId)
    .maybeSingle()

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  const nowIso = new Date().toISOString()

  const [{ data: checkinLists }, { data: printStations }] = await Promise.all([
    (supabase as any)
      .from("checkin_lists")
      .select("id, name, list_purpose, access_token")
      .eq("event_id", eventId)
      .eq("is_active", true)
      // Exclude lists whose staff link has already expired — no point
      // surfacing a dead link on the launcher menu.
      .or(`access_token_expires_at.is.null,access_token_expires_at.gt.${nowIso}`)
      .order("sort_order", { ascending: true }),
    (supabase as any)
      .from("print_stations")
      .select("id, name, access_token")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
  ])

  return NextResponse.json({
    event: { id: event.id, name: event.name, short_name: event.short_name },
    checkinLists: checkinLists || [],
    printStations: printStations || [],
  })
}
