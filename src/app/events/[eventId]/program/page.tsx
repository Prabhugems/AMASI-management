"use client"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  Calendar,
  Presentation,
  Users,
  Loader2,
  Plus,
  CheckCircle2,
  XCircle,
  Clock3,
  Send,
  Mail,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  UserCheck,
  AlertTriangle,
  Eye,
} from "lucide-react"
import { toast } from "sonner"
import { HelpTooltip } from "@/components/ui/help-tooltip"

type Session = {
  id: string
  session_name: string
  session_type: string
  session_date: string
  start_time: string
  end_time: string
  hall: string | null
  specialty_track: string | null
  speakers_text: string | null
  chairpersons_text: string | null
  moderators_text: string | null
}

type FacultyAssignment = {
  id: string
  session_id: string
  faculty_name: string
  faculty_email: string
  role: string
  status: string
  invitation_sent_at: string | null
  responded_at: string | null
  session_name: string
  session_date: string
  hall: string
}

type Track = {
  id: string
  name: string
  description: string | null
}

const STATUS_CONFIG = {
  pending: { label: "Not Invited", color: "bg-gray-100 text-gray-700", icon: Clock3 },
  invited: { label: "Invited", color: "bg-blue-100 text-blue-700", icon: Mail },
  confirmed: { label: "Confirmed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  declined: { label: "Declined", color: "bg-red-100 text-red-700", icon: XCircle },
  change_requested: { label: "Change Requested", color: "bg-amber-100 text-amber-700", icon: AlertTriangle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500", icon: XCircle },
}

export default function ProgramDashboardPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [selectedDay, setSelectedDay] = useState<string>("all")
  const [selectedHall, setSelectedHall] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)

  // Fetch sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["dashboard-sessions", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("event_id", eventId)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
      return (data || []) as Session[]
    },
  })

  // Fetch faculty assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["dashboard-assignments", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("faculty_assignments")
        .select("*")
        .eq("event_id", eventId)
        .order("session_date", { ascending: true })
      return (data || []) as FacultyAssignment[]
    },
  })

  // Fetch registration statuses (to cross-reference with faculty_assignments)
  // This fixes the count discrepancy: speakers confirm via portal → registrations.status = 'confirmed'
  // but faculty_assignments.status may stay 'pending' if faculty_email is NULL
  const { data: respondedRegistrations } = useQuery({
    queryKey: ["dashboard-registrations", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("registrations")
        .select("id, attendee_email, attendee_name, status")
        .eq("event_id", eventId)
        .in("status", ["confirmed", "declined", "cancelled"])
      return (data || []) as Array<{ id: string; attendee_email: string; attendee_name: string; status: string }>
    },
  })

  // Fetch tracks
  const { data: _tracks } = useQuery({
    queryKey: ["dashboard-tracks", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tracks")
        .select("*")
        .eq("event_id", eventId)
      return (data || []) as Track[]
    },
  })

  // Build lookup maps from registration statuses (by email and name)
  const registrationStatusMap = useMemo(() => {
    const emailMap = new Map<string, string>()
    const nameMap = new Map<string, string>()
    for (const reg of respondedRegistrations || []) {
      if (reg.attendee_email) {
        emailMap.set(reg.attendee_email.toLowerCase(), reg.status)
      }
      if (reg.attendee_name) {
        const stripped = reg.attendee_name.replace(/^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?|shri\.?)\s+/i, "").trim().toLowerCase()
        if (stripped) nameMap.set(stripped, reg.status)
      }
    }
    return { emailMap, nameMap }
  }, [respondedRegistrations])

  // Get effective status: use assignment status if it has a response,
  // otherwise check if matching registration has responded
  const getEffectiveStatus = useCallback((assignment: FacultyAssignment) => {
    if (['confirmed', 'declined', 'cancelled', 'change_requested'].includes(assignment.status)) {
      return assignment.status
    }
    // Try email match
    if (assignment.faculty_email) {
      const regStatus = registrationStatusMap.emailMap.get(assignment.faculty_email.toLowerCase())
      if (regStatus) return regStatus
    }
    // Try name match
    if (assignment.faculty_name) {
      const stripped = assignment.faculty_name.replace(/^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?|shri\.?)\s+/i, "").trim().toLowerCase()
      if (stripped) {
        const regStatus = registrationStatusMap.nameMap.get(stripped)
        if (regStatus) return regStatus
      }
    }
    return assignment.status
  }, [registrationStatusMap])

  // Get unique dates and halls
  const dates = useMemo(() => {
    if (!sessions) return []
    return [...new Set(sessions.map(s => s.session_date))].filter(Boolean).sort()
  }, [sessions])

  const halls = useMemo(() => {
    if (!sessions) return []
    return [...new Set(sessions.map(s => s.hall).filter(Boolean))] as string[]
  }, [sessions])

  // Calculate stats using effective status (cross-references registration data)
  const stats = useMemo(() => {
    if (!assignments) return null

    const total = assignments.length
    const confirmed = assignments.filter(a => getEffectiveStatus(a) === 'confirmed').length
    const invited = assignments.filter(a => getEffectiveStatus(a) === 'invited').length
    const pending = assignments.filter(a => getEffectiveStatus(a) === 'pending').length
    const declined = assignments.filter(a => getEffectiveStatus(a) === 'declined').length
    const changeRequested = assignments.filter(a => getEffectiveStatus(a) === 'change_requested').length

    const speakers = assignments.filter(a => a.role === 'speaker').length
    const chairpersons = assignments.filter(a => a.role === 'chairperson').length
    const moderators = assignments.filter(a => a.role === 'moderator').length

    const confirmationRate = total > 0 ? Math.round((confirmed / total) * 100) : 0
    const responseRate = total > 0 ? Math.round(((confirmed + declined + changeRequested) / total) * 100) : 0

    return {
      total,
      confirmed,
      invited,
      pending,
      declined,
      changeRequested,
      speakers,
      chairpersons,
      moderators,
      confirmationRate,
      responseRate,
    }
  }, [assignments, getEffectiveStatus])

  // Group assignments by session (using effective status for accurate counts)
  const sessionGroups = useMemo(() => {
    if (!sessions || !assignments) return []

    return sessions
      .filter(session => {
        if (selectedDay !== "all" && session.session_date !== selectedDay) return false
        if (selectedHall !== "all" && session.hall !== selectedHall) return false
        return true
      })
      .map(session => {
        const sessionAssignments = assignments.filter(a => a.session_id === session.id)

        // Filter by effective status if needed
        const filteredAssignments = selectedStatus === "all"
          ? sessionAssignments
          : sessionAssignments.filter(a => getEffectiveStatus(a) === selectedStatus)

        const confirmedCount = sessionAssignments.filter(a => getEffectiveStatus(a) === 'confirmed').length
        const totalCount = sessionAssignments.length
        const needsAttention = sessionAssignments.some(a => {
          const s = getEffectiveStatus(a)
          return s === 'declined' || s === 'change_requested'
        })
        const allConfirmed = totalCount > 0 && confirmedCount === totalCount
        const notStarted = totalCount > 0 && sessionAssignments.every(a => getEffectiveStatus(a) === 'pending')

        return {
          session,
          assignments: filteredAssignments,
          allAssignments: sessionAssignments,
          confirmedCount,
          totalCount,
          needsAttention,
          allConfirmed,
          notStarted,
        }
      })
      .filter(group => selectedStatus === "all" || group.assignments.length > 0)
  }, [sessions, assignments, selectedDay, selectedHall, selectedStatus, getEffectiveStatus])

  // Sync faculty assignments from session data
  const syncAssignments = async () => {
    if (!sessions) return
    setSyncing(true)
    try {
      const response = await fetch(`/api/events/${eventId}/program/sync-assignments`, {
        method: 'POST',
      })
      if (response.ok) {
        const result = await response.json()
        toast.success(`Synced ${result.created} assignments`)
        queryClient.invalidateQueries({ queryKey: ["dashboard-assignments", eventId] })
      } else {
        toast.error("Failed to sync assignments")
      }
    } catch (_error) {
      toast.error("Error syncing assignments")
    } finally {
      setSyncing(false)
    }
  }

  // Auto-sync: if sessions have speakers but no faculty_assignments, trigger sync once
  const autoSyncDone = useRef(false)
  useEffect(() => {
    if (autoSyncDone.current || syncing) return
    if (!sessions || sessions.length === 0) return
    if (assignmentsLoading) return

    const hasSpeakerData = sessions.some((s: any) =>
      s.speakers_text || s.speakers || s.chairpersons_text || s.chairpersons || s.moderators_text || s.moderators
    )
    const hasAssignments = (assignments || []).length > 0

    if (hasSpeakerData && !hasAssignments) {
      autoSyncDone.current = true
      syncAssignments()
    }
  }, [sessions, assignments, assignmentsLoading, syncing])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    })
  }

  const formatTime = (time: string | null) => {
    if (!time) return ""
    return time.substring(0, 5)
  }

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedSessions(new Set(sessionGroups.map(g => g.session.id)))
  }

  const collapseAll = () => {
    setExpandedSessions(new Set())
  }

  if (sessionsLoading || assignmentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const basePath = `/events/${eventId}/program`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Program Dashboard</h1>
          <p className="text-muted-foreground">Track confirmations and manage your program</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncAssignments} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync from Sessions
          </Button>
          <Link href={`${basePath}/confirmations/send`}>
            <Button>
              <Send className="h-4 w-4 mr-2" />
              Send Invitations
            </Button>
          </Link>
        </div>
      </div>

      {/* Confirmation Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total Faculty</span>
            <HelpTooltip content="All speakers, chairpersons, moderators and panelists assigned to sessions. Synced from your program schedule." />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2">{stats?.total || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats?.speakers || 0} speakers, {stats?.chairpersons || 0} chairs
          </p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">Confirmed</span>
            <HelpTooltip content="Faculty who have accepted their invitation. They will receive reminder emails before the event." />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-green-600">{stats?.confirmed || 0}</p>
          <Progress value={stats?.confirmationRate || 0} className="h-1 mt-2" />
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-600">
            <Mail className="h-4 w-4" />
            <span className="text-sm">Invited</span>
            <HelpTooltip content="Faculty who have received invitations but haven't responded yet. Send reminder emails to follow up." />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-blue-600">{stats?.invited || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting response</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Clock3 className="h-4 w-4" />
            <span className="text-sm">Not Invited</span>
            <HelpTooltip content="Faculty who haven't been sent invitations yet. Go to 'Send Invitations' to invite them." />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-gray-500">{stats?.pending || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Need invitation</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Needs Attention</span>
            <HelpTooltip content="Faculty who declined or requested changes to their session. Review and reassign if needed." />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-amber-600">
            {(stats?.declined || 0) + (stats?.changeRequested || 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats?.declined || 0} declined, {stats?.changeRequested || 0} changes
          </p>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Confirmation Progress</h3>
          <span className="text-sm text-muted-foreground">{stats?.confirmationRate || 0}% confirmed</span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${((stats?.confirmed || 0) / (stats?.total || 1)) * 100}%` }}
          />
          <div
            className="bg-blue-500 transition-all"
            style={{ width: `${((stats?.invited || 0) / (stats?.total || 1)) * 100}%` }}
          />
          <div
            className="bg-amber-500 transition-all"
            style={{ width: `${((stats?.changeRequested || 0) / (stats?.total || 1)) * 100}%` }}
          />
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${((stats?.declined || 0) / (stats?.total || 1)) * 100}%` }}
          />
        </div>
        <div className="flex gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span>Confirmed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span>Invited</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-500 rounded" />
            <span>Change Requested</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded" />
            <span>Declined</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-300 rounded" />
            <span>Pending</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-muted/30 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filter:</span>
          <Select value={selectedDay} onValueChange={setSelectedDay}>
            <SelectTrigger className="w-[150px] bg-background">
              <SelectValue placeholder="All Days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Days</SelectItem>
              {dates.map((date, i) => (
                <SelectItem key={date} value={date}>
                  Day {i + 1} - {formatDate(date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedHall} onValueChange={setSelectedHall}>
            <SelectTrigger className="w-[150px] bg-background">
              <SelectValue placeholder="All Halls" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Halls</SelectItem>
              {halls.map(hall => (
                <SelectItem key={hall} value={hall}>{hall}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* Session List with Assignments */}
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Sessions ({sessionGroups.length})</h3>

        {sessionGroups.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
            <Presentation className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No sessions found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Import program data or adjust filters
            </p>
            <div className="flex justify-center gap-2 mt-4">
              <Link href={`${basePath}/import`}>
                <Button size="sm">Import Program</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            {sessionGroups.map(({ session, assignments: filteredAssignments, allAssignments, confirmedCount, totalCount, needsAttention, allConfirmed, notStarted }) => {
              const isExpanded = expandedSessions.has(session.id)

              return (
                <div key={session.id} className="border-b last:border-b-0">
                  {/* Session Header */}
                  <button
                    onClick={() => toggleSession(session.id)}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors text-left",
                      allConfirmed && "bg-green-50",
                      needsAttention && "bg-amber-50",
                      notStarted && "bg-gray-50"
                    )}
                  >
                    {/* Expand Icon */}
                    <div className="w-5 flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Status Indicator */}
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{
                      backgroundColor: allConfirmed ? '#22c55e' :
                        needsAttention ? '#f59e0b' :
                        notStarted ? '#9ca3af' : '#3b82f6'
                    }} />

                    {/* Time & Hall */}
                    <div className="w-24 flex-shrink-0 text-sm text-muted-foreground">
                      <div>{formatTime(session.start_time)}</div>
                      <div className="text-xs">{session.hall}</div>
                    </div>

                    {/* Session Name */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{session.session_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {session.specialty_track || session.session_type}
                      </div>
                    </div>

                    {/* Confirmation Status */}
                    <div className="w-32 flex-shrink-0 text-right">
                      {totalCount > 0 ? (
                        <>
                          <div className="font-medium">
                            {confirmedCount}/{totalCount} confirmed
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full mt-1">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${(confirmedCount / totalCount) * 100}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">No faculty</span>
                      )}
                    </div>

                    {/* Quick Status Badges */}
                    <div className="w-24 flex-shrink-0 flex justify-end gap-1">
                      {allAssignments.filter(a => getEffectiveStatus(a) === 'pending').length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {allAssignments.filter(a => getEffectiveStatus(a) === 'pending').length} pending
                        </Badge>
                      )}
                      {allAssignments.filter(a => getEffectiveStatus(a) === 'declined').length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {allAssignments.filter(a => getEffectiveStatus(a) === 'declined').length} declined
                        </Badge>
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="bg-muted/20 border-t">
                      {filteredAssignments.length === 0 ? (
                        <div className="px-4 py-6 text-center text-muted-foreground">
                          <p>No faculty assignments for this session</p>
                          <Button variant="outline" size="sm" className="mt-2">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Faculty
                          </Button>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {/* Header */}
                          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                            <div className="col-span-1"></div>
                            <div className="col-span-3">Name</div>
                            <div className="col-span-2">Role</div>
                            <div className="col-span-2">Email</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Actions</div>
                          </div>

                          {filteredAssignments.map(assignment => {
                            const effectiveStatus = getEffectiveStatus(assignment)
                            const statusConfig = STATUS_CONFIG[effectiveStatus as keyof typeof STATUS_CONFIG]
                            const StatusIcon = statusConfig?.icon || Clock3

                            return (
                              <div key={assignment.id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-muted/30">
                                <div className="col-span-1">
                                  <StatusIcon className={cn(
                                    "h-4 w-4",
                                    effectiveStatus === 'confirmed' && "text-green-600",
                                    effectiveStatus === 'invited' && "text-blue-600",
                                    effectiveStatus === 'declined' && "text-red-600",
                                    effectiveStatus === 'change_requested' && "text-amber-600",
                                    effectiveStatus === 'pending' && "text-gray-400"
                                  )} />
                                </div>
                                <div className="col-span-3 font-medium">{assignment.faculty_name}</div>
                                <div className="col-span-2">
                                  <Badge variant="outline" className="capitalize text-xs">
                                    {assignment.role}
                                  </Badge>
                                </div>
                                <div className="col-span-2 text-sm text-muted-foreground truncate">
                                  {assignment.faculty_email || "-"}
                                </div>
                                <div className="col-span-2">
                                  <Badge className={cn("text-xs", statusConfig?.color)}>
                                    {statusConfig?.label || effectiveStatus}
                                  </Badge>
                                </div>
                                <div className="col-span-2 flex gap-1">
                                  {effectiveStatus === 'pending' && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs">
                                      <Mail className="h-3 w-3 mr-1" />
                                      Invite
                                    </Button>
                                  )}
                                  {effectiveStatus === 'invited' && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs">
                                      <RefreshCw className="h-3 w-3 mr-1" />
                                      Remind
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href={`${basePath}/confirmations`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <UserCheck className="h-6 w-6 mx-auto text-green-600 mb-2" />
          <p className="font-medium">Confirmations</p>
          <p className="text-xs text-muted-foreground">Track all responses</p>
        </Link>

        <Link
          href={`${basePath}/delegate`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Eye className="h-6 w-6 mx-auto text-purple-600 mb-2" />
          <p className="font-medium">Delegate View</p>
          <p className="text-xs text-muted-foreground">Display view</p>
        </Link>

        <Link
          href={`${basePath}/schedule`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Calendar className="h-6 w-6 mx-auto text-blue-600 mb-2" />
          <p className="font-medium">Schedule</p>
          <p className="text-xs text-muted-foreground">Timeline view</p>
        </Link>

        <Link
          href={`${basePath}/import`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Plus className="h-6 w-6 mx-auto text-amber-600 mb-2" />
          <p className="font-medium">Import</p>
          <p className="text-xs text-muted-foreground">Import program data</p>
        </Link>
      </div>
    </div>
  )
}
