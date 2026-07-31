# Print Station Printer Type Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing "Printer type" admin setting to a print station's config (spec item §3.1: "Thermal (fast, no dialog)" or "Any other printer (browser print)"), closing a real existing bug in the same motion: two separate admin pages already filter kiosk-station printer pickers by `print_settings.printer_type === "usb"`, but no UI has ever set that field — every print station created through the real form has been invisible in that picker.

**Architecture:** `print_stations.print_settings` is an existing jsonb column that already has a `printer_type` key used elsewhere in the codebase (`"browser" | "zebra" | "thermal" | "usb"`, per `/print/[token]/page.tsx`'s type) — no migration needed. This task only adds the missing admin form control that sets it, using the exact two values the kiosk flow's existing filters already expect (`"usb"` for thermal/WebUSB, `"browser"` for the future browser-print fallback).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, TanStack Query — same as the rest of this codebase.

## Global Constraints

- Do not touch `/print/[token]/page.tsx` (the separate, older volunteer-facing print page) — explicitly out of scope per the project owner ("leave it alone for now").
- Do not touch the kiosk print-trigger code path (`KioskCheckinScreen.tsx`'s `printBadge`, `usb-printer.ts`, `escpos-printer.ts`) — this task only captures the *setting*; actually branching print behavior on it (the browser-print fallback / "Path B") is separate, later work.
- Default the new field to `"usb"` for both new and existing stations — this preserves the exact current behavior (every station acts as a thermal/WebUSB station, matching what the whole kiosk flow already assumes) for every station that predates this field.
- Do not add a "Zebra"/"custom paper size"/any other option beyond the two the spec names. Do not touch the existing Paper Size or Print Mode (blank vs. pre-printed) fields — both already satisfy the spec's other two settings and are out of scope for this task.
- `npx tsc --noEmit` and `npx vitest run` must stay clean.

---

### Task 1: Printer Type field in the print station admin form

**Files:**
- Modify: `src/app/events/[eventId]/print-stations/page.tsx`

**Interfaces:**
- Consumes: nothing new — `print_settings` is already an untyped jsonb column, and the existing `PUT`/`POST /api/print-stations` routes already accept any `print_settings` shape from the client without an explicit field allowlist (confirmed: `POST` spreads a fixed object into `.insert()`, `PUT` spreads `...updates` directly into `.update()` — no server-side change needed).
- Produces: `print_settings.printer_type: "usb" | "browser"` on every station saved through this form going forward.

- [ ] **Step 1: Add form state**

Near the other `form*` state declarations (`formPaperSize`, `formOrientation`, etc., around line 115), add:

```ts
  const [formPrinterType, setFormPrinterType] = useState<"usb" | "browser">("usb")
```

- [ ] **Step 2: Add to `resetForm`**

Find `resetForm` (around line 298) and add, alongside the other `setForm*` calls:

```ts
    setFormPrinterType("usb")
```

- [ ] **Step 3: Add to `openEditModal`**

Find `openEditModal` (around line 316) and add, alongside `setFormPaperSize(station.print_settings?.paper_size || "4x6")`:

```ts
    setFormPrinterType(station.print_settings?.printer_type === "browser" ? "browser" : "usb")
```

(Explicit `=== "browser"` check rather than a bare fallback, so any unexpected/legacy value in the jsonb — e.g. `"zebra"` from the older volunteer-facing page — safely defaults to `"usb"` rather than silently becoming an invalid third state in this form.)

- [ ] **Step 4: Add to `handleSubmit`'s `print_settings` object**

Find the `print_settings` object inside `handleSubmit` (around line 344):

```ts
      print_settings: {
        paper_size: formPaperSize,
        orientation: formOrientation,
        rotation: formRotation,
        printer_ip: formPrinterIp || null,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        scale: 100,
        copies: 1
      },
```

Add `printer_type: formPrinterType,` as a new key:

```ts
      print_settings: {
        paper_size: formPaperSize,
        orientation: formOrientation,
        rotation: formRotation,
        printer_ip: formPrinterIp || null,
        printer_type: formPrinterType,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        scale: 100,
        copies: 1
      },
```

- [ ] **Step 5: Add the form UI**

Find the `grid grid-cols-3 gap-4` block containing Paper Size / Orientation / Rotation (around line 801-838). Immediately before that grid, add a new field:

```tsx
              <div>
                <label className="block text-sm font-semibold mb-2">Printer Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormPrinterType("usb")}
                    className={`text-left rounded-xl border-2 p-4 transition-all ${
                      formPrinterType === "usb"
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-border hover:border-purple-500/40"
                    }`}
                  >
                    <p className="font-medium">Thermal</p>
                    <p className="text-xs text-muted-foreground mt-1">Fast, no dialog. USB-connected thermal label/badge printer.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormPrinterType("browser")}
                    className={`text-left rounded-xl border-2 p-4 transition-all ${
                      formPrinterType === "browser"
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-border hover:border-purple-500/40"
                    }`}
                  >
                    <p className="font-medium">Any other printer</p>
                    <p className="text-xs text-muted-foreground mt-1">Goes through the browser&apos;s print dialog. Works with laser, inkjet, or network printers.</p>
                  </button>
                </div>
              </div>

```

(Matches this same file's existing button-pair visual pattern used elsewhere in the form, e.g. the Print Mode cards — `border-2`, active state `border-purple-500 bg-purple-500/10`.)

- [ ] **Step 6: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Manually confirm on the dev server or live: creating a new print station now defaults to "Thermal" selected; editing an existing station without this field set (e.g. the current "Badge Print Station USB (Test)") still shows "Thermal" selected (back-compat default); saving persists the choice; the kiosk-station admin's printer picker (`src/app/events/[eventId]/kiosk-stations/page.tsx` and its `[stationId]` detail page) still correctly lists stations with `printer_type: "usb"` and now would also correctly *exclude* a station explicitly set to `"browser"` (expected — that station isn't a WebUSB target yet, since the browser-print fallback itself isn't built).

- [ ] **Step 7: Commit**

```bash
git add "src/app/events/[eventId]/print-stations/page.tsx"
git commit -m "feat(print-stations): add Printer Type admin setting (thermal vs any other/browser)"
```

---

### Task 2: Review + live verify

- [ ] Dispatch a task review of the diff (single file, well-specified — one review pass is sufficient, no separate final-whole-branch review needed for a change this size).
- [ ] Live-verify on collegeofmas.org.in: edit the existing "Badge Print Station USB (Test)" station, confirm it shows "Thermal" pre-selected (matching its already-`usb` printer_type), save with no changes, confirm it still appears in a kiosk station's printer picker afterward (regression check — saving must not accidentally blank the field). Then create a brand new test print station, leave Printer Type on its default (Thermal), save, and confirm it now appears as a selectable option in the kiosk-station admin's printer picker — the exact bug this task fixes.
- [ ] Merge, push, confirm the Vercel production deploy succeeds.
