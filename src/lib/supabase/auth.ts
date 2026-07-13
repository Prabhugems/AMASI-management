import { createClient } from './client'
import type { Tables, TablesUpdate } from './database.types'

export type UserProfile = Tables<'users'>
export type UserProfileUpdate = TablesUpdate<'users'>

// Sign in with magic link (sends custom designed email via API)
export async function signInWithMagicLink(email: string, redirectTo?: string) {
  const res = await fetch('/api/auth/magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, redirectTo }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to send login link')
  }
  return { success: true }
}

// Sign out
export async function signOut() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  return { success: true }
}

// Get current user
export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

// Get current session
export async function getSession() {
  const supabase = createClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  return session
}

// Get user profile from users table
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  // Same TS inference quirk as use-auth.ts's fetchProfile — equivalent
  // shape at runtime, just not structurally identical to TS here.
  return data as unknown as UserProfile | null
}

// Update user profile
export async function updateUserProfile(userId: string, updates: UserProfileUpdate) {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('users') as any)
    .update(updates)
    .eq('id', userId)
    .select()
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as UserProfile | null
}

// Check if user is admin
export async function isUserAdmin(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId)
  // 'admin' has never been a valid platform_role value (the real enum is
  // super_admin/event_admin/committee/faculty/delegate) — this comparison
  // has always been dead. Cast preserves that exact (harmless, since no
  // row can ever match) behavior; not changed here, flagged separately.
  return profile?.platform_role === 'super_admin' || (profile?.platform_role as string) === 'admin'
}

// Check if user has role
export async function hasRole(userId: string, roles: UserProfile['platform_role'][]): Promise<boolean> {
  const profile = await getUserProfile(userId)
  return profile ? roles.includes(profile.platform_role) : false
}
