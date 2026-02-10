import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { parse } from "csv-parse/sync"
import { requireEventAccess } from "@/lib/auth/api-auth"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

type CSVRow = {
  Date?: string
  Hall?: string
  Session?: string
  Time?: string
  Topic?: string
  Name?: string
  Role?: string
  // Email columns - various possible header names
  "Email ID (from Faculty Link) 4"?: string
  "Email ID"?: string
  "Email"?: string
  "email"?: string
  // Phone columns - various possible header names
  "Mobile Number (from Faculty Link) 4"?: string
  "Mobile Number"?: string
  "Phone"?: string
  "phone"?: string
  "Mobile"?: string
  [key: string]: string | undefined
}

// Faculty/Speaker info for registration creation
type FacultyInfo = {
  name: string
  email: string | null
  phone: string | null
  role: string
  sessions: string[] // session names this person is associated with
}

type SessionKey = string
type SessionData = {
  event_id: string
  session_name: string
  session_type: string
  session_date: string
  start_time: string
  end_time: string
  duration_minutes: number | null
  hall: string | null
  specialty_track: string | null
  speakers: string[]
  chairpersons: string[]
  moderators: string[]
  panelists: string[]
  presenters: string[]
  description: string | null
}

// Helper to extract email from row (checks multiple column names)
function getEmail(row: CSVRow): string | null {
  const email = row["Email ID (from Faculty Link) 4"] ||
    row["Email ID"] ||
    row["Email"] ||
    row["email"] ||
    Object.entries(row).find(([k, v]) => k.toLowerCase().includes("email") && v)?.[1] ||
    null
  return email?.trim() || null
}

// Helper to extract phone from row (checks multiple column names)
function getPhone(row: CSVRow): string | null {
  let phone = row["Mobile Number (from Faculty Link) 4"] ||
    row["Mobile Number"] ||
    row["Phone"] ||
    row["phone"] ||
    row["Mobile"] ||
    Object.entries(row).find(([k, _v]) => k.toLowerCase().includes("mobile") || k.toLowerCase().includes("phone"))?.[1] ||
    null

  if (!phone) return null

  // Clean phone number - keep only digits
  phone = phone.trim().replace(/[^0-9+]/g, "")

  // Add +91 if it's a 10 digit Indian number
  if (phone.length === 10 && !phone.startsWith("+")) {
    phone = "+91" + phone
  }

  return phone || null
}

// Normalize name for consistent matching
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ")
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "bulk")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const eventId = formData.get("event_id") as string
    const clearExisting = formData.get("clear_existing") === "true"
    const createRegistrations = formData.get("create_registrations") !== "false" // default true

    if (!file || !eventId) {
      return NextResponse.json(
        { error: "File and event_id are required" },
        { status: 400 }
      )
    }

    const { error: authError } = await requireEventAccess(eventId)
    if (authError) return authError

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Read CSV content
    const text = await file.text()

    // Parse CSV
    const records: CSVRow[] = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    })

    if (records.length === 0) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 }
      )
    }

    // Group sessions by unique key (date + hall + session + time + topic)
    const sessionMap = new Map<SessionKey, SessionData>()

    // Collect faculty info for creating registrations
    const facultyMap = new Map<string, FacultyInfo>()

    records.forEach((row: CSVRow) => {
      // Extract faculty contact info first
      const personName = row["Name"] || row["name"] || row["Full Name"] || row["Speaker"] || ""
      const email = getEmail(row)
      const phone = getPhone(row)
      const role = (row["Role"] || row["role"] || "Speaker").trim()

      // Add to faculty map if we have a name
      if (personName && personName.trim()) {
        const normalizedKey = normalizeName(personName)
        const existingFaculty = facultyMap.get(normalizedKey)

        if (existingFaculty) {
          // Update with new info if available
          if (email && !existingFaculty.email) existingFaculty.email = email
          if (phone && !existingFaculty.phone) existingFaculty.phone = phone
        } else {
          facultyMap.set(normalizedKey, {
            name: personName.trim(),
            email,
            phone,
            role,
            sessions: [],
          })
        }
      }

      // Parse date - handles multiple formats
      let parsedDate = ""
      const dateStr = row["Date"] || row["date"] || ""

      // Try DD.MM.YYYY format (AMASICON)
      let dateMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
      if (dateMatch) {
        const [_match, day, month, year] = dateMatch
        parsedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
      }

      // Try DD/MM/YYYY format
      if (!parsedDate) {
        dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        if (dateMatch) {
          const [_match, day, month, year] = dateMatch
          parsedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
        }
      }

      // Try YYYY-MM-DD format
      if (!parsedDate) {
        dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
        if (dateMatch) {
          parsedDate = dateStr
        }
      }

      // Parse time - handles range format "10:30 - 10:45" or "10:30-10:45"
      let startTime = ""
      let endTime = ""
      const timeStr = row["Time"] || row["time"] || row["Starting Time"] || ""

      // Time range format
      const timeRangeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/)
      if (timeRangeMatch) {
        const [_match, startH, startM, endH, endM] = timeRangeMatch
        startTime = `${startH.padStart(2, "0")}:${startM}:00`
        endTime = `${endH.padStart(2, "0")}:${endM}:00`
      } else {
        // Single time format
        const singleTimeMatch = timeStr.match(/(\d{1,2}):(\d{2})/)
        if (singleTimeMatch) {
          const [_match, hours, minutes] = singleTimeMatch
          startTime = `${hours.padStart(2, "0")}:${minutes}:00`
          endTime = startTime
        }
      }

      // Get topic/session name
      const topic = row["Topic"] || row["topic"] || row["Session Name"] || row["Name"] || ""
      if (!topic || !parsedDate || !startTime) return

      // Get hall and session track
      const hall = row["Hall"] || row["hall"] || row["Venue"] || null
      const sessionTrack = row["Session"] || row["session"] || row["Track"] || null

      // Create unique session key
      const sessionKey = `${parsedDate}|${hall || ""}|${sessionTrack || ""}|${startTime}|${topic}`

      // Get or create session
      if (!sessionMap.has(sessionKey)) {
        // Determine session type
        let sessionType = "lecture"
        const topicLower = topic.toLowerCase()
        const trackLower = (sessionTrack || "").toLowerCase()

        if (topicLower.includes("panel") || topicLower.includes("discussion")) sessionType = "panel"
        else if (topicLower.includes("keynote") || topicLower.includes("oration")) sessionType = "keynote"
        else if (topicLower.includes("workshop")) sessionType = "workshop"
        else if (topicLower.includes("live") || topicLower.includes("surgery")) sessionType = "live_surgery"
        else if (trackLower.includes("exam") || topicLower.includes("exam")) sessionType = "exam"
        else if (topicLower.includes("inaug") || topicLower.includes("opening")) sessionType = "ceremony"
        else if (topicLower.includes("break") || topicLower.includes("lunch") || topicLower.includes("tea")) sessionType = "break"

        // Calculate duration
        let duration: number | null = null
        if (startTime && endTime) {
          const [sh, sm] = startTime.split(":").map(Number)
          const [eh, em] = endTime.split(":").map(Number)
          duration = (eh * 60 + em) - (sh * 60 + sm)
          if (duration < 0) duration = null
        }

        sessionMap.set(sessionKey, {
          event_id: eventId,
          session_name: topic.trim(),
          session_type: sessionType,
          session_date: parsedDate,
          start_time: startTime,
          end_time: endTime,
          duration_minutes: duration,
          hall: hall,
          specialty_track: sessionTrack,
          speakers: [],
          chairpersons: [],
          moderators: [],
          panelists: [],
          presenters: [],
          description: null,
        })
      }

      // Add person to the session based on role
      const session = sessionMap.get(sessionKey)!
      const roleLower = role.toLowerCase()

      if (personName && personName.trim()) {
        const cleanName = personName.trim()

        // Track this session for the faculty member
        const normalizedKey = normalizeName(personName)
        const faculty = facultyMap.get(normalizedKey)
        if (faculty && topic) {
          if (!faculty.sessions.includes(topic.trim())) {
            faculty.sessions.push(topic.trim())
          }
        }

        if (roleLower.includes("chair") || roleLower.includes("co-ordinator") || roleLower.includes("coordinator")) {
          if (!session.chairpersons.includes(cleanName)) {
            session.chairpersons.push(cleanName)
          }
        } else if (roleLower.includes("moderator")) {
          if (!session.moderators.includes(cleanName)) {
            session.moderators.push(cleanName)
          }
        } else if (roleLower.includes("panel") || roleLower.includes("debat") || roleLower.includes("arbitrator")) {
          if (!session.panelists.includes(cleanName)) {
            session.panelists.push(cleanName)
          }
        } else if (roleLower.includes("presenter")) {
          if (!session.presenters.includes(cleanName)) {
            session.presenters.push(cleanName)
          }
        } else {
          // Default to speaker
          if (!session.speakers.includes(cleanName)) {
            session.speakers.push(cleanName)
          }
        }
      }
    })

    // Convert to array and format for database
    const sessions = Array.from(sessionMap.values()).map(session => ({
      event_id: session.event_id,
      session_name: session.session_name,
      session_type: session.session_type,
      session_date: session.session_date,
      start_time: session.start_time,
      end_time: session.end_time,
      duration_minutes: session.duration_minutes,
      hall: session.hall,
      specialty_track: session.specialty_track,
      speakers: session.speakers.length > 0 ? session.speakers.join(", ") : null,
      chairpersons: session.chairpersons.length > 0 ? session.chairpersons.join(", ") : null,
      moderators: session.moderators.length > 0 ? session.moderators.join(", ") : null,
      description: [
        ...session.panelists.map(p => `Panelist: ${p}`),
        ...session.presenters.map(p => `Presenter: ${p}`),
      ].join("; ") || null,
    }))

    if (sessions.length === 0) {
      return NextResponse.json(
        { error: "No valid sessions found in CSV. Please check the date and time format." },
        { status: 400 }
      )
    }

    // Clear existing sessions if requested
    if (clearExisting) {
      await db
        .from("sessions")
        .delete()
        .eq("event_id", eventId)
    }

    // Check for existing sessions to avoid duplicates (when not clearing)
    let sessionsToInsert = sessions
    let skippedDuplicates = 0

    if (!clearExisting) {
      const { data: existingSessions } = await db
        .from("sessions")
        .select("session_name, session_date, start_time, hall")
        .eq("event_id", eventId)

      const existingKeys = new Set(
        (existingSessions || []).map((s: any) =>
          `${s.session_date}|${s.start_time}|${s.hall || ''}|${s.session_name}`
        )
      )

      sessionsToInsert = sessions.filter((s: any) => {
        const key = `${s.session_date}|${s.start_time}|${s.hall || ''}|${s.session_name}`
        return !existingKeys.has(key)
      })

      skippedDuplicates = sessions.length - sessionsToInsert.length
    }

    // Insert sessions in batches
    const batchSize = 100
    let insertedCount = 0

    for (let i = 0; i < sessionsToInsert.length; i += batchSize) {
      const batch = sessionsToInsert.slice(i, i + batchSize)
      if (batch.length === 0) continue

      const { data, error } = await db
        .from("sessions")
        .insert(batch as any)
        .select()

      if (error) {
        console.error("Insert error:", error)
        return NextResponse.json(
          { error: "Failed to import sessions", inserted: insertedCount },
          { status: 500 }
        )
      }

      insertedCount += data?.length || 0
    }

    // Create/Update faculty registrations with contact info
    let facultyCreated = 0
    let facultyUpdated = 0

    if (createRegistrations) {
      // Get existing registrations to avoid duplicates
      const { data: existingRegs } = await db
        .from("registrations")
        .select("attendee_name, attendee_email, attendee_phone, id")
        .eq("event_id", eventId)

      const existingByName = new Map<string, any>()
      const existingByEmail = new Map<string, any>()
      existingRegs?.forEach((r: any) => {
        if (r.attendee_name) existingByName.set(normalizeName(r.attendee_name), r)
        if (r.attendee_email) existingByEmail.set(r.attendee_email.toLowerCase(), r)
      })

      // Get or create a faculty ticket type
      let ticketTypeId: string | null = null
      const { data: existingTickets } = await db
        .from("ticket_types")
        .select("id, name")
        .eq("event_id", eventId)
        .or("name.ilike.%faculty%,name.ilike.%speaker%,name.ilike.%complimentary%")
        .limit(1)
        .single()

      if (existingTickets) {
        ticketTypeId = existingTickets.id
      } else {
        // Create a Faculty ticket type
        const { data: newTicket } = await db
          .from("ticket_types")
          .insert({
            event_id: eventId,
            name: "Faculty / Speaker",
            price: 0,
            quantity_total: 9999,
            quantity_sold: 0,
            is_active: true,
          } as any)
          .select("id")
          .single()

        ticketTypeId = newTicket?.id || null
      }

      // Process each faculty
      for (const [_key, faculty] of facultyMap) {
        // Skip if no email and no phone (no useful contact info)
        if (!faculty.email && !faculty.phone) continue

        // Check if already exists
        const existingByNameMatch = existingByName.get(normalizeName(faculty.name))
        const existingByEmailMatch = faculty.email ? existingByEmail.get(faculty.email.toLowerCase()) : null

        if (existingByNameMatch || existingByEmailMatch) {
          // Update existing registration with contact info if missing
          const existing = existingByNameMatch || existingByEmailMatch
          const updates: any = {}

          if (!existing.attendee_phone && faculty.phone) {
            updates.attendee_phone = faculty.phone
          }
          if (!existing.attendee_email && faculty.email) {
            updates.attendee_email = faculty.email
          }

          if (Object.keys(updates).length > 0) {
            await db
              .from("registrations")
              .update(updates)
              .eq("id", existing.id)
            facultyUpdated++
          }
        } else if (ticketTypeId) {
          // Create new registration
          const regNumber = `FAC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

          const { error: insertError } = await db
            .from("registrations")
            .insert({
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
            } as any)

          if (!insertError) {
            facultyCreated++
          }
        }
      }
    }

    // Summary stats
    const facultyWithContact = Array.from(facultyMap.values()).filter(f => f.email || f.phone).length

    return NextResponse.json({
      success: true,
      imported: insertedCount,
      skippedDuplicates,
      total: records.length,
      uniqueSessions: sessions.length,
      faculty: {
        total: facultyMap.size,
        withContact: facultyWithContact,
        created: facultyCreated,
        updated: facultyUpdated,
      },
      message: `Imported ${insertedCount} sessions, ${facultyCreated} new faculty, ${facultyUpdated} updated faculty`,
    })
  } catch (error: any) {
    console.error("Import error:", error)
    return NextResponse.json(
      { error: "Import failed" },
      { status: 500 }
    )
  }
}
