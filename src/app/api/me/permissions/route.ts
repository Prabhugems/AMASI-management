import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/auth/api-auth'

/**
 * Expand wildcard permissions (e.g., 'travel.*') into individual actions
 * based on the module definitions.
 */
const MODULE_ACTIONS: Record<string, string[]> = {
  events: ['view', 'create', 'edit', 'delete', 'publish'],
  faculty: ['view', 'create', 'edit', 'delete', 'invite'],
  members: ['view', 'create', 'edit', 'delete'],
  registrations: ['view', 'create', 'edit', 'delete', 'check_in', 'export'],
  sessions: ['view', 'create', 'edit', 'delete'],
  abstracts: ['view', 'create', 'edit', 'delete', 'review', 'assign_reviewer'],
  finance: ['view', 'refund', 'export'],
  travel: ['view', 'create', 'edit', 'delete', 'export'],
  communications: ['view', 'send_email', 'send_whatsapp', 'manage_templates'],
  team: ['view', 'invite', 'edit', 'delete'],
  reports: ['view', 'export'],
  forms: ['view', 'create', 'edit', 'delete', 'export'],
  certificates: ['view', 'create', 'edit', 'delete', 'generate'],
  badges: ['view', 'create', 'edit', 'delete', 'print'],
}

function getAllPermissions(): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const [module, actions] of Object.entries(MODULE_ACTIONS)) {
    result[module] = [...actions]
  }
  return result
}

function getAllPermissionsExceptTeamDelete(): Record<string, string[]> {
  const result = getAllPermissions()
  result.team = result.team.filter(a => a !== 'delete')
  return result
}

/**
 * Parse a permissions array (which may contain wildcards like 'travel.*')
 * into a structured { module: actions[] } object.
 */
function parsePermissions(permissions: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {}

  for (const perm of permissions) {
    if (perm.endsWith('.*')) {
      // Wildcard: expand to all actions for this module
      const module = perm.replace('.*', '')
      if (MODULE_ACTIONS[module]) {
        result[module] = [...MODULE_ACTIONS[module]]
      }
    } else if (perm.includes('.')) {
      const [module, action] = perm.split('.')
      if (!result[module]) {
        result[module] = []
      }
      if (!result[module].includes(action)) {
        result[module].push(action)
      }
    }
  }

  return result
}

/**
 * GET /api/me/permissions
 * Returns the current user's effective permissions.
 */
export async function GET() {
  try {
    const { user, error: authError } = await getApiUser()

    if (authError || !user) {
      return authError || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const adminClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClient as any

    // Fetch team_members record and users record in parallel
    const [teamResult, userResult] = await Promise.all([
      supabase
        .from('team_members')
        .select('id, role, permissions, event_ids, is_active')
        .ilike('email', user.email)
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('users')
        .select('platform_role, is_super_admin')
        .eq('id', user.id)
        .maybeSingle(),
    ])

    const teamMember = teamResult.data
    const userRecord = userResult.data

    const role = userRecord?.platform_role || user.platform_role
    const isSuperAdmin = userRecord?.is_super_admin === true || role === 'super_admin'

    // Compute effective permissions
    let permissions: Record<string, string[]>

    if (isSuperAdmin || role === 'super_admin') {
      permissions = getAllPermissions()
    } else if (role === 'admin') {
      permissions = getAllPermissionsExceptTeamDelete()
    } else if (teamMember?.permissions && Array.isArray(teamMember.permissions) && teamMember.permissions.length > 0) {
      permissions = parsePermissions(teamMember.permissions as string[])
    } else {
      // No specific permissions stored means full access for this team member
      permissions = getAllPermissions()
    }

    // Determine event_ids: null means access to all events
    const eventIds = teamMember?.event_ids && Array.isArray(teamMember.event_ids) && teamMember.event_ids.length > 0
      ? teamMember.event_ids
      : null

    return NextResponse.json({
      role,
      permissions,
      event_ids: eventIds,
      is_active: teamMember?.is_active ?? true,
    })
  } catch (error) {
    console.error('My permissions error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    )
  }
}
