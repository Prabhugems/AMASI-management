# Kiosk system — Phase 1 report

**Date:** 2026-08-02
**Source documents:** `Kiosk System Work Order - Approval.md` (the full autonomous work order), scoped down by a session brief that overrode its §0 authority clause — see §0 below.
**Branch:** `feat/kiosk-phase-1-tablet-health-menu-fixes` — PR opened, **not merged**.

---

## 0. Authority note

The work order's §0 says "proceed without asking permission… apply migrations, merge to production." That clause was treated as void for this session, per an explicit session brief: it conflicts with the standing CLAUDE.md rule against applying migrations without a human go-ahead, a rule that exists because of several documented incidents this year where code shipped ahead of its migration and broke production. This session:

- Wrote one new migration file, **did not apply it**.
- Made all code changes on a branch, **did not merge**.
- Used Supabase MCP **read-only** twice (`information_schema` column check, `list_migrations`) to diagnose a real discrepancy found mid-session (§3.1 below) — no writes.

---

## 1. What was built

| Ref | What | Notes |
|---|---|---|
| §6.1 | Screen wake lock | New `useScreenWakeLock()` hook, held for `KioskCheckinScreen`'s mount lifetime — which already *is* "a job is active" (the shell unmounts it entirely on return to menu; the direct-URL path never shows a menu at all), so no extra active/inactive state was needed. Feature-detects `"wakeLock" in navigator`, re-acquires on `visibilitychange`, releases on unmount. Genuine failures (not "unsupported") go to Sentry. |
| §6.2 | Battery in footer | New `useBatteryStatus()` hook (`navigator.getBattery()`, feature-detected) + `<BatteryStatusBadge>`. Renders nothing at all on unsupported browsers (iOS Safari) — no placeholder. Added to the scan-screen footer, the printer-setup footer, and the menu-screen footer. Low-battery (<20%) uses **orange**, deliberately not the amber/red reserved for check-in results. |
| §2.1/§2.2 | Tile sizing + equal row heights | `JobTile` (`KioskStationShell.tsx`) now uses identical padding/icon/text sizing for open and closed tiles — previously open tiles had substantially larger padding than closed ones, which was the actual cause of uneven rows, not just the two-column open/closed split. Roughly halved vertical padding and icon/text size. Added `content-start` to the grid so tiles pack at their natural height instead of stretching to fill the screen. |
| §2.4 | Light background | Menu screen already used theme-aware tokens (`bg-background` etc.) — it only needed the app to stop defaulting to dark. Added `useForceLightTheme()` (forces `next-themes` to `"light"` for this browser instance; app-wide default in `layout.tsx` is untouched). The scan/idle screen, success screen, and printer-setup screen were **hardcoded** to a dark slate palette regardless of theme (`bg-gray-800/50`, `text-white`, etc.) — recolored to theme-aware tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`) across all three. **Deliberately left unchanged:** the category-colored header band (already a solid, theme-independent blue/violet/cyan-600 bar with white text — not the dark-theme problem), the camera video viewport and its black overlay/scrim controls (need a dark frame for contrast against live video regardless of page theme), and the `bg-sidebar` footers (`KioskStationFooter`, menu footer) — those match the same always-dark-sidebar convention used by the main admin dashboard and are what §2.5 says to keep, not rebuild. |
| §2.5 | Verify footer + printer icon | Confirmed: `JobTile`'s printer-vs-clipboard icon logic (`mode === "checkin_and_print" && list.prints_badge`) is byte-identical to before, just resized. Footer fields (station/list/online) untouched; only `BatteryStatusBadge` added as a new sibling element. |
| §9.1 | Offline copy | **Already correct** — no change made. `OfflineTransitionScreen` already says "A duplicate scanned on THIS tablet is always caught instantly. A duplicate collected on another tablet won't show here until you're back online" (commit `98f1280`, 2026-07-30). |
| §9.2 | Remove "By [volunteer]" | **Already correct** — no change made. `DuplicateWarningScreen` never had a volunteer-attribution row; commit `629cf76` explicitly notes "no volunteer-name row, per explicit product decision." Only When/Where are shown. |
| §10 | Station self-test page | New route `/kiosk-station/[token]/self-test` (server component resolving the station, same lookup as the main kiosk page) rendering a new `<StationSelfTest>` client component. Reachable via a small, low-emphasis text link ("Station self-test") next to the clock chip on the menu screen — deliberately not a tile a volunteer could mistake for a job. Covers: printer type/connection/test-print-with-confirmation (reuses the exact same `testUsbPrinter`/`printHtmlViaBrowser` calls and Yes/No confirm pattern as the real printer setup screen — no new print logic), scanner scan-to-verify (burst-timing heuristic, **never calls a check-in/lookup endpoint** — just detects that a fast keystroke burst arrived), cached roster count + last-updated time per assigned list (reads IndexedDB only), pending sync queue depth per list, online/offline, battery, live device clock, and a device-clock-accuracy check (compares local time to the `Date` response header from the existing read-only station manifest endpoint — the closest a web page can get to "is this on automatic network time" without an OS-level API). Entirely read-only: no check-in, no write, no real test print without its own explicit confirmation step. |

---

## 2. What was skipped, and why

- **§2.3 (distinct icon per category)** — skipped per the session brief. **Important correction to the brief's own premise, though:** the brief said this was blocked on a migration this session couldn't apply. That's no longer true — see §3.1 below, the `checkin_lists.category` migration and an entire colour-system feature chain (SSR threading, manifest API, offline cache, admin UI, Checkin Hub cards, kiosk tile icon circles, scan-screen header band, station admin list pills) were already built and are already live in production, from work done 2026-07-31–08-01, independent of this session. §2.3 (icons) specifically was left undone by that prior work and could likely be picked up in a future session with no migration blocker at all now. Left untouched here to respect the brief's explicit scope boundary, not because it's still blocked.
- **§5 (name search), §6.3 (scanner disconnect), §6.4 (printer state), §8 (printing)** — deferred per the brief (scan/print path, supervised session only). §8 was confirm-only, see §4 below.
- **§4 (help desk screen), §7 (reporting)** — deferred per the brief.
- **§3 (remove volunteer correction/override paths)** — reported, not touched, per the brief.
- **Everything else in the work order not in the brief's Build table** — out of scope for this session by the brief's own framing ("Build only the following").

---

## 3. Migrations

**None were applied.** One new file was written; one pre-existing gap was found and documented (not written by this session).

### 3.1 — Found already applied to production (documentation gap, not a code gap)

`supabase/migrations/20260731_checkin_lists_category.sql` — adds `checkin_lists.category` (NOT NULL, backfilled via a name-regex heuristic: meal-name matches → `food_drink`, `list_purpose = 'collection'` → `goods_kits`, else `entry_access`). This file, and eight downstream commits that thread `category` through SSR/the manifest API/the offline cache and colour five different UI surfaces by it, were already on `main` before this session started. A read-only check (`information_schema.columns`, then `list_migrations`) confirmed the column **is live in production** (`schema_migrations` version `20260731132217`) — it just has no entry in CLAUDE.md's migration-application history, which is otherwise a complete log of every apply this year. This was a real risk worth surfacing: if it had turned out *not* applied, every kiosk station-manifest fetch on production would currently be broken (the exact "code shipped ahead of its migration" incident class CLAUDE.md already documents four times over). It wasn't broken — just undocumented. Added a CLAUDE.md entry recording the finding so it isn't invisible going forward.

**Consequence for this session's scope:** the brief asked for a *nullable* `category` column with the backfill as a *separate reviewable file*. That migration already exists with different characteristics (NOT NULL, inline backfill) and is already live — writing a second, conflicting file for the same column would be actively harmful. No new file was written for this.

### 3.2 — Found already existing, no migration needed

Per-event admin phone number (work order §6.5): `events.contact_phone` already exists, is already per-event, already editable in the event settings UI, and is already read by the kiosk's `PrinterSetupScreen` ("Printer trouble? Call {contactPhone}"). No new column needed. Gap (not fixed this session, out of scope): it's fetched once server-side and isn't part of the polled/cached station-manifest response, so it isn't available offline to the menu screen's footer — only to the one-time printer setup screen.

### 3.3 — New file, written but not applied

`supabase/migrations/20260802_event_settings_help_desk_location.sql`

```sql
alter table event_settings
  add column if not exists help_desk_location text;

comment on column event_settings.help_desk_location is
  'Per-event help desk location shown to volunteers/delegates on kiosk help-affordance copy. NULL = no location shown (current generic copy).';
```

Additive, nullable, no backfill, zero behavior change until something reads it. **Note on the work order's own premise**: it describes this as replacing a hardcoded "Hall A entrance" string. No such hardcoded location string exists anywhere in the kiosk code (see §4 item 3 below) — the kiosk's help copy is already generic ("contact the registration desk", "see the help desk"). This migration is forward-looking (lets a future pass show a real location), not a bugfix.

---

## 4. §8 / §9 / §9.4 status audit (confirm-only, per the brief — nothing here was built)

### §8 — badge printing spec (vs. `docs/superpowers/specs/2026-07-31-badge-printing-admin-configured-design.md`; the work order's named `badge-printing-admin-configured-spec.md` doesn't exist under that name)

| # | Requirement | Status |
|---|---|---|
| 1 | Both print paths (ESC/POS-over-WebUSB + `window.print()` with correct `@page` sizing) | **Done** |
| 2 | Admin configures, volunteer chooses nothing | **Done** |
| 3 | Printer setup before scanning, not after first scan | **Done** |
| 4 | Test print requires "Did a badge come out?" confirmation | **Done** — explicitly guards against the exact LaserJet false-positive named in this work order's §0.5 |
| 5 | Print failure ≠ check-in failure, "Skip and continue" exists | **Done** |
| 6 | Persistent "Reprint last badge" on success + ready screens, local-first | **Partial** — fully correct on the idle/ready screen; the success screen only has a generic "Print Badge" button (not a small, persistent, name-labeled reprint action) as its primary action. Also a narrow edge case: `browser-print.ts`'s `window.print()` path writes the full document `<head>` into the print iframe, so a badge template using a custom Google Font would trigger a live network fetch at print time — Path A (USB) strips the `<head>` first and is unaffected. |

### §9 — screen corrections (the work order's named `checkin-screens-corrections.md` doesn't exist anywhere in the repo or its history; closest trace is a commit message, not a doc)

| # | Item | Status |
|---|---|---|
| 1 | Offline copy: "this desk" not "duplicates are caught" | **Already correct** — see §1 above |
| 2 | Remove "By [volunteer]" from duplicate card | **Already correct** — never existed, deliberate original decision |
| 3 | Help desk location hardcoded to "Hall A entrance" | **Not found** — no such string exists in kiosk code anywhere. The only literal "Hall A entrance" in the whole repo is an unrelated placeholder on the abstracts presenter check-in page. Kiosk help copy is generic today; §3.3's new migration is forward-looking, not a fix for an existing hardcode. |
| 9.4 | Station naming consistency (tablet-name vs. desk-name) | **Real inconsistency found, not fixed (report only per the brief).** The admin CRUD list page instructs desk-based naming ("named after its desk"). The add-station wizard contradicts it: it auto-suggests `"Tablet N"` as the default name (regex-matching existing `Tablet (\d+)` names) and uses `"e.g. Tablet 3"` as its placeholder, directly under helper text that itself says "so the volunteer knows which desk they're on." The kiosk device side is naming-agnostic — it only ever renders whatever name the admin gave it, so the inconsistency originates entirely in the add-station wizard's default/placeholder, not the device. The sibling Print Stations admin page uses a desk-style placeholder consistently ("e.g., Main Registration Desk"), reinforcing that the kiosk wizard's `"Tablet 3"` default is the outlier. |

---

## 5. Three open decisions (restated with what the code told us — not resolved)

1. **§4 "reverse a wrong check-in" — hard delete vs. compensating record?** Not investigated further this session (§4 is fully deferred). Whichever is chosen determines whether §7.1/§7.2 reporting stays auditable — a hard delete of a `checkin_records` row would make "how many people were wrongly checked in and corrected" unanswerable later; a compensating record (a new row marking a reversal, not removing the original) would preserve that. No audit-log migration was written this session per the brief, pending this decision.
2. **§4 name edit + reprint vs. local-first — how does an admin's laptop edit reach a tablet's cached roster?** Not investigated further this session (§4 deferred). What the code told us: the offline store (`kiosk-offline-store.ts`) caches each list's roster via `replaceDelegateCache`, refreshed by `KioskStationShell` on a 5-minute poll plus a cold-start fetch — there is no push/invalidation path today, so an admin's edit would only reach a tablet on its next scheduled poll (up to 5 minutes) or a manual reload, and only while that tablet is online. Worth deciding explicitly rather than assuming "it'll sync eventually" is fast enough for a delegate standing at the desk expecting a corrected badge.
3. **§1 backfill — how long does the "meal lists render cyan" window last, and can it be made safer?** Superseded by what was found in §3.1: the *actual* backfill already live in production is smarter than the work order assumed — it pattern-matches list names against `breakfast|lunch|dinner|tea|coffee` and assigns `food_drink` directly, falling back to `goods_kits` only for other collection-purpose lists (kits, badges, etc.) and `entry_access` for everything else. So most meal lists were almost certainly never cyan to begin with; the manual-correction window in practice is bounded to lists whose names don't match that regex (e.g. a meal list named something unconventional). Whether any such lists exist on the live event should be checked directly (`select name, category from checkin_lists where category = 'goods_kits'` and eyeball for anything meal-shaped) rather than assumed from the original naive backfill this open question was written against.

---

## 6. What must be tested on real hardware

Nothing in this pass — or in this whole project, per the standing memory note — has run on the real DC421 Pro → USB hub → Mi tablet → scanner chain. Specifically from this session's changes:

- **Wake lock**: confirm it actually holds on the real Mi tablets' Android WebView/Chrome build, and that the re-acquire-on-visibilitychange path works after the tablet's own screen-lock kicks in (not just backgrounding a browser tab).
- **Battery API**: confirm `navigator.getBattery()` is actually available on the tablets' browser (Android Chrome supports it inconsistently by version/build) — if unsupported, the badge should silently not render (verify it degrades quietly rather than erroring).
- **Self-test page's scan-to-verify**: the burst-timing heuristic (`SCAN_MAX_AVG_GAP_MS = 50`) was copied from the real scan screen's tuning, but has never been run against the actual scanner hardware from this page specifically — confirm a real scan is detected reliably and manual typing isn't false-positived as "scanner working."
- **Self-test page's printer test**: exercises the same `connectUsbPrinter`/`testUsbPrinter` WebUSB calls as production, but from a different page/route — confirm the WebUSB device picker and permission grant behave the same here as on the main kiosk screen (WebUSB permissions can be origin *and* sometimes navigation-path sensitive on some Android builds).
- **Light theme on the real tablets**: confirm the forced-light screens are actually more legible under real hall lighting/glare than the previous dark theme — this was a design judgment call based on the work order's stated complaint, not something a browser preview can validate.
- **Menu tile sizing**: confirm 6-8 tiles genuinely fit without scrolling on the actual Mi tablet screen size/resolution/browser chrome, not just at common preview breakpoints.
- **Device-clock-accuracy check**: only works while online (it round-trips to the server); confirm the messaging is clear enough for an admin doing pre-event setup without a data connection to know to check again once connected.

---

## 7. Everything from the confirm-only audits, for convenience

See §4 above for the full §8/§9/§9.4 tables. No code was changed based on those audits beyond what §1 already lists (§9.1/§9.2 required no changes — they were already correct).
