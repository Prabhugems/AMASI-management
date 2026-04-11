import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/api-auth'

/**
 * PATCH /api/team/device-tokens/[id] - Update device token (revoke/reactivate)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireSuperAdmin()

    if (authError || !user) {
      return authError || NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !['active', 'revoked'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be "active" or "revoked"' },
        { status: 400 }
      )
    }

    const adminClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClient as any

    const { data: token, error: updateError } = await supabase
      .from('team_device_tokens')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError || !token) {
      console.error('Failed to update device token:', updateError)
      return NextResponse.json(
        { error: 'Failed to update device token' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      token,
      message: `Device token ${status === 'revoked' ? 'revoked' : 'reactivated'} successfully`,
    })
  } catch (error) {
    console.error('Device token update error:', error)
    return NextResponse.json(
      { error: 'Failed to update device token' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/team/device-tokens/[id] - Delete device token
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireSuperAdmin()

    if (authError || !user) {
      return authError || NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params

    const adminClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClient as any

    const { error: deleteError } = await supabase
      .from('team_device_tokens')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Failed to delete device token:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete device token' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Device token deleted successfully',
    })
  } catch (error) {
    console.error('Device token delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete device token' },
      { status: 500 }
    )
  }
}
