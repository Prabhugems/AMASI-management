"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import {
  BarChart3,
  GraduationCap,
  Award,
  Users,
  Calendar,
  Download,
  Mail,
  Loader2,
  Clock,
  RefreshCw,
} from "lucide-react"
import { getGreeting } from "@/lib/utils"
import { usePermissions } from "@/hooks/use-permissions"
import { COMPANY_CONFIG, FEATURES } from "@/lib/config"

// Dashboard components
import { WhosOnlineWidget } from "@/components/dashboard/whos-online-widget"
import { EventsTable } from "@/components/dashboard/events-table"
import { MetricCard, MetricPanel } from "@/components/dashboard/metric-card"
import { RecentFacultyTable } from "@/components/dashboard/recent-faculty-table"
import { HealthWidget } from "@/components/dashboard/health-widget"
import { TeamWidget } from "@/components/dashboard/team-widget"
import { CronStatusWidget } from "@/components/dashboard/cron-status-widget"

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl p-4 sm:p-5 bg-card border border-border animate-pulse">
      <div className="flex items-start justify-between mb-4 sm:mb-5">
        <div className="p-2.5 rounded-lg bg-muted w-10 h-10" />
      </div>
      <div className="w-20 h-3 rounded bg-muted mb-2" />
      <div className="w-24 h-8 rounded bg-muted mb-2" />
      <div className="w-28 h-3 rounded bg-muted/60 mt-3" />
    </div>
  )
}

function LastUpdatedBadge({ lastUpdated, onRefresh }: { lastUpdated: Date | null; onRefresh: () => void }) {
  const [timeAgo, setTimeAgo] = useState("")

  useEffect(() => {
    if (!lastUpdated) return

    const update = () => {
      const now = new Date()
      const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000)
      if (diff < 10) setTimeAgo("Just now")
      else if (diff < 60) setTimeAgo(`${diff}s ago`)
      else if (diff < 3600) setTimeAgo(`${Math.floor(diff / 60)}m ago`)
      else setTimeAgo(`${Math.floor(diff / 3600)}h ago`)
    }

    update()
    const interval = setInterval(update, 10000)
    return () => clearInterval(interval)
  }, [lastUpdated])

  return (
    <div className="flex items-center gap-2 text-[11px] text-gray-400">
      <Clock className="h-3 w-3" />
      <span>{timeAgo || "..."}</span>
      <button
        onClick={onRefresh}
        className="p-1 rounded-md hover:bg-muted transition-colors"
        title="Refresh dashboard"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    </div>
  )
}

export default function Home() {
  const supabase = createClient()
  const router = useRouter()
  const { isEventScoped, eventIds, isLoading: permissionsLoading, userName } = usePermissions()
  const [pageReady, setPageReady] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Page transition
  useEffect(() => {
    const timer = setTimeout(() => setPageReady(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Get session info immediately for quick display while permissions load
  const { data: sessionData } = useQuery({
    queryKey: ["session-info"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      return session
    },
    staleTime: 5 * 60 * 1000,
  })
  const quickName = sessionData?.user?.user_metadata?.name || sessionData?.user?.email?.split("@")[0] || ""

  // Helper: compute 7-day trend from rows with created_at
  function computeWeeklyTrend(rows: { created_at: string }[]): number[] {
    const now = new Date()
    const counts = Array(7).fill(0)
    for (const row of rows) {
      const d = new Date(row.created_at)
      const daysAgo = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
      if (daysAgo >= 0 && daysAgo < 7) {
        counts[6 - daysAgo]++
      }
    }
    return counts
  }

  // Fetch live stats immediately (don't wait for permissions)
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [membersResult, facultyResult, activeEventsResult, delegatesResult, recentMembers, recentFaculty, recentDelegates] = await Promise.all([
        supabase.from("members").select("*", { count: "exact", head: true }),
        supabase.from("faculty").select("*", { count: "exact", head: true }),
        supabase.from("events").select("*", { count: "exact", head: true }).not("status", "in", '("completed","archived")'),
        supabase.from("registrations").select("*", { count: "exact", head: true }),
        // Fetch recent records for sparkline trends
        supabase.from("members").select("created_at").gte("created_at", sevenDaysAgo),
        supabase.from("faculty").select("created_at").gte("created_at", sevenDaysAgo),
        supabase.from("registrations").select("created_at").gte("created_at", sevenDaysAgo),
      ])

      // Log any errors for debugging (only if error has message)
      if (membersResult.error?.message) console.error("Members error:", membersResult.error.message)
      if (facultyResult.error?.message) console.error("Faculty error:", facultyResult.error.message)
      if (activeEventsResult.error?.message) console.error("Active events error:", activeEventsResult.error.message)
      if (delegatesResult.error?.message) console.error("Delegates error:", delegatesResult.error.message)

      setLastUpdated(new Date())
      return {
        members: membersResult.count ?? 0,
        faculty: facultyResult.count ?? 0,
        activeEvents: activeEventsResult.count ?? 0,
        delegates: delegatesResult.count ?? 0,
        membersTrend: computeWeeklyTrend((recentMembers.data as any[]) || []),
        facultyTrend: computeWeeklyTrend((recentFaculty.data as any[]) || []),
        delegatesTrend: computeWeeklyTrend((recentDelegates.data as any[]) || []),
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const handleRefresh = () => {
    refetchStats()
  }

  // Redirect event-scoped users to their event dashboard
  useEffect(() => {
    if (!permissionsLoading && isEventScoped && eventIds.length > 0) {
      // Redirect to the first event they have access to
      router.replace(`/events/${eventIds[0]}`)
    }
  }, [isEventScoped, eventIds, permissionsLoading, router])

  // Log stats error if any
  if (statsError) console.error("Stats query error:", statsError)

  // Only block render for event-scoped redirect (brief)
  if (!permissionsLoading && isEventScoped && eventIds.length > 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Redirecting to your event...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className={`transition-all duration-500 ease-out max-w-full overflow-x-hidden ${pageReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
      {/* Welcome Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {getGreeting()}, {userName || quickName || (permissionsLoading ? <span className="inline-block w-20 h-6 rounded bg-muted animate-pulse align-middle" /> : "Admin")}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Here&apos;s your {COMPANY_CONFIG.name} dashboard overview</p>
          </div>
          <LastUpdatedBadge lastUpdated={lastUpdated} onRefresh={handleRefresh} />
        </div>
      </div>

      {/* Animated Stats Cards — metallic mint + champagne */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-6">
          {[0, 1, 2, 3].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <MetricPanel className="mb-6">
          {FEATURES.membership && (
            <MetricCard icon={<Users className="w-5 h-5" />} label="Total Members" value={stats?.members || 0} tone="mint" href="/members" />
          )}
          {FEATURES.faculty && (
            <MetricCard icon={<GraduationCap className="w-5 h-5" />} label="Faculty Database" value={stats?.faculty || 0} tone="mint" href="/faculty" />
          )}
          <MetricCard icon={<Calendar className="w-5 h-5" />} label="Active Events" value={stats?.activeEvents || 0} tone="gold" href="/events" />
          <MetricCard icon={<Award className="w-5 h-5" />} label="Total Attendees" value={stats?.delegates || 0} tone="gold" href="/attendees" />
        </MetricPanel>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full mb-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 min-w-0 space-y-6">
          {/* Events Table */}
          <EventsTable />

          {/* Faculty Table */}
          {FEATURES.faculty && <RecentFacultyTable />}
        </div>

        {/* Right Column - 1/3 width */}
        <div className="lg:col-span-1 min-w-0 space-y-6">
          {/* System Health Widget */}
          <HealthWidget />

          {/* Cron Jobs Widget */}
          <CronStatusWidget />

          {/* Team Widget */}
          <TeamWidget />

          {/* Who's Online Widget */}
          <WhosOnlineWidget />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border">
          <h5 className="text-sm font-bold text-foreground">Quick Actions</h5>
          <p className="text-xs text-gray-400 mt-0.5">Common tasks at your fingertips</p>
        </div>
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/faculty" className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-secondary hover:bg-accent transition-colors group">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-cyan-100 transition-colors">
                <Download className="h-4 w-4 text-muted-foreground group-hover:text-cyan-600 transition-colors" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Import CSV</span>
            </Link>
            <Link href="/events" className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-secondary hover:bg-accent transition-colors group">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-cyan-100 transition-colors">
                <Mail className="h-4 w-4 text-muted-foreground group-hover:text-cyan-600 transition-colors" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Bulk Email</span>
            </Link>
            <Link href="/events" className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-secondary hover:bg-accent transition-colors group">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-cyan-100 transition-colors">
                <BarChart3 className="h-4 w-4 text-muted-foreground group-hover:text-cyan-600 transition-colors" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Reports</span>
            </Link>
            <Link href="/events" className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-secondary hover:bg-accent transition-colors group">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-cyan-100 transition-colors">
                <Award className="h-4 w-4 text-muted-foreground group-hover:text-cyan-600 transition-colors" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Certificates</span>
            </Link>
          </div>
        </div>
      </div>
      </div>
    </DashboardLayout>
  )
}
