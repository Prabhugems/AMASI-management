import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Update login activity using admin client to bypass RLS
      try {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
        )
        const now = new Date().toISOString()
        // Get current user profile and team_members name in parallel
        const [userResult, teamResult] = await Promise.all([
          adminClient
            .from('users')
            .select('login_count, platform_role, name')
            .eq('id', user.id)
            .maybeSingle(),
          user.email
            ? adminClient
                .from('team_members')
                .select('name')
                .eq('email', user.email.toLowerCase())
                .eq('is_active', true)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ])
        const currentUser = userResult.data
        const teamMemberName = teamResult.data?.name

        if (currentUser) {
          // Existing user - update login activity and sync name from team_members
          const updateData: Record<string, unknown> = {
            last_login_at: now,
            last_active_at: now,
            login_count: (currentUser.login_count || 0) + 1,
          }
          // Sync name from team_members if users.name is missing or default
          if (teamMemberName && (!currentUser.name || currentUser.name === 'User' || currentUser.name === user.email?.split('@')[0])) {
            updateData.name = teamMemberName
          }
          await adminClient
            .from('users')
            .update(updateData)
            .eq('id', user.id)
        } else {
          // New user - auto-create profile so dashboard works immediately
          await adminClient
            .from('users')
            .insert({
              id: user.id,
              email: user.email || '',
              name: teamMemberName || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
              platform_role: 'event_admin',
              is_super_admin: false,
              is_active: true,
              is_verified: true,
              login_count: 1,
              last_login_at: now,
              last_active_at: now,
              created_at: now,
              updated_at: now,
            })
        }

        // Auto-link unlinked team_members records by matching email
        if (user.email) {
          await adminClient
            .from('team_members')
            .update({ user_id: user.id })
            .eq('email', user.email.toLowerCase())
            .is('user_id', null)
        }

        // Log login event to activity_logs for audit trail
        await adminClient
          .from('activity_logs')
          .insert({
            user_id: user.id,
            user_email: user.email || '',
            user_name: user.user_metadata?.name || user.email?.split('@')[0] || '',
            action: 'login',
            entity_type: 'user',
            entity_id: user.id,
            entity_name: user.email || '',
            description: `User logged in via magic link`,
            metadata: {
              login_count: (currentUser?.login_count || 0) + 1,
              method: 'magic_link',
            },
          })
      } catch (e) {
        // Don't block login if tracking fails
        console.error('Failed to update login activity:', e)
      }

      // If there's an explicit next URL, validate it to prevent open redirects
      if (next) {
        // Only allow relative paths (same-origin redirects)
        if (next.startsWith('/') && !next.startsWith('//') && !next.includes('://')) {
          return NextResponse.redirect(new URL(next, requestUrl.origin))
        }
        // Invalid redirect target, fall through to role-based redirect
        console.warn('Blocked potentially unsafe redirect target:', next)
      }

      // Get user profile to determine role-based redirect (use admin client to bypass RLS)
      const adminClientForProfile = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
      )
      const { data: profile } = await adminClientForProfile
        .from('users')
        .select('platform_role')
        .eq('id', user.id)
        .maybeSingle()

      // Determine redirect based on role
      let redirectTo = '/'

      if (profile?.platform_role === 'super_admin' || profile?.platform_role === 'admin') {
        // Super admin and admin go to main dashboard
        redirectTo = '/'
      } else if (profile?.platform_role === 'event_admin' || profile?.platform_role === 'staff') {
        // Event admin and staff - check if they have event access
        const { data: eventAccess } = await supabase
          .from('event_faculty')
          .select('event_id')
          .eq('faculty_id', user.id)
          .limit(1)
          .maybeSingle()

        if (eventAccess?.event_id) {
          redirectTo = `/events/${eventAccess.event_id}`
        }
      } else if (profile?.platform_role === 'faculty') {
        // Faculty members go to their event if assigned
        const { data: facultyRecord } = await supabase
          .from('faculty')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (facultyRecord) {
          const { data: eventAssignment } = await supabase
            .from('event_faculty')
            .select('event_id')
            .eq('faculty_id', facultyRecord.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (eventAssignment?.event_id) {
            redirectTo = `/events/${eventAssignment.event_id}`
          }
        }
      }

      return NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
    }
  }

  // Auth error, redirect to login with error message
  return NextResponse.redirect(
    new URL('/login?error=auth_callback_error', requestUrl.origin)
  )
}
