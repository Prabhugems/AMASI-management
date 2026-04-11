import { requireAdmin } from '@/lib/auth/api-auth'
import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, isEmailEnabled } from '@/lib/email'
import { COMPANY_CONFIG } from '@/lib/config'
import { teamInvitation } from '@/lib/email-templates'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_INVITES_PER_REQUEST = 50

type InviteInput = {
  email: string
  name: string
  role?: string
  permissions?: string[]
  event_ids?: string[]
}

type InviteResult = {
  email: string
  status: 'sent' | 'duplicate' | 'exists' | 'invalid' | 'error'
  reason?: string
}

// POST - Send bulk team invitations
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { invites } = body as { invites: InviteInput[] }

    if (!Array.isArray(invites) || invites.length === 0) {
      return NextResponse.json(
        { error: 'invites array is required and must not be empty' },
        { status: 400 }
      )
    }

    if (invites.length > MAX_INVITES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_INVITES_PER_REQUEST} invites per request` },
        { status: 400 }
      )
    }

    const adminClientRaw = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClientRaw as any

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://collegeofmas.org.in'
    const emailEnabled = isEmailEnabled()
    const results: InviteResult[] = []

    for (const invite of invites) {
      const normalizedEmail = invite.email?.trim().toLowerCase()

      // Validate email
      if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
        results.push({
          email: invite.email || '(empty)',
          status: 'invalid',
          reason: 'Invalid email format',
        })
        continue
      }

      // Validate role
      const role = invite.role?.trim() || 'coordinator'

      try {
        // Check if email already exists in team_members
        const { data: existingMember } = await supabase
          .from('team_members')
          .select('id')
          .ilike('email', normalizedEmail)
          .eq('is_active', true)
          .maybeSingle()

        if (existingMember) {
          results.push({
            email: normalizedEmail,
            status: 'exists',
            reason: 'Already a team member',
          })
          continue
        }

        // Check for existing pending invitation
        const { data: existingInvitation } = await supabase
          .from('team_invitations')
          .select('id')
          .ilike('email', normalizedEmail)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()

        if (existingInvitation) {
          results.push({
            email: normalizedEmail,
            status: 'duplicate',
            reason: 'Invitation already pending',
          })
          continue
        }

        // Create invitation record
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7)

        const { data: invitation, error: insertError } = await supabase
          .from('team_invitations')
          .insert({
            email: normalizedEmail,
            name: invite.name?.trim() || null,
            role,
            permissions: invite.permissions || null,
            event_ids: invite.event_ids || null,
            invited_by: user.id,
            status: 'pending',
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single()

        if (insertError) {
          console.error(`Failed to create invitation for ${normalizedEmail}:`, insertError)
          results.push({
            email: normalizedEmail,
            status: 'error',
            reason: 'Failed to create invitation',
          })
          continue
        }

        // Send invitation email
        const inviteLink = `${appUrl}/team/accept-invite?token=${invitation.token}`

        if (emailEnabled) {
          const inviteEmail = teamInvitation({
            name: invite.name?.trim() || undefined,
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
            console.error(`Failed to send invitation email to ${normalizedEmail}:`, emailResult.error)
          }
        } else {
          console.warn(`[Bulk Invite] Email not enabled. Invite link for ${normalizedEmail}:`, inviteLink)
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
              invited_name: invite.name?.trim() || null,
              bulk_invite: true,
            },
          })
        } catch (logError) {
          console.error('Failed to log team activity:', logError)
        }

        results.push({
          email: normalizedEmail,
          status: 'sent',
        })
      } catch (err) {
        console.error(`Error processing invite for ${normalizedEmail}:`, err)
        results.push({
          email: normalizedEmail,
          status: 'error',
          reason: 'Unexpected error',
        })
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Bulk invite API error:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk invitations' },
      { status: 500 }
    )
  }
}
