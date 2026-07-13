"use client"

import { useEffect, useState, useCallback, useMemo } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

export type UserProfile = Tables<'users'>

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return url && !url.includes('placeholder')
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Memoize the Supabase client to avoid creating a new instance on every render
  const supabase = useMemo(() => createClient(), [])

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!error && data) {
        // TS infers a slightly different (but equivalent) shape for the
        // select('*') result vs. the Tables<'users'> UserProfile alias here;
        // both resolve from the same generated Row type at runtime.
        setProfile(data as unknown as UserProfile)
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
    }
  }, [supabase])

  useEffect(() => {
    // Skip if Supabase is not configured
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          await fetchProfile(session.user.id)
        }
      } catch (err) {
        console.error('Error getting session:', err)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }

        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signInWithMagicLink = async (email: string, redirectTo?: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please add your Supabase credentials to .env.local')
    }

    // Send magic link via server API (validates email against users/team_members)
    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirectTo }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Failed to send magic link')
    }

    return { success: true }
  }

  const signInWithPassword = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.')
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
    setSession(null)
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  return {
    user,
    profile,
    session,
    loading,
    isAuthenticated: !!user,
    // 'admin' has never been a valid platform_role value (real enum is
    // super_admin/event_admin/committee/faculty/delegate) — dead comparison,
    // preserved as-is (see lib/supabase/auth.ts isUserAdmin for the same note).
    isAdmin: profile?.platform_role === 'super_admin' || (profile?.platform_role as string) === 'admin',
    isSuperAdmin: profile?.is_super_admin || profile?.platform_role === 'super_admin',
    signInWithMagicLink,
    signInWithPassword,
    signOut,
    refreshProfile,
  }
}
