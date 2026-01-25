import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

type SessionRow = {
  id: string
  event_id: string
  session_name: string | null
  session_date: string
  start_time: string | null
  end_time: string | null
  hall: string | null
  specialty_track: string | null
  speakers_text: string | null
  chairpersons_text: string | null
  moderators_text: string | null
}

// Generate a random token for invitation links
function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Parse "Name (email, phone) | Name2 (email2, phone2)" format
function parseFacultyText(text: string | null): Array<{name: string, email: string | null, phone: string | null}> {
  if (!text) return []

  return text.split(' | ').map(part => {
    const match = part.match(/^([^(]+)\s*(?:\(([^,]*),?\s*([^)]*)\))?$/)
    if (match) {
      return {
        name: match[1].trim(),
        email: match[2]?.trim() || null,
        phone: match[3]?.trim() || null,
      }
    }
    return { name: part.trim(), email: null, phone: null }
  }).filter(f => f.name)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Fetch all sessions for this event
    const { data: sessionsData, error: sessionsError } = await db
      .from("sessions")
      .select("id, event_id, session_name, session_date, start_time, end_time, hall, specialty_track, speakers_text, chairpersons_text, moderators_text")
      .eq("event_id", eventId)

    if (sessionsError) {
      return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
    }

    const sessions = (sessionsData || []) as SessionRow[]

    let created = 0
    let skipped = 0
    let firstError: string | null = null
    const errors: string[] = []

    for (const session of sessions) {
      // Parse speakers
      const speakers = parseFacultyText(session.speakers_text)
      for (const speaker of speakers) {
        // Check if already exists (by session_id + name + role)
        const { data: existing } = await db
          .from("faculty_assignments")
          .select("id")
          .eq("session_id", session.id)
          .eq("faculty_name", speaker.name)
          .eq("role", "speaker")
          .maybeSingle()

        if (existing) {
          skipped++
          continue
        }

        const { error } = await db
          .from("faculty_assignments")
          .insert({
            event_id: eventId,
            session_id: session.id,
            faculty_name: speaker.name,
            faculty_email: speaker.email,
            faculty_phone: speaker.phone,
            role: 'speaker',
            session_date: session.session_date,
            start_time: session.start_time,
            end_time: session.end_time,
            hall: session.hall,
            session_name: session.session_name,
            topic_title: session.session_name,
            invitation_token: generateToken(),
          })

        if (!error) {
          created++
        } else {
          if (!firstError) firstError = error.message
          if (errors.length < 5) errors.push(`Speaker ${speaker.name}: ${error.message}`)
          skipped++
        }
      }

      // Parse chairpersons
      const chairpersons = parseFacultyText(session.chairpersons_text)
      for (const chair of chairpersons) {
        const { data: existing } = await db
          .from("faculty_assignments")
          .select("id")
          .eq("session_id", session.id)
          .eq("faculty_name", chair.name)
          .eq("role", "chairperson")
          .maybeSingle()

        if (existing) {
          skipped++
          continue
        }

        const { error } = await db
          .from("faculty_assignments")
          .insert({
            event_id: eventId,
            session_id: session.id,
            faculty_name: chair.name,
            faculty_email: chair.email,
            faculty_phone: chair.phone,
            role: 'chairperson',
            session_date: session.session_date,
            start_time: session.start_time,
            end_time: session.end_time,
            hall: session.hall,
            session_name: session.session_name,
            invitation_token: generateToken(),
          })

        if (!error) {
          created++
        } else {
          if (!firstError) firstError = error.message
          if (errors.length < 5) errors.push(`Chair ${chair.name}: ${error.message}`)
          skipped++
        }
      }

      // Parse moderators
      const moderators = parseFacultyText(session.moderators_text)
      for (const mod of moderators) {
        const { data: existing } = await db
          .from("faculty_assignments")
          .select("id")
          .eq("session_id", session.id)
          .eq("faculty_name", mod.name)
          .eq("role", "moderator")
          .maybeSingle()

        if (existing) {
          skipped++
          continue
        }

        const { error } = await db
          .from("faculty_assignments")
          .insert({
            event_id: eventId,
            session_id: session.id,
            faculty_name: mod.name,
            faculty_email: mod.email,
            faculty_phone: mod.phone,
            role: 'moderator',
            session_date: session.session_date,
            start_time: session.start_time,
            end_time: session.end_time,
            hall: session.hall,
            session_name: session.session_name,
            invitation_token: generateToken(),
          })

        if (!error) {
          created++
        } else {
          if (!firstError) firstError = error.message
          if (errors.length < 5) errors.push(`Moderator ${mod.name}: ${error.message}`)
          skipped++
        }
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: created + skipped,
      firstError,
      sampleErrors: errors,
    })

  } catch (error) {
    console.error("Error syncing assignments:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
