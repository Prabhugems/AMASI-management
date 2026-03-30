import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET() {
  try {
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
