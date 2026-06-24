import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

const CONTENT_TYPES = ['slides', 'handout', 'video', 'poster', 'supplementary'] as const
type ContentType = typeof CONTENT_TYPES[number]

// GET /api/events/[eventId]/speaker-content
// Admin list of current speaker_content for the event, joined with the
// originating faculty_assignment for display context.
// Optional filters: ?content_type=, ?faculty_id=, ?assignment_id=
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  const url = new URL(request.url)
  const contentType = url.searchParams.get('content_type')
  const facultyId = url.searchParams.get('faculty_id')
  const assignmentId = url.searchParams.get('assignment_id')

  if (contentType && !CONTENT_TYPES.includes(contentType as ContentType)) {
    return NextResponse.json(
      { error: `content_type must be one of: ${CONTENT_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const supabase = await createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('speaker_content')
      .select(`
        *,
        faculty_assignment:faculty_assignments(id, session_name, session_date, role, faculty_name, faculty_email)
      `)
      .eq('event_id', eventId)
      .eq('is_current', true)
      .order('uploaded_at', { ascending: false })

    if (contentType) query = query.eq('content_type', contentType)
    if (facultyId) query = query.eq('faculty_id', facultyId)
    if (assignmentId) query = query.eq('faculty_assignment_id', assignmentId)

    const { data, error } = await query
    if (error) {
      console.error('admin speaker-content list error:', { eventId, error })
      return NextResponse.json({ error: 'Failed to load speaker content' }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    console.error('admin speaker-content GET error:', { eventId, error: e })
    return NextResponse.json({ error: 'Failed to load speaker content' }, { status: 500 })
  }
}
