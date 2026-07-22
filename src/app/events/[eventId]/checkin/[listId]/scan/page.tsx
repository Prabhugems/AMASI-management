"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { QrImage } from "@/components/QrImage"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useQrCameraScanner } from "@/hooks/use-qr-camera-scanner"
import {
  enqueueRequest,
  flushRequestQueue,
  pendingRequestCount,
  isNetworkFailure,
  type RequestFlushResult,
} from "@/lib/offline-scan-queue"
import {
  ArrowLeft,
  QrCode,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  List,
  RotateCcw,
  Trash2,
  LogOut,
  LogIn,
  Wifi,
  WifiOff,
  Keyboard,
  Clock,
  Ticket,
  X,
  Share2,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Camera,
  CameraOff,
  Loader2
} from "lucide-react"

interface ScanResult {
  type: "success" | "error" | "warning" | "already" | "not_checked_in" | "queued"
  message: string
  registrationId?: string
  // Non-blocking note attached to an otherwise-successful check-in (e.g.
  // outside a list's configured time window) — informational, never changes
  // the success/error classification above.
  warning?: string
  attendee?: {
    name: string
    email: string
    ticket: string
    registration_number: string
    institution?: string
  }
}

interface Stats {
  list: {
    id: string
    name: string
    description: string | null
    access_token?: string | null
    access_token_expires_at?: string | null
  }
  total: number
  checkedIn: number
  notCheckedIn: number
  percentage: number
  byTicketType?: { id: string; name: string; total: number; checkedIn: number; percentage: number }[]
}

interface RecentScan {
  id: string
  name: string
  registrationNumber: string
  registrationId?: string
  time: string
  status: "success" | "error" | "already"
}

export default function CheckinScanPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const listId = params.listId as string
  // Namespaced distinctly from staff-scanner access tokens so the two
  // offline queues can never collide even by coincidence.
  const queuePartitionKey = `admin:${eventId}:${listId}`

  const [manualSearch, setManualSearch] = useState("")
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])
  const [checkoutMode, setCheckoutMode] = useState(false)
  const [showKeyboardHints, setShowKeyboardHints] = useState(false)
  const [showTicketStats, setShowTicketStats] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showMobileRecent, setShowMobileRecent] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [lastCheckedInId, setLastCheckedInId] = useState<string | null>(null)
  // Camera scanning is opt-in and off by default: this page is mostly used on
  // desktop admin machines with a USB/Bluetooth hardware scanner, where an
  // unsolicited getUserMedia permission prompt would be unwelcome. Toggling it
  // on lets the same page double as a phone camera scanner when needed.
  const [cameraEnabled, setCameraEnabled] = useState(false)
  // Offline queue: a scan that fails on the network path (rather than a real
  // server rejection) is persisted to IndexedDB and flushed when connectivity
  // returns, mirroring the staff scanner's offline queue — this page + the
  // kiosk were the two check-in surfaces that previously lost scans silently
  // on a wifi drop.
  const [queueCount, setQueueCount] = useState(0)
  const [isManualFlushing, setIsManualFlushing] = useState(false)
  const flushInFlightRef = useRef(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const successAudioRef = useRef<HTMLAudioElement | null>(null)
  const errorAudioRef = useRef<HTMLAudioElement | null>(null)
  // Phone-camera QR scanners decode the same QR on every frame while it's in
  // view, firing this handler 5-10 times per scan. Track the last accepted
  // value so re-emits of the same code inside the window are silently dropped.
  // Mode is part of the key so that toggling check-in <-> check-out within the
  // window on the same badge is treated as a different action and goes through.
  const lastSubmitRef = useRef<{ value: string; mode: "in" | "out"; ts: number } | null>(null)

  // Manual-entry scanner auto-submit. A USB/QR scanner types the whole code in a
  // fast burst (characters land a few ms apart) and many models do NOT send a
  // trailing Enter, so the box used to just fill and wait for a manual submit.
  // We detect the burst and auto-submit on a brief idle. Human typing is
  // slower, so it falls through to the button/Enter instead of mis-firing.
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const burstStartRef = useRef<number>(0)
  const lastKeyTimeRef = useRef<number>(0)

  // Initialize audio
  useEffect(() => {
    successAudioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2NgI17cF1qfIGKhX9zam15f4eFg3htYnOBhoaAfHBrcX+ChYR/eXNwdX5/gYCAf3x5eHp8foCBgYGAf358e3t9foCAgoOCgYB+fHt7fH1+f4GCgoKBgH59fHx8fX5/gIGBgYGAf359fHx8fX5/gIGBgYGAgH59fHx8fX5/gICBgYGAgH59fHx9fX5/gICBgYGAf359fX19fn9/gICBgYCAf359fX19fn9/gICAgICAgH59fX19fn5/f4CAgICAgH9+fX19fX5+f3+AgICAgIB/fn19fX1+fn9/gICAgICAf359fX19fn5/f4CAgICAgH9+fX19fX5+f3+AgICAf4B/fn19fX1+fn9/gICAgH+Af359fX19fn5/f4CAgIB/gH9+fX19fX5+f3+AgICAf4B/fn19fX5+fn9/gICAgH+Af359fX1+fn5/f4CAgIB/gH9+fX19fn5+f3+AgICAf4B/fn59fX5+fn9/gICAgH+Af359fX1+fn5/f4CAgIB/gH9+fn19fn5+f3+AgICAf4B/fn59fX5+fn9/gICAgH+Af35+fX1+fn5/f4CAgIB/gH9+fn59fn5+f3+AgICAf4B/fn59fX5+fn9/gICAgH+Af359fX5+fn5/f4CAgIB/gH9+fn19fn5+f4CAgICAf4B/fn59fX5+fn9/gICAgH+Af35+fX1+fn5/f4CAgIB/gH9+fn59fn5+f3+AgICAf39/fn59fX5+fn9/gICAgH9/f35+fX1+fn5/f4CAgIB/f39+fn59fn5+f3+AgICAf39/fn59fX5+fn9/gICAgH9/f35+fn1+fn5/f4CAgIB/f39+fn59fn5+f3+AgIB/f39/fn59fX5+fn9/gICAgH9/f35+fn1+fn5/f4CAgH9/f39+fn59fn5+f3+AgIB/f39/fn5+fX5+fn9/gICAf39/f35+fn1+fn5/f4CAgH9/f39+fn59fn5+f3+AgIB/f39/fn5+fX5+fn9/gICAf39/f35+fn5+fn5/f4CAgH9/f39+fn59fn5+f3+AgIB/f39/fn5+fX5+fn9/gICAf39/f35+fn5+fn5/f4CAf39/f39+fn59fn5+f3+AgIB/f39/fn5+fX5+fn9/gIB/f39/f35+fn1+fn5/f4CAf39/f39+fn59fn5+f39/gH9/f39/fn5+fX5+fn9/f4B/f39/f35+fn5+fn5/f3+Af39/f39+fn59fn5+f39/gH9/f39/fn5+fn5+fn9/f4B/f39/f35+fn1+fn5/f3+Af39/f39+fn5+fn5+f39/gH9/f39/fn5+fn5+fn9/f4B/f39/f35+fn5+fn5/f3+Af39/f39+fn5+fn5+f39/gH9/f39/fn5+fn5+fn9/f4B/f39/f35+fn5+fn5/f3+Af39/f39+fn5+fn5+f39/gH9/f39/fn5+fn5+fn9/f4B/f39/f35+fn5+fn5/f3+A")
    errorAudioRef.current = new Audio("data:audio/wav;base64,UklGRjIEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQ4EAABpZnmBgYCAdnJxcHJ2fIOGhoWCfXl4eHl8gIWIiYmHhIF9e3p6e36ChoeHhoSBfnt5eXp9gIOGhoaDgH17eXh5fH+ChYWFg4F+e3l4eXx/goWFhYOAf3x6eXl7foGEhYWDgYB9e3l5enx/goSEhIOAf3x6eXl7fX+Cg4SDgYB9e3p5eXt+gIKDg4KBf3x7enl6fH6Ag4ODgoB/fXt6eXp8foGCg4OCgH59e3p5ent9gIGCg4KBf317enp6e31/gYKCgoGAf317enp6e31/gYKCgoGAf317enp6fH1/gIGCgYGAf317enp6e31/gIGBgYGAf317e3p6e31/gIGBgYGAf3x7e3p7fH1/gIGBgYCAf3x7e3p7fH1/gIGBgYCAf3x7e3p7fH1/gIGBgYCAf3x7e3t7fH1/gIGBgYB/f3x7e3t7fH5/gIGBgYB/f3x7e3t7fH5/gIGBgIB/f3x7e3t7fH5/gICBgIB/f3x7e3t7fH5/gICBgIB/f3x7e3t8fH5/gICAgIB/f3x8e3t8fH5/gICAgIB/f3x8e3t8fH5/gICAgIB/f3x8e3x8fH5/gICAgH9/f3x8e3x8fH5/gICAgH9/f3x8fHx8fH5/gICAgH9/f3x8fHx8fH5/gICAgH9/f3x8fHx8fX5/gICAgH9/f3x8fHx8fX5/gICAf39/f3x8fHx8fX5/f4CAf39/f3x8fHx9fX5/f4CAf39/f3x8fHx9fX5/f4CAf39/f3x8fHx9fX5/f4CAf39/f318fHx9fX5/f4B/f39/f318fHx9fX5/f4B/f39/f318fH19fX5/f4B/f39/f318fH19fX5/f4B/f39/f318fH19fX5/f4B/f39/f319fH19fX5/f4B/f39/f319fX19fX5/f4B/f39/f319fX19fX5/f39/f39/f319fX19fX5/f39/f39/f319fX19fX5/f39/f39/f319fX19fX5/f39/f39/f319fX19fn5/f39/f39/f319fX19fn5/f39/f39/f319fX1+fn5/f39/f39/f319fX1+fn5/f39/f39/f319fX1+fn5/f39/f39/f31+fX1+fn5/f39/f39/f31+fX1+fn5/f39/f39/f31+fn1+fn5/f39/f39/f31+fn1+fn5/f39/f39/f31+fn5+fn5/f39/f39/f31+fn5+fn5/f39/f39/f35+fn5+fn5/f39/f39/f35+fn5+fn5/f39/f39/f35+fn5+fn5/f39/f39/f35+fn5+fn5/f39/f3+Af35+fn5+fn5/f39/f3+Af35+fn5+fn5/f39/f3+Af35+fn5+fn5/f39/f3+Af35+fn5+fn9/f39/f3+Af35+fn5+fn9/f39/f3+Af35+fn5+fn9/f39/f3+Af35+fn5+f39/f39/f3+Af35+fn5+f39/f39/")
  }, [])

  // Fullscreen change detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  // Vibrate on mobile
  const vibrate = (pattern: number | number[]) => {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern)
    }
  }

  // Play sound
  const playSound = (type: "success" | "error") => {
    if (!soundEnabled) return
    if (type === "success" && successAudioRef.current) {
      successAudioRef.current.currentTime = 0
      successAudioRef.current.play().catch(() => {})
    } else if (type === "error" && errorAudioRef.current) {
      errorAudioRef.current.currentTime = 0
      errorAudioRef.current.play().catch(() => {})
    }
  }

  // Fetch event
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`)
      return res.json() as Promise<{ id: string; name: string; short_name: string | null }>
    }
  })

  // Fetch stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["checkin-stats", listId],
    queryFn: async () => {
      const res = await fetch(`/api/checkin/stats?event_id=${eventId}&checkin_list_id=${listId}`)
      return res.json() as Promise<Stats>
    },
    refetchInterval: 15000
  })

  // Check-in/checkout mutation
  const checkinMutation = useMutation({
    mutationFn: async (registrationNumber: string) => {
      const body = {
        event_id: eventId,
        checkin_list_id: listId,
        registration_number: registrationNumber,
        action: checkoutMode ? "check_out" : "check_in"
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueRequest(queuePartitionKey, { url: "/api/checkin", body })
        await refreshQueueCount()
        return { queued: true }
      }

      try {
        const res = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
        return await res.json()
      } catch (err) {
        if (isNetworkFailure(err)) {
          await enqueueRequest(queuePartitionKey, { url: "/api/checkin", body })
          await refreshQueueCount()
          return { queued: true }
        }
        throw err
      }
    },
    onSuccess: (data) => {
      if (data.queued) {
        setScanResult({ type: "queued", message: "Queued offline — will sync when online" })
        vibrate(200)
        setCountdown(5)
        return
      }
      if (data.success) {
        const isCheckout = checkoutMode || data.action === "checked_out"

        if (data.action === "already_checked_in") {
          setScanResult({
            type: "already",
            message: data.message || "Already checked in",
            registrationId: data.registration?.id,
            attendee: {
              name: data.registration?.attendee_name,
              email: data.registration?.attendee_email,
              ticket: data.registration?.ticket_types?.name,
              registration_number: data.registration?.registration_number,
              institution: data.registration?.attendee_institution
            }
          })
          // A repeat scan is always a success, never an error — see the Tito
          // model note in CLAUDE.md. The card stays visually distinct
          // (yellow "already" tone) but the harsh error buzzer is wrong here.
          playSound("success")
          vibrate(200)
          addRecentScan(data.registration?.attendee_name, data.registration?.registration_number, data.registration?.id, "already")
        } else if (data.action === "already_checked_out") {
          setScanResult({
            type: "not_checked_in",
            message: data.message || "Not checked in",
            attendee: {
              name: data.registration?.attendee_name,
              email: data.registration?.attendee_email,
              ticket: data.registration?.ticket_types?.name,
              registration_number: data.registration?.registration_number,
              institution: data.registration?.attendee_institution
            }
          })
          playSound("error")
          vibrate(200)
          addRecentScan(data.registration?.attendee_name, data.registration?.registration_number, data.registration?.id, "error")
        } else {
          setScanResult({
            type: "success",
            message: isCheckout ? `Checked out from ${data.list_name}` : `Checked in to ${data.list_name}`,
            registrationId: data.registration?.id,
            warning: data.warning,
            attendee: {
              name: data.registration?.attendee_name,
              email: data.registration?.attendee_email,
              ticket: data.registration?.ticket_types?.name,
              registration_number: data.registration?.registration_number,
              institution: data.registration?.attendee_institution
            }
          })
          playSound("success")
          vibrate([100, 50, 100])
          addRecentScan(data.registration?.attendee_name, data.registration?.registration_number, data.registration?.id, "success")
          if (!isCheckout) {
            setLastCheckedInId(data.registration?.id)
          }
        }
      } else {
        // Server returned success: false (e.g. attendee not found, ticket
        // type not allowed). Clear the dedupe ref so the volunteer can
        // immediately retry the same value once the underlying issue is
        // resolved.
        lastSubmitRef.current = null
        setScanResult({
          type: "error",
          message: data.error || "Check-in failed"
        })
        playSound("error")
        vibrate([200, 100, 200])
        addRecentScan("Unknown", "", undefined, "error")
      }
      refetchStats()
      // Start countdown
      setCountdown(5)
    },
    onError: (error: any) => {
      // Network/parse failure — let the volunteer retry the same value.
      lastSubmitRef.current = null
      setScanResult({
        type: "error",
        message: error.message || "Check-in failed"
      })
      playSound("error")
      vibrate([200, 100, 200])
      addRecentScan("Unknown", "", undefined, "error")
    }
  })

  // Undo mutation
  const undoMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          checkin_list_id: listId,
          registration_id: registrationId,
          action: "check_out"
        })
      })
      return res.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        // Free the dedupe ref so re-scanning the same badge immediately after
        // an undo (the common "oops wrong button" recovery) goes through.
        lastSubmitRef.current = null
        setScanResult({
          type: "warning",
          message: `Undone: ${data.registration?.attendee_name} checked out`
        })
        setLastCheckedInId(null)
        refetchStats()
      }
    }
  })

  const handleUndo = () => {
    if (lastCheckedInId) {
      undoMutation.mutate(lastCheckedInId)
    }
  }

  const addRecentScan = (name: string, registrationNumber: string, registrationId: string | undefined, status: "success" | "error" | "already") => {
    setRecentScans((prev) => [
      {
        id: Date.now().toString(),
        name,
        registrationNumber,
        registrationId,
        time: new Date().toLocaleTimeString(),
        status
      },
      ...prev.slice(0, 19) // Keep last 20 scans
    ])
  }

  const clearRecentScans = () => {
    setRecentScans([])
  }

  // Refresh the queue-count badge from IndexedDB. Cheap (single IDB store
  // scan filtered by partition key); called after every enqueue/flush.
  const refreshQueueCount = useCallback(async () => {
    try {
      const n = await pendingRequestCount(queuePartitionKey)
      setQueueCount(n)
    } catch {
      // IDB unavailable (e.g. private browsing) — fall back to "no queue"
      // rather than blocking the scanner UI.
    }
  }, [queuePartitionKey])

  // Drain the offline queue. Idempotent + concurrency-guarded so the
  // `online` event firing while already flushing doesn't start a parallel
  // drain. Each synced scan is folded into recentScans + stats the same way
  // a live scan is, so the volunteer sees what just landed.
  const flushAllPending = useCallback(async () => {
    if (flushInFlightRef.current) return
    flushInFlightRef.current = true
    try {
      await flushRequestQueue(queuePartitionKey, (result: RequestFlushResult) => {
        const data = result.response as {
          success?: boolean
          action?: string
          registration?: { id?: string; attendee_name?: string; registration_number?: string; ticket_types?: { name?: string } }
        } | undefined
        if (result.success && data?.success) {
          const isAlready = data.action === "already_checked_in" || data.action === "already_checked_out"
          addRecentScan(
            data.registration?.attendee_name || "Unknown",
            data.registration?.registration_number || "",
            data.registration?.id,
            isAlready ? "already" : "success"
          )
        } else {
          addRecentScan("Unknown", "", undefined, "error")
        }
      })
    } finally {
      flushInFlightRef.current = false
      await refreshQueueCount()
      refetchStats()
    }
  }, [queuePartitionKey, refreshQueueCount, refetchStats])

  // Manual "sync now" tap on the queue badge below. Separate from the ref
  // guard inside flushAllPending — that one just no-ops a re-entrant call,
  // this one drives the button's disabled/spinner state so a double-tap
  // reads as "already syncing" instead of firing twice.
  const handleManualFlush = useCallback(async () => {
    if (isManualFlushing) return
    setIsManualFlushing(true)
    try {
      await flushAllPending()
    } finally {
      setIsManualFlushing(false)
    }
  }, [isManualFlushing, flushAllPending])

  // Online/offline detection + initial queue load + flush-on-reconnect.
  // Also polls every 20s: navigator.onLine only reflects the OS network
  // interface, not request health, so a timed-out scan (see
  // fetch-with-timeout.ts) can sit queued with onLine still true and no
  // `online` event ever firing to drain it.
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      flushAllPending()
    }
    const handleOffline = () => setIsOnline(false)

    setIsOnline(navigator.onLine)
    refreshQueueCount()
    if (navigator.onLine) flushAllPending()

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    const pollId = setInterval(() => {
      if (navigator.onLine) flushAllPending()
    }, 20000)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(pollId)
    }
  }, [refreshQueueCount, flushAllPending])

  // Shared finalize logic for the manual-entry box, used by both the form's
  // Enter/submit-button path and the scanner-burst auto-submit path below, so
  // the dedupe/guard logic isn't duplicated.
  const submitManualValue = (raw: string) => {
    // Strip invisible chars some bluetooth scanners inject (NBSP, ZWSP, BOM)
    // before trim, so visually-identical scans dedupe correctly.
    const value = raw.replace(/[\u200B\uFEFF\u00A0]/g, "").trim()
    if (!value) return

    // Block while a previous scan is still in flight, otherwise duplicate
    // submits race the INSERT and the later response paints "already
    // checked in" over a real success.
    if (checkinMutation.isPending) {
      setManualSearch("")
      return
    }

    // Drop same-value, same-mode re-emits from the camera scanner within 5s.
    const mode: "in" | "out" = checkoutMode ? "out" : "in"
    const now = Date.now()
    const last = lastSubmitRef.current
    if (last && last.value === value && last.mode === mode && now - last.ts < 5000) {
      setManualSearch("")
      return
    }

    lastSubmitRef.current = { value, mode, ts: now }
    checkinMutation.mutate(value)
    setManualSearch("")
  }

  // Camera scanning reuses submitManualValue directly — it already has the
  // in-flight guard and the 5s same-value/same-mode dedupe needed for a
  // camera that re-decodes the same QR 5-10x/sec while it's in view, so no
  // separate dedupe logic is needed here.
  const { cameraError, scannerReady, retry: retryCamera } = useQrCameraScanner({
    enabled: cameraEnabled,
    elementId: "admin-qr-reader",
    onDecode: submitManualValue,
    facingMode: "environment"
  })

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current)
      autoSubmitTimerRef.current = null
    }
    submitManualValue(manualSearch)
  }

  // Tunables for scanner-burst detection (see `lastSubmitRef` comment above
  // for why we still need per-value/mode de-dup on top of this).
  const MANUAL_MIN_LEN = 3            // ignore stray 1-2 char input
  const SCANNER_MAX_AVG_GAP_MS = 50  // avg ms/keystroke at/below this = scanner
  const AUTO_SUBMIT_IDLE_MS = 200    // idle after last keystroke before submit

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setManualSearch(value)

    // Anchor a fresh burst whenever the gap since the last keystroke is large
    // (new attendee / after a pause). Timing-based on purpose: a fast scanner
    // can outrun React so we must NOT depend on the `manualSearch` state here.
    const now = Date.now()
    if (now - lastKeyTimeRef.current > 500) burstStartRef.current = now
    lastKeyTimeRef.current = now

    // Schedule an auto-submit for a brief idle after typing stops. Only fires
    // if the whole entry arrived at scanner speed - manual typing is too slow
    // and is left for Enter/the submit button. Reads the live DOM value, not
    // React state, since a fast burst can outrun React's render.
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current)
    autoSubmitTimerRef.current = setTimeout(() => {
      autoSubmitTimerRef.current = null
      const current = (searchInputRef.current?.value || "").trim()
      if (current.length < MANUAL_MIN_LEN) return
      const span = lastKeyTimeRef.current - burstStartRef.current
      const avgGap = current.length > 1 ? span / (current.length - 1) : 0
      if (avgGap <= SCANNER_MAX_AVG_GAP_MS) submitManualValue(current)
    }, AUTO_SUBMIT_IDLE_MS)
  }

  const handleManualKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // A scanner configured with an Enter/CR suffix (or an operator typing
      // manually) lands here. Cancel any pending burst auto-submit, prevent
      // the native form submit (which would otherwise also fire and re-read
      // possibly-stale state), and submit immediately reading the DOM value -
      // the Enter can arrive before React flushes the last characters into
      // `manualSearch` (which would submit a truncated code).
      e.preventDefault()
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current)
        autoSubmitTimerRef.current = null
      }
      const current = searchInputRef.current?.value ?? manualSearch
      submitManualValue(current)
    }
  }

  // Clear any pending burst auto-submit on unmount.
  useEffect(() => () => {
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current)
  }, [])

  // Countdown timer for auto-clear
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0) {
      setScanResult(null)
      setCountdown(null)
      searchInputRef.current?.focus()
    }
  }, [countdown])

  // Focus on search input
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (document.activeElement === searchInputRef.current) {
        if (e.key === "Escape") {
          setScanResult(null)
          setCountdown(null)
        }
        return
      }

      switch (e.key.toLowerCase()) {
        case "m":
          setSoundEnabled((prev) => !prev)
          break
        case "f":
          toggleFullscreen()
          break
        case "c":
          setCheckoutMode((prev) => !prev)
          break
        case "u":
          if (lastCheckedInId) handleUndo()
          break
        case "s":
        case "/":
          searchInputRef.current?.focus()
          e.preventDefault()
          break
        case "escape":
          setScanResult(null)
          setCountdown(null)
          break
        case "?":
          setShowKeyboardHints((prev) => !prev)
          break
        case "t":
          setShowTicketStats((prev) => !prev)
          break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [lastCheckedInId])

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Staff access URL (no login required) - the correct link to share with
  // volunteers. Never share window.location.href here; that's this admin
  // page's own URL, which requires a dashboard login.
  const getStaffAccessUrl = () => {
    if (typeof window === "undefined" || !stats?.list.access_token) return ""
    return `${window.location.origin}/checkin/access/${stats.list.access_token}`
  }

  // Copy link to clipboard
  const copyLink = async () => {
    await navigator.clipboard.writeText(getStaffAccessUrl())
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Link
                href={`/events/${eventId}/checkin/${listId}`}
                className="p-1.5 sm:p-2 hover:bg-gray-700 rounded-lg flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-lg font-bold truncate">{stats?.list.name || "Check-in Scanner"}</h1>
                  {checkoutMode && (
                    <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-medium rounded-full flex-shrink-0">
                      CHECK-OUT
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-400 truncate">{event?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Connection Status — clickable to force a sync attempt when queued */}
              <button
                type="button"
                disabled={!queueCount || isManualFlushing}
                onClick={handleManualFlush}
                className={`relative p-2 rounded-lg ${isOnline ? "text-green-400" : "text-red-400"} ${queueCount > 0 && !isManualFlushing ? "cursor-pointer hover:bg-gray-700" : "cursor-default"}`}
                title={
                  queueCount > 0
                    ? isManualFlushing
                      ? "Syncing…"
                      : `${isOnline ? "Online" : "Offline"} — ${queueCount} scan(s) queued. Tap to sync now.`
                    : isOnline ? "Online" : "Offline"
                }
              >
                {isManualFlushing ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                ) : isOnline ? (
                  <Wifi className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <WifiOff className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
                {queueCount > 0 && !isManualFlushing && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-sky-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {queueCount}
                  </span>
                )}
              </button>

              {/* Check-out Mode Toggle */}
              <button
                onClick={() => setCheckoutMode(!checkoutMode)}
                className={`p-2 rounded-lg ${checkoutMode ? "bg-red-600 text-white" : "hover:bg-gray-700"}`}
                title={checkoutMode ? "Switch to Check-in Mode (C)" : "Switch to Check-out Mode (C)"}
                aria-label={checkoutMode ? "Switch to Check-in Mode" : "Switch to Check-out Mode"}
              >
                {checkoutMode ? <LogOut className="w-4 h-4 sm:w-5 sm:h-5" /> : <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>

              {/* Undo Button */}
              {lastCheckedInId && (
                <button
                  onClick={handleUndo}
                  className="p-2 hover:bg-gray-700 rounded-lg text-yellow-400"
                  title="Undo Last Check-in (U)"
                  aria-label="Undo Last Check-in"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              <button
                onClick={() => router.push(`/events/${eventId}/checkin/${listId}`)}
                className="p-2 hover:bg-gray-700 rounded-lg hidden sm:block"
                title="View List"
                aria-label="View List"
              >
                <List className="w-5 h-5" />
              </button>

              <button
                onClick={() => setShowShareModal(true)}
                className="p-2 hover:bg-gray-700 rounded-lg"
                title="Share Scanner Link"
                aria-label="Share Scanner Link"
              >
                <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                onClick={() => setCameraEnabled(!cameraEnabled)}
                className={`p-2 rounded-lg ${cameraEnabled ? "bg-blue-600 text-white" : "hover:bg-gray-700"}`}
                title={cameraEnabled ? "Disable Camera Scanner" : "Enable Camera Scanner"}
                aria-label={cameraEnabled ? "Disable Camera Scanner" : "Enable Camera Scanner"}
              >
                {cameraEnabled ? <CameraOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Camera className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>

              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-lg ${soundEnabled ? "hover:bg-gray-700" : "text-red-400 hover:bg-gray-700"}`}
                title={soundEnabled ? "Mute (M)" : "Unmute (M)"}
                aria-label={soundEnabled ? "Mute" : "Unmute"}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>

              <button
                onClick={() => setShowKeyboardHints(!showKeyboardHints)}
                className="p-2 hover:bg-gray-700 rounded-lg hidden sm:block"
                title="Keyboard Shortcuts (?)"
                aria-label="Keyboard Shortcuts"
              >
                <Keyboard className="w-5 h-5" />
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-gray-700 rounded-lg"
                title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
                aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardHints && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowKeyboardHints(false)}>
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Keyboard Shortcuts</h3>
              <button onClick={() => setShowKeyboardHints(false)} className="p-1 hover:bg-gray-700 rounded" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Search / Focus Input</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">S</kbd>
                  <span className="text-gray-500">or</span>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">/</kbd>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Toggle Sound</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">M</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Toggle Fullscreen</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">F</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Toggle Check-out Mode</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">C</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Undo Last Check-in</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">U</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Toggle Ticket Stats</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">T</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Clear Result / Close</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">Esc</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Show This Help</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">?</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowShareModal(false)}>
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Share Scanner</h3>
              <button onClick={() => setShowShareModal(false)} className="p-1 hover:bg-gray-700 rounded" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            {stats?.list.access_token ? (
              <>
                <p className="text-gray-400 text-sm mb-4">Share this link with volunteers. They can open it on their phone and start checking people in immediately. No login required.</p>
                <div className="bg-gray-900 p-3 rounded-lg mb-4 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <code className="text-sm text-blue-400 truncate flex-1">{getStaffAccessUrl()}</code>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      copyLink()
                      setShowShareModal(false)
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => setShowShareModal(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4 flex justify-center">
                  <QrImage value={getStaffAccessUrl()} size={192} className="w-48 h-48 rounded-lg" light="#1f2937" dark="#ffffff" />
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-sm mb-4">No staff link has been generated for this list yet. Generate one from the Check-in Lists page.</p>
                <Link
                  href={`/events/${eventId}/checkin`}
                  onClick={() => setShowShareModal(false)}
                  className="block text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                >
                  Go to Check-in Lists
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-56px)] sm:min-h-[calc(100vh-64px)]">
        {/* Main Scanner Area */}
        <div className="flex-1 p-3 sm:p-8">
          {/* Mode Indicator */}
          {checkoutMode && (
            <div className="max-w-xl mx-auto mb-4 p-3 bg-red-900/50 border border-red-500 rounded-xl text-center">
              <div className="flex items-center justify-center gap-2 text-red-400">
                <LogOut className="w-5 h-5" />
                <span className="font-medium">CHECK-OUT MODE ACTIVE</span>
              </div>
              <p className="text-xs text-red-400/70 mt-1">Scanning will check out attendees instead of checking them in</p>
            </div>
          )}

          {/* Stats Bar */}
          <div className="flex items-center justify-center gap-3 sm:gap-8 mb-4 sm:mb-8">
            <div className="text-center">
              <div className="text-2xl sm:text-5xl font-bold text-green-400">{stats?.checkedIn || 0}</div>
              <div className="text-[10px] sm:text-sm text-gray-400">Checked In</div>
            </div>
            <div className="text-3xl sm:text-6xl text-gray-600">/</div>
            <div className="text-center">
              <div className="text-2xl sm:text-5xl font-bold">{stats?.total || 0}</div>
              <div className="text-[10px] sm:text-sm text-gray-400">Total</div>
            </div>
            <div className="ml-2 sm:ml-8 text-center">
              <div className="text-2xl sm:text-5xl font-bold text-amber-400">{stats?.notCheckedIn || 0}</div>
              <div className="text-[10px] sm:text-sm text-gray-400">Remaining</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="max-w-xl mx-auto mb-4 sm:mb-8">
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${stats?.percentage || 0}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-400">
              <span>{stats?.percentage || 0}% complete</span>
              <button
                onClick={() => setShowTicketStats(!showTicketStats)}
                className="flex items-center gap-1 hover:text-white transition-colors"
              >
                <Ticket className="w-4 h-4" />
                <span className="hidden sm:inline">By ticket type</span>
                {showTicketStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Ticket Type Stats (Collapsible) */}
          {showTicketStats && stats?.byTicketType && (
            <div className="max-w-xl mx-auto mb-6 p-4 bg-gray-800 rounded-xl">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Stats by Ticket Type</h4>
              <div className="space-y-3">
                {stats.byTicketType.map((ticket) => (
                  <div key={ticket.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{ticket.name}</span>
                        <span className="text-gray-400">{ticket.checkedIn}/{ticket.total}</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${ticket.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{ticket.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Camera Scanner (opt-in) */}
          {cameraEnabled && (
            <div className="max-w-xl mx-auto mb-4 sm:mb-6 bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
              {cameraError ? (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <XCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-red-300 text-sm mb-3">{cameraError}</p>
                  <button
                    onClick={() => retryCamera()}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div id="admin-qr-reader" className="w-full" style={{ minHeight: 250 }} />
                  {!scannerReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
                        <p className="text-gray-400 text-sm mt-2">Starting camera...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Search Input */}
          <form onSubmit={handleManualSearch} className="max-w-xl mx-auto mb-4 sm:mb-8">
            <div className="relative">
              {checkoutMode ? (
                <LogOut className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-red-400" />
              ) : (
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
              )}
              <input
                ref={searchInputRef}
                type="text"
                value={manualSearch}
                onChange={handleManualChange}
                onKeyDown={handleManualKeyDown}
                placeholder={checkoutMode ? "Scan to check out attendee..." : "Scan QR code or type registration number..."}
                className={`w-full pl-14 pr-4 py-4 bg-gray-800 border rounded-xl text-lg focus:outline-none focus:ring-2 transition-all ${
                  checkoutMode
                    ? "border-red-500/50 focus:ring-red-500 placeholder-red-400/50"
                    : "border-gray-700 focus:ring-blue-500"
                }`}
                autoFocus
              />
              {checkinMutation.isPending && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center hidden sm:block">
              Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">S</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">/</kbd> to focus • <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">?</kbd> for all shortcuts
            </p>
          </form>

          {/* Scan Result */}
          {scanResult && (
            <div
              className={`max-w-xl mx-auto p-4 sm:p-6 rounded-2xl relative overflow-hidden ${
                scanResult.type === "success"
                  ? "bg-gradient-to-br from-green-900/80 to-emerald-900/80 border-2 border-green-500"
                  : scanResult.type === "already"
                  ? "bg-gradient-to-br from-yellow-900/80 to-amber-900/80 border-2 border-yellow-500"
                  : scanResult.type === "warning"
                  ? "bg-gradient-to-br from-orange-900/80 to-amber-900/80 border-2 border-orange-500"
                  : scanResult.type === "not_checked_in"
                  ? "bg-gradient-to-br from-slate-800/80 to-slate-700/80 border-2 border-slate-500"
                  : scanResult.type === "queued"
                  ? "bg-gradient-to-br from-sky-900/80 to-blue-900/80 border-2 border-sky-500"
                  : "bg-gradient-to-br from-red-900/80 to-rose-900/80 border-2 border-red-500"
              }`}
            >
              {/* Countdown Timer */}
              {countdown !== null && (
                <div className="absolute top-4 right-4 flex items-center gap-2 text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">{countdown}s</span>
                </div>
              )}

              <div className="flex items-start gap-4">
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center flex-shrink-0 ${
                    scanResult.type === "success"
                      ? "bg-green-500 shadow-lg shadow-green-500/50"
                      : scanResult.type === "already"
                      ? "bg-yellow-500 shadow-lg shadow-yellow-500/50"
                      : scanResult.type === "warning"
                      ? "bg-orange-500 shadow-lg shadow-orange-500/50"
                      : scanResult.type === "not_checked_in"
                      ? "bg-slate-500 shadow-lg shadow-slate-500/50"
                      : scanResult.type === "queued"
                      ? "bg-sky-500 shadow-lg shadow-sky-500/50"
                      : "bg-red-500 shadow-lg shadow-red-500/50"
                  }`}
                >
                  {scanResult.type === "success" ? (
                    <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                  ) : scanResult.type === "already" ? (
                    <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                  ) : scanResult.type === "warning" ? (
                    <RotateCcw className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                  ) : scanResult.type === "not_checked_in" ? (
                    <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                  ) : scanResult.type === "queued" ? (
                    <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                  ) : (
                    <XCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-xl sm:text-2xl font-bold ${
                      scanResult.type === "success"
                        ? "text-green-400"
                        : scanResult.type === "already"
                        ? "text-yellow-400"
                        : scanResult.type === "warning"
                        ? "text-orange-400"
                        : scanResult.type === "not_checked_in"
                        ? "text-slate-300"
                        : scanResult.type === "queued"
                        ? "text-sky-300"
                        : "text-red-400"
                    }`}
                  >
                    {scanResult.type === "success"
                      ? checkoutMode ? "Check-out Successful" : "Check-in Successful"
                      : scanResult.type === "already"
                      ? "Already Checked In"
                      : scanResult.type === "warning"
                      ? "Undo Successful"
                      : scanResult.type === "not_checked_in"
                      ? "Not Checked In"
                      : scanResult.type === "queued"
                      ? "Queued Offline"
                      : "Check-in Failed"}
                  </div>
                  {scanResult.attendee && (
                    <div className="mt-3 space-y-1">
                      <div className="text-xl sm:text-2xl font-bold text-white truncate">{scanResult.attendee.name}</div>
                      {scanResult.attendee.institution && (
                        <div className="text-gray-300">{scanResult.attendee.institution}</div>
                      )}
                      <div className="text-gray-400 truncate">{scanResult.attendee.email}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 rounded-full text-sm">
                          <Ticket className="w-3 h-3" />
                          {scanResult.attendee.ticket}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 rounded-full text-sm font-mono">
                          #{scanResult.attendee.registration_number}
                        </span>
                      </div>
                      {scanResult.message && (
                        <div className="mt-2 text-gray-300 text-sm">{scanResult.message}</div>
                      )}
                    </div>
                  )}
                  {!scanResult.attendee && (
                    <div className="mt-2 text-gray-300">{scanResult.message}</div>
                  )}
                  {scanResult.warning && (
                    <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{scanResult.warning}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              {scanResult.type === "success" && !checkoutMode && scanResult.registrationId && (
                <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
                  <button
                    onClick={handleUndo}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Undo
                  </button>
                  <button
                    onClick={() => {
                      setScanResult(null)
                      setCountdown(null)
                      searchInputRef.current?.focus()
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {!scanResult && (
            <div className="max-w-xl mx-auto text-center text-gray-500">
              <div className={`w-20 h-20 sm:w-32 sm:h-32 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${
                checkoutMode ? "bg-red-900/30" : "bg-gray-800"
              }`}>
                {checkoutMode ? (
                  <LogOut className="w-12 h-12 sm:w-16 sm:h-16 text-red-400/50" />
                ) : (
                  <QrCode className="w-12 h-12 sm:w-16 sm:h-16 opacity-30" />
                )}
              </div>
              <p className="text-lg">
                {checkoutMode ? "Scan to check out an attendee" : "Scan a QR code or enter registration number"}
              </p>
              <p className="text-sm mt-2">The input field is auto-focused for barcode scanners</p>
            </div>
          )}
        </div>

        {/* Mobile Recent Scans Toggle */}
        <button
          onClick={() => setShowMobileRecent(!showMobileRecent)}
          className="lg:hidden fixed bottom-4 right-4 p-4 bg-gray-800 rounded-full shadow-lg border border-gray-700 z-40"
          aria-label="View recent scans"
        >
          <Clock className="w-6 h-6" />
          {recentScans.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
              {recentScans.length}
            </span>
          )}
        </button>

        {/* Recent Scans Sidebar */}
        <div className={`
          ${showMobileRecent ? "fixed inset-0 z-50 bg-gray-900" : "hidden"}
          lg:block lg:relative lg:w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto
        `}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-300">Recent Scans</h3>
            <div className="flex items-center gap-2">
              {recentScans.length > 0 && (
                <button
                  onClick={clearRecentScans}
                  className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setShowMobileRecent(false)}
                className="lg:hidden p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                aria-label="Close recent scans"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {recentScans.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No scans yet</p>
              <p className="text-gray-600 text-xs mt-1">Scan results will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentScans.map((scan, index) => (
                <div
                  key={scan.id}
                  className={`p-3 rounded-xl transition-all ${
                    index === 0 ? "ring-2 ring-white/10" : ""
                  } ${
                    scan.status === "success"
                      ? "bg-green-900/30"
                      : scan.status === "already"
                      ? "bg-yellow-900/30"
                      : "bg-red-900/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      scan.status === "success"
                        ? "bg-green-500/20"
                        : scan.status === "already"
                        ? "bg-yellow-500/20"
                        : "bg-red-500/20"
                    }`}>
                      {scan.status === "success" ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : scan.status === "already" ? (
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{scan.name}</div>
                      {scan.registrationNumber && (
                        <div className="text-xs text-gray-400 font-mono">#{scan.registrationNumber}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">{scan.time}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
