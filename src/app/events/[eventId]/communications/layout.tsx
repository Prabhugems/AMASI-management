"use client"

import { useParams, usePathname } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Send,
  FileText,
  History,
  Settings,
  ChevronLeft,
  Loader2,
  Lock,
  LogOut,
  Calendar,
  MapPin,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

const sidebarItems = [
  { title: "Overview", href: "", icon: LayoutDashboard },
  { title: "Compose", href: "/compose", icon: Send },
  { title: "Templates", href: "/templates", icon: FileText },
  { title: "History", href: "/history", icon: History },
  { title: "Settings", href: "/settings", icon: Settings },
]

export default function CommunicationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const eventId = params.eventId as string
  const basePath = `/events/${eventId}/communications`
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
        .single()
      return data as EventType | null
    },
  })

  // Fetch user permissions
  const { data: userPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ["user-permissions-communications", eventId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) return { permissions: [] as string[], isAdmin: false, hasAccess: false, isTeamUser: false, userName: "" }

      type TeamMemberType = { permissions: string[] | null; role: string | null; name: string; event_ids: string[] | null }
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

      // Check if user is event-scoped and has access to this event
      const isEventScoped = teamMember.event_ids && teamMember.event_ids.length > 0
      const hasEventAccess = !isEventScoped || teamMember.event_ids?.includes(eventId)

      if (!hasEventAccess) {
        return {
          permissions: teamMember?.permissions || [],
          isAdmin: false,
          isTeamUser: true,
          hasFullAccess: false,
          hasAccess: false,
          userName: teamMember?.name || session.user.email,
        }
      }

      const isAdmin = teamMember.role?.includes("admin")
      const isTeamUser = !isAdmin || isEventScoped
      const hasFullAccess = !isEventScoped && (!teamMember.permissions || teamMember.permissions.length === 0)
      const hasCommunicationsPermission = teamMember.permissions?.includes("communications")

      const hasAccess = (!isEventScoped && isAdmin) || hasFullAccess || hasCommunicationsPermission

      return {
        permissions: teamMember?.permissions || [],
        isAdmin: !isEventScoped && isAdmin,
        isTeamUser,
        hasFullAccess,
        hasAccess,
        userName: teamMember?.name || session.user.email,
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
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={`${basePath}${item.href}`}
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
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">You don&apos;t have permission to access Communications.</p>
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
              <MessageSquare className="h-5 w-5 text-purple-400" />
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
              <h2 className="font-semibold text-lg">Communications</h2>
              <p className="text-xs text-muted-foreground">Email, WhatsApp & SMS</p>
            </div>
            <nav className="flex-1 p-2 space-y-1">{renderNavigation()}</nav>
          </div>
          <div className="flex-1 overflow-auto">{children}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-56 border-r bg-muted/30 flex flex-col">
        <Link href={`/events/${eventId}`} className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b">
          <ChevronLeft className="h-4 w-4" />Back to Event
        </Link>
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-lg">Communications</h2>
          <p className="text-xs text-muted-foreground">Email, WhatsApp & SMS</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">{renderNavigation()}</nav>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
