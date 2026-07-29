// IndexedDB-backed offline store for the self-check-in kiosk's Stage 1
// redesign (docs/superpowers/plans/2026-07-27-kiosk-offline-first-stage1.md).
// A separate database from src/lib/offline-scan-queue.ts on purpose: that
// module is a shipped, working production path for the staff scanner and
// admin scan page, and stays completely untouched so nothing here can
// regress it.
//
// `station_id` (from getOrCreateDeviceId) is a per-device random id
// generated once and persisted locally -- a placeholder for the real
// kiosk_stations.id that Stage 3 introduces. Callers should treat this as
// an opaque string; Stage 3's job is to swap the *source* of this value,
// not the ScanLogEntry.station_id field itself.

import { openDB, type IDBPDatabase } from "idb"
import * as Sentry from "@sentry/nextjs"
import type { CachedDelegate } from "./kiosk-delegate-match"

export type { CachedDelegate }

const DB_NAME = "amasi-kiosk-offline"
const VERSION = 2
const META_STORE = "meta"
const DELEGATE_STORE = "delegate_cache"
const SCAN_STORE = "scan_log"
const PRINT_TEMPLATE_STORE = "print_template_cache"
const PRINT_LOG_STORE = "print_log"

interface StoredDelegate extends CachedDelegate {
  list_id: string
}

interface MetaRow {
  key: string
  value: string | number
}

export interface ScanLogEntry {
  scan_id: string
  station_id: string
  list_id: string
  delegate_code: string
  scanned_at: number
  status: "pending" | "synced" | "conflict"
  registration_id: string
  registration_snapshot: CachedDelegate
  attempts: number
  last_attempt_at?: number
  last_error?: string
  server_response?: unknown
}

export interface CachedPrintTemplate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  badgeTemplate: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  printSettings: any
  printStationId: string
  // Every element with an imageUrl in badgeTemplate.elements has that URL
  // pre-fetched and inlined as a data: URL in this map (imageUrl -> data URL)
  // before caching, so rendering at print time has zero network dependency.
  imageDataUrls: Record<string, string>
  // print_stations.print_mode ("label" | "overlay" | "full_badge") --
  // cached alongside the template so printBadge's generatePrintContent call
  // can render overlay mode correctly (transparent background, design
  // elements stripped) without a live lookup at print time. Optional since
  // some callers may not have this available yet.
  printMode?: string
  // events.name at cache time -- the live event query has no offline
  // persistence, so printing while offline needs this cached copy for
  // {{event_name}} placeholders rather than relying on a query that will be
  // undefined offline.
  eventName?: string
  cachedAt: number
}

export interface PrintLogEntry {
  print_id: string
  list_id: string
  registration_id: string
  printed_at: number
  status: "success" | "failed"
  synced: boolean
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" })
        }
        if (!db.objectStoreNames.contains(DELEGATE_STORE)) {
          // Compound key (list_id, id) ensures each delegate per list is a distinct row.
          // Same registration can appear on multiple checkin_lists (per AMASI model);
          // single "id" key would cause overwrites if same delegate cached on two lists.
          const store = db.createObjectStore(DELEGATE_STORE, { keyPath: ["list_id", "id"] })
          store.createIndex("by_list", "list_id")
        }
        if (!db.objectStoreNames.contains(SCAN_STORE)) {
          const store = db.createObjectStore(SCAN_STORE, { keyPath: "scan_id" })
          store.createIndex("by_status", "status")
        }
        if (!db.objectStoreNames.contains(PRINT_TEMPLATE_STORE)) {
          db.createObjectStore(PRINT_TEMPLATE_STORE, { keyPath: "list_id" })
        }
        if (!db.objectStoreNames.contains(PRINT_LOG_STORE)) {
          const store = db.createObjectStore(PRINT_LOG_STORE, { keyPath: "print_id" })
          store.createIndex("by_list", "list_id")
          store.createIndex("by_registration", ["list_id", "registration_id"])
        }
      },
      // Without these, a VERSION bump can hang the whole kiosk bootstrap
      // forever: if another browser tab on this device still holds an open
      // connection to the OLD database version (e.g. a kiosk tab left open
      // from before this deploy), openDB at the new VERSION neither resolves
      // nor rejects by default -- it just blocks -- so getOrCreateDeviceId()
      // (called during bootstrap) never returns and the entire kiosk,
      // including the base check-in flow, hangs on "Loading..." forever
      // with no error and no Sentry event.
      blocking() {
        // This tab holds an old version open in another tab context --
        // close it so the newer tab's upgrade can proceed instead of
        // hanging forever.
        void dbPromise?.then((db) => db.close())
      },
      blocked() {
        Sentry.captureMessage("kiosk IndexedDB upgrade blocked by another open tab", { tags: { module: "kiosk-offline-store" } })
      },
    })
  }
  return dbPromise
}

// Shared UUID generator for both `station_id` (below) and the kiosk page's
// `scan_id` -- a single implementation, not two duplicated ones, exported so
// src/app/kiosk/[eventId]/[listId]/page.tsx can use the exact same fallback.
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for browsers without crypto.randomUUID -- must still be
  // UUID-shaped: scan_id is validated server-side (Stage 2) and a
  // malformed fallback here would 400 every scan on this device.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// --- Device identity ---------------------------------------------------

export async function getOrCreateDeviceId(): Promise<string> {
  const db = await getDb()
  const existing = (await db.get(META_STORE, "device_id")) as MetaRow | undefined
  if (existing) return existing.value as string

  const id = newId()
  await db.put(META_STORE, { key: "device_id", value: id } satisfies MetaRow)
  return id
}

// --- Delegate cache ------------------------------------------------------

export async function replaceDelegateCache(listId: string, delegates: CachedDelegate[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(DELEGATE_STORE, "readwrite")
  const index = tx.store.index("by_list")
  let cursor = await index.openCursor(IDBKeyRange.only(listId))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  for (const delegate of delegates) {
    await tx.store.put({ ...delegate, list_id: listId } satisfies StoredDelegate)
  }
  await tx.done

  const metaDb = await getDb()
  await metaDb.put(META_STORE, { key: `cache_updated_at:${listId}`, value: Date.now() } satisfies MetaRow)
}

export async function getDelegateCache(listId: string): Promise<CachedDelegate[]> {
  const db = await getDb()
  const rows = (await db.getAllFromIndex(DELEGATE_STORE, "by_list", listId)) as StoredDelegate[]
  return rows.map(({ list_id: _listId, ...delegate }) => delegate)
}

export async function getCacheUpdatedAt(listId: string): Promise<number | null> {
  const db = await getDb()
  const row = (await db.get(META_STORE, `cache_updated_at:${listId}`)) as MetaRow | undefined
  return row ? (row.value as number) : null
}

// --- Scan log --------------------------------------------------------------

export async function enqueueScan(entry: Omit<ScanLogEntry, "status" | "attempts">): Promise<void> {
  const db = await getDb()
  await db.put(SCAN_STORE, { ...entry, status: "pending", attempts: 0 } satisfies ScanLogEntry)
}

export async function getPendingScans(listId: string): Promise<ScanLogEntry[]> {
  const db = await getDb()
  const rows = (await db.getAllFromIndex(SCAN_STORE, "by_status", "pending")) as ScanLogEntry[]
  return rows.filter((r) => r.list_id === listId).sort((a, b) => a.scanned_at - b.scanned_at)
}

export async function getPendingScanCount(listId: string): Promise<number> {
  return (await getPendingScans(listId)).length
}

export async function recordScanAttempt(scanId: string, attempts: number, lastError: string): Promise<void> {
  const db = await getDb()
  const entry = (await db.get(SCAN_STORE, scanId)) as ScanLogEntry | undefined
  if (!entry) return
  await db.put(SCAN_STORE, { ...entry, attempts, last_attempt_at: Date.now(), last_error: lastError } satisfies ScanLogEntry)
}

export async function markScanSynced(scanId: string, serverResponse: unknown): Promise<void> {
  const db = await getDb()
  const entry = (await db.get(SCAN_STORE, scanId)) as ScanLogEntry | undefined
  if (!entry) return
  await db.put(SCAN_STORE, { ...entry, status: "synced", server_response: serverResponse } satisfies ScanLogEntry)
}

export async function markScanConflict(scanId: string, serverResponse: unknown): Promise<void> {
  const db = await getDb()
  const entry = (await db.get(SCAN_STORE, scanId)) as ScanLogEntry | undefined
  if (!entry) return
  await db.put(SCAN_STORE, { ...entry, status: "conflict", server_response: serverResponse } satisfies ScanLogEntry)
}

// --- Print template cache -------------------------------------------------

export async function cachePrintTemplate(listId: string, template: CachedPrintTemplate): Promise<void> {
  const db = await getDb()
  await db.put(PRINT_TEMPLATE_STORE, { list_id: listId, ...template })
}

export async function getPrintTemplate(listId: string): Promise<CachedPrintTemplate | null> {
  const db = await getDb()
  const row = await db.get(PRINT_TEMPLATE_STORE, listId)
  if (!row) return null
  const { list_id: _listId, ...template } = row
  return template as CachedPrintTemplate
}

// --- Print log (local reprint-check + eventual print_jobs sync) ----------

export async function recordPrintOutcome(
  entry: Omit<PrintLogEntry, "status" | "synced">,
  status: "success" | "failed"
): Promise<void> {
  const db = await getDb()
  await db.put(PRINT_LOG_STORE, { ...entry, status, synced: false } satisfies PrintLogEntry)
}

export async function getLastPrintForRegistration(listId: string, registrationId: string): Promise<PrintLogEntry | null> {
  const db = await getDb()
  const rows = (await db.getAllFromIndex(PRINT_LOG_STORE, "by_registration", [listId, registrationId])) as PrintLogEntry[]
  if (rows.length === 0) return null
  return rows.reduce((latest, row) => (row.printed_at > latest.printed_at ? row : latest))
}

export async function getPendingPrintSyncs(listId: string): Promise<PrintLogEntry[]> {
  const db = await getDb()
  const rows = (await db.getAllFromIndex(PRINT_LOG_STORE, "by_list", listId)) as PrintLogEntry[]
  return rows.filter((r) => !r.synced)
}

export async function markPrintSynced(printId: string): Promise<void> {
  const db = await getDb()
  const entry = (await db.get(PRINT_LOG_STORE, printId)) as PrintLogEntry | undefined
  if (!entry) return
  await db.put(PRINT_LOG_STORE, { ...entry, synced: true })
}

// --- Retention -------------------------------------------------------------
//
// A device reused across many events/lists over time never had anything
// removing OLD data: replaceDelegateCache only clears rows for the list_id
// it's currently refreshing, and scan_log/print_log entries are never
// deleted once synced. Left unchecked, IndexedDB usage on a long-lived
// kiosk device grows without bound. This is a best-effort prune, called
// once per bootstrap -- never awaited by anything that would block
// check-in, and a failure here must never surface as a check-in failure.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function pruneStaleData(now: number = Date.now()): Promise<void> {
  const db = await getDb()
  const cutoff = now - RETENTION_MS

  // Stale lists: any list_id whose cache_updated_at meta key is older than
  // the retention window is a list this device hasn't served in a month --
  // safe to drop that list's delegate cache and print template. The meta
  // key itself is deleted too, so a list that genuinely comes back into use
  // later just re-populates from scratch on its next refresh, same as a
  // brand-new device would.
  const allMeta = (await db.getAll(META_STORE)) as MetaRow[]
  const staleListIds = allMeta
    .filter((row) => row.key.startsWith("cache_updated_at:") && (row.value as number) < cutoff)
    .map((row) => row.key.slice("cache_updated_at:".length))

  for (const listId of staleListIds) {
    const tx = db.transaction(DELEGATE_STORE, "readwrite")
    const index = tx.store.index("by_list")
    let cursor = await index.openCursor(IDBKeyRange.only(listId))
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }
    await tx.done
    await db.delete(PRINT_TEMPLATE_STORE, listId)
    await db.delete(META_STORE, `cache_updated_at:${listId}`)
  }

  // Synced scan_log entries are already durably recorded server-side --
  // safe to drop locally once old. "pending"/"conflict" entries are never
  // touched here regardless of age.
  const scanTx = db.transaction(SCAN_STORE, "readwrite")
  const scanIndex = scanTx.store.index("by_status")
  let scanCursor = await scanIndex.openCursor(IDBKeyRange.only("synced"))
  while (scanCursor) {
    const entry = scanCursor.value as ScanLogEntry
    if (entry.scanned_at < cutoff) await scanCursor.delete()
    scanCursor = await scanCursor.continue()
  }
  await scanTx.done

  // Synced print_log entries -- same reasoning as scan_log above.
  const printRows = (await db.getAll(PRINT_LOG_STORE)) as PrintLogEntry[]
  for (const row of printRows) {
    if (row.synced && row.printed_at < cutoff) {
      await db.delete(PRINT_LOG_STORE, row.print_id)
    }
  }
}
