import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// GET /api/kiosk/delegates?event_id=&token= -- bulk delegate roster for
// the self-check-in kiosk's local delegate cache (Stage 1 of the
// offline-first kiosk redesign, see
// docs/superpowers/plans/2026-07-27-kiosk-offline-first-stage1.md).
//
// This is the largest single PII export in the app (~2,000 full records
// in one response), so unlike /api/kiosk/checkin's bare "unguessable UUID
// pair" trust model, this route requires the list's own access_token --
// the same credential /checkin/access/[token] and /print/[token] already
// use, auto-generated on every list by a DB trigger (never null). An
// admin session does not substitute for it.
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

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }
  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 })
  }

  try {
    const supabase = await createAdminClient()

    const { data: list, error: listLookupError } = await (supabase as any)
      .from("checkin_lists")
      .select("id, event_id, list_purpose, access_token, access_token_expires_at, ticket_type_ids, addon_ids")
      .eq("access_token", token)
      .maybeSingle()

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
      return NextResponse.json({ error: "Invalid access token." }, { status: 401 })
    }
    if (list.access_token_expires_at && new Date(list.access_token_expires_at) < new Date()) {
      return NextResponse.json({ error: "This link has expired." }, { status: 401 })
    }
    if (list.event_id !== eventId) {
      return NextResponse.json({ error: "Check-in list not found." }, { status: 404 })
    }

    // Self check-in is entry-only, permanently (see /api/kiosk/checkin) --
    // nothing worth caching for a list the kiosk will never accept a scan
    // against. list_purpose is included in the response so the page can
    // distinguish "legitimately nothing to cache" from "haven't fetched yet".
    if (list.list_purpose === "collection") {
      return NextResponse.json({ delegates: [], list_purpose: list.list_purpose })
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
        const { data: batch, error: addonError } = await (supabase as any)
          .from("registration_addons")
          .select("registration_id")
          .in("addon_id", list.addon_ids)
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
        return NextResponse.json({ delegates: [], list_purpose: list.list_purpose })
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

      const { data: batch, error } = await registrationsQuery.range(offset, offset + batchSize - 1)

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

    return NextResponse.json({ delegates, list_purpose: list.list_purpose })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "kiosk/delegates" }, extra: { eventId } })
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
  }
}
