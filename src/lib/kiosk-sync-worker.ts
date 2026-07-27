// Background sync for the self-check-in kiosk's offline scan log (Stage 1,
// docs/superpowers/plans/2026-07-27-kiosk-offline-first-stage1.md). Drains
// src/lib/kiosk-offline-store.ts's scan_log oldest-first, retrying
// indefinitely with exponential backoff -- this never gives up on a queued
// scan the way the old inline-retry-then-enqueue logic in the kiosk page
// used to cap out after 2 attempts.
//
// "Conflict" here means the server's answer disagreed with what the
// attendee already saw on the tablet (e.g. alreadyCheckedIn=true when the
// tablet resolved this as a fresh check-in from its cache, most likely
// because they were also checked in at a different station moments
// earlier). Per the redesign brief: never retroactively change what the
// volunteer/attendee already saw -- the badge notification already went
// out. This just flags it for the admin view (a later stage's job to
// surface); Stage 1 only needs to *record* the conflict correctly.

import * as Sentry from "@sentry/nextjs"
import { fetchWithTimeout } from "./fetch-with-timeout"
import { isNetworkFailure } from "./offline-scan-queue"
import {
  getPendingScans,
  recordScanAttempt,
  markScanSynced,
  markScanConflict,
  type ScanLogEntry,
} from "./kiosk-offline-store"

const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30000

export function computeBackoffMs(attempts: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS)
}

function isEligibleForRetry(entry: ScanLogEntry): boolean {
  if (!entry.last_attempt_at) return true
  return Date.now() - entry.last_attempt_at >= computeBackoffMs(entry.attempts)
}

interface CheckinApiResponse {
  success?: boolean
  alreadyCheckedIn?: boolean
  registration?: { id: string }
  message?: string
}

/**
 * One drain pass over the pending queue for `listId`. Stops at the first
 * network failure (we're likely still offline) so repeated calls (on an
 * interval, on the browser's `online` event) don't churn the queue --
 * matches the existing convention in offline-scan-queue.ts's flushQueue.
 */
export async function drainScanQueue(
  listId: string,
  eventId: string,
  onSynced: (entry: ScanLogEntry, response: unknown) => void,
  onConflict: (entry: ScanLogEntry, response: unknown) => void
): Promise<{ synced: number; conflicted: number; remaining: number }> {
  const pending = await getPendingScans(listId)
  let synced = 0
  let conflicted = 0

  for (const entry of pending) {
    if (!isEligibleForRetry(entry)) continue

    try {
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
      const data = (await res.json().catch(() => ({}))) as CheckinApiResponse

      if (res.ok && data.success) {
        const conflictsWithLocalView =
          data.alreadyCheckedIn === true || (data.registration && data.registration.id !== entry.registration_id)
        if (conflictsWithLocalView) {
          await markScanConflict(entry.scan_id, data)
          conflicted++
          onConflict(entry, data)
        } else {
          await markScanSynced(entry.scan_id, data)
          synced++
          onSynced(entry, data)
        }
      } else if (res.status === 429 || res.status >= 500) {
        // Transient: our own rate limit (a burst of queued scans syncing
        // on reconnect can plausibly exceed /api/kiosk/checkin's 30/min
        // "public" tier) or a temporary server error. Retry with backoff
        // like a network failure -- marking this "conflict" would be a
        // dead end, since conflicts are never retried, and would silently
        // and permanently fail to sync a perfectly legitimate check-in.
        await recordScanAttempt(entry.scan_id, entry.attempts + 1, data.message || `HTTP ${res.status}`)
        break
      } else {
        // A genuine terminal business-logic rejection (e.g. 403
        // collection-list block, 404 for a registration that existed when
        // cached but was since removed) -- retrying won't change the
        // outcome, so surface it for admin review instead.
        await markScanConflict(entry.scan_id, data)
        conflicted++
        onConflict(entry, data)
      }
    } catch (err) {
      if (isNetworkFailure(err)) {
        await recordScanAttempt(entry.scan_id, entry.attempts + 1, err instanceof Error ? err.message : String(err))
        break
      }
      // Not a network failure -- something unexpected (e.g. a JSON parse
      // throw). Never leave this pending forever on a repeat identical
      // error (a "poison row" retried infinitely on every drain pass) --
      // same reasoning as offline-scan-queue.ts's flushQueue treating a
      // non-network throw as terminal. Unlike that queue, nothing here is
      // ever deleted: route it to "conflict" for admin review instead of
      // losing it.
      const message = err instanceof Error ? err.message : String(err)
      Sentry.captureException(err, { tags: { module: "kiosk-sync-worker" }, extra: { scanId: entry.scan_id, listId } })
      await markScanConflict(entry.scan_id, { error: message })
      conflicted++
      onConflict(entry, { error: message })
    }
  }

  const remaining = (await getPendingScans(listId)).length
  return { synced, conflicted, remaining }
}
