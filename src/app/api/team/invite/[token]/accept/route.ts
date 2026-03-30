import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST - Accept team invitation (public route, no auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      )
    }

    const adminClientRaw = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClientRaw as any

    // Find invitation by token
    const { data: invitation, error: fetchError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (fetchError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation link' },
        { status: 404 }
      )
    }

    // Validate status
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `This invitation has already been ${invitation.status}` },
        { status: 400 }
      )
    }

    // Check expiration
    const now = new Date()
    const expiresAt = new Date(invitation.expires_at)
    if (expiresAt < now) {
      return NextResponse.json(
        { error: 'This invitation has expired. Please ask the admin to resend it.' },
        { status: 410 }
      )
    }

    // Check if email already exists in team_members (in case they were added manually)
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id')
      .ilike('email', invitation.email)
      .eq('is_active', true)
      .maybeSingle()

    if (existingMember) {
      // Mark invitation as accepted since they're already a member
      await supabase
        .from('team_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      return NextResponse.json({
        success: true,
        message: 'You are already a team member',
        redirect: '/login',
      })
    }

    // Create team_member record from invitation data
    const { data: teamMember, error: memberError } = await supabase
      .from('team_members')
      .insert({
        email: invitation.email,
        name: invitation.name || invitation.email.split('@')[0],
        role: invitation.role,
        permissions: invitation.permissions || null,
        event_ids: invitation.event_ids || null,
        is_active: true,
        invited_by: invitation.invited_by,
      })
      .select()
      .single()

    if (memberError) {
      console.error('Failed to create team member:', memberError)
      return NextResponse.json(
        { error: 'Failed to accept invitation. Please try again or contact support.' },
        { status: 500 }
      )
    }

    // Update invitation status to accepted
    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)

    if (updateError) {
      console.error('Failed to update invitation status:', updateError)
      // Non-critical - member was created successfully
    }

    // Log activity
    try {
      await supabase.from('team_activity_logs').insert({
        actor_id: teamMember.id,
        actor_email: invitation.email,
        action: 'team_member.invite_accepted',
        target_email: invitation.email,
        metadata: {
          invitation_id: invitation.id,
          team_member_id: teamMember.id,
          role: invitation.role,
        },
      })
    } catch (logError) {
      console.error('Failed to log invite acceptance:', logError)
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully. You can now log in.',
      redirect: '/login',
      data: {
        team_member_id: teamMember.id,
        email: invitation.email,
        role: invitation.role,
      },
    })
  } catch (error) {
    console.error('Accept invite API error:', error)
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    )
  }
}
