"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Users,
  Mail,
  MailOpen,
  Eye,
  EyeOff,
  Bell,
  Activity,
  AlertOctagon,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  BarChart3,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ReviewerActivity = {
  last_login_at: string | null
  total_emails_sent: number
  total_emails_opened: number
  decline_count: number
  assignments_total: number
  assignments_opened: number
  assignments_viewed: number
  assignments_pending: number
  assignments_completed: number
  assignments_declined: number
  last_viewed_at: string | null
  reminders_sent: number
  activity_status: string
}

type Reviewer = {
  id: string
  name: string
  email: string
  status: string
  review_count: number
  assigned_abstracts: string[]
  activity: ReviewerActivity | null
}

export default function ReviewerTrackingPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const { data: reviewers = [], isLoading } = useQuery({
    queryKey: ["abstract-reviewers", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch reviewers")
      return res.json() as Promise<Reviewer[]>
    },
  })

  // Calculate stats
  const stats = useMemo(() => {
    const total = reviewers.length
    const activeReviewers = reviewers.filter(r => r.status === "active").length

    let emailsOpened = 0
    let emailsNotOpened = 0
    let abstractsViewed = 0
    let abstractsNotViewed = 0
    let totalReminders = 0
    let totalDeclined = 0
    let activeToday = 0
    let activeRecently = 0
    let inactiveWeek = 0
    let inactiveLong = 0
    let neverActive = 0

    reviewers.forEach(r => {
      if (r.activity) {
        emailsOpened += r.activity.assignments_opened
        emailsNotOpened += (r.activity.assignments_total - r.activity.assignments_opened)
        abstractsViewed += r.activity.assignments_viewed
        abstractsNotViewed += (r.activity.assignments_total - r.activity.assignments_viewed)
        totalReminders += r.activity.reminders_sent
        totalDeclined += r.activity.assignments_declined

        switch (r.activity.activity_status) {
          case "active_today": activeToday++; break
          case "active_recently": activeRecently++; break
          case "inactive_week": inactiveWeek++; break
          case "inactive_long": inactiveLong++; break
          case "never_active": neverActive++; break
        }
      }
    })

    return {
      total,
      activeReviewers,
      emailsOpened,
      emailsNotOpened,
      abstractsViewed,
      abstractsNotViewed,
      totalReminders,
      totalDeclined,
      activeToday,
      activeRecently,
      inactiveWeek,
      inactiveLong,
      neverActive,
    }
  }, [reviewers])

  // Categorize reviewers by activity
  const categorizedReviewers = useMemo(() => {
    const neverOpened = reviewers.filter(r =>
      r.activity && r.activity.assignments_total > 0 && r.activity.assignments_opened === 0
    )
    const openedNotViewed = reviewers.filter(r =>
      r.activity && r.activity.assignments_opened > 0 && r.activity.assignments_viewed === 0
    )
    const needsReminder = reviewers.filter(r =>
      r.activity && r.activity.reminders_sent > 0 && r.activity.assignments_pending > 0
    )
    const declined = reviewers.filter(r =>
      r.activity && r.activity.assignments_declined > 0
    )
    const completed = reviewers.filter(r =>
      r.activity && r.activity.assignments_completed > 0 && r.activity.assignments_pending === 0
    )

    return { neverOpened, openedNotViewed, needsReminder, declined, completed }
  }, [reviewers])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never"
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading tracking data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <BarChart3 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Reviewer Tracking
            <Sparkles className="h-5 w-5 text-yellow-500" />
          </h1>
          <p className="text-sm text-muted-foreground">Monitor reviewer activity and engagement</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <MailOpen className="h-5 w-5 text-emerald-600" />
            <span className="text-sm text-muted-foreground">Emails Opened</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{stats.emailsOpened}</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-5 w-5 text-red-500" />
            <span className="text-sm text-muted-foreground">Not Opened</span>
          </div>
          <p className="text-3xl font-bold text-red-500">{stats.emailsNotOpened}</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-muted-foreground">Viewed</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats.abstractsViewed}</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-muted-foreground">Reminders Sent</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{stats.totalReminders}</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertOctagon className="h-5 w-5 text-purple-600" />
            <span className="text-sm text-muted-foreground">Declined</span>
          </div>
          <p className="text-3xl font-bold text-purple-600">{stats.totalDeclined}</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-gray-500/10 to-slate-500/10 border border-gray-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-gray-600" />
            <span className="text-sm text-muted-foreground">Total Reviewers</span>
          </div>
          <p className="text-3xl font-bold text-gray-600">{stats.total}</p>
        </div>
      </div>

      {/* Activity Status Distribution */}
      <div className="rounded-2xl border p-5 bg-gradient-to-r from-background to-muted/30">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Activity Distribution
        </h2>
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="font-medium">{stats.activeToday}</span>
            <span className="text-sm">Active Today</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 text-blue-700">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="font-medium">{stats.activeRecently}</span>
            <span className="text-sm">Last 3 Days</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 text-amber-700">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="font-medium">{stats.inactiveWeek}</span>
            <span className="text-sm">3-7 Days</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-100 text-red-700">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="font-medium">{stats.inactiveLong}</span>
            <span className="text-sm">7+ Days</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-700">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <span className="font-medium">{stats.neverActive}</span>
            <span className="text-sm">Never Active</span>
          </div>
        </div>
      </div>

      {/* Problem Areas */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Never Opened Email */}
        <div className="rounded-2xl border p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Never Opened Email ({categorizedReviewers.neverOpened.length})
          </h2>
          {categorizedReviewers.neverOpened.length === 0 ? (
            <p className="text-sm text-muted-foreground">All reviewers have opened their emails</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {categorizedReviewers.neverOpened.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-100">
                  <div>
                    <p className="font-medium text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-red-600">{r.activity?.assignments_total || 0} assigned</p>
                    <p className="text-xs text-muted-foreground">{r.activity?.reminders_sent || 0} reminders</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Opened but Not Viewed */}
        <div className="rounded-2xl border p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-amber-600">
            <EyeOff className="h-5 w-5" />
            Opened but Not Viewed ({categorizedReviewers.openedNotViewed.length})
          </h2>
          {categorizedReviewers.openedNotViewed.length === 0 ? (
            <p className="text-sm text-muted-foreground">All who opened have viewed abstracts</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {categorizedReviewers.openedNotViewed.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <div>
                    <p className="font-medium text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-amber-600">{r.activity?.assignments_opened || 0} opened</p>
                    <p className="text-xs text-muted-foreground">0 viewed</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Declined */}
        <div className="rounded-2xl border p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-purple-600">
            <AlertOctagon className="h-5 w-5" />
            Declined Assignments ({categorizedReviewers.declined.length})
          </h2>
          {categorizedReviewers.declined.length === 0 ? (
            <p className="text-sm text-muted-foreground">No declined assignments</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {categorizedReviewers.declined.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-purple-50 border border-purple-100">
                  <div>
                    <p className="font-medium text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-purple-600">{r.activity?.assignments_declined || 0} declined</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed All */}
        <div className="rounded-2xl border p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            Completed All Reviews ({categorizedReviewers.completed.length})
          </h2>
          {categorizedReviewers.completed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviewers have completed all assigned reviews</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {categorizedReviewers.completed.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div>
                    <p className="font-medium text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-emerald-600">{r.activity?.assignments_completed || 0} completed</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All Reviewers Table */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h2 className="font-semibold">All Reviewers Activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Reviewer</th>
                <th className="text-center p-3 font-medium">Assigned</th>
                <th className="text-center p-3 font-medium">Opened</th>
                <th className="text-center p-3 font-medium">Viewed</th>
                <th className="text-center p-3 font-medium">Completed</th>
                <th className="text-center p-3 font-medium">Declined</th>
                <th className="text-center p-3 font-medium">Reminders</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-center p-3 font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reviewers.map(r => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="p-3">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </td>
                  <td className="text-center p-3">{r.activity?.assignments_total || 0}</td>
                  <td className="text-center p-3">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                      (r.activity?.assignments_opened || 0) > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {r.activity?.assignments_opened || 0}
                    </span>
                  </td>
                  <td className="text-center p-3">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                      (r.activity?.assignments_viewed || 0) > 0 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {r.activity?.assignments_viewed || 0}
                    </span>
                  </td>
                  <td className="text-center p-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      {r.activity?.assignments_completed || 0}
                    </span>
                  </td>
                  <td className="text-center p-3">
                    {(r.activity?.assignments_declined || 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        {r.activity?.assignments_declined}
                      </span>
                    )}
                  </td>
                  <td className="text-center p-3">
                    {(r.activity?.reminders_sent || 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        {r.activity?.reminders_sent}
                      </span>
                    )}
                  </td>
                  <td className="text-center p-3">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                      r.activity?.activity_status === "active_today" && "bg-emerald-100 text-emerald-700",
                      r.activity?.activity_status === "active_recently" && "bg-blue-100 text-blue-700",
                      r.activity?.activity_status === "inactive_week" && "bg-amber-100 text-amber-700",
                      r.activity?.activity_status === "inactive_long" && "bg-red-100 text-red-700",
                      r.activity?.activity_status === "never_active" && "bg-gray-100 text-gray-500"
                    )}>
                      {r.activity?.activity_status === "active_today" && "Today"}
                      {r.activity?.activity_status === "active_recently" && "Recent"}
                      {r.activity?.activity_status === "inactive_week" && "3-7d"}
                      {r.activity?.activity_status === "inactive_long" && "7d+"}
                      {r.activity?.activity_status === "never_active" && "Never"}
                      {!r.activity?.activity_status && "Unknown"}
                    </span>
                  </td>
                  <td className="text-center p-3 text-xs text-muted-foreground">
                    {formatDate(r.activity?.last_viewed_at || null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
