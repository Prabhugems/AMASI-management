import { createClient } from './client'
import type { Tables, UpdateTables } from './database.types'

export type UserProfile = Tables<'users'>
export type UserProfileUpdate = UpdateTables<'users'>

// Sign in with magic link (sends custom designed email via API)
export async function signInWithMagicLink(email: string, redirectTo?: string) {
  const res = await fetch('/api/auth/magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, redirectTo }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to send magic link')
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
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return data
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
    .single()

  if (error) throw error
  return data as UserProfile
}

// Check if user is admin
export async function isUserAdmin(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId)
  return profile?.platform_role === 'super_admin' || profile?.platform_role === 'admin'
}

// Check if user has role
export async function hasRole(userId: string, roles: UserProfile['platform_role'][]): Promise<boolean> {
  const profile = await getUserProfile(userId)
  return profile ? roles.includes(profile.platform_role) : false
}
