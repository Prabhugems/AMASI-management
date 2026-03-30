"use client"

import { usePermissions, type Permission } from "@/hooks/use-permissions"
import { useRouter } from "next/navigation"
import { ShieldX, ArrowLeft, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface PermissionGateProps {
  children: React.ReactNode
  permission: string // e.g., "registrations", "speakers", "flights"
  eventId?: string // optional - if provided, also checks event access
  fallback?: React.ReactNode // custom fallback, defaults to AccessDenied
}

export function PermissionGate({
  children,
  permission,
  eventId,
  fallback,
}: PermissionGateProps) {
  const {
    hasPermission,
    hasEventAccess,
    isLoading,
    isAdmin,
    isEventScoped,
    hasFullAccess,
  } = usePermissions()

  if (isLoading) {
    return <LoadingSkeleton />
  }

  // Super admins and admins with full access always pass
  if (isAdmin || hasFullAccess) {
    return <>{children}</>
  }

  // Check event access if eventId provided
  if (eventId && isEventScoped && !hasEventAccess(eventId)) {
    return fallback ? <>{fallback}</> : <AccessDenied reason="event" />
  }

  // Check module permission
  if (!hasPermission(permission as Permission)) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <AccessDenied reason="module" module={permission} />
    )
  }

  return <>{children}</>
}

function AccessDenied({
  reason = "module",
  module,
}: {
  reason?: "event" | "module"
  module?: string
}) {
  const router = useRouter()

  const title =
    reason === "event" ? "Event Access Denied" : "Module Access Denied"

  const description =
    reason === "event"
      ? "You don't have permission to access this event. Please contact an administrator if you believe this is an error."
      : `You don't have permission to access the "${module}" module. Contact your administrator to request access.`

  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-muted-foreground mb-6">{description}</p>
        {module && (
          <p className="text-sm text-muted-foreground mb-6">
            Required permission:{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
              {module}
            </code>
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
          <Button asChild>
            <Link href="/events">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="py-16 px-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-96 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-lg mt-4" />
      </div>
    </div>
  )
}
