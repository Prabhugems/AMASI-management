import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

// POST /api/events/[eventId]/speakers/sync-faculty
// Syncs speakers from event registrations (Speaker tickets) to the master faculty table
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params

  // Allow both authenticated users and cron calls
  const cronSecret = request.headers.get("x-cron-secret")
  if (cronSecret !== process.env.CRON_SECRET) {
    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get event info
    const { data: event } = await db
      .from("events")
      .select("id, name, short_name")
      .eq("id", eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Get all speaker registrations (Speaker ticket type)
    const { data: speakerTickets } = await db
      .from("ticket_types")
      .select("id")
      .eq("event_id", eventId)
      .ilike("name", "%speaker%")

    if (!speakerTickets?.length) {
      return NextResponse.json({ message: "No speaker tickets found", added: 0 })
    }

    const ticketIds = speakerTickets.map((t: { id: string }) => t.id)

    const { data: speakers } = await db
      .from("registrations")
      .select("attendee_name, attendee_email, attendee_phone, attendee_designation")
      .eq("event_id", eventId)
      .in("ticket_type_id", ticketIds)
      .eq("status", "confirmed")

    if (!speakers?.length) {
      return NextResponse.json({ message: "No confirmed speakers found", added: 0 })
    }

    // Get sessions for this event to capture topics
    const { data: sessions } = await db
      .from("sessions")
      .select("session_name, speakers, chairpersons, moderators")
      .eq("event_id", eventId)

    // Build speaker → topics map
    const speakerTopics: Record<string, string[]> = {}
    for (const s of sessions || []) {
      for (const field of ["speakers", "chairpersons", "moderators"]) {
        const names = s[field]
        if (!names) continue
        // Names can be comma-separated or single
        const nameList = names.split(",").map((n: string) => n.replace(/^(Dr\.|Prof\.)\s*/i, "").trim().toLowerCase())
        for (const name of nameList) {
          if (!speakerTopics[name]) speakerTopics[name] = []
          if (s.session_name && !speakerTopics[name].includes(s.session_name)) {
            speakerTopics[name].push(s.session_name)
          }
        }
      }
    }

    let added = 0
    let updated = 0
    let skipped = 0
    const eventLabel = event.short_name || event.name

    for (const speaker of speakers) {
      if (!speaker.attendee_email) {
        skipped++
        continue
      }

      // Check if faculty already exists by email
      const { data: existing } = await db
        .from("faculty")
        .select("id, notes")
        .eq("email", speaker.attendee_email.toLowerCase())
        .maybeSingle()

      // Build topics string for this speaker
      const cleanName = speaker.attendee_name?.replace(/^(Dr\.|Prof\.)\s*/i, "").trim().toLowerCase()
      const topics = cleanName ? (speakerTopics[cleanName] || []) : []
      const courseNote = topics.length > 0
        ? `${eventLabel}: ${topics.join(", ")}`
        : eventLabel

      if (existing) {
        // Update notes to include this course if not already mentioned
        const currentNotes = existing.notes || ""
        if (!currentNotes.includes(eventLabel)) {
          const newNotes = currentNotes
            ? `${currentNotes}\n${courseNote}`
            : courseNote
          await db.from("faculty").update({
            notes: newNotes,
            // Update phone if missing
            ...(speaker.attendee_phone && !existing.phone ? { phone: speaker.attendee_phone } : {}),
          }).eq("id", existing.id)
          updated++
        } else {
          skipped++
        }
      } else {
        // Create new faculty entry
        await db.from("faculty").insert({
          name: speaker.attendee_name,
          email: speaker.attendee_email,
          phone: speaker.attendee_phone || null,
          designation: speaker.attendee_designation || null,
          status: "active",
          notes: courseNote,
        })
        added++
      }
    }

    return NextResponse.json({
      message: `Faculty sync complete for ${eventLabel}`,
      added,
      updated,
      skipped,
      total: speakers.length,
    })
  } catch (error) {
    console.error("Faculty sync error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
