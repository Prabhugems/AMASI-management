import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabaseServerClient = await createServerSupabaseClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = supabaseServerClient as any

    // Verify the requesting user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClientRaw = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = adminClientRaw as any

    // Fetch team members
    const { data: teamMembers, error: teamError } = await adminClient
      .from('team_members')
      .select('id, name, email, role, is_active, created_at')
      .order('created_at', { ascending: false })

    if (teamError) {
      return NextResponse.json({ error: teamError.message }, { status: 500 })
    }

    // Fetch auth users to get real login data
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers()
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Build email -> auth user map
    const authMap = new Map<string, { last_sign_in_at: string | null; created_at: string }>()
    for (const authUser of authData.users) {
      if (authUser.email) {
        authMap.set(authUser.email.toLowerCase(), {
          last_sign_in_at: authUser.last_sign_in_at ?? null,
          created_at: authUser.created_at,
        })
      }
    }

    // Also fetch last_active_at from users table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emails = (teamMembers || []).map((m: any) => m.email.toLowerCase())
    const { data: usersData } = await adminClient
      .from('users')
      .select('email, last_active_at')
      .in('email', emails.length > 0 ? emails : [''])

    const activeMap = new Map<string, { last_active_at: string | null }>()
    for (const u of usersData || []) {
      if (u.email) {
        activeMap.set(u.email.toLowerCase(), {
          last_active_at: u.last_active_at,
        })
      }
    }

    // Merge data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const members = (teamMembers || []).map((member: any) => {
      const emailKey = member.email.toLowerCase()
      const auth = authMap.get(emailKey)
      const activity = activeMap.get(emailKey)
      return {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        is_active: member.is_active,
        has_logged_in: !!auth?.last_sign_in_at,
        last_sign_in_at: auth?.last_sign_in_at ?? null,
        last_active_at: activity?.last_active_at ?? null,
        logged_out_at: null,
      }
    })

    return NextResponse.json({ members })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch team status' }, { status: 500 })
  }
}
