"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Target,
  Zap,
  ArrowRight,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { LEAD_STATUSES, LEAD_SOURCES } from "./leads-types"

interface AnalyticsData {
  byStatus: Record<string, number>
  bySource: Record<string, number>
  byDay: { date: string; count: number }[]
  conversionRate: number
  total: number
}

export default function LeadsAnalytics({ eventId }: { eventId: string }) {
  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["event-leads-analytics", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/leads/analytics`)
      if (!res.ok) throw new Error("Failed to fetch analytics")
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-card rounded-xl border p-8 text-center">
        <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Failed to load analytics data.</p>
      </div>
    )
  }

  const { byStatus, bySource, byDay, conversionRate, total } = data

  // Calculate leads this week from byDay
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const leadsThisWeek = byDay
    .filter((d) => new Date(d.date) >= weekAgo)
    .reduce((sum, d) => sum + d.count, 0)

  // Most active source
  const sortedSources = Object.entries(bySource).sort(([, a], [, b]) => b - a)
  const topSource = sortedSources[0]
  const topSourceLabel =
    LEAD_SOURCES.find((s) => s.value === topSource?.[0])?.label ||
    topSource?.[0] ||
    "N/A"

  // Lead velocity: last 7 days avg vs previous 7 days avg
  const twoWeeksAgo = new Date(now)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const last7 = byDay
    .filter((d) => new Date(d.date) >= weekAgo)
    .reduce((sum, d) => sum + d.count, 0)
  const prev7 = byDay
    .filter((d) => {
      const date = new Date(d.date)
      return date >= twoWeeksAgo && date < weekAgo
    })
    .reduce((sum, d) => sum + d.count, 0)
  const last7Avg = last7 / 7
  const prev7Avg = prev7 / 7
  const velocityChange =
    prev7Avg > 0 ? ((last7Avg - prev7Avg) / prev7Avg) * 100 : last7Avg > 0 ? 100 : 0

  // Funnel stages (excluding unsubscribed)
  const funnelStatuses = LEAD_STATUSES.filter(
    (s) => s.value !== "unsubscribed"
  )
  const funnelCounts = funnelStatuses.map((s) => ({
    ...s,
    count: byStatus[s.value] || 0,
  }))

  // Max source count for bar width calculation
  const maxSourceCount = sortedSources.length > 0 ? sortedSources[0][1] : 1

  // Daily trend chart
  const maxDayCount = Math.max(...byDay.map((d) => d.count), 1)

  return (
    <div className="space-y-6">
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Users className="w-5 h-5" />}
          label="Total Leads"
          value={total.toLocaleString()}
          iconBg="bg-blue-50 dark:bg-blue-950/50"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <SummaryCard
          icon={<Target className="w-5 h-5" />}
          label="Conversion Rate"
          value={`${conversionRate.toFixed(1)}%`}
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          iconColor="text-emerald-600 dark:text-emerald-400"
          extra={
            <Badge
              variant={
                conversionRate > 20
                  ? "success"
                  : conversionRate > 10
                    ? "warning"
                    : "destructive"
              }
              className="text-[10px] ml-2"
            >
              {conversionRate > 20
                ? "Strong"
                : conversionRate > 10
                  ? "Average"
                  : "Low"}
            </Badge>
          }
        />
        <SummaryCard
          icon={<Zap className="w-5 h-5" />}
          label="Top Source"
          value={topSourceLabel}
          subtitle={topSource ? `${topSource[1]} leads` : undefined}
          iconBg="bg-purple-50 dark:bg-purple-950/50"
          iconColor="text-purple-600 dark:text-purple-400"
        />
        <SummaryCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Leads This Week"
          value={leadsThisWeek.toLocaleString()}
          iconBg="bg-amber-50 dark:bg-amber-950/50"
          iconColor="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* 2-column layout for funnel + sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. Conversion Funnel */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            Conversion Funnel
          </h3>
          <div className="space-y-3">
            {funnelCounts.map((stage, i) => {
              const pct = total > 0 ? (stage.count / total) * 100 : 0
              // Funnel width decreases per stage: 100%, 80%, 60%, 40%
              const widthPercent = Math.max(
                ((funnelStatuses.length - i) / funnelStatuses.length) * 100,
                20
              )
              // Drop-off from previous stage
              const prevCount = i > 0 ? funnelCounts[i - 1].count : total
              const dropOff =
                i > 0 && prevCount > 0
                  ? (((prevCount - stage.count) / prevCount) * 100).toFixed(0)
                  : null

              return (
                <div key={stage.value}>
                  {dropOff !== null && (
                    <div className="flex items-center gap-2 pl-4 py-1">
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">
                        {dropOff}% drop-off
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div
                      className="relative overflow-hidden rounded-lg h-10 transition-all"
                      style={{ width: `${widthPercent}%` }}
                    >
                      <div
                        className={`absolute inset-0 ${stage.bgColor} rounded-lg`}
                      />
                      <div className="relative flex items-center justify-between h-full px-3">
                        <span
                          className={`text-xs font-medium ${stage.color}`}
                        >
                          {stage.label}
                        </span>
                        <span
                          className={`text-xs font-semibold ${stage.color}`}
                        >
                          {stage.count}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. Leads by Source */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            Leads by Source
          </h3>
          {sortedSources.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No source data available.
            </p>
          ) : (
            <div className="space-y-2.5">
              {sortedSources.map(([source, count], i) => {
                const pct = total > 0 ? (count / total) * 100 : 0
                const barWidth = (count / maxSourceCount) * 100
                const label =
                  LEAD_SOURCES.find((s) => s.value === source)?.label || source

                return (
                  <div
                    key={source}
                    className={`rounded-lg px-3 py-2 ${i % 2 === 0 ? "bg-muted/40" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground">
                        {label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {count}{" "}
                        <span className="text-muted-foreground/60">
                          ({pct.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Daily Trend (Last 30 Days) */}
      <div className="bg-card rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          Daily Trend (Last 30 Days)
        </h3>
        {byDay.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No daily data available yet.
          </p>
        ) : (
          <div className="flex items-end gap-[3px] h-40">
            {byDay.map((day, i) => {
              const heightPct =
                day.count > 0 ? (day.count / maxDayCount) * 100 : 2
              const dateObj = new Date(day.date)
              const showLabel = i % 5 === 0 || i === byDay.length - 1

              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
                >
                  <div
                    className={`w-full rounded-t transition-colors ${
                      day.count > 0
                        ? "bg-primary hover:bg-primary/80"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                    style={{ height: `${heightPct}%`, minHeight: "2px" }}
                    title={`${dateObj.toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}: ${day.count} lead${day.count !== 1 ? "s" : ""}`}
                  />
                  {showLabel && (
                    <span className="text-[9px] text-muted-foreground mt-1.5 whitespace-nowrap">
                      {dateObj.toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 5. Lead Velocity */}
      <div className="bg-card rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-muted-foreground" />
          Lead Velocity
        </h3>
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Last 7 days (avg/day)
            </p>
            <p className="text-2xl font-bold text-foreground">
              {last7Avg.toFixed(1)}
            </p>
          </div>
          <div className="text-muted-foreground/40 text-2xl font-light">
            vs
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Previous 7 days (avg/day)
            </p>
            <p className="text-2xl font-bold text-foreground">
              {prev7Avg.toFixed(1)}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {velocityChange > 0 ? (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm font-semibold">
                  +{velocityChange.toFixed(0)}%
                </span>
              </div>
            ) : velocityChange < 0 ? (
              <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <TrendingDown className="w-5 h-5" />
                <span className="text-sm font-semibold">
                  {velocityChange.toFixed(0)}%
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Minus className="w-5 h-5" />
                <span className="text-sm font-semibold">No change</span>
              </div>
            )}
            <Badge
              variant={
                velocityChange > 0
                  ? "success"
                  : velocityChange < 0
                    ? "destructive"
                    : "muted"
              }
              className="text-[10px]"
            >
              {velocityChange > 0
                ? "Improving"
                : velocityChange < 0
                  ? "Declining"
                  : "Steady"}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  subtitle,
  iconBg,
  iconColor,
  extra,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtitle?: string
  iconBg: string
  iconColor: string
  extra?: React.ReactNode
}) {
  return (
    <div className="bg-card rounded-xl border p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <div className={iconColor}>{icon}</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="flex items-center">
        <p className="text-xl font-bold text-foreground">{value}</p>
        {extra}
      </div>
      {subtitle && (
        <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}
