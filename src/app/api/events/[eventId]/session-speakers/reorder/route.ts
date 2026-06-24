import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireEventAndPermission } from '@/lib/auth/api-auth'

// POST /api/events/[eventId]/session-speakers/reorder
// Body: { session_id: string, ordered_ids: string[] }
// Assigns display_order = index for each id in ordered_ids.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  let body: { session_id?: string; ordered_ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.session_id) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }
  if (!Array.isArray(body.ordered_ids) || body.ordered_ids.length === 0) {
    return NextResponse.json({ error: 'ordered_ids must be a non-empty array' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Verify all rows belong to this event+session before reordering.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (supabase as any)
    .from('faculty_assignments')
    .select('id')
    .eq('event_id', eventId)
    .eq('session_id', body.session_id)
    .in('id', body.ordered_ids)

  if (fetchError) {
    console.error('reorder fetch error', { eventId, error: fetchError })
    return NextResponse.json({ error: 'Failed to verify assignments' }, { status: 500 })
  }

  const foundIds = new Set((existing ?? []).map((r: { id: string }) => r.id))
  const missing = body.ordered_ids.filter((id) => !foundIds.has(id))
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Assignments not in this session: ${missing.join(', ')}` },
      { status: 400 }
    )
  }

  // Sequential updates — one per row. Volume is small (single session).
  // NOTE: These writes are NOT transactional. A failure partway through can
  // leave display_order in an inconsistent state; the client should re-fetch
  // on error to observe the actual current ordering.
  // TODO: wrap in a single SQL transaction if multi-admin scenarios appear
  const errors: string[] = []
  for (let i = 0; i < body.ordered_ids.length; i++) {
    const id = body.ordered_ids[i]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('faculty_assignments')
      .update({ display_order: i })
      .eq('id', id)
      .eq('event_id', eventId)
    if (error) errors.push(`${id}: ${error.message}`)
  }

  if (errors.length > 0) {
    console.error('reorder partial failure', { eventId, errors })
    return NextResponse.json(
      {
        error: 'Some reorder writes failed; client should re-fetch to see current state',
        details: errors,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, count: body.ordered_ids.length })
}
