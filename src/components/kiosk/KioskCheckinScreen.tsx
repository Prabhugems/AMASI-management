"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  QrCode,
  Loader2,
  CheckCircle2,
  Mail,
  MessageCircle,
  RotateCcw,
  User,
  Calendar,
  MapPin,
  Ticket,
  AlertCircle,
  Keyboard,
  Briefcase,
  Building2,
} from "lucide-react"
import { toast } from "sonner"
import * as Sentry from "@sentry/nextjs"
import { matchDelegate, type CachedDelegate } from "@/lib/kiosk-delegate-match"
import {
  getOrCreateDeviceId,
  replaceDelegateCache,
  getDelegateCache,
  enqueueScan,
  newId,
} from "@/lib/kiosk-offline-store"
import { drainScanQueue } from "@/lib/kiosk-sync-worker"
import { isNetworkFailure } from "@/lib/offline-scan-queue"

type CheckinResult = {
  success: boolean
  message: string
  // Non-blocking note on an otherwise-successful check-in (e.g. outside the
  // list's configured time window) — informational only.
  warning?: string
  registration?: {
    id: string
    registration_number: string
    attendee_name: string
    attendee_email: string
    attendee_designation?: string
    attendee_institution?: string
    ticket_type?: { name: string }
  }
  alreadyCheckedIn?: boolean
}

// Scanner-burst auto-submit tunables (mirror of the staff check-in kiosk): a
// barcode/QR scanner types the whole code in a fast burst and often omits a
// trailing Enter, so we auto-submit on a brief idle when the input arrived at
// scanner speed. Manual typing is slower and still uses the "Check in" button.
const MANUAL_MIN_LEN = 3
const SCANNER_MAX_AVG_GAP_MS = 50
const AUTO_SUBMIT_IDLE_MS = 200

interface KioskCheckinScreenProps {
  eventId: string
  listId: string
  // Exactly one of these two is ever provided by a caller. `token` is a
  // checkin_lists.access_token (the original direct-URL path, Stage 1/2 --
  // Task 6 admin links). `stationToken` is a kiosk_stations token (Stage 3 --
  // the /kiosk-station/[token] route never passes the underlying list's own
  // token to this component at all).
  token?: string
  stationToken?: string
}

export function KioskCheckinScreen({ eventId, listId, token = "", stationToken }: KioskCheckinScreenProps) {
  const supabase = createClient()

  const [registrationNumber, setRegistrationNumber] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<CheckinResult | null>(null)
  const [countdown, setCountdown] = useState(10)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false)
  const [whatsappSent, setWhatsappSent] = useState(false)
  const [cacheReady, setCacheReady] = useState(false)
  const [cacheError, setCacheError] = useState<string | null>(null)
  const [listBlockedReason, setListBlockedReason] = useState<string | null>(null)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  // Scanner-burst auto-submit + double-submit guard (see handleRegChange).
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const burstStartRef = useRef<number>(0)
  const lastKeyTimeRef = useRef<number>(0)
  const submittingRef = useRef<boolean>(false)
  const delegatesRef = useRef<CachedDelegate[]>([])
  const deviceIdRef = useRef<string>("")
  // In-flight guard for syncNow -- the click handler (`void syncNow()` in
  // handleCheckin), the `online` listener, and the 20s interval poll can all
  // fire close together, and drainScanQueue has no guard of its own against
  // two overlapping passes over the same pending queue.
  const syncInFlightRef = useRef<boolean>(false)

  // Local-first bootstrap: load whatever's already cached from a previous
  // session immediately (works offline from a cold reload), then refresh
  // from the server if online. Refreshes again every 5 minutes while
  // online. ~2,000 records for a full event roster -- load the whole list,
  // no pagination (see the Stage 1 plan's architecture notes).
  useEffect(() => {
    let cancelled = false

    // cacheReady only ever becomes true when there is a genuinely usable
    // local cache: either the local IndexedDB read already had entries from
    // a prior session (safe to accept scans immediately, even offline), or
    // a server refresh has completed in some terminal way (success, 401,
    // non-ok response, network-failure) -- never simply "the local read
    // finished, even if it returned zero rows". A brand-new device with an
    // empty cache and a refresh still in flight must keep showing
    // "Loading…", not silently accept scans against an empty roster.
    async function refreshFromServer() {
      if (!token && !stationToken) return
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (!cancelled && delegatesRef.current.length > 0) setCacheReady(true)
        return
      }
      try {
        const authParam = token
          ? `token=${encodeURIComponent(token)}`
          : `station_token=${encodeURIComponent(stationToken!)}`
        const res = await fetch(
          `/api/kiosk/delegates?event_id=${encodeURIComponent(eventId)}&${authParam}`
        )
        if (res.status === 401) {
          if (!cancelled) {
            setCacheError("This kiosk link has expired or is invalid. Ask an admin to reshare it.")
            if (delegatesRef.current.length > 0) setCacheReady(true)
          }
          return
        }
        if (!res.ok) {
          if (!cancelled && delegatesRef.current.length > 0) setCacheReady(true)
          return
        }
        const data = (await res.json()) as { delegates: CachedDelegate[]; list_purpose?: string }
        if (cancelled) return

        if (data.list_purpose === "collection") {
          // Self check-in never accepts scans against a collection-purpose
          // list (see /api/kiosk/checkin/route.ts:58-63) -- there's nothing
          // worth caching, and every scan must be rejected with a specific,
          // distinct message rather than looking like a match failure.
          delegatesRef.current = []
          await replaceDelegateCache(listId, [])
          setListBlockedReason("Self check-in isn't available for this list. Please see a staff member.")
          setCacheReady(true)
          return
        }

        setListBlockedReason(null)
        await replaceDelegateCache(listId, data.delegates)
        delegatesRef.current = data.delegates
        setCacheError(null)
        setCacheReady(true)
      } catch (err) {
        // A network failure here is a routine, expected condition (this
        // runs on an interval regardless of connectivity) -- the
        // on-device cache stays valid and in use, nothing to report.
        // Anything else is unexpected and must not be swallowed silently.
        if (!isNetworkFailure(err)) {
          Sentry.captureException(err, { tags: { module: "kiosk-page" }, extra: { eventId, listId } })
        }
        if (!cancelled && delegatesRef.current.length > 0) setCacheReady(true)
      }
    }

    async function bootstrap() {
      if (!token && !stationToken) {
        if (!cancelled) setCacheError("This kiosk link is missing its access token. Ask an admin to reshare it.")
        return
      }
      try {
        deviceIdRef.current = await getOrCreateDeviceId()
        delegatesRef.current = await getDelegateCache(listId)
        // Only safe to accept scans immediately if the local cache already
        // has entries from a prior session -- an empty read must not flip
        // cacheReady here, or a brand-new device would accept scans against
        // a roster it hasn't actually fetched yet.
        if (!cancelled && delegatesRef.current.length > 0) setCacheReady(true)
        await refreshFromServer()
      } catch (err) {
        // getOrCreateDeviceId/getDelegateCache throwing (e.g. IndexedDB
        // unavailable) must not leave the kiosk showing "Loading…" forever
        // with zero diagnostic signal -- indistinguishable from a hung page
        // on an unattended device.
        Sentry.captureException(err, { tags: { module: "kiosk-page" }, extra: { eventId, listId } })
        if (!cancelled) setCacheError("This kiosk couldn't start. Please see a staff member.")
      }
    }

    bootstrap()
    const refreshInterval = setInterval(refreshFromServer, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(refreshInterval)
    }
  }, [eventId, listId, token, stationToken])

  // Fetch event and list details
  const { data: event } = useQuery({
    queryKey: ["event-kiosk", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("id, name, short_name, start_date, venue_name, city")
        .eq("id", eventId)
        .maybeSingle()
      return data
    },
  })

  const { data: list } = useQuery({
    queryKey: ["checkin-list-kiosk", listId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("checkin_lists")
        .select("id, name, description, allow_multiple_checkins")
        .eq("id", listId)
        .maybeSingle()
      return data
    },
  })

  const resetKiosk = useCallback(() => {
    setResult(null)
    setRegistrationNumber("")
    setCountdown(10)
    setEmailSent(false)
    setWhatsappSent(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // Auto-reset countdown
  useEffect(() => {
    if (result) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            resetKiosk()
            return 10
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [result, resetKiosk])

  // Focus input on mount and after reset
  useEffect(() => {
    if (!result) {
      inputRef.current?.focus()
    }
  }, [result])

  // Clear any pending burst auto-submit on unmount.
  useEffect(() => () => {
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current)
  }, [])

  const syncNow = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return
    // The click handler, the `online` listener, and the 20s interval poll
    // can all fire close together -- without this guard, two overlapping
    // drains would both read the same "pending" rows and could double-POST
    // a scan before either pass marks it synced/conflict.
    if (syncInFlightRef.current) return
    syncInFlightRef.current = true
    try {
      const { remaining } = await drainScanQueue(
        listId,
        eventId,
        stationToken,
        () => {},
        () => {}
      )
      setPendingSyncCount(remaining)
    } catch (err) {
      // drainScanQueue can reject (e.g. IndexedDB unavailable -- Safari
      // private browsing, quota exceeded), and the underlying idb module
      // caches a rejected connection promise -- left uncaught, this would
      // reject on every subsequent call for the rest of the session, as an
      // unhandled rejection each time (handleCheckin's `void syncNow()`,
      // the `online` listener, and the setInterval poll all call this).
      Sentry.captureException(err, { tags: { module: "kiosk-page" }, extra: { eventId, listId } })
    } finally {
      syncInFlightRef.current = false
    }
  }, [eventId, listId, stationToken])

  // Local-first: resolve from the on-device delegate cache and render
  // immediately -- zero network calls on this path. The scan is durably
  // queued (IndexedDB survives a reload) and synced in the background by
  // the sync worker. See the Stage 1 plan for why this replaces the old
  // "await the network, retry twice, then queue" behavior.
  const handleCheckin = async (override?: string) => {
    const searchTerm = (override ?? registrationNumber).trim()
    if (!searchTerm) {
      toast.error("Please enter a registration number")
      return
    }
    // This guard must live inside handleCheckin itself, not only on the
    // submit button's `disabled` attribute -- the barcode-scanner-burst
    // path (handleRegChange's auto-submit) and the Enter-key handler both
    // call handleCheckin directly, bypassing the button entirely.
    if (listBlockedReason) {
      setResult({ success: false, message: listBlockedReason })
      return
    }
    if (submittingRef.current) return
    submittingRef.current = true
    setIsProcessing(true)

    try {
      const delegate = matchDelegate(delegatesRef.current, searchTerm)

      if (!delegate) {
        setResult({
          success: false,
          message: "Registration not found. Please check your registration number.",
        })
        return
      }

      const scanId = newId()

      await enqueueScan({
        scan_id: scanId,
        station_id: deviceIdRef.current,
        list_id: listId,
        delegate_code: searchTerm,
        scanned_at: Date.now(),
        registration_id: delegate.id,
        registration_snapshot: delegate,
      })

      setResult({
        success: true,
        message: "Check-in successful!",
        registration: {
          id: delegate.id,
          registration_number: delegate.registration_number,
          attendee_name: delegate.attendee_name,
          attendee_email: delegate.attendee_email,
          attendee_designation: delegate.attendee_designation ?? undefined,
          attendee_institution: delegate.attendee_institution ?? undefined,
        },
      })

      void syncNow()
    } catch (error) {
      // The most safety-critical write in the local-first redesign
      // (durable IndexedDB enqueue) must never fail silently -- e.g. quota
      // exceeded, Safari private-browsing storage restrictions. Surface an
      // honest failure rather than leaving the attendee on a stuck screen.
      Sentry.captureException(error, { tags: { module: "kiosk-page" }, extra: { eventId, listId, searchTerm } })
      setResult({
        success: false,
        message: "Something went wrong recording this check-in. Please try again.",
      })
    } finally {
      setIsProcessing(false)
      submittingRef.current = false
    }
  }

  // Silent background self-heal, same rationale as the old flush effect it
  // replaces: no "queue"/"pending" language in the attendee-facing UI, and
  // a 20s poll because navigator.onLine only reflects the OS network
  // interface, not request health.
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) void syncNow()
    window.addEventListener("online", syncNow)
    const pollId = setInterval(syncNow, 20000)
    return () => {
      window.removeEventListener("online", syncNow)
      clearInterval(pollId)
    }
  }, [syncNow])

  const handleEmailBadge = async () => {
    if (!result?.registration) return

    setSendingEmail(true)
    try {
      const response = await fetch("/api/badges/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: result.registration.id,
          event_id: eventId,
        }),
      })

      if (response.ok) {
        setEmailSent(true)
        toast.success("Badge sent to your email!")
      } else {
        toast.error("Failed to send badge. Please try again.")
      }
    } catch {
      toast.error("Failed to send badge")
    } finally {
      setSendingEmail(false)
    }
  }

  const handleWhatsappBadge = async () => {
    if (!result?.registration) return

    setSendingWhatsapp(true)
    try {
      const response = await fetch("/api/kiosk/whatsapp-badge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: result.registration.id,
          event_id: eventId,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        setWhatsappSent(true)
        toast.success(data.message || "Badge sent on WhatsApp!")
      } else {
        toast.error(data.message || "Couldn't send WhatsApp. Please try again.")
      }
    } catch {
      toast.error("Couldn't send WhatsApp")
    } finally {
      setSendingWhatsapp(false)
    }
  }

  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setRegistrationNumber(value)

    // Anchor a fresh burst after any pause; timing-based so a fast scanner
    // outrunning React state can't confuse the detection.
    const now = Date.now()
    if (now - lastKeyTimeRef.current > 500) burstStartRef.current = now
    lastKeyTimeRef.current = now

    // Auto-submit shortly after typing stops, but only if the whole entry
    // arrived at scanner speed. Reads the live DOM value, not React state.
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current)
    autoSubmitTimerRef.current = setTimeout(() => {
      autoSubmitTimerRef.current = null
      const current = (inputRef.current?.value || "").trim().toUpperCase()
      if (current.length < MANUAL_MIN_LEN) return
      const span = lastKeyTimeRef.current - burstStartRef.current
      const avgGap = current.length > 1 ? span / (current.length - 1) : 0
      if (avgGap <= SCANNER_MAX_AVG_GAP_MS) handleCheckin(current)
    }, AUTO_SUBMIT_IDLE_MS)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Scanner with an Enter/CR suffix lands here. Cancel any pending burst
      // submit and submit the live DOM value (not possibly-stale state).
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current)
        autoSubmitTimerRef.current = null
      }
      handleCheckin(inputRef.current?.value || registrationNumber)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ""
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  // ============================================================
  // SUCCESS / ERROR SCREEN
  // ============================================================
  if (result) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800/50 border-b border-white/10 px-4 sm:px-8 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                {event?.short_name || event?.name}
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 truncate">{list?.name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs sm:text-sm text-gray-400">Auto-reset in</p>
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                {countdown}s
              </p>
            </div>
          </div>
        </div>

        {/* Result Content */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8 overflow-y-auto">
          <div className="max-w-2xl w-full text-center">
            {result.success ? (
              <>
                {/* Success — ring-expand animation */}
                <div className="mb-8 relative w-32 h-32 sm:w-40 sm:h-40 mx-auto">
                  <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
                  <div className="relative w-full h-full rounded-full bg-emerald-500/20 outline outline-1 -outline-offset-1 outline-emerald-500/40 flex items-center justify-center">
                    <CheckCircle2 className="h-16 w-16 sm:h-20 sm:w-20 text-emerald-300" />
                  </div>
                </div>

                <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3">
                  Welcome, {result.registration?.attendee_name?.split(" ")[0]}!
                </h1>
                <p className="text-base sm:text-xl text-emerald-300 mb-2">
                  {result.alreadyCheckedIn ? "You're already checked in" : "Check-in successful"}
                </p>
                {result.warning && (
                  <p className="text-sm text-amber-300 mb-6 max-w-md mx-auto">{result.warning}</p>
                )}
                {!result.warning && <div className="mb-8" />}

                {/* Details — stacked-list pattern */}
                <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg overflow-hidden mb-8 text-left">
                  <ul className="divide-y divide-white/5">
                    <li className="flex items-center gap-x-4 px-5 py-4">
                      <div className="size-10 flex-none rounded-full bg-white/5 outline outline-1 -outline-offset-1 outline-white/10 flex items-center justify-center text-white/60">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Name</p>
                        <p className="mt-0.5 text-base sm:text-lg font-medium text-white">
                          {result.registration?.attendee_name}
                        </p>
                      </div>
                    </li>
                    <li className="flex items-center gap-x-4 px-5 py-4">
                      <div className="size-10 flex-none rounded-full bg-white/5 outline outline-1 -outline-offset-1 outline-white/10 flex items-center justify-center text-white/60">
                        <Ticket className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Registration</p>
                        <p className="mt-0.5 text-base sm:text-lg font-medium text-white font-mono">
                          {result.registration?.registration_number}
                        </p>
                      </div>
                    </li>
                    {result.registration?.attendee_designation && (
                      <li className="flex items-center gap-x-4 px-5 py-4">
                        <div className="size-10 flex-none rounded-full bg-white/5 outline outline-1 -outline-offset-1 outline-white/10 flex items-center justify-center text-white/60">
                          <Briefcase className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Designation</p>
                          <p className="mt-0.5 text-base sm:text-lg font-medium text-white">
                            {result.registration.attendee_designation}
                          </p>
                        </div>
                      </li>
                    )}
                    {result.registration?.attendee_institution && (
                      <li className="flex items-center gap-x-4 px-5 py-4">
                        <div className="size-10 flex-none rounded-full bg-white/5 outline outline-1 -outline-offset-1 outline-white/10 flex items-center justify-center text-white/60">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Institution</p>
                          <p className="mt-0.5 text-base sm:text-lg font-medium text-white">
                            {result.registration.attendee_institution}
                          </p>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-transparent border-white/15 text-white hover:bg-white/10 hover:text-white"
                    onClick={resetKiosk}
                  >
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Done
                  </Button>
                  {!emailSent ? (
                    <Button
                      size="lg"
                      className="h-14 sm:h-16 px-6 sm:px-8 text-base"
                      onClick={handleEmailBadge}
                      disabled={sendingEmail}
                    >
                      {sendingEmail ? (
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <Mail className="h-5 w-5 mr-2" />
                      )}
                      Email my badge
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-emerald-600 hover:bg-emerald-600 text-white"
                      disabled
                    >
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Badge sent
                    </Button>
                  )}
                  {!whatsappSent ? (
                    <Button
                      size="lg"
                      className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-[#25D366] hover:bg-[#1eb955] text-white"
                      onClick={handleWhatsappBadge}
                      disabled={sendingWhatsapp}
                    >
                      {sendingWhatsapp ? (
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <MessageCircle className="h-5 w-5 mr-2" />
                      )}
                      WhatsApp my badge
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-emerald-600 hover:bg-emerald-600 text-white"
                      disabled
                    >
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Sent on WhatsApp
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Error — ring-expand animation */}
                <div className="mb-8 relative w-32 h-32 sm:w-40 sm:h-40 mx-auto">
                  <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                  <div className="relative w-full h-full rounded-full bg-red-500/20 outline outline-1 -outline-offset-1 outline-red-500/40 flex items-center justify-center">
                    <AlertCircle className="h-16 w-16 sm:h-20 sm:w-20 text-red-300" />
                  </div>
                </div>

                <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3">
                  Check-in failed
                </h1>
                <p className="text-base sm:text-xl text-red-300 mb-8 max-w-md mx-auto">
                  {result.message}
                </p>

                <Button
                  size="lg"
                  className="h-14 sm:h-16 px-8 sm:px-12 text-base"
                  onClick={resetKiosk}
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Try again
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-800/50 border-t border-white/10 px-4 sm:px-8 py-4 text-center">
          <p className="text-xs sm:text-sm text-gray-400">
            Touch anywhere or wait {countdown} seconds to check in another person
          </p>
        </div>
      </div>
    )
  }

  // ============================================================
  // SCAN / ENTRY SCREEN
  // ============================================================
  return (
    <div
      className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div className="bg-gray-800/50 border-b border-white/10 px-4 sm:px-8 py-4 sm:py-6">
        <div className="max-w-4xl mx-auto flex items-start sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">
              {event?.short_name || event?.name || "Event"}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs sm:text-sm text-gray-400">
              {event?.start_date && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(event.start_date)}
                </span>
              )}
              {event?.venue_name && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.venue_name}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs sm:text-sm text-gray-400">Checking in for</p>
            <p className="text-base sm:text-xl font-semibold text-white truncate">
              {list?.name || "Loading…"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-2xl w-full">
          {/* Hero icon + headline */}
          <div className="text-center mb-8">
            <div className="size-20 sm:size-28 mx-auto rounded-3xl bg-indigo-500/15 outline outline-1 -outline-offset-1 outline-indigo-500/30 flex items-center justify-center mb-6 text-indigo-300">
              <QrCode className="h-12 w-12 sm:h-16 sm:w-16" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">Self check-in</h2>
            <p className="text-base sm:text-lg text-gray-400 max-w-md mx-auto">
              Scan QR code or enter your name, phone, or registration number
            </p>
          </div>

          {/* Input panel — action-panel surface */}
          <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-5 sm:p-6">
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                placeholder="Registration #, name, phone, or email…"
                value={registrationNumber}
                onChange={handleRegChange}
                onKeyDown={handleKeyDown}
                className="h-14 sm:h-16 text-base sm:text-xl text-center bg-white text-slate-900 border-0 rounded-xl placeholder:text-slate-400 pr-14"
                autoComplete="off"
                autoFocus
              />
              <Keyboard className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-7 sm:w-7 text-slate-400 pointer-events-none" />
            </div>

            <Button
              size="lg"
              className="w-full h-14 sm:h-16 mt-4 text-base sm:text-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
              onClick={() => handleCheckin()}
              disabled={isProcessing || !cacheReady || !registrationNumber.trim()}
            >
              {!cacheReady && cacheError ? (
                "Unavailable"
              ) : !cacheReady ? (
                <>
                  <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                  Loading…
                </>
              ) : isProcessing ? (
                <>
                  <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                  Checking in…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-6 w-6 mr-2" />
                  Check in
                </>
              )}
            </Button>
          </div>

          {/* Instructions — action-panel cards */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-4 flex items-start gap-3">
              <div className="size-10 flex-none rounded-full bg-blue-500/15 outline outline-1 -outline-offset-1 outline-blue-500/30 flex items-center justify-center text-blue-300">
                <QrCode className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Badge scanner</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Scan your badge with the scanner at this kiosk
                </p>
              </div>
            </div>
            <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-4 flex items-start gap-3">
              <div className="size-10 flex-none rounded-full bg-purple-500/15 outline outline-1 -outline-offset-1 outline-purple-500/30 flex items-center justify-center text-purple-300">
                <Keyboard className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Manual entry</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Type your name, phone number, or registration ID
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-800/50 border-t border-white/10 px-4 sm:px-8 py-4 text-center">
        <p className="text-xs sm:text-sm text-gray-400">
          Need help? Please contact the registration desk
        </p>
        {cacheError && (
          <p className="text-xs text-red-400 mt-1">{cacheError}</p>
        )}
        {pendingSyncCount > 0 && (
          <p className="text-xs text-gray-500 mt-1">Syncing {pendingSyncCount} check-in{pendingSyncCount === 1 ? "" : "s"}…</p>
        )}
      </div>
    </div>
  )
}
