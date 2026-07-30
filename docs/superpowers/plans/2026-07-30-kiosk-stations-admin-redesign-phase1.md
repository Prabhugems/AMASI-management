# Kiosk Stations Admin Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the Kiosk Stations admin list to one compact row per station, give each station its own detail page (with a new recent-activity feed), and auto-name new stations "Tablet N".

**Architecture:** Extract the four presentational components already used by the list/grid views (`StationNameEditor`, `StationListsPicker`, `StationBehaviourControls`, `StationActions`) plus their shared types/helpers out of the 1900-line `page.tsx` into a new shared file, so a new detail-page route can reuse them unchanged. Add three small admin-authenticated GET endpoints (single station, per-station activity feed, event-wide list counts) that follow this codebase's existing `kiosk_stations` auth pattern exactly. Then reshape the list page's row rendering to be compact and link to the new detail page, and default new-station names to `Tablet N`.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (admin client), Vitest, TypeScript, Tailwind, Shadcn UI (already in use throughout this file).

## Global Constraints

- No database schema or migration changes in this phase — every new endpoint reads existing tables/columns (`kiosk_stations`, `kiosk_station_lists`, `checkin_records`, `checkin_audit_log`, `registrations`, `checkin_lists`) exactly as they exist today.
- Every new/modified API route must authenticate the same way `src/app/api/kiosk-stations/[id]/route.ts` already does: look up the station row first (to get its `event_id`), THEN call `requireEventAndPermission(station.event_id, "checkin")` — never authenticate before you know which event the station belongs to.
- Use `createAdminClient()` from `@/lib/supabase/server` for every query (this codebase's established RLS-bypass pattern for admin routes) — never the browser/RLS client.
- Validate every id with `isValidUUID` from `@/lib/validation` before using it in a query.
- Match existing test conventions exactly: `createSupabaseMock` from `@/test/helpers/supabase-mock`, `makeRequest` from `@/test/helpers/request`, and `vi.mock("@/lib/auth/api-auth", () => ({ requireEventAndPermission: vi.fn(async () => ({ user: { id: "admin-1" }, error: null })) }))` for the success path (override per-test for the auth-failure case).
- `npx tsc --noEmit` and `npx vitest run` must both stay clean after every task.
- No "Station" → "Tablet" rename anywhere in code, routes, nav labels, or copy. The sidebar/page title stays "Kiosk Stations". The ONLY new "Tablet" text is the *default value* suggested in the new-station name field (Task 7) — fully user-editable before and after creation.
- Do not touch the kiosk tablet-facing code at all in this phase (`KioskStationShell.tsx`, `KioskCheckinScreen.tsx`, `/api/kiosk/*` routes) — everything here is purely on the admin side.

---

### Task 1: Extract shared station components into their own file

**Files:**
- Create: `src/components/kiosk-admin/station-controls.tsx`
- Modify: `src/app/events/[eventId]/kiosk-stations/page.tsx:1-502` (remove the moved definitions, add one import)

**Interfaces:**
- Produces (all re-exported from the new file, unchanged signatures): `type CheckinList`, `type PrintStation`, `type KioskStation`, `STATUS_MEANINGS`, `attendedHelpText(attended: boolean): string`, `autoPrintHelpText(autoPrint: boolean): string`, `PRINTER_USB_HELP_TEXT: string`, `stationUrl(token: string): string`, `relativeLastSeen(iso: string | null): string`, `STATUS_META`, `STATUS_FILTERS`, `STATUS_RANK`, `GROUP_ORDER`, `GROUP_LABELS`, `CHIP_LIMIT`, `StationListsPicker`, `StationNameEditor`, `StationBehaviourControls`, `StationActions`.
- Consumes: nothing new — this is a pure move of code that already exists verbatim in `page.tsx` today (lines 59–502, as read from the current file).

This is a pure refactor with zero behavior change, so it has no natural "failing test" — the verification is that `tsc`/`vitest`/a manual smoke check all show the page working exactly as before.

- [ ] **Step 1: Create the new shared file**

Create `src/components/kiosk-admin/station-controls.tsx` containing exactly the following, moved verbatim from `src/app/events/[eventId]/kiosk-stations/page.tsx` (currently lines 59 through 502 — re-read the file first to get the exact current text, since other tasks in this plan may have touched nearby lines by the time you run this):

- The imports these components actually need: `useState` from `"react"`, `Button` from `"@/components/ui/button"`, `Input` from `"@/components/ui/input"`, `Checkbox` from `"@/components/ui/checkbox"`, `Switch` from `"@/components/ui/switch"`, `Popover`/`PopoverContent`/`PopoverTrigger` from `"@/components/ui/popover"`, `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`/`DropdownMenuLabel`/`DropdownMenuSeparator` from `"@/components/ui/dropdown-menu"`, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` from `"@/components/ui/select"`, `Pencil`/`RefreshCw`/`MoreVertical` from `"lucide-react"`, `cn` from `"@/lib/utils"`, `toast` from `"sonner"`, and `type KioskStationStatus` from `"@/lib/kiosk-station-status"`.
- `STATUS_MEANINGS`, `attendedHelpText`, `autoPrintHelpText`, `PRINTER_USB_HELP_TEXT`, the `CheckinList`/`PrintStation`/`KioskStation` types, `stationUrl`, `relativeLastSeen`, `STATUS_META`, `STATUS_FILTERS`, `STATUS_RANK`, `GROUP_ORDER`, `GROUP_LABELS`, `CHIP_LIMIT`, `StationListsPicker`, `StationNameEditor`, `StationBehaviourControls`, `StationActions` — every one of these, with `export` added to each (the originals in `page.tsx` are not exported since they're only used within that one file today).

**Step 2: Update `page.tsx` to import instead of define**

- [ ] Delete lines 59–502 of `page.tsx` (everything from `STATUS_MEANINGS` through the closing brace of `StationActions`) — all of it now lives in the new file.
- [ ] Replace the deleted block with a single import:
  ```ts
  import {
    STATUS_MEANINGS,
    attendedHelpText,
    autoPrintHelpText,
    PRINTER_USB_HELP_TEXT,
    stationUrl,
    relativeLastSeen,
    STATUS_META,
    STATUS_FILTERS,
    STATUS_RANK,
    GROUP_ORDER,
    GROUP_LABELS,
    CHIP_LIMIT,
    StationListsPicker,
    StationNameEditor,
    StationBehaviourControls,
    StationActions,
    type CheckinList,
    type PrintStation,
    type KioskStation,
  } from "@/components/kiosk-admin/station-controls"
  ```
- [ ] Remove any of `page.tsx`'s top-level imports (`Checkbox`, `Popover`/`PopoverContent`/`PopoverTrigger`, `DropdownMenu*`, `Select*`, `Pencil`, `RefreshCw`, `MoreVertical`) that are now unused in `page.tsx` itself — check each with a search across the remaining file before removing; several (e.g. `Switch`, `Button`, `Input`) are still used directly by the create-station dialog and must stay.

**Step 3: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect the same pass count as before this task (no existing test references these functions directly, so this only confirms nothing else broke).
- [ ] Start the dev server and open the Kiosk Stations admin page for an event with at least one station in each status (active/quiet/pending/revoked) — confirm the list AND grid views render identically to before (same text, same controls, same behavior on toggling attended/print/renaming).

- [ ] **Step 4: Commit**

```bash
git add src/components/kiosk-admin/station-controls.tsx src/app/events/[eventId]/kiosk-stations/page.tsx
git commit -m "refactor(kiosk): extract shared station components for reuse on the new detail page"
```

---

### Task 2: `GET /api/kiosk-stations/[id]` — single station

**Files:**
- Modify: `src/app/api/kiosk-stations/[id]/route.ts` (add a `GET` export alongside the existing `PATCH`/`DELETE`)
- Modify: `src/app/api/kiosk-stations/[id]/route.test.ts` (add tests)

**Interfaces:**
- Consumes: nothing new.
- Produces: `GET` returns `{ id, event_id, name, mode, print_station_id, auto_print_badge, attended, last_seen_at, revoked_at, created_at, list_ids: string[] }` — the same per-station shape the existing list endpoint (`GET /api/kiosk-stations`) already returns per row, just for one station instead of all of them. Task 5 (the detail page) consumes this exact shape.

- [ ] **Step 1: Write the failing tests**

Add to `src/app/api/kiosk-stations/[id]/route.test.ts` (same file, same `describe` conventions as the existing `PATCH` tests above them):

```ts
describe("GET /api/kiosk-stations/[id]", () => {
  it("400s on an invalid station id", async () => {
    const { GET } = await import("./route")
    const res = await GET(
      makeRequest("http://localhost/api/kiosk-stations/not-a-uuid"),
      { params: Promise.resolve({ id: "not-a-uuid" }) }
    )
    expect(res.status).toBe(400)
  })

  it("404s when the station doesn't exist", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`), params())
    expect(res.status).toBe(404)
  })

  it("500s when the station lookup errors", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`), params())
    expect(res.status).toBe(500)
  })

  it("returns the station with its list_ids merged in", async () => {
    mock.queueResponse("kiosk_stations", {
      data: {
        id: STATION_ID,
        event_id: EVENT_ID,
        name: "Tablet 1",
        mode: "checkin",
        print_station_id: null,
        auto_print_badge: false,
        attended: true,
        last_seen_at: null,
        revoked_at: null,
        created_at: "2026-07-30T00:00:00Z",
      },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: [{ checkin_list_id: LIST_ID }], error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`), params())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.id).toBe(STATION_ID)
    expect(body.list_ids).toEqual([LIST_ID])
  })

  it("500s when the list-membership lookup errors", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: STATION_ID, event_id: EVENT_ID, name: "Tablet 1" },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`), params())
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/kiosk-stations/[id]/route.test.ts`
Expected: the 5 new tests FAIL (no `GET` export exists yet — import error or undefined-is-not-a-function).

- [ ] **Step 3: Implement the `GET` handler**

Add to `src/app/api/kiosk-stations/[id]/route.ts`, above the existing `export async function PATCH(...)`:

```ts
// GET /api/kiosk-stations/[id] -- single station, including its assigned
// list_ids, for the per-station detail page. Same per-station shape the
// list endpoint (GET /api/kiosk-stations) already returns per row.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid station id." }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error: findErr } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id, name, mode, print_station_id, auto_print_badge, attended, last_seen_at, revoked_at, created_at")
    .eq("id", id)
    .maybeSingle()

  if (findErr) {
    return NextResponse.json({ error: "Failed to load station." }, { status: 500 })
  }
  if (!station) {
    return NextResponse.json({ error: "Kiosk station not found." }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(station.event_id, "checkin")
  if (authError) return authError

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: listRows, error: listErr } = await (supabase as any)
    .from("kiosk_station_lists")
    .select("checkin_list_id")
    .eq("station_id", id)

  if (listErr) {
    return NextResponse.json({ error: "Failed to load station's lists." }, { status: 500 })
  }

  return NextResponse.json({
    ...station,
    list_ids: (listRows || []).map((r: { checkin_list_id: string }) => r.checkin_list_id),
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/kiosk-stations/[id]/route.test.ts`
Expected: all tests PASS, including the pre-existing `PATCH`/`DELETE` tests (unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/kiosk-stations/[id]/route.ts src/app/api/kiosk-stations/[id]/route.test.ts
git commit -m "feat(kiosk): add GET /api/kiosk-stations/[id] for the per-station detail page"
```

---

### Task 3: `GET /api/kiosk-stations/[id]/activity` — recent activity feed

**Files:**
- Create: `src/app/api/kiosk-stations/[id]/activity/route.ts`
- Create: `src/app/api/kiosk-stations/[id]/activity/route.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `GET` returns `{ activity: ActivityItem[] }` where
  ```ts
  interface ActivityItem {
    type: "check_in" | "duplicate"
    registration_name: string | null
    registration_number: string | null
    list_name: string | null
    at: string
  }
  ```
  sorted `at` descending, at most 20 items. Task 5 (detail page) renders this list directly.

Data comes from two existing tables, merged (there is no single table with everything — see the spec's "Current State" section): `checkin_records` (real, first-time check-ins, has a real `station_id` column) for `type: "check_in"`, and `checkin_audit_log` (only written for kiosk repeat-scan attempts, no real `station_id` column — the id lives inside the `device_info` JSON blob) for `type: "duplicate"`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/kiosk-stations/[id]/activity/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const STATION_ID = "33333333-3333-3333-3333-333333333333"
const EVENT_ID = "11111111-1111-1111-1111-111111111111"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

vi.mock("@/lib/auth/api-auth", () => ({
  requireEventAndPermission: vi.fn(async () => ({ user: { id: "admin-1" }, error: null })),
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

function params() {
  return { params: Promise.resolve({ id: STATION_ID }) }
}

describe("GET /api/kiosk-stations/[id]/activity", () => {
  it("400s on an invalid station id", async () => {
    const { GET } = await import("./route")
    const res = await GET(
      makeRequest("http://localhost/api/kiosk-stations/not-a-uuid/activity"),
      { params: Promise.resolve({ id: "not-a-uuid" }) }
    )
    expect(res.status).toBe(400)
  })

  it("404s when the station doesn't exist", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/activity`), params())
    expect(res.status).toBe(404)
  })

  it("returns check-ins and duplicate attempts merged and sorted, most recent first", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("checkin_records", {
      data: [
        {
          checked_in_at: "2026-07-30T12:00:00Z",
          registrations: { attendee_name: "Dr K. Thomas", registration_number: "R-001" },
          checkin_lists: { name: "Lunch" },
        },
      ],
      error: null,
    })
    mock.queueResponse("checkin_audit_log", {
      data: [
        {
          created_at: "2026-07-30T12:05:00Z",
          device_info: { station_id: STATION_ID, duplicate: true },
          registrations: { attendee_name: "Dr P. Iyer", registration_number: "R-002" },
          checkin_lists: { name: "Lunch" },
        },
        {
          created_at: "2026-07-30T11:00:00Z",
          device_info: { station_id: "some-other-station", duplicate: true },
          registrations: { attendee_name: "Someone Else", registration_number: "R-003" },
          checkin_lists: { name: "Lunch" },
        },
      ],
      error: null,
    })

    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/activity`), params())
    const body = await res.json()

    expect(res.status).toBe(200)
    // The other station's duplicate row must be filtered out.
    expect(body.activity).toHaveLength(2)
    // Most recent first.
    expect(body.activity[0]).toMatchObject({ type: "duplicate", registration_name: "Dr P. Iyer" })
    expect(body.activity[1]).toMatchObject({ type: "check_in", registration_name: "Dr K. Thomas" })
  })

  it("500s when the checkin_records query errors", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("checkin_records", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/activity`), params())
    expect(res.status).toBe(500)
  })

  it("500s when the checkin_audit_log query errors", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("checkin_records", { data: [], error: null })
    mock.queueResponse("checkin_audit_log", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/activity`), params())
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/kiosk-stations/[id]/activity/route.test.ts`
Expected: FAIL (`route.ts` doesn't exist yet — module not found).

- [ ] **Step 3: Implement**

Create `src/app/api/kiosk-stations/[id]/activity/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"

const ACTIVITY_LIMIT = 20

interface ActivityItem {
  type: "check_in" | "duplicate"
  registration_name: string | null
  registration_number: string | null
  list_name: string | null
  at: string
}

// GET /api/kiosk-stations/[id]/activity -- the "recent activity" feed on the
// per-station detail page. There is no single table with "everything this
// station has done": checkin_records (has a real station_id column) covers
// first-time, successful check-ins; checkin_audit_log covers kiosk repeat-
// scan attempts, but only ever tags a station via device_info.station_id --
// see src/app/api/kiosk/checkin/route.ts's duplicate-audit insert -- because
// a repeat scan never creates a new checkin_records row at all (the
// UNIQUE(checkin_list_id, registration_id) constraint means there's nothing
// new to attribute). Both queries fetch a bounded page and filter/merge in
// JS rather than filtering the JSONB device_info column at the DB layer,
// matching this codebase's existing pattern for checkin_audit_log reads
// (see /api/registrations/[id]/checkin-history).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid station id." }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error: findErr } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id")
    .eq("id", id)
    .maybeSingle()

  if (findErr) {
    return NextResponse.json({ error: "Failed to load station." }, { status: 500 })
  }
  if (!station) {
    return NextResponse.json({ error: "Kiosk station not found." }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(station.event_id, "checkin")
  if (authError) return authError

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: checkins, error: checkinsErr } = await (supabase as any)
    .from("checkin_records")
    .select("checked_in_at, registrations (attendee_name, registration_number), checkin_lists (name)")
    .eq("station_id", id)
    .order("checked_in_at", { ascending: false })
    .limit(ACTIVITY_LIMIT)

  if (checkinsErr) {
    return NextResponse.json({ error: "Failed to load check-ins." }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: auditRows, error: auditErr } = await (supabase as any)
    .from("checkin_audit_log")
    .select("created_at, device_info, registrations (attendee_name, registration_number), checkin_lists (name)")
    .eq("event_id", station.event_id)
    .eq("action", "check_in")
    .eq("success", true)
    .order("created_at", { ascending: false })
    .limit(200)

  if (auditErr) {
    return NextResponse.json({ error: "Failed to load activity log." }, { status: 500 })
  }

  const checkinItems: ActivityItem[] = (checkins || []).map((row: any) => ({
    type: "check_in",
    registration_name: row.registrations?.attendee_name ?? null,
    registration_number: row.registrations?.registration_number ?? null,
    list_name: row.checkin_lists?.name ?? null,
    at: row.checked_in_at,
  }))

  const duplicateItems: ActivityItem[] = (auditRows || [])
    .filter((row: any) => row.device_info?.duplicate === true && row.device_info?.station_id === id)
    .map((row: any) => ({
      type: "duplicate",
      registration_name: row.registrations?.attendee_name ?? null,
      registration_number: row.registrations?.registration_number ?? null,
      list_name: row.checkin_lists?.name ?? null,
      at: row.created_at,
    }))

  const activity = [...checkinItems, ...duplicateItems]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, ACTIVITY_LIMIT)

  return NextResponse.json({ activity })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/kiosk-stations/[id]/activity/route.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/kiosk-stations/[id]/activity/route.ts src/app/api/kiosk-stations/[id]/activity/route.test.ts
git commit -m "feat(kiosk): add per-station recent activity feed endpoint"
```

---

### Task 4: `GET /api/kiosk-stations/list-counts` — event-wide check-in counts for the admin list view

**Files:**
- Create: `src/app/api/kiosk-stations/list-counts/route.ts`
- Create: `src/app/api/kiosk-stations/list-counts/route.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `GET ?event_id=` returns `{ counts: Record<string, number> }`, one entry per `checkin_lists.id` in the event. Task 6 (compact list view) consumes this to show a count next to each list chip.

This is deliberately a SEPARATE, simpler endpoint from the kiosk-tablet-facing `/api/kiosk/list-counts` (which authenticates via a station token and only returns counts for lists a specific station serves) — an admin viewing the whole event's station list needs every list's count in one call, admin-authenticated, with no station-membership filtering at all.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/kiosk-stations/list-counts/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"
const LIST_A = "22222222-2222-2222-2222-222222222222"
const LIST_B = "33333333-3333-3333-3333-333333333333"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

vi.mock("@/lib/auth/api-auth", () => ({
  requireEventAndPermission: vi.fn(async () => ({ user: { id: "admin-1" }, error: null })),
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

function url(params: Record<string, string>) {
  return `http://localhost/api/kiosk-stations/list-counts?${new URLSearchParams(params).toString()}`
}

describe("GET /api/kiosk-stations/list-counts", () => {
  it("400s on a missing or invalid event_id", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: "not-a-uuid" })))
    expect(res.status).toBe(400)
  })

  it("returns a count per list in the event", async () => {
    mock.queueResponse("checkin_lists", { data: [{ id: LIST_A }, { id: LIST_B }], error: null })
    mock.queueResponse("checkin_records", { data: null, error: null, count: 142 })
    mock.queueResponse("checkin_records", { data: null, error: null, count: 0 })

    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Object.values(body.counts).sort()).toEqual([0, 142])
  })

  it("500s when the event's list of check-in lists fails to load", async () => {
    mock.queueResponse("checkin_lists", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID })))
    expect(res.status).toBe(500)
  })

  it("omits a list's count (rather than erroring the whole request) if its count query fails", async () => {
    mock.queueResponse("checkin_lists", { data: [{ id: LIST_A }, { id: LIST_B }], error: null })
    mock.queueResponse("checkin_records", { data: null, error: { message: "boom" } })
    mock.queueResponse("checkin_records", { data: null, error: null, count: 7 })

    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Object.keys(body.counts)).toHaveLength(1)
    expect(Object.values(body.counts)).toEqual([7])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/kiosk-stations/list-counts/route.test.ts`
Expected: FAIL (module doesn't exist).

- [ ] **Step 3: Implement**

Create `src/app/api/kiosk-stations/list-counts/route.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/kiosk-stations/list-counts/route.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/kiosk-stations/list-counts/route.ts src/app/api/kiosk-stations/list-counts/route.test.ts
git commit -m "feat(kiosk): add event-wide list-counts endpoint for the admin station list"
```

---

### Task 5: New detail page `/events/[eventId]/kiosk-stations/[stationId]`

**Files:**
- Create: `src/app/events/[eventId]/kiosk-stations/[stationId]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/kiosk-stations/[id]` (Task 2), `GET /api/kiosk-stations/[id]/activity` (Task 3), and the existing `PATCH`/`DELETE /api/kiosk-stations/[id]`, `POST/DELETE /api/kiosk-stations/[id]/access-token` (all pre-existing, unchanged), plus `StationNameEditor`, `StationListsPicker`, `StationBehaviourControls`, `StationActions` from `@/components/kiosk-admin/station-controls` (Task 1). Also fetches the event's `checkin_lists` and `print_stations` the same way `page.tsx` already does (same two existing endpoints), since `StationListsPicker`/`StationBehaviourControls` both need those as props.
- Produces: nothing new — this is a leaf page.

- [ ] **Step 1: Build the page**

Create `src/app/events/[eventId]/kiosk-stations/[stationId]/page.tsx`:

```tsx
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Clock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { computeStationStatus, STATION_STATUS_LABELS } from "@/lib/kiosk-station-status"
import {
  STATUS_META,
  relativeLastSeen,
  StationNameEditor,
  StationListsPicker,
  StationBehaviourControls,
  StationActions,
  type CheckinList,
  type PrintStation,
  type KioskStation,
} from "@/components/kiosk-admin/station-controls"

interface ActivityItem {
  type: "check_in" | "duplicate"
  registration_name: string | null
  registration_number: string | null
  list_name: string | null
  at: string
}

export default function KioskStationDetailPage() {
  const { eventId, stationId } = useParams<{ eventId: string; stationId: string }>()

  const [station, setStation] = useState<KioskStation | null>(null)
  const [lists, setLists] = useState<CheckinList[]>([])
  const [printStations, setPrintStations] = useState<PrintStation[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadStation = async () => {
    const res = await fetch(`/api/kiosk-stations/${stationId}`)
    if (!res.ok) return
    setStation(await res.json())
  }

  const loadActivity = async () => {
    const res = await fetch(`/api/kiosk-stations/${stationId}/activity`)
    if (!res.ok) return
    const data = await res.json()
    setActivity(data.activity || [])
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      await Promise.all([
        loadStation(),
        fetch(`/api/checkin-lists?event_id=${eventId}`)
          .then((r) => r.json())
          .then((d) => setLists(d.lists || d || [])),
        fetch(`/api/print-stations?event_id=${eventId}`)
          .then((r) => r.json())
          .then((d) => setPrintStations(Array.isArray(d) ? d : [])),
        loadActivity(),
      ])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, stationId])

  function assignableLists(attended: boolean) {
    return lists.filter((l) => l.is_active === true && (attended || l.list_purpose !== "collection"))
  }
  const usbPrintStations = printStations.filter((p) => p?.print_settings?.printer_type === "usb")

  // Rename
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState("")
  const [renaming, setRenaming] = useState(false)
  const startRename = () => {
    if (!station) return
    setIsRenaming(true)
    setRenameDraft(station.name)
  }
  const cancelRename = () => setIsRenaming(false)
  const saveRename = async () => {
    if (!station) return
    const trimmed = renameDraft.trim()
    if (!trimmed || trimmed === station.name) {
      setIsRenaming(false)
      return
    }
    setRenaming(true)
    try {
      const res = await fetch(`/api/kiosk-stations/${station.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to rename station")
        return
      }
      toast.success("Station renamed")
      setIsRenaming(false)
      await loadStation()
    } finally {
      setRenaming(false)
    }
  }

  // Lists / attended / printer / auto-print
  const [reassigning, setReassigning] = useState(false)
  const handleReassignLists = async (listIds: string[]) => {
    if (!station) return
    setReassigning(true)
    try {
      const res = await fetch(`/api/kiosk-stations/${station.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list_ids: listIds }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to change lists")
        return
      }
      toast.success(`${station.name} reassigned`)
      await loadStation()
    } finally {
      setReassigning(false)
    }
  }

  const performToggleAttended = async (next: boolean) => {
    if (!station) return
    const res = await fetch(`/api/kiosk-stations/${station.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: next }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to change attended")
      return
    }
    toast.success(`${station.name}: attended ${next ? "on" : "off"}`)
    await loadStation()
  }
  const [attendedConfirmOpen, setAttendedConfirmOpen] = useState(false)
  const [attendedConfirmBusy, setAttendedConfirmBusy] = useState(false)
  const handleAttendedSwitch = () => {
    if (!station) return
    if (station.attended) {
      performToggleAttended(false)
    } else {
      setAttendedConfirmOpen(true)
    }
  }
  const confirmAttendedOn = async () => {
    setAttendedConfirmBusy(true)
    try {
      await performToggleAttended(true)
    } finally {
      setAttendedConfirmBusy(false)
      setAttendedConfirmOpen(false)
    }
  }

  const handleReassignPrintStation = async (printStationId: string) => {
    if (!station) return
    const res = await fetch(`/api/kiosk-stations/${station.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ print_station_id: printStationId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to change print station")
      return
    }
    toast.success(`${station.name} reassigned to ${printStations.find((p) => p.id === printStationId)?.name || "the new print station"}`)
    await loadStation()
  }

  const handleToggleAutoPrint = async () => {
    if (!station) return
    const next = !station.auto_print_badge
    const res = await fetch(`/api/kiosk-stations/${station.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_print_badge: next }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to change auto-print")
      return
    }
    toast.success(`${station.name}: auto-print ${next ? "on" : "off"}`)
    await loadStation()
  }

  // New link / Revoke / Delete
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false)
  const [regenerateBusy, setRegenerateBusy] = useState(false)
  const performRegenerate = async () => {
    if (!station) return
    setRegenerateBusy(true)
    try {
      const res = await fetch(`/api/kiosk-stations/${station.id}/access-token`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to issue a new link")
        return
      }
      setRegenerateConfirmOpen(false)
      toast.success("New link issued")
      await loadStation()
    } finally {
      setRegenerateBusy(false)
    }
  }

  const [dangerAction, setDangerAction] = useState<"revoke" | "delete" | null>(null)
  const [dangerBusy, setDangerBusy] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const deleteConfirmSatisfied = dangerAction !== "delete" || deleteConfirmText.trim() === (station?.name ?? "").trim()

  const runDangerAction = async () => {
    if (!station || !dangerAction) return
    if (dangerAction === "delete" && !deleteConfirmSatisfied) return
    setDangerBusy(true)
    try {
      const res =
        dangerAction === "revoke"
          ? await fetch(`/api/kiosk-stations/${station.id}/access-token`, { method: "DELETE" })
          : await fetch(`/api/kiosk-stations/${station.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        toast.error(data.error || `Failed to ${dangerAction} station`)
        return
      }
      toast.success(`${station.name} ${dangerAction === "revoke" ? "revoked" : "deleted"}`)
      setDangerAction(null)
      setDeleteConfirmText("")
      if (dangerAction === "delete") {
        window.location.href = `/events/${eventId}/kiosk-stations`
      } else {
        await loadStation()
      }
    } finally {
      setDangerBusy(false)
    }
  }

  if (loading || !station) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>
  }

  const revoked = !!station.revoked_at
  const status = computeStationStatus(station)

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8 space-y-8">
      <Link
        href={`/events/${eventId}/kiosk-stations`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kiosk Stations
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <StationNameEditor
            station={station}
            isRenaming={isRenaming}
            renameDraft={renameDraft}
            onDraftChange={setRenameDraft}
            renaming={renaming}
            onStart={startRename}
            onCancel={cancelRename}
            onSave={saveRename}
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", STATUS_META[status].dot)} />
            {STATION_STATUS_LABELS[status]}
            <Clock className="h-3 w-3" />
            {revoked ? "Revoked" : relativeLastSeen(station.last_seen_at)}
          </div>
        </div>
        <StationActions
          revoked={revoked}
          onRegenerate={() => setRegenerateConfirmOpen(true)}
          onRename={startRename}
          onRevoke={() => setDangerAction("revoke")}
          onDelete={() => {
            setDeleteConfirmText("")
            setDangerAction("delete")
          }}
        />
      </div>

      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Check-in lists</h2>
        <StationListsPicker
          station={station}
          lists={lists}
          options={assignableLists(station.attended)}
          busy={reassigning}
          onChange={handleReassignLists}
          onFocusAttended={() => {}}
        />
      </section>

      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Behaviour</h2>
        <StationBehaviourControls
          station={station}
          revoked={revoked}
          usbPrintStations={usbPrintStations}
          onToggleAttended={handleAttendedSwitch}
          onTogglePrint={handleToggleAutoPrint}
          onReassignPrintStation={handleReassignPrintStation}
        />
      </section>

      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {activity.map((item, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span>
                  {item.registration_name || "Unknown"} — {item.list_name || "Unknown list"}
                  {item.type === "duplicate" && (
                    <span className="ml-2 text-xs text-amber-600">already collected, turned away</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* New link confirm -- same copy as page.tsx's regenerateConfirmStation dialog */}
      <AlertDialog open={regenerateConfirmOpen} onOpenChange={setRegenerateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue a new link?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                The current link stops working immediately. Any tablet using it will need the new link.
              </span>
              <span className="mt-2 block">The station keeps its name, lists, and printer.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button disabled={regenerateBusy} onClick={performRegenerate}>
              {regenerateBusy ? "Issuing…" : "Issue new link"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attended-ON confirm -- same copy as page.tsx's attendedConfirmTarget dialog */}
      <AlertDialog open={attendedConfirmOpen} onOpenChange={setAttendedConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn on attended mode?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                This lets the tablet serve collection lists — meals, kits, anything a delegate physically picks up.
              </span>
              <span className="mt-2 block">
                Only turn this on if a volunteer is holding the tablet at all times. On an unattended tablet, a
                delegate could scan twice and take two.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button disabled={attendedConfirmBusy} onClick={confirmAttendedOn}>
              {attendedConfirmBusy ? "Turning on…" : "Turn on"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke / Delete confirm -- same copy as page.tsx's confirmState dialog,
          simplified to the always-single-station case (no bulk here). */}
      <AlertDialog
        open={!!dangerAction}
        onOpenChange={(open) => {
          if (!open) {
            setDangerAction(null)
            setDeleteConfirmText("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dangerAction === "revoke" ? "Revoke this station?" : "Delete this station?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dangerAction === "revoke" ? (
                <>
                  <span className="block">
                    The tablet stops working right away. Use this if a tablet is lost or stolen. Any scans already
                    saved on it will be lost if it cannot get online again.
                  </span>
                  <span className="mt-2 block">The station keeps its settings — you can issue a new link later.</span>
                </>
              ) : (
                `${station.name} and its list assignments, printer link and sign-in link will be removed. Check-ins already recorded are kept.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dangerAction === "delete" && (
            <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <label className="text-sm font-medium">
                Type <strong>&quot;{station.name}&quot;</strong> to confirm:
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={station.name}
                className="border-destructive/50"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={dangerBusy || (dangerAction === "delete" && !deleteConfirmSatisfied)}
              onClick={runDangerAction}
            >
              {dangerAction === "revoke" ? "Revoke" : "Delete station"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

Note: `StationBehaviourControls` is called here without `attendedSwitchRef` — that prop is optional (used only by the list page's "jump to this switch from the hidden-lists note" affordance, which doesn't apply on a page that already shows both sections together), and `StationListsPicker`'s `onFocusAttended` is a no-op here for the same reason (the Behaviour section is already visible on this page, not tucked in a popover).

- [ ] **Step 2: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions (this task adds no new route, so no new automated tests are expected; verification is manual).
- [ ] Start the dev server, open a station's new detail page, and confirm: rename works and persists on reload; toggling attended flips the lists picker's available options exactly like it does on the list page; reassigning the printer and toggling auto-print work; New link/Revoke/Delete all show the same confirm dialogs as today and take effect; the activity feed shows real recent scans for a station that has some, and "No activity yet" for one that doesn't.

- [ ] **Step 3: Commit**

```bash
git add src/app/events/[eventId]/kiosk-stations/[stationId]/page.tsx
git commit -m "feat(kiosk): add per-station detail page with recent activity feed"
```

---

### Task 6: Compact list-view rows + link to the detail page

**Files:**
- Modify: `src/app/events/[eventId]/kiosk-stations/page.tsx` (the list-view row rendering only — grid/card view is untouched in this phase)
- Modify: `src/components/kiosk-admin/station-controls.tsx` (add one new small component)

**Interfaces:**
- Consumes: `GET /api/kiosk-stations/list-counts` (Task 4).
- Produces: `StationBehaviourSummary({ station, printStationName }: { station: KioskStation; printStationName: string | null }): JSX.Element` — a new one-line, read-only summary added to `station-controls.tsx`, used only by the list-view row (the grid/card view and the new detail page keep using the full, editable `StationBehaviourControls`).

- [ ] **Step 1: Add the compact summary component**

In `src/components/kiosk-admin/station-controls.tsx`, add:

```tsx
// One-line, read-only summary for the compact list-view row -- editing
// happens on the station's own detail page now, not inline in the list.
export function StationBehaviourSummary({
  station,
  printStationName,
}: {
  station: KioskStation
  printStationName: string | null
}) {
  const parts = [station.attended ? "Attended" : "Unattended"]
  if (station.mode === "checkin_and_print") {
    parts.push(station.auto_print_badge ? "Auto-print" : "Manual print")
    if (printStationName) parts.push(printStationName)
  }
  return <span className="truncate text-xs text-muted-foreground">{parts.join(" · ")}</span>
}
```

- [ ] **Step 2: Thread an optional `counts` prop through `StationListsPicker`**

In `src/components/kiosk-admin/station-controls.tsx`, add `counts?: Record<string, number>` to `StationListsPicker`'s props, and use it when building `listNames`/`visibleChips` labels — change:

```ts
const listNames = station.list_ids.map((id) => lists.find((l) => l.id === id)?.name).filter(Boolean) as string[]
```

to:

```ts
const listNames = station.list_ids
  .map((id) => {
    const list = lists.find((l) => l.id === id)
    if (!list) return null
    return counts?.[id] !== undefined ? `${list.name} · ${counts[id]}` : list.name
  })
  .filter(Boolean) as string[]
```

and add `counts` to the destructured props (default `undefined`, so the grid/card view's existing call sites — which don't pass it — are unaffected).

- [ ] **Step 3: Fetch list counts in `page.tsx`**

Add `const [listCounts, setListCounts] = useState<Record<string, number>>({})` alongside the page's other state, and fetch it in the same `useEffect`/`loadStations` that already fetches `stations`/`lists`/`printStations`:

```ts
fetch(`/api/kiosk-stations/list-counts?event_id=${eventId}`)
  .then((r) => r.json())
  .then((d) => setListCounts(d.counts || {})),
```

added as one more entry in the existing `Promise.all([...])` array in the page's load effect.

- [ ] **Step 4: Reshape the list-view row**

Replace the list-view row's current per-station block (the `StationNameEditor` / `StationListsPicker` / `StationBehaviourControls` / `StationActions` sequence at the call site shown below, matching what's at roughly line 1380–1446 as of Task 1) with:

```tsx
{/* Station name + printer */}
<div className="min-w-0 flex flex-col gap-1">
  <div className="flex items-center gap-2">
    <StationNameEditor
      station={station}
      isRenaming={isRenaming}
      renameDraft={renameDraft}
      onDraftChange={setRenameDraft}
      renaming={renaming}
      onStart={() => startRename(station)}
      onCancel={cancelRename}
      onSave={() => saveRename(station)}
    />
    <Link
      href={`/events/${eventId}/kiosk-stations/${station.id}`}
      className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
    >
      Manage
    </Link>
  </div>
  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
    <span
      className="rounded-full border px-1.5 py-0.5 text-[10px] font-normal"
      title={
        station.mode === "checkin_and_print"
          ? "Scans delegates in and prints their badge."
          : "Scans delegates in. No badge printing."
      }
    >
      {station.mode === "checkin_and_print" ? "Check-in + Print" : "Check-in"}
    </span>
    {station.attended && (
      <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-normal">Attended</span>
    )}
  </div>
</div>

{/* Check-in lists, with live counts */}
<div className="min-w-0">
  <StationListsPicker
    station={station}
    lists={lists}
    options={assignableLists(station.attended)}
    counts={listCounts}
    busy={reassigningStationId === station.id}
    onChange={(ids) => handleReassignLists(station, ids)}
    onFocusAttended={() => focusAttendedSwitch(station.id)}
  />
</div>

{/* Behaviour: one-line summary -- editing moved to the station's detail page */}
<StationBehaviourSummary
  station={station}
  printStationName={printStations.find((p) => p.id === station.print_station_id)?.name ?? null}
/>

{/* Actions */}
<div className="flex items-center justify-end gap-1.5">
  <StationActions
    revoked={revoked}
    onRegenerate={() => handleRegenerate(station)}
    onRename={() => startRename(station)}
    onRevoke={() => handleRevoke([station])}
    onDelete={() => handleDelete([station])}
  />
</div>
```

Add `import Link from "next/link"` to `page.tsx` if it isn't already imported, and add `StationBehaviourSummary` to the existing import from `@/components/kiosk-admin/station-controls`. This ONLY changes the list-view row (the block(s) at the first of the two call sites Task 1 identified) — leave the grid/card view's call sites (the second set) untouched in this task; they keep using the full `StationBehaviourControls` and no `counts` prop, matching today's behavior exactly.

- [ ] **Step 5: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Start the dev server: confirm the list view now shows one compact line per station with a working link to its detail page, counts appear next to list chips, and the grid/card view (untouched) still looks exactly as it did before this task.

- [ ] **Step 6: Commit**

```bash
git add src/app/events/[eventId]/kiosk-stations/page.tsx src/components/kiosk-admin/station-controls.tsx
git commit -m "feat(kiosk): compact list-view rows with check-in counts and a link to the detail page"
```

---

### Task 7: Auto-name new stations "Tablet N"

**Files:**
- Modify: `src/app/events/[eventId]/kiosk-stations/page.tsx` (only the create-dialog open handlers, ~lines 1100/1115 and the `newName` state)

**Interfaces:**
- Consumes: the existing `stations` array already held in this page's state.
- Produces: nothing new.

- [ ] **Step 1: Compute the next default name**

Add a small helper near the top of `page.tsx` (or in `station-controls.tsx` if you prefer, since it's a pure function of `KioskStation[]`):

```ts
function nextDefaultStationName(stations: KioskStation[]): string {
  let highest = 0
  for (const s of stations) {
    const match = /^Tablet (\d+)$/.exec(s.name.trim())
    if (match) highest = Math.max(highest, parseInt(match[1], 10))
  }
  return `Tablet ${highest + 1}`
}
```

- [ ] **Step 2: Use it when opening the create dialog**

At both call sites that currently do `setShowCreate(true)` (lines ~1100 and ~1115), change them to also set the default name, e.g.:
```ts
onClick={() => {
  setNewName(nextDefaultStationName(stations))
  setShowCreate(true)
}}
```
Leave the `Input` at line 1610 exactly as it is (`value={newName} onChange={(e) => setNewName(e.target.value)}`) — the admin can still clear/retype it before submitting, this only changes the starting value.

- [ ] **Step 3: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Start the dev server: open "Add Station" on an event with no stations yet — confirm the name field starts pre-filled with "Tablet 1". Create it, open "Add Station" again — confirm it now starts pre-filled with "Tablet 2". Rename a station to something unrelated (e.g. "Front Desk") and confirm the next new station still correctly continues the "Tablet N" sequence based on the highest existing `Tablet <n>` name, ignoring non-matching names.

- [ ] **Step 4: Commit**

```bash
git add src/app/events/[eventId]/kiosk-stations/page.tsx
git commit -m "feat(kiosk): auto-name new stations Tablet 1, Tablet 2, ... by default"
```
