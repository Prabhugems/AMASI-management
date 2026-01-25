"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  Users,
  Building2,
  BedDouble,
  Clock,
  CheckCircle,
  Check,
  CreditCard,
  CalendarRange,
  ArrowRight,
  Loader2,
  TrendingUp,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Guest = {
  id: string
  attendee_name: string
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
      hotel_cost?: number
      hotel_checkin?: string
      hotel_checkout?: string
      hotel_room_number?: string
    }
  } | null
}

type HotelType = {
  id: string
  name: string
  total_rooms: number
  assigned_rooms: number
  available_rooms: number
}

export default function AccommodationOverviewPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch guests needing accommodation
  const { data: guests, isLoading: guestsLoading } = useQuery({
    queryKey: ["accommodation-overview-guests", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, custom_fields")
        .eq("event_id", eventId)
        .or("attendee_designation.ilike.%speaker%,attendee_designation.ilike.%faculty%,attendee_designation.ilike.%chairperson%,attendee_designation.ilike.%moderator%")

      return (data || []).filter((g: Guest) => g.custom_fields?.travel_details?.hotel_required) as Guest[]
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

  // Fetch room blocks
  const { data: roomBlocks } = useQuery({
    queryKey: ["room-blocks", eventId],
    queryFn: async () => {
      const { data: event } = await (supabase as any)
        .from("events")
        .select("custom_fields")
        .eq("id", eventId)
        .single()

      return event?.custom_fields?.room_blocks || []
    },
  })

  // Calculate nights
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

  // Stats
  const stats = useMemo(() => {
    if (!guests || !hotels) return null

    const totalGuests = guests.length
    const pending = guests.filter(g => (g.custom_fields?.booking?.hotel_status || "pending") === "pending").length
    const booked = guests.filter(g => g.custom_fields?.booking?.hotel_status === "booked").length
    const confirmed = guests.filter(g => g.custom_fields?.booking?.hotel_status === "confirmed").length

    const totalNights = guests.reduce((sum, g) => sum + getNights(g), 0)
    const totalCost = guests.reduce((sum, g) => sum + (g.custom_fields?.booking?.hotel_cost || 0), 0)

    const totalRooms = hotels.reduce((sum, h) => sum + h.total_rooms, 0)
    const assignedRooms = hotels.reduce((sum, h) => sum + h.assigned_rooms, 0)
    const availableRooms = totalRooms - assignedRooms

    const withRoomNumber = guests.filter(g => g.custom_fields?.booking?.hotel_room_number).length
    const pendingRoomAssignment = guests.filter(g =>
      g.custom_fields?.booking?.hotel_name && !g.custom_fields?.booking?.hotel_room_number
    ).length

    return {
      totalGuests,
      pending,
      booked,
      confirmed,
      totalNights,
      totalCost,
      totalHotels: hotels.length,
      totalRooms,
      assignedRooms,
      availableRooms,
      withRoomNumber,
      pendingRoomAssignment,
      roomBlocks: roomBlocks?.length || 0,
    }
  }, [guests, hotels, roomBlocks])

  // Upcoming check-ins (next 7 days)
  const upcomingCheckins = useMemo(() => {
    if (!guests) return []

    const today = new Date()
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    return guests
      .filter(g => {
        const checkin = g.custom_fields?.booking?.hotel_checkin || g.custom_fields?.travel_details?.arrival_date
        if (!checkin) return false
        const date = new Date(checkin)
        return date >= today && date <= weekFromNow
      })
      .sort((a, b) => {
        const dateA = a.custom_fields?.booking?.hotel_checkin || a.custom_fields?.travel_details?.arrival_date || ""
        const dateB = b.custom_fields?.booking?.hotel_checkin || b.custom_fields?.travel_details?.arrival_date || ""
        return dateA.localeCompare(dateB)
      })
      .slice(0, 5)
  }, [guests])

  if (guestsLoading || hotelsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const basePath = `/events/${eventId}/accommodation`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Accommodation Overview</h1>
        <p className="text-muted-foreground">
          Quick summary of accommodation management
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href={`${basePath}/guests`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Guests</span>
          </div>
          <p className="text-3xl font-bold mt-2">{stats?.totalGuests || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Requiring accommodation</p>
        </Link>

        <Link
          href={`${basePath}/hotels`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="text-sm">Hotels</span>
          </div>
          <p className="text-3xl font-bold mt-2">{stats?.totalHotels || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">{stats?.totalRooms || 0} total rooms</p>
        </Link>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BedDouble className="h-4 w-4" />
            <span className="text-sm">Room Nights</span>
          </div>
          <p className="text-3xl font-bold mt-2">{stats?.totalNights || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            <span className="text-sm">Total Cost</span>
          </div>
          <p className="text-2xl font-bold mt-2">₹{(stats?.totalCost || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Booking Status */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Booking Status</h3>
          <div className="space-y-3">
            <Link
              href={`${basePath}/guests?status=pending`}
              className="flex items-center justify-between p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-500" />
                <span className="font-medium">Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-amber-600">{stats?.pending || 0}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>

            <Link
              href={`${basePath}/guests?status=booked`}
              className="flex items-center justify-between p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Booked</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-blue-600">{stats?.booked || 0}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>

            <Link
              href={`${basePath}/guests?status=confirmed`}
              className="flex items-center justify-between p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-500" />
                <span className="font-medium">Confirmed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green-600">{stats?.confirmed || 0}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </div>
        </div>

        {/* Room Inventory */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Room Inventory</h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Room Utilization</span>
                <span className="font-medium">
                  {stats?.assignedRooms || 0}/{stats?.totalRooms || 0} rooms
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{
                    width: `${stats?.totalRooms ? (stats.assignedRooms / stats.totalRooms) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{stats?.availableRooms || 0}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{stats?.assignedRooms || 0}</p>
                <p className="text-xs text-muted-foreground">Assigned</p>
              </div>
            </div>

            <Link
              href={`${basePath}/blocking`}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CalendarRange className="h-5 w-5 text-purple-500" />
                <span className="font-medium">Room Blocks</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{stats?.roomBlocks || 0}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Actions & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Alerts */}
        {(stats?.pending || 0) > 0 || (stats?.pendingRoomAssignment || 0) > 0 ? (
          <div className="bg-card rounded-lg border p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Action Required
            </h3>
            <div className="space-y-2">
              {(stats?.pending || 0) > 0 && (
                <Link
                  href={`${basePath}/guests?status=pending`}
                  className="flex items-center justify-between p-3 rounded-lg bg-amber-50 hover:bg-amber-100"
                >
                  <span className="text-sm">{stats?.pending} guests pending hotel assignment</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              {(stats?.pendingRoomAssignment || 0) > 0 && (
                <Link
                  href={`${basePath}/rooming-list`}
                  className="flex items-center justify-between p-3 rounded-lg bg-orange-50 hover:bg-orange-100"
                >
                  <span className="text-sm">{stats?.pendingRoomAssignment} guests pending room number</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-700">
              <Check className="h-4 w-4" />
              All Good!
            </h3>
            <p className="text-sm text-green-600">All guests have been assigned to hotels.</p>
          </div>
        )}

        {/* Upcoming Check-ins */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Upcoming Check-ins (7 days)
          </h3>
          {upcomingCheckins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No check-ins in the next 7 days
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingCheckins.map((guest) => {
                const checkin = guest.custom_fields?.booking?.hotel_checkin || guest.custom_fields?.travel_details?.arrival_date
                return (
                  <div
                    key={guest.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <span className="text-sm font-medium truncate flex-1">{guest.attendee_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {checkin && new Date(checkin).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                )
              })}
              {upcomingCheckins.length >= 5 && (
                <Link
                  href={`${basePath}/guests`}
                  className="block text-center text-sm text-primary hover:underline pt-2"
                >
                  View all guests →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href={`${basePath}/guests`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Users className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Manage Guests</p>
          <p className="text-xs text-muted-foreground">Assign hotels</p>
        </Link>

        <Link
          href={`${basePath}/hotels`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Building2 className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Manage Hotels</p>
          <p className="text-xs text-muted-foreground">Add & edit hotels</p>
        </Link>

        <Link
          href={`${basePath}/rooming-list`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <BedDouble className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Rooming List</p>
          <p className="text-xs text-muted-foreground">Room assignments</p>
        </Link>

        <Link
          href={`${basePath}/reports`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <TrendingUp className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Reports</p>
          <p className="text-xs text-muted-foreground">Analytics</p>
        </Link>
      </div>
    </div>
  )
}
