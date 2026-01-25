"use client"

import { useEffect, useState, useCallback } from 'react'
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

  const supabase = createClient()

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (!error && data) {
        setProfile(data)
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

  const signInWithMagicLink = async (email: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please add your Supabase credentials to .env.local')
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    return { success: true }
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
    isAdmin: profile?.platform_role === 'super_admin' || profile?.platform_role === 'admin',
    isSuperAdmin: profile?.is_super_admin || profile?.platform_role === 'super_admin',
    signInWithMagicLink,
    signOut,
    refreshProfile,
  }
}
