"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Calendar,
  MapPin,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  Plane,
  Clock,
  Building2,
  Mic,
  User,
  AlertCircle,
  CalendarPlus,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Download,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { cn } from "@/lib/utils"
import { COMPANY_CONFIG } from "@/lib/config"
import { InsertChat } from "@/components/insert-chat"
import { TravelForm } from "@/components/travel-form"
import { JourneyItinerary } from "@/components/journey-itinerary"

type Session = {
  id: string
  session_name: string
  session_date: string
  start_time: string
  end_time: string
  hall: string | null
  specialty_track: string | null
  description: string | null
}

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
  logo_url?: string | null
  start_date: string
  end_date: string
  venue_name: string | null
  city: string | null
}

type Registration = {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  attendee_institution: string | null
  attendee_designation: string | null
  status: string
  custom_fields: any
  event: Event
  ticket_type: { name: string }
}

type Faculty = {
  name: string
  email: string | null
  phone: string | null
}

type PortalResponse = {
  tokenType: "portal"
  registration: Registration
  sessions: Session[]
}

type InvitationResponse = {
  tokenType: "invitation"
  faculty: Faculty
  assignments: FacultyAssignment[]
  event: Event
  registration: Registration | null
}

type ApiResponse = PortalResponse | InvitationResponse

export default function SpeakerPortalPage() {
  const params = useParams()
  const token = params.token as string
  const queryClient = useQueryClient()

  // For invitation flow: session confirmation state
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [step, setStep] = useState<"confirm" | "travel">("confirm")
  const [submitting, setSubmitting] = useState(false)

  // Fetch data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["speaker-portal", token],
    queryFn: async () => {
      const response = await fetch(`/api/speaker/${token}`)
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to load invitation")
      }
      return result as ApiResponse
    },
  })

  const tokenType = data?.tokenType

  // Portal flow data
  const portalRegistration = tokenType === "portal" ? (data as PortalResponse).registration : null
  const portalSessions = tokenType === "portal" ? (data as PortalResponse).sessions : []

  // Invitation flow data
  const faculty = tokenType === "invitation" ? (data as InvitationResponse).faculty : null
  const assignments = tokenType === "invitation" ? (data as InvitationResponse).assignments : []
  const invitationEvent = tokenType === "invitation" ? (data as InvitationResponse).event : null
  const invitationRegistration = tokenType === "invitation" ? (data as InvitationResponse).registration : null

  // Unified event/registration for both flows
  const event = portalRegistration?.event || invitationEvent
  const registration = portalRegistration || invitationRegistration

  // Initialize responses for invitation flow
  useEffect(() => {
    if (tokenType !== "invitation" || !assignments.length) return

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

    if (allResponded && assignments.length > 0) {
      setStep("travel")
    }
  }, [tokenType, assignments])

  // --- Portal flow mutations ---
  const acceptInvitation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/speaker/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error)
      }
    },
    onSuccess: () => {
      toast.success("Thank you! Your participation is confirmed.")
      queryClient.invalidateQueries({ queryKey: ["speaker-portal", token] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const declineInvitation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/speaker/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error)
      }
    },
    onSuccess: () => {
      toast.success("We're sorry you can't make it. Thank you for letting us know.")
      queryClient.invalidateQueries({ queryKey: ["speaker-portal", token] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // --- Invitation flow helpers ---
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

  const handleSubmitResponses = async () => {
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
      const res = await fetch(`/api/speaker/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses, notes }),
      })

      const result = await res.json()
      if (!res.ok || result.error) {
        throw new Error(result.error || "Failed to submit")
      }

      toast.success("Your responses have been recorded!")

      const hasConfirmed = Object.values(responses).some((s) => s === "confirmed")
      if (hasConfirmed) {
        await refetch()
        setStep("travel")
      } else {
        await refetch()
        setStep("travel")
      }
    } catch (_err) {
      toast.error("Failed to submit responses. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // --- Formatters ---
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const formatTime = (time: string | null) => {
    if (!time) return ""
    const [hours, minutes] = time.split(":")
    const h = parseInt(hours)
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  const getGoogleCalendarUrl = (session: Session) => {
    const startDate = new Date(session.session_date)
    const [startHours, startMinutes] = (session.start_time || "09:00").split(":")
    startDate.setHours(parseInt(startHours), parseInt(startMinutes), 0)

    const endDate = new Date(session.session_date)
    const [endHours, endMinutes] = (session.end_time || "10:00").split(":")
    endDate.setHours(parseInt(endHours), parseInt(endMinutes), 0)

    const formatGCalDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
    }

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: session.session_name,
      dates: `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`,
      details: session.description || `Session at ${event?.name || "Event"}`,
      location: [session.hall, event?.venue_name].filter(Boolean).join(", "),
    })

    return `https://www.google.com/calendar/render?${params.toString()}`
  }

  const downloadCalendar = () => {
    if (!event) return
    const email = portalRegistration?.attendee_email || faculty?.email || ""
    const url = `/api/events/${event.id}/calendar?speaker=${encodeURIComponent(email)}`
    window.open(url, "_blank")
  }

  // --- Computed values for invitation flow ---
  const confirmedCount = Object.values(responses).filter((r) => r === "confirmed").length
  const declinedCount = Object.values(responses).filter((r) => r === "declined").length
  const changeCount = Object.values(responses).filter((r) => r === "change_requested").length
  const pendingCount = Object.values(responses).filter((r) => !r).length

  const hasAnyConfirmed = tokenType === "invitation"
    ? assignments.some((a) => a.status === "confirmed" || responses[a.id] === "confirmed")
    : false

  // --- Loading state ---
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

  // --- Error state ---
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/10 backdrop-blur border-white/20">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Invalid Link</h2>
            <p className="text-white/70">
              {error instanceof Error ? error.message : "This invitation link is invalid or has expired. Please contact the organizers for assistance."}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ========================================================================
  // PORTAL TOKEN FLOW (existing speaker registration)
  // ========================================================================
  if (tokenType === "portal" && portalRegistration) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 print:bg-white print:min-h-0">
        <Toaster position="top-center" richColors />
        <InsertChat
          userEmail={portalRegistration.attendee_email}
          userFirstName={portalRegistration.attendee_name?.split(" ")[0]}
          userLastName={portalRegistration.attendee_name?.split(" ").slice(1).join(" ")}
          metadata={{ event: event?.name || "", type: "speaker" }}
        />

        {/* Header */}
        <div className="bg-white/5 backdrop-blur border-b border-white/10 print:hidden">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">{event?.short_name || event?.name}</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-white/70 text-xs sm:text-sm">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {event?.start_date && formatDate(event.start_date)}
                  </span>
                  {event?.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {event.city}
                    </span>
                  )}
                </div>
              </div>
              <Badge
                className={cn(
                  "self-start sm:self-auto text-sm px-3 py-1",
                  portalRegistration.status === "confirmed"
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : portalRegistration.status === "declined"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                )}
              >
                {portalRegistration.status === "confirmed" ? "Confirmed" :
                 portalRegistration.status === "declined" ? "Declined" : "Pending Response"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 print:p-0 print:max-w-none">
          {/* Welcome */}
          <Card className="bg-white/10 backdrop-blur border-white/20 print:hidden">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5" />
                Welcome, {portalRegistration.attendee_name}
              </CardTitle>
              <CardDescription className="text-white/70">
                You have been invited as <strong className="text-white">{portalRegistration.attendee_designation || "Speaker"}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/70 text-xs sm:text-sm break-all sm:break-normal">
                <span className="flex items-center gap-1 max-w-full">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="break-all">{portalRegistration.attendee_email}</span>
                </span>
                {portalRegistration.attendee_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4 shrink-0" />
                    {portalRegistration.attendee_phone}
                  </span>
                )}
              </div>

              {/* Accept/Decline Buttons */}
              {portalRegistration.status === "pending" && (
                <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:gap-3">
                  <Button
                    onClick={() => acceptInvitation.mutate()}
                    disabled={acceptInvitation.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {acceptInvitation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Accept Invitation
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm("Are you sure you want to decline this invitation?")) {
                        declineInvitation.mutate()
                      }
                    }}
                    disabled={declineInvitation.isPending}
                    className="w-full sm:w-auto border-red-500/50 text-red-400 hover:bg-red-500/20"
                  >
                    {declineInvitation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Decline
                  </Button>
                </div>
              )}

              {portalRegistration.status === "confirmed" && (
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="h-5 w-5 shrink-0" />
                      <span className="font-medium">Your participation is confirmed!</span>
                    </div>
                    {event?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto border-green-400/50 text-green-300 hover:bg-green-500/20"
                        onClick={() => {
                          window.open(`/api/events/${event.id}/invitation-pdf?type=speaker&name=${encodeURIComponent(faculty?.name || "")}&email=${encodeURIComponent(faculty?.email || "")}`, "_blank")
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Invitation
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sessions */}
          <Card className="bg-white/10 backdrop-blur border-white/20 print:hidden">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Your Sessions ({portalSessions.length})
              </CardTitle>
              <CardDescription className="text-white/70 flex items-center justify-between">
                <span>Sessions you are assigned to present</span>
                {portalSessions.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs gap-1.5"
                    onClick={downloadCalendar}
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    Subscribe to Calendar
                  </Button>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {portalSessions.length === 0 ? (
                <p className="text-white/50 text-center py-4">No sessions assigned yet</p>
              ) : (
                <div className="space-y-3">
                  {portalSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 bg-white/5 rounded-lg border border-white/10"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-white">{session.session_name}</h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs sm:text-sm text-white/60">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              {new Date(session.session_date).toLocaleDateString("en-IN", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              {formatTime(session.start_time)} - {formatTime(session.end_time)}
                            </span>
                            {session.hall && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5 shrink-0" />
                                {session.hall}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {session.specialty_track && (
                            <Badge variant="outline" className="text-xs text-white/70 border-white/30">
                              {session.specialty_track}
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-white/60 hover:text-white hover:bg-white/10"
                            onClick={() => window.open(getGoogleCalendarUrl(session), "_blank")}
                          >
                            <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                            Add to Calendar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Journey Itinerary */}
          {portalRegistration.custom_fields?.booking && (
            <JourneyItinerary
              attendeeName={portalRegistration.attendee_name}
              eventName={event?.name || ""}
              customFields={portalRegistration.custom_fields}
              sessions={portalSessions}
            />
          )}

          {/* Travel & Accommodation - Only show if confirmed */}
          {portalRegistration.status === "confirmed" && (
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
                  apiEndpoint="/api/speaker"
                  customFields={portalRegistration.custom_fields}
                  queryKey={["speaker-portal", token]}
                />
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <div className="text-center text-white/50 text-sm py-4 print:hidden">
            <p>Need help? Contact the organizing team</p>
            <p className="mt-1">Powered by {COMPANY_CONFIG.name} Event Management</p>
          </div>
        </div>
      </div>
    )
  }

  // ========================================================================
  // INVITATION TOKEN FLOW (faculty assignment - two-step wizard)
  // ========================================================================
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
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              {invitationEvent?.logo_url && (
                <img src={invitationEvent.logo_url} alt="" className="h-10 sm:h-12 rounded shrink-0" />
              )}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-white break-words">
                  {event?.short_name || event?.name || "Conference"}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-white/70 text-xs sm:text-sm">
                  {event?.venue_name && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      {event.venue_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-4">
            <button
              onClick={() => {
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
              Welcome, {faculty?.name}
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
            {/* Quick Action — Confirm all (action-panel pattern) */}
            <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg">
              <div className="p-5 sm:flex sm:items-start sm:justify-between sm:gap-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Confirm all topics</h3>
                  <p className="mt-2 max-w-xl text-sm text-gray-400">
                    Save time by confirming all {assignments.length} assigned {assignments.length === 1 ? "topic" : "topics"} in one click. You can still change individual responses below.
                  </p>
                </div>
                <div className="mt-5 sm:mt-0 sm:shrink-0 sm:flex sm:items-center">
                  <Button
                    onClick={confirmAll}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirm All
                  </Button>
                </div>
              </div>
            </div>

            {/* Assignments List — action-panel styled per session */}
            <ul role="list" className="space-y-3">
              {assignments.map((assignment) => {
                const response = responses[assignment.id]
                const statusMeta =
                  response === "confirmed"
                    ? { dot: "bg-emerald-400", label: "Confirmed", text: "text-emerald-300", ring: "outline-emerald-500/40", iconBg: "bg-emerald-500/15", iconText: "text-emerald-300" }
                    : response === "declined"
                    ? { dot: "bg-red-400", label: "Declined", text: "text-red-300", ring: "outline-red-500/40", iconBg: "bg-red-500/15", iconText: "text-red-300" }
                    : response === "change_requested"
                    ? { dot: "bg-amber-400", label: "Change requested", text: "text-amber-300", ring: "outline-amber-500/40", iconBg: "bg-amber-500/15", iconText: "text-amber-300" }
                    : { dot: "", label: "", text: "", ring: "outline-white/10", iconBg: "bg-white/5", iconText: "text-white/50" }

                return (
                  <li
                    key={assignment.id}
                    className={cn(
                      "bg-gray-800/50 outline outline-1 -outline-offset-1 rounded-lg p-5 transition-colors",
                      statusMeta.ring
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "size-12 flex-none rounded-full flex items-center justify-center outline outline-1 -outline-offset-1 outline-white/5",
                          statusMeta.iconBg,
                          statusMeta.iconText
                        )}
                      >
                        <Mic className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white leading-6">
                              {assignment.session_name}
                            </p>
                            {assignment.topic_title && (
                              <p className="mt-0.5 text-sm text-gray-400 leading-6">
                                {assignment.topic_title}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className="capitalize shrink-0 text-white/70 border-white/20 bg-transparent"
                          >
                            {assignment.role}
                          </Badge>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(assignment.session_date)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(assignment.start_time)} – {formatTime(assignment.end_time)}
                          </span>
                          {assignment.hall && (
                            <span className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5" />
                              {assignment.hall}
                            </span>
                          )}
                        </div>

                        {statusMeta.label && (
                          <div className="mt-3 flex items-center gap-1.5">
                            <div className={cn("size-1.5 rounded-full", statusMeta.dot)} />
                            <span className={cn("text-xs font-medium", statusMeta.text)}>
                              {statusMeta.label}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Response buttons */}
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={response === "confirmed" ? "default" : "outline"}
                        className={cn(
                          "flex-1 sm:flex-none",
                          response === "confirmed"
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                            : "bg-transparent border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
                        )}
                        onClick={() => setIndividualResponse(assignment.id, "confirmed")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant={response === "change_requested" ? "default" : "outline"}
                        className={cn(
                          "flex-1 sm:flex-none",
                          response === "change_requested"
                            ? "bg-amber-600 hover:bg-amber-500 text-white"
                            : "bg-transparent border-amber-500/30 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
                        )}
                        onClick={() => setIndividualResponse(assignment.id, "change_requested")}
                        title="Request change in date/time/topic"
                      >
                        <AlertTriangle className="h-4 w-4 mr-1.5" />
                        Change
                      </Button>
                      <Button
                        size="sm"
                        variant={response === "declined" ? "default" : "outline"}
                        className={cn(
                          "flex-1 sm:flex-none",
                          response === "declined"
                            ? "bg-red-600 hover:bg-red-500 text-white"
                            : "bg-transparent border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                        )}
                        onClick={() => setIndividualResponse(assignment.id, "declined")}
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        Decline
                      </Button>
                    </div>

                    {/* Notes field — inline when declined or change requested */}
                    {(response === "declined" || response === "change_requested") && (
                      <div className="mt-5 pt-5 border-t border-white/10">
                        <Label className="text-sm font-medium text-white/80">
                          {response === "change_requested"
                            ? "What changes do you need?"
                            : "Reason for declining"}{" "}
                          <span className="text-red-400">*</span>
                        </Label>
                        {response === "change_requested" && (
                          <p className="mt-1 text-xs text-gray-500">
                            Specify: change in date/time, topic title, venue, etc.
                          </p>
                        )}
                        <Textarea
                          value={notes[assignment.id] || ""}
                          onChange={(e) => setNoteForAssignment(assignment.id, e.target.value)}
                          placeholder={
                            response === "change_requested"
                              ? "E.g., Please change to 29th Aug afternoon due to travel conflict..."
                              : "Please provide reason..."
                          }
                          rows={2}
                          className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            {/* Summary */}
            <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-5">
              <h4 className="text-sm font-semibold text-white">Response summary</h4>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <div className="size-1.5 rounded-full bg-emerald-400" />
                  {confirmedCount} confirmed
                </span>
                <span className="flex items-center gap-1.5 text-amber-300">
                  <div className="size-1.5 rounded-full bg-amber-400" />
                  {changeCount} change
                </span>
                <span className="flex items-center gap-1.5 text-red-300">
                  <div className="size-1.5 rounded-full bg-red-400" />
                  {declinedCount} declined
                </span>
                {pendingCount > 0 && (
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <div className="size-1.5 rounded-full bg-white/30" />
                    {pendingCount} pending
                  </span>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmitResponses}
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
            {/* Session Confirmation Summary — stacked-list pattern */}
            <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg overflow-hidden print:hidden">
              <div className="px-5 py-4 sm:flex sm:items-center sm:justify-between border-b border-white/10">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    Your session responses
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {confirmedCount > 0 && (
                      <span className="flex items-center gap-1.5 text-emerald-300">
                        <div className="size-1.5 rounded-full bg-emerald-400" />
                        {confirmedCount} confirmed
                      </span>
                    )}
                    {changeCount > 0 && (
                      <span className="flex items-center gap-1.5 text-amber-300">
                        <div className="size-1.5 rounded-full bg-amber-400" />
                        {changeCount} change
                      </span>
                    )}
                    {declinedCount > 0 && (
                      <span className="flex items-center gap-1.5 text-red-300">
                        <div className="size-1.5 rounded-full bg-red-400" />
                        {declinedCount} declined
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 sm:mt-0 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => {
                    const allPreviouslyResponded = assignments.every(
                      (a) => a.status !== "pending" && a.status !== "invited"
                    )
                    if (!allPreviouslyResponded) {
                      setStep("confirm")
                    }
                  }}
                >
                  View details
                </Button>
              </div>

              <ul role="list" className="divide-y divide-white/5 max-h-72 overflow-y-auto">
                {assignments.map((a) => {
                  const status = (responses[a.id] || a.status) as string
                  const statusMeta =
                    status === "confirmed"
                      ? { dot: "bg-emerald-400", label: "Confirmed", text: "text-emerald-300", iconBg: "bg-emerald-500/15", iconText: "text-emerald-300" }
                      : status === "declined"
                      ? { dot: "bg-red-400", label: "Declined", text: "text-red-300", iconBg: "bg-red-500/15", iconText: "text-red-300" }
                      : status === "change_requested"
                      ? { dot: "bg-amber-400", label: "Change", text: "text-amber-300", iconBg: "bg-amber-500/15", iconText: "text-amber-300" }
                      : { dot: "bg-white/30", label: "Pending", text: "text-gray-400", iconBg: "bg-white/5", iconText: "text-white/40" }

                  return (
                    <li key={a.id} className="flex items-center gap-x-4 px-5 py-3.5">
                      <div className={cn("size-9 flex-none rounded-full flex items-center justify-center outline outline-1 -outline-offset-1 outline-white/5", statusMeta.iconBg, statusMeta.iconText)}>
                        <Mic className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{a.session_name}</p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {formatDate(a.session_date)} · {formatTime(a.start_time)}
                        </p>
                      </div>
                      <div className="hidden sm:flex sm:items-center sm:gap-1.5 shrink-0">
                        <div className={cn("size-1.5 rounded-full", statusMeta.dot)} />
                        <span className={cn("text-xs font-medium", statusMeta.text)}>{statusMeta.label}</span>
                      </div>
                      <div className={cn("sm:hidden size-2 rounded-full shrink-0", statusMeta.dot)} />
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Download Invitation Letter — action-panel pattern */}
            {confirmedCount > 0 && event?.id && (
              <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-5">
                <div className="sm:flex sm:items-start sm:justify-between sm:gap-6">
                  <div className="flex items-start gap-3">
                    <div className="size-10 flex-none rounded-full bg-blue-500/15 outline outline-1 -outline-offset-1 outline-blue-500/30 flex items-center justify-center text-blue-300">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">Invitation letter</h3>
                      <p className="mt-1 max-w-xl text-sm text-gray-400">
                        Download a formal PDF for your institution or travel approval.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-0 sm:shrink-0 sm:flex sm:items-center">
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto bg-transparent border-white/15 text-white hover:bg-white/10"
                      onClick={() => {
                        window.open(`/api/events/${event.id}/invitation-pdf?type=speaker&name=${encodeURIComponent(faculty?.name || "")}&email=${encodeURIComponent(faculty?.email || "")}`, "_blank")
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Journey Itinerary (if booking exists) */}
            {registration?.custom_fields?.booking && (
              <JourneyItinerary
                attendeeName={faculty?.name || ""}
                eventName={event?.name || ""}
                customFields={registration.custom_fields}
              />
            )}

            {/* Travel Form */}
            {hasAnyConfirmed && registration && (
              <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg overflow-hidden print:hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Plane className="h-5 w-5" />
                    Travel &amp; accommodation
                  </h3>
                  <p className="mt-1 text-sm text-gray-400">
                    Let us know your travel requirements so we can book your tickets.
                  </p>
                </div>
                <div className="p-5">
                  <TravelForm
                    token={token}
                    apiEndpoint="/api/speaker"
                    customFields={registration.custom_fields}
                    queryKey={["speaker-portal", token]}
                  />
                </div>
              </div>
            )}

            {/* No registration yet - waiting message */}
            {hasAnyConfirmed && !registration && (
              <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-8 text-center">
                <Loader2 className="h-8 w-8 text-white/50 animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium text-white/80">Setting up your travel portal…</p>
                <p className="text-xs text-gray-400 mt-1">Please refresh the page in a moment.</p>
              </div>
            )}

            {/* All declined - no travel needed */}
            {!hasAnyConfirmed && (
              <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-8 text-center">
                <div className="size-12 mx-auto rounded-full bg-white/5 outline outline-1 -outline-offset-1 outline-white/10 flex items-center justify-center mb-3">
                  <XCircle className="h-6 w-6 text-white/40" />
                </div>
                <p className="text-sm font-medium text-white/80">No sessions confirmed</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  Travel arrangements are not needed since no sessions were confirmed.
                </p>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center text-white/50 text-sm py-4 print:hidden">
          <p>Need help? Contact the organizing team</p>
          <p className="mt-1">Powered by {COMPANY_CONFIG.name} Event Management</p>
        </div>
      </div>
    </div>
  )
}
