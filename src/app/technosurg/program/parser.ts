import Papa from "papaparse"

export type Row =
  | { kind: "block"; blockTime?: string; rangeOrNote: string; sessionTitle: string; chair?: string }
  | { kind: "section"; title: string; note?: string; chair?: string }
  | { kind: "talk"; time?: string; topic: string; speaker?: string; chair?: string }
  | { kind: "note"; text: string }

export type Day = { label: string; rows: Row[] }

// The sheet records chairs on the talks themselves (sometimes only the first
// talk, sometimes scattered across several talks in the same session). Collect
// every chair within a section/block and combine them on the container so the
// session header carries the full chair list.
function hoistChairs(days: Day[]): Day[] {
  for (const day of days) {
    let container: Extract<Row, { kind: "block" | "section" }> | null = null
    let containerEnd: number | null = null
    let collected: string[] = []

    const flush = () => {
      if (!container) return
      const merged = [...(container.chair ? [container.chair] : []), ...collected]
      const parts = new Set<string>()
      for (const m of merged) {
        for (const p of m.split(/\s*,\s*/)) {
          const trimmed = p.trim()
          if (trimmed) parts.add(trimmed)
        }
      }
      if (parts.size > 0) container.chair = Array.from(parts).join(", ")
      collected = []
    }

    for (const row of day.rows) {
      if (row.kind === "block" || row.kind === "section") {
        flush()
        container = row
        const sourceForEnd =
          row.kind === "block" ? row.rangeOrNote || row.blockTime : row.note || row.title
        containerEnd = parseEndMinutes(sourceForEnd)
      } else if (row.kind === "talk" && row.chair && container) {
        const talkStart = parseStartMinutes(row.time)
        // If we know when the session ends and the talk starts after that,
        // the talk belongs to a new (untitled) session — release the container.
        if (containerEnd !== null && talkStart !== null && talkStart >= containerEnd) {
          flush()
          container = null
          containerEnd = null
        } else {
          collected.push(row.chair)
          row.chair = undefined
        }
      }
    }
    flush()
  }
  return days
}

function clean(v: unknown): string {
  return typeof v === "string"
    ? v.replace(/\s+/g, " ").replace(/-{2,}/g, "-").trim()
    : ""
}

const CEREMONIAL_TITLES = /^(INAUGURATION|BANQUET DINNER|CULTURAL PROGRAM|VOTE OF THANKS|VIDEO AWARDS SESSION\/POSTER SESSION|QUIZ|PRODUCT LAUNCH)/i

function isCeremonialTopic(c2: string): boolean {
  return CEREMONIAL_TITLES.test(c2)
}

function parseStartMinutes(s: string | undefined): number | null {
  if (!s) return null
  // Find every numeric time token. Some sources have a range like "9:45-11:30 AM"
  // where the first time lacks an explicit am/pm — borrow the last token's marker.
  const tokens: { h: number; mn: number; ampm?: string }[] = []
  const re = /(\d{1,2})[:.]?(\d{0,2})\s*(am|pm)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    const h = parseInt(m[1])
    const mn = m[2] ? parseInt(m[2]) : 0
    if (isNaN(h) || h < 1 || h > 12) continue
    tokens.push({ h, mn: isNaN(mn) ? 0 : mn, ampm: m[3]?.toLowerCase() })
  }
  if (tokens.length === 0) return null
  const first = tokens[0]
  const inferredAmpm =
    first.ampm || tokens.find((t) => t.ampm)?.ampm || undefined
  if (!inferredAmpm) return null
  let h = first.h
  if (inferredAmpm === "pm" && h < 12) h += 12
  if (inferredAmpm === "am" && h === 12) h = 0
  return h * 60 + first.mn
}

// If the string carries a time range (e.g. "9.30-11 am" or "3 PM - 4.30 PM"),
// return the END minute. Single-time strings return null.
function parseEndMinutes(s: string | undefined): number | null {
  if (!s) return null
  if (!/[-–—]|\bto\b/i.test(s)) return null
  const re = /(\d{1,2})([:.]\d{2})?\s*(am|pm)/gi
  let last: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) last = m
  if (!last) return null
  let h = parseInt(last[1])
  const minPart = last[2] ? last[2].slice(1) : "0"
  const mn = parseInt(minPart) || 0
  const ampm = last[3].toLowerCase()
  if (ampm === "pm" && h < 12) h += 12
  if (ampm === "am" && h === 12) h = 0
  return h * 60 + mn
}

function rowStartMinutes(row: Row): number | null {
  if (row.kind === "block") {
    return parseStartMinutes(row.blockTime) ?? parseStartMinutes(row.rangeOrNote)
  }
  if (row.kind === "talk") return parseStartMinutes(row.time)
  if (row.kind === "section") return parseStartMinutes(row.note) ?? parseStartMinutes(row.title)
  return null
}

// Split a day's rows by time bucket using the 11 AM and 3 PM boundaries.
// Returns the rows that fall before, during, and after the parallel window.
export function splitDayForPlenary(day: Day): {
  morning: Row[]
  parallel: Row[]
  evening: Row[]
} {
  const result: { morning: Row[]; parallel: Row[]; evening: Row[] } = {
    morning: [],
    parallel: [],
    evening: [],
  }
  let bucket: "morning" | "parallel" | "evening" = "morning"
  for (const row of day.rows) {
    const start = rowStartMinutes(row)
    if (start !== null) {
      if (start < 11 * 60) bucket = "morning"
      else if (start < 15 * 60) bucket = "parallel"
      else bucket = "evening"
    }
    result[bucket].push(row)
  }
  return result
}

// Drop chair values that are actually TNMC numbers or "yes/no" mail flags
// leaking from the source sheet's chair column.
function cleanChair(v: string): string | undefined {
  if (!v) return undefined
  if (/^(yes|no|y|n|pending|done|judge|n\/?a)$/i.test(v)) return undefined
  // "Chairperson for 2:45 to 4:24" is a label in the sheet, not a chair name
  if (/^chairperson\s+for/i.test(v)) return undefined
  // TNMC-like: "name - 12345" or short string with digits & dash
  if (/-\s*\d{4,}/.test(v) && v.length < 40 && !/dr\.?\s/i.test(v)) return undefined
  return v
}

function looksLikeBlockTime(s: string): boolean {
  if (!s) return false
  return /^\d{1,2}([:.]\d{2})?\s*(AM|PM)/i.test(s)
}

function looksLikeTime(s: string): boolean {
  if (!s) return false
  return /\d{1,2}[:.]?\d{0,2}\s*(am|pm|AM|PM)/.test(s)
}

function parseCsv(csv: string): string[][] {
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: false })
  return parsed.data.filter((r) => Array.isArray(r)) as string[][]
}

function rowJoined(r: string[]): string {
  return r.map((v) => (typeof v === "string" ? v : "")).join(" | ")
}

// ────────────────────────────────────────────────────────────────────────
// Screen 1 — main lecture screen (surgery sheet, cols 0–5)
// ────────────────────────────────────────────────────────────────────────
export function parseScreen1(csv: string): Day[] {
  const rows = parseCsv(csv)
  const days: Day[] = [{ label: "Day 1", rows: [] }]
  let current = days[0]

  let stop = false
  for (const r of rows) {
    if (stop) break
    const c0 = clean(r[0])
    const c1 = clean(r[1])
    const c2 = clean(r[2])
    const c3 = clean(r[3])
    const c4 = clean(r[4])
    const c5 = clean(r[5])

    if (!c0 && !c1 && !c2 && !c3 && !c4 && !c5) continue
    if (/^screen\s*1$/i.test(c1)) continue

    // The surgery sheet has appendix rows after Day 2 (e.g. "ONLINE TALKS 20.06.2026")
    // that don't belong to either day — stop parsing when we hit them.
    if (/online\s*talks/i.test(rowJoined(r))) {
      stop = true
      continue
    }

    if (/\bDAY\s*2\b/i.test(rowJoined(r)) && current.rows.length) {
      current = { label: "Day 2", rows: [] }
      days.push(current)
      continue
    }

    // Fix the common "11 PM - 12:30 PM" typo in the live sheet — should be 11 AM.
    const c1Fixed = /^\s*11\s*PM\s*-\s*12[:.]?\d{0,2}\s*PM/i.test(c1)
      ? c1.replace(/^(\s*11\s*)PM/i, "$1AM")
      : c1

    if (looksLikeBlockTime(c0)) {
      current.rows.push({
        kind: "block",
        blockTime: c0,
        rangeOrNote: c1,
        sessionTitle: c2,
      })
      continue
    }

    // Ceremonial entries (Inauguration, Banquet, Vote of Thanks, …) — render as block headers
    if (looksLikeTime(c1Fixed) && c2 && isCeremonialTopic(c2)) {
      current.rows.push({
        kind: "block",
        blockTime: c1Fixed,
        rangeOrNote: c3 || "",
        sessionTitle: c2,
      })
      continue
    }

    if (looksLikeTime(c1Fixed) && c2 && c3) {
      current.rows.push({
        kind: "talk",
        time: c1Fixed,
        topic: c2,
        speaker: c3 || undefined,
        chair: cleanChair(c5),
      })
      continue
    }

    if (!c0 && (c1Fixed || c2)) {
      if (/^\(.*\)$/.test(c1Fixed) && !c2) {
        current.rows.push({ kind: "note", text: c1Fixed })
        continue
      }
      const title = c2 || c1Fixed
      const note = c2 && c1Fixed && c1Fixed !== c2 ? c1Fixed : undefined
      // Capture moderators (c3) on a section header — the sheet uses c3 for
      // panel moderators which would otherwise be discarded.
      const chair = cleanChair(c3) || cleanChair(c5)
      current.rows.push({ kind: "section", title, note, chair })
      continue
    }

    if (c0 && !c1 && !c2) {
      current.rows.push({ kind: "note", text: c0 })
    }
  }

  return hoistChairs(days.filter((d) => d.rows.length > 0))
}

// ────────────────────────────────────────────────────────────────────────
// Screen 2/3 — sparse live-surgery columns in the surgery sheet
// ────────────────────────────────────────────────────────────────────────
function parseSparseScreen(csv: string, cols: number[]): Day[] {
  const rows = parseCsv(csv)
  const days: Day[] = [{ label: "Day 1", rows: [] }]
  let current = days[0]
  let pendingBlock: { time?: string; title?: string; notes: string[]; surgeons?: string } | null = null
  let stop = false

  const flush = () => {
    if (!pendingBlock) return
    const { time, title, notes, surgeons } = pendingBlock
    if (time || title || notes.length || surgeons) {
      current.rows.push({
        kind: "block",
        blockTime: time,
        rangeOrNote: notes.join(" • "),
        sessionTitle: title || "LIVE SURGERIES",
      })
      if (surgeons) {
        current.rows.push({
          kind: "talk",
          topic: "Operating surgeons",
          speaker: surgeons,
        })
      }
    }
    pendingBlock = null
  }

  for (const r of rows) {
    if (stop) break
    if (/online\s*talks/i.test(rowJoined(r))) {
      flush()
      stop = true
      continue
    }
    if (/\bDAY\s*2\b/i.test(rowJoined(r)) && current.rows.length) {
      flush()
      current = { label: "Day 2", rows: [] }
      days.push(current)
      continue
    }

    const vals = cols.map((c) => clean(r[c])).filter((v) => v && !/^screen\s*\d+$/i.test(v))
    if (vals.length === 0) continue

    // Treat consecutive non-empty cells as part of the same block
    if (!pendingBlock) pendingBlock = { notes: [] }
    for (const v of vals) {
      if (looksLikeBlockTime(v) || looksLikeTime(v)) {
        pendingBlock.time = pendingBlock.time ? `${pendingBlock.time} / ${v}` : v
      } else if (/^\(.*\)$/.test(v)) {
        pendingBlock.notes.push(v)
      } else if (/\b(LIVE\s+SURGER|SURGERY|SESSION|MASTERCLASS)\b/i.test(v) && v.length < 60) {
        pendingBlock.title = v
      } else if (/Dr[.\s]/i.test(v) && v.length > 30) {
        pendingBlock.surgeons = pendingBlock.surgeons ? `${pendingBlock.surgeons}, ${v}` : v
      } else {
        pendingBlock.notes.push(v)
      }
    }
  }
  flush()
  return days.filter((d) => d.rows.length > 0)
}

export function parseScreen2(csv: string): Day[] {
  return parseSparseScreen(csv, [7, 8, 9, 10])
}

export function parseScreen3(csv: string): Day[] {
  return parseSparseScreen(csv, [11, 12, 13, 14])
}

// ────────────────────────────────────────────────────────────────────────
// Screen 4 — Gynaec, dedicated sheet tab
//   cols: 0=time, 1=topic/title, 2=speaker, 3=mail (ignore), 4=chair
// ────────────────────────────────────────────────────────────────────────
export function parseGynaec(csv: string): Day[] {
  const rows = parseCsv(csv)
  const days: Day[] = []
  let current: Day | null = null

  const ensureDay = (label: string) => {
    if (current?.label === label) return
    current = { label, rows: [] }
    days.push(current)
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const c0 = clean(r[0])
    const c1 = clean(r[1])
    const c2 = clean(r[2])
    const c4 = clean(r[4])

    if (!c0 && !c1 && !c2 && !c4) continue

    // Skip column header
    if (/^session$/i.test(c0) && /^topic$/i.test(c1)) continue

    // Skip stray sentinel rows (Y/N, TNMC table, single-word names)
    if (!c0 && !c1 && !c2 && c4 && c4.length <= 4) continue
    if (!c0 && !c1 && !c4 && c2 && /^[a-z]+$/i.test(c2)) continue

    // Day markers
    if (/^DAY\s*1/i.test(c0)) {
      ensureDay("Day 1")
      // Day 1 row also carries a single live-surgery block. Keep speaker on a
      // talk row (operating surgeon name) but move the chair list onto the
      // block so we avoid duplicate empty rows after chair hoisting.
      if (c1) {
        current!.rows.push({
          kind: "block",
          rangeOrNote: c0,
          sessionTitle: c1,
          chair: cleanChair(c4),
        })
        if (c2) {
          current!.rows.push({
            kind: "talk",
            topic: "Operating surgeon",
            speaker: c2,
          })
        }
      }
      continue
    }
    if (/^DAY\s*2/i.test(c0)) {
      ensureDay("Day 2")
      continue
    }

    if (!current) ensureDay("Day 1")

    // Section header: time-range in c0 + session title in c1, no speaker
    if (c0 && c1 && !c2 && /SESSION|MASTERCLASS|PANEL|KEYNOTE/i.test(c1)) {
      current!.rows.push({ kind: "section", title: c1, note: c0 })
      continue
    }
    if (!c0 && c1 && !c2 && /SESSION|MASTERCLASS|PANEL|KEYNOTE/i.test(c1)) {
      current!.rows.push({ kind: "section", title: c1 })
      continue
    }

    // Talk: time + topic + speaker
    if (c0 && c1 && c2) {
      current!.rows.push({
        kind: "talk",
        time: c0,
        topic: c1,
        speaker: c2,
        chair: cleanChair(c4),
      })
      continue
    }

    // Block-like: time + topic but no speaker (e.g. LIVE SURGERY)
    // Chair list goes directly on the block so hoistChairs doesn't need a
    // separate dummy talk row.
    if (c0 && c1 && !c2) {
      current!.rows.push({
        kind: "block",
        rangeOrNote: c0,
        sessionTitle: c1,
        chair: cleanChair(c4),
      })
      continue
    }

    // Continuation of chairs from previous row (no c0/c1/c2, only c4)
    if (!c0 && !c1 && !c2 && c4) {
      const last = current!.rows[current!.rows.length - 1]
      if (last && last.kind === "talk") {
        last.chair = last.chair ? `${last.chair}, ${c4}` : c4
      }
      continue
    }
  }

  return hoistChairs(days.filter((d) => d.rows.length > 0))
}
