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
import type { CachedDelegate } from "./kiosk-delegate-match"

export type { CachedDelegate }

const DB_NAME = "amasi-kiosk-offline"
const VERSION = 1
const META_STORE = "meta"
const DELEGATE_STORE = "delegate_cache"
const SCAN_STORE = "scan_log"

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
