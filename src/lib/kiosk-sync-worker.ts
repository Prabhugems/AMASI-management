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

type EntryOutcome =
  | { kind: "synced"; response: unknown }
  | { kind: "conflict"; response: unknown }
  | { kind: "retry-break" }
  | { kind: "retry-continue" }

/**
 * One drain pass over the pending queue for `listId`. `onSynced`/
 * `onConflict` run AFTER the store transition and outside any try/catch --
 * if a callback throws (e.g. a UI sound-effect failure), it must not
 * rewrite or double-count an outcome that's already been committed to
 * IndexedDB.
 *
 * `retry-break` (429, a genuine network failure, or an unparseable
 * response body) stops the whole pass -- these indicate the connection or
 * the server as a whole is currently unable to help, so trying the rest of
 * the queue right now would just churn. `retry-continue` (a 5xx on this
 * one entry) does NOT stop the pass -- a 5xx is a plausible per-entry,
 * deterministic failure (e.g. a DB constraint violation on that specific
 * registration), and treating it as queue-wide would let one poison entry
 * block every other queued scan indefinitely, since it's retried first on
 * every future pass (oldest-first ordering).
 */
export async function drainScanQueue(
  listId: string,
  eventId: string,
  // Stage 3: when this device was provisioned via /kiosk-station/[token],
  // this is that station's own token -- forwarded so the server can attribute
  // each synced check-in to a real kiosk_stations row (see checkin/route.ts).
  // undefined for the original direct-URL (checkin_lists.access_token) path,
  // where there is no station to attribute to.
  stationToken: string | undefined,
  // The target list's own checkin_lists.access_token -- the direct-URL
  // kiosk path's credential. Required by /api/kiosk/checkin whenever
  // stationToken is absent (bug-audit fix, 2026-08: this route previously
  // accepted a check-in from anyone who knew the event/list id alone).
  // undefined on the station path, which authorizes via stationToken instead.
  token: string | undefined,
  onSynced: (entry: ScanLogEntry, response: unknown) => void,
  onConflict: (entry: ScanLogEntry, response: unknown) => void
): Promise<{ synced: number; conflicted: number; remaining: number }> {
  const pending = await getPendingScans(listId)
  let synced = 0
  let conflicted = 0

  for (const entry of pending) {
    if (!isEligibleForRetry(entry)) continue

    let outcome: EntryOutcome

    try {
      const res = await fetchWithTimeout("/api/kiosk/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          checkin_list_id: listId,
          registration_id: entry.registration_id,
          search: entry.delegate_code,
          scan_id: entry.scan_id,
          ...(stationToken && { station_token: stationToken }),
          ...(token && { token }),
        }),
      })
      // No .catch(() => ({})) here -- an unparseable body (e.g. a captive
      // WiFi portal serving an HTML login page over what looked like a
      // successful connection) must not be silently treated as `{}` and
      // fall through to a permanent, unreported "conflict". Let it throw
      // into the catch block below, where it's retried and reported.
      const data = (await res.json()) as CheckinApiResponse

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
        // Our own rate limit -- a burst of queued scans syncing on
        // reconnect can plausibly exceed /api/kiosk/checkin's 30/min
        // "public" tier. Queue-wide: stop this pass.
        await recordScanAttempt(entry.scan_id, entry.attempts + 1, data.message || `HTTP ${res.status}`)
        outcome = { kind: "retry-break" }
      } else if (res.status >= 500) {
        // Per-entry, not queue-wide -- see the function-level comment.
        await recordScanAttempt(entry.scan_id, entry.attempts + 1, data.message || `HTTP ${res.status}`)
        outcome = { kind: "retry-continue" }
      } else {
        // A genuine terminal business-logic rejection (e.g. 403
        // collection-list block, 404 for a registration that existed when
        // cached but was since removed) -- retrying won't change the
        // outcome, so surface it for admin review instead.
        await markScanConflict(entry.scan_id, data)
        outcome = { kind: "conflict", response: data }
      }
    } catch (err) {
      if (isNetworkFailure(err)) {
        // Routine, expected for an offline-first kiosk -- no Sentry report.
        await recordScanAttempt(entry.scan_id, entry.attempts + 1, err instanceof Error ? err.message : String(err))
        outcome = { kind: "retry-break" }
      } else if (err instanceof SyntaxError) {
        // res.json() couldn't parse the body -- see the comment above the
        // call. Retryable (whatever intercepted this response may not
        // intercept the next attempt), but worth knowing about.
        Sentry.captureException(err, { tags: { module: "kiosk-sync-worker" }, extra: { scanId: entry.scan_id, listId } })
        await recordScanAttempt(entry.scan_id, entry.attempts + 1, err.message)
        outcome = { kind: "retry-break" }
      } else {
        // Not a network failure -- something unexpected. Never leave this
        // pending forever on a repeat identical error (a "poison row"
        // retried infinitely on every drain pass) -- same reasoning as
        // offline-scan-queue.ts's flushQueue treating a non-network throw
        // as terminal. Unlike that queue, nothing here is ever deleted:
        // route it to "conflict" for admin review instead of losing it.
        const message = err instanceof Error ? err.message : String(err)
        Sentry.captureException(err, { tags: { module: "kiosk-sync-worker" }, extra: { scanId: entry.scan_id, listId } })
        await markScanConflict(entry.scan_id, { error: message })
        outcome = { kind: "conflict", response: { error: message } }
      }
    }

    // Callbacks run after the store transition is already committed, and
    // outside any try/catch -- a throwing callback must not rewrite or
    // double-count an outcome that IndexedDB already has on record.
    if (outcome.kind === "synced") {
      synced++
      onSynced(entry, outcome.response)
    } else if (outcome.kind === "conflict") {
      conflicted++
      onConflict(entry, outcome.response)
    }

    if (outcome.kind === "retry-break") break
    // "retry-continue" falls through to the next entry in this same pass.
  }

  const remaining = (await getPendingScans(listId)).length
  return { synced, conflicted, remaining }
}
