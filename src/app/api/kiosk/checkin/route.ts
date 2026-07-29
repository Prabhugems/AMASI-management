import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { checkTimeWindow } from "@/lib/checkin-time-window"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { resolveStationByToken, stationServesList } from "@/lib/kiosk-station-lookup"

// POST /api/kiosk/checkin -- public self check-in for the /kiosk/[eventId]/[listId]
// page. The kiosk runs as the anon browser client, but checkin_records has RLS
// enabled with no policy, so a direct browser insert is always denied. This
// route performs the lookup + insert server-side with the admin client (which
// bypasses RLS), mirroring every other check-in path in the app.
//
// Stage 2 (docs/superpowers/specs/2026-07-27-kiosk-stage2-checkin-authority-design.md):
// the client (kiosk-sync-worker.ts) resolves `registration_id` itself from its
// local IndexedDB cache and sends it directly -- this route trusts that
// resolution instead of re-deriving one via fuzzy search, and uses `scan_id`
// to make retries of the same scan deterministic.
//
// TEMPORARY, one-release compatibility shim (final-review-fix-report for this
// stage, Fix 4 -- remove once there's confidence every kiosk device has
// reloaded past this stage): a kiosk tablet stays open all day without
// reloading its JS bundle, so an already-open tab can still be running
// pre-Stage-2 code that POSTs the OLD request shape -- no `registration_id`
// at all. Rather than 400ing every scan on that device until someone
// physically walks over and reloads it, `registration_id` is optional: if
// it's simply absent (not present-but-malformed), this route falls back to
// running the OLD pre-Stage-2 fuzzy `.or()` search against `search`,
// matching that route's exact prior behavior end to end -- including its
// "not found" response being a bare 200/success:false, not a 404.
export async function POST(request: NextRequest) {
  // Public, unauthenticated -- rate-limit by IP to blunt enumeration while
  // staying generous enough for a real kiosk queue.
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`kiosk-checkin:${clientIp}`, "public")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  try {
    const body = await request.json().catch(() => ({}))
    const eventId = body.event_id as string | undefined
    const checkinListId = body.checkin_list_id as string | undefined
    const registrationId = body.registration_id as string | undefined
    const scanId = body.scan_id as string | undefined
    const stationToken = body.station_token as string | undefined
    // Strip characters that have meaning in PostgREST's .or() filter so user
    // input can't break out of the ilike clauses -- only matters on the
    // registration_id-absent fallback path below, where this is used for
    // matching again; on the normal path it's kept only for context.
    const searchTerm = (body.search ?? "").toString().replace(/[(),]/g, "").trim()

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json({ success: false, message: "Invalid event." }, { status: 400 })
    }
    if (!checkinListId || !isValidUUID(checkinListId)) {
      return NextResponse.json({ success: false, message: "Invalid check-in list." }, { status: 400 })
    }
    // registration_id is optional -- see the TEMPORARY fallback note above.
    // Only reject it if it's present but malformed, not if it's simply absent.
    if (registrationId !== undefined && !isValidUUID(registrationId)) {
      return NextResponse.json({ success: false, message: "Invalid registration." }, { status: 400 })
    }
    if (!scanId || !isValidUUID(scanId)) {
      return NextResponse.json({ success: false, message: "Invalid scan." }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Stage 3: resolve station_id for attribution only -- this route was
    // never token-gated (see the header comment above), so a station_token
    // that's absent, malformed, revoked, doesn't resolve, or doesn't serve
    // this list must NEVER block a check-in from completing. It only fails
    // to attribute it to a station.
    let stationId: string | null = null
    if (stationToken) {
      const { station } = await resolveStationByToken(supabase, stationToken)

      if (
        station &&
        !station.revoked_at &&
        (station.mode === "checkin" || station.mode === "checkin_and_print") &&
        station.event_id === eventId &&
        (await stationServesList(supabase, station.id, checkinListId))
      ) {
        stationId = station.id
      }
    }

    // --- scan_id replay check, first, before anything else -------------
    // A row found here was, by construction, inserted BY this exact scan_id
    // -- scan_id is only ever attached to a row at insert time (see
    // completeCheckin below), never backfilled onto a pre-existing
    // "already checked in" row -- so a hit here always represents an
    // original FRESH insert, and alreadyCheckedIn is always false. The
    // registration_id in this request is not consulted at all on this path
    // -- the original recorded registration always wins.
    const { data: existingByScan } = await (supabase as any)
      .from("checkin_records")
      .select("id, registration_id, checkin_list_id, checked_in_at")
      .eq("scan_id", scanId)
      .maybeSingle()

    if (existingByScan) {
      // Defense-in-depth: scan_id is an unguessable UUID, so in practice a
      // row can only ever be found here if it was created for this same
      // checkin_list_id. But this is a public, unauthenticated endpoint --
      // never treat a row belonging to a DIFFERENT list as a replay for the
      // list this request specifies.
      if (existingByScan.checkin_list_id !== checkinListId) {
        return NextResponse.json({ success: false, message: "Check-in list not found." }, { status: 404 })
      }

      const { data: originalRegistration } = await (supabase as any)
        .from("registrations")
        .select(`
          id,
          registration_number,
          attendee_name,
          attendee_email,
          attendee_phone,
          attendee_designation,
          attendee_institution,
          ticket_type:ticket_types(name)
        `)
        .eq("id", existingByScan.registration_id)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        message: "Check-in successful!",
        registration: originalRegistration,
        alreadyCheckedIn: false,
      })
    }

    if (registrationId) {
      // --- Fresh resolution path: client already resolved identity --------
      const { data: registration } = await (supabase as any)
        .from("registrations")
        .select(`
          id,
          event_id,
          ticket_type_id,
          registration_number,
          attendee_name,
          attendee_email,
          attendee_phone,
          attendee_designation,
          attendee_institution,
          ticket_type:ticket_types(name)
        `)
        .eq("id", registrationId)
        .maybeSingle()

      if (!registration || registration.event_id !== eventId) {
        return NextResponse.json({ success: false, message: "Registration not found." }, { status: 404 })
      }

      const { data: list } = await (supabase as any)
        .from("checkin_lists")
        .select("id, event_id, list_purpose, ticket_type_ids, addon_ids, starts_at, ends_at")
        .eq("id", checkinListId)
        .maybeSingle()

      if (!list || list.event_id !== eventId) {
        return NextResponse.json({ success: false, message: "Check-in list not found." }, { status: 404 })
      }

      // --- List eligibility: mirrors src/app/api/checkin/access/[accessToken]/attendees/route.ts:49-84 exactly.
      // Empty/null ticket_type_ids/addon_ids = unrestricted, matching that
      // route's convention. This is the response the client never
      // distinguishes from "doesn't exist" / "wrong event" -- same 404,
      // same message, so a caller can't tell which reason applies.
      if (Array.isArray(list.ticket_type_ids) && list.ticket_type_ids.length > 0) {
        if (!list.ticket_type_ids.includes(registration.ticket_type_id)) {
          return NextResponse.json({ success: false, message: "Registration not found." }, { status: 404 })
        }
      }
      if (Array.isArray(list.addon_ids) && list.addon_ids.length > 0) {
        // Scoped to this ONE registration -- this route only ever needs a
        // single boolean, unlike the roster-building use of this same
        // eligibility pattern in /api/kiosk/delegates and
        // /api/checkin/access/[accessToken]/attendees, which genuinely need
        // the full eligible-ID set. An unscoped `.in("addon_id", ...)` here
        // would fetch every registration_addons row for the addon across the
        // WHOLE event -- past Supabase's ~1000-row cap that silently 404s
        // eligible delegates once an addon has enough registrants.
        const { data: addonRow } = await (supabase as any)
          .from("registration_addons")
          .select("registration_id")
          .eq("registration_id", registration.id)
          .in("addon_id", list.addon_ids)
          .limit(1)
          .maybeSingle()
        if (!addonRow) {
          return NextResponse.json({ success: false, message: "Registration not found." }, { status: 404 })
        }
      }

      // event_id/ticket_type_id were only fetched for the checks above --
      // strip them before this registration goes into any client response,
      // matching the field set the pre-Stage-2 route already returned.
      const { event_id: _regEventId, ticket_type_id: _regTicketTypeId, ...publicRegistration } = registration

      const { warning: timeWindowWarning } = checkTimeWindow(list)

      // The kiosk is unattended -- nobody is standing there to stop a
      // delegate self-serving a second kit/paper/badge. Collection lists
      // (repeat scan means "do not issue again") are staff-scanner-only; the
      // kiosk is entry-only by design, permanently.
      if (list.list_purpose === "collection") {
        return NextResponse.json(
          { success: false, message: "Self check-in isn't available for this list. Please see a staff member." },
          { status: 403 }
        )
      }

      return completeCheckin(supabase, publicRegistration, registration.id, checkinListId, scanId, stationId, timeWindowWarning)
    }

    // --- TEMPORARY fallback: registration_id absent (pre-Stage-2 kiosk bundle) ---
    // See the header comment above / Fix 4 in this stage's final-review-fix-
    // report. Reproduces the OLD pre-Stage-2 route end to end: list lookup +
    // collection/time-window checks first, then a fuzzy `.or()` search
    // scoped by event_id only -- no list-eligibility gate, since old clients
    // never had one and this is a compatibility shim, not new functionality
    // for them. Remove this whole branch once every kiosk device has
    // reloaded past this stage.
    const { data: list } = await (supabase as any)
      .from("checkin_lists")
      .select("id, event_id, list_purpose, starts_at, ends_at")
      .eq("id", checkinListId)
      .maybeSingle()

    if (!list || list.event_id !== eventId) {
      return NextResponse.json({ success: false, message: "Check-in list not found." }, { status: 404 })
    }

    const { warning: timeWindowWarning } = checkTimeWindow(list)

    if (list.list_purpose === "collection") {
      return NextResponse.json(
        { success: false, message: "Self check-in isn't available for this list. Please see a staff member." },
        { status: 403 }
      )
    }

    if (!searchTerm) {
      return NextResponse.json({ success: false, message: "Please enter a registration number." }, { status: 400 })
    }

    const { data: fuzzyRegistration } = await (supabase as any)
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        attendee_email,
        attendee_phone,
        attendee_designation,
        attendee_institution,
        ticket_type:ticket_types(name)
      `)
      .eq("event_id", eventId)
      .or(
        `registration_number.ilike.%${searchTerm}%,attendee_email.ilike.%${searchTerm}%,attendee_name.ilike.%${searchTerm}%,attendee_phone.ilike.%${searchTerm}%`
      )
      .limit(1)
      .maybeSingle()

    if (!fuzzyRegistration) {
      // OLD "not found" shape, verbatim: bare 200 with success:false, NOT a
      // 404 -- old-client classification logic checks `res.ok && data.success`
      // first, so this must match exactly for the fallback to behave
      // identically to before this stage shipped.
      return NextResponse.json({
        success: false,
        message: "Registration not found. Please check your registration number.",
      })
    }

    return completeCheckin(supabase, fuzzyRegistration, fuzzyRegistration.id, checkinListId, scanId, stationId, timeWindowWarning)
  } catch (error: any) {
    console.error("Kiosk check-in error:", error)
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}

// Shared tail for both the fresh-resolution path (registration_id present)
// and the TEMPORARY registration_id-absent fallback above: existing-active-
// record check, insert (with scan_id), 23505 race handling, registrations
// flag update, and the success response. Kept as one function so this logic
// -- especially the scan_id-race disambiguation below -- isn't duplicated
// between the two callers.
async function completeCheckin(
  supabase: any,
  registrationForResponse: any,
  registrationId: string,
  checkinListId: string,
  scanId: string,
  stationId: string | null,
  timeWindowWarning: string | null
): Promise<NextResponse> {
  // Already checked in on this list via some other path (e.g. staff
  // scanner, or a race -- see below)? allow_multiple_checkins is
  // intentionally ignored: UNIQUE(checkin_list_id, registration_id) means a
  // second insert always violates the constraint. This row's scan_id is NOT
  // backfilled -- it belongs to whatever originally created it.
  const { data: existing } = await (supabase as any)
    .from("checkin_records")
    .select("id")
    .eq("registration_id", registrationId)
    .eq("checkin_list_id", checkinListId)
    .is("checked_out_at", null)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      success: true,
      message: "You're already checked in!",
      registration: registrationForResponse,
      alreadyCheckedIn: true,
    })
  }

  const now = new Date().toISOString()

  const { error: insertError } = await (supabase as any)
    .from("checkin_records")
    .insert({
      registration_id: registrationId,
      checkin_list_id: checkinListId,
      checked_in_at: now,
      checked_in_by: "Self check-in (kiosk)",
      scan_id: scanId,
      // Defense-in-depth: omit the key entirely when there's no station to
      // attribute to, rather than sending `station_id: null`. Production does
      // not yet have this column (migration committed, intentionally
      // unapplied -- see CLAUDE.md's migration-pipeline section); every
      // check-in via the pre-existing direct-URL kiosk flow has stationId ===
      // null, so this keeps that already-live flow structurally immune to a
      // PostgREST "unknown column" rejection regardless of migration timing.
      ...(stationId && { station_id: stationId }),
    })

  if (insertError) {
    if (insertError.code === "23505") {
      // Two different constraints can produce a 23505 here: (checkin_list_id,
      // registration_id) -- a genuine prior check-in (via another path) raced
      // us -- or checkin_records_scan_id_key -- our OWN concurrent retry
      // (syncNow previously had no in-flight guard) raced itself and the
      // other copy of this exact request won. Distinguish by re-checking
      // scan_id: a row now existing for THIS scan_id means our own twin
      // succeeded, not a pre-existing check-in.
      const { data: wonByTwin } = await (supabase as any)
        .from("checkin_records")
        .select("id")
        .eq("scan_id", scanId)
        .maybeSingle()

      if (wonByTwin) {
        return NextResponse.json({
          success: true,
          message: "Check-in successful!",
          registration: registrationForResponse,
          alreadyCheckedIn: false,
        })
      }

      return NextResponse.json({
        success: true,
        message: "You're already checked in!",
        registration: registrationForResponse,
        alreadyCheckedIn: true,
      })
    }
    console.error("Kiosk check-in insert failed:", insertError)
    return NextResponse.json(
      { success: false, message: "Failed to check in. Please try again." },
      { status: 500 }
    )
  }

  await (supabase as any)
    .from("registrations")
    .update({ checked_in: true, checked_in_at: now })
    .eq("id", registrationId)

  return NextResponse.json({
    success: true,
    message: "Check-in successful!",
    registration: registrationForResponse,
    alreadyCheckedIn: false,
    ...(timeWindowWarning && { warning: timeWindowWarning }),
  })
}
