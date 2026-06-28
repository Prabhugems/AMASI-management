import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const CONTENT_TYPES = ['slides', 'handout', 'video', 'poster', 'supplementary'] as const
type ContentType = typeof CONTENT_TYPES[number]

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

// GET /api/speaker/[token]/content
// Returns sibling assignments + current speaker_content + deadline info
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

    // Find all sibling assignments for the same speaker in the same event.
    // Match by email when available, otherwise fall back to name.
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
    const siblingIds = assignments.map((a) => a.id)

    let content: unknown[] = []
    if (siblingIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: contentRows } = await (supabase as any)
        .from('speaker_content')
        .select('*')
        .eq('event_id', tokenRow.event_id)
        .eq('is_current', true)
        .in('faculty_assignment_id', siblingIds)
        .order('uploaded_at', { ascending: false })
      content = contentRows ?? []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (supabase as any)
      .from('event_settings')
      .select('speaker_content_deadline')
      .eq('event_id', tokenRow.event_id)
      .maybeSingle()
    const deadline = (settings?.speaker_content_deadline as string | null) ?? null
    const deadline_passed = deadline ? new Date(deadline) < new Date() : false

    return NextResponse.json({
      assignments,
      content,
      deadline,
      deadline_passed,
    })
  } catch (e) {
    console.error('speaker content GET error:', { token: maskToken(token), error: e })
    return NextResponse.json({ error: 'Failed to load content' }, { status: 500 })
  }
}

// POST /api/speaker/[token]/content
// Register a content row. Supersedes any existing current row for the same
// (faculty_assignment_id, content_type) pair.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createAdminClient()

  let body: {
    faculty_assignment_id?: string
    content_type?: string
    storage_path?: string
    public_url?: string
    original_filename?: string
    file_size_bytes?: number
    mime_type?: string
    notes?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    faculty_assignment_id,
    content_type,
    storage_path,
    public_url,
    original_filename,
    file_size_bytes,
    mime_type,
    notes,
  } = body

  if (!faculty_assignment_id || !content_type || !storage_path || !original_filename || !mime_type) {
    return NextResponse.json(
      { error: 'faculty_assignment_id, content_type, storage_path, original_filename, mime_type are required' },
      { status: 400 }
    )
  }
  if (typeof file_size_bytes !== 'number' || file_size_bytes <= 0) {
    return NextResponse.json({ error: 'file_size_bytes must be a positive number' }, { status: 400 })
  }
  if (!CONTENT_TYPES.includes(content_type as ContentType)) {
    return NextResponse.json(
      { error: `content_type must be one of: ${CONTENT_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const tokenRow = await resolveSpeakerToken(supabase, token)
    if (!tokenRow) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }

    // Ownership check: the target assignment must belong to the same speaker.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let siblingsQuery = (supabase as any)
      .from('faculty_assignments')
      .select('id')
      .eq('event_id', tokenRow.event_id)
    if (tokenRow.faculty_email) {
      siblingsQuery = siblingsQuery.eq('faculty_email', tokenRow.faculty_email)
    } else {
      siblingsQuery = siblingsQuery.eq('faculty_name', tokenRow.faculty_name)
    }
    const { data: siblings } = await siblingsQuery
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const siblingIds = ((siblings ?? []) as any[]).map((r) => r.id)
    if (!siblingIds.includes(faculty_assignment_id)) {
      console.error('speaker content POST forbidden:', {
        token: maskToken(token),
        faculty_assignment_id,
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Deadline check.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (supabase as any)
      .from('event_settings')
      .select('speaker_content_deadline')
      .eq('event_id', tokenRow.event_id)
      .maybeSingle()
    const deadline = (settings?.speaker_content_deadline as string | null) ?? null
    if (deadline && new Date(deadline) < new Date()) {
      return NextResponse.json(
        { error: 'Upload deadline has passed' },
        { status: 400 }
      )
    }

    // Defense-in-depth path check.
    const expectedPrefix = `events/${tokenRow.event_id}/${faculty_assignment_id}/${content_type}/`
    if (!storage_path.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: `storage_path must start with ${expectedPrefix}` },
        { status: 400 }
      )
    }

    // Look up existing current row to determine version + action_type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prev } = await (supabase as any)
      .from('speaker_content')
      .select('id, version')
      .eq('faculty_assignment_id', faculty_assignment_id)
      .eq('content_type', content_type)
      .eq('is_current', true)
      .maybeSingle()

    let newVersion = 1
    let actionType: 'uploaded_content' | 'replaced_content' = 'uploaded_content'
    if (prev) {
      newVersion = (prev.version ?? 1) + 1
      actionType = 'replaced_content'
      // Supersede the previous current row.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: supersedeError } = await (supabase as any)
        .from('speaker_content')
        .update({ is_current: false, superseded_at: new Date().toISOString() })
        .eq('id', prev.id)
      if (supersedeError) {
        console.error('speaker content supersede error:', {
          token: maskToken(token),
          faculty_assignment_id,
          prev_id: prev.id,
          error: supersedeError,
        })
        return NextResponse.json({ error: 'Failed to supersede previous version' }, { status: 500 })
      }
    }

    const insertPayload = {
      faculty_assignment_id,
      event_id: tokenRow.event_id,
      faculty_id: tokenRow.faculty_id ?? null,
      content_type,
      storage_bucket: 'speaker-content',
      storage_path,
      public_url: public_url ?? null,
      original_filename,
      file_size_bytes,
      mime_type,
      version: newVersion,
      is_current: true,
      notes: notes ?? null,
      uploaded_by_token: token,
      uploaded_by_email: tokenRow.faculty_email ?? null,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newRow, error: insertError } = await (supabase as any)
      .from('speaker_content')
      .insert(insertPayload)
      .select('*')
      .single()

    if (insertError) {
      console.error('speaker content insert error:', {
        token: maskToken(token),
        faculty_assignment_id,
        error: insertError,
      })
      return NextResponse.json({ error: 'Failed to register content' }, { status: 500 })
    }

    // Log portal action (best-effort).
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || request.headers.get('x-real-ip')
      || null
    const userAgent = request.headers.get('user-agent') || null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('speaker_portal_actions')
      .insert({
        faculty_assignment_id,
        event_id: tokenRow.event_id,
        action_type: actionType,
        payload: {
          content_id: newRow.id,
          content_type,
          faculty_assignment_id,
        },
        ip_address: ip,
        user_agent: userAgent,
      })

    return NextResponse.json({ data: newRow })
  } catch (e) {
    console.error('speaker content POST error:', { token: maskToken(token), error: e })
    return NextResponse.json({ error: 'Failed to register content' }, { status: 500 })
  }
}
