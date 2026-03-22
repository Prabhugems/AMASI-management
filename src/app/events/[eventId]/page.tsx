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
  Bell,
  BarChart3,
  Share2,
  Settings,
  FileText,
  Palette,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { formatDistanceToNow, differenceInDays, isToday, isBefore } from "date-fns"
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
        .maybeSingle()

      return data as Event | null
    },
    enabled: !!eventId,
  })

  // Fetch faculty/speaker stats from registrations (same source as speakers list page)
  const { data: facultyStats, isLoading: isLoadingFaculty } = useQuery({
    queryKey: ["event-faculty-stats", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("registrations")
        .select("id, attendee_designation, status, ticket_type:ticket_types(name)")
        .eq("event_id", eventId)

      const allRegs = Array.isArray(data) ? data : []

      // Filter to speaker/faculty registrations - same logic as speakers list page
      const speakers = allRegs.filter((reg: any) => {
        const ticketName = (reg.ticket_type?.name || "").toLowerCase()
        const designation = (reg.attendee_designation || "").toLowerCase()
        return (
          ticketName.includes("speaker") ||
          ticketName.includes("faculty") ||
          designation === "speaker" ||
          designation === "chairperson" ||
          designation === "moderator" ||
          designation === "panelist" ||
          designation === "faculty"
        )
      })

      const total = speakers.length
      const confirmed = speakers.filter((r: any) => r.status === "confirmed").length

      return { total, confirmed }
    },
    enabled: !!eventId,
  })

  // Fetch registration/attendee stats
  const { data: attendeeStats, isLoading: isLoadingAttendees } = useQuery({
    queryKey: ["event-attendee-stats", eventId],
    queryFn: async () => {
      const { data: allRegistrations, error } = await supabase
        .from("registrations")
        .select("id, checked_in, attendee_designation")
        .eq("event_id", eventId)

      if (error || !allRegistrations || !Array.isArray(allRegistrations)) {
        return { total: 0, checkedIn: 0 }
      }

      // Exclude faculty/speaker registrations - those are counted in the Faculty card
      const facultyDesignations = ["speaker", "faculty", "chairperson", "panelist", "moderator"]
      const attendeesOnly = allRegistrations.filter((r: any) => {
        const designation = (r.attendee_designation || "").toLowerCase()
        return !facultyDesignations.some(d => designation.includes(d))
      })

      return {
        total: attendeesOnly.length,
        checkedIn: attendeesOnly.filter((r: any) => r.checked_in).length,
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

  // Fetch 7-day registration trend for sparkline
  const { data: registrationTrend } = useQuery({
    queryKey: ["event-registration-trend", eventId],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from("registrations")
        .select("created_at")
        .eq("event_id", eventId)
        .gte("created_at", sevenDaysAgo)

      const rows = (data || []) as { created_at: string }[]
      const now = new Date()
      const counts = Array(7).fill(0)
      for (const row of rows) {
        const d = new Date(row.created_at)
        const daysAgo = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
        if (daysAgo >= 0 && daysAgo < 7) {
          counts[6 - daysAgo]++
        }
      }
      return counts
    },
    enabled: !!eventId,
  })

  // Fetch module settings for conditional UI
  const { data: moduleSettings } = useQuery({
    queryKey: ["event-module-settings", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_settings")
        .select("enable_speakers")
        .eq("event_id", eventId)
        .maybeSingle()
      return {
        enable_speakers: (data as any)?.enable_speakers ?? true,
      }
    },
    enabled: !!eventId,
  })

  // Fetch badge templates count for context-aware actions
  const { data: badgeTemplatesCount } = useQuery({
    queryKey: ["event-badge-templates-count", eventId],
    queryFn: async () => {
      const { count } = await supabase
        .from("badge_templates")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
      return count || 0
    },
    enabled: !!eventId,
  })

  // Fetch forms count for context-aware actions
  const { data: formsCount } = useQuery({
    queryKey: ["event-forms-count", eventId],
    queryFn: async () => {
      const { count } = await supabase
        .from("forms")
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

  // Calculate setup progress (moved before context actions so setupProgress is available)
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
      completed: (ticketsAndAddonsStats?.activeTickets || 0) > 0,
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

  // Context-aware quick actions
  type ContextAction = {
    icon: LucideIcon
    label: string
    description: string
    href: string
    iconColor: string
    iconBg: string
    priority: number
  }

  const getContextActions = (): ContextAction[] => {
    if (!event) return []

    const actions: ContextAction[] = []
    const now = new Date()
    const startDate = event.start_date ? new Date(event.start_date) : null
    const daysUntilEvent = startDate ? differenceInDays(startDate, now) : null
    const eventIsToday = startDate ? isToday(startDate) : false
    const eventIsPast = startDate ? isBefore(startDate, now) && !eventIsToday : false
    const totalRegistrations = (attendeeStats?.total || 0) + (facultyStats?.total || 0)
    const hasTickets = (ticketsAndAddonsStats?.tickets || 0) > 0
    const hasActiveTickets = (ticketsAndAddonsStats?.activeTickets || 0) > 0
    const hasBadgeTemplate = (badgeTemplatesCount || 0) > 0
    const hasForms = (formsCount || 0) > 0
    const hasEmailTemplates = (messageTemplatesCount || 0) > 0

    // Event is today - show day-of actions
    if (eventIsToday) {
      actions.push({
        icon: LogIn,
        label: "Start Check-in",
        description: "Open the check-in station",
        href: `/events/${eventId}/checkin`,
        iconColor: "text-emerald-600",
        iconBg: "bg-emerald-500/10 group-hover:bg-emerald-500/20",
        priority: 100,
      })
      actions.push({
        icon: BarChart3,
        label: "View Live Stats",
        description: "Real-time event analytics",
        href: `/events/${eventId}/analytics`,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-500/10 group-hover:bg-blue-500/20",
        priority: 95,
      })
      if (hasBadgeTemplate) {
        actions.push({
          icon: BadgeCheck,
          label: "Print Badges",
          description: "Print attendee badges",
          href: `/events/${eventId}/badges`,
          iconColor: "text-purple-600",
          iconBg: "bg-purple-500/10 group-hover:bg-purple-500/20",
          priority: 90,
        })
      }
      actions.push({
        icon: Users,
        label: "View Registrations",
        description: "See all registered attendees",
        href: `/events/${eventId}/registrations`,
        iconColor: "text-teal-600",
        iconBg: "bg-teal-500/10 group-hover:bg-teal-500/20",
        priority: 85,
      })
    }
    // Event starting soon (within 7 days)
    else if (daysUntilEvent !== null && daysUntilEvent > 0 && daysUntilEvent <= 7) {
      actions.push({
        icon: Bell,
        label: "Send Final Reminder",
        description: "Notify all registered attendees",
        href: `/events/${eventId}/communications/compose`,
        iconColor: "text-orange-600",
        iconBg: "bg-orange-500/10 group-hover:bg-orange-500/20",
        priority: 100,
      })
      actions.push({
        icon: Download,
        label: "Download Check-in List",
        description: "Export registrations for check-in",
        href: `/events/${eventId}/registrations/export`,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-500/10 group-hover:bg-blue-500/20",
        priority: 95,
      })
      if (hasBadgeTemplate) {
        actions.push({
          icon: BadgeCheck,
          label: "Print Badges",
          description: "Generate and print badges",
          href: `/events/${eventId}/badges`,
          iconColor: "text-purple-600",
          iconBg: "bg-purple-500/10 group-hover:bg-purple-500/20",
          priority: 90,
        })
      }
      actions.push({
        icon: Calendar,
        label: "Review Program",
        description: "Finalize the event schedule",
        href: `/events/${eventId}/program`,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-500/10 group-hover:bg-amber-500/20",
        priority: 85,
      })
    }
    // Event is past
    else if (eventIsPast) {
      actions.push({
        icon: Award,
        label: "Issue Certificates",
        description: "Generate attendance certificates",
        href: `/events/${eventId}/certificates`,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-500/10 group-hover:bg-amber-500/20",
        priority: 100,
      })
      actions.push({
        icon: BarChart3,
        label: "View Analytics",
        description: "Post-event statistics",
        href: `/events/${eventId}/analytics`,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-500/10 group-hover:bg-blue-500/20",
        priority: 95,
      })
      actions.push({
        icon: Download,
        label: "Export Data",
        description: "Download all event data",
        href: `/events/${eventId}/registrations/export`,
        iconColor: "text-teal-600",
        iconBg: "bg-teal-500/10 group-hover:bg-teal-500/20",
        priority: 90,
      })
      actions.push({
        icon: Mail,
        label: "Send Thank You",
        description: "Thank attendees and speakers",
        href: `/events/${eventId}/communications/compose`,
        iconColor: "text-indigo-600",
        iconBg: "bg-indigo-500/10 group-hover:bg-indigo-500/20",
        priority: 85,
      })
    }
    // Default: Setup phase or event far away
    else {
      // Setup-related actions based on what's incomplete
      if (!hasTickets) {
        actions.push({
          icon: Ticket,
          label: "Create Tickets",
          description: "Set up ticket types and pricing",
          href: `/events/${eventId}/tickets`,
          iconColor: "text-indigo-600",
          iconBg: "bg-indigo-500/10 group-hover:bg-indigo-500/20",
          priority: 100,
        })
      }

      if (!hasBadgeTemplate) {
        actions.push({
          icon: Palette,
          label: "Design Badge",
          description: "Create a badge template",
          href: `/events/${eventId}/badges`,
          iconColor: "text-purple-600",
          iconBg: "bg-purple-500/10 group-hover:bg-purple-500/20",
          priority: 95,
        })
      }

      if (!hasForms) {
        actions.push({
          icon: FileText,
          label: "Configure Form",
          description: "Build your registration form",
          href: `/events/${eventId}/forms`,
          iconColor: "text-cyan-600",
          iconBg: "bg-cyan-500/10 group-hover:bg-cyan-500/20",
          priority: 90,
        })
      }

      if (!hasEmailTemplates) {
        actions.push({
          icon: Mail,
          label: "Set Up Emails",
          description: "Create email templates",
          href: `/events/${eventId}/communications/templates`,
          iconColor: "text-rose-600",
          iconBg: "bg-rose-500/10 group-hover:bg-rose-500/20",
          priority: 88,
        })
      }

      if (setupProgress < 100) {
        actions.push({
          icon: Settings,
          label: "Complete Setup",
          description: "Finish configuring your event",
          href: `/events/${eventId}/settings`,
          iconColor: "text-gray-600",
          iconBg: "bg-gray-500/10 group-hover:bg-gray-500/20",
          priority: 85,
        })
      }

      // Registration & promotion actions
      if (totalRegistrations < 10 && hasActiveTickets && event.slug) {
        actions.push({
          icon: Share2,
          label: "Share Registration Link",
          description: "Copy and share the registration page",
          href: `/register/${event.slug}`,
          iconColor: "text-green-600",
          iconBg: "bg-green-500/10 group-hover:bg-green-500/20",
          priority: 92,
        })
      }

      if (hasActiveTickets) {
        actions.push({
          icon: Mail,
          label: "Send Invitations",
          description: "Invite attendees to register",
          href: `/events/${eventId}/communications/compose`,
          iconColor: "text-blue-600",
          iconBg: "bg-blue-500/10 group-hover:bg-blue-500/20",
          priority: 80,
        })
      }

      if (moduleSettings?.enable_speakers !== false) {
        actions.push({
          icon: GraduationCap,
          label: "Invite Faculty",
          description: "Add speakers and faculty",
          href: `/events/${eventId}/speakers`,
          iconColor: "text-rose-600",
          iconBg: "bg-rose-500/10 group-hover:bg-rose-500/20",
          priority: 78,
        })
      }

      actions.push({
        icon: Calendar,
        label: "Build Program",
        description: "Create the event schedule",
        href: `/events/${eventId}/program`,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-500/10 group-hover:bg-amber-500/20",
        priority: 75,
      })
    }

    // Sort by priority and return top 4
    return actions.sort((a, b) => b.priority - a.priority).slice(0, 4)
  }

  const contextActions = getContextActions()

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
          <Button variant="outline" size="sm" onClick={() => router.push(`/events/${eventId}/registrations/export`)}>
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/events/${eventId}/communications/compose`)}>
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
          <div className="flex items-center justify-between overflow-x-auto pb-2 animate-stagger">
            {setupSteps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-shrink-0">
                <button
                  onClick={() => router.push(step.link)}
                  className="flex flex-col items-center group transition-all duration-300 hover:-translate-y-1"
                >
                  <div
                    className={cn(
                      "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all duration-300",
                      step.completed
                        ? "bg-emerald-500 text-white shadow-emerald-500/25 shadow-md"
                        : "bg-red-100 text-red-600 group-hover:bg-red-200 group-hover:shadow-md"
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
                    "w-6 sm:w-16 h-0.5 mx-1 sm:mx-2 flex-shrink-0 transition-colors duration-500",
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 animate-stagger">
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
          sparklineData={registrationTrend}
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

      {/* Context-Aware Priority Actions */}
      {contextActions.length > 0 && (
        <div className="paper-card card-animated">
          <div className="p-5 border-b border-border">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-amber-500" />
              <h5 className="text-base font-semibold text-foreground">
                Suggested Actions
              </h5>
            </div>
            <p className="text-sm text-muted-foreground">
              {event.start_date && isToday(new Date(event.start_date))
                ? "Your event is happening now"
                : event.start_date && differenceInDays(new Date(event.start_date), new Date()) > 0 && differenceInDays(new Date(event.start_date), new Date()) <= 7
                ? `${differenceInDays(new Date(event.start_date), new Date())} days until your event`
                : event.start_date && isBefore(new Date(event.start_date), new Date())
                ? "Post-event tasks"
                : "Priority tasks to get your event ready"}
            </p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
              {contextActions.map((action) => {
                const ActionIcon = action.icon
                return (
                  <button
                    key={action.label}
                    onClick={() => {
                      if (action.label === "Share Registration Link") {
                        navigator.clipboard.writeText(`${window.location.origin}${action.href}`)
                        // Could add a toast here
                      } else {
                        router.push(action.href)
                      }
                    }}
                    className="flex flex-col items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all duration-300 group hover:-translate-y-1 hover:shadow-md card-shine"
                  >
                    <div className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center transition-all",
                      action.iconBg
                    )}>
                      <ActionIcon className={cn("h-5 w-5", action.iconColor)} />
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-medium text-foreground block">
                        {action.label}
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5 block">
                        {action.description}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

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
