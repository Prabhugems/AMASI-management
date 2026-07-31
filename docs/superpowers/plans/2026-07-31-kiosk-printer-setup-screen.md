# Printer Setup Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a printer setup screen before the scan screen for any check-in list with `mode === "checkin_and_print"`, so a volunteer connects and test-prints before a delegate is standing there — plus a printer icon on that list's menu tile.

**Architecture:** All screen-flow work lives in `KioskCheckinScreen.tsx` (the print-related state and the WebUSB effect already live there). A new `PrinterSetupScreen` sub-component, matching the file's existing pattern of extracted full-screen components (`DuplicateWarningScreen`, `CollectionSuccessScreen`, `NotOnListScreen`), gates entry to the existing scan screen. The menu-tile icon is a separate, independent change in `KioskStationShell.tsx`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind, lucide-react icons — same as the rest of this codebase.

## Global Constraints

- No change to `KioskCheckinScreen`'s existing print-trigger logic (`printBadge`, `handlePrintButtonClick`, the auto-print effect) — this plan only adds a gate *before* the existing scan screen, and extracts (not rewrites) the existing Connect Printer handler.
- No change to `/kiosk/[eventId]/[listId]/page.tsx` (direct-URL path) — it never sets `mode`, so `mode === "checkin_and_print"` is never true there; this feature is naturally scoped out.
- The printer setup screen must be skippable — a volunteer must always be able to reach the scan screen even with no printer connected, matching this codebase's established "print is best-effort, never blocks check-in" posture (see `printBadge`'s own fail-fast-with-message behavior, `auto_print_badge`'s non-blocking design in CLAUDE.md history).
- `npx tsc --noEmit` and `npx vitest run` must stay clean after every task.

---

### Task 1: Printer setup screen in `KioskCheckinScreen.tsx`

**Files:**
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx`

**Interfaces:**
- Consumes: `testUsbPrinter`, `connectUsbPrinter` (both already exported from `@/lib/usb-printer`, `testUsbPrinter` currently unused anywhere in the codebase until this task).
- Produces: no new props on `KioskCheckinScreen` itself — this is entirely internal state/flow. `PrinterSetupScreen` is a new unexported-outside-this-file component, same visibility as its siblings (`DuplicateWarningScreen` etc.).

- [ ] **Step 1: Add new state**

Near the existing print-related state (`usbSupported`, `printerConnected`, `printerName`, `printing`, `printStatus` — around line 200-204), add:

```ts
  const [printerSetupDone, setPrinterSetupDone] = useState(false)
  const [checkingPrinter, setCheckingPrinter] = useState(true)
  const [testPrinting, setTestPrinting] = useState(false)
  const [testPrintStatus, setTestPrintStatus] = useState<{ success: boolean; message: string } | null>(null)
```

- [ ] **Step 2: Import the `Printer` icon**

Add `Printer` to the existing `lucide-react` import block near the top of the file (alongside `QrCode`, `Loader2`, etc.).

- [ ] **Step 3: Mark the WebUSB feature-detect effect "done checking"**

Find the effect (currently starting `// Stage 4: feature-detect WebUSB, silently try to reconnect...`):

```ts
  useEffect(() => {
    if (mode !== "checkin_and_print") return
    let cancelled = false
    let cleanupDisconnect: (() => void) | undefined
    ;(async () => {
      const { isWebUSBSupported, reconnectUsbPrinter, getUsbPrinterName, onUsbDisconnect } = await import("@/lib/usb-printer")
      if (!isWebUSBSupported()) return
      if (cancelled) return
      setUsbSupported(true)
      const result = await reconnectUsbPrinter()
      if (cancelled) return
      if (result.success) {
        setPrinterConnected(true)
        setPrinterName(result.name || getUsbPrinterName())
      }
      cleanupDisconnect = onUsbDisconnect(() => {
        setPrinterConnected(false)
        setPrinterName(null)
      })
    })()
    return () => {
      cancelled = true
      cleanupDisconnect?.()
    }
  }, [mode])
```

Replace it with (adds `setCheckingPrinter(false)` on every exit path, so the new screen's "Checking…" state always resolves):

```ts
  useEffect(() => {
    if (mode !== "checkin_and_print") {
      setCheckingPrinter(false)
      return
    }
    let cancelled = false
    let cleanupDisconnect: (() => void) | undefined
    ;(async () => {
      const { isWebUSBSupported, reconnectUsbPrinter, getUsbPrinterName, onUsbDisconnect } = await import("@/lib/usb-printer")
      if (!isWebUSBSupported()) {
        if (!cancelled) setCheckingPrinter(false)
        return
      }
      if (cancelled) return
      setUsbSupported(true)
      const result = await reconnectUsbPrinter()
      if (cancelled) return
      if (result.success) {
        setPrinterConnected(true)
        setPrinterName(result.name || getUsbPrinterName())
      }
      setCheckingPrinter(false)
      cleanupDisconnect = onUsbDisconnect(() => {
        setPrinterConnected(false)
        setPrinterName(null)
      })
    })()
    return () => {
      cancelled = true
      cleanupDisconnect?.()
    }
  }, [mode])
```

- [ ] **Step 4: Extract the Connect Printer handler**

Find the inline connect handler currently only used on the success screen's Connect Printer button (`onClick={async () => { const { connectUsbPrinter } = await import("@/lib/usb-printer") ... }}`, inside the `{mode === "checkin_and_print" && usbSupported && (!printerConnected ? (...) : (...))}` block). Add a `useCallback` near the other handlers (e.g. near `printBadge`):

```ts
  const handleConnectPrinter = useCallback(async () => {
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

Then replace the success screen's inline `onClick={async () => {...}}` body with `onClick={handleConnectPrinter}` — same button, same behavior, now calling the shared handler instead of a duplicated inline closure.

- [ ] **Step 5: Add the Test Print handler**

Add alongside `handleConnectPrinter`:

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

- [ ] **Step 6: Gate the camera-start effect on the printer setup screen**

Find:

```ts
  // Camera only runs on the entry screen (no active result) and only in
  // "camera" scan mode -- mirrors the print station page's identical gate.
  useEffect(() => {
    if (scanMode === "camera" && !result) {
      getCameras()
    } else if (scanMode === "manual") {
      stopScanner()
    }
    return () => {
      ...
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode, result])
```

Change the condition and dependency array only (leave the cleanup body untouched):

```ts
  useEffect(() => {
    const showingPrinterSetup = mode === "checkin_and_print" && !printerSetupDone
    if (scanMode === "camera" && !result && !showingPrinterSetup) {
      getCameras()
    } else if (scanMode === "manual") {
      stopScanner()
    }
    return () => {
      ...
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode, result, mode, printerSetupDone])
```

- [ ] **Step 7: Insert the gate and the new screen component**

Find `// SUCCESS / ERROR SCREEN` / `if (result) {` (the first line of that section). Immediately before it, insert:

```ts
  // ============================================================
  // PRINTER SETUP SCREEN — shown once per mount (i.e. once per time the
  // volunteer enters this job from the menu, since KioskCheckinScreen
  // remounts on key={activeList.id} in KioskStationShell), before the scan
  // screen or its camera ever start. A volunteer must be able to connect
  // and test a badge before any delegate is standing there -- discovering
  // a dead printer on the success card after the first scan is too late.
  // ============================================================
  if (mode === "checkin_and_print" && !printerSetupDone) {
    return (
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
        onContinue={() => setPrinterSetupDone(true)}
        isOnline={isOnline}
      />
    )
  }

```

- [ ] **Step 8: Add the `PrinterSetupScreen` component**

Add near the other extracted full-screen components (e.g. right before `function DuplicateWarningScreen`):

```tsx
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

// Gates the scan screen for any checkin_and_print list -- a volunteer
// connects and test-prints here, before a delegate is ever standing in
// front of them. Skippable: the Continue button always works, and the
// success screen's own Connect Printer / Print Badge flow (unchanged) is
// still there as a fallback for anyone who skips this screen.
function PrinterSetupScreen({
  eventName,
  stationName,
  listName,
  checking,
  usbSupported,
  printerConnected,
  printerName,
  onConnect,
  connectStatus,
  onTestPrint,
  testPrinting,
  testPrintStatus,
  onContinue,
  isOnline,
}: PrinterSetupScreenProps) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <div className="bg-gray-800/50 border-b border-white/10 px-4 sm:px-8 py-4 sm:py-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{eventName || "Event"}</h1>
          {stationName && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-3 py-1 text-xs sm:text-sm font-bold uppercase tracking-wide text-indigo-300 shrink-0">
              <span className="size-1.5 rounded-full bg-indigo-400" />
              {stationName}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <div className="size-20 sm:size-24 mx-auto rounded-3xl bg-indigo-500/15 outline outline-1 -outline-offset-1 outline-indigo-500/30 flex items-center justify-center mb-5 text-indigo-300">
              <Printer className="h-10 w-10 sm:h-12 sm:w-12" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Set up the printer</h2>
            <p className="text-sm sm:text-base text-gray-400">
              {listName} prints a badge on check-in. Connect and test it now — the delegate line can&apos;t wait
              while you find out it&apos;s dead.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gray-800/50 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-300">Status</span>
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
            </div>

            {!usbSupported && !checking && (
              <p className="text-xs text-amber-400">
                This browser can&apos;t connect to a printer over USB. Use Chrome or Edge, or skip and print
                elsewhere.
              </p>
            )}

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

            {connectStatus && !connectStatus.success && <p className="text-xs text-red-400">{connectStatus.message}</p>}
            {testPrintStatus && (
              <p className={testPrintStatus.success ? "text-xs text-emerald-400" : "text-xs text-red-400"}>
                {testPrintStatus.message}
              </p>
            )}
          </div>

          <Button size="lg" className="w-full h-14 sm:h-16 mt-6 text-base" onClick={onContinue}>
            {printerConnected ? "Start Scanning" : "Skip — Start Scanning"}
          </Button>
        </div>
      </div>

      <div className="bg-gray-800/50 border-t border-white/10 px-4 sm:px-8 py-3 text-center">
        <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <span className={`inline-flex items-center gap-1 ${isOnline ? "text-emerald-400" : "text-amber-400"}`}>
            <span className={`size-1.5 rounded-full ${isOnline ? "bg-emerald-400" : "bg-amber-400"}`} />
            {isOnline ? "Online" : "Offline"}
          </span>
          {usbSupported && (
            <span className={`inline-flex items-center gap-1 ${printerConnected ? "text-emerald-400" : "text-gray-500"}`}>
              <span className={`size-1.5 rounded-full ${printerConnected ? "bg-emerald-400" : "bg-gray-500"}`} />
              {printerConnected ? "Printer connected" : "Printer not connected"}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions (233/233 baseline).
- [ ] Read back the diff: confirm `handleConnectPrinter` is used in exactly two places (the new screen, and the success screen's existing Connect Printer button, no longer with a duplicated inline closure), confirm the camera-start effect's new guard, confirm `PrinterSetupScreen` receives every prop it's given at the call site.

- [ ] **Step 10: Commit**

```bash
git add src/components/kiosk/KioskCheckinScreen.tsx
git commit -m "feat(kiosk): add a printer setup screen before scanning starts"
```

---

### Task 2: Printer icon on the menu tile

**Files:**
- Modify: `src/components/kiosk/KioskStationShell.tsx`

**Interfaces:**
- Consumes: `prints_badge: boolean` (already present on `AssignedList` since the per-list badge printing fix), `mode: "checkin" | "checkin_and_print"` (already a prop of `KioskStationShell` itself, threaded one level further down into `KioskMenuScreen` and `JobTile`).

- [ ] **Step 1: Import the `Printer` icon**

Add `Printer` to this file's `lucide-react` import (alongside the existing `ClipboardList`).

- [ ] **Step 2: Thread `mode` into `KioskMenuScreen`**

Find the `<KioskMenuScreen ... />` call site (around line 338) inside `KioskStationShell`. Add `mode={mode}` to its props.

Find `KioskMenuScreen`'s prop type and destructuring (`stationName, lists, attended, listCounts, onSelect`). Add `mode: "checkin" | "checkin_and_print"` to the type and destructuring.

- [ ] **Step 3: Thread `mode` into every `JobTile` call site**

`KioskMenuScreen` renders `<JobTile ... />` in three places (the `useGrid` open-lists map, the `useGrid` closed-lists map, and the non-grid single-column map). Add `mode={mode}` to all three.

- [ ] **Step 4: Accept `mode` in `JobTile` and show the icon**

Find `JobTile`'s prop type and destructuring (`list, now, attended, open, count, onSelect`). Add `mode: "checkin" | "checkin_and_print"`.

Find the icon rendering:

```tsx
      <span
        className={`flex-none rounded-full flex items-center justify-center ${
          open ? "size-16 sm:size-[76px] bg-white/20" : "size-12 sm:size-[60px] bg-muted"
        }`}
      >
        <ClipboardList
          className={open ? "size-8 sm:size-9" : "size-6 sm:size-7 text-muted-foreground"}
          strokeWidth={1.9}
        />
      </span>
```

Replace the icon choice with a conditional (keep the outer `<span>` wrapper exactly as-is — only the icon component inside changes):

```tsx
      <span
        className={`flex-none rounded-full flex items-center justify-center ${
          open ? "size-16 sm:size-[76px] bg-white/20" : "size-12 sm:size-[60px] bg-muted"
        }`}
      >
        {mode === "checkin_and_print" && list.prints_badge ? (
          <Printer
            className={open ? "size-8 sm:size-9" : "size-6 sm:size-7 text-muted-foreground"}
            strokeWidth={1.9}
          />
        ) : (
          <ClipboardList
            className={open ? "size-8 sm:size-9" : "size-6 sm:size-7 text-muted-foreground"}
            strokeWidth={1.9}
          />
        )}
      </span>
```

- [ ] **Step 5: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Manually confirm (dev server or live) that only the printing-flagged list's tile shows the printer icon, every other tile keeps the plain clipboard icon.

- [ ] **Step 6: Commit**

```bash
git add src/components/kiosk/KioskStationShell.tsx
git commit -m "feat(kiosk): show a printer icon on the menu tile of the list that prints"
```

---

### Task 3: Final review + live verify

- [ ] Dispatch the standard final whole-branch review across both tasks' commits together (subagent-driven-development's final review step).
- [ ] Live-verify on Tablet 4 (or another `checkin_and_print` station with a `prints_badge` list): entering Registration Check-in shows the printer setup screen before any scan UI; Connect and Test Print work (or degrade cleanly if no real printer is attached to the test browser); Continue reaches the scan screen; Skip (when not connected) also reaches the scan screen; the menu shows a printer icon only on the printing-flagged tile; re-entering the job from the menu shows the printer setup screen again.
- [ ] Merge, push, confirm the Vercel production deploy succeeds.
