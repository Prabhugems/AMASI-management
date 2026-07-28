# Kiosk Stations — "Check-in + Print Badge" Mode Design

**Date:** 2026-07-28
**Status:** Approved for planning

## Context

Kiosk Stage 3 (`docs/superpowers/specs/2026-07-27-kiosk-stage3-station-identity-design.md`, PR #122, merged 2026-07-28) shipped admin-provisioned `kiosk_stations` for self-check-in devices only. Its own design spec explicitly scoped `mode: 'print'` support out: *"The admin creation UI should only expose `mode: 'checkin'` for now — not offer a mode selector that doesn't do anything yet."*

Separately, this app already has a mature, independent badge-printing system: `print_stations` (admin page `src/app/events/[eventId]/print-stations/page.tsx`, device page `src/app/print/[token]/page.tsx`) — supporting browser/Zebra-network/thermal/USB printer types, badge templates (`badge_templates.template_data` + `template_image_url`), reprint policy (`allow_reprint`, `max_reprints`), and a `print_jobs` audit table. Its USB path (confirmed by reading `src/app/print/[token]/page.tsx`) still calls a server endpoint (`/api/local-print`) to *render* the badge before sending bytes over WebUSB — it is not local-first end to end today. `kiosk_stations` has carried an unused `print_station_id` column (nullable FK → `print_stations`) since Stage 1 — schema headroom clearly intended for exactly this kind of linkage, never wired up.

The user's request, from a hand-drawn flow diagram: on the **same** Kiosk Stations admin page, a station should be creatable in one of two roles — "Checkin" (today's Stage 3 behavior, unchanged) or "Print Badge" (check-in **and** badge printing, both from the same device). This went through two rounds of decisions:

**Round 1 (flow shape):**
1. Check-in happens first (today's kiosk flow, byte-for-byte unchanged); a **"Print Badge"** button appears on the success screen.
2. Printer config is **linked from an existing, already-configured Print Station** (reusing `print_station_id`) rather than duplicating printer setup UI.
3. Reprinting shows a **warning confirmation** rather than silently reprinting or blocking outright.

**Round 2 (explicit engineering decisions, superseding parts of Round 1):**
4. Combined check-in + print stations are **USB direct, Android only** — no Zebra-network, no thermal-over-network, no browser print-dialog fallback for this mode.
5. **Feature-detect `navigator.usb`** on the kiosk device; if absent, hide print-mode UI entirely — no picker, no "Connect Printer" button offered on a device that structurally cannot support it (this is how "Android only" is enforced in practice: WebUSB is unavailable on iOS Safari and most non-Chromium browsers, so the feature-detect naturally excludes them).
6. The print path is **local-first**: the badge renders from the already-cached delegate record with **no network call** at print time. This is a materially different, stricter requirement than the existing Print Station USB path, which still round-trips to `/api/local-print` to render — this feature cannot reuse that endpoint and needs new client-side rendering.
7. **Auto-print is a per-station setting**: when enabled, the badge prints automatically right after a successful check-in; the "Print Badge" button still renders regardless (auto-print on or off), now serving as the **manual (re)print** trigger — so Round 1's warn-before-reprint behavior (item 3) applies uniformly whether the first print was automatic or the button was tapped manually.
8. Badge composition is an **HTML5 canvas composite**: draw the cached `template_image_url` background plus text overlays (name/designation/institution/registration number, per `template_data`'s field-position schema) onto a canvas client-side, then convert to the USB printer's expected raster/print format.

**Technical correction found during planning research:** the existing `/print/[token]/page.tsx` already implements exactly this composite — but via an HTML/CSS template engine (`generatePrintContent`/`renderElementToHtml`, handling `template_data.elements` of type text/shape/image/photo/line/qr_code/barcode) rasterized through `html2canvas` (an already-installed dependency, not a new one) into a canvas, then `src/lib/usb-printer.ts`'s `printBadgeViaUsb(canvas, paperSize)` sends it over WebUSB — and this entire pipeline is already network-free once its inputs (`registration`, `badge_template`, `print_settings`) are in hand. These functions are currently private closures inside that one page component. The real work here is **extracting them into a shared module** so both the standalone Print Station page and the new kiosk flow use the identical, already-battle-tested rendering logic — not writing a new hand-rolled canvas-drawing implementation.

## Goal

Add a third `kiosk_stations.mode`, `'checkin_and_print'`, so one admin-provisioned, one-URL Android kiosk device can check a delegate in and print their badge over a directly-connected USB printer — entirely offline-capable at print time, with printer identity/config borrowed from an existing Print Station rather than duplicated.

## Design

### 1. Schema

Widen the existing `mode` CHECK constraint on `kiosk_stations`:

```sql
alter table kiosk_stations drop constraint kiosk_stations_mode_check; -- exact constraint name to be confirmed at implementation time
alter table kiosk_stations add constraint kiosk_stations_mode_check
  check (mode in ('checkin', 'print', 'checkin_and_print'));
```

Also add a per-station auto-print toggle (item 7):

```sql
alter table kiosk_stations add column if not exists auto_print_badge boolean not null default false;
```

Semantics going forward:
- `mode = 'checkin'` (Stage 3, unchanged): requires `list_id`, ignores `print_station_id`/`auto_print_badge`.
- `mode = 'print'` (schema-ready since Stage 1, still not built — out of scope here, unchanged): would require `print_station_id`, ignore `list_id`.
- `mode = 'checkin_and_print'` (this feature): requires **both** `list_id` and a `print_station_id` that resolves to a Print Station configured with `print_settings.printer_type = 'usb'`. `auto_print_badge` is meaningful only on this mode.

No change to `checkin_records.station_id` (Stage 3) or any other already-shipped Stage 3 column.

### 2. Admin UI — `src/app/events/[eventId]/kiosk-stations/page.tsx`

The create dialog gains a mode choice (radio buttons — only two real choices for now, matching the user's own mockup):
- **Check-in only** (today's default/only option)
- **Check-in + Print Badge**

Selecting "Check-in + Print Badge" reveals:
- **Print Station** picker, populated from the existing print-stations list endpoint, **filtered to `print_settings.printer_type === 'usb'` only** (confirm exact route/response shape and where `printer_type` lives in the returned payload at implementation time). If the event has no USB-type Print Station yet, show a clear message pointing to the Print Station admin page to create/configure one first, rather than a silently-empty dropdown.
- **Auto-print badge on check-in** toggle (defaults off, matches `auto_print_badge`'s schema default).
- A static note: "Requires an Android device with a directly-connected USB printer. Other devices will show check-in only, even if this station is configured for printing." (documents item 5's runtime behavior — see Section 4).

`POST`/`PATCH /api/kiosk-stations` gain `print_station_id` and `auto_print_badge` fields, with the same cross-event validation already used for `list_id` (reject a `print_station_id` belonging to a different event) plus the new `printer_type === 'usb'` check. The existing "Change list" reassignment control gets a parallel "Change print station" control for `checkin_and_print`-mode rows.

### 3. Device UI — `src/components/kiosk/KioskCheckinScreen.tsx` and `/kiosk-station/[token]`

`/kiosk-station/[token]/page.tsx` already resolves the full `kiosk_stations` row; it additionally resolves (when linked) the print station's `badge_template_id` → `badge_templates` row, and passes `mode`, `autoPrintBadge`, and the resolved template down as new props on `KioskCheckinScreen`.

**Bootstrap (online, once):** when a `checkin_and_print` station comes online, alongside the existing delegate-roster fetch (Stage 1's `refreshFromServer`), it also fetches and caches the linked badge template's `template_data` JSON and the `template_image_url` background image (fetched once, stored as a blob in the same IndexedDB store used for the delegate cache) — this is the one-time network dependency that makes the print path local-first afterward.

**On the device (runtime):** before rendering any print-related UI, feature-detect `"usb" in navigator`. If absent, the station behaves exactly like `mode: 'checkin'` for that session — no print button, no "Connect Printer" prompt, no error message implying something is broken (it isn't; the device just can't do this).

If `navigator.usb` is present:
- First use on a given browser/device needs a one-time "Connect Printer" step (`navigator.usb.requestDevice()`, a user-gesture-gated picker) — reusing the same connect-flow UI `/print/[token]` already has for its USB path, not a new one. WebUSB permissions are origin-scoped, so a device that already paired via `/print/[token]` on this exact browser does not need to repeat this step.
- On a successful check-in: if `auto_print_badge` is on, the badge prints automatically (composited on canvas from the cached template + the cached delegate record, converted to the USB printer's expected format, sent via the already-paired WebUSB connection) with **no network call**. The "Print Badge" button still renders on the success screen either way.
- Tapping "Print Badge" (whether after an auto-print or as the first manual print) checks the local cache for a prior successful print of this registration on this station; if one exists, shows a warning confirm ("Already printed at HH:MM — print again?") before re-sending. This check and the print itself are both local-only — no server round-trip, no dependency on `print_jobs` at print time.
- Print outcomes (success/failure, timestamp) are recorded locally for the reprint-warning check above, and synced to the server's `print_jobs` table opportunistically whenever the device is next online (mirroring the existing scan-queue sync pattern from Stage 1/2) — so server-side audit trail stays consistent without gating the print action on connectivity.

### 4. Platform constraint enforcement

"Android only" is enforced structurally, not by user-agent sniffing: WebUSB (`navigator.usb`) is unavailable on iOS Safari and most non-Chromium browsers, so feature-detecting it is sufficient in practice. A desktop Chrome/Edge browser technically has `navigator.usb` too; this design does not attempt to additionally block desktop — the admin-facing note in Section 2 documents the intended deployment (Android tablet, USB printer) without hard-blocking other Chromium environments that happen to have the API.

## Out of Scope (explicitly)

- `mode: 'print'` (print-only kiosk stations, no check-in) — still unbuilt, still Stage-1-schema-only, unrelated to this feature.
- Zebra-network, thermal-over-network, and browser-print-dialog paths for `checkin_and_print` stations — USB direct only, per the explicit decision. (The standalone Print Station system keeps all of these for its own, unrelated `mode: print`-style stations.)
- The full Print Station device toolkit (camera QR scanner, manual search, printer picker) appearing on the kiosk UI — the kiosk's own existing check-in/search flow (Stage 1/2) stays exactly as-is; only a print trigger is added post-check-in.
- Any change to the standalone `/print/[token]` or `/events/[eventId]/print-stations` pages themselves — they keep working exactly as today. This feature only reads a Print Station's `print_station_id`/`badge_template_id`/`print_settings` linkage; it does not modify that system's own server-rendered `/api/local-print` path.
- Rebuilding the *existing* printer connectivity plumbing (WebUSB device pairing/reconnection helpers already in `src/lib/usb-printer.ts`) — reused as-is. What's newly built is the *local, network-free badge rendering* step, which the existing print flow does not have.
- Exit-pin lockdown, kiosk-launcher, and everything else Stage 3 already deferred — unaffected, still deferred.

## Testing

- Route tests for `/api/kiosk-stations`'s `POST`/`PATCH` gaining `print_station_id`/`auto_print_badge` and the widened `mode` check — valid `checkin_and_print` creation, missing `print_station_id` on that mode rejected, missing `list_id` on that mode rejected, `print_station_id` from a different event rejected, `print_station_id` pointing at a non-`usb` Print Station rejected.
- Unit tests for the canvas-composite badge renderer (given a fixed template + delegate record, produces the expected draw calls/output) and for the local reprint-check logic, following this codebase's established no-DOM-shim Vitest constraint (mock canvas APIs rather than requiring a real DOM).
- Manual verification (extends Stage 3's own Task 10 hardware-verification step): provision a `checkin_and_print` station on a real Android device linked to a real USB-type Print Station, pair the printer once, check someone in with auto-print on (confirm the badge prints with no network activity visible in DevTools at print time) and with auto-print off (confirm the manual button), confirm the reprint warning fires on a second tap, confirm a non-Android/non-WebUSB device (e.g. an iPad) shows check-in only with no print UI at all, confirm print outcomes eventually sync to `print_jobs` once back online.
