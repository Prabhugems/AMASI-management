import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/api-auth'

/**
 * GET /api/team/[id]/activity — Fetch activity logs for a specific team member
 * Returns logs where the team member is either the target or the actor.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: require admin role
    const { user, error: authError } = await requireAdmin()

    if (authError || !user) {
      return authError || NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const adminClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClient as any

    // First, look up the team member to get their user_id (actor_id match)
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle()

    if (!teamMember) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    // Build an OR filter: target_id = team member id, OR actor_id = team member's user_id
    // If the team member has no linked user_id, only match on target_id
    let orFilter = `target_id.eq.${id}`
    if (teamMember.user_id) {
      orFilter += `,actor_id.eq.${teamMember.user_id}`
    }

    const { data, error, count } = await supabase
      .from('team_activity_logs')
      .select('*', { count: 'exact' })
      .or(orFilter)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Failed to fetch team member activity:', error)
      return NextResponse.json(
        { error: 'Failed to fetch activity logs' },
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
    console.error('Team member activity error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    )
  }
}
