import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { resolveStationByToken, stationServesList } from "@/lib/kiosk-station-lookup"

// GET /api/kiosk/collected-status?event_id=&station_token=&list_id= -- Layer 2
// of cross-device duplicate detection for collection-purpose lists (Layer 1
// is the instant, same-tablet-only IndexedDB scan-log check already built in
// KioskCheckinScreen). Returns every registration already checked into this
// list, with real station attribution, so a tablet polling this on a ~30s
// interval can catch a duplicate collected at a DIFFERENT desk. Never called
// synchronously from the check-in path itself -- purely a background-
// refreshed local cache, same spirit as /api/kiosk/delegates' 5-minute roster
// refresh. Degrades to `blocked: true`/empty on an unattended station exactly
// like /api/kiosk/delegates, never a 403/404 for that case.
export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`kiosk-collected-status:${clientIp}`, "public")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")
  const stationToken = searchParams.get("station_token")
  const listId = searchParams.get("list_id")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }
  if (!stationToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 })
  }
  if (!listId || !isValidUUID(listId)) {
    return NextResponse.json({ error: "list_id is required." }, { status: 400 })
  }

  try {
    const supabase = await createAdminClient()

    // Defaults closed: only ever flipped to true once every station-
    // resolution check below has positively succeeded. Same fail-closed
    // pattern as /api/kiosk/delegates' stationIsAttended.
    let isAttended = false

    const { station, error: stationLookupError } = await resolveStationByToken(supabase, stationToken)

    if (stationLookupError) {
      Sentry.captureException(stationLookupError, { tags: { route: "kiosk/collected-status" }, extra: { eventId, listId } })
      return NextResponse.json({ error: "Something went wrong looking up this station." }, { status: 503 })
    }
    if (!station || station.revoked_at || (station.mode !== "checkin" && station.mode !== "checkin_and_print")) {
      return NextResponse.json({ error: "Invalid access token." }, { status: 401 })
    }
    if (station.event_id !== eventId) {
      return NextResponse.json({ error: "Check-in list not found." }, { status: 404 })
    }

    const { isMember, error: membershipError } = await stationServesList(supabase, station.id, listId)
    if (membershipError) {
      Sentry.captureException(membershipError, { tags: { route: "kiosk/collected-status" }, extra: { eventId, listId } })
      return NextResponse.json({ error: "Something went wrong looking up this station's lists." }, { status: 503 })
    }
    if (!isMember) {
      return NextResponse.json({ error: "Check-in list not found." }, { status: 404 })
    }

    // Every check above has now positively succeeded (station exists, not
    // revoked, correct mode, correct event, confirmed member of this list) --
    // only now is it safe to record whether this station is staff-attended.
    isAttended = station.attended === true

    // Mirrors /api/kiosk/delegates' collection-list short-circuit exactly:
    // "proceed only if attended", never "skip unless unresolved" -- so a
    // future edit can't accidentally invert it. Not an error: an unattended
    // station polling this (which shouldn't normally happen, since the
    // client only polls when isCollectionListActive is already true, but
    // must still degrade safely if station state changed mid-session) just
    // gets an empty, blocked: true response.
    if (!isAttended) {
      return NextResponse.json({ registrations: [], blocked: true })
    }

    // Supabase caps a single query at ~1,000 rows -- same batched pagination
    // pattern as /api/kiosk/delegates' registrations fetch.
    let records: { registration_id: string; checked_in_at: string; station_id: string | null }[] = []
    let offset = 0
    const batchSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data: batch, error } = await (supabase as any)
        .from("checkin_records")
        .select("registration_id, checked_in_at, station_id")
        .eq("checkin_list_id", listId)
        .is("checked_out_at", null)
        .range(offset, offset + batchSize - 1)

      if (error) {
        Sentry.captureException(error, { tags: { route: "kiosk/collected-status" }, extra: { eventId, listId, offset } })
        return NextResponse.json({ error: "Failed to load collected status." }, { status: 500 })
      }

      if (batch && batch.length > 0) {
        records = records.concat(batch)
        offset += batchSize
        hasMore = batch.length === batchSize
      } else {
        hasMore = false
      }
    }

    return NextResponse.json({ registrations: records, blocked: false })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "kiosk/collected-status" }, extra: { eventId, listId } })
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
  }
}
