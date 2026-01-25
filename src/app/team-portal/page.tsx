"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  Users,
  Loader2,
  Calendar,
  MapPin,
  ChevronRight,
  LogOut,
  Plane,
  Hotel,
  Car,
  Train,
  UserCheck,
  CalendarDays,
  CheckCircle,
  Award,
  FileText,
  ClipboardList,
  Shield,
  Lock,
  Mail,
  Phone,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"

type Event = {
  id: string
  name: string
  short_name: string
  start_date: string
  end_date: string
  city: string
  venue_name: string
  status: string
}

type TeamMember = {
  id: string
  email: string
  name: string
  phone: string
  role: string
  permissions: string[]
  event_ids: string[]
  is_active: boolean
}

// Define all available modules with their details
const ALL_MODULES = {
  // Travel & Logistics
  flights: { label: "Flights", icon: Plane, color: "bg-blue-500", category: "travel", href: "/travel/flights" },
  hotels: { label: "Hotels", icon: Hotel, color: "bg-amber-500", category: "travel", href: "/accommodation" },
  transfers: { label: "Transfers", icon: Car, color: "bg-green-500", category: "travel", href: "/travel/transfers" },
  trains: { label: "Trains", icon: Train, color: "bg-purple-500", category: "travel", href: "/travel/trains" },
  // Event Management
  speakers: { label: "Speakers", icon: UserCheck, color: "bg-cyan-500", category: "event", href: "/speakers" },
  program: { label: "Program", icon: CalendarDays, color: "bg-indigo-500", category: "event", href: "/program" },
  checkin: { label: "Check-in", icon: CheckCircle, color: "bg-emerald-500", category: "event", href: "/checkin" },
  badges: { label: "Badges", icon: Award, color: "bg-pink-500", category: "event", href: "/badges" },
  certificates: { label: "Certificates", icon: FileText, color: "bg-orange-500", category: "event", href: "/certificates" },
  registrations: { label: "Registrations", icon: ClipboardList, color: "bg-teal-500", category: "event", href: "/registrations" },
}

export default function TeamPortalPage() {
  const router = useRouter()
  const supabase = createClient()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null)

  // Check authentication and get team member data
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        router.push("/team-login")
        return
      }

      // Get team member details
      const { data: member } = await supabase
        .from("team_members")
        .select("*")
        .eq("email", session.user.email.toLowerCase())
        .eq("is_active", true)
        .single()

      if (!member) {
        router.push("/team-login")
        return
      }

      setTeamMember(member as TeamMember)
      setCheckingAuth(false)
    }
    checkAuth()
  }, [supabase, router])

  // Fetch events based on user's access
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["team-portal-events", teamMember?.event_ids],
    queryFn: async () => {
      if (!teamMember) return []

      const hasAllEventsAccess = !teamMember.event_ids || teamMember.event_ids.length === 0 || teamMember.role.includes("admin")

      let query = supabase
        .from("events")
        .select("id, name, short_name, start_date, end_date, city, venue_name, status")
        .order("start_date", { ascending: false })

      if (!hasAllEventsAccess && teamMember.event_ids.length > 0) {
        query = query.in("id", teamMember.event_ids)
      }

      const { data } = await query
      return (data || []) as Event[]
    },
    enabled: !!teamMember,
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/team-login")
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ""
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  // Get user's accessible modules
  const getAccessibleModules = () => {
    if (!teamMember) return []

    // Admin or empty permissions = full access
    const hasFullAccess = teamMember.role.includes("admin") || !teamMember.permissions || teamMember.permissions.length === 0

    if (hasFullAccess) {
      return Object.entries(ALL_MODULES).map(([key, value]) => ({ key, ...value }))
    }

    return teamMember.permissions
      .filter(perm => ALL_MODULES[perm as keyof typeof ALL_MODULES])
      .map(perm => ({ key: perm, ...ALL_MODULES[perm as keyof typeof ALL_MODULES] }))
  }

  const accessibleModules = getAccessibleModules()
  const travelModules = accessibleModules.filter(m => m.category === "travel")
  const eventModules = accessibleModules.filter(m => m.category === "event")

  // Check if user has any travel permissions
  const hasTravelAccess = travelModules.length > 0
  const hasEventAccess = eventModules.length > 0

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Separate active and past events
  const now = new Date()
  const activeEvents = events?.filter(e => new Date(e.end_date) >= now || e.status === "active") || []
  const pastEvents = events?.filter(e => new Date(e.end_date) < now && e.status !== "active") || []

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Team Portal</h1>
                <p className="text-slate-400 text-sm">AMASI Event Management</p>
              </div>
            </div>
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
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* User Profile Card */}
        <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {teamMember?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-semibold">{teamMember?.name}</h2>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {teamMember?.email}
                  </span>
                  {teamMember?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {teamMember.phone}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="capitalize">
                    <Shield className="h-3 w-3 mr-1" />
                    {teamMember?.role}
                  </Badge>
                  {(!teamMember?.permissions || teamMember.permissions.length === 0) && !teamMember?.role.includes("admin") && (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      Full Access
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Permissions Section */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Your Permissions</h3>

            {teamMember?.role.includes("admin") ? (
              <div className="flex items-center gap-2 text-green-600">
                <Shield className="h-5 w-5" />
                <span className="font-medium">Administrator - Full access to all modules</span>
              </div>
            ) : !teamMember?.permissions || teamMember.permissions.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Full access to all modules</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {accessibleModules.map((module) => {
                  const Icon = module.icon
                  return (
                    <div
                      key={module.key}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                    >
                      <div className={cn("h-6 w-6 rounded flex items-center justify-center text-white", module.color)}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <span className="text-sm">{module.label}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Restricted modules */}
            {teamMember?.permissions && teamMember.permissions.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Restricted Modules
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ALL_MODULES)
                    .filter(([key]) => !teamMember.permissions.includes(key))
                    .map(([key, module]) => (
                      <Badge key={key} variant="outline" className="text-muted-foreground">
                        {module.label}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Event Access Section */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Event Access</h3>
            {!teamMember?.event_ids || teamMember.event_ids.length === 0 || teamMember.role.includes("admin") ? (
              <div className="flex items-center gap-2 text-green-600">
                <Calendar className="h-5 w-5" />
                <span className="font-medium">Access to all events</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <Calendar className="h-5 w-5" />
                <span className="font-medium">Access to {teamMember.event_ids.length} specific event(s)</span>
              </div>
            )}
          </div>
        </div>

        {/* Events Section */}
        <h2 className="text-lg font-semibold mb-4">Select an Event</h2>

        {eventsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Active Events */}
            {activeEvents.length > 0 && (
              <div className="mb-8">
                <p className="text-sm text-muted-foreground mb-3">Active Events</p>
                <div className="space-y-3">
                  {activeEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      formatDate={formatDate}
                      hasTravelAccess={hasTravelAccess}
                      hasEventAccess={hasEventAccess}
                      travelModules={travelModules}
                      eventModules={eventModules}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Past Events */}
            {pastEvents.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">Past Events</p>
                <div className="space-y-3">
                  {pastEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      formatDate={formatDate}
                      isPast
                      hasTravelAccess={hasTravelAccess}
                      hasEventAccess={hasEventAccess}
                      travelModules={travelModules}
                      eventModules={eventModules}
                    />
                  ))}
                </div>
              </div>
            )}

            {events?.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No events found</p>
                <p className="text-xs text-muted-foreground">
                  Contact admin if you need access to specific events.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

// Event Card Component
function EventCard({
  event,
  formatDate,
  isPast = false,
  hasTravelAccess,
  hasEventAccess,
  travelModules,
  eventModules,
}: {
  event: Event
  formatDate: (date: string) => string
  isPast?: boolean
  hasTravelAccess: boolean
  hasEventAccess: boolean
  travelModules: any[]
  eventModules: any[]
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      "bg-white rounded-xl border shadow-sm overflow-hidden transition-all",
      isPast && "opacity-75"
    )}>
      {/* Event Header - Clickable */}
      <div
        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={cn(
          "h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0",
          isPast ? "bg-slate-100" : "bg-primary/10"
        )}>
          <Calendar className={cn("h-7 w-7", isPast ? "text-slate-400" : "text-primary")} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={cn("font-semibold text-lg truncate", isPast && "text-muted-foreground")}>
            {event.short_name || event.name}
          </h3>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(event.start_date)}</span>
            </div>
            {event.city && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{event.city}</span>
              </div>
            )}
          </div>
        </div>
        <ChevronRight className={cn(
          "h-5 w-5 text-muted-foreground transition-transform",
          expanded && "rotate-90"
        )} />
      </div>

      {/* Expanded Modules Section */}
      {expanded && (
        <div className="px-4 pb-4 border-t bg-muted/20">
          <div className="pt-4 space-y-4">
            {/* Travel & Logistics Modules */}
            {hasTravelAccess && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Plane className="h-3 w-3" /> Travel & Logistics
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {travelModules.map((module) => {
                    const Icon = module.icon
                    const href = module.key === "hotels"
                      ? `/events/${event.id}/accommodation`
                      : `/events/${event.id}/travel${module.href.replace('/travel', '')}`
                    return (
                      <Link
                        key={module.key}
                        href={href}
                        className="flex items-center gap-2 p-3 rounded-lg bg-white border hover:border-primary hover:shadow-sm transition-all"
                      >
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white", module.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">{module.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Event Management Modules */}
            {hasEventAccess && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Event Management
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {eventModules.map((module) => {
                    const Icon = module.icon
                    return (
                      <Link
                        key={module.key}
                        href={`/events/${event.id}${module.href}`}
                        className="flex items-center gap-2 p-3 rounded-lg bg-white border hover:border-primary hover:shadow-sm transition-all"
                      >
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white", module.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">{module.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {!hasTravelAccess && !hasEventAccess && (
              <div className="text-center py-4 text-muted-foreground">
                <Lock className="h-8 w-8 mx-auto mb-2" />
                <p>No module permissions assigned.</p>
                <p className="text-xs">Contact admin to get access.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
