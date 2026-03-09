"use client"

import { useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

function AuthCallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const handleAuth = async () => {
      const supabase = createClient()
      const next = searchParams.get("next") || "/"

      // 1. Check for hash fragment (implicit flow from generateLink)
      const hash = window.location.hash
      if (hash && hash.includes("access_token")) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get("access_token")
        const refreshToken = params.get("refresh_token")

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (error) {
            router.replace("/login?error=auth_callback_error")
            return
          }

          // Validate user and track login
          try {
            const res = await fetch("/api/auth/login-complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accessToken }),
            })

            const data = await res.json()

            if (!res.ok || data.error) {
              await supabase.auth.signOut()
              router.replace("/login?error=unauthorized")
              return
            }

            // Clear hash and redirect
            window.history.replaceState(null, "", window.location.pathname + window.location.search)
            router.replace(data.redirectTo || next)
          } catch {
            // If login-complete fails, still allow login for existing users
            router.replace(next)
          }
          return
        }
      }

      // 2. Check for code parameter (PKCE flow)
      const code = searchParams.get("code")
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
          router.replace("/login?error=auth_callback_error")
          return
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.access_token) {
          try {
            const res = await fetch("/api/auth/login-complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accessToken: session.access_token }),
            })

            const data = await res.json()

            if (!res.ok || data.error) {
              await supabase.auth.signOut()
              router.replace("/login?error=unauthorized")
              return
            }

            router.replace(data.redirectTo || next)
          } catch {
            router.replace(next)
          }
          return
        }
      }

      // No valid auth params
      router.replace("/login?error=auth_callback_error")
    }

    handleAuth()
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthCallbackHandler />
    </Suspense>
  )
}
