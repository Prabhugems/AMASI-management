# Printer Test-Print Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a real gap found during live hardware testing of the printer setup screen: "Test page sent" was reported as success purely because the USB `transferOut` call succeeded — but that only proves bytes left the tablet, not that a badge actually printed (confirmed live: an HP LaserJet accepted the exact same ESC/POS bytes and produced nothing). Require the volunteer to confirm with their own eyes.

**Architecture:** All changes live in `src/components/kiosk/KioskCheckinScreen.tsx`, inside the printer-setup-screen work from earlier today. Add a `printerVerified` boolean that is only ever set `true` by an explicit "Yes, a badge came out" tap — never by a successful USB transfer alone.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind — same as the rest of this codebase.

## Global Constraints

- No change to the actual print-trigger logic on the success screen (`printBadge`, `handlePrintButtonClick`, the auto-print effect) — this is scoped entirely to the setup screen's own test-print step.
- No device-identification/allowlist work (explicitly deferred by the project owner — "if that isn't reliable, skip it, the confirmation catches it anyway"). Do not add any vendor/product ID matching.
- The setup screen must stay skippable — Continue must always work regardless of `printerVerified`.
- `npx tsc --noEmit` and `npx vitest run` must stay clean.

---

### Task 1: Yes/No confirmation after Test Print

**Files:**
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx`

**Interfaces:**
- Produces: `PrinterSetupScreen` gains three new props (`printerVerified: boolean`, `awaitingPrintConfirm: boolean`, `onConfirmTestPrint: (badgePrinted: boolean) => void`) — internal to this file, no external consumers.

- [ ] **Step 1: Add new state**

Near the existing `testPrinting`/`testPrintStatus` state declarations, add:

```ts
  const [printerVerified, setPrinterVerified] = useState(false)
  const [awaitingPrintConfirm, setAwaitingPrintConfirm] = useState(false)
```

- [ ] **Step 2: Reset verification on every fresh connect attempt**

In `handleConnectPrinter`, add two lines right after the existing `setPrintStatus(null)`:

```ts
  const handleConnectPrinter = useCallback(async () => {
    setPrintStatus(null)
    setPrinterVerified(false)
    setAwaitingPrintConfirm(false)
    const { connectUsbPrinter } = await import("@/lib/usb-printer")
    const res = await connectUsbPrinter()
    if (res.success) {
      setPrinterConnected(true)
      setPrinterName(res.name || null)
    } else {
      setPrintStatus({ success: false, message: res.error || "Connection failed" })
    }
  }, [])
```

(A fresh Connect/Reconnect might be a different physical device than whatever was last verified — don't carry a stale "verified" claim forward.)

- [ ] **Step 3: Replace `handleTestPrint` and add `handleConfirmTestPrint`**

Find the current `handleTestPrint`:

```ts
  const handleTestPrint = useCallback(async () => {
    setTestPrinting(true)
    setTestPrintStatus(null)
    try {
      const { testUsbPrinter } = await import("@/lib/usb-printer")
      const res = await testUsbPrinter()
      setTestPrintStatus(
        res.success ? { success: true, message: "Test page sent." } : { success: false, message: res.error || "Test print failed." }
      )
    } finally {
      setTestPrinting(false)
    }
  }, [])
```

Replace it with:

```ts
  const handleTestPrint = useCallback(async () => {
    setTestPrinting(true)
    setTestPrintStatus(null)
    setPrinterVerified(false)
    try {
      const { testUsbPrinter } = await import("@/lib/usb-printer")
      const res = await testUsbPrinter()
      if (res.success) {
        // Bytes leaving the USB port successfully is not proof a badge
        // actually printed -- a non-thermal printer, or a thermal printer
        // with no paper loaded, accepts the exact same bytes and produces
        // nothing. Confirmed live: an HP LaserJet reported "sent" and
        // printed nothing. Ask the volunteer to confirm with their own
        // eyes before this printer is considered ready.
        setAwaitingPrintConfirm(true)
      } else {
        setTestPrintStatus({ success: false, message: res.error || "Test print failed." })
      }
    } finally {
      setTestPrinting(false)
    }
  }, [])

  const handleConfirmTestPrint = useCallback((badgePrinted: boolean) => {
    setAwaitingPrintConfirm(false)
    if (badgePrinted) {
      setPrinterVerified(true)
      setTestPrintStatus({ success: true, message: "Printer verified." })
    } else {
      setPrinterVerified(false)
      setTestPrintStatus({ success: false, message: "No badge came out — check the printer and try again." })
    }
  }, [])
```

- [ ] **Step 4: Update the `PrinterSetupScreen` call site**

Find:

```tsx
      <PrinterSetupScreen
        eventName={event?.short_name || event?.name}
        stationName={stationName}
        listName={listName || "this list"}
        checking={checkingPrinter}
        usbSupported={usbSupported}
        printerConnected={printerConnected}
        printerName={printerName}
        onConnect={handleConnectPrinter}
        connectStatus={printStatus}
        onTestPrint={handleTestPrint}
        testPrinting={testPrinting}
        testPrintStatus={testPrintStatus}
        onContinue={() => {
          setPrintStatus(null)
          setPrinterSetupDone(true)
        }}
        isOnline={isOnline}
      />
```

Add `printerVerified`, `awaitingPrintConfirm`, and `onConfirmTestPrint` (placed logically alongside the other printer props):

```tsx
      <PrinterSetupScreen
        eventName={event?.short_name || event?.name}
        stationName={stationName}
        listName={listName || "this list"}
        checking={checkingPrinter}
        usbSupported={usbSupported}
        printerConnected={printerConnected}
        printerVerified={printerVerified}
        printerName={printerName}
        onConnect={handleConnectPrinter}
        connectStatus={printStatus}
        onTestPrint={handleTestPrint}
        testPrinting={testPrinting}
        awaitingPrintConfirm={awaitingPrintConfirm}
        onConfirmTestPrint={handleConfirmTestPrint}
        testPrintStatus={testPrintStatus}
        onContinue={() => {
          setPrintStatus(null)
          setPrinterSetupDone(true)
        }}
        isOnline={isOnline}
      />
```

- [ ] **Step 5: Update `PrinterSetupScreenProps` and the component's destructuring**

Find:

```ts
interface PrinterSetupScreenProps {
  eventName?: string
  stationName?: string
  listName: string
  checking: boolean
  usbSupported: boolean
  printerConnected: boolean
  printerName: string | null
  onConnect: () => void
  connectStatus: { success: boolean; message: string } | null
  onTestPrint: () => void
  testPrinting: boolean
  testPrintStatus: { success: boolean; message: string } | null
  onContinue: () => void
  isOnline: boolean
}
```

Add three fields (`printerVerified` after `printerConnected`, `awaitingPrintConfirm` and `onConfirmTestPrint` after `testPrinting`):

```ts
interface PrinterSetupScreenProps {
  eventName?: string
  stationName?: string
  listName: string
  checking: boolean
  usbSupported: boolean
  printerConnected: boolean
  printerVerified: boolean
  printerName: string | null
  onConnect: () => void
  connectStatus: { success: boolean; message: string } | null
  onTestPrint: () => void
  testPrinting: boolean
  awaitingPrintConfirm: boolean
  onConfirmTestPrint: (badgePrinted: boolean) => void
  testPrintStatus: { success: boolean; message: string } | null
  onContinue: () => void
  isOnline: boolean
}
```

Find the function's destructured parameters (`function PrinterSetupScreen({ eventName, stationName, listName, checking, usbSupported, printerConnected, printerName, onConnect, connectStatus, onTestPrint, testPrinting, testPrintStatus, onContinue, isOnline }: PrinterSetupScreenProps)`) and add the same three new names in the same positions.

- [ ] **Step 6: Update the status row to distinguish "connected" from "verified"**

Find:

```tsx
              {checking ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold ${printerConnected ? "text-emerald-400" : "text-gray-400"}`}
                >
                  <span className={`size-1.5 rounded-full ${printerConnected ? "bg-emerald-400" : "bg-gray-500"}`} />
                  {printerConnected ? printerName || "Printer connected" : "Not connected"}
                </span>
              )}
```

Replace with (three visual states now: not connected / connected-but-not-tested / verified):

```tsx
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
```

- [ ] **Step 7: Swap in the Yes/No confirmation UI**

Find the button-pair block:

```tsx
            {usbSupported && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-12 bg-transparent border-white/15 text-white hover:bg-white/10 hover:text-white"
                  onClick={onConnect}
                  disabled={checking}
                >
                  {printerConnected ? "Reconnect" : "Connect Printer"}
                </Button>
                <Button className="h-12" onClick={onTestPrint} disabled={!printerConnected || testPrinting}>
                  {testPrinting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Test Print
                </Button>
              </div>
            )}
```

Replace with (same button pair when idle; a Yes/No prompt takes over the same space while awaiting confirmation):

```tsx
            {usbSupported && (
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
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-12 bg-transparent border-white/15 text-white hover:bg-white/10 hover:text-white"
                    onClick={onConnect}
                    disabled={checking}
                  >
                    {printerConnected ? "Reconnect" : "Connect Printer"}
                  </Button>
                  <Button className="h-12" onClick={onTestPrint} disabled={!printerConnected || testPrinting}>
                    {testPrinting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Test Print
                  </Button>
                </div>
              )
            )}
```

- [ ] **Step 8: Continue button reflects verification, not just connection**

Find:

```tsx
          <Button size="lg" className="w-full h-14 sm:h-16 mt-6 text-base" onClick={onContinue}>
            {printerConnected ? "Start Scanning" : "Skip — Start Scanning"}
          </Button>
```

Replace with:

```tsx
          <Button size="lg" className="w-full h-14 sm:h-16 mt-6 text-base" onClick={onContinue}>
            {printerVerified ? "Start Scanning" : "Skip — Start Scanning"}
          </Button>
```

(A connected-but-unverified printer still reads "Skip" — honest signal that printing hasn't actually been proven yet. The button itself keeps working regardless, per the Global Constraint that this screen must always be skippable.)

- [ ] **Step 9: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions (233/233 baseline).
- [ ] Read back the full diff: confirm every one of the 8 code changes above landed, confirm `printerVerified`/`awaitingPrintConfirm` are never set `true` by anything other than an explicit user tap on "Yes", confirm the scan screen's own separate footer status indicator (a different block, much later in the file, around where `mode === "checkin_and_print" && usbSupported` renders "Printer connected"/"Printer not connected") was NOT touched — this fix is scoped to the setup screen only.

- [ ] **Step 10: Commit**

```bash
git add src/components/kiosk/KioskCheckinScreen.tsx
git commit -m "feat(kiosk): require a Yes/No confirmation after test print, not just a sent USB transfer"
```

---

### Task 2: Final review + live verify + deploy

- [ ] Dispatch the standard final review across this task's commit (subagent-driven-development's review step — this is a small, single-task change, so the "task review" and "final review" can be the same pass).
- [ ] Live-verify: on a real thermal printer, Test Print → "Did a badge come out?" appears → tapping Yes shows "verified" (green) and Continue reads "Start Scanning". On a non-printing device (or by simulating a "No" tap), confirm the status stays amber "Connected — not tested" and Continue still reads "Skip — Start Scanning".
- [ ] Merge, push, confirm the Vercel production deploy succeeds.
