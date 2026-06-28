import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireEventAndPermission } from '@/lib/auth/api-auth'

const VALID_ROLES = ['speaker', 'chairperson', 'moderator', 'panelist', 'keynote', 'discussant'] as const
type Role = (typeof VALID_ROLES)[number]

const VALID_STATUSES = ['pending', 'invited', 'confirmed', 'declined', 'change_requested', 'cancelled'] as const
const VALID_PARTICIPATION_MODES = ['online', 'offline', 'hybrid'] as const

// GET /api/events/[eventId]/session-speakers?session_id=...&role=...
// Lists assignments for an event, optionally filtered. Joins faculty profile fields.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  const url = new URL(request.url)
  const sessionId = url.searchParams.get('session_id')
  const role = url.searchParams.get('role')
  const status = url.searchParams.get('status')

  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('faculty_assignments')
    .select(`
      id, event_id, session_id, faculty_id, faculty_name, faculty_email, faculty_phone,
      role, topic_title, topic_description, session_date, start_time, end_time, hall,
      session_name, status, response_notes, responded_at, invitation_sent_at, invitation_token,
      registration_id, participation_mode, display_order, replaced_by, created_at, updated_at,
      faculty:faculty_id (
        id, name, email, title, designation, institution, photo_url,
        bio_markdown, expertise_tags, headshot_urls, youtube_reel_url,
        linkedin, twitter, orcid_id
      )
    `)
    .eq('event_id', eventId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (sessionId) query = query.eq('session_id', sessionId)
  if (role) query = query.eq('role', role)
  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) {
    console.error('session-speakers GET error', { eventId, error })
    return NextResponse.json({ error: 'Failed to load assignments' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/events/[eventId]/session-speakers
// Body: { session_id, faculty_id?, faculty_name, faculty_email?, role, topic_title?, topic_description?, display_order?, status? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const sessionId = body.session_id as string | undefined
  const facultyId = body.faculty_id as string | null | undefined
  const facultyName = (body.faculty_name as string | undefined)?.trim()
  const facultyEmail = (body.faculty_email as string | undefined)?.trim().toLowerCase() || null
  const role = body.role as Role | undefined

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }
  if (!facultyName) {
    return NextResponse.json({ error: 'faculty_name is required' }, { status: 400 })
  }
  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `role must be one of: ${VALID_ROLES.join(', ')}` },
      { status: 400 }
    )
  }

  if (
    typeof body.status === 'string' &&
    !(VALID_STATUSES as readonly string[]).includes(body.status)
  ) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  if (
    typeof body.participation_mode === 'string' &&
    !(VALID_PARTICIPATION_MODES as readonly string[]).includes(body.participation_mode)
  ) {
    return NextResponse.json(
      { error: `participation_mode must be one of: ${VALID_PARTICIPATION_MODES.join(', ')}` },
      { status: 400 }
    )
  }

  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = await (supabase as any)
    .from('sessions')
    .select('id, event_id, session_name, session_date, start_time, end_time, hall')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session || session.event_id !== eventId) {
    return NextResponse.json({ error: 'Session not found for this event' }, { status: 404 })
  }

  // If display_order not provided, append at end.
  // Race-prone for concurrent inserts; acceptable at Phase 1 single-admin scale.
  let displayOrder = typeof body.display_order === 'number' ? body.display_order : null
  if (displayOrder === null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: maxRow } = await (supabase as any)
      .from('faculty_assignments')
      .select('display_order')
      .eq('session_id', sessionId)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    displayOrder = maxRow ? (maxRow.display_order as number) + 1 : 0
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('faculty_assignments')
    .insert({
      event_id: eventId,
      session_id: sessionId,
      faculty_id: facultyId || null,
      faculty_name: facultyName,
      faculty_email: facultyEmail,
      faculty_phone: (body.faculty_phone as string | undefined)?.trim() || null,
      role,
      topic_title: (body.topic_title as string | undefined)?.trim() || null,
      topic_description: (body.topic_description as string | undefined)?.trim() || null,
      session_date: session.session_date,
      start_time: session.start_time,
      end_time: session.end_time,
      hall: session.hall,
      session_name: session.session_name,
      display_order: displayOrder,
      status: (body.status as string | undefined) || 'pending',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'This faculty is already assigned to this session in this role' },
        { status: 409 }
      )
    }
    console.error('session-speakers POST error', { eventId, error })
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }

  return NextResponse.json({ data, success: true })
}
