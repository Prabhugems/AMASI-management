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

// Uniform time formatting. Source has wild variation: "9 am", "9.00am",
// "9:00Am", "9.30-9.38 am", "10:00 AM ---10:15 AM". Normalise to a single
// canonical form: "9:00 AM", "9:00 AM – 9:15 AM".
export function formatTime(input: string | undefined): string {
  if (!input) return ""
  let s = input
  // 1. Convert decimal-hour notation to colon — must run before the AM/PM
  //    cleanup so "9.30" becomes "9:30" first. Use a lookahead instead of
  //    \b so "9.00am" (digit-to-letter, no word boundary) is still caught.
  s = s.replace(/(\b\d{1,2})\.(\d{2})(?!\d)/g, "$1:$2")
  // 2. Ensure exactly one space before AM/PM and uppercase them.
  s = s.replace(/\s*(am|pm)\b/gi, (_m, ampm) => ` ${ampm.toUpperCase()}`)
  // 3. Add ":00" to hour-only times — but only when the hour isn't already
  //    followed by ":NN" (the lookbehind/lookahead avoids "9:00 AM" → "9:0:00 AM").
  s = s.replace(/(?<![:.\d])(\b\d{1,2})\s+(AM|PM)\b/g, "$1:00 $2")
  // 4. Collapse one-or-more dashes between tokens to a single en-dash + spaces.
  s = s.replace(/\s*-{1,}\s*/g, " – ")
  // 5. Normalize multiple spaces.
  s = s.replace(/\s+/g, " ").trim()
  return s
}

// Detect a panel-style chair string ("MODERATOR : X PANELISTS Y") and break it
// into separate moderator / panel pieces with a clearer label.
export function splitPanel(chair: string | undefined): {
  label: string
  moderator?: string
  panel?: string
} {
  if (!chair) return { label: "Chair" }
  // Pattern with explicit MODERATOR and PANELISTS sections
  const both = chair.match(
    /^MODERATORS?\s*:?\s*(.+?)\s+PANELISTS?\s*[-:]?\s*(.+)$/i,
  )
  if (both) {
    return {
      label: "Moderator & panel",
      moderator: both[1].trim(),
      panel: both[2].trim(),
    }
  }
  // Just MODERATOR(S) prefix, no explicit PANELISTS marker — treat the whole
  // remainder as the moderator/panel group.
  if (/^MODERATORS?\s*:/i.test(chair)) {
    return {
      label: "Moderator & panel",
      moderator: chair.replace(/^MODERATORS?\s*:?\s*/i, "").trim(),
    }
  }
  return { label: "Chair", moderator: chair }
}

// Strip leading/trailing dashes left over from clean()'s dash-run collapse.
function stripBorderDashes(s: string): string {
  return s.replace(/^[\s\-–—•·]+/, "").replace(/[\s\-–—•·]+$/, "").trim()
}

// Split a comma-separated list of names into individual entries, dropping
// empty/trivial tokens.
function splitNames(s: string): string[] {
  return s
    .split(/\s*,\s*/)
    .map(stripBorderDashes)
    .filter((n) => n.length >= 2)
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

function SpeakerLine({
  topic,
  value,
  accent,
  compact,
}: {
  topic: string
  value: string
  accent: { icon: string }
  compact: boolean
}) {
  const cleaned = stripBorderDashes(value)
  const names = splitNames(cleaned)
  const isSurgeonRoster =
    /operating\s+surgeon|operating\s+surgeons|live\s+surgeries|live\s+surgery/i.test(topic) &&
    names.length >= 3

  if (isSurgeonRoster) {
    return (
      <div className="flex items-start gap-1.5">
        <User className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${accent.icon}`} />
        <ul className={`min-w-0 space-y-0.5 ${compact ? "text-xs" : "text-sm"} font-medium text-foreground/80`}>
          {names.map((n, i) => (
            <li key={i} className="leading-snug">{formatTime(titleCase(n))}</li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-1.5">
      <User className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${accent.icon}`} />
      <span className={`font-medium text-foreground/80 ${compact ? "text-xs" : "text-sm"}`}>
        {formatTime(titleCase(cleaned))}
      </span>
    </div>
  )
}

function ChairLine({ value, sessionLevel = false }: { value: string; sessionLevel?: boolean }) {
  const panel = splitPanel(value)
  const prefix = sessionLevel && panel.label === "Chair" ? "Session chair" : panel.label
  return (
    <div className="mt-2 flex items-start gap-1.5">
      <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground/70">{prefix} — </span>
        {panel.moderator && <span>{formatTime(titleCase(panel.moderator))}</span>}
        {panel.panel && (
          <>
            <span className="mx-1.5 text-foreground/40">·</span>
            <span className="font-semibold text-foreground/70">Panelists — </span>
            <span>{formatTime(titleCase(panel.panel))}</span>
          </>
        )}
      </span>
    </div>
  )
}

export function RenderRow({ row, accent, compact = false }: { row: Row; accent: string; compact?: boolean }) {
  const a = deriveAccent(accent)

  if (row.kind === "block") {
    return (
      <div className={`relative border-l-4 ${a.border} bg-muted/50 px-5 py-4 dark:bg-slate-900/40`}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          {row.blockTime && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${a.pill}`}>
              {formatTime(row.blockTime)}
            </span>
          )}
          {row.rangeOrNote && (
            <span className="text-xs font-semibold text-foreground/70">{formatTime(row.rangeOrNote)}</span>
          )}
          {row.sessionTitle && (
            <span className="text-base font-bold tracking-tight text-foreground">
              {smartCase(row.sessionTitle)}
            </span>
          )}
        </div>
        {row.chair && <ChairLine value={row.chair} sessionLevel />}
      </div>
    )
  }

  if (row.kind === "section") {
    return (
      <div className={`border-l-4 ${a.border} bg-muted/30 px-5 py-3`}>
        <div className="text-sm font-bold tracking-tight text-foreground">
          {formatTime(smartCase(row.title))}
        </div>
        {row.note && (
          <div className="mt-1 text-xs font-medium text-muted-foreground">{formatTime(row.note)}</div>
        )}
        {row.chair && <ChairLine value={row.chair} sessionLevel />}
      </div>
    )
  }

  if (row.kind === "note") {
    return (
      <div className="px-5 py-2.5 text-xs italic text-muted-foreground">{formatTime(row.text)}</div>
    )
  }

  return (
    <div className="px-4 py-3 transition-colors hover:bg-muted/30">
      <div className={`flex flex-col gap-2 ${compact ? "" : "sm:flex-row sm:items-start sm:gap-4"}`}>
        {row.time && (
          <div className={`shrink-0 ${compact ? "" : "sm:w-32"}`}>
            <div className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[10px] font-semibold text-foreground/80">
              <Clock className="h-3 w-3" />
              <span>{formatTime(row.time)}</span>
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className={`font-semibold leading-snug tracking-tight text-foreground ${compact ? "text-[13px]" : "text-[15px]"}`}>
            {smartCase(row.topic)}
          </h3>
          {(row.speaker || row.chair) && (
            <div className="mt-1.5 space-y-1">
              {row.speaker && <SpeakerLine topic={row.topic} value={row.speaker} accent={a} compact={compact} />}
              {row.chair && <ChairLine value={row.chair} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
