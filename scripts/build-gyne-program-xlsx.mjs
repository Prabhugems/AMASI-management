#!/usr/bin/env node
/**
 * Parse the GYNE scientific programme CSV and emit a clean xlsx.
 *
 * Source columns: SESSION | TOPIC | SPEAKER | mail (Y/N) | CHAIRPERSONS | TNMC | MAIL ID
 *
 * Output sheets:
 *   Program     — one row per (session, person) with Day, Block, Start, End,
 *                 Duration, Role, Topic, Name, Email, TNMC, Mail Confirmed.
 *   People      — deduplicated unique speakers + chairpersons with their
 *                 best-known email + TNMC.
 */
import fs from "node:fs"
import { parse } from "csv-parse/sync"
import xlsx from "xlsx"

const CSV_PATH = "/Users/prabhubalasubramaniam/Downloads/gyn scientific programme - Sheet1.csv"
const OUT_PATH = "/Users/prabhubalasubramaniam/Downloads/gyne-program.xlsx"

const csv = fs.readFileSync(CSV_PATH, "utf8")
const rows = parse(csv, { skip_empty_lines: false })

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
  let s = raw.replace(/\s+/g, " ").trim().toLowerCase().replace(/—|–/g, "-")
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

// ---------- Extract emails / TNMCs from text blobs ----------
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

function extractEmails(text) {
  if (!text) return []
  return (text.match(EMAIL_RE) || []).map((e) => e.trim().toLowerCase())
}

// TNMC entries look like "name - NNNNN" or "name - NNNNN (state)" or "NAME - 12345"
function extractTnmcs(text) {
  if (!text) return []
  const out = []
  // Split on comma — each part is one entry
  for (const part of text.split(",")) {
    const m = part.trim().match(/^([A-Za-z. ]+?)\s*[-:]\s*([A-Z0-9\/]+)\s*(\([^)]+\))?$/)
    if (m) {
      out.push({ name: m[1].trim().toLowerCase(), tnmc: m[2].trim() })
    } else {
      const onlyNum = part.trim().match(/^([A-Z0-9\/]+)$/)
      if (onlyNum) out.push({ name: null, tnmc: onlyNum[1] })
    }
  }
  return out
}

// ---------- Name normalisation + matching ----------
const TITLE_RE = /\b(dr|prof|mr|mrs|ms|shri)\b\.?/gi
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

function splitNames(raw) {
  if (!raw) return []
  let s = raw
    .replace(/MODERATORS?\s*[:\-]/gi, "")
    .replace(/JUDGE/gi, "")
    .replace(/\bvs\b/gi, ",")
    .replace(/\b(For|Against|FOR|AGAINST)\s*[-–:]\s*/g, "")
    .replace(/\b(yes|y\/n)\b/gi, "")
  // Handle the role-prefixed format "DR. GYN - DR. KARTHIKHA" → "DR. KARTHIKHA"
  s = s.replace(/(COLORECTAL|UROLOGIST|FERTILITY EXPERT|GYN|DR\. GYN)\s*[-:]\s*/gi, "")
  const parts = s.split(/,|\||;|\//).map((x) => x.trim()).filter(Boolean)
  return parts
    .map((x) => x.replace(/^\s*-\s*/, "").trim())
    .filter((x) => {
      if (!x || x === "----") return false
      const norm = normalize(x)
      if (!norm) return false
      if (tokens(x).length === 0) return false
      // Discard tokens that are obviously not names (e.g. "PENDING")
      if (/^(pending|tbc|tbd)$/i.test(norm)) return false
      return true
    })
}

function findTnmcFor(speakerName, tnmcEntries) {
  const want = tokens(speakerName)
  if (!want.length) return null
  for (const e of tnmcEntries) {
    if (!e.name) continue
    const have = new Set(tokens(e.name))
    if (want.some((t) => have.has(t))) return e.tnmc
  }
  // Fallback: if only one entry, attach
  if (tnmcEntries.length === 1) return tnmcEntries[0].tnmc
  return null
}

function findEmailFor(speakerName, emails) {
  const want = tokens(speakerName)
  if (!want.length) return null
  for (const e of emails) {
    const local = e.split("@")[0].toLowerCase().replace(/[^a-z]/g, "")
    if (want.some((t) => local.includes(t.replace(/[^a-z]/g, "")))) return e
  }
  if (emails.length === 1) return emails[0]
  return null
}

// ---------- Walk rows ----------
const sessionRows = []
const peopleMap = new Map() // normalized name → { Name, Email, TNMC }
let currentDay = null
let currentBlock = null

function recordPerson(name, email, tnmc) {
  if (!name) return
  const key = normalize(name)
  if (!key) return
  const prev = peopleMap.get(key) || { Name: name, Email: "", TNMC: "" }
  if (email && !prev.Email) prev.Email = email
  if (tnmc && !prev.TNMC) prev.TNMC = tnmc
  if (name.length > prev.Name.length) prev.Name = name // prefer fuller spelling
  peopleMap.set(key, prev)
}

for (let i = 0; i < rows.length; i++) {
  const [colSession, colTopic, colSpeaker, colMail, colChair, colTnmc, colMailId] = rows[i].map((c) => (c || "").trim())

  // Skip blank rows
  if (!colSession && !colTopic && !colSpeaker && !colChair && !colTnmc && !colMailId) continue
  // Header
  if (colSession.toUpperCase() === "SESSION" && colTopic.toUpperCase() === "TOPIC") continue
  // Bottom-of-sheet roster table (DR | HOSP | CONTACT | ...) — skip
  if (/^DR\b/i.test(colSession) && /HOSP/i.test(colTopic)) {
    // From here on we're in the side-roster — stop processing as program rows
    break
  }

  // Day header
  const dayMatch = colSession.match(/^DAY\s*(\d)\b/i)
  if (dayMatch) {
    currentDay = `DAY ${dayMatch[1]}`
    currentBlock = null
    // Some day rows also include a time hint and a live-surgery topic, so don't skip
    if (!colTopic && !colSpeaker) continue
  }

  // Block header (rows where TOPIC carries the SESSION X title and other cols are empty)
  if (!colSession && colTopic && /SESSION\s*\d/i.test(colTopic) && !colSpeaker) {
    currentBlock = colTopic.replace(/\s+/g, " ").trim()
    continue
  }
  // Or block embedded in SESSION column without time (e.g. row 6)
  if (colSession && /SESSION\s*\d/i.test(colSession) && !colTopic && !colSpeaker) {
    currentBlock = colSession.replace(/\s+/g, " ").trim()
    continue
  }

  // Otherwise treat as a program row
  const range = parseTimeRange(colSession)
  const topic = colTopic.replace(/\s+/g, " ").trim()
  if (!topic && !colSpeaker && !colChair) continue

  const emails = extractEmails(colMailId)
  const tnmcs = extractTnmcs(colTnmc)
  const speakerNames = splitNames(colSpeaker)
  const chairNames = splitNames(colChair)

  if (!speakerNames.length) {
    sessionRows.push({
      Day: currentDay || "",
      Block: currentBlock || "",
      Start: range?.start || "",
      End: range?.end || "",
      "Duration (min)": range?.durationMin || "",
      Role: "Session",
      Topic: topic,
      Name: "",
      Email: "",
      "TNMC No": "",
      "Mail Confirmed": colMail || "",
    })
    continue
  }

  for (const n of speakerNames) {
    const email = findEmailFor(n, emails) || ""
    const tnmc = findTnmcFor(n, tnmcs) || ""
    sessionRows.push({
      Day: currentDay || "",
      Block: currentBlock || "",
      Start: range?.start || "",
      End: range?.end || "",
      "Duration (min)": range?.durationMin || "",
      Role: "Speaker",
      Topic: topic,
      Name: n,
      Email: email,
      "TNMC No": tnmc,
      "Mail Confirmed": colMail || "",
    })
    recordPerson(n, email, tnmc)
  }
  // Chairpersons intentionally skipped — output is speaker-only per user request.
}

// ---------- Write xlsx ----------
const wb = xlsx.utils.book_new()

const programSheet = xlsx.utils.json_to_sheet(sessionRows)
programSheet["!cols"] = [
  { wch: 8 }, { wch: 36 }, { wch: 7 }, { wch: 7 }, { wch: 8 },
  { wch: 12 }, { wch: 60 }, { wch: 28 }, { wch: 32 }, { wch: 14 }, { wch: 8 },
]
xlsx.utils.book_append_sheet(wb, programSheet, "Program")

const peopleRows = [...peopleMap.values()].sort((a, b) => a.Name.localeCompare(b.Name))
const peopleSheet = xlsx.utils.json_to_sheet(peopleRows)
peopleSheet["!cols"] = [{ wch: 32 }, { wch: 32 }, { wch: 16 }]
xlsx.utils.book_append_sheet(wb, peopleSheet, "People")

xlsx.writeFile(wb, OUT_PATH)

const matched = sessionRows.filter((r) => r.Name && (r.Email || r["TNMC No"])).length
const total = sessionRows.filter((r) => r.Name).length
console.log(`Program rows: ${sessionRows.length}`)
console.log(`People with name: ${total}  | with email or TNMC: ${matched}`)
console.log(`Unique people: ${peopleMap.size}`)
console.log(`\n✓ Wrote ${OUT_PATH}`)
