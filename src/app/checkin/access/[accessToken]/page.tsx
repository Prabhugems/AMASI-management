"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useSearchParams } from "next/navigation"
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
  SwitchCamera,
  AlertCircle,
  List as ListIcon,
  Users,
  Pencil,
} from "lucide-react"
import { Html5Qrcode } from "html5-qrcode"
import {
  enqueueScan,
  flushQueue,
  pendingCount,
  isNetworkFailure,
  type FlushResult,
} from "@/lib/offline-scan-queue"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

interface CheckinList {
  id: string
  name: string
  event_id: string
  list_purpose: "entry" | "collection"
  events: {
    id: string
    name: string
  }
}

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

// A running feed of the last ~10 scans, newest first. Replaces the old
// single "lastResult" card entirely — there is nothing to show/dismiss,
// just a log that keeps growing while the camera keeps running.
type FeedStatus = "pending" | "checked_in" | "already_in" | "wrong_event" | "not_found" | "queued_offline" | "error"

interface FeedEntry {
  id: string
  code: string // Q5 — every entry is keyed to the scanned code it belongs to
  status: FeedStatus
  attendeeName?: string
  regNumber?: string
  ticketType?: string
  checkedInAt?: string
  badgeEventName?: string
  message?: string
  time: Date
}

interface VolunteerIdentity {
  volunteerName: string
  deskLabel: string
}

type ScanMode = "camera" | "manual" | "list"

// Q2 — same code seen again within this window is silently ignored (still
// in the volunteer's hand, camera re-saw it). A different code is never
// throttled, at any point. This replaces the old global 2s cooldown +
// 7s repeat-window pair entirely; there is no "hold" state left to derive
// a window from.
const RECENT_SCAN_DEDUP_MS = 60_000

const FEED_LIMIT = 10

function newFeedId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function StaffCheckinPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const accessToken = params.accessToken as string
  // Q-telemetry — the burst-scan investigation harness, kept in behind a
  // debug flag (docs/telemetry-burst-scan-2026-07.md) so the exact 20-card
  // burst test can be re-run against this build without redeploying
  // instrumented code. This route is unauthenticated (access is via an
  // unguessable token, not a login) and the link circulates among
  // volunteers, so ?debug=1 alone would let anyone who's ever held a scan
  // link turn on verbose logging. NODE_ENV also has to be non-production —
  // there is no way to arm this in a live deployment.
  const debugMode = process.env.NODE_ENV !== "production" && searchParams.get("debug") === "1"

  const [loading, setLoading] = useState(true)
  const [checkinList, setCheckinList] = useState<CheckinList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [stats, setStats] = useState({ total: 0, checkedIn: 0 })
  const [scanMode, setScanMode] = useState<ScanMode>("camera")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scannerReady, setScannerReady] = useState(false)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")

  // Q3/Q6 — the feed and the session counter. Camera never stops for either.
  const [scanFeed, setScanFeed] = useState<FeedEntry[]>([])
  const [scannedThisSession, setScannedThisSession] = useState(0)

  // Item 6 — volunteer identity, hard-gated on first open. Persisted per
  // access token so a reload doesn't re-prompt, but a fresh access link
  // (different desk) always does.
  const [identity, setIdentity] = useState<VolunteerIdentity | null>(null)
  const [showIdentityForm, setShowIdentityForm] = useState(false)
  const [identityDraft, setIdentityDraft] = useState({ volunteerName: "", deskLabel: "" })

  // Offline scan queue (src/lib/offline-scan-queue.ts) state.
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
  const isStartingRef = useRef(false)
  // Q2's Map: code -> last-accepted timestamp. Read/written by processScan.
  const recentScanMapRef = useRef<Map<string, number>>(new Map())

  // Manual-entry scanner auto-submit. A USB/QR scanner types the whole code in a
  // fast burst (characters land a few ms apart) and many models do NOT send a
  // trailing Enter, so the box used to just fill and wait for a manual "Check
  // In" press. We detect the burst and auto-submit on a brief idle. Human
  // typing is slower, so it falls through to the button instead of mis-firing.
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const burstStartRef = useRef<number>(0)
  const lastKeyTimeRef = useRef<number>(0)

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

  // Load (or prompt for) volunteer identity once the access token is known.
  useEffect(() => {
    if (!accessToken) return
    try {
      const raw = localStorage.getItem(`checkin_identity_${accessToken}`)
      if (raw) {
        setIdentity(JSON.parse(raw))
        return
      }
    } catch {
      // localStorage unavailable — fall through to the form every time.
    }
    setShowIdentityForm(true)
  }, [accessToken])

  const saveIdentity = () => {
    const volunteerName = identityDraft.volunteerName.trim()
    const deskLabel = identityDraft.deskLabel.trim()
    if (!volunteerName || !deskLabel) return
    const next: VolunteerIdentity = { volunteerName, deskLabel }
    setIdentity(next)
    try {
      localStorage.setItem(`checkin_identity_${accessToken}`, JSON.stringify(next))
    } catch {
      // Best effort — identity still applies for this session even if it
      // can't persist across a reload.
    }
    setShowIdentityForm(false)
  }

  const openIdentityForm = () => {
    setIdentityDraft(identity || { volunteerName: "", deskLabel: "" })
    setShowIdentityForm(true)
  }

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    return () => {
      audioContextRef.current?.close()
    }
  }, [])

  const playSound = (type: "tick" | "success" | "error" | "warning") => {
    if (!soundEnabled || !audioContextRef.current) return
    try {
      const ctx = audioContextRef.current
      if (ctx.state === "suspended") {
        ctx.resume()
      }

      if (type === "tick") {
        // Q4 — fires the instant a code is accepted by the dedup Map, before
        // we know the server's verdict. In a burst nobody is watching the
        // screen; this is the "yes, the camera saw that one" confirmation.
        // Deliberately quiet/short/neutral so it doesn't compete with the
        // real success/warning/error tone that follows once the response
        // resolves (a few hundred ms later, typically).
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(1200, ctx.currentTime)
        gain.gain.setValueAtTime(0.12, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.05)
        return
      }

      if (type === "warning") {
        // Distinct double-tone for "already collected — do not issue again".
        // Deliberately NOT the success chime (ascending, one sweep) and NOT
        // the error buzzer (harsh square wave) — two identical flat beeps,
        // audibly its own thing, so a volunteer working by ear alone can
        // tell it apart from both other outcomes.
        for (const startOffset of [0, 0.18]) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.setValueAtTime(660, ctx.currentTime + startOffset)
          gain.gain.setValueAtTime(0.3, ctx.currentTime + startOffset)
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startOffset + 0.15)
          osc.start(ctx.currentTime + startOffset)
          osc.stop(ctx.currentTime + startOffset + 0.15)
        }
        if (navigator.vibrate) navigator.vibrate([120, 80, 120])
        return
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
  // a feed entry so the volunteer sees what just landed, same as a live scan.
  const flushAllPending = useCallback(async () => {
    if (flushInFlightRef.current) return
    flushInFlightRef.current = true
    try {
      await flushQueue(accessToken, (result: FlushResult) => {
        if (result.success) {
          const reg = (result.response as { registration?: { id?: string; attendee_name?: string; registration_number?: string; ticket_type?: { name?: string }; checked_in_at?: string } } | undefined)?.registration
          const isAlready = (result.response as { alreadyCheckedIn?: boolean } | undefined)?.alreadyCheckedIn
          if (!isAlready) {
            setStats((prev) => ({ ...prev, checkedIn: prev.checkedIn + 1 }))
          }
          const entry: FeedEntry = {
            id: newFeedId(),
            code: result.scan.token,
            status: isAlready ? "already_in" : "checked_in",
            attendeeName: reg?.attendee_name,
            regNumber: reg?.registration_number,
            ticketType: reg?.ticket_type?.name,
            checkedInAt: reg?.checked_in_at,
            time: new Date(),
          }
          setScanFeed((prev) => [entry, ...prev].slice(0, FEED_LIMIT))
        } else {
          const entry: FeedEntry = {
            id: newFeedId(),
            code: result.scan.token,
            status: "error",
            message: result.terminalError || "Sync failed",
            time: new Date(),
          }
          setScanFeed((prev) => [entry, ...prev].slice(0, FEED_LIMIT))
        }
      })
    } finally {
      flushInFlightRef.current = false
      await refreshQueueCount()
    }
  }, [accessToken, refreshQueueCount])

  // Wire online/offline detection + initial queue load.
  useEffect(() => {
    if (!accessToken) return

    const onOnline = () => {
      setOnline(true)
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

  // The single entry point for every scan — camera decode, manual typing, or
  // a barcode scanner's auto-submit. Q2's dedup Map lives here: same code
  // within RECENT_SCAN_DEDUP_MS is silently ignored (no feed entry, no tone,
  // no network call — it never happened as far as the system is concerned).
  // Anything else is accepted instantly, no throttle. Q6's counter increments
  // the moment a scan is ACCEPTED here, before the server verdict is known —
  // that's what makes a silent drop visible: "scanned 20, feed/list disagree".
  // Returns the parsed /api/verify response so callers that need the
  // outcome (the List tab, to update its own row) can react to it — the
  // camera/manual paths ignore the return value, same as before. Returns
  // `null` for a suppressed duplicate, a queued-offline scan, or a network
  // error — none of those carry a server response to hand back.
  const processScan = useCallback(async (rawValue: string, source: "camera" | "manual" | "list") => {
    if (!rawValue.trim() || !checkinList) return null

    let token = rawValue.trim()
    const urlMatch = token.match(/\/v\/([A-Za-z0-9_-]+)/)
    if (urlMatch) token = urlMatch[1]

    const now = Date.now()
    const lastSeen = recentScanMapRef.current.get(token)
    const isRecentDup = lastSeen !== undefined && now - lastSeen < RECENT_SCAN_DEDUP_MS
    if (debugMode) {
      // eslint-disable-next-line no-console
      console.log("[SCAN_TELEMETRY]", JSON.stringify({
        token, now, source,
        msSinceLast: lastSeen !== undefined ? now - lastSeen : null,
        verdict: isRecentDup ? "SUPPRESSED_RECENT_MAP" : "ACCEPTED",
      }))
    }
    if (isRecentDup) return null
    recentScanMapRef.current.set(token, now)

    const feedId = newFeedId()
    playSound("tick")
    setScannedThisSession((n) => n + 1)
    const pendingEntry: FeedEntry = { id: feedId, code: token, status: "pending", time: new Date() }
    setScanFeed((prev) => [pendingEntry, ...prev].slice(0, FEED_LIMIT))

    const performedBy = identity ? `${identity.volunteerName} (${identity.deskLabel})` : "Staff (via access link)"
    const deviceInfo = { volunteer: identity?.volunteerName, desk: identity?.deskLabel, source }

    const updateEntry = (patch: Partial<FeedEntry>) => {
      setScanFeed((prev) => prev.map((e) => (e.id === feedId ? { ...e, ...patch, time: new Date() } : e)))
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueScan(accessToken, token, performedBy, deviceInfo)
      await refreshQueueCount()
      playSound("success")
      updateEntry({ status: "queued_offline", message: "Queued offline — will sync when online" })
      return null
    }

    try {
      // Hard 3s timeout — a hung request on saturated venue wifi must never
      // block the lane. navigator.onLine stays true and nothing throws on a
      // TCP connection that just never responds; fetchWithTimeout turns that
      // into a normal, catchable failure so it queues like any other outage.
      const res = await fetchWithTimeout(`/api/verify/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkin_list_id: checkinList.id,
          access_token: accessToken,
          action: "check_in",
          performed_by: performedBy,
          device_info: deviceInfo,
        }),
      })

      const data = await res.json()

      if (data.alreadyCheckedIn) {
        // Legitimate repeat scan — never the error buzzer. Which chime
        // depends on list_purpose: entry means "let them in" (soft chime);
        // collection means "already collected, do not issue again" (distinct
        // double-tone).
        playSound(checkinList.list_purpose === "collection" ? "warning" : "success")
        updateEntry({
          status: "already_in",
          attendeeName: data.registration?.attendee_name,
          regNumber: data.registration?.registration_number,
          ticketType: data.registration?.ticket_type?.name,
          checkedInAt: data.registration?.checked_in_at,
          message: data.message,
        })
      } else if (data.success) {
        playSound("success")
        setStats((prev) => ({ ...prev, checkedIn: prev.checkedIn + 1 }))
        updateEntry({
          status: "checked_in",
          attendeeName: data.registration?.attendee_name,
          regNumber: data.registration?.registration_number,
          ticketType: data.registration?.ticket_type?.name,
        })
      } else {
        playSound("error")
        updateEntry({
          status: data.error_code === "wrong_event" ? "wrong_event" : "not_found",
          attendeeName: data.registration?.attendee_name,
          regNumber: data.registration?.registration_number,
          badgeEventName: data.badge_event_name,
          message: data.error,
        })
      }
      return data
    } catch (err) {
      // Network failure — offline/DNS/TLS (TypeError) or a timed-out hang on
      // bad wifi (AbortError, from fetchWithTimeout above). Either way, queue
      // the scan rather than losing it.
      if (isNetworkFailure(err)) {
        try {
          await enqueueScan(accessToken, token, performedBy, deviceInfo)
          await refreshQueueCount()
          setOnline(false)
          playSound("success")
          updateEntry({ status: "queued_offline", message: "Queued offline — will sync when online" })
          return null
        } catch (queueErr) {
          console.error("Failed to enqueue offline scan:", queueErr)
        }
      }
      playSound("error")
      updateEntry({ status: "error", message: "Network error. Please try again." })
      return null
    }
  }, [checkinList, accessToken, identity, refreshQueueCount, debugMode, soundEnabled])

  // Tunables for scanner-burst detection.
  const MANUAL_MIN_LEN = 3            // ignore stray 1-2 char input
  const SCANNER_MAX_AVG_GAP_MS = 50  // avg ms/keystroke at/below this = scanner
  const AUTO_SUBMIT_IDLE_MS = 200    // idle after last keystroke before submit

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setInputValue(value)

    const now = Date.now()
    if (now - lastKeyTimeRef.current > 500) burstStartRef.current = now
    lastKeyTimeRef.current = now

    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current)
    autoSubmitTimerRef.current = setTimeout(() => {
      autoSubmitTimerRef.current = null
      const current = (inputRef.current?.value || "").trim().toUpperCase()
      if (current.length < MANUAL_MIN_LEN) return
      const span = lastKeyTimeRef.current - burstStartRef.current
      const avgGap = current.length > 1 ? span / (current.length - 1) : 0
      if (avgGap <= SCANNER_MAX_AVG_GAP_MS) {
        processScan(current, "manual")
        setInputValue("")
      }
    }, AUTO_SUBMIT_IDLE_MS)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current)
        autoSubmitTimerRef.current = null
      }
      const current = ((inputRef.current?.value || inputValue) ?? "").trim().toUpperCase()
      processScan(current, "manual")
      setInputValue("")
    }
  }

  useEffect(() => () => {
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current)
  }, [])

  // Focus recovery for hardware-scanner lanes. A keyboard-wedge scanner
  // types into whatever field currently has focus — if focus is ever lost,
  // the next physical scan goes nowhere and nobody notices until badges stop
  // moving. The known way to lose it: the "Check In" button only renders
  // while `inputValue` is truthy (see the JSX below), so clicking it clears
  // the value and the button unmounts out from under its own click — focus
  // reverts to document.body with nothing to reclaim it. Any stray tap on a
  // non-interactive part of the page (a feed card, the background) does the
  // same. `focusout` (unlike `blur`) bubbles, so a document-level listener
  // catches focus leaving ANY descendant, including one that's about to be
  // removed from the DOM.
  useEffect(() => {
    if (scanMode !== "manual") return

    const isInteractive = (el: Element | null) =>
      !!el && (el === inputRef.current || /^(INPUT|BUTTON|A|SELECT|TEXTAREA)$/.test(el.tagName))

    const reclaim = () => {
      if (!isInteractive(document.activeElement)) {
        inputRef.current?.focus()
      }
    }

    const onFocusOut = () => {
      // Run after the DOM settles (the vanishing button's removal, a click's
      // default focus behavior) rather than mid-event.
      requestAnimationFrame(reclaim)
    }
    const onDocClick = (e: MouseEvent) => {
      if (!isInteractive(e.target as Element)) {
        requestAnimationFrame(reclaim)
      }
    }

    document.addEventListener("focusout", onFocusOut)
    document.addEventListener("click", onDocClick)
    reclaim()

    return () => {
      document.removeEventListener("focusout", onFocusOut)
      document.removeEventListener("click", onDocClick)
    }
  }, [scanMode])

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
      // Hard 3s timeout on top of the caller's own cancel-on-new-search
      // signal — a hung roster fetch on bad wifi must not leave the List tab
      // stuck on "Loading…" forever.
      const res = await fetchWithTimeout(url.toString(), { signal })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to load attendees")
      }
      const data = await res.json()
      setListAttendees(data.data || [])
    } catch (err: any) {
      if (signal?.aborted) {
        // The caller's own signal fired — a newer search superseded this
        // one. Intentional, not an error.
        return
      }
      if (err?.name === "AbortError") {
        // Our own timeout fired, not the caller's cancel signal above.
        setListError("Request timed out. Check your connection and try again.")
        return
      }
      setListError(err.message || "Failed to load attendees")
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

  // Check in a single attendee from the list view. Routes through the same
  // processScan the camera/manual tabs use — one dedup map, one feed, one
  // session counter, regardless of which tab a volunteer is on. Before this,
  // list check-ins were invisible to both: the session counter (item 10 —
  // the counter existed to catch under-reporting, and a check-in path it
  // didn't see was exactly the kind of gap it was supposed to catch) and the
  // scan feed. This still does its own thing on top: updates the row in the
  // roster table, which processScan has no reason to know about.
  const checkInFromList = useCallback(async (attendee: ListAttendee) => {
    if (!checkinList || listCheckinPending) return
    setListCheckinPending(attendee.id)
    try {
      const data = await processScan(attendee.registration_number, "list")
      if (data?.alreadyCheckedIn || data?.success) {
        setListAttendees(prev => prev.map(a =>
          a.id === attendee.id
            ? { ...a, checked_in: true, checked_in_at: data.registration?.checked_in_at || new Date().toISOString() }
            : a
        ))
      } else if (data) {
        setListError(data.error || "Check-in failed")
      }
      // data === null: either a duplicate suppressed within the last 60s
      // (processScan already ignored it silently, nothing to surface here)
      // or a network/offline case processScan already handled — the queued
      // scan's own feed entry covers that; no separate error needed.
    } finally {
      setListCheckinPending(null)
    }
  }, [checkinList, listCheckinPending, processScan])

  // Camera scanner setup. Q1 — this is called once when entering camera mode
  // and is NEVER stopped in response to a scan result. There is no more
  // "stop on result, restart after the hold" cycle; the feed and counter
  // update in place while the camera keeps running underneath.
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

        const handleCameraDecode = (decodedText: string) => {
          processScan(decodedText, "camera")
        }
        if (debugMode && typeof window !== "undefined") {
          (window as any).__debugFeedDecode = handleCameraDecode
        }

        await scanner.start(
          { facingMode },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          handleCameraDecode,
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
  }, [facingMode, processScan, debugMode])

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

  // Start/stop scanner based on mode ONLY — no dependency on any scan result.
  // Also gated on !showIdentityForm: the #qr-reader div this mounts into only
  // exists in the main render branch, not the identity-gate branch — without
  // this check, startScanner() fires (and fails to find the element) the
  // instant checkinList loads, even while the identity modal is still what's
  // actually on screen.
  useEffect(() => {
    if (scanMode === "camera" && checkinList && !showIdentityForm) {
      startScanner()
    } else {
      stopScanner()
    }

    return () => {
      stopScanner()
    }
  }, [scanMode, checkinList, showIdentityForm, startScanner, stopScanner])

  // Restart scanner when facing mode changes
  useEffect(() => {
    if (scanMode === "camera" && scannerReady) {
      startScanner()
    }
  }, [facingMode])

  const switchCamera = async () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment")
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

  // Display config for a feed row — one place that maps a FeedEntry's status
  // (+ this list's purpose, for "already_in") to color/icon/label.
  const feedDisplay = (entry: FeedEntry) => {
    switch (entry.status) {
      case "pending":
        return { color: "border-white/10 bg-white/5", dot: "bg-white/30", label: "Checking…" }
      case "checked_in":
        return { color: "border-emerald-500/20 bg-emerald-500/10", dot: "bg-emerald-400", label: "✓ Checked in" }
      case "already_in":
        return checkinList?.list_purpose === "collection"
          ? { color: "border-amber-500/20 bg-amber-500/10", dot: "bg-amber-400", label: "⚠ Already collected" }
          : { color: "border-amber-500/20 bg-amber-500/10", dot: "bg-amber-400", label: "✓ Already checked in" }
      case "wrong_event":
        return { color: "border-red-500/20 bg-red-500/10", dot: "bg-red-400", label: "✗ Wrong event" }
      case "not_found":
        return { color: "border-red-500/20 bg-red-500/10", dot: "bg-red-400", label: "✗ Not on this list" }
      case "queued_offline":
        return { color: "border-sky-500/20 bg-sky-500/10", dot: "bg-sky-400", label: "Queued offline" }
      case "error":
      default:
        return { color: "border-red-500/20 bg-red-500/10", dot: "bg-red-400", label: "✗ Error" }
    }
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

  if (showIdentityForm) {
    const canSave = identityDraft.volunteerName.trim() && identityDraft.deskLabel.trim()
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-black/30 backdrop-blur-sm rounded-3xl max-w-md w-full p-8 border border-white/10">
          <h1 className="text-white text-xl font-bold mb-1">Who&apos;s scanning?</h1>
          <p className="text-white/50 text-sm mb-6">
            Every scan on this list gets attributed to you and your desk. Required before scanning.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Your name</label>
              <input
                type="text"
                value={identityDraft.volunteerName}
                onChange={(e) => setIdentityDraft({ ...identityDraft, volunteerName: e.target.value })}
                placeholder="e.g. Priya"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Scan point / desk</label>
              <input
                type="text"
                value={identityDraft.deskLabel}
                onChange={(e) => setIdentityDraft({ ...identityDraft, deskLabel: e.target.value })}
                placeholder="e.g. Desk 2"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <button
              onClick={saveIdentity}
              disabled={!canSave}
              className="w-full px-4 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start scanning
            </button>
          </div>
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
            {identity && (
              <button
                onClick={openIdentityForm}
                className="mt-0.5 flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors"
              >
                {identity.volunteerName} · {identity.deskLabel}
                <Pencil className="w-3 h-3" />
              </button>
            )}
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

      {/* Stats Bar — check-ins on the LIST (shared, server truth). NOT the
          same thing as the session counter below (this device's own tally). */}
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
            Scan
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-6xl mx-auto w-full">
        <div className="flex-1 flex flex-col items-center">
          {/* Queue mode: camera + session counter + scan feed. The camera
              never stops here — there is no result screen to unmount it. */}
          {scanMode === "camera" && (
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
                          : "Point camera at the badge QR code — keep scanning, nothing to dismiss"
                        }
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Q6 — session counter. NOT the stats bar above: this is
                  scans on THIS DEVICE, THIS SESSION, so a volunteer can
                  check it against the physical stack in their hand. */}
              <div className="mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-white/5 rounded-xl border border-white/10">
                <span className="text-white/60 text-sm">Scanned this session:</span>
                <span className="text-white text-xl font-bold">{scannedThisSession}</span>
              </div>

              {/* Q3 — scan feed. Newest on top, last 10, nothing to dismiss. */}
              <div className="mt-3 space-y-2">
                {scanFeed.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-6">No scans yet this session</p>
                ) : (
                  scanFeed.map((entry) => {
                    const display = feedDisplay(entry)
                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${display.color}`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${display.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">
                            {entry.attendeeName || entry.regNumber || entry.code}
                          </p>
                          <p className="text-white/50 text-xs truncate">
                            {display.label}
                            {entry.ticketType ? ` · ${entry.ticketType}` : ""}
                            {entry.badgeEventName ? ` · for ${entry.badgeEventName}` : ""}
                          </p>
                        </div>
                        <span className="text-white/40 text-xs flex-shrink-0">{formatTime(entry.time)}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Manual Input */}
          {scanMode === "manual" && (
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
                      processScan(inputValue, "manual")
                      setInputValue("")
                    }}
                    className="mt-4 w-full px-4 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-emerald-500/25"
                  >
                    Check In
                  </button>
                )}
              </div>

              <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-white/40 text-xs text-center">
                  Tip: Use a USB/Bluetooth barcode scanner for faster check-ins
                </p>
              </div>

              {/* Same feed + counter as queue mode — manual entries land here too. */}
              <div className="mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-white/5 rounded-xl border border-white/10">
                <span className="text-white/60 text-sm">Scanned this session:</span>
                <span className="text-white text-xl font-bold">{scannedThisSession}</span>
              </div>
              <div className="mt-3 space-y-2">
                {scanFeed.map((entry) => {
                  const display = feedDisplay(entry)
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${display.color}`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${display.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {entry.attendeeName || entry.regNumber || entry.code}
                        </p>
                        <p className="text-white/50 text-xs truncate">{display.label}</p>
                      </div>
                      <span className="text-white/40 text-xs flex-shrink-0">{formatTime(entry.time)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Attendee List — second screen, not home */}
          {scanMode === "list" && (
            <div className="w-full max-w-2xl">
              <div className="bg-black/30 backdrop-blur-sm rounded-3xl border border-white/10 flex flex-col max-h-[70vh]">
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

                <div className="px-4 py-2 border-t border-white/10 text-center">
                  <p className="text-white/40 text-xs">
                    Showing {listAttendees.length} attendee{listAttendees.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-black/20 px-4 py-3 text-center border-t border-white/10">
        <p className="text-white/30 text-xs">
          Staff Check-in • {checkinList.name}
        </p>
      </div>
    </div>
  )
}
