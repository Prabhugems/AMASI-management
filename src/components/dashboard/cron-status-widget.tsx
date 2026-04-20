"use client"

import { useQuery } from "@tanstack/react-query"
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

type CronRunRow = {
  id: number
  job: string
  started_at: string
  finished_at: string | null
  status: "running" | "success" | "error"
  synced_count: number | null
  error: string | null
}

type CronJobSummary = {
  job: string
  latest: CronRunRow | null
  success: number
  error: number
  running: number
}

export function CronStatusWidget() {
  const { data, isLoading } = useQuery<{ jobs: CronJobSummary[] }>({
    queryKey: ["cron-runs"],
    queryFn: async () => {
      const res = await fetch("/api/cron-runs")
      if (!res.ok) throw new Error("Failed to fetch cron runs")
      return res.json()
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Cron Jobs</h3>
        </div>
        <span className="text-xs text-muted-foreground">last 7 days</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.jobs?.length ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No cron runs recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {data.jobs.map((j) => {
            const latest = j.latest
            const isError = latest?.status === "error"
            const isRunning = latest?.status === "running"
            const Icon = isError ? XCircle : isRunning ? Loader2 : CheckCircle2
            const iconColor = isError
              ? "text-red-500"
              : isRunning
              ? "text-amber-500 animate-spin"
              : "text-emerald-500"

            return (
              <div key={j.job} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
                  <span className="font-mono truncate">{j.job}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  {latest?.synced_count != null && (
                    <span className="tabular-nums">{latest.synced_count} synced</span>
                  )}
                  {latest?.started_at && (
                    <span>{formatDistanceToNow(new Date(latest.started_at), { addSuffix: true })}</span>
                  )}
                  <span className="tabular-nums">
                    <span className="text-emerald-600">{j.success}✓</span>
                    {j.error > 0 && <span className="text-red-500 ml-1">{j.error}✗</span>}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
