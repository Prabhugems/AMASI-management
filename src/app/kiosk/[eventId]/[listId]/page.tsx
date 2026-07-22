"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
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
import { enqueueRequest, flushRequestQueue, isNetworkFailure } from "@/lib/offline-scan-queue"

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

export default function KioskPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const listId = params.listId as string
  const supabase = createClient()
  // Namespaced distinctly from the admin scanner's and staff scanner's
  // offline queues so the three can never collide.
  const queuePartitionKey = `kiosk:${eventId}:${listId}`

  const [registrationNumber, setRegistrationNumber] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<CheckinResult | null>(null)
  const [countdown, setCountdown] = useState(10)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false)
  const [whatsappSent, setWhatsappSent] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Scanner-burst auto-submit + double-submit guard (see handleRegChange).
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const burstStartRef = useRef<number>(0)
  const lastKeyTimeRef = useRef<number>(0)
  const submittingRef = useRef<boolean>(false)

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

  // Offline handling here is deliberately NOT a transplant of the staff
  // scanner's "show success immediately, reconcile later" pattern — that
  // design relies on a human volunteer noticing a later sync problem. A
  // kiosk is unattended: an optimistic "Check-in successful!" for a
  // queued-but-unconfirmed scan would manufacture false confidence at a
  // public terminal with nobody there to catch a later failure. So:
  //   1. Pre-flight offline check — honest "please wait" state, no lies.
  //   2. Inline retry (2 attempts, ~1.5s apart) on a network blip, before
  //      showing any result — covers brief drops without ever queuing.
  //   3. Only once retries are exhausted, queue as a last-resort safety net
  //      so the scan self-heals in the background — but the attendee still
  //      sees an honest failure, never the success/countdown screen.
  const handleCheckin = async (override?: string) => {
    // `override` lets the scanner-burst auto-submit and the Enter handler pass
    // the live DOM value, which a fast scanner can fill before React flushes
    // `registrationNumber` state.
    const searchTerm = (override ?? registrationNumber).trim()
    if (!searchTerm) {
      toast.error("Please enter a registration number")
      return
    }

    // Guard against a double submit (burst timer racing the Enter key / a tap).
    if (submittingRef.current) return
    submittingRef.current = true
    setIsProcessing(true)

    const body = { event_id: eventId, checkin_list_id: listId, search: searchTerm }

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setResult({
          success: false,
          message: "You appear to be offline. Please wait a moment and try again.",
        })
        return
      }

      let lastErr: unknown = null
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          // The check-in runs server-side via the admin client. The kiosk is
          // a public (anon) page and checkin_records has RLS with no policy,
          // so a direct browser insert is always denied — see
          // /api/kiosk/checkin.
          const res = await fetch("/api/kiosk/checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
          const data = (await res.json().catch(() => ({}))) as CheckinResult
          setResult({
            success: !!data.success,
            message:
              data.message ||
              (data.success ? "Check-in successful!" : "Failed to check in. Please try again."),
            warning: data.warning,
            registration: data.registration,
            alreadyCheckedIn: data.alreadyCheckedIn,
          })
          return
        } catch (err) {
          lastErr = err
          if (!isNetworkFailure(err) || attempt === 2) break
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }
      }

      if (isNetworkFailure(lastErr)) {
        await enqueueRequest(queuePartitionKey, { url: "/api/kiosk/checkin", body })
      }
      setResult({
        success: false,
        message: "We couldn't check you in — please see a staff member.",
      })
    } finally {
      setIsProcessing(false)
      submittingRef.current = false
    }
  }

  // Silent background self-heal for anything queued above — no "queue" or
  // "pending" language anywhere in the attendee-facing UI; this just retries
  // once connectivity returns, the same way it would have worked the first
  // time if the network hadn't blipped. Also polls every 20s: navigator.onLine
  // only reflects the OS network interface, not request health, so a
  // timed-out request (see fetch-with-timeout.ts) can queue silently with
  // onLine still true and no `online` event ever firing to drain it — this
  // matters most here since the kiosk is unattended and can't be nudged.
  useEffect(() => {
    const flush = () => {
      flushRequestQueue(queuePartitionKey, () => {}).catch(() => {})
    }
    if (typeof navigator !== "undefined" && navigator.onLine) flush()
    window.addEventListener("online", flush)
    const pollId = setInterval(() => {
      if (navigator.onLine) flush()
    }, 20000)
    return () => {
      window.removeEventListener("online", flush)
      clearInterval(pollId)
    }
  }, [queuePartitionKey])

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
              disabled={isProcessing || !registrationNumber.trim()}
            >
              {isProcessing ? (
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
      </div>
    </div>
  )
}
