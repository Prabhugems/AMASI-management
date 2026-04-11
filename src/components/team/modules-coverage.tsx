"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { PERMISSION_CATEGORIES } from "@/lib/team-constants"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Check, X, AlertTriangle, ExternalLink } from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TeamMember = {
  id: string
  permissions?: string[]
  is_active: boolean
}

type ModulesCoverageProps = {
  members: TeamMember[]
  eventId?: string
}

type CoverageStatus = "covered" | "at_risk" | "uncovered"

type ModuleCoverage = {
  value: string
  label: string
  status: CoverageStatus
  memberCount: number
}

type CategoryCoverage = {
  key: string
  label: string
  color: string
  bg: string
  bgLight: string
  modules: ModuleCoverage[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModulesCoverage({ members, eventId }: ModulesCoverageProps) {
  const coverage = useMemo(() => {
    const activeMembers = members.filter(m => m.is_active)

    // Count how many active members cover each module
    const moduleCounts = new Map<string, number>()

    for (const member of activeMembers) {
      const perms = Array.isArray(member.permissions) ? member.permissions : []
      const hasFullAccess = perms.length === 0

      if (hasFullAccess) {
        // Full access covers all modules
        for (const cat of PERMISSION_CATEGORIES) {
          for (const perm of cat.permissions) {
            moduleCounts.set(perm.value, (moduleCounts.get(perm.value) || 0) + 1)
          }
        }
      } else {
        for (const p of perms) {
          moduleCounts.set(p, (moduleCounts.get(p) || 0) + 1)
        }
      }
    }

    // Build category coverage
    const categories: CategoryCoverage[] = PERMISSION_CATEGORIES.map(cat => ({
      key: cat.key,
      label: cat.label,
      color: cat.color,
      bg: cat.bg,
      bgLight: cat.bgLight,
      modules: cat.permissions.map(perm => {
        const count = moduleCounts.get(perm.value) || 0
        let status: CoverageStatus = "uncovered"
        if (count >= 2) status = "covered"
        else if (count === 1) status = "at_risk"
        return { value: perm.value, label: perm.label, status, memberCount: count }
      }),
    }))

    // Summary
    const allModules = categories.flatMap(c => c.modules)
    const covered = allModules.filter(m => m.status === "covered").length
    const atRisk = allModules.filter(m => m.status === "at_risk").length
    const uncovered = allModules.filter(m => m.status === "uncovered").length
    const total = allModules.length

    return { categories, covered, atRisk, uncovered, total }
  }, [members])

  const handleOpenHandoverPack = () => {
    if (eventId) {
      window.open(`/api/events/${eventId}/team/handover-pack`, "_blank")
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Module Coverage</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="font-medium text-foreground">{coverage.covered}/{coverage.total}</span> modules covered
            {coverage.atRisk > 0 && <> · <span className="text-amber-600 font-medium">{coverage.atRisk} at risk</span></>}
            {coverage.uncovered > 0 && <> · <span className="text-red-600 font-medium">{coverage.uncovered} uncovered</span></>}
            {coverage.uncovered === 0 && coverage.atRisk === 0 && <> · <span className="text-green-600 font-medium">Fully covered</span></>}
          </p>
        </div>
        {eventId && (
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={handleOpenHandoverPack}>
            <ExternalLink className="h-3 w-3" />
            Gap Report
          </Button>
        )}
      </div>

      {/* Categories */}
      <TooltipProvider delayDuration={200}>
        <div className="space-y-2.5">
          {coverage.categories.map(cat => (
            <div key={cat.key} className="flex items-start gap-3">
              {/* Category label */}
              <div className="w-28 flex-shrink-0 pt-0.5">
                <p className="text-[11px] font-medium text-muted-foreground truncate">{cat.label}</p>
              </div>

              {/* Module pills */}
              <div className="flex flex-wrap gap-1.5">
                {cat.modules.map(mod => (
                  <Tooltip key={mod.value}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border cursor-default transition-colors",
                          mod.status === "covered" && "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
                          mod.status === "at_risk" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
                          mod.status === "uncovered" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
                        )}
                      >
                        {mod.status === "covered" && <Check className="h-3 w-3" />}
                        {mod.status === "at_risk" && <AlertTriangle className="h-3 w-3" />}
                        {mod.status === "uncovered" && <X className="h-3 w-3" />}
                        {mod.label}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {mod.status === "covered" && <>{mod.memberCount} members cover this module</>}
                      {mod.status === "at_risk" && <>Only 1 member — single point of failure</>}
                      {mod.status === "uncovered" && <>No active member covers this module</>}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </TooltipProvider>

      {/* Coverage progress bar */}
      <div className="mt-3 pt-3 border-t">
        <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          {coverage.covered > 0 && (
            <div
              className="bg-green-500 transition-all duration-500"
              style={{ width: `${(coverage.covered / coverage.total) * 100}%` }}
            />
          )}
          {coverage.atRisk > 0 && (
            <div
              className="bg-amber-400 transition-all duration-500"
              style={{ width: `${(coverage.atRisk / coverage.total) * 100}%` }}
            />
          )}
          {coverage.uncovered > 0 && (
            <div
              className="bg-red-400 transition-all duration-500"
              style={{ width: `${(coverage.uncovered / coverage.total) * 100}%` }}
            />
          )}
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{coverage.covered} covered</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{coverage.atRisk} at risk</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />{coverage.uncovered} uncovered</span>
        </div>
      </div>
    </div>
  )
}
