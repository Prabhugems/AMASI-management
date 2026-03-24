"use client"

import React, { useState, useEffect, useRef } from "react"
import { useDebounce } from "@/hooks/use-debounce"
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
  UserCheck,
  ScanLine,
  Eye,
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
import { FEATURES } from "@/lib/config"

// Skeleton card for loading state
function EventCardSkeleton() {
  return (
    <div className="paper-card animate-pulse">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="w-16 h-5 rounded-full bg-gray-200 dark:bg-slate-700 mb-2" />
            <div className="w-40 h-5 rounded bg-gray-200 dark:bg-slate-700 mb-1" />
            <div className="w-56 h-4 rounded bg-gray-200 dark:bg-slate-700" />
          </div>
          <div className="w-8 h-8 rounded bg-gray-200 dark:bg-slate-700" />
        </div>
        <div className="space-y-2">
          <div className="w-32 h-4 rounded bg-gray-200 dark:bg-slate-700" />
          <div className="w-28 h-4 rounded bg-gray-200 dark:bg-slate-700" />
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="flex gap-4">
            <div className="w-12 h-4 rounded bg-gray-200 dark:bg-slate-700" />
            <div className="w-12 h-4 rounded bg-gray-200 dark:bg-slate-700" />
          </div>
          <div className="w-4 h-4 rounded bg-gray-200 dark:bg-slate-700" />
        </div>
      </div>
    </div>
  )
}

export default function EventsPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [duplicatingEventId, setDuplicatingEventId] = useState<string | null>(null)
  const [pageReady, setPageReady] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Page transition
  useEffect(() => {
    const timer = setTimeout(() => setPageReady(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Keyboard shortcut: Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      // Escape to clear search
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearch("")
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

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
    registrations: { count: number }[]
    faculty_assignments: { count: number }[]
  }

  // Fetch events with filters
  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ["events", debouncedSearch, statusFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("*, registrations(count), faculty_assignments(count)")
        .order("start_date", { ascending: false })

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,short_name.ilike.%${debouncedSearch}%,city.ilike.%${debouncedSearch}%`)
      }
      if (statusFilter === "all") {
        // Hide archived events by default
        query = query.neq("status", "archived")
      } else {
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

  // Single event mode: auto-redirect to the event
  React.useEffect(() => {
    if (!FEATURES.multipleEvents && events && events.length === 1) {
      router.replace(`/events/${events[0].id}`)
    }
  }, [events, router])

  // Fetch stats (parallel queries)
  const { data: stats } = useQuery({
    queryKey: ["events-stats"],
    queryFn: async () => {
      const [totalResult, activeResult, completedResult] = await Promise.all([
        supabase.from("events").select("*", { count: "exact", head: true }),
        supabase.from("events").select("*", { count: "exact", head: true }).in("status", ["setup", "draft", "active", "ongoing"]),
        supabase.from("events").select("*", { count: "exact", head: true }).eq("status", "completed"),
      ])
      return {
        total: totalResult.count || 0,
        active: activeResult.count || 0,
        completed: completedResult.count || 0,
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
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
      <div className={`transition-all duration-500 ease-out ${pageReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg text-muted-foreground font-normal">Events</h4>
            <p className="text-sm text-muted-foreground/70">
              Manage conferences, workshops, and courses
            </p>
          </div>
          {FEATURES.multipleEvents && (
            <Button size="sm" asChild>
              <Link href="/events/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Link>
            </Button>
          )}
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
          trend={null}
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
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-16"
              />
              {!search && (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">&#8984;</span>K
                </kbd>
              )}
            </div>
            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
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
                <SelectTrigger className="w-full sm:w-[150px]">
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
              <Button variant="outline" size="sm" onClick={() => refetch()} className="flex-shrink-0">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : events?.length === 0 ? (
        <div className="paper-card card-animated">
          <div className="p-16 text-center">
            <div className="inline-flex p-6 rounded-full bg-secondary/50 mb-6">
              <Calendar className="h-12 w-12 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {debouncedSearch ? "No events match your search" : "No events found"}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {debouncedSearch
                ? `No events matching "${debouncedSearch}". Try a different search term or clear filters.`
                : "Get started by creating your first event to manage conferences, workshops, and courses."}
            </p>
            <div className="flex items-center justify-center gap-3">
              {debouncedSearch && (
                <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); }}>
                  Clear Filters
                </Button>
              )}
              <Button asChild>
                <Link href="/events/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events?.map((event, eventIndex) => (
            <div
              key={event.id}
              className={`relative group rounded-xl transition-all duration-500 ease-out ${
                pageReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${eventIndex * 60}ms` }}
            >
            {/* Gradient border on hover */}
            <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/50 group-hover:via-primary/30 group-hover:to-violet-500/50 transition-all duration-500 opacity-0 group-hover:opacity-100 blur-[1px]" />
            <Link
              href={`/events/${event.id}`}
              className="relative block paper-card card-animated hover-lift bg-background"
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
                      {FEATURES.multipleEvents && (
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
                      )}
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
                    <div className="flex items-center gap-1" title="Faculty assigned">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {event.faculty_assignments?.[0]?.count || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-1" title="Registrations">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {event.registrations?.[0]?.count || 0}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>

                {/* Quick Action Buttons - visible on hover */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={(e) => {
                      e.preventDefault()
                      router.push(`/events/${event.id}/registrations`)
                    }}
                  >
                    <UserCheck className="h-3 w-3 mr-1" />
                    Registrations
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={(e) => {
                      e.preventDefault()
                      router.push(`/events/${event.id}/checkin`)
                    }}
                  >
                    <ScanLine className="h-3 w-3 mr-1" />
                    Check-in
                  </Button>
                  {event.slug && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={(e) => {
                        e.preventDefault()
                        window.open(`/register/${event.slug}`, '_blank')
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Delegate View
                    </Button>
                  )}
                </div>
              </div>
            </Link>
            </div>
          ))}
        </div>
      )}
      </div>
    </DashboardLayout>
  )
}
