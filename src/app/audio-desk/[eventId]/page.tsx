"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Headphones, ScanLine, Undo2, ListChecks, Search, Loader2, CheckCircle, XCircle, AlertCircle, RotateCcw,
  Hash, User, Ticket, Building2,
} from "lucide-react"
import { Html5Qrcode } from "html5-qrcode"
import Link from "next/link"

type Tab = "issue" | "return" | "list"
type IssueStep = "scan_badge" | "scan_device" | "result"

interface Attendee {
  id: string
  registration_number: string
  attendee_name: string
  ticket_types?: { name: string } | null
}

interface ListRow {
  id: string
  assigned_at: string
  returned_at: string | null
  audio_devices: { device_code: string }
  registrations: { registration_number: string; attendee_name: string; ticket_types?: { name: string } | null }
}

export default function AudioDeskPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [tab, setTab] = useState<Tab>("issue")
  const [issueStep, setIssueStep] = useState<IssueStep>("scan_badge")
  const [scanning, setScanning] = useState(false)
  const [cameraTarget, setCameraTarget] = useState<"badge" | "device" | "return" | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scannerReady, setScannerReady] = useState(false)
  const [scanInput, setScanInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [attendee, setAttendee] = useState<Attendee | null>(null)
  const [result, setResult] = useState<{ kind: "success" | "error" | "warning"; title: string; subtitle?: string; deviceCode?: string; attendeeName?: string } | null>(null)

  const [returnInput, setReturnInput] = useState("")

  const [listRows, setListRows] = useState<ListRow[]>([])
  const [listStats, setListStats] = useState({ currentlyOut: 0, totalReturns: 0, knownDevices: 0 })
  const [listFilter, setListFilter] = useState<"active" | "returned" | "all">("active")
  const [listSearch, setListSearch] = useState("")

  const badgeInputRef = useRef<HTMLInputElement>(null)
  const deviceInputRef = useRef<HTMLInputElement>(null)
  const returnInputRef = useRef<HTMLInputElement>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  // Auto-focus the right input
  useEffect(() => {
    if (tab === "issue" && issueStep === "scan_badge") badgeInputRef.current?.focus()
    if (tab === "issue" && issueStep === "scan_device") deviceInputRef.current?.focus()
    if (tab === "return") returnInputRef.current?.focus()
  }, [tab, issueStep, result])

  // Auto-start camera when entering a scan state (no result visible)
  useEffect(() => {
    if (result || scanning) return
    if (tab === "issue" && issueStep === "scan_badge") startCamera("badge")
    else if (tab === "issue" && issueStep === "scan_device") startCamera("device")
    else if (tab === "return") startCamera("return")
    // intentionally re-runs when tab/step changes; startCamera is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, issueStep, result])

  // Look up an attendee by reg number or by /v/{token} URL
  const lookupAttendee = useCallback(async (value: string) => {
    const v = value.trim()
    if (!v) return
    setBusy(true)
    try {
      // If it's a verify URL, extract the token. Resolve via verify endpoint to get the reg.
      let regNumber = v
      const urlMatch = v.match(/\/v\/([A-Za-z0-9_-]+)/)
      if (urlMatch) {
        const res = await fetch(`/api/verify/${urlMatch[1]}?event_id=${eventId}`)
        if (res.ok) {
          const data = await res.json()
          regNumber = data.registration?.registration_number || data.registration_number || ""
        }
      }
      if (!regNumber) {
        setResult({ kind: "error", title: "Could not read badge" })
        setIssueStep("result")
        return
      }
      // Lookup via the public audio-desk find endpoint
      const r = await fetch(`/api/audio-devices/find-attendee?event_id=${eventId}&q=${encodeURIComponent(regNumber)}`)
      if (!r.ok) throw new Error("Registration lookup failed")
      const j = await r.json()
      const reg = j.data
      if (!reg) {
        setResult({ kind: "error", title: "Attendee not found", subtitle: regNumber })
        setIssueStep("result")
        return
      }
      setAttendee(reg)
      setScanInput("")
      setIssueStep("scan_device")
    } catch (e: any) {
      setResult({ kind: "error", title: e.message || "Error" })
      setIssueStep("result")
    } finally {
      setBusy(false)
    }
  }, [eventId])

  // Issue device to current attendee
  const issueDevice = useCallback(async (rawCode: string) => {
    if (!attendee) return
    const code = rawCode.trim().toUpperCase()
    if (!code) return
    setBusy(true)
    try {
      const res = await fetch("/api/audio-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          device_code: code,
          registration_id: attendee.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ kind: "error", title: "Cannot issue device", subtitle: data.error })
      } else if (data.already) {
        setResult({ kind: "warning", title: "Already with this person", subtitle: data.message, deviceCode: code, attendeeName: attendee.attendee_name })
      } else {
        setResult({
          kind: "success",
          title: "Device issued",
          subtitle: data.warning || undefined,
          deviceCode: code,
          attendeeName: attendee.attendee_name,
        })
      }
      setIssueStep("result")
    } catch (e: any) {
      setResult({ kind: "error", title: e.message || "Error" })
      setIssueStep("result")
    } finally {
      setBusy(false)
    }
  }, [attendee, eventId])

  const returnDevice = useCallback(async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase()
    if (!code) return
    setBusy(true)
    try {
      const res = await fetch("/api/audio-devices/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, device_code: code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ kind: "error", title: "Cannot return", subtitle: data.error })
      } else if (data.already) {
        setResult({ kind: "warning", title: "Not currently issued", subtitle: data.message, deviceCode: code })
      } else {
        setResult({
          kind: "success",
          title: "Device returned",
          deviceCode: code,
          attendeeName: data.registration?.attendee_name,
        })
      }
      setReturnInput("")
    } catch (e: any) {
      setResult({ kind: "error", title: e.message || "Error" })
    } finally {
      setBusy(false)
    }
  }, [eventId])

  const fetchList = useCallback(async () => {
    const url = new URL(`/api/audio-devices/list`, window.location.origin)
    url.searchParams.set("event_id", eventId)
    url.searchParams.set("status", listFilter)
    if (listSearch.trim()) url.searchParams.set("q", listSearch.trim())
    const res = await fetch(url.toString())
    if (!res.ok) return
    const data = await res.json()
    setListRows(data.data || [])
    setListStats(data.stats || { currentlyOut: 0, totalReturns: 0, knownDevices: 0 })
  }, [eventId, listFilter, listSearch])

  useEffect(() => {
    if (tab === "list") {
      fetchList()
      const t = setInterval(fetchList, 5000)
      return () => clearInterval(t)
    }
  }, [tab, fetchList])

  // Always refresh stats on Issue too
  useEffect(() => { fetchList() }, [fetchList])

  const resetIssueFlow = () => {
    setAttendee(null)
    setScanInput("")
    setResult(null)
    setIssueStep("scan_badge")
  }

  // Camera scanner — entry: click sets state, the useEffect below boots the scanner
  // AFTER the <div id="audio-desk-qr"> has been mounted (avoids "Element not found").
  const startCamera = useCallback((targetInput: "badge" | "device" | "return") => {
    setCameraError(null)
    setScannerReady(false)
    setCameraTarget(targetInput)
    setScanning(true)
  }, [])

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      scannerRef.current = null
    }
    setScannerReady(false)
    setScanning(false)
    setCameraTarget(null)
  }, [])

  // Boot html5-qrcode only after the target <div> is in the DOM.
  useEffect(() => {
    if (!scanning || !cameraTarget) return
    let cancelled = false
    const target = cameraTarget

    ;(async () => {
      try {
        const scanner = new Html5Qrcode("audio-desk-qr")
        if (cancelled) return
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decoded) => {
            try { await scanner.stop() } catch {}
            scannerRef.current = null
            setScannerReady(false)
            setScanning(false)
            setCameraTarget(null)
            if (target === "badge") await lookupAttendee(decoded)
            else if (target === "device") await issueDevice(decoded)
            else await returnDevice(decoded)
          },
          () => {}
        )
        if (cancelled) {
          try { await scanner.stop() } catch {}
          return
        }
        setScannerReady(true)
      } catch (e: any) {
        const msg = String(e?.message || e || "")
        const isPerm = /permission|NotAllowed/i.test(msg)
        const isMissing = /not found|getElementById/i.test(msg)
        setCameraError(
          isPerm
            ? "Camera permission denied. Allow camera access in your browser settings."
            : isMissing
            ? "Could not attach to camera view — please try again."
            : `Camera error: ${msg}`
        )
        setScannerReady(false)
      }
    })()

    return () => {
      cancelled = true
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [scanning, cameraTarget, lookupAttendee, issueDevice, returnDevice])

  useEffect(() => () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="bg-black/30 border-b border-white/10 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-lg leading-tight">Audio Desk</h1>
            <p className="text-white/50 text-xs">Headset issue & return</p>
          </div>
          <Link href={`/events/${eventId}`} className="text-xs text-white/60 hover:text-white">← Event</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-black/10 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-6 sm:gap-12">
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-400">{listStats.currentlyOut}</p>
            <p className="text-xs text-white/50">Currently Out</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{listStats.totalReturns}</p>
            <p className="text-xs text-white/50">Returns</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-3xl font-bold text-cyan-400">{listStats.knownDevices}</p>
            <p className="text-xs text-white/50">Devices Seen</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-3">
        <div className="max-w-md mx-auto flex items-center gap-2">
          {([
            { key: "issue",  label: "Issue",  icon: ScanLine   },
            { key: "return", label: "Return", icon: Undo2      },
            { key: "list",   label: "List",   icon: ListChecks },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setResult(null); resetIssueFlow() }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                tab === key
                  ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              <Icon className="w-5 h-5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-12">
        {/* Result card */}
        {result && (
          <div className={`mb-4 p-6 rounded-3xl text-center border-2 ${
            result.kind === "success" ? "bg-emerald-500/15 border-emerald-500/50"
            : result.kind === "warning" ? "bg-amber-500/15 border-amber-500/50"
            : "bg-red-500/15 border-red-500/50"
          }`}>
            <div className="flex justify-center mb-3">
              {result.kind === "success" ? (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center">
                  <CheckCircle className="w-9 h-9 text-white" />
                </div>
              ) : result.kind === "warning" ? (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
                  <AlertCircle className="w-9 h-9 text-white" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-pink-400 flex items-center justify-center">
                  <XCircle className="w-9 h-9 text-white" />
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold mb-1">{result.title}</h2>
            {result.deviceCode && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl mt-2">
                <Hash className="w-5 h-5 text-emerald-300" />
                <span className="font-mono text-xl font-bold tracking-wider">{result.deviceCode}</span>
              </div>
            )}
            {result.attendeeName && <p className="mt-3 text-lg">{result.attendeeName}</p>}
            {result.subtitle && <p className="mt-2 text-white/60 text-sm">{result.subtitle}</p>}
            <button
              onClick={() => { setResult(null); if (tab === "issue") resetIssueFlow() }}
              className="mt-5 px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Next scan
            </button>
          </div>
        )}

        {/* Camera overlay */}
        {scanning && (
          <div className="mb-4 p-4 bg-black/30 rounded-2xl border border-white/10">
            <div className="relative">
              <div id="audio-desk-qr" style={{ minHeight: 250 }} />
              {!scannerReady && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 rounded-xl">
                  <div className="text-center">
                    <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
                    <p className="text-white/60 mt-3 text-sm">Starting camera…</p>
                  </div>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-xl p-4">
                  <div className="text-center max-w-xs">
                    <XCircle className="w-10 h-10 text-red-400 mx-auto" />
                    <p className="text-red-200 mt-3 text-sm">{cameraError}</p>
                  </div>
                </div>
              )}
            </div>
            <button onClick={stopCamera} className="mt-3 w-full py-2 rounded-xl bg-white/10 hover:bg-white/20">Close camera</button>
          </div>
        )}

        {/* Issue tab */}
        {tab === "issue" && !result && !scanning && (
          <div className="space-y-4">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className={`px-3 py-1 rounded-full border ${issueStep === "scan_badge" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "border-white/20 text-white/40"}`}>1. Badge</span>
              <span className="text-white/30">→</span>
              <span className={`px-3 py-1 rounded-full border ${issueStep === "scan_device" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "border-white/20 text-white/40"}`}>2. Device</span>
            </div>

            {issueStep === "scan_badge" && (
              <div className="bg-black/30 border border-white/10 rounded-3xl p-6">
                <div className="flex items-center gap-2 text-white/60 mb-2"><User className="w-4 h-4" /> Step 1 — Scan attendee badge</div>
                <input
                  ref={badgeInputRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") lookupAttendee(scanInput) }}
                  disabled={busy}
                  placeholder="Scan badge QR or enter reg number…"
                  className="w-full px-4 py-4 bg-white/5 border border-white/15 rounded-xl text-white text-center text-lg tracking-wider font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  autoFocus
                  autoCapitalize="characters"
                  autoComplete="off"
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => startCamera("badge")} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20">Use camera</button>
                  <button
                    onClick={() => lookupAttendee(scanInput)}
                    disabled={!scanInput || busy}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Find attendee"}
                  </button>
                </div>
              </div>
            )}

            {issueStep === "scan_device" && attendee && (
              <div className="bg-black/30 border border-white/10 rounded-3xl p-6">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-4">
                  <p className="text-xs text-emerald-300 uppercase tracking-wider mb-1">Attendee</p>
                  <p className="text-xl font-bold">{attendee.attendee_name}</p>
                  <div className="flex items-center gap-2 mt-1 text-sm text-white/70">
                    <Hash className="w-3.5 h-3.5" />
                    <span className="font-mono">{attendee.registration_number}</span>
                    {attendee.ticket_types?.name && (
                      <>
                        <span className="text-white/30">•</span>
                        <Ticket className="w-3.5 h-3.5" />
                        <span>{attendee.ticket_types.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-white/60 mb-2"><Headphones className="w-4 h-4" /> Step 2 — Scan device QR</div>
                <input
                  ref={deviceInputRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") issueDevice(scanInput) }}
                  disabled={busy}
                  placeholder="Scan device QR (e.g. AUD-001)…"
                  className="w-full px-4 py-4 bg-white/5 border border-white/15 rounded-xl text-white text-center text-lg tracking-wider font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  autoFocus
                  autoCapitalize="characters"
                  autoComplete="off"
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={resetIssueFlow} className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20">Cancel</button>
                  <button onClick={() => startCamera("device")} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20">Use camera</button>
                  <button
                    onClick={() => issueDevice(scanInput)}
                    disabled={!scanInput || busy}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Issue"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Return tab */}
        {tab === "return" && !result && !scanning && (
          <div className="bg-black/30 border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-2 text-white/60 mb-2"><Undo2 className="w-4 h-4" /> Scan returning device</div>
            <input
              ref={returnInputRef}
              value={returnInput}
              onChange={(e) => setReturnInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") returnDevice(returnInput) }}
              disabled={busy}
              placeholder="Scan device QR…"
              className="w-full px-4 py-4 bg-white/5 border border-white/15 rounded-xl text-white text-center text-lg tracking-wider font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => startCamera("return")} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20">Use camera</button>
              <button
                onClick={() => returnDevice(returnInput)}
                disabled={!returnInput || busy}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Return"}
              </button>
            </div>
          </div>
        )}

        {/* List tab */}
        {tab === "list" && (
          <div className="bg-black/30 border border-white/10 rounded-3xl flex flex-col max-h-[70vh] overflow-hidden">
            <div className="p-4 border-b border-white/10 space-y-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Search device code, name, reg, phone…"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/15 rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                {([
                  { k: "active",   label: "Currently Out" },
                  { k: "returned", label: "Returned" },
                  { k: "all",      label: "All" },
                ] as const).map(({ k, label }) => (
                  <button
                    key={k}
                    onClick={() => setListFilter(k)}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${
                      listFilter === k ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-white/5 text-white/60 border-white/15"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {listRows.length === 0 ? (
                <div className="text-center py-12 text-white/40 text-sm">No records</div>
              ) : listRows.map(row => (
                <div key={row.id} className={`p-3 rounded-xl border flex items-center gap-3 ${row.returned_at ? "bg-white/5 border-white/10" : "bg-emerald-500/10 border-emerald-500/30"}`}>
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <Headphones className="w-6 h-6 text-emerald-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold tracking-wider">{row.audio_devices?.device_code}</div>
                    <div className="text-sm text-white truncate">{row.registrations?.attendee_name}</div>
                    <div className="text-xs text-white/40 flex flex-wrap gap-x-2">
                      <span className="font-mono">{row.registrations?.registration_number}</span>
                      <span>· issued {new Date(row.assigned_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                      {row.returned_at && <span>· returned {new Date(row.returned_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                  </div>
                  {!row.returned_at && (
                    <button
                      onClick={() => returnDevice(row.audio_devices.device_code)}
                      className="px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-xs font-medium"
                    >
                      Return
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
