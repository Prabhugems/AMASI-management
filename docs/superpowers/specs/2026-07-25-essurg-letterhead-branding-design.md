# ESSURG 2026 Real Letterhead Branding

## Problem

Every PDF ESSURG 2026 generates today — the generic invitation
(`invitation-pdf/route.ts`), the new faculty letters
(`faculty-letter-pdf/route.ts`), and the three receipt routes
(`registrations/[id]/receipt`, `registrations/[id]/final-receipt`,
`orders/[id]/receipt`) — draws its own header programmatically (a plain blue
gradient band in the two jsPDF routes, a green-themed band with the event
logo in the pdf-lib receipt routes). None of them use ESSURG's actual
branded letterhead: the Vitruvian Man / ESS logo, navy-and-gold "ESSURG
2026" title, tagline, date/venue/contact row, and a footer bar with
collaborator logos ("In collaboration with" — Varchasva FZ LLC, Chiktsa
Foundation), Local Organising Secretariat contact details, and a QR code —
all supplied in `~/Downloads/ESSURG 2026 Letterhead.pdf` and confirmed
against a real generated invitation as visibly wrong.

## Goal

Every PDF generated for the ESSURG 2026 event carries the real letterhead
header and footer, sized to fit without materially degrading how much of
the page is left for actual letter/receipt content.

## Non-goals

- No Taj Mahal watermark behind body content — real body text (paragraphs,
  detail boxes, itemized charges) at varying lengths risks colliding with a
  fixed-position background image; the header/footer bands alone already
  carry the branding.
- No per-event-configurable letterhead (no new settings UI, no Supabase
  storage upload flow for these two images). This is a one-off, ESSURG-2026-
  specific static asset, following the exact precedent already established
  in this codebase for AMASI's own letterhead (see Design below) — not a
  general "any event can have a custom letterhead" feature.
- No change to any other event's PDF output, on this deployment or any
  other white-label deployment sharing this codebase (see the tenant-gating
  requirement below — this is load-bearing, not incidental).
- No re-litigating the sizing trade-off already settled during brainstorming
  (inset, narrower-than-full-page-width, aspect-preserved images) — see
  Design.

## Design

### Assets

Two PNGs cropped from the reference letterhead PDF (rendered at 3× zoom,
~216 DPI, from the PDF's 595×842pt/A4 page — see exact crop coordinates
below), committed into the repo at:

- `public/essurg/letterhead-header.png`
- `public/essurg/letterhead-footer.png`

Source crop coordinates (pixels, from the 1785×2526px full-page render):
header = `(0, 0, 1785, 650)`; footer = `(0, 2075, 1785, 2526)`. Both were
generated and visually verified during brainstorming; the same PyMuPDF +
Pillow crop is reproducible from the reference PDF if the assets need
regenerating.

This mirrors an existing, working pattern already in this codebase:
`src/app/api/events/[eventId]/aes-faculty-pdf/route.ts` bundles AMASI's own
letterhead the same way — a static PNG under `public/amasi/`, loaded via
`fs.readFileSync(...).toString("base64")` with a module-level in-memory
cache (`LETTERHEAD_CACHE`). This design reuses that exact approach rather
than inventing a new asset-loading mechanism or a database-backed upload
flow.

### Shared helper: `src/lib/pdf/essurg-letterhead.ts`

New module, consumed by all five routes below. Exports:

- `ESSURG_EVENT_ID = "e4af037d-6055-463c-9d57-31db69ecd414"` — the one and
  only event in ESSURG's isolated Supabase project (confirmed empirically:
  `select id, name from events` on that project returns exactly one row).
- `shouldUseEssurgLetterhead(eventId: string): boolean` — a pure function
  (`eventId === ESSURG_EVENT_ID`), unit tested directly. This is the load-
  bearing tenant-gating check: the codebase this route ships in is shared
  across multiple white-label deployments (AMASI/College at
  `collegeofmas.org.in`, ESSURG at `app.essurg2026.org`, others). Every one
  of the five routes below must call this before using the real letterhead
  and fall back to its current, unchanged generic header for every other
  event — otherwise a future deploy of this shared codebase would leak
  ESSURG's logo onto AMASI's real invitations. (This exact class of bug has
  already happened once in this codebase's history for a different reason —
  see the `gst_inclusive_rate` incident in CLAUDE.md's migration log — so
  the check is deliberate, not defensive boilerplate.)
- Cached raw-bytes loaders for the two PNGs (module-level cache, same
  pattern as `aes-faculty-pdf/route.ts`'s `LETTERHEAD_CACHE`).
- Two small positioning helpers, one per PDF library in use across the five
  routes (jsPDF for `invitation-pdf`/`faculty-letter-pdf`; pdf-lib for the
  three receipt routes) — each embeds the header/footer image at the sizes
  below and returns the Y coordinate where the caller's existing body
  content should now start, so each route's own layout logic downstream of
  the header is otherwise untouched, just shifted to clear the new header
  height. Two helpers (not one) because jsPDF and pdf-lib have incompatible
  image-embedding APIs and coordinate systems (jsPDF: top-down Y,
  `doc.addImage`; pdf-lib: bottom-up Y, `pdfDoc.embedPng` +
  `page.drawImage`) — sharing the byte-loading/caching logic across both is
  the DRY part; the drawing calls themselves cannot be unified without
  fighting both libraries' APIs.

### Sizing

Both images render narrower than the full page width, inset from the same
20mm left margin the letter body already uses — not edge-to-edge like the
original flyer design. This was a deliberate trade-off made during
brainstorming: the source images' real proportions don't allow a compact
height (target ~40mm header / ~25mm footer) at full 210mm page width
without either squishing the logo/text or cropping out real content (the
date/venue row, the QR code). Rendering narrower preserves the source
aspect ratio exactly — no distortion, nothing cropped — at the cost of not
spanning the page edge-to-edge.

Exact target sizes (aspect-ratio-preserving from the source crop
dimensions):

| | Height | Width | Source aspect ratio |
|---|---|---|---|
| Header | 40mm | 109.8mm (≈110mm) | 1785:650 = 2.746:1 |
| Footer | 25mm | 98.9mm (≈99mm) | 1785:451 = 3.958:1 |

Both positioned at the page's left margin (20mm from the left edge,
matching the existing `margin` constant already used in
`invitation-pdf/route.ts` and `faculty-letter-pdf/route.ts`); header at the
top of the page, footer at the bottom margin.

### Per-route integration

**`invitation-pdf/route.ts` and `faculty-letter-pdf/route.ts`** (jsPDF):
when `shouldUseEssurgLetterhead(event.id)` is true, skip the existing
programmatic header-drawing block (the gradient-fill rectangles + measured
title/tagline/edition text) entirely, draw the header image via the shared
jsPDF helper, and start body content at the Y position it returns. Same
substitution for the footer: replace the current one-line
"computer-generated" disclaimer text with the footer image. For every other
event, both routes' existing code paths run completely unchanged — this is
an additive branch, not a rewrite of the existing behavior.

**The three receipt routes** (pdf-lib): same conditional, using the pdf-lib
helper instead. Each route currently draws its own ad hoc header (event
logo + green-themed text) before laying out itemized charges/tax
breakdown; when the gate is true, that header-drawing code is skipped in
favor of the embedded image, and the existing itemization logic starts
lower on the page at the Y the helper returns. For every other event, all
three routes' current behavior is unchanged.

### Error handling

If the bundled PNGs ever fail to load (not expected — they're committed
files read from disk, not fetched over the network), the shared helper
catches the read failure and returns `null`; every call site treats a
`null` return the same as `shouldUseEssurgLetterhead` being false and falls
back to that route's existing generic header, rather than failing PDF
generation outright.

### Testing

`shouldUseEssurgLetterhead` is genuine pure logic and gets a real unit test
(same precedent as the Task 1 template registry in the faculty-letter-pdf
work: true for the known ESSURG event ID, false for any other string,
false for empty/undefined). Everything downstream of the gate — actual PDF
rendering — follows this codebase's existing, already-accepted precedent of
manual-only verification for PDF-generation routes (no other PDF route in
this codebase has automated rendering tests). Verification is: regenerate
one document of each of the five affected types for the real ESSURG event
and visually compare against the reference letterhead PDF.
