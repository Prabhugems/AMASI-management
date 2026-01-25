/**
 * Calendar Export Utility
 *
 * Generate .ics files for calendar integration
 */

interface CalendarEvent {
  id: string
  title: string
  description?: string
  location?: string
  startTime: Date
  endTime: Date
  organizer?: {
    name: string
    email: string
  }
  url?: string
}

/**
 * Escape special characters for iCal format
 */
function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

/**
 * Format date to iCal format (YYYYMMDDTHHMMSS)
 */
function formatIcalDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
}

/**
 * Generate a unique UID for calendar events
 */
function generateUID(id: string, domain = "amasi-events.com"): string {
  return `${id}@${domain}`
}

/**
 * Generate iCal content for a single event
 */
function generateEventIcal(event: CalendarEvent): string {
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${generateUID(event.id)}`,
    `DTSTAMP:${formatIcalDate(new Date())}`,
    `DTSTART:${formatIcalDate(event.startTime)}`,
    `DTEND:${formatIcalDate(event.endTime)}`,
    `SUMMARY:${escapeIcal(event.title)}`,
  ]

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcal(event.description)}`)
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeIcal(event.location)}`)
  }

  if (event.organizer) {
    lines.push(
      `ORGANIZER;CN=${escapeIcal(event.organizer.name)}:mailto:${event.organizer.email}`
    )
  }

  if (event.url) {
    lines.push(`URL:${event.url}`)
  }

  lines.push("END:VEVENT")

  return lines.join("\r\n")
}

/**
 * Generate complete iCal file content
 */
export function generateIcal(
  events: CalendarEvent[],
  calendarName = "Event Schedule"
): string {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AMASI Events//Event Manager//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcal(calendarName)}`,
  ].join("\r\n")

  const footer = "END:VCALENDAR"

  const eventsContent = events.map(generateEventIcal).join("\r\n")

  return `${header}\r\n${eventsContent}\r\n${footer}`
}

/**
 * Download iCal file
 */
export function downloadIcal(
  events: CalendarEvent[],
  filename = "schedule.ics",
  calendarName = "Event Schedule"
): void {
  const icalContent = generateIcal(events, calendarName)
  const blob = new Blob([icalContent], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Convert session data to CalendarEvent format
 */
export function sessionToCalendarEvent(
  session: {
    id: string
    title: string
    description?: string
    start_time: string
    end_time: string
    hall?: { name: string } | null
    speakers?: Array<{ name: string }> | null
  },
  eventName?: string
): CalendarEvent {
  const speakerNames = session.speakers?.map((s) => s.name).join(", ")
  const description = [
    session.description,
    speakerNames ? `Speakers: ${speakerNames}` : null,
    eventName ? `Event: ${eventName}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  return {
    id: session.id,
    title: session.title,
    description,
    location: session.hall?.name,
    startTime: new Date(session.start_time),
    endTime: new Date(session.end_time),
  }
}

/**
 * Export multiple sessions as a single calendar
 */
export function exportSessionsToCalendar(
  sessions: Array<{
    id: string
    title: string
    description?: string
    start_time: string
    end_time: string
    hall?: { name: string } | null
    speakers?: Array<{ name: string }> | null
  }>,
  eventName: string
): void {
  const events = sessions.map((s) => sessionToCalendarEvent(s, eventName))
  downloadIcal(events, `${eventName.replace(/\s+/g, "-").toLowerCase()}-schedule.ics`, eventName)
}
