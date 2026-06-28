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

// DELETE /api/speaker/[token]/content/[id]
// Soft-delete: marks the row not current. Verifies the content belongs to
// one of the speaker's assignments (same email/name in same event).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params
  const supabase = await createAdminClient()

  try {
    const tokenRow = await resolveSpeakerToken(supabase, token)
    if (!tokenRow) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contentRow } = await (supabase as any)
      .from('speaker_content')
      .select('id, faculty_assignment_id, event_id, content_type, is_current')
      .eq('id', id)
      .maybeSingle()

    if (!contentRow) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    // Ownership check via sibling assignments.
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
    if (!siblingIds.includes(contentRow.faculty_assignment_id)) {
      console.error('speaker content DELETE forbidden:', {
        token: maskToken(token),
        content_id: id,
        faculty_assignment_id: contentRow.faculty_assignment_id,
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('speaker_content')
      .update({ is_current: false, superseded_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      console.error('speaker content DELETE update error:', {
        token: maskToken(token),
        content_id: id,
        error: updateError,
      })
      return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || request.headers.get('x-real-ip')
      || null
    const userAgent = request.headers.get('user-agent') || null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('speaker_portal_actions')
      .insert({
        faculty_assignment_id: contentRow.faculty_assignment_id,
        event_id: tokenRow.event_id,
        action_type: 'deleted_content',
        payload: {
          content_id: id,
          content_type: contentRow.content_type,
          faculty_assignment_id: contentRow.faculty_assignment_id,
        },
        ip_address: ip,
        user_agent: userAgent,
      })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('speaker content DELETE error:', {
      token: maskToken(token),
      content_id: id,
      error: e,
    })
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 })
  }
}
