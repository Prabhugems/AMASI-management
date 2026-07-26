# Kiosk / Print-Station Admin Sidebar

## Problem

Two tablet-facing, token-based, no-login screens exist today:

- `/print/[token]` — the frontdesk "scan to print" screen. A volunteer scans
  a badge, the attendee gets checked in, and a badge label prints. It already
  has an inline "Settings" modal (printer type, IP, paper size, proxy printer
  name) but no way to do anything else without leaving the page.
- `/kiosk/[eventId]/[listId]` — the unattended self-service check-in screen.
  Attendee scans/types their own registration number, gets checked in, and is
  emailed/WhatsApped a digital badge (no physical printing here).

Both are deliberately locked into one function per tablet. Neither shows
live stats, and neither has any way for an admin to switch which check-in
list or print station the tablet is pointed at without re-entering a new
URL/token by hand. There is currently no navigational or admin surface on
either screen at all.

## Goal

A shared sidebar component, usable from both screens, that lets an admin:

1. Switch which check-in list (on `/kiosk`) or print station (on
   `/print/[token]`) the tablet is currently serving, without retyping a
   token.
2. View live stats (total / checked-in / remaining) for the current list —
   not shown on either screen today.
3. (On `/print/[token]` only) Access the existing printer/scan settings,
   relocated into the sidebar instead of a separate modal trigger.

Gated by a PIN so a volunteer or attendee holding the tablet/link can't
casually reach admin actions.

## Non-goals

- No new printer technology. Browser print (native OS print dialog, admin
  picks whatever printer is set up on the tablet) stays the baseline exactly
  as it works today. No Zebra/USB-proxy feature work.
- No new packages or libraries. Built entirely from what's already in the
  stack: the existing `src/components/ui/sheet.tsx` overlay primitive,
  existing React/Next.js/Supabase patterns, one new database column.
- No full admin-login flow. The two host screens stay token-based/no-login;
  only the sidebar's contents are gated, by a simple PIN — not a session,
  not an auth redirect.
- No per-list or per-station PIN. One PIN per event, set once.
- No lockout/attempt-tracking beyond the existing IP rate-limit pattern
  already used on `checkin-access` routes.
- No changes to the audit/offline-scan-queue logic already in both pages.

## Design

### Data model

One new nullable column: `events.kiosk_pin` (text, expected to hold a 4-6
digit string, not enforced by a DB constraint). Additive only, no backfill —
an event with `kiosk_pin IS NULL` simply can't have its sidebar unlocked;
the sidebar shows "Ask an admin to set a kiosk PIN in event settings"
instead of a PIN pad.

This requires a migration. Per this project's standing rule (see
`CLAUDE.md`), no migration is applied out-of-band without explicit user
go-ahead at implementation time — this spec only records that one is
needed, it does not apply it.

The admin sets/changes the PIN from the existing event edit/settings page
in the dashboard: one new plain text input, no new page.

### API surface

One new route:

- `POST /api/events/[eventId]/kiosk/entry-points`
  Body: `{ pin: string }`.
  Validates `pin` against `events.kiosk_pin` for that event. Rate-limited
  the same way as `/api/checkin/access/[accessToken]` (reuse
  `checkRateLimit`/`getClientIp`/`rateLimitExceededResponse` from
  `@/lib/rate-limit`, "strict" tier) since a short PIN is brute-forceable.
  On success, returns the event's sibling `checkin_lists` (id, name,
  list_purpose, access_token) and `print_stations` (id, name, is_active,
  access_token) — this single response both confirms the PIN and supplies
  everything the "switch" UI needs. Access tokens are only ever returned
  after a correct PIN.
  On failure: 401, no partial data.

No other new endpoints. Live stats reuse the existing
`/api/checkin/stats` endpoint already used by the admin
`/events/[eventId]/checkin/[listId]/scan` page.

### Frontend

- `src/components/kiosk/KioskSidebar.tsx` — client component wrapping the
  existing `Sheet` primitive (`src/components/ui/sheet.tsx`). Props:
  `eventId`, `currentListId` and/or `currentStationId`, and an optional
  `settingsSlot` (`ReactNode`) for page-specific content.
- Unlock state: on a correct PIN, set
  `sessionStorage["kiosk-unlocked:{eventId}"] = "1"` (the PIN itself is
  never persisted client-side). Stays unlocked until the tab/page is
  reloaded or closed; re-entering the PIN is required after that.
- A single, always-visible, corner-docked trigger button opens the sheet.
  If not yet unlocked this session, the sheet's first (and only) content is
  a numeric PIN pad. Once unlocked, it shows exactly three plain,
  clearly-labeled buttons/sections — no nested menus:
  1. **Switch List/Station**
  2. **View Stats**
  3. **Printer Settings** (present only when `settingsSlot` is passed)
- `/print/[token]/page.tsx`: imports `KioskSidebar`; its existing
  `showSettings` printer-config form is relocated (not rebuilt) into
  `settingsSlot`.
- `/kiosk/[eventId]/[listId]/page.tsx`: imports `KioskSidebar` with no
  `settingsSlot` — only Switch List and View Stats apply, since this
  screen has no printer.

### Error handling

- Wrong PIN: inline error message on the pad, no extra lockout beyond the
  existing IP rate limit.
- `entry-points` fetch fails (network/server error): sidebar falls back to
  showing only the current list/station (no switch options) with a retry
  button. This never blocks or interrupts the underlying scan/check-in/print
  flow on the host page.
- No PIN configured for the event: sidebar shows a message directing the
  admin to set one in event settings, instead of a PIN pad.

### Testing

- Unit tests for the new API route, following the existing
  `route.test.ts` pattern used elsewhere under `src/app/api/checkin`:
  valid PIN, invalid PIN, rate-limit trip, and no-PIN-configured event.
- No new browser/e2e test infra. Manual verification on both host screens
  is consistent with this project's existing test coverage approach for
  similar tablet-facing pages.
