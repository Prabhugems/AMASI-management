"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { InsertChat } from "@/components/insert-chat"
import { TravelForm } from "@/components/travel-form"
import { JourneyItinerary } from "@/components/journey-itinerary"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  Building2,
  Plane,
  ArrowRight,
} from "lucide-react"
import { toast, Toaster } from "sonner"

type FacultyAssignment = {
  id: string
  event_id: string
  faculty_name: string
  faculty_email: string | null
  faculty_phone: string | null
  role: string
  status: string
  session_name: string
  session_date: string
  start_time: string
  end_time: string
  hall: string
  topic_title: string | null
  responded_at: string | null
  registration_id: string | null
}

type Event = {
  id: string
  name: string
  short_name: string | null
  logo_url: string | null
  start_date: string | null
  end_date: string | null
  venue_name: string | null
}

type Faculty = {
  name: string
  email: string | null
  phone: string | null
}

type Registration = {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  status: string
  custom_fields: any
}

// Create a QueryClient for the page
const queryClient = new QueryClient()

function RespondPageContent() {
  const params = useParams()
  const token = params.token as string

  const [submitting, setSubmitting] = useState(false)
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [step, setStep] = useState<"confirm" | "travel">("confirm")

  // Fetch data via TanStack Query for proper cache invalidation
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["respond-portal", token],
    queryFn: async () => {
      const res = await fetch(`/api/respond/${token}`)
      const result = await res.json()
      if (!res.ok || result.error) {
        throw new Error(result.error || "Invalid or expired invitation link")
      }
      return result as {
        faculty: Faculty
        assignments: FacultyAssignment[]
        event: Event
        registration: Registration | null
      }
    },
  })

  const faculty = data?.faculty || null
  const assignments = data?.assignments || []
  const event = data?.event || null
  const registration = data?.registration || null

  // Initialize responses and determine step
  useEffect(() => {
    if (!assignments.length) return

    const initialResponses: Record<string, string> = {}
    let allResponded = true
    assignments.forEach((a: FacultyAssignment) => {
      if (a.status === "pending" || a.status === "invited") {
        initialResponses[a.id] = ""
        allResponded = false
      } else {
        initialResponses[a.id] = a.status
      }
    })
    setResponses(initialResponses)

    // If all have been responded to, skip to travel step
    if (allResponded && assignments.length > 0) {
      setStep("travel")
    }
  }, [assignments])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const formatTime = (time: string | null) => {
    if (!time) return ""
    return time.substring(0, 5)
  }

  const confirmAll = () => {
    const newResponses: Record<string, string> = {}
    assignments.forEach((a) => {
      newResponses[a.id] = "confirmed"
    })
    setResponses(newResponses)
  }

  const setIndividualResponse = (id: string, status: string) => {
    setResponses((prev) => ({ ...prev, [id]: status }))
  }

  const setNoteForAssignment = (id: string, note: string) => {
    setNotes((prev) => ({ ...prev, [id]: note }))
  }

  const handleSubmit = async () => {
    const pendingCount = Object.values(responses).filter((r) => !r).length
    if (pendingCount > 0) {
      toast.error(`Please respond to all ${pendingCount} pending topic(s)`)
      return
    }

    const missingNotes: string[] = []
    Object.entries(responses).forEach(([id, status]) => {
      if ((status === "declined" || status === "change_requested") && !notes[id]?.trim()) {
        missingNotes.push(id)
      }
    })
    if (missingNotes.length > 0) {
      toast.error(`Please provide reason for ${missingNotes.length} topic(s) marked as declined/change requested`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/respond/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses, notes }),
      })

      const result = await res.json()

      if (!res.ok || result.error) {
        throw new Error(result.error || "Failed to submit")
      }

      toast.success("Your responses have been recorded!")

      // If any were confirmed, move to travel step
      const hasConfirmed = Object.values(responses).some((s) => s === "confirmed")
      if (hasConfirmed) {
        // Refetch to get the newly created registration
        await refetch()
        setStep("travel")
      } else {
        // All declined/changed, just show confirmation
        await refetch()
        setStep("travel") // Still go to travel in case they want to see summary
      }
    } catch (_err) {
      toast.error("Failed to submit responses. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-white/70">Loading your invitation...</p>
        </div>
      </div>
    )
  }

  if (error || !faculty) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/10 backdrop-blur border-white/20">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Invalid Link</h2>
            <p className="text-white/70">
              {error instanceof Error ? error.message : "This invitation link is invalid or has expired."}
            </p>
            <p className="text-sm text-white/50 mt-4">
              If you believe this is an error, please contact the event organizers.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const confirmedCount = Object.values(responses).filter((r) => r === "confirmed").length
  const declinedCount = Object.values(responses).filter((r) => r === "declined").length
  const changeCount = Object.values(responses).filter((r) => r === "change_requested").length
  const pendingCount = Object.values(responses).filter((r) => !r).length

  const hasAnyConfirmed = assignments.some(
    (a) => a.status === "confirmed" || responses[a.id] === "confirmed"
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 print:bg-white print:min-h-0">
      <Toaster position="top-center" richColors />
      <InsertChat
        userEmail={faculty?.email || ""}
        userFirstName={faculty?.name?.split(" ")[0] || ""}
        userLastName={faculty?.name?.split(" ").slice(1).join(" ") || ""}
        metadata={{ event: event?.name || "", type: "faculty" }}
      />

      {/* Header */}
      <div className="bg-white/5 backdrop-blur border-b border-white/10 print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {event?.logo_url && (
                <img src={event.logo_url} alt="" className="h-12 rounded" />
              )}
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {event?.short_name || event?.name || "Conference"}
                </h1>
                <div className="flex items-center gap-4 mt-1 text-white/70 text-sm">
                  {event?.venue_name && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {event.venue_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => {
                // Only allow going back to confirm if not all locked
                const allPreviouslyResponded = assignments.every(
                  (a) => a.status !== "pending" && a.status !== "invited"
                )
                if (!allPreviouslyResponded) setStep("confirm")
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                step === "confirm"
                  ? "bg-primary text-white"
                  : "bg-white/10 text-white/60"
              )}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
                1
              </span>
              Sessions
            </button>
            <ArrowRight className="h-4 w-4 text-white/30" />
            <button
              onClick={() => {
                if (hasAnyConfirmed) setStep("travel")
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                step === "travel"
                  ? "bg-primary text-white"
                  : "bg-white/10 text-white/60",
                !hasAnyConfirmed && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
                2
              </span>
              Travel
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 print:p-0 print:max-w-none">
        {/* Welcome Card */}
        <Card className="bg-white/10 backdrop-blur border-white/20 print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5" />
              Welcome, {faculty.name}
            </CardTitle>
            <CardDescription className="text-white/70">
              {step === "confirm"
                ? `Please confirm your participation for ${assignments.length} assigned topic${assignments.length !== 1 ? "s" : ""}`
                : "Submit your travel details so we can arrange your journey"}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* STEP 1: Session Confirmation */}
        {step === "confirm" && (
          <>
            {/* Quick Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
                onClick={confirmAll}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirm All Topics
              </Button>
            </div>

            {/* Assignments List */}
            <div className="space-y-4">
              {assignments.map((assignment, index) => (
                <Card
                  key={assignment.id}
                  className={cn(
                    "bg-white/10 backdrop-blur border-white/20 transition-colors",
                    responses[assignment.id] === "confirmed" && "border-green-500/40 bg-green-500/5",
                    responses[assignment.id] === "declined" && "border-red-500/40 bg-red-500/5",
                    responses[assignment.id] === "change_requested" && "border-amber-500/40 bg-amber-500/5"
                  )}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="bg-white/10 text-white/70 text-sm font-medium px-2 py-1 rounded">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-white">{assignment.session_name}</p>
                        {assignment.topic_title && (
                          <p className="text-sm text-white/60 mt-0.5">{assignment.topic_title}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/50 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(assignment.session_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(assignment.start_time)} - {formatTime(assignment.end_time)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {assignment.hall}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize shrink-0 text-white/70 border-white/30">
                        {assignment.role}
                      </Badge>
                    </div>

                    {/* Response buttons */}
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant={responses[assignment.id] === "confirmed" ? "default" : "outline"}
                        className={cn(
                          "flex-1",
                          responses[assignment.id] === "confirmed"
                            ? "bg-green-600 hover:bg-green-700"
                            : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                        )}
                        onClick={() => setIndividualResponse(assignment.id, "confirmed")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant={responses[assignment.id] === "change_requested" ? "default" : "outline"}
                        className={cn(
                          "flex-1",
                          responses[assignment.id] === "change_requested"
                            ? "bg-amber-600 hover:bg-amber-700"
                            : "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        )}
                        onClick={() => setIndividualResponse(assignment.id, "change_requested")}
                        title="Request change in date/time/topic"
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Change
                      </Button>
                      <Button
                        size="sm"
                        variant={responses[assignment.id] === "declined" ? "default" : "outline"}
                        className={cn(
                          "flex-1",
                          responses[assignment.id] === "declined"
                            ? "bg-red-600 hover:bg-red-700"
                            : "border-red-500/30 text-red-400 hover:bg-red-500/10"
                        )}
                        onClick={() => setIndividualResponse(assignment.id, "declined")}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>

                    {/* Notes field */}
                    {(responses[assignment.id] === "declined" ||
                      responses[assignment.id] === "change_requested") && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <Label className="text-sm font-medium text-white/80">
                          {responses[assignment.id] === "change_requested"
                            ? "What changes do you need?"
                            : "Reason for declining"}{" "}
                          <span className="text-red-400">*</span>
                        </Label>
                        {responses[assignment.id] === "change_requested" && (
                          <p className="text-xs text-white/50 mt-1">
                            Specify: change in date/time, topic title, venue, etc.
                          </p>
                        )}
                        <Textarea
                          value={notes[assignment.id] || ""}
                          onChange={(e) => setNoteForAssignment(assignment.id, e.target.value)}
                          placeholder={
                            responses[assignment.id] === "change_requested"
                              ? "E.g., Please change to 29th Aug afternoon due to travel conflict..."
                              : "Please provide reason..."
                          }
                          rows={2}
                          className="mt-2 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Summary */}
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="py-4">
                <h4 className="font-medium text-white mb-2">Response Summary</h4>
                <div className="flex gap-4 flex-wrap">
                  <span className="text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    {confirmedCount} confirmed
                  </span>
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {changeCount} change
                  </span>
                  <span className="text-red-400 flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    {declinedCount} declined
                  </span>
                  {pendingCount > 0 && (
                    <span className="text-white/50">{pendingCount} pending</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={pendingCount > 0 || submitting}
              className="w-full bg-primary hover:bg-primary/90"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : pendingCount > 0 ? (
                `Respond to ${pendingCount} remaining topic(s)`
              ) : (
                <>
                  Submit Responses
                  {confirmedCount > 0 && (
                    <span className="ml-2 flex items-center gap-1 text-xs opacity-80">
                      <ArrowRight className="h-3 w-3" /> Travel Details
                    </span>
                  )}
                </>
              )}
            </Button>
          </>
        )}

        {/* STEP 2: Travel Details */}
        {step === "travel" && (
          <>
            {/* Session Confirmation Summary */}
            <Card className="bg-white/10 backdrop-blur border-white/20 print:hidden">
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-white flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    Sessions Confirmed
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/60 hover:text-white hover:bg-white/10"
                    onClick={() => {
                      const allPreviouslyResponded = assignments.every(
                        (a) => a.status !== "pending" && a.status !== "invited"
                      )
                      if (!allPreviouslyResponded) {
                        setStep("confirm")
                      }
                    }}
                  >
                    View Details
                  </Button>
                </div>
                <div className="flex gap-3 flex-wrap">
                  {confirmedCount > 0 && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      {confirmedCount} Confirmed
                    </Badge>
                  )}
                  {declinedCount > 0 && (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      {declinedCount} Declined
                    </Badge>
                  )}
                  {changeCount > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                      {changeCount} Change Requested
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5 mt-3 max-h-48 overflow-y-auto">
                  {assignments.map((a, i) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="text-white/40 w-5">{i + 1}.</span>
                      <span className="flex-1 text-white/80 truncate">{a.session_name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          (responses[a.id] || a.status) === "confirmed" && "text-green-400 border-green-500/30",
                          (responses[a.id] || a.status) === "declined" && "text-red-400 border-red-500/30",
                          (responses[a.id] || a.status) === "change_requested" && "text-amber-400 border-amber-500/30"
                        )}
                      >
                        {(responses[a.id] || a.status) === "confirmed" && "Confirmed"}
                        {(responses[a.id] || a.status) === "declined" && "Declined"}
                        {(responses[a.id] || a.status) === "change_requested" && "Change"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Journey Itinerary (if booking exists) */}
            {registration?.custom_fields?.booking && (
              <JourneyItinerary
                attendeeName={faculty.name}
                eventName={event?.name || ""}
                customFields={registration.custom_fields}
              />
            )}

            {/* Travel Form */}
            {hasAnyConfirmed && registration && (
              <Card className="bg-white/10 backdrop-blur border-white/20 print:hidden">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Plane className="h-5 w-5" />
                    Travel & Accommodation
                  </CardTitle>
                  <CardDescription className="text-white/70">
                    Let us know your travel requirements so we can book your tickets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TravelForm
                    token={token}
                    apiEndpoint="/api/respond"
                    customFields={registration.custom_fields}
                    queryKey={["respond-portal", token]}
                  />
                </CardContent>
              </Card>
            )}

            {/* No registration yet - waiting message */}
            {hasAnyConfirmed && !registration && (
              <Card className="bg-white/10 backdrop-blur border-white/20">
                <CardContent className="py-8 text-center">
                  <Loader2 className="h-8 w-8 text-white/50 animate-spin mx-auto mb-3" />
                  <p className="text-white/70">Setting up your travel portal...</p>
                  <p className="text-sm text-white/50 mt-1">Please refresh the page in a moment.</p>
                </CardContent>
              </Card>
            )}

            {/* All declined - no travel needed */}
            {!hasAnyConfirmed && (
              <Card className="bg-white/10 backdrop-blur border-white/20">
                <CardContent className="py-8 text-center">
                  <XCircle className="h-12 w-12 text-white/30 mx-auto mb-3" />
                  <p className="text-white/70">No sessions confirmed</p>
                  <p className="text-sm text-white/50 mt-1">
                    Travel arrangements are not needed since no sessions were confirmed.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center text-white/50 text-sm py-4 print:hidden">
          <p>Need help? Contact the organizing team</p>
          <p className="mt-1">Powered by AMASI Event Management</p>
        </div>
      </div>
    </div>
  )
}

export default function RespondPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <RespondPageContent />
    </QueryClientProvider>
  )
}
