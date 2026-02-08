import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
)

// Generate iCal format date (YYYYMMDDTHHMMSS)
function formatICalDate(dateStr: string, timeStr?: string): string {
  const date = new Date(dateStr)
  if (timeStr) {
    const [hours, minutes] = timeStr.split(":")
    date.setHours(parseInt(hours), parseInt(minutes), 0)
  }
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
}

// Format date for local timezone (without Z)
function formatICalDateLocal(dateStr: string, timeStr?: string): string {
  const date = new Date(dateStr)
  if (timeStr) {
    const [hours, minutes] = timeStr.split(":")
    date.setHours(parseInt(hours), parseInt(minutes), 0)
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const min = String(date.getMinutes()).padStart(2, "0")
  return `${year}${month}${day}T${hour}${min}00`
}

// Escape special characters in iCal text
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

// Fold long lines (iCal spec requires lines < 75 chars)
function foldLine(line: string): string {
  const maxLength = 75
  if (line.length <= maxLength) return line

  let result = ""
  let remaining = line
  while (remaining.length > maxLength) {
    result += remaining.substring(0, maxLength) + "\r\n "
    remaining = remaining.substring(maxLength)
  }
  result += remaining
  return result
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const searchParams = request.nextUrl.searchParams
  const speakerEmail = searchParams.get("speaker") // Optional: filter by speaker email
  const token = searchParams.get("token") // Optional: speaker portal token for auth

  try {
    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, start_date, end_date, venue_name, venue_address")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Fetch sessions
    let sessionsQuery = supabase
      .from("sessions")
      .select(`
        id,
        session_name,
        session_date,
        start_time,
        end_time,
        hall,
        description,
        session_speakers (
          faculty:faculty_id (
            name,
            email
          )
        )
      `)
      .eq("event_id", eventId)
      .order("session_date")
      .order("start_time")

    const { data: sessions, error: sessionsError } = await sessionsQuery

    if (sessionsError) {
      return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
    }

    // Filter by speaker if email provided
    let filteredSessions = sessions || []
    if (speakerEmail) {
      filteredSessions = sessions?.filter((session: any) =>
        session.session_speakers?.some((ss: any) =>
          ss.faculty?.email?.toLowerCase() === speakerEmail.toLowerCase()
        )
      ) || []
    }

    // Generate iCal content
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AMASI//Event Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeICalText(event.name)}`,
      `X-WR-TIMEZONE:Asia/Kolkata`,
    ]

    // Add timezone definition
    lines.push(
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Kolkata",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:+0530",
      "TZOFFSETTO:+0530",
      "END:STANDARD",
      "END:VTIMEZONE"
    )

    // Add each session as an event
    for (const session of filteredSessions) {
      const uid = `session-${session.id}@amasi.org`
      const dtStart = formatICalDateLocal(session.session_date, session.start_time)
      const dtEnd = formatICalDateLocal(session.session_date, session.end_time)

      // Build description with speakers
      const speakers = session.session_speakers
        ?.map((ss: any) => ss.faculty?.name)
        .filter(Boolean)
        .join(", ")

      let description = session.description || ""
      if (speakers) {
        description = `Speakers: ${speakers}\n\n${description}`
      }

      const location = [session.hall, event.venue_name].filter(Boolean).join(", ")

      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${formatICalDate(new Date().toISOString())}`,
        `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
        `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
        foldLine(`SUMMARY:${escapeICalText(session.session_name)}`),
      )

      if (description) {
        lines.push(foldLine(`DESCRIPTION:${escapeICalText(description)}`))
      }
      if (location) {
        lines.push(foldLine(`LOCATION:${escapeICalText(location)}`))
      }

      // Add reminder 30 minutes before
      lines.push(
        "BEGIN:VALARM",
        "TRIGGER:-PT30M",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeICalText(session.session_name)} starts in 30 minutes`,
        "END:VALARM"
      )

      lines.push("END:VEVENT")
    }

    lines.push("END:VCALENDAR")

    // Join with CRLF as per iCal spec
    const icalContent = lines.join("\r\n")

    // Return as .ics file
    return new NextResponse(icalContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${event.name.replace(/[^a-zA-Z0-9]/g, "_")}_calendar.ics"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("Calendar generation error:", error)
    return NextResponse.json({ error: "Failed to generate calendar" }, { status: 500 })
  }
}
