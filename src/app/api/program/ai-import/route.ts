import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { parse } from "csv-parse/sync"

/**
 * AI-Powered Program Import
 *
 * This endpoint intelligently analyzes CSV files to:
 * 1. Auto-detect column types (date, time, hall, speaker, email, phone, role)
 * 2. Extract unique halls and create hall coordinators
 * 3. Parse faculty with contact info
 * 4. Create sessions with proper relationships
 */

type ColumnType = "date" | "time" | "topic" | "hall" | "session" | "name" | "email" | "phone" | "role" | "unknown"

type DetectedColumn = {
  header: string
  type: ColumnType
  confidence: number
  sampleValues: string[]
}

type CSVRow = Record<string, string>

// AI Column Detection - Pattern Recognition
function detectColumnType(header: string, values: string[]): DetectedColumn {
  const h = header.toLowerCase().trim()
  const sampleValues = values.slice(0, 10).filter(v => v?.trim())

  // Date detection
  if (h.includes("date") || h === "day" || h.includes("schedule")) {
    return { header, type: "date", confidence: 95, sampleValues }
  }
  // Check values for date patterns
  const datePattern = /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2}/
  if (sampleValues.some(v => datePattern.test(v))) {
    return { header, type: "date", confidence: 85, sampleValues }
  }

  // Time detection
  if (h.includes("time") || h === "slot" || h.includes("timing")) {
    return { header, type: "time", confidence: 95, sampleValues }
  }
  // Check for time patterns
  const timePattern = /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}|\d{1,2}:\d{2}/
  if (sampleValues.some(v => timePattern.test(v))) {
    return { header, type: "time", confidence: 85, sampleValues }
  }

  // Hall/Venue detection
  if (h.includes("hall") || h.includes("venue") || h.includes("room") || h.includes("auditorium") || h.includes("location")) {
    return { header, type: "hall", confidence: 95, sampleValues }
  }
  // Check for hall-like values
  const hallPattern = /hall|room|auditorium|theater|theatre|venue|ballroom|conference/i
  if (sampleValues.some(v => hallPattern.test(v))) {
    return { header, type: "hall", confidence: 75, sampleValues }
  }

  // Email detection
  if (h.includes("email") || h.includes("e-mail") || h.includes("mail id")) {
    return { header, type: "email", confidence: 95, sampleValues }
  }
  // Check for email patterns
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  if (sampleValues.some(v => emailPattern.test(v))) {
    return { header, type: "email", confidence: 90, sampleValues }
  }

  // Phone detection
  if (h.includes("phone") || h.includes("mobile") || h.includes("contact") || h.includes("cell") || h.includes("tel")) {
    return { header, type: "phone", confidence: 95, sampleValues }
  }
  // Check for phone patterns (10+ digits)
  const phonePattern = /[\d\s+()-]{10,}/
  if (sampleValues.some(v => phonePattern.test(v) && /\d{10,}/.test(v.replace(/\D/g, "")))) {
    return { header, type: "phone", confidence: 85, sampleValues }
  }

  // Role detection
  if (h.includes("role") || h.includes("designation") || h.includes("position") || h.includes("type") && h.includes("speaker")) {
    return { header, type: "role", confidence: 95, sampleValues }
  }
  // Check for role-like values
  const rolePattern = /speaker|chairperson|moderator|panelist|faculty|presenter|coordinator|chair/i
  if (sampleValues.some(v => rolePattern.test(v))) {
    return { header, type: "role", confidence: 80, sampleValues }
  }

  // Topic/Title detection (usually longer text)
  if (h.includes("topic") || h.includes("title") || h.includes("subject") || h.includes("presentation")) {
    return { header, type: "topic", confidence: 95, sampleValues }
  }

  // Session/Track detection - BUT check if values are long text (then it's actually a topic)
  if ((h.includes("session") || h.includes("track") || h.includes("category")) && !h.includes("name")) {
    // If values are long (>30 chars avg), it's a topic/title, not a track number
    const avgLength = sampleValues.reduce((acc, v) => acc + v.length, 0) / (sampleValues.length || 1)
    if (avgLength > 30) {
      return { header, type: "topic", confidence: 85, sampleValues }
    }
    // Short values like "Session 1", "Track A" - treat as track
    return { header, type: "session", confidence: 90, sampleValues }
  }

  // Name detection (speaker/faculty name)
  if (h === "name" || h.includes("speaker") || h.includes("faculty") || h.includes("presenter") || h.includes("full name")) {
    return { header, type: "name", confidence: 90, sampleValues }
  }
  // Check if values look like person names (2-3 words, capitalized)
  const namePattern = /^[A-Z][a-z]+(\s+[A-Z][a-z]+){0,3}$/
  if (sampleValues.filter(v => namePattern.test(v.trim())).length >= sampleValues.length * 0.5) {
    return { header, type: "name", confidence: 70, sampleValues }
  }

  // Topic detection for longer text values
  const avgLength = sampleValues.reduce((acc, v) => acc + v.length, 0) / (sampleValues.length || 1)
  if (avgLength > 50 && !h.includes("description")) {
    return { header, type: "topic", confidence: 60, sampleValues }
  }

  return { header, type: "unknown", confidence: 0, sampleValues }
}

// Normalize name for matching
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ")
}

// Clean phone number
function cleanPhone(phone: string | undefined): string | null {
  if (!phone) return null
  let cleaned = phone.replace(/[^0-9+]/g, "")
  if (cleaned.length === 10 && !cleaned.startsWith("+")) {
    cleaned = "+91" + cleaned
  }
  return cleaned.length >= 10 ? cleaned : null
}

// Parse date to YYYY-MM-DD
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null

  // DD.MM.YYYY
  let match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`

  // DD/MM/YYYY
  match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`

  // DD-MM-YYYY
  match = dateStr.match(/(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`

  // YYYY-MM-DD (already correct)
  match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (match) return match[0]

  return null
}

// Parse time range and calculate duration
function parseTime(timeStr: string): { start: string | null; end: string | null; duration: number | null } {
  if (!timeStr) return { start: null, end: null, duration: null }

  // Range format: HH:MM - HH:MM
  const rangeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/)
  if (rangeMatch) {
    const startH = parseInt(rangeMatch[1])
    const startM = parseInt(rangeMatch[2])
    const endH = parseInt(rangeMatch[3])
    const endM = parseInt(rangeMatch[4])
    const duration = (endH * 60 + endM) - (startH * 60 + startM)
    return {
      start: `${rangeMatch[1].padStart(2, "0")}:${rangeMatch[2]}:00`,
      end: `${rangeMatch[3].padStart(2, "0")}:${rangeMatch[4]}:00`,
      duration: duration > 0 ? duration : null,
    }
  }

  // Single time: HH:MM
  const singleMatch = timeStr.match(/(\d{1,2}):(\d{2})/)
  if (singleMatch) {
    const time = `${singleMatch[1].padStart(2, "0")}:${singleMatch[2]}:00`
    return { start: time, end: time, duration: null }
  }

  return { start: null, end: null, duration: null }
}

// Convert time string to minutes
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + (m || 0)
}

// Convert minutes to time string
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:00`
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check - only authenticated users can import programs
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - please login to import program data' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const eventId = formData.get("event_id") as string
    const clearExisting = formData.get("clear_existing") === "true"
    const createCoordinators = formData.get("create_coordinators") !== "false"
    const createRegistrations = formData.get("create_registrations") !== "false"

    if (!file || !eventId) {
      return NextResponse.json({ error: "File and event_id are required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Parse CSV
    const text = await file.text()
    const records: CSVRow[] = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    })

    if (records.length === 0) {
      return NextResponse.json({ error: "CSV file is empty" }, { status: 400 })
    }

    // AI Column Detection
    const headers = Object.keys(records[0])
    const columnValues: Record<string, string[]> = {}
    headers.forEach(h => {
      columnValues[h] = records.map(r => r[h] || "").filter(v => v.trim())
    })

    const detectedColumns = headers.map(h => detectColumnType(h, columnValues[h]))

    // Find best column for each type
    const findBestColumn = (type: ColumnType): string | null => {
      const matches = detectedColumns.filter(c => c.type === type).sort((a, b) => b.confidence - a.confidence)
      return matches[0]?.header || null
    }

    const columnMap = {
      date: findBestColumn("date"),
      time: findBestColumn("time"),
      topic: findBestColumn("topic"),
      hall: findBestColumn("hall"),
      session: findBestColumn("session"),
      name: findBestColumn("name"),
      email: findBestColumn("email"),
      phone: findBestColumn("phone"),
      role: findBestColumn("role"),
    }

    // Extract unique halls
    const halls = new Set<string>()
    if (columnMap.hall) {
      records.forEach(r => {
        const hall = r[columnMap.hall!]?.trim()
        if (hall) halls.add(hall)
      })
    }

    // Extract unique tracks/sessions with metadata (description + chairpersons with contacts)
    const tracks = new Set<string>()
    type TrackChairperson = { name: string; email: string | null; phone: string | null }
    type TrackMetadata = {
      name: string
      description: string | null
      chairpersons: TrackChairperson[]
    }
    const trackMetadataMap = new Map<string, TrackMetadata>()

    if (columnMap.session) {
      // First pass: collect track names and metadata
      // Track headers are detected by:
      // 1. No speaker name (header row with just track info)
      // 2. OR role = Chairperson (defines track chairpersons)
      records.forEach(r => {
        const track = r[columnMap.session!]?.trim()
        if (track) {
          tracks.add(track)

          // Initialize track metadata if not exists
          if (!trackMetadataMap.has(track)) {
            trackMetadataMap.set(track, {
              name: track,
              description: null,
              chairpersons: []
            })
          }

          const role = columnMap.role ? r[columnMap.role]?.trim()?.toLowerCase() : ""
          const name = columnMap.name ? r[columnMap.name]?.trim() : null
          const email = columnMap.email ? r[columnMap.email]?.trim() : null
          const phone = columnMap.phone ? cleanPhone(r[columnMap.phone]) : null
          const topic = columnMap.topic ? r[columnMap.topic]?.trim() : null
          const isChairperson = role.includes("chair") || role.includes("coordinator")

          const meta = trackMetadataMap.get(track)!

          // Case 1: Row has chairperson role - collect chairpersons with contacts and use topic as description
          if (isChairperson) {
            if (topic && !meta.description) {
              meta.description = topic
            }
            if (name && !meta.chairpersons.some(c => c.name === name)) {
              meta.chairpersons.push({ name, email: email || null, phone: phone || null })
            }
          }
          // Case 2: Row has NO speaker name - this is a track header row
          // Use its topic as the track description
          else if (!name && topic) {
            if (!meta.description) {
              meta.description = topic
            }
          }
        }
      })
    }

    // Collect faculty info
    type FacultyInfo = { name: string; email: string | null; phone: string | null; role: string }
    const facultyMap = new Map<string, FacultyInfo>()

    // Collect sessions with contact details
    type PersonDetail = { name: string; email: string | null; phone: string | null }
    type SessionData = {
      event_id: string
      session_name: string
      session_type: string
      session_date: string | null
      start_time: string | null
      end_time: string | null
      duration_minutes: number | null
      hall: string | null
      specialty_track: string | null
      speakers: PersonDetail[]
      chairpersons: PersonDetail[]
      moderators: PersonDetail[]
      panelists: PersonDetail[]
    }

    const sessionMap = new Map<string, SessionData>()

    // Timing analysis
    type TimingIssue = {
      type: "overlap" | "gap" | "long_session" | "faculty_conflict"
      hall: string
      date: string
      session1: string
      session2?: string
      faculty?: string
      details: string
    }
    const timingIssues: TimingIssue[] = []

    // Track faculty schedules for conflict detection
    type FacultySchedule = { date: string; start: number; end: number; session: string; hall: string }
    const facultySchedules = new Map<string, FacultySchedule[]>()

    // Debug: Log first row to see what's being read
    if (records.length > 0) {
      console.log("Column Map:", columnMap)
      console.log("First row keys:", Object.keys(records[0]))
      console.log("First row session column value:", columnMap.session ? records[0][columnMap.session] : "NO SESSION COLUMN")
    }

    records.forEach(row => {
      // Extract data using detected columns
      const date = columnMap.date ? parseDate(row[columnMap.date]) : null
      const time = columnMap.time ? parseTime(row[columnMap.time]) : { start: null, end: null, duration: null }
      const topic = columnMap.topic ? row[columnMap.topic]?.trim() : null
      const hall = columnMap.hall ? row[columnMap.hall]?.trim() : null
      const session = columnMap.session ? row[columnMap.session]?.trim() : null
      const name = columnMap.name ? row[columnMap.name]?.trim() : null
      const email = columnMap.email ? row[columnMap.email]?.trim() : null
      const phone = columnMap.phone ? cleanPhone(row[columnMap.phone]) : null
      const role = columnMap.role ? row[columnMap.role]?.trim() || "Speaker" : "Speaker"
      const roleLower = role.toLowerCase()
      const isChairperson = roleLower.includes("chair") || roleLower.includes("coordinator")

      // Check if this is a track metadata row (not an individual talk)
      // Track metadata rows are:
      // 1. Chairperson rows (topic matches track description)
      // 2. Header rows with no speaker name
      const trackMeta = session ? trackMetadataMap.get(session) : null
      const isChairpersonTrackRow = isChairperson && trackMeta && trackMeta.description === topic
      const isHeaderRow = !name && trackMeta && trackMeta.description === topic
      const isTrackMetadataRow = isChairpersonTrackRow || isHeaderRow

      // Add faculty
      if (name) {
        const key = normalizeName(name)
        if (!facultyMap.has(key)) {
          facultyMap.set(key, { name, email: email || null, phone, role })
        } else {
          const existing = facultyMap.get(key)!
          if (!existing.email && email) existing.email = email
          if (!existing.phone && phone) existing.phone = phone
        }

        // Track faculty schedule for conflict detection (skip track metadata rows)
        if (date && time.start && time.end && !isTrackMetadataRow) {
          const facultyKey = normalizeName(name)
          if (!facultySchedules.has(facultyKey)) {
            facultySchedules.set(facultyKey, [])
          }
          facultySchedules.get(facultyKey)!.push({
            date,
            start: timeToMinutes(time.start),
            end: timeToMinutes(time.end),
            session: topic || "Unknown",
            hall: hall || "Unknown",
          })
        }
      }

      // Skip creating session for track-level chairperson rows (e.g., "Safety in MIS HPB" with chairpersons)
      // These rows define track metadata, not individual talks
      if (isTrackMetadataRow) {
        return // Skip this row for session creation
      }

      // Create session key
      if (topic && date && time.start) {
        const sessionKey = `${date}|${hall || ""}|${session || ""}|${time.start}|${topic}`

        if (!sessionMap.has(sessionKey)) {
          // Detect session type
          let sessionType = "lecture"
          const topicLower = topic.toLowerCase()
          if (topicLower.includes("panel") || topicLower.includes("discussion")) sessionType = "panel"
          else if (topicLower.includes("keynote") || topicLower.includes("oration")) sessionType = "keynote"
          else if (topicLower.includes("workshop")) sessionType = "workshop"
          else if (topicLower.includes("live") || topicLower.includes("surgery")) sessionType = "live_surgery"
          else if (topicLower.includes("inaug")) sessionType = "ceremony"
          else if (topicLower.includes("break") || topicLower.includes("lunch")) sessionType = "break"

          // Flag unusually long sessions (> 180 min / 3 hours)
          // Medical conferences typically have 30-90 min sessions, so 3+ hours is unusual
          if (time.duration && time.duration > 180 && sessionType === "lecture") {
            timingIssues.push({
              type: "long_session",
              hall: hall || "Unknown",
              date,
              session1: topic,
              details: `Session is ${time.duration} minutes long (${Math.round(time.duration/60)} hours) - unusually long`,
            })
          }

          sessionMap.set(sessionKey, {
            event_id: eventId,
            session_name: topic,
            session_type: sessionType,
            session_date: date,
            start_time: time.start,
            end_time: time.end,
            duration_minutes: time.duration,
            hall,
            specialty_track: session,
            speakers: [],
            chairpersons: [],
            moderators: [],
            panelists: [],
          })
        }

        // Add person to session with contact details
        const s = sessionMap.get(sessionKey)!
        if (name) {
          const personDetail: PersonDetail = { name, email: email || null, phone: phone || null }
          const roleLower = role.toLowerCase()

          // Helper to check if person already exists in array
          const personExists = (arr: PersonDetail[]) => arr.some(p => p.name === name)

          if (roleLower.includes("chair") || roleLower.includes("coordinator")) {
            if (!personExists(s.chairpersons)) s.chairpersons.push(personDetail)
          } else if (roleLower.includes("moderator")) {
            if (!personExists(s.moderators)) s.moderators.push(personDetail)
          } else if (roleLower.includes("panel")) {
            if (!personExists(s.panelists)) s.panelists.push(personDetail)
          } else {
            if (!personExists(s.speakers)) s.speakers.push(personDetail)
          }
        }
      }
    })

    // Detect faculty conflicts (same person in two places at same time)
    for (const [facultyName, schedules] of facultySchedules) {
      const sortedSchedules = schedules.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)

      for (let i = 0; i < sortedSchedules.length - 1; i++) {
        const current = sortedSchedules[i]
        const next = sortedSchedules[i + 1]

        // Check if on same date and times overlap
        if (current.date === next.date && current.end > next.start && current.hall !== next.hall) {
          timingIssues.push({
            type: "faculty_conflict",
            hall: `${current.hall} & ${next.hall}`,
            date: current.date,
            session1: current.session,
            session2: next.session,
            faculty: facultyMap.get(facultyName)?.name || facultyName,
            details: `Same person scheduled in 2 halls at overlapping times`,
          })
        }
      }
    }

    // Detect hall timing conflicts (sessions overlap in same hall)
    const hallSessions = new Map<string, SessionData[]>()
    for (const session of sessionMap.values()) {
      if (session.hall && session.session_date && session.start_time) {
        const key = `${session.session_date}|${session.hall}`
        if (!hallSessions.has(key)) hallSessions.set(key, [])
        hallSessions.get(key)!.push(session)
      }
    }

    for (const [key, sessions] of hallSessions) {
      const sorted = sessions.sort((a, b) => timeToMinutes(a.start_time!) - timeToMinutes(b.start_time!))
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i]
        const next = sorted[i + 1]
        const currentEnd = timeToMinutes(current.end_time!)
        const nextStart = timeToMinutes(next.start_time!)

        if (currentEnd > nextStart) {
          // Overlap detected
          timingIssues.push({
            type: "overlap",
            hall: current.hall!,
            date: current.session_date!,
            session1: current.session_name,
            session2: next.session_name,
            details: `Overlap: ${current.session_name} ends at ${current.end_time?.substring(0,5)} but ${next.session_name} starts at ${next.start_time?.substring(0,5)}`,
          })
        } else if (nextStart - currentEnd > 90) {
          // Gap > 90 min detected (normal breaks are 30-60 min)
          timingIssues.push({
            type: "gap",
            hall: current.hall!,
            date: current.session_date!,
            session1: current.session_name,
            session2: next.session_name,
            details: `${nextStart - currentEnd} min gap between sessions (longer than typical lunch break)`,
          })
        }
      }
    }

    // Smart Analysis: Speaker Load
    type SpeakerLoad = { name: string; sessionCount: number; totalMinutes: number; roles: string[] }
    const speakerLoads: SpeakerLoad[] = []
    for (const [key, schedules] of facultySchedules) {
      const faculty = facultyMap.get(key)
      const totalMinutes = schedules.reduce((sum, s) => sum + (s.end - s.start), 0)
      const roles = [...new Set(schedules.map(s => s.session))]
      if (schedules.length > 15) {
        // Only flag if speaker has more than 15 sessions (very busy)
        timingIssues.push({
          type: "long_session",
          hall: "Multiple",
          date: schedules[0].date,
          session1: faculty?.name || key,
          details: `Speaker has ${schedules.length} sessions across the event - heavy workload`,
        })
      }
      speakerLoads.push({
        name: faculty?.name || key,
        sessionCount: schedules.length,
        totalMinutes,
        roles,
      })
    }

    // Smart Analysis: Hall Balance
    const hallSessionCounts = new Map<string, number>()
    for (const session of sessionMap.values()) {
      if (session.hall) {
        hallSessionCounts.set(session.hall, (hallSessionCounts.get(session.hall) || 0) + 1)
      }
    }
    const hallCounts = Array.from(hallSessionCounts.values())
    const avgSessions = hallCounts.reduce((a, b) => a + b, 0) / hallCounts.length
    for (const [hall, count] of hallSessionCounts) {
      if (count < avgSessions * 0.5) {
        timingIssues.push({
          type: "gap",
          hall,
          date: "All",
          session1: `${count} sessions`,
          details: `Hall is underutilized (avg: ${Math.round(avgSessions)} sessions/hall)`,
        })
      }
    }

    // Smart Analysis: Break Detection
    for (const [key, sessions] of hallSessions) {
      const [date, hall] = key.split("|")
      const sorted = sessions.sort((a, b) => timeToMinutes(a.start_time!) - timeToMinutes(b.start_time!))

      let continuousMinutes = 0
      let lastBreak = sorted[0]?.start_time ? timeToMinutes(sorted[0].start_time) : 0

      for (const session of sorted) {
        if (!session.start_time || !session.end_time) continue
        const start = timeToMinutes(session.start_time)
        const end = timeToMinutes(session.end_time)
        const sessionType = session.session_type.toLowerCase()

        // Reset counter if it's a break session
        if (sessionType === "break" || session.session_name.toLowerCase().includes("break") ||
            session.session_name.toLowerCase().includes("lunch") || session.session_name.toLowerCase().includes("tea")) {
          continuousMinutes = 0
          lastBreak = end
        } else {
          continuousMinutes = end - lastBreak
          if (continuousMinutes > 180) { // 3 hours without break
            timingIssues.push({
              type: "gap",
              hall,
              date,
              session1: session.session_name,
              details: `${Math.round(continuousMinutes / 60)}+ hours without a break - consider adding one`,
            })
          }
        }
      }
    }

    // Smart Analysis: Day Statistics
    const dayStats = new Map<string, { sessions: number; totalMinutes: number; halls: Set<string>; speakers: Set<string> }>()
    for (const session of sessionMap.values()) {
      if (!session.session_date) continue
      if (!dayStats.has(session.session_date)) {
        dayStats.set(session.session_date, { sessions: 0, totalMinutes: 0, halls: new Set(), speakers: new Set() })
      }
      const stat = dayStats.get(session.session_date)!
      stat.sessions++
      stat.totalMinutes += session.duration_minutes || 0
      if (session.hall) stat.halls.add(session.hall)
      session.speakers.forEach(s => stat.speakers.add(s.name))
      session.chairpersons.forEach(s => stat.speakers.add(s.name))
      session.moderators.forEach(s => stat.speakers.add(s.name))
    }

    // Build schedule summary
    const scheduleSummary = {
      totalSessions: sessionMap.size,
      totalHalls: halls.size,
      totalFaculty: facultyMap.size,
      totalDays: dayStats.size,
      daysBreakdown: Array.from(dayStats.entries()).map(([date, stat]) => ({
        date,
        sessions: stat.sessions,
        totalHours: Math.round(stat.totalMinutes / 60 * 10) / 10,
        hallsUsed: stat.halls.size,
        uniqueSpeakers: stat.speakers.size,
      })),
      topSpeakers: speakerLoads.sort((a, b) => b.sessionCount - a.sessionCount).slice(0, 10),
      hallDistribution: Array.from(hallSessionCounts.entries()).map(([hall, count]) => ({ hall, sessions: count })),
    }

    // Clear existing data if requested
    if (clearExisting) {
      await (supabase as any).from("sessions").delete().eq("event_id", eventId)
      if (createCoordinators) {
        await (supabase as any).from("hall_coordinators").delete().eq("event_id", eventId)
      }
    }

    // Helper to format person with contact details
    const formatPersonWithContact = (p: PersonDetail) => {
      const contacts = [p.email, p.phone].filter(Boolean)
      if (contacts.length > 0) {
        return `${p.name} (${contacts.join(", ")})`
      }
      return p.name
    }

    // Helper to format just names (for display fields)
    const formatNames = (arr: PersonDetail[]) => arr.map(p => p.name).join(", ")

    // Helper to format with full contact details (for reports)
    const formatWithContacts = (arr: PersonDetail[]) => arr.map(formatPersonWithContact).join(" | ")

    // Insert sessions with duration and contact details
    const sessions = Array.from(sessionMap.values()).map(s => ({
      event_id: s.event_id,
      session_name: s.session_name,
      session_type: s.session_type,
      session_date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      duration_minutes: s.duration_minutes,
      hall: s.hall,
      specialty_track: s.specialty_track,
      // Store names for display
      speakers: s.speakers.length > 0 ? formatNames(s.speakers) : null,
      chairpersons: s.chairpersons.length > 0 ? formatNames(s.chairpersons) : null,
      moderators: s.moderators.length > 0 ? formatNames(s.moderators) : null,
      // Store full contact details in speakers_text for reports
      speakers_text: s.speakers.length > 0 ? formatWithContacts(s.speakers) : null,
      chairpersons_text: s.chairpersons.length > 0 ? formatWithContacts(s.chairpersons) : null,
      moderators_text: s.moderators.length > 0 ? formatWithContacts(s.moderators) : null,
      description: s.panelists.length > 0 ? s.panelists.map(p => formatPersonWithContact(p)).join(" | ") : null,
    }))

    let insertedSessions = 0
    const batchSize = 100
    for (let i = 0; i < sessions.length; i += batchSize) {
      const batch = sessions.slice(i, i + batchSize)
      const { data, error } = await (supabase as any).from("sessions").insert(batch).select()
      if (!error) insertedSessions += data?.length || 0
    }

    // Create hall coordinators
    let coordinatorsCreated = 0
    if (createCoordinators && halls.size > 0) {
      for (const hallName of halls) {
        // Check if coordinator already exists
        const { data: existing } = await (supabase as any)
          .from("hall_coordinators")
          .select("id")
          .eq("event_id", eventId)
          .eq("hall_name", hallName)
          .single()

        if (!existing) {
          const { error } = await (supabase as any).from("hall_coordinators").insert({
            event_id: eventId,
            hall_name: hallName,
            coordinator_name: `${hallName} Coordinator`,
            coordinator_email: `${hallName.toLowerCase().replace(/\s+/g, ".")}@event.com`,
          })
          if (!error) coordinatorsCreated++
        }
      }
    }

    // Create tracks with description and chairpersons from track metadata
    let tracksCreated = 0
    const trackColors = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#6366F1", "#14B8A6"]
    if (tracks.size > 0) {
      let colorIndex = 0
      for (const trackName of tracks) {
        // Get track metadata (description + chairpersons)
        const meta = trackMetadataMap.get(trackName)

        // Check if track already exists
        const { data: existing } = await (supabase as any)
          .from("tracks")
          .select("id")
          .eq("event_id", eventId)
          .eq("name", trackName)
          .single()

        // Format chairpersons with contact details: "Name (email, phone) | Name2 (email, phone)"
        const formatTrackChairpersons = (chairs: TrackChairperson[]) => {
          return chairs.map(c => {
            const contacts = [c.email, c.phone].filter(Boolean)
            return contacts.length > 0 ? `${c.name} (${contacts.join(", ")})` : c.name
          }).join(" | ")
        }

        if (!existing) {
          const { error } = await (supabase as any).from("tracks").insert({
            event_id: eventId,
            name: trackName,
            description: meta?.description || null,
            chairpersons: meta?.chairpersons?.length ? formatTrackChairpersons(meta.chairpersons) : null,
            color: trackColors[colorIndex % trackColors.length],
          })
          if (!error) {
            tracksCreated++
            colorIndex++
          }
        } else if (meta?.description || meta?.chairpersons?.length) {
          // Update existing track with description and chairpersons
          await (supabase as any).from("tracks").update({
            description: meta?.description || null,
            chairpersons: meta?.chairpersons?.length ? formatTrackChairpersons(meta.chairpersons) : null,
          }).eq("id", existing.id)
        }
      }
    }

    // Smart Faculty Analysis & Registration
    let facultyCreated = 0
    let facultyUpdated = 0
    let facultyMatched = 0
    const facultyAnalysis: Array<{
      name: string
      status: "new" | "updated" | "matched" | "skipped"
      matchedBy?: string
      existingData?: { name: string; email?: string; phone?: string }
      newData?: { email?: string; phone?: string }
    }> = []

    if (createRegistrations) {
      type RegRecord = { attendee_name: string; attendee_email: string; attendee_phone: string; id: string; event_id?: string }

      // Get ALL existing registrations (not just for this event) for better matching
      const { data: allExistingRegs } = await (supabase as any)
        .from("registrations")
        .select("attendee_name, attendee_email, attendee_phone, id, event_id") as { data: RegRecord[] | null }

      // Get existing registrations for this event
      const { data: eventRegs } = await (supabase as any)
        .from("registrations")
        .select("attendee_name, attendee_email, attendee_phone, id")
        .eq("event_id", eventId) as { data: RegRecord[] | null }

      // Get ALL faculty from the faculty table (event speakers)
      type FacultyRecord = { id: string; first_name: string; last_name: string; email: string; phone: string; whatsapp: string; designation: string; institution: string }
      const { data: allFaculty } = await (supabase as any)
        .from("faculty")
        .select("id, first_name, last_name, email, phone, whatsapp, designation, institution") as { data: FacultyRecord[] | null }

      // Get ALL members from the members table (AMASI members with membership numbers - master database)
      type MemberRecord = { id: string; name: string; email: string; phone: string; amasi_number: string }
      const { data: allMembers } = await (supabase as any)
        .from("members")
        .select("id, name, email, phone, amasi_number") as { data: MemberRecord[] | null }

      // Build lookup maps with fuzzy matching support
      const existingByName = new Map<string, RegRecord>()
      const existingByEmail = new Map<string, RegRecord>()
      const existingByPhone = new Map<string, RegRecord>()
      const globalByEmail = new Map<string, RegRecord>()
      const globalByPhone = new Map<string, RegRecord>()

      // Faculty lookup maps (event speakers)
      const facultyByName = new Map<string, FacultyRecord>()
      const facultyByEmail = new Map<string, FacultyRecord>()
      const facultyByPhone = new Map<string, FacultyRecord>()

      // Members lookup maps (AMASI members - for contact enrichment only, NOT for creating new)
      const membersByName = new Map<string, MemberRecord>()
      const membersByEmail = new Map<string, MemberRecord>()
      const membersByPhone = new Map<string, MemberRecord>()

      // Index event registrations
      eventRegs?.forEach(r => {
        if (r.attendee_name) existingByName.set(normalizeName(r.attendee_name), r)
        if (r.attendee_email) existingByEmail.set(r.attendee_email.toLowerCase().trim(), r)
        if (r.attendee_phone) existingByPhone.set(String(r.attendee_phone).replace(/\D/g, "").slice(-10), r)
      })

      // Index global registrations for data enrichment
      allExistingRegs?.forEach(r => {
        if (r.attendee_email) globalByEmail.set(r.attendee_email.toLowerCase().trim(), r)
        if (r.attendee_phone) globalByPhone.set(String(r.attendee_phone).replace(/\D/g, "").slice(-10), r)
      })

      // Index faculty table for data enrichment
      allFaculty?.forEach(f => {
        const fullName = `${f.first_name} ${f.last_name}`.trim()
        if (fullName) facultyByName.set(normalizeName(fullName), f)
        if (f.email) facultyByEmail.set(f.email.toLowerCase().trim(), f)
        if (f.phone) facultyByPhone.set(String(f.phone).replace(/\D/g, "").slice(-10), f)
        if (f.whatsapp) facultyByPhone.set(String(f.whatsapp).replace(/\D/g, "").slice(-10), f)
      })

      // Index members table (AMASI members) for contact enrichment
      allMembers?.forEach(m => {
        if (m.name) membersByName.set(normalizeName(m.name), m)
        if (m.email) membersByEmail.set(m.email.toLowerCase().trim(), m)
        if (m.phone) membersByPhone.set(String(m.phone).replace(/\D/g, "").slice(-10), m)
      })

      // Smart name matching with fuzzy logic
      const fuzzyNameMatch = (name: string): any => {
        const normalized = normalizeName(name)

        // Exact match
        if (existingByName.has(normalized)) {
          return { match: existingByName.get(normalized), matchType: "exact_name" }
        }

        // Check by parts (first name + last name)
        const parts = normalized.split(" ").filter(p => p.length > 1)
        if (parts.length >= 2) {
          // Try first + last
          for (const [key, reg] of existingByName) {
            const regParts = key.split(" ").filter((p: string) => p.length > 1)
            // Match if first and last name match
            if (regParts.includes(parts[0]) && regParts.includes(parts[parts.length - 1])) {
              return { match: reg, matchType: "partial_name" }
            }
            // Match if at least 2 parts match
            const matchingParts = parts.filter(p => regParts.includes(p))
            if (matchingParts.length >= 2) {
              return { match: reg, matchType: "fuzzy_name" }
            }
          }
        }

        return null
      }

      // Get or create faculty ticket type
      let ticketTypeId: string | null = null
      const { data: existingTicket } = await (supabase as any)
        .from("ticket_types")
        .select("id")
        .eq("event_id", eventId)
        .or("name.ilike.%faculty%,name.ilike.%speaker%")
        .limit(1)
        .single() as { data: { id: string } | null }

      if (existingTicket) {
        ticketTypeId = existingTicket.id
      } else {
        const { data: newTicket } = await (supabase as any)
          .from("ticket_types")
          .insert({
            event_id: eventId,
            name: "Faculty / Speaker",
            price: 0,
            quantity_total: 9999,
            quantity_sold: 0,
            is_active: true,
          })
          .select("id")
          .single() as { data: { id: string } | null }
        ticketTypeId = newTicket?.id || null
      }

      // Process each faculty with smart matching
      for (const [_, faculty] of facultyMap) {
        let existingMatch: any = null
        let matchedBy = ""
        let facultyTableMatch: FacultyRecord | null = null

        // PRIORITY 1: Check faculty table (master faculty list) for contact info
        const normalizedFacultyName = normalizeName(faculty.name)

        // Check faculty by name first
        if (facultyByName.has(normalizedFacultyName)) {
          facultyTableMatch = facultyByName.get(normalizedFacultyName)!
        }

        // Also check faculty by email if we have it
        if (!facultyTableMatch && faculty.email) {
          const emailKey = faculty.email.toLowerCase().trim()
          if (facultyByEmail.has(emailKey)) {
            facultyTableMatch = facultyByEmail.get(emailKey)!
          }
        }

        // Also check faculty by phone if we have it
        if (!facultyTableMatch && faculty.phone) {
          const phoneKey = String(faculty.phone).replace(/\D/g, "").slice(-10)
          if (facultyByPhone.has(phoneKey)) {
            facultyTableMatch = facultyByPhone.get(phoneKey)!
          }
        }

        // Fuzzy name matching against faculty table
        if (!facultyTableMatch) {
          const parts = normalizedFacultyName.split(" ").filter(p => p.length > 1)
          if (parts.length >= 2) {
            for (const [key, fac] of facultyByName) {
              const facParts = key.split(" ").filter((p: string) => p.length > 1)
              // Match if first and last name match
              if (facParts.includes(parts[0]) && facParts.includes(parts[parts.length - 1])) {
                facultyTableMatch = fac
                break
              }
              // Match if at least 2 parts match
              const matchingParts = parts.filter(p => facParts.includes(p))
              if (matchingParts.length >= 2) {
                facultyTableMatch = fac
                break
              }
            }
          }
        }

        // Enrich data from faculty table
        if (facultyTableMatch) {
          if (!faculty.email && facultyTableMatch.email) faculty.email = facultyTableMatch.email
          if (!faculty.phone && facultyTableMatch.phone) faculty.phone = facultyTableMatch.phone
          if (!faculty.phone && facultyTableMatch.whatsapp) faculty.phone = facultyTableMatch.whatsapp
        }

        // ALSO check Members table (AMASI members) for contact enrichment
        let memberMatch: MemberRecord | null = null
        if (!faculty.email || !faculty.phone) {
          // Check by name
          if (membersByName.has(normalizedFacultyName)) {
            memberMatch = membersByName.get(normalizedFacultyName)!
          }
          // Check by email
          if (!memberMatch && faculty.email) {
            const emailKey = faculty.email.toLowerCase().trim()
            if (membersByEmail.has(emailKey)) {
              memberMatch = membersByEmail.get(emailKey)!
            }
          }
          // Check by phone
          if (!memberMatch && faculty.phone) {
            const phoneKey = String(faculty.phone).replace(/\D/g, "").slice(-10)
            if (membersByPhone.has(phoneKey)) {
              memberMatch = membersByPhone.get(phoneKey)!
            }
          }
          // Fuzzy name match against members
          if (!memberMatch) {
            const parts = normalizedFacultyName.split(" ").filter(p => p.length > 1)
            if (parts.length >= 2) {
              for (const [key, member] of membersByName) {
                const memberParts = key.split(" ").filter((p: string) => p.length > 1)
                if (memberParts.includes(parts[0]) && memberParts.includes(parts[parts.length - 1])) {
                  memberMatch = member
                  break
                }
                const matchingParts = parts.filter(p => memberParts.includes(p))
                if (matchingParts.length >= 2) {
                  memberMatch = member
                  break
                }
              }
            }
          }
          // Enrich from member data (AMASI member contact info)
          if (memberMatch) {
            if (!faculty.email && memberMatch.email) faculty.email = memberMatch.email
            if (!faculty.phone && memberMatch.phone) faculty.phone = memberMatch.phone
            if (!matchedBy) matchedBy = "amasi_member"
          }
        }

        // 1. Try to match by email (most accurate) in registrations
        if (faculty.email) {
          const emailKey = faculty.email.toLowerCase().trim()
          if (existingByEmail.has(emailKey)) {
            existingMatch = existingByEmail.get(emailKey)
            matchedBy = "email"
          } else if (globalByEmail.has(emailKey)) {
            // Found in another event - can enrich data
            const globalMatch = globalByEmail.get(emailKey)
            if (globalMatch && !faculty.phone && globalMatch.attendee_phone) {
              faculty.phone = globalMatch.attendee_phone
            }
          }
        }

        // 2. Try to match by phone in registrations
        if (!existingMatch && faculty.phone) {
          const phoneKey = String(faculty.phone).replace(/\D/g, "").slice(-10)
          if (existingByPhone.has(phoneKey)) {
            existingMatch = existingByPhone.get(phoneKey)
            matchedBy = "phone"
          } else if (globalByPhone.has(phoneKey)) {
            // Found in another event - can enrich data
            const globalMatch = globalByPhone.get(phoneKey)
            if (globalMatch && !faculty.email && globalMatch.attendee_email) {
              faculty.email = globalMatch.attendee_email
            }
          }
        }

        // 3. Try fuzzy name matching in registrations
        if (!existingMatch) {
          const nameMatch = fuzzyNameMatch(faculty.name)
          if (nameMatch) {
            existingMatch = nameMatch.match
            matchedBy = nameMatch.matchType
          }
        }

        // Track if contact came from faculty table
        if (facultyTableMatch && !matchedBy) {
          matchedBy = "faculty_table"
        }

        // Process based on match status
        if (existingMatch) {
          // Update existing registration with any missing data
          const updates: any = {}
          let hasUpdates = false

          if (!existingMatch.attendee_phone && faculty.phone) {
            updates.attendee_phone = faculty.phone
            hasUpdates = true
          }
          if (!existingMatch.attendee_email && faculty.email) {
            updates.attendee_email = faculty.email
            hasUpdates = true
          }

          if (hasUpdates) {
            await (supabase as any).from("registrations").update(updates).eq("id", existingMatch.id)
            facultyUpdated++
            facultyAnalysis.push({
              name: faculty.name,
              status: "updated",
              matchedBy,
              existingData: {
                name: existingMatch.attendee_name,
                email: existingMatch.attendee_email,
                phone: existingMatch.attendee_phone,
              },
              newData: updates,
            })
          } else {
            facultyMatched++
            facultyAnalysis.push({
              name: faculty.name,
              status: "matched",
              matchedBy,
              existingData: {
                name: existingMatch.attendee_name,
                email: existingMatch.attendee_email,
                phone: existingMatch.attendee_phone,
              },
            })
          }
        } else if ((faculty.email || faculty.phone) && ticketTypeId) {
          // NEW FACULTY - not found in faculty table or registrations
          // Step 1: Add to faculty table (master faculty database) if not already there
          if (!facultyTableMatch) {
            // Parse name into first/last
            const nameParts = faculty.name.trim().split(/\s+/)
            const firstName = nameParts[0] || faculty.name
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""

            const { error: facultyError } = await (supabase as any).from("faculty").insert({
              first_name: firstName,
              last_name: lastName || firstName, // Fallback to first name if no last name
              email: faculty.email || `${faculty.name.replace(/\s+/g, ".").toLowerCase()}@placeholder.faculty`,
              phone: faculty.phone || null,
              designation: faculty.role || "Speaker",
            })
            if (!facultyError) {
              matchedBy = "new_faculty_created"
            }
          }

          // Step 2: Create registration for this event
          const regNumber = `FAC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
          const { error } = await (supabase as any).from("registrations").insert({
            event_id: eventId,
            ticket_type_id: ticketTypeId,
            registration_number: regNumber,
            attendee_name: faculty.name,
            attendee_email: faculty.email || `${faculty.name.replace(/\s+/g, ".").toLowerCase()}@placeholder.com`,
            attendee_phone: faculty.phone,
            attendee_designation: faculty.role,
            status: "confirmed",
            payment_status: "paid",
            total_amount: 0,
          })

          if (!error) {
            facultyCreated++
            facultyAnalysis.push({
              name: faculty.name,
              status: "new",
              matchedBy: facultyTableMatch ? "from_faculty" : "new_faculty_created",
              newData: { email: faculty.email || undefined, phone: faculty.phone || undefined },
            })
          }
        } else if (!facultyTableMatch && faculty.name) {
          // Even without contact info, add to faculty table for tracking
          const nameParts = faculty.name.trim().split(/\s+/)
          const firstName = nameParts[0] || faculty.name
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""

          const { error: facultyError } = await (supabase as any).from("faculty").insert({
            first_name: firstName,
            last_name: lastName || firstName,
            email: `${faculty.name.replace(/\s+/g, ".").toLowerCase()}.pending@placeholder.faculty`,
            phone: null,
            designation: faculty.role || "Speaker",
          })

          facultyAnalysis.push({
            name: faculty.name,
            status: facultyError ? "skipped" : "new",
            matchedBy: facultyError ? undefined : "new_faculty_no_contact",
          })

          if (!facultyError) facultyCreated++
        } else {
          facultyAnalysis.push({
            name: faculty.name,
            status: "skipped",
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      ai_detection: {
        columns: detectedColumns.filter(c => c.type !== "unknown").map(c => ({
          header: c.header,
          detected_as: c.type,
          confidence: c.confidence,
        })),
        mapping: columnMap,
      },
      imported: {
        sessions: insertedSessions,
        halls: halls.size,
        coordinators: coordinatorsCreated,
        faculty: {
          total: facultyMap.size,
          withContact: Array.from(facultyMap.values()).filter(f => f.email || f.phone).length,
          created: facultyCreated,
          updated: facultyUpdated,
          matched: facultyMatched,
          skipped: facultyAnalysis.filter(f => f.status === "skipped").length,
          newFacultyCreated: facultyAnalysis.filter(f => f.matchedBy === "new_faculty_created" || f.matchedBy === "new_faculty_no_contact").length,
          fromFacultyTable: facultyAnalysis.filter(f => f.matchedBy === "faculty_table" || f.matchedBy === "from_faculty").length,
          fromAMASIMembers: facultyAnalysis.filter(f => f.matchedBy === "amasi_member").length,
        },
      },
      analysis: {
        timingIssues: timingIssues.slice(0, 100), // Limit to 100 issues
        scheduleSummary,
        issuesSummary: {
          total: timingIssues.length,
          overlaps: timingIssues.filter(i => i.type === "overlap").length,
          gaps: timingIssues.filter(i => i.type === "gap").length,
          longSessions: timingIssues.filter(i => i.type === "long_session").length,
          facultyConflicts: timingIssues.filter(i => i.type === "faculty_conflict").length,
        },
      },
      facultyAnalysis: facultyAnalysis.slice(0, 50), // Limit to first 50 for response size
      halls: Array.from(halls),
      tracks: Array.from(tracks),
      tracksCreated,
      message: `AI Import Complete: ${insertedSessions} sessions across ${halls.size} halls, ${tracks.size} tracks. Faculty: ${facultyCreated} new (added to Faculty DB), ${facultyUpdated} updated, ${facultyMatched} matched. Found ${timingIssues.length} timing issues.`,
    })
  } catch (error: any) {
    console.error("AI Import error:", error)
    return NextResponse.json({ error: error.message || "Import failed" }, { status: 500 })
  }
}
