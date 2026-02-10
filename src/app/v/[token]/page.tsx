"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { CheckCircle, Loader2, Calendar, MapPin, Ticket, User, Clock, ShieldCheck, ShieldX } from "lucide-react"

interface VerificationResult {
  valid: boolean
  error?: string
  registration?: {
    id: string
    registration_number: string
    attendee_name: string
    attendee_email: string
    attendee_phone?: string
    attendee_designation?: string
    attendee_institution?: string
    checked_in: boolean
    checked_in_at?: string
    ticket_type?: { id: string; name: string }
    event?: {
      id: string
      name: string
      start_date: string
      end_date: string
      venue?: string
    }
  }
}

export default function VerifyBadgePage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<VerificationResult | null>(null)

  useEffect(() => {
    async function verifyToken() {
      try {
        const res = await fetch(`/api/verify/${token}`)
        const data = await res.json()
        setResult(data)
      } catch (_error) {
        setResult({ valid: false, error: "Failed to verify badge" })
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      verifyToken()
    }
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto" />
          <p className="text-white/70 mt-4">Verifying badge...</p>
        </div>
      </div>
    )
  }

  if (!result?.valid || !result.registration) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 to-red-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldX className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Badge</h1>
          <p className="text-gray-600 mb-6">
            {result?.error || "This badge could not be verified. It may be invalid or expired."}
          </p>
          <div className="p-4 bg-red-50 rounded-lg text-sm text-red-700">
            If you believe this is an error, please contact the event organizers.
          </div>
        </div>
      </div>
    )
  }

  const { registration } = result
  const event = registration.event

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-emerald-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold">Verified Badge</h1>
          <p className="text-emerald-100 text-sm mt-1">This is a valid event badge</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Attendee Name */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{registration.attendee_name}</h2>
            {registration.attendee_designation && (
              <p className="text-gray-600">{registration.attendee_designation}</p>
            )}
            {registration.attendee_institution && (
              <p className="text-gray-500 text-sm">{registration.attendee_institution}</p>
            )}
          </div>

          {/* Event Info */}
          {event && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3">{event.name}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(event.start_date)} - {formatDate(event.end_date)}</span>
                </div>
                {event.venue && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{event.venue}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Badge Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex items-center gap-2 text-gray-600">
                <Ticket className="w-4 h-4" />
                <span>Ticket Type</span>
              </div>
              <span className="font-medium text-gray-900">
                {registration.ticket_type?.name || "General"}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex items-center gap-2 text-gray-600">
                <User className="w-4 h-4" />
                <span>Registration #</span>
              </div>
              <span className="font-mono font-medium text-gray-900">
                {registration.registration_number}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Check-in Status</span>
              </div>
              {registration.checked_in ? (
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Checked In
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <Clock className="w-4 h-4" />
                  Not Checked In
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 text-center">
          <p className="text-xs text-gray-500">
            This badge has been verified. For check-in, present this at the registration desk.
          </p>
        </div>
      </div>
    </div>
  )
}
