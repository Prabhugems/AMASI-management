import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEventAndPermission } from '@/lib/auth/api-auth'

type CmePatchBody = {
  cme_credits?: number | string | null
  cme_category?: string | null
  accrediting_body?: string | null
  activity_code?: string | null
  requires_completion_quiz?: boolean | null
  quiz_form_id?: string | null
  notes?: string | null
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
  return { ok: true, value: Math.round(num * 100) / 100 }
}

// PATCH /api/events/[eventId]/session-cme/[sessionId]
// Single-session upsert of CME fields.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; sessionId: string }> }
) {
  const { eventId, sessionId } = await params
  const { user, error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  let body: CmePatchBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.cme_credits !== undefined) {
    const v = validateCredits(body.cme_credits)
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 })
    }
  }

  try {
    const supabase = await createAdminClient()

    // Validate session belongs to event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session } = await (supabase as any)
      .from('sessions')
      .select('id, event_id')
      .eq('id', sessionId)
      .maybeSingle()

    if (!session || session.event_id !== eventId) {
      return NextResponse.json({ error: 'Session not found for this event' }, { status: 404 })
    }

    const payload: Record<string, unknown> = {
      event_id: eventId,
      session_id: sessionId,
      created_by: user?.id ?? null,
    }

    if (body.cme_credits !== undefined) {
      const v = validateCredits(body.cme_credits)
      if (v.ok) payload.cme_credits = v.value
    }
    if (body.cme_category !== undefined) payload.cme_category = body.cme_category || null
    if (body.accrediting_body !== undefined) payload.accrediting_body = body.accrediting_body || null
    if (body.activity_code !== undefined) payload.activity_code = body.activity_code || null
    if (body.requires_completion_quiz !== undefined)
      payload.requires_completion_quiz = !!body.requires_completion_quiz
    if (body.quiz_form_id !== undefined) payload.quiz_form_id = body.quiz_form_id || null
    if (body.notes !== undefined) payload.notes = body.notes || null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('session_cme')
      .upsert(payload, { onConflict: 'session_id' })
      .select('*')
      .single()

    if (error) {
      console.error('session-cme PATCH error:', { eventId, sessionId, error })
      return NextResponse.json({ error: 'Failed to save CME row' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e) {
    console.error('session-cme PATCH error:', { eventId, sessionId, error: e })
    return NextResponse.json({ error: 'Failed to save CME row' }, { status: 500 })
  }
}

// DELETE /api/events/[eventId]/session-cme/[sessionId]
// Removes the session_cme row for this session (clears CME).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; sessionId: string }> }
) {
  const { eventId, sessionId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  try {
    const supabase = await createAdminClient()

    // Validate session belongs to event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session } = await (supabase as any)
      .from('sessions')
      .select('id, event_id')
      .eq('id', sessionId)
      .maybeSingle()

    if (!session || session.event_id !== eventId) {
      return NextResponse.json({ error: 'Session not found for this event' }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('session_cme')
      .delete()
      .eq('session_id', sessionId)
      .eq('event_id', eventId)

    if (error) {
      console.error('session-cme DELETE error:', { eventId, sessionId, error })
      return NextResponse.json({ error: 'Failed to delete CME row' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('session-cme DELETE error:', { eventId, sessionId, error: e })
    return NextResponse.json({ error: 'Failed to delete CME row' }, { status: 500 })
  }
}
