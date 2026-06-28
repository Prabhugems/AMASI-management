import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEventAndPermission } from '@/lib/auth/api-auth'

// Upsertable fields on session_cme
type CmeUpsertRow = {
  session_id: string
  cme_credits?: number | string | null
  cme_category?: string | null
  accrediting_body?: string | null
  activity_code?: string | null
  requires_completion_quiz?: boolean | null
  quiz_form_id?: string | null
  notes?: string | null
}

type SessionRow = {
  id: string
  event_id: string
  session_name: string | null
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall: string | null
  specialty_track: string | null
}

type CmeRow = {
  id: string
  session_id: string
  event_id: string
  cme_credits: number | string | null
  cme_category: string | null
  accrediting_body: string | null
  activity_code: string | null
  requires_completion_quiz: boolean
  quiz_form_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

function validateCredits(value: unknown): { ok: true; value: number } | { ok: false; error: string } {
  if (value === null || value === undefined || value === '') {
    return { ok: true, value: 0 }
  }
  const num = typeof value === 'string' ? Number(value) : (value as number)
  if (!Number.isFinite(num)) {
    return { ok: false, error: 'cme_credits must be a number' }
  }
  if (num < 0) {
    return { ok: false, error: 'cme_credits must be >= 0' }
  }
  if (num > 99.99) {
    return { ok: false, error: 'cme_credits must be <= 99.99' }
  }
  // Round to 2 decimal places for NUMERIC(4,2)
  return { ok: true, value: Math.round(num * 100) / 100 }
}

// GET /api/events/[eventId]/session-cme
// Returns all sessions for the event paired with their session_cme row (or null).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  try {
    const supabase = await createAdminClient()

    // Load all sessions for the event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessionsData, error: sessionsError } = await (supabase as any)
      .from('sessions')
      .select('id, event_id, session_name, session_date, start_time, end_time, hall, specialty_track')
      .eq('event_id', eventId)
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (sessionsError) {
      console.error('session-cme GET sessions error:', { eventId, error: sessionsError })
      return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 })
    }

    const sessions = (sessionsData ?? []) as SessionRow[]

    // Load all session_cme rows for the event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cmeData, error: cmeError } = await (supabase as any)
      .from('session_cme')
      .select('*')
      .eq('event_id', eventId)

    if (cmeError) {
      console.error('session-cme GET cme error:', { eventId, error: cmeError })
      return NextResponse.json({ error: 'Failed to load CME rows' }, { status: 500 })
    }

    const cmeRows = (cmeData ?? []) as CmeRow[]
    const cmeBySessionId = new Map<string, CmeRow>()
    for (const row of cmeRows) {
      cmeBySessionId.set(row.session_id, row)
    }

    const data = sessions.map((session) => ({
      session,
      cme: cmeBySessionId.get(session.id) ?? null,
    }))

    return NextResponse.json({ data })
  } catch (e) {
    console.error('session-cme GET error:', { eventId, error: e })
    return NextResponse.json({ error: 'Failed to load CME data' }, { status: 500 })
  }
}

// PUT /api/events/[eventId]/session-cme
// Bulk upsert. Body: { rows: [{ session_id, ...fields }] }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { user, error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  let body: { rows?: CmeUpsertRow[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rows = Array.isArray(body.rows) ? body.rows : null
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: 'rows array is required' }, { status: 400 })
  }

  // Validate each row
  for (const row of rows) {
    if (!row.session_id || typeof row.session_id !== 'string') {
      return NextResponse.json(
        { error: 'Each row must include session_id' },
        { status: 400 }
      )
    }
    if (row.cme_credits !== undefined) {
      const v = validateCredits(row.cme_credits)
      if (!v.ok) {
        return NextResponse.json(
          { error: `Session ${row.session_id}: ${v.error}` },
          { status: 400 }
        )
      }
    }
  }

  try {
    const supabase = await createAdminClient()

    // Validate all sessions belong to the event
    const sessionIds = rows.map((r) => r.session_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ownedSessions } = await (supabase as any)
      .from('sessions')
      .select('id')
      .eq('event_id', eventId)
      .in('id', sessionIds)

    const ownedIds = new Set<string>(((ownedSessions ?? []) as { id: string }[]).map((s) => s.id))
    const invalid = sessionIds.filter((id) => !ownedIds.has(id))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Sessions not found for this event: ${invalid.join(', ')}` },
        { status: 404 }
      )
    }

    // Build upsert payload
    const payload = rows.map((r) => {
      const credits = r.cme_credits !== undefined ? validateCredits(r.cme_credits) : null
      const row: Record<string, unknown> = {
        event_id: eventId,
        session_id: r.session_id,
        created_by: user?.id ?? null,
      }
      if (credits && credits.ok) row.cme_credits = credits.value
      if (r.cme_category !== undefined) row.cme_category = r.cme_category || null
      if (r.accrediting_body !== undefined) row.accrediting_body = r.accrediting_body || null
      if (r.activity_code !== undefined) row.activity_code = r.activity_code || null
      if (r.requires_completion_quiz !== undefined)
        row.requires_completion_quiz = !!r.requires_completion_quiz
      if (r.quiz_form_id !== undefined) row.quiz_form_id = r.quiz_form_id || null
      if (r.notes !== undefined) row.notes = r.notes || null
      return row
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('session_cme')
      .upsert(payload, { onConflict: 'session_id' })
      .select('*')

    if (error) {
      console.error('session-cme PUT upsert error:', { eventId, error })
      return NextResponse.json({ error: 'Failed to save CME rows' }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    console.error('session-cme PUT error:', { eventId, error: e })
    return NextResponse.json({ error: 'Failed to save CME rows' }, { status: 500 })
  }
}
