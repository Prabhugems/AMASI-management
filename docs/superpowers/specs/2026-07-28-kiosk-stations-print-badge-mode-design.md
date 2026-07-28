# Kiosk Stations — "Check-in + Print Badge" Mode Design

**Date:** 2026-07-28
**Status:** Approved for planning

## Context

Kiosk Stage 3 (`docs/superpowers/specs/2026-07-27-kiosk-stage3-station-identity-design.md`, PR #122, merged 2026-07-28) shipped admin-provisioned `kiosk_stations` for self-check-in devices only. Its own design spec explicitly scoped `mode: 'print'` support out: *"The admin creation UI should only expose `mode: 'checkin'` for now — not offer a mode selector that doesn't do anything yet."*

Separately, this app already has a mature, independent badge-printing system: `print_stations` (admin page `src/app/events/[eventId]/print-stations/page.tsx`, device page `src/app/print/[token]/page.tsx`) — supporting browser/Zebra-network/thermal/USB printer types, badge templates, reprint policy (`allow_reprint`, `max_reprints`), and a `print_jobs` audit table. This system is unrelated to `kiosk_stations` in code today, though `kiosk_stations` has carried an unused `print_station_id` column (nullable FK → `print_stations`) since Stage 1 — schema headroom that was clearly intended for exactly this kind of linkage, never wired up.

The user's request, from a hand-drawn flow diagram: on the **same** Kiosk Stations admin page, a station should be creatable in one of two roles — "Checkin" (today's Stage 3 behavior, unchanged) or "Print Badge" (check-in **and** badge printing, both from the same device). This is a new, real feature — not a Stage 3 bug — decided through a short round of clarifying questions:

1. **Combined flow**: check-in happens first (today's kiosk flow, byte-for-byte unchanged); on a successful check-in, a manual **"Print Badge"** button appears on the success screen. No auto-print, no full print-station toolkit (printer picker, camera scanner, manual search) grafted onto the kiosk UI.
2. **Printer config source**: a "Check-in + Print Badge" kiosk station is **linked to an existing, already-configured Print Station** (reusing that print_station's `print_settings`) rather than duplicating printer setup UI. This is exactly what the dormant `kiosk_stations.print_station_id` column was for.
3. **Reprint behavior**: tapping "Print Badge" when a badge was already printed for this registration on this station shows a **warning confirmation** ("Already printed at HH:MM — print again?") rather than silently reprinting or blocking outright.

## Goal

Add a third `kiosk_stations.mode`, `'checkin_and_print'`, so one admin-provisioned, one-URL kiosk device can check a delegate in and then print their badge — reusing the existing Print Station's printer connectivity and audit trail rather than rebuilding it.

## Design

### 1. Schema

Widen the existing `mode` CHECK constraint on `kiosk_stations`:

```sql
alter table kiosk_stations drop constraint kiosk_stations_mode_check; -- exact constraint name to be confirmed at implementation time
alter table kiosk_stations add constraint kiosk_stations_mode_check
  check (mode in ('checkin', 'print', 'checkin_and_print'));
```

Semantics going forward:
- `mode = 'checkin'` (Stage 3, unchanged): requires `list_id`, ignores `print_station_id`.
- `mode = 'print'` (schema-ready since Stage 1, still not built — out of scope here, unchanged): would require `print_station_id`, ignore `list_id`.
- `mode = 'checkin_and_print'` (this feature): requires **both** `list_id` and `print_station_id`.

No change to `checkin_records.station_id` (Stage 3) or any other already-shipped Stage 3 column.

### 2. Admin UI — `src/app/events/[eventId]/kiosk-stations/page.tsx`

The create dialog gains a mode choice (radio buttons, not a dropdown — only two real choices for now, matching the user's own mockup):
- **Check-in only** (today's default/only option)
- **Check-in + Print Badge**

Selecting "Check-in + Print Badge" reveals a second required picker: **Print Station**, populated from `GET /api/print-stations?event_id=` (the existing print-stations list endpoint — confirm exact route/response shape at implementation time), filtered to that event's active print stations. `POST /api/kiosk-stations` gains `print_station_id` as an optional field, required when `mode === 'checkin_and_print'`.

The existing "Change list" reassignment control (shipped in Stage 3's final-review fix wave) gets a parallel "Change print station" control for `checkin_and_print`-mode rows, using the same inline-`Select` pattern.

### 3. Device UI — `src/components/kiosk/KioskCheckinScreen.tsx` and `/kiosk-station/[token]`

`/kiosk-station/[token]/page.tsx` already resolves the full `kiosk_stations` row; it additionally passes `mode` and (when linked) the resolved print station's `print_settings`/`badge_template_id`/reprint policy down as new props on `KioskCheckinScreen`.

On the existing check-in **success screen** (unchanged for `mode: 'checkin'`), when `mode === 'checkin_and_print'`:
- A **"Print Badge"** button renders alongside the existing success UI.
- Tapping it triggers the same underlying badge-print call the standalone `/print/[token]` page already uses (the exact function/endpoint to reuse — e.g. `/api/print-stations/print` vs. a shared client-side helper — is a Consumes/Produces detail for the implementation plan, determined by reading `src/app/print/[token]/page.tsx` in full at that time, not guessed here).
- If a `print_jobs` row already exists for this registration on this print station (i.e. a prior successful print), show a confirm-style warning ("Already printed at HH:MM — print again?") before re-sending the job. This mirrors `print_stations.allow_reprint`/`max_reprints`' existing intent, applied to the kiosk's own print trigger.
- The print action is **online-only** — it is not part of the offline-first scan queue (`kiosk-offline-store.ts`/`kiosk-sync-worker.ts`) Stage 1/2 built. If the device is offline when "Print Badge" is tapped, it shows a clear "You're offline — try again once connected" state rather than silently queuing or failing.

### 4. Printer connectivity carry-over (a real constraint, not a design choice)

USB-connected printers (`printer_type: 'usb'`/`'thermal'` with WebUSB) require a one-time, user-gesture-triggered browser permission grant per physical device. Since `/kiosk-station/[token]` and `/print/[token]` are different URLs (same origin, so a WebUSB grant already made from one page **does** carry over to the other in Chromium — permissions are origin-scoped, not path-scoped), a kiosk device that has never previously visited `/print/[token]` on this exact browser will need a one-time "Connect Printer" step before its first badge print — reusing the identical connect-flow UI `/print/[token]` already has, not a new one. Network/Zebra-IP printers have no such requirement and work immediately.

This is documented behavior for event staff, not something the code can eliminate — flag it in the admin UI's print-station-linking step ("USB printers may need a one-time connection step on this device").

## Out of Scope (explicitly)

- `mode: 'print'` (print-only kiosk stations, no check-in) — still unbuilt, still Stage-1-schema-only, unrelated to this feature.
- Auto-print on check-in (rejected in favor of the explicit "Print Badge" button, per the clarifying answer above).
- The full Print Station device toolkit (camera QR scanner, manual search, printer picker) appearing on the kiosk UI — the kiosk's own existing check-in/search flow (Stage 1/2) stays exactly as-is; only a print trigger is added post-check-in.
- Any change to the standalone `/print/[token]` or `/events/[eventId]/print-stations` pages themselves — they keep working exactly as today for print-only stations. This feature only adds a new consumer of the same printer settings/audit trail.
- Rebuilding printer connectivity (USB/Zebra/thermal) from scratch — this feature is explicitly a reuse of the existing, working implementation.
- Exit-pin lockdown, kiosk-launcher, and everything else Stage 3 already deferred — unaffected, still deferred.

## Testing

- Route tests for `/api/kiosk-stations`'s `POST`/`PATCH` gaining `print_station_id` and the widened `mode` check — valid `checkin_and_print` creation, missing `print_station_id` on that mode rejected, missing `list_id` on that mode rejected, `print_station_id` from a different event rejected (mirroring the existing `list_id`-cross-event check already in that route).
- Route/component tests for the kiosk device's print-trigger call and its reprint-warning branch (exact shape depends on which existing print endpoint/helper is reused — determined during planning).
- Manual verification (extends Stage 3's own Task 10 hardware-verification step, not a new standalone step): provision a `checkin_and_print` station linked to a real print station, check someone in, confirm the "Print Badge" button appears and a real badge prints via that print station's actual printer, confirm the reprint-warning fires on a second tap, confirm a USB-printer-only device that never visited `/print/[token]` before is prompted to connect the printer once.
