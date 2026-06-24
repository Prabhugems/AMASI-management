// Persistent offline scan queue for the staff check-in scanner
// (src/app/checkin/access/[accessToken]/page.tsx).
//
// Why this exists: every scan today is a live `fetch` to /api/verify. Pre-fix,
// a dropped wifi at the conference desk lost the scan with just a toast.
// With this queue, a scan that fails on the network path is persisted to
// IndexedDB and flushed when connectivity returns — the volunteer keeps
// scanning without losing rows.
//
// Scope discipline: this is the minimal "don't lose scans" version (audit's
// Option Y). It does NOT pre-fetch the attendee roster, does NOT do local
// lookups for offline attendee names, and does NOT optimistically update
// `registrations.checked_in` from the client. The server's response on flush
// remains the truth — including idempotency for the "checked in by another
// device while we were offline" case, which /api/verify already handles via
// the 23505 swallow + alreadyCheckedIn flag (PR #75/79). Upgrading to a
// local-roster version (audit's Option Z) is a post-AMASICON follow-up.
//
// Storage layout: one IDB database, one store keyed by uuid. Scans are
// partitioned by `list_access_token` so a volunteer's queue for List A
// doesn't leak into a different access link.

import { openDB, type IDBPDatabase } from "idb"

const DB_NAME = "amasi-checkin-offline"
const STORE = "pending_scans"
const VERSION = 1

export interface QueuedScan {
  id: string
  list_access_token: string
  token: string
  scanned_at: number
  attempts: number
  last_error?: string
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" })
        }
      },
    })
  }
  return dbPromise
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function enqueueScan(listAccessToken: string, token: string): Promise<QueuedScan> {
  const db = await getDb()
  const scan: QueuedScan = {
    id: newId(),
    list_access_token: listAccessToken,
    token,
    scanned_at: Date.now(),
    attempts: 0,
  }
  await db.put(STORE, scan)
  return scan
}

export async function listPending(listAccessToken: string): Promise<QueuedScan[]> {
  const db = await getDb()
  const all = (await db.getAll(STORE)) as QueuedScan[]
  return all
    .filter((s) => s.list_access_token === listAccessToken)
    .sort((a, b) => a.scanned_at - b.scanned_at)
}

export async function pendingCount(listAccessToken: string): Promise<number> {
  return (await listPending(listAccessToken)).length
}

export async function deleteScan(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, id)
}

async function updateScan(scan: QueuedScan): Promise<void> {
  const db = await getDb()
  await db.put(STORE, scan)
}

/**
 * Detect whether a fetch error indicates a network failure (vs a server
 * response we should treat as terminal). Browsers throw `TypeError` for
 * network-level failures including offline / DNS / TLS / aborted-by-network.
 * Anything else (a real HTTP response we then mishandled) is terminal.
 */
function isNetworkFailure(err: unknown): boolean {
  return err instanceof TypeError
}

export interface FlushResult {
  scan: QueuedScan
  /** Response JSON from /api/verify, if a response came back at all. */
  response?: unknown
  /** True iff /api/verify returned ok+success. */
  success: boolean
  /** Terminal error (4xx/5xx body, or non-network throw). Queue entry removed. */
  terminalError?: string
}

/**
 * Drain the queue for `listAccessToken`. Sequential, low concurrency on
 * purpose — the verify endpoint is IP-rate-limited (5/min strict per
 * api/checkin/access/route.ts:11-14), and AMASICON's mobile networks aren't
 * worth flooding. Stops at the first network failure (likely we're still
 * offline) so we don't churn the queue.
 *
 * Each scan that gets a response — success OR a server-side rejection like
 * already_checked_in / not_found / 401 expired — is removed from the queue
 * and reported via onResult. A retryable network failure leaves the scan in
 * the queue with attempts++.
 */
export async function flushQueue(
  listAccessToken: string,
  onResult: (result: FlushResult) => void,
): Promise<{ flushed: number; remaining: number }> {
  const pending = await listPending(listAccessToken)
  let flushed = 0

  for (const scan of pending) {
    try {
      const res = await fetch(`/api/verify/${scan.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // checkin_list_id is ignored server-side; the route re-resolves it
          // from the access token (verify/[token]/route.ts:189-191). Sending
          // null keeps payload shape consistent without storing it per-scan.
          checkin_list_id: null,
          access_token: listAccessToken,
          action: "check_in",
          performed_by: "Staff (synced from offline queue)",
        }),
      })

      // Any HTTP response — 2xx or 4xx/5xx — is terminal for the queue.
      // /api/verify is idempotent: a second check-in for the same registration
      // returns ok with alreadyCheckedIn=true, so the only "errors" here are
      // genuine ones (registration not found, token revoked, etc).
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      const success = res.ok && data.success === true
      await deleteScan(scan.id)
      flushed++
      onResult({
        scan,
        response: data,
        success,
        terminalError: success ? undefined : (data.error || `HTTP ${res.status}`),
      })
    } catch (err) {
      if (isNetworkFailure(err)) {
        // Likely still offline. Leave in queue, increment attempts, stop.
        await updateScan({
          ...scan,
          attempts: scan.attempts + 1,
          last_error: err instanceof Error ? err.message : String(err),
        })
        break
      }
      // Non-network throw (shouldn't happen — fetch+json is the only async
      // surface). Treat as terminal to avoid an infinite loop on a poison row.
      await deleteScan(scan.id)
      flushed++
      onResult({
        scan,
        success: false,
        terminalError: err instanceof Error ? err.message : "Unknown error during sync",
      })
    }
  }

  const remaining = (await listPending(listAccessToken)).length
  return { flushed, remaining }
}

/** Wipes every queued scan for this access link. UI's "discard all" affordance. */
export async function clearAll(listAccessToken: string): Promise<number> {
  const db = await getDb()
  const all = (await db.getAll(STORE)) as QueuedScan[]
  const toDelete = all.filter((s) => s.list_access_token === listAccessToken)
  await Promise.all(toDelete.map((s) => db.delete(STORE, s.id)))
  return toDelete.length
}
