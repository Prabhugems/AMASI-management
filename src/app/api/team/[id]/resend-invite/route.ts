import { requireAdmin } from '@/lib/auth/api-auth'
import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, isEmailEnabled } from '@/lib/email'
import { sendWhatsAppTeamInvite, isGallaboxEnabled } from '@/lib/gallabox'
import { COMPANY_CONFIG } from '@/lib/config'
import { teamInvitation } from '@/lib/email-templates'
import crypto from 'crypto'

// POST - Resend team invitation with regenerated token
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

    if (invitation.status !== 'pending' && invitation.status !== 'expired') {
      return NextResponse.json(
        { error: `Cannot resend: invitation is ${invitation.status}` },
        { status: 400 }
      )
    }

    // Always regenerate token and extend expiry
    const newToken = crypto.randomBytes(32).toString('hex')
    const newExpiresAt = new Date()
    newExpiresAt.setDate(newExpiresAt.getDate() + 7)

    const { data: updated, error: updateError } = await supabase
      .from('team_invitations')
      .update({
        token: newToken,
        expires_at: newExpiresAt.toISOString(),
        status: 'pending', // Reset to pending if it was expired
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to refresh invitation:', updateError)
      return NextResponse.json(
        { error: 'Failed to refresh invitation' },
        { status: 500 }
      )
    }

    // Build invite link with the NEW token
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://collegeofmas.org.in'
    const inviteLink = `${appUrl}/team/accept-invite?token=${newToken}`

    // Send invitation email using the template
    if (isEmailEnabled()) {
      const inviteEmail = teamInvitation({
        name: updated.name || undefined,
        role: updated.role,
        org_name: COMPANY_CONFIG.name,
        invite_link: inviteLink,
      })

      const emailResult = await sendEmail({
        to: updated.email,
        subject: `Reminder: ${inviteEmail.subject}`,
        html: inviteEmail.html,
      })

      if (!emailResult.success) {
        console.error('Failed to resend invitation email:', emailResult.error)
        return NextResponse.json(
          { error: `Invitation updated but email failed: ${emailResult.error}` },
          { status: 500 }
        )
      }
    } else {
      console.warn('[Team Invite] Email not enabled. Invite link:', inviteLink)
    }

    // Send WhatsApp if phone is available
    let whatsappSent = false
    const phone = updated.phone
    if (phone && isGallaboxEnabled()) {
      try {
        const waResult = await sendWhatsAppTeamInvite(
          phone,
          updated.name || '',
          inviteLink
        )
        whatsappSent = waResult.success
        if (!waResult.success) {
          console.error('Failed to send WhatsApp invite on resend:', waResult.error)
        }
      } catch (err) {
        console.error('WhatsApp invite error on resend:', err)
      }
    }

    // Log activity
    try {
      await supabase.from('team_activity_logs').insert({
        actor_id: user.id,
        actor_email: user.email,
        action: 'team_member.invite_resent',
        target_email: updated.email,
        metadata: {
          invitation_id: updated.id,
          token_regenerated: true,
          whatsapp_sent: whatsappSent,
        },
      })
    } catch (logError) {
      console.error('Failed to log team activity:', logError)
    }

    return NextResponse.json({
      success: true,
      whatsapp_sent: whatsappSent,
      message: whatsappSent
        ? 'Invitation resent via email + WhatsApp with new link'
        : 'Invitation resent with new link',
      data: updated,
    })
  } catch (error) {
    console.error('Resend invite API error:', error)
    return NextResponse.json(
      { error: 'Failed to resend invitation' },
      { status: 500 }
    )
  }
}
