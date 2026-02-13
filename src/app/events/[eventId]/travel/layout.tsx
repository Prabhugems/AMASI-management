"use client"

import { useParams, usePathname } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Plane,
  Train,
  Car,
  FileBarChart,
  ChevronLeft,
  Route,
  Loader2,
  Lock,
  LogOut,
  Calendar,
  MapPin,
  Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

// Define sidebar items with their required permissions
const sidebarItems = [
  {
    title: "Overview",
    href: "",
    icon: LayoutDashboard,
    permission: null, // Always visible
    isExternal: false,
  },
  {
    title: "Guests",
    href: "/guests",
    icon: Users,
    permission: null, // Always visible
    isExternal: false,
  },
  {
    title: "Flights",
    href: "/flights",
    icon: Plane,
    permission: "flights",
    isExternal: false,
  },
  {
    title: "Trains",
    href: "/trains",
    icon: Train,
    permission: "trains",
    isExternal: false,
  },
  {
    title: "Pickup/Drop",
    href: "/transfers",
    icon: Car,
    permission: "transfers",
    isExternal: false,
  },
  {
    title: "Accommodation",
    href: "/accommodation",
    icon: Building2,
    permission: "hotels",
    isExternal: true, // Links to /events/[eventId]/accommodation
  },
  {
    title: "Itineraries",
    href: "/itineraries",
    icon: Route,
    permission: null, // Always visible
    isExternal: false,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: FileBarChart,
    permission: null, // Always visible
    isExternal: false,
  },
]

export default function TravelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const eventId = params.eventId as string
  const basePath = `/events/${eventId}/travel`
  const supabase = createClient()

  // Fetch event details
  type EventType = { id: string; name: string; short_name: string | null; start_date: string | null; city: string | null }
  const { data: event } = useQuery({
    queryKey: ["event-details", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name, start_date, city")
        .eq("id", eventId)
        .maybeSingle()
      return data as EventType | null
    },
  })

  // Fetch current user's permissions
  type TeamMemberType = { permissions: string[] | null; role: string | null; name: string; event_ids: string[] | null }
  const { data: userPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ["user-permissions", eventId, "travel"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) return { permissions: [] as string[], isAdmin: false, isTransportUser: false, userName: "" }

      const { data: teamMemberData } = await supabase
        .from("team_members")
        .select("permissions, role, name, event_ids")
        .eq("email", session.user.email.toLowerCase())
        .eq("is_active", true)
        .maybeSingle()
      const teamMember = teamMemberData as TeamMemberType | null

      // If user is NOT in team_members table, they're a main app admin with full access
      if (!teamMember) {
        return {
          permissions: [] as string[],
          isAdmin: true,
          isTransportUser: false,
          hasFullAccess: true,
          hasAccess: true,
          hasHotelsPermission: true,
          hasFlightsPermission: true,
          hasTransfersPermission: true,
          hasTrainsPermission: true,
          userName: session.user.email,
        }
      }

      // Check if user is event-scoped
      const isEventScoped = teamMember.event_ids && teamMember.event_ids.length > 0
      const hasEventAccess = !isEventScoped || teamMember.event_ids?.includes(eventId)

      // If user doesn't have access to this event, deny access
      if (!hasEventAccess) {
        return {
          permissions: teamMember.permissions || [],
          isAdmin: false,
          isTransportUser: false,
          hasFullAccess: false,
          hasAccess: false,
          hasHotelsPermission: false,
          hasFlightsPermission: false,
          hasTransfersPermission: false,
          hasTrainsPermission: false,
          userName: teamMember.name || session.user.email,
        }
      }

      // Event-scoped users should NOT get isAdmin or hasFullAccess
      const isAdmin = isEventScoped ? false : teamMember.role?.includes("admin")
      // Check if transport/travel user (not admin)
      const isTransportUser = (teamMember.role?.includes("travel") || teamMember.role?.includes("transport")) && !isAdmin
      // Empty permissions array means full access (only for non-event-scoped users)
      const hasFullAccess = isEventScoped ? false : (!teamMember.permissions || teamMember.permissions.length === 0)
      // Check specific permissions
      const hasHotelsPermission = teamMember.permissions?.includes("hotels")
      const hasFlightsPermission = teamMember.permissions?.includes("flights")
      const hasTransfersPermission = teamMember.permissions?.includes("transfers")
      const hasTrainsPermission = teamMember.permissions?.includes("trains")

      return {
        permissions: teamMember.permissions || [],
        isAdmin,
        isTransportUser,
        hasFullAccess,
        hasAccess: isAdmin || hasFullAccess || ((teamMember.permissions?.length ?? 0) > 0),
        hasHotelsPermission: isAdmin || hasFullAccess || hasHotelsPermission,
        hasFlightsPermission: isAdmin || hasFullAccess || hasFlightsPermission,
        hasTransfersPermission: isAdmin || hasFullAccess || hasTransfersPermission,
        hasTrainsPermission: isAdmin || hasFullAccess || hasTrainsPermission,
        userName: teamMember.name || session.user.email,
      }
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  })

  const isActive = (href: string) => {
    const fullPath = `${basePath}${href}`
    if (href === "") {
      return pathname === basePath
    }
    return pathname.startsWith(fullPath)
  }

  // Check if user has access to a specific permission
  const hasPermission = (permission: string | null) => {
    if (!permission) return true // No permission required
    if (userPermissions?.isAdmin) return true // Admin has full access
    if (userPermissions?.hasFullAccess) return true // Full access
    // Use specific permission flags
    switch (permission) {
      case "hotels": return userPermissions?.hasHotelsPermission
      case "flights": return userPermissions?.hasFlightsPermission
      case "transfers": return userPermissions?.hasTransfersPermission
      case "trains": return userPermissions?.hasTrainsPermission
      default: return userPermissions?.permissions?.includes(permission)
    }
  }

  // Filter sidebar items based on permissions
  const visibleItems = sidebarItems.filter(item => hasPermission(item.permission))

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/travel-login")
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ""
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  // Transport user gets a standalone full-page layout
  if (userPermissions?.isTransportUser) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* Header for transport users */}
        <header className="h-14 border-b bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/events/${eventId}`}
              className="flex items-center gap-2 text-slate-300 hover:text-white text-sm"
            >
              <ChevronLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <div className="h-6 w-px bg-slate-600" />
            <div className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-sm">{event?.short_name || event?.name || "Event"}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {event?.start_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(event.start_date)}
                    </span>
                  )}
                  {event?.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {event.city}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300">{userPermissions.userName}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-300 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </header>

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 border-r bg-muted/30 flex flex-col">
            {/* Title */}
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold text-lg">Travel</h2>
              <p className="text-xs text-muted-foreground">Manage travel & logistics</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-1">
              {permissionsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                visibleItems.map((item) => {
                  const Icon = item.icon
                  const itemPath = item.isExternal
                    ? `/events/${eventId}${item.href}`
                    : `${basePath}${item.href}`
                  const active = item.isExternal
                    ? pathname.startsWith(`/events/${eventId}${item.href}`)
                    : isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={itemPath}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.title}
                    </Link>
                  )
                })
              )}
            </nav>

            {/* Permission indicator */}
            {!permissionsLoading && !userPermissions?.hasFullAccess && (
              <div className="p-3 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  <span>Limited access</span>
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            {children}
          </div>
        </div>
      </div>
    )
  }

  // Regular layout for admin users (within event layout)
  return (
    <div className="flex h-[calc(100vh-6rem)] -mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
      {/* Sidebar */}
      <div className="w-56 border-r bg-muted/30 flex flex-col">
        {/* Back link */}
        <Link
          href={`/events/${eventId}`}
          className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Event
        </Link>

        {/* Title */}
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-lg">Travel</h2>
          <p className="text-xs text-muted-foreground">Manage travel & logistics</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {permissionsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            visibleItems.map((item) => {
              const Icon = item.icon
              const itemPath = item.isExternal
                ? `/events/${eventId}${item.href}`
                : `${basePath}${item.href}`
              const active = item.isExternal
                ? pathname.startsWith(`/events/${eventId}${item.href}`)
                : isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={itemPath}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
                </Link>
              )
            })
          )}
        </nav>

        {/* Permission indicator */}
        {!permissionsLoading && !userPermissions?.hasFullAccess && !userPermissions?.isAdmin && (
          <div className="p-3 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>Limited access</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {children}
      </div>
    </div>
  )
}
