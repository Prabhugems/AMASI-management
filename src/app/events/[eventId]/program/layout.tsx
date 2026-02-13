"use client"

import { useParams, usePathname } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Calendar,
  Presentation,
  Layers,
  Users,
  Printer,
  Globe,
  ChevronLeft,
  Settings,
  Upload,
  Building2,
  UserCheck,
  AlertTriangle,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  CalendarDays,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

type SidebarItem = {
  title: string
  href: string
  icon: any
  external?: boolean
}

const sidebarItems: SidebarItem[] = [
  { title: "Dashboard", href: "", icon: LayoutDashboard },
  { title: "Confirmations", href: "/confirmations", icon: UserCheck },
  { title: "Schedule", href: "/schedule", icon: Calendar },
  { title: "Sessions", href: "/sessions", icon: Presentation },
  { title: "Tracks", href: "/tracks", icon: Layers },
  { title: "Halls", href: "/halls", icon: Building2 },
  { title: "Coordinators", href: "/coordinators", icon: UserCheck },
  { title: "Speakers", href: "/speakers", icon: Users, external: true },
  { title: "Import", href: "/import", icon: Upload },
  { title: "Conflicts", href: "/conflicts", icon: AlertTriangle },
  { title: "Print", href: "/print", icon: Printer },
  { title: "Public View", href: "/public", icon: Globe },
  { title: "Delegate View", href: "/delegate", icon: Calendar },
  { title: "Settings", href: "/settings", icon: Settings },
]

export default function ProgramLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const eventId = params.eventId as string
  const basePath = `/events/${eventId}/program`
  const supabase = createClient()

  type EventType = { id: string; name: string; short_name: string | null; start_date: string | null; city: string | null }
  const { data: event } = useQuery({
    queryKey: ["event-details", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name, start_date, city")
        .eq("id", eventId)
        .single()
      return data as EventType | null
    },
  })

  type TeamMemberType = { permissions: string[] | null; role: string | null; name: string; event_ids: string[] | null }
  const { data: userPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ["user-permissions", eventId, "program"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) return { permissions: [] as string[], isAdmin: false, hasAccess: false, isTeamUser: false, userName: "" }

      const { data: teamMemberData } = await supabase
        .from("team_members")
        .select("permissions, role, name, event_ids")
        .eq("email", session.user.email.toLowerCase())
        .eq("is_active", true)
        .single()
      const teamMember = teamMemberData as TeamMemberType | null

      // If user is NOT in team_members table, they're a main app admin with full access
      if (!teamMember) {
        return {
          permissions: [] as string[],
          isAdmin: true,
          isTeamUser: false,
          hasFullAccess: true,
          hasAccess: true,
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
          isTeamUser: true,
          hasFullAccess: false,
          hasAccess: false,
          userName: teamMember.name || session.user.email,
        }
      }

      // Event-scoped users should NOT get isAdmin or hasFullAccess
      const isAdmin = isEventScoped ? false : teamMember.role?.includes("admin")
      const isTeamUser = !isAdmin
      const hasFullAccess = isEventScoped ? false : (!teamMember.permissions || teamMember.permissions.length === 0)
      const hasProgramPermission = teamMember.permissions?.includes("program")

      return {
        permissions: teamMember.permissions || [],
        isAdmin,
        isTeamUser,
        hasFullAccess,
        hasAccess: isAdmin || hasFullAccess || hasProgramPermission,
        userName: teamMember.name || session.user.email,
      }
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  })

  const isActive = (href: string) => {
    const fullPath = `${basePath}${href}`
    if (href === "") return pathname === basePath
    return pathname.startsWith(fullPath)
  }

  // Public view should render without the admin sidebar
  const isPublicView = pathname.endsWith("/public") || pathname.includes("/program/public")
  if (isPublicView) {
    return <>{children}</>
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/team-login")
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ""
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  }

  const renderNavigation = () => (
    <>
      {permissionsLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        sidebarItems.map((item) => {
          const Icon = item.icon
          const fullHref = item.external ? `/events/${eventId}${item.href}` : `${basePath}${item.href}`
          const active = item.external ? pathname.startsWith(`/events/${eventId}${item.href}`) : isActive(item.href)
          return (
            <Link
              key={item.href}
              href={fullHref}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          )
        })
      )}
    </>
  )

  if (!permissionsLoading && !userPermissions?.hasAccess) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
        <div className="text-center">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">You don't have permission to access Program.</p>
          <Link href={`/events/${eventId}`} className="text-primary hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  if (userPermissions?.isTeamUser) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <header className="h-14 border-b bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href={`/events/${eventId}`} className="flex items-center gap-2 text-slate-300 hover:text-white text-sm">
              <ChevronLeft className="h-4 w-4" />Dashboard
            </Link>
            <div className="h-6 w-px bg-slate-600" />
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-400" />
              <div>
                <p className="font-semibold text-sm">{event?.short_name || event?.name || "Event"}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {event?.start_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(event.start_date)}</span>}
                  {event?.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.city}</span>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300">{userPermissions.userName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-300 hover:text-white hover:bg-white/10">
              <LogOut className="h-4 w-4 mr-2" />Logout
            </Button>
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 border-r bg-muted/30 flex flex-col">
            <Link href={`/events/${eventId}`} className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b">
              <ChevronLeft className="h-4 w-4" />Back to Dashboard
            </Link>
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold text-lg">Program</h2>
              <p className="text-xs text-muted-foreground">Schedule & sessions</p>
            </div>
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">{renderNavigation()}</nav>
            {!permissionsLoading && !userPermissions?.hasFullAccess && (
              <div className="p-3 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" /><span>Program Access</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto">{children}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] -mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
      <div className="w-56 border-r bg-muted/30 flex flex-col">
        <Link href={`/events/${eventId}`} className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b">
          <ChevronLeft className="h-4 w-4" />Back to Event
        </Link>
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-lg">Program</h2>
          <p className="text-xs text-muted-foreground">Schedule & sessions</p>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">{renderNavigation()}</nav>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
