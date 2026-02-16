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
        platform_role: 'member', // Default to member - admins must promote manually
        is_super_admin: false,
        is_active: true,
        is_verified: true,
        login_count: 1,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, email, name, platform_role, is_super_admin')
      .maybeSingle()

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

  // Auto-link unlinked team_members records by matching email
  try {
    const linkClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (linkClient as any)
      .from('team_members')
      .update({ user_id: authUser.id })
      .eq('email', authUser.email)
      .is('user_id', null)
  } catch {
    // Non-critical - don't block login if linking fails
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

/**
 * Check if user has access to a specific event
 * Super admins have access to all events
 * Event admins have access to events they created or are team members of
 */
export async function requireEventAccess(eventId: string): Promise<AuthResult> {
  const result = await getApiUser()

  if (result.error) {
    return result
  }

  if (!result.user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  // Super admins have access to all events
  if (result.user.is_super_admin) {
    return result
  }

  // Check if user created the event or is a team member
  const adminClient = await createAdminClient()

  // Check event ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = await (adminClient as any)
    .from('events')
    .select('id, created_by')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }
  }

  // Check if user is the event creator
  if (event.created_by === result.user.id) {
    return result
  }

  // Check if user is a team member for this event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teamMember } = await (adminClient as any)
    .from('team_members')
    .select('id')
    .contains('event_ids', [eventId])
    .eq('user_id', result.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (teamMember) {
    return result
  }

  return {
    user: null,
    error: NextResponse.json(
      { error: 'Forbidden - You do not have access to this event' },
      { status: 403 }
    )
  }
}

/**
 * Check if user has access to a specific form
 * Super admins have access to all forms
 * If form has event_id, delegates to requireEventAccess
 * If no event_id, only the creator has access
 */
export async function requireFormAccess(formId: string): Promise<AuthResult> {
  const result = await getApiUser()

  if (result.error) {
    return result
  }

  if (!result.user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  // Super admins have access to all forms
  if (result.user.is_super_admin) {
    return result
  }

  const adminClient = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: form } = await (adminClient as any)
    .from('forms')
    .select('id, event_id, created_by')
    .eq('id', formId)
    .maybeSingle()

  if (!form) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }
  }

  // If form has event_id, delegate to event access check
  if (form.event_id) {
    return requireEventAccess(form.event_id)
  }

  // If no event_id, only the creator has access
  if (form.created_by === result.user.id) {
    return result
  }

  return {
    user: null,
    error: NextResponse.json(
      { error: 'Forbidden - You do not have access to this form' },
      { status: 403 }
    )
  }
}

/**
 * Get event ID from a registration ID
 */
export async function getEventIdFromRegistration(registrationId: string): Promise<string | null> {
  const adminClient = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (adminClient as any)
    .from('registrations')
    .select('event_id')
    .eq('id', registrationId)
    .maybeSingle()

  return data?.event_id || null
}
