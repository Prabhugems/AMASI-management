"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Activity,
  Search,
  Loader2,
  User,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Mail,
  UserCheck,
  BadgeCheck,
  Award,
  Settings,
  Download,
  Upload,
  Send,
  Bell,
  CheckCircle,
  XCircle,
  FileText,
  CreditCard,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

type ActivityLog = {
  id: string
  user_id: string | null
  user_email: string
  user_name: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  event_id: string | null
  event_name: string | null
  description: string | null
  metadata: Record<string, any>
  created_at: string
}

const ACTION_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  create: { icon: Plus, color: "text-green-600 bg-green-100", label: "Created" },
  update: { icon: Pencil, color: "text-blue-600 bg-blue-100", label: "Updated" },
  delete: { icon: Trash2, color: "text-red-600 bg-red-100", label: "Deleted" },
  send_email: { icon: Mail, color: "text-purple-600 bg-purple-100", label: "Email Sent" },
  send_bulk_email: { icon: Send, color: "text-purple-600 bg-purple-100", label: "Bulk Email" },
  generate_badge: { icon: BadgeCheck, color: "text-indigo-600 bg-indigo-100", label: "Badge Generated" },
  generate_certificate: { icon: Award, color: "text-amber-600 bg-amber-100", label: "Certificate Generated" },
  check_in: { icon: UserCheck, color: "text-green-600 bg-green-100", label: "Checked In" },
  check_out: { icon: XCircle, color: "text-orange-600 bg-orange-100", label: "Checked Out" },
  confirm: { icon: CheckCircle, color: "text-green-600 bg-green-100", label: "Confirmed" },
  cancel: { icon: XCircle, color: "text-red-600 bg-red-100", label: "Cancelled" },
  refund: { icon: CreditCard, color: "text-amber-600 bg-amber-100", label: "Refunded" },
  invite: { icon: Send, color: "text-blue-600 bg-blue-100", label: "Invited" },
  remind: { icon: Bell, color: "text-amber-600 bg-amber-100", label: "Reminder Sent" },
  export: { icon: Download, color: "text-gray-600 bg-gray-100", label: "Exported" },
  import: { icon: Upload, color: "text-gray-600 bg-gray-100", label: "Imported" },
  bulk_action: { icon: Settings, color: "text-indigo-600 bg-indigo-100", label: "Bulk Action" },
  login: { icon: User, color: "text-green-600 bg-green-100", label: "Login" },
  logout: { icon: User, color: "text-gray-600 bg-gray-100", label: "Logout" },
}

const ENTITY_LABELS: Record<string, string> = {
  registration: "Registration",
  event: "Event",
  ticket: "Ticket",
  badge: "Badge",
  certificate: "Certificate",
  speaker: "Speaker",
  session: "Session",
  checkin_list: "Check-in List",
  email_template: "Email Template",
  discount_code: "Discount Code",
  payment: "Payment",
  team_member: "Team Member",
  settings: "Settings",
  user: "User",
}

export default function ActivityLogPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [entityFilter, setEntityFilter] = useState<string>("all")
  const [page, setPage] = useState(0)
  const limit = 25

  // Fetch activity logs
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["activity-logs", eventId, actionFilter, entityFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        event_id: eventId,
        limit: limit.toString(),
        offset: (page * limit).toString(),
      })

      if (actionFilter !== "all") {
        params.append("action", actionFilter)
      }
      if (entityFilter !== "all") {
        params.append("entity_type", entityFilter)
      }

      const res = await fetch(`/api/activity-logs?${params}`)
      return res.json() as Promise<{ data: ActivityLog[]; total: number }>
    },
  })

  const logs = data?.data || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  // Filter by search
  const filteredLogs = logs.filter((log) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.user_email?.toLowerCase().includes(searchLower) ||
      log.entity_name?.toLowerCase().includes(searchLower) ||
      log.description?.toLowerCase().includes(searchLower)
    )
  })

  const getActionConfig = (action: string) => {
    return ACTION_CONFIG[action] || { icon: Activity, color: "text-gray-600 bg-gray-100", label: action }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true })
    }
    return format(date, "MMM d, yyyy 'at' h:mm a")
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Activity Log
          </h1>
          <p className="text-muted-foreground">
            Track all actions and changes made to this event
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span className="text-sm">Total Activities</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <Plus className="h-4 w-4" />
            <span className="text-sm">Creates</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">
            {logs.filter((l) => l.action === "create").length}
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-600">
            <Pencil className="h-4 w-4" />
            <span className="text-sm">Updates</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">
            {logs.filter((l) => l.action === "update").length}
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-purple-600">
            <Mail className="h-4 w-4" />
            <span className="text-sm">Emails Sent</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">
            {logs.filter((l) => l.action.includes("email")).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, entity, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="send_email">Send Email</SelectItem>
            <SelectItem value="check_in">Check In</SelectItem>
            <SelectItem value="generate_badge">Generate Badge</SelectItem>
            <SelectItem value="confirm">Confirm</SelectItem>
            <SelectItem value="cancel">Cancel</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full md:w-48">
            <FileText className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="registration">Registrations</SelectItem>
            <SelectItem value="ticket">Tickets</SelectItem>
            <SelectItem value="badge">Badges</SelectItem>
            <SelectItem value="certificate">Certificates</SelectItem>
            <SelectItem value="speaker">Speakers</SelectItem>
            <SelectItem value="session">Sessions</SelectItem>
            <SelectItem value="email_template">Email Templates</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No activity yet</h3>
          <p className="text-muted-foreground">
            Actions performed on this event will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const config = getActionConfig(log.action)
            const Icon = config.icon

            return (
              <div
                key={log.id}
                className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Action Icon */}
                  <div className={cn("p-2 rounded-lg", config.color)}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">
                          {log.description || `${config.label} ${ENTITY_LABELS[log.entity_type] || log.entity_type}`}
                        </p>
                        {log.entity_name && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {log.entity_name}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-muted-foreground">
                          {formatTime(log.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* User & Metadata */}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span>{log.user_name || log.user_email}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {ENTITY_LABELS[log.entity_type] || log.entity_type}
                      </Badge>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          +{Object.keys(log.metadata).length} details
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total} activities
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
