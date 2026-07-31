# Per-list badge printing (fixing station-wide print gating)

## Problem

`kiosk_stations.mode` (`checkin` | `checkin_and_print`) is a station-wide setting. `KioskStationShell` passes the same `mode` to `KioskCheckinScreen` no matter which check-in list is currently active (`KioskStationShell.tsx:315`). Result: on a shared multi-list station configured `checkin_and_print` (e.g. "Tablet 4", serving Registration Check-in + Lunch + Kit Collection), checking someone in for **Lunch** also shows "Connect Printer" / "Print Badge" — even though nobody needs a badge printed at a lunch desk. Badges were already printed at Registration; Lunch and Kit Collection have nothing to do with printing.

Confirmed live on production (Tablet 4, 2026-07-30): the print/connect-printer UI appeared identically regardless of which of the station's three lists was active.

## Design

Printing becomes a property of the **check-in list**, not the station. New column `checkin_lists.prints_badge BOOLEAN NOT NULL DEFAULT false` — a list-level flag, same tier as the existing `list_purpose` column, since "does Lunch print a badge" doesn't depend on which tablet happens to serve it.

`KioskStationShell` already knows both the station's `mode` and the currently `activeList`. It computes an effective per-screen mode:

```ts
const effectiveMode = mode === "checkin_and_print" && activeList?.prints_badge ? "checkin_and_print" : "checkin"
```

...and passes `mode={effectiveMode}` (not the raw station `mode`) to `KioskCheckinScreen`. Every print-related gate inside `KioskCheckinScreen` already keys off its `mode` prop (`mode === "checkin_and_print"`), so this one change at the call site is sufficient — no changes needed inside `KioskCheckinScreen` itself.

`prints_badge` needs to flow through the same three places `list_purpose` already flows through, since these are the only three places a list's shape crosses a network/storage boundary before reaching `KioskStationShell`:
1. `src/app/kiosk-station/[token]/page.tsx` — the server-side initial-load `.select(...)` on `checkin_lists`.
2. `src/app/api/kiosk/station-manifest/route.ts` — the client-side manifest refresh endpoint.
3. `src/lib/kiosk-offline-store.ts`'s `StationManifestList` interface — the offline-cached shape.

Direct-URL single-list stations (`/kiosk/[eventId]/[listId]/page.tsx`) never set a `mode` prop on `KioskCheckinScreen` at all (defaults to checkin-only), so they're unaffected — this fix is scoped entirely to the shared-station shell.

## Migration & backfill

Additive column, default `false`. To avoid silently taking away printing from every list that currently has it (every list on every `checkin_and_print`-mode station works today, precisely because of the bug being fixed), the migration backfills `prints_badge = true` for every `checkin_lists` row currently joined (via `kiosk_station_lists`) to a station with `mode = 'checkin_and_print'`. This preserves the exact current behavior for every existing station at the moment the migration lands — nothing stops printing that used to print. From then on, an admin can go into a list's settings and turn printing off for lists like Lunch that shouldn't have it (the whole point of this fix).

## Admin UI

`src/app/events/[eventId]/checkin/lists/page.tsx` gets a new "Prints badge" `Switch` in the existing "Settings" card, next to "Active" — same pattern, no new UI section. `src/app/api/checkin-lists/route.ts`'s `POST`/`PUT` handlers accept and persist `prints_badge` the same way they already handle `list_purpose`/`is_active`.

## Out of scope

No change to `kiosk_stations.mode` itself (still governs whether a station has printing hardware wired up at all — `print_station_id`, `auto_print_badge`), no change to the printer-connection/WebUSB flow, no change to the direct-URL single-list kiosk path, no UI change to the tablet-facing menu screen (a list's tile doesn't need to visually indicate whether it prints — the volunteer only sees the difference once they enter that list's screen).
