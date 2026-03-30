import { requireAdmin } from '@/lib/auth/api-auth'
import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, isEmailEnabled } from '@/lib/email'
import { COMPANY_CONFIG } from '@/lib/config'
import { teamInvitation } from '@/lib/email-templates'

// POST - Send team invitation
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, name, role, permissions, event_ids } = body

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!role?.trim()) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const adminClientRaw = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClientRaw as any

    // Check if email already exists in team_members
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id, name, email')
      .ilike('email', normalizedEmail)
      .eq('is_active', true)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json(
        { error: `${normalizedEmail} is already a team member` },
        { status: 409 }
      )
    }

    // Check if there's already a pending invitation for this email
    const { data: existingInvitation } = await supabase
      .from('team_invitations')
      .select('id, email, status, expires_at')
      .ilike('email', normalizedEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (existingInvitation) {
      return NextResponse.json(
        { error: `An invitation is already pending for ${normalizedEmail}` },
        { status: 409 }
      )
    }

    // Create invitation record
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data: invitation, error: insertError } = await supabase
      .from('team_invitations')
      .insert({
        email: normalizedEmail,
        name: name?.trim() || null,
        role,
        permissions: permissions || null,
        event_ids: event_ids || null,
        invited_by: user.id,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create team invitation:', insertError)
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      )
    }

    // Send invitation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://collegeofmas.org.in'
    const inviteLink = `${appUrl}/team/accept-invite?token=${invitation.token}`

    if (isEmailEnabled()) {
      const inviteEmail = teamInvitation({
        name: name?.trim() || undefined,
        role,
        org_name: COMPANY_CONFIG.name,
        invite_link: inviteLink,
      })

      const emailResult = await sendEmail({
        to: normalizedEmail,
        subject: inviteEmail.subject,
        html: inviteEmail.html,
      })

      if (!emailResult.success) {
        console.error('Failed to send invitation email:', emailResult.error)
        // Don't fail the request - invitation was created, email just didn't send
      }
    } else {
      console.warn('[Team Invite] Email not enabled. Invite link:', inviteLink)
    }

    // Log activity
    try {
      await supabase.from('team_activity_logs').insert({
        actor_id: user.id,
        actor_email: user.email,
        action: 'team_member.invited',
        target_email: normalizedEmail,
        metadata: {
          invitation_id: invitation.id,
          role,
          invited_name: name?.trim() || null,
        },
      })
    } catch (logError) {
      console.error('Failed to log team activity:', logError)
      // Non-critical - don't fail the request
    }

    return NextResponse.json({ data: invitation, success: true })
  } catch (error) {
    console.error('Team invite API error:', error)
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    )
  }
}

// GET - List all invitations
export async function GET() {
  try {
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClientRaw = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClientRaw as any

    const { data: invitations, error } = await supabase
      .from('team_invitations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch invitations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch invitations' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: invitations })
  } catch (error) {
    console.error('Team invitations list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
}
