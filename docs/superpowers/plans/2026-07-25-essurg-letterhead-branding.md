# ESSURG 2026 Real Letterhead Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every PDF generated for the ESSURG 2026 event (invitation, the 6 faculty letters, and 3 receipt types) carries the real branded letterhead header/footer instead of a generic programmatic header, with zero change to any other event's PDF output on this or any other white-label deployment sharing this codebase.

**Architecture:** A new shared helper (`src/lib/pdf/essurg-letterhead.ts`) exports a pure tenant-gating check plus cached image loaders and two small drawing helpers — one for jsPDF call sites, one for pdf-lib call sites (the two libraries have incompatible image APIs and coordinate systems, so the drawing logic can't be unified, only the byte-loading/caching). Each of the 5 target routes gets one new conditional branch around its existing header-drawing code and one around its existing footer-drawing code: real letterhead when the event matches ESSURG 2026's ID, completely unchanged existing behavior otherwise.

**Tech Stack:** Next.js 16 App Router, TypeScript, jsPDF (`invitation-pdf`, `faculty-letter-pdf`), pdf-lib (`registrations/[id]/receipt`, `registrations/[id]/final-receipt`, `orders/[id]/receipt`), vitest (existing, for the new pure-logic gate function).

## Global Constraints

- No Taj Mahal watermark, no per-event-configurable letterhead/upload UI — see spec's Non-goals.
- No change to any other event's PDF output, on this or any other white-label deployment. The `event.id === ESSURG_EVENT_ID` gate is load-bearing — every one of the 5 call sites must use it, and the non-ESSURG branch of every route must be the existing code completely unchanged, not merely "close to" the original.
- Header renders at 40mm tall × 109.8mm wide, footer at 25mm tall × 98.9mm wide, aspect-ratio-preserved from the source crops — do not stretch/distort. Both left-aligned at each route's own existing left margin (not forced to a uniform value across routes — the two jsPDF routes already use `margin = 20` (mm); the three pdf-lib routes already use `x: 50` (pt) — keep each route's own value).
- On any image-load failure, fall back to that route's existing generic header/footer — PDF generation must never fail because of this feature.
- No automated rendering tests for the PDF output itself (matches this codebase's existing accepted precedent for every other PDF route) — only the pure gate function `shouldUseEssurgLetterhead` gets a real unit test.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/pdf/essurg-letterhead.ts` (new) | Tenant gate (`shouldUseEssurgLetterhead`), cached PNG byte loaders, jsPDF drawing helper, pdf-lib drawing helper. |
| `src/lib/pdf/essurg-letterhead.test.ts` (new) | Unit tests for the pure gate function. |
| `src/app/api/events/[eventId]/invitation-pdf/route.ts` (modify) | Wrap existing header/footer blocks in the ESSURG conditional. |
| `src/app/api/events/[eventId]/faculty-letter-pdf/route.ts` (modify) | Same, plus thread a new `useEssurgLetterhead` boolean into `renderLetterPdf` (its `event` param is `LetterEventInfo`, which has no `id` field — computed once in the route handler instead of touching Task 1's type). |
| `src/app/api/registrations/[id]/receipt/route.ts` (modify) | Same pattern, pdf-lib; add `id` to the `events(...)` select (currently missing). |
| `src/app/api/registrations/[id]/final-receipt/route.ts` (modify) | Same; add `id` to the `events(...)` select (currently missing). |
| `src/app/api/orders/[id]/receipt/route.ts` (modify) | Same; add `id` to the `events(...)` select (currently missing). |

`public/essurg/letterhead-header.png` and `public/essurg/letterhead-footer.png` already exist (committed in the spec commit `b2e38b0`) — no task creates them.

---

## Task 1: Shared letterhead helper (pure logic, TDD)

**Files:**
- Create: `src/lib/pdf/essurg-letterhead.ts`
- Test: `src/lib/pdf/essurg-letterhead.test.ts`

**Interfaces:**
- Produces (used by Tasks 2–6): `ESSURG_EVENT_ID: string`, `shouldUseEssurgLetterhead(eventId: string | null | undefined): boolean`, `drawEssurgHeaderJsPdf(doc: jsPDF, marginMm: number): number | null` (returns the Y in mm where body content should start, or `null` on load failure), `drawEssurgFooterJsPdf(doc: jsPDF, pageHeightMm: number, marginMm: number): boolean` (`true` if drawn), `drawEssurgHeaderPdfLib(pdfDoc: PDFDocument, page: PDFPage, marginPt: number): Promise<number | null>` (returns the Y in pt where body content should start, or `null`), `drawEssurgFooterPdfLib(pdfDoc: PDFDocument, page: PDFPage, marginPt: number): Promise<boolean>`.
- Consumes: nothing from the rest of the app (reads only its own bundled PNG files).

- [ ] **Step 1: Write the failing test**

Create `src/lib/pdf/essurg-letterhead.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { shouldUseEssurgLetterhead, ESSURG_EVENT_ID } from "./essurg-letterhead"

describe("shouldUseEssurgLetterhead", () => {
  it("returns true for the ESSURG 2026 event id", () => {
    expect(shouldUseEssurgLetterhead(ESSURG_EVENT_ID)).toBe(true)
  })

  it("returns false for any other event id", () => {
    expect(shouldUseEssurgLetterhead("11111111-2222-3333-4444-555555555555")).toBe(false)
  })

  it("returns false for null or undefined", () => {
    expect(shouldUseEssurgLetterhead(null)).toBe(false)
    expect(shouldUseEssurgLetterhead(undefined)).toBe(false)
  })

  it("returns false for an empty string", () => {
    expect(shouldUseEssurgLetterhead("")).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pdf/essurg-letterhead.test.ts`
Expected: FAIL with `Cannot find module './essurg-letterhead'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/pdf/essurg-letterhead.ts`:

```ts
import fs from "node:fs"
import path from "node:path"
import type { jsPDF } from "jspdf"
import type { PDFDocument, PDFPage } from "pdf-lib"

// The one event this bundled artwork is for. This codebase is shared across
// multiple white-label deployments (AMASI/College at collegeofmas.org.in,
// ESSURG at app.essurg2026.org, others) — every call site MUST gate on this
// before using the real letterhead, or a future deploy of this shared code
// leaks ESSURG's logo onto another tenant's real documents.
export const ESSURG_EVENT_ID = "e4af037d-6055-463c-9d57-31db69ecd414"

export function shouldUseEssurgLetterhead(eventId: string | null | undefined): boolean {
  return eventId === ESSURG_EVENT_ID
}

const HEADER_PATH = path.join(process.cwd(), "public/essurg/letterhead-header.png")
const FOOTER_PATH = path.join(process.cwd(), "public/essurg/letterhead-footer.png")

let headerCache: Buffer | null = null
let footerCache: Buffer | null = null

function loadHeaderBytes(): Buffer | null {
  if (headerCache) return headerCache
  try {
    headerCache = fs.readFileSync(HEADER_PATH)
    return headerCache
  } catch {
    return null
  }
}

function loadFooterBytes(): Buffer | null {
  if (footerCache) return footerCache
  try {
    footerCache = fs.readFileSync(FOOTER_PATH)
    return footerCache
  } catch {
    return null
  }
}

// Aspect-ratio-preserving target sizes (mm), derived from the source crops
// (header 1785x650px, footer 1785x451px) — see
// docs/superpowers/specs/2026-07-25-essurg-letterhead-branding-design.md
export const ESSURG_HEADER_WIDTH_MM = 109.8
export const ESSURG_HEADER_HEIGHT_MM = 40
export const ESSURG_FOOTER_WIDTH_MM = 98.9
export const ESSURG_FOOTER_HEIGHT_MM = 25

const MM_TO_PT = 2.83465

const ESSURG_HEADER_WIDTH_PT = ESSURG_HEADER_WIDTH_MM * MM_TO_PT
const ESSURG_HEADER_HEIGHT_PT = ESSURG_HEADER_HEIGHT_MM * MM_TO_PT
const ESSURG_FOOTER_WIDTH_PT = ESSURG_FOOTER_WIDTH_MM * MM_TO_PT
const ESSURG_FOOTER_HEIGHT_PT = ESSURG_FOOTER_HEIGHT_MM * MM_TO_PT

/**
 * Draw the ESSURG header into a jsPDF document (top-down Y, mm).
 * Returns the Y where body content should start, or null if the image
 * couldn't be loaded — callers must fall back to their generic header.
 */
export function drawEssurgHeaderJsPdf(doc: jsPDF, marginMm: number): number | null {
  const bytes = loadHeaderBytes()
  if (!bytes) return null
  const base64 = bytes.toString("base64")
  doc.addImage(`data:image/png;base64,${base64}`, "PNG", marginMm, 10, ESSURG_HEADER_WIDTH_MM, ESSURG_HEADER_HEIGHT_MM)
  return 10 + ESSURG_HEADER_HEIGHT_MM + 8
}

/** Draw the ESSURG footer into a jsPDF document. Returns true if drawn. */
export function drawEssurgFooterJsPdf(doc: jsPDF, pageHeightMm: number, marginMm: number): boolean {
  const bytes = loadFooterBytes()
  if (!bytes) return false
  const base64 = bytes.toString("base64")
  const y = pageHeightMm - ESSURG_FOOTER_HEIGHT_MM - 10
  doc.addImage(`data:image/png;base64,${base64}`, "PNG", marginMm, y, ESSURG_FOOTER_WIDTH_MM, ESSURG_FOOTER_HEIGHT_MM)
  return true
}

/**
 * Draw the ESSURG header into a pdf-lib page (bottom-up Y, points).
 * Returns the Y where body content should start, or null on failure.
 */
export async function drawEssurgHeaderPdfLib(
  pdfDoc: PDFDocument,
  page: PDFPage,
  marginPt: number
): Promise<number | null> {
  const bytes = loadHeaderBytes()
  if (!bytes) return null
  const image = await pdfDoc.embedPng(bytes)
  const { height: pageHeight } = page.getSize()
  const topPaddingPt = 30
  const y = pageHeight - topPaddingPt - ESSURG_HEADER_HEIGHT_PT
  page.drawImage(image, { x: marginPt, y, width: ESSURG_HEADER_WIDTH_PT, height: ESSURG_HEADER_HEIGHT_PT })
  return y - 20
}

/** Draw the ESSURG footer into a pdf-lib page. Returns true if drawn. */
export async function drawEssurgFooterPdfLib(
  pdfDoc: PDFDocument,
  page: PDFPage,
  marginPt: number
): Promise<boolean> {
  const bytes = loadFooterBytes()
  if (!bytes) return false
  const image = await pdfDoc.embedPng(bytes)
  page.drawImage(image, { x: marginPt, y: 30, width: ESSURG_FOOTER_WIDTH_PT, height: ESSURG_FOOTER_HEIGHT_PT })
  return true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pdf/essurg-letterhead.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test`
Expected: PASS (all existing tests plus the 4 new ones).

Run: `npx tsc --noEmit -p . 2>&1 | grep -i "essurg-letterhead"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pdf/essurg-letterhead.ts src/lib/pdf/essurg-letterhead.test.ts
git commit -m "feat(letterhead): add ESSURG letterhead helper with tenant gate"
```

---

## Task 2: `invitation-pdf/route.ts` integration

**Files:**
- Modify: `src/app/api/events/[eventId]/invitation-pdf/route.ts`

**Interfaces:**
- Consumes: `shouldUseEssurgLetterhead`, `drawEssurgHeaderJsPdf`, `drawEssurgFooterJsPdf` from Task 1's `src/lib/pdf/essurg-letterhead.ts`.

- [ ] **Step 1: Add the import**

Add near the top of the file, after the existing `rate-limit` import:

```ts
import { shouldUseEssurgLetterhead, drawEssurgHeaderJsPdf, drawEssurgFooterJsPdf } from "@/lib/pdf/essurg-letterhead"
```

- [ ] **Step 2: Wrap the header block**

The file already selects `event.id` (confirm: the `.select(...)` call includes `"id, name, short_name, tagline, ..."` — it does, no select change needed here).

Replace the `// === HEADER BAND ===` section (from the comment through `y = headerHeight + 8`) with:

```ts
    // === HEADER BAND ===
    const essurgHeaderY = shouldUseEssurgLetterhead(event.id) ? drawEssurgHeaderJsPdf(doc, margin) : null

    if (essurgHeaderY !== null) {
      y = essurgHeaderY
    } else {
      // Measure everything first so the band can grow to fit (and the edition
      // badge sits below the tagline instead of at a fixed offset that used to
      // collide with it whenever the title wrapped to two lines).
      doc.setFontSize(16)
      doc.setFont("helvetica", "bold")
      const eventTitle = event.name || "Event"
      const titleLines = doc.splitTextToSize(eventTitle, contentWidth - 10)
      const titleStartY = titleLines.length > 1 ? 12 : 15
      const afterTitleY = titleStartY + titleLines.length * 7.5

      let taglineLines: string[] = []
      let taglineY = afterTitleY
      if (event.tagline) {
        doc.setFontSize(10)
        doc.setFont("helvetica", "italic")
        taglineLines = doc.splitTextToSize(event.tagline, contentWidth - 10)
        taglineY = afterTitleY + 2
      }
      const afterTaglineY = taglineLines.length > 0 ? taglineY + (taglineLines.length - 1) * 4.5 : afterTitleY

      const editionY = afterTaglineY + 6
      const headerHeight = Math.max(35, editionY + 4)

      // Gradient effect with two rectangles
      doc.setFillColor(...primaryDark)
      doc.rect(0, 0, pageWidth, headerHeight, "F")
      doc.setFillColor(...primary)
      doc.rect(0, 0, pageWidth, headerHeight - 3, "F")

      // Event title
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont("helvetica", "bold")
      doc.text(titleLines, pageWidth / 2, titleStartY, { align: "center", lineHeightFactor: 1.3 })

      // Tagline
      if (taglineLines.length > 0) {
        doc.setFontSize(10)
        doc.setFont("helvetica", "italic")
        doc.setTextColor(255, 255, 255, 180)
        doc.text(taglineLines, pageWidth / 2, taglineY, { align: "center" })
      }

      // Edition badge
      if (event.edition) {
        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(255, 255, 255, 160)
        doc.text(`${event.edition} Edition`, pageWidth / 2, editionY, {
          align: "center",
        })
      }

      y = headerHeight + 8
    }
```

This is the existing block unchanged, just indented one level inside the new `else`. Do not alter any line inside the `else` — including the two `setTextColor(255, 255, 255, N)` calls, which have a known, separate, pre-existing color bug (jsPDF treats a 4-numeric-argument call as CMYK, not RGBA) — that bug is explicitly out of scope for this plan (it only affects the non-ESSURG path here, since ESSURG now bypasses this block entirely) and is not to be fixed as a side effect of this task.

- [ ] **Step 3: Wrap the footer block**

Replace the `// === FOOTER ===` section with:

```ts
    // === FOOTER ===
    const essurgFooterDrawn = shouldUseEssurgLetterhead(event.id) && drawEssurgFooterJsPdf(doc, pageHeight, margin)
    if (!essurgFooterDrawn) {
      const footerY = pageHeight - 10
      doc.setDrawColor(226, 232, 240)
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)

      doc.setTextColor(...light)
      doc.setFontSize(7.5)
      doc.setFont("helvetica", "normal")
      doc.text(
        `This is a computer-generated invitation.  |  Generated on ${today}`,
        pageWidth / 2,
        footerY,
        { align: "center" }
      )
    }
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep -i "invitation-pdf"`
Expected: no output.

Run: `npx eslint "src/app/api/events/[eventId]/invitation-pdf/route.ts"`
Expected: the one pre-existing `no-explicit-any` error (unrelated to this change, confirmed present before this task in earlier work on this file) — no *new* errors.

- [ ] **Step 5: Manual verification**

This route is a public `GET` endpoint — no authentication needed. Find any real registration ID for the ESSURG 2026 event (e.g. via the Supabase `essurg-2026` project's `registrations` table, or from the admin UI), then:

```bash
curl "https://app.essurg2026.org/api/events/e4af037d-6055-463c-9d57-31db69ecd414/invitation-pdf?registration_id=<a-real-registration-id>" --output /tmp/essurg-invitation.pdf
```

Expected: HTTP 200, the downloaded PDF shows the real letterhead header (logo, "ESSURG 2026" title, tagline, date/venue/contact row) and footer (collaborator logos, QR code) instead of the generic blue band — matching `~/Downloads/ESSURG 2026 Letterhead.pdf`'s branding at the reduced size.

To confirm the non-ESSURG path is unaffected, run the same request against any other event's ID on a non-ESSURG deployment (or, if none is reachable, confirm by code review that the `else` branch is byte-identical to the pre-change code — already done in Step 2).

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/events/[eventId]/invitation-pdf/route.ts"
git commit -m "feat(letterhead): use real ESSURG letterhead in invitation-pdf"
```

---

## Task 3: `faculty-letter-pdf/route.ts` integration

**Files:**
- Modify: `src/app/api/events/[eventId]/faculty-letter-pdf/route.ts`

**Interfaces:**
- Consumes: same four exports from Task 1's `essurg-letterhead.ts`.
- Produces: `renderLetterPdf` gains a new final parameter `useEssurgLetterhead: boolean` — no other signature change, so nothing else calling it needs updating (it has exactly one call site, in this same file).

- [ ] **Step 1: Add the import**

```ts
import { shouldUseEssurgLetterhead, drawEssurgHeaderJsPdf, drawEssurgFooterJsPdf } from "@/lib/pdf/essurg-letterhead"
```

- [ ] **Step 2: Compute the flag in the POST handler and pass it through**

`renderLetterPdf` receives a `LetterEventInfo` (from Task 1 of the faculty-letter-templates work), which has no `id` field — that type is owned by the template registry and shouldn't be widened just for this. Compute the boolean in the handler, where `event.id` (the raw DB row) is still in scope, and pass it as a new argument.

Replace this line:

```ts
    const pdfBuffer = await renderLetterPdf(
      content,
      recipient,
      eventInfo,
      signers,
      buildRef(event.short_name, registration.registration_number),
      embassyName,
      embassyCity
    )
```

with:

```ts
    const pdfBuffer = await renderLetterPdf(
      content,
      recipient,
      eventInfo,
      signers,
      buildRef(event.short_name, registration.registration_number),
      shouldUseEssurgLetterhead(event.id),
      embassyName,
      embassyCity
    )
```

- [ ] **Step 3: Update `renderLetterPdf`'s signature**

Replace:

```ts
async function renderLetterPdf(
  content: LetterContent,
  recipient: { name: string; designation?: string; institution?: string },
  event: LetterEventInfo,
  signers: { name: string; title: string; signature_url?: string }[],
  ref: string,
  embassyName?: string,
  embassyCity?: string
) {
```

with:

```ts
async function renderLetterPdf(
  content: LetterContent,
  recipient: { name: string; designation?: string; institution?: string },
  event: LetterEventInfo,
  signers: { name: string; title: string; signature_url?: string }[],
  ref: string,
  useEssurgLetterhead: boolean,
  embassyName?: string,
  embassyCity?: string
) {
```

- [ ] **Step 4: Wrap the header block**

Replace the `// === HEADER BAND — measure before draw, same fix as invitation-pdf/route.ts ===` section (through `y = headerHeight + 8`) with:

```ts
  // === HEADER BAND — measure before draw, same fix as invitation-pdf/route.ts ===
  const essurgHeaderY = useEssurgLetterhead ? drawEssurgHeaderJsPdf(doc, margin) : null

  if (essurgHeaderY !== null) {
    y = essurgHeaderY
  } else {
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    const titleLines = doc.splitTextToSize(event.name || "Event", contentWidth - 10)
    const titleStartY = titleLines.length > 1 ? 12 : 15
    const afterTitleY = titleStartY + titleLines.length * 7.5
    const editionY = afterTitleY + 6
    const headerHeight = Math.max(35, editionY + 4)

    doc.setFillColor(...primaryDark)
    doc.rect(0, 0, pageWidth, headerHeight, "F")
    doc.setFillColor(...primary)
    doc.rect(0, 0, pageWidth, headerHeight - 3, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text(titleLines, pageWidth / 2, titleStartY, { align: "center", lineHeightFactor: 1.3 })

    if (event.edition) {
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(226, 232, 240)
      doc.text(`${event.edition} Edition`, pageWidth / 2, editionY, { align: "center" })
    }

    y = headerHeight + 8
  }
```

(This is the existing block, unchanged content, indented into the new `else`.)

- [ ] **Step 5: Wrap the footer block**

Replace the `// === FOOTER ===` section with:

```ts
  // === FOOTER ===
  const essurgFooterDrawn = useEssurgLetterhead && drawEssurgFooterJsPdf(doc, pageHeight, margin)
  if (!essurgFooterDrawn) {
    const footerY = pageHeight - 10
    doc.setDrawColor(226, 232, 240)
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)
    doc.setTextColor(...light)
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.text(`This is a computer-generated letter.  |  Generated on ${today}`, pageWidth / 2, footerY, { align: "center" })
  }
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep -i "faculty-letter-pdf"`
Expected: no output.

Run: `npx eslint "src/app/api/events/[eventId]/faculty-letter-pdf/route.ts"`
Expected: no new errors vs. before this task.

- [ ] **Step 7: Manual verification**

This route is `POST` and requires an authenticated session (`requireEventAndPermission(eventId, "speakers")`) — you need a valid session cookie from a logged-in browser session against `app.essurg2026.org`. With one:

```bash
curl -X POST "https://app.essurg2026.org/api/events/e4af037d-6055-463c-9d57-31db69ecd414/faculty-letter-pdf" \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste session cookie from browser devtools>" \
  -d '{
    "template_key": "initial_invitation",
    "registration_id": "<a-real-registration-id-for-a-speaker>",
    "fields": {
      "specialty": "Laparoscopic Surgery",
      "facultyRole": "Invited Speaker",
      "trackSession": "Advanced Laparoscopy Track",
      "contributionFormat": "Lecture",
      "proposedTitle": "Innovations in Hernia Repair",
      "duration": "20 minutes",
      "mainRegistration": "Complimentary",
      "workshopSocialEvents": "Not included",
      "travel": "Not covered",
      "accommodation": "Not covered",
      "localTransport": "Not covered",
      "honorariumVisa": "Nil",
      "acceptanceDeadline": "2026-10-15"
    }
  }' --output /tmp/essurg-letter.pdf
```

Expected: HTTP 200, PDF shows the real letterhead header/footer. If you cannot obtain a session cookie in this environment, flag this step as pending live verification rather than skipping it silently.

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/events/[eventId]/faculty-letter-pdf/route.ts"
git commit -m "feat(letterhead): use real ESSURG letterhead in faculty-letter-pdf"
```

---

## Task 4: `registrations/[id]/receipt/route.ts` integration

**Files:**
- Modify: `src/app/api/registrations/[id]/receipt/route.ts`

**Interfaces:**
- Consumes: `shouldUseEssurgLetterhead`, `drawEssurgHeaderPdfLib`, `drawEssurgFooterPdfLib` from Task 1.

- [ ] **Step 1: Add the import**

```ts
import { shouldUseEssurgLetterhead, drawEssurgHeaderPdfLib, drawEssurgFooterPdfLib } from "@/lib/pdf/essurg-letterhead"
```

- [ ] **Step 2: Add `id` to the events select**

This route's `events(...)` select is currently missing `id`, so the gate has nothing to check. Replace:

```ts
        events (
          name,
          short_name,
          start_date,
          end_date,
          venue_name,
          city,
          state,
          contact_email,
          logo_url
        )
```

with:

```ts
        events (
          id,
          name,
          short_name,
          start_date,
          end_date,
          venue_name,
          city,
          state,
          contact_email,
          logo_url
        )
```

And add `id: string` to the inline `events` type in the `registration` type assertion just below (the block starting `const registration = data as { ... events: { ... } }`):

```ts
      events: {
        id: string
        name: string
        short_name: string | null
        start_date: string
        end_date: string | null
        venue_name: string | null
        city: string | null
        state: string | null
        contact_email: string | null
        logo_url: string | null
      }
```

- [ ] **Step 3: Wrap the header block**

Replace the `// Header - Event Logo + Organization Name` section (from `let logoXOffset = 50` through the `fontRegular` "fullName" `page.drawText` call) with:

```ts
    // Header - Event Logo + Organization Name
    const essurgHeaderY = shouldUseEssurgLetterhead(event?.id) ? await drawEssurgHeaderPdfLib(pdfDoc, page, 50) : null

    if (essurgHeaderY !== null) {
      y = essurgHeaderY
    } else {
      let logoXOffset = 50
      if (event?.logo_url) {
        try {
          const logoResponse = await fetch(event.logo_url)
          if (logoResponse.ok) {
            const logoBytes = await logoResponse.arrayBuffer()
            const uint8 = new Uint8Array(logoBytes)
            const isPNG = uint8[0] === 0x89 && uint8[1] === 0x50
            const isJPG = uint8[0] === 0xFF && uint8[1] === 0xD8
            let logoImage
            if (isPNG) logoImage = await pdfDoc.embedPng(logoBytes)
            else if (isJPG) logoImage = await pdfDoc.embedJpg(logoBytes)
            if (logoImage) {
              const logoSize = 40
              page.drawImage(logoImage, { x: 50, y: y - 15, width: logoSize, height: logoSize })
              logoXOffset = 50 + logoSize + 10
            }
          }
        } catch (e) {
          console.error("Failed to embed logo in receipt:", e)
        }
      }

      page.drawText(COMPANY_CONFIG.name, {
        x: logoXOffset,
        y,
        size: 24,
        font: fontBold,
        color: primaryColor,
      })

      page.drawText(COMPANY_CONFIG.fullName, {
        x: logoXOffset,
        y: y - 20,
        size: 10,
        font: fontRegular,
        color: mutedColor,
      })
    }
```

Note `y` is not reassigned inside the `else` branch — matches the pre-existing behavior exactly, where the subsequent `y -= 60` (Receipt Title section) already accounts for the header without the header block itself moving `y`. In the `if` branch, `y` is set to the real header's returned bottom position, and that same downstream `y -= 60` then applies on top of it correctly.

- [ ] **Step 4: Wrap the footer block**

Replace the `// Footer` section (the two `page.drawText` calls at the end of the function, before `const pdfBytes = await pdfDoc.save()`) with:

```ts
    // Footer
    const essurgFooterDrawn = shouldUseEssurgLetterhead(event?.id) && await drawEssurgFooterPdfLib(pdfDoc, page, 50)
    if (!essurgFooterDrawn) {
      page.drawText(`Generated on ${new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`, {
        x: 50,
        y: 50,
        size: 8,
        font: fontRegular,
        color: mutedColor,
      })

      page.drawText(`Manage your registration at: ${COMPANY_CONFIG.website.replace(/^https?:\/\//, "")}/my`, {
        x: 50,
        y: 35,
        size: 8,
        font: fontRegular,
        color: primaryColor,
      })
    }
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep -i "registrations/\[id\]/receipt"`
Expected: no output.

Run: `npx eslint "src/app/api/registrations/[id]/receipt/route.ts"`
Expected: no new errors vs. before this task.

- [ ] **Step 6: Manual verification**

Public `GET`, no auth needed:

```bash
curl "https://app.essurg2026.org/api/registrations/<a-real-registration-id>/receipt" --output /tmp/essurg-receipt.pdf
```

Expected: HTTP 200, real letterhead header/footer, existing QR code and itemization still present and correctly positioned below the new header.

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/registrations/[id]/receipt/route.ts"
git commit -m "feat(letterhead): use real ESSURG letterhead in registrations receipt"
```

---

## Task 5: `registrations/[id]/final-receipt/route.ts` integration

**Files:**
- Modify: `src/app/api/registrations/[id]/final-receipt/route.ts`

**Interfaces:**
- Consumes: same three exports from Task 1.

- [ ] **Step 1: Add the import**

```ts
import { shouldUseEssurgLetterhead, drawEssurgHeaderPdfLib, drawEssurgFooterPdfLib } from "@/lib/pdf/essurg-letterhead"
```

- [ ] **Step 2: Add `id` to the events select**

Replace:

```ts
      events (name, short_name, start_date, end_date, venue_name, city)
```

with:

```ts
      events (id, name, short_name, start_date, end_date, venue_name, city)
```

(This route accesses `registration.events` as an untyped `any`-cast object — no separate type declaration to update, unlike Task 4's route.)

- [ ] **Step 3: Wrap the header block**

This is two separate edits in this step, not one contiguous block — `const eventY = height - 130` is declared much later in the file, after the entire "Attendee Info" (BILL TO) section, not adjacent to `y = height - 130`.

First, replace from the `// Header` comment through the last `page.drawText` call for the date (ending with the block that draws `Date: ${new Date(receiptDate)...}`), and the one line right after it (`y = height - 130`), with:

```ts
  // Header
  const essurgHeaderY = shouldUseEssurgLetterhead(event?.id) ? await drawEssurgHeaderPdfLib(pdfDoc, page, 50) : null

  if (essurgHeaderY === null) {
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width: width,
      height: 100,
      color: primaryColor,
    })

    page.drawText("REGISTRATION RECEIPT", {
      x: 50,
      y: height - 55,
      size: 22,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    })

    page.drawText("Final Consolidated Receipt", {
      x: 50,
      y: height - 75,
      size: 10,
      font: helvetica,
      color: rgb(0.8, 0.8, 0.8),
    })

    page.drawText(event?.short_name || event?.name || "Event", {
      x: 50,
      y: height - 90,
      size: 11,
      font: helvetica,
      color: rgb(0.8, 0.8, 0.8),
    })

    page.drawText(`Reg #: ${registration.registration_number}`, {
      x: width - 180,
      y: height - 55,
      size: 12,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    })

    const receiptDate = registration.confirmed_at || registration.created_at
    page.drawText(`Date: ${new Date(receiptDate).toLocaleDateString("en-IN")}`, {
      x: width - 180,
      y: height - 72,
      size: 10,
      font: helvetica,
      color: rgb(1, 1, 1),
    })
  }

  y = essurgHeaderY ?? height - 130

  // Attendee Info
  page.drawText("BILL TO", {
```

(The `page.drawText("BILL TO", {` line is the start of the next existing section — shown here only to mark exactly where the replacement ends; do not duplicate it.)

Then find the two lines:

```ts
  // Event Info (right side)
  const eventY = height - 130
```

and replace `const eventY = height - 130` with:

```ts
  const eventY = y
```

(`y` at this point already equals either the real header's returned position or the original `height - 130` fallback, from the change above — this keeps the right-hand "EVENT" column vertically aligned with the left-hand "BILL TO" column exactly as it was before, whichever header was used.)

- [ ] **Step 4: Wrap the footer block**

Replace the `// Footer` section (the two `page.drawText` calls right before `const pdfBytes = await pdfDoc.save()`) with:

```ts
  // Footer
  const essurgFooterDrawn = shouldUseEssurgLetterhead(event?.id) && await drawEssurgFooterPdfLib(pdfDoc, page, 50)
  if (!essurgFooterDrawn) {
    page.drawText("This is a computer-generated receipt and does not require a signature.", {
      x: 50,
      y: 50,
      size: 8,
      font: helvetica,
      color: grayColor,
    })

    page.drawText(`Generated on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, {
      x: 50,
      y: 35,
      size: 8,
      font: helvetica,
      color: grayColor,
    })
  }
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep -i "final-receipt"`
Expected: no output.

Run: `npx eslint "src/app/api/registrations/[id]/final-receipt/route.ts"`
Expected: no new errors vs. before this task.

- [ ] **Step 6: Manual verification**

Public `GET`, no auth needed:

```bash
curl "https://app.essurg2026.org/api/registrations/<a-real-registration-id>/final-receipt" --output /tmp/essurg-final-receipt.pdf
```

Expected: HTTP 200, real letterhead header/footer; "BILL TO" and "EVENT" columns still vertically aligned with each other; itemized table and payment history unaffected.

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/registrations/[id]/final-receipt/route.ts"
git commit -m "feat(letterhead): use real ESSURG letterhead in final-receipt"
```

---

## Task 6: `orders/[id]/receipt/route.ts` integration

**Files:**
- Modify: `src/app/api/orders/[id]/receipt/route.ts`

**Interfaces:**
- Consumes: same three exports from Task 1.

- [ ] **Step 1: Add the import**

```ts
import { shouldUseEssurgLetterhead, drawEssurgHeaderPdfLib, drawEssurgFooterPdfLib } from "@/lib/pdf/essurg-letterhead"
```

- [ ] **Step 2: Add `id` to the events select**

Replace:

```ts
      events (name, short_name, start_date, end_date, venue_name, city, logo_url)
```

with:

```ts
      events (id, name, short_name, start_date, end_date, venue_name, city, logo_url)
```

- [ ] **Step 3: Wrap the header block**

This is two separate edits in this step, not one contiguous block — `const eventY = height - 130` is declared much later in the file, after the entire "Bill To" section, not adjacent to `y = height - 130`.

First, replace from the `// Header` comment through the block that draws `Date: ${new Date(receiptDate)...}` for the order date, and the one line right after it (`y = height - 130`), with:

```ts
  // Header
  const essurgHeaderY = shouldUseEssurgLetterhead(event?.id) ? await drawEssurgHeaderPdfLib(pdfDoc, page, 50) : null

  if (essurgHeaderY === null) {
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width: width,
      height: 100,
      color: isAddonPurchase ? infoColor : primaryColor,
    })

    // Embed event logo in header
    const headerTextX = 50
    if (event?.logo_url) {
      try {
        const logoResponse = await fetch(event.logo_url)
        if (logoResponse.ok) {
          const logoBytes = await logoResponse.arrayBuffer()
          const uint8 = new Uint8Array(logoBytes)
          const isPNG = uint8[0] === 0x89 && uint8[1] === 0x50
          const isJPG = uint8[0] === 0xFF && uint8[1] === 0xD8
          let logoImage
          if (isPNG) logoImage = await pdfDoc.embedPng(logoBytes)
          else if (isJPG) logoImage = await pdfDoc.embedJpg(logoBytes)
          if (logoImage) {
            const logoSize = 50
            page.drawImage(logoImage, {
              x: width - 50 - logoSize,
              y: height - 85,
              width: logoSize,
              height: logoSize,
            })
          }
        }
      } catch (e) {
        console.error("Failed to embed logo in order receipt:", e)
      }
    }

    const receiptTitle = isAddonPurchase ? "ADD-ON PURCHASE RECEIPT" : "PAYMENT RECEIPT"
    page.drawText(receiptTitle, {
      x: headerTextX,
      y: height - 55,
      size: 20,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    })

    page.drawText(event?.short_name || event?.name || "Event", {
      x: headerTextX,
      y: height - 78,
      size: 11,
      font: helvetica,
      color: rgb(0.9, 0.9, 0.9),
    })

    if (isAddonPurchase) {
      page.drawText("Additional Purchase", {
        x: 50,
        y: height - 92,
        size: 9,
        font: helvetica,
        color: rgb(0.8, 0.8, 0.8),
      })
    }

    // Receipt Number (right side)
    page.drawText(`Order #: ${payment.payment_number}`, {
      x: width - 180,
      y: height - 55,
      size: 11,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    })

    const receiptDate = payment.completed_at || payment.created_at
    page.drawText(`Date: ${new Date(receiptDate).toLocaleDateString("en-IN")}`, {
      x: width - 180,
      y: height - 72,
      size: 10,
      font: helvetica,
      color: rgb(1, 1, 1),
    })
  }

  y = essurgHeaderY ?? height - 130

  // Bill To Section
  page.drawText("BILL TO", {
```

(As in Task 5, the trailing `page.drawText("BILL TO", {` line marks where the replacement ends — the existing next section, not to be duplicated.)

Then find:

```ts
  // Event Info (right side)
  const eventY = height - 130
```

and replace `const eventY = height - 130` with:

```ts
  const eventY = y
```

- [ ] **Step 4: Wrap the footer block**

Replace the `// Footer` section (the two `page.drawText` calls before `const pdfBytes = await pdfDoc.save()`) with:

```ts
  // Footer
  const essurgFooterDrawn = shouldUseEssurgLetterhead(event?.id) && await drawEssurgFooterPdfLib(pdfDoc, page, 50)
  if (!essurgFooterDrawn) {
    page.drawText("This is a computer-generated receipt and does not require a signature.", {
      x: 50,
      y: 50,
      size: 8,
      font: helvetica,
      color: grayColor,
    })

    page.drawText(`Generated on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, {
      x: 50,
      y: 35,
      size: 8,
      font: helvetica,
      color: grayColor,
    })
  }
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep -i "orders/\[id\]/receipt"`
Expected: no output.

Run: `npx eslint "src/app/api/orders/[id]/receipt/route.ts"`
Expected: no new errors vs. before this task.

- [ ] **Step 6: Manual verification**

Public `GET`, no auth needed:

```bash
curl "https://app.essurg2026.org/api/orders/<a-real-payment-id>/receipt" --output /tmp/essurg-order-receipt.pdf
```

Expected: HTTP 200, real letterhead header/footer; "BILL TO"/"EVENT" columns aligned; itemized table, payment method/IDs, and status badge unaffected. Test with both a regular ticket order and an addon-purchase order if both exist, since this route has an `isAddonPurchase` branch that changes header color/title text in the non-ESSURG path (confirm that branch still works when falling back, and that the ESSURG image header is used identically for both purchase types).

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/orders/[id]/receipt/route.ts"
git commit -m "feat(letterhead): use real ESSURG letterhead in orders receipt"
```

---

## Task 7: Full end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: PASS, including the 4 tests added in Task 1.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: succeeds with no type errors. (This also runs `db:check` per the existing `build` script — a missing-Supabase-credentials warning there is expected in a local/worktree environment without `.env.local` and is not a failure of this feature; confirm the actual Next.js build/typecheck phases succeed.)

- [ ] **Step 3: Generate one of each of the 5 document types for the real ESSURG event**

Using the curl commands from Tasks 2–6's Step 6/7 (four are public and directly runnable; `faculty-letter-pdf` needs an authenticated session cookie), generate and visually compare each against `~/Downloads/ESSURG 2026 Letterhead.pdf`:

- Header shows the Vitruvian Man/ESS logo, "ESSURG 2026" title, tagline, and date/venue/contact row, at the reduced ~40mm size, left-aligned rather than edge-to-edge.
- Footer shows the collaborator logos, Local Organising Secretariat contact block, and QR code, at the reduced ~25mm size.
- No overlap between the header/footer images and the document's own body content (addressee block, itemized table, signature block, etc.) in any of the 5 documents.
- No `undefined`/`null`/broken-image placeholder anywhere.

- [ ] **Step 4: Confirm the tenant gate against the design spec's non-goals**

- Confirm every one of the 5 routes' non-ESSURG code path is byte-identical to what it was before this plan (`git diff main --stat` for each file, cross-checked against the "wrap existing block in else" pattern used in every task above — nothing inside any `else` branch should differ from the pre-change file).
- Confirm no other route, page, or shared component was touched (`git diff main --stat` overall should list exactly: `src/lib/pdf/essurg-letterhead.ts`, `src/lib/pdf/essurg-letterhead.test.ts`, and the 5 route files).
- Confirm no DB migration was created (`git diff main --stat | grep -i migration` empty).

- [ ] **Step 5: Final commit (if any cleanup was needed)**

If verification surfaced only doc/comment fixes, commit them; if it surfaced a real bug (e.g. a header/body overlap on a specific document type, a missing `id` in a select that was overlooked), stop and fix it as a proper task — write/adjust the relevant step above and re-run its verification — rather than patching silently.
