# Kiosk Path B (Browser Print Fallback) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Path B from `docs/superpowers/specs/2026-07-31-badge-printing-admin-configured-design.md` §2: for a print station configured as `printer_type: "browser"` (added in the P8 admin-setting task), render the badge as a correctly-sized HTML page and print it via the browser's own print dialog (`window.print()`) instead of raw ESC/POS over WebUSB — so any printer the device already knows about (laser, inkjet, network) works, not just a WebUSB thermal label printer.

**Architecture:** No new rendering pipeline is needed. `src/lib/badge-render.ts`'s existing `generatePrintContent()` — already shared with the Path A (thermal) branch inside `printBadge` — already produces a complete HTML document with correct `@page` CSS sizing from `paper_size`/`orientation` (confirmed: lines 244, 306 of that file). Path A currently extracts just the `<body>` inner HTML from that document to rasterize via `html2canvas` for a WebUSB send; Path B instead writes the FULL document into a hidden `<iframe>` and calls `iframe.contentWindow.print()` — the exact same technique already proven and shipped in the older `src/app/print/[token]/page.tsx`'s own browser-print branch (`triggerPrint`, using a hidden iframe specifically because `window.open()`-based printing is blocked on iPad Safari). `printBadge` branches on `printer_type` immediately after the offline-cached template loads; everything upstream (QR pre-generation, image substitution, `generatePrintContent` itself) is identical for both paths and untouched by this plan.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript — same as the rest of this codebase.

## Global Constraints

- Do not touch `/print/[token]/page.tsx` — out of scope per the project owner, unchanged from prior phases. It is referenced here only as a proven pattern to copy, never edited.
- Do not touch `src/lib/usb-printer.ts` or `src/lib/escpos-printer.ts` — Path A's WebUSB/ESC-POS pipeline is completely unchanged; Path B is purely additive, selected only when `printer_type === "browser"`.
- Do not touch `src/lib/badge-render.ts` — `generatePrintContent`/`getPaperDimensions` already produce everything Path B needs; this plan only calls them, never modifies them.
- **Design decision made in this plan, not explicitly detailed in the spec** (the spec's §4 volunteer-view wording assumes a physical USB cable throughout, which doesn't literally apply to Path B): a `printer_type: "browser"` station still shows the printer setup screen (a volunteer still benefits from confirming the OS print pipeline works before a delegate is standing there), but with no "Connect Printer" step at all — there is no persistent USB pairing to establish, so the screen goes straight to "Test Print", using the exact same Yes/No confirmation already built for Path A (spec's "bytes leaving is not proof" principle applies here too — an OS print dialog appearing is not proof paper came out either). This is a judgment call; flag it to the project owner for confirmation after this ships, alongside the live-verify results.
- `printer_type` is read from `printSettings` (the top-level, SSR-provided prop, synchronously available at render time — used for render-time/effect-gating decisions) and separately from `template.printSettings` (the offline-cached copy from `getPrintTemplate`, used for the actual print action inside `printBadge`, since that function must work fully offline). Both trace to the same `print_stations.print_settings` column; this two-tier split already exists in the file for every other print setting and is not a new pattern.
- `npx tsc --noEmit` and `npx vitest run` must stay clean after every task.

---

### Task 1: `src/lib/browser-print.ts` — shared print-via-iframe helper

**Files:**
- Create: `src/lib/browser-print.ts`

**Interfaces:**
- Produces: `printHtmlViaBrowser(html: string): { success: boolean; error?: string }` and `buildBrowserTestPageHtml(eventName: string): string`, both consumed by Task 2 and Task 3.

- [ ] **Step 1: Write the module**

```ts
// Path B (Badge Printing Admin Configured spec, §2): renders a full HTML
// page and calls the browser's own print(), going through the OS print
// dialog so it works with any printer the device already knows about
// (laser, inkjet, network) instead of raw ESC/POS over WebUSB. Uses a
// hidden iframe rather than window.open -- window.open-based printing is
// blocked on iPad Safari, the exact same reason src/app/print/[token]/page.tsx's
// own browser-print branch already uses this technique.
export function printHtmlViaBrowser(html: string): { success: boolean; error?: string } {
  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "0"
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return { success: false, error: "Could not prepare the print page." }
  }

  doc.open()
  doc.write(html)
  doc.close()

  // Give fonts/images inside the badge a moment to load before printing --
  // mirrors the 400ms wait already used before html2canvas's Path A render.
  setTimeout(() => {
    try {
      iframe.contentWindow?.print()
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe)
      }, 2000)
    }
  }, 400)

  return { success: true }
}

// A minimal, deliberately non-badge test page -- Test Print on a
// printer_type: "browser" station just needs to confirm the OS print
// dialog appears and something physically comes out, not exercise the
// real badge template.
export function buildBrowserTestPageHtml(eventName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<style>
  @page { margin: 0.5in; }
  body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  p { font-size: 16px; color: #444; }
</style>
</head>
<body>
  <h1>TEST PRINT</h1>
  <p>${eventName}</p>
  <p>Browser print — ${new Date().toLocaleString()}</p>
</body>
</html>`
}
```

- [ ] **Step 2: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.

- [ ] **Step 3: Commit**

```bash
git add src/lib/browser-print.ts
git commit -m "feat(kiosk): add browser-print-via-iframe helper for Path B"
```

---

### Task 2: `printBadge` branches on `printer_type`

**Files:**
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx`

**Interfaces:**
- Consumes: `printHtmlViaBrowser` from Task 1.
- Consumes: `template.printSettings?.printer_type` (already present on every cached template — it's the same jsonb column the P8 admin setting writes to; no offline-store schema change needed since the whole `print_settings` object is already cached as-is, confirmed via `getPrintTemplate`'s existing shape).

The isUsbPrinterConnected() fast-fail currently runs BEFORE the template loads. This task reorders it to run after (guarded to skip entirely for `printer_type === "browser"`, which has no persistent connection to check), since printer type is only known once the template is available offline.

- [ ] **Step 1: Move the fast-fail check and add the printer-type branch**

Find the start of `printBadge` (the exact current code):

```ts
  const printBadge = useCallback(async (registration: NonNullable<CheckinResult["registration"]>) => {
    setLastPrintedRegistration(registration)
    setPrinting(true)
    setPrintStatus(null)
    try {
      // Cheapest possible check first, before any rendering work: if the
      // printer isn't actually connected (unplugged, reset, or the reconnect
      // on mount never found it), fail fast with a clear message instead of
      // doing a full QR-gen + html2canvas render that's guaranteed to be
      // thrown away.
      const { isUsbPrinterConnected } = await import("@/lib/usb-printer")
      if (!isUsbPrinterConnected()) {
        setPrintStatus({ success: false, message: "Printer not connected — tap Connect Printer first." })
        return
      }

      const template = await getPrintTemplate(listId)
      if (!template) {
```

Replace it with:

```ts
  const printBadge = useCallback(async (registration: NonNullable<CheckinResult["registration"]>) => {
    setLastPrintedRegistration(registration)
    setPrinting(true)
    setPrintStatus(null)
    try {
      const template = await getPrintTemplate(listId)
      if (!template) {
```

(This moves the template fetch above the printer check — the two `if (!template)` bodies below are otherwise unchanged.)

Immediately after the existing `if (!template) { ... return }` block (right before the `const badgeTemplate = template.badgeTemplate` line), insert:

```ts
      const printerType = template.printSettings?.printer_type === "browser" ? "browser" : "usb"

      // Cheapest possible check first, before any rendering work, for Path A
      // only -- Path B has no persistent WebUSB connection to check.
      if (printerType !== "browser") {
        const { isUsbPrinterConnected } = await import("@/lib/usb-printer")
        if (!isUsbPrinterConnected()) {
          setPrintStatus({ success: false, message: "Printer not connected — tap Connect Printer first." })
          return
        }
      }

```

- [ ] **Step 2: Add the Path B branch after `generatePrintContent`**

Find:

```ts
      const { generatePrintContent, getPaperDimensions } = await import("@/lib/badge-render")
      const printContent = generatePrintContent({
        registration,
        printSettings: template.printSettings,
        printMode: template.printMode || "full_badge",
        badgeTemplate: { ...badgeTemplate, template_data: { ...badgeTemplate.template_data, elements: resolvedElements } },
        eventName: template.eventName || "",
      })

      const dim = getPaperDimensions(template.printSettings?.paper_size || "4x6", template.printSettings?.orientation || "portrait")
```

Insert a new block between the `generatePrintContent` call and the `getPaperDimensions` line:

```ts
      const { generatePrintContent, getPaperDimensions } = await import("@/lib/badge-render")
      const printContent = generatePrintContent({
        registration,
        printSettings: template.printSettings,
        printMode: template.printMode || "full_badge",
        badgeTemplate: { ...badgeTemplate, template_data: { ...badgeTemplate.template_data, elements: resolvedElements } },
        eventName: template.eventName || "",
      })

      if (printerType === "browser") {
        // Path B: printContent is already a full HTML document, correctly
        // sized via @page CSS (getPaperDimensions/generatePrintContent) --
        // no canvas rasterization or WebUSB needed, just the OS print
        // dialog. Zero network calls, matches the offline-first
        // requirement identically to Path A.
        const { printHtmlViaBrowser } = await import("@/lib/browser-print")
        const result = printHtmlViaBrowser(printContent)
        await recordPrintOutcome(
          { print_id: newId(), list_id: listId, registration_id: registration.id, printed_at: Date.now() },
          result.success ? "success" : "failed"
        )
        setPrintStatus(
          result.success
            ? { success: true, message: "Sent to printer." }
            : { success: false, message: result.error || "Could not open the print dialog." }
        )
        return
      }

      const dim = getPaperDimensions(template.printSettings?.paper_size || "4x6", template.printSettings?.orientation || "portrait")
```

Everything below this (the `container` div creation through the end of the function) is untouched — it only ever runs for `printerType !== "browser"` now.

- [ ] **Step 3: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Manually confirm on the dev server: configure a test print station with `printer_type: "browser"` (already possible via the P8 admin UI), attach it to a checkin_and_print kiosk station, check in a delegate, and confirm the OS print dialog opens with the badge preview at the correct physical size (matching the station's configured paper size) instead of anything WebUSB-related happening.

- [ ] **Step 4: Commit**

```bash
git add src/components/kiosk/KioskCheckinScreen.tsx
git commit -m "feat(kiosk): printBadge Path B — render+window.print() for printer_type=browser stations"
```

---

### Task 3: Printer setup screen — browser-type variant (no Connect step)

**Files:**
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx`

**Interfaces:**
- Consumes: `printHtmlViaBrowser`, `buildBrowserTestPageHtml` from Task 1.
- Produces: a `printerType: "usb" | "browser"` prop on `PrinterSetupScreenProps`, computed once in the parent component from the top-level `printSettings` prop.

- [ ] **Step 1: Compute `printerType` in the component body**

Near the top of `KioskCheckinScreen` (right after `const supabase = createClient()`), add:

```ts
  // Render-time / effect-gating printer type -- from the top-level SSR
  // prop (always synchronously available), NOT the offline-cached
  // template (which only resolves async inside printBadge itself). Both
  // trace to the same print_stations.print_settings column.
  const printerType: "usb" | "browser" = printSettings?.printer_type === "browser" ? "browser" : "usb"
```

- [ ] **Step 2: Skip the WebUSB effect entirely for browser type**

Find:

```ts
  useEffect(() => {
    if (mode !== "checkin_and_print") {
      setCheckingPrinter(false)
      return
    }
```

Replace with:

```ts
  useEffect(() => {
    if (mode !== "checkin_and_print" || printerType === "browser") {
      setCheckingPrinter(false)
      return
    }
```

Add `printerType` to this effect's dependency array — find `}, [mode])` immediately following this effect's body and replace with `}, [mode, printerType])`.

- [ ] **Step 3: Branch `handleTestPrint` on `printerType`**

Find:

```ts
  const handleTestPrint = useCallback(async () => {
    setTestPrinting(true)
    setTestPrintStatus(null)
    setPrinterVerified(false)
    try {
      const { testUsbPrinter } = await import("@/lib/usb-printer")
      const res = await testUsbPrinter()
      if (res.success) {
```

Replace with:

```ts
  const handleTestPrint = useCallback(async () => {
    setTestPrinting(true)
    setTestPrintStatus(null)
    setPrinterVerified(false)
    try {
      if (printerType === "browser") {
        const { printHtmlViaBrowser, buildBrowserTestPageHtml } = await import("@/lib/browser-print")
        const res = printHtmlViaBrowser(buildBrowserTestPageHtml(event?.short_name || event?.name || "Event"))
        if (res.success) {
          setAwaitingPrintConfirm(true)
        } else {
          setTestPrintStatus({ success: false, message: res.error || "Could not open the print dialog." })
        }
        return
      }
      const { testUsbPrinter } = await import("@/lib/usb-printer")
      const res = await testUsbPrinter()
      if (res.success) {
```

Update this callback's dependency array — find the closing `}, [])` for `handleTestPrint` and replace with `}, [printerType, event?.short_name, event?.name])`.

- [ ] **Step 4: Pass `printerType` into `PrinterSetupScreen`**

Find the `<PrinterSetupScreen ... />` invocation and add `printerType={printerType}` alongside the existing `contactPhone={contactPhone}` line.

- [ ] **Step 5: Update `PrinterSetupScreenProps` and the component's rendering**

Add to `PrinterSetupScreenProps` (alongside `contactPhone?: string | null`):

```ts
  printerType: "usb" | "browser"
```

Add `printerType` to `PrinterSetupScreen`'s destructured parameters (alongside `contactPhone`).

Find the status-row block:

```tsx
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-300">Status</span>
              {checking ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                    !printerConnected ? "text-gray-400" : printerVerified ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      !printerConnected ? "bg-gray-500" : printerVerified ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                  {!printerConnected
                    ? "Not connected"
                    : printerVerified
                      ? `${printerName || "Printer"} — verified`
                      : "Connected — not tested"}
                </span>
              )}
            </div>

            {!usbSupported && !checking && (
              <p className="text-xs text-amber-400">
                This browser can&apos;t connect to a printer over USB. Use Chrome or Edge, or skip and print
                elsewhere.
              </p>
            )}

            {usbSupported && (
```

Replace with:

```tsx
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-300">Status</span>
              {checking ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
                </span>
              ) : printerType === "browser" ? (
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${printerVerified ? "text-emerald-400" : "text-gray-400"}`}>
                  <span className={`size-1.5 rounded-full ${printerVerified ? "bg-emerald-400" : "bg-gray-500"}`} />
                  {printerVerified ? "Verified" : "Not tested yet"}
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                    !printerConnected ? "text-gray-400" : printerVerified ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      !printerConnected ? "bg-gray-500" : printerVerified ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                  {!printerConnected
                    ? "Not connected"
                    : printerVerified
                      ? `${printerName || "Printer"} — verified`
                      : "Connected — not tested"}
                </span>
              )}
            </div>

            {printerType !== "browser" && !usbSupported && !checking && (
              <p className="text-xs text-amber-400">
                This browser can&apos;t connect to a printer over USB. Use Chrome or Edge, or skip and print
                elsewhere.
              </p>
            )}

            {printerType === "browser" && (
              awaitingPrintConfirm ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-300 text-center">Did a badge come out?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-12 bg-transparent border-white/15 text-white hover:bg-white/10 hover:text-white"
                      onClick={() => onConfirmTestPrint(false)}
                    >
                      No
                    </Button>
                    <Button className="h-12" onClick={() => onConfirmTestPrint(true)}>
                      Yes
                    </Button>
                  </div>
                </div>
              ) : (
                <Button className="w-full h-12" onClick={onTestPrint} disabled={testPrinting}>
                  {testPrinting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Test Print
                </Button>
              )
            )}

            {printerType === "usb" && usbSupported && (
```

(The trailing `{usbSupported && (` line's matching closing `)}` for that whole Path A block does not change — only its opening condition gains the `printerType === "usb" &&` prefix.)

- [ ] **Step 6: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Manually confirm: a `printer_type: "browser"` station's printer setup screen shows no "Connect Printer" button and no WebUSB-unsupported warning, goes straight to a single "Test Print" button, and the Yes/No confirmation + Continue button behave identically to Path A.

- [ ] **Step 7: Commit**

```bash
git add src/components/kiosk/KioskCheckinScreen.tsx
git commit -m "feat(kiosk): printer setup screen skips Connect step for printer_type=browser stations"
```

---

### Task 4: Idle screen and success screen — `printerType`-aware print affordances

**Files:**
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx`

Both the idle-screen footer chip (fixed for Path A in the prior plan) and the success screen's inline Connect/Print button are gated on `usbSupported`, which is never set `true` for a `printer_type: "browser"` station (Task 3 skips that whole effect) — without this task, a browser-type station would show no printer status at all and no way to manually print/reprint from the success screen.

- [ ] **Step 1: Idle-screen footer chip**

Find (as fixed in the prior plan):

```tsx
          {mode === "checkin_and_print" && usbSupported && (
            <span className={`inline-flex items-center gap-1 ${printerConnected && printerVerified ? "text-emerald-400" : "text-red-400"}`}>
              <span className={`size-1.5 rounded-full ${printerConnected && printerVerified ? "bg-emerald-400" : "bg-red-400"}`} />
              {printerConnected && printerVerified ? "Printer ready" : "Printer problem — call for help"}
            </span>
          )}
```

Replace with:

```tsx
          {mode === "checkin_and_print" && (usbSupported || printerType === "browser") && (
            <span className={`inline-flex items-center gap-1 ${(printerType === "browser" ? printerVerified : printerConnected && printerVerified) ? "text-emerald-400" : "text-red-400"}`}>
              <span className={`size-1.5 rounded-full ${(printerType === "browser" ? printerVerified : printerConnected && printerVerified) ? "bg-emerald-400" : "bg-red-400"}`} />
              {(printerType === "browser" ? printerVerified : printerConnected && printerVerified) ? "Printer ready" : "Printer problem — call for help"}
            </span>
          )}
```

- [ ] **Step 2: Success screen's inline print button**

Find:

```tsx
                  {mode === "checkin_and_print" && usbSupported && !(printStatus && !printStatus.success) && (
                    !printerConnected ? (
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-transparent border-white/15 text-white hover:bg-white/10 hover:text-white"
                        onClick={handleConnectPrinter}
                      >
                        Connect Printer
                      </Button>
                    ) : (
```

Replace with:

```tsx
                  {mode === "checkin_and_print" && (usbSupported || printerType === "browser") && !(printStatus && !printStatus.success) && (
                    printerType !== "browser" && !printerConnected ? (
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-transparent border-white/15 text-white hover:bg-white/10 hover:text-white"
                        onClick={handleConnectPrinter}
                      >
                        Connect Printer
                      </Button>
                    ) : (
```

(The `else` branch — the "Print Badge" button calling `handlePrintButtonClick` — is unchanged; it already works for both types since `printBadge` itself branches internally.)

- [ ] **Step 3: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Manually confirm: on a `printer_type: "browser"` station, the idle screen shows the "Printer ready"/"Printer problem" chip (driven by `printerVerified` alone), and the success screen shows a "Print Badge" button directly (no "Connect Printer" gate).

- [ ] **Step 4: Commit**

```bash
git add src/components/kiosk/KioskCheckinScreen.tsx
git commit -m "feat(kiosk): make idle/success-screen print affordances printer_type-aware"
```

---

### Task 5: Final review + live verify + deploy

- [ ] Review the combined diff across all four tasks together (they all touch the same file and the same `printerType` value — a combined pass catches inconsistencies a per-task review would miss).
- [ ] Fix any findings.
- [ ] Live-verify on collegeofmas.org.in: configure a test print station as `printer_type: "browser"` (or confirm an existing one), link it to a `checkin_and_print` kiosk station, and confirm end-to-end: printer setup screen has no Connect step, Test Print opens the OS print dialog with the Yes/No confirmation, Continue reaches the scan screen, a real check-in opens the OS print dialog with the badge at the correct physical size, the idle screen's status chip and success screen's Print Badge button both work without any WebUSB involvement.
- [ ] Merge, push, confirm the Vercel production deploy succeeds.
- [ ] Flag the printer-setup-screen design decision (Global Constraints) to the project owner explicitly, since it wasn't spelled out in the spec.
