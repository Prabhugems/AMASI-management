"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import {
  Plane,
  Loader2,
  Calendar,
  MapPin,
  Users,
  Hotel,
  Car,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { HelpTooltip } from "@/components/ui/help-tooltip"

type Event = {
  id: string
  name: string
  short_name: string
  start_date: string
  end_date: string
  venue_name: string
  city: string
}

type TravelStats = {
  total: number
  pending: number
  booked: number
  hotelRequired: number
  transfersRequired: number
}

export default function TravelDashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  // Redirect transport users to the focused transport portal
  useEffect(() => {
    const checkAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) return

      type TeamMemberType = { role: string | null; permissions: string[] | null }
      const { data: teamMemberData } = await supabase
        .from("team_members")
        .select("role, permissions")
        .eq("email", session.user.email.toLowerCase())
        .eq("is_active", true)
        .single()
      const teamMember = teamMemberData as TeamMemberType | null

      if (teamMember) {
        const role = teamMember.role || ""
        // If user is transport/travel but NOT admin, redirect to transport portal
        if ((role.includes("travel") || role.includes("transport")) && !role.includes("admin")) {
          router.replace("/transport-portal")
        }
      }
    }
    checkAndRedirect()
  }, [supabase, router])

  // Fetch events with travel requirements
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["travel-dashboard-events"],
    queryFn: async () => {
      // Fetch all events
      const { data: events } = await (supabase as any)
        .from("events")
        .select("id, name, short_name, start_date, end_date, venue_name, city")
        .order("start_date", { ascending: false })

      if (!events) return []

      // For each event, get travel stats
      const eventsWithStats = await Promise.all(
        (events as Event[]).map(async (event) => {
          const { data: registrations } = await (supabase as any)
            .from("registrations")
            .select("custom_fields")
            .eq("event_id", event.id)

          const speakers = (registrations || []).filter(
            (r: any) => r.custom_fields?.needs_travel
          )

          const stats: TravelStats = {
            total: speakers.length,
            pending: speakers.filter((s: any) => {
              const status = s.custom_fields?.booking?.onward_status
              return !status || status === "pending"
            }).length,
            booked: speakers.filter((s: any) => {
              const status = s.custom_fields?.booking?.onward_status
              return status === "booked" || status === "confirmed"
            }).length,
            hotelRequired: speakers.filter((s: any) =>
              s.custom_fields?.travel_details?.hotel_required
            ).length,
            transfersRequired: speakers.filter((s: any) =>
              s.custom_fields?.travel_details?.pickup_required ||
              s.custom_fields?.travel_details?.drop_required
            ).length,
          }

          return { ...event, stats }
        })
      )

      // Filter to only events with travel requirements
      return eventsWithStats.filter(e => e.stats.total > 0)
    },
  })

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy")
    } catch {
      return dateStr
    }
  }

  const isUpcoming = (dateStr: string) => {
    return new Date(dateStr) >= new Date()
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plane className="h-6 w-6 text-primary" />
            Travel Dashboard
          </h1>
          <p className="text-muted-foreground">
            Select an event to manage travel bookings
          </p>
        </div>

        {eventsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !eventsData || eventsData.length === 0 ? (
          <div className="text-center py-12 paper-card">
            <Plane className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No events with travel requirements</h3>
            <p className="text-muted-foreground">Events will appear here when speakers request travel assistance</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {eventsData.map((event) => (
              <div
                key={event.id}
                className="paper-card p-6 cursor-pointer transition-all hover:shadow-lg hover:border-primary/30"
                onClick={() => router.push(`/travel-dashboard/${event.id}`)}
              >
                {/* Event Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{event.short_name || event.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(event.start_date)}
                      {event.end_date !== event.start_date && ` - ${formatDate(event.end_date)}`}
                    </div>
                    {event.city && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.venue_name ? `${event.venue_name}, ${event.city}` : event.city}
                      </div>
                    )}
                  </div>
                  <Badge className={cn(
                    "text-xs",
                    isUpcoming(event.start_date)
                      ? "bg-success/20 text-success border-success/30"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {isUpcoming(event.start_date) ? "Upcoming" : "Past"}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-2xl font-bold text-foreground">{event.stats.total}</span>
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      Total Guests
                      <HelpTooltip content="Speakers/faculty who require travel arrangements for this event" iconClassName="h-3 w-3" />
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      {event.stats.pending > 0 ? (
                        <AlertCircle className="h-4 w-4 text-warning" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-success" />
                      )}
                      <span className="text-2xl font-bold text-foreground">{event.stats.pending}</span>
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      Pending
                      <HelpTooltip content="Guests without flight bookings. Click to view and book their travel." iconClassName="h-3 w-3" />
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Hotel className="h-4 w-4 text-info" />
                      <span className="text-2xl font-bold text-foreground">{event.stats.hotelRequired}</span>
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      Need Hotel
                      <HelpTooltip content="Guests who indicated they need hotel accommodation for the event" iconClassName="h-3 w-3" />
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-destructive" />
                      <span className="text-2xl font-bold text-foreground">{event.stats.transfersRequired}</span>
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      Transfers
                      <HelpTooltip content="Guests who need airport/station pickup and drop services" iconClassName="h-3 w-3" />
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Booking Progress</span>
                    <span>{event.stats.total > 0 ? Math.round((event.stats.booked / event.stats.total) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${event.stats.total > 0 ? (event.stats.booked / event.stats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
