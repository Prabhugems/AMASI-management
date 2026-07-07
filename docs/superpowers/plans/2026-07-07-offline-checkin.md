# Offline-Capable Check-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff keep checking in delegates/faculty on `/events/[eventId]/checkin/[listId]/scan` when the venue's connectivity is patchy, by matching scans against a locally cached attendee list and queuing failed check-ins for automatic sync once the network returns.

**Architecture:** A new client-side library (`src/lib/offline-checkin/`) backed by IndexedDB provides an attendee cache (for instant offline name-match) and a pending-actions queue (for check-ins that fail to reach the server). A React hook drains the queue automatically via the `online` event, a 10s interval, and a manual button. The existing `/api/checkin` route, DB schema, and duplicate-check-in handling (`route.ts:381-395`) are untouched — the queue relies on that route's existing idempotent behavior for safe replay.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query, native IndexedDB (no new runtime dependency), Vitest + fake-indexeddb (new dev-only test infra).

## Global Constraints

- No changes to `/api/checkin`, the DB schema, or `/events/[eventId]/checkin/attendees` (read-only page, no check-in action — left untouched).
- No Service Worker Background Sync API — rejected for lacking iOS Safari support. Sync is an in-page loop only.
- Attendee cache fetch loop has no fixed record-count cap: page until a short page is returned, with a 25,000-record safety ceiling (125 pages × 200/page) purely as an infinite-loop guard, not an expected limit. Largest list/event observed in production today is 273 registrations.
- Sync drains the queue oldest-first, one request at a time — never parallel. This ordering is required for the duplicate-check-in guarantee (first replay wins the real insert; every later replay of the same registration gets the server's existing idempotent `already_checked_in`/`already_checked_out` response, which counts as sync success).
- Recorded check-in timestamp is **sync time**, not scan time — confirmed acceptable. No `queued_at`-as-`checked_in_at` change to the server.
- A scan that fails locally-cache lookup (attendee not in the cached list) shows "not found" and is never queued — never fabricate a check-in for an unrecognized code.
- New test infrastructure (Vitest + fake-indexeddb) is scoped to `src/lib/offline-checkin/` only. The React hook and the scan-page UI integration are verified manually (browser), consistent with there being no existing component-test setup in this repo.
- `public/app-sw.js`'s "never cache HTML" rule (documented in its header comment, added after a real stale-chunk incident) is intentionally narrowed for exactly one route pattern (the scan page) in this plan, on your explicit confirmation. Every other route keeps the existing network-first + generic `/offline` fallback behavior unchanged.

---

## Task 1: Test infrastructure (Vitest + fake-indexeddb)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/offline-checkin/__smoke__.test.ts`

**Interfaces:**
- Produces: a working `npm test` command any later task's tests rely on.

- [ ] **Step 1: Install dependencies**

```bash
npm install -D vitest fake-indexeddb
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

- [ ] **Step 3: Add the `test` script**

In `package.json`, inside `"scripts"`, add:

```json
    "test": "vitest run",
```

(Keep existing scripts as-is; this is a new line alongside `dev`, `build`, `start`, `lint`, `db:check`, `db:setup`.)

- [ ] **Step 4: Write a smoke test**

Create `src/lib/offline-checkin/__smoke__.test.ts`:

```ts
import "fake-indexeddb/auto"
import { describe, expect, it } from "vitest"

describe("vitest + fake-indexeddb setup", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(2)
  })

  it("has a global indexedDB polyfill available", () => {
    expect(typeof indexedDB).toBe("object")
  })
})
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: `2 passed` (the smoke test file), no other test files yet.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/offline-checkin/__smoke__.test.ts
git commit -m "test: add vitest + fake-indexeddb test infrastructure"
```

---

## Task 2: IndexedDB wrapper + shared types

**Files:**
- Create: `src/lib/offline-checkin/types.ts`
- Create: `src/lib/offline-checkin/db.ts`
- Test: `src/lib/offline-checkin/db.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `CachedAttendee`, `PendingAction`, `CheckinRegistration`, `CheckinApiResult`.
  - `db.ts`: `STORE_ATTENDEES`, `STORE_PENDING`, `STORE_META` (string constants), `openDb(): Promise<IDBDatabase>`, `getAll<T>(storeName: string): Promise<T[]>`, `getOne<T>(storeName: string, key: string): Promise<T | undefined>`, `putAll(storeName: string, records: any[]): Promise<void>`, `putOne(storeName: string, record: any): Promise<void>`, `removeOne(storeName: string, key: string): Promise<void>`, `clearStore(storeName: string): Promise<void>`, `__resetForTests(): Promise<void>`.

- [ ] **Step 1: Write the shared types**

Create `src/lib/offline-checkin/types.ts`:

```ts
export interface CachedAttendee {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_institution: string | null
  ticket_type_name: string | null
  checked_in: boolean
}

export interface PendingAction {
  id: string
  registration_number: string
  action: "check_in" | "check_out"
  event_id: string
  checkin_list_id: string
  queued_at: number
  attempts: number
}

export interface CheckinRegistration {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_institution?: string | null
  ticket_types?: { id: string; name: string } | null
  checked_in: boolean
  checked_in_at?: string | null
}

export interface CheckinApiResult {
  success: boolean
  action?: "checked_in" | "checked_out" | "already_checked_in" | "already_checked_out"
  list_name?: string
  message?: string
  error?: string
  warning?: string
  registration?: CheckinRegistration
  pending?: boolean
}
```

- [ ] **Step 2: Write the failing test for the DB wrapper**

Create `src/lib/offline-checkin/db.test.ts`:

```ts
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import {
  STORE_ATTENDEES,
  STORE_PENDING,
  getAll,
  getOne,
  putAll,
  putOne,
  removeOne,
  clearStore,
  __resetForTests,
} from "./db"

beforeEach(async () => {
  await __resetForTests()
})

describe("db", () => {
  it("stores and retrieves a record by key", async () => {
    await putOne(STORE_ATTENDEES, { registration_number: "125F2048", attendee_name: "Jayanta Chakraborty" })
    const found = await getOne<{ registration_number: string; attendee_name: string }>(
      STORE_ATTENDEES,
      "125F2048"
    )
    expect(found?.attendee_name).toBe("Jayanta Chakraborty")
  })

  it("returns undefined for a missing key", async () => {
    const found = await getOne(STORE_ATTENDEES, "does-not-exist")
    expect(found).toBeUndefined()
  })

  it("putAll writes multiple records in one transaction", async () => {
    await putAll(STORE_ATTENDEES, [
      { registration_number: "A1", attendee_name: "Alice" },
      { registration_number: "A2", attendee_name: "Bob" },
    ])
    const all = await getAll(STORE_ATTENDEES)
    expect(all).toHaveLength(2)
  })

  it("removeOne deletes a record", async () => {
    await putOne(STORE_PENDING, { id: "p1", registration_number: "A1" })
    await removeOne(STORE_PENDING, "p1")
    const found = await getOne(STORE_PENDING, "p1")
    expect(found).toBeUndefined()
  })

  it("clearStore empties a store", async () => {
    await putAll(STORE_ATTENDEES, [{ registration_number: "A1", attendee_name: "Alice" }])
    await clearStore(STORE_ATTENDEES)
    const all = await getAll(STORE_ATTENDEES)
    expect(all).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- db.test.ts`
Expected: FAIL — `Cannot find module './db'` (file doesn't exist yet).

- [ ] **Step 4: Implement the DB wrapper**

Create `src/lib/offline-checkin/db.ts`:

```ts
const DB_NAME = "amasi-checkin"
const DB_VERSION = 1

export const STORE_ATTENDEES = "attendees"
export const STORE_PENDING = "pending_actions"
export const STORE_META = "meta"

let dbPromise: Promise<IDBDatabase> | null = null

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_ATTENDEES)) {
        db.createObjectStore(STORE_ATTENDEES, { keyPath: "registration_number" })
      }
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly")
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

export async function getOne<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly")
    const req = tx.objectStore(storeName).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function putAll(storeName: string, records: any[]): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite")
    records.forEach((r) => tx.objectStore(storeName).put(r))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function putOne(storeName: string, record: any): Promise<void> {
  return putAll(storeName, [record])
}

export async function removeOne(storeName: string, key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite")
    tx.objectStore(storeName).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearStore(storeName: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite")
    tx.objectStore(storeName).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Test-only: forces a fresh DB connection and wipes all data. Production code
// never calls this — it exists so each test starts from a clean database.
export async function __resetForTests(): Promise<void> {
  dbPromise = null
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- db.test.ts`
Expected: `5 passed`

- [ ] **Step 6: Commit**

```bash
git add src/lib/offline-checkin/types.ts src/lib/offline-checkin/db.ts src/lib/offline-checkin/db.test.ts
git commit -m "feat: add IndexedDB wrapper and shared types for offline check-in"
```

---

## Task 3: Attendee cache

**Files:**
- Create: `src/lib/offline-checkin/attendee-cache.ts`
- Test: `src/lib/offline-checkin/attendee-cache.test.ts`

**Interfaces:**
- Consumes: `db.ts`'s `getAll`, `getOne`, `putAll`, `putOne`, `clearStore`, `STORE_ATTENDEES`, `STORE_META`; `types.ts`'s `CachedAttendee`, `CheckinRegistration`.
- Produces: `refreshAttendeeCache(eventId: string, checkinListId: string): Promise<number>`, `findCachedAttendee(rawValue: string): Promise<CachedAttendee | undefined>`, `markCachedCheckin(registrationNumber: string, checkedIn: boolean): Promise<void>`, `reconcileCachedAttendee(registration: CheckinRegistration): Promise<void>`, `getCachedListName(checkinListId: string): Promise<string | undefined>`, `setCachedListName(checkinListId: string, name: string): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/offline-checkin/attendee-cache.test.ts`:

```ts
import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { __resetForTests, getAll, STORE_ATTENDEES } from "./db"
import {
  refreshAttendeeCache,
  findCachedAttendee,
  markCachedCheckin,
  reconcileCachedAttendee,
  getCachedListName,
  setCachedListName,
} from "./attendee-cache"

function makeApiRow(overrides: Partial<{ id: string; registration_number: string; attendee_name: string }> = {}) {
  return {
    id: overrides.id ?? "id-1",
    registration_number: overrides.registration_number ?? "125F0001",
    attendee_name: overrides.attendee_name ?? "Test Attendee",
    attendee_email: "test@example.com",
    attendee_institution: null,
    ticket_types: { id: "t1", name: "Faculty" },
    checked_in: false,
  }
}

beforeEach(async () => {
  await __resetForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("refreshAttendeeCache", () => {
  it("pages until a short page is returned and stores every record", async () => {
    const page1 = { data: Array.from({ length: 200 }, (_, i) => makeApiRow({ id: `id-${i}`, registration_number: `REG${i}` })), total: 210, page: 1, limit: 200, totalPages: 2 }
    const page2 = { data: Array.from({ length: 10 }, (_, i) => makeApiRow({ id: `id-${200 + i}`, registration_number: `REG${200 + i}` })), total: 210, page: 2, limit: 200, totalPages: 2 }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => page1 })
      .mockResolvedValueOnce({ ok: true, json: async () => page2 })
    vi.stubGlobal("fetch", fetchMock)

    const count = await refreshAttendeeCache("event-1", "list-1")

    expect(count).toBe(210)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const stored = await getAll(STORE_ATTENDEES)
    expect(stored).toHaveLength(210)
  })

  it("clears stale entries from a previous refresh before writing new ones", async () => {
    const stalePage = { data: [makeApiRow({ registration_number: "STALE1" })], total: 1, page: 1, limit: 200, totalPages: 1 }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => stalePage }))
    await refreshAttendeeCache("event-1", "list-1")

    const freshPage = { data: [makeApiRow({ registration_number: "FRESH1" })], total: 1, page: 1, limit: 200, totalPages: 1 }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => freshPage }))
    await refreshAttendeeCache("event-1", "list-1")

    const stored = await getAll(STORE_ATTENDEES)
    expect(stored).toHaveLength(1)
    expect(await findCachedAttendee("STALE1")).toBeUndefined()
    expect(await findCachedAttendee("FRESH1")).toBeDefined()
  })
})

describe("findCachedAttendee", () => {
  it("matches by registration_number", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makeApiRow({ registration_number: "125F0099" })], total: 1, page: 1, limit: 200, totalPages: 1 }),
    }))
    await refreshAttendeeCache("event-1", "list-1")
    const found = await findCachedAttendee("125F0099")
    expect(found?.attendee_name).toBe("Test Attendee")
  })

  it("matches by id when the raw value isn't a registration_number", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makeApiRow({ id: "uuid-123", registration_number: "125F0099" })], total: 1, page: 1, limit: 200, totalPages: 1 }),
    }))
    await refreshAttendeeCache("event-1", "list-1")
    const found = await findCachedAttendee("uuid-123")
    expect(found?.registration_number).toBe("125F0099")
  })

  it("returns undefined when not cached", async () => {
    const found = await findCachedAttendee("nope")
    expect(found).toBeUndefined()
  })
})

describe("markCachedCheckin", () => {
  it("optimistically flips the checked_in flag for a cached attendee", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [makeApiRow({ registration_number: "125F0055" })], total: 1, page: 1, limit: 200, totalPages: 1 }),
    }))
    await refreshAttendeeCache("event-1", "list-1")

    await markCachedCheckin("125F0055", true)
    expect((await findCachedAttendee("125F0055"))?.checked_in).toBe(true)
  })
})

describe("reconcileCachedAttendee", () => {
  it("upserts the cache from an authoritative server registration object", async () => {
    await reconcileCachedAttendee({
      id: "id-9",
      registration_number: "125F0077",
      attendee_name: "Server Truth",
      attendee_email: "server@example.com",
      ticket_types: { id: "t1", name: "Delegate" },
      checked_in: true,
    })
    const found = await findCachedAttendee("125F0077")
    expect(found?.attendee_name).toBe("Server Truth")
    expect(found?.checked_in).toBe(true)
    expect(found?.ticket_type_name).toBe("Delegate")
  })
})

describe("list name cache", () => {
  it("round-trips a list name through the meta store", async () => {
    expect(await getCachedListName("list-1")).toBeUndefined()
    await setCachedListName("list-1", "Hall A - Session 3")
    expect(await getCachedListName("list-1")).toBe("Hall A - Session 3")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- attendee-cache.test.ts`
Expected: FAIL — `Cannot find module './attendee-cache'`

- [ ] **Step 3: Implement the attendee cache**

Create `src/lib/offline-checkin/attendee-cache.ts`:

```ts
import { getAll, getOne, putAll, putOne, clearStore, STORE_ATTENDEES, STORE_META } from "./db"
import type { CachedAttendee, CheckinRegistration } from "./types"

const PAGE_LIMIT = 200
const SAFETY_MAX_PAGES = 125 // 125 * 200 = 25,000 records — infinite-loop guard, not an expected limit

interface CheckinApiRow {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_institution?: string | null
  ticket_types?: { id: string; name: string } | null
  checked_in: boolean
}

interface CheckinApiListResponse {
  data: CheckinApiRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

function toCachedAttendee(row: CheckinApiRow): CachedAttendee {
  return {
    id: row.id,
    registration_number: row.registration_number,
    attendee_name: row.attendee_name,
    attendee_email: row.attendee_email,
    attendee_institution: row.attendee_institution ?? null,
    ticket_type_name: row.ticket_types?.name ?? null,
    checked_in: row.checked_in,
  }
}

export async function refreshAttendeeCache(eventId: string, checkinListId: string): Promise<number> {
  await clearStore(STORE_ATTENDEES)
  let cached = 0

  for (let page = 1; page <= SAFETY_MAX_PAGES; page++) {
    const res = await fetch(
      `/api/checkin?event_id=${eventId}&checkin_list_id=${checkinListId}&page=${page}&limit=${PAGE_LIMIT}`
    )
    if (!res.ok) break
    const json: CheckinApiListResponse = await res.json()
    const records = json.data.map(toCachedAttendee)

    if (records.length > 0) {
      await putAll(STORE_ATTENDEES, records)
      cached += records.length
    }

    if (records.length < PAGE_LIMIT) break
  }

  return cached
}

export async function findCachedAttendee(rawValue: string): Promise<CachedAttendee | undefined> {
  const value = rawValue.trim()
  const byRegNumber = await getOne<CachedAttendee>(STORE_ATTENDEES, value)
  if (byRegNumber) return byRegNumber
  const all = await getAll<CachedAttendee>(STORE_ATTENDEES)
  return all.find((a) => a.id === value)
}

export async function markCachedCheckin(registrationNumber: string, checkedIn: boolean): Promise<void> {
  const existing = await getOne<CachedAttendee>(STORE_ATTENDEES, registrationNumber)
  if (!existing) return
  await putOne(STORE_ATTENDEES, { ...existing, checked_in: checkedIn })
}

export async function reconcileCachedAttendee(registration: CheckinRegistration): Promise<void> {
  const existing = await getOne<CachedAttendee>(STORE_ATTENDEES, registration.registration_number)
  await putOne(STORE_ATTENDEES, {
    id: registration.id,
    registration_number: registration.registration_number,
    attendee_name: registration.attendee_name,
    attendee_email: registration.attendee_email,
    attendee_institution: registration.attendee_institution ?? existing?.attendee_institution ?? null,
    ticket_type_name: registration.ticket_types?.name ?? existing?.ticket_type_name ?? null,
    checked_in: !!registration.checked_in,
  })
}

export async function getCachedListName(checkinListId: string): Promise<string | undefined> {
  const meta = await getOne<{ key: string; value: string }>(STORE_META, `list_name:${checkinListId}`)
  return meta?.value
}

export async function setCachedListName(checkinListId: string, name: string): Promise<void> {
  await putOne(STORE_META, { key: `list_name:${checkinListId}`, value: name })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- attendee-cache.test.ts`
Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline-checkin/attendee-cache.ts src/lib/offline-checkin/attendee-cache.test.ts
git commit -m "feat: add attendee cache for offline check-in name lookup"
```

---

## Task 4: Pending-actions queue + sync

**Files:**
- Create: `src/lib/offline-checkin/pending-queue.ts`
- Test: `src/lib/offline-checkin/pending-queue.test.ts`

**Interfaces:**
- Consumes: `db.ts`'s `getAll`, `putOne`, `removeOne`, `STORE_PENDING`; `attendee-cache.ts`'s `reconcileCachedAttendee`; `types.ts`'s `PendingAction`, `CheckinApiResult`.
- Produces: `enqueueAction(input: { registration_number: string; action: "check_in" | "check_out"; event_id: string; checkin_list_id: string }): Promise<PendingAction>`, `listPendingActions(): Promise<PendingAction[]>`, `removePendingAction(id: string): Promise<void>`, `incrementAttempts(id: string): Promise<void>`, `hasPendingActionFor(registrationNumber: string, action: "check_in" | "check_out"): Promise<boolean>`, `syncPendingActions(): Promise<{ synced: number; remaining: number; hardFailures: PendingAction[] }>`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/offline-checkin/pending-queue.test.ts`:

```ts
import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { __resetForTests } from "./db"
import {
  enqueueAction,
  listPendingActions,
  removePendingAction,
  incrementAttempts,
  hasPendingActionFor,
  syncPendingActions,
} from "./pending-queue"

beforeEach(async () => {
  await __resetForTests()
  vi.useFakeTimers()
  vi.setSystemTime(0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const BASE = { event_id: "event-1", checkin_list_id: "list-1" } as const

describe("queue basics", () => {
  it("enqueue then list returns items oldest-first", async () => {
    vi.setSystemTime(1000)
    await enqueueAction({ registration_number: "A", action: "check_in", ...BASE })
    vi.setSystemTime(2000)
    await enqueueAction({ registration_number: "B", action: "check_in", ...BASE })

    const queue = await listPendingActions()
    expect(queue.map((q) => q.registration_number)).toEqual(["A", "B"])
  })

  it("removePendingAction removes exactly one item", async () => {
    const a = await enqueueAction({ registration_number: "A", action: "check_in", ...BASE })
    await enqueueAction({ registration_number: "B", action: "check_in", ...BASE })
    await removePendingAction(a.id)
    const queue = await listPendingActions()
    expect(queue.map((q) => q.registration_number)).toEqual(["B"])
  })

  it("incrementAttempts bumps the attempts counter", async () => {
    const a = await enqueueAction({ registration_number: "A", action: "check_in", ...BASE })
    await incrementAttempts(a.id)
    await incrementAttempts(a.id)
    const [found] = await listPendingActions()
    expect(found.attempts).toBe(2)
  })

  it("hasPendingActionFor detects an existing queued action for the same registration+action", async () => {
    await enqueueAction({ registration_number: "A", action: "check_in", ...BASE })
    expect(await hasPendingActionFor("A", "check_in")).toBe(true)
    expect(await hasPendingActionFor("A", "check_out")).toBe(false)
    expect(await hasPendingActionFor("B", "check_in")).toBe(false)
  })
})

describe("syncPendingActions", () => {
  it("removes items on success (including already_checked_in) and reconciles the cache", async () => {
    await enqueueAction({ registration_number: "A", action: "check_in", ...BASE })
    await enqueueAction({ registration_number: "B", action: "check_in", ...BASE })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ success: true, action: "checked_in", registration: { id: "1", registration_number: "A", attendee_name: "A", attendee_email: "a@x.com", checked_in: true } }) })
      .mockResolvedValueOnce({ json: async () => ({ success: true, action: "already_checked_in", registration: { id: "2", registration_number: "B", attendee_name: "B", attendee_email: "b@x.com", checked_in: true } }) })
    vi.stubGlobal("fetch", fetchMock)

    const summary = await syncPendingActions()

    expect(summary.synced).toBe(2)
    expect(summary.remaining).toBe(0)
    expect(summary.hardFailures).toHaveLength(0)
    expect(await listPendingActions()).toHaveLength(0)
  })

  it("stops the pass on the first network failure, leaving the rest queued", async () => {
    await enqueueAction({ registration_number: "A", action: "check_in", ...BASE })
    await enqueueAction({ registration_number: "B", action: "check_in", ...BASE })
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network down"))
    vi.stubGlobal("fetch", fetchMock)

    const summary = await syncPendingActions()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(summary.synced).toBe(0)
    expect(summary.remaining).toBe(2)
    const [firstItem] = await listPendingActions()
    expect(firstItem.attempts).toBe(1)
  })

  it("removes a hard (business-logic) failure from the queue and reports it, without stopping the pass", async () => {
    await enqueueAction({ registration_number: "A", action: "check_in", ...BASE })
    await enqueueAction({ registration_number: "B", action: "check_in", ...BASE })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ success: false, error: "registration cancelled" }) })
      .mockResolvedValueOnce({ json: async () => ({ success: true, action: "checked_in", registration: { id: "2", registration_number: "B", attendee_name: "B", attendee_email: "b@x.com", checked_in: true } }) })
    vi.stubGlobal("fetch", fetchMock)

    const summary = await syncPendingActions()

    expect(summary.synced).toBe(1)
    expect(summary.hardFailures).toHaveLength(1)
    expect(summary.hardFailures[0].registration_number).toBe("A")
    expect(summary.remaining).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- pending-queue.test.ts`
Expected: FAIL — `Cannot find module './pending-queue'`

- [ ] **Step 3: Implement the queue**

Create `src/lib/offline-checkin/pending-queue.ts`:

```ts
import { getAll, putOne, removeOne, STORE_PENDING } from "./db"
import { reconcileCachedAttendee } from "./attendee-cache"
import type { CheckinApiResult, PendingAction } from "./types"

export async function enqueueAction(input: {
  registration_number: string
  action: "check_in" | "check_out"
  event_id: string
  checkin_list_id: string
}): Promise<PendingAction> {
  const record: PendingAction = {
    id: crypto.randomUUID(),
    registration_number: input.registration_number,
    action: input.action,
    event_id: input.event_id,
    checkin_list_id: input.checkin_list_id,
    queued_at: Date.now(),
    attempts: 0,
  }
  await putOne(STORE_PENDING, record)
  return record
}

export async function listPendingActions(): Promise<PendingAction[]> {
  const all = await getAll<PendingAction>(STORE_PENDING)
  return all.sort((a, b) => a.queued_at - b.queued_at)
}

export async function removePendingAction(id: string): Promise<void> {
  await removeOne(STORE_PENDING, id)
}

export async function incrementAttempts(id: string): Promise<void> {
  const all = await getAll<PendingAction>(STORE_PENDING)
  const found = all.find((a) => a.id === id)
  if (!found) return
  await putOne(STORE_PENDING, { ...found, attempts: found.attempts + 1 })
}

export async function hasPendingActionFor(
  registrationNumber: string,
  action: "check_in" | "check_out"
): Promise<boolean> {
  const all = await getAll<PendingAction>(STORE_PENDING)
  return all.some((a) => a.registration_number === registrationNumber && a.action === action)
}

export interface SyncSummary {
  synced: number
  remaining: number
  hardFailures: PendingAction[]
}

// Drains the queue oldest-first, one request at a time. Stops the whole pass
// on the first network failure (connection is still down — no point burning
// through the rest of the queue) but keeps going past a single item's
// business-logic rejection (e.g. a registration cancelled since queuing).
export async function syncPendingActions(): Promise<SyncSummary> {
  const queue = await listPendingActions()
  let synced = 0
  const hardFailures: PendingAction[] = []

  for (const item of queue) {
    let json: CheckinApiResult
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: item.event_id,
          checkin_list_id: item.checkin_list_id,
          registration_number: item.registration_number,
          action: item.action,
        }),
      })
      json = await res.json()
    } catch {
      await incrementAttempts(item.id)
      break
    }

    if (json.success) {
      if (json.registration) await reconcileCachedAttendee(json.registration)
      await removePendingAction(item.id)
      synced++
    } else {
      await removePendingAction(item.id)
      hardFailures.push(item)
    }
  }

  const remainingQueue = await listPendingActions()
  return { synced, remaining: remainingQueue.length, hardFailures }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- pending-queue.test.ts`
Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline-checkin/pending-queue.ts src/lib/offline-checkin/pending-queue.test.ts
git commit -m "feat: add pending-actions queue and ordered sync for offline check-in"
```

---

## Task 5: Scan orchestrator (`submitCheckin`)

**Files:**
- Create: `src/lib/offline-checkin/submit-checkin.ts`
- Test: `src/lib/offline-checkin/submit-checkin.test.ts`

**Interfaces:**
- Consumes: `attendee-cache.ts`'s `findCachedAttendee`, `markCachedCheckin`, `reconcileCachedAttendee`; `pending-queue.ts`'s `enqueueAction`, `hasPendingActionFor`; `types.ts`'s `CheckinApiResult`.
- Produces: `submitCheckin(input: { eventId: string; checkinListId: string; value: string; action: "check_in" | "check_out" }): Promise<CheckinApiResult>` — this is what the scan page's mutation calls in Task 8.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/offline-checkin/submit-checkin.test.ts`:

```ts
import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { __resetForTests } from "./db"
import { refreshAttendeeCache } from "./attendee-cache"
import { listPendingActions } from "./pending-queue"
import { submitCheckin } from "./submit-checkin"

async function seedCache(registrationNumber: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [{
        id: "id-1", registration_number: registrationNumber, attendee_name: "Test Attendee",
        attendee_email: "t@x.com", ticket_types: { id: "t1", name: "Faculty" }, checked_in: false,
      }],
      total: 1, page: 1, limit: 200, totalPages: 1,
    }),
  }))
  await refreshAttendeeCache("event-1", "list-1")
}

beforeEach(async () => {
  await __resetForTests()
  vi.stubGlobal("navigator", { onLine: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("submitCheckin", () => {
  it("returns the server response directly on network success", async () => {
    await seedCache("125F0001")
    const serverResult = { success: true, action: "checked_in", registration: { id: "id-1", registration_number: "125F0001", attendee_name: "Test Attendee", attendee_email: "t@x.com", checked_in: true } }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => serverResult }))

    const result = await submitCheckin({ eventId: "event-1", checkinListId: "list-1", value: "125F0001", action: "check_in" })

    expect(result).toEqual(serverResult)
    expect(await listPendingActions()).toHaveLength(0)
  })

  it("queues the action and returns an optimistic pending success when the network call throws", async () => {
    await seedCache("125F0002")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    const result = await submitCheckin({ eventId: "event-1", checkinListId: "list-1", value: "125F0002", action: "check_in" })

    expect(result.success).toBe(true)
    expect(result.pending).toBe(true)
    expect(result.registration?.attendee_name).toBe("Test Attendee")
    expect(await listPendingActions()).toHaveLength(1)
  })

  it("skips the network call entirely when navigator.onLine is false", async () => {
    await seedCache("125F0003")
    vi.stubGlobal("navigator", { onLine: false })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await submitCheckin({ eventId: "event-1", checkinListId: "list-1", value: "125F0003", action: "check_in" })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.pending).toBe(true)
  })

  it("does not double-queue when the same device submits the same registration+action twice while offline", async () => {
    await seedCache("125F0004")
    vi.stubGlobal("navigator", { onLine: false })
    vi.stubGlobal("fetch", vi.fn())

    await submitCheckin({ eventId: "event-1", checkinListId: "list-1", value: "125F0004", action: "check_in" })
    await submitCheckin({ eventId: "event-1", checkinListId: "list-1", value: "125F0004", action: "check_in" })

    expect(await listPendingActions()).toHaveLength(1)
  })

  it("returns a not-found error when the value isn't in the local cache and the network is unavailable", async () => {
    vi.stubGlobal("navigator", { onLine: false })
    vi.stubGlobal("fetch", vi.fn())

    const result = await submitCheckin({ eventId: "event-1", checkinListId: "list-1", value: "unknown-code", action: "check_in" })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- submit-checkin.test.ts`
Expected: FAIL — `Cannot find module './submit-checkin'`

- [ ] **Step 3: Implement the orchestrator**

Create `src/lib/offline-checkin/submit-checkin.ts`:

```ts
import { findCachedAttendee, markCachedCheckin, reconcileCachedAttendee } from "./attendee-cache"
import { enqueueAction, hasPendingActionFor } from "./pending-queue"
import type { CheckinApiResult } from "./types"

const NETWORK_TIMEOUT_MS = 3000

export async function submitCheckin(input: {
  eventId: string
  checkinListId: string
  value: string
  action: "check_in" | "check_out"
}): Promise<CheckinApiResult> {
  const { eventId, checkinListId, value, action } = input
  const cached = await findCachedAttendee(value)

  if (navigator.onLine !== false) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS)
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          checkin_list_id: checkinListId,
          registration_number: value,
          action,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const json: CheckinApiResult = await res.json()
      if (json.registration) await reconcileCachedAttendee(json.registration)
      return json
    } catch {
      // Network error or timeout — fall through to the offline queue path.
    }
  }

  if (!cached) {
    return { success: false, error: "Not found locally — connect to the internet or refresh the attendee list" }
  }

  const alreadyQueued = await hasPendingActionFor(cached.registration_number, action)
  if (!alreadyQueued) {
    await enqueueAction({
      registration_number: cached.registration_number,
      action,
      event_id: eventId,
      checkin_list_id: checkinListId,
    })
    await markCachedCheckin(cached.registration_number, action === "check_in")
  }

  return {
    success: true,
    action: action === "check_in" ? "checked_in" : "checked_out",
    pending: true,
    registration: {
      id: cached.id,
      registration_number: cached.registration_number,
      attendee_name: cached.attendee_name,
      attendee_email: cached.attendee_email,
      attendee_institution: cached.attendee_institution,
      ticket_types: cached.ticket_type_name ? { id: "", name: cached.ticket_type_name } : null,
      checked_in: action === "check_in",
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- submit-checkin.test.ts`
Expected: `5 passed`

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all test files pass (smoke, db, attendee-cache, pending-queue, submit-checkin).

- [ ] **Step 6: Commit**

```bash
git add src/lib/offline-checkin/submit-checkin.ts src/lib/offline-checkin/submit-checkin.test.ts
git commit -m "feat: add submitCheckin orchestrator with offline fallback"
```

---

## Task 6: Sync hook (`useOfflineCheckinSync`)

**Files:**
- Create: `src/hooks/use-offline-checkin-sync.ts`

**Interfaces:**
- Consumes: `pending-queue.ts`'s `listPendingActions`, `syncPendingActions`, `SyncSummary`.
- Produces: `useOfflineCheckinSync(): { pendingCount: number; isOnline: boolean; lastFailures: PendingAction[]; syncNow: () => Promise<void>; refreshPendingCount: () => Promise<void> }` — consumed directly by the scan page in Task 8.

This task has no automated test (no component-test harness exists in this repo — see Global Constraints). It's verified manually as part of Task 9's end-to-end pass.

- [ ] **Step 1: Implement the hook**

Create `src/hooks/use-offline-checkin-sync.ts`:

```ts
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { listPendingActions, syncPendingActions } from "@/lib/offline-checkin/pending-queue"
import type { PendingAction } from "@/lib/offline-checkin/types"

const RETRY_INTERVAL_MS = 10000

export function useOfflineCheckinSync() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(true)
  const [lastFailures, setLastFailures] = useState<PendingAction[]>([])
  const syncingRef = useRef(false)

  const refreshPendingCount = useCallback(async () => {
    const queue = await listPendingActions()
    setPendingCount(queue.length)
  }, [])

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    try {
      const summary = await syncPendingActions()
      if (summary.hardFailures.length > 0) {
        setLastFailures((prev) => [...prev, ...summary.hardFailures])
      }
      setPendingCount(summary.remaining)
    } finally {
      syncingRef.current = false
    }
  }, [])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    refreshPendingCount()

    const handleOnline = () => {
      setIsOnline(true)
      syncNow()
    }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    const interval = setInterval(() => {
      if (navigator.onLine) syncNow()
    }, RETRY_INTERVAL_MS)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(interval)
    }
  }, [refreshPendingCount, syncNow])

  return { pendingCount, isOnline, lastFailures, syncNow, refreshPendingCount }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-offline-checkin-sync.ts
git commit -m "feat: add useOfflineCheckinSync hook for automatic queue draining"
```

---

## Task 7: Scan page integration

**Files:**
- Modify: `src/app/events/[eventId]/checkin/[listId]/scan/page.tsx`

**Interfaces:**
- Consumes: `useOfflineCheckinSync` (Task 6), `submitCheckin` (Task 5), `refreshAttendeeCache`/`getCachedListName`/`setCachedListName` (Task 3).

This task has no automated test — it's a UI integration into an existing, untested client component. Verify manually per Task 9.

- [ ] **Step 1: Add imports**

In `src/app/events/[eventId]/checkin/[listId]/scan/page.tsx`, add near the top with the other imports:

```ts
import { useOfflineCheckinSync } from "@/hooks/use-offline-checkin-sync"
import { submitCheckin } from "@/lib/offline-checkin/submit-checkin"
import { refreshAttendeeCache, getCachedListName, setCachedListName } from "@/lib/offline-checkin/attendee-cache"
import { RefreshCw } from "lucide-react"
```

- [ ] **Step 2: Replace the local online/offline state with the hook's**

Remove the existing local state and effect (originally around lines 81 and 112-123):

```ts
  const [isOnline, setIsOnline] = useState(true)
```

and

```ts
  // Online/offline detection
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])
```

Replace both with a single hook call near the top of the component body:

```ts
  const { pendingCount, isOnline, lastFailures, syncNow, refreshPendingCount } = useOfflineCheckinSync()
```

- [ ] **Step 3: Add attendee-cache + list-name state and loading effect**

Add new state near the other `useState` calls:

```ts
  const [cachedListName, setCachedListNameState] = useState<string | null>(null)
  const [refreshingCache, setRefreshingCache] = useState(false)
```

Add a new effect that loads the cached list name on mount and refreshes the attendee cache:

```ts
  const loadAttendeeCache = async () => {
    setRefreshingCache(true)
    try {
      await refreshAttendeeCache(eventId, listId)
    } finally {
      setRefreshingCache(false)
    }
  }

  useEffect(() => {
    getCachedListName(listId).then((name) => {
      if (name) setCachedListNameState(name)
    })
    loadAttendeeCache()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId])

  // Persist the list name locally as soon as we learn it online, so it's
  // available on the next load even with no connectivity.
  useEffect(() => {
    if (stats?.list.name) {
      setCachedListName(listId, stats.list.name)
      setCachedListNameState(stats.list.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats?.list.name])
```

- [ ] **Step 4: Use the cached name as a fallback in the header title**

Find this line (originally line 522):

```tsx
                  <h1 className="text-sm sm:text-lg font-bold truncate">{stats?.list.name || "Check-in Scanner"}</h1>
```

Replace with:

```tsx
                  <h1 className="text-sm sm:text-lg font-bold truncate">{stats?.list.name || cachedListName || "Check-in Scanner"}</h1>
```

- [ ] **Step 5: Route check-in submissions through `submitCheckin`**

Find the `checkinMutation` definition (originally around lines 173-186):

```ts
  const checkinMutation = useMutation({
    mutationFn: async (registrationNumber: string) => {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          checkin_list_id: listId,
          registration_number: registrationNumber,
          action: checkoutMode ? "check_out" : "check_in"
        })
      })
      return res.json()
    },
```

Replace the `mutationFn` body with:

```ts
  const checkinMutation = useMutation({
    mutationFn: async (registrationNumber: string) => {
      return submitCheckin({
        eventId,
        checkinListId: listId,
        value: registrationNumber,
        action: checkoutMode ? "check_out" : "check_in"
      })
    },
```

- [ ] **Step 6: Extend `ScanResult` and `RecentScan` types with a `pending` flag**

Find the interfaces near the top of the file:

```ts
interface ScanResult {
  type: "success" | "error" | "warning" | "already"
  message: string
  registrationId?: string
  attendee?: {
    name: string
    email: string
    ticket: string
    registration_number: string
    institution?: string
  }
}
```

Add a `pending` field:

```ts
interface ScanResult {
  type: "success" | "error" | "warning" | "already"
  message: string
  registrationId?: string
  pending?: boolean
  attendee?: {
    name: string
    email: string
    ticket: string
    registration_number: string
    institution?: string
  }
}
```

And similarly for `RecentScan`:

```ts
interface RecentScan {
  id: string
  name: string
  registrationNumber: string
  registrationId?: string
  time: string
  status: "success" | "error" | "already"
  pending?: boolean
}
```

- [ ] **Step 7: Thread `data.pending` through the success handler**

In `checkinMutation`'s `onSuccess`, in the `else` branch that builds the success `ScanResult` (originally around lines 222-241), add `pending: data.pending` to the `setScanResult` call and update `addRecentScan` to accept and pass it through:

```ts
        } else {
          setScanResult({
            type: "success",
            message: isCheckout ? `Checked out from ${data.list_name}` : `Checked in to ${data.list_name}`,
            registrationId: data.registration?.id,
            pending: data.pending,
            attendee: {
              name: data.registration?.attendee_name,
              email: data.registration?.attendee_email,
              ticket: data.registration?.ticket_types?.name,
              registration_number: data.registration?.registration_number,
              institution: data.registration?.attendee_institution
            }
          })
          playSound("success")
          vibrate([100, 50, 100])
          addRecentScan(data.registration?.attendee_name, data.registration?.registration_number, data.registration?.id, "success", data.pending)
          if (!isCheckout) {
            setLastCheckedInId(data.registration?.id)
          }
        }
      } else {
        // ...unchanged error branch...
      }
      refetchStats()
      if (data.pending) refreshPendingCount()
      // Start countdown
      setCountdown(5)
```

Update the `addRecentScan` function signature to accept the new optional argument (originally around lines 309-321):

```ts
  const addRecentScan = (name: string, registrationNumber: string, registrationId: string | undefined, status: "success" | "error" | "already", pending?: boolean) => {
    setRecentScans((prev) => [
      {
        id: Date.now().toString(),
        name,
        registrationNumber,
        registrationId,
        time: new Date().toLocaleTimeString(),
        status,
        pending
      },
      ...prev.slice(0, 19) // Keep last 20 scans
    ])
  }
```

- [ ] **Step 8: Show a pending badge in the result card and Recent Scans**

In the scan result card, after the existing countdown timer block (originally around lines 817-823), add a pending indicator next to it:

```tsx
              {scanResult.pending && (
                <div className="absolute top-4 left-4 px-2 py-1 bg-amber-500/20 border border-amber-500/50 rounded-full text-xs font-medium text-amber-300">
                  ⏳ Pending sync
                </div>
              )}
```

In the Recent Scans list item (originally around lines 1012-1018), add a small pending marker next to the timestamp:

```tsx
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        {scan.time}
                        {scan.pending && <span className="text-amber-400">⏳ pending</span>}
                      </div>
```

(This replaces the existing plain `<div className="text-xs text-gray-500 mt-1">{scan.time}</div>`.)

- [ ] **Step 9: Add a pending-count badge and Sync/Refresh buttons to the header**

Find the connection status block (originally around lines 533-536):

```tsx
              {/* Connection Status */}
              <div className={`p-2 rounded-lg ${isOnline ? "text-green-400" : "text-red-400"}`} title={isOnline ? "Online" : "Offline"}>
                {isOnline ? <Wifi className="w-4 h-4 sm:w-5 sm:h-5" /> : <WifiOff className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
```

Replace with a version that also shows the pending count and a sync button:

```tsx
              {/* Connection Status */}
              <div className={`flex items-center gap-1 p-2 rounded-lg ${isOnline ? "text-green-400" : "text-red-400"}`} title={isOnline ? "Online" : "Offline"}>
                {isOnline ? <Wifi className="w-4 h-4 sm:w-5 sm:h-5" /> : <WifiOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                {pendingCount > 0 && (
                  <span className="text-xs font-medium text-amber-400">⏳ {pendingCount}</span>
                )}
              </div>

              {pendingCount > 0 && (
                <button
                  onClick={() => syncNow().then(refreshPendingCount)}
                  className="p-2 hover:bg-gray-700 rounded-lg text-amber-400"
                  title="Sync now"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              <button
                onClick={loadAttendeeCache}
                disabled={refreshingCache}
                className="p-2 hover:bg-gray-700 rounded-lg hidden sm:block disabled:opacity-50"
                title="Refresh attendee list"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${refreshingCache ? "animate-spin" : ""}`} />
              </button>
```

- [ ] **Step 10: Add a non-blocking banner for hard sync failures**

A hard failure (spec: a genuine business-logic rejection like a registration cancelled since queuing) is removed from the queue by `syncPendingActions` but reported in `lastFailures` — it must not be silently dropped. Add state and a dismissible banner.

Add state near the other `useState` calls:

```ts
  const [dismissedFailureCount, setDismissedFailureCount] = useState(0)
```

Add the banner just below the header `<div>` block (after its closing tag, before the Keyboard Shortcuts Modal):

```tsx
      {lastFailures.length > dismissedFailureCount && (
        <div className="bg-red-900/50 border-b border-red-500 px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-sm text-red-300">
            {lastFailures.length - dismissedFailureCount} queued check-in{lastFailures.length - dismissedFailureCount === 1 ? "" : "s"} couldn't sync — {lastFailures.slice(dismissedFailureCount).map((f) => f.registration_number).join(", ")}
          </p>
          <button
            onClick={() => setDismissedFailureCount(lastFailures.length)}
            className="text-red-300 hover:text-white text-sm underline flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
```

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 12: Commit**

```bash
git add src/app/events/\[eventId\]/checkin/\[listId\]/scan/page.tsx
git commit -m "feat: wire offline check-in cache, queue, and sync into the scan page"
```

---

## Task 8: Service worker — scoped scan-shell caching

**Files:**
- Modify: `public/app-sw.js`

**Interfaces:** none (browser-level fetch interception only).

This task has no automated test — service worker behavior is verified manually per Task 9.

- [ ] **Step 1: Bump the cache version and document the scoped exception**

Find the top of `public/app-sw.js`:

```js
const CACHE_VERSION = "v3"
const CACHE_NAME = `amasi-${CACHE_VERSION}`

// Only an offline shell is precached. No app HTML, no JS chunks.
const PRECACHE_URLS = ["/offline"]
```

Replace with:

```js
const CACHE_VERSION = "v4"
const CACHE_NAME = `amasi-${CACHE_VERSION}`

// Only an offline shell is precached app-wide. No other app HTML, no JS chunks.
const PRECACHE_URLS = ["/offline"]

// Exception to the "never cache HTML" rule above, scoped to exactly one
// route: the volunteer check-in scan page. Connectivity at venues is patchy
// (not fully dead), and this page needs to survive a reload during a dead
// spot rather than falling back to the generic /offline page — its own
// IndexedDB queue (src/lib/offline-checkin) is what actually protects
// check-in data, independent of this cache. Staleness is bounded by
// stale-while-revalidate below: every successful online visit overwrites the
// cached copy, so the worst case is "as stale as this device's last visit to
// this exact list's scan page" rather than "as stale as the last deploy."
// See docs/superpowers/specs/2026-07-07-offline-checkin-design.md.
const SCAN_ROUTE_PATTERN = /^\/events\/[^/]+\/checkin\/[^/]+\/scan\/?$/
```

- [ ] **Step 2: Add the scoped stale-while-revalidate branch**

Find the navigation-handling block:

```js
  // Navigations / HTML: network-first, fall back to the offline page only.
  // We do NOT cache live HTML — a cached shell can reference chunks that a later
  // deploy has removed, which is exactly what produced the blank-page bug.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/offline").then((cached) => cached || new Response("Offline", { status: 503 }))
      )
    )
    return
  }
```

Replace with:

```js
  // Navigations / HTML: network-first, fall back to the offline page only.
  // We do NOT cache live HTML — a cached shell can reference chunks that a later
  // deploy has removed, which is exactly what produced the blank-page bug.
  if (event.request.mode === "navigate") {
    if (SCAN_ROUTE_PATTERN.test(url.pathname)) {
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
            }
            return response
          })
          .catch(() =>
            caches
              .match(event.request)
              .then((cached) => cached || caches.match("/offline"))
              .then((cached) => cached || new Response("Offline", { status: 503 }))
          )
      )
      return
    }

    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/offline").then((cached) => cached || new Response("Offline", { status: 503 }))
      )
    )
    return
  }
```

- [ ] **Step 3: Commit**

```bash
git add public/app-sw.js
git commit -m "feat: cache the check-in scan page shell for offline reloads"
```

---

## Task 9: End-to-end manual verification

**Files:** none (verification only).

Run every check below in Chrome DevTools against a real event/checkin list in a dev or preview deploy (service workers need `https://` or `localhost`).

- [ ] **Step 1: Baseline online behavior is unchanged**

Open a scan page (`/events/{eventId}/checkin/{listId}/scan`) with normal connectivity. Scan/type a known registration number. Confirm success/already/error states look and sound exactly as before this change.

- [ ] **Step 2: Hard offline — scan queues instantly**

DevTools → Network tab → set to "Offline". Scan a registration number that's in the list. Expected: success UI appears immediately (no 3s stall — confirms the `navigator.onLine` pre-check), with a "⏳ Pending sync" tag, and the header's pending badge shows `⏳ 1`.

- [ ] **Step 3: Sync on reconnect**

Set Network back to "Online" (or "No throttling"). Within 10s (or tap "Sync now"), confirm the pending badge clears and the Recent Scans entry loses its pending tag. Verify in the DB:

```sql
select * from checkin_records where registration_id = '<the id you scanned>';
```

Expect exactly one row.

- [ ] **Step 4: Flaky/intermittent signal**

DevTools → Network → "Slow 3G" or a custom throttling profile that occasionally times out. Scan several attendees. Confirm some succeed immediately online and some queue-then-sync, with no duplicate `checkin_records` rows for any of them.

- [ ] **Step 5: Connection drop mid-sync**

Queue 3+ pending actions (set Offline, scan 3 people, set back Online but immediately re-toggle Offline mid-sync via rapid DevTools toggling, or throttle to force a mid-batch failure). Confirm the sync pass stops after the first failure (check Network tab shows only one `/api/checkin` POST after the drop), the remaining items stay queued, and a later successful sync completes them with no duplicates.

- [ ] **Step 6: Two-device duplicate check-in**

Open the same scan page in two separate browser profiles (or one normal + one Incognito window) logged in as staff. Set both Offline. Scan the same registration number on both. Set both Online. Confirm: exactly one `checkin_records` row is created; the device that synced second shows "Already checked in" without an error.

- [ ] **Step 7: Same-device double-scan dedupe**

While Offline, scan the same registration number twice in a row on one device. Confirm only one entry appears in `pending_actions` (check via DevTools → Application → IndexedDB → `amasi-checkin` → `pending_actions`), not two.

- [ ] **Step 8: Reload during a dead spot**

While Offline, reload the scan page. Confirm the actual scan UI loads (not the generic `/offline` page) — this confirms the Task 8 service worker change is working, and that `pending_actions`/`attendees` in IndexedDB survived the reload.

- [ ] **Step 9: Unrelated pages are unaffected**

While Offline, reload a different app page (e.g. `/events/{eventId}` dashboard). Confirm it still falls back to the generic `/offline` page as before — confirms the scoped service worker change didn't affect other routes.

- [ ] **Step 10: iPhone Safari**

Repeat Steps 2-3 on an actual iPhone in Safari (airplane mode toggle in place of DevTools Offline). Confirm identical behavior — this is the device class that ruled out Background Sync API, so it's the one that most needs direct confirmation.

- [ ] **Step 11: Not-found handling**

While Offline, type a value that doesn't match anyone in the cached list. Confirm a clear "Not found" message and that nothing is added to `pending_actions`.

- [ ] **Step 12: Hard-failure banner**

Queue a check-in while Offline for a registration you then cancel (set that registration's `status` to something other than `confirmed` directly in the DB) before going back Online. Sync. Confirm the red banner appears naming that registration number, and dismissing it clears it without re-appearing on the next sync pass.
