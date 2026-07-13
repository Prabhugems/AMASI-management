"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  CheckCircle,
  XCircle,
  Loader2,
  QrCode,
  Search,
  Camera,
  Keyboard,
  Volume2,
  VolumeX,
  RotateCcw,
  SwitchCamera,
  Clock,
  Building2,
  Ticket,
  Hash,
  AlertCircle,
  List as ListIcon,
  Users,
} from "lucide-react"
import { Html5Qrcode } from "html5-qrcode"
import {
  enqueueScan,
  flushQueue,
  pendingCount,
  type FlushResult,
} from "@/lib/offline-scan-queue"

interface CheckinList {
  id: string
  name: string
  event_id: string
  events: {
    id: string
    name: string
  }
}

interface Attendee {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_designation?: string
  attendee_institution?: string
  ticket_type?: { name: string }
  checked_in: boolean
  checked_in_at?: string
}

interface RecentCheckin {
  id: string
  name: string
  regNumber: string
  ticketType?: string
  institution?: string
  time: Date
  success: boolean
}

type ScanMode = "manual" | "camera" | "list"

// How long the result card stays up before the scanner auto-resets and the
// camera restarts. Used by the auto-continue effect below.
const AUTO_CONTINUE_MS = 5000

// Camera de-dup window — DERIVED from AUTO_CONTINUE_MS so the two numbers can't
// silently drift apart. It MUST exceed the auto-continue delay: when the camera
// restarts after a successful scan, a badge still sitting in frame must NOT be
// re-decoded into a second /api/verify call (which the server correctly rejects
// as "already checked in"). The +2000ms margin also absorbs decode latency. A
// deliberate re-scan of the same badge on an allow_multiple_checkins list still
// works once this window elapses.
const SCAN_REPEAT_WINDOW_MS = AUTO_CONTINUE_MS + 2000

// Manual/barcode mode re-arms much faster on a SUCCESSFUL check-in so staff can
// scan a queue of delegates back-to-back. Kept separate from AUTO_CONTINUE_MS so
// the camera de-dup window (derived above) is unaffected. Failures still use the
// full AUTO_CONTINUE_MS so staff can read the reason (not found / already in).
const MANUAL_AUTO_CONTINUE_MS = 1500

interface ListAttendee {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_institution?: string | null
  attendee_designation?: string | null
  ticket_type?: { name: string } | null
  checked_in: boolean
  checked_in_at?: string | null
}

export default function StaffCheckinPage() {
  const params = useParams()
  const accessToken = params.accessToken as string

  const [loading, setLoading] = useState(true)
  const [checkinList, setCheckinList] = useState<CheckinList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [processing, setProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<{
    success: boolean
    message: string
    attendee?: Attendee
    alreadyCheckedIn?: boolean
    checkedInAt?: string
    errorCode?: string
    badgeEventName?: string
  } | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [stats, setStats] = useState({ total: 0, checkedIn: 0 })
  const [scanMode, setScanMode] = useState<ScanMode>("camera")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scannerReady, setScannerReady] = useState(false)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [recentCheckins, setRecentCheckins] = useState<RecentCheckin[]>([])
  const autoContinueTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Offline scan queue (src/lib/offline-scan-queue.ts) state.
  // online = browser's `navigator.onLine` mirror, kept in sync via the
  //   "online" / "offline" window events.
  // queueCount = number of pending scans in IndexedDB for THIS access token,
  //   recomputed after each enqueue and after each flush.
  // Initialise pessimistically (online=true on SSR; nav.onLine is read in the
  // mount effect below).
  const [online, setOnline] = useState(true)
  const [queueCount, setQueueCount] = useState(0)
  const flushInFlightRef = useRef(false)

  // List view state
  const [listAttendees, setListAttendees] = useState<ListAttendee[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [listSearch, setListSearch] = useState("")
  const [listStatusFilter, setListStatusFilter] = useState<"all" | "checked_in" | "not_checked_in">("all")
  const [listCheckinPending, setListCheckinPending] = useState<string | null>(null)
  const listSearchTimerRef = useRef<NodeJS.Timeout | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  // Last camera scan ACCEPTED by the decode callback, keyed on the RAW
  // decodedText (not the parsed token) + a timestamp. Used for time-windowed
  // de-dup; intentionally NOT cleared by resetResult so an auto-restart can't
  // re-fire the same badge.
  const lastScannedRef = useRef<{ value: string; ts: number }>({ value: "", ts: 0 })
  const scanCooldownRef = useRef<boolean>(false)

  // Manual-entry scanner auto-submit. A USB/QR scanner types the whole code in a
  // fast burst (characters land a few ms apart) and many models do NOT send a
  // trailing Enter, so the box used to just fill and wait for a manual "Check
  // In" press. We detect the burst and auto-check-in on a brief idle. Human
  // typing is slower, so it falls through to the button instead of mis-firing.
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const burstStartRef = useRef<number>(0)
  const lastKeyTimeRef = useRef<number>(0)
  const isStartingRef = useRef(false)

  // Validate access token and get checkin list info
  useEffect(() => {
    async function validateAccess() {
      try {
        const res = await fetch(`/api/checkin/access/${accessToken}`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Invalid access link")
        }
        const data = await res.json()
        setCheckinList(data.checkinList)
        setStats(data.stats || { total: 0, checkedIn: 0 })
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (accessToken) {
      validateAccess()
    }
  }, [accessToken])

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    return () => {
      audioContextRef.current?.close()
    }
  }, [])

  // Focus input on load and after each scan (manual mode only)
  useEffect(() => {
    if (!loading && !error && inputRef.current && scanMode === "manual" && !lastResult) {
      inputRef.current.focus()
    }
  }, [loading, error, lastResult, scanMode])

  const playSound = (type: "success" | "error") => {
    if (!soundEnabled || !audioContextRef.current) return
    try {
      const ctx = audioContextRef.current
      if (ctx.state === "suspended") {
        ctx.resume()
      }

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      if (type === "success") {
        // Pleasant success beep (two ascending tones)
        oscillator.frequency.setValueAtTime(880, ctx.currentTime)
        oscillator.frequency.setValueAtTime(1108, ctx.currentTime + 0.1)
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.3)
      } else {
        // Error buzzer
        oscillator.frequency.setValueAtTime(220, ctx.currentTime)
        oscillator.type = "square"
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.4)
      }

      // Vibrate on mobile
      if (navigator.vibrate) {
        navigator.vibrate(type === "success" ? [100, 50, 100] : [200, 100, 200])
      }
    } catch (e) {
      // Ignore sound errors
    }
  }

  // Refresh queue count from IndexedDB. Called after every mutation
  // (enqueue, flush) so the header badge stays in sync. Cheap (single IDB
  // store scan filtered by access_token); no need to be debounced.
  const refreshQueueCount = useCallback(async () => {
    try {
      const n = await pendingCount(accessToken)
      setQueueCount(n)
    } catch {
      // IDB unavailable (e.g. private browsing on some browsers) — fall back
      // to "no queue" rather than blocking the scanner UI.
    }
  }, [accessToken])

  // Drain the offline queue. Idempotent + concurrency-guarded via
  // flushInFlightRef so the `online` event firing while we're already
  // flushing doesn't kick off a parallel drain. Each synced scan appends
  // a row to recentCheckins so the volunteer sees what just landed.
  const flushAllPending = useCallback(async () => {
    if (flushInFlightRef.current) return
    flushInFlightRef.current = true
    try {
      await flushQueue(accessToken, (result: FlushResult) => {
        const fallbackName = result.terminalError || "Unknown"
        if (result.success) {
          const reg = (result.response as { registration?: { id?: string; attendee_name?: string; registration_number?: string; ticket_type?: { name?: string }; attendee_institution?: string } } | undefined)?.registration
          setStats((prev) => ({ ...prev, checkedIn: prev.checkedIn + 1 }))
          setRecentCheckins((prev) => [{
            id: reg?.id || `synced-${result.scan.id}`,
            name: reg?.attendee_name || "Synced (offline)",
            regNumber: reg?.registration_number || result.scan.token,
            ticketType: reg?.ticket_type?.name,
            institution: reg?.attendee_institution,
            time: new Date(),
            success: true,
          }, ...prev].slice(0, 20))
        } else {
          setRecentCheckins((prev) => [{
            id: `synced-fail-${result.scan.id}`,
            name: fallbackName,
            regNumber: result.scan.token,
            time: new Date(),
            success: false,
          }, ...prev].slice(0, 20))
        }
      })
    } finally {
      flushInFlightRef.current = false
      await refreshQueueCount()
    }
  }, [accessToken, refreshQueueCount])

  // Wire online/offline detection + initial queue load.
  // Effect runs once per accessToken (when the page mounts after the access
  // token is in scope). Sets the initial online state from navigator.onLine,
  // subscribes to the window events, and kicks off a flush attempt on mount
  // in case a previous session left scans behind.
  useEffect(() => {
    if (!accessToken) return

    const onOnline = () => {
      setOnline(true)
      // Don't await — best-effort; errors handled inside flushAllPending.
      flushAllPending()
    }
    const onOffline = () => setOnline(false)

    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true)
    refreshQueueCount()
    if (typeof navigator !== "undefined" && navigator.onLine) {
      flushAllPending()
    }

    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [accessToken, refreshQueueCount, flushAllPending])

  const handleScan = useCallback(async (value: string) => {
    if (!value.trim() || processing || !checkinList) return

    // Prevent duplicate scans
    if (scanCooldownRef.current) return
    scanCooldownRef.current = true
    setTimeout(() => { scanCooldownRef.current = false }, 2000)

    setProcessing(true)
    setLastResult(null)

    // Stop the camera before the result view unmounts #qr-reader, so html5-qrcode's
    // internal video.play() can't be interrupted (fixes Sentry AMASI-MANAGEMENT-T).
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch { /* already stopping */ }
      scannerRef.current = null
      setScannerReady(false)
    }

    // Parse the token OUTSIDE the try so the catch block can also enqueue it.
    // The QR may encode either a bare token or a /v/<token> URL — extract.
    let token = value.trim()
    const urlMatch = value.match(/\/v\/([A-Za-z0-9_-]+)/)
    if (urlMatch) {
      token = urlMatch[1]
    }

    // Offline pre-check: if we know we're offline, skip the fetch and
    // queue immediately. Volunteer keeps scanning; sync happens when the
    // browser fires the "online" event. The catch below handles the case
    // where navigator.onLine lies (DNS works, server unreachable) — the
    // fetch throws TypeError there and we queue from the catch.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueScan(accessToken, token)
      await refreshQueueCount()
      playSound("success")
      setLastResult({
        success: true,
        message: "Queued offline — will sync when online",
      })
      setRecentCheckins((prev) => [{
        id: `queued-${Date.now()}`,
        name: "Queued offline",
        regNumber: token,
        time: new Date(),
        success: true,
      }, ...prev].slice(0, 20))
      setProcessing(false)
      setInputValue("")
      return
    }

    try {
      // Try to check in using the token
      const res = await fetch(`/api/verify/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkin_list_id: checkinList.id,
          access_token: accessToken,
          action: "check_in",
          performed_by: "Staff (via access link)",
        }),
      })

      const data = await res.json()

      if (data.alreadyCheckedIn) {
        // Legitimate repeat scan (re-entry, staff confirming status) — not an
        // error. Play the normal confirmation chime, never the buzzer, and
        // don't double-count it in the stats bar.
        playSound("success")
        setLastResult({
          success: true,
          message: data.message || "Already checked in",
          alreadyCheckedIn: true,
          checkedInAt: data.registration?.checked_in_at,
          attendee: data.registration,
        })
        setRecentCheckins(prev => [{
          id: data.registration?.id || Date.now().toString(),
          name: data.registration?.attendee_name || "Unknown",
          regNumber: data.registration?.registration_number || token,
          ticketType: data.registration?.ticket_type?.name,
          institution: data.registration?.attendee_institution,
          time: new Date(),
          success: true,
        }, ...prev].slice(0, 20))
      } else if (data.success) {
        playSound("success")
        setLastResult({
          success: true,
          message: "Checked in successfully!",
          attendee: data.registration,
        })
        setStats(prev => ({ ...prev, checkedIn: prev.checkedIn + 1 }))
        // NOTE: camera de-dup memory is set in the decode callback (keyed on the
        // RAW decodedText), not here — setting it to the parsed `token` here was
        // the bug that broke de-dup for /v/<token> URL QR codes.
        // Add to recent check-ins
        setRecentCheckins(prev => [{
          id: data.registration?.id || Date.now().toString(),
          name: data.registration?.attendee_name || "Unknown",
          regNumber: data.registration?.registration_number || token,
          ticketType: data.registration?.ticket_type?.name,
          institution: data.registration?.attendee_institution,
          time: new Date(),
          success: true,
        }, ...prev].slice(0, 20))
      } else {
        playSound("error")
        setLastResult({
          success: false,
          message: data.error || "Check-in failed",
          alreadyCheckedIn: data.alreadyCheckedIn || false,
          errorCode: data.error_code,
          badgeEventName: data.badge_event_name,
          attendee: data.registration,
        })
        // Track failed attempts too
        setRecentCheckins(prev => [{
          id: Date.now().toString(),
          name: data.registration?.attendee_name || data.error || "Failed",
          regNumber: data.registration?.registration_number || token,
          time: new Date(),
          success: false,
        }, ...prev].slice(0, 20))
      }
    } catch (err) {
      // Network failure (fetch throws TypeError for offline / DNS / TLS /
      // aborted-by-network). Queue the scan rather than losing it. Anything
      // else — JSON parse errors, etc. — falls into the error UI.
      if (err instanceof TypeError) {
        try {
          await enqueueScan(accessToken, token)
          await refreshQueueCount()
          // Mark online=false so the header pill reflects reality —
          // navigator.onLine was true (else we'd have queued pre-emptively),
          // but the network test just disproved it.
          setOnline(false)
          playSound("success")
          setLastResult({
            success: true,
            message: "Queued offline — will sync when online",
          })
          setRecentCheckins((prev) => [{
            id: `queued-${Date.now()}`,
            name: "Queued offline",
            regNumber: token,
            time: new Date(),
            success: true,
          }, ...prev].slice(0, 20))
          return
        } catch (queueErr) {
          // IDB write itself failed (private browsing, quota, etc.) — fall
          // through to the error UI so the volunteer knows the scan was lost.
          console.error("Failed to enqueue offline scan:", queueErr)
        }
      }
      playSound("error")
      setLastResult({
        success: false,
        message: "Network error. Please try again.",
      })
    } finally {
      setProcessing(false)
      setInputValue("")
    }
  }, [processing, checkinList, accessToken, soundEnabled, refreshQueueCount])

  // Tunables for scanner-burst detection.
  const MANUAL_MIN_LEN = 3            // ignore stray 1-2 char input
  const SCANNER_MAX_AVG_GAP_MS = 50  // avg ms/keystroke at/below this = scanner
  const AUTO_SUBMIT_IDLE_MS = 200    // idle after last keystroke before submit

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setInputValue(value)

    // Anchor a fresh burst whenever the gap since the last keystroke is large
    // (new delegate / after a pause). Timing-based on purpose: a fast scanner
    // can outrun React so we must NOT depend on the `inputValue` state here.
    const now = Date.now()
    if (now - lastKeyTimeRef.current > 500) burstStartRef.current = now
    lastKeyTimeRef.current = now

    // Schedule an auto-submit for a brief idle after typing stops. Only fires if
    // the whole entry arrived at scanner speed — manual typing is too slow and
    // is left for the "Check In" button. Reads the live DOM value, not React
    // state, since a fast burst can outrun React's render.
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current)
    autoSubmitTimerRef.current = setTimeout(() => {
      autoSubmitTimerRef.current = null
      const current = (inputRef.current?.value || "").trim().toUpperCase()
      if (current.length < MANUAL_MIN_LEN) return
      const span = lastKeyTimeRef.current - burstStartRef.current
      const avgGap = current.length > 1 ? span / (current.length - 1) : 0
      if (avgGap <= SCANNER_MAX_AVG_GAP_MS) handleScan(current)
    }, AUTO_SUBMIT_IDLE_MS)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // A scanner configured with an Enter/CR suffix lands here. Cancel any
      // pending burst auto-submit and submit immediately. Read the DOM value,
      // not React state — the Enter can arrive before React flushes the last
      // characters into `inputValue` (which would submit a truncated code).
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current)
        autoSubmitTimerRef.current = null
      }
      const current = ((inputRef.current?.value || inputValue) ?? "").trim().toUpperCase()
      handleScan(current)
    }
  }

  // Clear any pending burst auto-submit on unmount.
  useEffect(() => () => {
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current)
  }, [])

  const resetResult = () => {
    setLastResult(null)
    // Do NOT clear lastScannedRef here. resetResult runs on the 5s auto-continue
    // which re-starts the camera; wiping the de-dup memory would let a badge
    // still in frame be re-decoded and fire a duplicate /api/verify. The
    // time-windowed check in the decode callback handles legitimate re-scans.
    if (autoContinueTimerRef.current) {
      clearTimeout(autoContinueTimerRef.current)
      autoContinueTimerRef.current = null
    }
    if (scanMode === "manual" && inputRef.current) {
      inputRef.current.focus()
    }
  }

  // Auto-continue effect. Manual/barcode mode re-arms fast on a SUCCESSFUL scan
  // (MANUAL_AUTO_CONTINUE_MS) so a queue can be scanned back-to-back; failures
  // and camera mode keep the full AUTO_CONTINUE_MS (the camera dedup window is
  // derived from it, so it stays untouched).
  useEffect(() => {
    if (lastResult) {
      const delay = scanMode === "manual" && lastResult.success
        ? MANUAL_AUTO_CONTINUE_MS
        : AUTO_CONTINUE_MS
      autoContinueTimerRef.current = setTimeout(() => {
        resetResult()
      }, delay)
    }
    return () => {
      if (autoContinueTimerRef.current) {
        clearTimeout(autoContinueTimerRef.current)
      }
    }
  }, [lastResult, scanMode])

  // Fetch attendee roster for list view (debounced on search/filter)
  const fetchListAttendees = useCallback(async (signal?: AbortSignal) => {
    if (!checkinList) return
    setListLoading(true)
    setListError(null)
    try {
      const url = new URL(`/api/checkin/access/${accessToken}/attendees`, window.location.origin)
      if (listSearch.trim()) url.searchParams.set("q", listSearch.trim())
      if (listStatusFilter !== "all") url.searchParams.set("status", listStatusFilter)
      url.searchParams.set("limit", "200")
      const res = await fetch(url.toString(), { signal })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to load attendees")
      }
      const data = await res.json()
      setListAttendees(data.data || [])
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setListError(err.message || "Failed to load attendees")
      }
    } finally {
      setListLoading(false)
    }
  }, [accessToken, checkinList, listSearch, listStatusFilter])

  useEffect(() => {
    if (scanMode !== "list" || !checkinList) return
    const ctrl = new AbortController()
    if (listSearchTimerRef.current) clearTimeout(listSearchTimerRef.current)
    listSearchTimerRef.current = setTimeout(() => {
      fetchListAttendees(ctrl.signal)
    }, listSearch ? 250 : 0)
    return () => {
      ctrl.abort()
      if (listSearchTimerRef.current) clearTimeout(listSearchTimerRef.current)
    }
  }, [scanMode, checkinList, listSearch, listStatusFilter, fetchListAttendees])

  // Check in a single attendee from the list view
  const checkInFromList = useCallback(async (attendee: ListAttendee) => {
    if (!checkinList || listCheckinPending) return
    setListCheckinPending(attendee.id)
    try {
      const res = await fetch(`/api/verify/${attendee.registration_number}?event_id=${checkinList.event_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkin_list_id: checkinList.id,
          access_token: accessToken,
          action: "check_in",
          performed_by: "Staff (via access link)",
        }),
      })
      const data = await res.json()
      if (data.success) {
        playSound("success")
        const wasAlready = data.action === "already_checked_in"
        // Optimistically mark this attendee as checked in
        setListAttendees(prev => prev.map(a =>
          a.id === attendee.id
            ? { ...a, checked_in: true, checked_in_at: data.registration?.checked_in_at || new Date().toISOString() }
            : a
        ))
        if (!wasAlready) {
          setStats(prev => ({ ...prev, checkedIn: prev.checkedIn + 1 }))
          setRecentCheckins(prev => [{
            id: data.registration?.id || Date.now().toString(),
            name: data.registration?.attendee_name || attendee.attendee_name,
            regNumber: data.registration?.registration_number || attendee.registration_number,
            ticketType: data.registration?.ticket_type?.name || attendee.ticket_type?.name,
            institution: data.registration?.attendee_institution || attendee.attendee_institution || undefined,
            time: new Date(),
            success: true,
          }, ...prev].slice(0, 20))
        }
      } else {
        playSound("error")
        setListError(data.error || "Check-in failed")
      }
    } catch {
      playSound("error")
      setListError("Network error. Please try again.")
    } finally {
      setListCheckinPending(null)
    }
  }, [checkinList, accessToken, listCheckinPending, soundEnabled])

  // Camera scanner setup
  const startScanner = useCallback(async () => {
    if (isStartingRef.current) return
    isStartingRef.current = true
    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop()
        } catch (e) {
          // Ignore
        }
      }

      setCameraError(null)
      setScannerReady(false)

      try {
        const scanner = new Html5Qrcode("qr-reader")
        scannerRef.current = scanner

        await scanner.start(
          { facingMode },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            // Time-windowed de-dup keyed on the RAW decodedText. Accept a scan
            // only when the 2s cooldown is clear AND this is not a repeat of the
            // same value within SCAN_REPEAT_WINDOW_MS (>5s auto-continue), so a
            // badge still in frame when the camera auto-restarts can't fire a
            // second check-in. A different badge has a different value and is
            // accepted immediately; the same badge re-scans once the window passes.
            const now = Date.now()
            const last = lastScannedRef.current
            const isWindowedRepeat =
              decodedText === last.value && now - last.ts < SCAN_REPEAT_WINDOW_MS
            if (!scanCooldownRef.current && !isWindowedRepeat) {
              lastScannedRef.current = { value: decodedText, ts: now }
              handleScan(decodedText)
            }
          },
          () => {}
        )
        setScannerReady(true)
      } catch (err: any) {
        console.error("Camera error:", err)
        setCameraError(
          err.message?.includes("Permission")
            ? "Camera permission denied. Please allow camera access."
            : "Could not access camera. Try manual entry instead."
        )
      }
    } finally {
      isStartingRef.current = false
    }
  }, [facingMode, handleScan])

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current = null
      } catch (e) {
        // Ignore
      }
    }
    setScannerReady(false)
  }, [])

  // Start/stop scanner based on mode
  useEffect(() => {
    if (scanMode === "camera" && checkinList && !lastResult) {
      startScanner()
    } else {
      stopScanner()
    }

    return () => {
      stopScanner()
    }
  }, [scanMode, checkinList, lastResult, startScanner, stopScanner])

  // Restart scanner when facing mode changes
  useEffect(() => {
    if (scanMode === "camera" && scannerReady) {
      startScanner()
    }
  }, [facingMode])

  const switchCamera = async () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment")
  }

  const toggleMode = () => {
    setScanMode(prev => prev === "camera" ? "manual" : "camera")
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  }

  const formatDateTime = (date: Date) => {
    const day = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    const time = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    return `${day}, ${time}`
  }

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-white/70 mt-6 font-medium">Connecting...</p>
        </div>
      </div>
    )
  }

  if (error || !checkinList) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center shadow-2xl">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">
            {error || "This check-in link is invalid or has expired."}
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Please contact the event organizer for a valid access link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-white font-bold text-lg">{checkinList.name}</h1>
            <p className="text-white/60 text-sm">{checkinList.events?.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl transition-all ${
                soundEnabled
                  ? "text-white/60 hover:text-white hover:bg-white/10"
                  : "text-white/30"
              }`}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            {(() => {
              // Header connectivity pill — four states:
              //   online + queue=0   -> green "Live" (the existing default)
              //   online + queue>0   -> amber "Syncing N"  (auto-flush in progress / pending)
              //   offline + queue=0  -> red "Offline"
              //   offline + queue>0  -> red "Offline · N queued"
              // Clicking the pill while online+pending forces a flush (defensive
              // affordance for the rare case the "online" event was missed).
              const isOffline = !online
              const hasQueue = queueCount > 0
              const cls = isOffline
                ? "bg-red-500/20 text-red-300"
                : hasQueue
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-emerald-500/20 text-emerald-400"
              const dotCls = isOffline ? "bg-red-500" : hasQueue ? "bg-amber-500" : "bg-emerald-500"
              const label = isOffline
                ? hasQueue ? `Offline · ${queueCount} queued` : "Offline"
                : hasQueue ? `Syncing ${queueCount}` : "Live"
              const isClickable = online && hasQueue
              return (
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => { if (isClickable) flushAllPending() }}
                  className={`flex items-center gap-1.5 ml-2 px-3 py-1.5 rounded-full ${cls} ${isClickable ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}
                  title={isClickable ? "Tap to retry syncing queued scans" : undefined}
                >
                  <span className="relative flex h-2 w-2">
                    {!isOffline && !hasQueue && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${dotCls}`}></span>
                  </span>
                  <span className="text-xs font-medium">{label}</span>
                </button>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-black/10 px-4 py-3">
        <div className="flex items-center justify-center gap-3 sm:gap-8 max-w-2xl mx-auto">
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-400">{stats.checkedIn}</p>
            <p className="text-xs text-white/50 font-medium">Checked In</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-white/50 font-medium">Total</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-3xl font-bold text-cyan-400">
              {stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0}%
            </p>
            <p className="text-xs text-white/50 font-medium">Progress</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-md mx-auto mt-3">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${stats.total > 0 ? (stats.checkedIn / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
          <button
            onClick={() => setScanMode("camera")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              scanMode === "camera"
                ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Camera className="w-5 h-5" />
            Camera
          </button>
          <button
            onClick={() => setScanMode("manual")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              scanMode === "manual"
                ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Keyboard className="w-5 h-5" />
            Manual
          </button>
          <button
            onClick={() => setScanMode("list")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              scanMode === "list"
                ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <ListIcon className="w-5 h-5" />
            List
          </button>
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-6xl mx-auto w-full">
        {/* Scanner Column */}
        <div className="flex-1 flex flex-col items-center justify-center">
        {/* Result Display */}
        {lastResult && (
          <div className={`w-full max-w-md animate-in fade-in zoom-in-95 duration-300`}>
            <div
              className={`p-8 rounded-3xl text-center relative overflow-hidden ${
                lastResult.alreadyCheckedIn
                  ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-500/50"
                  : lastResult.success
                  ? "bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border-2 border-emerald-500/50"
                  : "bg-gradient-to-br from-red-500/20 to-pink-500/20 border-2 border-red-500/50"
              }`}
            >
              {/* Background glow */}
              <div className={`absolute inset-0 ${
                lastResult.alreadyCheckedIn ? "bg-amber-500/5" : lastResult.success ? "bg-emerald-500/5" : "bg-red-500/5"
              }`} />

              <div className="relative">
                {lastResult.success && !lastResult.alreadyCheckedIn ? (
                  <>
                    <div className="w-24 h-24 mx-auto mb-4 relative">
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
                      <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-12 h-12 text-white" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                      {lastResult.attendee?.attendee_name}
                    </h2>
                    {lastResult.attendee?.registration_number && (
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl mb-3">
                        <Hash className="w-5 h-5 text-emerald-300" />
                        <span className="font-mono text-xl font-bold text-white tracking-wider">
                          {lastResult.attendee.registration_number}
                        </span>
                      </div>
                    )}
                    {lastResult.attendee?.ticket_type && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 rounded-full mb-2">
                        <Ticket className="w-3.5 h-3.5 text-emerald-300" />
                        <span className="text-emerald-300 text-sm font-medium">
                          {lastResult.attendee.ticket_type.name}
                        </span>
                      </div>
                    )}
                    {lastResult.attendee?.attendee_institution && (
                      <p className="text-white/60 text-sm flex items-center justify-center gap-1.5 mb-2">
                        <Building2 className="w-3.5 h-3.5" />
                        {lastResult.attendee.attendee_institution}
                      </p>
                    )}
                    <p className="text-emerald-300 text-sm mt-3 font-medium">{lastResult.message}</p>
                  </>
                ) : lastResult.alreadyCheckedIn ? (
                  <>
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">✓ ALREADY CHECKED IN</h2>
                    {lastResult.attendee && (
                      <p className="text-white text-lg font-semibold mb-2">
                        {lastResult.attendee.attendee_name}
                      </p>
                    )}
                    {lastResult.attendee?.registration_number && (
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl mb-2">
                        <Hash className="w-5 h-5 text-amber-300" />
                        <span className="font-mono text-xl font-bold text-white tracking-wider">
                          {lastResult.attendee.registration_number}
                        </span>
                      </div>
                    )}
                    <p className="text-amber-200">
                      {/* Desk/volunteer identity isn't captured yet (planned in a
                          follow-up) — shows the check-in time only until then. */}
                      {lastResult.checkedInAt
                        ? `Checked in at ${formatTime(new Date(lastResult.checkedInAt))}`
                        : lastResult.message}
                    </p>
                  </>
                ) : lastResult.errorCode === "wrong_event" ? (
                  <>
                    <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <XCircle className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">✗ WRONG EVENT</h2>
                    <p className="text-red-200">
                      This badge is for {lastResult.badgeEventName || "a different event"}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <XCircle className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Check-in Failed</h2>
                    <p className="text-red-200">{lastResult.message}</p>
                  </>
                )}

                <div className="mt-6">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden max-w-[200px] mx-auto">
                    <div
                      className={`h-full rounded-full ${
                        lastResult.alreadyCheckedIn ? "bg-amber-400" : lastResult.success ? "bg-emerald-400" : "bg-red-400"
                      }`}
                      style={{
                        animation: "shrink 5s linear forwards",
                      }}
                    />
                  </div>
                  {lastResult.alreadyCheckedIn ? (
                    // The volunteer build this replaces trained staff to read a
                    // repeat scan as "stop them." A colour/sound change alone
                    // won't retrain that reflex — the button has to say the
                    // instruction outright, and it has to be the loudest thing
                    // on the screen.
                    <button
                      onClick={resetResult}
                      className="mt-4 w-full max-w-xs mx-auto px-8 py-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xl font-extrabold tracking-wide rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 transition-all"
                    >
                      <CheckCircle className="w-7 h-7" />
                      LET THEM IN
                    </button>
                  ) : (
                    <button
                      onClick={resetResult}
                      className="mt-4 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center gap-2 mx-auto transition-all font-medium"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Scan Next
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Camera Scanner */}
        {!lastResult && scanMode === "camera" && (
          <div className="w-full max-w-md">
            <div className="bg-black/30 backdrop-blur-sm rounded-3xl overflow-hidden border border-white/10">
              {cameraError ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-red-300 mb-4">{cameraError}</p>
                  <button
                    onClick={() => startScanner()}
                    className="px-6 py-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors font-medium"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <div id="qr-reader" className="w-full" style={{ minHeight: "250px" }} />
                    {!scannerReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                        <div className="text-center">
                          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
                          <p className="text-white/60 mt-3">Starting camera...</p>
                        </div>
                      </div>
                    )}
                    {/* Camera controls */}
                    {scannerReady && (
                      <div className="absolute bottom-4 right-4 left-4 flex justify-between items-center">
                        <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                          facingMode === "user"
                            ? "bg-emerald-500/80 text-white"
                            : "bg-black/50 text-white/70"
                        }`}>
                          {facingMode === "user" ? "Kiosk Mode" : "Staff Mode"}
                        </div>
                        <button
                          onClick={switchCamera}
                          className="flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                        >
                          <SwitchCamera className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {facingMode === "environment" ? "Front" : "Back"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-4 text-center border-t border-white/10">
                    <p className="text-white/60 text-sm">
                      {facingMode === "user"
                        ? "Hold your badge QR code to the camera"
                        : "Point camera at the badge QR code"
                      }
                    </p>
                  </div>
                </>
              )}
            </div>

            {processing && (
              <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Processing...</span>
              </div>
            )}
          </div>
        )}

        {/* Manual Input */}
        {!lastResult && scanMode === "manual" && (
          <div className="w-full max-w-md">
            <div className="bg-black/30 backdrop-blur-sm rounded-3xl p-8 text-center border border-white/10">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-white text-xl font-bold mb-2">Manual Entry</h2>
              <p className="text-white/50 text-sm mb-6">
                Use a barcode scanner or enter the registration number
              </p>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={handleManualChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter reg number..."
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-center text-base sm:text-lg font-mono tracking-wider"
                  disabled={processing}
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="characters"
                />
              </div>

              {inputValue && (
                <button
                  onClick={() => {
                    if (autoSubmitTimerRef.current) {
                      clearTimeout(autoSubmitTimerRef.current)
                      autoSubmitTimerRef.current = null
                    }
                    handleScan(inputValue)
                  }}
                  disabled={processing}
                  className="mt-4 w-full px-4 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50"
                >
                  Check In
                </button>
              )}

              {processing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">Processing...</span>
                </div>
              )}
            </div>

            {/* Quick tips */}
            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-white/40 text-xs text-center">
                Tip: Use a USB/Bluetooth barcode scanner for faster check-ins
              </p>
            </div>
          </div>
        )}

        {/* Attendee List */}
        {!lastResult && scanMode === "list" && (
          <div className="w-full max-w-2xl">
            <div className="bg-black/30 backdrop-blur-sm rounded-3xl border border-white/10 flex flex-col max-h-[70vh]">
              {/* Search + filter */}
              <div className="p-4 border-b border-white/10 space-y-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    placeholder="Search name, reg number, email, or phone..."
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-2 text-sm">
                  {([
                    { key: "all", label: "All" },
                    { key: "not_checked_in", label: "Pending" },
                    { key: "checked_in", label: "Checked in" },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setListStatusFilter(opt.key)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                        listStatusFilter === opt.key
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* List body */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {listLoading && listAttendees.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                  </div>
                ) : listError ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-red-300 text-sm">{listError}</p>
                  </div>
                ) : listAttendees.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6 text-white/20" />
                    </div>
                    <p className="text-white/40 text-sm">No attendees match</p>
                  </div>
                ) : (
                  listAttendees.map(attendee => (
                    <div
                      key={attendee.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        attendee.checked_in
                          ? "bg-emerald-500/10 border-emerald-500/20"
                          : "bg-white/5 border-white/10"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        attendee.checked_in
                          ? "bg-emerald-500/30 text-emerald-300"
                          : "bg-white/10 text-white/60"
                      }`}>
                        {getInitials(attendee.attendee_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{attendee.attendee_name}</p>
                        <div className="flex items-center gap-2 text-xs text-white/40">
                          <span className="font-mono">{attendee.registration_number}</span>
                          {attendee.ticket_type?.name && (
                            <>
                              <span>•</span>
                              <span className="truncate">{attendee.ticket_type.name}</span>
                            </>
                          )}
                          {attendee.checked_in && attendee.checked_in_at && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-300/80 whitespace-nowrap">
                                In at {formatDateTime(new Date(attendee.checked_in_at))}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {attendee.checked_in ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 rounded-full flex-shrink-0">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs text-emerald-300 font-medium">In</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => checkInFromList(attendee)}
                          disabled={listCheckinPending === attendee.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-full text-xs font-medium disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-500/25 transition-all flex-shrink-0"
                        >
                          {listCheckinPending === attendee.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Check In
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer count */}
              <div className="px-4 py-2 border-t border-white/10 text-center">
                <p className="text-white/40 text-xs">
                  Showing {listAttendees.length} attendee{listAttendees.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Recent Check-ins Sidebar */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl border border-white/10 h-full max-h-[500px] lg:max-h-[600px] flex flex-col">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/60">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium text-sm">Recent Scans</span>
                </div>
                <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">
                  {recentCheckins.length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {recentCheckins.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-white/20" />
                  </div>
                  <p className="text-white/30 text-sm">No scans yet</p>
                  <p className="text-white/20 text-xs mt-1">Scanned attendees will appear here</p>
                </div>
              ) : (
                recentCheckins.map((checkin, idx) => (
                  <div
                    key={checkin.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      checkin.success
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : "bg-red-500/10 border border-red-500/20"
                    } ${idx === 0 ? "ring-2 ring-emerald-500/30 animate-in fade-in slide-in-from-top-2 duration-300" : ""}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      checkin.success ? "bg-emerald-500/30 text-emerald-300" : "bg-red-500/30 text-red-300"
                    }`}>
                      {checkin.success ? getInitials(checkin.name) : "!"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${checkin.success ? "text-emerald-200" : "text-red-200"}`}>
                        {checkin.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <span>{checkin.ticketType || checkin.regNumber}</span>
                        <span>•</span>
                        <span>{formatTime(checkin.time)}</span>
                      </div>
                    </div>
                    {checkin.success ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-black/20 px-4 py-3 text-center border-t border-white/10">
        <p className="text-white/30 text-xs">
          Staff Check-in • {checkinList.name}
        </p>
      </div>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
