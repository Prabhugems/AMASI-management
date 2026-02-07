"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Mail, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return url && !url.includes('placeholder')
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") || "/"
  const supabaseConfigured = isSupabaseConfigured()

  const { signInWithMagicLink, isAuthenticated, loading: authLoading } = useAuth()

  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState("")

  // If login page receives a code param, redirect to auth callback
  React.useEffect(() => {
    const code = searchParams.get("code")
    if (code) {
      const callbackUrl = `/auth/callback?code=${code}${redirectTo ? `&next=${redirectTo}` : ""}`
      router.replace(callbackUrl)
    }
  }, [searchParams, router, redirectTo])

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push(redirectTo)
    }
  }, [isAuthenticated, authLoading, router, redirectTo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      await signInWithMagicLink(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send magic link")
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/90 to-primary items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <span className="text-2xl font-bold">A</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">AMASI</h1>
              <p className="text-white/70 text-sm">Command Center</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-4">
            Faculty Management System
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Streamline your event management with powerful tools for faculty coordination,
            delegate registration, and certificate generation.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span>Manage 17,000+ AMASI members</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span>Faculty invitations & tracking</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span>QR-based check-in system</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-xl font-bold text-white">A</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">AMASI</h1>
              <p className="text-muted-foreground text-xs">Command Center</p>
            </div>
          </div>

          <div className="paper-card p-8">
            {!supabaseConfigured ? (
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-warning" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Development Mode
                </h2>
                <p className="text-muted-foreground mb-6">
                  Supabase is not configured. Authentication is disabled.
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  To enable authentication, add your Supabase credentials to <code className="bg-secondary px-1 py-0.5 rounded">.env.local</code>
                </p>
                <Button
                  onClick={() => router.push('/')}
                  className="w-full"
                >
                  Continue to Dashboard
                </Button>
              </div>
            ) : sent ? (
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-8 w-8 text-success" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Check your email
                </h2>
                <p className="text-muted-foreground mb-6">
                  We sent a magic link to <strong>{email}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Click the link in the email to sign in to your account.
                </p>
                <Button
                  variant="ghost"
                  className="mt-6"
                  onClick={() => {
                    setSent(false)
                    setEmail("")
                  }}
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-semibold text-foreground mb-2">
                    Welcome back
                  </h2>
                  <p className="text-muted-foreground">
                    Sign in with your email to continue
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className={cn(
                          "w-full h-12 pl-11 pr-4 rounded-xl bg-secondary/50 border text-foreground",
                          "placeholder:text-muted-foreground",
                          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
                          "transition-all duration-200",
                          error ? "border-destructive" : "border-transparent"
                        )}
                      />
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-destructive">{error}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12"
                    disabled={loading || !email}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending magic link...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Send magic link
                      </>
                    )}
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  No password required. We&apos;ll send you a secure link to sign in.
                </p>
              </>
            )}
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Association of Minimal Access Surgeons of India
          </p>
        </div>
      </div>
    </div>
  )
}

function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  )
}
