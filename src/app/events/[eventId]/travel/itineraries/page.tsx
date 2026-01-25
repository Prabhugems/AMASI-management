"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
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
  Route,
  Loader2,
  Download,
  Search,
  Send,
  Plane,
  Hotel,
  Car,
  Calendar,
  CheckCircle,
  Clock,
  Mail,
  FileText,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Guest = {
  id: string
  attendee_name: string
  attendee_email: string
  custom_fields: {
    portal_token?: string
    travel_details?: {
      arrival_date?: string
      departure_date?: string
    }
    booking?: {
      // Onward flight
      onward_status?: string
      onward_airline?: string
      onward_flight_number?: string
      onward_pnr?: string
      onward_from_city?: string
      onward_to_city?: string
      onward_departure_date?: string
      onward_departure_time?: string
      onward_arrival_date?: string
      onward_arrival_time?: string
      onward_seat?: string
      onward_eticket?: string
      // Return flight
      return_status?: string
      return_airline?: string
      return_flight_number?: string
      return_pnr?: string
      return_from_city?: string
      return_to_city?: string
      return_departure_date?: string
      return_departure_time?: string
      return_arrival_date?: string
      return_arrival_time?: string
      return_seat?: string
      return_eticket?: string
      // Hotel
      hotel_status?: string
      hotel_name?: string
      hotel_address?: string
      hotel_phone?: string
      hotel_confirmation?: string
      hotel_checkin?: string
      hotel_checkout?: string
      hotel_room_type?: string
      // Ground transport
      pickup_required?: boolean
      pickup_time?: string
      pickup_location?: string
      drop_required?: boolean
      drop_time?: string
      drop_location?: string
      // Voucher
      voucher_sent?: boolean
      voucher_sent_date?: string
      [key: string]: string | boolean | undefined
    }
  } | null
}

export default function ItinerariesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event-details", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("id, name, short_name, start_date, end_date, venue_name, city")
        .eq("id", eventId)
        .single()
      return data
    },
  })

  // Fetch guests
  const { data: guests, isLoading } = useQuery({
    queryKey: ["itinerary-guests", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, custom_fields")
        .eq("event_id", eventId)
        .or("attendee_designation.ilike.%speaker%,attendee_designation.ilike.%faculty%,attendee_designation.ilike.%chairperson%,attendee_designation.ilike.%moderator%")
        .order("attendee_name")

      return (data || []).filter((g: Guest) => g.custom_fields?.booking) as Guest[]
    },
  })

  // Filter guests
  const filteredGuests = useMemo(() => {
    if (!guests) return []
    return guests.filter(g =>
      g.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
      g.attendee_email.toLowerCase().includes(search.toLowerCase())
    )
  }, [guests, search])

  // Stats
  const stats = useMemo(() => {
    if (!guests) return { total: 0, sent: 0, pending: 0, ready: 0 }

    const sent = guests.filter(g => g.custom_fields?.booking?.voucher_sent).length
    const ready = guests.filter(g => {
      const booking = g.custom_fields?.booking || {}
      const hasOnward = booking.onward_status === "confirmed" || booking.onward_status === "booked"
      const hasHotel = booking.hotel_status === "confirmed" || booking.hotel_status === "booked"
      return (hasOnward || hasHotel) && !booking.voucher_sent
    }).length

    return {
      total: guests.length,
      sent,
      pending: guests.length - sent,
      ready,
    }
  }, [guests])

  // Check if guest has complete itinerary
  const isComplete = (g: Guest) => {
    const booking = g.custom_fields?.booking || {}
    const hasOnward = booking.onward_status === "confirmed" || booking.onward_status === "booked"
    const hasHotel = booking.hotel_status === "confirmed" || booking.hotel_status === "booked"
    return hasOnward || hasHotel
  }

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedGuests)
    if (newSelection.has(id)) newSelection.delete(id)
    else newSelection.add(id)
    setSelectedGuests(newSelection)
  }

  const selectAllReady = () => {
    const ready = filteredGuests.filter(g => isComplete(g) && !g.custom_fields?.booking?.voucher_sent)
    setSelectedGuests(new Set(ready.map(g => g.id)))
  }

  const sendItineraries = async () => {
    if (selectedGuests.size === 0) return
    setSending(true)

    let successCount = 0
    let failCount = 0

    const eventName = event?.short_name || event?.name || "Event"
    const eventVenue = event?.venue_name ? `${event.venue_name}${event.city ? `, ${event.city}` : ""}` : ""

    for (const guestId of selectedGuests) {
      const guest = guests?.find(g => g.id === guestId)
      if (!guest) continue

      const booking = guest.custom_fields?.booking || {}

      try {
        const response = await fetch("/api/email/travel-itinerary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registration_id: guest.id,
            event_id: eventId,
            speaker_name: guest.attendee_name,
            speaker_email: guest.attendee_email,
            event_name: eventName,
            event_start_date: event?.start_date,
            event_end_date: event?.end_date,
            event_venue: eventVenue,
            booking: {
              // Onward flight
              onward_airline: booking.onward_airline,
              onward_flight_number: booking.onward_flight_number,
              onward_pnr: booking.onward_pnr,
              onward_from_city: booking.onward_from_city,
              onward_to_city: booking.onward_to_city,
              onward_departure_date: booking.onward_departure_date,
              onward_departure_time: booking.onward_departure_time,
              onward_arrival_date: booking.onward_arrival_date,
              onward_arrival_time: booking.onward_arrival_time,
              onward_seat: booking.onward_seat,
              onward_eticket: booking.onward_eticket,
              // Return flight
              return_airline: booking.return_airline,
              return_flight_number: booking.return_flight_number,
              return_pnr: booking.return_pnr,
              return_from_city: booking.return_from_city,
              return_to_city: booking.return_to_city,
              return_departure_date: booking.return_departure_date,
              return_departure_time: booking.return_departure_time,
              return_arrival_date: booking.return_arrival_date,
              return_arrival_time: booking.return_arrival_time,
              return_seat: booking.return_seat,
              return_eticket: booking.return_eticket,
              // Hotel
              hotel_name: booking.hotel_name,
              hotel_address: booking.hotel_address,
              hotel_phone: booking.hotel_phone,
              hotel_confirmation: booking.hotel_confirmation,
              hotel_checkin: booking.hotel_checkin,
              hotel_checkout: booking.hotel_checkout,
              hotel_room_type: booking.hotel_room_type,
              // Ground transport
              pickup_required: booking.pickup_required,
              pickup_details: booking.pickup_details,
              drop_required: booking.drop_required,
              drop_details: booking.drop_details,
            },
          }),
        })

        if (response.ok) {
          // Mark voucher as sent
          const { data: current } = await (supabase as any)
            .from("registrations")
            .select("custom_fields")
            .eq("id", guest.id)
            .single()

          await (supabase as any)
            .from("registrations")
            .update({
              custom_fields: {
                ...(current?.custom_fields || {}),
                booking: {
                  ...(current?.custom_fields?.booking || {}),
                  voucher_sent: true,
                  voucher_sent_date: new Date().toISOString(),
                },
              },
            })
            .eq("id", guest.id)

          successCount++
        } else {
          failCount++
        }
      } catch (error) {
        console.error("Error sending itinerary:", error)
        failCount++
      }
    }

    setSending(false)
    queryClient.invalidateQueries({ queryKey: ["itinerary-guests", eventId] })

    if (successCount > 0) {
      toast.success(`Sent itineraries to ${successCount} guest${successCount > 1 ? "s" : ""}`)
    }
    if (failCount > 0) {
      toast.error(`Failed to send to ${failCount} guest${failCount > 1 ? "s" : ""}`)
    }
    setSelectedGuests(new Set())
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  }

  const exportItineraries = () => {
    const headers = ["Guest", "Email", "Onward Flight", "Onward Date", "Return Flight", "Return Date", "Hotel", "Check-in", "Check-out", "Voucher Sent"]
    const rows = filteredGuests.map(g => {
      const b = g.custom_fields?.booking || {}
      return [g.attendee_name, g.attendee_email, b.onward_flight_number || "", b.onward_departure_date || "", b.return_flight_number || "", b.return_departure_date || "", b.hotel_name || "", b.hotel_checkin || "", b.hotel_checkout || "", b.voucher_sent ? "Yes" : "No"]
    })

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `itineraries-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Itineraries exported")
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Itineraries</h1>
          <p className="text-muted-foreground">Send travel itineraries with calendar invites</p>
        </div>
        <Button variant="outline" onClick={exportItineraries}><Download className="h-4 w-4 mr-2" />Export</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><Route className="h-4 w-4" /><span className="text-sm">Total</span></div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600"><CheckCircle className="h-4 w-4" /><span className="text-sm">Sent</span></div>
          <p className="text-2xl font-bold mt-1">{stats.sent}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-500"><Clock className="h-4 w-4" /><span className="text-sm">Pending</span></div>
          <p className="text-2xl font-bold mt-1">{stats.pending}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-500"><FileText className="h-4 w-4" /><span className="text-sm">Ready to Send</span></div>
          <p className="text-2xl font-bold mt-1">{stats.ready}</p>
        </div>
      </div>

      {/* Actions */}
      {selectedGuests.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Mail className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-800">{selectedGuests.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setSelectedGuests(new Set())}>Clear</Button>
          <Button size="sm" onClick={sendItineraries} disabled={sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Sending..." : "Send Itineraries"}
          </Button>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search guests..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm" onClick={selectAllReady}>Select Ready ({stats.ready})</Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedGuests.size === filteredGuests.length && filteredGuests.length > 0}
                  onCheckedChange={() => {
                    if (selectedGuests.size === filteredGuests.length) setSelectedGuests(new Set())
                    else setSelectedGuests(new Set(filteredGuests.map(g => g.id)))
                  }}
                />
              </TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Onward</TableHead>
              <TableHead>Return</TableHead>
              <TableHead>Hotel</TableHead>
              <TableHead>Transport</TableHead>
              <TableHead>Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGuests.map((guest) => {
              const b = guest.custom_fields?.booking || {}
              const complete = isComplete(guest)

              return (
                <TableRow key={guest.id} className={cn(!complete && "opacity-50")}>
                  <TableCell>
                    <Checkbox
                      checked={selectedGuests.has(guest.id)}
                      onCheckedChange={() => toggleSelection(guest.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{guest.attendee_name}</p>
                    <p className="text-xs text-muted-foreground">{guest.attendee_email}</p>
                  </TableCell>
                  <TableCell>
                    {b.onward_flight_number ? (
                      <div className="flex items-center gap-2">
                        <Plane className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="font-mono text-sm">{b.onward_flight_number}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(b.onward_departure_date)} {b.onward_departure_time}</p>
                        </div>
                      </div>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {b.return_flight_number ? (
                      <div className="flex items-center gap-2">
                        <Plane className="h-4 w-4 text-orange-500" />
                        <div>
                          <p className="font-mono text-sm">{b.return_flight_number}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(b.return_departure_date)} {b.return_departure_time}</p>
                        </div>
                      </div>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {b.hotel_name ? (
                      <div className="flex items-center gap-2">
                        <Hotel className="h-4 w-4 text-purple-500" />
                        <div>
                          <p className="text-sm">{b.hotel_name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(b.hotel_checkin)} - {formatDate(b.hotel_checkout)}</p>
                        </div>
                      </div>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {b.pickup_required && <Badge variant="outline" className="text-xs"><Car className="h-3 w-3 mr-1" />Pick</Badge>}
                      {b.drop_required && <Badge variant="outline" className="text-xs"><Car className="h-3 w-3 mr-1" />Drop</Badge>}
                      {!b.pickup_required && !b.drop_required && <span className="text-muted-foreground">-</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {b.voucher_sent ? (
                      <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
