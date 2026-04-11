import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireSuperAdmin } from '@/lib/auth/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Summarise the JSONB metadata into a short human-readable string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summariseMetadata(metadata: any): string {
  if (!metadata || typeof metadata !== 'object') return ''
  const parts: string[] = []

  // Role changes
  if (metadata.old_role && metadata.new_role) {
    parts.push(`Role: ${metadata.old_role} → ${metadata.new_role}`)
  }

  // Permission changes
  if (metadata.full_access_granted) {
    parts.push('full_access_granted')
  }
  if (metadata.permissions_added?.length) {
    parts.push(`permissions_added: ${metadata.permissions_added.join(', ')}`)
  }
  if (metadata.permissions_removed?.length) {
    parts.push(`permissions_removed: ${metadata.permissions_removed.join(', ')}`)
  }

  // Session / security
  if (metadata.sessions_terminated) {
    parts.push('sessions_terminated')
  }

  // Invite related
  if (metadata.invite_email) {
    parts.push(`invite: ${metadata.invite_email}`)
  }

  // Status changes
  if (metadata.status_change) {
    parts.push(`status: ${metadata.status_change}`)
  }

  // Generic reason
  if (metadata.reason) {
    parts.push(`reason: ${metadata.reason}`)
  }

  // Fallback: show raw keys if nothing matched
  if (parts.length === 0) {
    const keys = Object.keys(metadata).filter(k => k !== 'id')
    if (keys.length > 0) {
      parts.push(keys.join(', '))
    }
  }

  return parts.join('; ')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    // --- Audit trail CSV export ---
    if (type === 'audit') {
      return handleAuditExport(searchParams)
    }

    // --- Default: team members CSV export ---
    const { user, error } = await requireAdmin()
    if (error) return error
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClientRaw = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = adminClientRaw as any

    // Fetch team members, auth users, and activity data in parallel
    const [teamResult, authResult] = await Promise.all([
      adminClient
        .from('team_members')
        .select('id, name, email, phone, role, is_active, permissions, event_ids, created_at')
        .order('created_at', { ascending: false }),
      adminClient.auth.admin.listUsers(),
    ])

    const { data: teamMembers, error: teamError } = teamResult
    const { data: authData, error: authError } = authResult

    if (teamError) {
      return NextResponse.json({ error: teamError.message }, { status: 500 })
    }
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Build email -> last_sign_in map from auth
    const authMap = new Map<string, string | null>()
    for (const authUser of authData.users) {
      if (authUser.email) {
        authMap.set(authUser.email.toLowerCase(), authUser.last_sign_in_at ?? null)
      }
    }

    // Fetch last_active_at from users table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emails = (teamMembers || []).map((m: any) => m.email.toLowerCase())
    const { data: usersData } = await adminClient
      .from('users')
      .select('email, last_active_at')
      .in('email', emails.length > 0 ? emails : [''])

    const activeMap = new Map<string, string | null>()
    for (const u of usersData || []) {
      if (u.email) {
        activeMap.set(u.email.toLowerCase(), u.last_active_at ?? null)
      }
    }

    // CSV header
    const columns = ['Name', 'Email', 'Phone', 'Role', 'Permissions', 'Event Count', 'Status', 'Created At', 'Last Active']
    const csvRows: string[] = [columns.join(',')]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const member of (teamMembers || []) as any[]) {
      const emailKey = member.email.toLowerCase()
      const lastActive = activeMap.get(emailKey) || authMap.get(emailKey) || ''
      const permissions = member.permissions && member.permissions.length > 0
        ? member.permissions.join(', ')
        : 'All'
      const eventCount = member.event_ids && member.event_ids.length > 0
        ? String(member.event_ids.length)
        : 'All'
      const status = member.is_active ? 'Active' : 'Inactive'
      const createdAt = member.created_at
        ? new Date(member.created_at).toISOString().slice(0, 10)
        : ''
      const lastActiveFormatted = lastActive
        ? new Date(lastActive).toISOString().replace('T', ' ').slice(0, 19)
        : 'Never'

      const row = [
        escapeCsvField(member.name || ''),
        escapeCsvField(member.email || ''),
        escapeCsvField(member.phone || ''),
        escapeCsvField(member.role || ''),
        escapeCsvField(permissions),
        escapeCsvField(eventCount),
        escapeCsvField(status),
        escapeCsvField(createdAt),
        escapeCsvField(lastActiveFormatted),
      ]
      csvRows.push(row.join(','))
    }

    const csv = csvRows.join('\n')
    const today = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="team-members-${today}.csv"`,
      },
    })
  } catch (err) {
    console.error('Error exporting team members:', err)
    return NextResponse.json({ error: 'Failed to export team members' }, { status: 500 })
  }
}

/**
 * Export audit trail as CSV (super admin only).
 * Accepts filter params: from, to, actor_email, action_type
 */
async function handleAuditExport(searchParams: URLSearchParams) {
  const { user, error: authError } = await requireSuperAdmin()
  if (authError) return authError
  if (!user) {
    return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 })
  }

  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const actorEmail = searchParams.get('actor_email')
  const actionType = searchParams.get('action_type')

  const adminClient = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (adminClient as any)
    .from('team_activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10000)

  if (from) {
    query = query.gte('created_at', from)
  }
  if (to) {
    // Include the entire "to" day by appending end-of-day
    query = query.lte('created_at', `${to}T23:59:59.999Z`)
  }
  if (actorEmail) {
    query = query.ilike('actor_email', actorEmail)
  }
  if (actionType) {
    query = query.eq('action', actionType)
  }

  const { data: logs, error: queryError } = await query

  if (queryError) {
    console.error('Error exporting audit logs:', queryError)
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  // Build a quick lookup for team member names by email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allEmails = new Set<string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const log of (logs || []) as any[]) {
    if (log.actor_email) allEmails.add(log.actor_email.toLowerCase())
    if (log.target_email) allEmails.add(log.target_email.toLowerCase())
  }

  const emailArr = Array.from(allEmails)
  const nameMap = new Map<string, string>()
  if (emailArr.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: members } = await (adminClient as any)
      .from('team_members')
      .select('email, name')
      .in('email', emailArr)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const m of (members || []) as any[]) {
      if (m.email) nameMap.set(m.email.toLowerCase(), m.name || '')
    }
  }

  // CSV header
  const columns = [
    'Timestamp',
    'Actor Name',
    'Actor Email',
    'Action',
    'Target Name',
    'Target Email',
    'IP Address',
    'Metadata Summary',
  ]
  const csvRows: string[] = [columns.join(',')]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const log of (logs || []) as any[]) {
    const timestamp = log.created_at
      ? new Date(log.created_at).toISOString().replace('T', ' ').slice(0, 19)
      : ''
    const actorName = nameMap.get((log.actor_email || '').toLowerCase()) || ''
    const targetName = nameMap.get((log.target_email || '').toLowerCase()) || ''

    const row = [
      escapeCsvField(timestamp),
      escapeCsvField(actorName),
      escapeCsvField(log.actor_email || ''),
      escapeCsvField(log.action || ''),
      escapeCsvField(targetName),
      escapeCsvField(log.target_email || ''),
      escapeCsvField(log.ip_address || ''),
      escapeCsvField(summariseMetadata(log.metadata)),
    ]
    csvRows.push(row.join(','))
  }

  const csv = csvRows.join('\n')
  const today = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-trail-${today}.csv"`,
    },
  })
}
