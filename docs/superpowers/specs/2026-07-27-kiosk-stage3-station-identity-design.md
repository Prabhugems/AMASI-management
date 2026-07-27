# Kiosk Stage 3 — Real Station Identity Design

**Date:** 2026-07-27
**Status:** Approved for planning

## Context

Stage 1 (`docs/superpowers/plans/2026-07-27-kiosk-offline-first-stage1.md`, merged in PR #119) and Stage 2 (`docs/superpowers/specs/2026-07-27-kiosk-stage2-checkin-authority-design.md`, PR #120) built the self-check-in kiosk's offline-first scan resolution and server-side check-in authority. Both left `src/lib/kiosk-offline-store.ts`'s `getOrCreateDeviceId()` untouched — a random UUID generated client-side and persisted in the browser's IndexedDB, with no admin visibility, no connection to a real device record, and (confirmed while writing this spec) **never actually sent to the server at all** — it exists only in the client's local `scan_log`.

Stage 1's own migration (`supabase/migrations/20260727_kiosk_scan_id_and_kiosk_stations.sql`) already created a `kiosk_stations` table as groundwork for this stage:

```sql
create table kiosk_stations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('checkin', 'print')),
  list_id uuid references checkin_lists(id) on delete set null,
  print_station_id uuid references print_stations(id) on delete set null,
  printer_config jsonb,
  exit_pin_hash text,
  exit_pin_salt text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  access_token_hash text,
  revoked_at timestamptz
);
-- RLS enabled, no policies (default-deny; admin-client-only)
```

This table has never been used by any application code before this stage.

**Two things were reconciled before this design was written, both discovered while exploring context, not assumed:**

1. **`feat/kiosk-launcher`** (an old, unmerged branch, dated the day before Stage 1's plan) already built a *different*, simpler feature: `/kiosk-launcher/[eventId]`, a no-PIN, no-new-table navigation page listing an event's active check-in lists and print stations, linking to their *existing* access-token URLs. It explicitly marked an earlier PIN-gated sidebar spec (`2026-07-26-kiosk-print-station-sidebar-design.md`) as superseded. **Decision: this stays a separate, complementary piece of work — not part of Stage 3.** It solves discovery/navigation to an existing entry point; Stage 3 solves a device's own persistent identity and credentials. Both can exist.
2. **The `exit_pin_hash`/`exit_pin_salt` columns already in `kiosk_stations`** imply a full-screen lockdown UX that overlaps with what earlier stage-planning docs called "Stage 4." **Decision: those columns stay unused by this stage.** Stage 3 is identity/auth only; the lockdown UX built around those columns is Stage 4's job.
3. **Scope is check-in mode only for this stage.** The schema supports `mode: 'print'` too, but adapting `/print/[token]` (materially more complex — Zebra/USB printer settings, camera QR scanner, an existing Settings modal) is real, separate work. The admin creation UI should only expose `mode: 'checkin'` for now — not offer a mode selector that doesn't do anything yet.

## Goal

Replace `getOrCreateDeviceId()`'s meaningless random placeholder with a real, admin-provisioned station identity: an admin sets up a physical device once, the device gets one token that authenticates it going forward, and every scan it makes is attributable to a real, visible station record — not an anonymous client-generated UUID nobody can see.

## Design

### 1. Admin provisioning UI

New page, `src/app/events/[eventId]/kiosk-stations/page.tsx`, structurally mirroring the existing `src/app/events/[eventId]/print-stations/page.tsx` (CRUD list + create/edit form), not inventing new conventions:

- **Create**: `name` (text), target picker (a dropdown of the event's active `checkin_lists` — reusing the same data `feat/kiosk-launcher`'s `/api/kiosk-launcher/[eventId]` route already fetches, if that branch lands first; otherwise a plain query against `checkin_lists where event_id = X and is_active = true`). `mode` is fixed to `'checkin'` for this stage — no selector shown.
- On save, `POST /api/kiosk-stations`: inserts the row, mints a token (`crypto.randomBytes(24).toString("hex")`, matching `print_stations`' existing convention), stores only `access_token_hash` (SHA-256) — **never plaintext**, unlike `print_stations`' current permanent-plaintext storage. Returns the plaintext token in the creation response body **exactly once**.
- **Hand-off UI**: immediately after creation, the same "Share with Staff" modal pattern already used in `checkin/page.tsx:874-980` (QR code via the existing `QrImage` component, copy-link button) — showing the full `/kiosk-station/[token]` URL. This is the only time it's retrievable.
- **Regenerate**: new dedicated `POST /api/kiosk-stations/[id]/access-token` route, mirroring `checkin_lists`' rotate endpoint (cleaner than `print_stations`' generic PATCH-action approach) — mints a new token, immediately invalidates the old one. The physical device must be re-provisioned (open the new URL) to keep working.
- **Revoke**: `DELETE /api/kiosk-stations/[id]/access-token` sets `revoked_at = now()` (matches `checkin_lists`' revoke pattern).
- **List view**: name, target list, `last_seen_at` (human-relative, e.g. "3 min ago" / "never connected"), Regenerate, Revoke, Delete.

### 2. Device-side resolution — `/kiosk-station/[token]`

New public route, same trust tier as `/kiosk`, `/print/[token]`, `/checkin/access/[token]` today — the token in the URL *is* the access boundary, no session/login.

`src/app/kiosk-station/[token]/page.tsx` is a **server component**:
1. Hash the incoming `token`, look up `kiosk_stations` by `access_token_hash`.
2. Not found, or `revoked_at` is set → a "Station not found" state (mirrors `/print/[token]`'s existing copy/pattern for the same case — do not invent new wording).
3. `list_id` is null (target was deleted/deactivated after provisioning) → a distinct "This station's list was removed — contact an admin to reassign it" state, not a generic not-found.
4. Otherwise: touch `last_seen_at = now()` on this same lookup (no separate heartbeat endpoint for this stage — keeps it simple; continuous online/offline presence tracking is a real feature to design later if wanted, not assumed here), then render the *existing* kiosk check-in client component (`src/app/kiosk/[eventId]/[listId]/page.tsx`'s component tree, reused, not duplicated), passing the resolved `eventId`/`listId` as props and the **station's own token** (not the list's token) down as the credential the client uses for its own subsequent calls.

### 3. Authenticating without the list's token ever reaching the browser

The core mechanism that makes this more than a redirect wrapper:

- `/api/kiosk/delegates` and `/api/kiosk/checkin` both get a small, **additive** extension: accept either the existing `token` query param / body field (a `checkin_lists.access_token` — the old direct-URL path, completely unchanged, Task 6's existing admin links keep working) **or** a new `station_token`. When `station_token` is present, the route hashes it, resolves `kiosk_stations` → `list_id` internally (checking `mode === 'checkin'` and `revoked_at is null`), and proceeds exactly as today.
- The list's own `access_token` is never fetched, transmitted, or read by the browser at any point on this path — the *only* secret that ever reaches the device is its own station token.
- This reuses effectively all of Stage 1/2's existing kiosk logic (`matchDelegate`, the IndexedDB cache, the sync worker, the whole local-first flow) — only how it's parameterized and authenticated changes.

### 4. Station identity becomes visible server-side (new migration required)

`station_id` is currently **never sent to the server at all** — confirmed while researching this spec, it exists only in the client's local `scan_log`. For this stage to deliver real value (an admin can actually see which device did what), the server needs to record it.

**Requires one additive migration** (not applied without explicit go-ahead at implementation time, per this project's standing rule):
```sql
alter table checkin_records
  add column if not exists station_id uuid references kiosk_stations(id) on delete set null;
```

With that column: `kiosk-sync-worker.ts`'s POST body gains `station_id` — but **resolved server-side from the authenticated `station_token`**, the same trust pattern Stage 2 established for `registration_id` (never trust a client-supplied identity value directly when the authenticated credential already lets the server derive it itself). `/api/kiosk/checkin` persists it on insert alongside `scan_id`.

`getOrCreateDeviceId()` and its random-UUID fallback **stay in place**, unchanged — they're still what a device uses if it's opened via the old direct `/kiosk/[eventId]/[listId]?token=` URL rather than a provisioned `/kiosk-station/[token]` one. Stage 3 adds a better path; it doesn't retire the old one.

### 5. Service worker

`public/app-sw.js`'s `SHELL_ROUTE_PREFIXES` (added in Stage 1's Task 8 fix) needs `/kiosk-station/` added, so this new entry point gets the same stale-while-revalidate offline-shell treatment `/kiosk/` already has — otherwise a station-provisioned device would regress to the exact "generic offline fallback instead of mounting" bug Stage 1's Task 8 fixed, just on a new URL prefix.

## Out of scope (explicitly, not deferred by omission)

- `mode: 'print'` and any change to `/print/[token]` — schema already supports it, application code does not yet, and won't in this stage.
- `exit_pin_hash`/`exit_pin_salt` and any full-screen lockdown UX built around them — Stage 4's job.
- A continuous online/offline heartbeat beyond the simple `last_seen_at` touch on each page load / roster fetch.
- Finishing/merging `feat/kiosk-launcher` — separate, already-mostly-built work, not blocking or blocked by this stage.
- Any change to `print_stations`' existing plaintext-token storage — noted as a worse pattern than what this stage builds for `kiosk_stations`, but fixing it retroactively is out of this stage's scope.

## Testing

- Route tests for `/api/kiosk-stations` (create, list, the rotate and revoke endpoints), following this codebase's established `route.test.ts` + `createSupabaseMock` pattern.
- Route tests for the new `station_token` auth path added to `/api/kiosk/delegates` and `/api/kiosk/checkin` — valid token, revoked station, station with a null `list_id`, mode mismatch (a `print`-mode station's token presented to the checkin path).
- No new client-side IndexedDB test infrastructure (same standing exclusion as Stages 1 and 2 — this repo's Vitest config has no DOM/IndexedDB shim).
- Manual verification: provision a station end to end, open its URL fresh, confirm scans record with the real `station_id` (not a `getOrCreateDeviceId()` placeholder), confirm Regenerate/Revoke actually cut off an already-provisioned device's *next* action (not its current open tab, per the accepted Stage-2-precedent trade-off).
