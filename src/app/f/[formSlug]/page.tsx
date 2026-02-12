"use client"

import { useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Form, FormField } from "@/lib/types"
import { FormRenderer } from "@/components/forms/renderer/form-renderer"
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Sparkles,
  FileText,
  User,
  Building2,
  Award,
  Mail,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { format } from "date-fns"

interface EventRegistration {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone?: string
  attendee_designation?: string
  attendee_institution?: string
  status: string
  checked_in: boolean
  checked_in_at?: string
  checkin_token?: string
  ticket_type?: { id: string; name: string }
  event?: {
    id: string
    name: string
    short_name?: string
    start_date: string
    end_date: string
    venue_name?: string
    city?: string
    logo_url?: string
  }
}

export default function PublicFormPage() {
  const params = useParams()
  const router = useRouter()
  const formSlug = params.formSlug as string

  const [isSubmitted, setIsSubmitted] = useState(false)

  // Event form verification states
  const [registration, setRegistration] = useState<EventRegistration | null>(null)
  const [verifyEmail, setVerifyEmail] = useState("")
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-form", formSlug],
    queryFn: async () => {
      const response = await fetch("/api/forms/public/" + formSlug)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Form not found")
      }
      return response.json()
    },
  })

  const submitMutation = useMutation({
    mutationFn: async ({ responses, verifiedEmails }: {
      responses: Record<string, unknown>
      verifiedEmails?: Record<string, string>
    }) => {
      // For event forms, use verified registration email; otherwise extract from responses
      let submitterEmail: string | undefined
      let submitterName: string | undefined

      if (registration) {
        submitterEmail = registration.attendee_email
        submitterName = registration.attendee_name
      } else {
        const formFields: FormField[] = data?.fields || []
        const emailField = formFields.find((f: FormField) => f.field_type === "email")
        submitterEmail = emailField ? (responses[emailField.id] as string) : undefined
        const nameField = formFields.find((f: FormField) =>
          f.field_type === "text" && f.label?.toLowerCase().includes("name") && !f.label?.toLowerCase().includes("event")
        )
        submitterName = nameField ? (responses[nameField.id] as string) : undefined
      }

      const response = await fetch("/api/forms/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: data.form.id,
          responses,
          submitter_email: submitterEmail,
          submitter_name: submitterName,
          verified_emails: verifiedEmails,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to submit form")
      }

      return response.json()
    },
    onSuccess: () => {
      setIsSubmitted(true)
      if (data.form.redirect_url) {
        // Validate redirect URL is same-origin or relative to prevent open redirects
        try {
          const redirectUrl = new URL(data.form.redirect_url, window.location.origin)
          if (redirectUrl.origin === window.location.origin) {
            window.location.href = redirectUrl.href
          }
        } catch {
          // Invalid URL - ignore redirect
        }
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (responses: Record<string, unknown>, verifiedEmails?: Record<string, string>) => {
    submitMutation.mutate({ responses, verifiedEmails })
  }

  // Email verification against event registrations
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verifyEmail.trim() || !data?.form?.event_id) return

    setVerifyLoading(true)
    setVerifyError(null)

    try {
      const res = await fetch(`/api/my?q=${encodeURIComponent(verifyEmail.trim())}`)
      const result = await res.json()

      if (!res.ok) {
        setVerifyError("No registration found for this email. Please check your email or register for the event first.")
        return
      }

      // Filter registrations for this specific event
      const eventReg = result.registrations?.find(
        (r: EventRegistration) => r.event?.id === data.form.event_id
      )

      if (!eventReg) {
        setVerifyError("You are not registered for this event. Please register first to submit this form.")
        return
      }

      setRegistration(eventReg)
      toast.success(`Welcome, ${eventReg.attendee_name}!`)
    } catch {
      setVerifyError("Something went wrong. Please try again.")
    } finally {
      setVerifyLoading(false)
    }
  }

  // Pre-fill form values from registration
  const initialValues = useMemo(() => {
    if (!registration || !data?.fields) return undefined
    const formFields: FormField[] = data.fields
    const values: Record<string, unknown> = {}

    formFields.forEach((f: FormField) => {
      if (f.field_type === "email") {
        values[f.id] = registration.attendee_email
      }
      if (f.field_type === "text") {
        const label = (f.label || "").toLowerCase()
        if (label.includes("name") && !label.includes("event")) {
          values[f.id] = registration.attendee_name
        }
      }
    })

    return Object.keys(values).length > 0 ? values : undefined
  }, [registration, data?.fields])

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-2xl animate-pulse">
            <FileText className="w-10 h-10 text-white" />
          </div>
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Loading your form...</p>
        </div>
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-rose-50 to-orange-50">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-10 mx-4 max-w-md text-center border border-red-200">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <AlertCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-800 mb-3">Form Not Found</h1>
          <p className="text-gray-600 mb-8 text-lg">
            {(error as Error).message || "The form you are looking for does not exist."}
          </p>
          <Button
            onClick={() => router.push("/")}
            className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg"
          >
            Go Home
          </Button>
        </div>
      </div>
    )
  }

  const form: Form = data.form
  const fields: FormField[] = data.fields || []
  const isEventForm = !!form.event_id

  const isDeadlinePassed = form.submission_deadline
    ? new Date(form.submission_deadline) < new Date()
    : false

  const isMaxSubmissionsReached = form.max_submissions
    ? (data.submissionCount || 0) >= form.max_submissions
    : false

  // Form closed
  if (isDeadlinePassed || isMaxSubmissionsReached) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: form.background_color || "#F5F3FF" }}
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 mx-4 max-w-md text-center border border-amber-200">
          {form.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logo_url} alt="Logo" className="max-h-16 mx-auto mb-6 object-contain" />
          )}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <AlertCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-800 mb-3">Form Closed</h1>
          <p className="text-gray-600 mb-8 text-lg">
            {isDeadlinePassed
              ? "This form has passed its submission deadline"
              : "This form has reached its maximum number of submissions"}
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="border-2 border-amber-300 hover:bg-amber-50 font-bold px-8 py-3 rounded-xl"
          >
            Go Home
          </Button>
        </div>
      </div>
    )
  }

  // Event form: Email verification required
  if (isEventForm && !registration) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: form.background_color || "#F5F3FF" }}
      >
        <div className="w-full max-w-md">
          {/* Form Header */}
          <div className="text-center mb-8">
            {form.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo_url} alt="Logo" className="max-h-16 mx-auto mb-4 object-contain" />
            ) : (
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl"
                style={{ background: `linear-gradient(135deg, ${form.primary_color || "#8B5CF6"}, ${form.primary_color ? form.primary_color + "CC" : "#7C3AED"})` }}
              >
                <FileText className="w-10 h-10 text-white" />
              </div>
            )}
            <h1
              className="text-2xl font-black mb-2"
              style={{ color: form.primary_color || "#8B5CF6" }}
            >
              {form.name}
            </h1>
            {form.description && (
              <p className="text-gray-600 text-sm">{form.description}</p>
            )}
          </div>

          {/* Email Verification Form */}
          <form onSubmit={handleVerifyEmail} className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-gray-200/50">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${form.primary_color || "#8B5CF6"}20, ${form.primary_color || "#8B5CF6"}10)` }}
              >
                <Mail className="w-5 h-5" style={{ color: form.primary_color || "#8B5CF6" }} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Verify Your Registration</h2>
                <p className="text-sm text-gray-500">Enter the email you registered with</p>
              </div>
            </div>

            <div className="mb-4">
              <input
                type="email"
                value={verifyEmail}
                onChange={(e) => {
                  setVerifyEmail(e.target.value)
                  setVerifyError(null)
                }}
                placeholder="your.email@example.com"
                className="w-full px-4 py-3.5 text-base border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                autoFocus
                required
              />
            </div>

            {verifyError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{verifyError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={verifyLoading || !verifyEmail.trim()}
              className="w-full py-3.5 text-white rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{ background: `linear-gradient(135deg, ${form.primary_color || "#8B5CF6"}, ${form.primary_color ? form.primary_color + "CC" : "#7C3AED"})` }}
            >
              {verifyLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Verify & Continue
                </>
              )}
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              Only registered participants can submit this form
            </p>
          </form>

          <div className="text-center py-6">
            <p className="text-sm text-gray-500/80 font-medium flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: form.primary_color || "#8B5CF6" }} />
              Powered by AMASI Forms
              <Sparkles className="w-4 h-4" style={{ color: form.primary_color || "#8B5CF6" }} />
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Success screen
  if (isSubmitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: form.background_color || "#F5F3FF" }}
      >
        <div className="w-full max-w-md space-y-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 text-center border border-green-200">
            {form.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo_url} alt="Logo" className="max-h-16 mx-auto mb-6 object-contain" />
            )}
            <div
              className="w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl"
              style={{ background: `linear-gradient(135deg, ${form.primary_color || "#8B5CF6"}, ${form.primary_color ? form.primary_color + "CC" : "#7C3AED"})` }}
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-black mb-4" style={{ color: form.primary_color || "#8B5CF6" }}>
              Thank You!
            </h1>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <p className="text-lg font-semibold text-gray-700">Response submitted successfully</p>
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-gray-600 text-lg whitespace-pre-wrap mb-6">
              {form.success_message || "Your response has been recorded."}
            </p>

            {/* Certificate release message for event forms */}
            {registration && form.release_certificate_on_submission && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <div className="flex items-center justify-center gap-2 text-amber-700 font-semibold">
                  <Award className="w-5 h-5" />
                  <span>Your certificate has been released!</span>
                </div>
                {form.auto_email_certificate && (
                  <p className="text-sm text-amber-600 mt-1">A copy will be sent to your email shortly.</p>
                )}
              </div>
            )}

            {/* Link to /my page for downloads */}
            {registration && (
              <a
                href="/my"
                className="inline-flex items-center gap-2 mt-2 text-sm font-medium hover:underline"
                style={{ color: form.primary_color || "#8B5CF6" }}
              >
                Download your badge & certificate from My Page
              </a>
            )}

            {form.allow_multiple_submissions && (
              <Button
                className="mt-4 font-bold px-8 py-3 rounded-xl shadow-lg"
                style={{ background: `linear-gradient(135deg, ${form.primary_color || "#8B5CF6"}, ${form.primary_color ? form.primary_color + "CC" : "#7C3AED"})` }}
                onClick={() => setIsSubmitted(false)}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Submit Another Response
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Main form view
  return (
    <div className="min-h-screen py-12" style={{ backgroundColor: form.background_color || "#F5F3FF" }}>
      {form.header_image_url && (
        <div className="max-w-3xl mx-auto px-4 mb-8">
          <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.header_image_url} alt="Form header" className="w-full h-56 object-cover" />
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4">
        {/* Participant Info Card - shown for verified event participants */}
        {registration && (
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl p-5 mb-4 border border-gray-200/50">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${form.primary_color || "#8B5CF6"}, ${form.primary_color ? form.primary_color + "CC" : "#7C3AED"})` }}
              >
                {registration.attendee_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate">
                  Welcome, {registration.attendee_name}!
                </h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                  {registration.attendee_designation && (
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {registration.attendee_designation}
                    </span>
                  )}
                  {registration.attendee_institution && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {registration.attendee_institution}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 font-mono mt-1">{registration.registration_number}</p>
              </div>
              <button
                onClick={() => {
                  setRegistration(null)
                  setVerifyEmail("")
                }}
                className="text-xs text-gray-400 hover:text-gray-600 underline flex-shrink-0"
              >
                Change
              </button>
            </div>

          </div>
        )}

        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-gray-200/50">
          {/* Form Header */}
          <div
            className="p-8 md:p-10"
            style={{ background: `linear-gradient(135deg, ${form.primary_color || "#8B5CF6"}15, ${form.primary_color || "#8B5CF6"}08)` }}
          >
            {form.logo_url && (
              <div className="flex justify-center mb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.logo_url} alt="Logo" className="max-h-16 object-contain" />
              </div>
            )}
            <div className="flex items-center justify-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                style={{ background: `linear-gradient(135deg, ${form.primary_color || "#8B5CF6"}, ${form.primary_color ? form.primary_color + "CC" : "#7C3AED"})` }}
              >
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
            <h1
              className="text-3xl md:text-4xl font-black text-center mb-3"
              style={{ color: form.primary_color || "#8B5CF6" }}
            >
              {form.name}
            </h1>
            {form.description && (
              <p className="text-gray-600 text-center text-lg max-w-xl mx-auto">{form.description}</p>
            )}
            {form.submission_deadline && (
              <div
                className="flex items-center justify-center gap-2 mt-6 text-sm font-semibold px-5 py-2.5 rounded-full shadow-md inline-flex mx-auto"
                style={{
                  backgroundColor: `${form.primary_color || "#8B5CF6"}20`,
                  color: form.primary_color || "#8B5CF6"
                }}
              >
                <Calendar className="w-4 h-4" />
                <span>Submit by {format(new Date(form.submission_deadline), "MMMM d, yyyy")}</span>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="p-8 md:p-10 bg-gradient-to-b from-gray-50/50 to-white">
            <FormRenderer
              form={form}
              fields={fields}
              onSubmit={handleSubmit}
              isSubmitting={submitMutation.isPending}
              requireEmailVerification={!registration}
              initialValues={initialValues}
              preVerifiedEmail={registration?.attendee_email}
            />
          </div>
        </div>

        <div className="text-center py-8">
          <p className="text-sm text-gray-500 font-medium flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            Powered by AMASI Forms
            <Sparkles className="w-4 h-4 text-violet-400" />
          </p>
        </div>
      </div>
    </div>
  )
}
