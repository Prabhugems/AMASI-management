import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/api-auth'

/**
 * GET /api/team/device-tokens - List all device tokens
 */
export async function GET() {
  try {
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

    const { data: tokens, error } = await supabase
      .from('team_device_tokens')
      .select('id, name, module, event_ids, status, last_used_at, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch device tokens:', error)
      return NextResponse.json(
        { error: 'Failed to fetch device tokens' },
        { status: 500 }
      )
    }

    return NextResponse.json({ tokens: tokens || [] })
  } catch (error) {
    console.error('Device tokens list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch device tokens' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/team/device-tokens - Create a new device token
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireSuperAdmin()

    if (authError || !user) {
      return authError || NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, module, event_ids } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const adminClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClient as any

    const { data: token, error: insertError } = await supabase
      .from('team_device_tokens')
      .insert({
        name: name.trim(),
        module: module || 'print_station',
        event_ids: event_ids || [],
        created_by: user.id,
      })
      .select('*')
      .single()

    if (insertError || !token) {
      console.error('Failed to create device token:', insertError)
      return NextResponse.json(
        { error: 'Failed to create device token' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      token,
      message: 'Device token created successfully',
    })
  } catch (error) {
    console.error('Device token creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create device token' },
      { status: 500 }
    )
  }
}
