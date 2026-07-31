# Check-in List Category Colours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every ad-hoc/uniform colour currently used for check-in lists (the Checkin Hub's arbitrary index-cycled gradients, the kiosk menu tiles' uniform `bg-primary`, the plain kiosk scan-screen header, and the flat grey admin "list pills") with a single, consistent colour driven by a new `checkin_lists.category` column — set once by the admin, rendered identically everywhere.

**Architecture:** One new required enum column (`category`, mirroring the existing `list_purpose` field's "required, no default" UX exactly). One new shared module (`src/lib/checkin-list-category.ts`) is the single source of truth for the three categories' labels and Tailwind classes per surface — every screen imports from it, never hardcodes a category colour itself. Printing stays a per-tile icon overlay (already built, unchanged) — it is explicitly NOT a fourth colour category per the spec.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase — same as the rest of this codebase.

## Global Constraints

- Exactly three categories, exactly these colours: `entry_access` → **blue**, `food_drink` → **violet**, `goods_kits` → **cyan**. Never introduce a fourth category or a fourth colour.
- Never use green, amber, or red for a category colour anywhere — those are reserved for scan results (success/warning/error) and must stay visually unambiguous from list identity. This applies to every Tailwind class chosen in the shared colour module.
- Do not touch the existing staff scanner's amber duplicate-scan card (a separate, older screen, out of scope) or the kiosk's own `DuplicateWarningScreen`/success/error screens' colours (green/amber/red there is scan-result colour, not list colour, and is correct as-is).
- Lunch vs Dinner (or any two lists in the same category) get the exact same colour — no per-list differentiation within a category. Do not add any per-list colour override.
- `category` is required with **no default** in the admin form, exactly matching the existing `list_purpose` field's UX (a save is blocked until both are explicitly chosen) — for NEW lists only. Existing lists are backfilled by the migration (Task 1) so nothing already in production is left without a category.
- Printing is never folded into the colour system — the printer icon on a menu tile (already built, `mode === "checkin_and_print" && list.prints_badge`) is unchanged and layers independently on top of whatever category colour the tile now has.
- `npx tsc --noEmit` and `npx vitest run` must stay clean after every task.
- The migration in Task 1 must NOT be applied without explicit user go-ahead, per this repo's standing migration-safety rule (see `CLAUDE.md`).

---

### Task 1: Shared colour module + migration file

**Files:**
- Create: `src/lib/checkin-list-category.ts`
- Create: `supabase/migrations/20260731_checkin_lists_category.sql`

**Interfaces:**
- Produces: `ListCategory` type, `LIST_CATEGORIES` (ordered array for building selectors), `CATEGORY_COLORS` (Tailwind classes per surface, keyed by category) — consumed by every task below.

- [ ] **Step 1: Write the shared module**

```ts
// Single source of truth for check-in list category colours (Badge
// Printing / Kiosk spec, July 2026: "Colour by category, not per job").
// Every screen that shows a list's colour imports from here -- never
// hardcode a category's colour inline elsewhere.
//
// Exactly three categories, exactly these colours. Never green, amber, or
// red -- those are reserved for scan results (success/warning/error) across
// the kiosk and must never be confused with list identity.
export type ListCategory = "entry_access" | "food_drink" | "goods_kits"

export const LIST_CATEGORIES: { value: ListCategory; label: string; description: string }[] = [
  {
    value: "entry_access",
    label: "Entry & access",
    description: "Registration, hall entry, course entry, sessions",
  },
  {
    value: "food_drink",
    label: "Food & drink",
    description: "Breakfast, lunch, dinner, tea",
  },
  {
    value: "goods_kits",
    label: "Goods & kits",
    description: "Kit, bag, headset, certificate",
  },
]

export const CATEGORY_COLORS: Record<
  ListCategory,
  {
    // Checkin Hub list card icon circle + kiosk menu tile background.
    solid: string
    // Kiosk scan-screen header band background.
    header: string
    // Admin "list pill" badge -- border/background/text, light+dark safe.
    pill: string
    // Small status dot (e.g. group headers, legends).
    dot: string
    // Admin category-picker card -- selected-state border+background.
    formSelected: string
    // Admin category-picker card -- unselected-state hover border.
    formHover: string
  }
> = {
  entry_access: {
    solid: "bg-blue-600",
    header: "bg-blue-600",
    pill: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
    formSelected: "border-blue-500 bg-blue-500/10",
    formHover: "hover:border-blue-500/40",
  },
  food_drink: {
    solid: "bg-violet-600",
    header: "bg-violet-600",
    pill: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
    formSelected: "border-violet-500 bg-violet-500/10",
    formHover: "hover:border-violet-500/40",
  },
  goods_kits: {
    solid: "bg-cyan-600",
    header: "bg-cyan-600",
    pill: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    dot: "bg-cyan-500",
    formSelected: "border-cyan-500 bg-cyan-500/10",
    formHover: "hover:border-cyan-500/40",
  },
}

// Every screen that renders a category colour receives `category` typed as
// `ListCategory | null | undefined` in practice (SSR selects, cached
// offline data, etc.) -- this is the one shared fallback for "no category
// yet" so every surface degrades identically instead of each screen
// inventing its own grey.
export function categoryColors(category: ListCategory | null | undefined) {
  return category ? CATEGORY_COLORS[category] : null
}
```

- [ ] **Step 2: Write the migration file (do NOT apply)**

Existing rows are backfilled by keyword match on name (food/drink keywords first), falling back to `list_purpose` (`collection` → `goods_kits`, `entry` → `entry_access`) -- confirmed against all 22 existing rows in production; every row's `list_purpose` is already `entry` or `collection` (`not null`), so the fallback always resolves.

```sql
alter table checkin_lists
  add column if not exists category text;

update checkin_lists
set category = case
  when name ~* '(breakfast|lunch|dinner|\mtea\M|coffee)' then 'food_drink'
  when list_purpose = 'collection' then 'goods_kits'
  else 'entry_access'
end
where category is null;

alter table checkin_lists
  alter column category set not null;

alter table checkin_lists
  add constraint checkin_lists_category_check
    check (category in ('entry_access', 'food_drink', 'goods_kits'));
```

- [ ] **Step 3: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors (new file only, no consumers yet).
- [ ] Run: `npx vitest run` — expect no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/lib/checkin-list-category.ts supabase/migrations/20260731_checkin_lists_category.sql
git commit -m "feat(kiosk): add list-category colour module + migration (not applied)"
```

---

### Task 2: `/api/checkin-lists` — accept and persist `category`

**Files:**
- Modify: `src/app/api/checkin-lists/route.ts`

**Interfaces:**
- Consumes: `ListCategory` from Task 1 (for validation only — the route itself stays untyped/any like its neighbours, matching this file's existing style).

- [ ] **Step 1: POST — require and validate `category`**

Find the POST handler's destructure (around line 115):

```ts
    const { event_id, name, description, ticket_type_ids, addon_ids, starts_at, ends_at, list_purpose, kiosk_opens_at, kiosk_closes_at, kiosk_force_state, prints_badge } = body
```

Add `category` to the destructure:

```ts
    const { event_id, name, description, ticket_type_ids, addon_ids, starts_at, ends_at, list_purpose, kiosk_opens_at, kiosk_closes_at, kiosk_force_state, prints_badge, category } = body
```

Find the `list_purpose` validation block (around line 124):

```ts
    if (list_purpose !== "entry" && list_purpose !== "collection") {
      return NextResponse.json(
        { error: "list_purpose is required and must be 'entry' or 'collection'" },
        { status: 400 }
      )
    }
```

Add an identical validation block for `category` immediately after it:

```ts
    if (category !== "entry_access" && category !== "food_drink" && category !== "goods_kits") {
      return NextResponse.json(
        { error: "category is required and must be 'entry_access', 'food_drink', or 'goods_kits'" },
        { status: 400 }
      )
    }
```

Find the insert object (around line 177, alongside `list_purpose,`):

```ts
        list_purpose,
        prints_badge: prints_badge ?? false,
```

Add `category,` alongside it:

```ts
        list_purpose,
        category,
        prints_badge: prints_badge ?? false,
```

- [ ] **Step 2: PUT — accept optional `category` update**

Find the PUT handler's destructure (around line 200):

```ts
    const { id, name, description, ticket_type_ids, addon_ids, starts_at, ends_at, is_active, sort_order, list_purpose, kiosk_opens_at, kiosk_closes_at, kiosk_force_state, prints_badge } = body
```

Add `category`:

```ts
    const { id, name, description, ticket_type_ids, addon_ids, starts_at, ends_at, is_active, sort_order, list_purpose, kiosk_opens_at, kiosk_closes_at, kiosk_force_state, prints_badge, category } = body
```

Find the `list_purpose` PUT validation (around line 206):

```ts
    if (list_purpose !== undefined && list_purpose !== "entry" && list_purpose !== "collection") {
      return NextResponse.json(
        { error: "list_purpose must be 'entry' or 'collection'" },
        { status: 400 }
      )
    }
```

Add the equivalent for `category` immediately after:

```ts
    if (category !== undefined && category !== "entry_access" && category !== "food_drink" && category !== "goods_kits") {
      return NextResponse.json(
        { error: "category must be 'entry_access', 'food_drink', or 'goods_kits'" },
        { status: 400 }
      )
    }
```

Find the update-data assembly (around line 246, alongside `if (list_purpose !== undefined) updateData.list_purpose = list_purpose`):

```ts
    if (list_purpose !== undefined) updateData.list_purpose = list_purpose
    if (prints_badge !== undefined) updateData.prints_badge = prints_badge
```

Add `category`:

```ts
    if (list_purpose !== undefined) updateData.list_purpose = list_purpose
    if (category !== undefined) updateData.category = category
    if (prints_badge !== undefined) updateData.prints_badge = prints_badge
```

- [ ] **Step 3: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/checkin-lists/route.ts
git commit -m "feat(kiosk): validate and persist checkin_lists.category in the API route"
```

---

### Task 3: Admin form — Category selector + Checkin Hub card colours

**Files:**
- Modify: `src/app/events/[eventId]/checkin/lists/page.tsx`

**Interfaces:**
- Consumes: `LIST_CATEGORIES`, `CATEGORY_COLORS`, `ListCategory` from Task 1.

- [ ] **Step 1: Add `category` to the `CheckinList` type and form state**

Find:

```ts
type CheckinList = {
  id: string
  name: string
  description?: string
  is_active: boolean
  list_purpose: "entry" | "collection"
  prints_badge: boolean
```

Add `category` (import `ListCategory` from the new module at the top of the file):

```ts
import { LIST_CATEGORIES, CATEGORY_COLORS, type ListCategory } from "@/lib/checkin-list-category"
```

```ts
type CheckinList = {
  id: string
  name: string
  description?: string
  is_active: boolean
  list_purpose: "entry" | "collection"
  category: ListCategory
  prints_badge: boolean
```

Find the form state (around line 103):

```ts
    list_purpose: "" as "" | "entry" | "collection",
```

Add a sibling field:

```ts
    list_purpose: "" as "" | "entry" | "collection",
    category: "" as "" | ListCategory,
```

Find where `list_purpose` is read back into form state on selecting an existing list (around line 166):

```ts
          list_purpose: list.list_purpose,
```

Add `category`:

```ts
          list_purpose: list.list_purpose,
          category: list.category,
```

Find the save-mutation call site (around line 187) that includes `list_purpose: data.list_purpose,` in the payload sent to the API, and the two `saveMutation.mutate(...)` calls (around lines 298, 300) that cast `list_purpose`. Add `category` alongside `list_purpose` in all three places (the payload build and both type casts), mirroring `list_purpose` exactly.

Find the reset-to-blank state (around line 265, alongside `list_purpose: "",`):

```ts
      list_purpose: "",
```

Add:

```ts
      list_purpose: "",
      category: "",
```

- [ ] **Step 2: Add the Category selector to the form UI**

Find the "Purpose — required" card (around line 675-716) and insert a new "Category — required" card immediately after its closing `</div>` (before the "Settings" card):

```tsx
                {/* Category — required, no default. Drives the colour
                    shown on this list's tile/pill/header everywhere it
                    appears -- never green/amber/red, those are reserved
                    for scan results. */}
                <div className="bg-card rounded-2xl border p-5 space-y-3">
                  <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                    Category <span className="text-destructive normal-case tracking-normal">(required)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {LIST_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat.value })}
                        className={cn(
                          "text-left rounded-xl border-2 p-4 transition-all",
                          formData.category === cat.value
                            ? CATEGORY_COLORS[cat.value].formSelected
                            : cn("border-border", CATEGORY_COLORS[cat.value].formHover)
                        )}
                      >
                        <p className="font-medium">{cat.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                      </button>
                    ))}
                  </div>
                  {!formData.category && (
                    <p className="text-xs text-destructive">Pick one — there is no default.</p>
                  )}
                </div>
```

- [ ] **Step 3: Gate Save on `category` too**

Find the Save button's `disabled` prop (around line 776):

```tsx
                      disabled={!formData.name.trim() || !formData.list_purpose || saveMutation.isPending || showSaved}
```

Add `|| !formData.category`:

```tsx
                      disabled={!formData.name.trim() || !formData.list_purpose || !formData.category || saveMutation.isPending || showSaved}
```

- [ ] **Step 4: Replace the Checkin Hub card's arbitrary gradient with the category colour**

Find `getGradient` (around line 327-337) and delete the entire function — it is fully replaced by the shared module, not kept as a fallback.

Find the card's icon-circle rendering (around line 397-402):

```tsx
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                        isSelected
                          ? "bg-white/20"
                          : `bg-gradient-to-br ${getGradient(index)} text-white`
                      )}>
```

Replace with:

```tsx
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white",
                        isSelected ? "bg-white/20" : CATEGORY_COLORS[list.category].solid
                      )}>
```

`lists.map((list, index) => {` still needs `index` for the React key context elsewhere in this block — leave the `.map` signature as-is even though `getGradient(index)` no longer exists; only remove the one call site above.

- [ ] **Step 5: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Manually confirm on the dev server: creating a new list requires picking a category (Save stays disabled until chosen, matching Purpose); editing an existing list shows its backfilled category pre-selected; Checkin Hub cards show blue/violet/cyan instead of the old 6-colour cycle (including former green/red slots).

- [ ] **Step 6: Commit**

```bash
git add "src/app/events/[eventId]/checkin/lists/page.tsx"
git commit -m "feat(kiosk): add Category selector to check-in list admin form, colour Checkin Hub cards by category"
```

---

### Task 4: Thread `category` through every server-side read path

**Files:**
- Modify: `src/app/kiosk-station/[token]/page.tsx`
- Modify: `src/app/api/kiosk/station-manifest/route.ts`
- Modify: `src/lib/kiosk-offline-store.ts`
- Modify: `src/components/kiosk/KioskStationShell.tsx`

**Interfaces:**
- Produces: `category` present on `AssignedList` (already exported from `KioskStationShell.tsx`), consumed by Task 5 and Task 6.

- [ ] **Step 1: SSR page select**

In `src/app/kiosk-station/[token]/page.tsx`, find:

```ts
        .select("id, name, list_purpose, prints_badge, kiosk_opens_at, kiosk_closes_at, kiosk_force_state")
```

Add `category`:

```ts
        .select("id, name, list_purpose, category, prints_badge, kiosk_opens_at, kiosk_closes_at, kiosk_force_state")
```

- [ ] **Step 2: `/api/kiosk/station-manifest` select**

In `src/app/api/kiosk/station-manifest/route.ts`, find:

```ts
      .select("id, name, list_purpose, prints_badge, kiosk_opens_at, kiosk_closes_at, kiosk_force_state")
```

Add `category`:

```ts
      .select("id, name, list_purpose, category, prints_badge, kiosk_opens_at, kiosk_closes_at, kiosk_force_state")
```

(No change needed to the response-shaping code below it — confirmed this route already spreads raw list rows through, matching the same pattern the `prints_badge` field used when it was added.)

- [ ] **Step 3: Offline store type**

In `src/lib/kiosk-offline-store.ts`, find:

```ts
export interface StationManifestList {
  id: string
  name: string
  list_purpose: string
  prints_badge: boolean
  kiosk_opens_at: string | null
  kiosk_closes_at: string | null
  kiosk_force_state: "open" | "closed" | null
}
```

Add `category`:

```ts
export interface StationManifestList {
  id: string
  name: string
  list_purpose: string
  category: "entry_access" | "food_drink" | "goods_kits"
  prints_badge: boolean
  kiosk_opens_at: string | null
  kiosk_closes_at: string | null
  kiosk_force_state: "open" | "closed" | null
}
```

- [ ] **Step 4: `AssignedList` + `toAssignedLists`**

In `src/components/kiosk/KioskStationShell.tsx`, find:

```ts
export interface AssignedList extends ScheduledList {
  id: string
  name: string
  list_purpose: string
  prints_badge: boolean
}
```

Add `category`:

```ts
export interface AssignedList extends ScheduledList {
  id: string
  name: string
  list_purpose: string
  category: "entry_access" | "food_drink" | "goods_kits"
  prints_badge: boolean
}
```

Find `toAssignedLists`:

```ts
function toAssignedLists(manifest: StationManifest): AssignedList[] {
  return manifest.lists.map((l) => ({
    id: l.id,
    name: l.name,
    list_purpose: l.list_purpose,
    prints_badge: l.prints_badge,
    kiosk_opens_at: l.kiosk_opens_at,
    kiosk_closes_at: l.kiosk_closes_at,
    kiosk_force_state: l.kiosk_force_state,
  }))
}
```

Add `category: l.category,`:

```ts
function toAssignedLists(manifest: StationManifest): AssignedList[] {
  return manifest.lists.map((l) => ({
    id: l.id,
    name: l.name,
    list_purpose: l.list_purpose,
    category: l.category,
    prints_badge: l.prints_badge,
    kiosk_opens_at: l.kiosk_opens_at,
    kiosk_closes_at: l.kiosk_closes_at,
    kiosk_force_state: l.kiosk_force_state,
  }))
}
```

`initialLists: AssignedList[]` (the prop passed in from the SSR page) needs no code change — it's typed against the same interface, and the SSR page's query (Step 1) now includes `category`, so the shape already matches once Step 1 lands.

- [ ] **Step 5: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors (this is where a missing `category` in any upstream select would surface as a type error against the now-required `AssignedList.category` field — that is the intended safety net for this task).
- [ ] Run: `npx vitest run` — expect no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/app/kiosk-station/\[token\]/page.tsx src/app/api/kiosk/station-manifest/route.ts src/lib/kiosk-offline-store.ts src/components/kiosk/KioskStationShell.tsx
git commit -m "feat(kiosk): thread checkin_lists.category through SSR, manifest API, and offline cache"
```

---

### Task 5: Kiosk menu tiles — category colour

**Files:**
- Modify: `src/components/kiosk/KioskStationShell.tsx`

**Interfaces:**
- Consumes: `CATEGORY_COLORS` from Task 1, `list.category` from Task 4's `AssignedList`.

- [ ] **Step 1: Import the colour module**

Add near the top of the file, alongside the other imports:

```ts
import { CATEGORY_COLORS } from "@/lib/checkin-list-category"
```

- [ ] **Step 2: Colour the tile's icon circle by category**

Find `JobTile`'s icon-circle span (around line 415-419):

```tsx
      <span
        className={`flex-none rounded-full flex items-center justify-center ${
          open ? "size-16 sm:size-[76px] bg-white/20" : "size-12 sm:size-[60px] bg-muted"
        }`}
      >
```

Replace with (the category colour only applies while `open` — a closed/disabled tile stays neutral grey, matching the existing disabled-state convention used for every other closed-tile element on this component):

```tsx
      <span
        className={`flex-none rounded-full flex items-center justify-center text-white ${
          open ? `size-16 sm:size-[76px] ${CATEGORY_COLORS[list.category].solid}` : "size-12 sm:size-[60px] bg-muted"
        }`}
      >
```

The icon inside (`Printer`/`ClipboardList`) currently has its own conditional text colour (`open ? ... : "text-muted-foreground"` with no explicit white for the open case, relying on inherited white from a parent) — confirm this still reads correctly against the new solid colour backgrounds (blue/violet/cyan all have enough contrast for a white icon, same as the previous `bg-white/20` treatment did against the primary-coloured tile).

- [ ] **Step 3: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Manually confirm: on the kiosk menu (Tablet 1 or equivalent), Registration Check-in's tile icon circle is blue, Lunch/Kit Collection are violet/cyan respectively (per their backfilled category), and a closed/not-yet-open tile still shows the neutral grey disabled treatment, not a category colour.

- [ ] **Step 4: Commit**

```bash
git add src/components/kiosk/KioskStationShell.tsx
git commit -m "feat(kiosk): colour menu tile icon circle by list category"
```

---

### Task 6: Kiosk scan-screen header band — category colour

**Files:**
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx`

**Interfaces:**
- Consumes: `CATEGORY_COLORS` from Task 1. Needs a new `category` prop threaded onto `KioskCheckinScreenProps` (same static-SSR-prop pattern as `contactPhone`/`printerType` before it), since this component doesn't otherwise know which list's colour to show.

- [ ] **Step 1: Import the colour module**

Add near the top of `KioskCheckinScreen.tsx`:

```ts
import { CATEGORY_COLORS, type ListCategory } from "@/lib/checkin-list-category"
```

- [ ] **Step 2: Add `category` prop**

Find `KioskCheckinScreenProps`'s `listClosesAt?: string | null` field and add immediately after:

```ts
  category?: ListCategory
```

Add `category` to the destructured function parameters (alongside `listClosesAt`).

- [ ] **Step 3: Thread it from `KioskStationShell`**

In `src/components/kiosk/KioskStationShell.tsx`, find the `<KioskCheckinScreen ... />` invocation (the one with `key={activeList.id}`) and add `category={activeList.category}` alongside the existing `listClosesAt={activeList.kiosk_closes_at}` line.

- [ ] **Step 4: Colour the idle/self-service scan screen's header band**

Find the idle screen's header (the bar showing the event name / list name for the self-service scan screen — NOT the printer setup screen, NOT the collection ready screen, which already has its own amber-tinted header per the Tito-model design). Search for the header block immediately preceding the "Switch list" button found earlier (around line 2180-2214, the `bg-primary text-primary-foreground` header bar). Find:

```tsx
      <div className="flex-none bg-primary text-primary-foreground px-6 sm:px-12 py-5 sm:py-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
```

Replace `bg-primary text-primary-foreground` with a category-driven class, falling back to `bg-primary` only if `category` is somehow unset (defensive, should not happen once Task 4 lands everywhere):

```tsx
      <div className={`flex-none text-white px-6 sm:px-12 py-5 sm:py-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 ${category ? CATEGORY_COLORS[category].header : "bg-primary"}`}>
```

Do NOT touch the `CollectionReadyScreen`'s header (already has its own distinct amber-family styling for collection-purpose lists per the existing Tito-model design) or the `PrinterSetupScreen`'s header (a distinct pre-scan screen, out of scope for this "identifiable from 2 metres while scanning" requirement) — this task colours only the actual scan screen a volunteer stands at while checking people in.

- [ ] **Step 5: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Manually confirm: the Registration Check-in scan screen's header band is blue; switching to a food/drink or goods list (where reachable without the collection-ready-screen override) shows violet/cyan respectively.

- [ ] **Step 6: Commit**

```bash
git add src/components/kiosk/KioskCheckinScreen.tsx src/components/kiosk/KioskStationShell.tsx
git commit -m "feat(kiosk): colour the scan-screen header band by list category"
```

---

### Task 7: Station admin "list pills" — category colour

**Files:**
- Modify: `src/components/kiosk-admin/station-controls.tsx`

**Interfaces:**
- Consumes: `CATEGORY_COLORS` from Task 1.
- Produces: widens the local `CheckinList` type to include `category`, consumed by `page.tsx`'s existing `lists` query (already fetches `.select("*")`, so no server-side change needed — confirmed in Task 2's research).

- [ ] **Step 1: Widen the `CheckinList` type**

Find:

```ts
export type CheckinList = { id: string; name: string; is_active?: boolean; list_purpose?: string }
```

Replace with:

```ts
export type CheckinList = { id: string; name: string; is_active?: boolean; list_purpose?: string; category?: "entry_access" | "food_drink" | "goods_kits" }
```

- [ ] **Step 2: Import the colour module**

Add near the top of the file:

```ts
import { CATEGORY_COLORS } from "@/lib/checkin-list-category"
```

- [ ] **Step 3: Colour the pills**

Find `StationListsPicker`'s `listNames` computation (around line 168-174):

```ts
  const listNames = station.list_ids
    .map((id) => {
      const list = lists.find((l) => l.id === id)
      if (!list) return null
      return counts?.[id] !== undefined ? `${list.name} · ${counts[id]}` : list.name
    })
    .filter(Boolean) as string[]
  const visibleChips = listNames.slice(0, CHIP_LIMIT)
  const moreCount = listNames.length - visibleChips.length
```

Replace with a version that keeps the list reference (needed for its category), not just the display string:

```ts
  const chipData = station.list_ids
    .map((id) => {
      const list = lists.find((l) => l.id === id)
      if (!list) return null
      const label = counts?.[id] !== undefined ? `${list.name} · ${counts[id]}` : list.name
      return { id, label, category: list.category }
    })
    .filter((c): c is { id: string; label: string; category?: "entry_access" | "food_drink" | "goods_kits" } => c !== null)
  const visibleChips = chipData.slice(0, CHIP_LIMIT)
  const moreCount = chipData.length - visibleChips.length
```

Find the rendering of `visibleChips` (around line 216-236):

```tsx
            {listNames.length === 0 ? (
              <span className="rounded-md border border-dashed border-warning/50 px-2 py-0.5 text-xs text-warning">
                Assign lists
              </span>
            ) : (
              <>
                {visibleChips.map((name) => (
                  <span
                    key={name}
                    className="rounded-md border bg-muted px-2 py-0.5 text-xs whitespace-nowrap text-foreground/80"
                  >
                    {name}
                  </span>
                ))}
                {moreCount > 0 && (
```

Replace with:

```tsx
            {chipData.length === 0 ? (
              <span className="rounded-md border border-dashed border-warning/50 px-2 py-0.5 text-xs text-warning">
                Assign lists
              </span>
            ) : (
              <>
                {visibleChips.map((chip) => (
                  <span
                    key={chip.id}
                    className={`rounded-md border px-2 py-0.5 text-xs whitespace-nowrap ${
                      chip.category ? CATEGORY_COLORS[chip.category].pill : "bg-muted text-foreground/80"
                    }`}
                  >
                    {chip.label}
                  </span>
                ))}
                {moreCount > 0 && (
```

- [ ] **Step 2: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Manually confirm on the kiosk-stations admin page: a station's list pills show blue/violet/cyan per list, matching that same list's colour on the Checkin Hub card and the kiosk tile.

- [ ] **Step 3: Commit**

```bash
git add src/components/kiosk-admin/station-controls.tsx
git commit -m "feat(kiosk): colour station admin list pills by category"
```

---

### Task 8: Apply migration + final review + live verify + deploy

- [ ] Review the combined diff across all seven tasks together (they share the one colour module and the one new column — a combined pass catches inconsistencies a per-task review would miss, e.g. a surface that ended up with a different shade than the others).
- [ ] Fix any findings.
- [ ] Get explicit user go-ahead, then apply the migration via Supabase MCP. Pre-flight: confirm the exact row count and category breakdown this plan's backfill logic will produce, matching what was queried during design (22 rows across 10 events, classified above). Post-apply: confirm `category` is `not null` with the check constraint, and that every existing row's backfilled value matches the pre-flight classification.
- [ ] Regenerate `src/lib/supabase/database.types.ts`.
- [ ] Live-verify on collegeofmas.org.in: confirm the same list shows the same colour across all four surfaces (Checkin Hub card, kiosk menu tile, kiosk scan-screen header, station admin list pill) for at least one list per category.
- [ ] Merge, push, confirm the Vercel production deploy succeeds.
