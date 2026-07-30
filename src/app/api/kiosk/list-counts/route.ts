import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { resolveStationByToken } from "@/lib/kiosk-station-lookup"

const MAX_LIST_IDS = 20

// GET /api/kiosk/list-counts?event_id=&station_token=&list_ids=id1,id2,...
// Powers the kiosk menu screen's "N checked in" subline -- an event-wide,
// per-list total (every station's scans combined) so a volunteer moving
// between desks can see each list's progress without leaving the tablet or
// asking someone to check the admin dashboard. Polled on a ~30s cadence from
// KioskStationShell while the menu itself is showing, same spirit as
// /api/kiosk/collected-status' background refresh. Purely informational --
// never called from the check-in path, and a failure here must never block
// or alter check-in; the client just keeps whatever counts it last had.
export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`kiosk-list-counts:${clientIp}`, "public")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")
  const stationToken = searchParams.get("station_token")
  const listIdsParam = searchParams.get("list_ids")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }
  if (!stationToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 })
  }
  if (!listIdsParam) {
    return NextResponse.json({ error: "list_ids is required." }, { status: 400 })
  }

  const requestedIds = listIdsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)

  if (requestedIds.length === 0 || requestedIds.length > MAX_LIST_IDS || !requestedIds.every(isValidUUID)) {
    return NextResponse.json({ error: "Invalid list_ids." }, { status: 400 })
  }

  try {
    const supabase = await createAdminClient()

    const { station, error: stationLookupError } = await resolveStationByToken(supabase, stationToken)
    if (stationLookupError) {
      Sentry.captureException(stationLookupError, { tags: { route: "kiosk/list-counts" }, extra: { eventId } })
      return NextResponse.json({ error: "Something went wrong looking up this station." }, { status: 503 })
    }
    if (!station || station.revoked_at || (station.mode !== "checkin" && station.mode !== "checkin_and_print")) {
      return NextResponse.json({ error: "Invalid access token." }, { status: 401 })
    }
    if (station.event_id !== eventId) {
      return NextResponse.json({ error: "Check-in list not found." }, { status: 404 })
    }

    // One membership query for the whole station, rather than one per
    // requested id -- same set of lists this station serves either way, just
    // fetched in a single round trip.
    const { data: memberships, error: membershipError } = await (supabase as any)
      .from("kiosk_station_lists")
      .select("checkin_list_id")
      .eq("station_id", station.id)

    if (membershipError) {
      Sentry.captureException(membershipError, { tags: { route: "kiosk/list-counts" }, extra: { eventId } })
      return NextResponse.json({ error: "Something went wrong looking up this station's lists." }, { status: 503 })
    }

    const memberIds = new Set(
      ((memberships ?? []) as { checkin_list_id: string }[]).map((m) => m.checkin_list_id)
    )
    // A requested id this station doesn't serve is silently dropped, not an
    // error -- the client only ever asks about its own assigned lists, but a
    // stale/removed assignment must degrade to "no count shown" for that
    // tile, never a hard failure for the whole request.
    const allowedIds = requestedIds.filter((id) => memberIds.has(id))

    const counts: Record<string, number> = {}
    await Promise.all(
      allowedIds.map(async (listId) => {
        const { count, error } = await (supabase as any)
          .from("checkin_records")
          .select("id", { count: "exact", head: true })
          .eq("checkin_list_id", listId)
        if (error) {
          Sentry.captureException(error, { tags: { route: "kiosk/list-counts" }, extra: { eventId, listId } })
          return
        }
        counts[listId] = count ?? 0
      })
    )

    return NextResponse.json({ counts })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "kiosk/list-counts" }, extra: { eventId } })
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
  }
}
