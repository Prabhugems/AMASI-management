import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

function maskToken(token: string): string {
  if (!token) return '<empty>'
  return `${token.slice(0, 6)}...`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveSpeakerToken(supabase: any, token: string) {
  const { data: tokenRow } = await supabase
    .from('faculty_assignments')
    .select('id, event_id, faculty_id, faculty_email, faculty_name')
    .eq('invitation_token', token)
    .maybeSingle()
  return tokenRow
}

// GET /api/speaker/[token]/dashboard
// Returns the speaker's post-event aggregate view.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createAdminClient()

  try {
    const tokenRow = await resolveSpeakerToken(supabase, token)
    if (!tokenRow) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }

    // Find sibling assignments by (event_id, faculty_email) — same as other speaker routes.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let assignmentsQuery = (supabase as any)
      .from('faculty_assignments')
      .select('id, event_id, session_id, faculty_id, faculty_name, faculty_email, role, topic_title, session_name, session_date, start_time, end_time, hall, status')
      .eq('event_id', tokenRow.event_id)

    if (tokenRow.faculty_email) {
      assignmentsQuery = assignmentsQuery.eq('faculty_email', tokenRow.faculty_email)
    } else {
      assignmentsQuery = assignmentsQuery.eq('faculty_name', tokenRow.faculty_name)
    }

    const { data: assignmentsRaw } = await assignmentsQuery
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignments = (assignmentsRaw ?? []) as any[]
    const siblingIds: string[] = assignments.map((a) => a.id)
    const siblingSessionIds: string[] = Array.from(
      new Set(assignments.map((a) => a.session_id).filter((id): id is string => !!id))
    )

    // Event info (name + end_date)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: eventRow } = await (supabase as any)
      .from('events')
      .select('id, name, start_date, end_date')
      .eq('id', tokenRow.event_id)
      .maybeSingle()

    const eventEndDate: string | null = eventRow?.end_date ?? null
    const is_post_event = eventEndDate ? new Date(eventEndDate) < new Date() : false

    // Feedback: where session_speaker_id IN siblings OR (session_id IN sibling_sessions AND session_speaker_id IS NULL)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let feedbackRows: any[] = []
    if (siblingIds.length > 0 || siblingSessionIds.length > 0) {
      const orParts: string[] = []
      if (siblingIds.length > 0) {
        orParts.push(`session_speaker_id.in.(${siblingIds.join(',')})`)
      }
      if (siblingSessionIds.length > 0) {
        orParts.push(`and(session_id.in.(${siblingSessionIds.join(',')}),session_speaker_id.is.null)`)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fb } = await (supabase as any)
        .from('session_feedback')
        .select('id, session_id, session_speaker_id, rating_overall, rating_content, rating_delivery, comments, created_at')
        .or(orParts.join(','))
      feedbackRows = (fb ?? [])
    }

    // Q&A (published only): where session_speaker_id IN siblings OR session_id IN sibling_sessions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let qaRows: any[] = []
    if (siblingIds.length > 0 || siblingSessionIds.length > 0) {
      const orParts: string[] = []
      if (siblingIds.length > 0) {
        orParts.push(`session_speaker_id.in.(${siblingIds.join(',')})`)
      }
      if (siblingSessionIds.length > 0) {
        orParts.push(`session_id.in.(${siblingSessionIds.join(',')})`)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: qa } = await (supabase as any)
        .from('session_qa')
        .select('id, session_id, session_speaker_id, question, answer, is_published, upvotes, asked_at')
        .eq('is_published', true)
        .or(orParts.join(','))
        .order('upvotes', { ascending: false })
      qaRows = (qa ?? [])
    }

    // Attendance: where session_speaker_id IN siblings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let attendanceRows: any[] = []
    if (siblingIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: att } = await (supabase as any)
        .from('session_attendance_speaker')
        .select('id, session_speaker_id, checked_in_at, arrived_late, no_show')
        .in('session_speaker_id', siblingIds)
      attendanceRows = (att ?? [])
    }

    // CME: where session_id IN sibling_sessions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cmeRows: any[] = []
    if (siblingSessionIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cme } = await (supabase as any)
        .from('session_cme')
        .select('id, session_id, cme_credits')
        .in('session_id', siblingSessionIds)
      cmeRows = (cme ?? [])
    }

    // Honorarium
    let honorarium: { amount: number; currency: string; status: string; paid_at?: string | null } | null = null
    if (tokenRow.faculty_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: efRow } = await (supabase as any)
        .from('event_faculty')
        .select('honorarium_amount, honorarium_status, honorarium_currency, honorarium_paid_at')
        .eq('faculty_id', tokenRow.faculty_id)
        .eq('event_id', tokenRow.event_id)
        .maybeSingle()
      if (efRow && (efRow.honorarium_amount != null || efRow.honorarium_status)) {
        honorarium = {
          amount: Number(efRow.honorarium_amount ?? 0),
          currency: efRow.honorarium_currency ?? 'INR',
          status: efRow.honorarium_status ?? 'pending',
          paid_at: efRow.honorarium_paid_at ?? null,
        }
      }
    }

    // Content counts per assignment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contentRows: any[] = []
    if (siblingIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cr } = await (supabase as any)
        .from('speaker_content')
        .select('id, faculty_assignment_id')
        .eq('is_current', true)
        .in('faculty_assignment_id', siblingIds)
      contentRows = (cr ?? [])
    }

    // Aggregate per assignment
    const perAssignment = assignments.map((a) => {
      const feedbackForAssignment = feedbackRows.filter(
        (f) =>
          f.session_speaker_id === a.id ||
          (f.session_speaker_id == null && a.session_id && f.session_id === a.session_id)
      )
      const count = feedbackForAssignment.length
      const sumOverall = feedbackForAssignment.reduce((s, f) => s + (Number(f.rating_overall) || 0), 0)
      const sumContent = feedbackForAssignment.reduce((s, f) => s + (Number(f.rating_content) || 0), 0)
      const sumDelivery = feedbackForAssignment.reduce((s, f) => s + (Number(f.rating_delivery) || 0), 0)
      const overallValues = feedbackForAssignment.map((f) => Number(f.rating_overall)).filter((v) => !isNaN(v) && v > 0)
      const contentValues = feedbackForAssignment.map((f) => Number(f.rating_content)).filter((v) => !isNaN(v) && v > 0)
      const deliveryValues = feedbackForAssignment.map((f) => Number(f.rating_delivery)).filter((v) => !isNaN(v) && v > 0)

      const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      for (const v of overallValues) {
        const k = Math.round(v) as 1 | 2 | 3 | 4 | 5
        if (k >= 1 && k <= 5) distribution[k]++
      }

      const qaForAssignment = qaRows.filter(
        (q) => q.session_speaker_id === a.id || (a.session_id && q.session_id === a.session_id)
      )
      // dedupe by id
      const seen = new Set<string>()
      const uniqueQa = qaForAssignment.filter((q) => {
        if (seen.has(q.id)) return false
        seen.add(q.id)
        return true
      })

      const attRow = attendanceRows.find((r) => r.session_speaker_id === a.id) || null
      const cmeForSession = cmeRows
        .filter((c) => a.session_id && c.session_id === a.session_id)
        .reduce((s, c) => s + (Number(c.cme_credits) || 0), 0)

      const contentCount = contentRows.filter((c) => c.faculty_assignment_id === a.id).length

      return {
        ...a,
        ratings: {
          count,
          avg_overall: overallValues.length > 0 ? sumOverall / overallValues.length : 0,
          avg_content: contentValues.length > 0 ? sumContent / contentValues.length : 0,
          avg_delivery: deliveryValues.length > 0 ? sumDelivery / deliveryValues.length : 0,
          distribution,
        },
        qa: uniqueQa,
        attendance: attRow
          ? {
              checked_in_at: attRow.checked_in_at ?? null,
              arrived_late: !!attRow.arrived_late,
              no_show: !!attRow.no_show,
              recorded: true,
            }
          : { checked_in_at: null, arrived_late: false, no_show: false, recorded: false },
        cme_credits: cmeForSession,
        content_count: contentCount,
      }
    })

    // Totals
    const total_sessions = assignments.length
    const allOverall = feedbackRows.map((f) => Number(f.rating_overall)).filter((v) => !isNaN(v) && v > 0)
    const total_ratings = allOverall.length
    const avg_overall =
      total_ratings > 0 ? allOverall.reduce((s, v) => s + v, 0) / total_ratings : 0
    const total_cme_credits = perAssignment.reduce((s, a) => s + (a.cme_credits || 0), 0)
    // Total Q&A across sessions (dedupe by id)
    const qaIds = new Set<string>()
    for (const q of qaRows) qaIds.add(q.id)
    const total_qa_received = qaIds.size

    return NextResponse.json({
      event: eventRow
        ? { id: eventRow.id, name: eventRow.name, start_date: eventRow.start_date, end_date: eventRow.end_date }
        : null,
      assignments: perAssignment,
      totals: {
        total_sessions,
        total_ratings,
        avg_overall,
        total_cme_credits,
        total_qa_received,
        honorarium,
      },
      is_post_event,
    })
  } catch (e) {
    console.error('speaker dashboard GET error:', { token: maskToken(token), error: e })
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
