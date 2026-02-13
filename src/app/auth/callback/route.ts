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
        // Get current login count first
        const { data: currentUser } = await adminClient
          .from('users')
          .select('login_count')
          .eq('id', user.id)
          .single()
        await adminClient
          .from('users')
          .update({
            last_login_at: now,
            last_active_at: now,
            logged_out_at: null,
            login_count: (currentUser?.login_count || 0) + 1,
          })
          .eq('id', user.id)
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

      // If there's an explicit next URL, use it
      if (next) {
        return NextResponse.redirect(new URL(next, requestUrl.origin))
      }

      // Get user profile to determine role-based redirect
      const { data: profile } = await supabase
        .from('users')
        .select('platform_role')
        .eq('id', user.id)
        .single()

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
          .single()

        if (eventAccess?.event_id) {
          redirectTo = `/events/${eventAccess.event_id}`
        }
      } else if (profile?.platform_role === 'faculty') {
        // Faculty members go to their event if assigned
        const { data: facultyRecord } = await supabase
          .from('faculty')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (facultyRecord) {
          const { data: eventAssignment } = await supabase
            .from('event_faculty')
            .select('event_id')
            .eq('faculty_id', facultyRecord.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

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
