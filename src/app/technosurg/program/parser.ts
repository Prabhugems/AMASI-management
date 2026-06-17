import Papa from "papaparse"

export type Row =
  | { kind: "block"; blockTime?: string; rangeOrNote: string; sessionTitle: string; chair?: string }
  | { kind: "section"; title: string; note?: string; chair?: string }
  | { kind: "talk"; time?: string; topic: string; speaker?: string; chair?: string; screen?: number }
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
      // Dedup by alpha-only normalized key so "Dr. Vinoth Kumar" and
      // "Dr.Vinoth Kumar" collapse into a single entry.
      const seen = new Set<string>()
      const ordered: string[] = []
      for (const m of merged) {
        // Insert commas between adjacent "Dr X Dr Y" tokens (some sheet cells
        // list two doctors without a comma separator). Skip when the preceding
        // letter is an AM/PM marker so "10:15 AM Dr X" doesn't become
        // "10:15 AM, Dr X" (which would split the slot label off as a name).
        const withCommas = m.replace(
          /([a-z])\s+(Dr[.\s])/gi,
          (match, before, after, offset, str) => {
            const ctx = (str as string).substring(Math.max(0, offset - 2), offset + 1)
            if (/[ap]m$/i.test(ctx)) return match
            return `${before}, ${after}`
          },
        )
        for (const p of withCommas.split(/\s*,\s*/)) {
          const trimmed = p.trim().replace(/\s+/g, " ")
          if (!trimmed) continue
          const key = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "")
          if (seen.has(key)) continue
          seen.add(key)
          ordered.push(trimmed)
        }
      }
      if (ordered.length) container.chair = ordered.join(", ")
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
  // "Chairperson" / "Chairperson:" alone is a column-label header, not a name
  if (/^chairpersons?\s*:?\s*$/i.test(v)) return undefined
  // "Chairperson for HH:MM to HH:MM Dr.X Dr.Y" — strip the time-window
  // descriptor and keep the actual chair names that follow.
  if (/^chairpersons?\s+for\b/i.test(v)) {
    const stripped = v.replace(
      /^chairpersons?\s+for\s+[^A-Za-z]*(?:[ap]m)?\s*(?:to|[-–])\s*[^A-Za-z]*(?:[ap]m)?\s*/i,
      "",
    )
    return stripped && stripped !== v ? stripped.trim() || undefined : undefined
  }
  // TNMC-like: "name - 12345" or short string with digits & dash
  if (/-\s*\d{4,}/.test(v) && v.length < 40 && !/dr\.?\s/i.test(v)) return undefined
  // Strip just the "Chairperson(s)" word and any colon/dash separator.
  // Preserve any leading time-range prefix so splitChairsByTimeSlot can
  // group chairs by sub-window (e.g. "9.00 - 9.36 AM Chairpersons Dr. X"
  // becomes "9.00 - 9.36 AM Dr. X").
  return v.replace(/\bchairpersons?\s*[:\-]?\s*/i, "").trim() || undefined
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
        rangeOrNote: c1Fixed,
        sessionTitle: c2,
        chair: cleanChair(c5),
      })
      continue
    }

    // Panelists-only continuation row (panelists list in c3 alone) — attach
    // to the previous section's chair so ChairLine's MODERATOR/PANELISTS
    // splitter shows both labelled lines.
    if (!c0 && !c1Fixed && !c2 && c3 && !c4 && !c5 && /^panelists?\b/i.test(c3)) {
      const last = current.rows[current.rows.length - 1]
      if (last && (last.kind === "section" || last.kind === "block")) {
        last.chair = last.chair ? `${last.chair} ${c3}` : c3
      }
      continue
    }

    // Chair-only continuation row: nothing in c0-c4, only c5 has names.
    // Attach to the most recent block or section.
    if (!c0 && !c1 && !c2 && !c3 && !c4 && c5) {
      const cleaned = cleanChair(c5)
      if (cleaned) {
        for (let i = current.rows.length - 1; i >= 0; i--) {
          const prev = current.rows[i]
          if (prev.kind === "block" || prev.kind === "section") {
            prev.chair = prev.chair ? `${prev.chair}, ${cleaned}` : cleaned
            break
          }
        }
      }
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
        // A note row can also carry chairs for the previous block; attach.
        const chairFromNote = cleanChair(c5)
        if (chairFromNote) {
          for (let i = current.rows.length - 2; i >= 0; i--) {
            const prev = current.rows[i]
            if (prev.kind === "block" || prev.kind === "section") {
              prev.chair = prev.chair ? `${prev.chair}, ${chairFromNote}` : chairFromNote
              break
            }
          }
        }
        continue
      }
      // "MODERATORS [FOR LIVE]:" line attaches to the previous block as its
      // moderators roster rather than creating a new section — keeps the
      // LIVE SURGERY block on Screens 1 & 2 from splintering into 3 sections.
      // Also tag the preceding section/block with the time so splitDayForPlenary
      // can bucket the whole group into the right band.
      if (c2 && /^MODERATORS?\b/i.test(c2)) {
        const cleaned = c2
          .replace(/^MODERATORS?(?:\s+FOR\s+LIVE)?\s*[:\-]?\s*/i, "")
          .trim()
        const last = current.rows[current.rows.length - 1]
        if (last && last.kind === "section" && !last.note && looksLikeTime(c1Fixed)) {
          last.note = c1Fixed
        }
        if (last && last.kind === "block" && !last.blockTime && looksLikeTime(c1Fixed)) {
          last.blockTime = c1Fixed
        }
        current.rows.push({
          kind: "talk",
          time: looksLikeTime(c1Fixed) ? c1Fixed : undefined,
          topic: "Moderators",
          speaker: cleaned,
        })
        continue
      }
      // Strip "(SCREEN N)" / "(SCREEN N & M)" source markers from session
      // titles — these are internal scheduling notes, not display labels.
      const rawTitle = (c2 || c1Fixed).replace(/\s*\(\s*SCREEN[^)]*\)\s*/gi, "").trim()
      const title = rawTitle || c1Fixed
      const note = c2 && c1Fixed && c1Fixed !== c2 ? c1Fixed : undefined
      // Capture moderators (c3) on a section header — the sheet uses c3 for
      // panel moderators which would otherwise be discarded.
      const chair = cleanChair(c3) || cleanChair(c5)
      // Skip a duplicate "LIVE SURGER…" header that immediately follows a
      // section with the same root — the surgery sheet emits a 3-row LIVE
      // SURGERY block and we already absorbed the first row.
      const last = current.rows[current.rows.length - 1]
      if (
        last &&
        last.kind === "section" &&
        /^live\s+surger/i.test(last.title) &&
        /^live\s+surger/i.test(title) &&
        !note
      ) {
        // Prefer the more canonical short form ("Live Surgeries" over
        // "Live Surgery").
        if (title.length > last.title.length) last.title = title
        continue
      }
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
      const finalTitle = title || "LIVE SURGERIES"
      // Drop note entries that just repeat the title (case-insensitive).
      const filteredNotes = notes.filter(
        (n) => n.toLowerCase().trim() !== finalTitle.toLowerCase().trim(),
      )
      current.rows.push({
        kind: "block",
        blockTime: time,
        rangeOrNote: filteredNotes.join(" • "),
        sessionTitle: finalTitle,
      })
      if (surgeons) {
        current.rows.push({
          kind: "talk",
          topic: "Moderators",
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
    if (/\bDAY\s*2\b/i.test(rowJoined(r)) && (current.rows.length || pendingBlock)) {
      flush()
      current = { label: "Day 2", rows: [] }
      days.push(current)
      continue
    }

    // Only treat the row as LIVE SURGERIES-block content when its first listed
    // column has data OR one of the listed columns starts with "MODERATORS".
    // Rows where only later columns have data are structured talks handled by
    // parseScreen2Structured (e.g. the 5:45-6 PM MERIL entries at col 8-10).
    const firstColVal = clean(r[cols[0]])
    const hasModeratorsMarker = cols.some((c) =>
      /^MODERATORS?\b/i.test(clean(r[c])),
    )
    if (!firstColVal && !hasModeratorsMarker) continue

    const vals = cols
      .map((c) => clean(r[c]))
      .filter((v) => {
        if (!v) return false
        if (/^screen\s*\d+$/i.test(v)) return false
        // Strip stray email addresses and TNMC-like "name - 12345" IDs that
        // leak in from adjacent contact-detail columns.
        if (/\S+@\S+\.\S+/.test(v)) return false
        if (/^[a-z]+\s*-\s*\d{4,}/i.test(v) && v.length < 40) return false
        return true
      })
    if (vals.length === 0) continue

    // Treat consecutive non-empty cells as part of the same block
    if (!pendingBlock) pendingBlock = { notes: [] }
    for (const v of vals) {
      if (looksLikeBlockTime(v) || looksLikeTime(v)) {
        pendingBlock.time = pendingBlock.time ? `${pendingBlock.time} / ${v}` : v
      } else if (/^\(.*\)$/.test(v)) {
        pendingBlock.notes.push(v)
      } else if (/\b(LIVE\s+SURGER\w*|SURGER(?:Y|IES)|SESSION|MASTERCLASS)\b/i.test(v) && v.length < 60) {
        pendingBlock.title = v
      } else if (/^MODERATORS?\b/i.test(v) || (/Dr[.\s]/i.test(v) && v.length > 30)) {
        // Strip the "MODERATORS [FOR LIVE]:" prefix so the rendered roster
        // shows just the names — the label is supplied by the topic field.
        const cleaned = v
          .replace(/^MODERATORS?(?:\s+FOR\s+LIVE)?\s*[:\-]?\s*/i, "")
          .replace(/^-+|-+$/g, "")
          .trim()
        if (cleaned) {
          pendingBlock.surgeons = pendingBlock.surgeons
            ? `${pendingBlock.surgeons}, ${cleaned}`
            : cleaned
        }
      } else {
        pendingBlock.notes.push(v)
      }
    }
  }
  flush()
  return days.filter((d) => d.rows.length > 0)
}

// Screen 2 also carries one-off structured talks at cols 8-10
//   col 8 = time, col 9 = topic, col 10 = speaker
// — e.g. the 5:45–6 PM MERIL Robotic Console Inauguration on Day 1 evening.
// Row 62 is a continuation (no time) that reuses the previous talk's slot.
function parseScreen2Structured(csv: string): Day[] {
  const rows = parseCsv(csv)
  const days: Day[] = [{ label: "Day 1", rows: [] }]
  let current = days[0]
  let stop = false
  let lastTime: string | undefined

  for (const r of rows) {
    if (stop) break
    const joined = rowJoined(r)
    if (/online\s*talks/i.test(joined)) {
      stop = true
      continue
    }
    if (/\bDAY\s*2\b/i.test(joined) && current.rows.length) {
      current = { label: "Day 2", rows: [] }
      days.push(current)
      lastTime = undefined
      continue
    }

    const c8 = clean(r[8])
    const c9 = clean(r[9])
    const c10 = clean(r[10])

    // Don't treat the LIVE SURGERIES moderator row (c9 starts with MODERATORS)
    // or column headers as structured talks.
    if (c9 && /^(MODERATORS?|SCREEN\s*\d)/i.test(c9)) continue

    if (c8 && (looksLikeBlockTime(c8) || looksLikeTime(c8)) && c9) {
      current.rows.push({
        kind: "talk",
        time: c8,
        topic: c9,
        speaker: c10 || undefined,
        screen: 2,
      })
      lastTime = c8
      continue
    }

    if (!c8 && c9 && c10 && lastTime) {
      current.rows.push({
        kind: "talk",
        time: lastTime,
        topic: c9,
        speaker: c10,
        screen: 2,
      })
      continue
    }
  }

  return days.filter((d) => d.rows.length > 0)
}

export function parseScreen2(csv: string): Day[] {
  // Screen 2 has two co-existing layouts in the same column range:
  //   – sparse rows 20-22 carrying the LIVE SURGERIES 11 AM–3 PM block
  //   – structured rows (cols 8-10) carrying individual evening talks
  // Merge both into the same day list.
  const sparse = parseSparseScreen(csv, [7, 8, 9])
  const structured = parseScreen2Structured(csv)
  const dayMap = new Map<string, Day>()
  for (const d of sparse) dayMap.set(d.label, { label: d.label, rows: [...d.rows] })
  for (const d of structured) {
    const existing = dayMap.get(d.label)
    if (existing) existing.rows.push(...d.rows)
    else dayMap.set(d.label, { label: d.label, rows: [...d.rows] })
  }
  return Array.from(dayMap.values())
}

// Screen 3 grew its own structured grid: col 15 = time, col 16 = topic,
// col 17 = speaker, col 18 = chair. Parse it like the main lecture column
// rather than as sparse data.
export function parseScreen3(csv: string): Day[] {
  const rows = parseCsv(csv)
  const days: Day[] = [{ label: "Day 1", rows: [] }]
  let current = days[0]
  let stop = false

  const skipPatterns = (v: string) =>
    /\S+@\S+\.\S+/.test(v) || /^[a-z]+\s*-\s*\d{4,}/i.test(v)

  for (const r of rows) {
    if (stop) break
    const joined = rowJoined(r)
    if (/online\s*talks/i.test(joined)) {
      stop = true
      continue
    }
    if (/\bDAY\s*2\b/i.test(joined) && current.rows.length) {
      current = { label: "Day 2", rows: [] }
      days.push(current)
      continue
    }

    const c15 = clean(r[15])
    const c16 = clean(r[16])
    const c17 = clean(r[17])
    const c18 = clean(r[18])

    if (!c15 && !c16 && !c17 && !c18) continue
    if (/^screen\s*\d+$/i.test(c16) || /^speakers?$/i.test(c17) || /^chairpersons?$/i.test(c18)) continue
    if ((c16 && skipPatterns(c16)) || (c17 && skipPatterns(c17))) continue

    // Row carrying just a block time in c16 (e.g. "11 AM ----3.00 PM").
    if (!c15 && looksLikeBlockTime(c16) && !c17 && !c18) {
      current.rows.push({
        kind: "block",
        blockTime: c16,
        rangeOrNote: "",
        sessionTitle: "",
      })
      continue
    }

    // Title-only row attaches to a preceding title-less block. Skip "DAY N"
    // header labels — they're column markers, not session titles.
    if (!c15 && c16 && !c17 && !c18 && !looksLikeTime(c16)) {
      if (/^DAY\s*\d+\b/i.test(c16)) continue
      const last = current.rows[current.rows.length - 1]
      if (last && last.kind === "block" && !last.sessionTitle) {
        last.sessionTitle = c16
      } else {
        current.rows.push({ kind: "section", title: c16 })
      }
      continue
    }

    // Full talk: time + topic (+ optional speaker, chair).
    if (c15 && c16) {
      current.rows.push({
        kind: "talk",
        time: c15,
        topic: c16,
        speaker: c17 || undefined,
        chair: cleanChair(c18),
      })
      continue
    }

    // Chair-only continuation.
    if (!c15 && !c16 && !c17 && c18) {
      const cleaned = cleanChair(c18)
      if (cleaned) {
        for (let i = current.rows.length - 1; i >= 0; i--) {
          const prev = current.rows[i]
          if (prev.kind === "talk" || prev.kind === "block" || prev.kind === "section") {
            prev.chair = prev.chair ? `${prev.chair}, ${cleaned}` : cleaned
            break
          }
        }
      }
      continue
    }
  }

  // Default any title-less blocks to "LIVE SURGERIES".
  for (const day of days) {
    for (const row of day.rows) {
      if (row.kind === "block" && !row.sessionTitle) row.sessionTitle = "LIVE SURGERIES"
    }
  }

  // Skip hoistChairs — Screen 3 talks have per-talk chairs that should stay
  // attached to their individual talks, not aggregate to the session header.
  return days.filter((d) => d.rows.length > 0)
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
      // Day 1 row also carries a single live-surgery block. Render only the
      // block + chair list — the c2 speaker (e.g. Dr. Kavitha Yogini) is also
      // a moderator-equivalent, so fold them in with the chairs to avoid a
      // misleading "Operating surgeon" sub-row.
      if (c1) {
        const chairs = [cleanChair(c4), cleanChair(c2)].filter(Boolean) as string[]
        current!.rows.push({
          kind: "block",
          rangeOrNote: c0,
          sessionTitle: c1,
          chair: chairs.length ? chairs.join(", ") : undefined,
        })
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
    // Time-only row (c0 has a time range, rest empty) — the SESSION title was
    // erased from the sheet. Emit a section divider so the talks beneath it
    // hoist their chairs to this header instead of staying on the first talk.
    if (c0 && !c1 && !c2 && !c4 && /\d/.test(c0)) {
      // c0 may carry both time and title in one cell, like
      // "9.00 AM to 9.45 AM SESSION 1 - THE FUTURE BEGINS HERE ...".
      // Split the time prefix into a note so the title renders cleanly.
      const split = c0.match(
        /^(\d[\d:.]*\s*(?:AM|PM)?\s*(?:to|[-–—])\s*\d[\d:.]*\s*(?:AM|PM)?)\s+(.+)$/i,
      )
      if (split) {
        current!.rows.push({ kind: "section", title: split[2], note: split[1] })
      } else {
        current!.rows.push({ kind: "section", title: c0 })
      }
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

    // Continuation of chairs from previous row (no c0/c1/c2, only c4) —
    // attach to the most recent talk OR block/section so multi-row slot-grouped
    // chair lists (e.g. DAY 2 LIVE SURGERY split into "… 11 AM-1 PM" and
    // "… 1PM-3PM") don't drop the second row.
    if (!c0 && !c1 && !c2 && c4) {
      const last = current!.rows[current!.rows.length - 1]
      if (last && (last.kind === "talk" || last.kind === "block" || last.kind === "section")) {
        const cleaned = last.kind === "talk" ? c4 : (cleanChair(c4) ?? "")
        if (cleaned) last.chair = last.chair ? `${last.chair}, ${cleaned}` : cleaned
      }
      continue
    }
  }

  return hoistChairs(days.filter((d) => d.rows.length > 0))
}
