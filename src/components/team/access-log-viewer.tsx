"use client"

import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import {
  Plane, Hotel, Car, Train, Users, Calendar, CheckCircle,
  Award, FileText, ClipboardList, BookOpen, Eye, Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

const MODULE_META: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  flights:       { icon: Plane, color: "text-sky-500", label: "Flights" },
  hotels:        { icon: Hotel, color: "text-amber-500", label: "Hotels" },
  transfers:     { icon: Car, color: "text-emerald-500", label: "Transfers" },
  trains:        { icon: Train, color: "text-orange-500", label: "Trains" },
  speakers:      { icon: Users, color: "text-cyan-500", label: "Speakers" },
  program:       { icon: Calendar, color: "text-indigo-500", label: "Program" },
  checkin:       { icon: CheckCircle, color: "text-green-500", label: "Check-in" },
  badges:        { icon: Award, color: "text-pink-500", label: "Badges" },
  certificates:  { icon: FileText, color: "text-violet-500", label: "Certificates" },
  registrations: { icon: ClipboardList, color: "text-teal-500", label: "Registrations" },
  abstracts:     { icon: BookOpen, color: "text-orange-500", label: "Abstracts" },
}

const ALL_MODULES = Object.keys(MODULE_META)

interface AccessLog {
  id: string
  module: string
  path: string | null
  created_at: string
}

interface AccessLogResponse {
  logs: AccessLog[]
  total: number
  summary: {
    total_accesses: number
    unique_users: number
    top_modules: { module: string; count: number }[]
  }
}

export function AccessLogViewer({ memberId, memberEmail }: { memberId: string; memberEmail: string }) {
  const { data, isLoading, error } = useQuery<AccessLogResponse>({
    queryKey: ["access-logs", memberId],
    queryFn: async () => {
      const res = await fetch(`/api/team/access-log?user_email=${encodeURIComponent(memberEmail)}&limit=20`)
      if (!res.ok) {
        if (res.status === 403) return { logs: [], total: 0, summary: { total_accesses: 0, unique_users: 0, top_modules: [] } }
        throw new Error("Failed to fetch")
      }
      return res.json()
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error || !data) {
    return <p className="text-xs text-muted-foreground">Unable to load access logs.</p>
  }

  const accessedModules = new Set(data.summary.top_modules.map(m => m.module))
  const neverAccessed = ALL_MODULES.filter(m => !accessedModules.has(m))

  // Build module summary map
  const moduleSummary = new Map<string, { count: number; lastAccess: string }>()
  for (const log of data.logs) {
    if (!moduleSummary.has(log.module)) {
      moduleSummary.set(log.module, { count: 0, lastAccess: log.created_at })
    }
  }
  for (const tm of data.summary.top_modules) {
    const existing = moduleSummary.get(tm.module)
    if (existing) existing.count = tm.count
    else moduleSummary.set(tm.module, { count: tm.count, lastAccess: "" })
  }

  const hasAnyData = data.logs.length > 0 || data.summary.top_modules.length > 0

  if (!hasAnyData) {
    return (
      <div className="rounded-xl bg-slate-50 p-4 text-center">
        <Eye className="h-5 w-5 mx-auto text-muted-foreground mb-1.5" />
        <p className="text-sm text-muted-foreground">No module access recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Module access summary cards */}
      {moduleSummary.size > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from(moduleSummary.entries()).map(([mod, info]) => {
            const meta = MODULE_META[mod]
            if (!meta) return null
            const Icon = meta.icon
            return (
              <div key={mod} className="rounded-xl bg-slate-50 p-2.5 text-center">
                <Icon className={cn("h-3.5 w-3.5 mx-auto mb-1", meta.color)} />
                <p className="text-xs font-medium">{meta.label}</p>
                <p className="text-[10px] text-muted-foreground">{info.count} view{info.count !== 1 ? "s" : ""}</p>
                {info.lastAccess && (
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(info.lastAccess), { addSuffix: true })}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Recent access timeline */}
      {data.logs.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Activity</p>
          <div className="space-y-1">
            {data.logs.map(log => {
              const meta = MODULE_META[log.module] || { icon: Eye, color: "text-slate-500", label: log.module }
              const Icon = meta.icon
              return (
                <div key={log.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.color)} />
                  <span className="text-xs font-medium truncate">{meta.label}</span>
                  {log.path && <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">{log.path}</span>}
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Never accessed modules */}
      {neverAccessed.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Never Accessed</p>
          <div className="flex flex-wrap gap-1.5">
            {neverAccessed.map(mod => {
              const meta = MODULE_META[mod]
              if (!meta) return null
              const Icon = meta.icon
              return (
                <div key={mod} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                  <Icon className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] text-slate-400">{meta.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
