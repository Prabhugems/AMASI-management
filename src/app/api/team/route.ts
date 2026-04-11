import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/api-auth'

/**
 * POST /api/team - Create a new team member
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: require admin role (event_admin, admin, or super_admin)
    const { user, error: authError } = await requireAdmin()

    if (authError || !user) {
      return authError || NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Parse body
    const body = await request.json()
    const { email, name, phone, role, permissions, event_ids, notes, timezone, tags, backup_member_id } = body

    // Validate required fields
    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const trimmedEmail = email.trim().toLowerCase()

    // Use admin client to bypass RLS
    const adminClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClient as any

    // Check for duplicate email
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .ilike('email', trimmedEmail)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'A team member with this email already exists' },
        { status: 409 }
      )
    }

    // Insert new team member
    const { data: member, error: insertError } = await supabase
      .from('team_members')
      .insert({
        email: trimmedEmail,
        name: name?.trim() || trimmedEmail.split('@')[0],
        phone: phone?.trim() || null,
        role: role || 'event_admin',
        permissions: permissions || null,
        event_ids: event_ids || null,
        notes: notes?.trim() || null,
        timezone: timezone || 'Asia/Kolkata',
        tags: Array.isArray(tags) ? tags : [],
        backup_member_id: backup_member_id || null,
        is_active: true,
      })
      .select()
      .single()

    if (insertError || !member) {
      console.error('Failed to create team member:', insertError)
      return NextResponse.json(
        { error: 'Failed to create team member' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase
      .from('team_activity_logs')
      .insert({
        actor_id: user.id,
        actor_email: user.email,
        action: 'team_member.created',
        target_id: member.id,
        target_email: member.email,
        metadata: {
          name: member.name,
          email: member.email,
          role: member.role,
          ...(!member.permissions || (Array.isArray(member.permissions) && member.permissions.length === 0))
            ? { full_access_granted: true }
            : {},
        },
      })

    return NextResponse.json({
      success: true,
      member,
      message: 'Team member created successfully',
    })
  } catch (error) {
    console.error('Team member creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create team member' },
      { status: 500 }
    )
  }
}
