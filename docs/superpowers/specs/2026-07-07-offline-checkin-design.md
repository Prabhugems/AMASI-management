# Offline-Capable Check-In — Design

Date: 2026-07-07
Status: Approved (design), pending implementation plan

## Problem

Staff check in delegates/faculty at event venues using `/events/[eventId]/checkin/[listId]/scan` on mobile devices. Connectivity at venues is **patchy/slow, not fully dead** — signal drops in and out but is rarely absent for long stretches. Today, when a scan's `POST /api/checkin` fails due to network issues, the check-in is simply lost; the volunteer sees an error and must retry once signal returns, with no memory that the earlier attempt happened.

## Scope

- **In scope:** `/events/[eventId]/checkin/[listId]/scan` only.
- **Out of scope:** `/api/checkin` route logic, DB schema, `checkin_records` table, and `/events/[eventId]/checkin/attendees` (a read-only search/badge view with no check-in action today — left untouched).
- No backend changes, with one explicit exception considered and declined (see "Timestamp decision" below).

## Architecture

Three new client-side pieces live in `src/lib/offline-checkin/`, backed by IndexedDB (native, no new dependency):

1. **Attendee cache** — a local snapshot of the active check-in list's attendees, enabling instant name/photo match on scan even with zero connectivity.
2. **Pending queue** — every check-in/check-out action is durably queued locally before the network attempt; only cleared on confirmed server outcome.
3. **Sync engine** — drains the queue against the real `/api/checkin` endpoint automatically, in order, whenever connectivity is available.

`/api/checkin`'s existing idempotent duplicate handling (unique constraint on `(checkin_list_id, registration_id)` + `23505` race catch, `route.ts:381-395`) is what makes safe replay possible without any server change — see "Duplicate check-in flow" below.

## 1. Active list label (required)

Each scan station is locked to one list via `[listId]`, but nothing on screen names it today. A device left on the wrong list (e.g. entrance list active at a session door) silently records nothing for that session while showing plausible-looking "already checked in" results.

**Change:** persistent header label, e.g. `Scanning: Hall A — Session 3`, fetched once on load from the list metadata the page already resolves, visible at all times including offline.

**Acceptance:** a volunteer can read the active list name without tapping anything, on every scan.

## 2. Attendee cache

On page load, and via a manual "🔄 Refresh list" button:
- Call `/api/checkin?event_id&checkin_list_id` in a loop across pages, storing every row (`id`, `registration_number`, `attendee_name`, `attendee_email`, `ticket_types.name`, `attendee_institution`, current `checked_in` state) into an IndexedDB store `attendees`, keyed by `registration_number`.
- **Loop termination:** keep paging while a page returns a full page of results; stop on a short/empty page. No fixed count cap — a hard cap risked truncating a large list and showing real attendees as "not found" offline. Largest list/event observed today is 273 registrations; the loop is capped only by a generous safety ceiling of 25,000 records to guard against an infinite-loop bug, not as an expected limit.
- This is a **snapshot**: refreshed on load/manual refresh only. New registrations added mid-event won't appear until the next refresh — acceptable since it's a one-tap action once back online.

## 3. Scan handling

For every scan/manual entry:
1. Existing dedupe guard (`lastSubmitRef`, burst detection) — unchanged.
2. Look up the value in the local `attendees` cache.
   - Not found locally → "Not found — check spelling or refresh list."
   - Found → proceed.
3. **Connectivity check before attempting network** (addendum #2): if `navigator.onLine === false`, skip the fetch entirely and go straight to queuing — no perceptible delay for volunteers at a busy door during a real dead zone. Otherwise, try the network first with a short ~3s timeout (handles flaky-but-present signal correctly, matching today's behavior when connectivity is good).
4. Network success → handle exactly as today (`checked_in` / `already_checked_in` / `already_checked_out` / real error).
5. Network failure (timeout, fetch error, or `navigator.onLine === false`) — **not** a business-logic 4xx like "registration not confirmed," which is a real rejection and surfaces immediately:
   - Write to `pending_actions`: `{ id (uuid), registration_number, action, event_id, checkin_list_id, queued_at, attempts: 0 }`.
   - **Mark the attendee checked-in in the local cache immediately** (addendum confirmation a). If the *same volunteer* re-scans the same badge while still offline, the second scan resolves to "already checked in" from the local cache and does **not** create a second pending action.
   - Show the same success UI as an online check-in, plus a "⏳ pending sync" tag.

## 4. Sync engine

- **Triggers:** browser `online` event, `setInterval` every 10s while `pending_actions` is non-empty, manual "Sync now" button.
- **Guard:** a `syncing` ref ensures only one pass runs at a time, so the interval and `online` event can't race each other.
- **Order:** oldest-first, one request at a time — this ordering is what makes the duplicate-check-in guarantee (below) hold.
- **Per item:**
  - `success: true` (`checked_in` **or** `already_checked_in`/`already_checked_out`) → remove from queue, reconcile local cache with the server's returned `registration` object (authoritative).
  - Network failure again → leave queued, `attempts += 1`, **stop the pass** (don't burn through the rest of the queue against a connection that's still down); retry on next trigger. Covers "connection drops mid-sync" (addendum test case) with no duplicate rows and no lost items — the next trigger resumes from the same unprocessed item.
  - Genuine 4xx (e.g. registration cancelled since queuing) → remove from queue, surface a non-blocking banner ("2 queued check-ins couldn't sync — see details") rather than silently dropping it.

### Duplicate check-in flow (two devices, both offline)

Staff A and Staff B scan the same badge independently while both offline (see approved diagram). Both queue locally with optimistic success. Whichever syncs first performs the real `INSERT`; the second replay hits the DB unique constraint, which the existing route already catches (`23505`) and turns into an idempotent `already_checked_in` response. The sync engine treats that as a **success**, clears the queue entry, and reconciles the local cache — no duplicate row, no error shown to Staff B. This holds regardless of which device syncs first, because the server-side guarantee is order-independent.

## 5. UI additions

- Header connectivity icon (`Wifi`/`WifiOff`) becomes functional (already partially exists, was cosmetic) plus a pending-count badge, e.g. `⏳ 3 pending`.
- Active list label (item 1).
- Recent Scans entries show "synced ✓" / "pending ⏳", flipping when sync confirms.
- "Sync now" button beside the connectivity icon, disabled when the queue is empty.
- Fully-online behavior is unchanged — a volunteer with good signal throughout sees no behavioral difference from today.

## 6. Surviving a page reload while offline

Connectivity is patchy, not dead, so this is a smaller risk, but a reload during a dead spot must still load the app shell. Following this repo's existing pattern (`public/app-sw.js`, `public/sw.js` for `/print`):
- Extend `app-sw.js`'s scope, or add an isolated `checkin-sw.js`, to precache the `/events/*/checkin/*/scan` shell only — never `/api/*`, never Supabase — same network-first-with-offline-fallback approach already documented in that file.
- `pending_actions` and the `attendees` cache live in IndexedDB, independent of the service worker, so queued data is never at risk from a reload.

## Timestamp decision

Because `/api/checkin` is unchanged, the DB records **sync time**, not **scan time** — e.g. a 09:00 scan that syncs at 09:06 is stored as 09:06.

**Decided:** sync time is acceptable. No `queued_at`-as-`checked_in_at` change to `/api/checkin`. If precise arrival timing or per-session CME-hour accuracy becomes a requirement later, this is the one change that would touch the server route and would need its own follow-up.

## Testing plan

- **Unit:** queue add/remove/reorder logic; the "success vs already vs real error" classification function (pure, testable in isolation).
- **Manual/browser:**
  - Chrome DevTools → Network → Offline toggle: scan offline → optimistic success → go online → confirm sync → confirm `checkin_records` row count is exactly 1.
  - Two-device duplicate scenario (two browser profiles) matching the approved diagram.
  - **Flaky/intermittent signal** — requests timing out and recovering, not only the hard offline toggle (addendum test case).
  - **Connection drops mid-sync** while the queue is draining — confirm the pass stops cleanly after the first failure and resumes on the next trigger, with no duplicate rows and no lost items (addendum test case).
  - Same-volunteer double-scan of one badge while offline — confirm only one `pending_actions` entry is created (addendum confirmation a).
  - iPhone Safari specifically — no Background Sync dependency, so IndexedDB + retry-on-`online`-event should behave identically to Chrome/Android; worth confirming directly since it's the device most likely to be excluded by a naive design.

## Explicitly out of scope

- `/events/[eventId]/checkin/attendees` — remains a read-only list; no check-in action added.
- Any Service Worker Background Sync API usage — rejected due to no iOS Safari support.
- `queued_at`-based server-side timestamp correction — declined per the timestamp decision above.
