"use client"

import { useCountUp } from "@/hooks/use-count-up"
import { cn } from "@/lib/utils"
import { type ReactNode, useState, useCallback, useEffect } from "react"
import { Loader2 } from "lucide-react"

/* ========================================
   Animated Stat Card
   ======================================== */
interface StatCardProps {
  label: string
  value: number
  color?: string
  bgColor?: string
  icon?: ReactNode
  active?: boolean
  onClick?: () => void
}

export function AnimatedStatCard({ label, value, color, bgColor, icon, active, onClick }: StatCardProps) {
  const animatedValue = useCountUp(value)

  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-card border rounded-xl p-4 text-left transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 stagger-item group",
        bgColor,
        active && "ring-2 ring-primary border-primary shadow-md"
      )}
    >
      {icon && (
        <div className="mb-2 opacity-60 group-hover:opacity-100 transition-opacity">
          {icon}
        </div>
      )}
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", color)}>
        {animatedValue}
      </p>
    </button>
  )
}

/* ========================================
   Search Highlight
   ======================================== */
export function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search || !text) return <>{text}</>
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

/* ========================================
   Export Progress Indicator
   ======================================== */
export function useExportProgress() {
  const [exporting, setExporting] = useState(false)
  const [exportLabel, setExportLabel] = useState("")

  const startExport = useCallback((label: string) => {
    setExporting(true)
    setExportLabel(label)
  }, [])

  const endExport = useCallback(() => {
    // Brief delay so user sees completion
    setTimeout(() => {
      setExporting(false)
      setExportLabel("")
    }, 600)
  }, [])

  const ExportOverlay = () =>
    exporting ? (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-card border rounded-2xl shadow-xl p-8 flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-200">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="font-medium text-sm">{exportLabel}</p>
        </div>
      </div>
    ) : null

  return { exporting, startExport, endExport, ExportOverlay }
}

/* ========================================
   Empty State
   ======================================== */
interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="text-center py-16 text-muted-foreground animate-in fade-in duration-500">
      <div className="mx-auto mb-4 opacity-30">{icon}</div>
      <p className="font-medium text-base">{title}</p>
      {description && <p className="text-sm mt-1 max-w-sm mx-auto">{description}</p>}
    </div>
  )
}

/* ========================================
   Result Badge with pulse effect
   ======================================== */
export function ResultBadge({ result }: { result: string | null }) {
  if (result === "pass") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full animate-in fade-in duration-300">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        Pass
      </span>
    )
  }
  if (result === "fail") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-full animate-in fade-in duration-300">
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        Fail
      </span>
    )
  }
  if (result === "absent") {
    return (
      <span className="text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2.5 py-1 rounded-full">Absent</span>
    )
  }
  if (result === "withheld") {
    return (
      <span className="text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2.5 py-1 rounded-full">Withheld</span>
    )
  }
  return <span className="text-xs text-muted-foreground">Pending</span>
}

/* ========================================
   Keyboard Shortcut Hint Badge
   ======================================== */
export function KbdHint({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  )
}
