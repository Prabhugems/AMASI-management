import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    // Verify the requesting user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    )

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
    const emails = (teamMembers || []).map(m => m.email.toLowerCase())
    const { data: usersData } = await adminClient
      .from('users')
      .select('email, last_active_at, logged_out_at')
      .in('email', emails.length > 0 ? emails : [''])

    const activeMap = new Map<string, { last_active_at: string | null; logged_out_at: string | null }>()
    for (const u of usersData || []) {
      if (u.email) {
        activeMap.set(u.email.toLowerCase(), {
          last_active_at: u.last_active_at,
          logged_out_at: u.logged_out_at,
        })
      }
    }

    // Merge data
    const members = (teamMembers || []).map(member => {
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
        logged_out_at: activity?.logged_out_at ?? null,
      }
    })

    return NextResponse.json({ members })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch team status' }, { status: 500 })
  }
}
