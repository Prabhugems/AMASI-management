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
        .single()
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
        .single()
      return data
    },
  })

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
  }, [result])

  // Focus input on mount and after reset
  useEffect(() => {
    if (!result) {
      inputRef.current?.focus()
    }
  }, [result])

  const resetKiosk = useCallback(() => {
    setResult(null)
    setRegistrationNumber("")
    setCountdown(10)
    setEmailSent(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

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
        .single()

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
          .single()

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

  // Success/Error Screen
  if (result) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
        {/* Header */}
        <div className="bg-black/20 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{event?.short_name || event?.name}</h1>
            <p className="text-white/60 text-sm">{list?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-sm">Auto-reset in</p>
            <p className="text-3xl font-bold text-white">{countdown}s</p>
          </div>
        </div>

        {/* Result Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full text-center">
            {result.success ? (
              <>
                {/* Success Animation */}
                <div className="mb-8 relative">
                  <div className="w-32 h-32 mx-auto rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                    <CheckCircle2 className="h-20 w-20 text-green-400" />
                  </div>
                </div>

                {/* Welcome Message */}
                <h1 className="text-5xl font-bold text-white mb-4">
                  Welcome, {result.registration?.attendee_name?.split(" ")[0]}!
                </h1>
                <p className="text-2xl text-green-400 mb-8">
                  {result.alreadyCheckedIn ? "You're already checked in" : "Check-in successful"}
                </p>

                {/* Details Card */}
                <div className="bg-white/10 backdrop-blur rounded-2xl p-8 mb-8 text-left">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex items-start gap-4">
                      <User className="h-6 w-6 text-white/60 mt-1" />
                      <div>
                        <p className="text-white/60 text-sm">Name</p>
                        <p className="text-white text-xl font-medium">{result.registration?.attendee_name}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <Ticket className="h-6 w-6 text-white/60 mt-1" />
                      <div>
                        <p className="text-white/60 text-sm">Registration</p>
                        <p className="text-white text-xl font-medium">{result.registration?.registration_number}</p>
                      </div>
                    </div>
                    {result.registration?.attendee_designation && (
                      <div className="flex items-start gap-4">
                        <User className="h-6 w-6 text-white/60 mt-1" />
                        <div>
                          <p className="text-white/60 text-sm">Designation</p>
                          <p className="text-white text-xl font-medium">{result.registration.attendee_designation}</p>
                        </div>
                      </div>
                    )}
                    {result.registration?.attendee_institution && (
                      <div className="flex items-start gap-4">
                        <MapPin className="h-6 w-6 text-white/60 mt-1" />
                        <div>
                          <p className="text-white/60 text-sm">Institution</p>
                          <p className="text-white text-xl font-medium">{result.registration.attendee_institution}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 justify-center">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-16 px-8 text-lg border-white/30 text-white hover:bg-white/10"
                    onClick={resetKiosk}
                  >
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Done
                  </Button>
                  {!emailSent ? (
                    <Button
                      size="lg"
                      className="h-16 px-8 text-lg bg-blue-600 hover:bg-blue-700"
                      onClick={handleEmailBadge}
                      disabled={sendingEmail}
                    >
                      {sendingEmail ? (
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <Mail className="h-5 w-5 mr-2" />
                      )}
                      Email My Badge
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="h-16 px-8 text-lg bg-green-600 hover:bg-green-700"
                      disabled
                    >
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Badge Sent!
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Error Animation */}
                <div className="mb-8">
                  <div className="w-32 h-32 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="h-20 w-20 text-red-400" />
                  </div>
                </div>

                {/* Error Message */}
                <h1 className="text-4xl font-bold text-white mb-4">Oops!</h1>
                <p className="text-xl text-red-400 mb-8">{result.message}</p>

                {/* Try Again Button */}
                <Button
                  size="lg"
                  className="h-16 px-12 text-lg"
                  onClick={resetKiosk}
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Try Again
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-black/20 px-8 py-4 text-center">
          <p className="text-white/40 text-sm">Touch anywhere or wait {countdown} seconds to check in another person</p>
        </div>
      </div>
    )
  }

  // Scan Screen
  return (
    <div
      className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div className="bg-black/20 px-8 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{event?.short_name || event?.name || "Event"}</h1>
            <div className="flex items-center gap-4 mt-1 text-white/60">
              {event?.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(event.start_date)}
                </span>
              )}
              {event?.venue_name && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {event.venue_name}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-sm">Checking in for</p>
            <p className="text-xl font-semibold text-white">{list?.name || "Loading..."}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          {/* QR Icon */}
          <div className="text-center mb-8">
            <div className="w-40 h-40 mx-auto rounded-3xl bg-white/10 flex items-center justify-center mb-6">
              <QrCode className="h-24 w-24 text-white/80" />
            </div>
            <h2 className="text-4xl font-bold text-white mb-2">Self Check-in</h2>
            <p className="text-xl text-white/60">Scan QR code or enter your name / phone / registration number</p>
          </div>

          {/* Input Area */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                placeholder="Registration #, Name, Phone, or Email..."
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                className="h-20 text-2xl text-center bg-white text-slate-900 border-0 rounded-xl placeholder:text-slate-400"
                autoComplete="off"
                autoFocus
              />
              <Keyboard className="absolute right-6 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400" />
            </div>

            <Button
              size="lg"
              className="w-full h-20 mt-6 text-2xl font-semibold bg-green-600 hover:bg-green-700 rounded-xl"
              onClick={handleCheckin}
              disabled={isProcessing || !registrationNumber.trim()}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-8 w-8 mr-3 animate-spin" />
                  Checking in...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-8 w-8 mr-3" />
                  Check In
                </>
              )}
            </Button>
          </div>

          {/* Instructions */}
          <div className="mt-8 grid grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-xl p-6 flex items-start gap-4">
              <Camera className="h-8 w-8 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-white font-medium">QR Code</p>
                <p className="text-white/60 text-sm">Position your badge QR code in front of the scanner</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-6 flex items-start gap-4">
              <Keyboard className="h-8 w-8 text-purple-400 flex-shrink-0" />
              <div>
                <p className="text-white font-medium">Manual Entry</p>
                <p className="text-white/60 text-sm">Type your name, phone number, or registration ID</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-black/20 px-8 py-4 text-center">
        <p className="text-white/40 text-sm">Need help? Please contact the registration desk</p>
      </div>
    </div>
  )
}
