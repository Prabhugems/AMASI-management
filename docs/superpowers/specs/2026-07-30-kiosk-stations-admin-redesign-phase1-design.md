# Kiosk Stations Admin Redesign — Phase 1 (List View + Detail Page + Auto-Naming)

## Context

Two design mockups were supplied (`Kiosk Stations Standalone - AMASI Design System.html`, 9 screens; `Admin Station Management Redesign (2).html`, an alternate list-view take) proposing a full redesign of the Kiosk Stations admin experience: a compact list view, a 4-step creation wizard, a new per-station detail page with an activity feed, rewritten confirmation dialogs, and a "Station" → "Tablet" terminology change throughout.

The full scope is too large for one pass. This spec covers **Phase 1 only** — the highest-value, lowest-risk slice, confirmed piece-by-piece with the project owner:

1. Shrink the list view's per-row footprint (today's rows repeat the same explanatory paragraph for every station, making 6+ stations require scrolling).
2. Give each station its own detail page, including a new "recent activity" feed.
3. Auto-name new stations "Tablet 1", "Tablet 2", ... instead of a blank required name field.

**Explicitly out of scope for this phase** (deferred to a later spec, not to be built now):
- The 4-step creation wizard (name → attended → jobs → printer). Today's single inline create form stays as-is.
- The table/card view toggle from the mockup.
- The live throughput sparkline ("38/hr").
- Any "Station" → "Tablet" rename in code, routes, database, or persistent copy (nav stays "Kiosk Stations"). Only the *default name* new stations get changes.
- The rewritten confirmation-dialog copy from Screen 9 (today's dialogs are kept as-is; only their trigger location moves to the new detail page).

## Current State (verified against the live codebase)

- Everything lives in one file, `src/app/events/[eventId]/kiosk-stations/page.tsx` (1915 lines): the list, the inline create form (`showCreate` boolean), rename editor (`StationNameEditor`), list picker (`StationListsPicker`), behaviour controls (`StationBehaviourControls`: attended toggle + printer/auto-print), and row actions (`StationActions`: New link/Revoke/Delete), all rendered inline per row.
- No detail route exists today — `/kiosk-stations/[id]` is new.
- `POST /api/kiosk-stations` already accepts `name`, `list_ids`, `mode`, `print_station_id`, `auto_print_badge`, `attended`. `PATCH /api/kiosk-stations/[id]` already supports partial updates including `attended` and `list_ids` (validated before mutation). The access-token rotate/revoke endpoint (`/api/kiosk-stations/[id]/access-token`) already exists. **None of these need to change for Phase 1** — only the UI consuming them moves/reshapes.
- Our just-shipped `/api/kiosk/list-counts` (event-wide checked-in counts per list) is reused as-is for the list-view counts.
- No endpoint today returns a per-station activity feed. Two existing tables carry the needed data:
  - `checkin_records` (has a proper `station_id` FK) — one row per successful, non-duplicate check-in.
  - `checkin_audit_log` — for kiosk check-ins, only written on the **duplicate** path (`action: "check_in"`, `success: true`, `device_info: { station_id, duplicate: true }`), per the existing `logKioskDuplicateAudit`-style helper in `src/app/api/kiosk/checkin/route.ts`. A genuinely new/first-time check-in does **not** get an audit_log row today — only `checkin_records`.
  - This means the activity feed is a **union of both**, not a single query.
- `/api/checkin/audit` exists today but only surfaces `success: false` rows filtered by `event_id`/`checkin_list_id` — it does not filter by station and does not include successful rows. Not reusable as-is; Phase 1 needs its own endpoint.

## Design

### 1. List view

Each row collapses to one compact line per concern, replacing today's repeated paragraphs:

- **Status**: colored dot + label + relative time (unchanged from today).
- **Station**: bold name (inline rename via the existing `StationNameEditor`, unchanged component) + an abbreviated, monospace token badge with a copy icon (e.g. `st_28e3…6ddb`) — new, purely cosmetic.
- **Check-in lists**: existing list-name chips, each now suffixed with its live count from `/api/kiosk/list-counts` (e.g. "Lunch · 5").
- **Behaviour**: a single-line plain-text summary (e.g. "Attended · Auto-print · Zebra ZD421") replacing today's toggle + explanatory paragraph. The explanation itself moves to (a) a one-time help panel similar to the existing "What the status means" legend at the bottom of the page, and (b) the new detail page, where there's room for it.
- **Actions**: one "Manage" button linking to `/kiosk-stations/[id]`, replacing the inline expanding controls. A kebab menu keeps New link / Revoke / Delete directly on the row for speed (these already exist as `StationActions` — reused, not rebuilt).

No change to the underlying data model or API calls for this section — it's a rendering/layout change over data already being fetched today, plus one additional fetch to `/api/kiosk/list-counts`.

### 2. New `/events/[eventId]/kiosk-stations/[stationId]/page.tsx`

- Header: name (editable, reuses `StationNameEditor`), status, last-seen, mode.
- Settings panel: reuses the existing `StationListsPicker` and `StationBehaviourControls` components as-is, just rendered on their own page instead of inline in a list row. No new API calls beyond what these components already make.
- Link management: reuses today's existing New-link/Revoke/Delete confirm dialogs (already built in `StationActions`), relocated here from the list row's kebab menu (both stay available — kebab on the list row for speed, full versions with more context here).
- **Recent activity feed** (new): a new endpoint, `GET /api/kiosk-stations/[id]/activity`, that:
  1. Queries `checkin_records` where `station_id = :id`, joined to `registrations` (attendee name) and `checkin_lists` (list name), ordered by `checked_in_at` desc — these are the successful, first-time check-ins.
  2. Queries `checkin_audit_log` where `success = true` and `device_info->>station_id = :id` and `device_info->>duplicate = 'true'`, joined the same way — these are the "already collected, turned away" entries, matching the mockup's "Lunch · already collected · Dr P. Iyer · turned away" line.
  3. Merges both lists by timestamp, returns the most recent ~20.
  - Same admin-client/RLS-bypass pattern as every other kiosk admin route in this codebase (`checkin_audit_log` has RLS enabled with zero policies, per this repo's established gotcha — must use the admin client, not a direct browser query).

### 3. Auto-naming

`POST /api/kiosk-stations`'s create form defaults the name field to the next unused `Tablet N` (computed client-side from the current station list: highest existing `Tablet <n>` + 1, or `Tablet 1` if none match that pattern) instead of requiring the admin to type something. The field stays fully editable before submit, and renamable afterward via the existing rename control — this is a client-side default only, no API contract change.

## Testing

- Route tests for the new `GET /api/kiosk-stations/[id]/activity` endpoint: auth required, invalid/missing station id, empty result, merge-and-sort ordering across the two source tables, RLS-bypass via admin client.
- Component-level checks for the reshaped list row (compact layout renders the same underlying data as today, just laid out differently) and the new detail page (renders settings via the same existing components, activity feed renders the merged/sorted list).
- No changes to check-in, print, or kiosk-tablet-facing behavior in this phase — existing kiosk route test suites should need no changes.
