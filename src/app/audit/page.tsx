"use client"

import { useState, useCallback } from "react"
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
  ChevronDown,
  ChevronUp,
  Users,
  Clock,
  LogIn,
  LogOut,
  Activity,
  UserCheck,
  Timer,
  AlertCircle,
  ArrowUpDown,
  Download,
  TrendingUp,
  Trophy,
  BarChart3,
  CalendarDays,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { exportToCSV } from "@/lib/csv-export"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"

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
  user_id: string
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

type LoginPerDay = {
  date: string
  count: number
}

type TopUser = {
  name: string
  email: string
  login_count: number
  status: string
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

// Expandable user row component showing individual login/logout history
function UserHistoryRow({ user }: { user: AuditUser }) {
  const [expanded, setExpanded] = useState(false)
  const statusConfig = STATUS_CONFIG[user.status] || STATUS_CONFIG.offline

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["user-activity-history", user.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        user_id: user.id,
        limit: "20",
      })
      const res = await fetch(`/api/activity-logs?${params}`)
      if (!res.ok) throw new Error("Failed to fetch user history")
      return res.json() as Promise<{ data: ActivityLog[]; total: number }>
    },
    enabled: expanded,
  })

  return (
    <div>
      {/* Main row */}
      <div
        className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_80px_40px] gap-2 md:gap-4 px-4 py-3 hover:bg-muted/30 transition-colors items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* User */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
              {(user.name || user.email || "?").charAt(0).toUpperCase()}
            </div>
            <div className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background", statusConfig.dot)} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Badge variant="outline" className="text-[10px] px-1.5">
              {ROLE_LABELS[user.platform_role] || user.platform_role}
            </Badge>
            {user.is_team_member && (
              <Badge variant="secondary" className="text-[10px] px-1.5">Team</Badge>
            )}
          </div>
        </div>

        {/* Status */}
        <div>
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border", statusConfig.color)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig.dot, user.status === "online" && "animate-pulse")} />
            {statusConfig.label}
          </span>
        </div>

        {/* Last Login */}
        <div className="text-sm text-muted-foreground">
          {user.last_login_at ? (
            <div>
              <p>{formatTime(user.last_login_at)}</p>
              <p className="text-[11px] text-muted-foreground/70">
                {format(new Date(user.last_login_at), "MMM d, h:mm a")}
              </p>
            </div>
          ) : (
            <span className="text-muted-foreground/50">--</span>
          )}
        </div>

        {/* Last Active */}
        <div className="text-sm text-muted-foreground">
          {user.logged_out_at && (!user.last_active_at || new Date(user.logged_out_at) > new Date(user.last_active_at)) ? (
            <div>
              <p className="flex items-center gap-1 text-muted-foreground">
                <LogOut className="h-3 w-3" />
                {formatTime(user.logged_out_at)}
              </p>
              <p className="text-[11px] text-muted-foreground/70">Logged out</p>
            </div>
          ) : user.last_active_at ? (
            <div>
              <p>{formatTime(user.last_active_at)}</p>
              <p className="text-[11px] text-muted-foreground/70">
                {format(new Date(user.last_active_at), "MMM d, h:mm a")}
              </p>
            </div>
          ) : (
            <span className="text-muted-foreground/50">--</span>
          )}
        </div>

        {/* Session Duration */}
        <div className="text-sm">
          {user.session_duration_ms !== null ? (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{formatDuration(user.session_duration_ms)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground/50">--</span>
          )}
        </div>

        {/* Login Count */}
        <div className="text-right">
          <span className={cn(
            "inline-flex items-center justify-center min-w-[32px] h-7 rounded-full text-sm font-semibold",
            user.login_count > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {user.login_count}
          </span>
        </div>

        {/* Expand toggle */}
        <div className="flex items-center justify-center">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded history */}
      {expanded && (
        <div className="px-4 pb-3 bg-muted/20 border-t border-dashed">
          <div className="pl-12 py-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Recent Activity ({historyData?.total || 0} total)
            </h4>
            {historyLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading history...</span>
              </div>
            ) : !historyData?.data?.length ? (
              <p className="text-sm text-muted-foreground py-2">No activity recorded yet</p>
            ) : (
              <div className="space-y-1.5">
                {historyData.data.map((log) => {
                  const isLogin = log.action === "login"
                  return (
                    <div key={log.id} className="flex items-center gap-2 text-sm py-1">
                      <div className={cn(
                        "h-2 w-2 rounded-full flex-shrink-0",
                        isLogin ? "bg-green-500" : "bg-gray-400"
                      )} />
                      {isLogin ? (
                        <LogIn className="h-3 w-3 text-green-600 flex-shrink-0" />
                      ) : (
                        <LogOut className="h-3 w-3 text-gray-500 flex-shrink-0" />
                      )}
                      <Badge variant={isLogin ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {isLogin ? "Login" : "Logout"}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm:ss a")}
                      </span>
                      {log.metadata?.login_count && (
                        <span className="text-[10px] text-muted-foreground/70">
                          (login #{log.metadata.login_count})
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AuditDashboardPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [tab, setTab] = useState<"users" | "timeline" | "analytics">("users")
  const [sortBy, setSortBy] = useState<"last_login" | "login_count" | "name">("last_login")
  const [timelinePage, setTimelinePage] = useState(0)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const timelineLimit = 30

  // Fetch audit data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["audit-sessions", timelinePage, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: timelineLimit.toString(),
        offset: (timelinePage * timelineLimit).toString(),
      })
      if (dateRange?.from) params.set("start_date", dateRange.from.toISOString())
      if (dateRange?.to) params.set("end_date", dateRange.to.toISOString())

      const res = await fetch(`/api/audit/sessions?${params}`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Failed to fetch audit data (${res.status})`)
      }
      return res.json() as Promise<{
        users: AuditUser[]
        activity_logs: ActivityLog[]
        activity_logs_total: number
        stats: AuditStats
        logins_per_day: LoginPerDay[]
        top_users: TopUser[]
      }>
    },
    retry: 1,
  })

  const users = data?.users || []
  const activityLogs = data?.activity_logs || []
  const stats = data?.stats || { total_users: 0, online_now: 0, active_today: 0, never_logged_in: 0, avg_session_duration_ms: 0 }
  const logsTotal = data?.activity_logs_total || 0
  const totalTimelinePages = Math.ceil(logsTotal / timelineLimit)
  const loginsPerDay = data?.logins_per_day || []
  const topUsers = data?.top_users || []

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
    if (!a.last_login_at && !b.last_login_at) return 0
    if (!a.last_login_at) return 1
    if (!b.last_login_at) return -1
    return new Date(b.last_login_at).getTime() - new Date(a.last_login_at).getTime()
  })

  // CSV Export
  const handleExportCSV = useCallback(() => {
    if (!sortedUsers.length) return
    exportToCSV(
      sortedUsers,
      [
        { key: "name", header: "Name" },
        { key: "email", header: "Email" },
        { key: "platform_role", header: "Role", format: (v) => ROLE_LABELS[v] || v },
        { key: "status", header: "Status", format: (v) => STATUS_CONFIG[v]?.label || v },
        { key: "login_count", header: "Login Count" },
        { key: "last_login_at", header: "Last Login", format: (v) => v ? format(new Date(v), "yyyy-MM-dd HH:mm:ss") : "" },
        { key: "last_active_at", header: "Last Active", format: (v) => v ? format(new Date(v), "yyyy-MM-dd HH:mm:ss") : "" },
        { key: "logged_out_at", header: "Last Logout", format: (v) => v ? format(new Date(v), "yyyy-MM-dd HH:mm:ss") : "" },
        { key: "session_duration_ms", header: "Session Duration", format: (v) => v ? formatDuration(v) : "" },
        { key: "is_team_member", header: "Team Member", format: (v) => v ? "Yes" : "No" },
        { key: "created_at", header: "Account Created", format: (v) => v ? format(new Date(v), "yyyy-MM-dd") : "" },
      ],
      `audit-report-${format(new Date(), "yyyy-MM-dd")}`
    )
  }, [sortedUsers])

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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!sortedUsers.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span>Date Range:</span>
        </div>
        <DateRangePicker
          value={dateRange}
          onChange={(range) => {
            setDateRange(range)
            setTimelinePage(0)
          }}
          showPresets
          placeholder="All time"
        />
        {dateRange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateRange(undefined)
              setTimelinePage(0)
            }}
          >
            Clear filter
          </Button>
        )}
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

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">Failed to load audit data</h3>
            <p className="text-sm text-red-600 mt-1">{error.message}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Try Again
            </Button>
          </div>
        </div>
      )}

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
        <button
          onClick={() => setTab("analytics")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-md transition-colors",
            tab === "analytics" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BarChart3 className="h-4 w-4 inline mr-2" />
          Analytics
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
              <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_80px_40px] gap-4 px-4 py-3 bg-muted/50 text-sm font-medium text-muted-foreground border-b">
                <span>User</span>
                <span>Status</span>
                <span>Last Login</span>
                <span>Last Active</span>
                <span>Session Duration</span>
                <span className="text-right">Logins</span>
                <span></span>
              </div>

              {/* Rows */}
              <div className="divide-y">
                {sortedUsers.map((u) => (
                  <UserHistoryRow key={u.id} user={u} />
                ))}
              </div>

              {/* Summary */}
              <div className="px-4 py-3 bg-muted/30 border-t text-sm text-muted-foreground flex items-center justify-between">
                <span>Showing {sortedUsers.length} of {users.length} users</span>
                <Button variant="ghost" size="sm" onClick={handleExportCSV}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export
                </Button>
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

      {/* Analytics Tab */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Login Activity Chart */}
              <div className="bg-card rounded-lg border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Login Activity (Last 30 Days)</h3>
                </div>
                {loginsPerDay.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={loginsPerDay} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="loginGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => format(new Date(v + "T00:00:00"), "MMM d")}
                          className="text-xs"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          allowDecimals={false}
                          className="text-xs"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                        />
                        <Tooltip
                          labelFormatter={(v) => format(new Date(v + "T00:00:00"), "EEEE, MMM d, yyyy")}
                          formatter={(value: number) => [value, "Logins"]}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            backgroundColor: "hsl(var(--card))",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#loginGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    <p>No login data available for the last 30 days</p>
                  </div>
                )}
              </div>

              {/* Two-column layout: Top Users + Status Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Most Active Users */}
                <div className="bg-card rounded-lg border p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <h3 className="text-lg font-semibold">Most Active Users</h3>
                  </div>
                  {topUsers.length > 0 ? (
                    <div className="space-y-3">
                      {topUsers.map((user, idx) => {
                        const statusCfg = STATUS_CONFIG[user.status] || STATUS_CONFIG.offline
                        return (
                          <div key={user.email} className="flex items-center gap-3">
                            {/* Rank */}
                            <div className={cn(
                              "flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold flex-shrink-0",
                              idx === 0 ? "bg-amber-100 text-amber-700" :
                              idx === 1 ? "bg-gray-200 text-gray-700" :
                              idx === 2 ? "bg-orange-100 text-orange-700" :
                              "bg-muted text-muted-foreground"
                            )}>
                              {idx + 1}
                            </div>
                            {/* User info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{user.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                            {/* Status dot */}
                            <span className={cn("h-2 w-2 rounded-full flex-shrink-0", statusCfg.dot)} />
                            {/* Login count */}
                            <div className="text-right flex-shrink-0">
                              <span className="text-sm font-bold text-primary">{user.login_count}</span>
                              <span className="text-xs text-muted-foreground ml-1">logins</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No login data yet</p>
                  )}
                </div>

                {/* Status Distribution */}
                <div className="bg-card rounded-lg border p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    <h3 className="text-lg font-semibold">User Status Distribution</h3>
                  </div>
                  {users.length > 0 ? (
                    <>
                      <div className="h-[200px] w-full mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={Object.entries(
                              users.reduce((acc: Record<string, number>, u) => {
                                acc[u.status] = (acc[u.status] || 0) + 1
                                return acc
                              }, {})
                            ).map(([status, count]) => ({
                              status: STATUS_CONFIG[status]?.label || status,
                              count,
                              fill: status === "online" ? "#22c55e" :
                                    status === "away" ? "#f59e0b" :
                                    status === "logged_out" ? "#9ca3af" :
                                    status === "never" ? "#ef4444" : "#d1d5db"
                            }))}
                            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                              dataKey="status"
                              className="text-xs"
                              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                            />
                            <YAxis
                              allowDecimals={false}
                              className="text-xs"
                              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                            />
                            <Tooltip
                              contentStyle={{
                                borderRadius: "8px",
                                border: "1px solid hsl(var(--border))",
                                backgroundColor: "hsl(var(--card))",
                                color: "hsl(var(--foreground))",
                              }}
                            />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                              {Object.entries(
                                users.reduce((acc: Record<string, number>, u) => {
                                  acc[u.status] = (acc[u.status] || 0) + 1
                                  return acc
                                }, {})
                              ).map(([status], index) => {
                                const color = status === "online" ? "#22c55e" :
                                              status === "away" ? "#f59e0b" :
                                              status === "logged_out" ? "#9ca3af" :
                                              status === "never" ? "#ef4444" : "#d1d5db"
                                return <Cell key={`cell-${index}`} fill={color} />
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Legend */}
                      <div className="flex flex-wrap gap-3 justify-center">
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                          const count = users.filter(u => u.status === key).length
                          if (count === 0) return null
                          return (
                            <div key={key} className="flex items-center gap-1.5 text-xs">
                              <span className={cn("h-2.5 w-2.5 rounded-full", config.dot)} />
                              <span className="text-muted-foreground">{config.label}: <span className="font-semibold text-foreground">{count}</span></span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No user data yet</p>
                  )}
                </div>
              </div>

              {/* Quick Stats Summary */}
              <div className="bg-card rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-3xl font-bold text-primary">
                      {loginsPerDay.reduce((sum, d) => sum + d.count, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Total Logins (30 days)</p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">
                      {loginsPerDay.length > 0 ? Math.round(loginsPerDay.reduce((sum, d) => sum + d.count, 0) / loginsPerDay.length * 10) / 10 : 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Avg Daily Logins</p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-3xl font-bold text-amber-600">
                      {loginsPerDay.length > 0 ? Math.max(...loginsPerDay.map(d => d.count)) : 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Peak Day Logins</p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">
                      {users.filter(u => u.login_count > 0).length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Users Who Logged In</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
