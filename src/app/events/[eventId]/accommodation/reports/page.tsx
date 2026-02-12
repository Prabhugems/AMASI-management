"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  FileBarChart,
  Loader2,
  Download,
  Building2,
  Users,
  BedDouble,
  CreditCard,
  Calendar,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"

type Guest = {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string
  custom_fields: {
    assigned_hotel_id?: string
    travel_details?: {
      arrival_date?: string
      departure_date?: string
      hotel_required?: boolean
    }
    booking?: {
      hotel_status?: string
      hotel_name?: string
      hotel_room_type?: string
      hotel_checkin?: string
      hotel_checkout?: string
      hotel_cost?: number
    }
  } | null
}

type HotelType = {
  id: string
  name: string
  total_rooms: number
  assigned_rooms: number
  available_rooms: number
  standard_rate: number
  deluxe_rate: number
  suite_rate: number
}

export default function AccommodationReportsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch guests
  const { data: guests, isLoading: guestsLoading } = useQuery({
    queryKey: ["accommodation-report-guests", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, registration_number, attendee_name, attendee_email, attendee_phone, custom_fields")
        .eq("event_id", eventId)

      return (data || []).filter((g: any) =>
        g.custom_fields?.travel_details?.hotel_required ||
        g.custom_fields?.assigned_hotel_id ||
        g.custom_fields?.booking?.hotel_name
      ) as Guest[]
    },
  })

  // Fetch hotels
  const { data: hotels, isLoading: hotelsLoading } = useQuery({
    queryKey: ["event-hotels", eventId],
    queryFn: async () => {
      const response = await fetch(`/api/hotels?event_id=${eventId}`)
      if (!response.ok) throw new Error("Failed to fetch hotels")
      return response.json() as Promise<HotelType[]>
    },
  })

  // Calculate nights for a guest
  const getNights = (guest: Guest) => {
    const booking = guest.custom_fields?.booking || {}
    const travel = guest.custom_fields?.travel_details || {}
    const checkin = booking.hotel_checkin || travel.arrival_date
    const checkout = booking.hotel_checkout || travel.departure_date

    if (checkin && checkout) {
      const start = new Date(checkin)
      const end = new Date(checkout)
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      return diff > 0 ? diff : 0
    }
    return 0
  }

  // Summary stats
  const summary = useMemo(() => {
    if (!guests || !hotels) return null

    const totalGuests = guests.length
    const assignedGuests = guests.filter(g => g.custom_fields?.booking?.hotel_name).length
    const pendingGuests = totalGuests - assignedGuests

    const totalNights = guests.reduce((sum, g) => sum + getNights(g), 0)
    const totalCost = guests.reduce((sum, g) => sum + (g.custom_fields?.booking?.hotel_cost || 0), 0)

    const totalRooms = hotels.reduce((sum, h) => sum + h.total_rooms, 0)
    const assignedRooms = hotels.reduce((sum, h) => sum + h.assigned_rooms, 0)
    const availableRooms = totalRooms - assignedRooms
    const occupancyRate = totalRooms > 0 ? Math.round((assignedRooms / totalRooms) * 100) : 0

    // Room type distribution
    const roomTypes: Record<string, number> = {}
    guests.forEach(g => {
      const type = g.custom_fields?.booking?.hotel_room_type || "unassigned"
      roomTypes[type] = (roomTypes[type] || 0) + 1
    })

    // Status distribution
    const statuses: Record<string, number> = { pending: 0, booked: 0, confirmed: 0 }
    guests.forEach(g => {
      const status = g.custom_fields?.booking?.hotel_status || "pending"
      statuses[status] = (statuses[status] || 0) + 1
    })

    return {
      totalGuests,
      assignedGuests,
      pendingGuests,
      totalNights,
      totalCost,
      totalRooms,
      assignedRooms,
      availableRooms,
      occupancyRate,
      roomTypes,
      statuses,
    }
  }, [guests, hotels])

  // Hotel-wise breakdown
  const hotelBreakdown = useMemo(() => {
    if (!guests || !hotels) return []

    return hotels.map(hotel => {
      const hotelGuests = guests.filter(g => g.custom_fields?.assigned_hotel_id === hotel.id)
      const nights = hotelGuests.reduce((sum, g) => sum + getNights(g), 0)
      const cost = hotelGuests.reduce((sum, g) => sum + (g.custom_fields?.booking?.hotel_cost || 0), 0)

      return {
        id: hotel.id,
        name: hotel.name,
        totalRooms: hotel.total_rooms,
        assignedRooms: hotel.assigned_rooms,
        availableRooms: hotel.available_rooms,
        guests: hotelGuests.length,
        nights,
        cost,
        occupancy: hotel.total_rooms > 0 ? Math.round((hotel.assigned_rooms / hotel.total_rooms) * 100) : 0,
      }
    })
  }, [guests, hotels])

  // Date-wise check-in/out
  const dateWise = useMemo(() => {
    if (!guests) return []

    const dates: Record<string, { checkIn: number; checkOut: number }> = {}

    guests.forEach(g => {
      const checkin = g.custom_fields?.booking?.hotel_checkin || g.custom_fields?.travel_details?.arrival_date
      const checkout = g.custom_fields?.booking?.hotel_checkout || g.custom_fields?.travel_details?.departure_date

      if (checkin) {
        dates[checkin] = dates[checkin] || { checkIn: 0, checkOut: 0 }
        dates[checkin].checkIn++
      }
      if (checkout) {
        dates[checkout] = dates[checkout] || { checkIn: 0, checkOut: 0 }
        dates[checkout].checkOut++
      }
    })

    return Object.entries(dates)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }))
  }, [guests])

  // Export full report
  const exportCSV = () => {
    if (!guests) return

    const headers = ["Reg Number", "Name", "Email", "Phone", "Hotel", "Room Type", "Check-in", "Check-out", "Nights", "Cost", "Status"]
    const rows = guests.map((g: Guest) => {
      const b = g.custom_fields?.booking || {}
      const t = g.custom_fields?.travel_details || {}
      const checkin = b.hotel_checkin || t.arrival_date || ""
      const checkout = b.hotel_checkout || t.departure_date || ""
      return [
        g.registration_number || "",
        `"${(g.attendee_name || '').replace(/"/g, '""')}"`,
        g.attendee_email || "",
        g.attendee_phone || "",
        b.hotel_name || "",
        b.hotel_room_type || "",
        checkin,
        checkout,
        getNights(g),
        b.hotel_cost || 0,
        b.hotel_status || "pending",
      ]
    })

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `accommodation-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Report exported")
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
  }

  if (guestsLoading || hotelsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-dashed">
        <FileBarChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No data available</h3>
        <p className="text-muted-foreground">Add guests and hotels to view reports</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Accommodation Reports</h1>
          <p className="text-muted-foreground">Analytics and summaries</p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total Guests</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{summary.totalGuests}</p>
          <p className="text-xs text-muted-foreground">
            {summary.assignedGuests} assigned, {summary.pendingGuests} pending
          </p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BedDouble className="h-4 w-4" />
            <span className="text-sm">Room Nights</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{summary.totalNights}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            <span className="text-sm">Total Cost</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">₹{summary.totalCost.toLocaleString()}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Occupancy Rate</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{summary.occupancyRate}%</p>
          <p className="text-xs text-muted-foreground">
            {summary.assignedRooms}/{summary.totalRooms} rooms
          </p>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Booking Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Pending</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full"
                    style={{ width: `${(summary.statuses.pending / summary.totalGuests) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8">{summary.statuses.pending}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Booked</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${(summary.statuses.booked / summary.totalGuests) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8">{summary.statuses.booked}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Confirmed</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${(summary.statuses.confirmed / summary.totalGuests) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8">{summary.statuses.confirmed}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BedDouble className="h-4 w-4" />
            Room Types
          </h3>
          <div className="space-y-3">
            {Object.entries(summary.roomTypes).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm capitalize">{type}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ width: `${(count / summary.totalGuests) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hotel-wise Breakdown */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/50">
          <h3 className="font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Hotel-wise Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hotel</TableHead>
              <TableHead className="text-right">Rooms</TableHead>
              <TableHead className="text-right">Guests</TableHead>
              <TableHead className="text-right">Nights</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Occupancy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hotelBreakdown.map((hotel) => (
              <TableRow key={hotel.id}>
                <TableCell className="font-medium">{hotel.name}</TableCell>
                <TableCell className="text-right">
                  {hotel.assignedRooms}/{hotel.totalRooms}
                </TableCell>
                <TableCell className="text-right">{hotel.guests}</TableCell>
                <TableCell className="text-right">{hotel.nights}</TableCell>
                <TableCell className="text-right">₹{hotel.cost.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${hotel.occupancy}%` }}
                      />
                    </div>
                    <span className="text-sm">{hotel.occupancy}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Date-wise Check-in/out */}
      {dateWise.length > 0 && (
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/50">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Daily Check-in / Check-out
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right text-green-600">Check-in</TableHead>
                <TableHead className="text-right text-red-600">Check-out</TableHead>
                <TableHead className="text-right">Net Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dateWise.map((day) => (
                <TableRow key={day.date}>
                  <TableCell className="font-medium">{formatDate(day.date)}</TableCell>
                  <TableCell className="text-right text-green-600">+{day.checkIn}</TableCell>
                  <TableCell className="text-right text-red-600">-{day.checkOut}</TableCell>
                  <TableCell className="text-right font-medium">
                    {day.checkIn - day.checkOut > 0 ? "+" : ""}{day.checkIn - day.checkOut}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      )}
    </div>
  )
}
