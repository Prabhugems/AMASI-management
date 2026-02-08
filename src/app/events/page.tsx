"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Plus,
  Calendar,
  Users,
  GraduationCap,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  ArrowRight,
  CalendarCheck,
  CalendarX,
  CopyPlus,
  Loader2,
  ExternalLink,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { StatCard } from "@/components/dashboard/stat-card"

export default function EventsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [duplicatingEventId, setDuplicatingEventId] = useState<string | null>(null)

  const router = useRouter()
  const queryClient = useQueryClient()
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
    confirmed_faculty: number
    total_delegates: number
  }

  // Fetch events with filters
  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ["events", search, statusFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("*")
        .order("start_date", { ascending: false })

      if (search) {
        query = query.or(`name.ilike.%${search}%,short_name.ilike.%${search}%,city.ilike.%${search}%`)
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }
      if (typeFilter !== "all") {
        query = query.eq("event_type", typeFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return (data as Event[]) || []
    },
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["events-stats"],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
      const { count: active } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .in("status", ["setup", "draft", "active", "ongoing"])
      const { count: completed } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
      return {
        total: total || 0,
        active: active || 0,
        completed: completed || 0,
      }
    },
  })

  // Duplicate event mutation
  const duplicateEvent = useMutation({
    mutationFn: async (eventId: string) => {
      setDuplicatingEventId(eventId)
      const response = await fetch(`/api/events/${eventId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to duplicate event")
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      queryClient.invalidateQueries({ queryKey: ["events-stats"] })
      toast.success(data.message || "Event duplicated successfully!")
      // Navigate to the new event
      if (data.event?.id) {
        router.push(`/events/${data.event.id}/settings`)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
    onSettled: () => {
      setDuplicatingEventId(null)
    },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ongoing":
        return "bg-success/20 text-success"
      case "active":
        return "bg-info/20 text-info"
      case "setup":
        return "bg-warning/20 text-warning"
      case "draft":
        return "bg-secondary text-secondary-foreground"
      case "completed":
        return "bg-muted text-muted-foreground"
      case "archived":
        return "bg-destructive/20 text-destructive"
      default:
        return "bg-secondary text-secondary-foreground"
    }
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg text-muted-foreground font-normal">Events</h4>
            <p className="text-sm text-muted-foreground/70">
              Manage conferences, workshops, and courses
            </p>
          </div>
          <Button size="sm" asChild>
            <Link href="/events/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Link>
          </Button>
        </div>
      </div>

      {/* Animated Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard
          icon={Calendar}
          value={stats?.total || 0}
          label="Total Events"
          subtext="All time"
          trend={null}
          color="rose"
          delay={0}
        />
        <StatCard
          icon={CalendarCheck}
          value={stats?.active || 0}
          label="Active Events"
          subtext="Planning/Ongoing"
          trend={15}
          color="teal"
          delay={100}
        />
        <StatCard
          icon={CalendarX}
          value={stats?.completed || 0}
          label="Completed"
          subtext="Successfully held"
          trend={null}
          color="violet"
          delay={200}
        />
      </div>

      {/* Search & Filters */}
      <div className="paper-card card-animated mb-6">
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="setup">Setup</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="conference">Conference</SelectItem>
                <SelectItem value="workshop">Workshop</SelectItem>
                <SelectItem value="course">Course</SelectItem>
                <SelectItem value="webinar">Webinar</SelectItem>
                <SelectItem value="symposium">Symposium</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      ) : events?.length === 0 ? (
        <div className="paper-card card-animated">
          <div className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No events found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by creating your first event
            </p>
            <Button asChild>
              <Link href="/events/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events?.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="paper-card card-animated hover-lift group"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-medium border-0 capitalize mb-2",
                        getStatusColor(event.status)
                      )}
                    >
                      {event.status?.replace("_", " ")}
                    </Badge>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {event.short_name || event.name}
                    </h3>
                    {event.short_name && event.name !== event.short_name && (
                      <p className="text-sm text-muted-foreground truncate">
                        {event.name}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        {duplicatingEventId === event.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.preventDefault()
                        router.push(`/events/${event.id}/settings`)
                      }}>
                        Edit Event
                      </DropdownMenuItem>
                      {event.slug && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault()
                            window.open(`/register/${event.slug}`, '_blank')
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Page
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          duplicateEvent.mutate(event.id)
                        }}
                        disabled={duplicateEvent.isPending}
                      >
                        <CopyPlus className="h-4 w-4 mr-2" />
                        Duplicate Event
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.preventDefault()
                          if (confirm(`Archive "${event.short_name || event.name}"? It will be hidden from active events.`)) {
                            fetch(`/api/events/${event.id}/settings`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: "archived" }),
                            }).then((res) => {
                              if (res.ok) {
                                toast.success("Event archived")
                                queryClient.invalidateQueries({ queryKey: ["events"] })
                                queryClient.invalidateQueries({ queryKey: ["events-stats"] })
                              } else {
                                toast.error("Failed to archive event")
                              }
                            })
                          }
                        }}
                      >
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  {event.start_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(event.start_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  {event.city && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {event.city}
                        {event.state && `, ${event.state}`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {event.confirmed_faculty || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {event.total_delegates || 0}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
