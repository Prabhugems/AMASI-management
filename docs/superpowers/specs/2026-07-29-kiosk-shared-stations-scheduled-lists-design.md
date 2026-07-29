# Kiosk stations — shared tablets, multi-list menu, scheduled windows

**Date:** 2026-07-29
**Status:** Approved for planning
**Source:** User-authored spec (`Kiosk Shared Stations Scheduled Lists Spec.md`), resolved against the current codebase via Explore + Plan agent verification and confirmed with the user.

## 1. Why this changes

Today a volunteer needs a different link for every check-in list. During a multi-day, multi-desk event that means they come to the admin for a URL, a QR, or a token every time the job changes — several times a day, across every desk.

New model: **one tablet, provisioned once, holds every list it might need.** The volunteer picks from a menu on the device. They never ask for a link again.

Second benefit: if all tablets are provisioned identically, any tablet can cover any desk. A device dies mid-shift, you hand over a spare, it works.

## 2. The cost this introduces, and the fix

Shared tablets make one new error possible: **a volunteer scanning into the wrong list.** Lunch guests recorded against Dinner for twenty minutes before anyone notices. Today this cannot happen because the link opens one list only.

**Fix: scheduled open/close windows per list.** Closed lists are visible but not tappable. There is no wrong list to tap, so the error is structurally prevented rather than merely warned against.

The menu and the schedule ship together. Do not build the multi-list menu without the windows — the menu alone is a regression in safety.

## 3. Vocabulary

- **Station** = the physical tablet. Has a name ("Print desk 2"), an identity on the admin dashboard, and a printer if one is plugged in.
- **List** = what the volunteer selects from the menu (Registration, Lunch).

The volunteer never needs to know the word "station." The admin does.

## 4. Current codebase state (verified, not assumed)

- `kiosk_stations` columns today: `id, event_id, name, mode, list_id, print_station_id, printer_config, exit_pin_hash, exit_pin_salt, last_seen_at, created_at, updated_at, access_token_hash, revoked_at, auto_print_badge`. `list_id` is a single nullable FK — not a set. `revoked_at` **already exists** (Stage 1) and is already enforced in three places (`kiosk-station/[token]/page.tsx`, `/api/kiosk/delegates`, `/api/kiosk/checkin`) — no new work needed there, contrary to the original spec draft's assumption it needed adding.
- `database.types.ts` has zero knowledge of `kiosk_stations` today — every route already casts `(supabase as any)`. Worth regenerating for the new table at least, as part of this work.
- `checkin_lists.starts_at`/`ends_at` already exist and already drive a **different, soft-warning-only** behavior live today via `src/lib/checkin-time-window.ts`, consumed in `/api/kiosk/checkin` (an early/late scan gets a warning attached to an otherwise-successful response, never a rejection). **Confirmed decision: do not reuse these for the new hard-gating schedule** — add separate `kiosk_opens_at`/`kiosk_closes_at`/`kiosk_force_state` columns instead, so nothing already configured on a live list silently starts hard-blocking.
- `KioskCheckinScreen` (`src/components/kiosk/KioskCheckinScreen.tsx`, ~1735 lines) takes a single required `listId: string` prop threaded through roughly 30 call sites. Retrofitting internal multi-list awareness would touch nearly every effect in the file — the plan avoids this (see §9).
- `src/lib/kiosk-offline-store.ts` (IndexedDB) is **already multi-list-safe**: delegate cache keyed `["list_id", "id"]`, print template cache keyed by `list_id`, print log indexed by `list_id`. No schema change needed here.
- `src/lib/kiosk-sync-worker.ts`'s `drainScanQueue(listId, eventId, stationToken, onSynced, onConflict)` drains one list's queue per call — needs looping, not rewriting.
- `/api/kiosk/delegates`'s `station_token` path and `/api/kiosk/checkin`'s attribution check both currently resolve/compare against exactly one `station.list_id` — these are the two places requiring the "one list" → "one of this station's assigned lists" change.
- Check-in list scheduling admin UI already lives on `src/app/events/[eventId]/checkin/lists/page.tsx` (already edits `starts_at`/`ends_at` there) — new schedule fields belong alongside them.
- No multi-select shadcn component exists in this repo — a checkbox-list-in-a-popover (reusing existing `checkbox.tsx`/`popover.tsx`) is the right fit, no new dependency.

## 5. Schema

### `kiosk_stations`

- Deprecate the single `list_id` as the source of truth for what a station serves (keep the column for now; drop it in a later, separate migration once every code path has moved off it).
- Add a join table: `kiosk_station_lists (station_id, checkin_list_id)` — many lists per station.
- Keep `printer_config`/`mode`/`print_station_id`/`auto_print_badge` on the station as today. One printer per station, shared by whichever list is active.
- `revoked_at` already exists — no change needed.

### `checkin_lists`

Add, as new and separate from `starts_at`/`ends_at`:

- `kiosk_opens_at timestamptz null`
- `kiosk_closes_at timestamptz null`
- `kiosk_force_state text null` — one of `'open'`, `'closed'`, or null

Null window bounds mean "no schedule on that side." All three are inert (resolve to "open") until an admin explicitly sets them — zero behavior change for any existing list.

**Migration must be additive.** Existing single-list stations keep working — backfill one join row per existing station's current `list_id`.

## 6. Mode and printing

`mode` stays a per-station property (`checkin | print | checkin_and_print`). It is orthogonal to the multi-list change — do not fold them together.

- **Registration desk** — `checkin_and_print`, entry list, printer attached
- **Food desk** — `checkin`, several collection lists, no printer

Printing is hardware-bound, not a setting: the printer must be physically attached to that tablet's USB hub. **Show print options only when a printer is actually detected connected** (not merely "this browser supports WebUSB") — composed from the existing `isWebUSBSupported()`/`isUsbPrinterConnected()`/`reconnectUsbPrinter()` exports in `src/lib/usb-printer.ts`, no new WebUSB primitives needed.

**Confirmed: no separate "print" menu tile, ever.** Picking a list from the menu always enters its check-in screen; if that station has a printer, today's existing Print Badge button/auto-print applies within that same screen, unchanged.

USB direct, Android only (unchanged from the prior stage's decision) — feature-detect `navigator.usb`; if absent, print UI never appears.

## 7. Open/closed logic

State resolution order:

1. `kiosk_force_state` if set — **always wins over the schedule**
2. Otherwise compute from `kiosk_opens_at`/`kiosk_closes_at` against device clock
3. No window set → open

**Computed on device, from the device clock.** A station offline all afternoon must still close Lunch at 3pm on its own — no server round trip.

Manual override (`kiosk_force_state`) is set from the admin dashboard and reaches tablets on the next sync (the same 5-minute cadence the roster/manifest already refreshes on) — not instantly. There is deliberately no push mechanism.

### Closing mid-shift

Do not eject a volunteer mid-queue.

- Show a banner at T-5 minutes: "Lunch closes in 5 minutes"
- At close time, return to the menu
- **Anything already scanned stays queued and syncs normally** — closing a list must never drop or block pending scans

## 8. Menu screen

Shows only lists assigned to *this* station (not every list in the event). Each row:

- List name (large)
- Sub-line: what it does, or when it opens/closes ("prints badge", "ended 9:30 am", "opens 7:00 pm")
- State on the right: Open / Closed

Closed rows are visible but **not tappable** — not hidden. The volunteer needs to see that Dinner exists and starts at 7, or they will come and ask.

## 9. Wrong-list defence on the scan screen

Even with windows, two lists can be open at once (Registration and Lunch). So the active list must be unmissable:

- **Active list name large and persistent** on the scan screen, not only in a footer
- Also in the persistent footer alongside station name, queue depth, and online/offline state
- Switching lists shows a confirmation — one tap, but a deliberate one

## 10. Client architecture

A new shell component (`KioskStationShell`) replaces what `/kiosk-station/[token]/page.tsx` renders, and owns:
- The set of assigned lists (fetched from a new `GET /api/kiosk/station-manifest?station_token=` endpoint) and which one is currently active (`null` = show the menu).
- Startup roster caching for **every** assigned list (looping the existing per-list `/api/kiosk/delegates` call), independent of which list is active.
- Its own `drainScanQueue` loop over all assigned lists, replacing `KioskCheckinScreen`'s internal 20s poll when running under the shell (a new `externallyDriven?: boolean` prop disables the component's own timer to avoid double-draining).

When a list is picked, render `<KioskCheckinScreen key={listId} listId={listId} ... />` exactly as today — keyed on the list id so switching cleanly unmounts/remounts rather than retrofitting multi-list state into an already-dense component. The direct-URL single-list path (`/kiosk/[eventId]/[listId]`) is untouched, out of scope.

Because `enqueueScan`/`getPendingScans` are already scoped by `list_id` as a field (not "which screen is showing"), a scan made on list A that's still pending when the volunteer switches to list B is drained by the shell's loop with zero special-casing.

## 11. Offline behaviour — non-negotiable

- **Cache every assigned list's roster at startup**, not just the active one. A volunteer switching from Lunch to Dinner while offline must not find an empty roster.
- **Switching lists must not touch the pending queue.** Scans carry their own `checkin_list_id`; the sync worker drains them regardless of what is on screen.
- Open/closed state and the assigned-lists manifest are cached locally (IndexedDB `META_STORE`), so the menu works fully offline from a cold reload.

## 12. Security

A shared tablet can reach every list for **that event**. It must not reach: the admin dashboard, any other event, member data, finance, or any other module. Same station-credential boundary as before (`kiosk_stations.access_token_hash`, resolved server-side, event_id compared and 404'd on mismatch) — the scope simply covers a set of lists rather than one, enforced via the new `kiosk_station_lists` membership check.

`revoked_at` (already exists) gives a same-minute answer to a lost tablet.

## 13. Device clock

State is computed from the device clock, so all tablets must be set to automatic network time. Add to the hardware ops checklist — not a code concern.

## 14. Migration/deploy sequencing

This codebase has hit "code shipped ahead of an unapplied migration" twice already (documented in `CLAUDE.md`). This feature touches more new schema than either prior incident:

1. Commit the migration (new `checkin_lists` columns + `kiosk_station_lists` table + backfill). Do not apply yet.
2. Write all code so nothing breaks if the migration hasn't landed.
3. Get explicit user go-ahead, apply via Supabase MCP, confirm pre/post state.
4. Only merge after the migration is confirmed applied.
5. Regenerate `database.types.ts` in the same pass.

## 15. Out of scope

- Cross-station printing. A USB printer is bound to the tablet it is plugged into. Never offer another station's printer in a picker.
- Fleet monitoring beyond `last_seen_at` and `revoked_at`.
- A separate "print" menu tile (confirmed out of scope).
- Dropping `kiosk_stations.list_id` (deferred to a later, separate migration).

## 16. Acceptance tests

1. Station with three lists assigned → menu shows exactly those three
2. List outside its window → visible, greyed, not tappable
3. `kiosk_force_state = 'open'` past `kiosk_closes_at` → stays open
4. `kiosk_force_state = 'closed'` inside window → stays closed
5. Go offline, wait past a close time → list closes on device with no network
6. Offline, switch from list A to list B → B's roster is present, scanning works
7. Switch lists with pending scans queued → queue untouched, all sync
8. List closes while scans are pending → pending scans still sync
9. Tablet with no printer physically attached → no print option offered anywhere, even if `mode` is `checkin_and_print`
10. `revoked_at` set → station stops working on next sync
11. Station credential cannot reach another event's lists — verify with a direct call, expect 404
