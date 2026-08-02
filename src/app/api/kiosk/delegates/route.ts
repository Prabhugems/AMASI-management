import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { resolveStationByToken, stationServesList } from "@/lib/kiosk-station-lookup"

// GET /api/kiosk/delegates?event_id=&token=|&station_token= -- bulk delegate
// roster for the self-check-in kiosk's local delegate cache (Stage 1 of the
// offline-first kiosk redesign, see
// docs/superpowers/plans/2026-07-27-kiosk-offline-first-stage1.md).
//
// This is the largest single PII export in the app (~2,000 full records
// in one response), so unlike /api/kiosk/checkin's bare "unguessable UUID
// pair" trust model, this route requires ONE of two credentials -- either
// is an equally strict authorization gate; an admin session does not
// substitute for either of them:
//   - `token`: the target checkin_lists row's own access_token -- the same
//     credential /checkin/access/[token] and /print/[token] already use,
//     auto-generated on every list by a DB trigger (never null). The
//     original, direct-URL kiosk path.
//   - `station_token` (Stage 3, docs/superpowers/specs/2026-07-27-kiosk-stage3-station-identity-design.md):
//     a kiosk_stations row's own token. A station now serves a SET of lists
//     (kiosk_station_lists), not a single bound list, so the caller must
//     also supply `list_id` to say which of the station's assigned lists it
//     wants a roster for -- the server verifies station membership for that
//     specific list before returning anything. The list's own access_token
//     is never fetched, read, or transmitted to the browser on this path --
//     that's the whole point of station identity. Just as strict: any
//     failure to resolve (missing, malformed, revoked, wrong mode, wrong
//     event, not a member of the requested list) rejects the request
//     exactly like a bad `token` would, never falls back to open access.
//
// Matching scope must mirror /api/kiosk/checkin's server-side eligibility
// gate exactly (Stage 2, docs/superpowers/specs/2026-07-27-kiosk-stage2-checkin-authority-design.md):
// event_id, AND ticket_type_ids/addon_ids restriction when the list has one.
// The local cache and the server's live check must never disagree about who
// is eligible to self-check-in -- a mismatch here means the kiosk shows a
// false "Check-in successful!" from the stale local cache while the server
// silently 404s the sync.
export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`kiosk-delegates:${clientIp}`, "public")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")
  const token = searchParams.get("token")
  const stationToken = searchParams.get("station_token")
  const requestedListId = searchParams.get("list_id")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }
  if (!token && !stationToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 })
  }
  // A station now serves a SET of lists (kiosk_station_lists), not one --
  // the caller must say which of the station's assigned lists it wants a
  // roster for. The direct token path needs no equivalent: checkin_lists'
  // own access_token is already list-specific.
  if (stationToken && (!requestedListId || !isValidUUID(requestedListId))) {
    return NextResponse.json({ error: "list_id is required." }, { status: 400 })
  }

  try {
    const supabase = await createAdminClient()

    let list: any = null
    let listLookupError: any = null
    // Hoisted like list/listLookupError above -- needed further down, past
    // the `if (stationToken)` block where `station` itself goes out of
    // scope. Defaults closed: only ever flipped to true once every station-
    // resolution check below has positively succeeded.
    let stationIsAttended = false

    if (stationToken) {
      const { station, error: stationLookupError } = await resolveStationByToken(supabase, stationToken)

      if (stationLookupError) {
        Sentry.captureException(stationLookupError, { tags: { route: "kiosk/delegates" }, extra: { eventId } })
        return NextResponse.json({ error: "Something went wrong looking up this station." }, { status: 503 })
      }
      if (!station || station.revoked_at || (station.mode !== "checkin" && station.mode !== "checkin_and_print")) {
        return NextResponse.json({ error: "Invalid access token." }, { status: 401 })
      }
      if (station.event_id !== eventId) {
        return NextResponse.json({ error: "Check-in list not found." }, { status: 404 })
      }

      const { isMember, error: membershipError } = await stationServesList(supabase, station.id, requestedListId as string)
      if (membershipError) {
        // Same rationale as the listLookupError/stationLookupError handling
        // above: a transient Supabase error here must not look identical to
        // "this station genuinely doesn't serve this list" (both would
        // otherwise produce a hard 404, indistinguishable from a permanent
        // credential rejection).
        Sentry.captureException(membershipError, { tags: { route: "kiosk/delegates" }, extra: { eventId } })
        return NextResponse.json({ error: "Something went wrong looking up this station's lists." }, { status: 503 })
      }
      if (!isMember) {
        return NextResponse.json({ error: "Check-in list not found." }, { status: 404 })
      }

      // Every check above has now positively succeeded (station exists, not
      // revoked, correct mode, correct event, confirmed member of THIS
      // list) -- only now is it safe to record whether this station is
      // staff-attended, for the collection-list gate further down.
      stationIsAttended = station.attended === true

      const result = await (supabase as any)
        .from("checkin_lists")
        .select("id, event_id, name, list_purpose, ticket_type_ids, addon_ids")
        .eq("id", requestedListId)
        .maybeSingle()
      list = result.data
      listLookupError = result.error

      // touch last_seen_at -- best-effort, never blocks the roster response
      // on a failure here.
      await (supabase as any)
        .from("kiosk_stations")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", station.id)
    } else {
      const result = await (supabase as any)
        .from("checkin_lists")
        .select("id, event_id, name, list_purpose, access_token_expires_at, ticket_type_ids, addon_ids")
        .eq("access_token", token)
        .maybeSingle()
      list = result.data
      listLookupError = result.error
    }

    if (listLookupError) {
      // A transient Supabase error looks identical to "no list matched this
      // token" if left undistinguished -- destructure and report it rather
      // than falling into the 401 credential-rejection branch below, which
      // is meant for a genuinely wrong/missing token, not an infra hiccup.
      // 503 lets the page's stale-cache path treat this as transient and
      // retryable, rather than a credential rejection.
      Sentry.captureException(listLookupError, { tags: { route: "kiosk/delegates" }, extra: { eventId } })
      return NextResponse.json({ error: "Something went wrong looking up this list." }, { status: 503 })
    }

    if (!list) {
      return NextResponse.json(
        { error: stationToken ? "Check-in list not found." : "Invalid access token." },
        { status: stationToken ? 404 : 401 }
      )
    }
    if (!stationToken && list.access_token_expires_at && new Date(list.access_token_expires_at) < new Date()) {
      return NextResponse.json({ error: "This link has expired." }, { status: 401 })
    }
    if (list.event_id !== eventId) {
      return NextResponse.json({ error: "Check-in list not found." }, { status: 404 })
    }

    // Self check-in is entry-only for an UNATTENDED kiosk (see
    // /api/kiosk/checkin) -- nothing worth caching for a list the kiosk will
    // never accept a scan against. list_purpose is included in the response
    // so the page can distinguish "legitimately nothing to cache" from
    // "haven't fetched yet".
    //
    // This is the one place in this route where station resolution GATES
    // behavior rather than merely attributing it: a collection-purpose list
    // still gets the real roster when (and only when) the request came via
    // station_token AND that station resolved through every single check
    // above with no ambiguity AND is staff-attended (stationIsAttended).
    // stationIsAttended defaults to false and is only ever set true after
    // every prior check has positively succeeded, so any resolution
    // failure -- bad/missing/revoked token, wrong mode, wrong event, not a
    // member of this list, or a transient lookup error -- leaves it false
    // and this short-circuit still fires. Fail closed, always: the check is
    // written as "proceed only if attended", never as "skip unless
    // unresolved", so it can't accidentally invert under a future edit.
    if (list.list_purpose === "collection" && !stationIsAttended) {
      return NextResponse.json({ delegates: [], name: list.name, list_purpose: list.list_purpose, blocked: true })
    }

    // List eligibility: mirrors src/app/api/checkin/access/[accessToken]/attendees/route.ts:49-84
    // exactly -- same computation /api/kiosk/checkin's server-side gate uses.
    // If the list restricts by addons, fetch eligible registration IDs first
    // and collapse to an ID set (this route genuinely needs the full
    // eligible-ID set to build a roster, unlike /api/kiosk/checkin's
    // single-registration boolean check, so `.in("addon_id", ...)` here is
    // the right shape, not a per-registration `.eq`).
    let addonFilteredRegIds: string[] | null = null
    if (Array.isArray(list.addon_ids) && list.addon_ids.length > 0) {
      // Fetch in batches -- Supabase caps a single query at ~1000 rows, and
      // an addon-restricted list's eligible-registration count can exceed
      // that for a large event. Same pattern as
      // src/app/api/reviewers-pool/route.ts:101-116.
      let allAddonRegs: { registration_id: string }[] = []
      let offset = 0
      const batchSize = 1000
      let hasMore = true

      while (hasMore) {
        // .order() is required, not optional -- bug-audit fix (2026-08).
        // Without an explicit, stable order, Postgres/PostgREST doesn't
        // guarantee consistent row order across repeated paginated requests
        // (not even between two back-to-back queries with nothing written in
        // between). Under concurrent inserts during a live event, that could
        // silently skip or duplicate rows across pages -- the same
        // pagination bug class CLAUDE.md already documents was found (and
        // fixed the same way) in the halls/tracks backfill scripts.
        const { data: batch, error: addonError } = await (supabase as any)
          .from("registration_addons")
          .select("registration_id")
          .in("addon_id", list.addon_ids)
          .order("id")
          .range(offset, offset + batchSize - 1)

        if (addonError) {
          Sentry.captureException(addonError, { tags: { route: "kiosk/delegates" }, extra: { eventId, listId: list.id } })
          return NextResponse.json({ error: "Failed to load delegate roster." }, { status: 500 })
        }

        if (batch && batch.length > 0) {
          allAddonRegs = allAddonRegs.concat(batch)
          offset += batchSize
          hasMore = batch.length === batchSize
        } else {
          hasMore = false
        }
      }

      addonFilteredRegIds = [...new Set(allAddonRegs.map((r) => r.registration_id))]
      if (addonFilteredRegIds.length === 0) {
        // Legitimately empty (no registration holds the restricted addon),
        // not a collection-list policy block -- blocked: false so the
        // client caches this as a real (if empty) roster rather than
        // treating it as the "see a staff member" case.
        return NextResponse.json({ delegates: [], name: list.name, list_purpose: list.list_purpose, blocked: false })
      }
    }

    // Supabase caps a single query at ~1,000 rows -- with ~2,000 delegates
    // expected for AMASICON's main event, a bare unpaginated query would
    // silently truncate the cache past row 1,000 (no error, no admin
    // visibility -- see the module comment above). Batch across pages until
    // one comes back short, mirroring the precedent in
    // /api/reviewers-pool/route.ts. The eligibility filters below apply to
    // every page, not just the first.
    let registrations: unknown[] = []
    let offset = 0
    const batchSize = 1000
    let hasMore = true

    while (hasMore) {
      let registrationsQuery = (supabase as any)
        .from("registrations")
        .select(`
          id,
          registration_number,
          attendee_name,
          attendee_email,
          attendee_phone,
          attendee_designation,
          attendee_institution
        `)
        .eq("event_id", eventId)

      if (Array.isArray(list.ticket_type_ids) && list.ticket_type_ids.length > 0) {
        registrationsQuery = registrationsQuery.in("ticket_type_id", list.ticket_type_ids)
      }
      if (addonFilteredRegIds !== null) {
        registrationsQuery = registrationsQuery.in("id", addonFilteredRegIds)
      }

      // .order() is required, not optional -- see the identical comment on
      // the registration_addons batch loop above (bug-audit fix, 2026-08).
      const { data: batch, error } = await registrationsQuery.order("id").range(offset, offset + batchSize - 1)

      if (error) {
        Sentry.captureException(error, { tags: { route: "kiosk/delegates" }, extra: { eventId, listId: list.id, offset } })
        return NextResponse.json({ error: "Failed to load delegate roster." }, { status: 500 })
      }

      if (batch && batch.length > 0) {
        registrations = registrations.concat(batch)
        offset += batchSize
        hasMore = batch.length === batchSize
      } else {
        hasMore = false
      }
    }

    const delegates = registrations.map((r: any) => ({
      id: r.id,
      registration_number: r.registration_number,
      attendee_name: r.attendee_name,
      attendee_email: r.attendee_email,
      attendee_phone: r.attendee_phone,
      attendee_designation: r.attendee_designation,
      attendee_institution: r.attendee_institution,
    }))

    return NextResponse.json({ delegates, name: list.name, list_purpose: list.list_purpose, blocked: false })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "kiosk/delegates" }, extra: { eventId } })
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
  }
}
