# Badges module redesign — Sub-project A: shared renderer + foundations

**Date:** 5 August 2026
**Context:** First sub-project out of the 11-screen "Badges module — redesign"
brief (Claude Design artifact, `Badges Module Redesign.dc.html`). That brief
is too large for one spec — it spans Overview/Templates/Generate/Designer
plus five safeguard screens and two pre-run-check screens, several needing
new schema fields. This spec covers only the piece everything else in the
brief depends on: a single shared badge-rendering component, plus the two
foundational primitives (font, color tokens) scoped tightly enough not to
creep back into the full redesign.

---

## 1. Why this is first

The full brief's own handoff notes call out the template-card-preview
problem as "the important one": today, badge templates have no real preview
at all outside the Designer — any card showing a template elsewhere would
either be a static thumbnail (goes stale the moment the design changes) or a
second, hand-maintained rendering implementation (drifts from the real
artwork over time, the same way two independent unit converters always
eventually disagree). The brief's fix is one renderer, driven by
`template_data`, consumed everywhere a template needs to be shown. Every
other screen in the full brief that shows a template (Templates cards,
Generate's live preview, the later Data Fit Audit) depends on this existing
first.

**Explicitly out of scope for this sub-project** (deferred to their own
later sub-projects): the Overview screen redesign (including deleting the
current Quick Actions list and four bottom cards — that's presentation work
specific to that page, not a shared dependency), the Templates/Generate
screen redesigns themselves, and anything under Tier 2/3 of the full brief
(confirm-generation modal, locked-template save gate, missing-data status,
cold start, per-attendee logo, proof sheet, data-fit audit). This sub-project
only builds the renderer and tokens those will later consume.

**Also explicitly out of scope:** `src/lib/badge-render.ts` (the server-side
HTML-string renderer used by the kiosk and Print Station device pages) and
`src/app/api/badges/generate/route.ts` (the pdf-lib PDF generator). The full
brief's own scope line states "design and generation only — no print-queue
or printer-station surfaces," and those two files feed exactly the surfaces
excluded. They are not touched by this work.

---

## 2. Component API & file layout

Following this codebase's existing convention (pure logic in `src/lib/`,
feature components in `src/components/[feature]/` — matching the precedent
already set by `src/lib/badge-element-bounds.ts` and
`src/lib/badge-pdf-font.ts`):

- **`src/lib/badge-template-types.ts`** — the `BadgeElement`, `BadgeTemplate`,
  and `BADGE_SIZES` types/constants. Currently defined inline and
  unexported inside `designer/page.tsx`; moved here so Templates, Generate,
  and Designer can all import the same shapes instead of redeclaring them.
- **`src/components/badges/badge-element-view.tsx`** —
  `<BadgeElementView element mode registration? event? scale? />`. A pure
  function of its props to visual output for **one** element (text, qr_code,
  image, shape, line, barcode, photo). No drag, no resize, no selection
  state — it renders the element's content at `scale` (default `1`),
  multiplied into font size / QR size / barcode size internally, exactly
  matching Designer's current `zoom`-multiplication mechanism (see Section
  2a below for why this is a prop rather than a CSS transform).
- **`src/components/badges/badge-canvas.tsx`** —
  `<BadgeCanvas template mode registration? event? scale? />`. Composes the
  background (color or image) and every element sorted by `zIndex`, each
  absolutely positioned per its own `x/y/width/height/zIndex/opacity/rotation`
  (positioning is generic across element types, so `BadgeCanvas` owns it —
  `BadgeElementView` only renders the type-specific content inside). Every
  position/size value is multiplied by `scale` the same way `BadgeElementView`
  multiplies its own internal measurements.

### 2a. Why `scale` is a prop, not a CSS transform

The full brief's handoff notes describe wrapping a fixed-size preview box in
`transform: scale(k)`. That's the right mechanism for a **new** consumer
(Template cards) with no existing zoom implementation to reconcile. It is
**not** how Designer's zoom works today: Designer multiplies every
measurement — element `x/y/width/height`, font size, QR/barcode size, `<Rnd>`
position/size, snap guides, rulers, grid spacing — by a `zoom` variable,
roughly 20+ call sites. Forcing Designer onto a CSS-transform model would
require reworking `react-rnd`'s drag/resize math (`react-rnd` has its own
`scale` prop specifically to correct mouse-delta math under an ancestor's
CSS transform — a different, incompatible mechanism from what Designer does
today), snap guides, and rulers — a real change to Designer's interaction
model, not the mechanical, zero-behavior-drift extraction this sub-project
is scoped as.

Decision (confirmed): `BadgeElementView`/`BadgeCanvas` take a `scale` prop,
multiplied internally into every measurement exactly like today's `zoom`
multiplication. Designer passes its existing `zoom` state straight through —
its drag/resize/snap/ruler code is untouched by this sub-project. Later
consumers (Template cards, Generate's live preview) compute their own
`k = boxWidth / template.width` and pass it as `scale` — same prop, same
component, same "one renderer" guarantee, without mandating any particular
CSS mechanism on the consumer side.

Designer keeps its own `<Rnd>` wrapping, drag/resize handlers, selection
outlines, and context menus — none of that moves. Because it needs
per-element interactivity, it renders one `<Rnd><BadgeElementView /></Rnd>`
per element directly (not `<BadgeCanvas>`, which has no per-element
interaction points). Template cards and Generate's live preview (built in
later sub-projects) render `<BadgeCanvas>` as a single non-interactive unit.

---

## 3. Rendering modes

The existing Designer has a single `previewMode` boolean. The shared
components replace it with `mode: "placeholder" | "sample" | "live"`,
matching three real, distinct situations rather than a single on/off toggle:

- **`placeholder`** — renders `{{name}}`-style tokens literally as text.
  Used by the Designer canvas in its normal (non-preview) authoring state —
  unchanged from today's behavior.
- **`sample`** — binds to generic fabricated values (e.g. "Dr Anjali
  Deshmukh") and renders any `qr_code` element as **one static, hardcoded
  placeholder SVG graphic** — never a live encode. This is the full brief's
  own explicit instruction for template card previews ("the QR renders as a
  static SVG stand-in, not a live encode"), and matters for two reasons:
  performance (the Templates screen can show several cards at once; a real
  QR encode per card for data nobody will scan is wasted work) and safety
  (a single fixed placeholder graphic cannot be mistaken for something
  actually scannable, unlike encoding trivial-but-real content per card).
- **`live`** — binds to a real registration and generates a real, scannable
  QR. Used by the Designer's own existing Preview mode (unchanged) and, in a
  later sub-project, Generate's live preview.

---

## 4. Migration approach for Designer (risk control)

This extracts logic out of 3,331 lines of production code that shipped two
real bug fixes last session (element bounds clamping, PDF font matching).
The priority is **zero behavior drift**, not a rewrite:

- Designer's existing `renderElement` already splits into an outer wrapper
  (handles `x/y/width/height/zIndex/opacity/rotation` — generic to every
  element type) and an inner `elementContent()` (the per-type visual
  content). That split already matches the `BadgeCanvas` /
  `BadgeElementView` boundary in Section 2 almost exactly, so this is a
  **mechanical extraction**: `elementContent()`'s logic moves into
  `BadgeElementView` close to verbatim; `BadgeCanvas` takes over the
  positioning wrapper; Designer keeps wrapping each element in `<Rnd>`.
- There is no pure, unit-testable logic being introduced here the way
  `clampElementToCanvas`/`resolvePdfFontFamily` were — this is visual JSX
  composition. Verification is: `tsc --noEmit` and `eslint` clean (as
  before), then a full manual pass in the running dev server — drag, resize,
  all 7 element types, Designer's Preview mode, and a sample of the 30
  pre-built starter templates — comparing behavior before and after. This
  follows the project's own standing rule that UI changes need real browser
  verification, not just type-checking.
- Nothing in `badges/generate/route.ts`, `badge-render.ts`, or any
  print/kiosk code path changes.

---

## 5. Design tokens (foundations, tightly scoped)

- **Playfair Display** currently loads only for the public `/register` flow
  (a Google Fonts `<link>` scoped inside `register/layout.tsx`, applied via
  a `.register-flow` class — not a global font, not a Tailwind alias). It
  gets the same treatment scoped to the **Badges module layout only**: a
  scoped `<link>` plus a new class (e.g. `.badges-serif`) applied to page and
  card titles within `/events/[eventId]/badges/**`. It is intentionally
  **not** made available app-wide — extending it to every admin module is a
  separate, much larger design-system decision explicitly deferred (per
  direct confirmation this session).
- **Green-discipline tokens** — the full brief's rule that saturated
  `--success` green appears for exactly the terminal-success states it
  names (not general "positive" or "in progress" states, which use tinted
  blue/neutral) becomes a couple of new semantic CSS custom
  properties/Tailwind tokens alongside the existing ones in
  `tailwind.config.ts`. No new dependency; no visual change to any other
  module.

---

## 6. Deliverable checklist for this sub-project

- [ ] `src/lib/badge-template-types.ts` created; Designer imports its types
      from here instead of declaring them inline.
- [ ] `src/components/badges/badge-element-view.tsx` and
      `src/components/badges/badge-canvas.tsx` created.
- [ ] Designer refactored to use `<BadgeElementView>` (wrapped in its
      existing `<Rnd>`) with no behavior change, verified manually in the
      dev server per Section 4.
- [ ] Playfair Display scoped-loaded for the Badges module; green-discipline
      tokens added to `tailwind.config.ts`. Neither applied to any screen's
      visual redesign yet — that happens in the sub-projects that consume
      them (Overview, Templates, Generate, Designer restyle).
- [ ] `badge-render.ts` and `badges/generate/route.ts` unchanged.
- [ ] `tsc --noEmit` and `eslint` clean; `vitest run` still green (no new
      unit tests expected here per Section 4 — this is a JSX extraction, not
      new pure logic).
