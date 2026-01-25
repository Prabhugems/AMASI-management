import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Database } from '@/lib/supabase/database.types'
import { createAdminClient } from '@/lib/supabase/server'

export type PlatformRole = 'super_admin' | 'admin' | 'event_admin' | 'staff' | 'faculty' | 'member'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  platform_role: PlatformRole
  is_super_admin: boolean
}

export interface AuthResult {
  user: AuthUser | null
  error: NextResponse | null
}

/**
 * Get authenticated user for API routes
 * Returns user info if authenticated, or error response if not
 */
export async function getApiUser(): Promise<AuthResult> {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore - Server Component context
          }
        },
      },
    }
  )

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }
  }

  // Get user profile with role info
  let { data: userProfile } = await supabase
    .from('users')
    .select('id, email, name, platform_role, is_super_admin')
    .eq('id', authUser.id)
    .maybeSingle()

  // If profile doesn't exist, create it automatically using admin client (bypasses RLS)
  if (!userProfile) {
    const adminClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newProfile, error: createError } = await (adminClient as any)
      .from('users')
      .insert({
        id: authUser.id,
        email: authUser.email || '',
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
        platform_role: 'event_admin', // Default to event_admin for new users
        is_super_admin: false,
        is_active: true,
        is_verified: true,
        login_count: 1,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, email, name, platform_role, is_super_admin')
      .single()

    if (createError || !newProfile) {
      console.error('Failed to create user profile:', createError)
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Failed to create user profile' },
          { status: 500 }
        )
      }
    }

    userProfile = newProfile
  }

  if (!userProfile) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'User profile not found' },
        { status: 401 }
      )
    }
  }

  return {
    user: userProfile as unknown as AuthUser,
    error: null
  }
}

/**
 * Require admin role for API routes
 * Returns user if admin, or error response if not
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await getApiUser()

  if (result.error) {
    return result
  }

  const adminRoles: PlatformRole[] = ['super_admin', 'admin', 'event_admin']

  if (!result.user || (!result.user.is_super_admin && !adminRoles.includes(result.user.platform_role))) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }
  }

  return result
}

/**
 * Require super admin role for API routes
 */
export async function requireSuperAdmin(): Promise<AuthResult> {
  const result = await getApiUser()

  if (result.error) {
    return result
  }

  if (!result.user || !result.user.is_super_admin) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      )
    }
  }

  return result
}
