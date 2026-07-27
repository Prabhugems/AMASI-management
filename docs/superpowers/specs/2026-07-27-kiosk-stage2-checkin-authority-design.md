# Kiosk Stage 2 — Server-Side Check-In Authority Design

**Date:** 2026-07-27
**Status:** Approved for planning

## Context

Stage 1 (`docs/superpowers/plans/2026-07-27-kiosk-offline-first-stage1.md`, merged to `main` in PR #119) made the self-check-in kiosk local-first: `handleCheckin` resolves a scan against an on-device delegate cache and queues it in IndexedDB; `kiosk-sync-worker.ts` drains that queue in the background, POSTing each entry to `POST /api/kiosk/checkin`.

That route was never changed in Stage 1 — deliberately. It still does what it did before this whole redesign: a fuzzy `.or()` search across `registration_number`/`attendee_email`/`attendee_name`/`attendee_phone`, scoped only by `event_id`, with no `ticket_type_ids`/`addon_ids` filtering. It also doesn't read the `scan_id` field the sync worker already sends on every request, or the `registration_id` Stage 1's local cache already resolved before enqueueing.

Two consequences fall out of that gap, both already documented as deferred-to-Stage-2 in Stage 1's own plan and final review:

1. **No idempotent replay.** A retried POST (lost response, sync worker resend) can't be distinguished from a fresh scan except by the pre-existing `UNIQUE(checkin_list_id, registration_id)` constraint — which works, but reports the retry as `alreadyCheckedIn: true` even when it's really the same successful scan reporting again.
2. **`registrationMismatch` risk.** The client already knows who it thinks this is (`registration_id`, resolved locally); the server re-derives its own answer via fuzzy search and can, in principle, disagree. Stage 1's sync worker detects this (`registrationMismatch`, Sentry-logged) but can't prevent it.

The schema for `scan_id`-based idempotency already exists — `checkin_records.scan_id uuid`, unique index `where scan_id is not null` — migrated in Stage 1 (`supabase/migrations/20260727_kiosk_scan_id_and_kiosk_stations.sql`). This stage is pure application logic against existing schema; **no new migration**.

## Goal

Make `/api/kiosk/checkin` trust the client's resolved identity instead of re-deriving it, make replays of the same scan deterministic, and close an authorization gap this change surfaces along the way.

## Design

### 1. Request/response contract

**Request body** (POST `/api/kiosk/checkin`):

```
{
  event_id: string
  checkin_list_id: string
  registration_id: string   // NEW — client's locally-resolved match
  scan_id: string           // already sent since Stage 1, was never read
  search: string            // kept, but now only for error-message/Sentry context — never used for matching
}
```

`kiosk-sync-worker.ts` adds `registration_id: entry.registration_id` to the POST body it already builds (`ScanLogEntry.registration_id` has existed since Stage 1's Task 3 — it just wasn't forwarded).

**Server-side flow, in order:**

1. **`scan_id` lookup first.** `SELECT` `checkin_records` by `scan_id`. If a row exists, this is a replay — skip every check below and go straight to "Replay response" (see §3). `registration_id` in this request is not consulted at all on this path.
2. **No `scan_id` match → resolve `registration_id` directly.** `SELECT registrations WHERE id = :registration_id AND event_id = :event_id`. Not found, or belongs to a different event → **404** (see §2, terminal).
3. **Authorization: confirm eligibility for *this* list**, not just the event (see §2). Fails → **404**, same message/status as step 2 — the response never distinguishes "doesn't exist" / "wrong event" / "not eligible for this list."
4. **`list_purpose === "collection"`** → **403**, unchanged from today.
5. **Existing-active-record check**, unchanged from today: same `(checkin_list_id, registration_id)`, not checked out → return `alreadyCheckedIn: true` (this is the "already checked in via a different scan_id, e.g. staff scanner" case — no `scan_id` backfill onto that row).
6. **Insert**, now actually persisting `scan_id` (today's route doesn't). Existing `23505` race handling unchanged, with one addition (see §4).

Steps 3–4 (authorization, collection-purpose gate) and the time-window check run **only** on the fresh-resolution path (steps 2–6) — never on a `scan_id` replay (step 1). Those are pre-insert gates; re-running them against an outcome that's already recorded could make a previously-successful check-in report differently on a later replay (e.g. if the list's time window lapsed between the original attempt and a retry), which would be wrong. A replay always reports what actually happened the first time.

### 2. Authorization: list eligibility, not just event membership

**This is a deliberate behavior change to a live, already-shipped endpoint — not a bug fix Stage 2 happens to include.** Today, `/api/kiosk/checkin`'s fuzzy search (and Task 1's bulk roster endpoint, which intentionally mirrors this exact scope) both apply zero `ticket_type_ids`/`addon_ids` filtering: any registration in the event matches, regardless of which list is being checked into. Moving resolution to the client makes this gap concrete and worth closing now: a list's own `access_token` is list-scoped, but without this check, holding one list's token would let someone check in any delegate in the whole event, including ones that list was never meant to admit.

The eligibility check mirrors the canonical pattern already used elsewhere in this app for the exact same computation (`src/app/api/checkin/access/[accessToken]/attendees/route.ts:49-84`) — not reinvented:

- If `checkin_lists.ticket_type_ids` is non-empty, `registrations.ticket_type_id` must be in that array.
- If `checkin_lists.addon_ids` is non-empty, the registration must have a matching row in `registration_addons` (`addon_id` in that array).
- Both empty/null → unrestricted, matching existing convention everywhere else in the app.

Both filters combine with implicit AND, same as the reference implementation.

### 3. Replay response — deterministic, verbatim

On a `scan_id` hit, re-fetch the registration fresh (in case attendee details changed since), but return the **original recorded outcome verbatim**:

- `success: true` (a recorded row is definitionally a successful check-in — nothing reaches this row that didn't).
- `message`: reconstructed from the row's own history, matching whichever branch produced it originally ("Check-in successful!" if it was a fresh insert; "You're already checked in!" if the original request itself landed on an already-checked-in registration).
- `alreadyCheckedIn`: the value from the *original* outcome, not re-derived. A fresh-insert's replay always reports `false`. An already-existing-checkin's replay always reports `true`. Same input → same answer, forever — made explicit in the code as its own branch, not left to fall out of shared control flow.

This also fixes a specific nuance Stage 1's plan flagged in `kiosk-sync-worker.ts`'s header comment: today, a resent request (lost response, sync worker retry) that actually succeeded the first time gets misclassified by the client as an `alreadyCheckedIn` conflict. With `scan_id` anchoring the replay to its original `alreadyCheckedIn: false` outcome, the sync worker's existing classification (`conflictsWithLocalView = alreadyCheckedIn === true || registrationMismatch`) now correctly resolves it as `synced`, not `conflict`.

### 4. `23505` race — accepted gap, documented not hidden

When two concurrent requests race on the unique `(checkin_list_id, registration_id)` constraint, the loser's insert fails with `23505` and the route returns the winner's outcome (unchanged from today) — but the winner's row was inserted by a *different* request, whose `scan_id` never gets attached to this one. That row's `scan_id` stays `null` permanently. The check-in itself is correct (the delegate is checked in, the response is correct) — but that specific scan can never afterwards be distinguished from a genuine cross-station duplicate by `scan_id` alone. Rare enough to accept without further engineering; the `23505` branch gets an explicit code comment saying exactly this, so a future reader doesn't mistake it for an oversight.

### 5. Client cleanup: `registrationMismatch` removed

`kiosk-sync-worker.ts`'s `registrationMismatch` detection (comparing `data.registration.id !== entry.registration_id`, Sentry-logged) becomes dead code once the server trusts `registration_id` directly — there's nothing left for the client to disagree with, since the server no longer independently re-derives a possibly-different match. Removed as part of this stage, not left in place to mislead a future reader into thinking mismatches are still possible.

### 6. Terminal vs. retryable — no client change required

Confirmed against `kiosk-sync-worker.ts`'s existing classification (built in Stage 1, unchanged by this stage): any response that is not `2xx`, not `429`, and not `>= 500` already routes to `markScanConflict` — terminal, never retried. This already covers the `404`/`403` cases above correctly. Stage 2 only needs the server to emit the right status codes; the sync worker's own retry/terminal logic requires no changes.

Explicitly **out of scope for this stage**: an admin-facing view of terminally-conflicted kiosk scans. Stage 1 already durably records a conflict in the kiosk's own IndexedDB (`markScanConflict`); there is no server-side or dashboard surface for it today, and building one is real, separate feature work for a later stage, not folded into this one.

## Out of scope

- Any UI for surfacing conflicted/terminal scans to admins (see above).
- `print_jobs.scan_id` enforcement — that column exists from the same Stage 1 migration but is explicitly Stage 3's concern (station identity / reprint logic), not this stage's.
- Any change to `kiosk_stations` or station identity — Stage 3.
- Schema changes — none needed; both `checkin_records.scan_id` and its unique index already exist.

## Testing

- `src/app/api/kiosk/checkin/route.test.ts` — new file; the route has existed since before Stage 1 and has zero test coverage today. Cover the `scan_id`-hit replay path (fresh-insert replay reports `alreadyCheckedIn: false`; already-checked-in replay reports `true`, verbatim on repeated calls), the eligibility-gate 404 (registration not on this list's `ticket_type_ids`/`addon_ids`), the wrong-event 404, the collection-purpose 403, and the `23505` race path.
- No new IndexedDB-touching code on the client side beyond the one-line `registration_id` addition to the sync worker's POST body — no new client-side test infrastructure needed.
