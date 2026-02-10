"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Mail, Loader2, Users, AlertTriangle, Plane, Calendar, UserCheck, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

function TeamLoginForm() {
  const router = useRouter()
  const _searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState("")
  const [checkingAuth, setCheckingAuth] = React.useState(true)

  // Check if already authenticated
  React.useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        // Check if user is a team member
        const { data: teamMember } = await supabase
          .from("team_members")
          .select("*")
          .eq("email", session.user.email.toLowerCase())
          .eq("is_active", true)
          .single()

        if (teamMember) {
          router.push("/team-portal")
          return
        }
      }
      setCheckingAuth(false)
    }
    checkAuth()
  }, [supabase, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // First check if email is a valid team member
      const { data: teamMember, error: teamError } = await supabase
        .from("team_members")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("is_active", true)
        .single()

      if (teamError || !teamMember) {
        setError("This email is not authorized. Please contact admin.")
        setLoading(false)
        return
      }

      // Send magic link
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/team-portal`,
        },
      })

      if (signInError) throw signInError
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send magic link")
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar items-center justify-center p-12">
        <div className="max-w-md text-sidebar-foreground">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-sidebar-primary flex items-center justify-center">
              <Users className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AMASI Team</h1>
              <p className="text-sidebar-muted text-sm">Management Portal</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-4">
            Team Portal
          </h2>
          <p className="text-sidebar-muted text-lg mb-8">
            Access your assigned modules based on your permissions. Manage events, speakers, travel, and more.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sidebar-accent flex items-center justify-center">
                <Plane className="h-5 w-5 text-sidebar-primary" />
              </div>
              <span>Travel & Logistics</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sidebar-accent flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-sidebar-primary" />
              </div>
              <span>Speakers & Program</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sidebar-accent flex items-center justify-center">
                <Calendar className="h-5 w-5 text-sidebar-primary" />
              </div>
              <span>Check-in & Registrations</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sidebar-accent flex items-center justify-center">
                <Award className="h-5 w-5 text-sidebar-primary" />
              </div>
              <span>Badges & Certificates</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="h-12 w-12 rounded-xl bg-sidebar flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">AMASI Team</h1>
              <p className="text-muted-foreground text-xs">Management Portal</p>
            </div>
          </div>

          <div className="paper-card p-8">
            {sent ? (
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-8 w-8 text-success" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Check your email
                </h2>
                <p className="text-muted-foreground mb-6">
                  We sent a magic link to <strong className="text-foreground">{email}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Click the link in the email to access the team portal.
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
                    Team Login
                  </h2>
                  <p className="text-muted-foreground">
                    Enter your email to receive a magic link
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className={cn("pl-11", error && "border-destructive")}
                      />
                    </div>
                    {error && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        {error}
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || !email}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Verifying...
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
                  Only authorized team members can access this portal.
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

export default function TeamLoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <TeamLoginForm />
    </Suspense>
  )
}
