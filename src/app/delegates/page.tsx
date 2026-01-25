"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  SlideOver,
  SlideOverSection,
  SlideOverTabs,
  SlideOverFooter,
} from "@/components/ui/slide-over"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Download,
  Users,
  CreditCard,
  UserCheck,
  Calendar,
  Check,
  X,
  Printer,
  Award,
  RefreshCw,
  Upload,
  Plus,
  Mail,
  Phone,
  Building,
  MapPin,
  Edit2,
  Trash2,
  ArrowUpRight,
  Loader2,
  QrCode,
  Ticket,
  Send,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { format } from "date-fns"

interface Attendee {
  id: string
  event_id: string
  name: string
  email: string
  phone: string | null
  registration_id: string | null
  category: string | null
  status: string | null
  checked_in: boolean
  checked_in_at: string | null
  institution: string | null
  designation: string | null
  city: string | null
  created_at: string
  event: { name: string; short_name: string | null } | null
}

export default function GlobalAttendeesPage() {
  const [search, setSearch] = useState("")
  const [eventFilter, setEventFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [checkinFilter, setCheckinFilter] = useState("all")
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null)
  const [activeTab, setActiveTab] = useState("details")

  const supabase = createClient()

  // Fetch events for dropdown
  const { data: events } = useQuery({
    queryKey: ["events-dropdown"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name")
        .order("start_date", { ascending: false })
      return data as { id: string; name: string; short_name: string | null }[] || []
    },
  })

  // Fetch attendees with filters
  const { data: attendees, isLoading, refetch } = useQuery({
    queryKey: ["global-attendees", search, eventFilter, statusFilter, checkinFilter],
    queryFn: async () => {
      let query = supabase
        .from("participants")
        .select(`*, event:events(name, short_name)`)
        .order("created_at", { ascending: false })
        .limit(100)

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,email.ilike.%${search}%,registration_id.ilike.%${search}%`
        )
      }
      if (eventFilter !== "all") {
        query = query.eq("event_id", eventFilter)
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }
      if (checkinFilter !== "all") {
        query = query.eq("checked_in", checkinFilter === "yes")
      }

      const { data, error } = await query
      if (error) throw error
      return (data as unknown as Attendee[]) || []
    },
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["attendees-stats"],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("participants")
        .select("*", { count: "exact", head: true })
      const { count: paid } = await supabase
        .from("participants")
        .select("*", { count: "exact", head: true })
        .eq("status", "confirmed")
      const { count: checkedIn } = await supabase
        .from("participants")
        .select("*", { count: "exact", head: true })
        .eq("checked_in", true)
      return {
        total: total || 0,
        paid: paid || 0,
        checkedIn: checkedIn || 0,
      }
    },
  })

  // Export to CSV
  const handleExport = async () => {
    const { data } = await supabase.from("participants").select("*").csv()
    const blob = new Blob([data || ""], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendees_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "confirmed": return "bg-emerald-500/10 text-emerald-600"
      case "cancelled": return "bg-rose-500/10 text-rose-600"
      default: return "bg-amber-500/10 text-amber-600"
    }
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-6rem)]">
        {/* Left Panel - Attendee List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Attendees</h1>
                <p className="text-muted-foreground mt-1">Manage attendees across all events</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/delegates/import">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/delegates/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Attendee
                  </Link>
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-secondary/30 rounded-xl p-4 border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.total || 0}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>
              <div className="bg-secondary/30 rounded-xl p-4 border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.paid || 0}</p>
                    <p className="text-xs text-muted-foreground">Confirmed</p>
                  </div>
                </div>
              </div>
              <div className="bg-secondary/30 rounded-xl p-4 border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.checkedIn || 0}</p>
                    <p className="text-xs text-muted-foreground">Checked In</p>
                  </div>
                </div>
              </div>
              <div className="bg-secondary/30 rounded-xl p-4 border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{events?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Events</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="p-4 border-b border-border bg-secondary/20">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or reg ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-background"
                />
              </div>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  {events?.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.short_name || event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-background">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={checkinFilter} onValueChange={setCheckinFilter}>
                <SelectTrigger className="w-[140px] bg-background">
                  <SelectValue placeholder="Check-in" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Checked In</SelectItem>
                  <SelectItem value="no">Not Checked In</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Attendee List */}
          <div className="flex-1 overflow-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : attendees?.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
                <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No attendees found</h3>
                <p className="text-muted-foreground mb-6">Try adjusting your filters or add new attendees.</p>
                <Button asChild>
                  <Link href="/delegates/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Attendee
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {attendees?.map((attendee) => (
                  <div
                    key={attendee.id}
                    onClick={() => setSelectedAttendee(attendee)}
                    className={cn(
                      "group p-4 rounded-xl border cursor-pointer transition-all duration-200",
                      selectedAttendee?.id === attendee.id
                        ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                        : "bg-card border-border hover:border-primary/20 hover:bg-secondary/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Status indicator */}
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0",
                          attendee.status === "confirmed"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600"
                        )}>
                          {attendee.name.charAt(0).toUpperCase()}
                        </div>

                        {/* Attendee info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground truncate">{attendee.name}</h3>
                            {attendee.checked_in && (
                              <Badge variant="outline" className="text-[10px] gap-1 flex-shrink-0 bg-emerald-500/10 text-emerald-600 border-0">
                                <Check className="h-3 w-3" />
                                Checked In
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{attendee.email}</span>
                            <span>•</span>
                            <span className="font-mono text-xs text-primary">
                              {attendee.registration_id || "No Reg ID"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Event & Status */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right hidden md:block">
                          <p className="text-sm font-medium">
                            {attendee.event?.short_name || attendee.event?.name || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {attendee.category || "Attendee"}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-medium border-0",
                            getStatusColor(attendee.status)
                          )}
                        >
                          {attendee.status || "Pending"}
                        </Badge>
                        <ArrowUpRight className={cn(
                          "h-4 w-4 transition-all",
                          selectedAttendee?.id === attendee.id
                            ? "text-primary"
                            : "text-muted-foreground opacity-0 group-hover:opacity-100"
                        )} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-secondary/20">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{attendees?.length || 0} attendees showing</span>
              <span>{stats?.total?.toLocaleString() || 0} total across all events</span>
            </div>
          </div>
        </div>

        {/* Right Panel - Slide Over Details */}
        <SlideOver
          open={!!selectedAttendee}
          onClose={() => setSelectedAttendee(null)}
          title={selectedAttendee?.name}
          subtitle={selectedAttendee?.registration_id || "No Registration ID"}
          width="lg"
          showOverlay={false}
        >
          {selectedAttendee && (
            <>
              {/* Tabs */}
              <SlideOverTabs
                tabs={[
                  { id: "details", label: "Details" },
                  { id: "tickets", label: "Tickets" },
                  { id: "activity", label: "Activity" },
                ]}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              {activeTab === "details" && (
                <>
                  {/* Status Cards */}
                  <SlideOverSection>
                    <div className="grid grid-cols-2 gap-4">
                      <div className={cn(
                        "rounded-lg p-4 text-center",
                        selectedAttendee.status === "confirmed"
                          ? "bg-emerald-500/10"
                          : "bg-amber-500/10"
                      )}>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-medium border-0 mb-2",
                            getStatusColor(selectedAttendee.status)
                          )}
                        >
                          {selectedAttendee.status || "Pending"}
                        </Badge>
                        <p className="text-xs text-muted-foreground">Registration Status</p>
                      </div>
                      <div className={cn(
                        "rounded-lg p-4 text-center",
                        selectedAttendee.checked_in
                          ? "bg-emerald-500/10"
                          : "bg-secondary/50"
                      )}>
                        {selectedAttendee.checked_in ? (
                          <Check className="h-5 w-5 text-emerald-600 mx-auto mb-2" />
                        ) : (
                          <X className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                        )}
                        <p className="text-xs text-muted-foreground">
                          {selectedAttendee.checked_in ? "Checked In" : "Not Checked In"}
                        </p>
                      </div>
                    </div>
                  </SlideOverSection>

                  {/* Contact Info */}
                  <SlideOverSection title="Contact Information" className="border-t border-border">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedAttendee.email}</span>
                      </div>
                      {selectedAttendee.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{selectedAttendee.phone}</span>
                        </div>
                      )}
                      {selectedAttendee.institution && (
                        <div className="flex items-center gap-3">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{selectedAttendee.institution}</span>
                        </div>
                      )}
                      {selectedAttendee.city && (
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{selectedAttendee.city}</span>
                        </div>
                      )}
                    </div>
                  </SlideOverSection>

                  {/* Event Info */}
                  <SlideOverSection title="Event Details" className="border-t border-border">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Event</span>
                        <Link
                          href={`/events/${selectedAttendee.event_id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {selectedAttendee.event?.short_name || selectedAttendee.event?.name}
                        </Link>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Category</span>
                        <span className="font-medium">{selectedAttendee.category || "Attendee"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Registered</span>
                        <span className="font-medium">
                          {format(new Date(selectedAttendee.created_at), "d MMM yyyy")}
                        </span>
                      </div>
                      {selectedAttendee.checked_in_at && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Checked In At</span>
                          <span className="font-medium">
                            {format(new Date(selectedAttendee.checked_in_at), "d MMM yyyy, h:mm a")}
                          </span>
                        </div>
                      )}
                    </div>
                  </SlideOverSection>

                  {/* Quick Actions */}
                  <SlideOverSection title="Quick Actions" className="border-t border-border">
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" size="sm" className="justify-start">
                        <QrCode className="h-4 w-4 mr-2" />
                        Check In
                      </Button>
                      <Button variant="outline" size="sm" className="justify-start">
                        <Printer className="h-4 w-4 mr-2" />
                        Print Badge
                      </Button>
                      <Button variant="outline" size="sm" className="justify-start">
                        <Award className="h-4 w-4 mr-2" />
                        Certificate
                      </Button>
                      <Button variant="outline" size="sm" className="justify-start">
                        <Send className="h-4 w-4 mr-2" />
                        Send Email
                      </Button>
                    </div>
                  </SlideOverSection>
                </>
              )}

              {activeTab === "tickets" && (
                <SlideOverSection>
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Ticket className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h4 className="font-medium mb-2">Ticket Information</h4>
                    <p className="text-sm text-muted-foreground">
                      Ticket details and history coming soon
                    </p>
                  </div>
                </SlideOverSection>
              )}

              {activeTab === "activity" && (
                <SlideOverSection>
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h4 className="font-medium mb-2">Activity Log</h4>
                    <p className="text-sm text-muted-foreground">
                      Activity history coming soon
                    </p>
                  </div>
                </SlideOverSection>
              )}

              {/* Footer Actions */}
              <SlideOverFooter className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <Button size="sm" asChild>
                  <Link href={`/delegates/${selectedAttendee.id}/edit`}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </Button>
              </SlideOverFooter>
            </>
          )}
        </SlideOver>
      </div>
    </DashboardLayout>
  )
}
