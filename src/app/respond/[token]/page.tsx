"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { InsertChat } from "@/components/insert-chat"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  Building2,
} from "lucide-react"
import { toast } from "sonner"

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

export default function RespondPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [faculty, setFaculty] = useState<Faculty | null>(null)
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([])
  const [event, setEvent] = useState<Event | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [responses, setResponses] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  // Load assignment details via API
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/respond/${token}`)
        const data = await res.json()

        if (!res.ok || data.error) {
          setError(data.error || "Invalid or expired invitation link")
          setLoading(false)
          return
        }

        setFaculty(data.faculty)
        setAssignments(data.assignments || [])
        setEvent(data.event)

        // Initialize responses based on current status
        const initialResponses: Record<string, string> = {}
        let allResponded = true
        data.assignments?.forEach((a: FacultyAssignment) => {
          if (a.status === 'pending' || a.status === 'invited') {
            initialResponses[a.id] = ''
            allResponded = false
          } else {
            initialResponses[a.id] = a.status
          }
        })
        setResponses(initialResponses)

        // If all have already been responded to, show submitted state
        if (allResponded && data.assignments?.length > 0) {
          setSubmitted(true)
        }

      } catch (_err) {
        setError("Failed to load invitation details")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [token])

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
    assignments.forEach(a => {
      newResponses[a.id] = 'confirmed'
    })
    setResponses(newResponses)
  }

  const setIndividualResponse = (id: string, status: string) => {
    setResponses(prev => ({ ...prev, [id]: status }))
  }

  const setNoteForAssignment = (id: string, note: string) => {
    setNotes(prev => ({ ...prev, [id]: note }))
  }

  const handleSubmit = async () => {
    // Check if all have a response
    const pendingCount = Object.values(responses).filter(r => !r).length
    if (pendingCount > 0) {
      toast.error(`Please respond to all ${pendingCount} pending topic(s)`)
      return
    }

    // Check if notes are required for each declined/change_requested topic
    const missingNotes: string[] = []
    Object.entries(responses).forEach(([id, status]) => {
      if ((status === 'declined' || status === 'change_requested') && !notes[id]?.trim()) {
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses, notes }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to submit")
      }

      setSubmitted(true)
      toast.success("Your responses have been recorded. Thank you!")

    } catch (_err) {
      toast.error("Failed to submit responses. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !faculty) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">{error || "This invitation link is invalid or has expired."}</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact the event organizers.
          </p>
        </div>
      </div>
    )
  }

  const confirmedCount = Object.values(responses).filter(r => r === 'confirmed').length
  const declinedCount = Object.values(responses).filter(r => r === 'declined').length
  const changeCount = Object.values(responses).filter(r => r === 'change_requested').length
  const pendingCount = Object.values(responses).filter(r => !r).length

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You, {faculty.name}!</h1>
          <p className="text-gray-600 mb-6">Your responses have been recorded.</p>

          <div className="bg-gray-50 rounded-lg p-4 text-left">
            <h3 className="font-semibold mb-3">Summary ({assignments.length} topics)</h3>
            <div className="flex gap-4 flex-wrap justify-center mb-4">
              {confirmedCount > 0 && (
                <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1">
                  {confirmedCount} Confirmed
                </Badge>
              )}
              {declinedCount > 0 && (
                <Badge className="bg-red-100 text-red-700 text-sm px-3 py-1">
                  {declinedCount} Declined
                </Badge>
              )}
              {changeCount > 0 && (
                <Badge className="bg-amber-100 text-amber-700 text-sm px-3 py-1">
                  {changeCount} Change Requested
                </Badge>
              )}
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {assignments.map((a, i) => (
                <div key={a.id} className="flex items-center gap-2 p-2 bg-white rounded border text-sm">
                  <span className="text-gray-500 w-6">{i + 1}.</span>
                  <span className="flex-1 truncate">{a.session_name}</span>
                  <Badge className={cn(
                    "text-xs",
                    responses[a.id] === 'confirmed' && "bg-green-100 text-green-700",
                    responses[a.id] === 'declined' && "bg-red-100 text-red-700",
                    responses[a.id] === 'change_requested' && "bg-amber-100 text-amber-700",
                  )}>
                    {responses[a.id] === 'confirmed' && 'Confirmed'}
                    {responses[a.id] === 'declined' && 'Declined'}
                    {responses[a.id] === 'change_requested' && 'Change'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {/* AI Chatbot for faculty assistance */}
      <InsertChat
        userEmail={faculty?.email || ""}
        userFirstName={faculty?.name?.split(" ")[0] || ""}
        userLastName={faculty?.name?.split(" ").slice(1).join(" ") || ""}
        metadata={{ event: event?.name || "", type: "faculty" }}
      />
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-primary/10 p-6 text-center">
            {event?.logo_url && (
              <img src={event.logo_url} alt="" className="h-16 mx-auto mb-4" />
            )}
            <h1 className="text-2xl font-bold text-gray-900">{event?.name || "Conference"}</h1>
            {event?.venue_name && (
              <p className="text-gray-600 mt-1">{event.venue_name}</p>
            )}
          </div>

          <div className="p-6">
            <h2 className="text-xl font-semibold text-center mb-2">
              Invitation Confirmation
            </h2>
            <p className="text-center text-gray-600 mb-6">
              Please confirm your participation for all assigned topics
            </p>

            {/* Faculty Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-3 rounded-full">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{faculty.name}</p>
                  <p className="text-gray-600 text-sm">
                    {assignments.length} assigned topic{assignments.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3 mb-6">
              <Button
                variant="outline"
                className="flex-1 border-green-300 text-green-700 hover:bg-green-50"
                onClick={confirmAll}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirm All Topics
              </Button>
            </div>

            {/* Assignments List */}
            <div className="space-y-4 mb-6">
              <h3 className="font-semibold text-gray-700">Your Assigned Topics</h3>

              {assignments.map((assignment, index) => (
                <div
                  key={assignment.id}
                  className={cn(
                    "border rounded-lg p-4 transition-colors",
                    responses[assignment.id] === 'confirmed' && "bg-green-50 border-green-200",
                    responses[assignment.id] === 'declined' && "bg-red-50 border-red-200",
                    responses[assignment.id] === 'change_requested' && "bg-amber-50 border-amber-200",
                  )}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="bg-gray-200 text-gray-700 text-sm font-medium px-2 py-1 rounded">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{assignment.session_name}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
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
                    <Badge variant="outline" className="capitalize shrink-0">
                      {assignment.role}
                    </Badge>
                  </div>

                  {/* Response buttons */}
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant={responses[assignment.id] === 'confirmed' ? 'default' : 'outline'}
                      className={cn(
                        "flex-1",
                        responses[assignment.id] === 'confirmed'
                          ? "bg-green-600 hover:bg-green-700"
                          : "border-green-300 text-green-700 hover:bg-green-50"
                      )}
                      onClick={() => setIndividualResponse(assignment.id, 'confirmed')}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant={responses[assignment.id] === 'change_requested' ? 'default' : 'outline'}
                      className={cn(
                        "flex-1",
                        responses[assignment.id] === 'change_requested'
                          ? "bg-amber-600 hover:bg-amber-700"
                          : "border-amber-300 text-amber-700 hover:bg-amber-50"
                      )}
                      onClick={() => setIndividualResponse(assignment.id, 'change_requested')}
                      title="Request change in date/time/topic"
                    >
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Request Change
                    </Button>
                    <Button
                      size="sm"
                      variant={responses[assignment.id] === 'declined' ? 'default' : 'outline'}
                      className={cn(
                        "flex-1",
                        responses[assignment.id] === 'declined'
                          ? "bg-red-600 hover:bg-red-700"
                          : "border-red-300 text-red-700 hover:bg-red-50"
                      )}
                      onClick={() => setIndividualResponse(assignment.id, 'declined')}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>

                  {/* Notes field for this topic */}
                  {(responses[assignment.id] === 'declined' || responses[assignment.id] === 'change_requested') && (
                    <div className="mt-3 pt-3 border-t">
                      <Label className="text-sm font-medium">
                        {responses[assignment.id] === 'change_requested'
                          ? "What changes do you need?"
                          : "Reason for declining"
                        } <span className="text-red-500">*</span>
                      </Label>
                      {responses[assignment.id] === 'change_requested' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Specify: change in date/time, topic title, venue, etc.
                        </p>
                      )}
                      <Textarea
                        value={notes[assignment.id] || ''}
                        onChange={e => setNoteForAssignment(assignment.id, e.target.value)}
                        placeholder={
                          responses[assignment.id] === 'change_requested'
                            ? "E.g., Please change to 29th Aug afternoon due to travel conflict..."
                            : "Please provide reason..."
                        }
                        rows={2}
                        className="mt-2"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium mb-2">Response Summary</h4>
              <div className="flex gap-4 flex-wrap">
                <span className="text-green-600">
                  <CheckCircle2 className="h-4 w-4 inline mr-1" />
                  {confirmedCount} confirmed
                </span>
                <span className="text-amber-600">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  {changeCount} change requested
                </span>
                <span className="text-red-600">
                  <XCircle className="h-4 w-4 inline mr-1" />
                  {declinedCount} declined
                </span>
                {pendingCount > 0 && (
                  <span className="text-gray-500">
                    {pendingCount} pending
                  </span>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={pendingCount > 0 || submitting}
              className="w-full"
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
                "Submit All Responses"
              )}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          Questions? Contact the organizing committee at the event email.
        </p>
      </div>
    </div>
  )
}
