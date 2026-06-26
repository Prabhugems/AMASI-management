"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Mail, Loader2, CheckCircle2, AlertTriangle, Calendar, Users, BarChart3, Shield, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"
import { COMPANY_CONFIG, FEATURES } from "@/lib/config"

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

  const { signInWithMagicLink, signInWithPassword, isAuthenticated, loading: authLoading } = useAuth()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState("")
  const [loginMode] = React.useState<"password" | "magic-link">("magic-link")
  // Email-scanner-resistant fallback: 6-digit code the user can type in case
  // the magic link gets pre-fetched (and burned) by their email provider.
  const [code, setCode] = React.useState("")
  const [verifying, setVerifying] = React.useState(false)
  const [verifyError, setVerifyError] = React.useState("")

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
      if (loginMode === "password") {
        await signInWithPassword(email, password)
        router.push(redirectTo)
      } else {
        await signInWithMagicLink(email, redirectTo !== "/" ? redirectTo : undefined)
        setSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = code.trim()
    // Supabase OTP length is configurable (MAILER_OTP_LENGTH); this project uses 8.
    if (token.length < 6) return
    setVerifying(true)
    setVerifyError("")

    try {
      const supabase = createClient()
      const { data, error: otpError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      })
      if (otpError) throw otpError
      const accessToken = data.session?.access_token
      if (!accessToken) throw new Error("No session returned")

      // Mirror the auth/callback flow: validate + record login, get redirect target
      const res = await fetch("/api/auth/login-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      })
      const lc = await res.json().catch(() => ({}))
      if (!res.ok || lc.error) {
        await supabase.auth.signOut()
        throw new Error(lc.error || "Unauthorized")
      }

      router.push(lc.redirectTo || redirectTo)
    } catch (err) {
      setVerifyError(
        err instanceof Error && err.message
          ? err.message === "Token has expired or is invalid"
            ? "That code is invalid or has expired. Request a new one."
            : err.message
          : "Invalid or expired code"
      )
    } finally {
      setVerifying(false)
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
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-primary/80 items-center justify-center p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 -left-10 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-white/15 blur-2xl" />
        </div>

        <div className="max-w-md text-white relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <span className="text-2xl font-bold">{COMPANY_CONFIG.name.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{COMPANY_CONFIG.name}</h1>
              <p className="text-white/60 text-sm">{FEATURES.membership ? "Command Center" : "Event Management Platform"}</p>
            </div>
          </div>

          {FEATURES.membership ? (
            <>
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
                  <span>Manage {COMPANY_CONFIG.name} members & faculty</span>
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
            </>
          ) : (
            <>
              <h2 className="text-4xl font-bold mb-4 leading-tight">
                Your complete event<br />command center
              </h2>
              <p className="text-white/70 text-lg mb-10">
                Everything you need to plan, manage, and execute world-class conferences and events.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <Calendar className="h-6 w-6 mb-3 text-white/80" />
                  <h3 className="font-semibold text-sm mb-1">Event Management</h3>
                  <p className="text-white/50 text-xs">Sessions, programs & schedules</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <Users className="h-6 w-6 mb-3 text-white/80" />
                  <h3 className="font-semibold text-sm mb-1">Registrations</h3>
                  <p className="text-white/50 text-xs">Delegates, badges & check-in</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <BarChart3 className="h-6 w-6 mb-3 text-white/80" />
                  <h3 className="font-semibold text-sm mb-1">Analytics</h3>
                  <p className="text-white/50 text-xs">Real-time insights & reports</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <Shield className="h-6 w-6 mb-3 text-white/80" />
                  <h3 className="font-semibold text-sm mb-1">Certificates</h3>
                  <p className="text-white/50 text-xs">Auto-generate & verify</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-xl font-bold text-white">{COMPANY_CONFIG.name.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground leading-tight">{COMPANY_CONFIG.name}</h1>
              <p className="text-muted-foreground text-xs">{FEATURES.membership ? "Command Center" : "Event Management"}</p>
            </div>
          </div>

          {!supabaseConfigured ? (
            <>
              <div className="h-12 w-12 rounded-full bg-warning/15 flex items-center justify-center mb-6">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground leading-9">
                Development Mode
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Supabase is not configured. To enable authentication, add your credentials to <code className="bg-secondary px-1 py-0.5 rounded text-xs">.env.local</code>.
              </p>
              <Button onClick={() => router.push('/')} className="w-full mt-10">
                Continue to Dashboard
              </Button>
            </>
          ) : sent ? (
            <>
              <div className="h-12 w-12 rounded-full bg-success/15 flex items-center justify-center mb-6">
                <Mail className="h-6 w-6 text-success" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground leading-9">
                Check your email
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                We sent a magic link and a verification code to{" "}
                <strong className="text-foreground">{email}</strong>. Click the link, or enter the
                code below if your email provider strips the link.
              </p>

              <form onSubmit={handleVerifyCode} className="mt-8 space-y-4">
                <div>
                  <label
                    htmlFor="otp-code"
                    className="block text-sm font-medium leading-6 text-foreground"
                  >
                    Verification code
                  </label>
                  <div className="mt-2">
                    <Input
                      id="otp-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      autoComplete="one-time-code"
                      autoFocus
                      value={code}
                      onChange={(e) => {
                        setVerifyError("")
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }}
                      placeholder="Enter code from email"
                      className="text-center text-lg sm:text-xl tracking-[0.2em] sm:tracking-[0.4em] font-mono"
                      aria-invalid={!!verifyError}
                    />
                  </div>
                </div>

                {verifyError && (
                  <p className="text-sm text-destructive">{verifyError}</p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={verifying || code.length < 6}
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4 mr-2" />
                      Verify code & sign in
                    </>
                  )}
                </Button>
              </form>

              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => {
                  setSent(false)
                  setEmail("")
                  setCode("")
                  setVerifyError("")
                }}
              >
                Use a different email
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-foreground leading-9">
                Sign in to your account
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                We&apos;ll email you a secure magic link — no password needed.
              </p>

              <form onSubmit={handleSubmit} className="mt-10 space-y-6">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium leading-6 text-foreground"
                  >
                    Email address
                  </label>
                  <div className="mt-2">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                      aria-invalid={!!error}
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !email}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending login link...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Send login link
                    </>
                  )}
                </Button>
              </form>
            </>
          )}

          <p className="mt-10 text-center text-xs text-muted-foreground leading-relaxed">
            {COMPANY_CONFIG.fullName}
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
