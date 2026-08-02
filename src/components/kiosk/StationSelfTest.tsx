"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import * as Sentry from "@sentry/nextjs"
import { Loader2, Printer, ScanLine, Database, Clock, Wifi, WifiOff, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBatteryStatus } from "@/hooks/use-battery-status"
import { useForceLightTheme } from "@/hooks/use-force-light-theme"
import { getDelegateCache, getCacheUpdatedAt, getPendingScanCount } from "@/lib/kiosk-offline-store"

// Scanner-burst detection tuned to match the real check-in screen's own
// heuristic (KioskCheckinScreen.tsx) -- a HID keyboard-wedge scanner has no
// WebUSB/WebHID identity to query, so "is it connected" can only ever mean
// "did a fast keystroke burst just arrive", the same signal the real scan
// screen already relies on.
const SCAN_MIN_LEN = 3
const SCAN_MAX_AVG_GAP_MS = 50

interface SelfTestList {
  id: string
  name: string
}

interface RosterRow {
  listId: string
  listName: string
  cachedCount: number | null
  cachedAt: number | null
  pendingCount: number | null
}

// Read-only diagnostics -- this component must never call a check-in or
// write endpoint (work order §10). Every check here either reads local
// IndexedDB/browser state, or (for the printer) requires its own explicit
// human "yes, it printed" confirmation before reporting success, exactly
// like the real printer setup screen.
export function StationSelfTest({
  stationToken,
  stationName,
  mode,
  printerConfigured,
  printerType,
  lists,
}: {
  stationToken: string
  stationName: string
  mode: "checkin" | "checkin_and_print"
  printerConfigured: boolean
  printerType: "usb" | "browser"
  lists: SelfTestList[]
}) {
  useForceLightTheme()
  const battery = useBatteryStatus()

  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine)
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const [clockCheck, setClockCheck] = useState<{ status: "idle" | "checking" | "ok" | "drift" | "error"; detailMs?: number }>({
    status: "idle",
  })
  const checkClock = async () => {
    setClockCheck({ status: "checking" })
    try {
      const before = Date.now()
      const res = await fetch(`/kiosk-station/${encodeURIComponent(stationToken)}/manifest`, { cache: "no-store" })
      const after = Date.now()
      const serverDateHeader = res.headers.get("date")
      if (!serverDateHeader) {
        setClockCheck({ status: "error" })
        return
      }
      const serverMs = new Date(serverDateHeader).getTime()
      const roundTripAllowance = after - before
      const driftMs = Math.abs(before + roundTripAllowance / 2 - serverMs)
      setClockCheck({ status: driftMs > 60_000 ? "drift" : "ok", detailMs: driftMs })
    } catch (err) {
      Sentry.captureException(err, { tags: { module: "kiosk-self-test" } })
      setClockCheck({ status: "error" })
    }
  }

  // Printer ----------------------------------------------------------
  const [printerConnected, setPrinterConnected] = useState(false)
  const [printerName, setPrinterName] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [testPrinting, setTestPrinting] = useState(false)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleConnect = async () => {
    setConnecting(true)
    setConnectError(null)
    try {
      const { connectUsbPrinter } = await import("@/lib/usb-printer")
      const res = await connectUsbPrinter()
      if (res.success) {
        setPrinterConnected(true)
        setPrinterName(res.name || "USB Printer")
      } else {
        setConnectError(res.error || "Could not connect.")
      }
    } finally {
      setConnecting(false)
    }
  }

  const handleTestPrint = async () => {
    setTestPrinting(true)
    setTestResult(null)
    try {
      if (printerType === "browser") {
        const { printHtmlViaBrowser, buildBrowserTestPageHtml } = await import("@/lib/browser-print")
        const res = await printHtmlViaBrowser(buildBrowserTestPageHtml(stationName))
        if (res.success) {
          setAwaitingConfirm(true)
        } else {
          setTestResult({ success: false, message: res.error || "Could not open the print dialog." })
        }
        return
      }
      const { testUsbPrinter } = await import("@/lib/usb-printer")
      const res = await testUsbPrinter()
      if (res.success) {
        setAwaitingConfirm(true)
      } else {
        setTestResult({ success: false, message: res.error || "Test print failed." })
      }
    } finally {
      setTestPrinting(false)
    }
  }

  const confirmTestPrint = (badgePrinted: boolean) => {
    setAwaitingConfirm(false)
    setTestResult(
      badgePrinted
        ? { success: true, message: "Confirmed — a badge came out." }
        : { success: false, message: "No badge came out — check the printer and try again." }
    )
  }

  // Scanner ------------------------------------------------------------
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [scanBuffer, setScanBuffer] = useState("")
  const keyTimesRef = useRef<number[]>([])
  const scanInputRef = useRef<HTMLInputElement>(null)

  const handleScanKeyDown = () => {
    keyTimesRef.current.push(Date.now())
    if (keyTimesRef.current.length > 20) keyTimesRef.current.shift()
  }

  const handleScanChange = (value: string) => {
    setScanBuffer(value)
    if (value.length < SCAN_MIN_LEN) return
    const times = keyTimesRef.current
    if (times.length < value.length - 1) return
    const gaps = times.slice(1).map((t, i) => t - times[i])
    const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : Infinity
    if (avgGap <= SCAN_MAX_AVG_GAP_MS) {
      setScanResult(value.length > 6 ? `${value.slice(0, 3)}…${value.slice(-3)}` : value)
      setScanBuffer("")
      keyTimesRef.current = []
    }
  }

  // Roster / queue -------------------------------------------------------
  const [roster, setRoster] = useState<RosterRow[] | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const rows = await Promise.all(
        lists.map(async (list) => {
          try {
            const [cached, cachedAt, pending] = await Promise.all([
              getDelegateCache(list.id),
              getCacheUpdatedAt(list.id),
              getPendingScanCount(list.id),
            ])
            return { listId: list.id, listName: list.name, cachedCount: cached.length, cachedAt, pendingCount: pending }
          } catch (err) {
            Sentry.captureException(err, { tags: { module: "kiosk-self-test" }, extra: { listId: list.id } })
            return { listId: list.id, listName: list.name, cachedCount: null, cachedAt: null, pendingCount: null }
          }
        })
      )
      if (!cancelled) setRoster(rows)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists.map((l) => l.id).join(",")])

  const totalPending = roster?.reduce((sum, r) => sum + (r.pendingCount || 0), 0) ?? null

  return (
    <div className="min-h-screen bg-background px-4 sm:px-8 py-6 sm:py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/kiosk-station/${stationToken}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Back to station
          </Link>
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Station self-test</h1>
          <p className="text-sm text-muted-foreground mt-1">{stationName} — run this before the tablet ships. Read-only: nothing here checks anyone in.</p>
        </div>

        {/* Network + clock + battery */}
        <Section title="Device" icon={<Clock className="size-4" />}>
          <Row label="Network">
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${isOnline ? "text-emerald-700" : "text-amber-700"}`}>
              {isOnline ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
              {isOnline ? "Online" : "Offline"}
            </span>
          </Row>
          <Row label="Battery">
            {battery.supported && battery.level !== null ? (
              <span className="text-sm font-medium text-foreground">
                {Math.round(battery.level * 100)}% {battery.charging ? "(charging)" : ""}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Not reported by this browser</span>
            )}
          </Row>
          <Row label="Device clock">
            <span className="text-sm font-medium text-foreground tabular-nums">{now.toLocaleString()}</span>
          </Row>
          <Row label="Time accuracy">
            <div className="flex items-center gap-2">
              {clockCheck.status === "ok" && <span className="text-sm text-emerald-700">Looks accurate</span>}
              {clockCheck.status === "drift" && (
                <span className="text-sm text-amber-700">
                  Off by ~{Math.round((clockCheck.detailMs || 0) / 1000)}s — check Settings → Date &amp; time → Automatic
                </span>
              )}
              {clockCheck.status === "error" && <span className="text-sm text-red-700">Couldn&apos;t check (offline?)</span>}
              <Button size="sm" variant="outline" onClick={checkClock} disabled={clockCheck.status === "checking"}>
                {clockCheck.status === "checking" ? <Loader2 className="size-3.5 animate-spin" /> : "Check"}
              </Button>
            </div>
          </Row>
        </Section>

        {/* Printer */}
        <Section title="Printer" icon={<Printer className="size-4" />}>
          {mode !== "checkin_and_print" || !printerConfigured ? (
            <p className="text-sm text-muted-foreground">This station isn&apos;t configured to print badges.</p>
          ) : (
            <div className="space-y-3">
              <Row label="Type">
                <span className="text-sm font-medium text-foreground capitalize">{printerType === "usb" ? "Thermal (USB)" : "Browser / other printer"}</span>
              </Row>
              {printerType === "usb" && (
                <Row label="Connection">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{printerConnected ? printerName : "Not connected"}</span>
                    <Button size="sm" variant="outline" onClick={handleConnect} disabled={connecting}>
                      {connecting ? <Loader2 className="size-3.5 animate-spin" /> : printerConnected ? "Reconnect" : "Connect"}
                    </Button>
                  </div>
                </Row>
              )}
              {connectError && <p className="text-xs text-red-700">{connectError}</p>}
              {awaitingConfirm ? (
                <div className="space-y-2">
                  <p className="text-sm text-foreground">Did a test badge come out?</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => confirmTestPrint(false)}>No</Button>
                    <Button size="sm" onClick={() => confirmTestPrint(true)}>Yes</Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={handleTestPrint}
                  disabled={testPrinting || (printerType === "usb" && !printerConnected)}
                >
                  {testPrinting ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                  Test print
                </Button>
              )}
              {testResult && (
                <p className={`text-sm ${testResult.success ? "text-emerald-700" : "text-red-700"}`}>{testResult.message}</p>
              )}
            </div>
          )}
        </Section>

        {/* Scanner */}
        <Section title="Scanner" icon={<ScanLine className="size-4" />}>
          <p className="text-sm text-muted-foreground mb-2">
            Scan any badge with the station&apos;s scanner. This only checks the scanner and cable — nothing is looked up or checked in.
          </p>
          <Input
            ref={scanInputRef}
            value={scanBuffer}
            onChange={(e) => handleScanChange(e.target.value)}
            onKeyDown={handleScanKeyDown}
            placeholder="Scan here…"
            autoComplete="off"
            className="max-w-xs"
          />
          {scanResult && (
            <p className="mt-2 text-sm text-emerald-700">Scanner working — read &ldquo;{scanResult}&rdquo;</p>
          )}
        </Section>

        {/* Roster + queue */}
        <Section title="Cached roster" icon={<Database className="size-4" />}>
          {roster === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lists assigned to this station.</p>
          ) : (
            <div className="space-y-2">
              {roster.map((r) => (
                <Row key={r.listId} label={r.listName}>
                  <span className="text-sm text-foreground">
                    {r.cachedCount === null ? "Error reading cache" : `${r.cachedCount.toLocaleString()} cached`}
                    {r.cachedAt ? ` · updated ${new Date(r.cachedAt).toLocaleTimeString()}` : " · never synced"}
                  </span>
                </Row>
              ))}
              <Row label="Pending sync queue">
                <span className="text-sm font-medium text-foreground">
                  {totalPending === null ? "—" : `${totalPending} scan${totalPending === 1 ? "" : "s"} waiting to send`}
                </span>
              </Row>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      {children}
    </div>
  )
}
