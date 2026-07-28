# Kiosk Stage 3 — Real Station Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `getOrCreateDeviceId()`'s random client-side placeholder with a real, admin-provisioned `kiosk_stations` identity. An admin sets up a physical device once (name + target check-in list), mints it a token, and the device authenticates with that token going forward via a new `/kiosk-station/[token]` route — the underlying check-in list's own `access_token` never has to reach that device's browser.

**Architecture:** A new CRUD subsystem (`kiosk_stations` — schema already migrated in Stage 1, unused until now) with its own admin page and token-rotation API; a new public device-facing route (`/kiosk-station/[token]`) that resolves a station and renders the *existing* kiosk check-in UI (extracted into a shared component so both the old direct-URL path and the new station path use identical, already-reviewed logic); an additive extension to `/api/kiosk/delegates` and `/api/kiosk/checkin` accepting a `station_token` as an alternate credential; one new column (`checkin_records.station_id`) so a station's identity is actually visible server-side, not just locally.

**Tech Stack:** Next.js 16 App Router, Supabase admin client, Node's built-in `crypto` (SHA-256 hashing, no new package), Vitest, Sentry.

## Global Constraints

- No new npm packages.
- No empty `catch` blocks. Anything caught and not re-thrown must call `Sentry.captureException(error)` with a `tags`/`extra` context object.
- **Scope for this stage: `mode: 'checkin'` only.** The admin creation UI must not offer a mode selector — every station this stage creates has `mode: 'checkin'` hardcoded. `mode: 'print'` is schema-ready but not implemented here.
- **`exit_pin_hash`/`exit_pin_salt` stay unused.** No lockdown UX in this stage — that's Stage 4's job.
- **One additive migration is required** (`checkin_records.station_id`) — do not apply it without explicit user go-ahead at implementation time, per this project's standing rule. Commit the migration file; that's all this plan does with it.
- `station_token` is an **attribution mechanism, not an authorization gate**, when added to `/api/kiosk/checkin` — that route was never token-gated to begin with (Stage 1's own documented "bare unguessable UUID pair" trust model). A missing/invalid `station_token` must never block a check-in from completing; it only fails to attribute it to a station.
- `station_token` **is** an authorization credential on `/api/kiosk/delegates` — that route already requires a token today (Stage 1's Task 1: "the largest single PII export in the app"), and `station_token` is a second valid way to satisfy that same requirement, not a weaker one.
- `checkin_lists.access_token` must never be fetched, read, or transmitted to the browser on the `station_token` path, on either route — this is the entire point of the stage.
- Follow the reference eligibility pattern already established in `/api/kiosk/checkin/route.ts` and `/api/kiosk/delegates/route.ts` (Stage 2) exactly where reused — do not reinvent.
- Full design rationale: `docs/superpowers/specs/2026-07-27-kiosk-stage3-station-identity-design.md`.

---

### Task 1: Migration — `checkin_records.station_id`

**Files:**
- Create: `supabase/migrations/20260727_checkin_records_station_id.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: the `checkin_records.station_id` column Task 7 persists into and Task 1's own migration is the only schema change this whole stage needs (the `kiosk_stations` table itself already exists from Stage 1).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260727_checkin_records_station_id.sql

-- Kiosk Stage 3: real station identity. Attributes a check-in to the real,
-- admin-provisioned kiosk_stations row that performed it, instead of the
-- client-only getOrCreateDeviceId() placeholder that never reached the
-- server at all. Additive only.
alter table checkin_records
  add column if not exists station_id uuid references kiosk_stations(id) on delete set null;
```

- [ ] **Step 2: Commit — do NOT apply**

```bash
git add supabase/migrations/20260727_checkin_records_station_id.sql
git commit -m "docs(kiosk): add Stage 3 migration for checkin_records.station_id (not applied)"
```

Per this project's standing rule, this migration is committed only. It must not be applied via Supabase MCP or the SQL editor without the user's explicit go-ahead — flag this clearly when this task is reported complete.

---

### Task 2: Shared token helper + `kiosk_stations` base CRUD

**Files:**
- Create: `src/lib/kiosk-station-auth.ts`
- Create: `src/app/api/kiosk-stations/route.ts`
- Create: `src/app/api/kiosk-stations/route.test.ts`
- Create: `src/app/api/kiosk-stations/[id]/route.ts`
- Create: `src/app/api/kiosk-stations/[id]/route.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `export function newStationToken(): string` and `export function hashStationToken(token: string): string` from `kiosk-station-auth.ts` — Tasks 3, 6, and 7 all import these (one implementation, not four copies). `POST /api/kiosk-stations` → `201 { id, event_id, name, mode, list_id, created_at, access_token }` (plaintext token, returned exactly once). `GET /api/kiosk-stations?event_id=` → `200 { stations: Array<{ id, event_id, name, mode, list_id, last_seen_at, revoked_at, created_at }> }` (never `access_token_hash`). `PATCH /api/kiosk-stations/[id]` → updates `name`/`list_id`. `DELETE /api/kiosk-stations/[id]` → removes the row entirely (distinct from revoking its token — see Task 3).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/kiosk-station-auth.test.ts
import { describe, it, expect } from "vitest"
import { newStationToken, hashStationToken } from "./kiosk-station-auth"

describe("kiosk-station-auth", () => {
  it("generates a 48-char hex token", () => {
    const token = newStationToken()
    expect(token).toMatch(/^[0-9a-f]{48}$/)
  })

  it("generates a different token on each call", () => {
    expect(newStationToken()).not.toBe(newStationToken())
  })

  it("hashes deterministically -- the same token always hashes the same way", () => {
    const token = newStationToken()
    expect(hashStationToken(token)).toBe(hashStationToken(token))
  })

  it("hash is a 64-char hex SHA-256 digest, and never equals the plaintext", () => {
    const token = newStationToken()
    const hash = hashStationToken(token)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toBe(token)
  })
})
```

```typescript
// src/app/api/kiosk-stations/route.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"
const LIST_ID = "22222222-2222-2222-2222-222222222222"

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

describe("GET /api/kiosk-stations", () => {
  it("400s on a missing or invalid event_id", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations?event_id=not-a-uuid`))
    expect(res.status).toBe(400)
  })

  it("lists stations for the event, never exposing access_token_hash", async () => {
    mock.queueResponse("kiosk_stations", {
      data: [{ id: "st-1", event_id: EVENT_ID, name: "Front Desk", mode: "checkin", list_id: LIST_ID, last_seen_at: null, revoked_at: null, created_at: "2026-07-27T00:00:00Z" }],
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations?event_id=${EVENT_ID}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.stations).toHaveLength(1)
    expect(body.stations[0].access_token_hash).toBeUndefined()
    // Pins the security property: the select must not even ask for the hash.
    expect(mock.calls.some((c) => c.table === "kiosk_stations" && c.method === "select" && String(c.args[0]).includes("access_token_hash"))).toBe(false)
  })
})

describe("POST /api/kiosk-stations", () => {
  it("400s on a missing name", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", { method: "POST", body: { event_id: EVENT_ID, list_id: LIST_ID, name: "" } }))
    expect(res.status).toBe(400)
  })

  it("404s when the target list doesn't belong to this event", async () => {
    mock.queueResponse("checkin_lists", { data: { id: LIST_ID, event_id: "99999999-9999-9999-9999-999999999999" }, error: null })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", { method: "POST", body: { event_id: EVENT_ID, list_id: LIST_ID, name: "Front Desk" } }))
    expect(res.status).toBe(404)
  })

  it("creates a station and returns the plaintext token exactly once", async () => {
    mock.queueResponse("checkin_lists", { data: { id: LIST_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, name: "Front Desk", mode: "checkin", list_id: LIST_ID, created_at: "2026-07-27T00:00:00Z" },
      error: null,
    })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", { method: "POST", body: { event_id: EVENT_ID, list_id: LIST_ID, name: "Front Desk" } }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.access_token).toMatch(/^[0-9a-f]{48}$/)
    expect(body.mode).toBe("checkin")
    // The insert must store a hash, never the plaintext.
    const insertCall = mock.calls.find((c) => c.table === "kiosk_stations" && c.method === "insert")
    expect((insertCall!.args[0] as any).access_token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect((insertCall!.args[0] as any).access_token).toBeUndefined()
  })
})
```

```typescript
// src/app/api/kiosk-stations/[id]/route.test.ts
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

describe("PATCH /api/kiosk-stations/[id]", () => {
  it("404s when the station doesn't exist", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { PATCH } = await import("./route")
    const res = await PATCH(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "PATCH", body: { name: "New Name" } }), params())
    expect(res.status).toBe(404)
  })

  it("updates the name", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, name: "New Name" }, error: null })
    const { PATCH } = await import("./route")
    const res = await PATCH(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "PATCH", body: { name: "New Name" } }), params())
    expect(res.status).toBe(200)
  })
})

describe("DELETE /api/kiosk-stations/[id]", () => {
  it("404s when the station doesn't exist", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { DELETE } = await import("./route")
    const res = await DELETE(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "DELETE" }), params())
    expect(res.status).toBe(404)
  })

  it("deletes the row", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { DELETE } = await import("./route")
    const res = await DELETE(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "DELETE" }), params())
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/kiosk-station-auth.test.ts src/app/api/kiosk-stations/route.test.ts "src/app/api/kiosk-stations/[id]/route.test.ts"`
Expected: FAIL — none of these modules exist yet.

- [ ] **Step 3: Implement the shared helper**

```typescript
// src/lib/kiosk-station-auth.ts
import crypto from "crypto"

// One shared implementation for every route that mints or verifies a
// kiosk_stations access token (kiosk-stations CRUD, the access-token rotate
// endpoint, and the station_token auth path on /api/kiosk/delegates and
// /api/kiosk/checkin) -- not four copies.

// 48-char CSPRNG hex token -- twice checkin_lists'/print_stations' 24-char
// convention, since this credential is the sole authenticator for a public,
// no-login device route (/kiosk-station/[token]), not a secondary check
// layered on top of dashboard auth.
export function newStationToken(): string {
  return crypto.randomBytes(24).toString("hex")
}

// SHA-256 -- sufficient for a high-entropy random token (unlike a short PIN,
// this needs no brute-force-resistant KDF like scrypt). Only the hash is
// ever persisted; the plaintext token is returned to the caller exactly
// once, at mint time, and never stored anywhere retrievable again.
export function hashStationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}
```

- [ ] **Step 4: Implement the base CRUD routes**

```typescript
// src/app/api/kiosk-stations/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"
import { newStationToken, hashStationToken } from "@/lib/kiosk-station-auth"

// GET /api/kiosk-stations?event_id= -- admin dashboard list. Never selects
// access_token_hash; the hash is not the admin's business once minted, only
// the "is a token configured" fact (implicit here: every row always has one).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }

  const { error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  const supabase = await createAdminClient()
  const { data, error } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id, name, mode, list_id, last_seen_at, revoked_at, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Failed to load kiosk stations." }, { status: 500 })
  }
  return NextResponse.json({ stations: data || [] })
}

// POST /api/kiosk-stations -- create a station and mint its access token.
// mode is hardcoded "checkin" -- this stage never creates a "print"-mode
// station (see this plan's Global Constraints).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const eventId = body.event_id as string | undefined
  const name = (body.name as string | undefined)?.trim()
  const listId = body.list_id as string | undefined

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 })
  }
  if (!listId || !isValidUUID(listId)) {
    return NextResponse.json({ error: "A check-in list must be selected." }, { status: 400 })
  }

  const { error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  const supabase = await createAdminClient()

  // Confirm the list actually belongs to this event -- a station bound to a
  // list from a different event would be a real authorization hole, not
  // just bad data.
  const { data: list } = await (supabase as any)
    .from("checkin_lists")
    .select("id, event_id")
    .eq("id", listId)
    .maybeSingle()

  if (!list || list.event_id !== eventId) {
    return NextResponse.json({ error: "Check-in list not found for this event." }, { status: 404 })
  }

  const access_token = newStationToken()

  const { data: station, error } = await (supabase as any)
    .from("kiosk_stations")
    .insert({
      event_id: eventId,
      name,
      mode: "checkin",
      list_id: listId,
      access_token_hash: hashStationToken(access_token),
    })
    .select("id, event_id, name, mode, list_id, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to create kiosk station." }, { status: 500 })
  }

  // access_token is returned ONLY in this creation response -- it is never
  // retrievable again (only its hash is stored server-side). If lost, the
  // only recourse is Task 3's regenerate endpoint.
  return NextResponse.json({ ...station, access_token }, { status: 201 })
}
```

```typescript
// src/app/api/kiosk-stations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"

// PATCH /api/kiosk-stations/[id] -- rename and/or reassign the target list.
// Does NOT touch the access token -- see Task 3 for that.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createAdminClient()

  const { data: station, error: findErr } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id")
    .eq("id", id)
    .maybeSingle()

  if (findErr || !station) {
    return NextResponse.json({ error: "Kiosk station not found." }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(station.event_id, "checkin")
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim()
  }
  if (typeof body.list_id === "string") {
    if (!isValidUUID(body.list_id)) {
      return NextResponse.json({ error: "Invalid list." }, { status: 400 })
    }
    const { data: list } = await (supabase as any)
      .from("checkin_lists")
      .select("id, event_id")
      .eq("id", body.list_id)
      .maybeSingle()
    if (!list || list.event_id !== station.event_id) {
      return NextResponse.json({ error: "Check-in list not found for this event." }, { status: 404 })
    }
    updates.list_id = body.list_id
  }

  const { data, error } = await (supabase as any)
    .from("kiosk_stations")
    .update(updates)
    .eq("id", id)
    .select("id, event_id, name, mode, list_id")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to update kiosk station." }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/kiosk-stations/[id] -- remove the station entirely. Distinct
// from revoking its token (Task 3): this deletes the admin-facing record,
// not just its credential.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createAdminClient()

  const { data: station, error: findErr } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id")
    .eq("id", id)
    .maybeSingle()

  if (findErr || !station) {
    return NextResponse.json({ error: "Kiosk station not found." }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(station.event_id, "checkin")
  if (authError) return authError

  const { error } = await (supabase as any).from("kiosk_stations").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to delete kiosk station." }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/kiosk-station-auth.test.ts src/app/api/kiosk-stations/route.test.ts "src/app/api/kiosk-stations/[id]/route.test.ts"`
Expected: PASS (4/4 + 5/5 + 4/4).

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/lib/kiosk-station-auth.ts src/app/api/kiosk-stations/route.ts "src/app/api/kiosk-stations/[id]/route.ts"`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/kiosk-station-auth.ts src/lib/kiosk-station-auth.test.ts src/app/api/kiosk-stations/route.ts src/app/api/kiosk-stations/route.test.ts "src/app/api/kiosk-stations/[id]/route.ts" "src/app/api/kiosk-stations/[id]/route.test.ts"
git commit -m "feat(kiosk): add kiosk_stations CRUD API and shared token helper"
```

---

### Task 3: Access-token rotate/revoke endpoint

**Files:**
- Create: `src/app/api/kiosk-stations/[id]/access-token/route.ts`
- Create: `src/app/api/kiosk-stations/[id]/access-token/route.test.ts`

**Interfaces:**
- Consumes: `newStationToken`, `hashStationToken` from `src/lib/kiosk-station-auth.ts` (Task 2).
- Produces: `POST /api/kiosk-stations/[id]/access-token` → `200 { id, name, access_token }` (rotate — plaintext token returned once, hash stored). `DELETE /api/kiosk-stations/[id]/access-token` → `200 { success: true }` (revoke — sets `revoked_at`).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/api/kiosk-stations/[id]/access-token/route.test.ts
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

describe("POST /api/kiosk-stations/[id]/access-token", () => {
  it("404s when the station doesn't exist", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { POST } = await import("./route")
    const res = await POST(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/access-token`, { method: "POST" }), params())
    expect(res.status).toBe(404)
  })

  it("rotates the token, storing only a hash, and clears any prior revocation", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, name: "Front Desk" }, error: null })

    const { POST } = await import("./route")
    const res = await POST(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/access-token`, { method: "POST" }), params())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.access_token).toMatch(/^[0-9a-f]{48}$/)
    const updateCall = mock.calls.find((c) => c.table === "kiosk_stations" && c.method === "update")
    expect((updateCall!.args[0] as any).access_token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect((updateCall!.args[0] as any).revoked_at).toBeNull()
  })
})

describe("DELETE /api/kiosk-stations/[id]/access-token", () => {
  it("404s when the station doesn't exist", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { DELETE } = await import("./route")
    const res = await DELETE(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/access-token`, { method: "DELETE" }), params())
    expect(res.status).toBe(404)
  })

  it("sets revoked_at", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("kiosk_stations", { data: null, error: null })

    const { DELETE } = await import("./route")
    const res = await DELETE(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/access-token`, { method: "DELETE" }), params())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    const updateCall = mock.calls.find((c) => c.table === "kiosk_stations" && c.method === "update")
    expect((updateCall!.args[0] as any).revoked_at).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "src/app/api/kiosk-stations/[id]/access-token/route.test.ts"`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the route**

```typescript
// src/app/api/kiosk-stations/[id]/access-token/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { newStationToken, hashStationToken } from "@/lib/kiosk-station-auth"

// POST /api/kiosk-stations/[id]/access-token -- ROTATE: mint a fresh token,
// invalidating the old one immediately (a new hash overwrites the old one).
// The physical device must be re-provisioned -- open the new /kiosk-station
// URL -- to keep working; an already-open tab on the old token 401s at its
// next roster refresh (see Task 6).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createAdminClient()

  const { data: station, error: findErr } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id")
    .eq("id", id)
    .maybeSingle()

  if (findErr || !station) {
    return NextResponse.json({ error: "Kiosk station not found." }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(station.event_id, "checkin")
  if (authError) return authError

  const access_token = newStationToken()

  const { data, error } = await (supabase as any)
    .from("kiosk_stations")
    .update({
      access_token_hash: hashStationToken(access_token),
      revoked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, name")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to rotate access token." }, { status: 500 })
  }
  return NextResponse.json({ ...data, access_token })
}

// DELETE /api/kiosk-stations/[id]/access-token -- REVOKE: the station stops
// authenticating for /api/kiosk/delegates immediately (checked at the
// device's next page load / roster refresh, not mid-session -- same
// accepted trade-off as checkin_lists' own revoke, Stage 1).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createAdminClient()

  const { data: station, error: findErr } = await (supabase as any)
    .from("kiosk_stations")
    .select("event_id")
    .eq("id", id)
    .maybeSingle()

  if (findErr || !station) {
    return NextResponse.json({ error: "Kiosk station not found." }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(station.event_id, "checkin")
  if (authError) return authError

  const { error } = await (supabase as any)
    .from("kiosk_stations")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to revoke access." }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "src/app/api/kiosk-stations/[id]/access-token/route.test.ts"`
Expected: PASS (4/4).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "src/app/api/kiosk-stations/[id]/access-token/route.ts"`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/kiosk-stations/[id]/access-token/route.ts" "src/app/api/kiosk-stations/[id]/access-token/route.test.ts"
git commit -m "feat(kiosk): add kiosk station access-token rotate/revoke endpoint"
```

---

### Task 4: Admin UI for kiosk stations

**Files:**
- Create: `src/app/events/[eventId]/kiosk-stations/page.tsx`

**Interfaces:**
- Consumes: `GET /api/kiosk-stations`, `POST /api/kiosk-stations`, `PATCH`/`DELETE /api/kiosk-stations/[id]`, `POST`/`DELETE /api/kiosk-stations/[id]/access-token` (Tasks 2, 3). Reuses `QrImage` (`src/components/QrImage.tsx`) for the hand-off modal, matching `checkin/page.tsx`'s existing "Share with Staff" pattern.
- Produces: no exports consumed by other tasks — this is a leaf admin page. No automated test — this codebase's established convention for admin CRUD pages (`print-stations/page.tsx`, `checkin/lists/page.tsx`) is manual verification, not component tests; Task 10 covers this page's manual check.

- [ ] **Step 1: Implement the page**

```typescript
// src/app/events/[eventId]/kiosk-stations/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { QrImage } from "@/components/QrImage"
import { toast } from "sonner"
import { Plus, Copy, QrCode, RefreshCw, Ban, Trash2, Monitor } from "lucide-react"

type CheckinList = { id: string; name: string }
type KioskStation = {
  id: string
  event_id: string
  name: string
  mode: "checkin" | "print"
  list_id: string | null
  last_seen_at: string | null
  revoked_at: string | null
  created_at: string
}

function stationUrl(token: string) {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/kiosk-station/${token}`
}

function relativeLastSeen(iso: string | null) {
  if (!iso) return "Never connected"
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Active just now"
  if (mins < 60) return `Active ${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Active ${hours}h ago`
  return `Active ${Math.floor(hours / 24)}d ago`
}

export default function KioskStationsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [stations, setStations] = useState<KioskStation[]>([])
  const [lists, setLists] = useState<CheckinList[]>([])
  const [loading, setLoading] = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newListId, setNewListId] = useState("")
  const [creating, setCreating] = useState(false)

  // Hand-off modal: shows a freshly-minted plaintext token exactly once
  // (on create or regenerate) -- never re-fetchable afterward.
  const [handoff, setHandoff] = useState<{ name: string; token: string } | null>(null)

  const loadStations = async () => {
    const res = await fetch(`/api/kiosk-stations?event_id=${eventId}`)
    const data = await res.json()
    setStations(data.stations || [])
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      await Promise.all([
        loadStations(),
        fetch(`/api/checkin-lists?event_id=${eventId}`)
          .then((r) => r.json())
          .then((d) => setLists(d.lists || d || [])),
      ])
      setLoading(false)
    }
    load()
  }, [eventId])

  const handleCreate = async () => {
    if (!newName.trim() || !newListId) return
    setCreating(true)
    try {
      const res = await fetch("/api/kiosk-stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, name: newName.trim(), list_id: newListId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to create station")
        return
      }
      setShowCreate(false)
      setNewName("")
      setNewListId("")
      setHandoff({ name: data.name, token: data.access_token })
      await loadStations()
    } finally {
      setCreating(false)
    }
  }

  const handleRegenerate = async (station: KioskStation) => {
    const res = await fetch(`/api/kiosk-stations/${station.id}/access-token`, { method: "POST" })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to regenerate token")
      return
    }
    setHandoff({ name: station.name, token: data.access_token })
    await loadStations()
  }

  const handleRevoke = async (station: KioskStation) => {
    const res = await fetch(`/api/kiosk-stations/${station.id}/access-token`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to revoke station")
      return
    }
    toast.success(`${station.name} revoked`)
    await loadStations()
  }

  const handleDelete = async (station: KioskStation) => {
    const res = await fetch(`/api/kiosk-stations/${station.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to delete station")
      return
    }
    toast.success(`${station.name} deleted`)
    await loadStations()
  }

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(stationUrl(token))
    toast.success("Link copied")
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Kiosk Stations
          </h1>
          <p className="text-sm text-muted-foreground">
            Provision a physical device once — it authenticates with its own token from then on.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Station
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : stations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No kiosk stations yet.</p>
      ) : (
        <div className="space-y-3">
          {stations.map((station) => (
            <div key={station.id} className="border rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium">{station.name}</p>
                <p className="text-xs text-muted-foreground">
                  {lists.find((l) => l.id === station.list_id)?.name || "No list assigned"}
                  {" · "}
                  {station.revoked_at ? "Revoked" : relativeLastSeen(station.last_seen_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => handleRegenerate(station)}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  New Token
                </Button>
                {!station.revoked_at && (
                  <Button variant="outline" size="sm" onClick={() => handleRevoke(station)}>
                    <Ban className="h-4 w-4 mr-1" />
                    Revoke
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleDelete(station)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Kiosk Station</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Front Desk Tablet" />
            </div>
            <div>
              <label className="text-sm font-medium">Check-in list</label>
              <Select value={newListId} onValueChange={setNewListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={creating || !newName.trim() || !newListId} className="w-full">
              Create Station
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hand-off modal -- the ONLY place the plaintext token is ever shown */}
      <Dialog open={!!handoff} onOpenChange={() => setHandoff(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{handoff?.name} — Set Up This Device</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Open this link on the tablet, then "Add to Home Screen". This is the only time this link is shown —
              if lost, use "New Token" to generate a replacement.
            </p>
            {handoff && (
              <>
                <div className="flex justify-center">
                  <QrImage value={stationUrl(handoff.token)} size={192} />
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={stationUrl(handoff.token)} className="font-mono text-xs" />
                  <Button variant="outline" onClick={() => copyLink(handoff.token)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

Confirmed: `src/components/ui/dialog.tsx` and `src/components/ui/select.tsx` both exist in this codebase with the exact export names used above (standard shadcn components, already used in `print-stations/page.tsx`). Also confirmed: `GET /api/checkin-lists?event_id=` returns a bare array (`NextResponse.json(listsWithStats)`, `src/app/api/checkin-lists/route.ts:104`), not `{ lists: [...] }` — the `d.lists || d || []` fallback above already handles this correctly (`d.lists` is `undefined` on an array, so it falls through to `d`), so no change is needed there, but do not "simplify" it to `d.lists || []` — that would break on the real bare-array response.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "src/app/events/[eventId]/kiosk-stations/page.tsx"`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/events/[eventId]/kiosk-stations/page.tsx"
git commit -m "feat(kiosk): add admin UI for provisioning kiosk stations"
```

---

### Task 5: Extract the kiosk check-in screen into a shared component

**Files:**
- Create: `src/components/kiosk/KioskCheckinScreen.tsx`
- Modify: `src/app/kiosk/[eventId]/[listId]/page.tsx`
- Modify: `src/lib/kiosk-sync-worker.ts`

**Interfaces:**
- Consumes: nothing new — this is a pure extraction of Task 1/2 Stage 1/2 logic, unchanged in substance.
- Produces: `export function KioskCheckinScreen(props: { eventId: string; listId: string; token?: string; stationToken?: string }): JSX.Element` — Task 8 (`/kiosk-station/[token]/page.tsx`) renders this directly. `drainScanQueue`'s signature gains a new third parameter, `stationToken: string | undefined`, consumed by both this component and Task 8's resolved station identity.

**This is a refactor, not a rewrite — read the current file in full before touching it, and verify every line of JSX/logic below is preserved exactly except the specific auth-related lines called out.** No automated test exists for this component today (a big client page; this codebase's established convention, matching Stage 1/2, is manual verification for kiosk client pages — Task 10 covers it) — your own careful diff review against the current file is what stands in for a test here.

- [ ] **Step 1: Read the current file in full**

Read `src/app/kiosk/[eventId]/[listId]/page.tsx` completely before proceeding — do not work from memory or from this plan's excerpts below. Confirm every line this task references still matches; if the live file has drifted from what's described here, follow the live file's actual content and adapt these instructions accordingly rather than blindly applying a stale patch.

- [ ] **Step 2: Move the file, renaming the component and changing its signature**

`git mv "src/app/kiosk/[eventId]/[listId]/page.tsx" src/components/kiosk/KioskCheckinScreen.tsx` (create the `src/components/kiosk/` directory if it doesn't exist).

In the moved file, apply these exact changes:

**Remove** the `useParams`/`useSearchParams` import (no longer needed — `eventId`, `listId`, `token`, `stationToken` all arrive as props now):
```typescript
import { useParams, useSearchParams } from "next/navigation"
```

**Add**, in its place, nothing (the import is deleted, not replaced) — but the `newId` import from `@/lib/kiosk-offline-store` and every other existing import stays exactly as-is.

**Replace** the component's opening (`export default function KioskPage() {` through the `token` line):
```typescript
export default function KioskPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const listId = params.listId as string
  const supabase = createClient()

  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
```
with:
```typescript
interface KioskCheckinScreenProps {
  eventId: string
  listId: string
  // Exactly one of these two is ever provided by a caller. `token` is a
  // checkin_lists.access_token (the original direct-URL path, Stage 1/2 --
  // Task 6 admin links). `stationToken` is a kiosk_stations token (Stage 3 --
  // the /kiosk-station/[token] route never passes the underlying list's own
  // token to this component at all).
  token?: string
  stationToken?: string
}

export function KioskCheckinScreen({ eventId, listId, token = "", stationToken }: KioskCheckinScreenProps) {
  const supabase = createClient()
```

**Replace** every remaining `if (!token)` truthiness check that gates "do we have ANY credential" with `if (!token && !stationToken)` — there are exactly two: the top of `refreshFromServer` (`if (!token) return`) and the top of `bootstrap` (`if (!token) { ... setCacheError(...) ... return }`). Do not touch the OTHER `token` reference inside the fetch URL (next change, below) or anything else — only these two early-return guards.

**Replace** the roster-fetch URL construction inside `refreshFromServer`:
```typescript
        const res = await fetch(
          `/api/kiosk/delegates?event_id=${encodeURIComponent(eventId)}&token=${encodeURIComponent(token)}`
        )
```
with:
```typescript
        const authParam = token
          ? `token=${encodeURIComponent(token)}`
          : `station_token=${encodeURIComponent(stationToken!)}`
        const res = await fetch(
          `/api/kiosk/delegates?event_id=${encodeURIComponent(eventId)}&${authParam}`
        )
```

**Replace** the bootstrap effect's dependency array:
```typescript
  }, [eventId, listId, token])
```
with:
```typescript
  }, [eventId, listId, token, stationToken])
```

**Replace** `syncNow`'s `drainScanQueue` call:
```typescript
      const { remaining } = await drainScanQueue(
        listId,
        eventId,
        () => {},
        () => {}
      )
```
with:
```typescript
      const { remaining } = await drainScanQueue(
        listId,
        eventId,
        stationToken,
        () => {},
        () => {}
      )
```

**Replace** `syncNow`'s `useCallback` dependency array:
```typescript
  }, [eventId, listId])
```
(the one immediately closing `syncNow`, not `bootstrap`'s effect above it — confirm by context, there are two `[eventId, listId]`-shaped arrays in this file before your edits, one per effect/callback)
with:
```typescript
  }, [eventId, listId, stationToken])
```

Everything else in the file — every other line of state, every effect, `handleCheckin`, `handleEmailBadge`, `handleWhatsappBadge`, `handleRegChange`, `handleKeyDown`, `formatDate`, and the entire JSX return (both the success/error screen and the scan/entry screen) — is copied verbatim, unchanged.

- [ ] **Step 3: Rewrite the original page as a thin wrapper**

```typescript
// src/app/kiosk/[eventId]/[listId]/page.tsx
"use client"

import { useParams, useSearchParams } from "next/navigation"
import { KioskCheckinScreen } from "@/components/kiosk/KioskCheckinScreen"

export default function KioskPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  return (
    <KioskCheckinScreen
      eventId={params.eventId as string}
      listId={params.listId as string}
      token={searchParams.get("token") ?? ""}
    />
  )
}
```

- [ ] **Step 4: Update `drainScanQueue`'s signature in `kiosk-sync-worker.ts`**

Replace the function signature:
```typescript
export async function drainScanQueue(
  listId: string,
  eventId: string,
  onSynced: (entry: ScanLogEntry, response: unknown) => void,
  onConflict: (entry: ScanLogEntry, response: unknown) => void
): Promise<{ synced: number; conflicted: number; remaining: number }> {
```
with:
```typescript
export async function drainScanQueue(
  listId: string,
  eventId: string,
  // Stage 3: when this device was provisioned via /kiosk-station/[token],
  // this is that station's own token -- forwarded so the server can attribute
  // each synced check-in to a real kiosk_stations row (see checkin/route.ts).
  // undefined for the original direct-URL (checkin_lists.access_token) path,
  // where there is no station to attribute to.
  stationToken: string | undefined,
  onSynced: (entry: ScanLogEntry, response: unknown) => void,
  onConflict: (entry: ScanLogEntry, response: unknown) => void
): Promise<{ synced: number; conflicted: number; remaining: number }> {
```

Replace the POST body construction inside the loop:
```typescript
        body: JSON.stringify({
          event_id: eventId,
          checkin_list_id: listId,
          registration_id: entry.registration_id,
          search: entry.delegate_code,
          scan_id: entry.scan_id,
        }),
```
with:
```typescript
        body: JSON.stringify({
          event_id: eventId,
          checkin_list_id: listId,
          registration_id: entry.registration_id,
          search: entry.delegate_code,
          scan_id: entry.scan_id,
          ...(stationToken && { station_token: stationToken }),
        }),
```

- [ ] **Step 5: Run the existing test suite to confirm nothing broke**

Run: `npx vitest run src/lib/kiosk-sync-worker.test.ts`
Expected: PASS (3/3) — this file only tests `computeBackoffMs`, unaffected by the signature change (it doesn't call `drainScanQueue` directly).

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/kiosk/KioskCheckinScreen.tsx "src/app/kiosk/[eventId]/[listId]/page.tsx" src/lib/kiosk-sync-worker.ts`
Expected: no new errors. Pay particular attention to any type error on `stationToken!` (the non-null assertion in the roster-fetch URL construction) — it is safe there only because the surrounding `token ? ... : ...` ternary's else-branch is only reached when `token` is falsy, and the component's only two callers (Task 3's wrapper, always passing a `token`; Task 8, always passing a `stationToken`) guarantee at least one is always present — if the typechecker still complains, do not silently add a runtime fallback that masks a real caller bug; report it instead.

- [ ] **Step 7: Self-review**

Diff the new `KioskCheckinScreen.tsx` against `git show HEAD:src/app/kiosk/\[eventId\]/\[listId\]/page.tsx` (the pre-move version) and confirm the ONLY differences are: the import removal, the props interface + signature change, the two `!token` → `!token && !stationToken` guards, the fetch URL construction, the two dependency array additions, and the `drainScanQueue` call's new argument. Every other line — especially the entire JSX return block — must be byte-identical. This component has already been through two full whole-branch reviews (Stage 1, Stage 2); an incidental change here would be re-introducing risk into already-hardened code for no reason.

- [ ] **Step 8: Commit**

```bash
git add src/components/kiosk/KioskCheckinScreen.tsx "src/app/kiosk/[eventId]/[listId]/page.tsx" src/lib/kiosk-sync-worker.ts
git commit -m "refactor(kiosk): extract KioskCheckinScreen so /kiosk-station can reuse it"
```

---

### Task 6: `station_token` support on `/api/kiosk/delegates`

**Files:**
- Modify: `src/app/api/kiosk/delegates/route.ts`
- Modify: `src/app/api/kiosk/delegates/route.test.ts`

**Interfaces:**
- Consumes: `hashStationToken` from `src/lib/kiosk-station-auth.ts` (Task 2).
- Produces: `GET /api/kiosk/delegates` now also accepts `?station_token=` as an alternative to `?token=` — Task 5's `KioskCheckinScreen` (via Task 8's station-provisioned path) is the consumer.

- [ ] **Step 1: Write the new failing tests**

Add these cases to the existing `src/app/api/kiosk/delegates/route.test.ts` (read the current file first — do not remove or restructure any existing test; these are additions):

```typescript
  it("401s when station_token doesn't resolve to any station", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "bad-token" })))
    expect(res.status).toBe(401)
  })

  it("401s when the station is revoked", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", list_id: LIST_ID, revoked_at: "2026-01-01T00:00:00Z" },
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "some-token" })))
    expect(res.status).toBe(401)
  })

  it("404s when the station's event doesn't match", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: "99999999-9999-9999-9999-999999999999", mode: "checkin", list_id: LIST_ID, revoked_at: null },
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "some-token" })))
    expect(res.status).toBe(404)
  })

  it("resolves the roster via a valid station_token without ever querying checkin_lists.access_token", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", list_id: LIST_ID, revoked_at: null },
      error: null,
    })
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("registrations", { data: [], error: null })

    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "some-token" })))

    expect(res.status).toBe(200)
    // Pins the security property: the checkin_lists lookup on this path must
    // never filter by access_token -- the list's own token is not part of
    // this request at all.
    expect(mock.calls.some((c) => c.table === "checkin_lists" && c.method === "eq" && c.args[0] === "access_token")).toBe(false)
    expect(mock.calls.some((c) => c.table === "checkin_lists" && c.method === "eq" && c.args[0] === "id" && c.args[1] === LIST_ID)).toBe(true)
  })
```

Update the `url()` helper (if it only currently builds a `token` param) to accept an arbitrary params object — check its current implementation; it likely already does (`new URLSearchParams(params).toString()`), in which case no change is needed and `station_token` just passes through as any other key.

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/app/api/kiosk/delegates/route.test.ts`
Expected: existing tests still PASS; the 4 new ones FAIL (no `station_token` handling exists yet).

- [ ] **Step 3: Implement the change**

Read the current file in full first (it has drifted across Stage 2's two fix waves — work from what's actually there, not from an older snapshot). Replace the parameter-reading and list-lookup section:

```typescript
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
```

with:

```typescript
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")
  const token = searchParams.get("token")
  const stationToken = searchParams.get("station_token")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }
  if (!token && !stationToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 })
  }

  try {
    const supabase = await createAdminClient()

    let list: any = null
    let listLookupError: any = null

    if (stationToken) {
      // Stage 3: station_token resolves a kiosk_stations row -> list_id,
      // then looks the list up BY ID -- never by its own access_token, which
      // this request never carries and this route never needs to see.
      const { data: station, error: stationLookupError } = await (supabase as any)
        .from("kiosk_stations")
        .select("id, event_id, mode, list_id, revoked_at")
        .eq("access_token_hash", hashStationToken(stationToken))
        .maybeSingle()

      if (stationLookupError) {
        Sentry.captureException(stationLookupError, { tags: { route: "kiosk/delegates" }, extra: { eventId } })
        return NextResponse.json({ error: "Something went wrong looking up this station." }, { status: 503 })
      }
      if (!station || station.revoked_at || station.mode !== "checkin" || !station.list_id) {
        return NextResponse.json({ error: "Invalid access token." }, { status: 401 })
      }
      if (station.event_id !== eventId) {
        return NextResponse.json({ error: "Check-in list not found." }, { status: 404 })
      }

      const result = await (supabase as any)
        .from("checkin_lists")
        .select("id, event_id, list_purpose, ticket_type_ids, addon_ids")
        .eq("id", station.list_id)
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

    if (listLookupError) {
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
```

Add the import at the top of the file:
```typescript
import { hashStationToken } from "@/lib/kiosk-station-auth"
```

Everything below this point in the file (the `collection`-purpose short-circuit, the eligibility filtering, the paginated roster fetch, the response) is unchanged — it already operates on `list` and doesn't care which path produced it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/kiosk/delegates/route.test.ts`
Expected: PASS, all tests (existing + new 4).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/app/api/kiosk/delegates/route.ts`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/kiosk/delegates/route.ts src/app/api/kiosk/delegates/route.test.ts
git commit -m "feat(kiosk): accept station_token as an alternate credential on /api/kiosk/delegates"
```

---

### Task 7: `station_token` attribution on `/api/kiosk/checkin`

**Files:**
- Modify: `src/app/api/kiosk/checkin/route.ts`
- Modify: `src/app/api/kiosk/checkin/route.test.ts`

**Interfaces:**
- Consumes: `hashStationToken` from `src/lib/kiosk-station-auth.ts` (Task 2).
- Produces: `checkin_records.station_id` gets populated when a valid `station_token` is present in the request (requires Task 1's migration to actually be applied before this has any visible effect in the database — the code change itself does not depend on the migration being applied yet to typecheck/test correctly, since the insert simply passes `station_id: null` harmlessly against the column once it exists, or would error only if the column is entirely absent — confirm this by checking whether `station_id` needs to be omitted from the insert object entirely when null, or if `station_id: null` is safe to always include; prefer always including it, letting the column accept null, since that's simpler and matches how other optional fields already behave in this codebase).

- [ ] **Step 1: Write the new failing tests**

Add these cases to the existing `src/app/api/kiosk/checkin/route.test.ts` (read the current file first — this is a large, twice-reviewed test suite; add to it, don't restructure it):

```typescript
  it("persists station_id on the insert when a valid station_token resolves", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", list_id: LIST_ID, revoked_at: null },
      error: null,
    })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "some-station-token" })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    const insertCall = mock.calls.find((c) => c.table === "checkin_records" && c.method === "insert")
    expect((insertCall!.args[0] as any).station_id).toBe("st-1")
  })

  it("never blocks a check-in when station_token is present but doesn't resolve", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", { data: null, error: null }) // station_token doesn't resolve
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "bad-token" })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    const insertCall = mock.calls.find((c) => c.table === "checkin_records" && c.method === "insert")
    expect((insertCall!.args[0] as any).station_id).toBeNull()
  })
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/app/api/kiosk/checkin/route.test.ts`
Expected: existing tests still PASS; the 2 new ones FAIL.

- [ ] **Step 3: Implement the change**

Read the current file in full first. Add the import:
```typescript
import { hashStationToken } from "@/lib/kiosk-station-auth"
```

Add `stationToken` parsing alongside the existing body destructuring:
```typescript
    const scanId = body.scan_id as string | undefined
```
becomes:
```typescript
    const scanId = body.scan_id as string | undefined
    const stationToken = body.station_token as string | undefined
```

After the existing scan/event/list/registration validation block (right before the `scan_id` replay check begins), add the station resolution:

```typescript
    // Stage 3: resolve station_id for attribution only -- this route was
    // never token-gated (see the header comment above), so a station_token
    // that's absent, malformed, revoked, or simply doesn't resolve must
    // NEVER block a check-in from completing. It only fails to attribute it
    // to a station.
    let stationId: string | null = null
    if (stationToken) {
      const { data: station } = await (supabase as any)
        .from("kiosk_stations")
        .select("id, event_id, mode, list_id, revoked_at")
        .eq("access_token_hash", hashStationToken(stationToken))
        .maybeSingle()

      if (
        station &&
        !station.revoked_at &&
        station.mode === "checkin" &&
        station.event_id === eventId &&
        station.list_id === checkinListId
      ) {
        stationId = station.id
      }
    }
```

Change `completeCheckin`'s signature to accept `stationId`:
```typescript
async function completeCheckin(
  supabase: any,
  registrationForResponse: any,
  registrationId: string,
  checkinListId: string,
  scanId: string,
  timeWindowWarning: string | null
): Promise<NextResponse> {
```
becomes:
```typescript
async function completeCheckin(
  supabase: any,
  registrationForResponse: any,
  registrationId: string,
  checkinListId: string,
  scanId: string,
  stationId: string | null,
  timeWindowWarning: string | null
): Promise<NextResponse> {
```

Update its insert call:
```typescript
    .insert({
      registration_id: registrationId,
      checkin_list_id: checkinListId,
      checked_in_at: now,
      checked_in_by: "Self check-in (kiosk)",
      scan_id: scanId,
    })
```
becomes:
```typescript
    .insert({
      registration_id: registrationId,
      checkin_list_id: checkinListId,
      checked_in_at: now,
      checked_in_by: "Self check-in (kiosk)",
      scan_id: scanId,
      station_id: stationId,
    })
```

Update both call sites (the fresh-resolution path and the temporary fallback path) to pass `stationId` in the right position:
```typescript
      return completeCheckin(supabase, publicRegistration, registration.id, checkinListId, scanId, timeWindowWarning)
```
becomes:
```typescript
      return completeCheckin(supabase, publicRegistration, registration.id, checkinListId, scanId, stationId, timeWindowWarning)
```
and:
```typescript
    return completeCheckin(supabase, fuzzyRegistration, fuzzyRegistration.id, checkinListId, scanId, timeWindowWarning)
```
becomes:
```typescript
    return completeCheckin(supabase, fuzzyRegistration, fuzzyRegistration.id, checkinListId, scanId, stationId, timeWindowWarning)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/kiosk/checkin/route.test.ts`
Expected: PASS, all tests (existing + new 2).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/app/api/kiosk/checkin/route.ts`
Expected: no new errors. If TypeScript complains about `station_id` not existing on the `checkin_records` insert shape, that's expected until Task 1's migration is actually applied and `database.types.ts` is regenerated — the route already casts `supabase as any` throughout (matching this file's established, pre-existing convention), so this should not surface as a type error in practice; if it does, do not silently work around it by loosening an unrelated type — report it.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/kiosk/checkin/route.ts src/app/api/kiosk/checkin/route.test.ts
git commit -m "feat(kiosk): attribute check-ins to a real kiosk station when station_token resolves"
```

---

### Task 8: Device-facing route — `/kiosk-station/[token]`

**Files:**
- Create: `src/app/kiosk-station/[token]/page.tsx`

**Interfaces:**
- Consumes: `KioskCheckinScreen` (Task 5), `hashStationToken` (Task 2).
- Produces: no exports consumed by other tasks — this is a leaf route.

- [ ] **Step 1: Implement the route**

```typescript
// src/app/kiosk-station/[token]/page.tsx
import { createAdminClient } from "@/lib/supabase/server"
import { hashStationToken } from "@/lib/kiosk-station-auth"
import { KioskCheckinScreen } from "@/components/kiosk/KioskCheckinScreen"

// Server component: resolves a kiosk_stations row from its token, entirely
// server-side, and renders the same KioskCheckinScreen every other kiosk
// entry point uses -- parameterized by this station's own token, never the
// underlying check-in list's own access_token, which this component never
// even fetches on this path (see KioskCheckinScreen and
// /api/kiosk/delegates's station_token branch).
export default async function KioskStationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createAdminClient()

  const { data: station } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id, mode, list_id, revoked_at")
    .eq("access_token_hash", hashStationToken(token))
    .maybeSingle()

  if (!station || station.revoked_at || station.mode !== "checkin") {
    return <StationNotFound />
  }
  if (!station.list_id) {
    return <StationListRemoved />
  }

  // Best-effort presence touch -- never blocks rendering on failure.
  await (supabase as any)
    .from("kiosk_stations")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", station.id)

  return <KioskCheckinScreen eventId={station.event_id} listId={station.list_id} stationToken={token} />
}

function StationNotFound() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md text-center text-white">
        <h1 className="text-2xl font-bold mb-2">Station Not Found</h1>
        <p className="text-gray-400">
          This kiosk station link is invalid or has been revoked. Please contact the event organizer.
        </p>
      </div>
    </div>
  )
}

function StationListRemoved() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md text-center text-white">
        <h1 className="text-2xl font-bold mb-2">Station Needs Reassignment</h1>
        <p className="text-gray-400">
          This station's check-in list was removed. Please contact an admin to assign a new one.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "src/app/kiosk-station/[token]/page.tsx"`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/kiosk-station/[token]/page.tsx"
git commit -m "feat(kiosk): add /kiosk-station/[token] device entry point"
```

---

### Task 9: Service worker — cover `/kiosk-station/`

**Files:**
- Modify: `public/app-sw.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by other tasks — this is the last functional change before manual verification.

Without this, a station-provisioned device reloading offline would regress to exactly the "generic offline fallback instead of mounting" bug Stage 1's Task 8 fixed — just on a new URL prefix that isn't in the shell-route list yet.

- [ ] **Step 1: Add the prefix**

In `public/app-sw.js`, replace:
```javascript
const SHELL_ROUTE_PREFIXES = ["/kiosk/"]
```
with:
```javascript
const SHELL_ROUTE_PREFIXES = ["/kiosk/", "/kiosk-station/"]
```

Read the surrounding file first to confirm this exact line still matches (it was introduced in Stage 1's Task 8 fix and hasn't been touched since, but confirm rather than assume) — no other change is needed in this file; every branch keyed off `isShellRoute(url.pathname)` or `SHELL_ROUTE_PREFIXES` automatically covers the new prefix once it's in this one array.

- [ ] **Step 2: Commit**

```bash
git add public/app-sw.js
git commit -m "fix(pwa): extend the offline shell cache to /kiosk-station/"
```

---

### Task 10: Manual hardware verification

No code changes — exercises Tasks 1-9's work end to end. No automated test replaces this (matching the established convention for IndexedDB/service-worker-touching kiosk work throughout Stages 1 and 2).

- [ ] **Step 1: Apply the migration**

Get explicit user go-ahead, then apply `supabase/migrations/20260727_checkin_records_station_id.sql` (via Supabase MCP or the SQL editor, per this project's standing process for one-off applies). Confirm `checkin_records.station_id` exists and is nullable.

- [ ] **Step 2: Provision a station**

From an event's admin dashboard, go to `/events/<eventId>/kiosk-stations`, create a station bound to a real check-in list with confirmed registrations, and confirm the hand-off modal shows a QR code and a copyable `/kiosk-station/<token>` link.

- [ ] **Step 3: Open the station link fresh**

Open that link on the actual tablet hardware (or a laptop browser). Confirm the kiosk UI renders exactly as it does on the original `/kiosk/[eventId]/[listId]?token=` path (same header, same input, same button states) — this is the same `KioskCheckinScreen` component, so it should be visually and behaviorally identical.

- [ ] **Step 4: Confirm the roster loads without the list's own token ever appearing**

Open DevTools → Network, confirm the `GET /api/kiosk/delegates` request carries `station_token=`, not `token=`, and confirm no request anywhere in the page's network activity ever references the underlying check-in list's `access_token` value.

- [ ] **Step 5: Scan and confirm attribution**

Perform a real check-in. Confirm the success screen renders as usual. In the database, confirm the resulting `checkin_records` row has `station_id` set to the provisioned station's real `id` — not null, not a random `getOrCreateDeviceId()`-style value.

- [ ] **Step 6: Confirm Regenerate and Revoke**

With the kiosk tab still open, use "New Token" on the admin page. Confirm the already-open tab keeps working until its next roster refresh (~5 min, or reload), then starts 401ing and shows the expired-link message — matching the accepted trade-off already established for `checkin_lists`' own token rotation. Repeat for Revoke.

- [ ] **Step 7: Confirm a removed/deactivated target list**

Set the station's list to one that gets deleted (or simulate via a direct DB check), reload `/kiosk-station/<token>`, and confirm the "Station Needs Reassignment" message renders instead of a crash or generic error.

- [ ] **Step 8: Record results**

Note the outcome of Steps 2-7 (pass/fail, any anomalies) in the PR description when this branch is opened for review.

---

## Self-Review Notes

- **Spec coverage:** §1 (admin provisioning) → Tasks 2, 3, 4. §2 (device-side resolution) → Task 8. §3 (auth without the list's token reaching the browser) → Tasks 5, 6. §4 (station identity visible server-side, new migration) → Tasks 1, 7. §5 (service worker) → Task 9. Manual verification → Task 10.
- **Out of scope, confirmed not touched:** `mode: 'print'` (no application code added for it — the admin UI hardcodes `mode: 'checkin'` and never offers a selector); `exit_pin_hash`/`exit_pin_salt` (no code reads or writes these columns anywhere in this plan); `feat/kiosk-launcher` (untouched, separate branch); any continuous heartbeat beyond the simple `last_seen_at` touch on page load / roster refresh.
- **Type consistency check:** `stationToken` is the same name across `KioskCheckinScreen`'s props, `drainScanQueue`'s new parameter, and `kiosk-sync-worker.ts`'s POST body construction. `station_token` (snake_case) is the consistent wire/body field name across `/api/kiosk/delegates`, `/api/kiosk/checkin`, and both client call sites. `hashStationToken`/`newStationToken` are imported from the single `src/lib/kiosk-station-auth.ts` source everywhere they're used (Tasks 2, 3, 6, 7, 8) — no duplicate implementations.
- **Migration sequencing:** Task 1's migration must exist (committed) before Task 7 is implemented, since Task 7's code assumes the column will exist once applied — but per the Global Constraints, the actual `alter table` is not run until Task 10 gets explicit go-ahead. This is intentional: the same pattern Stage 1 used for `scan_id` (send/persist code lands before the column is live, with no functional effect until the column exists — the insert simply writes `station_id: null`-compatible data that Postgres accepts once the column is there).
