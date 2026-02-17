"use client"

import { useMemo, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  Search,
  Loader2,
  MoreHorizontal,
  Mail,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock3,
  AlertTriangle,
  Send,
  Download,
  Eye,
  Edit,
  Trash2,
  Phone,
  Calendar,
  Building2,
  ExternalLink,
  Copy,
  X,
  MousePointerClick,
} from "lucide-react"
import { toast } from "sonner"

type FacultyAssignment = {
  id: string
  session_id: string
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
  invitation_sent_at: string | null
  responded_at: string | null
  response_notes: string | null
  change_request_details: string | null
  reminder_count: number
  last_reminder_at: string | null
  invitation_token: string | null
}

const STATUS_CONFIG = {
  pending: { label: "Not Invited", color: "bg-gray-100 text-gray-700", icon: Clock3 },
  invited: { label: "Invited", color: "bg-blue-100 text-blue-700", icon: Mail },
  confirmed: { label: "Confirmed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  declined: { label: "Declined", color: "bg-red-100 text-red-700", icon: XCircle },
  change_requested: { label: "Change Requested", color: "bg-amber-100 text-amber-700", icon: AlertTriangle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500", icon: XCircle },
}

const ROLE_COLORS = {
  speaker: "bg-purple-100 text-purple-700",
  chairperson: "bg-blue-100 text-blue-700",
  moderator: "bg-green-100 text-green-700",
  panelist: "bg-amber-100 text-amber-700",
}

export default function ConfirmationsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [dayFilter, setDayFilter] = useState<string>("all")
  const [hallFilter, setHallFilter] = useState<string>("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sendingInvitations, setSendingInvitations] = useState(false)
  const [sendingReminders, setSendingReminders] = useState(false)
  const [detailAssignment, setDetailAssignment] = useState<FacultyAssignment | null>(null)
  const [resendingInvite, setResendingInvite] = useState(false)

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event-details", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("id, name, short_name, start_date, end_date, venue_name, city")
        .eq("id", eventId)
        .single()
      return data
    },
  })

  // Fetch assignments
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["confirmations", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("faculty_assignments")
        .select("*")
        .eq("event_id", eventId)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
        .order("faculty_name", { ascending: true })
      return (data || []) as FacultyAssignment[]
    },
  })

  // Fetch email logs for the selected assignment
  const { data: emailLogs } = useQuery({
    queryKey: ["assignment-emails", detailAssignment?.id],
    queryFn: async () => {
      if (!detailAssignment) return []
      const { data } = await (supabase as any)
        .from("assignment_emails")
        .select("*")
        .eq("assignment_id", detailAssignment.id)
        .order("sent_at", { ascending: false })
      return (data || []) as Array<{
        id: string
        email_type: string
        recipient_email: string
        subject: string
        status: string
        sent_at: string
        opened_at: string | null
        clicked_at: string | null
        external_id: string | null
      }>
    },
    enabled: !!detailAssignment,
  })

  // Resend invitation for a single assignment
  const resendInvitation = useCallback(async (assignment: FacultyAssignment) => {
    if (!assignment.faculty_email || assignment.faculty_email.includes("@placeholder.")) {
      toast.error("Cannot send to placeholder email. Update with a real email first.")
      return
    }

    setResendingInvite(true)
    try {
      const eventName = event?.short_name || event?.name || "Event"
      const eventVenue = event?.venue_name ? `${event.venue_name}${event.city ? `, ${event.city}` : ""}` : ""

      const response = await fetch("/api/email/faculty-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: assignment.id,
          event_id: eventId,
          event_name: eventName,
          event_start_date: event?.start_date,
          event_end_date: event?.end_date,
          event_venue: eventVenue,
        }),
      })

      if (response.ok) {
        toast.success(`Invitation sent to ${assignment.faculty_name}`)
        queryClient.invalidateQueries({ queryKey: ["confirmations", eventId] })
        queryClient.invalidateQueries({ queryKey: ["assignment-emails", assignment.id] })
        // Update the detail assignment with new status
        setDetailAssignment(prev => prev ? { ...prev, status: "invited", invitation_sent_at: new Date().toISOString() } : null)
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to send invitation")
      }
    } catch {
      toast.error("Error sending invitation")
    } finally {
      setResendingInvite(false)
    }
  }, [event, eventId, queryClient])

  // Get unique values for filters
  const dates = useMemo(() => {
    if (!assignments) return []
    return [...new Set(assignments.map(a => a.session_date))].filter(Boolean).sort()
  }, [assignments])

  const halls = useMemo(() => {
    if (!assignments) return []
    return [...new Set(assignments.map(a => a.hall))].filter(Boolean) as string[]
  }, [assignments])

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    if (!assignments) return []

    return assignments.filter(a => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase()
        if (
          !a.faculty_name.toLowerCase().includes(searchLower) &&
          !(a.faculty_email || "").toLowerCase().includes(searchLower) &&
          !(a.session_name || "").toLowerCase().includes(searchLower)
        ) {
          return false
        }
      }

      // Status filter
      if (statusFilter !== "all" && a.status !== statusFilter) return false

      // Role filter
      if (roleFilter !== "all" && a.role !== roleFilter) return false

      // Day filter
      if (dayFilter !== "all" && a.session_date !== dayFilter) return false

      // Hall filter
      if (hallFilter !== "all" && a.hall !== hallFilter) return false

      return true
    })
  }, [assignments, search, statusFilter, roleFilter, dayFilter, hallFilter])

  // Stats
  const stats = useMemo(() => {
    if (!filteredAssignments) return null

    return {
      total: filteredAssignments.length,
      confirmed: filteredAssignments.filter(a => a.status === 'confirmed').length,
      invited: filteredAssignments.filter(a => a.status === 'invited').length,
      pending: filteredAssignments.filter(a => a.status === 'pending').length,
      declined: filteredAssignments.filter(a => a.status === 'declined').length,
      changeRequested: filteredAssignments.filter(a => a.status === 'change_requested').length,
    }
  }, [filteredAssignments])

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

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-"
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Select all
  const selectAll = () => {
    if (selectedIds.size === filteredAssignments.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredAssignments.map(a => a.id)))
    }
  }

  // Bulk actions
  const sendBulkInvitations = async () => {
    const pendingSelected = filteredAssignments
      .filter(a => selectedIds.has(a.id) && a.status === 'pending' && a.faculty_email && !a.faculty_email.includes("@placeholder."))

    const placeholderCount = filteredAssignments
      .filter(a => selectedIds.has(a.id) && a.status === 'pending' && a.faculty_email?.includes("@placeholder.")).length

    if (pendingSelected.length === 0) {
      if (placeholderCount > 0) {
        toast.error(`${placeholderCount} faculty have placeholder emails. Update with real emails before sending invitations.`)
      } else {
        toast.error("No pending assignments with email selected")
      }
      return
    }

    if (placeholderCount > 0) {
      toast.warning(`Skipping ${placeholderCount} faculty with placeholder emails. Sending to ${pendingSelected.length} with real emails.`)
    }

    setSendingInvitations(true)
    let successCount = 0
    let failCount = 0

    const eventName = event?.short_name || event?.name || "Event"
    const eventVenue = event?.venue_name ? `${event.venue_name}${event.city ? `, ${event.city}` : ""}` : ""

    for (const assignment of pendingSelected) {
      try {
        const response = await fetch("/api/email/faculty-invitation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignment_id: assignment.id,
            event_id: eventId,
            event_name: eventName,
            event_start_date: event?.start_date,
            event_end_date: event?.end_date,
            event_venue: eventVenue,
          }),
        })

        if (response.ok) {
          successCount++
        } else {
          failCount++
        }
      } catch (error) {
        console.error("Error sending invitation:", error)
        failCount++
      }
    }

    setSendingInvitations(false)
    queryClient.invalidateQueries({ queryKey: ["confirmations", eventId] })

    if (successCount > 0) {
      toast.success(`Sent invitations to ${successCount} faculty`)
    }
    if (failCount > 0) {
      toast.error(`Failed to send to ${failCount} faculty`)
    }
    setSelectedIds(new Set())
  }

  const sendBulkReminders = async () => {
    const invitedSelected = filteredAssignments
      .filter(a => selectedIds.has(a.id) && a.status === 'invited' && a.faculty_email)

    if (invitedSelected.length === 0) {
      toast.error("No invited assignments with email selected")
      return
    }

    setSendingReminders(true)
    let successCount = 0
    let failCount = 0

    const eventName = event?.short_name || event?.name || "Event"
    const eventVenue = event?.venue_name ? `${event.venue_name}${event.city ? `, ${event.city}` : ""}` : ""

    for (const assignment of invitedSelected) {
      try {
        const response = await fetch("/api/email/faculty-reminder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignment_id: assignment.id,
            event_id: eventId,
            event_name: eventName,
            event_start_date: event?.start_date,
            event_end_date: event?.end_date,
            event_venue: eventVenue,
          }),
        })

        if (response.ok) {
          successCount++
        } else {
          failCount++
        }
      } catch (error) {
        console.error("Error sending reminder:", error)
        failCount++
      }
    }

    setSendingReminders(false)
    queryClient.invalidateQueries({ queryKey: ["confirmations", eventId] })

    if (successCount > 0) {
      toast.success(`Sent reminders to ${successCount} faculty`)
    }
    if (failCount > 0) {
      toast.error(`Failed to send to ${failCount} faculty`)
    }
    setSelectedIds(new Set())
  }

  // Export to CSV
  const exportToCsv = () => {
    const headers = ['Name', 'Email', 'Phone', 'Role', 'Session', 'Date', 'Time', 'Hall', 'Status', 'Invited At', 'Responded At']
    const rows = filteredAssignments.map(a => [
      a.faculty_name,
      a.faculty_email || '',
      a.faculty_phone || '',
      a.role,
      a.session_name,
      a.session_date,
      `${formatTime(a.start_time)} - ${formatTime(a.end_time)}`,
      a.hall,
      a.status,
      a.invitation_sent_at || '',
      a.responded_at || '',
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `confirmations-${eventId}.csv`
    a.click()
  }

  if (isLoading) {
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
          <h1 className="text-xl sm:text-2xl font-bold">Confirmations</h1>
          <p className="text-muted-foreground">Track and manage all faculty confirmations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Link href={`${basePath}/confirmations/send`}>
            <Button>
              <Send className="h-4 w-4 mr-2" />
              Send Invitations
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        <div className="flex items-center gap-2 px-4 py-2 bg-card border rounded-lg min-w-fit">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-bold">{stats?.total || 0}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg min-w-fit">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-green-700">Confirmed: {stats?.confirmed || 0}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg min-w-fit">
          <Mail className="h-4 w-4 text-blue-600" />
          <span className="text-blue-700">Invited: {stats?.invited || 0}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg min-w-fit">
          <Clock3 className="h-4 w-4 text-gray-600" />
          <span className="text-gray-700">Not Invited: {stats?.pending || 0}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg min-w-fit">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-amber-700">Changes: {stats?.changeRequested || 0}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg min-w-fit">
          <XCircle className="h-4 w-4 text-red-600" />
          <span className="text-red-700">Declined: {stats?.declined || 0}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-muted/30 p-4 rounded-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, or session..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px] bg-white">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="speaker">Speaker</SelectItem>
            <SelectItem value="chairperson">Chairperson</SelectItem>
            <SelectItem value="moderator">Moderator</SelectItem>
            <SelectItem value="panelist">Panelist</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dayFilter} onValueChange={setDayFilter}>
          <SelectTrigger className="w-[140px] bg-white">
            <SelectValue placeholder="Day" />
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

        <Select value={hallFilter} onValueChange={setHallFilter}>
          <SelectTrigger className="w-[140px] bg-white">
            <SelectValue placeholder="Hall" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Halls</SelectItem>
            {halls.map(hall => (
              <SelectItem key={hall} value={hall}>{hall}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 bg-primary/5 border border-primary/20 p-4 rounded-lg">
          <span className="font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={sendBulkInvitations} disabled={sendingInvitations || sendingReminders}>
              {sendingInvitations ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              {sendingInvitations ? "Sending..." : "Send Invitations"}
            </Button>
            <Button size="sm" variant="outline" onClick={sendBulkReminders} disabled={sendingInvitations || sendingReminders}>
              {sendingReminders ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {sendingReminders ? "Sending..." : "Send Reminders"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={sendingInvitations || sendingReminders}>
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === filteredAssignments.length && filteredAssignments.length > 0}
                  onCheckedChange={selectAll}
                />
              </TableHead>
              <TableHead>Faculty</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Hall</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invited</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  No faculty assignments found. Import program data to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredAssignments.map(assignment => {
                const statusConfig = STATUS_CONFIG[assignment.status as keyof typeof STATUS_CONFIG]
                const roleColor = ROLE_COLORS[assignment.role as keyof typeof ROLE_COLORS]

                return (
                  <TableRow
                    key={assignment.id}
                    className={cn(
                      "cursor-pointer",
                      selectedIds.has(assignment.id) && "bg-primary/5",
                      detailAssignment?.id === assignment.id && "bg-blue-50"
                    )}
                    onClick={() => setDetailAssignment(assignment)}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(assignment.id)}
                        onCheckedChange={() => toggleSelection(assignment.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{assignment.faculty_name}</div>
                        {assignment.faculty_email && (
                          <div className="text-xs text-muted-foreground">
                            {assignment.faculty_email}
                            {assignment.faculty_email.includes("@placeholder.") && (
                              <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 text-amber-600 border-amber-300">placeholder</Badge>
                            )}
                          </div>
                        )}
                        {assignment.faculty_phone && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {assignment.faculty_phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("capitalize text-xs", roleColor)}>
                        {assignment.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate" title={assignment.session_name}>
                        {assignment.session_name}
                      </div>
                      {assignment.topic_title && assignment.topic_title !== assignment.session_name && (
                        <div className="text-xs text-muted-foreground truncate" title={assignment.topic_title}>
                          {assignment.topic_title}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(assignment.session_date)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(assignment.start_time)} - {formatTime(assignment.end_time)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {assignment.hall}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", statusConfig?.color)}>
                        {statusConfig?.label || assignment.status}
                      </Badge>
                      {assignment.reminder_count > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {assignment.reminder_count} reminder{assignment.reminder_count > 1 ? 's' : ''}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {assignment.invitation_sent_at ? (
                        <div>
                          <div>{formatDateTime(assignment.invitation_sent_at)}</div>
                          {assignment.responded_at && (
                            <div className="text-xs text-green-600">
                              Responded {formatDateTime(assignment.responded_at)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">Not sent</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailAssignment(assignment)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {assignment.status === 'pending' && (
                            <DropdownMenuItem>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Invitation
                            </DropdownMenuItem>
                          )}
                          {assignment.status === 'invited' && (
                            <DropdownMenuItem>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Send Reminder
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination info */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredAssignments.length} of {assignments?.length || 0} faculty assignments
      </div>

      {/* Detail Sidebar */}
      <Sheet open={!!detailAssignment} onOpenChange={(open) => { if (!open) setDetailAssignment(null) }}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Faculty Details</SheetTitle>
          </SheetHeader>
          {detailAssignment && (() => {
            const a = detailAssignment
            const statusConfig = STATUS_CONFIG[a.status as keyof typeof STATUS_CONFIG]
            const isPlaceholder = a.faculty_email?.includes("@placeholder.")

            return (
              <div className="space-y-6 mt-4">
                {/* Faculty Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">{a.faculty_name}</h3>
                  <div className="space-y-2 text-sm">
                    {a.faculty_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className={isPlaceholder ? "text-amber-600" : ""}>{a.faculty_email}</span>
                        {isPlaceholder && <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-300">placeholder</Badge>}
                      </div>
                    )}
                    {a.faculty_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{a.faculty_phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge className={cn("capitalize text-xs", ROLE_COLORS[a.role as keyof typeof ROLE_COLORS])}>
                        {a.role}
                      </Badge>
                      <Badge className={cn("text-xs", statusConfig?.color)}>
                        {statusConfig?.label || a.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Session Info */}
                <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
                  <h4 className="font-medium text-sm">Session</h4>
                  <p className="font-medium">{a.session_name}</p>
                  {a.topic_title && a.topic_title !== a.session_name && (
                    <p className="text-sm text-muted-foreground">{a.topic_title}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(a.session_date)}</span>
                    <span>{formatTime(a.start_time)} - {formatTime(a.end_time)}</span>
                  </div>
                  {a.hall && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />{a.hall}
                    </div>
                  )}
                </div>

                {/* Invitation Timeline */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Invitation Timeline</h4>
                  <div className="border rounded-lg divide-y">
                    {/* Status: Not Invited */}
                    <div className="flex items-center gap-3 p-3">
                      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", "bg-green-100")}>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Assignment Created</p>
                        <p className="text-xs text-muted-foreground">Faculty linked to session</p>
                      </div>
                    </div>

                    {/* Invitation Sent */}
                    <div className="flex items-center gap-3 p-3">
                      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                        a.invitation_sent_at ? "bg-blue-100" : "bg-gray-100"
                      )}>
                        <Mail className={cn("h-4 w-4", a.invitation_sent_at ? "text-blue-600" : "text-gray-400")} />
                      </div>
                      <div className="flex-1">
                        <p className={cn("text-sm font-medium", !a.invitation_sent_at && "text-muted-foreground")}>
                          Invitation {a.invitation_sent_at ? "Sent" : "Not Sent"}
                        </p>
                        {a.invitation_sent_at && (
                          <p className="text-xs text-muted-foreground">{formatDateTime(a.invitation_sent_at)}</p>
                        )}
                        {isPlaceholder && !a.invitation_sent_at && (
                          <p className="text-xs text-amber-600">Cannot send to placeholder email</p>
                        )}
                      </div>
                    </div>

                    {/* Email Delivery */}
                    {emailLogs && emailLogs.length > 0 && (
                      <div className="flex items-center gap-3 p-3">
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                          emailLogs[0].status === "delivered" ? "bg-green-100" :
                          emailLogs[0].status === "bounced" ? "bg-red-100" : "bg-blue-100"
                        )}>
                          <Send className={cn("h-4 w-4",
                            emailLogs[0].status === "delivered" ? "text-green-600" :
                            emailLogs[0].status === "bounced" ? "text-red-600" : "text-blue-600"
                          )} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium capitalize">
                            Email {emailLogs[0].status}
                          </p>
                          <p className="text-xs text-muted-foreground">{emailLogs[0].subject}</p>
                        </div>
                      </div>
                    )}

                    {/* Link Clicked */}
                    {emailLogs && emailLogs.some(l => l.clicked_at) && (
                      <div className="flex items-center gap-3 p-3">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-purple-100">
                          <MousePointerClick className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Link Clicked</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(emailLogs.find(l => l.clicked_at)?.clicked_at || null)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Response */}
                    {(a.status === "confirmed" || a.status === "declined" || a.status === "change_requested") && (
                      <div className="flex items-center gap-3 p-3">
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                          a.status === "confirmed" ? "bg-green-100" :
                          a.status === "declined" ? "bg-red-100" : "bg-amber-100"
                        )}>
                          {a.status === "confirmed" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                           a.status === "declined" ? <XCircle className="h-4 w-4 text-red-600" /> :
                           <AlertTriangle className="h-4 w-4 text-amber-600" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {a.status === "confirmed" ? "Confirmed" :
                             a.status === "declined" ? "Declined" : "Change Requested"}
                          </p>
                          {a.responded_at && (
                            <p className="text-xs text-muted-foreground">{formatDateTime(a.responded_at)}</p>
                          )}
                          {a.response_notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">&quot;{a.response_notes}&quot;</p>
                          )}
                          {a.change_request_details && (
                            <p className="text-xs text-amber-700 mt-1">{a.change_request_details}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Reminders */}
                    {a.reminder_count > 0 && (
                      <div className="flex items-center gap-3 p-3">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-orange-100">
                          <RefreshCw className="h-4 w-4 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{a.reminder_count} Reminder{a.reminder_count > 1 ? "s" : ""} Sent</p>
                          {a.last_reminder_at && (
                            <p className="text-xs text-muted-foreground">Last: {formatDateTime(a.last_reminder_at)}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Email History */}
                {emailLogs && emailLogs.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Email History</h4>
                    <div className="space-y-2">
                      {emailLogs.map((log) => (
                        <div key={log.id} className="border rounded-lg p-3 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="capitalize text-xs">{log.email_type.replace("_", " ")}</Badge>
                            <Badge className={cn("text-xs",
                              log.status === "sent" ? "bg-blue-100 text-blue-700" :
                              log.status === "delivered" ? "bg-green-100 text-green-700" :
                              log.status === "bounced" ? "bg-red-100 text-red-700" :
                              "bg-gray-100 text-gray-700"
                            )}>{log.status}</Badge>
                          </div>
                          <p className="text-muted-foreground text-xs">{log.subject}</p>
                          <p className="text-muted-foreground text-xs">{formatDateTime(log.sent_at)}</p>
                          {log.opened_at && <p className="text-xs text-green-600">Opened: {formatDateTime(log.opened_at)}</p>}
                          {log.clicked_at && <p className="text-xs text-purple-600">Clicked: {formatDateTime(log.clicked_at)}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t">
                  {(a.status === "pending" || a.status === "invited") && (
                    <Button
                      className="w-full"
                      onClick={() => resendInvitation(a)}
                      disabled={resendingInvite || isPlaceholder}
                    >
                      {resendingInvite ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                      ) : (
                        <><Send className="h-4 w-4 mr-2" />{a.status === "pending" ? "Send Invitation" : "Resend Invitation"}</>
                      )}
                    </Button>
                  )}
                  {a.invitation_token && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const url = `${window.location.origin}/speaker/${a.invitation_token}`
                        navigator.clipboard.writeText(url)
                        toast.success("Portal link copied to clipboard")
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Portal Link
                    </Button>
                  )}
                </div>
              </div>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
