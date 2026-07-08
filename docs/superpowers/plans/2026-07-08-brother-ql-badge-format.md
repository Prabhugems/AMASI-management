# Brother QL-820NWB 62mm×86mm Badge Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new 62mm×86mm portrait badge page size (`"62x86"`) that renders with no scaling and no blank tail on a Brother QL-820NWB fed with DK-22205 continuous 62mm roll, as an *additional* option alongside the existing 4x2/4x3/4x6/a6/a5 sizes — without touching or regressing the existing, production-proven 4x3 Zebra flow.

**Architecture:** The print system has two independent size concepts that must be kept in sync: (1) `badge_templates.size` — a designer-canvas key (`BADGE_SIZES` in the designer, px at a fixed 96 DPI convention) used only to lay out element x/y/width/height; (2) `print_stations.print_settings.paper_size` — the key that drives the actual `@page` CSS size at print time (`getPaperDimensions` in `/print/[token]`). Both need a new `"62x86"` entry, using the *same* key string, with the designer's px canvas computed at 96 DPI from 62mm×86mm so element coordinates map 1:1 onto the physical page. A new badge template row and a new print station row (both DB data, not schema/migration) wire it together for the same event and ticket-type scope as the existing "Brother Label Template" (4x3).

**Tech Stack:** Next.js 16 client component (`src/app/print/[token]/page.tsx`), Supabase (`badge_templates`, `print_stations`, `registrations` tables — no schema change), Node one-off seed scripts (`.mjs`, matches existing `scripts/125-*.mjs` convention).

## Global Constraints

- `@page { size: 62mm 86mm; margin: 0 }`, portrait, no scaling — exact CSS from the spec.
- Usable content width ≤ 60mm (QL-820NWB max print width 60.96mm) — layout must not exceed this.
- QR code ~40mm square, centered.
- **The existing 4x3 "Brother Label Template" (`id 53a180a7-01dd-425f-8932-ef0ddbbd8200`) and its "Brother Label" print station (`id 6f827b4b-0c03-4d33-98b7-b53920be4173`, `access_token e0bfd3b175a434241479de29f9fddfd26ab42db5f0caa7fe`), both on event 127 FMAS Course (`id 81d9da71-c745-4897-bb47-f363207a6223`), must NOT be modified — this is the production-proven flow.**
- **Every task that touches shared rendering code (`renderElementToHtml`, `getPaperDimensions`) must re-render the existing 4x3 "Brother Label" station via `/print/e0bfd3b175a434241479de29f9fddfd26ab42db5f0caa7fe` immediately after the change and confirm the badge box is still exactly `384px × 288px` (= 4in × 3in) with no overflow, BEFORE moving to the next task.** This is Task 2 and Task 3 below, plus a final pass in Task 9.
- `ticket_type_ids` on the new template and station: `null` (mirrors the existing Brother Label config exactly — confirmed via DB query, not scoped to a specific subset today).
- Rotation defaults to `0` (off) on the new station — feed direction can only be confirmed on the physical printer; flip to 180° in the print-station's existing Rotation dropdown if the first real print comes out upside-down. No code change needed either way.
- No push to `main` until the user has reviewed the rendered screenshot + measured dimensions of the new 62×86mm badge.

---

### Task 1: Create the disposable QA test registration

**Files:**
- Create: `scripts/127-brother-ql-test-registration.mjs`

**Interfaces:**
- Consumes: `.env.local` → `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (same loader pattern as `scripts/125-add-jayanta-chakraborty-invite.mjs:26-31`).
- Produces: one `registrations` row (`event_id 81d9da71-c745-4897-bb47-f363207a6223`, `attendee_email test-brother-ql-verify@internal.test`, `status confirmed`) whose `registration_number` (e.g. `127A1195`) is used as the manual-input value for every regression/verification check in Tasks 2, 3, and 8 — so no real attendee's `checked_in`/`badge_printed` flags are ever touched by this QA work.

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
/**
 * Disposable TEST registration for QA-verifying the print renderer — both
 * the existing 4x3 Brother Label flow (must stay unaffected) and the new
 * 62x86 Brother QL flow. Event: 127 FMAS Course. Using one synthetic
 * registration for all print-renderer QA means no real attendee's
 * checked_in/badge_printed flags are ever touched by this work.
 *
 * Default dry-run; pass --apply to write.
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const APPLY = process.argv.includes("--apply")

const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const EVENT_ID = "81d9da71-c745-4897-bb47-f363207a6223" // 127 FMAS Course
const TEST_EMAIL = "test-brother-ql-verify@internal.test"

console.log(APPLY ? "APPLY MODE — changes WILL be written" : "DRY RUN — no writes")

const { data: existingReg } = await supabase
  .from("registrations").select("id, registration_number")
  .eq("event_id", EVENT_ID).eq("attendee_email", TEST_EMAIL).maybeSingle()

if (existingReg) {
  console.log(`✓ Test registration already exists: ${existingReg.registration_number} — reusing`)
  process.exit(0)
}

const { data: anyTicketType } = await supabase
  .from("ticket_types").select("id, name").eq("event_id", EVENT_ID).limit(1).maybeSingle()
const { data: maxReg } = await supabase
  .from("registrations").select("registration_number")
  .eq("event_id", EVENT_ID).like("registration_number", "127A%")
  .order("registration_number", { ascending: false }).limit(1).maybeSingle()
const nextSeq = maxReg ? parseInt(maxReg.registration_number.slice(4), 10) + 1 : 1
const regNo = `127A${nextSeq}`

console.log(`+ ${regNo}: TEST Brother QL <${TEST_EMAIL}> (ticket type: ${anyTicketType?.name || "none found"})`)
if (APPLY) {
  const { data: inserted, error } = await supabase.from("registrations").insert({
    event_id: EVENT_ID,
    ticket_type_id: anyTicketType?.id || null,
    registration_number: regNo,
    attendee_name: "TEST Brother QL",
    attendee_email: TEST_EMAIL,
    attendee_designation: "QA Test",
    attendee_institution: "AMASI QA",
    status: "confirmed",
    payment_status: "completed",
    unit_price: 0, tax_amount: 0, discount_amount: 0, total_amount: 0,
    currency: "INR", quantity: 1,
    participation_mode: "offline",
    confirmed_at: new Date().toISOString(),
    notes: "DISPOSABLE — created for Brother QL/4x3 print-renderer QA. Safe to delete after verification.",
  }).select().single()
  if (error) { console.error("Registration insert failed:", error); process.exit(1) }
  console.log(`✓ created ${inserted.registration_number}`)
} else {
  console.log("(dry run — re-run with --apply to write)")
}
```

- [ ] **Step 2: Dry-run it**

Run: `node scripts/127-brother-ql-test-registration.mjs`
Expected: `DRY RUN` header, then `+ 127A<N>: TEST Brother QL <test-brother-ql-verify@internal.test> (ticket type: <some name>)`. No `✓ created` line.

- [ ] **Step 3: Apply it and record the registration number**

Run: `node scripts/127-brother-ql-test-registration.mjs --apply`
Expected: `✓ created 127A<N>`. **Record this registration number — every remaining task's browser check uses it verbatim.**

- [ ] **Step 4: Commit**

```bash
git add scripts/127-brother-ql-test-registration.mjs
git commit -m "chore: add disposable QA test registration for print-renderer verification"
```

---

### Task 2: Add `singleLine` and `lineClamp` support to the text-element renderer, then verify 4x3 is unaffected

**Files:**
- Modify: `src/app/print/[token]/page.tsx:1395-1420` (the plain "Text element" branch inside `renderElementToHtml`)

**Interfaces:**
- Consumes: nothing new — reads two new *optional* fields off the existing untyped `element` object: `element.singleLine?: boolean`, `element.lineClamp?: number`.
- Produces: when neither field is set, output is byte-for-byte identical to today (verified in Step 3) — every existing template, including the 4x3 Brother Label Template, keeps rendering exactly as before. When `singleLine: true` is set, text renders as one line truncated with `…`. When `lineClamp: N` is set, text wraps but is hard-capped at `N` lines with `…`. Task 6's new template JSON relies on both; the existing 4x3 template's `template_data` sets neither.

- [ ] **Step 1: Read the current text-element branch to confirm exact boundaries**

Run: `sed -n '1393,1421p' "src/app/print/[token]/page.tsx"`
Expected: prints the `// Text element` comment through the closing `` ` `` of the template literal — this is the block being replaced.

- [ ] **Step 2: Replace the block**

Replace:
```tsx
    // Text element
    const shadowStyle = element.shadowEnabled
      ? `text-shadow: ${element.shadowOffsetX || 2}px ${element.shadowOffsetY || 2}px ${element.shadowBlur || 4}px ${element.shadowColor || "rgba(0,0,0,0.3)"};`
      : ""

    return `<div style="
      ${baseStyle}
      display: flex;
      align-items: center;
      overflow: hidden;
      white-space: pre-wrap;
      font-size: ${element.fontSize || 14}px;
      font-family: ${element.fontFamily || "Arial, sans-serif"};
      font-weight: ${element.fontWeight || "normal"};
      font-style: ${element.fontStyle || "normal"};
      color: ${element.color || "#000000"};
      text-align: ${element.align || "left"};
      justify-content: ${element.align === "center" ? "center" : element.align === "right" ? "flex-end" : "flex-start"};
      background-color: ${element.backgroundColor || "transparent"};
      line-height: ${element.lineHeight || 1.3};
      letter-spacing: ${element.letterSpacing ? `${element.letterSpacing}px` : "normal"};
      ${shadowStyle}
      border: ${element.borderWidth || 0}px solid ${element.borderColor || "transparent"};
      border-radius: ${element.borderRadius || 0}px;
    ">${content}</div>`
  }
```

With:
```tsx
    // Text element
    const shadowStyle = element.shadowEnabled
      ? `text-shadow: ${element.shadowOffsetX || 2}px ${element.shadowOffsetY || 2}px ${element.shadowBlur || 4}px ${element.shadowColor || "rgba(0,0,0,0.3)"};`
      : ""

    // singleLine: truncate to one line with an ellipsis instead of wrapping.
    // Used by narrow labels (e.g. Brother QL 62mm badges) where a long value
    // must not push other elements off the printable area.
    if (element.singleLine) {
      return `<div style="
        ${baseStyle}
        display: block;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-size: ${element.fontSize || 14}px;
        font-family: ${element.fontFamily || "Arial, sans-serif"};
        font-weight: ${element.fontWeight || "normal"};
        font-style: ${element.fontStyle || "normal"};
        color: ${element.color || "#000000"};
        text-align: ${element.align || "left"};
        background-color: ${element.backgroundColor || "transparent"};
        line-height: ${element.height}px;
        letter-spacing: ${element.letterSpacing ? `${element.letterSpacing}px` : "normal"};
        ${shadowStyle}
        border: ${element.borderWidth || 0}px solid ${element.borderColor || "transparent"};
        border-radius: ${element.borderRadius || 0}px;
      ">${content}</div>`
    }

    // lineClamp: wrap normally but cut off after N lines with an ellipsis.
    const lineClampStyle = element.lineClamp
      ? `display: -webkit-box; -webkit-line-clamp: ${element.lineClamp}; -webkit-box-orient: vertical;`
      : "display: flex; align-items: center;"

    return `<div style="
      ${baseStyle}
      ${lineClampStyle}
      overflow: hidden;
      white-space: ${element.lineClamp ? "normal" : "pre-wrap"};
      font-size: ${element.fontSize || 14}px;
      font-family: ${element.fontFamily || "Arial, sans-serif"};
      font-weight: ${element.fontWeight || "normal"};
      font-style: ${element.fontStyle || "normal"};
      color: ${element.color || "#000000"};
      text-align: ${element.align || "left"};
      justify-content: ${element.align === "center" ? "center" : element.align === "right" ? "flex-end" : "flex-start"};
      background-color: ${element.backgroundColor || "transparent"};
      line-height: ${element.lineHeight || 1.3};
      letter-spacing: ${element.letterSpacing ? `${element.letterSpacing}px` : "normal"};
      ${shadowStyle}
      border: ${element.borderWidth || 0}px solid ${element.borderColor || "transparent"};
      border-radius: ${element.borderRadius || 0}px;
    ">${content}</div>`
  }
```

- [ ] **Step 3: Verify backward compatibility by diffing generated output for an element with neither flag set**

Run: `node -e "
const el = { x:0,y:0,width:100,height:20,fontSize:14 };
const before = \`display: flex; align-items: center;\`;
console.log('lineClampStyle when unset equals original:', before === (el.lineClamp ? '' : 'display: flex; align-items: center;'));
"`
Expected: `lineClampStyle when unset equals original: true`.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no new errors in `src/app/print/[token]/page.tsx`.

- [ ] **Step 5: REGRESSION CHECK — confirm the existing 4x3 "Brother Label" station still renders unaffected**

Start the dev server if not running (`npm run dev`). In Chrome, navigate to `http://localhost:3000/print/e0bfd3b175a434241479de29f9fddfd26ab42db5f0caa7fe`.

Suppress the native print dialog (same technique used throughout this plan — read `iframe.contentWindow.print` before triggering print so the OS dialog never opens):
```js
const iframe = document.querySelector("iframe")
if (iframe && iframe.contentWindow) iframe.contentWindow.print = () => { console.log("print() suppressed for QA") }
"patched"
```

Submit the registration number recorded in Task 1 Step 3 via the manual-input field.

Measure the rendered box:
```js
const iframe = document.querySelector("iframe")
const doc = iframe.contentDocument
const bodyRect = doc.body.getBoundingClientRect()
const container = doc.querySelector(".badge-container")
const containerRect = container.getBoundingClientRect()
const overflow = [...container.children].map(el => {
  const r = el.getBoundingClientRect()
  return {
    tag: el.tagName,
    right: (r.left - containerRect.left) + r.width,
    bottom: (r.top - containerRect.top) + r.height,
    overflowsRight: (r.left - containerRect.left) + r.width > containerRect.width + 0.5,
    overflowsBottom: (r.top - containerRect.top) + r.height > containerRect.height + 0.5,
  }
})
JSON.stringify({ bodyPx: { w: bodyRect.width, h: bodyRect.height }, expectedPx: { w: 384, h: 288 }, overflow }, null, 2)
```
Expected: `bodyPx` = `{ w: 384, h: 288 }` exactly (4in × 3in is an exact CSS px conversion, no rounding), and every `overflow` entry has `overflowsRight: false, overflowsBottom: false`. **If this fails, stop and fix Task 2 before proceeding — do not move to Task 3.**

- [ ] **Step 6: Commit**

```bash
git add "src/app/print/[token]/page.tsx"
git commit -m "feat(print): support singleLine/lineClamp text truncation in badge renderer"
```

---

### Task 3: Add the `62x86` paper size to the print renderer's `@page` dimension map, then re-verify 4x3

**Files:**
- Modify: `src/app/print/[token]/page.tsx:1568-1584` (`getPaperDimensions`)

**Interfaces:**
- Consumes: `settings.paper_size` string from `print_stations.print_settings.paper_size` (set to `"62x86"` by Task 6's seed script; still `"4x3"` on the untouched Brother Label station).
- Produces: `{ width: "62mm", height: "86mm" }` for the new key; the `"4x3"` entry is untouched, so `getPaperDimensions("4x3", "portrait")` keeps returning `{ width: "4in", height: "3in" }`.

- [ ] **Step 1: Add the entry**

Replace:
```tsx
    const sizes: Record<string, { width: string; height: string }> = {
      "4x2": { width: "4in", height: "2in" },
      "4x3": { width: "4in", height: "3in" },
      "4x6": { width: "4in", height: "6in" },
      "a6": { width: "105mm", height: "148mm" },
      "a5": { width: "148mm", height: "210mm" }
    }
```

With:
```tsx
    const sizes: Record<string, { width: string; height: string }> = {
      "4x2": { width: "4in", height: "2in" },
      "4x3": { width: "4in", height: "3in" },
      "4x6": { width: "4in", height: "6in" },
      "62x86": { width: "62mm", height: "86mm" },
      "a6": { width: "105mm", height: "148mm" },
      "a5": { width: "148mm", height: "210mm" }
    }
```

- [ ] **Step 2: Verify with a standalone Node check that both the new key and the untouched `4x3` key resolve correctly**

Run: `node -e "
const sizes = { '4x3': { width: '4in', height: '3in' }, '62x86': { width: '62mm', height: '86mm' } };
function getPaperDimensions(paperSize, orientation) {
  const size = sizes[paperSize] || sizes['4x6'];
  if (orientation === 'landscape') return { width: size.height, height: size.width };
  return size;
}
console.log('4x3 portrait:', JSON.stringify(getPaperDimensions('4x3', 'portrait')));
console.log('62x86 portrait:', JSON.stringify(getPaperDimensions('62x86', 'portrait')));
console.log('62x86 landscape:', JSON.stringify(getPaperDimensions('62x86', 'landscape')));
"`
Expected:
```
4x3 portrait: {"width":"4in","height":"3in"}
62x86 portrait: {"width":"62mm","height":"86mm"}
62x86 landscape: {"width":"86mm","height":"62mm"}
```

- [ ] **Step 3: REGRESSION CHECK — confirm the existing 4x3 "Brother Label" station still renders unaffected**

Repeat Task 2 Step 5 exactly (same URL `http://localhost:3000/print/e0bfd3b175a434241479de29f9fddfd26ab42db5f0caa7fe`, same registration number from Task 1, same measurement snippet).
Expected: `bodyPx` = `{ w: 384, h: 288 }` again, no overflow. **If this fails, stop and fix Task 3 before proceeding.**

- [ ] **Step 4: Commit**

```bash
git add "src/app/print/[token]/page.tsx"
git commit -m "feat(print): add 62x86mm Brother QL page size"
```

---

### Task 4: Add the `62x86` size to the badge designer's canvas size list

**Files:**
- Modify: `src/app/events/[eventId]/badges/designer/page.tsx:100-106` (`BADGE_SIZES`)

**Interfaces:**
- Consumes: nothing.
- Produces: `BADGE_SIZES["62x86"] = { width: 234, height: 325, label: "62mm × 86mm (Brother QL)" }`. `234`/`325` are `round(62mm / 25.4 * 96)` / `round(86mm / 25.4 * 96)` — the same 96-DPI convention already used for every other entry (verified against the existing `A6` row below). This dict is only consulted by the designer canvas (element layout), never by the print-time `@page` path — so this task carries **no regression risk to the 4x3 print flow** and does not need a live-render check; `npm run lint` is sufficient.

- [ ] **Step 1: Verify the DPI math independently before editing**

Run: `node -e "
console.log('62mm ->', Math.round(62/25.4*96));
console.log('86mm ->', Math.round(86/25.4*96));
console.log('105mm (A6 width, sanity check) ->', Math.round(105/25.4*96));
console.log('148mm (A6 height, sanity check) ->', Math.round(148/25.4*96));
"`
Expected:
```
62mm -> 234
86mm -> 325
105mm (A6 width, sanity check) -> 397
148mm (A6 height, sanity check) -> 559
```
The A6 sanity-check lines must equal the existing `A6: { width: 397, height: 559, ... }` row already in the file — confirms the convention before adding a new entry under it.

- [ ] **Step 2: Add the entry**

Replace:
```tsx
const BADGE_SIZES: Record<string, { width: number; height: number; label: string }> = {
  "4x3": { width: 384, height: 288, label: '4" × 3"' },
  "3x4": { width: 288, height: 384, label: '3" × 4"' },
  "4x6": { width: 384, height: 576, label: '4" × 6"' },
  "3.5x2": { width: 336, height: 192, label: '3.5" × 2"' },
  A6: { width: 397, height: 559, label: "A6" },
}
```

With:
```tsx
const BADGE_SIZES: Record<string, { width: number; height: number; label: string }> = {
  "4x3": { width: 384, height: 288, label: '4" × 3"' },
  "3x4": { width: 288, height: 384, label: '3" × 4"' },
  "4x6": { width: 384, height: 576, label: '4" × 6"' },
  "3.5x2": { width: 336, height: 192, label: '3.5" × 2"' },
  "62x86": { width: 234, height: 325, label: "62mm × 86mm (Brother QL)" },
  A6: { width: 397, height: 559, label: "A6" },
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors in `src/app/events/[eventId]/badges/designer/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/events/[eventId]/badges/designer/page.tsx"
git commit -m "feat(badges): add 62x86mm Brother QL size to designer canvas"
```

---

### Task 5: Add the `62x86` option to the print-station Paper Size dropdown

**Files:**
- Modify: `src/app/events/[eventId]/print-stations/page.tsx:87-94` (`PAPER_SIZES`)

**Interfaces:**
- Consumes: nothing.
- Produces: a new `{ value: "62x86", label: "62×86mm (Brother QL)" }` entry rendered as an `<option>` at `src/app/events/[eventId]/print-stations/page.tsx:808-810`. This list only feeds the create/edit form's `<select>` — it does not read or write any existing station's stored `print_settings`, so **no regression risk to the 4x3 flow**; `npm run lint` is sufficient.

- [ ] **Step 1: Add the entry**

Replace:
```tsx
const PAPER_SIZES = [
  { value: "4x2", label: "Label 4×2\"" },
  { value: "4x3", label: "Label 4×3\"" },
  { value: "4x6", label: "Badge 4×6\"" },
  { value: "a6", label: "A6 (105×148mm)" },
  { value: "a5", label: "A5 (148×210mm)" },
  { value: "custom", label: "Custom Size" }
]
```

With:
```tsx
const PAPER_SIZES = [
  { value: "4x2", label: "Label 4×2\"" },
  { value: "4x3", label: "Label 4×3\"" },
  { value: "4x6", label: "Badge 4×6\"" },
  { value: "62x86", label: "62×86mm (Brother QL)" },
  { value: "a6", label: "A6 (105×148mm)" },
  { value: "a5", label: "A5 (148×210mm)" },
  { value: "custom", label: "Custom Size" }
]
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors in `src/app/events/[eventId]/print-stations/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/events/[eventId]/print-stations/page.tsx"
git commit -m "feat(print-stations): add 62x86mm Brother QL paper size option"
```

---

### Task 6: Write the seed script that creates the new badge template and print station

**Files:**
- Create: `scripts/127-add-brother-ql-badge-template.mjs`

**Interfaces:**
- Consumes: `.env.local` (same loader pattern as Task 1's script).
- Produces (on `--apply`, printed to stdout): the new `badge_templates.id` and the new `print_stations.access_token` (needed to build the `/print/<token>` URL in Task 8).

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
/**
 * Brother QL-820NWB 62mm x 86mm badge format — additive setup for "127 FMAS
 * Course". Creates a NEW badge template + print station; does NOT touch the
 * existing 4x3 "Brother Label Template" / "Brother Label" station (Zebra
 * flow stays as-is).
 *
 * Default dry-run; pass --apply to write.
 */
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const APPLY = process.argv.includes("--apply")

const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const EVENT_ID = "81d9da71-c745-4897-bb47-f363207a6223" // 127 FMAS Course
const TEMPLATE_NAME = "Brother QL-820NWB Template (62x86mm)"
const STATION_NAME = "Brother QL-820NWB Test"

const log = []
function L(msg) { log.push(msg); console.log(msg) }
function header(t) { L(""); L("=".repeat(72)); L(t); L("=".repeat(72)) }

header(APPLY ? "APPLY MODE — changes WILL be written" : "DRY RUN — no writes")

const { data: event, error: eventErr } = await supabase
  .from("events").select("id, name").eq("id", EVENT_ID).single()
if (eventErr || !event) { console.error("Event not found:", eventErr); process.exit(1) }
L(`Event: ${event.name} (${event.id})`)

// ---- 1. Badge template ----
header("1. Badge template (62x86mm)")

const TEMPLATE_DATA = {
  backgroundColor: "#ffffff",
  elements: [
    {
      id: "name", type: "text", content: "Dr.{{name}}",
      x: 4, y: 10, width: 226, height: 34, zIndex: 1,
      fontSize: 16, fontWeight: "bold", fontFamily: "Arial, sans-serif",
      align: "center", color: "#000000", textCase: "capitalize",
      singleLine: true,
    },
    {
      id: "qr", type: "qr_code", content: "{{registration_number}}",
      x: 42, y: 54, width: 151, height: 151, zIndex: 2,
    },
    {
      id: "ticket_type", type: "text", content: "{{ticket_type}}",
      x: 4, y: 213, width: 226, height: 32, zIndex: 3,
      fontSize: 12, fontWeight: "normal", fontFamily: "Arial, sans-serif",
      align: "center", color: "#000000",
      lineClamp: 2,
    },
    {
      id: "regno", type: "text", content: "{{registration_number}}",
      x: 4, y: 291, width: 226, height: 24, zIndex: 4,
      fontSize: 14, fontWeight: "bold", fontFamily: "Arial, sans-serif",
      align: "center", color: "#000000",
    },
  ],
}

let templateId = null
const { data: existingTemplate } = await supabase
  .from("badge_templates").select("id").eq("event_id", EVENT_ID).eq("name", TEMPLATE_NAME).maybeSingle()

if (existingTemplate) {
  L(`  ✓ "${TEMPLATE_NAME}" already exists (${existingTemplate.id}) — reusing`)
  templateId = existingTemplate.id
} else {
  L(`  + "${TEMPLATE_NAME}" — size 62x86, 4 elements, ticket_type_ids: null`)
  if (APPLY) {
    const { data: inserted, error } = await supabase.from("badge_templates").insert({
      event_id: EVENT_ID,
      name: TEMPLATE_NAME,
      description: "Brother QL-820NWB, DK-22205 62mm continuous roll, portrait, no rotation by default",
      size: "62x86",
      template_data: TEMPLATE_DATA,
      ticket_type_ids: null,
      is_default: false,
    }).select().single()
    if (error) { console.error("Template insert failed:", error); process.exit(1) }
    templateId = inserted.id
    L(`  ✓ created ${templateId}`)
  }
}

// ---- 2. Print station ----
header("2. Print station")

let stationToken = null
let stationId = null
const { data: existingStation } = await supabase
  .from("print_stations").select("id, access_token").eq("event_id", EVENT_ID).eq("name", STATION_NAME).maybeSingle()

if (existingStation) {
  L(`  ✓ "${STATION_NAME}" already exists (${existingStation.id}) — reusing`)
  stationId = existingStation.id
  stationToken = existingStation.access_token
} else {
  stationToken = crypto.randomBytes(24).toString("hex")
  L(`  + "${STATION_NAME}" — paper_size: 62x86, orientation: portrait, rotation: 0, printer_type: browser`)
  if (APPLY) {
    const { data: inserted, error } = await supabase.from("print_stations").insert({
      event_id: EVENT_ID,
      name: STATION_NAME,
      description: "QA/verification station for the 62x86mm Brother QL badge format",
      print_mode: "full_badge",
      badge_template_id: templateId,
      print_settings: {
        paper_size: "62x86",
        orientation: "portrait",
        rotation: 0,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        scale: 100,
        copies: 1,
        printer_type: "browser",
      },
      allow_reprint: true,
      max_reprints: 3,
      auto_print: false,
      require_checkin: false,
      ticket_type_ids: null,
      access_token: stationToken,
      is_active: true,
    }).select().single()
    if (error) { console.error("Station insert failed:", error); process.exit(1) }
    stationId = inserted.id
    L(`  ✓ created ${stationId}`)
  }
}

header("DONE")
if (APPLY) {
  L(`Template ID: ${templateId}`)
  L(`Station ID:  ${stationId}`)
  L(`Print URL:   /print/${stationToken}`)
} else {
  L(`(dry run — re-run with --apply to write)`)
}
```

- [ ] **Step 2: Dry-run it**

Run: `node scripts/127-add-brother-ql-badge-template.mjs`
Expected: `DRY RUN` header, resolves `Event: 127 FMAS Course`, shows `+ "Brother QL-820NWB Template (62x86mm)"` and `+ "Brother QL-820NWB Test"` with no `✓ created` lines.

- [ ] **Step 3: Commit**

```bash
git add scripts/127-add-brother-ql-badge-template.mjs
git commit -m "chore: add seed script for Brother QL 62x86mm badge format"
```

---

### Task 7: Apply the seed script

**Files:** none (data only — no schema/migration change; inserts into existing `badge_templates`/`print_stations` tables, same as the app's own admin UI would do).

- [ ] **Step 1: Run with `--apply`**

Run: `node scripts/127-add-brother-ql-badge-template.mjs --apply`
Expected: two `✓ created <uuid>` lines, then `Template ID`, `Station ID`, `Print URL: /print/<64-hex-char token>`. **Record the token — Task 8 uses it verbatim.**

- [ ] **Step 2: Spot-check in the DB**

Run (via `mcp__supabase__execute_sql`):
```sql
select bt.name as template_name, bt.size, ps.name as station_name,
       ps.print_settings->>'paper_size' as paper_size,
       ps.print_settings->>'rotation' as rotation, ps.access_token
from print_stations ps join badge_templates bt on bt.id = ps.badge_template_id
where ps.event_id = '81d9da71-c745-4897-bb47-f363207a6223' and ps.name = 'Brother QL-820NWB Test';
```
Expected: one row, `size = '62x86'`, `paper_size = '62x86'`, `rotation = '0'`.

- [ ] **Step 3: Confirm the existing 4x3 template/station are untouched**

Run:
```sql
select updated_at from print_stations where id = '6f827b4b-0c03-4d33-98b7-b53920be4173';
select updated_at from badge_templates where id = '53a180a7-01dd-425f-8932-ef0ddbbd8200';
```
Expected: `updated_at` on both predates this session (no write ever targeted these IDs — confirmed by re-reading the plan: no task above references either ID in an `.insert()`/`.update()` call).

---

### Task 8: Browser-verify the new 62×86mm badge, screenshot, then re-confirm 4x3 one final time

**Files:** none (verification only).

**Interfaces:**
- Consumes: the dev server, the `access_token` from Task 7 and the `registration_number` from Task 1.
- Produces: a screenshot and a measured `{width, height}` in px to report back to the user before any push.

- [ ] **Step 1: Open `/print/<new token>` in Chrome, from Task 7's token**

Navigate to `http://localhost:3000/print/<token>`.
Expected: kiosk page loads, shows the station name "Brother QL-820NWB Test" and a manual-entry input.

- [ ] **Step 2: Patch out the native print dialog**

```js
const iframe = document.querySelector("iframe")
if (iframe && iframe.contentWindow) iframe.contentWindow.print = () => { console.log("print() suppressed for QA") }
"patched"
```
Expected: returns `"patched"`.

- [ ] **Step 3: Submit the test registration number from Task 1**

Type the `registration_number` into the manual-input field and submit.
Expected: success state, no error toast.

- [ ] **Step 4: Measure the rendered page box**

```js
const iframe = document.querySelector("iframe")
const doc = iframe.contentDocument
const body = doc.body
const container = doc.querySelector(".badge-container")
const bodyRect = body.getBoundingClientRect()
const containerRect = container.getBoundingClientRect()
const overflow = [...container.children].map(el => {
  const r = el.getBoundingClientRect()
  return {
    tag: el.tagName,
    right: (r.left - containerRect.left) + r.width,
    bottom: (r.top - containerRect.top) + r.height,
    overflowsRight: (r.left - containerRect.left) + r.width > containerRect.width + 0.5,
    overflowsBottom: (r.top - containerRect.top) + r.height > containerRect.height + 0.5,
  }
})
JSON.stringify({ bodyPx: { w: bodyRect.width, h: bodyRect.height }, expectedPx: { w: 62/25.4*96, h: 86/25.4*96 }, overflow }, null, 2)
```
Expected: `bodyPx` ≈ `{ w: 234.33, h: 325.04 }` (matches `expectedPx` within ~1px rounding), every `overflow` entry `overflowsRight: false, overflowsBottom: false`.

- [ ] **Step 5: Screenshot the rendered badge**

Temporarily reveal the iframe for the screenshot only (throwaway runtime DOM tweak, not a code change):
```js
const iframe = document.querySelector("iframe")
iframe.style.cssText = "position:fixed;top:20px;left:20px;width:250px;height:340px;z-index:99999;background:white;border:2px solid #333;"
"revealed"
```
Take a screenshot (`mcp__claude-in-chrome__computer`). Reload the tab afterward to discard the styling tweak.

- [ ] **Step 6: FINAL REGRESSION CHECK — one more full pass on the 4x3 flow before anything gets pushed**

Navigate to `http://localhost:3000/print/e0bfd3b175a434241479de29f9fddfd26ab42db5f0caa7fe`, repeat Steps 2–4 (patch print, submit the same Task 1 registration number, measure). Expected: `bodyPx` = `{ w: 384, h: 288 }`, no overflow — identical to Task 2 Step 5 and Task 3 Step 3.

- [ ] **Step 7: Report to the user**

Present: the 62×86mm screenshot, its measured `bodyPx`/overflow result, and the final 4x3 regression result. **Stop here and wait for the user's explicit go-ahead before Task 9.**

---

### Task 9: Commit and push to `main`

**Files:** none beyond what Tasks 1–6 already staged.

**Interfaces:**
- Consumes: user's go-ahead from Task 8, Step 7.

- [ ] **Step 1: Confirm all task commits are present and check final status**

Run: `git log --oneline -8` and `git status`
Expected: six commits from Tasks 1–6 (disposable test registration, renderer text-truncation support + 4x3 regression pass, `62x86` in print renderer + 4x3 regression pass, `62x86` in designer, `62x86` in print-station form, seed script), clean working tree.

- [ ] **Step 2: Push to `main`**

Run: `git push origin main`
Expected: push succeeds, fast-forward, no conflicts.

---

## Self-Review Notes

- **Spec coverage:** (1) new page size in designer + `@page` CSS → Tasks 3–4. (2) 62×86mm portrait template with Dr.{{name}} / QR ~40mm / ticket_type 2-line-max / registration_number → Task 6's `TEMPLATE_DATA`. (3) existing 4x3 untouched, additional template on same ticket-type scope → confirmed via `ticket_type_ids: null` mirroring the existing row, no task ever writes to the existing template/station IDs, and Task 7 Step 3 explicitly re-checks `updated_at`. (4) render + confirm exact dimensions, no overflow → Task 8. (5) preview before commit, push to main when done → Task 8 Step 7 (stop point) then Task 9.
- **User's added instruction (this revision):** "don't touch 4x3, verify after each task" → Task 2 Step 5 and Task 3 Step 3 are hard regression gates (explicitly: "stop and fix before proceeding" if they fail) right after the two tasks that touch shared rendering code; Task 8 Step 6 repeats the same check a third time as the last gate before push. Tasks 4–5 don't touch the print-time path at all (documented inline in each task's Interfaces section), so lint is the appropriate check there, not a live render.
- **Rotation:** left as a per-station toggle that already exists in the UI (`Rotation` select, `0°/90°/180°/270°`) — no code change needed; the seed script sets it to `0` explicitly so `settings.rotation ?? ...` in `generatePrintContent` never falls back to the 180° Zebra default. Feed direction is a physical-printer check only the user can make.
