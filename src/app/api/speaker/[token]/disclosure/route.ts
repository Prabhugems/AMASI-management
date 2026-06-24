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

type DisclosureEntity = {
  org?: string
  relationship?: string
  compensation_type?: string
}

// GET /api/speaker/[token]/disclosure
// Returns the current disclosure for the speaker's faculty_id (if any), plus faculty identity.
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

    if (!tokenRow.faculty_id) {
      // Without a faculty_id we cannot resolve a disclosure row (it's the FK).
      return NextResponse.json({
        disclosure: null,
        faculty: {
          id: null,
          name: tokenRow.faculty_name ?? null,
          email: tokenRow.faculty_email ?? null,
        },
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: facultyRow } = await (supabase as any)
      .from('faculty')
      .select('id, name, email')
      .eq('id', tokenRow.faculty_id)
      .maybeSingle()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: disclosure } = await (supabase as any)
      .from('speaker_disclosures')
      .select('*')
      .eq('faculty_id', tokenRow.faculty_id)
      .eq('event_id', tokenRow.event_id)
      .eq('is_current', true)
      .maybeSingle()

    return NextResponse.json({
      disclosure: disclosure ?? null,
      faculty: {
        id: facultyRow?.id ?? tokenRow.faculty_id,
        name: facultyRow?.name ?? tokenRow.faculty_name ?? null,
        email: facultyRow?.email ?? tokenRow.faculty_email ?? null,
      },
    })
  } catch (e) {
    console.error('speaker disclosure GET error:', { token: maskToken(token), error: e })
    return NextResponse.json({ error: 'Failed to load disclosure' }, { status: 500 })
  }
}

// POST /api/speaker/[token]/disclosure
// Sign a new disclosure. Supersedes any current row for the (faculty_id, event_id).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createAdminClient()

  let body: {
    has_conflict?: boolean
    disclosure_text?: string
    entities?: DisclosureEntity[]
    signature_image_url?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { has_conflict, disclosure_text, entities, signature_image_url } = body

  if (typeof has_conflict !== 'boolean') {
    return NextResponse.json(
      { error: 'has_conflict (boolean) is required' },
      { status: 400 }
    )
  }

  const safeEntities: DisclosureEntity[] = Array.isArray(entities)
    ? entities
        .filter((e) => e && typeof e === 'object')
        .map((e) => ({
          org: typeof e.org === 'string' ? e.org : '',
          relationship: typeof e.relationship === 'string' ? e.relationship : '',
          compensation_type:
            typeof e.compensation_type === 'string' ? e.compensation_type : '',
        }))
    : []

  if (has_conflict && safeEntities.length === 0) {
    return NextResponse.json(
      { error: 'At least one entity is required when has_conflict is true' },
      { status: 400 }
    )
  }

  try {
    const tokenRow = await resolveSpeakerToken(supabase, token)
    if (!tokenRow) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }
    if (!tokenRow.faculty_id) {
      return NextResponse.json(
        { error: 'Assignment has no linked faculty record; cannot sign disclosure' },
        { status: 400 }
      )
    }

    // Look up existing current disclosure to compute new version.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prev } = await (supabase as any)
      .from('speaker_disclosures')
      .select('id, version')
      .eq('faculty_id', tokenRow.faculty_id)
      .eq('event_id', tokenRow.event_id)
      .eq('is_current', true)
      .maybeSingle()

    const newVersion: number = prev ? (prev.version ?? 1) + 1 : 1

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      null

    // Step 1: supersede the previous current row BEFORE inserting the new one,
    // so the partial unique index on (faculty_id, event_id) WHERE is_current
    // doesn't conflict. superseded_by will be patched after insert.
    if (prev) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: supersedeError } = await (supabase as any)
        .from('speaker_disclosures')
        .update({
          is_current: false,
          superseded_at: new Date().toISOString(),
        })
        .eq('id', prev.id)
      if (supersedeError) {
        console.error('speaker disclosure supersede error:', {
          token: maskToken(token),
          prev_id: prev.id,
          error: supersedeError,
        })
        return NextResponse.json(
          { error: 'Failed to supersede previous disclosure' },
          { status: 500 }
        )
      }
    }

    // Step 2: insert the new disclosure row.
    // TODO(Phase 4): render the disclosure to a PDF and store under pdf_storage_path
    // in the speaker-disclosures bucket. For now we keep it NULL and the UI
    // renders the row data directly.
    const insertPayload = {
      faculty_id: tokenRow.faculty_id,
      event_id: tokenRow.event_id,
      version: newVersion,
      has_conflict,
      disclosure_text: disclosure_text ?? null,
      entities: has_conflict ? safeEntities : [],
      signed_at: new Date().toISOString(),
      signed_ip: ip,
      signed_by_token: token,
      signature_image_url: signature_image_url ?? null,
      pdf_storage_path: null as string | null,
      is_current: true,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newRow, error: insertError } = await (supabase as any)
      .from('speaker_disclosures')
      .insert(insertPayload)
      .select('*')
      .single()

    if (insertError) {
      console.error('speaker disclosure insert error:', {
        token: maskToken(token),
        error: insertError,
      })
      return NextResponse.json({ error: 'Failed to sign disclosure' }, { status: 500 })
    }

    // Step 3: backfill superseded_by on the previous row now that we have new id.
    if (prev) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('speaker_disclosures')
        .update({ superseded_by: newRow.id })
        .eq('id', prev.id)
    }

    // Log portal action (best-effort).
    const userAgent = request.headers.get('user-agent') || null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('speaker_portal_actions')
      .insert({
        faculty_assignment_id: tokenRow.id,
        event_id: tokenRow.event_id,
        action_type: 'signed_disclosure',
        payload: {
          disclosure_id: newRow.id,
          version: newVersion,
          has_conflict,
        },
        ip_address: ip,
        user_agent: userAgent,
      })

    return NextResponse.json({ data: newRow })
  } catch (e) {
    console.error('speaker disclosure POST error:', { token: maskToken(token), error: e })
    return NextResponse.json({ error: 'Failed to sign disclosure' }, { status: 500 })
  }
}
