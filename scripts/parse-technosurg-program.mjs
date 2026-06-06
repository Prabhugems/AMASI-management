#!/usr/bin/env node
/**
 * Parse the TechnoSurg program CSV and produce a preview of sessions
 * to be inserted. Does NOT touch the DB. Run again with --apply to insert.
 */
import fs from "node:fs"
import { parse } from "csv-parse/sync"
import { createClient } from "@supabase/supabase-js"

const env = {}
for (const line of fs.readFileSync("/Users/prabhubalasubramaniam/AMASI-management/.env.technosurg.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}

const CSV_PATH = "/Users/prabhubalasubramaniam/Downloads/New Microsoft Excel Worksheet.xlsx - Sheet1.csv"
const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"
const apply = process.argv.includes("--apply")

const csv = fs.readFileSync(CSV_PATH, "utf8")
const rows = parse(csv, { skip_empty_lines: false })

const DAY1 = "2026-06-19" // 19/06/26
const DAY2 = "2026-06-20" // 20/06/26

// Convert "9.00", "09.30", "9", "9:00" → "HH:MM" with am/pm awareness
function parseTimeHM(raw, periodHint) {
  if (!raw) return null
  let s = raw.trim().toLowerCase().replace(/\s+/g, "")
  // strip am/pm suffix (we have periodHint instead)
  const periodMatch = s.match(/(am|pm)$/)
  let period = periodMatch ? periodMatch[1] : periodHint
  s = s.replace(/(am|pm)$/, "")
  s = s.replace(":", ".")
  const [hStr, mStr] = s.split(".")
  let h = parseInt(hStr, 10)
  let m = mStr ? parseInt(mStr, 10) : 0
  if (Number.isNaN(h)) return null
  if (period === "pm" && h < 12) h += 12
  if (period === "am" && h === 12) h = 0
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
}

// Parse "9.00 - 9.15 am", "9.00-9.15 AM", "09.30 AM- 09.45 AM", "1-1.30 pm", "3 PM - 4.30 PM"
function parseTimeRange(raw) {
  if (!raw) return null
  const cleaned = raw.replace(/\s+/g, " ").trim().toLowerCase()
  // Split on "-" or "—" or "to" or "--"
  const parts = cleaned.split(/--|—|–|-|to/).map((s) => s.trim()).filter(Boolean)
  if (parts.length < 2) return null

  // Determine period from the second half if available
  const secondHasAM = /(am|pm)/.test(parts[1])
  const firstHasAM = /(am|pm)/.test(parts[0])
  const secondPeriod = parts[1].match(/(am|pm)/)?.[1] || null
  const firstPeriod = parts[0].match(/(am|pm)/)?.[1] || secondPeriod

  const start = parseTimeHM(parts[0], firstPeriod)
  const end = parseTimeHM(parts[1], secondPeriod || firstPeriod)
  if (!start || !end) return null
  return { start, end }
}

const sessions = []
let currentDay = null
let currentBlock = null

for (let i = 0; i < rows.length; i++) {
  const row = rows[i]
  const [colA, colB, colC, colD /* skip colE */] = row.map((c) => (c || "").trim())

  // Day header lives in column B usually: "DAY 1- 19/06/26"
  const dayMatch = (colA + " " + colB).match(/DAY\s*(\d)/i)
  if (dayMatch) {
    currentDay = dayMatch[1] === "1" ? DAY1 : DAY2
    currentBlock = null
    continue
  }

  // Skip header / blank rows
  if (!colA && !colB && !colC && !colD) continue
  if (colA === "TIME" || colB === "TOPIC") continue

  // Block header: TIME present but TOPIC is a category label (no speaker)
  // e.g. "9-9.30 am session" / "ICG Session"  OR  "11 am- 3 pm" / "LIVE SURGERIES"
  // Heuristic: if TIME exists AND TOPIC is uppercase / no speaker, treat as block.
  const looksLikeBlockHeader =
    colA && !colC && !colD &&
    (colB.toUpperCase() === colB || /SESSION|SURGERIES|BREAKOUT|VIDEO|QUIZ|INAUGURATION|BANQUET|LUNCH|VOTE|FLAGSHIP|ICG|ROBOTIC/i.test(colB))

  if (looksLikeBlockHeader && currentDay) {
    currentBlock = colB
    // Also push a "block" session
    const range = parseTimeRange(colA)
    if (range) {
      sessions.push({
        day: currentDay,
        date: currentDay,
        start_time: range.start,
        end_time: range.end,
        session_name: colB,
        session_type: "block",
        speakers: "",
        moderators: "",
        block: colB,
        source_row: i + 1,
      })
    } else {
      sessions.push({
        day: currentDay,
        date: currentDay,
        start_time: null,
        end_time: null,
        session_name: colB,
        session_type: "block",
        speakers: "",
        moderators: "",
        block: colB,
        source_row: i + 1,
      })
    }
    continue
  }

  // Note row with no time but a topic that's clearly a note (e.g. "(10+2 mins each)")
  if (!colA && colB.startsWith("(") && !colC) continue

  // Regular session row
  if (currentDay) {
    const range = parseTimeRange(colA) || { start: null, end: null }
    sessions.push({
      day: currentDay,
      date: currentDay,
      start_time: range.start,
      end_time: range.end,
      session_name: colB || "(unspecified)",
      session_type: "lecture",
      speakers: colC || "",
      moderators: colD || "",
      block: currentBlock,
      source_row: i + 1,
    })
  }
}

// Filter out empties
const cleaned = sessions.filter((s) => s.session_name && s.session_name !== "(unspecified)")

console.log(`Parsed ${cleaned.length} sessions:\n`)
let lastDay = null
for (const s of cleaned) {
  if (s.day !== lastDay) {
    console.log(`\n=== ${s.day} ===`)
    lastDay = s.day
  }
  const t = s.start_time ? `${s.start_time.slice(0, 5)}-${s.end_time?.slice(0, 5) || ""}` : "TBD"
  const speakers = s.speakers ? ` | spk: ${s.speakers.slice(0, 50)}` : ""
  const mods = s.moderators ? ` | mod: ${s.moderators.slice(0, 40)}` : ""
  console.log(`  ${t.padEnd(13)} [${s.session_type.padEnd(8)}] ${s.session_name.slice(0, 65)}${speakers}${mods}`)
}

if (!apply) {
  console.log("\nDRY RUN — run with --apply to insert into DB")
  process.exit(0)
}

// --- Apply ---
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const inserts = cleaned.map((s) => ({
  event_id: EVENT_ID,
  session_name: s.session_name,
  session_type: s.session_type,
  session_date: s.date,
  start_time: s.start_time,
  end_time: s.end_time,
  description: s.block ? `Block: ${s.block}` : null,
  speakers_text: s.speakers || null,
  moderators_text: s.moderators || null,
}))

const { data, error } = await db.from("sessions").insert(inserts).select("id")
if (error) {
  console.error("\nInsert error:", error)
  process.exit(1)
}
console.log(`\n✓ Inserted ${data.length} sessions on TechnoSurg`)
