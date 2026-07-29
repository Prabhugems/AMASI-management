# Kiosk stations — shared tablets, multi-list menu, scheduled windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one physical kiosk tablet serve every check-in list it's assigned (not just one), with an on-device menu and scheduled open/close windows so a shared tablet can never accept a scan against the wrong list.

**Architecture:** A new `kiosk_station_lists` join table replaces `kiosk_stations.list_id` as the source of truth for what a station serves (the column itself is kept, deprecated, dropped later). A new `KioskStationShell` client component owns the set of assigned lists and which one is active, rendering the unchanged `KioskCheckinScreen` keyed per list when one is picked, or a menu when none is. New `kiosk_opens_at`/`kiosk_closes_at`/`kiosk_force_state` columns on `checkin_lists` drive on-device open/closed computation, kept deliberately separate from the existing `starts_at`/`ends_at` (which already drive a different, soft-warning-only behavior live today).

**Tech Stack:** Next.js 16 App Router, Supabase (admin client), IndexedDB via `idb`, Vitest.

## Global Constraints

- Migration is additive only. Commit the migration file in Task 1 but **do not apply it** until the user explicitly says to. Do not run `supabase db push` or any MCP `apply_migration` call without that explicit go-ahead — this repo's automated migration pipeline is documented-broken (see `CLAUDE.md`'s Migration Pipeline section), so nothing applies this automatically.
- Do not merge this branch until the migration is confirmed applied (Task 13) — every other task's code must be safe to sit unmerged on a branch in the meantime; none of it needs a "migration not applied yet" runtime fallback, because it will never run in production before the migration lands.
- `kiosk_opens_at`/`kiosk_closes_at`/`kiosk_force_state` are a completely separate system from `checkin_lists.starts_at`/`ends_at` (soft-warning-only, live today via `src/lib/checkin-time-window.ts`). Never read, write, or share code between the two.
- No cross-station printing, ever. No separate "print" menu tile, ever — picking a list always enters its check-in screen.
- Only show print UI when a printer is actually detected connected (existing `isWebUSBSupported()`/`isUsbPrinterConnected()`/`reconnectUsbPrinter()` from `src/lib/usb-printer.ts` — no new WebUSB code).
- Fix the pre-existing mode-check bug while touching these exact lines: `/api/kiosk/delegates` and `/api/kiosk/checkin` currently gate their `station_token` path on `station.mode !== "checkin"` exactly, which incorrectly 401s (delegates) / silently drops attribution (checkin) for `checkin_and_print` stations. Both must accept `"checkin"` and `"checkin_and_print"`.
- Run `npx tsc --noEmit`, `npx vitest run`, and `npm run lint` after every task.
- Match this project's existing code style: `// eslint-disable-next-line @typescript-eslint/no-explicit-any` above every `(supabase as any)` cast (this repo has zero generated types for `kiosk_stations`/`kiosk_station_lists`/the new `checkin_lists` columns), and comments that explain *why*, not *what*.

---

### Task 1: Migration — `kiosk_station_lists` join table + `checkin_lists` schedule columns

**Files:**
- Create: `supabase/migrations/20260729_kiosk_shared_stations_scheduled_lists.sql`

**Interfaces:**
- Produces: `kiosk_station_lists(station_id uuid, checkin_list_id uuid, created_at timestamptz)`, primary key `(station_id, checkin_list_id)`, index `kiosk_station_lists_by_list` on `checkin_list_id`.
- Produces: `checkin_lists.kiosk_opens_at timestamptz null`, `checkin_lists.kiosk_closes_at timestamptz null`, `checkin_lists.kiosk_force_state text null` (check constraint: null, `'open'`, or `'closed'`).

- [ ] **Step 1: Write the migration file**

```sql
-- Kiosk stations: shared tablets, multi-list menu, scheduled windows.
-- See docs/superpowers/specs/2026-07-29-kiosk-shared-stations-scheduled-lists-design.md
-- Additive only. Commit only -- do NOT apply until explicit user go-ahead
-- (see CLAUDE.md's migration pipeline section). kiosk_stations.list_id is
-- deprecated by this migration, not dropped -- every existing code path
-- keeps working off it until a later, separate migration removes it.

alter table checkin_lists
  add column if not exists kiosk_opens_at timestamptz null,
  add column if not exists kiosk_closes_at timestamptz null,
  add column if not exists kiosk_force_state text null
    check (kiosk_force_state is null or kiosk_force_state in ('open', 'closed'));
-- All three columns are inert until an admin explicitly sets them: null on
-- all three resolves to "open" under src/lib/kiosk-list-schedule.ts's
-- computeListState, so every existing list keeps behaving exactly as
-- today -- zero behavior change on migration apply.

create table if not exists kiosk_station_lists (
  station_id uuid not null references kiosk_stations(id) on delete cascade,
  checkin_list_id uuid not null references checkin_lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (station_id, checkin_list_id)
);
create index if not exists kiosk_station_lists_by_list on kiosk_station_lists (checkin_list_id);
alter table kiosk_station_lists enable row level security;
-- No policies -- default-deny, same posture as kiosk_stations itself. Only
-- ever read/written via the admin (service-role) Supabase client.

-- Backfill: one join row per existing station's current list_id. Idempotent
-- regardless of row count (0 in most environments today, N in production).
insert into kiosk_station_lists (station_id, checkin_list_id)
select id, list_id from kiosk_stations
where list_id is not null
on conflict (station_id, checkin_list_id) do nothing;
```

- [ ] **Step 2: Commit (do not apply)**

```bash
git add supabase/migrations/20260729_kiosk_shared_stations_scheduled_lists.sql
git commit -m "feat(kiosk): add kiosk_station_lists join table + checkin_lists schedule columns (migration, not yet applied)"
```

---

### Task 2: `kiosk-station-lookup.ts` — shared station/membership query helper

**Files:**
- Create: `src/lib/kiosk-station-lookup.ts`
- Test: `src/lib/kiosk-station-lookup.test.ts`

**Interfaces:**
- Produces: `resolveStationByToken(supabase, stationToken): Promise<{ station: KioskStationRow | null; error: unknown }>`
- Produces: `stationServesList(supabase, stationId: string, checkinListId: string): Promise<boolean>`
- Produces: `interface KioskStationRow { id: string; event_id: string; mode: string; revoked_at: string | null }`
- Consumed by: Task 3 (`/api/kiosk/delegates`) and Task 4 (`/api/kiosk/checkin`). Query only, never the authorization *decision* — a membership miss means "hard reject" to one caller and "fall through to unattributed" to the other; each route makes that call itself.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/kiosk-station-auth", () => ({
  hashStationToken: (token: string) => `hashed:${token}`,
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

describe("resolveStationByToken", () => {
  it("queries kiosk_stations by the token's hash and returns the row", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: "ev-1", mode: "checkin", revoked_at: null },
      error: null,
    })
    const { resolveStationByToken } = await import("./kiosk-station-lookup")
    const { station, error } = await resolveStationByToken(mock.client, "plaintext-token")

    expect(error).toBeNull()
    expect(station).toEqual({ id: "st-1", event_id: "ev-1", mode: "checkin", revoked_at: null })
    expect(
      mock.calls.some((c) => c.table === "kiosk_stations" && c.method === "eq" && c.args[0] === "access_token_hash" && c.args[1] === "hashed:plaintext-token")
    ).toBe(true)
  })

  it("returns null station and no error on no match", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { resolveStationByToken } = await import("./kiosk-station-lookup")
    const { station, error } = await resolveStationByToken(mock.client, "wrong-token")
    expect(station).toBeNull()
    expect(error).toBeNull()
  })

  it("passes through a lookup error without throwing", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: { message: "boom" } })
    const { resolveStationByToken } = await import("./kiosk-station-lookup")
    const { error } = await resolveStationByToken(mock.client, "any-token")
    expect(error).toEqual({ message: "boom" })
  })
})

describe("stationServesList", () => {
  it("returns true when a kiosk_station_lists row exists for this pair", async () => {
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    const { stationServesList } = await import("./kiosk-station-lookup")
    const result = await stationServesList(mock.client, "st-1", "list-1")
    expect(result).toBe(true)
    expect(mock.calls.some((c) => c.table === "kiosk_station_lists" && c.method === "eq" && c.args[0] === "checkin_list_id" && c.args[1] === "list-1")).toBe(true)
  })

  it("returns false when no membership row exists", async () => {
    mock.queueResponse("kiosk_station_lists", { data: null, error: null })
    const { stationServesList } = await import("./kiosk-station-lookup")
    const result = await stationServesList(mock.client, "st-1", "list-1")
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/kiosk-station-lookup.test.ts`
Expected: FAIL — `Cannot find module './kiosk-station-lookup'`

- [ ] **Step 3: Write the implementation**

```typescript
// Shared station/membership lookup for /api/kiosk/delegates and
// /api/kiosk/checkin -- the QUERY only, never the authorization decision. A
// membership miss means "hard reject" to /delegates (see its module comment)
// but "fall through to an unattributed check-in" to /checkin (which was
// never token-gated) -- each route makes that call itself, on purpose, so
// one route's semantics can never leak into the other on a future edit.
import { hashStationToken } from "@/lib/kiosk-station-auth"

export interface KioskStationRow {
  id: string
  event_id: string
  mode: string
  revoked_at: string | null
}

export async function resolveStationByToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  stationToken: string
): Promise<{ station: KioskStationRow | null; error: unknown }> {
  const { data, error } = await supabase
    .from("kiosk_stations")
    .select("id, event_id, mode, revoked_at")
    .eq("access_token_hash", hashStationToken(stationToken))
    .maybeSingle()
  return { station: (data as KioskStationRow | null) ?? null, error }
}

export async function stationServesList(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  stationId: string,
  checkinListId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("kiosk_station_lists")
    .select("station_id")
    .eq("station_id", stationId)
    .eq("checkin_list_id", checkinListId)
    .maybeSingle()
  return !!data
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/kiosk-station-lookup.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/kiosk-station-lookup.ts src/lib/kiosk-station-lookup.test.ts
git commit -m "feat(kiosk): add shared station/membership lookup helper"
```

---

### Task 3: `/api/kiosk/delegates` — per-list membership check + mode-check fix

**Files:**
- Modify: `src/app/api/kiosk/delegates/route.ts:1-104`
- Modify: `src/app/api/kiosk/delegates/route.test.ts`

**Interfaces:**
- Consumes: `resolveStationByToken`, `stationServesList` from Task 2.
- Produces: query param contract change — `station_token` now REQUIRES a sibling `list_id` query param (the direct `token` path is unchanged; it's already list-specific via the list's own `access_token`).

- [ ] **Step 1: Write the failing tests**

Add to `src/app/api/kiosk/delegates/route.test.ts` (new `describe` block; keep every existing test as-is except where noted below):

```typescript
describe("GET /api/kiosk/delegates -- station_token multi-list", () => {
  it("400s when station_token is present without list_id", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "st-tok" })))
    expect(res.status).toBe(400)
  })

  it("404s when the station doesn't serve the requested list", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "st-tok", list_id: LIST_ID })))
    expect(res.status).toBe(404)
  })

  it("accepts a checkin_and_print station serving the requested list", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin_and_print", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "st-tok", list_id: LIST_ID })))
    expect(res.status).toBe(200)
  })
})
```

Update the three existing `station_token`-path tests around the current lines 270-300 (they currently pass `list_id: LIST_ID` inside the mocked `kiosk_stations` row, and mock only `kiosk_stations` + `checkin_lists`): add `&list_id=${LIST_ID}` to each request's `url(...)` call, remove `list_id: LIST_ID` from the mocked `kiosk_stations` data (that field is no longer selected), and add `mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })` before the `checkin_lists` queue in the ones that reach that far (the revoked/wrong-mode/wrong-event tests short-circuit before the membership check, so they don't need it).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/kiosk/delegates/route.test.ts`
Expected: FAIL (400/404 cases return the old behavior; existing station_token tests fail on the new required param)

- [ ] **Step 3: Implement**

Replace lines 1-6 (imports) — drop `hashStationToken`, add the new helper:

```typescript
import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { resolveStationByToken, stationServesList } from "@/lib/kiosk-station-lookup"
```

Replace lines 43-104 (param parsing through the end of the `if (stationToken) { ... } else { ... }` block):

```typescript
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

      const isMember = await stationServesList(supabase, station.id, requestedListId as string)
      if (!isMember) {
        return NextResponse.json({ error: "Check-in list not found." }, { status: 404 })
      }

      const result = await (supabase as any)
        .from("checkin_lists")
        .select("id, event_id, list_purpose, ticket_type_ids, addon_ids")
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
        .select("id, event_id, list_purpose, access_token_expires_at, ticket_type_ids, addon_ids")
        .eq("access_token", token)
        .maybeSingle()
      list = result.data
      listLookupError = result.error
    }
```

The rest of the file (from `if (listLookupError) { ... }` at the current line 106 onward) is unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/kiosk/delegates/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/kiosk/delegates/route.ts src/app/api/kiosk/delegates/route.test.ts
git commit -m "feat(kiosk): scope /api/kiosk/delegates station_token path to one of the station's assigned lists"
```

---

### Task 4: `/api/kiosk/checkin` — set-membership attribution + mode-check fix

**Files:**
- Modify: `src/app/api/kiosk/checkin/route.ts:68-90`
- Modify: `src/app/api/kiosk/checkin/route.test.ts`

**Interfaces:**
- Consumes: `resolveStationByToken`, `stationServesList` from Task 2.
- No response-shape or request-shape change — this is purely an internal attribution check, unchanged from the outside. `stationId` still resolves to `null` (never blocks the check-in) on any miss, exactly as documented in the existing header comment.

- [ ] **Step 1: Write the failing tests**

Add to `src/app/api/kiosk/checkin/route.test.ts`:

```typescript
describe("POST /api/kiosk/checkin -- set-membership station attribution", () => {
  it("attributes to the station when it serves the requested list (checkin_and_print)", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin_and_print", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id replay check
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // already-checked-in check
    mock.queueResponse("checkin_records", { data: { id: "cr-1" }, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // checked_in update

    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk/checkin", {
      method: "POST",
      body: { event_id: EVENT_ID, checkin_list_id: LIST_ID, registration_id: REGISTRATION_ID, scan_id: SCAN_ID, station_token: "st-tok" },
    }))
    expect(res.status).toBe(200)
    const insertCall = mock.calls.find((c) => c.table === "checkin_records" && c.method === "insert")
    expect((insertCall!.args[0] as any).station_id).toBe("st-1")
  })

  it("falls through to unattributed (never blocks) when the station doesn't serve this list", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: null, error: null })
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("checkin_records", { data: { id: "cr-1" }, error: null })
    mock.queueResponse("registrations", { data: null, error: null })

    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk/checkin", {
      method: "POST",
      body: { event_id: EVENT_ID, checkin_list_id: LIST_ID, registration_id: REGISTRATION_ID, scan_id: SCAN_ID, station_token: "st-tok" },
    }))
    expect(res.status).toBe(200)
    const insertCall = mock.calls.find((c) => c.table === "checkin_records" && c.method === "insert")
    expect((insertCall!.args[0] as any).station_id).toBeUndefined()
  })
})
```

(Use whatever `baseRegistration()`/`baseList()`/`REGISTRATION_ID`/`SCAN_ID` helpers/constants the existing file already defines — match their exact names; if the file doesn't have a `baseRegistration()` helper, inline the same registration shape the existing "resolves a fresh registration" test around line 366 already uses.)

Update the existing two tests at the current lines 366 and 411 (`mode: "checkin", list_id: LIST_ID` and `mode: "checkin", list_id: "999...999"` mocks): drop `list_id` from the mocked `kiosk_stations` row (no longer selected) and insert a `mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })` / `{ data: null, error: null }` respectively, matching each test's intent (the first attributes, the second's wrong-event station never reaches the membership check at all since `station.event_id !== eventId` isn't checked directly for `/checkin` — verify against the current code below before assuming; adjust the queued response only if the implementation still performs a membership lookup on that path).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/kiosk/checkin/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

Add import at the top of the file (alongside the existing ones):

```typescript
import { resolveStationByToken, stationServesList } from "@/lib/kiosk-station-lookup"
```

Remove the now-unused `hashStationToken` import if nothing else in the file uses it (check with a grep before deleting — this file's only other `hashStationToken` use is the block being replaced below).

Replace lines 73-90:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/kiosk/checkin/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/kiosk/checkin/route.ts src/app/api/kiosk/checkin/route.test.ts
git commit -m "fix(kiosk): attribute checkin via station-list membership; accept checkin_and_print stations"
```

---

### Task 5: `/api/kiosk-stations` — `list_ids: string[]` instead of `list_id: string`

**Files:**
- Modify: `src/app/api/kiosk-stations/route.ts` (GET lines 10-33, POST lines 39-123)
- Modify: `src/app/api/kiosk-stations/[id]/route.ts:8-84` (PATCH)
- Modify: `src/app/api/kiosk-stations/route.test.ts`
- Modify: `src/app/api/kiosk-stations/[id]/route.test.ts`

**Interfaces:**
- Produces: POST body `{ event_id, name, list_ids: string[] (non-empty), mode?, print_station_id?, auto_print_badge? }` → 201 with the created station (unchanged fields) plus `list_ids`.
- Produces: PATCH body may include `list_ids?: string[]` (replaces the full assignment set) alongside the existing `name?`/`print_station_id?`/`auto_print_badge?`.
- Produces: GET response's each station row now includes `list_ids: string[]`.
- `kiosk_stations.list_id` is no longer read or written by this route — new stations are created with it left `null`; existing rows keep whatever `list_id` they already had (untouched, matches Task 1's backfill).

- [ ] **Step 1: Write the failing tests**

Update `src/app/api/kiosk-stations/route.test.ts`:

Change the "lists stations" test to also queue a `kiosk_station_lists` response and assert `list_ids` on the returned station:

```typescript
  it("lists stations for the event, with each station's assigned list_ids, never exposing access_token_hash", async () => {
    mock.queueResponse("kiosk_stations", {
      data: [{ id: "st-1", event_id: EVENT_ID, name: "Front Desk", mode: "checkin", last_seen_at: null, revoked_at: null, created_at: "2026-07-27T00:00:00Z" }],
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: [{ station_id: "st-1", checkin_list_id: LIST_ID }], error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations?event_id=${EVENT_ID}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.stations[0].list_ids).toEqual([LIST_ID])
    expect(body.stations[0].access_token_hash).toBeUndefined()
  })
```

Replace every `list_id: LIST_ID` in the existing POST test bodies with `list_ids: [LIST_ID]`, and add:

```typescript
  it("400s when list_ids is missing or empty", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", { method: "POST", body: { event_id: EVENT_ID, name: "Front Desk", list_ids: [] } }))
    expect(res.status).toBe(400)
  })

  it("404s when any list_id doesn't belong to this event", async () => {
    mock.queueResponse("checkin_lists", { data: [{ id: LIST_ID, event_id: EVENT_ID }], error: null })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", {
      method: "POST",
      body: { event_id: EVENT_ID, name: "Front Desk", list_ids: [LIST_ID, "99999999-9999-9999-9999-999999999999"] },
    }))
    expect(res.status).toBe(404)
  })

  it("creates the station and inserts one kiosk_station_lists row per list_id", async () => {
    mock.queueResponse("checkin_lists", { data: [{ id: LIST_ID, event_id: EVENT_ID }], error: null })
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, name: "Front Desk", mode: "checkin", created_at: "2026-07-27T00:00:00Z" },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: null, error: null })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", { method: "POST", body: { event_id: EVENT_ID, name: "Front Desk", list_ids: [LIST_ID] } }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.list_ids).toEqual([LIST_ID])
    const joinInsert = mock.calls.find((c) => c.table === "kiosk_station_lists" && c.method === "insert")
    expect(joinInsert).toBeTruthy()
    expect((mock.calls.find((c) => c.table === "kiosk_stations" && c.method === "insert")!.args[0] as any).list_id).toBeUndefined()
  })
```

Update `src/app/api/kiosk-stations/[id]/route.test.ts` similarly: replace any `list_id`-reassignment test with one asserting `list_ids` triggers a delete-then-insert against `kiosk_station_lists`:

```typescript
  it("replaces the station's assigned lists on PATCH with list_ids", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: "st-1", event_id: EVENT_ID }, error: null })
    mock.queueResponse("checkin_lists", { data: [{ id: LIST_ID, event_id: EVENT_ID }], error: null })
    mock.queueResponse("kiosk_station_lists", { data: null, error: null }) // delete
    mock.queueResponse("kiosk_station_lists", { data: null, error: null }) // insert
    mock.queueResponse("kiosk_stations", { data: { id: "st-1", event_id: EVENT_ID, name: "Front Desk" }, error: null })
    const { PATCH } = await import("./route")
    const res = await PATCH(
      makeRequest("http://localhost/api/kiosk-stations/st-1", { method: "PATCH", body: { list_ids: [LIST_ID] } }),
      { params: Promise.resolve({ id: "st-1" }) }
    )
    expect(res.status).toBe(200)
    expect(mock.calls.some((c) => c.table === "kiosk_station_lists" && c.method === "delete")).toBe(true)
    expect(mock.calls.some((c) => c.table === "kiosk_station_lists" && c.method === "insert")).toBe(true)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/kiosk-stations/route.test.ts src/app/api/kiosk-stations/[id]/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement — GET (route.ts:10-33)**

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }

  const { error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id, name, mode, print_station_id, auto_print_badge, last_seen_at, revoked_at, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Failed to load kiosk stations." }, { status: 500 })
  }

  const stations = data || []
  const stationIds = stations.map((s: any) => s.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: joinRows } = stationIds.length > 0
    ? await (supabase as any).from("kiosk_station_lists").select("station_id, checkin_list_id").in("station_id", stationIds)
    : { data: [] }

  const listIdsByStation = new Map<string, string[]>()
  for (const row of joinRows || []) {
    const existing = listIdsByStation.get(row.station_id) || []
    existing.push(row.checkin_list_id)
    listIdsByStation.set(row.station_id, existing)
  }

  return NextResponse.json({
    stations: stations.map((s: any) => ({ ...s, list_ids: listIdsByStation.get(s.id) || [] })),
  })
}
```

- [ ] **Step 4: Implement — POST (route.ts:39-123)**

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const eventId = body.event_id as string | undefined
  const name = (body.name as string | undefined)?.trim()
  const listIds = Array.isArray(body.list_ids) ? (body.list_ids as string[]) : []

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 })
  }
  if (listIds.length === 0 || !listIds.every(isValidUUID)) {
    return NextResponse.json({ error: "At least one check-in list must be selected." }, { status: 400 })
  }

  const mode = (body.mode as string | undefined) === "checkin_and_print" ? "checkin_and_print" : "checkin"
  const printStationId = body.print_station_id as string | undefined
  const autoPrintBadge = body.auto_print_badge === true

  if (mode === "checkin_and_print" && (!printStationId || !isValidUUID(printStationId))) {
    return NextResponse.json({ error: "A Print Station must be selected for check-in + print mode." }, { status: 400 })
  }

  const { error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  const supabase = await createAdminClient()

  // Every requested list must belong to this event -- a station bound to a
  // list from a different event would be a real authorization hole.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lists } = await (supabase as any)
    .from("checkin_lists")
    .select("id, event_id")
    .in("id", listIds)

  const foundIds = new Set((lists || []).map((l: any) => l.id))
  if (listIds.some((id) => !foundIds.has(id)) || (lists || []).some((l: any) => l.event_id !== eventId)) {
    return NextResponse.json({ error: "Check-in list not found for this event." }, { status: 404 })
  }

  if (mode === "checkin_and_print") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: printStation } = await (supabase as any)
      .from("print_stations")
      .select("id, event_id, print_settings")
      .eq("id", printStationId)
      .maybeSingle()

    if (!printStation || printStation.event_id !== eventId) {
      return NextResponse.json({ error: "Print Station not found for this event." }, { status: 404 })
    }
    if (printStation.print_settings?.printer_type !== "usb") {
      return NextResponse.json({ error: "Check-in + Print Badge stations require a USB-type Print Station." }, { status: 400 })
    }
  }

  const access_token = newStationToken()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error } = await (supabase as any)
    .from("kiosk_stations")
    .insert({
      event_id: eventId,
      name,
      mode,
      // list_id is deliberately left unset -- kiosk_station_lists is the
      // source of truth for every station created from here on. The column
      // stays on the table only for stations created before this change.
      print_station_id: mode === "checkin_and_print" ? printStationId : null,
      auto_print_badge: mode === "checkin_and_print" ? autoPrintBadge : false,
      access_token_hash: hashStationToken(access_token),
    })
    .select("id, event_id, name, mode, print_station_id, auto_print_badge, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to create kiosk station." }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: joinError } = await (supabase as any)
    .from("kiosk_station_lists")
    .insert(listIds.map((checkin_list_id) => ({ station_id: station.id, checkin_list_id })))

  if (joinError) {
    return NextResponse.json({ error: "Station created but failed to assign lists." }, { status: 500 })
  }

  // access_token is returned ONLY in this creation response -- it is never
  // retrievable again (only its hash is stored server-side).
  return NextResponse.json({ ...station, list_ids: listIds, access_token }, { status: 201 })
}
```

- [ ] **Step 5: Implement — PATCH (`[id]/route.ts:29-70`)**

Replace the `list_id` handling block with `list_ids` handling. Insert this block where the old `if (typeof body.list_id === "string") { ... }` block was, and perform the delete-then-insert *after* the main `updates` object is built and applied (so a list-membership failure doesn't leave `updates` half-applied — do it in the same handler, after the existing `.update(updates)` call succeeds):

```typescript
  // ... existing name/print_station_id/auto_print_badge handling from the
  // current file stays exactly as-is, minus the list_id block ...

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("kiosk_stations")
    .update(updates)
    .eq("id", id)
    .select("id, event_id, name, mode, print_station_id, auto_print_badge")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to update kiosk station." }, { status: 500 })
  }

  let listIds: string[] | undefined
  if (Array.isArray(body.list_ids)) {
    const requested = body.list_ids as string[]
    if (requested.length === 0 || !requested.every(isValidUUID)) {
      return NextResponse.json({ error: "At least one check-in list must be selected." }, { status: 400 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lists } = await (supabase as any).from("checkin_lists").select("id, event_id").in("id", requested)
    const foundIds = new Set((lists || []).map((l: any) => l.id))
    if (requested.some((rid) => !foundIds.has(rid)) || (lists || []).some((l: any) => l.event_id !== station.event_id)) {
      return NextResponse.json({ error: "Check-in list not found for this event." }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("kiosk_station_lists").delete().eq("station_id", id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: joinError } = await (supabase as any)
      .from("kiosk_station_lists")
      .insert(requested.map((checkin_list_id) => ({ station_id: id, checkin_list_id })))
    if (joinError) {
      return NextResponse.json({ error: "Station updated but failed to reassign lists." }, { status: 500 })
    }
    listIds = requested
  }

  return NextResponse.json({ ...data, ...(listIds && { list_ids: listIds }) })
```

Move the `isValidUUID` check for `body.list_id` (currently rejecting invalid UUIDs) — this is superseded entirely by the `list_ids` array check above; remove the old `list_id` branch completely, including its cross-event `checkin_lists` lookup (now folded into the block above).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/app/api/kiosk-stations/route.test.ts "src/app/api/kiosk-stations/[id]/route.test.ts"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/kiosk-stations/route.ts "src/app/api/kiosk-stations/[id]/route.ts" src/app/api/kiosk-stations/route.test.ts "src/app/api/kiosk-stations/[id]/route.test.ts"
git commit -m "feat(kiosk): kiosk_stations POST/PATCH take list_ids[] via kiosk_station_lists"
```

---

### Task 6: `src/lib/kiosk-list-schedule.ts` — pure open/closed computation

**Files:**
- Create: `src/lib/kiosk-list-schedule.ts`
- Test: `src/lib/kiosk-list-schedule.test.ts`

**Interfaces:**
- Produces: `interface ScheduledList { kiosk_opens_at: string | null; kiosk_closes_at: string | null; kiosk_force_state: "open" | "closed" | null }`
- Produces: `computeListState(list: ScheduledList, now?: Date): "open" | "closed"`
- Produces: `minutesUntilClose(list: ScheduledList, now?: Date): number | null`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { computeListState, minutesUntilClose } from "./kiosk-list-schedule"

const NOON = new Date("2026-07-29T12:00:00.000Z")

describe("computeListState", () => {
  it("is open when nothing is set", () => {
    expect(computeListState({ kiosk_opens_at: null, kiosk_closes_at: null, kiosk_force_state: null }, NOON)).toBe("open")
  })

  it("force_state open wins even past closes_at", () => {
    expect(computeListState({
      kiosk_opens_at: null,
      kiosk_closes_at: "2026-07-29T11:00:00.000Z",
      kiosk_force_state: "open",
    }, NOON)).toBe("open")
  })

  it("force_state closed wins even inside the window", () => {
    expect(computeListState({
      kiosk_opens_at: "2026-07-29T09:00:00.000Z",
      kiosk_closes_at: "2026-07-29T18:00:00.000Z",
      kiosk_force_state: "closed",
    }, NOON)).toBe("closed")
  })

  it("is closed before opens_at", () => {
    expect(computeListState({ kiosk_opens_at: "2026-07-29T13:00:00.000Z", kiosk_closes_at: null, kiosk_force_state: null }, NOON)).toBe("closed")
  })

  it("is closed after closes_at", () => {
    expect(computeListState({ kiosk_opens_at: null, kiosk_closes_at: "2026-07-29T11:00:00.000Z", kiosk_force_state: null }, NOON)).toBe("closed")
  })

  it("is open inside the window", () => {
    expect(computeListState({
      kiosk_opens_at: "2026-07-29T09:00:00.000Z",
      kiosk_closes_at: "2026-07-29T18:00:00.000Z",
      kiosk_force_state: null,
    }, NOON)).toBe("open")
  })
})

describe("minutesUntilClose", () => {
  it("returns null when there's no closes_at", () => {
    expect(minutesUntilClose({ kiosk_opens_at: null, kiosk_closes_at: null, kiosk_force_state: null }, NOON)).toBeNull()
  })

  it("returns null when force_state is set (schedule is irrelevant)", () => {
    expect(minutesUntilClose({ kiosk_opens_at: null, kiosk_closes_at: "2026-07-29T12:03:00.000Z", kiosk_force_state: "open" }, NOON)).toBeNull()
  })

  it("returns null once already closed", () => {
    expect(minutesUntilClose({ kiosk_opens_at: null, kiosk_closes_at: "2026-07-29T11:00:00.000Z", kiosk_force_state: null }, NOON)).toBeNull()
  })

  it("returns whole minutes remaining", () => {
    expect(minutesUntilClose({ kiosk_opens_at: null, kiosk_closes_at: "2026-07-29T12:05:30.000Z", kiosk_force_state: null }, NOON)).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/kiosk-list-schedule.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// Pure, on-device open/closed computation for a shared kiosk station's
// assigned lists. Deliberately separate from src/lib/checkin-time-window.ts
// (that module drives a different, soft-warning-only behavior on
// checkin_lists.starts_at/ends_at, live in production today) -- this one
// hard-gates which menu rows are tappable, so it must never share code or
// data with that system. See docs/superpowers/specs/2026-07-29-kiosk-shared-stations-scheduled-lists-design.md.

export interface ScheduledList {
  kiosk_opens_at: string | null
  kiosk_closes_at: string | null
  kiosk_force_state: "open" | "closed" | null
}

export function computeListState(list: ScheduledList, now: Date = new Date()): "open" | "closed" {
  if (list.kiosk_force_state) return list.kiosk_force_state
  if (list.kiosk_opens_at && now < new Date(list.kiosk_opens_at)) return "closed"
  if (list.kiosk_closes_at && now > new Date(list.kiosk_closes_at)) return "closed"
  return "open"
}

// For the "closes in 5 minutes" banner. null when there's nothing to count
// down to: no closes_at, a force_state override (the schedule doesn't apply
// at all), or already closed.
export function minutesUntilClose(list: ScheduledList, now: Date = new Date()): number | null {
  if (list.kiosk_force_state) return null
  if (!list.kiosk_closes_at) return null
  if (computeListState(list, now) === "closed") return null
  const diffMs = new Date(list.kiosk_closes_at).getTime() - now.getTime()
  return Math.floor(diffMs / 60000)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/kiosk-list-schedule.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/kiosk-list-schedule.ts src/lib/kiosk-list-schedule.test.ts
git commit -m "feat(kiosk): add on-device list open/closed schedule computation"
```

---

### Task 7: `/api/kiosk/station-manifest` — new endpoint

**Files:**
- Create: `src/app/api/kiosk/station-manifest/route.ts`
- Test: `src/app/api/kiosk/station-manifest/route.test.ts`

**Interfaces:**
- Produces: `GET /api/kiosk/station-manifest?event_id=&station_token=` → `{ station_name: string; mode: "checkin" | "checkin_and_print"; print_station_id: string | null; auto_print_badge: boolean; lists: Array<{ id: string; name: string; kiosk_opens_at: string | null; kiosk_closes_at: string | null; kiosk_force_state: "open" | "closed" | null }> }`
- Consumed by: Task 10 (`KioskStationShell`'s refresh loop).

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))
vi.mock("@/lib/kiosk-station-auth", () => ({
  hashStationToken: (t: string) => `hashed:${t}`,
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

function url(params: Record<string, string>) {
  return `http://localhost/api/kiosk/station-manifest?${new URLSearchParams(params).toString()}`
}

describe("GET /api/kiosk/station-manifest", () => {
  it("400s on a missing or invalid event_id", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: "not-a-uuid", station_token: "tok" })))
    expect(res.status).toBe(400)
  })

  it("401s when station_token is missing", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID })))
    expect(res.status).toBe(401)
  })

  it("401s when the token doesn't resolve, is revoked, or is print-only mode", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "tok" })))
    expect(res.status).toBe(401)
  })

  it("404s when the station belongs to a different event", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: "99999999-9999-9999-9999-999999999999", name: "Front Desk", mode: "checkin", print_station_id: null, auto_print_badge: false, revoked_at: null },
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "tok" })))
    expect(res.status).toBe(404)
  })

  it("returns the station's assigned lists joined with their schedule fields", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, name: "Food Area", mode: "checkin", print_station_id: null, auto_print_badge: false, revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: [{ checkin_list_id: "list-1" }, { checkin_list_id: "list-2" }], error: null })
    mock.queueResponse("checkin_lists", {
      data: [
        { id: "list-1", name: "Breakfast", kiosk_opens_at: null, kiosk_closes_at: null, kiosk_force_state: null },
        { id: "list-2", name: "Lunch", kiosk_opens_at: null, kiosk_closes_at: null, kiosk_force_state: "closed" },
      ],
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "tok" })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.station_name).toBe("Food Area")
    expect(body.lists).toHaveLength(2)
    expect(body.lists.find((l: any) => l.id === "list-2").kiosk_force_state).toBe("closed")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/kiosk/station-manifest/route.test.ts`
Expected: FAIL — route module doesn't exist

- [ ] **Step 3: Implement**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { resolveStationByToken } from "@/lib/kiosk-station-lookup"

// GET /api/kiosk/station-manifest?event_id=&station_token= -- the set of
// lists THIS station is assigned, with their schedule fields, so
// KioskStationShell can render the menu and recompute open/closed on-device
// (src/lib/kiosk-list-schedule.ts). Refreshed on the same 5-minute cadence
// KioskCheckinScreen's own roster refresh already uses, and cached in
// kiosk-offline-store.ts so the menu works fully offline from a cold reload.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")
  const stationToken = searchParams.get("station_token")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }
  if (!stationToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 })
  }

  const supabase = await createAdminClient()
  const { station } = await resolveStationByToken(supabase, stationToken)

  if (!station || station.revoked_at || (station.mode !== "checkin" && station.mode !== "checkin_and_print")) {
    return NextResponse.json({ error: "Invalid access token." }, { status: 401 })
  }
  if (station.event_id !== eventId) {
    return NextResponse.json({ error: "Station not found." }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: joinRows } = await (supabase as any)
    .from("kiosk_station_lists")
    .select("checkin_list_id")
    .eq("station_id", station.id)

  const listIds = (joinRows || []).map((r: any) => r.checkin_list_id)

  let lists: any[] = []
  if (listIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("checkin_lists")
      .select("id, name, kiosk_opens_at, kiosk_closes_at, kiosk_force_state")
      .in("id", listIds)
    lists = data || []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stationRow = station as any
  return NextResponse.json({
    station_name: stationRow.name,
    mode: stationRow.mode,
    print_station_id: stationRow.print_station_id ?? null,
    auto_print_badge: !!stationRow.auto_print_badge,
    lists,
  })
}
```

Note: `resolveStationByToken`'s `select` (`id, event_id, mode, revoked_at`) doesn't include `name`/`print_station_id`/`auto_print_badge` — this route needs those too. Widen the shared helper's select list in Task 2 to `"id, event_id, mode, revoked_at, name, print_station_id, auto_print_badge"` and widen `KioskStationRow` to match (the two existing callers, `/delegates` and `/checkin`, simply ignore the extra fields — no behavior change there). Apply that widening now as part of this task, and re-run Task 2's and Task 3's tests to confirm nothing broke (their mocked rows may omit the new fields, which is fine — the mock's `data` object is used as-is regardless of the `select(...)` string).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/kiosk/station-manifest/route.test.ts src/lib/kiosk-station-lookup.test.ts src/app/api/kiosk/delegates/route.test.ts src/app/api/kiosk/checkin/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/kiosk/station-manifest/route.ts src/app/api/kiosk/station-manifest/route.test.ts src/lib/kiosk-station-lookup.ts
git commit -m "feat(kiosk): add /api/kiosk/station-manifest endpoint"
```

---

### Task 8: `kiosk-offline-store.ts` — cache the station manifest

**Files:**
- Modify: `src/lib/kiosk-offline-store.ts`
- Modify: `src/lib/kiosk-offline-store.test.ts` (if it exists; otherwise create it following this repo's existing IndexedDB-mocking convention for this file — check for a fake-indexeddb setup used elsewhere in this project's test suite before writing new mocking code)

**Interfaces:**
- Produces: `interface StationManifestList { id: string; name: string; kiosk_opens_at: string | null; kiosk_closes_at: string | null; kiosk_force_state: "open" | "closed" | null }`
- Produces: `interface StationManifest { station_name: string; mode: "checkin" | "checkin_and_print"; print_station_id: string | null; auto_print_badge: boolean; lists: StationManifestList[] }`
- Produces: `cacheStationManifest(manifest: StationManifest): Promise<void>`
- Produces: `getStationManifest(): Promise<StationManifest | null>`
- No `VERSION` bump, no new object store — reuses the existing `META_STORE` (keyPath `"key"`) with one new key, `"station_manifest"`, exactly like `device_id` and `cache_updated_at:<listId>` already do.

- [ ] **Step 1: Write the failing test**

Check the existing test file first — if `src/lib/kiosk-offline-store.test.ts` exists, follow its existing IndexedDB setup exactly (likely `fake-indexeddb/auto` imported at the top, since this module uses `idb`'s `openDB`) and add:

```typescript
describe("station manifest cache", () => {
  const manifest = {
    station_name: "Food Area",
    mode: "checkin" as const,
    print_station_id: null,
    auto_print_badge: false,
    lists: [{ id: "list-1", name: "Breakfast", kiosk_opens_at: null, kiosk_closes_at: null, kiosk_force_state: null }],
  }

  it("returns null before anything is cached", async () => {
    const { getStationManifest } = await import("./kiosk-offline-store")
    expect(await getStationManifest()).toBeNull()
  })

  it("round-trips a cached manifest", async () => {
    const { cacheStationManifest, getStationManifest } = await import("./kiosk-offline-store")
    await cacheStationManifest(manifest)
    expect(await getStationManifest()).toEqual(manifest)
  })

  it("overwrites the previous manifest on a later cache call", async () => {
    const { cacheStationManifest, getStationManifest } = await import("./kiosk-offline-store")
    await cacheStationManifest(manifest)
    await cacheStationManifest({ ...manifest, station_name: "Renamed" })
    expect((await getStationManifest())?.station_name).toBe("Renamed")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/kiosk-offline-store.test.ts`
Expected: FAIL — `cacheStationManifest`/`getStationManifest` not exported

- [ ] **Step 3: Implement**

Add near the other exported interfaces (after `PrintLogEntry`):

```typescript
export interface StationManifestList {
  id: string
  name: string
  kiosk_opens_at: string | null
  kiosk_closes_at: string | null
  kiosk_force_state: "open" | "closed" | null
}

export interface StationManifest {
  station_name: string
  mode: "checkin" | "checkin_and_print"
  print_station_id: string | null
  auto_print_badge: boolean
  lists: StationManifestList[]
}
```

Add near the other Meta-keyed functions (e.g. after `getCacheUpdatedAt`):

```typescript
// --- Station manifest cache (multi-list shared stations) ------------------
// One new META_STORE key, no VERSION bump -- see the module header for why
// this store's value type (string | number) is fine for a JSON blob.

export async function cacheStationManifest(manifest: StationManifest): Promise<void> {
  const db = await getDb()
  await db.put(META_STORE, { key: "station_manifest", value: JSON.stringify(manifest) } satisfies MetaRow)
}

export async function getStationManifest(): Promise<StationManifest | null> {
  const db = await getDb()
  const row = (await db.get(META_STORE, "station_manifest")) as MetaRow | undefined
  if (!row) return null
  return JSON.parse(row.value as string) as StationManifest
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/kiosk-offline-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/kiosk-offline-store.ts src/lib/kiosk-offline-store.test.ts
git commit -m "feat(kiosk): cache the station manifest in IndexedDB for offline cold reloads"
```

---

### Task 9: `KioskCheckinScreen` — `externallyDriven`, `onSwitchList`, `closingSoonMinutes` props

**Files:**
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx:76-119` (props), `:963-971` (sync-poll effect), `:1504-1512` (header list-name block)

**Interfaces:**
- Produces: three new optional props on `KioskCheckinScreenProps`:
  - `externallyDriven?: boolean` — when true, disables this component's own 20s scan-queue sync poll (a `KioskStationShell` parent owns draining every assigned list instead — see Task 10). Default `false`, so the existing direct-URL (`/kiosk/[eventId]/[listId]`) and single-list station callers are unaffected.
  - `onSwitchList?: () => void` — when provided, renders a "Switch list" control next to the list name; clicking it asks for confirmation (native `confirm()`, matching this codebase's existing convention in `kiosk-stations/page.tsx` and `checkin/lists/page.tsx`) and calls this callback on confirm.
  - `closingSoonMinutes?: number | null` — when a non-null number `<= 5`, renders a "closes in N minutes" banner. Computed and passed by the parent shell (this component has no access to schedule fields itself).

- [ ] **Step 1: Add the props**

In the `KioskCheckinScreenProps` interface (after `printMode?: string` at line 104):

```typescript
  // Multi-list shared-station mode (KioskStationShell, see
  // src/components/kiosk/KioskStationShell.tsx). All three are undefined/
  // false for every existing caller -- the direct-URL kiosk and a
  // single-list station both render this component directly, unchanged.
  externallyDriven?: boolean
  onSwitchList?: () => void
  closingSoonMinutes?: number | null
```

In the destructured props (after `printMode,` at line 118):

```typescript
  externallyDriven = false,
  onSwitchList,
  closingSoonMinutes,
```

- [ ] **Step 2: Gate the internal sync-poll effect**

Replace the effect at (current) lines 963-971:

```typescript
  useEffect(() => {
    // KioskStationShell owns draining every assigned list's queue when this
    // screen is rendered under it -- a second timer here would double-POST
    // whichever scan both timers raced to drain first.
    if (externallyDriven) return
    if (typeof navigator !== "undefined" && navigator.onLine) void syncNow()
    window.addEventListener("online", syncNow)
    const pollId = setInterval(syncNow, 20000)
    return () => {
      window.removeEventListener("online", syncNow)
      clearInterval(pollId)
    }
  }, [syncNow, externallyDriven])
```

- [ ] **Step 3: Add the switch-list control and closing-soon banner**

Replace the header block at (current) lines 1504-1512:

```typescript
          <div className="text-right shrink-0">
            <p className="text-xs sm:text-sm text-gray-400">Checking in for</p>
            <div className="flex items-center gap-2 justify-end">
              <p className="text-base sm:text-xl font-semibold text-white truncate">
                {list?.name || "Loading…"}
              </p>
              {onSwitchList && (
                <button
                  onClick={() => {
                    if (confirm(`Leave ${list?.name || "this list"} and return to the menu?`)) {
                      onSwitchList()
                    }
                  }}
                  className="text-xs text-indigo-300 underline hover:text-indigo-200 shrink-0"
                >
                  Switch list
                </button>
              )}
            </div>
            {stationName && (
              <p className="text-xs text-gray-500 truncate">{stationName}</p>
            )}
            {typeof closingSoonMinutes === "number" && closingSoonMinutes >= 0 && closingSoonMinutes <= 5 && (
              <p className="text-xs text-amber-400 mt-0.5">
                {list?.name || "This list"} closes in {closingSoonMinutes} minute{closingSoonMinutes === 1 ? "" : "s"}
              </p>
            )}
          </div>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: clean (this task adds no new tests of its own — its behavior is exercised end-to-end by Task 10's `KioskStationShell` tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/kiosk/KioskCheckinScreen.tsx
git commit -m "feat(kiosk): KioskCheckinScreen supports being driven by a multi-list shell"
```

---

### Task 10: `KioskStationShell` + menu screen + rewire `/kiosk-station/[token]`

**Files:**
- Create: `src/components/kiosk/KioskStationShell.tsx`
- Create: `src/components/kiosk/KioskStationShell.test.tsx`
- Modify: `src/app/kiosk-station/[token]/page.tsx`

**Interfaces:**
- Consumes: `KioskCheckinScreen` (unchanged, plus Task 9's new props), `computeListState`/`minutesUntilClose` (Task 6), `cacheStationManifest`/`getStationManifest`/`replaceDelegateCache` (Task 8 / existing), `drainScanQueue` (existing, looped per list).
- Produces: `KioskStationShell` component, props: `{ eventId, stationToken, stationName, mode, printStationId?, badgeTemplate?, printSettings?, printMode?, autoPrintBadge, initialLists: AssignedList[] }` where `AssignedList extends ScheduledList { id: string; name: string }`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

vi.mock("@/lib/kiosk-offline-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/kiosk-offline-store")>()
  return {
    ...actual,
    getStationManifest: vi.fn(async () => null),
    cacheStationManifest: vi.fn(async () => {}),
    replaceDelegateCache: vi.fn(async () => {}),
  }
})
vi.mock("@/lib/kiosk-sync-worker", () => ({
  drainScanQueue: vi.fn(async () => ({ synced: 0, conflicted: 0, remaining: 0 })),
}))
vi.mock("@/components/kiosk/KioskCheckinScreen", () => ({
  KioskCheckinScreen: ({ listId, onSwitchList }: any) => (
    <div>
      <p>Active: {listId}</p>
      <button onClick={onSwitchList}>Switch list</button>
    </div>
  ),
}))

const originalFetch = global.fetch

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ delegates: [] }) })) as any
})

afterEach(() => {
  global.fetch = originalFetch
})

const LISTS = [
  { id: "list-1", name: "Breakfast", kiosk_opens_at: null, kiosk_closes_at: null, kiosk_force_state: null },
  { id: "list-2", name: "Lunch", kiosk_opens_at: null, kiosk_closes_at: null, kiosk_force_state: "closed" as const },
]

describe("KioskStationShell", () => {
  it("shows a menu with a tappable open row and a non-tappable closed row", async () => {
    const { KioskStationShell } = await import("./KioskStationShell")
    render(
      <KioskStationShell
        eventId="ev-1"
        stationToken="tok"
        stationName="Food Area"
        mode="checkin"
        autoPrintBadge={false}
        initialLists={LISTS}
      />
    )
    await screen.findByText("Breakfast")
    expect(screen.getByText("Lunch")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Lunch"))
    expect(screen.queryByText(/Active:/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Breakfast"))
    await screen.findByText("Active: list-1")
  })

  it("auto-selects the only assigned list instead of showing a menu", async () => {
    const { KioskStationShell } = await import("./KioskStationShell")
    render(
      <KioskStationShell
        eventId="ev-1"
        stationToken="tok"
        stationName="Front Desk"
        mode="checkin"
        autoPrintBadge={false}
        initialLists={[LISTS[0]]}
      />
    )
    await screen.findByText("Active: list-1")
  })

  it("returns to the menu when the active screen calls onSwitchList", async () => {
    const { KioskStationShell } = await import("./KioskStationShell")
    render(
      <KioskStationShell
        eventId="ev-1"
        stationToken="tok"
        stationName="Food Area"
        mode="checkin"
        autoPrintBadge={false}
        initialLists={LISTS}
      />
    )
    fireEvent.click(await screen.findByText("Breakfast"))
    await screen.findByText("Active: list-1")
    fireEvent.click(screen.getByText("Switch list"))
    await screen.findByText("Breakfast")
    expect(screen.queryByText(/Active:/)).not.toBeInTheDocument()
  })
})
```

Check whether this project already has a `@testing-library/react` + jsdom setup available for component tests (grep existing `.test.tsx` files under `src/components/`); if none exists, follow whatever the closest precedent does, or fall back to testing `KioskStationShell`'s pure logic (menu row tappability, auto-select-when-one-list) by extracting the row-tappability decision into a small exported pure helper (`isListTappable(list, now) => boolean`, trivially `computeListState(list, now) === "open"` — already covered by Task 6's tests) and testing the component only for the parts that need jsdom, skipping this task's component test entirely if the project has no React Testing Library setup at all. Confirm this against the actual repo state before writing the test file — do not add a new testing library dependency to satisfy this task.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/kiosk/KioskStationShell.test.tsx`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement**

```tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import * as Sentry from "@sentry/nextjs"
import { KioskCheckinScreen } from "./KioskCheckinScreen"
import { computeListState, minutesUntilClose, type ScheduledList } from "@/lib/kiosk-list-schedule"
import { cacheStationManifest, getStationManifest, replaceDelegateCache, type StationManifest } from "@/lib/kiosk-offline-store"
import { drainScanQueue } from "@/lib/kiosk-sync-worker"

export interface AssignedList extends ScheduledList {
  id: string
  name: string
}

interface KioskStationShellProps {
  eventId: string
  stationToken: string
  stationName: string
  mode: "checkin" | "checkin_and_print"
  printStationId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  badgeTemplate?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  printSettings?: any
  printMode?: string
  autoPrintBadge: boolean
  initialLists: AssignedList[]
}

function toAssignedLists(manifest: StationManifest): AssignedList[] {
  return manifest.lists.map((l) => ({
    id: l.id,
    name: l.name,
    kiosk_opens_at: l.kiosk_opens_at,
    kiosk_closes_at: l.kiosk_closes_at,
    kiosk_force_state: l.kiosk_force_state,
  }))
}

export function KioskStationShell({
  eventId,
  stationToken,
  stationName,
  mode,
  printStationId,
  badgeTemplate,
  printSettings,
  printMode,
  autoPrintBadge,
  initialLists,
}: KioskStationShellProps) {
  const [assignedLists, setAssignedLists] = useState<AssignedList[]>(initialLists)
  // A station with exactly one assigned list skips the menu entirely -- the
  // common case (most stations still serve one list) shouldn't cost an
  // extra tap just because the underlying model now supports many.
  const [activeListId, setActiveListId] = useState<string | null>(
    initialLists.length === 1 ? initialLists[0].id : null
  )
  const [, forceTick] = useState(0)

  const refreshManifest = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/kiosk/station-manifest?event_id=${encodeURIComponent(eventId)}&station_token=${encodeURIComponent(stationToken)}`
      )
      if (!res.ok) return
      const manifest = (await res.json()) as StationManifest
      setAssignedLists(toAssignedLists(manifest))
      await cacheStationManifest(manifest)
    } catch {
      // Offline/transient -- keep whatever's currently in state.
    }
  }, [eventId, stationToken])

  // Cold start: prefer the on-device cached manifest over the server-rendered
  // `initialLists` prop (which can be a stale service-worker-cached HTML
  // render -- see the existing /kiosk-station/ service worker coverage).
  // Then always attempt a live refresh, which wins if it succeeds.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cached = await getStationManifest()
        if (cached && !cancelled) setAssignedLists(toAssignedLists(cached))
      } catch (err) {
        Sentry.captureException(err, { tags: { module: "kiosk-station-shell" } })
      }
      await refreshManifest()
    })()
    const interval = setInterval(refreshManifest, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [refreshManifest])

  // Cache every assigned list's roster at startup, independent of which one
  // is active -- a volunteer switching lists while offline must not find an
  // empty roster.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const list of assignedLists) {
        if (cancelled) return
        try {
          const res = await fetch(
            `/api/kiosk/delegates?event_id=${encodeURIComponent(eventId)}&station_token=${encodeURIComponent(stationToken)}&list_id=${encodeURIComponent(list.id)}`
          )
          if (!res.ok) continue
          const data = (await res.json()) as { delegates: unknown[] }
          if (cancelled) return
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await replaceDelegateCache(list.id, data.delegates as any)
        } catch {
          // Offline/transient -- that list's existing cached roster (if any)
          // stays in use; never blocks caching the remaining lists.
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, stationToken, assignedLists.map((l) => l.id).join(",")])

  // Shell owns draining every assigned list's scan queue -- a scan made on
  // list A that's still pending when the volunteer switches to list B must
  // still sync, even though KioskCheckinScreen unmounts on switch (see
  // KioskCheckinScreen's externallyDriven prop, which disables its own
  // per-list poll when rendered under this shell).
  useEffect(() => {
    let cancelled = false
    async function drainAll() {
      for (const list of assignedLists) {
        if (cancelled) return
        try {
          await drainScanQueue(list.id, eventId, stationToken, () => {}, () => {})
        } catch (err) {
          Sentry.captureException(err, { tags: { module: "kiosk-station-shell" }, extra: { listId: list.id } })
        }
      }
    }
    if (typeof navigator !== "undefined" && navigator.onLine) void drainAll()
    window.addEventListener("online", drainAll)
    const pollId = setInterval(drainAll, 20000)
    return () => {
      cancelled = true
      window.removeEventListener("online", drainAll)
      clearInterval(pollId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, stationToken, assignedLists.map((l) => l.id).join(",")])

  // Recompute open/closed and the closing-soon banner every 30s -- both are
  // pure functions of the device clock, not of any fetched data.
  useEffect(() => {
    const tick = setInterval(() => forceTick((n) => n + 1), 30000)
    return () => clearInterval(tick)
  }, [])

  const activeList = assignedLists.find((l) => l.id === activeListId) || null

  if (activeList) {
    return (
      <KioskCheckinScreen
        key={activeList.id}
        eventId={eventId}
        listId={activeList.id}
        stationToken={stationToken}
        stationName={stationName}
        mode={mode}
        autoPrintBadge={autoPrintBadge}
        printStationId={printStationId}
        badgeTemplate={badgeTemplate}
        printSettings={printSettings}
        printMode={printMode}
        externallyDriven
        onSwitchList={() => setActiveListId(null)}
        closingSoonMinutes={minutesUntilClose(activeList)}
      />
    )
  }

  return (
    <KioskMenuScreen
      stationName={stationName}
      lists={assignedLists}
      onSelect={(list) => {
        if (computeListState(list) !== "open") return
        setActiveListId(list.id)
      }}
    />
  )
}

function listSubline(list: AssignedList, now: Date): string {
  const state = computeListState(list, now)
  if (state === "closed") {
    if (list.kiosk_force_state === "closed") return "Closed"
    if (list.kiosk_opens_at && now < new Date(list.kiosk_opens_at)) {
      return `Opens ${new Date(list.kiosk_opens_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    }
    if (list.kiosk_closes_at) {
      return `Ended ${new Date(list.kiosk_closes_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    }
    return "Closed"
  }
  if (list.kiosk_closes_at) {
    return `Closes ${new Date(list.kiosk_closes_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
  }
  return "Open"
}

function KioskMenuScreen({
  stationName,
  lists,
  onSelect,
}: {
  stationName: string
  lists: AssignedList[]
  onSelect: (list: AssignedList) => void
}) {
  const now = new Date()
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <div className="bg-gray-800/50 border-b border-white/10 px-4 sm:px-8 py-4 sm:py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">{stationName}</h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">Choose what you&apos;re here for</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-xl mx-auto space-y-3">
          {lists.length === 0 && (
            <p className="text-center text-gray-400 text-sm">No lists assigned to this station yet.</p>
          )}
          {lists.map((list) => {
            const open = computeListState(list, now) === "open"
            return (
              <button
                key={list.id}
                type="button"
                disabled={!open}
                onClick={() => onSelect(list)}
                className={`w-full text-left rounded-2xl border-2 p-5 transition-all flex items-center justify-between gap-4 ${
                  open
                    ? "border-white/10 bg-gray-800/50 hover:border-emerald-500/50"
                    : "border-white/5 bg-gray-900/50 opacity-60 cursor-not-allowed"
                }`}
              >
                <span className="text-lg font-semibold text-white">{list.name}</span>
                <span className={`text-xs font-medium shrink-0 ${open ? "text-emerald-400" : "text-gray-500"}`}>
                  {listSubline(list, now)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rewire `/kiosk-station/[token]/page.tsx`**

Replace the file's server component body (the `select` at line 37 and the final `return` at lines 84-97) — the station lookup, revoked/mode checks, and print-station resolution stay exactly as they are today; only the list resolution and final render change:

```typescript
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, name, event_id, mode, print_station_id, auto_print_badge, revoked_at")
    .eq("access_token_hash", hashStationToken(token))
    .maybeSingle()

  if (error) {
    Sentry.captureException(error, { tags: { route: "kiosk-station/[token]" } })
    return <StationLookupError />
  }

  if (!station || station.revoked_at || (station.mode !== "checkin" && station.mode !== "checkin_and_print")) {
    return <StationNotFound />
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: joinRows } = await (supabase as any)
    .from("kiosk_station_lists")
    .select("checkin_list_id")
    .eq("station_id", station.id)

  const listIds = (joinRows || []).map((r: any) => r.checkin_list_id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lists } = listIds.length > 0
    ? await (supabase as any)
        .from("checkin_lists")
        .select("id, name, kiosk_opens_at, kiosk_closes_at, kiosk_force_state")
        .in("id", listIds)
    : { data: [] }

  if (!lists || lists.length === 0) {
    return <StationListRemoved />
  }
```

(Drop `list_id` entirely from the initial `select` — it's no longer read on this path — and delete the old `if (!station.list_id) return <StationListRemoved />` check, replaced by the `lists.length === 0` check above.)

Replace the final render (lines 84-97):

```typescript
  return (
    <KioskStationShell
      eventId={station.event_id}
      stationToken={token}
      stationName={station.name}
      mode={station.mode}
      autoPrintBadge={station.auto_print_badge}
      printStationId={station.print_station_id || undefined}
      badgeTemplate={badgeTemplate || undefined}
      printSettings={printSettings || undefined}
      printMode={printMode}
      initialLists={lists}
    />
  )
```

Update the import line at the top from `import { KioskCheckinScreen } from "@/components/kiosk/KioskCheckinScreen"` to `import { KioskStationShell } from "@/components/kiosk/KioskStationShell"`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/kiosk/KioskStationShell.test.tsx && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/kiosk/KioskStationShell.tsx src/components/kiosk/KioskStationShell.test.tsx "src/app/kiosk-station/[token]/page.tsx"
git commit -m "feat(kiosk): add KioskStationShell menu + rewire /kiosk-station/[token] to multi-list"
```

---

### Task 11: Admin UI — `kiosk-stations/page.tsx` multi-select list picker

**Files:**
- Modify: `src/app/events/[eventId]/kiosk-stations/page.tsx`

**Interfaces:**
- Consumes: `Checkbox` from `@/components/ui/checkbox`, `Popover`/`PopoverTrigger`/`PopoverContent` from `@/components/ui/popover` (both already present in this repo — no new dependency).
- Reuses: the `/api/kiosk-stations` `list_ids: string[]` contract from Task 5.

- [ ] **Step 1: Update the `KioskStation` type and state**

Replace `list_id: string | null` in the `KioskStation` type (line 31) with `list_ids: string[]`.

Replace `newListId`/`setNewListId` (lines 65) with `newListIds: string[]` / `setNewListIds`, initialized to `[]`.

- [ ] **Step 2: Update `handleCreate` (lines 112-144)**

Replace `list_id: newListId` in the POST body with `list_ids: newListIds`, and the `if (!newName.trim() || !newListId) return` guard with `if (!newName.trim() || newListIds.length === 0) return`. Reset `setNewListIds([])` instead of `setNewListId("")` in the success branch.

- [ ] **Step 3: Replace `handleReassignList` with `handleReassignLists`**

```typescript
  const handleReassignLists = async (station: KioskStation, listIds: string[]) => {
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
    await loadStations()
  }
```

- [ ] **Step 4: Replace the per-station `<Select>` for lists (lines 275-290) with a checkbox popover**

```tsx
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-xs max-w-52 justify-start truncate">
                      {station.list_ids.length > 0
                        ? station.list_ids.map((id) => lists.find((l) => l.id === id)?.name).filter(Boolean).join(", ")
                        : "No lists assigned"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 space-y-2">
                    {activeLists.map((list) => {
                      const checked = station.list_ids.includes(list.id)
                      return (
                        <label key={list.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) => {
                              const nextIds = next
                                ? [...station.list_ids, list.id]
                                : station.list_ids.filter((id) => id !== list.id)
                              if (nextIds.length === 0) {
                                toast.error("A station needs at least one assigned list")
                                return
                              }
                              handleReassignLists(station, nextIds)
                            }}
                          />
                          {list.name}
                        </label>
                      )
                    })}
                  </PopoverContent>
                </Popover>
```

Add the two imports at the top: `import { Checkbox } from "@/components/ui/checkbox"` and `import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"`.

- [ ] **Step 5: Update the "no list assigned" summary line (line 265) and the Create dialog's list picker (lines 343-357)**

Replace line 265's `{lists.find((l) => l.id === station.list_id)?.name || "No list assigned"}` with:

```tsx
                  {station.list_ids.map((id) => lists.find((l) => l.id === id)?.name).filter(Boolean).join(", ") || "No list assigned"}
```

Replace the Create dialog's single `<Select>` (lines 343-357) with the same checkbox-list pattern, backed by `newListIds`/`setNewListIds`:

```tsx
            <div>
              <label className="text-sm font-medium">Check-in lists</label>
              <div className="mt-1.5 space-y-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
                {activeLists.map((list) => (
                  <label key={list.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newListIds.includes(list.id)}
                      onCheckedChange={(checked) =>
                        setNewListIds(checked ? [...newListIds, list.id] : newListIds.filter((id) => id !== list.id))
                      }
                    />
                    {list.name}
                  </label>
                ))}
              </div>
            </div>
```

Update the Create button's `disabled` condition (line 405) from `!newListId` to `newListIds.length === 0`.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. (This page has no existing `.test.tsx` — matches the rest of this admin dashboard, which is verified manually per this project's established convention for dashboard pages.)

- [ ] **Step 7: Commit**

```bash
git add src/app/events/\[eventId\]/kiosk-stations/page.tsx
git commit -m "feat(kiosk): admin UI picks multiple lists per station via checkbox popover"
```

---

### Task 12: Admin UI — `checkin/lists/page.tsx` schedule fields

**Files:**
- Modify: `src/app/events/[eventId]/checkin/lists/page.tsx`
- Modify: `src/app/api/checkin-lists/route.ts` (POST lines 111-186, PUT lines 188-296)
- Modify: `src/app/api/checkin-lists/route.test.ts`

**Interfaces:**
- Produces: `/api/checkin-lists` POST/PUT accept `kiosk_opens_at?: string | null`, `kiosk_closes_at?: string | null`, `kiosk_force_state?: "open" | "closed" | null`.

- [ ] **Step 1: Write the failing API tests**

Add to `src/app/api/checkin-lists/route.test.ts` (mirroring whatever pattern the existing `starts_at`/`ends_at` tests already use in that file):

```typescript
  it("creates a list with kiosk schedule fields", async () => {
    // ... queue whatever this file's existing POST-success test queues,
    // plus assert the insert call includes kiosk_opens_at/kiosk_closes_at/
    // kiosk_force_state from the request body.
  })

  it("400s when kiosk_force_state is neither open, closed, nor null", async () => {
    const { PUT } = await import("./route")
    const res = await PUT(makeRequest("http://localhost/api/checkin-lists", {
      method: "PUT",
      body: { id: LIST_ID, kiosk_force_state: "sideways" },
    }))
    expect(res.status).toBe(400)
  })
```

(Match this exactly against the actual existing test file's helper functions/constants before writing — it wasn't fully re-read in this research pass; follow its established `mock`/`makeRequest` conventions, identical to every other route test in this codebase.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/checkin-lists/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement — POST (route.ts:115, 158-173)**

Add `kiosk_opens_at, kiosk_closes_at, kiosk_force_state` to the destructured body (line 115), validate `kiosk_force_state` the same way `list_purpose` already is (after the existing `list_purpose` check):

```typescript
    if (kiosk_force_state !== undefined && kiosk_force_state !== null && kiosk_force_state !== "open" && kiosk_force_state !== "closed") {
      return NextResponse.json({ error: "kiosk_force_state must be 'open', 'closed', or null" }, { status: 400 })
    }
```

Add the three fields to the `.insert({...})` call (after `ends_at,` at line 165):

```typescript
        kiosk_opens_at: kiosk_opens_at ?? null,
        kiosk_closes_at: kiosk_closes_at ?? null,
        kiosk_force_state: kiosk_force_state ?? null,
```

- [ ] **Step 4: Implement — PUT (route.ts:192, 198-203, 222-231)**

Add the three fields to the destructured body (line 192), add the same `kiosk_force_state` validation as POST, and add to `updateData` (after `if (ends_at !== undefined) updateData.ends_at = ends_at` at line 228):

```typescript
    if (kiosk_opens_at !== undefined) updateData.kiosk_opens_at = kiosk_opens_at
    if (kiosk_closes_at !== undefined) updateData.kiosk_closes_at = kiosk_closes_at
    if (kiosk_force_state !== undefined) updateData.kiosk_force_state = kiosk_force_state
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/app/api/checkin-lists/route.test.ts`
Expected: PASS

- [ ] **Step 6: Admin UI — add the fields to the form**

Add to the `CheckinList` type (after `ends_at?: string` at line 43):

```typescript
  kiosk_opens_at?: string
  kiosk_closes_at?: string
  kiosk_force_state?: "open" | "closed" | null
```

Add to `formData` initial state (after `ends_at: "",` at line 77) and to `resetForm()`'s reset object (after the same field at line 225):

```typescript
    kiosk_opens_at: "",
    kiosk_closes_at: "",
    kiosk_force_state: null as "open" | "closed" | null,
```

Add to the "Load selected list data into form" effect (after `ends_at: list.ends_at ? list.ends_at.slice(0, 16) : "",` at line 134):

```typescript
          kiosk_opens_at: list.kiosk_opens_at ? list.kiosk_opens_at.slice(0, 16) : "",
          kiosk_closes_at: list.kiosk_closes_at ? list.kiosk_closes_at.slice(0, 16) : "",
          kiosk_force_state: list.kiosk_force_state ?? null,
```

Add to `saveMutation`'s `payload` (after `ends_at: data.ends_at || null,` at line 151):

```typescript
        kiosk_opens_at: data.kiosk_opens_at || null,
        kiosk_closes_at: data.kiosk_closes_at || null,
        kiosk_force_state: data.kiosk_force_state,
```

Add a new card right after the existing "Schedule" card (after line 572, before the "Purpose" card comment at line 574):

```tsx
                {/* Kiosk schedule -- a completely separate system from the
                    Schedule card above (starts_at/ends_at is a soft warning
                    only, live today). This hard-gates whether the list is
                    even tappable on a shared kiosk's on-device menu. */}
                <div className="bg-card rounded-2xl border p-5 space-y-4">
                  <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                    <Monitor className="h-4 w-4" />
                    Kiosk Menu Schedule (Optional)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Controls whether this list is tappable on a shared kiosk station's menu — separate from the Schedule above.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Opens At</Label>
                      <Input
                        type="datetime-local"
                        value={formData.kiosk_opens_at}
                        onChange={(e) => setFormData({ ...formData, kiosk_opens_at: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Closes At</Label>
                      <Input
                        type="datetime-local"
                        value={formData.kiosk_closes_at}
                        onChange={(e) => setFormData({ ...formData, kiosk_closes_at: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["follow", "open", "closed"] as const).map((option) => {
                      const value = option === "follow" ? null : option
                      const isSelected = formData.kiosk_force_state === value
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setFormData({ ...formData, kiosk_force_state: value })}
                          className={cn(
                            "rounded-lg border-2 py-2 text-xs font-medium transition-all",
                            isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                          )}
                        >
                          {option === "follow" ? "Follow schedule" : option === "open" ? "Force open" : "Force closed"}
                        </button>
                      )
                    })}
                  </div>
                </div>
```

`Monitor` needs adding to the existing `lucide-react` import list at the top of the file.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/checkin-lists/route.ts src/app/api/checkin-lists/route.test.ts "src/app/events/[eventId]/checkin/lists/page.tsx"
git commit -m "feat(kiosk): admin UI for kiosk_opens_at/kiosk_closes_at/kiosk_force_state"
```

---

### Task 13: Apply migration + regenerate types + update CLAUDE.md

**Files:**
- None new — this is an operational task, not a code task.

- [ ] **Step 1: Confirm every other task is committed and its test suite is green**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: all clean, on this feature branch, not yet merged to `main`.

- [ ] **Step 2: Ask the user for explicit go-ahead**

Do not proceed past this point without it — this is the standing rule from `CLAUDE.md`'s Migration Pipeline section, honored throughout this project's history. State exactly what will be applied (this task's Task 1 migration file) and wait for an explicit yes.

- [ ] **Step 3: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration` (or the `claude_ai_Supabase` equivalent, whichever is connected) with the exact contents of `supabase/migrations/20260729_kiosk_shared_stations_scheduled_lists.sql`.

- [ ] **Step 4: Confirm pre/post state**

Before applying, note: current count of `kiosk_stations` rows with a non-null `list_id` (this is exactly how many `kiosk_station_lists` rows the backfill must produce). After applying, verify:
- `select count(*) from kiosk_station_lists` equals that pre-apply count.
- `select count(*) from checkin_lists where kiosk_opens_at is not null or kiosk_closes_at is not null or kiosk_force_state is not null` is `0` (every existing list is untouched — all three columns are new and null).

- [ ] **Step 5: Regenerate `database.types.ts`**

Use `mcp__supabase__generate_typescript_types` (or the CLI equivalent) and commit the regenerated file on its own.

- [ ] **Step 6: Update `CLAUDE.md`'s migration history**

Add an entry to the "Migration application history" list, matching the exact format of the existing entries (migration filename, what it does, applied date, explicit-go-ahead confirmation, pre/post counts from Step 4).

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/database.types.ts CLAUDE.md
git commit -m "chore(kiosk): regenerate database types after applying shared-stations migration; update migration history"
```

---

### Task 14: Manual hardware verification

**Files:** None — this is a manual, on-device task for the user, not something to execute in an agent session.

- [ ] Provision a station with 3 lists assigned (via the new checkbox popover) — confirm the on-device menu shows exactly those 3.
- [ ] Set one list's schedule so it's currently outside its window — confirm it's visible on the menu but not tappable, and shows the correct "opens/ended" sub-line.
- [ ] Set `kiosk_force_state = 'open'` on a list past its `kiosk_closes_at` — confirm it stays open and tappable.
- [ ] Set `kiosk_force_state = 'closed'` on a list inside its window — confirm it stays closed.
- [ ] Go offline on the device, wait past a list's `kiosk_closes_at` — confirm it closes on-device with no network activity.
- [ ] While offline, switch from an open list to a different open list — confirm the new list's roster is present and scanning still works.
- [ ] Scan a few check-ins on list A, switch to list B before they sync, confirm the queue drains untouched and all of list A's scans still sync.
- [ ] Confirm a station with no printer physically attached shows no print option anywhere, even when `mode` is `checkin_and_print`.
- [ ] Confirm the "Switch list" control's confirmation dialog appears and returning to the menu doesn't lose the printer connection state on the next list picked (mirrors the existing per-mount USB reconnect effect).
- [ ] Confirm a station credential cannot reach another event's lists (`list_id` query param for a foreign list against `/api/kiosk/delegates` returns 404).

---

## Self-Review

**Spec coverage:** Every numbered section of `docs/superpowers/specs/2026-07-29-kiosk-shared-stations-scheduled-lists-design.md` maps to a task — schema (Task 1), delegates/checkin authorization (Tasks 2-4), mode/printing (unchanged, verified in Task 14), open/closed logic (Task 6), menu screen (Task 10), wrong-list defence (Task 9's switch-list control + Task 10's persistent list name), client architecture (Tasks 9-10), offline behaviour (Tasks 8, 10), security (Tasks 3-4's membership checks), device clock (Task 14, ops-only), migration sequencing (Tasks 1, 13), acceptance tests (Task 14 exercises all 11).

**Placeholder scan:** No task defers real content to "later" or references unshown code; every task's code blocks are complete, not sketched. Task 12's test step is the one exception — it explicitly says to match the existing test file's conventions rather than inventing new ones sight-unseen, which is a deliberate hand-off of a mechanical detail, not a missing requirement.

**Type consistency:** `AssignedList`/`StationManifestList`/`ScheduledList` all carry the same three schedule fields (`kiosk_opens_at`, `kiosk_closes_at`, `kiosk_force_state`) with identical types across Tasks 6, 8, and 10. `resolveStationByToken`'s `KioskStationRow` is widened once (Task 7) to cover every field every caller (Tasks 3, 4, 7) needs, rather than three divergent shapes.
