# Per-list Badge Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the kiosk print UI from appearing on every check-in list of a `checkin_and_print` station — scope it to only the specific list(s) an admin has flagged as printing a badge.

**Architecture:** Add a new `checkin_lists.prints_badge` boolean column (list-level, same tier as `list_purpose`). Thread it through the three places a check-in list's shape already crosses a network/storage boundary (SSR initial load, manifest API, offline cache), then have `KioskStationShell` compute an effective per-list print mode instead of passing the station's raw mode straight through.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind, Shadcn UI — same as the rest of this codebase.

## Global Constraints

- No changes to `KioskCheckinScreen.tsx` itself — every print gate inside it already keys off its `mode` prop; only what gets passed into that prop changes.
- No changes to `/kiosk/[eventId]/[listId]/page.tsx` (direct-URL single-list path) — it never sets a `mode` prop, so it's already unaffected by this bug and out of scope for this fix.
- No changes to `kiosk_stations.mode`, `print_station_id`, `auto_print_badge`, or the WebUSB/printer-connection flow itself.
- Migration must be additive only (`DEFAULT false`, `IF NOT EXISTS`) and must backfill `prints_badge = true` for every check-in list currently assigned to a `checkin_and_print`-mode station, so no station's current printing behavior silently disappears the moment the migration lands.
- `npx tsc --noEmit` and `npx vitest run` must stay clean after every task.
- Per this repo's standing migration-safety rule, the migration file is committed but **not applied** until the user gives explicit go-ahead — do not run it via Supabase MCP without that.

---

### Task 1: Migration file — `checkin_lists.prints_badge`

**Files:**
- Create: `supabase/migrations/20260730_checkin_lists_prints_badge.sql`

**Interfaces:**
- Produces: a new nullable-free `prints_badge boolean not null default false` column on `checkin_lists`, and a data backfill. No code in this repo reads this column until Task 2, so this task has nothing to break.

This is a migration-file-only task — do not apply it (see Global Constraints).

- [ ] **Step 1: Write the migration**

```sql
-- Scopes badge printing to specific check-in lists instead of the whole
-- kiosk station. Previously, any list served by a checkin_and_print-mode
-- station showed print controls -- including lists like Lunch/Kit
-- Collection that have nothing to do with printing. Backfilled true for
-- every list currently on a checkin_and_print station so no station's
-- current printing behavior changes the moment this lands; admins can then
-- turn it off per-list going forward.
alter table checkin_lists
  add column if not exists prints_badge boolean not null default false;

update checkin_lists
set prints_badge = true
where id in (
  select ksl.checkin_list_id
  from kiosk_station_lists ksl
  join kiosk_stations ks on ks.id = ksl.station_id
  where ks.mode = 'checkin_and_print'
);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260730_checkin_lists_prints_badge.sql
git commit -m "feat(kiosk): add checkin_lists.prints_badge migration (not yet applied)"
```

---

### Task 2: Thread `prints_badge` through the server-side data paths

**Files:**
- Modify: `src/app/kiosk-station/[token]/page.tsx`
- Modify: `src/app/api/kiosk/station-manifest/route.ts`
- Modify: `src/lib/kiosk-offline-store.ts`

**Interfaces:**
- Consumes: the new `checkin_lists.prints_badge` column (added in Task 1; safe to select even before the migration is applied to production, since this task only changes code, and staging/dev may already have it — if the column genuinely doesn't exist yet in whatever database this code runs against, the select will error, exactly like any other not-yet-applied-migration code in this repo's established pattern of "commit code and migration together, apply migration before merge").
- Produces: `StationManifestList` (in `kiosk-offline-store.ts`) and the manifest API's response both carry `prints_badge: boolean` per list. This is what Task 3 consumes.

- [ ] **Step 1: SSR initial-load query**

In `src/app/kiosk-station/[token]/page.tsx`, find the `.select(...)` call on `checkin_lists` (currently `"id, name, list_purpose, kiosk_opens_at, kiosk_closes_at, kiosk_force_state"`) and add `prints_badge`:

```ts
  const { data: lists } = listIds.length > 0
    ? await (supabase as any)
        .from("checkin_lists")
        .select("id, name, list_purpose, prints_badge, kiosk_opens_at, kiosk_closes_at, kiosk_force_state")
        .in("id", listIds)
    : { data: [] }
```

No other change needed in this file — `lists` is passed straight through as `initialLists={lists}` untyped (`(supabase as any)`), so the new field rides along automatically once selected.

- [ ] **Step 2: Manifest API**

In `src/app/api/kiosk/station-manifest/route.ts`, find the `.select(...)` call on `checkin_lists` (currently `"id, name, list_purpose, kiosk_opens_at, kiosk_closes_at, kiosk_force_state"`) and add `prints_badge` the same way:

```ts
      .select("id, name, list_purpose, prints_badge, kiosk_opens_at, kiosk_closes_at, kiosk_force_state")
```

Check this route's response-shaping code (wherever it builds the `lists` array in its JSON response) and confirm `prints_badge` passes through — if it spreads the raw row (`...list`) it needs no further change; if it explicitly picks fields one-by-one, add `prints_badge` to that explicit list.

- [ ] **Step 3: Offline-cached shape**

In `src/lib/kiosk-offline-store.ts`, find:

```ts
export interface StationManifestList {
  id: string
  name: string
  list_purpose: string
  kiosk_opens_at: string | null
  // ...
}
```

Add `prints_badge: boolean` as a new field on this interface (alongside the existing fields — match the exact surrounding style/order, placing it next to `list_purpose` since they're the same tier of per-list flag).

- [ ] **Step 4: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors (the new field is additive to an interface, so nothing should break; if anything constructs a `StationManifestList` object literal without `prints_badge`, tsc will now catch it — fix that construction site to include it).
- [ ] Run: `npx vitest run` — expect no regressions.

- [ ] **Step 5: Commit**

```bash
git add "src/app/kiosk-station/[token]/page.tsx" src/app/api/kiosk/station-manifest/route.ts src/lib/kiosk-offline-store.ts
git commit -m "feat(kiosk): thread prints_badge through station manifest and SSR load"
```

---

### Task 3: `KioskStationShell` — compute effective per-list print mode

**Files:**
- Modify: `src/components/kiosk/KioskStationShell.tsx`

**Interfaces:**
- Consumes: `prints_badge: boolean` now present on every list object reaching this component (from Task 2's `StationManifestList` and the SSR `initialLists` prop).
- Produces: `KioskCheckinScreen` now receives a computed `mode`, not the raw station `mode` prop.

- [ ] **Step 1: Add `prints_badge` to `AssignedList`**

Find:

```ts
export interface AssignedList extends ScheduledList {
  id: string
  name: string
  list_purpose: string
}
```

Add `prints_badge: boolean` as a new field.

- [ ] **Step 2: Update `toAssignedLists`**

Find:

```ts
function toAssignedLists(manifest: StationManifest): AssignedList[] {
  return manifest.lists.map((l) => ({
    id: l.id,
    name: l.name,
    list_purpose: l.list_purpose,
    kiosk_opens_at: l.kiosk_opens_at,
    kiosk_closes_at: l.kiosk_closes_at,
    kiosk_force_state: l.kiosk_force_state,
  }))
}
```

Add `prints_badge: l.prints_badge` to the mapped object.

- [ ] **Step 3: Compute the effective mode at the `KioskCheckinScreen` call site**

Find the render block (around where `activeList` is truthy):

```ts
  if (activeList) {
    return (
      <KioskCheckinScreen
        key={activeList.id}
        ...
        listId={activeList.id}
        ...
        mode={mode}
        ...
```

Add, just above the `return`:

```ts
    // Printing is a property of the LIST, not the station -- a
    // checkin_and_print station only actually shows print controls on
    // lists an admin has explicitly flagged. Every other list on the same
    // station (e.g. Lunch, Kit Collection) behaves as checkin-only, even
    // though the station's printer hardware is fully configured.
    const effectiveMode = mode === "checkin_and_print" && activeList.prints_badge ? "checkin_and_print" : "checkin"
```

...and change `mode={mode}` to `mode={effectiveMode}` on the `<KioskCheckinScreen>` element. Do not change any other prop passed to `KioskCheckinScreen`.

- [ ] **Step 4: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Read back the full render block to confirm `effectiveMode` (not `mode`) is what's passed, and that every other prop on `KioskCheckinScreen` is untouched.

- [ ] **Step 5: Commit**

```bash
git add src/components/kiosk/KioskStationShell.tsx
git commit -m "fix(kiosk): scope print controls to lists flagged prints_badge, not the whole station"
```

---

### Task 4: Admin UI — `prints_badge` toggle on the check-in list editor

**Files:**
- Modify: `src/app/api/checkin-lists/route.ts`
- Modify: `src/app/events/[eventId]/checkin/lists/page.tsx`

**Interfaces:**
- Consumes: nothing new from earlier tasks — this task is independent of Tasks 2-3, only shares the same DB column from Task 1.
- Produces: `POST`/`PUT /api/checkin-lists` now accept and persist `prints_badge`; the list editor UI has a toggle for it.

- [ ] **Step 1: `POST` handler**

In `src/app/api/checkin-lists/route.ts`, find the `POST` handler's body destructuring:

```ts
    const { event_id, name, description, ticket_type_ids, addon_ids, starts_at, ends_at, list_purpose, kiosk_opens_at, kiosk_closes_at, kiosk_force_state } = body
```

Add `prints_badge` to the destructuring. Find the `.insert({...})` call further down and add `prints_badge: prints_badge ?? false,` to the inserted object (matching the style of the existing `kiosk_force_state: kiosk_force_state ?? null,` line).

- [ ] **Step 2: `PUT` handler**

Find the `PUT` handler's body destructuring:

```ts
    const { id, name, description, ticket_type_ids, addon_ids, starts_at, ends_at, is_active, sort_order, list_purpose, kiosk_opens_at, kiosk_closes_at, kiosk_force_state } = body
```

Add `prints_badge` to the destructuring. Find the `updateData` construction block (the series of `if (x !== undefined) updateData.x = x` lines) and add:

```ts
    if (prints_badge !== undefined) updateData.prints_badge = prints_badge
```

matching the existing pattern exactly (e.g. right next to the `is_active`/`list_purpose` lines).

- [ ] **Step 3: Admin UI toggle**

In `src/app/events/[eventId]/checkin/lists/page.tsx`:

1. Add `prints_badge: boolean` to whatever local type/interface models a check-in list row (find where `list_purpose: "entry" | "collection"` is declared at the top of the file, around line 39, and add the new field alongside it).
2. Add `prints_badge: false` as the default in the `formData` initial state (alongside `list_purpose: ""` around line 102).
3. In the effect/handler that populates `formData` from a selected existing list (around line 164, alongside `list_purpose: list.list_purpose`), add `prints_badge: list.prints_badge`.
4. In the save handler that builds the payload sent to `POST`/`PUT` (around lines 184-191, alongside `list_purpose: data.list_purpose`), add `prints_badge: data.prints_badge`.
5. In the reset-to-blank-form logic (around line 261-268, alongside `list_purpose: ""`), add `prints_badge: false`.
6. In the JSX "Settings" card (the block containing the existing "Active" `Switch`, around lines 709-728), add a second toggle row right after it:

```tsx
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <Label className="font-medium">Prints badge</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Only turn this on for the desk that actually prints badges. Other check-in jobs (meals, kit
                          collection) never need it, even on a station with a printer configured.
                        </p>
                      </div>
                      <Switch
                        checked={formData.prints_badge}
                        onCheckedChange={(checked) => setFormData({ ...formData, prints_badge: checked })}
                      />
                    </div>
```

- [ ] **Step 4: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/checkin-lists/route.ts "src/app/events/[eventId]/checkin/lists/page.tsx"
git commit -m "feat(kiosk): add Prints badge toggle to the check-in list editor"
```

---

### Task 5: Apply migration, regenerate types, final review, live verify

This task is NOT started until the user gives explicit go-ahead to apply the migration (per this repo's standing rule — see Global Constraints and `CLAUDE.md`'s migration history section).

- [ ] **Step 1: Ask for explicit go, then apply the migration** via Supabase MCP. Pre-flight: confirm `checkin_lists.prints_badge` doesn't yet exist; count existing `checkin_lists` rows and how many are joined to a `checkin_and_print`-mode station (the expected backfill-to-`true` count). Post-apply: confirm the column exists (`boolean`, not null, default `false`), and confirm exactly that many rows got backfilled to `true`, zero unexpected rows changed.
- [ ] **Step 2: Regenerate `src/lib/supabase/database.types.ts`** from the now-migrated database.
- [ ] **Step 3: Dispatch a final whole-branch review** across all four tasks' commits together (the standard subagent-driven-development final review step) — specifically check: does the effective-mode computation in `KioskStationShell` correctly fall back to `"checkin"` when `activeList` is null or `prints_badge` is undefined/missing (defensive against a manifest response that predates this feature, e.g. a stale service-worker cache)? Does the admin UI toggle correctly default to `false` for lists created before this feature (i.e. does a list with `prints_badge: undefined` in the client's local state render the switch as off, not crash)?
- [ ] **Step 4: Live-verify on collegeofmas.org.in**: on "Tablet 4" (the real station this bug was found on), use the admin editor to turn ON "Prints badge" for "Registration Check-in" only (leave Lunch/Kit Collection off, matching what the backfill already set — verify the backfill actually landed correctly here by checking these three lists' states before making any change). Then on the tablet: confirm Lunch and Kit Collection check-ins show no print/connect-printer UI at all, and confirm Registration Check-in still shows it exactly as before.
- [ ] **Step 5: Update `CLAUDE.md`'s migration history section** with this migration's entry, matching the existing format (applied date, pre/post-flight counts, explicit-go confirmation).
