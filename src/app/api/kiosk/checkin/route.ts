import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID, sanitizeSearchInput } from "@/lib/validation"
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

// Shared response builder for the fresh-resolution path's collection-list
// gate ONLY -- there is a single call site for this helper below.
// Deliberately NOT reused for the pre-Stage-2 fallback path -- that path has
// its own separate, unconditional inline check (it has no
// ticket_type_ids/addon_ids eligibility check at all, unlike this one, so it
// must never honor isAttendedStation; see the comment at that call site).
// This split is a deliberate earlier decision, not an oversight.
//
// `hadError` distinguishes two very different reasons isAttendedStation can
// be false: a genuine, definitive verdict (station not found/revoked/wrong
// mode/wrong event/not a member of this list, or simply not attended) vs. a
// transient lookup error (resolveStationByToken or stationServesList itself
// errored) that left the question unanswered. The former is a permanent
// business rejection (403); the latter is retryable and must not be
// presented as one (503) -- matching /api/kiosk/delegates' existing
// distinction for the equivalent situation.
function collectionListBlockedResponse(
  list: { list_purpose: string },
  isAttendedStation: boolean,
  hadError: boolean
): NextResponse | null {
  if (list.list_purpose !== "collection" || isAttendedStation) return null
  if (hadError) {
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again in a moment." },
      { status: 503 }
    )
  }
  return NextResponse.json(
    { success: false, message: "Self check-in isn't available for this list. Please see a staff member." },
    { status: 403 }
  )
}

// Authorization gate (bug-audit finding, 2026-08): this route previously
// accepted a check-in from anyone who knew an event_id + checkin_list_id --
// both plainly visible, non-secret path segments of the public kiosk URL.
// Called once per branch below, right after that branch's own
// `checkin_lists` fetch (which already selects access_token/
// access_token_expires_at) -- no separate query needed. A resolved
// station_token (stationId !== null) already proved authorization on its
// own; `token` is only checked when that's not the case.
function validateListToken(
  list: { id: string; access_token: string | null; access_token_expires_at: string | null },
  token: string | undefined,
  stationId: string | null
): NextResponse | null {
  if (stationId) return null
  if (!token || !list.access_token || token !== list.access_token) {
    return NextResponse.json({ success: false, message: "Invalid access token." }, { status: 401 })
  }
  if (list.access_token_expires_at && new Date(list.access_token_expires_at) < new Date()) {
    return NextResponse.json({ success: false, message: "This link has expired." }, { status: 401 })
  }
  return null
}

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
    // The target list's own checkin_lists.access_token -- the direct-URL
    // kiosk path's credential (same one /api/kiosk/delegates already
    // requires). Added retroactively (bug-audit finding, 2026-08): this
    // route previously accepted a check-in from anyone who merely knew an
    // event_id + checkin_list_id, both plainly visible in the public kiosk
    // URL/QR code -- see the token-gate check below.
    const token = body.token as string | undefined
    // Strip characters that have meaning in PostgREST's .or() filter so user
    // input can't break out of the ilike clauses -- only matters on the
    // registration_id-absent fallback path below, where this is used for
    // matching again; on the normal path it's kept only for context.
    // sanitizeSearchInput escapes ilike's own wildcard characters (% and _)
    // -- previously unescaped here, a bare "%" search matched every
    // registration in the event and checked in whichever came back first
    // (bug-audit finding, 2026-08).
    const searchTerm = sanitizeSearchInput((body.search ?? "").toString().replace(/[(),]/g, "")).trim()

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
    // Authorization gate (bug-audit finding, 2026-08): every legitimate
    // caller has one of these two credentials -- kiosk-sync-worker.ts now
    // sends the list's own access_token on the direct-URL path and
    // station_token on the station path (mirroring /api/kiosk/delegates,
    // which has required this since Stage 3). Neither present means this
    // request didn't come from a real kiosk device.
    if (!token && !stationToken) {
      return NextResponse.json({ success: false, message: "Missing access token." }, { status: 401 })
    }

    const supabase = await createAdminClient()

    // Stage 3: resolve station_id for attribution AND (see the token-gate
    // check below) authorization. A station_token that's absent, malformed,
    // revoked, doesn't resolve, or doesn't serve this list never blocks a
    // check-in by itself -- it only fails to attribute/authorize via this
    // credential, and the request still succeeds if `token` independently
    // validates.
    let stationId: string | null = null
    // Defaults closed. This is the ONE place in this route where station
    // resolution stops being purely cosmetic attribution and starts gating
    // real behavior -- whether a collection-purpose list's scan is allowed
    // at all (see the two list_purpose === "collection" checks below). It
    // is deliberately wired to fail closed: isAttendedStation is only ever
    // set true inside the SAME `if` block that already gates `stationId`,
    // after every one of its checks (station exists, not revoked, correct
    // mode, correct event, confirmed member of this list) has positively
    // succeeded -- so any resolution failure or ambiguity leaves it false,
    // exactly like it already leaves `stationId` null, and a collection
    // scan is denied by default. This is intentionally an AND-chain of
    // successes, not a negated failure check, so a future edit to this
    // condition can't silently flip a resolution failure into an "allow".
    let isAttendedStation = false
    // True only when a GENUINE, transient lookup error occurred on an
    // otherwise-plausible station (the lookup itself errored, or the
    // station resolved and passed every check but the membership query
    // errored) -- as opposed to a definitive negative match (no/invalid
    // token, station not found, revoked, wrong mode/event, or a clean
    // "not a member of this list"/"not attended"). This does NOT change
    // entry-list behavior at all: a resolution error there still simply
    // leaves the scan unattributed (stationId stays null), never blocking,
    // exactly as before. It exists ONLY so the collection-list gate below
    // (collectionListBlockedResponse) can tell "genuinely not an attended
    // station" (403, permanent) apart from "we couldn't tell because a
    // query errored" (503, retryable) -- mirroring the distinction
    // /api/kiosk/delegates already makes for the equivalent situation.
    let stationLookupHadError = false
    if (stationToken) {
      const { station, error: stationLookupError } = await resolveStationByToken(supabase, stationToken)

      if (stationLookupError) {
        // The lookup itself errored -- unconditionally a resolution error,
        // never a "station doesn't exist" verdict. (A missing/invalid
        // token instead resolves cleanly to station === null with no
        // error, and falls through the `else if` below as a genuine,
        // definitive non-match.)
        stationLookupHadError = true
      } else if (
        station &&
        !station.revoked_at &&
        (station.mode === "checkin" || station.mode === "checkin_and_print") &&
        station.event_id === eventId
      ) {
        // Station itself resolved fully and unambiguously -- now check
        // list membership. A query error here is ALSO a resolution error
        // (the station is otherwise plausible; we simply couldn't confirm
        // membership) -- distinct from a clean isMember: false, which is a
        // genuine, definitive "not assigned to this list."
        const { isMember, error: membershipError } = await stationServesList(supabase, station.id, checkinListId)
        if (membershipError) {
          stationLookupHadError = true
        } else if (isMember) {
          stationId = station.id
          // Only reachable once every check above has already passed --
          // AND-ing station.attended onto an already-fully-resolved
          // station, never evaluated independently of it.
          isAttendedStation = station.attended === true
        }
      }
    }

    // The second half of this gate -- validating `token` against this exact
    // list's own access_token when station_token didn't resolve -- happens
    // per-branch below (validateListToken), against the same `checkin_lists`
    // row each branch already has to fetch for its own business logic. No
    // separate query needed.

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
        .select("id, event_id, list_purpose, ticket_type_ids, addon_ids, starts_at, ends_at, access_token, access_token_expires_at")
        .eq("id", checkinListId)
        .maybeSingle()

      if (!list || list.event_id !== eventId) {
        return NextResponse.json({ success: false, message: "Check-in list not found." }, { status: 404 })
      }

      const tokenError = validateListToken(list, token, stationId)
      if (tokenError) return tokenError

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

      // The kiosk is unattended by default -- nobody is standing there to
      // stop a delegate self-serving a second kit/paper/badge. Collection
      // lists (repeat scan means "do not issue again") are normally
      // staff-scanner-only. The one exception: isAttendedStation (see
      // above), which can only be true when station resolution fully and
      // unambiguously succeeded AND the station is staff-attended -- any
      // other case (no station_token, unattended station, or a genuine,
      // definitive non-match) leaves it false and this still blocks with a
      // 403. The one further distinction: if isAttendedStation is false
      // because a lookup genuinely ERRORED (stationLookupHadError) rather
      // than definitively resolving to "not attended", this returns a 503
      // instead -- a transient infrastructure hiccup must not look like a
      // permanent business rejection to the client's retry logic.
      const blockedResponse = collectionListBlockedResponse(list, isAttendedStation, stationLookupHadError)
      if (blockedResponse) return blockedResponse

      return completeCheckin(supabase, publicRegistration, registration.id, eventId, checkinListId, scanId, stationId, timeWindowWarning)
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
      .select("id, event_id, list_purpose, starts_at, ends_at, access_token, access_token_expires_at")
      .eq("id", checkinListId)
      .maybeSingle()

    if (!list || list.event_id !== eventId) {
      return NextResponse.json({ success: false, message: "Check-in list not found." }, { status: 404 })
    }

    const tokenError = validateListToken(list, token, stationId)
    if (tokenError) return tokenError

    const { warning: timeWindowWarning } = checkTimeWindow(list)

    // Unconditional block, UNLIKE the fresh-resolution path above -- this
    // fallback path is a fuzzy `.or()` search with NO ticket_type_ids/
    // addon_ids eligibility check at all (see the header comment), so it
    // must never be the one that lets a collection list through. Extending
    // the attended-station exception here would let an attended station
    // check a delegate into a collection list (e.g. an addon-restricted
    // meal) with zero verification they're actually eligible for it.
    // Deliberately NOT using collectionListBlockedResponse's isAttendedStation
    // parameter here -- this path's semantics genuinely differ from the
    // fresh-resolution path's, so it gets its own always-false check rather
    // than being made attended-aware while deduplicating.
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

    return completeCheckin(supabase, fuzzyRegistration, fuzzyRegistration.id, eventId, checkinListId, scanId, stationId, timeWindowWarning)
  } catch (error: any) {
    console.error("Kiosk check-in error:", error)
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}

// Best-effort audit trail for a kiosk-detected duplicate/conflict scan --
// e.g. two devices independently checked the same delegate into the same
// list while both were offline, and the loser only discovers this once it
// reconnects and syncs. Without this, that event left NO trace anywhere an
// admin could review after the fact: checkin_records only ever holds the ONE
// winning row (correctly -- no kit is double-issued), and this route never
// wrote to checkin_audit_log at all (only the staff-scanner endpoint,
// /api/verify/[token], did). `performed_via: "kiosk"` distinguishes these
// rows from that endpoint's `"qr_scan"` rows. Always `success: true` --
// matching this repo's documented model (CLAUDE.md's Check-in Model note):
// a repeat scan is never an error, just a fact worth recording. Wrapped in
// try/catch and never awaited by the caller's response -- an audit-log
// failure must never turn a successful check-in response into a 500.
async function logKioskDuplicateAudit(
  supabase: any,
  params: { eventId: string; checkinListId: string; registrationId: string; stationId: string | null }
): Promise<void> {
  try {
    await supabase.from("checkin_audit_log").insert({
      event_id: params.eventId,
      checkin_list_id: params.checkinListId,
      registration_id: params.registrationId,
      action: "check_in",
      performed_by: "Self check-in (kiosk)",
      performed_via: "kiosk",
      device_info: params.stationId ? { station_id: params.stationId, duplicate: true } : { duplicate: true },
      success: true,
    })
  } catch (err) {
    console.error("Kiosk duplicate audit log insert failed:", err)
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
  eventId: string,
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
  //
  // Bug-audit fix (2026-08): this used to filter on `.is("checked_out_at",
  // null)`, so a delegate who'd been checked OUT (e.g. via the staff
  // checkout flow) was invisible to this pre-check and fell through to an
  // INSERT that always violates the UNIQUE constraint regardless -- landing
  // in the generic 23505 handler below with a misleading "You're already
  // checked in!" and no working path in this route to ever actually
  // reactivate them. Now fetches ANY existing row (checked-out, reversed, or
  // not) and branches on it explicitly.
  //
  // reversed_at follow-up (2026-08): the help desk's Reverse action
  // explicitly promises "this delegate can be checked in again" -- without
  // treating a reversed row the same as a checked-out one here, this route
  // would still tell that delegate "You're already checked in!" and block
  // the exact re-scan the reversal was meant to allow (the staff-scanner
  // side of this same gap was fixed separately in /api/verify/[token]).
  const { data: existing } = await (supabase as any)
    .from("checkin_records")
    .select("id, checked_in_at, station_id, checked_out_at, reversed_at")
    .eq("registration_id", registrationId)
    .eq("checkin_list_id", checkinListId)
    .limit(1)
    .maybeSingle()

  if (existing && !existing.checked_out_at && !existing.reversed_at) {
    await logKioskDuplicateAudit(supabase, { eventId, checkinListId, registrationId, stationId })
    return NextResponse.json({
      success: true,
      message: "You're already checked in!",
      registration: registrationForResponse,
      alreadyCheckedIn: true,
      checked_in_at: existing.checked_in_at,
      // Named distinctly from this function's own `stationId` parameter
      // (the CURRENT request's station) -- this is the station attributed
      // to the EXISTING prior check-in, which may be a different station or
      // none at all. Raw id only: resolving it to a display name happens
      // client-side from a locally-cached station list, not here.
      attributed_station_id: existing.station_id,
    })
  }

  const now = new Date().toISOString()

  if (existing && (existing.checked_out_at || existing.reversed_at)) {
    // Reactivate the same row rather than inserting a second one -- the
    // UNIQUE(checkin_list_id, registration_id) constraint means a second row
    // for this pair can never be created. This is a genuine, fresh
    // check-in from the delegate's perspective, so it gets the same
    // success response a brand-new insert would, not "already checked in."
    const { error: reactivateError } = await (supabase as any)
      .from("checkin_records")
      .update({
        checked_in_at: now,
        checked_in_by: "Self check-in (kiosk)",
        checked_out_at: null,
        reversed_at: null,
        reversed_by: null,
        reversal_reason: null,
        scan_id: scanId,
        station_id: stationId,
      })
      .eq("id", existing.id)

    if (reactivateError) {
      console.error("Kiosk check-in reactivation failed:", reactivateError)
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

  const { error: insertError } = await (supabase as any)
    .from("checkin_records")
    .insert({
      registration_id: registrationId,
      checkin_list_id: checkinListId,
      checked_in_at: now,
      checked_in_by: "Self check-in (kiosk)",
      scan_id: scanId,
      // Defense-in-depth: omit the key entirely when there's no station to
      // attribute to, rather than sending `station_id: null`. The column
      // (checkin_records.station_id) was applied to production on
      // 2026-07-28 -- see CLAUDE.md's migration-pipeline section -- so this
      // is no longer about the column potentially not existing; it's just
      // correct behavior regardless: every check-in via the pre-existing
      // direct-URL kiosk flow has stationId === null, and there's simply
      // nothing to attribute in that case.
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

      await logKioskDuplicateAudit(supabase, { eventId, checkinListId, registrationId, stationId })
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
