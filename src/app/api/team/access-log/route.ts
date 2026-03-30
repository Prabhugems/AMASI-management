import { NextRequest, NextResponse } from 'next/server'
import { getApiUser, requireSuperAdmin } from '@/lib/auth/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

// Simple in-memory rate limit: user_id:module -> last log timestamp
const recentLogs = new Map<string, number>()
const RATE_LIMIT_MS = 5 * 60 * 1000 // 5 minutes

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, ts] of recentLogs) {
    if (now - ts > RATE_LIMIT_MS) recentLogs.delete(key)
  }
}, 10 * 60 * 1000)

export async function POST(request: NextRequest) {
  const { user, error } = await getApiUser()
  if (error) return error

  try {
    const body = await request.json()
    const { module, event_id, path } = body

    if (!module || typeof module !== 'string') {
      return NextResponse.json({ error: 'module is required' }, { status: 400 })
    }

    // Rate limit: skip if same user+module logged within 5 minutes
    const rateKey = `${user!.id}:${module}`
    const lastLogged = recentLogs.get(rateKey)
    if (lastLogged && Date.now() - lastLogged < RATE_LIMIT_MS) {
      return NextResponse.json({ ok: true, skipped: true })
    }
    recentLogs.set(rateKey, Date.now())

    // Fire-and-forget insert
    const supabase = await createAdminClient()
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
    const userAgent = request.headers.get('user-agent') || null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .from('team_access_logs')
      .insert({
        user_id: user!.id,
        user_email: user!.email,
        module,
        event_id: event_id || null,
        path: path || null,
        method: 'PAGE_VIEW',
        ip_address: ip,
        user_agent: userAgent,
      })
      .then(() => {})
      .catch((err: Error) => console.error('Access log insert failed:', err))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireSuperAdmin()
  if (error) return error

  const url = request.nextUrl.searchParams
  const userId = url.get('user_id')
  const userEmail = url.get('user_email')
  const module = url.get('module')
  const eventId = url.get('event_id')
  const from = url.get('from')
  const to = url.get('to')
  const limit = Math.min(parseInt(url.get('limit') || '50'), 200)
  const offset = parseInt(url.get('offset') || '0')

  const supabase = await createAdminClient()

  // Build filtered query for paginated results
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('team_access_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (userId) query = query.eq('user_id', userId)
  if (userEmail) query = query.ilike('user_email', userEmail)
  if (module) query = query.eq('module', module)
  if (eventId) query = query.eq('event_id', eventId)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data: logs, count, error: queryError } = await query

  if (queryError) {
    console.error('Access log query failed:', queryError)
    return NextResponse.json({ error: 'Failed to fetch access logs' }, { status: 500 })
  }

  // Build summary stats with same filters (except pagination)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let statsQuery = (supabase as any)
    .from('team_access_logs')
    .select('module, user_id')

  if (userId) statsQuery = statsQuery.eq('user_id', userId)
  if (userEmail) statsQuery = statsQuery.ilike('user_email', userEmail)
  if (module) statsQuery = statsQuery.eq('module', module)
  if (eventId) statsQuery = statsQuery.eq('event_id', eventId)
  if (from) statsQuery = statsQuery.gte('created_at', from)
  if (to) statsQuery = statsQuery.lte('created_at', to)

  const { data: statsData } = await statsQuery

  // Compute summary
  const uniqueUsers = new Set((statsData || []).map((r: { user_id: string }) => r.user_id)).size
  const moduleCounts: Record<string, number> = {}
  for (const row of statsData || []) {
    moduleCounts[row.module] = (moduleCounts[row.module] || 0) + 1
  }
  const topModules = Object.entries(moduleCounts)
    .map(([m, c]) => ({ module: m, count: c }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({
    logs: logs || [],
    total: count || 0,
    limit,
    offset,
    summary: {
      total_accesses: (statsData || []).length,
      unique_users: uniqueUsers,
      top_modules: topModules,
    },
    _user: user!.id,
  })
}
