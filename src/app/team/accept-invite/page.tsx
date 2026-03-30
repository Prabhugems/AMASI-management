"use client"

import * as React from "react"
import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { UserCheck, CheckCircle, XCircle, Loader2, Clock, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { COMPANY_CONFIG } from "@/lib/config"

type PageState =
  | { kind: "loading" }
  | { kind: "valid"; role: string; email: string; name: string }
  | { kind: "processing" }
  | { kind: "success"; message: string }
  | { kind: "error"; type: "expired" | "invalid" | "already_accepted" | "generic"; message: string }

function AcceptInviteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [state, setState] = React.useState<PageState>({ kind: "loading" })

  // Fetch invitation details on mount
  React.useEffect(() => {
    if (!token) {
      setState({
        kind: "error",
        type: "invalid",
        message: "Invalid invitation link. No token provided.",
      })
      return
    }

    const fetchInvitation = async () => {
      try {
        // We'll use a GET-style check by attempting a lightweight fetch
        // Since the API only has POST, we validate on accept.
        // For now, show the accept UI with token present.
        // We can't fetch invitation details without a dedicated GET endpoint,
        // so we show a generic accept UI.
        setState({
          kind: "valid",
          role: "",
          email: "",
          name: "",
        })
      } catch {
        setState({
          kind: "error",
          type: "generic",
          message: "Something went wrong. Please try again.",
        })
      }
    }

    fetchInvitation()
  }, [token])

  const handleAccept = async () => {
    if (!token) return

    setState({ kind: "processing" })

    try {
      const res = await fetch(`/api/team/invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok && data.success) {
        const role = data.data?.role || ""
        const successMsg = role
          ? `Welcome aboard! You've joined as ${role.replace(/_/g, " ")}.`
          : data.message || "Invitation accepted successfully!"

        setState({ kind: "success", message: successMsg })

        // Redirect to team-login after 2 seconds
        setTimeout(() => {
          router.push("/team-login")
        }, 2000)
      } else if (res.status === 410) {
        setState({
          kind: "error",
          type: "expired",
          message: "This invitation has expired. Please ask your admin for a new one.",
        })
      } else if (res.status === 404) {
        setState({
          kind: "error",
          type: "invalid",
          message: "Invalid invitation link. This invitation does not exist.",
        })
      } else if (res.status === 400 && data.error?.includes("already been")) {
        setState({
          kind: "error",
          type: "already_accepted",
          message: data.error || "This invitation has already been used.",
        })
      } else {
        setState({
          kind: "error",
          type: "generic",
          message: data.error || "Failed to accept invitation. Please try again.",
        })
      }
    } catch {
      setState({
        kind: "error",
        type: "generic",
        message: "Network error. Please check your connection and try again.",
      })
    }
  }

  // Loading state
  if (state.kind === "loading") {
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
              <h1 className="text-2xl font-bold">{COMPANY_CONFIG.name} Team</h1>
              <p className="text-sidebar-muted text-sm">Management Portal</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-4">
            Join the Team
          </h2>
          <p className="text-sidebar-muted text-lg mb-8">
            You&apos;ve been invited to collaborate on event management. Accept the invitation to get started.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sidebar-accent flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-sidebar-primary" />
              </div>
              <span>Role-based access to modules</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sidebar-accent flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-sidebar-primary" />
              </div>
              <span>Manage events and registrations</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Accept Card */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="h-12 w-12 rounded-xl bg-sidebar flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{COMPANY_CONFIG.name} Team</h1>
              <p className="text-muted-foreground text-xs">Management Portal</p>
            </div>
          </div>

          <div className="paper-card p-8">
            {/* Valid invitation - show accept button */}
            {state.kind === "valid" && (
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <UserCheck className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  You&apos;ve Been Invited
                </h2>
                <p className="text-muted-foreground mb-6">
                  You&apos;ve been invited to join the {COMPANY_CONFIG.name} team. Click below to accept and get started.
                </p>
                <Button
                  onClick={handleAccept}
                  className="w-full"
                  size="lg"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Accept Invitation
                </Button>
              </div>
            )}

            {/* Processing state */}
            {state.kind === "processing" && (
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Accepting Invitation...
                </h2>
                <p className="text-muted-foreground">
                  Please wait while we set up your account.
                </p>
              </div>
            )}

            {/* Success state */}
            {state.kind === "success" && (
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  You&apos;re In!
                </h2>
                <p className="text-muted-foreground mb-4">
                  {state.message}
                </p>
                <p className="text-sm text-muted-foreground">
                  Redirecting to login...
                </p>
              </div>
            )}

            {/* Error states */}
            {state.kind === "error" && (
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  {state.type === "expired" ? (
                    <Clock className="h-8 w-8 text-destructive" />
                  ) : (
                    <XCircle className="h-8 w-8 text-destructive" />
                  )}
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {state.type === "expired" && "Invitation Expired"}
                  {state.type === "invalid" && "Invalid Invitation"}
                  {state.type === "already_accepted" && "Already Accepted"}
                  {state.type === "generic" && "Something Went Wrong"}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {state.message}
                </p>
                {state.type === "already_accepted" && (
                  <Button
                    onClick={() => router.push("/team-login")}
                    variant="outline"
                    className="w-full"
                  >
                    Go to Login
                  </Button>
                )}
              </div>
            )}
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            {COMPANY_CONFIG.fullName}
          </p>
        </div>
      </div>
    </div>
  )
}

function AcceptInviteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AcceptInviteLoading />}>
      <AcceptInviteContent />
    </Suspense>
  )
}
