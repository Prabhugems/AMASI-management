import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/api-auth'

/**
 * GET /api/audit-logs — Filterable audit log for team actions (super admin only)
 *
 * Query params:
 *   actor_email  — filter by who performed the action
 *   action       — filter by action type (e.g. 'team_member.created')
 *   target_email — filter by who was affected
 *   from         — start date (ISO string)
 *   to           — end date (ISO string)
 *   limit        — page size (default 50, max 200)
 *   offset       — pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    // Auth: only super admins can view all audit logs
    const { user, error: authError } = await requireSuperAdmin()

    if (authError || !user) {
      return authError || NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const actorEmail = searchParams.get('actor_email')
    const action = searchParams.get('action')
    const targetEmail = searchParams.get('target_email')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const adminClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (adminClient as any)
      .from('team_activity_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (actorEmail) {
      query = query.ilike('actor_email', actorEmail)
    }

    if (action) {
      query = query.eq('action', action)
    }

    if (targetEmail) {
      query = query.ilike('target_email', targetEmail)
    }

    if (from) {
      query = query.gte('created_at', from)
    }

    if (to) {
      query = query.lte('created_at', to)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Failed to fetch audit logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch audit logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      logs: data || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Audit logs error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
