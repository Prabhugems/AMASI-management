"use client"

import { Clock, User, Users } from "lucide-react"
import type { Row } from "./parser"

const ACRONYMS = new Set([
  "ICG", "AI", "AWR", "SLNB", "GEM", "VATS", "TME", "PD", "RAMPS",
  "ULAR", "MGM", "AIG", "MERIL", "SSI", "HUGO", "EUS", "GI", "TASO",
  "CAHO", "POV", "FOMO", "MGE", "IIT", "UGI", "MIS", "DIE", "OT", "OR",
  "VS", "AM", "PM", "USA", "UK", "NHS", "TK", "GV", "CD", "PSN", "SRP",
  "3D", "DUALTO", "ASPIRE", "TECHNOSURG", "ONCO", "MISSO",
  "DNA", "RNA", "MRI", "CT", "USG", "OPD", "ICU", "NICU", "ER", "OPN",
  "MD", "MS", "MCh", "DM", "FRCS", "MBBS",
])

// Title-case small words that stay lowercase unless they're the first word
// of the string (English title-case convention).
const SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into",
  "nor", "of", "on", "onto", "or", "the", "to", "via", "with", "yet",
])

export function smartCase(input: string | undefined): string {
  if (!input) return ""
  const letters = input.replace(/[^a-zA-Z]/g, "")
  if (letters.length === 0) return input

  let isFirstAlpha = true
  return input
    .split(/(\W+)/)
    .map((tok) => {
      if (!/[a-zA-Z]/.test(tok)) {
        // Clause-breaking punctuation re-arms the "first word" capitalization
        // so "Session 1 – the Future" becomes "Session 1 – The Future" and
        // "X : the Y" becomes "X : The Y".
        if (/[:–—?!.]|\s-\s/.test(tok)) isFirstAlpha = true
        return tok
      }
      const upper = tok.toUpperCase()
      if (ACRONYMS.has(upper)) {
        isFirstAlpha = false
        return upper
      }
      if (upper === "DR") {
        isFirstAlpha = false
        return "Dr"
      }
      const lowered = tok.toLowerCase()
      // Small words ("the", "and", "to", "in", …) stay lowercase unless
      // they're the first alpha word after a clause break or at the start.
      if (!isFirstAlpha && SMALL_WORDS.has(lowered)) return lowered
      isFirstAlpha = false
      return lowered.charAt(0).toUpperCase() + lowered.slice(1)
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
  // 2. Ensure exactly one space before AM/PM and uppercase them. Require a
  //    digit immediately before (optionally with :NN) so "Vikram" / "Sundaram"
  //    / "PROGRAM" / "team" don't get split into "Vikr AM" etc.
  s = s.replace(
    /(\d+(?:[:.]\d+)?)\s*(am|pm)\b/gi,
    (_m, time, ampm) => `${time} ${ampm.toUpperCase()}`,
  )
  // 2.1. Convert " to " between two time tokens into the canonical en-dash —
  //      need at least one end with AM/PM, then step 2.5 fills in the other.
  s = s.replace(
    /(\b\d[\d:.]*\s*(?:AM|PM)?)\s+to\s+(\d[\d:.]*\s*(?:AM|PM)?)/gi,
    (m, t1, t2) => {
      if (!/AM|PM/i.test(t1) && !/AM|PM/i.test(t2)) return m
      return `${t1} – ${t2}`
    },
  )
  // 2.5. If a time range carries AM/PM only on the end, infer the start.
  //      "11-1 PM" → "11 AM – 1 PM", "1-3 PM" → "1 PM – 3 PM".
  s = s.replace(
    /(\b\d{1,2})((?:[:.]\d{2})?)(\s*[-–]\s*)(\d{1,2}(?:[:.]\d{2})?\s+(AM|PM))/gi,
    (whole, h1, m1, sep, endTok, endAmPm) => {
      const sh = parseInt(h1)
      const eh = parseInt(endTok)
      if (isNaN(sh) || isNaN(eh) || sh < 1 || sh > 12 || eh < 1 || eh > 12) return whole
      const to24 = (h: number, ampm: string) => {
        if (ampm === "PM" && h !== 12) return h + 12
        if (ampm === "AM" && h === 12) return 0
        return h
      }
      const endAmPmU = endAmPm.toUpperCase()
      const end24 = to24(eh, endAmPmU)
      let startAmPm = endAmPmU
      for (const cand of [endAmPmU, endAmPmU === "PM" ? "AM" : "PM"]) {
        const start24 = to24(sh, cand)
        const diff = end24 - start24
        if (diff > 0 && diff <= 12) { startAmPm = cand; break }
      }
      return `${h1}${m1} ${startAmPm}${sep}${endTok}`
    },
  )
  // 3. Add ":00" to hour-only times — but only when the hour isn't already
  //    followed by ":NN" (the lookbehind/lookahead avoids "9:00 AM" → "9:0:00 AM").
  s = s.replace(/(?<![:.\d])(\b\d{1,2})\s+(AM|PM)\b/g, "$1:00 $2")
  // 4. Collapse one-or-more dashes between tokens to a single en-dash + spaces.
  s = s.replace(/\s*-{1,}\s*/g, " – ")
  // 5. Normalize multiple spaces.
  s = s.replace(/\s+/g, " ").trim()
  // 6. Trim whitespace immediately inside parentheses so "(11:00 AM – 3:00 PM )"
  //    reads "(11:00 AM – 3:00 PM)".
  s = s.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")")
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

// Detect chair strings that carry time-slot annotations. Supports both
// "names-then-slot" (gynaec: "Dr.A, Dr.B - 11-1 PM, Dr.C 1-3 PM") and
// "slot-then-names" (surgery: "9.00 - 9.36 AM Dr.X, Dr.Y, 9:36-10:00 AM Dr.Z").
export function splitChairsByTimeSlot(
  raw: string,
): Array<{ slot: string; names: string[] }> | null {
  const timeRangeRe =
    /\d{1,2}[:.]?\d{0,2}\s*(?:AM|PM)?\s*[-–]\s*\d{1,2}[:.]?\d{0,2}\s*(?:AM|PM)/gi
  const matches = [...raw.matchAll(timeRangeRe)]
  if (matches.length < 2) return null

  const splitToNames = (s: string) =>
    s
      .replace(/^[\s,\-–—]+|[\s,\-–—]+$/g, "")
      .split(/\s*,\s*/)
      .map((n) => n.trim())
      .filter((n) => n.length >= 2)

  const groups: Array<{ slot: string; names: string[] }> = []
  // If the first time match sits at (or near) the start of the string the
  // format is "slot then names" — names are the text BETWEEN matches.
  const slotFirst = (matches[0].index ?? 0) <= 2
  if (slotFirst) {
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]
      const start = (m.index ?? 0) + m[0].length
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length
      const names = splitToNames(raw.slice(start, end))
      if (names.length) groups.push({ slot: m[0], names })
    }
  } else if (matches.length === 1) {
    // Single time slot somewhere in the middle/end. Names before the slot are
    // "general" chairs (no slot label); names after belong to that slot.
    // If nothing follows, it's the original names-then-slot form.
    const m = matches[0]
    const before = splitToNames(raw.slice(0, m.index ?? 0))
    const after = splitToNames(raw.slice((m.index ?? 0) + m[0].length))
    if (after.length > 0) {
      if (before.length) groups.push({ slot: "", names: before })
      groups.push({ slot: m[0], names: after })
    } else if (before.length) {
      groups.push({ slot: m[0], names: before })
    }
  } else {
    let lastEnd = 0
    for (const m of matches) {
      const names = splitToNames(raw.slice(lastEnd, m.index ?? 0))
      if (names.length) groups.push({ slot: m[0], names })
      lastEnd = (m.index ?? 0) + m[0].length
    }
  }
  return groups.length >= 2 ? groups : null
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
  const stripped = stripBorderDashes(value).trim()

  // Panel session speaker field carrying "MODERATORS: X PANELISTS - Y" —
  // render the two roles as labelled lines. Must run BEFORE we strip the
  // MODERATORS prefix below, otherwise the regex anchor at "^MODERATORS"
  // can't fire.
  const panelMatch = stripped.match(
    /^MODERATORS?\s*[:\-]?\s*(.+?)\s+PANELISTS?\s*[:–-]?\s*(.+)$/i,
  )
  // Strip any leftover "MODERATORS [FOR LIVE]:" prefix so the first name
  // doesn't render as "Moderators: Dr X" when there's no PANELISTS portion.
  const cleaned = panelMatch
    ? stripped
    : stripped.replace(/^MODERATORS?(?:\s+FOR\s+LIVE)?\s*[:\-]?\s*/i, "").trim()
  if (panelMatch) {
    const mod = formatTime(titleCase(panelMatch[1].trim()))
    const pan = formatTime(titleCase(panelMatch[2].trim()))
    return (
      <div className="space-y-1.5">
        <div className="flex items-start gap-1.5">
          <User className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${accent.icon}`} />
          <span className={`min-w-0 ${compact ? "text-xs" : "text-sm"} font-medium text-foreground/80`}>
            <span className="font-semibold text-foreground/70">Moderators — </span>
            {mod}
          </span>
        </div>
        <div className="flex items-start gap-1.5">
          <User className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${accent.icon}`} />
          <span className={`min-w-0 ${compact ? "text-xs" : "text-sm"} font-medium text-foreground/80`}>
            <span className="font-semibold text-foreground/70">Panelists — </span>
            {pan}
          </span>
        </div>
      </div>
    )
  }

  const names = splitNames(cleaned)
  const isRoster =
    /operating\s+surgeon|live\s+surger|moderator/i.test(topic) &&
    names.length >= 3

  if (isRoster) {
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
  // First check for time-slot-grouped chairs — different chairs per sub-window.
  const slots = splitChairsByTimeSlot(value)
  if (slots) {
    return (
      <div className="mt-2 space-y-1.5">
        {slots.map((g, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/70">
                {g.slot ? `${formatTime(g.slot)} chair — ` : `${sessionLevel ? "Session chair" : "Chair"} — `}
              </span>
              {g.names.map((n) => formatTime(titleCase(n))).join(", ")}
            </span>
          </div>
        ))}
      </div>
    )
  }

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
            {typeof row.screen === "number" && (
              <div className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${a.pill}`}>
                Screen {row.screen}
              </div>
            )}
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
