"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Search,
  Loader2,
  RefreshCw,
  ArrowRight,
  Mail,
  CheckCircle2,
  XCircle,
  Clock3,
  AlertTriangle,
  X,
  User,
} from "lucide-react"
import { toast } from "sonner"

type Session = {
  id: string
  session_name: string
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall: string | null
  specialty_track: string | null
}

type FacultyAssignment = {
  id: string
  session_id: string
  faculty_name: string
  faculty_email: string | null
  faculty_phone: string | null
  role: string
  status: string
  session_name: string | null
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall: string | null
  topic_title: string | null
  invitation_sent_at: string | null
}

type ChangeLogEntry = {
  id: string
  change_type: string
  session_id: string | null
  session_name: string | null
  assignment_id: string | null
  old_values: { faculty_name?: string; faculty_email?: string } | null
  new_values: { faculty_name?: string; faculty_email?: string } | null
  summary: string | null
  changed_by_name: string | null
  notification_sent: boolean
  notification_type: string | null
  reason: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock3 },
  invited: { label: "Invited", variant: "default", icon: Mail },
  confirmed: { label: "Confirmed", variant: "default", icon: CheckCircle2 },
  declined: { label: "Declined", variant: "destructive", icon: XCircle },
  change_requested: { label: "Change Req.", variant: "outline", icon: AlertTriangle },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
}

const ROLE_COLORS: Record<string, string> = {
  speaker: "bg-blue-100 text-blue-800",
  chairperson: "bg-purple-100 text-purple-800",
  moderator: "bg-green-100 text-green-800",
  panelist: "bg-orange-100 text-orange-800",
}

export default function ProgramChangesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Search & selection state
  const [sessionSearch, setSessionSearch] = useState("")
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // Swap form state
  const [replacingAssignmentId, setReplacingAssignmentId] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [swapReason, setSwapReason] = useState("")
  const [sendInvitation, setSendInvitation] = useState(true)
  const [speakerSearch, setSpeakerSearch] = useState("")
  const [showSpeakerSuggestions, setShowSpeakerSuggestions] = useState(false)

  // Fetch sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["sessions-changes", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sessions")
        .select("id, session_name, session_date, start_time, end_time, hall, specialty_track")
        .eq("event_id", eventId)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
      return (data || []) as Session[]
    },
  })

  // Fetch assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["assignments-changes", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/program/faculty`)
      if (!res.ok) return []
      return (await res.json()) as FacultyAssignment[]
    },
  })

  // Fetch change log
  const { data: changeLog, isLoading: changeLogLoading } = useQuery({
    queryKey: ["program-change-log", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/program/change-log`)
      if (!res.ok) return []
      return (await res.json()) as ChangeLogEntry[]
    },
  })

  // Swap mutation
  const swapMutation = useMutation({
    mutationFn: async (data: {
      assignment_id: string
      new_faculty_name: string
      new_faculty_email?: string
      new_faculty_phone?: string
      send_invitation: boolean
      reason?: string
    }) => {
      const res = await fetch(`/api/events/${eventId}/program/swap-speaker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to swap speaker")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.summary || "Speaker swapped successfully")
      if (data.registration_created) {
        toast.success("Registration created for new speaker (offline, complimentary)")
      }
      if (data.invitation_status === "sent") {
        toast.success("Invitation email sent to new speaker")
      } else if (data.invitation_status === "failed") {
        toast.error("Speaker swapped but invitation email failed to send")
      }
      // Reset form
      setReplacingAssignmentId(null)
      setNewName("")
      setNewEmail("")
      setNewPhone("")
      setSwapReason("")
      setSendInvitation(true)
      setSpeakerSearch("")
      setShowSpeakerSuggestions(false)
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["assignments-changes", eventId] })
      queryClient.invalidateQueries({ queryKey: ["program-change-log", eventId] })
      queryClient.invalidateQueries({ queryKey: ["confirmations", eventId] })
      queryClient.invalidateQueries({ queryKey: ["sessions-list", eventId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Build a map of session_id -> faculty names for searching by speaker
  const sessionSpeakerMap = useMemo(() => {
    const map = new Map<string, string[]>()
    if (!assignments) return map
    for (const a of assignments) {
      if (!a.session_id) continue
      const names = map.get(a.session_id) || []
      names.push(a.faculty_name.toLowerCase())
      map.set(a.session_id, names)
    }
    return map
  }, [assignments])

  // Filtered sessions based on search (session name, hall, track, OR speaker name)
  const filteredSessions = useMemo(() => {
    if (!sessions || !sessionSearch.trim()) return []
    const q = sessionSearch.toLowerCase()
    return sessions.filter(
      (s) =>
        s.session_name?.toLowerCase().includes(q) ||
        s.hall?.toLowerCase().includes(q) ||
        s.specialty_track?.toLowerCase().includes(q) ||
        sessionSpeakerMap.get(s.id)?.some((name) => name.includes(q))
    )
  }, [sessions, sessionSearch, sessionSpeakerMap])

  // Unique speakers list for the "pick existing speaker" dropdown
  const uniqueSpeakers = useMemo(() => {
    if (!assignments) return []
    const seen = new Map<string, { name: string; email: string | null; phone: string | null }>()
    for (const a of assignments) {
      const key = a.faculty_email?.toLowerCase() || a.faculty_name.toLowerCase()
      if (!seen.has(key)) {
        seen.set(key, { name: a.faculty_name, email: a.faculty_email, phone: a.faculty_phone })
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [assignments])

  // Filtered speaker suggestions
  const filteredSpeakers = useMemo(() => {
    if (!speakerSearch.trim()) return []
    const q = speakerSearch.toLowerCase()
    return uniqueSpeakers.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    ).slice(0, 8)
  }, [uniqueSpeakers, speakerSearch])

  // Assignments for selected session
  const sessionAssignments = useMemo(() => {
    if (!selectedSessionId || !assignments) return []
    return assignments.filter((a) => a.session_id === selectedSessionId)
  }, [selectedSessionId, assignments])

  const selectedSession = useMemo(() => {
    return sessions?.find((s) => s.id === selectedSessionId)
  }, [sessions, selectedSessionId])

  const handleSelectSession = (session: Session) => {
    setSelectedSessionId(session.id)
    setSessionSearch("")
    setReplacingAssignmentId(null)
  }

  const handleStartReplace = (assignmentId: string) => {
    setReplacingAssignmentId(assignmentId)
    setNewName("")
    setNewEmail("")
    setNewPhone("")
    setSwapReason("")
    setSendInvitation(true)
    setSpeakerSearch("")
    setShowSpeakerSuggestions(false)
  }

  const handleSwap = () => {
    if (!replacingAssignmentId || !newName.trim()) return
    swapMutation.mutate({
      assignment_id: replacingAssignmentId,
      new_faculty_name: newName.trim(),
      new_faculty_email: newEmail.trim() || undefined,
      new_faculty_phone: newPhone.trim() || undefined,
      send_invitation: sendInvitation,
      reason: swapReason.trim() || undefined,
    })
  }

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  }

  const isLoading = sessionsLoading || assignmentsLoading

  return (
    <div className="p-6 max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Program Changes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Quick speaker swap and change tracking
        </p>
      </div>

      {/* Quick Speaker Swap Section */}
      <div className="border rounded-lg p-5 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Quick Speaker Swap
        </h2>

        {/* Session search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by session name, speaker name, hall, or track..."
            value={sessionSearch}
            onChange={(e) => {
              setSessionSearch(e.target.value)
              if (!e.target.value.trim()) setSelectedSessionId(null)
            }}
            className="pl-9"
          />
        </div>

        {/* Session search results dropdown */}
        {sessionSearch.trim() && filteredSessions.length > 0 && !selectedSessionId && (
          <div className="border rounded-md max-h-60 overflow-y-auto divide-y">
            {filteredSessions.slice(0, 15).map((session) => (
              <button
                key={session.id}
                onClick={() => handleSelectSession(session)}
                className="w-full px-4 py-2.5 text-left hover:bg-muted transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-sm">{session.session_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[session.hall, session.session_date, session.start_time?.slice(0, 5)].filter(Boolean).join(" · ")}
                    {(() => {
                      const q = sessionSearch.toLowerCase()
                      const matchedSpeaker = sessionSpeakerMap.get(session.id)?.find((name) => name.includes(q))
                      if (matchedSpeaker && !session.session_name?.toLowerCase().includes(q)) {
                        const original = assignments?.find((a) => a.session_id === session.id && a.faculty_name.toLowerCase().includes(q))
                        return original ? ` · Speaker: ${original.faculty_name}` : ""
                      }
                      return ""
                    })()}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {sessionSearch.trim() && filteredSessions.length === 0 && !selectedSessionId && !isLoading && (
          <p className="text-sm text-muted-foreground py-2">No sessions found matching &quot;{sessionSearch}&quot;</p>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Selected session */}
        {selectedSession && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-muted/50 rounded-md px-4 py-2.5">
              <div>
                <p className="font-medium">{selectedSession.session_name}</p>
                <p className="text-xs text-muted-foreground">
                  {[selectedSession.hall, selectedSession.session_date, selectedSession.start_time?.slice(0, 5)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedSessionId(null)
                  setReplacingAssignmentId(null)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Assigned speakers */}
            {sessionAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No speakers assigned to this session.</p>
            ) : (
              <div className="space-y-2">
                {sessionAssignments.map((assignment) => {
                  const statusConfig = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.pending
                  const StatusIcon = statusConfig.icon
                  const isReplacing = replacingAssignmentId === assignment.id

                  return (
                    <div key={assignment.id} className="border rounded-md">
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{assignment.faculty_name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {assignment.faculty_email && <span>{assignment.faculty_email}</span>}
                              {assignment.faculty_phone && <span>· {assignment.faculty_phone}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[assignment.role] || "bg-gray-100 text-gray-800"}`}>
                            {assignment.role}
                          </span>
                          <Badge variant={statusConfig.variant} className="gap-1 text-xs">
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                          {!isReplacing && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStartReplace(assignment.id)}
                              className="ml-2"
                            >
                              <RefreshCw className="h-3.5 w-3.5 mr-1" />
                              Replace
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Inline replace form */}
                      {isReplacing && (
                        <div className="border-t px-4 py-3 bg-muted/30 space-y-3">
                          <p className="text-sm font-medium">Replace with:</p>

                          {/* Pick existing speaker */}
                          <div className="relative">
                            <Label className="text-xs">Search existing speakers or type new name</Label>
                            <div className="relative mt-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Type speaker name to search..."
                                value={speakerSearch || newName}
                                onChange={(e) => {
                                  setSpeakerSearch(e.target.value)
                                  setNewName(e.target.value)
                                  setShowSpeakerSuggestions(true)
                                }}
                                onFocus={() => setShowSpeakerSuggestions(true)}
                                className="pl-9"
                              />
                            </div>
                            {showSpeakerSuggestions && filteredSpeakers.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 border rounded-md bg-background shadow-md max-h-48 overflow-y-auto divide-y">
                                {filteredSpeakers.map((speaker, i) => (
                                  <button
                                    key={i}
                                    onClick={() => {
                                      setNewName(speaker.name)
                                      setNewEmail(speaker.email || "")
                                      setNewPhone(speaker.phone || "")
                                      setSpeakerSearch("")
                                      setShowSpeakerSuggestions(false)
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                                  >
                                    <p className="text-sm font-medium">{speaker.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {[speaker.email, speaker.phone].filter(Boolean).join(" · ") || "No contact info"}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <Label htmlFor="new-name" className="text-xs">Name *</Label>
                              <Input
                                id="new-name"
                                placeholder="Dr. New Speaker"
                                value={newName}
                                onChange={(e) => {
                                  setNewName(e.target.value)
                                  setSpeakerSearch(e.target.value)
                                  setShowSpeakerSuggestions(true)
                                }}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="new-email" className="text-xs">Email</Label>
                              <Input
                                id="new-email"
                                type="email"
                                placeholder="email@example.com"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="new-phone" className="text-xs">Phone</Label>
                              <Input
                                id="new-phone"
                                placeholder="+91 9876543210"
                                value={newPhone}
                                onChange={(e) => setNewPhone(e.target.value)}
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="reason" className="text-xs">Reason (optional)</Label>
                            <Input
                              id="reason"
                              placeholder="e.g., Speaker unavailable due to travel conflict"
                              value={swapReason}
                              onChange={(e) => setSwapReason(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="send-invitation"
                              checked={sendInvitation}
                              onCheckedChange={(checked) => setSendInvitation(checked === true)}
                            />
                            <Label htmlFor="send-invitation" className="text-sm font-normal cursor-pointer">
                              Send invitation email to new speaker
                            </Label>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              onClick={handleSwap}
                              disabled={!newName.trim() || swapMutation.isPending}
                              size="sm"
                            >
                              {swapMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-1" />
                              )}
                              Swap Speaker
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReplacingAssignmentId(null)}
                              disabled={swapMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Changes Log Section */}
      <div className="border rounded-lg p-5 space-y-4">
        <h2 className="text-lg font-semibold">Recent Changes</h2>

        {changeLogLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !changeLog || changeLog.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No changes recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Time</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead className="w-[80px]">Notified</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changeLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(entry.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {entry.change_type === "speaker_swap" ? "Swap" : entry.change_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.old_values?.faculty_name && entry.new_values?.faculty_name ? (
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span className="line-through text-muted-foreground">{entry.old_values.faculty_name}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{entry.new_values.faculty_name}</span>
                        </span>
                      ) : (
                        <span>{entry.summary}</span>
                      )}
                      {entry.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5">Reason: {entry.reason}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.session_name || "—"}
                    </TableCell>
                    <TableCell>
                      {entry.notification_sent ? (
                        <Badge variant="default" className="text-xs gap-1">
                          <Mail className="h-3 w-3" />
                          Sent
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.changed_by_name || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
