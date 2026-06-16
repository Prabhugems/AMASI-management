"use client"

import { Clock, User, Users } from "lucide-react"
import type { Row } from "./parser"

const ACRONYMS = new Set([
  "ICG", "AI", "AWR", "SLNB", "GEM", "VATS", "TME", "PD", "RAMPS",
  "ULAR", "MGM", "AIG", "MERIL", "SSI", "HUGO", "EUS", "GI", "TASO",
  "CAHO", "POV", "FOMO", "MGE", "IIT", "UGI", "MIS", "DIE", "OT", "OR",
  "VS", "AM", "PM", "USA", "UK", "NHS", "TK", "GV", "CD", "PSN", "SRP",
  "3D", "DUALTO", "ASPIRE", "TECHNOSURG", "ONCO", "MISSO",
])

export function smartCase(input: string | undefined): string {
  if (!input) return ""
  const letters = input.replace(/[^a-zA-Z]/g, "")
  if (letters.length === 0) return input
  const upperRatio = (input.match(/[A-Z]/g) || []).length / letters.length
  if (upperRatio < 0.55) return input

  let firstAlpha = true
  return input
    .split(/(\W+)/)
    .map((tok) => {
      if (!/[a-zA-Z]/.test(tok)) return tok
      const upper = tok.toUpperCase()
      if (ACRONYMS.has(upper)) {
        firstAlpha = false
        return upper
      }
      if (upper === "DR") {
        firstAlpha = false
        return "Dr"
      }
      const lowered = tok.toLowerCase()
      if (firstAlpha) {
        firstAlpha = false
        return lowered.charAt(0).toUpperCase() + lowered.slice(1)
      }
      return lowered
    })
    .join("")
}

export function titleCase(input: string | undefined): string {
  if (!input) return ""
  const letters = input.replace(/[^a-zA-Z]/g, "")
  if (letters.length === 0) return input
  const upperRatio = (input.match(/[A-Z]/g) || []).length / letters.length
  if (upperRatio < 0.55) return input
  return input
    .split(/(\W+)/)
    .map((tok) => {
      if (!/[a-zA-Z]/.test(tok)) return tok
      const upper = tok.toUpperCase()
      if (ACRONYMS.has(upper)) return upper
      const lowered = tok.toLowerCase()
      return lowered.charAt(0).toUpperCase() + lowered.slice(1)
    })
    .join("")
}

type Accent = {
  pill: string
  border: string
  icon: string
}

// Static class map — Tailwind class-scanner needs these literally in source.
const ACCENT_MAP: Record<string, Accent> = {
  "bg-amber-600": { pill: "bg-amber-600", border: "border-amber-600", icon: "text-amber-600" },
  "bg-emerald-700": { pill: "bg-emerald-700", border: "border-emerald-700", icon: "text-emerald-700" },
  "bg-sky-700": { pill: "bg-sky-700", border: "border-sky-700", icon: "text-sky-700" },
  "bg-rose-600": { pill: "bg-rose-600", border: "border-rose-600", icon: "text-rose-600" },
  "bg-violet-700": { pill: "bg-violet-700", border: "border-violet-700", icon: "text-violet-700" },
  "bg-pink-700": { pill: "bg-pink-700", border: "border-pink-700", icon: "text-pink-700" },
  "bg-slate-700": { pill: "bg-slate-700", border: "border-slate-700", icon: "text-slate-700" },
  "bg-slate-900": { pill: "bg-slate-900", border: "border-slate-900", icon: "text-slate-900" },
}

function deriveAccent(accent: string): Accent {
  return ACCENT_MAP[accent] ?? ACCENT_MAP["bg-slate-700"]
}

export function RenderRow({ row, accent, compact = false }: { row: Row; accent: string; compact?: boolean }) {
  const a = deriveAccent(accent)

  if (row.kind === "block") {
    return (
      <div className={`relative border-l-4 ${a.border} bg-muted/50 px-5 py-4 dark:bg-slate-900/40`}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          {row.blockTime && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${a.pill}`}>
              {row.blockTime}
            </span>
          )}
          {row.rangeOrNote && (
            <span className="text-xs font-semibold text-foreground/70">{row.rangeOrNote}</span>
          )}
          {row.sessionTitle && (
            <span className="text-base font-bold tracking-tight text-foreground">
              {smartCase(row.sessionTitle)}
            </span>
          )}
        </div>
        {row.chair && (
          <div className="mt-2 flex items-start gap-1.5">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/70">Session chair — </span>
              {titleCase(row.chair)}
            </span>
          </div>
        )}
      </div>
    )
  }

  if (row.kind === "section") {
    return (
      <div className={`border-l-4 ${a.border} bg-muted/30 px-5 py-3`}>
        <div className="text-sm font-bold tracking-tight text-foreground">
          {smartCase(row.title)}
        </div>
        {row.note && (
          <div className="mt-1 text-xs font-medium text-muted-foreground">{row.note}</div>
        )}
        {row.chair && (
          <div className="mt-2 flex items-start gap-1.5">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/70">Session chair — </span>
              {titleCase(row.chair)}
            </span>
          </div>
        )}
      </div>
    )
  }

  if (row.kind === "note") {
    return (
      <div className="px-5 py-2.5 text-xs italic text-muted-foreground">{row.text}</div>
    )
  }

  return (
    <div className="px-4 py-3 transition-colors hover:bg-muted/30">
      <div className={`flex flex-col gap-2 ${compact ? "" : "sm:flex-row sm:items-start sm:gap-4"}`}>
        {row.time && (
          <div className={`shrink-0 ${compact ? "" : "sm:w-32"}`}>
            <div className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[10px] font-semibold text-foreground/80">
              <Clock className="h-3 w-3" />
              <span>{row.time}</span>
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className={`font-semibold leading-snug tracking-tight text-foreground ${compact ? "text-[13px]" : "text-[15px]"}`}>
            {smartCase(row.topic)}
          </h3>
          {(row.speaker || row.chair) && (
            <div className="mt-1.5 space-y-1">
              {row.speaker && (
                <div className="flex items-start gap-1.5">
                  <User className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${a.icon}`} />
                  <span className={`font-medium text-foreground/80 ${compact ? "text-xs" : "text-sm"}`}>
                    {titleCase(row.speaker)}
                  </span>
                </div>
              )}
              {row.chair && (
                <div className="flex items-start gap-1.5">
                  <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground/70">Chair — </span>
                    {titleCase(row.chair)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
