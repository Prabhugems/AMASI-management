"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import {
  BarChart3,
  Activity,
  GraduationCap,
  Award,
  Users,
  Calendar,
  Download,
  Mail,
  Loader2,
} from "lucide-react"
import { getGreeting } from "@/lib/utils"
import { usePermissions } from "@/hooks/use-permissions"

// Dashboard components
import { AlertsPanel } from "@/components/dashboard/alerts-panel"
import { WhosOnlineWidget } from "@/components/dashboard/whos-online-widget"
import { EventsTable } from "@/components/dashboard/events-table"
import { StatCard } from "@/components/dashboard/stat-card"
import { RecentFacultyTable } from "@/components/dashboard/recent-faculty-table"
import { TasksWidget } from "@/components/dashboard/tasks-widget"

function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl p-6 bg-white border border-gray-200/80 dark:bg-slate-800/50 dark:border-slate-700/50 animate-pulse">
      <div className="flex items-start justify-between mb-6">
        <div className="p-3.5 rounded-xl bg-gray-200 dark:bg-slate-700 w-[52px] h-[52px]" />
        <div className="w-16 h-6 rounded-full bg-gray-200 dark:bg-slate-700" />
      </div>
      <div className="w-24 h-4 rounded bg-gray-200 dark:bg-slate-700 mb-2" />
      <div className="w-20 h-10 rounded bg-gray-200 dark:bg-slate-700 mb-4" />
      <div className="pt-4 border-t border-gray-200/80 dark:border-slate-700/50">
        <div className="w-32 h-3 rounded bg-gray-200 dark:bg-slate-700" />
      </div>
    </div>
  )
}

function WidgetSkeleton({ title }: { title: string }) {
  return (
    <div className="paper-card animate-pulse">
      <div className="p-5 border-b border-border">
        <div className="w-40 h-5 rounded bg-gray-200 dark:bg-slate-700" />
      </div>
      <div className="p-5 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-1.5">
              <div className="w-3/4 h-3 rounded bg-gray-200 dark:bg-slate-700" />
              <div className="w-1/2 h-3 rounded bg-gray-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const supabase = createClient()
  const router = useRouter()
  const { isEventScoped, eventIds, isLoading: permissionsLoading, userName } = usePermissions()

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

  // Fetch live stats immediately (don't wait for permissions)
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [membersResult, facultyResult, activeEventsResult, delegatesResult] = await Promise.all([
        supabase.from("members").select("*", { count: "exact", head: true }),
        supabase.from("faculty").select("*", { count: "exact", head: true }),
        supabase.from("events").select("*", { count: "exact", head: true }).not("status", "in", '("completed","archived")'),
        supabase.from("registrations").select("*", { count: "exact", head: true }),
      ])

      // Log any errors for debugging (only if error has message)
      if (membersResult.error?.message) console.error("Members error:", membersResult.error.message)
      if (facultyResult.error?.message) console.error("Faculty error:", facultyResult.error.message)
      if (activeEventsResult.error?.message) console.error("Active events error:", activeEventsResult.error.message)
      if (delegatesResult.error?.message) console.error("Delegates error:", delegatesResult.error.message)

      return {
        members: membersResult.count ?? 0,
        faculty: facultyResult.count ?? 0,
        activeEvents: activeEventsResult.count ?? 0,
        delegates: delegatesResult.count ?? 0,
      }
    },
  })

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
      {/* Welcome Header - Paper Dashboard Style */}
      <div className="mb-6">
        <h4 className="text-lg text-muted-foreground font-normal">
          {getGreeting()}, {userName || quickName || (permissionsLoading ? <span className="inline-block w-24 h-5 rounded bg-gray-200 dark:bg-slate-700 animate-pulse align-middle" /> : "Admin")}
        </h4>
        <p className="text-sm text-muted-foreground/70">Here&apos;s your AMASI dashboard overview</p>
      </div>

      {/* Animated Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon={Users}
              value={stats?.members || 0}
              label="Total Members"
              subtext="Live from database"
              trend={12}
              color="rose"
              delay={0}
            />
            <StatCard
              icon={GraduationCap}
              value={stats?.faculty || 0}
              label="Faculty Database"
              subtext="Master database"
              trend={8}
              color="amber"
              delay={100}
            />
            <StatCard
              icon={Calendar}
              value={stats?.activeEvents || 0}
              label="Active Events"
              subtext="Planning/Ongoing"
              trend={null}
              color="teal"
              delay={200}
            />
            <StatCard
              icon={Award}
              value={stats?.delegates || 0}
              label="Total Attendees"
              subtext="All events"
              trend={5}
              color="violet"
              delay={300}
            />
          </>
        )}
      </div>

      {/* Alerts Panel */}
      <div className="mb-6">
        <AlertsPanel />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Events Table */}
          <EventsTable />

          {/* Faculty Table */}
          <RecentFacultyTable />
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Who's Online Widget */}
          <WhosOnlineWidget />

          {/* Tasks Widget */}
          <TasksWidget />
        </div>
      </div>

      {/* Quick Actions - Paper Dashboard Style */}
      <div className="paper-card card-animated">
        <div className="p-5 border-b border-border">
          <h5 className="text-base font-semibold text-foreground mb-1">Quick Actions</h5>
          <p className="text-sm text-muted-foreground">Common tasks at your fingertips</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button className="flex flex-col items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all duration-300 group btn-press hover:-translate-y-1">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Import CSV</span>
            </button>
            <button className="flex flex-col items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all duration-300 group btn-press hover:-translate-y-1">
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center group-hover:bg-success/20 group-hover:scale-110 transition-all duration-300">
                <Mail className="h-5 w-5 text-success" />
              </div>
              <span className="text-sm font-medium text-foreground">Bulk Email</span>
            </button>
            <button className="flex flex-col items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all duration-300 group btn-press hover:-translate-y-1">
              <div className="h-12 w-12 rounded-full bg-info/10 flex items-center justify-center group-hover:bg-info/20 group-hover:scale-110 transition-all duration-300">
                <BarChart3 className="h-5 w-5 text-info" />
              </div>
              <span className="text-sm font-medium text-foreground">Reports</span>
            </button>
            <button className="flex flex-col items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all duration-300 group btn-press hover:-translate-y-1">
              <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center group-hover:bg-warning/20 group-hover:scale-110 transition-all duration-300">
                <Award className="h-5 w-5 text-warning" />
              </div>
              <span className="text-sm font-medium text-foreground">Certificates</span>
            </button>
          </div>
        </div>
        <div className="card-stats-footer px-5 pb-4">
          <Activity className="h-4 w-4 inline-block mr-1 text-muted-foreground" />
          <span>Last activity 2 min ago</span>
        </div>
      </div>
    </DashboardLayout>
  )
}
