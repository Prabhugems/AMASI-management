"use client"

import { useParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/dashboard/stat-card"
import {
  Users,
  GraduationCap,
  Calendar,
  Download,
  Mail,
  ExternalLink,
  Package,
  Ticket,
  Check,
  Circle,
  UserPlus,
  BadgeCheck,
  Receipt,
  Award,
  LogIn,
  Edit,
  Trash2,
  Send,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

export default function EventDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()

  type Event = {
    id: string
    name: string
    short_name: string | null
    slug: string | null
    status: string
    event_type: string
    city: string | null
    state: string | null
    start_date: string | null
    end_date: string | null
    venue_name: string | null
    edition: number | null
    scientific_chairman: string | null
    organizing_chairman: string | null
    registration_open: boolean
    razorpay_key_id: string | null
    bank_account_number: string | null
    payment_methods_enabled: Record<string, boolean> | null
  }

  // Fetch event details
  const { data: event, isLoading } = useQuery({
    queryKey: ["event-details", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name, slug, status, event_type, city, state, start_date, end_date, venue_name, edition, scientific_chairman, organizing_chairman, registration_open, razorpay_key_id, bank_account_number, payment_methods_enabled")
        .eq("id", eventId)
        .single()

      return data as Event | null
    },
    enabled: !!eventId,
  })

  // Fetch faculty stats from both faculty_assignments AND speaker registrations
  const { data: facultyStats, isLoading: isLoadingFaculty } = useQuery({
    queryKey: ["event-faculty-stats", eventId],
    queryFn: async () => {
      // Check faculty_assignments table
      const { data: assignments } = await supabase
        .from("faculty_assignments")
        .select("id, status")
        .eq("event_id", eventId)

      // Also check registrations with speaker/faculty designations
      const { data: speakerRegs } = await supabase
        .from("registrations")
        .select("id, status")
        .eq("event_id", eventId)
        .or("attendee_designation.ilike.%speaker%,attendee_designation.ilike.%faculty%,attendee_designation.ilike.%chairperson%,attendee_designation.ilike.%panelist%,attendee_designation.ilike.%moderator%")

      const assignmentsList = Array.isArray(assignments) ? assignments : []
      const speakersList = Array.isArray(speakerRegs) ? speakerRegs : []

      // Combine both sources (avoid double counting if someone is in both)
      const totalFromAssignments = assignmentsList.length
      const confirmedFromAssignments = assignmentsList.filter((f: any) => f.status === "confirmed").length

      const totalFromSpeakers = speakersList.length
      const confirmedFromSpeakers = speakersList.filter((r: any) => r.status === "confirmed").length

      // If faculty_assignments has data, use it; otherwise use speaker registrations
      if (totalFromAssignments > 0) {
        return { total: totalFromAssignments, confirmed: confirmedFromAssignments }
      }

      return { total: totalFromSpeakers, confirmed: confirmedFromSpeakers }
    },
    enabled: !!eventId,
  })

  // Fetch registration/attendee stats
  const { data: attendeeStats, isLoading: isLoadingAttendees } = useQuery({
    queryKey: ["event-attendee-stats", eventId],
    queryFn: async () => {
      const { data: allRegistrations, error } = await supabase
        .from("registrations")
        .select("id, checked_in")
        .eq("event_id", eventId)

      if (error || !allRegistrations || !Array.isArray(allRegistrations)) {
        return { total: 0, checkedIn: 0 }
      }

      return {
        total: allRegistrations.length,
        checkedIn: allRegistrations.filter((r: any) => r.checked_in).length,
      }
    },
    enabled: !!eventId,
  })

  // Fetch sessions count for this event
  const { data: sessionsStats, isLoading: isLoadingSessions } = useQuery({
    queryKey: ["event-sessions-stats", eventId],
    queryFn: async () => {
      const { count } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
      return { total: count || 0 }
    },
    enabled: !!eventId,
  })

  // Fetch ticket types and addons count (includes active/on-sale tickets)
  const { data: ticketsAndAddonsStats, isLoading: isLoadingTicketsAddons } = useQuery({
    queryKey: ["event-tickets-addons-stats", eventId],
    queryFn: async () => {
      const [ticketsResult, activeTicketsResult, addonsResult] = await Promise.all([
        supabase
          .from("ticket_types")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId),
        supabase
          .from("ticket_types")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("status", "active"),
        supabase
          .from("addons")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
      ])
      return {
        tickets: ticketsResult.count || 0,
        activeTickets: activeTicketsResult.count || 0,
        addons: addonsResult.count || 0
      }
    },
    enabled: !!eventId,
  })

  // Fetch message templates count for setup progress (uses message_templates table)
  const { data: messageTemplatesCount } = useQuery({
    queryKey: ["event-message-templates-count", eventId],
    queryFn: async () => {
      const { count } = await supabase
        .from("message_templates")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
      return count || 0
    },
    enabled: !!eventId,
  })

  // Fetch recent activity logs
  type ActivityLog = {
    id: string
    action: string
    entity_type: string
    entity_name: string | null
    description: string | null
    user_name: string | null
    created_at: string
    metadata: Record<string, any> | null
  }

  const { data: recentActivity, isLoading: isLoadingActivity } = useQuery({
    queryKey: ["event-recent-activity", eventId],
    queryFn: async () => {
      const response = await fetch(`/api/activity-logs?event_id=${eventId}&limit=10`)
      if (!response.ok) return []
      const result = await response.json()
      return (result.data || []) as ActivityLog[]
    },
    enabled: !!eventId,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Helper to get activity icon
  const getActivityIcon = (action: string, entityType: string) => {
    if (action === "check_in" || action === "checkin") return <LogIn className="h-4 w-4 text-green-500" />
    if (action === "create" && entityType === "registration") return <UserPlus className="h-4 w-4 text-blue-500" />
    if (action === "generate_badge" || entityType === "badge") return <BadgeCheck className="h-4 w-4 text-purple-500" />
    if (action === "payment" || entityType === "payment") return <Receipt className="h-4 w-4 text-emerald-500" />
    if (action === "generate_certificate" || entityType === "certificate") return <Award className="h-4 w-4 text-amber-500" />
    if (action === "send_email" || entityType === "email") return <Send className="h-4 w-4 text-sky-500" />
    if (action === "update") return <Edit className="h-4 w-4 text-orange-500" />
    if (action === "delete") return <Trash2 className="h-4 w-4 text-red-500" />
    return <Circle className="h-4 w-4 text-gray-400" />
  }

  // Calculate setup progress
  const setupSteps = event ? [
    {
      id: 1,
      label: "Basic Info",
      completed: !!(event.name && event.start_date && event.city),
      link: `/events/${eventId}/settings`,
    },
    {
      id: 2,
      label: "Location",
      completed: !!(event.venue_name && event.city),
      link: `/events/${eventId}/settings`,
    },
    {
      id: 3,
      label: "Payment",
      completed: !!(event.razorpay_key_id || event.bank_account_number),
      link: `/events/${eventId}/settings`,
    },
    {
      id: 4,
      label: "Tickets",
      completed: (ticketsAndAddonsStats?.activeTickets || 0) > 0, // Only complete when tickets are active (on sale)
      link: `/events/${eventId}/tickets`,
    },
    {
      id: 5,
      label: "Emails",
      completed: (messageTemplatesCount || 0) > 0,
      link: `/events/${eventId}/communications/templates`,
    },
    {
      id: 6,
      label: "Go Live",
      completed: event.registration_open === true,
      link: `/events/${eventId}/settings`,
    },
  ] : []

  const completedSteps = setupSteps.filter(s => s.completed).length
  const setupProgress = setupSteps.length > 0 ? Math.round((completedSteps / setupSteps.length) * 100) : 0

  // Combined loading state for all queries
  const isLoadingAny = isLoading || isLoadingFaculty || isLoadingAttendees || isLoadingSessions || isLoadingTicketsAddons

  if (isLoadingAny) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading event...</p>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Event Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{event.name}</h1>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-medium border-0 capitalize",
                event.status === "ongoing"
                  ? "bg-success/20 text-success"
                  : event.status === "planning"
                  ? "bg-warning/20 text-warning"
                  : event.status === "completed"
                  ? "bg-info/20 text-info"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {event.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {event.city && `${event.city}, `}
            {event.start_date &&
              new Date(event.start_date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            {event.end_date &&
              event.start_date !== event.end_date &&
              ` - ${new Date(event.end_date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {event.slug && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/register/${event.slug}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">View Page</span>
            </Button>
          )}
          <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/events/${eventId}/invitation-pdf`, '_blank')}
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Invitation</span>
            </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button variant="outline" size="sm">
            <Mail className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Send Updates</span>
          </Button>
        </div>
      </div>

      {/* Event Setup Progress */}
      {setupProgress < 100 && (
        <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Event Setup Progress</h3>
            <span className="text-sm text-muted-foreground">{completedSteps}/{setupSteps.length} completed</span>
          </div>
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {setupSteps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-shrink-0">
                <button
                  onClick={() => router.push(step.link)}
                  className="flex flex-col items-center group"
                >
                  <div
                    className={cn(
                      "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all",
                      step.completed
                        ? "bg-emerald-500 text-white"
                        : "bg-red-100 text-red-600 group-hover:bg-red-200"
                    )}
                  >
                    {step.completed ? (
                      <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className={cn(
                    "text-[10px] sm:text-xs mt-1.5 font-medium whitespace-nowrap",
                    step.completed ? "text-emerald-600" : "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                  <span className={cn(
                    "text-[10px] hidden sm:block",
                    step.completed ? "text-emerald-500" : "text-red-500"
                  )}>
                    {step.completed ? "Completed" : "Pending"}
                  </span>
                </button>
                {index < setupSteps.length - 1 && (
                  <div className={cn(
                    "w-6 sm:w-16 h-0.5 mx-1 sm:mx-2 flex-shrink-0",
                    step.completed ? "bg-emerald-500" : "bg-gray-200"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Complete Badge */}
      {setupProgress === 100 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-emerald-700">Event Setup Complete!</p>
            <p className="text-sm text-emerald-600">Your event is ready to accept registrations.</p>
          </div>
        </div>
      )}

      {/* Animated Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          icon={GraduationCap}
          value={facultyStats?.total || 0}
          label="Faculty"
          subtext={`${facultyStats?.confirmed || 0}/${facultyStats?.total || 0} confirmed`}
          trend={null}
          color="rose"
          delay={0}
        />
        <StatCard
          icon={Users}
          value={attendeeStats?.total || 0}
          label="Attendees"
          subtext={`${attendeeStats?.checkedIn || 0} checked in`}
          trend={attendeeStats?.total ? Math.round((attendeeStats.checkedIn || 0) / attendeeStats.total * 100) : null}
          color="teal"
          delay={100}
        />
        <StatCard
          icon={Calendar}
          value={sessionsStats?.total || 0}
          label="Sessions"
          subtext="Scheduled"
          trend={null}
          color="amber"
          delay={200}
        />
        <StatCard
          icon={Ticket}
          value={ticketsAndAddonsStats?.tickets || 0}
          label="Ticket Types"
          subtext={
            (ticketsAndAddonsStats?.activeTickets || 0) > 0
              ? `${ticketsAndAddonsStats?.activeTickets} active`
              : (ticketsAndAddonsStats?.tickets || 0) > 0
                ? "All paused"
                : "None created"
          }
          trend={null}
          color="indigo"
          delay={300}
        />
        <StatCard
          icon={Package}
          value={ticketsAndAddonsStats?.addons || 0}
          label="Addons"
          subtext="Available"
          trend={null}
          color="violet"
          delay={400}
        />
      </div>

      {/* Quick Actions */}
      <div className="paper-card card-animated">
        <div className="p-5 border-b border-border">
          <h5 className="text-base font-semibold text-foreground mb-1">
            Quick Actions
          </h5>
          <p className="text-sm text-muted-foreground">
            Common tasks for this event
          </p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button
              onClick={() => router.push(`/events/${eventId}/speakers`)}
              className="flex flex-col items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all duration-300 group"
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Invite Faculty
              </span>
            </button>
            <button
              onClick={() => router.push(`/events/${eventId}/registrations/import`)}
              className="flex flex-col items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all duration-300 group"
            >
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-all">
                <Users className="h-5 w-5 text-success" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Import Attendees
              </span>
            </button>
            <button
              onClick={() => router.push(`/events/${eventId}/program`)}
              className="flex flex-col items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all duration-300 group"
            >
              <div className="h-12 w-12 rounded-full bg-info/10 flex items-center justify-center group-hover:bg-info/20 transition-all">
                <Calendar className="h-5 w-5 text-info" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Build Program
              </span>
            </button>
            <button
              onClick={() => router.push(`/events/${eventId}/registrations/communications`)}
              className="flex flex-col items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all duration-300 group"
            >
              <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center group-hover:bg-warning/20 transition-all">
                <Mail className="h-5 w-5 text-warning" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Send Invites
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Public Links */}
      <div className="paper-card card-animated">
        <div className="p-5 border-b border-border">
          <h5 className="text-base font-semibold text-foreground mb-1">
            Public Links
          </h5>
          <p className="text-sm text-muted-foreground">
            Share these links with delegates and attendees
          </p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a
              href="/my"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border border-indigo-200/50 transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/30 transition-all">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-foreground block">Delegate Portal</span>
                <span className="text-xs text-muted-foreground">Badge, certificate & status</span>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
            {event?.slug && (
              <a
                href={`/register/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 hover:from-green-500/20 hover:to-emerald-500/20 border border-green-200/50 transition-all duration-300 group"
              >
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-all">
                  <Ticket className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-foreground block">Registration Page</span>
                  <span className="text-xs text-muted-foreground">Public registration form</span>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            )}
            <a
              href={`/p/${eventId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 border border-blue-200/50 transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-all">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-foreground block">Program Schedule</span>
                <span className="text-xs text-muted-foreground">Public session schedule</span>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          </div>
        </div>
      </div>

      {/* Event Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Info */}
        <div className="paper-card card-animated">
          <div className="p-5 border-b border-border">
            <h5 className="text-base font-semibold text-foreground mb-1">
              Event Details
            </h5>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">{event.event_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Edition</span>
              <span className="font-medium">{event.edition || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Venue</span>
              <span className="font-medium">{event.venue_name || "TBD"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span className="font-medium">
                {event.city ? `${event.city}, ${event.state || ""}` : "TBD"}
              </span>
            </div>
            {event.scientific_chairman && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scientific Chairman</span>
                <span className="font-medium">{event.scientific_chairman}</span>
              </div>
            )}
            {event.organizing_chairman && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Organizing Chairman</span>
                <span className="font-medium">{event.organizing_chairman}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="paper-card card-animated">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h5 className="text-base font-semibold text-foreground">
              Recent Activity
            </h5>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => router.push(`/events/${eventId}/activity`)}
            >
              View All
            </Button>
          </div>
          <div className="divide-y divide-border">
            {isLoadingActivity ? (
              <div className="p-5 text-center text-muted-foreground">
                <p className="text-sm">Loading activity...</p>
              </div>
            ) : !recentActivity || recentActivity.length === 0 ? (
              <div className="p-5">
                <div className="flex items-center justify-center h-24 text-muted-foreground">
                  <div className="text-center">
                    <Circle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs mt-1">Actions like registrations and check-ins will appear here</p>
                  </div>
                </div>
              </div>
            ) : (
              recentActivity.slice(0, 8).map((activity) => (
                <div key={activity.id} className="px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getActivityIcon(activity.action, activity.entity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {activity.description || `${activity.action} ${activity.entity_type}`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {activity.user_name && (
                          <span className="text-xs text-muted-foreground">
                            by {activity.user_name}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
