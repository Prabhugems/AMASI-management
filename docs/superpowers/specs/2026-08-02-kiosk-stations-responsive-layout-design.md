# Kiosk Stations dashboard — responsive layout

## Problem

`/events/[eventId]/kiosk-stations`'s "List" view is a CSS Grid with fixed pixel column widths (`28px 150px 200px 260px 190px 190px`, ~1018px hard minimum), wrapped in a nested `overflow-x-auto` box with no visible scroll affordance. Below that minimum — a phone, a narrower laptop, or the desktop browser at high zoom (confirmed live: 200% zoom on a normal laptop window reproduces it) — the Actions column and its kebab menu render past the visible edge with no indication there's more to scroll to. This isn't a one-off clipping bug; the table simply isn't a responsive layout, and organizers realistically check this page from their phone while walking the venue during an event, not just at a desk beforehand.

Two smaller issues bundled into this pass because they compete for the same limited vertical space on a phone:
- The "Setting up for an event?" onboarding callout (5 numbered steps, bordered box) is always fully expanded, pushing real station data below the fold.
- The header (title + "Add Station") and filter bar (status tabs + search + view toggle) only `flex-wrap`, which looks cramped rather than intentional on a narrow screen.

## Design

### 1. View-mode gating

`view` (`"list" | "grid"`) gets a hard floor: below `1024px` viewport width, the page forces `"grid"` regardless of the stored/last-picked preference, and the List/Grid toggle buttons (`page.tsx` ~line 672-699) are not rendered at all. At `≥1024px`, both remain available exactly as today, defaulting to whichever the user last picked.

Implementation: a `useMediaQuery`-style hook (or a simple `window.matchMedia("(min-width: 1024px)")` + resize-aware state, SSR-safe default to desktop-available) gates both the toggle's visibility and the effective view value used for rendering. This fully retires the fixed-pixel table as a small-screen concern — no reflow logic is added to List itself, since it's simply unreachable below the breakpoint it was built for.

### 2. Grid view on phone/tablet

No structural change. `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` already existed; since List now owns `≥1024px` and Grid is forced below it, Grid's live range in practice becomes 1 column (phone) or 2 columns (tablet, `sm:` = 640px+) — the `lg:grid-cols-3` tier becomes dead code (unreachable, since 1024px+ shows List instead) and should be removed rather than left as misleading unused styling.

Existing card content order (status dot + label + last-seen, then name, then check-in lists, then behaviour, then actions) already matches "status first" priority for a phone glance — unchanged.

### 3. Header & filter bar (below 1024px)

- Header block (`page.tsx` ~line 583-598): title/description stack normally (already does); "Add Station" becomes a full-width button on its own row beneath the description instead of sitting inline to the right.
- Filter bar (`page.tsx` ~line 640-667): status tabs (`All`/`Active`/`Quiet`/`Revoked`) become a horizontally-scrollable single-line pill row (`overflow-x-auto`, `flex-nowrap` instead of the container's current `flex-wrap`, no visible scrollbar needed since pills are short and the affordance is obvious by their being cut off at the edge). Search input becomes full-width on its own row below the tabs, instead of `max-w-xs` inline.
- View toggle: omitted below the breakpoint per #1, so the filter bar has one fewer element to place at all.

At `≥1024px` this entire section is visually unchanged from today.

### 4. Onboarding banner collapse

The existing `showFirstRunBanner` gating (`localStorage`-backed dismissal keyed per event, auto-hides once any station goes active, unchanged) still decides *whether* the banner can show at all. New: an independent `localStorage`-backed `expanded` flag (separate key, same per-event convention), **default `false`**, applied at every breakpoint, not just mobile.

- Collapsed (default): one line, `› Setting up for an event?`, tappable/clickable to expand.
- Expanded: today's full content (5-step list + the existing X dismiss), plus a way to re-collapse (clicking the same header line, or a `‹`).

This is a genuine UX default change at desktop width too, not a mobile-only special case — reduces vertical noise for anyone who's seen the checklist before, while staying one tap from full detail.

## Out of scope

- The Phase 2 feature list gathered earlier in this project (bulk delete/archive, test-vs-production station filter, inline ping/restart on Quiet rows, live polling, tiered Quiet buckets beyond the existing stale/not-stale split, health icons, fuller filter bar by type/behaviour, accessible status-dot shapes, New-link rotation-warning clarity) — separate spec, built on top of this responsive foundation, not bundled in.
- General visual re-skinning of box/border treatment (the bordered card wrapping the whole table, left-accent-bar per status group) — explicitly left alone per user direction; only the onboarding banner's excessive default height is addressed, because it directly costs phone screen real estate, not for aesthetic reasons.
- Phase 1's 4 critical bug fixes (name/Manage overlap, Behaviour truncation tooltip, Actions column width, stale-quiet severity color) — already implemented and verified live in this session; not part of this spec.
