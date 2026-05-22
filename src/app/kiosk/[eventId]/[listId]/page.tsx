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
  RotateCcw,
  User,
  Calendar,
  MapPin,
  Ticket,
  AlertCircle,
  Keyboard,
  Camera,
  Briefcase,
  Building2,
} from "lucide-react"
import { toast } from "sonner"

type CheckinResult = {
  success: boolean
  message: string
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

export default function KioskPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const listId = params.listId as string
  const supabase = createClient()

  const [registrationNumber, setRegistrationNumber] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<CheckinResult | null>(null)
  const [countdown, setCountdown] = useState(10)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const handleCheckin = async () => {
    if (!registrationNumber.trim()) {
      toast.error("Please enter a registration number")
      return
    }

    setIsProcessing(true)

    try {
      // Find registration by reg number, name, email, or phone
      const searchTerm = registrationNumber.trim()
      const { data: registration, error: regError } = await (supabase as any)
        .from("registrations")
        .select(`
          id,
          registration_number,
          attendee_name,
          attendee_email,
          attendee_phone,
          attendee_designation,
          attendee_institution,
          ticket_type:ticket_types(name)
        `)
        .eq("event_id", eventId)
        .or(`registration_number.ilike.%${searchTerm}%,attendee_email.ilike.%${searchTerm}%,attendee_name.ilike.%${searchTerm}%,attendee_phone.ilike.%${searchTerm}%`)
        .limit(1)
        .maybeSingle()

      if (regError || !registration) {
        setResult({
          success: false,
          message: "Registration not found. Please check your registration number.",
        })
        return
      }

      // Check if already checked in (if multiple not allowed)
      if (!list?.allow_multiple_checkins) {
        const { data: existingCheckin } = await (supabase as any)
          .from("checkin_records")
          .select("id")
          .eq("registration_id", registration.id)
          .eq("checkin_list_id", listId)
          .limit(1)
          .maybeSingle()

        if (existingCheckin) {
          setResult({
            success: true,
            message: "You're already checked in!",
            registration,
            alreadyCheckedIn: true,
          })
          return
        }
      }

      // Create check-in record
      const { error: checkinError } = await (supabase as any)
        .from("checkin_records")
        .insert({
          registration_id: registration.id,
          checkin_list_id: listId,
          checked_in_at: new Date().toISOString(),
        })

      if (checkinError) {
        setResult({
          success: false,
          message: "Failed to check in. Please try again.",
        })
        return
      }

      setResult({
        success: true,
        message: "Check-in successful!",
        registration,
      })
    } catch (_error) {
      setResult({
        success: false,
        message: "Something went wrong. Please try again.",
      })
    } finally {
      setIsProcessing(false)
    }
  }

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCheckin()
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
                <p className="text-base sm:text-xl text-emerald-300 mb-8">
                  {result.alreadyCheckedIn ? "You're already checked in" : "Check-in successful"}
                </p>

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
                onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                className="h-14 sm:h-16 text-base sm:text-xl text-center bg-white text-slate-900 border-0 rounded-xl placeholder:text-slate-400 pr-14"
                autoComplete="off"
                autoFocus
              />
              <Keyboard className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-7 sm:w-7 text-slate-400 pointer-events-none" />
            </div>

            <Button
              size="lg"
              className="w-full h-14 sm:h-16 mt-4 text-base sm:text-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
              onClick={handleCheckin}
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
                <Camera className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">QR code</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Position your badge QR code in front of the scanner
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
