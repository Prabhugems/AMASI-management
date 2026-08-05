# Badges Shared Renderer (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Badge Designer's per-element rendering logic into a
shared, reusable `BadgeElementView`/`BadgeCanvas` pair of components, so
later sub-projects (Template card previews, Generate's live preview) can
show the exact same badge artwork without a second, drift-prone rendering
implementation — with zero behavior change to the Designer itself.

**Architecture:** Two new components in `src/components/badges/`:
`BadgeElementView` (renders one element's content, pure function of props)
and `BadgeCanvas` (composes a whole template's background + positioned
elements, non-interactive). Shared types move to `src/lib/badge-template-types.ts`.
Designer is refactored to consume both: `BadgeCanvas` for its existing
read-only preview mode, individual `<Rnd><BadgeElementView /></Rnd>` for its
existing interactive edit mode. A `scale` prop (default `1`), multiplied
into every measurement internally, replaces the need for a CSS transform —
this preserves Designer's current zoom mechanism untouched (see the design
spec's Section 2a for why).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 3, `qrcode`,
`jsbarcode`, `react-rnd` (unchanged), Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-05-badges-shared-renderer-design.md`
  (read this first — every task below implements a specific section of it).
- Do not modify `src/lib/badge-render.ts` or
  `src/app/api/badges/generate/route.ts` — explicitly out of scope (spec
  Section 1).
- Do not build Template card previews, Generate's live preview, or any
  Tier 2/3 screen from the full redesign brief — this plan only builds the
  renderer and the two foundational tokens (spec Section 1).
- `BadgeElementView`/`BadgeCanvas` take a `scale` prop (default `1`),
  multiplied internally into every measurement — never a CSS
  `transform: scale()` mandate on the consumer (spec Section 2a).
- Playfair Display loads scoped to the Badges module layout only (not
  globally, not as a bare Tailwind alias) — spec Section 5.
- No new test infrastructure: this repo has no React component test runner
  (`vitest.config.ts` uses `environment: "node"`, no `@testing-library/react`
  installed). Pure logic (`replacePlaceholders`, `applyTextCase`) gets
  Vitest unit tests, matching the existing pattern in
  `src/lib/badge-element-bounds.test.ts` / `src/lib/badge-pdf-font.test.ts`.
  JSX components get manual dev-server verification, matching this repo's
  own standing rule that UI changes need real browser verification.

---

### Task 1: Extract shared types

**Files:**
- Create: `src/lib/badge-template-types.ts`
- Modify: `src/app/events/[eventId]/badges/designer/page.tsx:100-107` (the
  `BADGE_SIZES` constant), `:872-914` (the `BadgeElement` interface),
  `:916-923` (the `BadgeTemplate` interface)

**Interfaces:**
- Produces: `BadgeElement`, `BadgeTemplate`, `BADGE_SIZES` — every later task
  imports these from `@/lib/badge-template-types` instead of declaring them
  locally.

- [ ] **Step 1: Create the shared types file**

```typescript
// src/lib/badge-template-types.ts
export const BADGE_SIZES: Record<string, { width: number; height: number; label: string }> = {
  "4x3": { width: 384, height: 288, label: '4" × 3"' },
  "3x4": { width: 288, height: 384, label: '3" × 4"' },
  "4x6": { width: 384, height: 576, label: '4" × 6"' },
  "3.5x2": { width: 336, height: 192, label: '3.5" × 2"' },
  "62x86": { width: 234, height: 325, label: "62mm × 86mm (Brother QL)" },
  A6: { width: 397, height: 559, label: "A6" },
}

export interface BadgeElement {
  id: string
  type: "text" | "qr_code" | "image" | "shape" | "line" | "barcode" | "photo"
  x: number
  y: number
  width: number
  height: number
  content?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: "normal" | "bold"
  fontStyle?: "normal" | "italic"
  textCase?: "none" | "uppercase" | "lowercase" | "capitalize"
  letterSpacing?: number
  lineHeight?: number
  color?: string
  backgroundColor?: string
  align?: "left" | "center" | "right"
  borderRadius?: number
  borderWidth?: number
  borderColor?: string
  opacity?: number
  locked?: boolean
  visible?: boolean
  imageUrl?: string
  zIndex: number
  lineStyle?: "solid" | "dashed" | "dotted"
  shadowEnabled?: boolean
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  rotation?: number
  shapeType?: "rectangle" | "circle" | "rounded" | "triangle"
  barcodeFormat?: "CODE128" | "CODE39" | "EAN13" | "UPC"
  gradient?: {
    enabled: boolean
    type: "linear" | "radial"
    colors: string[]
    angle?: number
  }
}

export interface BadgeTemplate {
  id: string
  name: string
  size: keyof typeof BADGE_SIZES
  backgroundColor: string
  backgroundImageUrl: string | null
  elements: BadgeElement[]
}
```

- [ ] **Step 2: Point Designer at the shared file**

In `src/app/events/[eventId]/badges/designer/page.tsx`:
1. Delete the local `BADGE_SIZES` constant (lines 100-107), the `BadgeElement`
   interface (lines 872-914), and the `BadgeTemplate` interface (lines
   916-923).
2. Add near the top of the file's imports:

```typescript
import { BADGE_SIZES, type BadgeElement, type BadgeTemplate } from "@/lib/badge-template-types"
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors (any pre-existing `any`-related errors in this file
are unrelated and already present before this change — see the "unchanged
baseline" note: run `git stash` then the same command to compare counts if
unsure).

- [ ] **Step 4: Commit**

```bash
git add src/lib/badge-template-types.ts "src/app/events/[eventId]/badges/designer/page.tsx"
git commit -m "refactor(badges): extract BadgeElement/BadgeTemplate/BADGE_SIZES to a shared lib module"
```

---

### Task 2: TDD the pure placeholder/text-case logic

**Files:**
- Create: `src/lib/badge-placeholders.ts`
- Create: `src/lib/badge-placeholders.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `replacePlaceholders(text, registration, event): string` and
  `applyTextCase(text, textCase?): string` — Task 3's `BadgeElementView`
  imports both from `@/lib/badge-placeholders`.

This is a verbatim extraction of Designer's existing `replacePlaceholders`
(`designer/page.tsx:1319-1353`, currently a `useCallback` closing over
`event`) and `applyTextCase` (`designer/page.tsx:2009-2017`), turned into
standalone pure functions that take `event` as an explicit parameter instead
of a closure variable. Behavior must match exactly — same regex
replacements, same fallback defaults.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/badge-placeholders.test.ts
import { describe, it, expect } from "vitest"
import { replacePlaceholders, applyTextCase } from "./badge-placeholders"

describe("replacePlaceholders", () => {
  it("substitutes real registration values when a registration is given", () => {
    const result = replacePlaceholders(
      "{{name}} - {{registration_number}}",
      { attendee_name: "Dr Anjali Deshmukh", registration_number: "AMASI-2026-0417" },
      undefined
    )
    expect(result).toBe("Dr Anjali Deshmukh - AMASI-2026-0417")
  })

  it("falls back to generic sample values when no registration is given", () => {
    const result = replacePlaceholders("{{name}} - {{registration_number}}", undefined, undefined)
    expect(result).toBe("John Doe - REG001")
  })

  it("substitutes the ticket type name from the nested ticket_types relation", () => {
    const result = replacePlaceholders("{{ticket_type}}", { ticket_types: { name: "Faculty" } }, undefined)
    expect(result).toBe("Faculty")
  })

  it("joins purchased addon names with a comma", () => {
    const result = replacePlaceholders(
      "{{addons}}",
      { registration_addons: [{ addons: { name: "Workshop" } }, { addons: { name: "Gala Dinner" } }] },
      undefined
    )
    expect(result).toBe("Workshop, Gala Dinner")
  })

  it("formats the event date range when both start and end dates are present", () => {
    // Mid-day UTC timestamps (not bare date-only strings) so this assertion
    // doesn't flake depending on the test runner's local timezone -- a
    // date-only string parses as UTC midnight, and toLocaleDateString
    // renders in local time, which can shift the calendar day at the
    // extremes. Noon UTC is safe across every real-world UTC offset.
    const result = replacePlaceholders(
      "{{event_date}}",
      undefined,
      { start_date: "2026-02-12T12:00:00Z", end_date: "2026-02-15T12:00:00Z" }
    )
    expect(result).toBe("12 Feb - 15 Feb, 2026")
  })

  it("falls back to a placeholder label when the event has no dates", () => {
    const result = replacePlaceholders("{{event_date}}", undefined, undefined)
    expect(result).toBe("Event Date")
  })

  it("returns an empty string for empty input", () => {
    expect(replacePlaceholders("", undefined, undefined)).toBe("")
  })
})

describe("applyTextCase", () => {
  it("uppercases when textCase is uppercase", () => {
    expect(applyTextCase("Dr Anjali", "uppercase")).toBe("DR ANJALI")
  })

  it("lowercases when textCase is lowercase", () => {
    expect(applyTextCase("Dr Anjali", "lowercase")).toBe("dr anjali")
  })

  it("capitalizes each word when textCase is capitalize", () => {
    expect(applyTextCase("dr anjali deshmukh", "capitalize")).toBe("Dr Anjali Deshmukh")
  })

  it("returns text unchanged when textCase is none or undefined", () => {
    expect(applyTextCase("Dr Anjali", "none")).toBe("Dr Anjali")
    expect(applyTextCase("Dr Anjali", undefined)).toBe("Dr Anjali")
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/badge-placeholders.test.ts`
Expected: FAIL — `Cannot find module './badge-placeholders'`

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/lib/badge-placeholders.ts
export interface BadgeRegistrationLike {
  attendee_name?: string
  registration_number?: string
  ticket_types?: { name?: string }
  attendee_email?: string
  attendee_phone?: string
  attendee_institution?: string
  attendee_designation?: string
  checkin_token?: string
  registration_addons?: { addons?: { name?: string } | null }[]
}

export interface BadgeEventLike {
  name?: string
  start_date?: string
  end_date?: string
}

export function replacePlaceholders(
  text: string,
  registration: BadgeRegistrationLike | undefined,
  event: BadgeEventLike | undefined
): string {
  if (!text) return ""
  let result = text
  result = result.replace(/\{\{name\}\}/g, registration?.attendee_name || "John Doe")
  result = result.replace(/\{\{registration_number\}\}/g, registration?.registration_number || "REG001")
  result = result.replace(/\{\{ticket_type\}\}/g, registration?.ticket_types?.name || "Delegate")
  result = result.replace(/\{\{email\}\}/g, registration?.attendee_email || "email@example.com")
  result = result.replace(/\{\{phone\}\}/g, registration?.attendee_phone || "+91 9876543210")
  result = result.replace(/\{\{institution\}\}/g, registration?.attendee_institution || "Institution")
  result = result.replace(/\{\{designation\}\}/g, registration?.attendee_designation || "Designation")
  result = result.replace(/\{\{event_name\}\}/g, event?.name || "Event Name")

  const addonNames = (registration?.registration_addons || [])
    .map((ra) => ra.addons?.name)
    .filter(Boolean)
    .join(", ")
  result = result.replace(/\{\{addons\}\}/g, addonNames || "")

  const checkinToken = registration?.checkin_token || registration?.registration_number || "TOKEN"
  result = result.replace(/\{\{checkin_token\}\}/g, checkinToken)
  const baseUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "")
  result = result.replace(/\{\{checkin_url\}\}/g, `${baseUrl}/v/${checkinToken}`)
  result = result.replace(/\{\{verify_url\}\}/g, `${baseUrl}/v/${checkinToken}`)

  if (event?.start_date && event?.end_date) {
    const start = new Date(event.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    const end = new Date(event.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    result = result.replace(/\{\{event_date\}\}/g, `${start} - ${end}`)
  } else {
    result = result.replace(/\{\{event_date\}\}/g, "Event Date")
  }
  return result
}

export function applyTextCase(text: string, textCase?: string): string {
  if (!text) return text
  switch (textCase) {
    case "uppercase": return text.toUpperCase()
    case "lowercase": return text.toLowerCase()
    case "capitalize": return text.toLowerCase().replace(/(?:^|[\s.])([a-z])/g, (match) => match.toUpperCase())
    default: return text
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/badge-placeholders.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/badge-placeholders.ts src/lib/badge-placeholders.test.ts
git commit -m "feat(badges): extract replacePlaceholders/applyTextCase as tested pure functions"
```

---

### Task 3: Build `BadgeElementView`

**Files:**
- Create: `src/components/badges/badge-element-view.tsx`

**Interfaces:**
- Consumes: `BadgeElement` from `@/lib/badge-template-types` (Task 1);
  `replacePlaceholders`, `applyTextCase`, `BadgeRegistrationLike`,
  `BadgeEventLike` from `@/lib/badge-placeholders` (Task 2).
- Produces: `BadgeElementView` component and `BadgeRenderMode` type —
  `BadgeCanvas` (Task 4) and Designer (Task 5) both import these from
  `@/components/badges/badge-element-view`.

This is a mechanical port of Designer's `elementContent()`
(`designer/page.tsx:2036-2129`) plus its `QRCodePreview`
(`designer/page.tsx:3306-3313`) and `BarcodePreview`
(`designer/page.tsx:3315-3338`) helper components, generalized from
`previewMode: boolean` to `mode: "placeholder" | "sample" | "live"` and from
`zoom` to `scale` (default `1`). The `sample` branch is new (spec Section
3): it reuses `replacePlaceholders`'s existing "no registration" fallback
path for text/barcode content, and — unlike `live`/`placeholder`, which
already always call `QRCode.toDataURL` regardless of mode today — never
calls it at all, rendering one fixed placeholder graphic instead.

- [ ] **Step 1: Write the component**

```typescript
// src/components/badges/badge-element-view.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import QRCode from "qrcode"
import JsBarcode from "jsbarcode"
import { QrCode, ImageIcon, UserCircle } from "lucide-react"
import type { BadgeElement } from "@/lib/badge-template-types"
import { replacePlaceholders, applyTextCase, type BadgeRegistrationLike, type BadgeEventLike } from "@/lib/badge-placeholders"

export type BadgeRenderMode = "placeholder" | "sample" | "live"

function getGradientStyle(el: BadgeElement): string | undefined {
  if (el.gradient?.enabled && el.gradient.colors.length >= 2) {
    if (el.gradient.type === "radial") {
      return `radial-gradient(circle, ${el.gradient.colors.join(", ")})`
    }
    return `linear-gradient(${el.gradient.angle || 0}deg, ${el.gradient.colors.join(", ")})`
  }
  return undefined
}

function QRCodeContent({ value, size, isSample }: { value: string; size: number; isSample: boolean }) {
  const [qrUrl, setQrUrl] = useState("")
  useEffect(() => {
    if (isSample) return
    QRCode.toDataURL(value || "PREVIEW", { width: size * 2, margin: 1, errorCorrectionLevel: "M" }).then(setQrUrl).catch(() => {})
  }, [value, size, isSample])
  if (isSample) {
    return (
      <div className="w-full h-full bg-white border border-dashed border-muted-foreground/40 flex items-center justify-center rounded">
        <QrCode className="h-1/2 w-1/2 text-muted-foreground/50" />
      </div>
    )
  }
  if (!qrUrl) return <div className="w-full h-full bg-muted flex items-center justify-center rounded"><QrCode className="h-6 w-6 text-muted-foreground" /></div>
  return <img src={qrUrl} alt="QR" className="w-full h-full object-contain" />
}

function BarcodeContent({ value, format, width, height }: { value: string; format: string; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format: format as string,
          width: 2,
          height: Math.max(30, height - 20),
          displayValue: true,
          fontSize: 12,
          margin: 5,
        })
      } catch {
        // Invalid barcode value
      }
    }
  }, [value, format, height])
  return (
    <div className="w-full h-full flex items-center justify-center bg-white">
      <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%" }} />
    </div>
  )
}

export interface BadgeElementViewProps {
  element: BadgeElement
  mode: BadgeRenderMode
  registration?: BadgeRegistrationLike
  event?: BadgeEventLike
  scale?: number
}

export function BadgeElementView({ element, mode, registration, event, scale = 1 }: BadgeElementViewProps) {
  const isPlaceholder = mode === "placeholder"
  const isSample = mode === "sample"

  const rawContent = isPlaceholder ? (element.content || "") : replacePlaceholders(element.content || "", registration, event)
  const content = element.type === "text" ? applyTextCase(rawContent, element.textCase) : rawContent
  const qrValue = isPlaceholder ? "PREVIEW-QR" : replacePlaceholders(element.content || "", registration, event)
  const barcodeValue = isPlaceholder ? "PREVIEW123" : replacePlaceholders(element.content || "", registration, event)

  if (element.type === "qr_code") {
    return <QRCodeContent value={qrValue} size={Math.min(element.width, element.height) * scale} isSample={isSample} />
  }
  if (element.type === "barcode") {
    return <BarcodeContent value={barcodeValue} format={element.barcodeFormat || "CODE128"} width={element.width * scale} height={element.height * scale} />
  }
  if (element.type === "photo") {
    return element.imageUrl ? (
      <img src={element.imageUrl} alt="" className="w-full h-full object-cover" style={{ borderRadius: element.borderRadius || 0, borderWidth: element.borderWidth || 0, borderColor: element.borderColor || "transparent", borderStyle: "solid" }} />
    ) : (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300" style={{ borderRadius: element.borderRadius || 0 }}>
        <UserCircle className="h-8 w-8" />
      </div>
    )
  }
  if (element.type === "shape") {
    const gradientBg = getGradientStyle(element)
    if (element.shapeType === "triangle") {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
            <polygon points="50,0 100,100 0,100" fill={element.backgroundColor || "#e5e7eb"} />
          </svg>
        </div>
      )
    }
    if (element.shapeType === "circle") {
      return (
        <div className="w-full h-full rounded-full" style={{
          backgroundColor: gradientBg ? undefined : (element.backgroundColor || "#e5e7eb"),
          backgroundImage: gradientBg,
          borderWidth: element.borderWidth || 0,
          borderColor: element.borderColor || "transparent",
          borderStyle: "solid",
        }} />
      )
    }
    return (
      <div className="w-full h-full" style={{
        backgroundColor: gradientBg ? undefined : (element.backgroundColor || "#e5e7eb"),
        backgroundImage: gradientBg,
        borderRadius: element.borderRadius || 0,
        borderWidth: element.borderWidth || 0,
        borderColor: element.borderColor || "transparent",
        borderStyle: "solid",
      }} />
    )
  }
  if (element.type === "image") {
    return element.imageUrl ? (
      <img src={element.imageUrl} alt="" className="w-full h-full object-contain" />
    ) : (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded">
        <ImageIcon className="h-6 w-6" />
      </div>
    )
  }
  if (element.type === "line") {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: element.height * scale }}>
        <div className="w-full" style={{
          height: Math.max(1, element.height) * scale,
          backgroundColor: element.color || "#000000",
          backgroundImage: element.lineStyle !== "solid"
            ? `repeating-linear-gradient(90deg, ${element.color || "#000000"} 0px, ${element.color || "#000000"} ${element.lineStyle === "dashed" ? "8px" : "2px"}, transparent ${element.lineStyle === "dashed" ? "8px" : "2px"}, transparent ${element.lineStyle === "dashed" ? "12px" : "4px"})`
            : "none",
        }} />
      </div>
    )
  }
  const shadowStyle = element.shadowEnabled ? `${element.shadowOffsetX || 2}px ${element.shadowOffsetY || 2}px ${element.shadowBlur || 4}px ${element.shadowColor || "rgba(0,0,0,0.3)"}` : "none"
  return (
    <div className="w-full h-full flex items-center overflow-hidden whitespace-pre-wrap" style={{
      fontSize: (element.fontSize || 14) * scale,
      fontFamily: element.fontFamily || "Arial, sans-serif",
      fontWeight: element.fontWeight || "normal",
      fontStyle: element.fontStyle || "normal",
      color: element.color || "#000000",
      textAlign: element.align || "left",
      justifyContent: element.align === "center" ? "center" : element.align === "right" ? "flex-end" : "flex-start",
      backgroundColor: element.backgroundColor || "transparent",
      lineHeight: element.lineHeight || 1.3,
      letterSpacing: element.letterSpacing ? `${element.letterSpacing}px` : "normal",
      textShadow: shadowStyle,
      borderWidth: element.borderWidth || 0,
      borderColor: element.borderColor || "transparent",
      borderStyle: element.borderWidth ? "solid" : "none",
      borderRadius: element.borderRadius || 0,
    }}>
      {content}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p . && npx eslint src/components/badges/badge-element-view.tsx`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/badges/badge-element-view.tsx
git commit -m "feat(badges): add shared BadgeElementView component"
```

---

### Task 4: Build `BadgeCanvas`

**Files:**
- Create: `src/components/badges/badge-canvas.tsx`

**Interfaces:**
- Consumes: `BadgeTemplate`, `BADGE_SIZES` from `@/lib/badge-template-types`
  (Task 1); `BadgeElementView`, `BadgeRenderMode` from
  `@/components/badges/badge-element-view` (Task 3).
- Produces: `BadgeCanvas` component — Designer (Task 5) imports it from
  `@/components/badges/badge-canvas` for its read-only preview mode.

This ports the background + positioned-elements composition Designer's own
preview-mode branch already does (`designer/page.tsx:2131-2145`), as a
standalone, non-interactive component any consumer can render a whole
template with.

- [ ] **Step 1: Write the component**

```typescript
// src/components/badges/badge-canvas.tsx
"use client"

import { BADGE_SIZES, type BadgeTemplate } from "@/lib/badge-template-types"
import { BadgeElementView, type BadgeRenderMode } from "./badge-element-view"
import type { BadgeRegistrationLike, BadgeEventLike } from "@/lib/badge-placeholders"

export interface BadgeCanvasProps {
  template: BadgeTemplate
  mode: BadgeRenderMode
  registration?: BadgeRegistrationLike
  event?: BadgeEventLike
  scale?: number
}

export function BadgeCanvas({ template, mode, registration, event, scale = 1 }: BadgeCanvasProps) {
  const size = BADGE_SIZES[template.size]
  return (
    <div className="relative" style={{
      width: size.width * scale,
      height: size.height * scale,
      backgroundColor: template.backgroundColor,
    }}>
      {template.backgroundImageUrl && (
        <img src={template.backgroundImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 0 }} />
      )}
      {template.elements.slice().sort((a, b) => a.zIndex - b.zIndex).map((element) => {
        const rotation = element.rotation || 0
        return (
          <div key={element.id} className="absolute" style={{
            left: element.x * scale,
            top: element.y * scale,
            width: element.width * scale,
            height: element.height * scale,
            zIndex: element.zIndex,
            opacity: (element.opacity ?? 100) / 100,
            transform: rotation ? `rotate(${rotation}deg)` : undefined,
            transformOrigin: "center center",
          }}>
            <BadgeElementView element={element} mode={mode} registration={registration} event={event} scale={scale} />
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p . && npx eslint src/components/badges/badge-canvas.tsx`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/badges/badge-canvas.tsx
git commit -m "feat(badges): add shared BadgeCanvas component"
```

---

### Task 5: Migrate Designer to the shared components

**Files:**
- Modify: `src/app/events/[eventId]/badges/designer/page.tsx`

**Interfaces:**
- Consumes: `BadgeCanvas` (Task 4), `BadgeElementView` + `BadgeRenderMode`
  (Task 3), `replacePlaceholders` + `applyTextCase` (Task 2 — only if any
  other part of `designer/page.tsx` besides `renderElement` still calls
  them directly; check before deleting the local copies).
- Produces: nothing new — this is the risk-controlled migration step from
  spec Section 4. No other task depends on Designer's internals changing.

This is the highest-risk task in this plan: it replaces working, recently
bug-fixed production code. Follow the steps in order and do not skip the
manual verification in Step 4.

- [ ] **Step 1: Replace the preview-mode branch with `BadgeCanvas`**

In `designer/page.tsx`, the canvas area currently renders
`template.elements.sort((a, b) => a.zIndex - b.zIndex).map(renderElement)`
unconditionally (around line 2637, inside the `canvasRef` div — this is
*separate* from `renderElement`'s own internal `if (previewMode)` branch).
Change the canvas body to branch explicitly:

```tsx
{previewMode ? (
  <BadgeCanvas
    template={template}
    mode="live"
    registration={currentRegistration}
    event={event}
    scale={zoom}
  />
) : (
  template.elements.sort((a, b) => a.zIndex - b.zIndex).map(renderElement)
)}
```

Add the import near the top of the file:

```typescript
import { BadgeCanvas } from "@/components/badges/badge-canvas"
import { BadgeElementView } from "@/components/badges/badge-element-view"
```

Note: `registrations`/`filteredRegistrations`/`currentRegistration` in this
file are typed loosely (`registrations?.filter((r: any) => ...)` at line
1295), so `currentRegistration` is effectively `any` and will satisfy
`BadgeCanvasProps.registration: BadgeRegistrationLike | undefined` with no
cast needed — confirmed no new type error here.

Note: `BadgeCanvas` renders its own background (color/image), so also wrap
the existing background-color/background-image JSX (the two blocks just
above `showGrid` in the same canvas div, currently always rendered) in
`{!previewMode && ( ... )}` so the background isn't rendered twice when
`BadgeCanvas` is active. Leave the grid/snap-guide/safe-area overlays exactly
as they are — those stay visible only in edit mode already (`!previewMode &&
...`), no change needed there.

- [ ] **Step 2: Replace `renderElement`'s edit-mode branch with `BadgeElementView`**

`renderElement` (currently `designer/page.tsx:2019-2188`) still handles the
non-preview (`<Rnd>`) case — this is the one path that keeps running now,
since Step 1 removed the preview-mode branch's call site. Simplify
`renderElement` to drop its own `elementContent()` closure, `rawContent`/
`content` computation, and `getGradientStyle` helper — `BadgeElementView`
now owns all of that — and render it inside the existing `<Rnd>`:

```tsx
const renderElement = (element: BadgeElement) => {
  const isSelected = selectedElementIds.includes(element.id)
  const rotation = element.rotation || 0

  return (
    <Rnd
      key={element.id}
      size={{ width: element.width * zoom, height: element.height * zoom }}
      position={{ x: element.x * zoom, y: element.y * zoom }}
      onDragStop={(e, d) => {
        const { snapX, snapY } = calculateSnapGuides(element.id, d.x / zoom, d.y / zoom, element.width, element.height)
        const clamped = clampElementToCanvas({ x: Math.round(snapX), y: Math.round(snapY), width: element.width, height: element.height }, badgeSize)
        updateElement(element.id, { x: clamped.x, y: clamped.y })
        setSnapGuides({ horizontal: [], vertical: [] })
      }}
      onDrag={(e, d) => {
        const { guides } = calculateSnapGuides(element.id, d.x / zoom, d.y / zoom, element.width, element.height)
        setSnapGuides(guides)
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        const clamped = clampElementToCanvas({
          x: Math.round(position.x / zoom),
          y: Math.round(position.y / zoom),
          width: Math.round(parseInt(ref.style.width) / zoom),
          height: Math.round(parseInt(ref.style.height) / zoom),
        }, badgeSize)
        updateElement(element.id, clamped)
      }}
      onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleElementSelect(element.id, e) }}
      onContextMenu={(e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation()
        setSelectedElementIds([element.id])
        setContextMenu({ x: e.clientX, y: e.clientY, elementId: element.id })
      }}
      bounds="parent"
      className={cn("group", isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:ring-1 hover:ring-primary/50", element.locked && "cursor-not-allowed")}
      style={{ zIndex: element.zIndex, opacity: (element.opacity ?? 100) / 100, transform: rotation ? `rotate(${rotation}deg)` : undefined, transformOrigin: "center center" }}
      enableResizing={isSelected && !element.locked}
      disableDragging={element.locked}
    >
      <BadgeElementView element={element} mode="placeholder" scale={zoom} />
      {element.locked && <div className="absolute top-1 right-1 bg-black/60 rounded p-0.5"><Lock className="h-3 w-3 text-white" /></div>}
    </Rnd>
  )
}
```

Note this is intentionally `mode="placeholder"` unconditionally now — the
function is only ever called from the non-preview branch after Step 1
(preview mode is fully handled by `BadgeCanvas` in `mode="live"` instead),
so the `previewMode ? ... : ...` branching that used to live inside
`elementContent()` no longer applies here.

- [ ] **Step 3: Delete now-dead code**

Delete from `designer/page.tsx`:
- The `applyTextCase` function (previously at `2009-2017`) — no longer
  called anywhere in this file (confirm with
  `grep -n "applyTextCase" "src/app/events/[eventId]/badges/designer/page.tsx"`
  before deleting; it should only appear in the function definition itself
  once `renderElement` no longer calls it).
- The `replacePlaceholders` `useCallback` (previously at `1319-1353`) —
  **do not delete if anything else in the file still calls it** (check with
  `grep -n "replacePlaceholders(" "src/app/events/[eventId]/badges/designer/page.tsx"`
  first — other parts of the Designer, such as the preview-navigation search
  or any other display, may still use it independent of element rendering).
  If nothing else calls it, delete it.
- The `QRCodePreview` function (previously at `3306-3313`) and
  `BarcodePreview` function (previously at `3315-3338`) — no longer called
  anywhere in this file once `elementContent()` is gone.

- [ ] **Step 4: Typecheck, lint, and manually verify in the dev server**

Run: `npx tsc --noEmit -p .`
Expected: clean (or only the same pre-existing `any`-related warnings from
before this task — compare against Task 1's baseline).

Run: `npx eslint "src/app/events/[eventId]/badges/designer/page.tsx"`
Expected: same warning/error set as before this task (no new ones
introduced by this migration).

Then start the dev server (`npm run dev`) and manually verify, on a real
event's Badge Designer:
1. Open an existing template — all 7 element types (text, qr_code, image,
   shape, line, barcode, photo) render identically to before.
2. Drag an element — moves smoothly, snap guides still appear, position
   clamps at all four edges (this is the Bug A fix from last session — must
   still work).
3. Resize an element — same clamping behavior at all edges.
4. Zoom in/out (several levels, e.g. 50%, 100%, 150%) — text stays crisp and
   correctly positioned relative to its box at every zoom level.
5. Toggle Preview mode on — canvas switches to `BadgeCanvas` rendering with
   real bound data from the selected registration; QR code encodes the real
   checkin URL (test by comparing the encoded URL pattern, or just confirm
   the QR image renders and is not a placeholder icon).
6. Toggle Preview mode off — back to interactive editing, unchanged.
7. Load 2-3 of the 30 pre-built starter templates (via Templates screen →
   "New template" → pre-built gallery) and confirm each renders correctly
   in both modes.
8. Lock icon still renders on locked elements in edit mode.

- [ ] **Step 5: Commit**

```bash
git add "src/app/events/[eventId]/badges/designer/page.tsx"
git commit -m "refactor(badges): migrate Designer to shared BadgeCanvas/BadgeElementView"
```

---

### Task 6: Scope Playfair Display to the Badges module

**Files:**
- Modify: `src/app/events/[eventId]/badges/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a `.badges-serif` CSS class — later sub-projects (Overview,
  Templates, Generate, Designer restyle) apply it to page/card titles
  within the Badges module. Not applied to any element by this task.

- [ ] **Step 1: Add the scoped font class to globals.css**

In `src/app/globals.css`, add near the existing `.register-flow` typography
rules (around line 1346):

```css
/* --- Badges module typography (scoped, not global — see
   docs/superpowers/specs/2026-08-05-badges-shared-renderer-design.md
   Section 5 for why this isn't app-wide) --- */
.badges-serif {
  font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  letter-spacing: -0.01em;
}
```

- [ ] **Step 2: Load the font, scoped to the Badges layout**

In `src/app/events/[eventId]/badges/layout.tsx`, add a Google Fonts
`<link>` as the first child of each of the three JSX trees this component
can return (the access-restricted early return around line 165, the
`isTeamUser` branch around line 184, and the main branch around line 235) —
matching the same scoped-`<link>` pattern already used in
`src/app/register/layout.tsx:41`:

```tsx
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap"
/>
```

For example, the main branch's return becomes:

```tsx
return (
  <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] -mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap"
    />
    {/* Desktop: vertical sidebar */}
    ...
```

Do the same for the other two returns (insert as the first child of the
outermost returned element in each).

- [ ] **Step 3: Typecheck and manually verify**

Run: `npx tsc --noEmit -p .`
Expected: clean.

Start the dev server, open any Badges page, open DevTools → Network, and
confirm a request to `fonts.googleapis.com` for Playfair Display fires.
Confirm no other module's pages (e.g. `/events/[eventId]/faculty`) show
this network request — the scoping must not leak.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css "src/app/events/[eventId]/badges/layout.tsx"
git commit -m "feat(badges): scope Playfair Display loading to the Badges module"
```

---

### Task 7: Add green-discipline color tokens

**Files:**
- Modify: `tailwind.config.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: Tailwind utility classes `bg-badge-success`,
  `text-badge-success`, `border-badge-success` — later sub-projects
  (Overview's conditional-escalation card, Templates' status chips) use
  these for the two terminal-success states the full brief's notes specify
  (a ticket type at 100%, and pending = 0). Not applied to any screen by
  this task.

- [ ] **Step 1: Add the token**

In `tailwind.config.ts`, inside the existing `colors` block (the same object
that already defines `border: "hsl(var(--border))"` and similar entries
around line 23), add:

```typescript
        "badge-success": {
          DEFAULT: "#16A34A",
          foreground: "#FFFFFF",
        },
```

This is a fixed, standalone token (not wired through a CSS custom property
like the existing `border`/`background` tokens, since it's intentionally
scoped to the Badges module's own discipline rule, not the app's general
theme). Later sub-projects reference it directly as
`bg-badge-success`/`text-badge-success`/`border-badge-success`.

- [ ] **Step 2: Typecheck and verify the class generates**

Run: `npx tsc --noEmit -p .`
Expected: clean (`tailwind.config.ts` is TypeScript, so this catches syntax
errors).

Run: `npm run dev`, temporarily add `className="bg-badge-success"` to any
element on any page, confirm the green renders, then remove the temporary
class — this task does not apply the token to any real UI.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(badges): add badge-success color token for the green-discipline rule"
```

---

### Task 8: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the 11 new tests from Task 2.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 3: Lint the touched/created files**

Run:
```bash
npx eslint src/lib/badge-template-types.ts src/lib/badge-placeholders.ts \
  src/components/badges/badge-element-view.tsx src/components/badges/badge-canvas.tsx \
  "src/app/events/[eventId]/badges/designer/page.tsx" \
  "src/app/events/[eventId]/badges/layout.tsx" tailwind.config.ts
```
Expected: no new errors/warnings versus the pre-existing baseline in
`designer/page.tsx` (that file has known pre-existing `any`/`img`-element
warnings unrelated to this work — see Task 1's baseline note).

- [ ] **Step 4: Re-run the Task 5 manual dev-server checklist once more, end to end**

This confirms nothing in Tasks 6-7 (font loading, Tailwind config change)
regressed the Designer.

- [ ] **Step 5: Update the spec's deliverable checklist**

In `docs/superpowers/specs/2026-08-05-badges-shared-renderer-design.md`
Section 6, check off every completed item.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-08-05-badges-shared-renderer-design.md
git commit -m "docs(badges): mark sub-project A deliverables complete"
```
