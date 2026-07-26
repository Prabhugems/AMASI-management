# Kiosk Launcher (superseded sidebar design)

> **Status: superseded.** This spec originally proposed a PIN-gated sidebar
> embedded inside `/print/[token]` and `/kiosk/[eventId]/[listId]`. After
> further discussion the actual requirement turned out to be simpler: a
> single standalone page a volunteer opens directly on a tablet, not a menu
> layered onto an already-open page. That shipped as `/kiosk-launcher/[eventId]`
> (implemented in `feat/kiosk-launcher`, commit `d0831b4`). The original
> sidebar design is kept below for the reasoning trail (in particular the
> `events` RLS finding, which is still true and still relevant elsewhere),
> but nothing in "Design" past this point was built. Skip to
> [What shipped instead](#what-shipped-instead) for the real thing.

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

Separately: an admin picking which check-in list or print station to hand
to a volunteer had to go into a specific event's own dashboard pages
(`/events/{eventId}/checkin/lists` or `/events/{eventId}/print-stations`)
and copy that one list/station's own "Share with Staff" link individually —
no single place to see all of an event's check-in/print entry points at
once, and no login-free way to get straight to one from the tablet itself.

## What shipped instead

**`/kiosk-launcher/[eventId]`** — public, no login, same trust model as
`/checkin/access/[accessToken]`, `/print/[token]`, and
`/kiosk/[eventId]/[listId]` already use in this app: the event ID in the
URL is the access boundary. No PIN, no session token, no new table, no
migration.

A volunteer opens this URL directly on a tablet (installable via "Add to
Home Screen" using the app's existing `public/manifest.json` — no new
packages) and sees one menu:

- **Check-in** → list of that event's active check-in lists → tap one →
  opens the existing `/checkin/access/{accessToken}` scanner page.
- **Print Badge** → list of that event's active print stations → tap one →
  opens the existing `/print/{accessToken}` page.

Both destinations are pages that already existed and already worked; this
is a discovery/navigation layer in front of them, not a new security
surface. It hands back the same `access_token` values the existing "Share
with Staff" modal already displays to anyone with dashboard access — no
new exposure.

### Implementation

- `src/app/api/kiosk-launcher/[eventId]/route.ts` — `GET`, rate-limited
  (`public` tier, keyed by IP), validates `eventId` is a UUID, 404s if the
  event doesn't exist. Returns the event's `name`/`short_name`, plus:
  - `checkin_lists` where `event_id = X and is_active = true`, additionally
    excluding any list whose `access_token_expires_at` has already passed
    (`.or("access_token_expires_at.is.null,access_token_expires_at.gt.<now>")`)
    — no point surfacing a dead link on the menu.
  - `print_stations` where `event_id = X and is_active = true`.
- `src/app/kiosk-launcher/[eventId]/page.tsx` — client component, three
  local view states (`menu` / `checkin` / `print`), each list item is a
  plain `<a href="/checkin/access/{token}">` or `<a href="/print/{token}">`.
  No layout.tsx needed — the root layout carries no dashboard chrome, same
  as `/checkin/access/[accessToken]` today.
- No middleware change needed: `src/middleware.ts` protects an explicit
  allowlist of routes (`protectedRoutes`), and `/kiosk-launcher` isn't on
  it — same as `/kiosk` and `/checkin/access` today, protection here is
  opt-in, not opt-out.

Verified directly against production data (event `cb26bbb1-...`, 125th
AMASI Skill Course): its one active print station ("Testing") resolves
correctly; its three check-in lists correctly resolve to an empty menu,
since the event concluded 2026-07-12 and all three lists' tokens expired
2026-07-14 — confirmed via direct SQL, not a bug in the filter.

### Explicitly not built (from the original design below)

- No PIN, no `event_kiosk_pins` table, no hashing, no signed session token.
- No "switch list without leaving the page" sidebar embedded in `/print`
  or `/kiosk` — switching means going back to the launcher page instead.
- No live-stats view, no printer-settings relocation. `/print/[token]`
  keeps its existing inline Settings modal untouched.
- No offline-queue-aware switch guard — there is no in-place switch to
  guard; navigating away from `/checkin/access/[accessToken]` to the
  launcher and back doesn't touch that page's own offline queue logic.

---

## Original sidebar design (superseded, kept for the reasoning trail)

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
- No new npm packages. Built entirely from what's already in the stack: the
  existing `src/components/ui/sheet.tsx` overlay primitive, existing
  React/Next.js/Supabase patterns, Node's built-in `crypto` module for
  hashing/signing, and the existing `NEXTAUTH_SECRET` env var for signing
  (no new secret to provision).
- No full admin-login flow. The two host screens stay token-based/no-login;
  only the sidebar's contents are gated, by a PIN — not a dashboard session,
  not an auth redirect.
- No per-list or per-station PIN. One PIN per event, set once.
- No lockout/attempt-tracking beyond IP+event rate limiting (see below).
- No changes to the offline-scan-queue's internal mechanics — only a new
  check at switch-time that reads its existing pending count.
- No fix to the `events` table's own RLS policies. They were audited as
  part of this design (see Security notes) and found to already allow
  unrestricted anon/public read on every column — that is a pre-existing,
  separate problem left untouched here. This design's job is to not add a
  new secret into a table already known to leak, not to fix that table.

## Security notes (why the design looks the way it does)

Two facts, checked directly against prod (`jmdwxymbgxwdsmcwbahp`) while
revising this spec, drove the data-model and session design below — **the
first of these is a real, still-current finding about this database**,
independent of whether this sidebar ever gets built:

1. **`events` RLS is fully open.** `pg_policy` on `public.events` shows
   `"Allow anon to read events"` (role `anon`, `USING (true)`) and
   `"Allow public read access to events"` (role: none, i.e. `PUBLIC`, also
   `USING (true)`). Postgres RLS is row-level, not column-level — there is
   no way to expose `events` to the anon key (which ships in every browser
   bundle) while hiding one column on it. Storing the PIN, hashed or not,
   directly on `events` would still be readable via a direct PostgREST
   call (`GET /rest/v1/events?select=kiosk_pin`) regardless of what the
   app's own UI code ever selects. **The PIN must live in a table the anon
   key cannot read at all**, not just a column the app's client code
   avoids selecting.
2. **`/api/checkin/stats` requires a dashboard session.** It calls
   `requireEventAndPermission(eventId, "checkin")`
   (`src/app/api/checkin/stats/route.ts:36`), which 401s any caller
   without an authenticated admin session — which neither kiosk screen
   has. It cannot be reused as-is; a token/PIN-gated stats path is needed.

## Design

### Data model

One new table, deliberately **not** a column on `events`:

```sql
create table event_kiosk_pins (
  event_id   uuid primary key references events(id) on delete cascade,
  pin_hash   text not null,
  pin_salt   text not null,
  updated_at timestamptz not null default now()
);
alter table event_kiosk_pins enable row level security;
-- No policies created for anon/authenticated/public — default-deny.
-- Only ever read/written via the admin (service-role) Supabase client,
-- which bypasses RLS, from the two API routes below.
```

No row for an event means "no PIN configured" — additive only, no
backfill. This requires a migration; per this project's standing rule (see
`CLAUDE.md`), it is not applied out-of-band without explicit user go-ahead
at implementation time — this spec only records that one is needed.

**PIN hashing:** `crypto.scrypt(pin, pin_salt, 64)` (Node built-in, no new
package), salt via `crypto.randomBytes(16).toString("hex")` per event.

**Validation (applied identically client-side in the settings form and
server-side in the write endpoint):** trim the input, then require exactly
4-6 digits (`/^\d{4,6}$/`). An empty or whitespace-only string is rejected
at write time — it is never saved, so "empty string" and "no row" can never
diverge. The read/unlock path additionally treats a missing row, a null
hash, and an empty-after-trim hash identically as "not configured" as a
second layer, in case of any future direct DB edit that bypasses the API.

**Setting the PIN (dashboard-side, authenticated):**
- `GET /api/events/[eventId]/kiosk-pin` — authenticated
  (`requireEventAndPermission(eventId, "checkin")`). Returns only
  `{ configured: boolean }`, never the hash or any derived value.
- `PUT /api/events/[eventId]/kiosk-pin` — same auth. Body `{ pin }`,
  validated as above, hashed, upserted.
- The event settings page renders this as a masked `••••` state with a
  "Change PIN" action that opens a small form — the stored value is never
  fetched into page HTML/props at all, only the boolean.

### API surface (kiosk-facing, no login)

**`POST /api/events/[eventId]/kiosk/unlock`**

Body: `{ pin: string }`.

- Rate limited on `` `kiosk-pin:${eventId}:${clientIp}` `` — a **new**
  tier in `src/lib/rate-limit.ts` (`kiosk: { requests: 20, windowMs: 5 * 60
  * 1000 }`, i.e. 20 attempts / 5 min), not `strict` (5/min). Reasoning:
  conference-venue tablets sit behind one NAT'd WiFi IP, so `strict` would
  be one shared 5-request bucket across every tablet at the event. Keying
  on `eventId + IP` at least stops one event's rate limit from starving a
  concurrent, unrelated event on the same network, and 20/5min still
  bounds brute force to a impractical timescale against a 4-6 digit PIN
  while giving real staff room for typos across several devices.
- Validates the PIN (trim, 4-6 digits) against `event_kiosk_pins` via
  `scrypt` + constant-time compare (`crypto.timingSafeEqual`).
- On success: mints a signed, stateless session token —
  `` `${eventId}.${expiresAtMs}.${hmac}` `` where
  `hmac = createHmac("sha256", process.env.NEXTAUTH_SECRET).update(`${eventId}.${expiresAtMs}`).digest("hex")`,
  `expiresAtMs = Date.now() + 10 * 60 * 1000` (10 min). Returns
  `{ token, expiresAt }`. This token — not the PIN — is what the client
  persists and what every subsequent protected call presents. No PIN
  configured / wrong PIN → 401 with a distinguishing error code
  (`pin_not_configured` vs `invalid_pin`) so the UI can show the right
  message.

**`POST /api/events/[eventId]/kiosk/entry-points`**

Body: `{ token: string }` (the session token from `unlock`, not the PIN).
Same rate-limit key/tier as above. Verifies the token's HMAC and expiry
server-side (stateless, no DB lookup). On success, returns the event's
sibling entry points, filtered to reduce blast radius:
- `checkin_lists` where `event_id = X and is_active = true` — id, name,
  list_purpose, access_token.
- `print_stations` where `event_id = X and is_active = true` — id, name,
  access_token.

A single correct PIN still surfaces every active list/station's token for
that event (unavoidable given "switch without retyping a token" is the
whole point), but this at least excludes inactive/retired lists and
stations rather than every row that ever existed.

**`GET /api/checkin/kiosk-stats?event_id=&checkin_list_id=&token=`**

New thin, token-gated (same token, same verification as above) read-only
wrapper that runs the same query `/api/checkin/stats` runs, without the
`requireEventAndPermission` admin-session check. This is the
token/PIN-gated stats path required because the existing endpoint is
dashboard-only (see Security notes).

### Frontend

- `src/components/kiosk/KioskSidebar.tsx` — client component wrapping the
  existing `Sheet` primitive (`src/components/ui/sheet.tsx`). Props:
  `eventId`, `currentListId` and/or `currentStationId`,
  `queuePartitionKey` (the host page's existing offline-queue partition
  key), and an optional `settingsSlot` (`ReactNode`).

- **Session persistence:** on successful unlock, store
  `sessionStorage["kiosk-session:{eventId}"] = { token, expiresAt }`. Every
  time the sidebar trigger is tapped, check `Date.now() < expiresAt`
  locally before showing the unlocked view (avoids a needless round trip
  for an obviously-stale token) — but the *server* is the actual
  authority: `entry-points` and `kiosk-stats` independently verify the
  token's embedded expiry via HMAC on every call, so a client-side-only
  flag (e.g. someone editing sessionStorage in devtools) cannot forge
  access on its own. Session expires 10 minutes after the PIN was entered,
  full stop — not sliding/refreshed by activity, since that's simplest to
  reason about and matches "unattended tablet" risk (an idle kiosk goes
  back to gated after 10 minutes either way).

- **PIN pad is tap-only.** No real `<input>` element backs it — digits are
  built up in component state from on-screen numeric buttons only. This is
  specifically so a USB/Bluetooth barcode scanner in HID keyboard-emulation
  mode (as used on `/print/[token]` with a Zebra) can't inject digits into
  the pad if a stray scan fires while the sheet happens to be open; there
  is no focused text field for its keystrokes to land in.

- **Trigger visibility differs by screen:**
  - `/print/[token]`: small, visible, corner-docked icon button — a
    volunteer is standing at this tablet, so a visible admin entry point
    is fine (and it already replaces the existing visible Settings-gear
    button).
  - `/kiosk/[eventId]/[listId]`: **no visible button.** This tablet sits
    unattended in front of the public; a labeled "admin" affordance is an
    attractive nuisance. Instead, a ~1.5s long-press on the event
    name/logo in the header opens the sheet.

- Once unlocked, the sheet shows exactly three plain, clearly-labeled
  sections — no nested menus:
  1. **Switch List/Station**
  2. **View Stats**
  3. **Printer Settings** (present only when `settingsSlot` is passed —
     i.e. only on `/print/[token]`)

- **Switch List/Station guards the offline queue.** Before navigating to a
  different list/station's URL, check
  `pendingRequestCount(queuePartitionKey)`. If non-zero: block the switch,
  show the pending count and a "Sync now" button (calls the existing
  `flushRequestQueue`); the switch option stays disabled until the count
  reaches 0. No silent override — an unsynced scan is exactly the kind of
  thing this feature must not quietly orphan.

- **Stats section lifecycle:** fetches `kiosk-stats` only when that
  section is opened, polls every 15s (matching the existing admin scan
  page's `refetchInterval` convention) only while the sheet is open on
  that section, and stops polling immediately on close. Ten tablets are
  not left polling all day in the background.

- `/print/[token]/page.tsx`: imports `KioskSidebar`; its existing
  `showSettings` printer-config form is relocated (not rebuilt) into
  `settingsSlot`.
- `/kiosk/[eventId]/[listId]/page.tsx`: imports `KioskSidebar` with no
  `settingsSlot`.

### Error handling

- Wrong PIN: inline error on the pad; no extra lockout beyond the
  `kiosk` rate-limit tier.
- No PIN configured for the event: pad is replaced with a message
  directing the admin to set one in event settings.
- `entry-points`/`kiosk-stats` call fails (network/server error, or token
  expired mid-session): falls back to showing only the current
  list/station with a retry button (entry-points) or a "stats unavailable"
  state (stats); a token expiry here just re-shows the PIN pad. None of
  this blocks or interrupts the underlying scan/check-in/print flow on the
  host page.
- Switch blocked by non-empty offline queue: see above — explicit pending
  count + Sync now, not a silent failure.

### Testing

- Unit tests for all three new/changed API routes (`unlock`,
  `entry-points`, `kiosk-stats`, `kiosk-pin` GET/PUT), following the
  existing `route.test.ts` pattern used elsewhere under `src/app/api/checkin`:
  valid PIN, invalid PIN, no-PIN-configured event, expired/tampered
  session token, rate-limit trip, and (for `entry-points`) that inactive
  lists/stations are excluded from the response.
- No new browser/e2e test infra. Manual verification on both host screens,
  including the long-press trigger and the HID-scanner-vs-PIN-pad
  behavior, is consistent with this project's existing test coverage
  approach for similar tablet-facing pages.
