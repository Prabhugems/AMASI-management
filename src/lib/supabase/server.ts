import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from './database.types'
import { getRequiredEnv } from '@/lib/env'

/**
 * Optional cookie domain. Set to e.g. ".amasi.org" on the AMASI deployment so
 * a session at membership.amasi.org persists to events.amasi.org. Leave unset
 * on the College deployment to keep host-only cookies (current behavior).
 *
 * Explicit env var rather than auto-deriving from NEXT_PUBLIC_APP_URL — preview
 * builds and future *.amasi.org subdomains that shouldn't share cookies need to
 * be reviewable, not invisible.
 */
function getCookieDomain(): string | undefined {
  const v = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim()
  return v && v !== '' ? v : undefined
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const cookieDomain = getCookieDomain()

  return createServerClient<Database>(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const mergedOptions = cookieDomain
                ? { ...options, domain: cookieDomain }
                : options
              cookieStore.set(name, value, mergedOptions)
            })
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}

// Admin client with service role - bypasses RLS completely
export async function createAdminClient() {
  return createClient<Database>(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Admin client for the TechnoSurg Supabase project. Returns null when the
// env isn't configured so callers can degrade gracefully (e.g. dev machines
// or deployments that shouldn't cross-tenant query).
export function createTechnosurgAdminClient() {
  const url = process.env.TECHNOSURG_SUPABASE_URL?.trim()
  const key = process.env.TECHNOSURG_SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
