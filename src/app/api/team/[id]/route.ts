import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin, requireSuperAdmin } from '@/lib/auth/api-auth'
import { sendEmail, isEmailEnabled } from '@/lib/email'
import { COMPANY_CONFIG } from '@/lib/config'
import { teamRoleChanged, teamDeactivated, teamActivated } from '@/lib/email-templates'

/**
 * PATCH /api/team/[id] - Update a team member
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Auth: require admin role
    const { user, error: authError } = await requireAdmin()

    if (authError || !user) {
      return authError || NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, role, permissions, event_ids, is_active, notes, phone } = body

    // Use admin client to bypass RLS
    const adminClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClient as any

    // Fetch existing member
    const { data: existing, error: fetchError } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    // Build update object with only provided fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {}
    if (name !== undefined) updates.name = name.trim()
    if (role !== undefined) updates.role = role
    if (permissions !== undefined) updates.permissions = permissions
    if (event_ids !== undefined) updates.event_ids = event_ids
    if (is_active !== undefined) updates.is_active = is_active
    if (notes !== undefined) updates.notes = notes?.trim() || null
    if (phone !== undefined) updates.phone = phone?.trim() || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    updates.updated_at = new Date().toISOString()

    // Update the member
    const { data: updated, error: updateError } = await supabase
      .from('team_members')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError || !updated) {
      console.error('Failed to update team member:', updateError)
      return NextResponse.json(
        { error: 'Failed to update team member' },
        { status: 500 }
      )
    }

    // Log the general update
    await supabase
      .from('team_activity_logs')
      .insert({
        actor_id: user.id,
        actor_email: user.email,
        action: 'team_member.updated',
        target_id: id,
        target_email: existing.email,
        metadata: {
          old_values: Object.keys(updates).reduce((acc, key) => {
            if (key !== 'updated_at') {
              acc[key] = existing[key]
            }
            return acc
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }, {} as Record<string, any>),
          new_values: Object.keys(updates).reduce((acc, key) => {
            if (key !== 'updated_at') {
              acc[key] = updates[key]
            }
            return acc
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }, {} as Record<string, any>),
        },
      })

    // Log specific changes
    const additionalLogs = []

    if (role !== undefined && role !== existing.role) {
      additionalLogs.push({
        actor_id: user.id,
        actor_email: user.email,
        action: 'team_member.role_changed',
        target_id: id,
        target_email: existing.email,
        metadata: {
          old_role: existing.role,
          new_role: role,
        },
      })
    }

    if (is_active !== undefined && is_active !== existing.is_active) {
      additionalLogs.push({
        actor_id: user.id,
        actor_email: user.email,
        action: is_active ? 'team_member.activated' : 'team_member.deactivated',
        target_id: id,
        target_email: existing.email,
        metadata: {
          member_email: existing.email,
          member_name: existing.name,
        },
      })
    }

    if (additionalLogs.length > 0) {
      await supabase
        .from('team_activity_logs')
        .insert(additionalLogs)
    }

    // Send notification emails (fire-and-forget)
    if (isEmailEnabled() && existing.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://collegeofmas.org.in'
      const memberName = existing.name || existing.email

      try {
        if (role !== undefined && role !== existing.role) {
          const email = teamRoleChanged({
            name: memberName,
            old_role: existing.role,
            new_role: role,
            org_name: COMPANY_CONFIG.name,
          })
          sendEmail({ to: existing.email, subject: email.subject, html: email.html }).catch((err) =>
            console.error('[Team] Failed to send role changed email:', err)
          )
        }

        if (is_active !== undefined && is_active !== existing.is_active) {
          if (!is_active) {
            const email = teamDeactivated({
              name: memberName,
              org_name: COMPANY_CONFIG.name,
            })
            sendEmail({ to: existing.email, subject: email.subject, html: email.html }).catch((err) =>
              console.error('[Team] Failed to send deactivated email:', err)
            )
          } else {
            const email = teamActivated({
              name: memberName,
              org_name: COMPANY_CONFIG.name,
              login_link: `${appUrl}/login`,
            })
            sendEmail({ to: existing.email, subject: email.subject, html: email.html }).catch((err) =>
              console.error('[Team] Failed to send activated email:', err)
            )
          }
        }
      } catch (emailError) {
        console.error('[Team] Email notification error:', emailError)
        // Non-critical - don't fail the request
      }
    }

    return NextResponse.json({
      success: true,
      member: updated,
      message: 'Team member updated successfully',
    })
  } catch (error) {
    console.error('Team member update error:', error)
    return NextResponse.json(
      { error: 'Failed to update team member' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/team/[id] - Delete a team member
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Auth: only super admins can delete team members
    const { user, error: authError } = await requireSuperAdmin()

    if (authError || !user) {
      return authError || NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      )
    }

    // Use admin client to bypass RLS
    const adminClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClient as any

    // Fetch existing member before deleting (for logging)
    const { data: existing } = await supabase
      .from('team_members')
      .select('id, name, email, role')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    // Delete the member
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Failed to delete team member:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete team member' },
        { status: 500 }
      )
    }

    // Log the deletion
    await supabase
      .from('team_activity_logs')
      .insert({
        actor_id: user.id,
        actor_email: user.email,
        action: 'team_member.deleted',
        target_id: id,
        target_email: existing.email,
        metadata: {
          deleted_member: {
            name: existing.name,
            email: existing.email,
            role: existing.role,
          },
        },
      })

    return NextResponse.json({
      success: true,
      message: 'Team member deleted successfully',
    })
  } catch (error) {
    console.error('Team member deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete team member' },
      { status: 500 }
    )
  }
}
