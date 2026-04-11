import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/api-auth'
import { logTeamAction } from '@/lib/team-audit'
import {
  PERMISSION_CATEGORIES,
  ALL_PERMISSION_VALUES,
  ROLE_CONFIG,
} from '@/lib/team-constants'

/**
 * GET /api/team/[id]/preview - Preview a team member's access (super_admin only)
 * Returns resolved permissions, module access grid, and event scope.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { user, error: authError } = await requireSuperAdmin()
    if (authError || !user) {
      return authError || NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      )
    }

    const adminClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClient as any

    // 1. Fetch the team member
    const { data: member, error: memberError } = await supabase
      .from('team_members')
      .select('id, name, email, role, permissions, event_ids, is_active')
      .eq('id', id)
      .maybeSingle()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    // 2. Resolve permissions
    const memberPerms: string[] = Array.isArray(member.permissions) ? member.permissions : []
    const hasFullAccess = memberPerms.length === 0

    // Build module access grid grouped by category
    const modules = PERMISSION_CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
      icon: category.icon,
      color: category.color,
      permissions: category.permissions.map((perm) => ({
        id: perm.value,
        label: perm.label,
        icon: perm.icon,
        description: perm.description,
        accessible: hasFullAccess || memberPerms.includes(perm.value),
      })),
    }))

    // 3. Resolve event scope
    const memberEventIds: string[] = Array.isArray(member.event_ids) ? member.event_ids : []
    const isAllEvents = memberEventIds.length === 0

    let eventList: { id: string; title: string }[] = []
    if (!isAllEvents && memberEventIds.length > 0) {
      const { data: events } = await supabase
        .from('events')
        .select('id, title')
        .in('id', memberEventIds)

      eventList = (events || []).map((e: { id: string; title: string }) => ({
        id: e.id,
        title: e.title,
      }))
    }

    // 4. Get role config
    const roleConfig = ROLE_CONFIG[member.role]
    const roleLabel = roleConfig?.label || member.role
    const roleDescription = roleConfig?.description || ''

    // 5. Build response
    const response = {
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        role_label: roleLabel,
        role_description: roleDescription,
        is_active: member.is_active,
      },
      access: {
        hasFullAccess,
        modules,
        totalModules: ALL_PERMISSION_VALUES.length,
        accessibleModules: hasFullAccess
          ? ALL_PERMISSION_VALUES.length
          : memberPerms.filter((p) => ALL_PERMISSION_VALUES.includes(p)).length,
        events: {
          isAllEvents,
          eventList,
        },
      },
    }

    // 6. Log the preview action (fire-and-forget)
    logTeamAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'team_member.previewed',
      targetId: member.id,
      targetEmail: member.email,
      metadata: {
        member_name: member.name,
        member_role: member.role,
      },
    }).catch(() => {})

    return NextResponse.json(response)
  } catch (err) {
    console.error('Preview API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
