# Kiosk Stations Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/events/[eventId]/kiosk-stations` usable on a phone during a live event, by gating the fixed-pixel desktop table to desktop widths and tightening up the header/filter bar and onboarding banner for narrow screens.

**Architecture:** A single new `useMediaQuery` hook drives a `1024px` desktop/mobile split. Below that width the page forces its already-responsive card ("Grid") view and hides the List/Grid toggle; the header, filter bar, and onboarding banner get `lg:`-gated layout classes so they stack cleanly on a phone and sit exactly as they do today at `≥1024px`. No new components, no new API calls, no new tests infrastructure.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS 3, TypeScript, Vitest (node environment, `.test.ts` only — this repo has no React/DOM component-testing setup, so UI changes are verified manually via the dev server, matching every other hook/page in `src/hooks` and this file, none of which have `.test.tsx` coverage).

## Global Constraints

- Breakpoint is `1024px` (`(min-width: 1024px)`) everywhere in this plan — the List/Grid gate, the header stacking, and the filter bar stacking all use the same threshold, per the spec.
- Do not touch `/Users/prabhubalasubramaniam/amasi-faculty-management` (the primary checkout) — another terminal session is actively using it for unrelated work. All commands in this plan run against `/Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard` (the isolated worktree, branch `feat/kiosk-stations-responsive-dashboard`).
- Out of scope (per `docs/superpowers/specs/2026-08-02-kiosk-stations-responsive-layout-design.md`): Phase 2 features (bulk actions, health icons, ping/restart, live polling, tiered Quiet buckets, filter-by-type/behaviour, accessible dot shapes, New-link rotation-warning copy) and general box/border re-skinning (group section borders, card wrapper). Do not add either while working through this plan.
- This repo has no jsdom/RTL setup (`vitest.config.ts` → `environment: "node"`, `include: ["src/**/*.test.ts"]` only) and no existing hook or page has a `.test.tsx`. Don't introduce one for this plan — verify UI/hook behavior manually against `npm run dev`, same as every other hook here.

---

### Task 1: Commit the already-implemented Phase 1 bug fixes

These 4 fixes (name/Manage overlap, Behaviour column tooltip, Actions column width, stale-quiet red severity) were implemented and verified live in the browser earlier this session, in this same worktree's working tree. They're unrelated to the responsive-layout work below and should land as their own commit before it starts.

**Files:**
- Modify (already modified, uncommitted): `src/app/events/[eventId]/kiosk-stations/page.tsx`
- Modify (already modified, uncommitted): `src/components/kiosk-admin/station-controls.tsx`
- Modify (already modified, uncommitted): `src/lib/kiosk-station-status.ts`
- Modify (already modified, uncommitted): `src/lib/kiosk-station-status.test.ts`

**Interfaces:**
- Produces: `isStaleQuiet(station: { revoked_at: string | null; last_seen_at: string | null }, now?: Date): boolean`, exported from `src/lib/kiosk-station-status.ts` — used by Task 3 onward's reasoning about the file, though no later task calls it directly.

- [ ] **Step 1: Confirm the working tree only contains the expected 4 files**

Run: `cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && git status --short`
Expected output (exactly these 4 lines, nothing else):
```
 M src/app/events/[eventId]/kiosk-stations/page.tsx
 M src/components/kiosk-admin/station-controls.tsx
 M src/lib/kiosk-station-status.test.ts
 M src/lib/kiosk-station-status.ts
```

- [ ] **Step 2: Run the existing unit tests**

Run: `cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && npx vitest run src/lib/kiosk-station-status.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  14 passed (14)`

- [ ] **Step 3: Typecheck**

Run: `cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0

- [ ] **Step 4: Commit**

```bash
cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard
git add src/app/events/\[eventId\]/kiosk-stations/page.tsx src/components/kiosk-admin/station-controls.tsx src/lib/kiosk-station-status.ts src/lib/kiosk-station-status.test.ts
git commit -m "$(cat <<'EOF'
fix(kiosk): station name/Manage overlap, Behaviour tooltip, Actions width, stale-quiet severity

Four Phase 1 dashboard bugs: long station names pushed "Manage" into
the Check-in Lists column (missing w-full on the name button inside a
min-w-0 flex-1 wrapper); the Behaviour column truncated with no way to
recover the full text; the Actions column was clipped by an
unnecessarily wide (1100px) forced table minimum; and a station quiet
for 15 minutes looked identical to one quiet for 2+ days. Adds
isStaleQuiet() (>24h) as a visual-only modifier on the existing
"quiet" status, verified live against production data.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add the `useMediaQuery` hook

**Files:**
- Create: `src/hooks/use-media-query.ts`

**Interfaces:**
- Produces: `useMediaQuery(query: string, defaultValue?: boolean): boolean` — Task 3 imports and calls this as `useMediaQuery("(min-width: 1024px)")`.

- [ ] **Step 1: Write the hook**

```typescript
import { useEffect, useState } from "react"

// SSR-safe: renders as `defaultValue` (desktop, for this page's only
// consumer -- kiosk-stations would rather assume desktop and correct on
// mount than flash a forced-mobile layout to every user on first paint),
// then syncs to the real value via matchMedia once mounted, and stays live
// across viewport/zoom changes for the lifetime of the component.
export function useMediaQuery(query: string, defaultValue = true): boolean {
  const [matches, setMatches] = useState(defaultValue)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [query])

  return matches
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0

- [ ] **Step 3: Commit**

```bash
cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard
git add src/hooks/use-media-query.ts
git commit -m "$(cat <<'EOF'
feat(hooks): add useMediaQuery

SSR-safe matchMedia hook, live-updating on viewport/zoom changes. First
consumer is the Kiosk Stations dashboard's List/Grid breakpoint gate
(next commit).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Gate List view to desktop widths, retire the dead 3-column Grid tier

**Files:**
- Modify: `src/app/events/[eventId]/kiosk-stations/page.tsx:39` (import), `:92` (view state — unchanged, but read alongside new `isDesktop`), `:672-699` (view toggle), `:790` (the `view === "list" ?` branch), `:974` (Grid view's column classes)

**Interfaces:**
- Consumes: `useMediaQuery(query: string, defaultValue?: boolean): boolean` from Task 2.

- [ ] **Step 1: Import the hook**

In `src/app/events/[eventId]/kiosk-stations/page.tsx`, add to the top of the import block (after the `AddStationWizard` import, line 60):

```typescript
import { useMediaQuery } from "@/hooks/use-media-query"
```

- [ ] **Step 2: Derive `isDesktop` and the effective view**

Immediately after the existing `const [view, setView] = useState<"list" | "grid">("list")` (line 92), add:

```typescript
  // List is a fixed-pixel desktop table (~1018px minimum); below 1024px it
  // forces Grid instead, which is already responsive down to one column.
  // See docs/superpowers/specs/2026-08-02-kiosk-stations-responsive-layout-design.md.
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const effectiveView = isDesktop ? view : "grid"
```

- [ ] **Step 3: Use `effectiveView` for the actual render branch**

In the render section, change (around line 790):

```typescript
          ) : view === "list" ? (
```

to:

```typescript
          ) : effectiveView === "list" ? (
```

- [ ] **Step 4: Hide the List/Grid toggle below 1024px**

Around lines 672-699, the toggle's wrapping `<div className="flex gap-1 rounded-lg bg-muted p-1">...</div>` (the one containing the `List`/`LayoutGrid` icon buttons) currently renders unconditionally inside the `<div className="ml-auto flex items-center gap-3">` block. Wrap just that toggle `<div>` in the gate:

```typescript
              {isDesktop && (
                <div className="flex gap-1 rounded-lg bg-muted p-1">
                  <button
                    type="button"
                    title="List view"
                    onClick={() => setView("list")}
                    className={cn(
                      "flex h-7 w-8 items-center justify-center rounded-md transition-colors",
                      view === "list"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Grid view"
                    onClick={() => setView("grid")}
                    className={cn(
                      "flex h-7 w-8 items-center justify-center rounded-md transition-colors",
                      view === "grid"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
```

(Same button JSX as today — only the wrapping `{isDesktop && (...)}` is new.)

- [ ] **Step 5: Retire the unreachable 3-column Grid tier**

Line 974 currently reads:

```typescript
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

Since Grid is now only ever rendered below 1024px (List takes over at `lg:` and above), `lg:grid-cols-3` can never apply — change to:

```typescript
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
```

- [ ] **Step 6: Typecheck**

Run: `cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0

- [ ] **Step 7: Manual verification in the browser**

```bash
cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && npm run dev
```

Open the Kiosk Stations page for an event with stations. Using Chrome DevTools' device toolbar (or plain window resize):
- At a width ≥1024px: List/Grid toggle is visible, List is the default view, both remain switchable exactly as before.
- Resize/emulate below 1024px: the toggle disappears, the page shows the card (Grid) layout regardless of which view was last selected, one card per row below ~640px and two per row between ~640-1024px.
- Resize back above 1024px: the toggle reappears and List is available again.

Stop the dev server (`Ctrl+C`) once confirmed.

- [ ] **Step 8: Commit**

```bash
cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard
git add src/app/events/\[eventId\]/kiosk-stations/page.tsx
git commit -m "$(cat <<'EOF'
fix(kiosk): gate List view to desktop widths (>=1024px)

List is a fixed-pixel CSS Grid (~1018px minimum) that overflowed with
no visible scroll affordance below that width -- reproducible at 200%
browser zoom on a normal laptop, and a real scenario since organizers
check this page from their phone during live events. Below 1024px the
page now forces the already-responsive Grid (card) view and hides the
List/Grid toggle entirely, rather than trying to make the fixed table
itself reflow. Also drops Grid's now-unreachable lg:grid-cols-3 tier,
since List owns >=1024px.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Responsive header and filter bar below 1024px

**Files:**
- Modify: `src/app/events/[eventId]/kiosk-stations/page.tsx:583-598` (header block), `:640-701` (filter bar)

**Interfaces:**
- Consumes: nothing new (pure Tailwind class changes on existing JSX).

- [ ] **Step 1: Stack the header block below 1024px**

Lines 583-598 currently:

```typescript
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Kiosk Stations
          </h1>
          <p className="text-sm text-muted-foreground">
            A station is one physical tablet at one desk. Set it up once here, then open its link on the tablet — it
            stays signed in on its own and never needs a password again.
          </p>
        </div>
        <Button onClick={() => setAddWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Station
        </Button>
      </div>
```

Change to:

```typescript
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Kiosk Stations
          </h1>
          <p className="text-sm text-muted-foreground">
            A station is one physical tablet at one desk. Set it up once here, then open its link on the tablet — it
            stays signed in on its own and never needs a password again.
          </p>
        </div>
        <Button className="w-full lg:w-auto" onClick={() => setAddWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Station
        </Button>
      </div>
```

- [ ] **Step 2: Stack the filter bar below 1024px**

Lines 640-701 currently open with:

```typescript
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {STATUS_FILTERS.map((f) => (
```

Change the outer container and the status-tabs container:

```typescript
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
              {STATUS_FILTERS.map((f) => (
```

Each tab button inside that map already renders short, single-word-plus-count labels (`f.label` + `statusCounts[f.key]`) that don't wrap today — add `whitespace-nowrap` to the button's existing className so the horizontal-scroll container never wraps a label onto two lines instead of scrolling:

```typescript
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === f.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
```

The search input's wrapping div (line 659) currently:

```typescript
            <div className="relative w-full max-w-xs">
```

Change to:

```typescript
            <div className="relative w-full lg:max-w-xs">
```

The trailing "count + view toggle" wrapper (line 668) currently:

```typescript
            <div className="ml-auto flex items-center gap-3">
```

Change to:

```typescript
            <div className="flex items-center gap-3 lg:ml-auto">
```

(`ml-auto` only makes sense once the container is a row, i.e. at `lg:` and above — as a column below that, an unconditional `ml-auto` does nothing harmful but is misleading to read; scoping it to `lg:` is more honest about when it's doing something.)

- [ ] **Step 3: Typecheck**

Run: `cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0

- [ ] **Step 4: Manual verification in the browser**

```bash
cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && npm run dev
```

At <1024px (Chrome device toolbar or resize): title/description sit above a full-width "Add Station" button; status tabs sit in their own horizontally-scrollable row (try a narrow enough phone width, e.g. 375px, to confirm the row scrolls instead of wrapping); search box is full-width on its own row below the tabs; the "N of M stations" count sits on its own line (no toggle, per Task 3).
At ≥1024px: identical to before this task — header inline with the button on the right, tabs/search/count all on one row, toggle visible on the far right.

Stop the dev server (`Ctrl+C`) once confirmed.

- [ ] **Step 5: Commit**

```bash
cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard
git add src/app/events/\[eventId\]/kiosk-stations/page.tsx
git commit -m "$(cat <<'EOF'
fix(kiosk): stack header and filter bar below 1024px

Title/description + Add Station button, and the status-tabs/search/
view-toggle row, only relied on flex-wrap -- cramped rather than
intentional on a phone. Below 1024px: Add Station becomes a full-width
button under the description, status tabs become a horizontally-
scrollable single row instead of wrapping, and search becomes
full-width on its own row. Unchanged at >=1024px.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Collapse the onboarding banner by default

**Files:**
- Modify: `src/app/events/[eventId]/kiosk-stations/page.tsx:27-37` (icon imports), `:161-171` (state, alongside existing first-run dismissal), `:616-638` (banner JSX)

**Interfaces:**
- Consumes: nothing new.
- Produces: `firstRunExpanded: boolean` and `toggleFirstRunExpanded: () => void`, local to this component — no other task reads these.

- [ ] **Step 1: Import `ChevronRight`**

The existing lucide-react import block (lines 27-37) already includes `ChevronDown` but not `ChevronRight`. Add it:

```typescript
import {
  Plus,
  Copy,
  Monitor,
  Search,
  Clock,
  List,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react"
```

- [ ] **Step 2: Add the expand/collapse state**

Immediately after the existing `dismissFirstRun` function (ends at line 171), add:

```typescript
  // Collapsed by default (independent of the dismiss-forever state above) --
  // reduces vertical space at every width, not just mobile, once an admin
  // has already seen the checklist once. Same per-event localStorage
  // convention as firstRunStorageKey above, but its own key: dismissal and
  // expand/collapse are independent axes (a not-yet-dismissed banner still
  // starts collapsed; expanding it doesn't dismiss it).
  const firstRunExpandedKey = `kiosk-stations-firstrun-expanded:${eventId}`
  const [firstRunExpanded, setFirstRunExpanded] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    setFirstRunExpanded(window.localStorage.getItem(firstRunExpandedKey) === "true")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])
  const toggleFirstRunExpanded = () => {
    const next = !firstRunExpanded
    if (typeof window !== "undefined") window.localStorage.setItem(firstRunExpandedKey, String(next))
    setFirstRunExpanded(next)
  }
```

- [ ] **Step 3: Update the banner JSX**

Lines 616-638 currently:

```typescript
          {showFirstRunBanner && (
            <div className="relative rounded-2xl border border-info/30 bg-info/5 p-4 text-sm">
              <button
                type="button"
                onClick={dismissFirstRun}
                title="Dismiss"
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="pr-6 font-semibold">Setting up for an event?</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
                <li>Add one station per tablet, named after its desk</li>
                <li>Tick the lists that desk handles</li>
                <li>Turn on &quot;Attended&quot; if a volunteer holds it</li>
                <li>Open the station&apos;s link on the tablet, and add it to the home screen</li>
                <li>Print one test badge before the tablet leaves</li>
              </ol>
              <p className="mt-2 text-muted-foreground">
                After that the volunteer just taps the icon — no login, no link.
              </p>
            </div>
          )}
```

Change to:

```typescript
          {showFirstRunBanner && (
            <div className="relative rounded-2xl border border-info/30 bg-info/5 p-4 text-sm">
              <button
                type="button"
                onClick={dismissFirstRun}
                title="Dismiss"
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleFirstRunExpanded}
                className="flex items-center gap-1.5 pr-6 font-semibold text-left"
              >
                <ChevronRight
                  className={cn("h-3.5 w-3.5 shrink-0 transition-transform", firstRunExpanded && "rotate-90")}
                />
                Setting up for an event?
              </button>
              {firstRunExpanded && (
                <>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
                    <li>Add one station per tablet, named after its desk</li>
                    <li>Tick the lists that desk handles</li>
                    <li>Turn on &quot;Attended&quot; if a volunteer holds it</li>
                    <li>Open the station&apos;s link on the tablet, and add it to the home screen</li>
                    <li>Print one test badge before the tablet leaves</li>
                  </ol>
                  <p className="mt-2 text-muted-foreground">
                    After that the volunteer just taps the icon — no login, no link.
                  </p>
                </>
              )}
            </div>
          )}
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0

- [ ] **Step 5: Manual verification in the browser**

```bash
cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && npm run dev
```

On an event where the banner shows (has stations, none Active yet, not previously dismissed): confirm it renders collapsed (`› Setting up for an event?`, one line) by default. Click the line — confirm it expands to the full 5-step checklist, chevron rotates to point down. Reload the page — confirm it stays expanded (persisted). Click again to collapse — reload — confirm it stays collapsed. Click the `X` — confirm the whole banner disappears (existing dismiss-forever behavior, unchanged) and reload confirms it stays gone.

Stop the dev server (`Ctrl+C`) once confirmed.

- [ ] **Step 6: Commit**

```bash
cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard
git add src/app/events/\[eventId\]/kiosk-stations/page.tsx
git commit -m "$(cat <<'EOF'
fix(kiosk): collapse the onboarding banner by default

The 5-step "Setting up for an event?" checklist always rendered fully
expanded, pushing real station data below the fold -- costly on a
phone, unnecessary noise on desktop for anyone who's seen it before.
Now collapses to one line by default (independent per-event
localStorage flag, separate from the existing dismiss-forever state),
expandable on tap, persisted across reloads.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && npx vitest run`
Expected: all test files pass, no failures.

- [ ] **Step 2: Full typecheck**

Run: `cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0

- [ ] **Step 3: Lint the touched files**

Run: `cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && npx eslint src/app/events/\[eventId\]/kiosk-stations/page.tsx src/components/kiosk-admin/station-controls.tsx src/lib/kiosk-station-status.ts src/hooks/use-media-query.ts`
Expected: no errors (pre-existing unrelated warnings, if any, are fine — do not fix warnings outside this plan's scope).

- [ ] **Step 4: End-to-end manual pass**

```bash
cd /Users/prabhubalasubramaniam/amasi-fm-kiosk-dashboard && npm run dev
```

Walk through the full page once more at three widths (phone ~375px, tablet ~768px, desktop ~1280px) confirming: banner collapsed by default and expandable; header/filter bar arrangement matches Task 4's description at each width; List/Grid gating matches Task 3's description; and — since Task 1's fixes live in the same file — the station name/Manage text never overlaps, the Behaviour column tooltip still works, and a station stale >24h still shows the red "· stale" marker, at every width tested.

Stop the dev server (`Ctrl+C`) when done. This task produces no commit — it's a final confirmation gate before the branch is considered done.
