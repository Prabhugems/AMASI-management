"use client"

import { useState } from "react"
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
  ChevronDown,
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
  BookOpen,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

type SidebarItem = {
  title: string
  href: string
  icon: any
  external?: boolean
  /** Which live count, if any, appears beside this item. */
  badge?: "conflicts" | "unconfirmed"
}

type SidebarSection = { id: string; title: string; items: SidebarItem[] }

// Grouped rather than a flat list of seventeen. The items are unchanged — the
// same seventeen destinations — but a wall of seventeen gives no sense of what
// belongs with what, and a coordinator scans it every time instead of reading
// it once. Six groups of two to five is scannable.
//
// The order follows how an event is actually built: describe the content, then
// the people, then reconcile the data, then publish it.
const sidebarSections: SidebarSection[] = [
  {
    id: "overview",
    title: "Overview",
    items: [{ title: "Dashboard", href: "", icon: LayoutDashboard }],
  },
  {
    id: "content",
    title: "Content",
    items: [
      { title: "Venue Overview", href: "/halls", icon: Building2 },
      { title: "Schedule", href: "/schedule", icon: Calendar },
      // The two-level agenda (blocks and talks). Sits alongside Schedule rather
      // than replacing it: Schedule is in live use for AMASICON 2026.
      { title: "Session Builder", href: "/builder", icon: CalendarDays },
      { title: "Sessions", href: "/sessions", icon: Presentation },
      { title: "Tracks", href: "/tracks", icon: Layers },
    ],
  },
  {
    id: "people",
    title: "People",
    items: [
      { title: "Speakers", href: "/speakers", icon: Users, external: true },
      { title: "Coordinators", href: "/coordinators", icon: UserCheck },
      { title: "Confirmations", href: "/confirmations", icon: UserCheck, badge: "unconfirmed" },
    ],
  },
  {
    id: "dataops",
    title: "Data Ops",
    items: [
      { title: "Import", href: "/import", icon: Upload },
      // No badge here yet, deliberately. findHallDoubleBookings treats any two
      // overlapping sessions in one hall as a blocking clash, which reports 174
      // on AMASICON 2026 — and every one is a false positive: HALL 2 runs
      // parallel hands-on stations (Lap TAPP, IPOM Plus, Proctology-Laser…)
      // 09:00-11:00 by design. A badge reading 174 that cannot be cleared
      // teaches people to ignore badges. It returns once parallel stations are
      // modelled as screens under their hall, which is what halls.parent_id
      // exists for.
      { title: "Conflicts", href: "/conflicts", icon: AlertTriangle },
      { title: "Changes", href: "/changes", icon: RefreshCw },
    ],
  },
  {
    id: "output",
    title: "Output",
    items: [
      { title: "Print", href: "/print", icon: Printer },
      { title: "Public View", href: "/public", icon: Globe },
      { title: "Delegate View", href: "/delegate", icon: Calendar },
    ],
  },
  {
    id: "system",
    title: "System",
    items: [
      { title: "Settings", href: "/settings", icon: Settings },
      { title: "Guide", href: "/guide", icon: BookOpen },
    ],
  },
]

/** Flat view, for the mobile sheet and for resolving the active item. */
const sidebarItems: SidebarItem[] = sidebarSections.flatMap((s) => s.items)

export default function ProgramLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
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
        .maybeSingle()
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
        .maybeSingle()
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
      const isAdmin = teamMember.role?.includes("admin") || false
      const isTeamUser = !isAdmin
      const hasFullAccess = !Array.isArray(teamMember.permissions) || teamMember.permissions.length === 0
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

  // Live badge counts. Only two, and only where the meaning is unambiguous —
  // see the counts route. Failures resolve to zero, which hides the badge
  // rather than breaking navigation.
  const { data: counts } = useQuery({
    queryKey: ["program-counts", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/program/counts`)
      if (!res.ok) return { conflicts: 0, unconfirmed: 0 }
      return (await res.json()).data as { conflicts: number; unconfirmed: number }
    },
    staleTime: 60_000,
  })

  const isActive = (href: string) => {
    const fullPath = `${basePath}${href}`
    if (href === "") return pathname === basePath
    return pathname.startsWith(fullPath)
  }

  // Public view, delegate view, and print page should render without the admin sidebar
  const isPublicView = pathname.endsWith("/public") || pathname.includes("/program/public") || pathname.includes("/program/print") || pathname.includes("/program/delegate")
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

  const navLink = (item: SidebarItem, onNavigate?: () => void) => {
    const Icon = item.icon
    const fullHref = item.external ? `/events/${eventId}${item.href}` : `${basePath}${item.href}`
    const active = item.external
      ? pathname.startsWith(`/events/${eventId}${item.href}`)
      : isActive(item.href)
    const count = item.badge ? (counts?.[item.badge] ?? 0) : 0

    return (
      <Link
        key={item.href}
        href={fullHref}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.title}</span>
        {count > 0 && (
          <span
            className={cn(
              "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              active
                ? "bg-primary-foreground/20 text-primary-foreground"
                : item.badge === "conflicts"
                  // Blocking clashes are red because they stop a programme
                  // being published; a chase list is amber because it is
                  // ordinary work in progress.
                  ? "bg-destructive/15 text-destructive"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-500"
            )}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    )
  }

  const renderNavigation = (onNavigate?: () => void) => (
    <>
      {permissionsLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        sidebarSections.map((section) => (
          <div key={section.id} className="pb-1">
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => navLink(item, onNavigate))}
            </div>
          </div>
        ))
      )}
    </>
  )

  if (!permissionsLoading && !userPermissions?.hasAccess) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
        <div className="text-center">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">You don&apos;t have permission to access Program.</p>
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
    <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] -mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
      {/* Desktop: vertical sidebar */}
      <div className="hidden lg:flex w-56 border-r bg-muted/30 flex-col flex-shrink-0">
        <Link href={`/events/${eventId}`} className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b">
          <ChevronLeft className="h-4 w-4" />Back to Event
        </Link>
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-lg">Program</h2>
          <p className="text-xs text-muted-foreground">Schedule & sessions</p>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">{renderNavigation()}</nav>
      </div>
      {/* Mobile: sticky bar + bottom sheet */}
      {(() => {
        const activeItem = sidebarItems.find((item) => {
          return item.external ? pathname.startsWith(`/events/${eventId}${item.href}`) : isActive(item.href)
        }) || sidebarItems[0]
        const ActiveIcon = activeItem.icon
        return (
          <>
            <div className="lg:hidden flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ActiveIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{activeItem.title}</span>
              </div>
              <button onClick={() => setMobileNavOpen(true)} className="p-1">
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
            {mobileNavOpen && (
              <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileNavOpen(false)} />
            )}
            <div className={cn(
              "lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto transition-transform duration-300",
              mobileNavOpen ? "translate-y-0" : "translate-y-full"
            )}>
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto my-3" />
              <div className="px-4 pb-2 font-semibold text-lg border-b">Program</div>
              {/* Same renderer as the desktop sidebar. It previously kept its
                  own copy of the list, which is how the two drift apart — the
                  Session Builder was missing from one of them for a while. */}
              <nav className="space-y-1 p-2">{renderNavigation(() => setMobileNavOpen(false))}</nav>
            </div>
          </>
        )
      })()}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
