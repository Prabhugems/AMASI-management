"use client"

import { useState } from "react"
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
  Shield,
  Search,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  LogIn,
  LogOut,
  Activity,
  UserCheck,
  Timer,
  AlertCircle,
  ArrowUpDown,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

type AuditUser = {
  id: string
  email: string
  name: string
  platform_role: string
  team_role: string | null
  is_active: boolean
  is_team_member: boolean
  status: "online" | "away" | "logged_out" | "offline" | "never"
  last_login_at: string | null
  last_active_at: string | null
  logged_out_at: string | null
  login_count: number
  last_sign_in_at: string | null
  session_duration_ms: number | null
  created_at: string
}

type ActivityLog = {
  id: string
  user_email: string
  user_name: string
  action: string
  description: string | null
  created_at: string
  metadata: Record<string, any>
}

type AuditStats = {
  total_users: number
  online_now: number
  active_today: number
  never_logged_in: number
  avg_session_duration_ms: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  online: { label: "Online", color: "text-green-700 bg-green-100 border-green-200", dot: "bg-green-500" },
  away: { label: "Away", color: "text-amber-700 bg-amber-100 border-amber-200", dot: "bg-amber-500" },
  logged_out: { label: "Logged Out", color: "text-gray-700 bg-gray-100 border-gray-200", dot: "bg-gray-400" },
  offline: { label: "Offline", color: "text-gray-600 bg-gray-50 border-gray-200", dot: "bg-gray-300" },
  never: { label: "Never Logged In", color: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-400" },
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  event_admin: "Event Admin",
  staff: "Staff",
  faculty: "Faculty",
  member: "Member",
}

function formatDuration(ms: number): string {
  if (ms < 60 * 1000) return "< 1 min"
  const mins = Math.floor(ms / (60 * 1000))
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${mins % 60}m`
  return `${mins}m`
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  if (diffHours < 24) return formatDistanceToNow(date, { addSuffix: true })
  return format(date, "MMM d, yyyy 'at' h:mm a")
}

export default function AuditDashboardPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [tab, setTab] = useState<"users" | "timeline">("users")
  const [sortBy, setSortBy] = useState<"last_login" | "login_count" | "name">("last_login")
  const [timelinePage, setTimelinePage] = useState(0)
  const timelineLimit = 30

  // Fetch audit data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["audit-sessions", timelinePage],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: timelineLimit.toString(),
        offset: (timelinePage * timelineLimit).toString(),
      })
      const res = await fetch(`/api/audit/sessions?${params}`)
      if (!res.ok) throw new Error("Failed to fetch audit data")
      return res.json() as Promise<{
        users: AuditUser[]
        activity_logs: ActivityLog[]
        activity_logs_total: number
        stats: AuditStats
      }>
    },
  })

  const users = data?.users || []
  const activityLogs = data?.activity_logs || []
  const stats = data?.stats || { total_users: 0, online_now: 0, active_today: 0, never_logged_in: 0, avg_session_duration_ms: 0 }
  const logsTotal = data?.activity_logs_total || 0
  const totalTimelinePages = Math.ceil(logsTotal / timelineLimit)

  // Filter users
  const filteredUsers = users.filter((u) => {
    if (statusFilter !== "all" && u.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.platform_role?.toLowerCase().includes(q)
      )
    }
    return true
  })

  // Sort users
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === "login_count") return b.login_count - a.login_count
    if (sortBy === "name") return (a.name || "").localeCompare(b.name || "")
    // Default: last_login (most recent first, nulls last)
    if (!a.last_login_at && !b.last_login_at) return 0
    if (!a.last_login_at) return 1
    if (!b.last_login_at) return -1
    return new Date(b.last_login_at).getTime() - new Date(a.last_login_at).getTime()
  })

  return (
    <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Audit Dashboard
          </h1>
          <p className="text-muted-foreground">
            Login/logout activity, session durations, and team member activity logs
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total Users</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total_users}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <UserCheck className="h-4 w-4" />
            <span className="text-sm">Online Now</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.online_now}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-600">
            <LogIn className="h-4 w-4" />
            <span className="text-sm">Active Today</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.active_today}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <Timer className="h-4 w-4" />
            <span className="text-sm">Avg Session</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {stats.avg_session_duration_ms > 0 ? formatDuration(stats.avg_session_duration_ms) : "--"}
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Never Logged In</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.never_logged_in}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("users")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-md transition-colors",
            tab === "users" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="h-4 w-4 inline mr-2" />
          User Sessions
        </button>
        <button
          onClick={() => setTab("timeline")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-md transition-colors",
            tab === "timeline" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Activity className="h-4 w-4 inline mr-2" />
          Activity Timeline
        </button>
      </div>

      {/* Users Tab */}
      {tab === "users" && (
        <>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="away">Away</SelectItem>
                <SelectItem value="logged_out">Logged Out</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="never">Never Logged In</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-full md:w-44">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_login">Last Login</SelectItem>
                <SelectItem value="login_count">Login Count</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedUsers.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border border-dashed">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No users found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="bg-card rounded-lg border overflow-hidden">
              {/* Table Header */}
              <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] gap-4 px-4 py-3 bg-muted/50 text-sm font-medium text-muted-foreground border-b">
                <span>User</span>
                <span>Status</span>
                <span>Last Login</span>
                <span>Last Active</span>
                <span>Session Duration</span>
                <span className="text-right">Logins</span>
              </div>

              {/* Rows */}
              <div className="divide-y">
                {sortedUsers.map((u) => {
                  const statusConfig = STATUS_CONFIG[u.status] || STATUS_CONFIG.offline

                  return (
                    <div
                      key={u.id}
                      className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] gap-2 md:gap-4 px-4 py-3 hover:bg-muted/30 transition-colors items-center"
                    >
                      {/* User */}
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                            {(u.name || u.email || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background", statusConfig.dot)} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{u.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Badge variant="outline" className="text-[10px] px-1.5">
                            {ROLE_LABELS[u.platform_role] || u.platform_role}
                          </Badge>
                          {u.is_team_member && (
                            <Badge variant="secondary" className="text-[10px] px-1.5">Team</Badge>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <div>
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border", statusConfig.color)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig.dot, u.status === "online" && "animate-pulse")} />
                          {statusConfig.label}
                        </span>
                      </div>

                      {/* Last Login */}
                      <div className="text-sm text-muted-foreground">
                        {u.last_login_at ? (
                          <div>
                            <p>{formatTime(u.last_login_at)}</p>
                            <p className="text-[11px] text-muted-foreground/70">
                              {format(new Date(u.last_login_at), "MMM d, h:mm a")}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">--</span>
                        )}
                      </div>

                      {/* Last Active */}
                      <div className="text-sm text-muted-foreground">
                        {u.logged_out_at && (!u.last_active_at || new Date(u.logged_out_at) > new Date(u.last_active_at)) ? (
                          <div>
                            <p className="flex items-center gap-1 text-muted-foreground">
                              <LogOut className="h-3 w-3" />
                              {formatTime(u.logged_out_at)}
                            </p>
                            <p className="text-[11px] text-muted-foreground/70">Logged out</p>
                          </div>
                        ) : u.last_active_at ? (
                          <div>
                            <p>{formatTime(u.last_active_at)}</p>
                            <p className="text-[11px] text-muted-foreground/70">
                              {format(new Date(u.last_active_at), "MMM d, h:mm a")}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">--</span>
                        )}
                      </div>

                      {/* Session Duration */}
                      <div className="text-sm">
                        {u.session_duration_ms !== null ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{formatDuration(u.session_duration_ms)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">--</span>
                        )}
                      </div>

                      {/* Login Count */}
                      <div className="text-right">
                        <span className={cn(
                          "inline-flex items-center justify-center min-w-[32px] h-7 rounded-full text-sm font-semibold",
                          u.login_count > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {u.login_count}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Summary */}
              <div className="px-4 py-3 bg-muted/30 border-t text-sm text-muted-foreground">
                Showing {sortedUsers.length} of {users.length} users
              </div>
            </div>
          )}
        </>
      )}

      {/* Timeline Tab */}
      {tab === "timeline" && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border border-dashed">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No login/logout activity recorded</h3>
              <p className="text-muted-foreground">
                Login and logout events will appear here once activity logging is active
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {/* Timeline */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[23px] top-4 bottom-4 w-px bg-border" />

                <div className="space-y-1">
                  {activityLogs.map((log, idx) => {
                    const isLogin = log.action === "login"
                    const prevLog = idx > 0 ? activityLogs[idx - 1] : null
                    const showDateHeader = !prevLog || format(new Date(log.created_at), "yyyy-MM-dd") !== format(new Date(prevLog.created_at), "yyyy-MM-dd")

                    return (
                      <div key={log.id}>
                        {showDateHeader && (
                          <div className="flex items-center gap-3 py-3 pl-2">
                            <div className="h-[11px] w-[11px] rounded-full bg-muted-foreground/30 border-2 border-background z-10" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              {format(new Date(log.created_at), "EEEE, MMMM d, yyyy")}
                            </span>
                          </div>
                        )}
                        <div className="flex items-start gap-3 py-2 pl-2 hover:bg-muted/30 rounded-lg transition-colors">
                          {/* Dot */}
                          <div className={cn(
                            "h-[11px] w-[11px] rounded-full border-2 border-background z-10 mt-1.5 flex-shrink-0",
                            isLogin ? "bg-green-500" : "bg-gray-400"
                          )} />

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isLogin ? (
                                <LogIn className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                              ) : (
                                <LogOut className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                              )}
                              <span className="font-medium text-sm">{log.user_name || log.user_email}</span>
                              <Badge variant={isLogin ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                {isLogin ? "Logged In" : "Logged Out"}
                              </Badge>
                              <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                                {format(new Date(log.created_at), "h:mm:ss a")}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {log.user_email}
                              {log.description && ` - ${log.description}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Timeline Pagination */}
              {totalTimelinePages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {timelinePage * timelineLimit + 1} to {Math.min((timelinePage + 1) * timelineLimit, logsTotal)} of {logsTotal}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTimelinePage(timelinePage - 1)}
                      disabled={timelinePage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {timelinePage + 1} of {totalTimelinePages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTimelinePage(timelinePage + 1)}
                      disabled={timelinePage >= totalTimelinePages - 1}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
