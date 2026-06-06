#!/usr/bin/env node
/**
 * Parse TechnoSurg program CSV, match each speaker/moderator against the
 * `faculty` table (primary source — 163 rows with rich contact data) and
 * `registrations` (fallback). Emit a clean xlsx with three sheets:
 *
 *   Program   — one row per (session, person) with Day, Block, Start, End,
 *               Duration, Role, Topic, Name, Email, Mobile.
 *   Speakers  — deduplicated list of every named speaker with their contact.
 *   Unmatched — names that couldn't be resolved (need manual lookup).
 */
import fs from "node:fs"
import { parse } from "csv-parse/sync"
import xlsx from "xlsx"
import { createClient } from "@supabase/supabase-js"

const env = {}
for (const line of fs.readFileSync("/Users/prabhubalasubramaniam/AMASI-management/.env.technosurg.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}

const CSV_PATH = "/Users/prabhubalasubramaniam/Downloads/New Microsoft Excel Worksheet.xlsx - Sheet1.csv"
const OUT_PATH = "/Users/prabhubalasubramaniam/Downloads/technosurg-program.xlsx"
const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"
const DAY1 = "19 Jun 2026"
const DAY2 = "20 Jun 2026"

// ---------- Time helpers ----------
function parseTimeHM(raw, periodHint) {
  if (!raw) return null
  let s = raw.trim().toLowerCase().replace(/\s+/g, "")
  const periodMatch = s.match(/(am|pm)$/)
  const period = periodMatch ? periodMatch[1] : periodHint
  s = s.replace(/(am|pm)$/, "").replace(":", ".")
  const [hStr, mStr] = s.split(".")
  let h = parseInt(hStr, 10)
  const m = mStr ? parseInt(mStr, 10) : 0
  if (Number.isNaN(h)) return null
  if (period === "pm" && h < 12) h += 12
  if (period === "am" && h === 12) h = 0
  if (h > 23 || m > 59) return null
  return { h, m, hhmm: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` }
}

function parseTimeRange(raw) {
  if (!raw) return null
  let s = raw.replace(/\s+/g, " ").trim().toLowerCase().replace(/—|–|--/g, "-")
  // "9:24-9-36 am" → "9:24-9.36 am"
  s = s.replace(/^(\d{1,2}[:.]\d{1,2})-(\d{1,2})-(\d{1,2})\b/, "$1-$2.$3")
  const parts = s.split(/-|to/).map((x) => x.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const secondPeriod = parts[1].match(/(am|pm)/)?.[1] || null
  const firstPeriod = parts[0].match(/(am|pm)/)?.[1] || secondPeriod
  const start = parseTimeHM(parts[0], firstPeriod)
  const end = parseTimeHM(parts[1], secondPeriod || firstPeriod)
  if (!start || !end) return null
  let durationMin = end.h * 60 + end.m - (start.h * 60 + start.m)
  if (durationMin < 0) durationMin += 24 * 60
  return { start: start.hhmm, end: end.hhmm, durationMin }
}

// ---------- Name normalisation + matching ----------
const TITLE_RE = /\b(dr|prof|mr|mrs|ms|shri)\b\.?/gi
const KNOWN_NON_NAMES = new Set([
  "aig", "namakkal", "iit prof", "kochi", "amritha kochi", "amritha", "alumni",
  "taso secretary", "secretary",
])

function normalize(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[.,()]/g, " ")
    .replace(TITLE_RE, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokens(name) {
  return normalize(name).split(/\s+/).filter((t) => t.length >= 3)
}

function cleanSplitName(raw) {
  if (!raw) return ""
  // Strip a trailing institution after comma: "Dr X, Namakkal" → "Dr X"
  let out = raw.trim()
  // Drop parenthetical: "(Amritha, Kochi)" → ""
  out = out.replace(/\s*\([^)]*\)\s*/g, " ").trim()
  // If the part after the last comma looks like an institution/city (single short word), drop it
  const lastComma = out.lastIndexOf(",")
  if (lastComma >= 0) {
    const tail = out.slice(lastComma + 1).trim()
    if (tail.split(/\s+/).length <= 2 && !/\bdr\b/i.test(tail)) {
      out = out.slice(0, lastComma).trim()
    }
  }
  return out
}

function splitNames(raw) {
  if (!raw) return []
  let s = raw
    .replace(/^MODERATOR\s*[:\-]?\s*/i, "")
    .replace(/\b(For|Against|FOR|AGAINST)\s*[-–:]\s*/g, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
  // Split on commas/pipes — keep "Dr Foo Dr Bar" as a single token (rare in CSV)
  const parts = s.split(/,|\|/).map((x) => x.trim()).filter(Boolean)
  return parts
    .map(cleanSplitName)
    .filter((x) => {
      if (!x || x === "----") return false
      const norm = normalize(x)
      if (!norm) return false
      if (KNOWN_NON_NAMES.has(norm)) return false
      // Reject single tokens shorter than 3 chars (e.g. "Mr", just titles)
      if (tokens(x).length === 0) return false
      return true
    })
}

// ---------- DB lookups ----------
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: faculty } = await db
  .from("faculty")
  .select("name, email, phone, whatsapp")
const { data: regs } = await db
  .from("registrations")
  .select("attendee_name, attendee_email, attendee_phone")
  .eq("event_id", EVENT_ID)

const candidates = [
  ...(faculty || []).map((f) => ({
    source: "faculty",
    name: f.name,
    email: f.email,
    phone: f.phone || f.whatsapp,
  })),
  ...(regs || []).map((r) => ({
    source: "registration",
    name: r.attendee_name,
    email: r.attendee_email,
    phone: r.attendee_phone,
  })),
]

function findMatch(searchName) {
  const want = tokens(searchName)
  if (!want.length) return null
  let best = null
  let bestScore = 0
  for (const c of candidates) {
    const have = new Set(tokens(c.name))
    if (have.size === 0) continue
    const overlap = want.filter((t) => have.has(t)).length
    // Require all search tokens matched (when search has 1-2 tokens) or majority for longer names
    const required = want.length <= 2 ? want.length : Math.ceil(want.length * 0.6)
    if (overlap >= required && overlap > bestScore) {
      bestScore = overlap
      best = c
    }
  }
  return best
}

// ---------- Parse CSV into sessions ----------
const csv = fs.readFileSync(CSV_PATH, "utf8")
const rows = parse(csv, { skip_empty_lines: false })

const sessions = []
let currentDay = null
let currentBlock = null

for (let i = 0; i < rows.length; i++) {
  const [colA, colB, colC, colD] = rows[i].map((c) => (c || "").trim())
  const dayMatch = (colA + " " + colB).match(/DAY\s*(\d)/i)
  if (dayMatch) {
    currentDay = dayMatch[1] === "1" ? DAY1 : DAY2
    currentBlock = null
    continue
  }
  if (!colA && !colB && !colC && !colD) continue
  if (colA === "TIME" || colB === "TOPIC") continue
  if (!colA && colB.startsWith("(") && !colC) continue

  const blockLike =
    colA && !colC && !colD &&
    (colB.toUpperCase() === colB || /SESSION|SURGERIES|BREAKOUT|VIDEO|QUIZ|INAUGURATION|BANQUET|LUNCH|VOTE|FLAGSHIP/i.test(colB))
  const range = parseTimeRange(colA)

  if (blockLike && currentDay) {
    currentBlock = colB
    sessions.push({
      day: currentDay,
      block: colB,
      start: range?.start || "",
      end: range?.end || "",
      duration: range?.durationMin || "",
      role: "Block",
      topic: colB,
      name: "",
    })
    continue
  }

  if (currentDay) {
    const speakerNames = splitNames(colC)
    const moderatorNames = splitNames(colD)
    const peopleRows = []
    if (!speakerNames.length && !moderatorNames.length) {
      peopleRows.push({ role: "Session", name: "" })
    }
    for (const n of speakerNames) peopleRows.push({ role: "Speaker", name: n })
    for (const n of moderatorNames) peopleRows.push({ role: "Moderator", name: n })
    for (const p of peopleRows) {
      sessions.push({
        day: currentDay,
        block: currentBlock || "",
        start: range?.start || "",
        end: range?.end || "",
        duration: range?.durationMin || "",
        role: p.role,
        topic: colB,
        name: p.name,
      })
    }
  }
}

// ---------- Resolve contacts ----------
let matched = 0, unmatched = 0
const unmatchedSet = new Set()
const programRows = []
const speakerMap = new Map() // dedupe by lowercased name

for (const s of sessions) {
  let email = "", phone = "", source = ""
  if (s.name) {
    const hit = findMatch(s.name)
    if (hit) {
      email = hit.email || ""
      phone = hit.phone || ""
      source = hit.source
      matched++
    } else {
      unmatched++
      unmatchedSet.add(s.name)
    }
    // Track in dedupe
    const key = normalize(s.name)
    if (key && !speakerMap.has(key)) {
      speakerMap.set(key, { Name: s.name, Email: email, Mobile: phone, Source: source })
    }
  }
  programRows.push({
    Day: s.day,
    Block: s.block,
    Start: s.start,
    End: s.end,
    "Duration (min)": s.duration,
    Role: s.role,
    Topic: s.topic,
    Name: s.name,
    Email: email,
    Mobile: phone,
  })
}

console.log(`Sessions/people rows: ${sessions.length}`)
console.log(`Speakers + moderators rows: ${sessions.filter((s) => s.name).length}`)
console.log(`  Matched: ${matched}`)
console.log(`  Unmatched: ${unmatched}`)
console.log(`Unique names: ${speakerMap.size}`)
console.log(`Unique unmatched names: ${unmatchedSet.size}`)

// ---------- Write xlsx ----------
const wb = xlsx.utils.book_new()

const programSheet = xlsx.utils.json_to_sheet(programRows)
programSheet["!cols"] = [
  { wch: 12 }, { wch: 28 }, { wch: 7 }, { wch: 7 }, { wch: 8 },
  { wch: 10 }, { wch: 60 }, { wch: 28 }, { wch: 32 }, { wch: 14 },
]
xlsx.utils.book_append_sheet(wb, programSheet, "Program")

const speakersRows = [...speakerMap.values()].sort((a, b) => a.Name.localeCompare(b.Name))
const speakersSheet = xlsx.utils.json_to_sheet(speakersRows)
speakersSheet["!cols"] = [{ wch: 32 }, { wch: 32 }, { wch: 14 }, { wch: 14 }]
xlsx.utils.book_append_sheet(wb, speakersSheet, "Speakers")

const unmatchedRows = [...unmatchedSet].sort().map((n) => ({ Name: n }))
const unmatchedSheet = xlsx.utils.json_to_sheet(unmatchedRows)
unmatchedSheet["!cols"] = [{ wch: 40 }]
xlsx.utils.book_append_sheet(wb, unmatchedSheet, "Unmatched")

xlsx.writeFile(wb, OUT_PATH)
console.log(`\n✓ Wrote ${OUT_PATH}`)
