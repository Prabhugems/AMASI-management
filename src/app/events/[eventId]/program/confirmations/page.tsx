"use client"

import { useMemo, useState } from "react"
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
      .filter(a => selectedIds.has(a.id) && a.status === 'pending' && a.faculty_email)

    if (pendingSelected.length === 0) {
      toast.error("No pending assignments with email selected")
      return
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
                  <TableRow key={assignment.id} className={cn(selectedIds.has(assignment.id) && "bg-primary/5")}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(assignment.id)}
                        onCheckedChange={() => toggleSelection(assignment.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{assignment.faculty_name}</div>
                        {assignment.faculty_email && (
                          <div className="text-xs text-muted-foreground">{assignment.faculty_email}</div>
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
                          <DropdownMenuItem>
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
    </div>
  )
}
