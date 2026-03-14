import { createAdminClient } from "@/lib/supabase/server"
import { Metadata } from "next"
import {
  CheckCircle,
  XCircle,
  Award,
  User,
  FileText,
  Calendar,
  MapPin,
  Building2,
  Clock,
  Shield,
  Mic,
} from "lucide-react"

type Props = {
  params: Promise<{ number: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params
  return {
    title: `Verify Certificate - ${number}`,
    description: `Verify presenter certificate for abstract ${number}`,
  }
}

export default async function VerifyAbstractPage({ params }: Props) {
  const { number } = await params
  const supabase = await createAdminClient()

  // Fetch abstract details
  const { data: abstract } = await (supabase as any)
    .from("abstracts")
    .select(`
      id,
      abstract_number,
      title,
      status,
      accepted_as,
      presenting_author_name,
      presenting_author_email,
      presenting_author_affiliation,
      session_date,
      session_time,
      session_location,
      presentation_completed,
      presentation_completed_at,
      events(id, name, short_name, start_date, end_date, city, venue_name, logo_url)
    `)
    .eq("abstract_number", number)
    .maybeSingle()

  const isValid = abstract && abstract.status === "accepted"
  const hasPresented = abstract?.presentation_completed === true
  const event = abstract?.events

  // Format dates
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const formatTime = (time: string | null) => {
    if (!time) return null
    const [h, m] = time.split(":")
    const hr = parseInt(h)
    if (isNaN(hr)) return time
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const presentationType = (type: string | null) => {
    if (!type) return null
    const labels: Record<string, string> = {
      oral: "Oral Presentation",
      poster: "Poster Presentation",
      video: "Video Presentation",
      eposter: "E-Poster Presentation",
    }
    return labels[type.toLowerCase()] || type
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Shield className="h-4 w-4" />
            <span>Certificate Verification Portal</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Verification Status Card */}
        <div
          className={`rounded-2xl border-2 p-6 mb-6 ${
            isValid
              ? hasPresented
                ? "bg-emerald-50 border-emerald-200"
                : "bg-blue-50 border-blue-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-full ${
                isValid
                  ? hasPresented
                    ? "bg-emerald-500"
                    : "bg-blue-500"
                  : "bg-red-500"
              }`}
            >
              {isValid ? (
                <CheckCircle className="h-8 w-8 text-white" />
              ) : (
                <XCircle className="h-8 w-8 text-white" />
              )}
            </div>
            <div className="flex-1">
              <h1
                className={`text-2xl font-bold ${
                  isValid
                    ? hasPresented
                      ? "text-emerald-800"
                      : "text-blue-800"
                    : "text-red-800"
                }`}
              >
                {isValid
                  ? hasPresented
                    ? "Certificate Verified"
                    : "Abstract Accepted"
                  : "Not Found"}
              </h1>
              <p
                className={`text-sm mt-1 ${
                  isValid
                    ? hasPresented
                      ? "text-emerald-600"
                      : "text-blue-600"
                    : "text-red-600"
                }`}
              >
                {isValid
                  ? hasPresented
                    ? "This presenter certificate is authentic and valid."
                    : "This abstract has been accepted but presentation is pending."
                  : `No accepted abstract found with number "${number}".`}
              </p>
            </div>
          </div>
        </div>

        {isValid && abstract && (
          <>
            {/* Presenter Info */}
            <div className="bg-white rounded-2xl border shadow-sm p-6 mb-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
                <Award className="h-4 w-4" />
                <span>Certificate Details</span>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                  {abstract.presenting_author_name?.charAt(0) || "?"}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {abstract.presenting_author_name}
                  </h2>
                  {abstract.presenting_author_affiliation && (
                    <p className="text-slate-500 text-sm flex items-center gap-1 mt-0.5">
                      <Building2 className="h-3.5 w-3.5" />
                      {abstract.presenting_author_affiliation}
                    </p>
                  )}
                </div>
              </div>

              {/* Abstract Number Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-sm font-mono text-slate-600 mb-4">
                <FileText className="h-3.5 w-3.5" />
                Abstract #{abstract.abstract_number}
              </div>

              {/* Abstract Title */}
              <div className="mb-6">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                  Paper Title
                </p>
                <p className="text-slate-800 font-medium leading-relaxed">
                  {abstract.title}
                </p>
              </div>

              {/* Presentation Type */}
              {abstract.accepted_as && (
                <div className="flex items-center gap-2 mb-4">
                  <Mic className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm text-slate-600">
                    {presentationType(abstract.accepted_as)}
                  </span>
                </div>
              )}

              {/* Presentation Status */}
              {hasPresented && abstract.presentation_completed_at && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800">
                      Presentation Completed
                    </p>
                    <p className="text-xs text-emerald-600">
                      {formatDateTime(abstract.presentation_completed_at)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Event Info */}
            {event && (
              <div className="bg-white rounded-2xl border shadow-sm p-6 mb-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
                  <Calendar className="h-4 w-4" />
                  <span>Event Information</span>
                </div>

                <h3 className="text-lg font-semibold text-slate-800 mb-3">
                  {event.name}
                </h3>

                <div className="space-y-2 text-sm text-slate-600">
                  {event.start_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>
                        {formatDate(event.start_date)}
                        {event.end_date &&
                          event.end_date !== event.start_date &&
                          ` - ${formatDate(event.end_date)}`}
                      </span>
                    </div>
                  )}
                  {(event.venue_name || event.city) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span>
                        {[event.venue_name, event.city].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Session Details */}
                {(abstract.session_date || abstract.session_location) && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                      Session Details
                    </p>
                    <div className="space-y-2 text-sm text-slate-600">
                      {abstract.session_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span>{formatDate(abstract.session_date)}</span>
                          {abstract.session_time && (
                            <span className="text-slate-400">
                              at {formatTime(abstract.session_time)}
                            </span>
                          )}
                        </div>
                      )}
                      {abstract.session_location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          <span>{abstract.session_location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Verification Info */}
            <div className="bg-slate-50 rounded-xl border p-4 text-center">
              <p className="text-xs text-slate-400">
                Verified on {new Date().toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Certificate verification powered by AMASI Management System
              </p>
            </div>
          </>
        )}

        {/* Not Found State */}
        {!isValid && (
          <div className="bg-white rounded-2xl border shadow-sm p-8 text-center">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              Certificate Not Found
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              The abstract number "{number}" was not found in our system or has not
              been accepted. Please check the number and try again.
            </p>
            <p className="text-xs text-slate-400 mt-4">
              If you believe this is an error, please contact the event organizers.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-white mt-8">
        <div className="max-w-2xl mx-auto px-4 py-4 text-center">
          <p className="text-xs text-slate-400">
            This is an official certificate verification page.
          </p>
        </div>
      </div>
    </div>
  )
}
