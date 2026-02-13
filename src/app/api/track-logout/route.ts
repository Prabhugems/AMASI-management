import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabaseServerClient = await createServerSupabaseClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = supabaseServerClient as any

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClientRaw = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = adminClientRaw as any

    const now = new Date().toISOString()

    await adminClient
      .from('users')
      .update({
        logged_out_at: now,
        last_active_at: null,
      })
      .eq('id', user.id)

    // Log logout event to activity_logs for audit trail
    try {
      await adminClient
        .from('activity_logs')
        .insert({
          user_id: user.id,
          user_email: user.email || '',
          user_name: user.user_metadata?.name || user.email?.split('@')[0] || '',
          action: 'logout',
          entity_type: 'user',
          entity_id: user.id,
          entity_name: user.email || '',
          description: 'User logged out',
        })
    } catch {
      // Don't block logout if audit logging fails
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
