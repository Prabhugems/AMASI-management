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
  speakers: string | null
  chairpersons: string | null
  moderators: string | null
  description: string | null
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

// Parse comma-separated names (fallback for sessions without _text columns)
// Format: "Dr Name1, Dr Name2" or "Name1 (Role), Name2 (Role)"
function parseNamesList(text: string | null): Array<{name: string, email: string | null, phone: string | null}> {
  if (!text) return []

  return text.split(',').map(entry => {
    // Remove role in parentheses like "(Chairperson)" but keep the name
    const name = entry.replace(/\s*\([^)]*\)\s*$/, '').trim()
    return { name, email: null, phone: null }
  }).filter(f => f.name)
}

async function insertAssignment(
  db: any,
  eventId: string,
  session: SessionRow,
  person: { name: string; email: string | null; phone: string | null },
  role: string,
) {
  // Check if already exists (by session_id + name + role)
  const { data: existing } = await db
    .from("faculty_assignments")
    .select("id")
    .eq("session_id", session.id)
    .eq("faculty_name", person.name)
    .eq("role", role)
    .maybeSingle()

  if (existing) {
    // Update email/phone if missing or placeholder on existing assignment
    if (person.email || person.phone) {
      const { data: existingFull } = await db
        .from("faculty_assignments")
        .select("faculty_email, faculty_phone")
        .eq("id", existing.id)
        .single()

      if (existingFull) {
        const updates: any = {}
        if (person.email && (!existingFull.faculty_email || existingFull.faculty_email.includes("@placeholder."))) {
          updates.faculty_email = person.email
        }
        if (person.phone && !existingFull.faculty_phone) {
          updates.faculty_phone = person.phone
        }
        if (Object.keys(updates).length > 0) {
          await db.from("faculty_assignments").update(updates).eq("id", existing.id)
        }
      }
    }
    return { created: false, error: null }
  }

  const { error } = await db
    .from("faculty_assignments")
    .insert({
      event_id: eventId,
      session_id: session.id,
      faculty_name: person.name,
      faculty_email: person.email,
      faculty_phone: person.phone,
      role,
      session_date: session.session_date,
      start_time: session.start_time,
      end_time: session.end_time,
      hall: session.hall,
      session_name: session.session_name,
      topic_title: session.session_name,
      invitation_token: generateToken(),
    })

  return { created: !error, error: error?.message || null }
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

    // Fetch all sessions for this event (include both _text and plain name columns)
    const { data: sessionsData, error: sessionsError } = await db
      .from("sessions")
      .select("id, event_id, session_name, session_date, start_time, end_time, hall, specialty_track, speakers_text, chairpersons_text, moderators_text, speakers, chairpersons, moderators, description")
      .eq("event_id", eventId)

    if (sessionsError) {
      return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
    }

    const sessions = (sessionsData || []) as SessionRow[]

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const session of sessions) {
      // Parse speakers: prefer speakers_text (has email/phone), fallback to speakers column (names only)
      const speakersFromText = parseFacultyText(session.speakers_text)
      const speakers = speakersFromText.length > 0 ? speakersFromText : parseNamesList(session.speakers)

      for (const speaker of speakers) {
        const result = await insertAssignment(db, eventId, session, speaker, 'speaker')
        if (result.created) created++
        else if (result.error) {
          if (errors.length < 5) errors.push(`Speaker ${speaker.name}: ${result.error}`)
          skipped++
        } else {
          skipped++
        }
      }

      // Parse chairpersons: prefer chairpersons_text, fallback to chairpersons column
      const chairsFromText = parseFacultyText(session.chairpersons_text)
      const chairpersons = chairsFromText.length > 0 ? chairsFromText : parseNamesList(session.chairpersons)

      for (const chair of chairpersons) {
        const result = await insertAssignment(db, eventId, session, chair, 'chairperson')
        if (result.created) created++
        else if (result.error) {
          if (errors.length < 5) errors.push(`Chair ${chair.name}: ${result.error}`)
          skipped++
        } else {
          skipped++
        }
      }

      // Parse moderators: prefer moderators_text, fallback to moderators column
      const modsFromText = parseFacultyText(session.moderators_text)
      const moderators = modsFromText.length > 0 ? modsFromText : parseNamesList(session.moderators)

      for (const mod of moderators) {
        const result = await insertAssignment(db, eventId, session, mod, 'moderator')
        if (result.created) created++
        else if (result.error) {
          if (errors.length < 5) errors.push(`Moderator ${mod.name}: ${result.error}`)
          skipped++
        } else {
          skipped++
        }
      }

      // Also check description for roles like "Panelist: Name"
      if (session.description) {
        const panelistMatches = session.description.match(/Panelist:\s*([^;]+)/g)
        if (panelistMatches) {
          for (const match of panelistMatches) {
            const name = match.replace(/^Panelist:\s*/, '').trim()
            if (name) {
              const result = await insertAssignment(db, eventId, session, { name, email: null, phone: null }, 'panelist')
              if (result.created) created++
              else skipped++
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: created + skipped,
      sampleErrors: errors.length > 0 ? errors : undefined,
    })

  } catch (error) {
    console.error("Error syncing assignments:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
