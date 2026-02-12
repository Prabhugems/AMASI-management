"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  Hotel,
  MoreVertical,
  Loader2,
  CheckCircle,
  Clock,
  Phone,
  Mail,
  Edit,
  ExternalLink,
  Download,
  Check,
  User,
  BedDouble,
  CalendarDays,
  CheckSquare,
  Square,
  Car,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Sheet,
  ResizableSheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type Speaker = {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  status: string
  custom_fields: {
    photo_url?: string
    portal_token?: string
    needs_travel?: boolean
    assigned_hotel_id?: string
    travel_details?: {
      mode?: string
      arrival_date?: string
      departure_date?: string
      hotel_check_in?: string
      hotel_check_out?: string
      from_city?: string
      hotel_required?: boolean
      hotel_nights?: number
      hotel_room_type?: string
      special_requirements?: string
      pickup_required?: boolean
      drop_required?: boolean
    }
    booking?: {
      hotel_status?: "pending" | "booked" | "confirmed"
      hotel_name?: string
      hotel_address?: string
      hotel_phone?: string
      hotel_confirmation?: string
      hotel_checkin?: string
      hotel_checkout?: string
      hotel_room_type?: string
      hotel_room_number?: string
      hotel_cost?: number
    }
  } | null
}

type HotelType = {
  id: string
  name: string
  address: string | null
  phone: string | null
  total_rooms: number
  assigned_rooms: number
  available_rooms: number
}

const BOOKING_STATUS = {
  pending: { label: "Pending", color: "bg-amber-500", icon: Clock },
  booked: { label: "Booked", color: "bg-blue-500", icon: CheckCircle },
  confirmed: { label: "Confirmed", color: "bg-green-500", icon: Check },
}

export default function AccommodationGuestsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "booked" | "confirmed">("all")
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null)
  const [editingBooking, setEditingBooking] = useState<Speaker | null>(null)

  // Bulk selection
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set())
  const [showBulkAssign, setShowBulkAssign] = useState(false)
  const [bulkAssignHotelId, setBulkAssignHotelId] = useState("")

  // Booking form state
  const [bookingForm, setBookingForm] = useState({
    hotel_status: "pending" as "pending" | "booked" | "confirmed",
    assigned_hotel_id: "",
    hotel_name: "",
    hotel_address: "",
    hotel_phone: "",
    hotel_confirmation: "",
    hotel_checkin: "",
    hotel_checkout: "",
    hotel_room_type: "",
    hotel_room_number: "",
    hotel_cost: 0,
  })

  // Fetch guests who need accommodation
  const { data: speakers, isLoading } = useQuery({
    queryKey: ["accommodation-speakers", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("*")
        .eq("event_id", eventId)
        .or("attendee_designation.ilike.%speaker%,attendee_designation.ilike.%faculty%,attendee_designation.ilike.%chairperson%,attendee_designation.ilike.%moderator%")
        .order("attendee_name")

      return (data || []).filter((s: Speaker) => s.custom_fields?.travel_details?.hotel_required) as Speaker[]
    },
  })

  // Fetch hotels
  const { data: hotels } = useQuery({
    queryKey: ["event-hotels", eventId],
    queryFn: async () => {
      const response = await fetch(`/api/hotels?event_id=${eventId}`)
      if (!response.ok) throw new Error("Failed to fetch hotels")
      return response.json() as Promise<HotelType[]>
    },
  })

  // Bulk assign mutation
  const bulkAssign = useMutation({
    mutationFn: async ({ hotelId, guestIds }: { hotelId: string; guestIds: string[] }) => {
      const hotel = hotels?.find(h => h.id === hotelId)
      if (!hotel) throw new Error("Hotel not found")

      const response = await fetch("/api/hotels/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel_id: hotelId,
          guest_ids: guestIds,
          hotel_name: hotel.name,
          hotel_address: hotel.address,
          hotel_phone: hotel.phone,
        }),
      })
      if (!response.ok) throw new Error("Failed to assign guests")
      return response.json()
    },
    onSuccess: (data) => {
      toast.success(data.message)
      setShowBulkAssign(false)
      setSelectedGuests(new Set())
      setBulkAssignHotelId("")
      queryClient.invalidateQueries({ queryKey: ["accommodation-speakers", eventId] })
      queryClient.invalidateQueries({ queryKey: ["event-hotels", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Update airport transfer settings
  const updateAirportTransfer = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: "pickup_required" | "drop_required"; value: boolean }) => {
      const { data: current } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", id)
        .single()

      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(current?.custom_fields || {}),
            travel_details: {
              ...(current?.custom_fields?.travel_details || {}),
              [field]: value,
            },
          },
        })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: (_, { field, value }) => {
      const label = field === "pickup_required" ? "Airport pickup" : "Airport drop"
      toast.success(`${label} ${value ? "enabled" : "disabled"}`)
      queryClient.invalidateQueries({ queryKey: ["accommodation-speakers", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Filter speakers
  const filteredSpeakers = useMemo(() => {
    if (!speakers) return []

    return speakers.filter((speaker) => {
      const matchesSearch = !search ||
        speaker.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
        speaker.attendee_email.toLowerCase().includes(search.toLowerCase()) ||
        speaker.custom_fields?.booking?.hotel_name?.toLowerCase().includes(search.toLowerCase())

      const hotelStatus = speaker.custom_fields?.booking?.hotel_status || "pending"
      const matchesStatus = statusFilter === "all" || hotelStatus === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [speakers, search, statusFilter])

  // Calculate nights
  const getNights = (s: Speaker) => {
    const booking = s.custom_fields?.booking || {}
    const travelDetails = s.custom_fields?.travel_details || {}

    if (travelDetails.hotel_nights) return travelDetails.hotel_nights

    const checkin = booking.hotel_checkin || travelDetails.arrival_date || travelDetails.hotel_check_in
    const checkout = booking.hotel_checkout || travelDetails.departure_date || travelDetails.hotel_check_out

    if (checkin && checkout) {
      const start = new Date(checkin)
      const end = new Date(checkout)
      const diffTime = end.getTime() - start.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays > 0 ? diffDays : 0
    }
    return 0
  }

  // Stats
  const stats = useMemo(() => {
    if (!speakers) return { total: 0, pending: 0, booked: 0, confirmed: 0 }
    return {
      total: speakers.length,
      pending: speakers.filter(s => (s.custom_fields?.booking?.hotel_status || "pending") === "pending").length,
      booked: speakers.filter(s => s.custom_fields?.booking?.hotel_status === "booked").length,
      confirmed: speakers.filter(s => s.custom_fields?.booking?.hotel_status === "confirmed").length,
    }
  }, [speakers])

  // Quick status update mutation
  const quickUpdateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pending" | "booked" | "confirmed" }) => {
      const { data: current } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", id)
        .single()

      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(current?.custom_fields || {}),
            booking: {
              ...(current?.custom_fields?.booking || {}),
              hotel_status: status,
            },
          },
        })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: (_, { status }) => {
      toast.success(`Status updated to ${status}`)
      queryClient.invalidateQueries({ queryKey: ["accommodation-speakers", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Update booking mutation
  const updateBooking = useMutation({
    mutationFn: async ({ id, booking }: { id: string; booking: typeof bookingForm }) => {
      const { data: current } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", id)
        .single()

      // Extract assigned_hotel_id to save at top level (for hotel count tracking)
      const { assigned_hotel_id, ...bookingData } = booking

      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(current?.custom_fields || {}),
            assigned_hotel_id: assigned_hotel_id || null, // Save at top level for hotel counts
            booking: {
              ...(current?.custom_fields?.booking || {}),
              ...bookingData,
            },
          },
        })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Booking details updated")
      setEditingBooking(null)
      queryClient.invalidateQueries({ queryKey: ["accommodation-speakers", eventId] })
      queryClient.invalidateQueries({ queryKey: ["event-hotels", eventId] }) // Refresh hotel counts
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const openEditBooking = (speaker: Speaker) => {
    const booking = speaker.custom_fields?.booking || {}
    const travelDetails = speaker.custom_fields?.travel_details || {}
    setBookingForm({
      hotel_status: booking.hotel_status || "pending",
      assigned_hotel_id: speaker.custom_fields?.assigned_hotel_id || "",
      hotel_name: booking.hotel_name || "",
      hotel_address: booking.hotel_address || "",
      hotel_phone: booking.hotel_phone || "",
      hotel_confirmation: booking.hotel_confirmation || "",
      hotel_checkin: booking.hotel_checkin || travelDetails.arrival_date || "",
      hotel_checkout: booking.hotel_checkout || travelDetails.departure_date || "",
      hotel_room_type: booking.hotel_room_type || "",
      hotel_room_number: booking.hotel_room_number || "",
      hotel_cost: booking.hotel_cost || 0,
    })
    setEditingBooking(speaker)
  }

  const toggleGuestSelection = (guestId: string) => {
    const newSelection = new Set(selectedGuests)
    if (newSelection.has(guestId)) {
      newSelection.delete(guestId)
    } else {
      newSelection.add(guestId)
    }
    setSelectedGuests(newSelection)
  }

  const clearSelection = () => setSelectedGuests(new Set())

  const exportToCSV = () => {
    const headers = ["Name", "Email", "Phone", "Nights", "Check-in", "Check-out", "Status", "Hotel Name", "Room", "Confirmation"]

    const rows = filteredSpeakers.map(s => [
      s.attendee_name,
      s.attendee_email,
      s.attendee_phone || "",
      getNights(s) || "",
      s.custom_fields?.booking?.hotel_checkin || s.custom_fields?.travel_details?.arrival_date || "",
      s.custom_fields?.booking?.hotel_checkout || s.custom_fields?.travel_details?.departure_date || "",
      s.custom_fields?.booking?.hotel_status || "pending",
      s.custom_fields?.booking?.hotel_name || "",
      s.custom_fields?.booking?.hotel_room_number || "",
      s.custom_fields?.booking?.hotel_confirmation || "",
    ])

    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `accommodation-guests-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Guest list exported")
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Guest Assignments</h1>
          <p className="text-muted-foreground">
            Manage hotel assignments for {speakers?.length || 0} guests
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Bulk Selection Toolbar */}
      {selectedGuests.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <CheckSquare className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-800">{selectedGuests.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={clearSelection}>
            Clear
          </Button>
          <Button
            size="sm"
            onClick={() => setShowBulkAssign(true)}
            disabled={!hotels?.length}
          >
            <Hotel className="h-4 w-4 mr-2" />
            Assign to Hotel
          </Button>
        </div>
      )}

      {/* Status Filter Cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: "all", label: "All Guests", count: stats.total, icon: User, color: "primary" },
          { key: "pending", label: "Pending", count: stats.pending, icon: Clock, color: "amber-500" },
          { key: "booked", label: "Booked", count: stats.booked, icon: CheckCircle, color: "blue-500" },
          { key: "confirmed", label: "Confirmed", count: stats.confirmed, icon: Check, color: "green-500" },
        ].map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              onClick={() => setStatusFilter(item.key as any)}
              className={cn(
                "bg-card rounded-lg border p-3 text-left transition-all hover:shadow-md",
                statusFilter === item.key && "ring-2 ring-primary"
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", `text-${item.color}`)} />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{item.count}</p>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, hotel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {(statusFilter !== "all" || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setSearch("") }}>
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {filteredSpeakers.length} guest{filteredSpeakers.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {filteredSpeakers.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Hotel className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No guests found</h3>
          <p className="text-muted-foreground">
            {speakers?.length === 0 ? "No speakers have requested accommodation" : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      if (selectedGuests.size === filteredSpeakers.length) {
                        clearSelection()
                      } else {
                        setSelectedGuests(new Set(filteredSpeakers.map(s => s.id)))
                      }
                    }}
                  >
                    {selectedGuests.size === filteredSpeakers.length && filteredSpeakers.length > 0 ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </Button>
                </TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Nights</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Hotel</TableHead>
                <TableHead>Room</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSpeakers.map((speaker) => {
                const hotelStatus = speaker.custom_fields?.booking?.hotel_status || "pending"
                const StatusIcon = BOOKING_STATUS[hotelStatus].icon
                const isSelected = selectedGuests.has(speaker.id)

                return (
                  <TableRow
                    key={speaker.id}
                    className={cn("cursor-pointer hover:bg-muted/50", isSelected && "bg-blue-50")}
                    onClick={() => openEditBooking(speaker)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleGuestSelection(speaker.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{speaker.attendee_name}</p>
                      <p className="text-xs text-muted-foreground">{speaker.attendee_email}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <BedDouble className="h-4 w-4 text-muted-foreground" />
                        <span>{getNights(speaker) || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        <div className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-green-500" />
                          {formatDate(speaker.custom_fields?.booking?.hotel_checkin || speaker.custom_fields?.travel_details?.arrival_date)}
                        </div>
                        <div className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-red-500" />
                          {formatDate(speaker.custom_fields?.booking?.hotel_checkout || speaker.custom_fields?.travel_details?.departure_date)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {speaker.custom_fields?.booking?.hotel_name || (
                        <span className="text-muted-foreground">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {speaker.custom_fields?.booking?.hotel_room_number || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn("text-white text-xs", BOOKING_STATUS[hotelStatus].color)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {BOOKING_STATUS[hotelStatus].label}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {hotelStatus !== "booked" && (
                            <DropdownMenuItem onClick={() => quickUpdateStatus.mutate({ id: speaker.id, status: "booked" })}>
                              <CheckCircle className="h-4 w-4 mr-2 text-blue-500" />
                              Mark as Booked
                            </DropdownMenuItem>
                          )}
                          {hotelStatus !== "confirmed" && (
                            <DropdownMenuItem onClick={() => quickUpdateStatus.mutate({ id: speaker.id, status: "confirmed" })}>
                              <Check className="h-4 w-4 mr-2 text-green-500" />
                              Mark as Confirmed
                            </DropdownMenuItem>
                          )}
                          {hotelStatus !== "pending" && (
                            <DropdownMenuItem onClick={() => quickUpdateStatus.mutate({ id: speaker.id, status: "pending" })}>
                              <Clock className="h-4 w-4 mr-2 text-amber-500" />
                              Mark as Pending
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEditBooking(speaker)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Booking
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            const token = speaker.custom_fields?.portal_token
                            if (token) window.open(`/speaker/${token}`, "_blank")
                          }}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Portal
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => window.open(`mailto:${speaker.attendee_email}`, "_blank")}>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Email
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Booking Sheet - Side by Side */}
      <Sheet open={!!editingBooking} onOpenChange={(open) => !open && setEditingBooking(null)}>
        <ResizableSheetContent defaultWidth={750} minWidth={500} maxWidth={1000} storageKey="accommodation-booking-sheet-width" className="overflow-y-auto p-0">
          {/* Header with gradient */}
          <div className="px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-purple-100/50">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500">
                  <Hotel className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-lg font-semibold">{editingBooking?.attendee_name}</p>
                  <p className="text-sm font-normal text-muted-foreground">Accommodation Booking</p>
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>

          <div className="grid grid-cols-2 gap-0 divide-x">
            {/* LEFT: Guest's Request */}
            <div className="p-5 bg-slate-50/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-md bg-blue-100">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <h3 className="font-semibold text-sm">Guest&apos;s Request</h3>
              </div>
              {editingBooking && (() => {
                const travel = editingBooking.custom_fields?.travel_details
                const photoUrl = editingBooking.custom_fields?.photo_url
                return (
                  <div className="space-y-4">
                    {/* Guest Photo & Contact Card */}
                    <div className="p-4 bg-white rounded-xl border shadow-sm">
                      <div className="flex items-start gap-3">
                        {photoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={photoUrl} alt={editingBooking.attendee_name} className="w-16 h-16 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center border">
                            <User className="h-8 w-8 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{editingBooking.attendee_name}</p>
                          {editingBooking.attendee_phone && (
                            <a href={`tel:${editingBooking.attendee_phone}`} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline mt-1">
                              <Phone className="h-3 w-3" />
                              {editingBooking.attendee_phone}
                            </a>
                          )}
                          {editingBooking.attendee_email && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 truncate">
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{editingBooking.attendee_email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-white rounded-xl border shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1">
                          <CalendarDays className="h-3 w-3 text-green-500" />
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Check-in</p>
                        </div>
                        <p className="font-semibold">{travel?.hotel_check_in ? new Date(travel.hotel_check_in).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-"}</p>
                      </div>
                      <div className="p-4 bg-white rounded-xl border shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1">
                          <CalendarDays className="h-3 w-3 text-red-500" />
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Check-out</p>
                        </div>
                        <p className="font-semibold">{travel?.hotel_check_out ? new Date(travel.hotel_check_out).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-"}</p>
                      </div>
                    </div>
                    <div className="p-4 bg-white rounded-xl border shadow-sm">
                      <div className="flex items-center gap-1.5 mb-1">
                        <BedDouble className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Room Type Requested</p>
                      </div>
                      <p className="font-medium capitalize">{travel?.hotel_room_type || "-"}</p>
                    </div>
                    {travel?.special_requirements && (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <p className="text-xs text-amber-700 font-medium uppercase tracking-wide mb-1">Special Requirements</p>
                        <p className="text-sm">{travel.special_requirements}</p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* RIGHT: Booking Form */}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-md bg-green-100">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <h3 className="font-semibold text-sm">Booking Details</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <Label className="font-medium">Status</Label>
                  <Select
                    value={bookingForm.hotel_status}
                    onValueChange={(v: any) => setBookingForm({ ...bookingForm, hotel_status: v })}
                  >
                    <SelectTrigger className="w-[140px] bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">⏳ Pending</SelectItem>
                      <SelectItem value="booked">📋 Booked</SelectItem>
                      <SelectItem value="confirmed">✅ Confirmed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Hotel</Label>
                  <Select
                    value={bookingForm.assigned_hotel_id || "none"}
                    onValueChange={(v) => {
                      if (v === "none") {
                        setBookingForm({ ...bookingForm, assigned_hotel_id: "", hotel_name: "" })
                      } else {
                        const hotel = hotels?.find(h => h.id === v)
                        setBookingForm({
                          ...bookingForm,
                          assigned_hotel_id: v,
                          hotel_name: hotel?.name || "",
                          hotel_address: hotel?.address || "",
                          hotel_phone: hotel?.phone || "",
                        })
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select hotel..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not assigned</SelectItem>
                      {hotels?.map((hotel) => (
                        <SelectItem key={hotel.id} value={hotel.id}>
                          🏨 {hotel.name} ({hotel.available_rooms} avail.)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Room #</Label>
                    <Input
                      value={bookingForm.hotel_room_number}
                      onChange={(e) => setBookingForm({ ...bookingForm, hotel_room_number: e.target.value })}
                      placeholder="301"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Confirmation #</Label>
                    <Input
                      value={bookingForm.hotel_confirmation}
                      onChange={(e) => setBookingForm({ ...bookingForm, hotel_confirmation: e.target.value })}
                      placeholder="CONF123"
                      className="font-mono mt-1.5 uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Check-in</Label>
                    <Input
                      type="date"
                      value={bookingForm.hotel_checkin}
                      onChange={(e) => setBookingForm({ ...bookingForm, hotel_checkin: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Check-out</Label>
                    <Input
                      type="date"
                      value={bookingForm.hotel_checkout}
                      onChange={(e) => setBookingForm({ ...bookingForm, hotel_checkout: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Room Type</Label>
                    <Select
                      value={bookingForm.hotel_room_type || "standard"}
                      onValueChange={(v) => setBookingForm({ ...bookingForm, hotel_room_type: v })}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="deluxe">Deluxe</SelectItem>
                        <SelectItem value="suite">Suite</SelectItem>
                        <SelectItem value="executive">Executive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Cost (₹)</Label>
                    <Input
                      type="number"
                      value={bookingForm.hotel_cost || ""}
                      onChange={(e) => setBookingForm({ ...bookingForm, hotel_cost: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
            <Button variant="outline" onClick={() => setEditingBooking(null)}>Cancel</Button>
            <Button
              onClick={() => editingBooking && updateBooking.mutate({ id: editingBooking.id, booking: bookingForm })}
              disabled={updateBooking.isPending}
              className="min-w-[120px]"
            >
              {updateBooking.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><Check className="h-4 w-4 mr-2" />Save Booking</>
              )}
            </Button>
          </div>
        </ResizableSheetContent>
      </Sheet>

      {/* Guest Details Sheet */}
      <Sheet open={!!selectedSpeaker} onOpenChange={(open) => !open && setSelectedSpeaker(null)}>
        <ResizableSheetContent defaultWidth={400} minWidth={350} maxWidth={700} storageKey="accommodation-guest-sheet-width" className="overflow-y-auto">
          {selectedSpeaker && (
            <>
              <SheetHeader>
                <SheetTitle>Guest Details</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <User className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedSpeaker.attendee_name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedSpeaker.attendee_email}</p>
                    {selectedSpeaker.attendee_phone && (
                      <p className="text-sm text-muted-foreground">{selectedSpeaker.attendee_phone}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm">Stay Details</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nights:</span>
                      <p className="font-medium">{getNights(selectedSpeaker) || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Room:</span>
                      <p className="font-medium">{selectedSpeaker.custom_fields?.booking?.hotel_room_number || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Check-in:</span>
                      <p className="font-medium">{formatDate(selectedSpeaker.custom_fields?.booking?.hotel_checkin)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Check-out:</span>
                      <p className="font-medium">{formatDate(selectedSpeaker.custom_fields?.booking?.hotel_checkout)}</p>
                    </div>
                  </div>
                </div>

                {/* Airport Transfers */}
                <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-sm flex items-center gap-2 text-green-700">
                    <Car className="h-4 w-4" />
                    Airport Transfers
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Airport Pickup</p>
                        <p className="text-xs text-muted-foreground">Pick up on arrival</p>
                      </div>
                      <Switch
                        checked={selectedSpeaker.custom_fields?.travel_details?.pickup_required || false}
                        onCheckedChange={(checked) => {
                          updateAirportTransfer.mutate({
                            id: selectedSpeaker.id,
                            field: "pickup_required",
                            value: checked
                          })
                          setSelectedSpeaker({
                            ...selectedSpeaker,
                            custom_fields: {
                              ...selectedSpeaker.custom_fields,
                              travel_details: {
                                ...selectedSpeaker.custom_fields?.travel_details,
                                pickup_required: checked
                              }
                            }
                          })
                        }}
                        disabled={updateAirportTransfer.isPending}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Airport Drop</p>
                        <p className="text-xs text-muted-foreground">Drop on departure</p>
                      </div>
                      <Switch
                        checked={selectedSpeaker.custom_fields?.travel_details?.drop_required || false}
                        onCheckedChange={(checked) => {
                          updateAirportTransfer.mutate({
                            id: selectedSpeaker.id,
                            field: "drop_required",
                            value: checked
                          })
                          setSelectedSpeaker({
                            ...selectedSpeaker,
                            custom_fields: {
                              ...selectedSpeaker.custom_fields,
                              travel_details: {
                                ...selectedSpeaker.custom_fields?.travel_details,
                                drop_required: checked
                              }
                            }
                          })
                        }}
                        disabled={updateAirportTransfer.isPending}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => { openEditBooking(selectedSpeaker); setSelectedSpeaker(null) }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Booking
                  </Button>
                </div>
              </div>
            </>
          )}
        </ResizableSheetContent>
      </Sheet>

      {/* Bulk Assign Dialog */}
      <Dialog open={showBulkAssign} onOpenChange={setShowBulkAssign}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign {selectedGuests.size} Guests to Hotel</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <Label>Select Hotel</Label>
              <Select value={bulkAssignHotelId} onValueChange={setBulkAssignHotelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a hotel..." />
                </SelectTrigger>
                <SelectContent>
                  {hotels?.map((hotel) => (
                    <SelectItem key={hotel.id} value={hotel.id}>
                      {hotel.name} ({hotel.available_rooms} available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-40 overflow-y-auto bg-muted/30 rounded-lg p-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Guests to assign:</p>
              {Array.from(selectedGuests).map(guestId => {
                const guest = speakers?.find(s => s.id === guestId)
                return guest ? <div key={guestId} className="text-sm py-1">{guest.attendee_name}</div> : null
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkAssign(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!bulkAssignHotelId) { toast.error("Please select a hotel"); return }
                bulkAssign.mutate({ hotelId: bulkAssignHotelId, guestIds: Array.from(selectedGuests) })
              }}
              disabled={bulkAssign.isPending || !bulkAssignHotelId}
            >
              {bulkAssign.isPending ? "Assigning..." : `Assign ${selectedGuests.size} Guests`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
