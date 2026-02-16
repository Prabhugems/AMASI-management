"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Calendar,
  Plane,
  Hotel,
  Building2,
  Mic,
  PlaneTakeoff,
  PlaneLanding,
  Car,
  Copy,
  Printer,
  Download,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Session = {
  id: string
  session_name: string
  session_date: string
  start_time: string
  end_time: string
  hall: string | null
}

interface JourneyItineraryProps {
  attendeeName: string
  eventName: string
  customFields: {
    booking?: any
    travel_details?: any
    travel_booked?: any
  }
  sessions?: Session[]
}

export function JourneyItinerary({
  attendeeName,
  eventName,
  customFields,
  sessions = [],
}: JourneyItineraryProps) {
  const booking = customFields?.booking || {}
  const travel = customFields?.travel_details || {}

  const hasBooking =
    booking.onward_status === "booked" ||
    booking.onward_status === "confirmed" ||
    booking.return_status === "booked" ||
    booking.return_status === "confirmed" ||
    booking.onward_pnr ||
    booking.return_pnr ||
    booking.flight_pnr ||
    booking.hotel_name ||
    booking.hotel_status === "booked" ||
    booking.hotel_status === "confirmed"

  if (!hasBooking) return null

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ""
    return new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const formatTime = (time: string) => {
    if (!time) return ""
    const [hours, minutes] = time.split(":")
    const h = parseInt(hours)
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  return (
    <Card className="bg-white/10 backdrop-blur border-white/20 print:bg-white print:text-black" id="journey-itinerary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2 print:text-black">
              <Calendar className="h-5 w-5 text-blue-400 print:text-blue-600" />
              Complete Journey Itinerary
            </CardTitle>
            <CardDescription className="text-white/70 print:text-gray-600">
              {attendeeName} &bull; {eventName}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="print:hidden border-white/20 text-white hover:bg-white/10"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-0">
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-green-500 via-amber-500 to-purple-500 print:bg-gray-300" />

          {/* No Onward Flight */}
          {(booking.return_status === "booked" || booking.return_status === "confirmed") &&
            booking.onward_status !== "booked" &&
            booking.onward_status !== "confirmed" &&
            !booking.onward_pnr && (
            <div className="relative pl-12 pb-6">
              <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center">
                <PlaneTakeoff className="h-3 w-3 text-white" />
              </div>
              <div className="p-3 bg-gray-500/10 rounded-lg border border-gray-500/20 print:bg-gray-50 print:border-gray-200">
                <p className="text-sm text-white/60 print:text-gray-500 flex items-center gap-2">
                  <span>No Onward Flight</span>
                  <Badge variant="outline" className="text-xs text-gray-400 border-gray-400/30">Self-arranged / Local</Badge>
                </p>
              </div>
            </div>
          )}

          {/* ARRIVAL FLIGHT */}
          {(booking.onward_status === "booked" ||
            booking.onward_status === "confirmed" ||
            booking.onward_pnr ||
            booking.flight_pnr) && (
            <div className="relative pl-12 pb-6">
              <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                <PlaneTakeoff className="h-3 w-3 text-white" />
              </div>
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20 print:bg-blue-50 print:border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-blue-400 print:text-blue-700 flex items-center gap-2">
                    ARRIVAL
                    <span className="text-xs font-normal text-white/60 print:text-gray-500">
                      {formatDate(booking.onward_departure_date || travel.onward_date || travel.arrival_date || "")}
                    </span>
                  </h4>
                  <Badge className={cn(
                    "print:bg-blue-100 print:text-blue-700",
                    booking.onward_status === "confirmed" ? "bg-green-500/30 text-green-300" :
                    booking.onward_status === "booked" ? "bg-blue-500/30 text-blue-300" :
                    "bg-amber-500/30 text-amber-300"
                  )}>
                    {booking.onward_status || "Pending"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white print:text-black">
                      {booking.onward_departure_time || travel.onward_departure_time || "--:--"}
                    </p>
                    <p className="text-sm text-white/70 print:text-gray-600 font-medium">
                      {booking.onward_from_city || travel.onward_from_city || travel.from_city || "-"}
                    </p>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 border-t border-dashed border-white/30 print:border-gray-300" />
                    <Plane className="h-4 w-4 text-white/50 print:text-gray-400" />
                    <div className="flex-1 border-t border-dashed border-white/30 print:border-gray-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white print:text-black">
                      {booking.onward_arrival_time || "--:--"}
                    </p>
                    <p className="text-sm text-white/70 print:text-gray-600 font-medium">
                      {booking.onward_to_city || travel.onward_to_city || "-"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-white/50 print:text-gray-500 text-xs">Flight</p>
                    <p className="text-white print:text-black font-mono">
                      {booking.onward_airline} {booking.onward_flight_number || travel.onward_preferred_time || booking.flight_number || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50 print:text-gray-500 text-xs">PNR</p>
                    <div className="flex items-center gap-1">
                      <p className="text-white print:text-black font-mono font-bold">
                        {booking.onward_pnr || booking.flight_pnr || (booking.onward_eticket ? "See ticket" : "-")}
                      </p>
                      {(booking.onward_pnr || booking.flight_pnr) && (
                        <button onClick={() => { navigator.clipboard.writeText(booking.onward_pnr || booking.flight_pnr || ""); toast.success("PNR copied!"); }} className="text-white/50 hover:text-white print:hidden">
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {booking.onward_seat && (
                    <div>
                      <p className="text-white/50 print:text-gray-500 text-xs">Seat</p>
                      <p className="text-white print:text-black font-mono">{booking.onward_seat}</p>
                    </div>
                  )}
                </div>
                {booking.onward_eticket && (
                  <div className="mt-3 pt-3 border-t border-white/10 print:border-gray-200">
                    <a href={booking.onward_eticket} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 print:text-blue-600">
                      <Download className="h-4 w-4" /> Download E-Ticket
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AIRPORT PICKUP */}
          {booking.pickup_required && (
            <div className="relative pl-12 pb-6">
              <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                <Car className="h-3 w-3 text-white" />
              </div>
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20 print:bg-green-50 print:border-green-200">
                <h4 className="font-semibold text-green-400 print:text-green-700 mb-2 flex items-center gap-2">
                  <Car className="h-4 w-4" /> AIRPORT PICKUP
                </h4>
                <p className="text-white/80 print:text-gray-700 text-sm">
                  {booking.pickup_details || "Pickup arranged - details will be shared"}
                </p>
              </div>
            </div>
          )}

          {/* HOTEL CHECK-IN */}
          {booking.hotel_name && (
            <div className="relative pl-12 pb-6">
              <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                <Hotel className="h-3 w-3 text-white" />
              </div>
              <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20 print:bg-amber-50 print:border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-amber-400 print:text-amber-700">
                    HOTEL CHECK-IN
                    <span className="text-xs font-normal text-white/60 print:text-gray-500 ml-2">
                      {booking.hotel_checkin && formatDate(booking.hotel_checkin)}
                    </span>
                  </h4>
                  <Badge className="bg-amber-500/30 text-amber-300 print:bg-amber-100 print:text-amber-700">
                    {booking.hotel_status || "Confirmed"}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-amber-400 print:text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-white print:text-black font-medium">{booking.hotel_name}</p>
                      {booking.hotel_address && <p className="text-white/60 print:text-gray-500 text-xs">{booking.hotel_address}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {booking.hotel_confirmation && (
                      <div>
                        <p className="text-white/50 print:text-gray-500 text-xs">Confirmation</p>
                        <p className="text-white print:text-black font-mono">{booking.hotel_confirmation}</p>
                      </div>
                    )}
                    {booking.hotel_room_type && (
                      <div>
                        <p className="text-white/50 print:text-gray-500 text-xs">Room Type</p>
                        <p className="text-white print:text-black capitalize">{booking.hotel_room_type}</p>
                      </div>
                    )}
                    {booking.hotel_phone && (
                      <div>
                        <p className="text-white/50 print:text-gray-500 text-xs">Hotel Phone</p>
                        <p className="text-white print:text-black">{booking.hotel_phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EVENT SESSIONS */}
          {sessions.length > 0 && (
            <div className="relative pl-12 pb-6">
              <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                <Mic className="h-3 w-3 text-white" />
              </div>
              <div className="p-4 bg-indigo-500/10 rounded-lg border border-indigo-500/20 print:bg-indigo-50 print:border-indigo-200">
                <h4 className="font-semibold text-indigo-400 print:text-indigo-700 mb-3">EVENT SESSIONS</h4>
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <div key={session.id} className="flex items-center gap-3 text-sm">
                      <div className="w-20 text-white/60 print:text-gray-500">
                        {formatDate(session.session_date)}
                      </div>
                      <div className="w-24 font-mono text-white/80 print:text-gray-700">
                        {formatTime(session.start_time)}
                      </div>
                      <div className="flex-1 text-white print:text-black">{session.session_name}</div>
                      {session.hall && (
                        <Badge variant="outline" className="text-white/60 border-white/20 print:text-gray-600 print:border-gray-300">
                          {session.hall}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* HOTEL CHECK-OUT */}
          {booking.hotel_name && booking.hotel_checkout && (
            <div className="relative pl-12 pb-6">
              <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center">
                <Hotel className="h-3 w-3 text-white" />
              </div>
              <div className="p-3 bg-amber-600/10 rounded-lg border border-amber-600/20 print:bg-amber-50 print:border-amber-200">
                <h4 className="font-semibold text-amber-400 print:text-amber-700 text-sm flex items-center gap-2">
                  HOTEL CHECK-OUT
                  <span className="text-xs font-normal text-white/60 print:text-gray-500">
                    {formatDate(booking.hotel_checkout)}
                  </span>
                </h4>
              </div>
            </div>
          )}

          {/* AIRPORT DROP */}
          {booking.drop_required && (
            <div className="relative pl-12 pb-6">
              <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                <Car className="h-3 w-3 text-white" />
              </div>
              <div className="p-4 bg-green-600/10 rounded-lg border border-green-600/20 print:bg-green-50 print:border-green-200">
                <h4 className="font-semibold text-green-400 print:text-green-700 mb-2 flex items-center gap-2">
                  <Car className="h-4 w-4" /> AIRPORT DROP
                </h4>
                <p className="text-white/80 print:text-gray-700 text-sm">
                  {booking.drop_details || "Drop arranged - details will be shared"}
                </p>
              </div>
            </div>
          )}

          {/* DEPARTURE FLIGHT */}
          {(booking.return_status === "booked" ||
            booking.return_status === "confirmed" ||
            booking.return_pnr) &&
            booking.return_status !== "not_required" && (
            <div className="relative pl-12 pb-2">
              <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                <PlaneLanding className="h-3 w-3 text-white" />
              </div>
              <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20 print:bg-purple-50 print:border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-purple-400 print:text-purple-700 flex items-center gap-2">
                    DEPARTURE
                    <span className="text-xs font-normal text-white/60 print:text-gray-500">
                      {formatDate(booking.return_departure_date || travel.return_date || travel.departure_date || "")}
                    </span>
                  </h4>
                  <Badge className={cn(
                    "print:bg-purple-100 print:text-purple-700",
                    booking.return_status === "confirmed" ? "bg-green-500/30 text-green-300" :
                    booking.return_status === "booked" ? "bg-purple-500/30 text-purple-300" :
                    "bg-amber-500/30 text-amber-300"
                  )}>
                    {booking.return_status || "Pending"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white print:text-black">
                      {booking.return_departure_time || travel.return_departure_time || "--:--"}
                    </p>
                    <p className="text-sm text-white/70 print:text-gray-600 font-medium">
                      {booking.return_from_city || travel.return_from_city || "-"}
                    </p>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 border-t border-dashed border-white/30 print:border-gray-300" />
                    <Plane className="h-4 w-4 text-white/50 print:text-gray-400" />
                    <div className="flex-1 border-t border-dashed border-white/30 print:border-gray-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white print:text-black">
                      {booking.return_arrival_time || "--:--"}
                    </p>
                    <p className="text-sm text-white/70 print:text-gray-600 font-medium">
                      {booking.return_to_city || travel.return_to_city || "-"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-white/50 print:text-gray-500 text-xs">Flight</p>
                    <p className="text-white print:text-black font-mono">
                      {booking.return_airline} {booking.return_flight_number || travel.return_preferred_time || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50 print:text-gray-500 text-xs">PNR</p>
                    <div className="flex items-center gap-1">
                      <p className="text-white print:text-black font-mono font-bold">
                        {booking.return_pnr || (booking.return_eticket ? "See ticket" : "-")}
                      </p>
                      {booking.return_pnr && (
                        <button onClick={() => { navigator.clipboard.writeText(booking.return_pnr || ""); toast.success("PNR copied!"); }} className="text-white/50 hover:text-white print:hidden">
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {booking.return_seat && (
                    <div>
                      <p className="text-white/50 print:text-gray-500 text-xs">Seat</p>
                      <p className="text-white print:text-black font-mono">{booking.return_seat}</p>
                    </div>
                  )}
                </div>
                {booking.return_eticket && (
                  <div className="mt-3 pt-3 border-t border-white/10 print:border-gray-200">
                    <a href={booking.return_eticket} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1 print:text-purple-600">
                      <Download className="h-4 w-4" /> Download E-Ticket
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10 text-center print:bg-gray-50 print:border-gray-200">
          <p className="text-white/60 text-sm print:text-gray-600">
            For any changes or assistance, contact the organizing team.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
