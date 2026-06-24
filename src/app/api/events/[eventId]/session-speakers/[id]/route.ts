import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireEventAndPermission } from '@/lib/auth/api-auth'

const VALID_ROLES = ['speaker', 'chairperson', 'moderator', 'panelist', 'keynote', 'discussant']
const VALID_STATUSES = ['pending', 'invited', 'confirmed', 'declined', 'change_requested', 'cancelled']

const PATCHABLE_FIELDS = [
  'faculty_id', 'faculty_name', 'faculty_email', 'faculty_phone',
  'role', 'topic_title', 'topic_description', 'display_order',
  'status', 'response_notes', 'participation_mode', 'replaced_by',
] as const

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  const { eventId, id } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('faculty_assignments')
    .select(`
      *,
      faculty:faculty_id (
        id, name, email, title, designation, institution, photo_url,
        bio_markdown, expertise_tags, headshot_urls, youtube_reel_url,
        linkedin, twitter, orcid_id
      )
    `)
    .eq('id', id)
    .eq('event_id', eventId)
    .maybeSingle()

  if (error) {
    console.error('session-speakers GET[id] error', { eventId, id, error })
    return NextResponse.json({ error: 'Failed to load assignment' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }
  return NextResponse.json({ data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  const { eventId, id } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const field of PATCHABLE_FIELDS) {
    if (field in body) update[field] = body[field]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  if (typeof update.role === 'string' && !VALID_ROLES.includes(update.role)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
  }
  if (typeof update.status === 'string' && !VALID_STATUSES.includes(update.status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }
  if (typeof update.faculty_email === 'string') {
    update.faculty_email = update.faculty_email.trim().toLowerCase()
  }
  if (typeof update.faculty_name === 'string') {
    update.faculty_name = update.faculty_name.trim()
    if (!update.faculty_name) {
      return NextResponse.json({ error: 'faculty_name cannot be empty' }, { status: 400 })
    }
  }

  // Track when a status transition happens — set responded_at on confirm/decline.
  if (
    update.status === 'confirmed' || update.status === 'declined' ||
    update.status === 'change_requested'
  ) {
    update.responded_at = new Date().toISOString()
  }

  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('faculty_assignments')
    .update(update)
    .eq('id', id)
    .eq('event_id', eventId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Another assignment already covers this faculty/session/role combination' },
        { status: 409 }
      )
    }
    console.error('session-speakers PATCH error', { eventId, id, error })
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  return NextResponse.json({ data, success: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  const { eventId, id } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  const supabase = await createAdminClient()

  // Confirm the row exists for this event before deleting; Postgrest's
  // delete() does not return the affected row count in a way we can rely on,
  // so we scope the existence check by eventId and 404 if not found.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: lookupError } = await (supabase as any)
    .from('faculty_assignments')
    .select('id')
    .eq('id', id)
    .eq('event_id', eventId)
    .maybeSingle()

  if (lookupError) {
    console.error('session-speakers DELETE lookup error', { eventId, id, error: lookupError })
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('faculty_assignments')
    .delete()
    .eq('id', id)
    .eq('event_id', eventId)

  if (error) {
    console.error('session-speakers DELETE error', { eventId, id, error })
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
