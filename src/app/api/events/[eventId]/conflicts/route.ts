import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
)

type Session = {
  id: string
  session_name: string
  session_date: string
  start_time: string
  end_time: string
  hall: string | null
}

type SpeakerSession = {
  session: Session
  role: string
}

type Conflict = {
  speaker_id: string
  speaker_name: string
  speaker_email: string
  session1: Session & { role: string }
  session2: Session & { role: string }
  overlap_minutes: number
}

// Check if two time ranges overlap
function getOverlapMinutes(
  date1: string,
  start1: string,
  end1: string,
  date2: string,
  start2: string,
  end2: string
): number {
  if (date1 !== date2) return 0

  const toMinutes = (time: string) => {
    if (!time || !time.includes(":")) return 0
    const [h, m] = time.split(":").map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  const s1 = toMinutes(start1)
  const e1 = toMinutes(end1)
  const s2 = toMinutes(start2)
  const e2 = toMinutes(end2)

  const overlapStart = Math.max(s1, s2)
  const overlapEnd = Math.min(e1, e2)

  return Math.max(0, overlapEnd - overlapStart)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params

  try {
    // Fetch all sessions with their speakers
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select(`
        id,
        session_name,
        session_date,
        start_time,
        end_time,
        hall,
        session_speakers (
          role,
          faculty:faculty_id (
            id,
            name,
            email
          )
        )
      `)
      .eq("event_id", eventId)
      .order("session_date")
      .order("start_time")

    if (sessionsError) {
      return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
    }

    // Build a map of speaker -> sessions
    const speakerSessions: Map<string, { speaker: any; sessions: SpeakerSession[] }> = new Map()

    for (const session of sessions || []) {
      for (const ss of session.session_speakers || []) {
        const faculty = ss.faculty as any
        if (!faculty?.id) continue

        if (!speakerSessions.has(faculty.id)) {
          speakerSessions.set(faculty.id, {
            speaker: faculty,
            sessions: [],
          })
        }

        speakerSessions.get(faculty.id)!.sessions.push({
          session: {
            id: session.id,
            session_name: session.session_name,
            session_date: session.session_date,
            start_time: session.start_time,
            end_time: session.end_time,
            hall: session.hall,
          },
          role: ss.role || "Speaker",
        })
      }
    }

    // Find conflicts
    const conflicts: Conflict[] = []

    for (const [speakerId, data] of speakerSessions) {
      const { speaker, sessions: speakerSessionList } = data

      // Check each pair of sessions for this speaker
      for (let i = 0; i < speakerSessionList.length; i++) {
        for (let j = i + 1; j < speakerSessionList.length; j++) {
          const s1 = speakerSessionList[i]
          const s2 = speakerSessionList[j]

          const overlap = getOverlapMinutes(
            s1.session.session_date,
            s1.session.start_time,
            s1.session.end_time,
            s2.session.session_date,
            s2.session.start_time,
            s2.session.end_time
          )

          if (overlap > 0) {
            conflicts.push({
              speaker_id: speakerId,
              speaker_name: speaker.name,
              speaker_email: speaker.email,
              session1: { ...s1.session, role: s1.role },
              session2: { ...s2.session, role: s2.role },
              overlap_minutes: overlap,
            })
          }
        }
      }
    }

    // Sort by overlap duration (most severe first)
    conflicts.sort((a, b) => b.overlap_minutes - a.overlap_minutes)

    // Summary stats
    const summary = {
      total_conflicts: conflicts.length,
      speakers_affected: new Set(conflicts.map((c) => c.speaker_id)).size,
      sessions_affected: new Set([
        ...conflicts.map((c) => c.session1.id),
        ...conflicts.map((c) => c.session2.id),
      ]).size,
    }

    return NextResponse.json({
      success: true,
      summary,
      conflicts,
    })
  } catch (error) {
    console.error("Conflict check error:", error)
    return NextResponse.json({ error: "Failed to check conflicts" }, { status: 500 })
  }
}
