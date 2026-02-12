"use client"

import { useState } from "react"
import { usePathname, useParams, useRouter } from "next/navigation"
import { EventSidebar } from "@/components/layout/event-sidebar"
import { Header } from "@/components/layout/header"
import { usePermissions } from "@/hooks/use-permissions"
import { Loader2, ShieldX } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function EventLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const params = useParams()
  const router = useRouter()
  const eventId = params?.eventId as string
  const { isEventScoped, hasEventAccess, isLoading: permissionsLoading } = usePermissions()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Hide sidebar for public pages
  const isPublicPage = pathname?.includes("/program/public")

  // Check event access for event-scoped users
  const canAccessEvent = !isEventScoped || hasEventAccess(eventId)

  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    )
  }

  // Show loading while checking permissions
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show access denied for event-scoped users trying to access wrong event
  if (!canAccessEvent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access this event. Please contact an administrator if you believe this is an error.
          </p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div className={`lg:block ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        <EventSidebar onNavigate={() => setMobileMenuOpen(false)} />
      </div>
      <div className="lg:pl-16 transition-all duration-300 print:pl-0">
        <Header sidebarCollapsed={false} onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="p-4 sm:p-6 pt-20 print:p-0 print:pt-0">{children}</main>
      </div>
    </div>
  )
}
