"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  Loader2,
  Download,
  User,
  Building2,
  Ticket,
  Calendar,
  CheckCircle,
  XCircle,
  FileText,
  RefreshCw,
} from "lucide-react"

interface BadgeInfo {
  registration: {
    id: string
    registration_number: string
    attendee_name: string
    attendee_email: string
    attendee_designation?: string
    attendee_institution?: string
    badge_url?: string
    badge_generated_at?: string
    ticket_type?: { id: string; name: string }
    event?: {
      id: string
      name: string
      short_name?: string
      start_date: string
      end_date: string
    }
  }
  template?: {
    id: string
    name: string
  }
}

export default function BadgeDownloadPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [badgeInfo, setBadgeInfo] = useState<BadgeInfo | null>(null)

  useEffect(() => {
    async function fetchBadgeInfo() {
      try {
        const res = await fetch(`/api/badge/${token}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch badge info")
        }

        setBadgeInfo(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchBadgeInfo()
    }
  }, [token])

  const handleDownload = async () => {
    if (!badgeInfo) return

    setGenerating(true)

    try {
      // If badge URL exists, redirect to it
      if (badgeInfo.registration.badge_url) {
        window.open(badgeInfo.registration.badge_url, "_blank")
        setGenerating(false)
        return
      }

      // Generate badge on the fly
      const res = await fetch(`/api/badge/${token}/download`)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to generate badge")
      }

      // Download the PDF
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `badge-${badgeInfo.registration.registration_number}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto" />
          <p className="text-white/70 mt-4">Loading badge information...</p>
        </div>
      </div>
    )
  }

  if (error || !badgeInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Badge Not Found</h1>
          <p className="text-gray-600">
            {error || "This badge link is invalid or has expired."}
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Please contact the event organizer for assistance.
          </p>
        </div>
      </div>
    )
  }

  const { registration } = badgeInfo
  const event = registration.event

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold">Your Event Badge</h1>
          <p className="text-indigo-100 text-sm mt-1">Download with one click</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Attendee Info */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{registration.attendee_name}</h2>
            {registration.attendee_designation && (
              <p className="text-gray-600">{registration.attendee_designation}</p>
            )}
            {registration.attendee_institution && (
              <p className="text-gray-500 text-sm flex items-center justify-center gap-1">
                <Building2 className="w-4 h-4" />
                {registration.attendee_institution}
              </p>
            )}
          </div>

          {/* Event Info */}
          {event && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">{event.short_name || event.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>
                  {formatDate(event.start_date)}
                  {event.end_date !== event.start_date && ` - ${formatDate(event.end_date)}`}
                </span>
              </div>
            </div>
          )}

          {/* Badge Details */}
          <div className="space-y-3 mb-6">
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

            {registration.badge_generated_at && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Badge Status</span>
                </div>
                <span className="text-green-600 font-medium text-sm">
                  Generated {formatDate(registration.badge_generated_at)}
                </span>
              </div>
            )}
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={generating}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-3 hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {generating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Generating Badge...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download Badge
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 text-center">
          <p className="text-xs text-gray-500">
            Print this badge and wear it at the event venue for identification.
          </p>
        </div>
      </div>
    </div>
  )
}
