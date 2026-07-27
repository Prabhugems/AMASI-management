# Kiosk Stage 2 — Server-Side Check-In Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `POST /api/kiosk/checkin` trust the client's locally-resolved `registration_id` instead of re-deriving a match via fuzzy search, make replays of the same `scan_id` return the original outcome verbatim, and add a list-eligibility (`ticket_type_ids`/`addon_ids`) authorization gate the current fuzzy search never applied.

**Architecture:** One file rewrite (`src/app/api/kiosk/checkin/route.ts`) plus one small client addition (`src/lib/kiosk-sync-worker.ts` sends the `registration_id` it already has locally, and drops the `registrationMismatch` detection that's dead once the server stops independently re-resolving). No schema changes — `checkin_records.scan_id` and its partial unique index already exist from Stage 1's migration.

**Tech Stack:** Next.js 16 App Router, Supabase admin client, Vitest, Sentry (`@sentry/nextjs`, already installed).

## Global Constraints

- No new npm packages.
- No empty `catch` blocks. Anything caught and not re-thrown must call `Sentry.captureException(error)` with a `tags`/`extra` context object.
- No schema changes. `checkin_records.scan_id uuid` and `checkin_records_scan_id_key` (`unique index ... where scan_id is not null`) already exist (`supabase/migrations/20260727_kiosk_scan_id_and_kiosk_stations.sql`, applied in Stage 1).
- The list-eligibility check (`ticket_type_ids`/`addon_ids`) must mirror the existing pattern in `src/app/api/checkin/access/[accessToken]/attendees/route.ts:49-84` exactly — same two-filter shape (ticket_type_ids as a direct `.in()`, addon_ids via a `registration_addons` subquery collapsed to an ID list), same empty/null-means-unrestricted semantics. Do not invent a different eligibility computation.
- `POST /api/kiosk/checkin` has exactly one caller in this codebase: `src/lib/kiosk-sync-worker.ts`. No backward-compatibility path for a caller that omits `registration_id` or `scan_id` is needed — both become required fields.
- A `scan_id`-replay response never re-runs `list_purpose`/eligibility/time-window checks — those are pre-insert gates on the fresh-resolution path only (see spec §1, §3). A replay returns exactly what was originally recorded.
- Full design rationale: `docs/superpowers/specs/2026-07-27-kiosk-stage2-checkin-authority-design.md`.

---

### Task 1: Rewrite `/api/kiosk/checkin` — scan_id replay, registration_id authority, list eligibility

**Files:**
- Modify: `src/app/api/kiosk/checkin/route.ts`
- Create: `src/app/api/kiosk/checkin/route.test.ts` (this route has zero test coverage today — new file, not an extension)

**Interfaces:**
- Consumes: nothing from other tasks in this plan.
- Produces: the new request/response contract Task 2's client change depends on — `POST` body now requires `registration_id` (string, UUID) alongside the existing `event_id`, `checkin_list_id`, `scan_id`, `search`. Response shape (`success`, `message`, `registration`, `alreadyCheckedIn`) is unchanged from today; only how it's computed changes.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/api/kiosk/checkin/route.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"
const LIST_ID = "22222222-2222-2222-2222-222222222222"
const REG_ID = "33333333-3333-3333-3333-333333333333"
const OTHER_REG_ID = "44444444-4444-4444-4444-444444444444"
const SCAN_ID = "55555555-5555-5555-5555-555555555555"
const TICKET_TYPE_ID = "66666666-6666-6666-6666-666666666666"
const OTHER_TICKET_TYPE_ID = "77777777-7777-7777-7777-777777777777"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

function checkinRequest(body: Record<string, unknown>) {
  return makeRequest("http://localhost/api/kiosk/checkin", { method: "POST", body })
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    event_id: EVENT_ID,
    checkin_list_id: LIST_ID,
    registration_id: REG_ID,
    scan_id: SCAN_ID,
    search: "125A1001",
    ...overrides,
  }
}

function baseList(overrides: Record<string, unknown> = {}) {
  return {
    id: LIST_ID,
    event_id: EVENT_ID,
    list_purpose: "entry",
    ticket_type_ids: null,
    addon_ids: null,
    starts_at: null,
    ends_at: null,
    ...overrides,
  }
}

function baseRegistration(overrides: Record<string, unknown> = {}) {
  return {
    id: REG_ID,
    event_id: EVENT_ID,
    registration_number: "125A1001",
    attendee_name: "Jane Doe",
    attendee_email: "jane@example.com",
    attendee_phone: "9999999999",
    attendee_designation: null,
    attendee_institution: null,
    ticket_type_id: TICKET_TYPE_ID,
    ...overrides,
  }
}

describe("POST /api/kiosk/checkin", () => {
  it("replays a scan_id that already has a checkin_records row, without touching registrations/checkin_lists", async () => {
    mock.queueResponse("checkin_records", {
      data: { id: "cr-1", registration_id: REG_ID, checked_in_at: "2026-07-27T00:00:00Z" },
      error: null,
    })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.alreadyCheckedIn).toBe(false)
    expect(body.registration.id).toBe(REG_ID)
    expect(mock.calls.some((c) => c.table === "checkin_lists")).toBe(false)
  })

  it("replays the same scan_id identically on a second call (deterministic)", async () => {
    mock.queueResponse("checkin_records", {
      data: { id: "cr-1", registration_id: REG_ID, checked_in_at: "2026-07-27T00:00:00Z" },
      error: null,
    })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_records", {
      data: { id: "cr-1", registration_id: REG_ID, checked_in_at: "2026-07-27T00:00:00Z" },
      error: null,
    })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })

    const { POST } = await import("./route")
    const first = await (await POST(checkinRequest(baseBody()))).json()
    const second = await (await POST(checkinRequest(baseBody()))).json()

    expect(first.alreadyCheckedIn).toBe(second.alreadyCheckedIn)
    expect(first.success).toBe(second.success)
  })

  it("ignores a mismatched registration_id on a scan_id replay and returns the original registration", async () => {
    mock.queueResponse("checkin_records", {
      data: { id: "cr-1", registration_id: REG_ID, checked_in_at: "2026-07-27T00:00:00Z" },
      error: null,
    })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ registration_id: OTHER_REG_ID })))
    const body = await res.json()

    expect(body.registration.id).toBe(REG_ID)
  })

  it("404s when registration_id doesn't resolve at all", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("registrations", { data: null, error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))

    expect(res.status).toBe(404)
  })

  it("404s when the registration belongs to a different event", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("registrations", { data: baseRegistration({ event_id: "99999999-9999-9999-9999-999999999999" }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))

    expect(res.status).toBe(404)
  })

  it("404s when the registration's ticket_type_id isn't in the list's ticket_type_ids", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("registrations", { data: baseRegistration({ ticket_type_id: OTHER_TICKET_TYPE_ID }), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [TICKET_TYPE_ID] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))

    expect(res.status).toBe(404)
  })

  it("allows check-in when ticket_type_ids is empty (unrestricted)", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.alreadyCheckedIn).toBe(false)
  })

  it("403s for a collection-purpose list", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ list_purpose: "collection", ticket_type_ids: [] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))

    expect(res.status).toBe(403)
  })

  it("returns alreadyCheckedIn true when an active record already exists for this registration+list", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: { id: "cr-existing" }, error: null }) // existing-active-record check

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alreadyCheckedIn).toBe(true)
  })

  it("treats a 23505 insert race as an idempotent success", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check (not found yet)
    mock.queueResponse("checkin_records", { data: null, error: { code: "23505" } }) // insert races and loses

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.alreadyCheckedIn).toBe(true)
  })

  it("400s on a missing registration_id", async () => {
    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ registration_id: undefined })))
    expect(res.status).toBe(400)
  })

  it("400s on a missing scan_id", async () => {
    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ scan_id: undefined })))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/kiosk/checkin/route.test.ts`
Expected: FAIL — the route doesn't read `registration_id`/eligibility yet, so several assertions (status codes, `alreadyCheckedIn` on replay, the ticket_type_ids 404) won't match.

- [ ] **Step 3: Implement the route**

```typescript
// src/app/api/kiosk/checkin/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { checkTimeWindow } from "@/lib/checkin-time-window"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

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
// to make retries of the same scan deterministic. `search` is kept only for
// error-message/Sentry context, never for matching.
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
    const searchTerm = (body.search ?? "").toString().trim()

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json({ success: false, message: "Invalid event." }, { status: 400 })
    }
    if (!checkinListId || !isValidUUID(checkinListId)) {
      return NextResponse.json({ success: false, message: "Invalid check-in list." }, { status: 400 })
    }
    if (!registrationId || !isValidUUID(registrationId)) {
      return NextResponse.json({ success: false, message: "Invalid registration." }, { status: 400 })
    }
    if (!scanId || !isValidUUID(scanId)) {
      return NextResponse.json({ success: false, message: "Invalid scan." }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // --- scan_id replay check, first, before anything else -------------
    // A row found here was, by construction, inserted BY this exact scan_id
    // (the "already checked in via a different scan" path below never
    // attaches a scan_id to the pre-existing row it reports on) -- so a hit
    // here always represents an original FRESH insert, and alreadyCheckedIn
    // is always false. The registration_id in this request is not consulted
    // at all on this path -- the original recorded registration always wins.
    const { data: existingByScan } = await (supabase as any)
      .from("checkin_records")
      .select("id, registration_id, checked_in_at")
      .eq("scan_id", scanId)
      .maybeSingle()

    if (existingByScan) {
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

    // --- Fresh resolution path -------------------------------------------
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
      const { data: addonRegs } = await (supabase as any)
        .from("registration_addons")
        .select("registration_id")
        .in("addon_id", list.addon_ids)
      const eligibleIds = new Set((addonRegs || []).map((r: any) => r.registration_id))
      if (!eligibleIds.has(registration.id)) {
        return NextResponse.json({ success: false, message: "Registration not found." }, { status: 404 })
      }
    }

    // event_id/ticket_type_id were only fetched for the checks above --
    // strip them before this registration goes into any client response,
    // matching the field set the pre-Stage-2 route already returned.
    const { event_id: _regEventId, ticket_type_id: _regTicketTypeId, ...publicRegistration } = registration

    const { warning: timeWindowWarning } = checkTimeWindow(list)

    // The kiosk is unattended -- nobody is standing there to stop a delegate
    // self-serving a second kit/paper/badge. Collection lists (repeat scan
    // means "do not issue again") are staff-scanner-only; the kiosk is
    // entry-only by design, permanently.
    if (list.list_purpose === "collection") {
      return NextResponse.json(
        { success: false, message: "Self check-in isn't available for this list. Please see a staff member." },
        { status: 403 }
      )
    }

    // Already checked in on this list via some other path (e.g. staff
    // scanner, or a race -- see below)? allow_multiple_checkins is
    // intentionally ignored: UNIQUE(checkin_list_id, registration_id) means
    // a second insert always violates the constraint. This row's scan_id is
    // NOT backfilled -- it belongs to whatever originally created it.
    const { data: existing } = await (supabase as any)
      .from("checkin_records")
      .select("id")
      .eq("registration_id", registration.id)
      .eq("checkin_list_id", checkinListId)
      .is("checked_out_at", null)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "You're already checked in!",
        registration: publicRegistration,
        alreadyCheckedIn: true,
      })
    }

    const now = new Date().toISOString()

    const { error: insertError } = await (supabase as any)
      .from("checkin_records")
      .insert({
        registration_id: registration.id,
        checkin_list_id: checkinListId,
        checked_in_at: now,
        checked_in_by: "Self check-in (kiosk)",
        scan_id: scanId,
      })

    if (insertError) {
      // 23505 = unique_violation on (checkin_list_id, registration_id): a
      // concurrent self-checkin from the same kiosk won the race. That's a
      // successful idempotent check-in, not a failure -- same pattern as
      // /api/verify/[token] and /api/checkin. This request's OWN scan_id is
      // never attached to the winning row (a different request's insert
      // created it) -- accepted, rare gap: that scan can never afterwards
      // be distinguished from a genuine cross-station duplicate by scan_id
      // alone. The check-in itself is correct either way.
      if (insertError.code === "23505") {
        return NextResponse.json({
          success: true,
          message: "You're already checked in!",
          registration: publicRegistration,
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
      .eq("id", registration.id)

    return NextResponse.json({
      success: true,
      message: "Check-in successful!",
      registration: publicRegistration,
      alreadyCheckedIn: false,
      ...(timeWindowWarning && { warning: timeWindowWarning }),
    })
  } catch (error: any) {
    console.error("Kiosk check-in error:", error)
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
```

Note: `searchTerm` is read but intentionally unused for matching (kept only so a future error-message/Sentry addition has it available) — if the linter flags it as an unused variable, prefix with `_searchTerm` or add a targeted `// eslint-disable-next-line` on that one line; do not delete the field from the destructured body, since the client still sends it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/kiosk/checkin/route.test.ts`
Expected: PASS (12/12).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/app/api/kiosk/checkin/route.ts`
Expected: no new errors. If `searchTerm` is flagged unused, apply the fix noted in Step 3.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/kiosk/checkin/route.ts src/app/api/kiosk/checkin/route.test.ts
git commit -m "feat(kiosk): trust client-resolved registration_id, make scan_id replays deterministic, add list-eligibility gate"
```

---

### Task 2: Sync worker sends `registration_id`, drops dead `registrationMismatch` detection

**Files:**
- Modify: `src/lib/kiosk-sync-worker.ts`

**Interfaces:**
- Consumes: Task 1's new request contract (`registration_id` now accepted/required by `/api/kiosk/checkin`).
- Produces: no exported signatures change — `drainScanQueue`'s own signature and `computeBackoffMs` are untouched. Existing tests in `kiosk-sync-worker.test.ts` (backoff calculation only) require no changes.

- [ ] **Step 1: Add `registration_id` to the POST body**

In `src/lib/kiosk-sync-worker.ts`, replace the `fetchWithTimeout` call's body (lines 90-99):

```typescript
      const res = await fetchWithTimeout("/api/kiosk/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          checkin_list_id: listId,
          search: entry.delegate_code,
          scan_id: entry.scan_id,
        }),
      })
```

with:

```typescript
      const res = await fetchWithTimeout("/api/kiosk/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          checkin_list_id: listId,
          registration_id: entry.registration_id,
          search: entry.delegate_code,
          scan_id: entry.scan_id,
        }),
      })
```

- [ ] **Step 2: Remove the dead `registrationMismatch` detection**

Replace the response-classification block (lines 107-137):

```typescript
      if (res.ok && data.success) {
        const registrationMismatch = !!data.registration && data.registration.id !== entry.registration_id
        const conflictsWithLocalView = data.alreadyCheckedIn === true || registrationMismatch

        if (registrationMismatch) {
          // The server's .or() match (see kiosk-delegate-match.ts's header
          // comment on its non-deterministic tie-break) resolved this scan
          // to a different registration than the local cache did. Rare,
          // but means the wrong person may have been checked in -- surface
          // it rather than filing it silently alongside routine
          // alreadyCheckedIn conflicts. Full fix (passing registration_id
          // through so the server can't disagree) is Stage 2's job,
          // alongside scan_id enforcement.
          Sentry.captureMessage("kiosk sync: server matched a different registration than the local cache", {
            tags: { module: "kiosk-sync-worker" },
            extra: {
              scanId: entry.scan_id,
              listId,
              localRegistrationId: entry.registration_id,
              serverRegistrationId: data.registration!.id,
            },
          })
        }

        if (conflictsWithLocalView) {
          await markScanConflict(entry.scan_id, data)
          outcome = { kind: "conflict", response: data }
        } else {
          await markScanSynced(entry.scan_id, data)
          outcome = { kind: "synced", response: data }
        }
      } else if (res.status === 429) {
```

with:

```typescript
      if (res.ok && data.success) {
        // The server now trusts the registration_id this worker sends
        // directly (Stage 2) instead of independently re-resolving via
        // fuzzy search -- there's no longer a way for the two to disagree,
        // so the mismatch detection this block used to do is gone.
        if (data.alreadyCheckedIn === true) {
          await markScanConflict(entry.scan_id, data)
          outcome = { kind: "conflict", response: data }
        } else {
          await markScanSynced(entry.scan_id, data)
          outcome = { kind: "synced", response: data }
        }
      } else if (res.status === 429) {
```

- [ ] **Step 3: Update the file header comment**

Replace the header comment block (lines 1-19) — same file, same purpose, just removing the now-stale "not a cross-station race" framing that was written before Stage 2 made mismatches structurally impossible:

```typescript
// Background sync for the self-check-in kiosk's offline scan log (Stage 1,
// docs/superpowers/plans/2026-07-27-kiosk-offline-first-stage1.md). Drains
// src/lib/kiosk-offline-store.ts's scan_log oldest-first, retrying
// indefinitely with exponential backoff -- this never gives up on a queued
// scan the way the old inline-retry-then-enqueue logic in the kiosk page
// used to cap out after 2 attempts.
//
// "Conflict" here means the server's answer disagreed with what the
// attendee already saw on the tablet (alreadyCheckedIn=true when the
// tablet resolved this as a fresh check-in from its cache -- most likely
// this station's own retry of a scan whose first attempt actually
// succeeded server-side before the response was lost). Per the redesign
// brief: never retroactively change what the volunteer/attendee already
// saw -- the badge notification already went out. This just flags it for
// the admin view (a later stage's job to surface); this module only needs
// to *record* the conflict correctly. No check-in is lost either way.
//
// Stage 2 (docs/superpowers/specs/2026-07-27-kiosk-stage2-checkin-authority-design.md)
// made the server trust this worker's own registration_id resolution
// directly instead of independently re-deriving one via fuzzy search --
// there is no longer a registrationMismatch case to detect here.
```

- [ ] **Step 4: Run the existing tests to confirm nothing broke**

Run: `npx vitest run src/lib/kiosk-sync-worker.test.ts`
Expected: PASS (3/3) — this file only covers `computeBackoffMs`, untouched by this task.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/lib/kiosk-sync-worker.ts`
Expected: no new errors. Confirm the `Sentry` import (line 21) is still used elsewhere in the file (the `SyntaxError` and unexpected-exception catch branches both still call `Sentry.captureException`) — it should not become an unused import.

- [ ] **Step 6: Commit**

```bash
git add src/lib/kiosk-sync-worker.ts
git commit -m "feat(kiosk): sync worker sends registration_id, drop dead registrationMismatch detection"
```

---

## Self-Review Notes

- **Spec coverage:** §1 (request/response contract, ordering) → Task 1 Step 3. §2 (authorization/list eligibility) → Task 1 Step 3's `ticket_type_ids`/`addon_ids` block, tested in Task 1 Step 1's eligibility tests. §3 (replay determinism) → Task 1 Step 3's scan_id-first block, tested by the two replay tests. §4 (23505 accepted gap, documented) → Task 1 Step 3's insert-error branch comment, tested by the race test. §5 (registrationMismatch removal) → Task 2 Step 2. §6 (terminal vs. retryable, no client change) → confirmed via Task 2's unchanged classification structure (only the mismatch-detection sub-block is removed; the 429/5xx/else branches are untouched).
- **Out of scope, confirmed not touched:** no admin view added; no changes to `kiosk_stations`/`print_jobs`/station identity (Stage 3); no schema migration.
- **Type consistency check:** `registration_id` is the same field name across Task 1's request body, Task 2's POST body construction, and the pre-existing `ScanLogEntry.registration_id` (`kiosk-offline-store.ts`, Stage 1) it's read from — no renaming across tasks.
