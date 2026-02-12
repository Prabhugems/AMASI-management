"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  Car,
  Loader2,
  Phone,
  Calendar,
  Clock,
  User,
  Building2,
  Plane,
  ArrowDown,
  ArrowUp,
  Navigation,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"

type Assignment = {
  id: string
  type: "pickup" | "drop"
  eventId: string
  eventName: string
  guestName: string
  guestPhone: string
  guestPhoto?: string
  date: string
  time: string
  flightNumber?: string
  flightTime?: string
  pickupLocation: string
  dropLocation: string
  hotelName: string
  hotelAddress?: string
  hotelPhone?: string
  vehicle: string
  notes?: string
  status: string
}

type Hotel = {
  id: string
  name: string
  address: string
  phone: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  arranged: "bg-blue-500",
  confirmed: "bg-green-500",
  completed: "bg-gray-500",
  cancelled: "bg-red-500",
}

export default function DriverAssignmentsPage() {
  const params = useParams()
  const router = useRouter()
  const phone = decodeURIComponent(params.phone as string)
  const supabase = createClient()

  // Fetch all assignments for this driver
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["driver-assignments", phone],
    queryFn: async () => {
      const normalizedPhone = phone.replace(/[^\d+]/g, "")

      // Fetch all registrations
      const { data: registrations } = await supabase
        .from("registrations")
        .select("id, event_id, attendee_name, attendee_phone, custom_fields")

      if (!registrations || registrations.length === 0) return []

      // Get unique event IDs
      type RegType = { id: string; event_id: string; attendee_name: string; attendee_phone: string; custom_fields: any }
      const regs = registrations as RegType[]
      const eventIds = [...new Set(regs.map(r => r.event_id))]

      // Fetch events
      type EventType = { id: string; name: string }
      const { data: eventsData } = await supabase
        .from("events")
        .select("id, name")
        .in("id", eventIds)
      const events = eventsData as EventType[] | null

      // Fetch hotels for all events
      type HotelType = { id: string; name: string; address: string; phone: string; event_id: string }
      const { data: hotelsData } = await supabase
        .from("hotels")
        .select("id, name, address, phone, event_id")
        .in("event_id", eventIds)
        .eq("is_active", true)
      const hotels = hotelsData as HotelType[] | null

      const eventsMap = new Map(events?.map(e => [e.id, e.name]) || [])
      const hotelsMap = new Map<string, Hotel[]>()
      hotels?.forEach(h => {
        const existing = hotelsMap.get(h.event_id) || []
        existing.push(h)
        hotelsMap.set(h.event_id, existing)
      })

      const result: Assignment[] = []

      regs.forEach(reg => {
        const booking = reg.custom_fields?.booking || {}
        const travel = reg.custom_fields?.travel_details || {}
        const eventHotels = hotelsMap.get(reg.event_id) || []

        // Check pickup assignment
        const pickupPhone = booking.pickup_driver_phone?.replace(/[^\d+]/g, "") || ""
        if (pickupPhone && (pickupPhone.includes(normalizedPhone.slice(-10)) || normalizedPhone.includes(pickupPhone.slice(-10)))) {
          // Get hotel info
          const assignedHotelId = reg.custom_fields?.assigned_hotel_id
          const hotel = assignedHotelId ? eventHotels.find(h => h.id === assignedHotelId) : null
          const hotelName = hotel?.name || booking.hotel_name || travel.hotel_name || "Hotel TBD"

          result.push({
            id: `${reg.id}-pickup`,
            type: "pickup",
            eventId: reg.event_id,
            eventName: eventsMap.get(reg.event_id) || "Event",
            guestName: reg.attendee_name,
            guestPhone: reg.attendee_phone || "",
            guestPhoto: reg.custom_fields?.photo_url,
            date: travel.onward_date || travel.arrival_date || "",
            time: booking.pickup_time || "",
            flightNumber: booking.onward_flight_number || travel.onward_from_city || "",
            flightTime: booking.onward_arrival_time || "",
            pickupLocation: booking.pickup_location || "Airport",
            dropLocation: hotelName,
            hotelName,
            hotelAddress: hotel?.address || booking.hotel_address || "",
            hotelPhone: hotel?.phone || booking.hotel_phone || "",
            vehicle: booking.pickup_vehicle || "",
            notes: booking.pickup_notes || "",
            status: booking.pickup_status || "pending",
          })
        }

        // Check drop assignment
        const dropPhone = booking.drop_driver_phone?.replace(/[^\d+]/g, "") || ""
        if (dropPhone && (dropPhone.includes(normalizedPhone.slice(-10)) || normalizedPhone.includes(dropPhone.slice(-10)))) {
          const assignedHotelId = reg.custom_fields?.assigned_hotel_id
          const hotel = assignedHotelId ? eventHotels.find(h => h.id === assignedHotelId) : null
          const hotelName = hotel?.name || booking.hotel_name || travel.hotel_name || "Hotel TBD"

          result.push({
            id: `${reg.id}-drop`,
            type: "drop",
            eventId: reg.event_id,
            eventName: eventsMap.get(reg.event_id) || "Event",
            guestName: reg.attendee_name,
            guestPhone: reg.attendee_phone || "",
            guestPhoto: reg.custom_fields?.photo_url,
            date: travel.return_date || travel.departure_date || "",
            time: booking.drop_time || "",
            flightNumber: booking.return_flight_number || travel.return_to_city || "",
            flightTime: booking.return_departure_time || "",
            pickupLocation: hotelName,
            dropLocation: booking.drop_location || "Airport",
            hotelName,
            hotelAddress: hotel?.address || booking.hotel_address || "",
            hotelPhone: hotel?.phone || booking.hotel_phone || "",
            vehicle: booking.drop_vehicle || "",
            notes: booking.drop_notes || "",
            status: booking.drop_status || "pending",
          })
        }
      })

      // Sort by date and time
      result.sort((a, b) => {
        if (!a.date || !b.date) return 0
        const dateA = new Date(a.date + " " + (a.time || "00:00"))
        const dateB = new Date(b.date + " " + (b.time || "00:00"))
        const timeA = dateA.getTime()
        const timeB = dateB.getTime()
        if (isNaN(timeA) || isNaN(timeB)) return 0
        return timeA - timeB
      })

      return result
    },
  })

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-"
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
  }

  const openMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, "_blank")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading assignments...</p>
        </div>
      </div>
    )
  }

  if (!assignments || assignments.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Assignments Found</h2>
          <p className="text-muted-foreground mb-6">
            No pickup or drop assignments found for this phone number.
          </p>
          <Button onClick={() => router.push("/driver-portal")} variant="outline">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Try Different Number
          </Button>
        </div>
      </div>
    )
  }

  // Group by date
  const groupedByDate = assignments.reduce((acc, assignment) => {
    const date = assignment.date || "Unscheduled"
    if (!acc[date]) acc[date] = []
    acc[date].push(assignment)
    return acc
  }, {} as Record<string, Assignment[]>)

  const upcomingCount = assignments.filter(a => a.status !== "completed" && a.status !== "cancelled").length
  const completedCount = assignments.filter(a => a.status === "completed").length

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-6 pb-12">
        <div className="max-w-lg mx-auto">
          <Link
            href="/driver-portal"
            className="inline-flex items-center text-slate-400 hover:text-white text-sm mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Change Number
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
              <Car className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">My Assignments</h1>
              <p className="text-slate-400 text-sm">{phone}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{upcomingCount}</p>
              <p className="text-xs text-slate-400">Upcoming</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-xs text-slate-400">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 -mt-6 pb-8">
        {Object.entries(groupedByDate).map(([date, dayAssignments]) => (
          <div key={date} className="mb-6">
            {/* Date Header */}
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{formatDate(date)}</span>
              <Badge variant="secondary" className="text-xs">{dayAssignments.length} trips</Badge>
            </div>

            {/* Assignment Cards */}
            <div className="space-y-4">
              {dayAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className={cn(
                    "bg-white rounded-2xl shadow-sm overflow-hidden border-l-4",
                    assignment.type === "pickup" ? "border-l-green-500" : "border-l-orange-500"
                  )}
                >
                  {/* Card Header */}
                  <div className={cn(
                    "px-4 py-3 flex items-center justify-between",
                    assignment.type === "pickup" ? "bg-green-50" : "bg-orange-50"
                  )}>
                    <div className="flex items-center gap-2">
                      {assignment.type === "pickup" ? (
                        <ArrowDown className="h-5 w-5 text-green-600" />
                      ) : (
                        <ArrowUp className="h-5 w-5 text-orange-600" />
                      )}
                      <span className="font-semibold text-sm">
                        {assignment.type === "pickup" ? "Pickup" : "Drop"}
                      </span>
                    </div>
                    <Badge className={cn("text-white text-xs", STATUS_COLORS[assignment.status])}>
                      {assignment.status}
                    </Badge>
                  </div>

                  {/* Guest Info */}
                  <div className="p-4 border-b">
                    <div className="flex items-start gap-3">
                      {assignment.guestPhoto ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={assignment.guestPhoto}
                          alt={assignment.guestName}
                          className="w-14 h-14 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center">
                          <User className="h-7 w-7 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-lg">{assignment.guestName}</p>
                        <p className="text-xs text-muted-foreground mb-2">{assignment.eventName}</p>
                        {assignment.guestPhone && (
                          <a
                            href={`tel:${assignment.guestPhone}`}
                            className="inline-flex items-center gap-1.5 text-sm text-primary font-medium"
                          >
                            <Phone className="h-4 w-4" />
                            {assignment.guestPhone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Trip Details */}
                  <div className="p-4 space-y-3">
                    {/* Time */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {assignment.type === "pickup" ? "Pickup Time" : "Drop Time"}
                        </p>
                        <p className="font-bold text-lg">{assignment.time || "TBD"}</p>
                      </div>
                    </div>

                    {/* Flight */}
                    {assignment.flightNumber && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                          <Plane className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Flight</p>
                          <p className="font-medium">
                            {assignment.flightNumber}
                            {assignment.flightTime && ` @ ${assignment.flightTime}`}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Route */}
                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-3 h-3 rounded-full",
                            assignment.type === "pickup" ? "bg-green-500" : "bg-orange-500"
                          )} />
                          <div className="w-0.5 h-8 bg-slate-300" />
                          <div className={cn(
                            "w-3 h-3 rounded-full",
                            assignment.type === "pickup" ? "bg-orange-500" : "bg-green-500"
                          )} />
                        </div>
                        <div className="flex-1 space-y-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">
                              {assignment.type === "pickup" ? "Pickup From" : "Pickup From (Hotel)"}
                            </p>
                            <p className="font-medium">{assignment.pickupLocation}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">
                              {assignment.type === "pickup" ? "Drop To (Hotel)" : "Drop To"}
                            </p>
                            <p className="font-medium">{assignment.dropLocation}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Hotel Address */}
                    {assignment.hotelAddress && (
                      <button
                        onClick={() => openMaps(assignment.hotelAddress!)}
                        className="w-full flex items-center gap-3 p-3 bg-amber-50 rounded-xl text-left hover:bg-amber-100 transition-colors"
                      >
                        <Building2 className="h-5 w-5 text-amber-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-amber-700 font-medium">Hotel Address</p>
                          <p className="text-sm text-amber-900 truncate">{assignment.hotelAddress}</p>
                        </div>
                        <Navigation className="h-4 w-4 text-amber-600" />
                      </button>
                    )}

                    {/* Hotel Phone */}
                    {assignment.hotelPhone && (
                      <a
                        href={`tel:${assignment.hotelPhone}`}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                      >
                        <Phone className="h-5 w-5 text-slate-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">Hotel Phone</p>
                          <p className="font-medium">{assignment.hotelPhone}</p>
                        </div>
                      </a>
                    )}

                    {/* Vehicle */}
                    {assignment.vehicle && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <Car className="h-5 w-5 text-slate-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">Vehicle</p>
                          <p className="font-medium">{assignment.vehicle}</p>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {assignment.notes && (
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <p className="text-xs text-blue-600 font-medium mb-1">Special Instructions</p>
                        <p className="text-sm text-blue-900">{assignment.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="px-4 py-3 bg-slate-50 flex gap-2">
                    {assignment.guestPhone && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        asChild
                      >
                        <a href={`tel:${assignment.guestPhone}`}>
                          <Phone className="h-4 w-4 mr-2" />
                          Call Guest
                        </a>
                      </Button>
                    )}
                    {assignment.hotelAddress && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openMaps(assignment.hotelAddress!)}
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        Navigate
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Refresh Button */}
      <div className="fixed bottom-4 right-4">
        <Button
          size="lg"
          className="rounded-full shadow-lg"
          onClick={() => window.location.reload()}
        >
          <CheckCircle2 className="h-5 w-5 mr-2" />
          Refresh
        </Button>
      </div>
    </div>
  )
}
