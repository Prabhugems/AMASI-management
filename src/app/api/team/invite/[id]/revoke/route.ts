import { requireAdmin } from '@/lib/auth/api-auth'
import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST - Revoke a pending team invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const adminClientRaw = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClientRaw as any

    // Fetch the invitation
    const { data: invitation, error: fetchError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot revoke: invitation is ${invitation.status}` },
        { status: 400 }
      )
    }

    // Update status to revoked
    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({ status: 'revoked' })
      .eq('id', id)

    if (updateError) {
      console.error('Failed to revoke invitation:', updateError)
      return NextResponse.json(
        { error: 'Failed to revoke invitation' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase
      .from('team_activity_logs')
      .insert({
        actor_id: user.id,
        actor_email: user.email,
        action: 'team_member.invite_revoked',
        target_email: invitation.email,
        metadata: {
          invitation_id: id,
          role: invitation.role,
        },
      })

    return NextResponse.json({
      success: true,
      message: 'Invitation revoked',
    })
  } catch (error) {
    console.error('Revoke invite API error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke invitation' },
      { status: 500 }
    )
  }
}
