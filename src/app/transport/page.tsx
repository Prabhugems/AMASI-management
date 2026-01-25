"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Car,
  Search,
  Plus,
  MapPin,
  Clock,
  User,
  Phone,
  Calendar,
  Plane,
  Building2,
  Filter,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"

type TransportRequest = {
  id: string
  speaker_name: string
  speaker_phone: string
  event_name: string
  event_id: string
  pickup_type: "arrival" | "departure"
  pickup_date: string
  pickup_time: string
  pickup_location: string
  drop_location: string
  flight_number?: string
  status: "pending" | "assigned" | "completed" | "cancelled"
  driver_name?: string
  driver_phone?: string
  vehicle_number?: string
}

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "bg-amber-500" },
  assigned: { label: "Assigned", color: "bg-blue-500" },
  completed: { label: "Completed", color: "bg-green-500" },
  cancelled: { label: "Cancelled", color: "bg-red-500" },
}

export default function TransportPage() {
  const supabase = createClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [eventFilter, setEventFilter] = useState<string>("all")

  // Fetch events for filter
  const { data: events } = useQuery({
    queryKey: ["events-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name")
        .order("start_date", { ascending: false })
      return (data || []) as { id: string; name: string; short_name: string | null }[]
    },
  })

  // Fetch transport requests from registrations
  const { data: transportRequests, isLoading } = useQuery({
    queryKey: ["transport-requests", eventFilter],
    queryFn: async () => {
      let query = supabase
        .from("registrations")
        .select(`
          id,
          attendee_name,
          attendee_phone,
          custom_fields,
          event_id,
          event:events(id, name, short_name)
        `)
        .not("custom_fields->travel_details", "is", null)

      if (eventFilter !== "all") {
        query = query.eq("event_id", eventFilter)
      }

      const { data } = await query

      // Transform to transport requests
      const requests: TransportRequest[] = []

      data?.forEach((reg: any) => {
        const travel = reg.custom_fields?.travel_details
        const booking = reg.custom_fields?.booking

        if (travel?.onward_required !== false && travel?.onward_date) {
          requests.push({
            id: `${reg.id}-arrival`,
            speaker_name: reg.attendee_name,
            speaker_phone: reg.attendee_phone || "",
            event_name: reg.event?.short_name || reg.event?.name || "",
            event_id: reg.event_id,
            pickup_type: "arrival",
            pickup_date: travel.onward_date,
            pickup_time: travel.onward_departure_time || "",
            pickup_location: travel.onward_to_city || "Airport",
            drop_location: "Hotel/Venue",
            flight_number: travel.onward_preferred_time,
            status: booking?.pickup_required ? "assigned" : "pending",
            driver_name: booking?.pickup_details?.driver_name,
            driver_phone: booking?.pickup_details?.driver_phone,
            vehicle_number: booking?.pickup_details?.vehicle_number,
          })
        }

        if (travel?.return_required !== false && travel?.return_date) {
          requests.push({
            id: `${reg.id}-departure`,
            speaker_name: reg.attendee_name,
            speaker_phone: reg.attendee_phone || "",
            event_name: reg.event?.short_name || reg.event?.name || "",
            event_id: reg.event_id,
            pickup_type: "departure",
            pickup_date: travel.return_date,
            pickup_time: travel.return_departure_time || "",
            pickup_location: "Hotel/Venue",
            drop_location: travel.return_to_city || "Airport",
            flight_number: travel.return_preferred_time,
            status: booking?.drop_required ? "assigned" : "pending",
            driver_name: booking?.drop_details?.driver_name,
            driver_phone: booking?.drop_details?.driver_phone,
            vehicle_number: booking?.drop_details?.vehicle_number,
          })
        }
      })

      // Sort by date
      requests.sort((a, b) => new Date(a.pickup_date).getTime() - new Date(b.pickup_date).getTime())

      return requests
    },
  })

  // Filter requests
  const filteredRequests = transportRequests?.filter((req) => {
    const matchesSearch =
      req.speaker_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.flight_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.driver_name?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || req.status === statusFilter

    return matchesSearch && matchesStatus
  }) || []

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  // Stats
  const stats = {
    total: transportRequests?.length || 0,
    pending: transportRequests?.filter(r => r.status === "pending").length || 0,
    assigned: transportRequests?.filter(r => r.status === "assigned").length || 0,
    completed: transportRequests?.filter(r => r.status === "completed").length || 0,
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Car className="h-6 w-6 text-primary" />
              Transport Management
            </h1>
            <p className="text-muted-foreground">
              Manage pickup and drop for speakers and guests
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Transport
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-3xl font-bold text-primary">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Requests</p>
          </div>
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-3xl font-bold text-blue-600">{stats.assigned}</p>
            <p className="text-sm text-muted-foreground">Assigned</p>
          </div>
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, flight, driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[200px]">
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
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Flight</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No transport requests found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.speaker_name}</p>
                        {request.speaker_phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {request.speaker_phone}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{request.event_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "text-white",
                        request.pickup_type === "arrival" ? "bg-blue-500" : "bg-purple-500"
                      )}>
                        {request.pickup_type === "arrival" ? (
                          <>
                            <Plane className="h-3 w-3 mr-1 rotate-45" />
                            Arrival
                          </>
                        ) : (
                          <>
                            <Plane className="h-3 w-3 mr-1 -rotate-45" />
                            Departure
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDate(request.pickup_date)}
                      </div>
                      {request.pickup_time && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {request.pickup_time}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-green-500" />
                          {request.pickup_location}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3 text-red-500" />
                          {request.drop_location}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {request.flight_number ? (
                        <span className="font-mono text-sm">{request.flight_number}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {request.driver_name ? (
                        <div className="text-sm">
                          <p className="font-medium">{request.driver_name}</p>
                          {request.vehicle_number && (
                            <p className="text-xs text-muted-foreground">{request.vehicle_number}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-white", STATUS_CONFIG[request.status].color)}>
                        {STATUS_CONFIG[request.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        Assign
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  )
}
