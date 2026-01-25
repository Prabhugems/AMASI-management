"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  ResizableSheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Car,
  Loader2,
  Check,
  Clock,
  Download,
  Search,
  Plane,
  MapPin,
  Calendar,
  ArrowRight,
  User,
  Phone,
  Mail,
  Building2,
  Copy,
  Share2,
  PlaneTakeoff,
  PlaneLanding,
  Navigation,
  ExternalLink,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Guest = {
  id: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  custom_fields: {
    photo_url?: string
    assigned_hotel_id?: string
    travel_details?: {
      arrival_date?: string
      departure_date?: string
      onward_date?: string
      return_date?: string
      onward_from_city?: string
      onward_to_city?: string
      return_from_city?: string
      return_to_city?: string
      pickup_required?: boolean
      drop_required?: boolean
      hotel_check_in?: string
      hotel_check_out?: string
      hotel_name?: string
    }
    booking?: {
      onward_flight_number?: string
      onward_arrival_time?: string
      onward_departure_time?: string
      return_flight_number?: string
      return_arrival_time?: string
      return_departure_time?: string
      hotel_name?: string
      hotel_address?: string
      hotel_phone?: string
      pickup_required?: boolean
      pickup_status?: string
      pickup_vehicle?: string
      pickup_driver?: string
      pickup_driver_phone?: string
      pickup_time?: string
      pickup_location?: string
      pickup_notes?: string
      drop_required?: boolean
      drop_status?: string
      drop_vehicle?: string
      drop_driver?: string
      drop_driver_phone?: string
      drop_time?: string
      drop_location?: string
      drop_notes?: string
    }
  } | null
}

type Hotel = {
  id: string
  name: string
  address: string
  phone: string
  contact_person: string
}

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-amber-500" },
  arranged: { label: "Arranged", color: "bg-blue-500" },
  confirmed: { label: "Confirmed", color: "bg-green-500" },
  completed: { label: "Completed", color: "bg-gray-500" },
  cancelled: { label: "Cancelled", color: "bg-red-500" },
}

export default function TransfersPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("pickup")
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [editingType, setEditingType] = useState<"pickup" | "drop">("pickup")

  const [transferForm, setTransferForm] = useState({
    required: true,
    status: "pending",
    vehicle: "",
    driver: "",
    driver_phone: "",
    time: "",
    location: "",
    notes: "",
  })

  // Fetch hotels for this event
  const { data: hotels } = useQuery({
    queryKey: ["event-hotels", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("hotels")
        .select("id, name, address, phone, contact_person")
        .eq("event_id", eventId)
        .eq("is_active", true)
      return (data || []) as Hotel[]
    },
  })

  // Fetch guests
  const { data: guests, isLoading } = useQuery({
    queryKey: ["transfer-guests", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, attendee_phone, custom_fields")
        .eq("event_id", eventId)
        .order("attendee_name")

      return (data || []).filter((g: Guest) =>
        g.custom_fields?.booking?.pickup_required ||
        g.custom_fields?.booking?.drop_required ||
        g.custom_fields?.travel_details?.pickup_required ||
        g.custom_fields?.travel_details?.drop_required ||
        g.custom_fields?.travel_details?.arrival_date
      ) as Guest[]
    },
  })

  // Get hotel info for a guest
  const getGuestHotel = (guest: Guest): Hotel | null => {
    const hotelId = guest.custom_fields?.assigned_hotel_id
    if (hotelId && hotels) {
      return hotels.find(h => h.id === hotelId) || null
    }
    return null
  }

  // Get hotel name from various sources
  const getHotelName = (guest: Guest): string => {
    const assignedHotel = getGuestHotel(guest)
    if (assignedHotel) return assignedHotel.name
    return guest.custom_fields?.booking?.hotel_name ||
           guest.custom_fields?.travel_details?.hotel_name ||
           "Hotel TBD"
  }

  // Update transfer
  const updateTransfer = useMutation({
    mutationFn: async ({ id, type, transfer }: { id: string; type: "pickup" | "drop"; transfer: typeof transferForm }) => {
      const { data: current } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", id)
        .single()

      const update = {
        [`${type}_required`]: transfer.required,
        [`${type}_status`]: transfer.status,
        [`${type}_vehicle`]: transfer.vehicle,
        [`${type}_driver`]: transfer.driver,
        [`${type}_driver_phone`]: transfer.driver_phone,
        [`${type}_time`]: transfer.time,
        [`${type}_location`]: transfer.location,
        [`${type}_notes`]: transfer.notes,
      }

      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(current?.custom_fields || {}),
            booking: { ...(current?.custom_fields?.booking || {}), ...update },
          },
        })
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Transfer updated")
      setEditingGuest(null)
      queryClient.invalidateQueries({ queryKey: ["transfer-guests", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
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
    if (!guests) return { pickup: { total: 0, pending: 0, arranged: 0 }, drop: { total: 0, pending: 0, arranged: 0 } }

    const pickupRequired = guests.filter(g => g.custom_fields?.booking?.pickup_required || g.custom_fields?.travel_details?.pickup_required)
    const dropRequired = guests.filter(g => g.custom_fields?.booking?.drop_required || g.custom_fields?.travel_details?.drop_required)

    return {
      pickup: {
        total: pickupRequired.length,
        pending: pickupRequired.filter(g => !g.custom_fields?.booking?.pickup_status || g.custom_fields?.booking?.pickup_status === "pending").length,
        arranged: pickupRequired.filter(g => g.custom_fields?.booking?.pickup_status === "arranged" || g.custom_fields?.booking?.pickup_status === "confirmed").length,
      },
      drop: {
        total: dropRequired.length,
        pending: dropRequired.filter(g => !g.custom_fields?.booking?.drop_status || g.custom_fields?.booking?.drop_status === "pending").length,
        arranged: dropRequired.filter(g => g.custom_fields?.booking?.drop_status === "arranged" || g.custom_fields?.booking?.drop_status === "confirmed").length,
      },
    }
  }, [guests])

  const openEditTransfer = (guest: Guest, type: "pickup" | "drop") => {
    const booking = guest.custom_fields?.booking || {}
    setTransferForm({
      required: type === "pickup" ? (booking.pickup_required ?? true) : (booking.drop_required ?? true),
      status: (type === "pickup" ? booking.pickup_status : booking.drop_status) || "pending",
      vehicle: (type === "pickup" ? booking.pickup_vehicle : booking.drop_vehicle) || "",
      driver: (type === "pickup" ? booking.pickup_driver : booking.drop_driver) || "",
      driver_phone: (type === "pickup" ? booking.pickup_driver_phone : booking.drop_driver_phone) || "",
      time: (type === "pickup" ? booking.pickup_time : booking.drop_time) || "",
      location: (type === "pickup" ? booking.pickup_location : booking.drop_location) || "",
      notes: (type === "pickup" ? booking.pickup_notes : booking.drop_notes) || "",
    })
    setEditingType(type)
    setEditingGuest(guest)
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  }

  // Share to WhatsApp - for driver
  const shareToDriver = (guest: Guest, type: "pickup" | "drop") => {
    const booking = guest.custom_fields?.booking || {}
    const travel = guest.custom_fields?.travel_details || {}
    const hotelName = getHotelName(guest)
    const hotel = getGuestHotel(guest)

    const driverPhone = type === "pickup" ? booking.pickup_driver_phone : booking.drop_driver_phone

    let message = ""
    if (type === "pickup") {
      message = `🚗 *PICKUP ASSIGNMENT*

👤 *Guest:* ${guest.attendee_name}
📞 Guest Phone: ${guest.attendee_phone || "N/A"}

✈️ *Flight Details:*
Flight: ${booking.onward_flight_number || travel.onward_from_city || "TBD"}
Arrival: ${formatDate(travel.onward_date || travel.arrival_date)} @ ${booking.onward_arrival_time || "-"}

📍 *Pickup:* ${booking.pickup_location || "Airport"}
⏰ *Time:* ${booking.pickup_time || "-"}

🏨 *Drop Location:* ${hotelName}
${hotel?.address ? `📍 ${hotel.address}` : ""}
${hotel?.phone ? `📞 Hotel: ${hotel.phone}` : ""}

🚙 Vehicle: ${booking.pickup_vehicle || "-"}

${booking.pickup_notes ? `📝 Notes: ${booking.pickup_notes}` : ""}`
    } else {
      message = `🚗 *DROP ASSIGNMENT*

👤 *Guest:* ${guest.attendee_name}
📞 Guest Phone: ${guest.attendee_phone || "N/A"}

🏨 *Pickup:* ${hotelName}
${hotel?.address ? `📍 ${hotel.address}` : ""}
⏰ *Time:* ${booking.drop_time || "-"}

✈️ *Flight Details:*
Flight: ${booking.return_flight_number || travel.return_to_city || "TBD"}
Departure: ${formatDate(travel.return_date || travel.departure_date)} @ ${booking.return_departure_time || "-"}

📍 *Drop:* ${booking.drop_location || "Airport"}

🚙 Vehicle: ${booking.drop_vehicle || "-"}

${booking.drop_notes ? `📝 Notes: ${booking.drop_notes}` : ""}`
    }

    const encodedMessage = encodeURIComponent(message)
    const phone = driverPhone?.replace(/\D/g, '') || ""
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank')
  }

  // Copy transfer details
  const copyTransferDetails = (guest: Guest, type: "pickup" | "drop") => {
    const booking = guest.custom_fields?.booking || {}
    const travel = guest.custom_fields?.travel_details || {}
    const hotelName = getHotelName(guest)
    const hotel = getGuestHotel(guest)

    let text = ""
    if (type === "pickup") {
      text = `PICKUP: ${guest.attendee_name}
Guest Phone: ${guest.attendee_phone || "-"}
Flight: ${booking.onward_flight_number || "-"} @ ${booking.onward_arrival_time || "-"}
Date: ${formatDate(travel.onward_date || travel.arrival_date)}
Pickup: ${booking.pickup_location || "Airport"} @ ${booking.pickup_time || "-"}
Drop: ${hotelName}${hotel?.address ? ` - ${hotel.address}` : ""}
Vehicle: ${booking.pickup_vehicle || "-"}
Driver: ${booking.pickup_driver || "-"} (${booking.pickup_driver_phone || "-"})`
    } else {
      text = `DROP: ${guest.attendee_name}
Guest Phone: ${guest.attendee_phone || "-"}
Pickup: ${hotelName}${hotel?.address ? ` - ${hotel.address}` : ""} @ ${booking.drop_time || "-"}
Flight: ${booking.return_flight_number || "-"} @ ${booking.return_departure_time || "-"}
Date: ${formatDate(travel.return_date || travel.departure_date)}
Drop: ${booking.drop_location || "Airport"}
Vehicle: ${booking.drop_vehicle || "-"}
Driver: ${booking.drop_driver || "-"} (${booking.drop_driver_phone || "-"})`
    }

    navigator.clipboard.writeText(text)
    toast.success("Details copied!")
  }

  const exportTransfers = () => {
    const headers = ["Guest", "Phone", "Type", "Date", "Time", "Location", "Hotel", "Hotel Address", "Vehicle", "Driver", "Driver Phone", "Status"]
    const rows: string[][] = []

    filteredGuests.forEach(g => {
      const booking = g.custom_fields?.booking || {}
      const travel = g.custom_fields?.travel_details || {}
      const hotelName = getHotelName(g)
      const hotel = getGuestHotel(g)

      if (booking.pickup_required || travel.pickup_required) {
        rows.push([g.attendee_name, g.attendee_phone || "", "Pickup", travel.arrival_date || travel.onward_date || "", booking.pickup_time || "", booking.pickup_location || "Airport", hotelName, hotel?.address || "", booking.pickup_vehicle || "", booking.pickup_driver || "", booking.pickup_driver_phone || "", booking.pickup_status || "pending"])
      }
      if (booking.drop_required || travel.drop_required) {
        rows.push([g.attendee_name, g.attendee_phone || "", "Drop", travel.departure_date || travel.return_date || "", booking.drop_time || "", booking.drop_location || "Airport", hotelName, hotel?.address || "", booking.drop_vehicle || "", booking.drop_driver || "", booking.drop_driver_phone || "", booking.drop_status || "pending"])
      }
    })

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transfers-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Transfers exported")
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pickup & Drop</h1>
          <p className="text-muted-foreground">Manage ground transportation</p>
        </div>
        <Button variant="outline" onClick={exportTransfers}><Download className="h-4 w-4 mr-2" />Export</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600"><PlaneLanding className="h-4 w-4" /><span className="text-sm">Pickups</span></div>
          <p className="text-2xl font-bold mt-1">{stats.pickup.total}</p>
          <p className="text-xs text-muted-foreground">{stats.pickup.arranged} arranged</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-500"><Clock className="h-4 w-4" /><span className="text-sm">Pickup Pending</span></div>
          <p className="text-2xl font-bold mt-1">{stats.pickup.pending}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-red-500"><PlaneTakeoff className="h-4 w-4" /><span className="text-sm">Drops</span></div>
          <p className="text-2xl font-bold mt-1">{stats.drop.total}</p>
          <p className="text-xs text-muted-foreground">{stats.drop.arranged} arranged</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-500"><Clock className="h-4 w-4" /><span className="text-sm">Drop Pending</span></div>
          <p className="text-2xl font-bold mt-1">{stats.drop.pending}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search guests..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pickup" className="gap-2"><PlaneLanding className="h-4 w-4" />Pickups ({stats.pickup.total})</TabsTrigger>
          <TabsTrigger value="drop" className="gap-2"><PlaneTakeoff className="h-4 w-4" />Drops ({stats.drop.total})</TabsTrigger>
        </TabsList>

        <TabsContent value="pickup" className="mt-4">
          <TransferTable
            guests={filteredGuests}
            type="pickup"
            onEdit={(g) => openEditTransfer(g, "pickup")}
            formatDate={formatDate}
            getHotelName={getHotelName}
            getGuestHotel={getGuestHotel}
            onShare={(g) => shareToDriver(g, "pickup")}
            onCopy={(g) => copyTransferDetails(g, "pickup")}
          />
        </TabsContent>

        <TabsContent value="drop" className="mt-4">
          <TransferTable
            guests={filteredGuests}
            type="drop"
            onEdit={(g) => openEditTransfer(g, "drop")}
            formatDate={formatDate}
            getHotelName={getHotelName}
            getGuestHotel={getGuestHotel}
            onShare={(g) => shareToDriver(g, "drop")}
            onCopy={(g) => copyTransferDetails(g, "drop")}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Sheet */}
      <Sheet open={!!editingGuest} onOpenChange={(open) => !open && setEditingGuest(null)}>
        <ResizableSheetContent defaultWidth={600} minWidth={400} maxWidth={900} storageKey="transfers-sheet-width" className="overflow-y-auto p-0">
          {/* Header with gradient */}
          <div className={cn(
            "px-6 py-4 border-b",
            editingType === "pickup" ? "bg-gradient-to-r from-green-50 to-green-100/50" : "bg-gradient-to-r from-orange-50 to-orange-100/50"
          )}>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  editingType === "pickup" ? "bg-green-500" : "bg-orange-500"
                )}>
                  <Car className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-lg font-semibold">{editingType === "pickup" ? "Airport Pickup" : "Airport Drop"}</p>
                  <p className="text-sm font-normal text-muted-foreground">{editingGuest?.attendee_name}</p>
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-5">
            {/* Guest Photo & Contact Card - Important for driver */}
            {editingGuest && (() => {
              const photoUrl = editingGuest.custom_fields?.photo_url
              const booking = editingGuest.custom_fields?.booking || {}
              const travel = editingGuest.custom_fields?.travel_details || {}
              const hotelName = getHotelName(editingGuest)
              const hotel = getGuestHotel(editingGuest)

              return (
                <>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-start gap-3">
                      {photoUrl ? (
                        <img src={photoUrl} alt={editingGuest.attendee_name} className="w-20 h-20 rounded-lg object-cover border-2 border-white shadow-sm" />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-white flex items-center justify-center border-2 border-slate-200">
                          <User className="h-10 w-10 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Guest to {editingType === "pickup" ? "Pickup" : "Drop"}</p>
                        <p className="font-semibold text-lg">{editingGuest.attendee_name}</p>
                        {editingGuest.attendee_phone && (
                          <a href={`tel:${editingGuest.attendee_phone}`} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline mt-1 font-medium">
                            <Phone className="h-4 w-4" />
                            {editingGuest.attendee_phone}
                          </a>
                        )}
                        {editingGuest.attendee_email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 truncate">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{editingGuest.attendee_email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Flight Info */}
                  <div className="p-4 bg-slate-50 rounded-xl border">
                    <div className="flex items-center gap-2 text-sm font-medium mb-3">
                      <Plane className="h-4 w-4 text-primary" />
                      Flight Information
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Flight</p>
                        <p className="font-mono font-medium">
                          {editingType === "pickup"
                            ? (booking.onward_flight_number || travel.onward_from_city || "-")
                            : (booking.return_flight_number || travel.return_to_city || "-")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="font-medium">
                          {editingType === "pickup"
                            ? formatDate(travel.onward_date || travel.arrival_date)
                            : formatDate(travel.return_date || travel.departure_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{editingType === "pickup" ? "Arrival Time" : "Departure Time"}</p>
                        <p className="font-mono font-medium">
                          {editingType === "pickup"
                            ? (booking.onward_arrival_time || "-")
                            : (booking.return_departure_time || "-")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Route</p>
                        <p className="font-medium text-xs">
                          {editingType === "pickup"
                            ? `${travel.onward_from_city || "-"} → ${travel.onward_to_city || "-"}`
                            : `${travel.return_from_city || "-"} → ${travel.return_to_city || "-"}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Hotel Info - Critical for driver */}
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 text-sm font-medium mb-3">
                      <Building2 className="h-4 w-4 text-amber-600" />
                      {editingType === "pickup" ? "Drop Location (Hotel)" : "Pickup Location (Hotel)"}
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-base">{hotelName}</p>
                      {hotel?.address && (
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <span>{hotel.address}</span>
                        </div>
                      )}
                      {hotel?.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${hotel.phone}`} className="text-primary hover:underline">{hotel.phone}</a>
                        </div>
                      )}
                      {hotel?.contact_person && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>Contact: {hotel.contact_person}</span>
                        </div>
                      )}
                      {!hotel && (
                        <p className="text-sm text-amber-600">Hotel not yet assigned</p>
                      )}
                    </div>
                  </div>
                </>
              )
            })()}

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <Label className="font-medium">Status</Label>
              <Select value={transferForm.status} onValueChange={(v) => setTransferForm({ ...transferForm, status: v })}>
                <SelectTrigger className="w-[140px] bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⏳ Pending</SelectItem>
                  <SelectItem value="arranged">📋 Arranged</SelectItem>
                  <SelectItem value="confirmed">✅ Confirmed</SelectItem>
                  <SelectItem value="completed">✔️ Completed</SelectItem>
                  <SelectItem value="cancelled">❌ Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Pickup/Drop Time</Label>
                <Input
                  value={transferForm.time}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9:]/g, '')
                    if (val.length <= 5) setTransferForm({ ...transferForm, time: val })
                  }}
                  placeholder="08:30"
                  maxLength={5}
                  className="mt-1.5 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Location</Label>
                <Input value={transferForm.location} onChange={(e) => setTransferForm({ ...transferForm, location: e.target.value })} placeholder="Airport T1" className="mt-1.5" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Vehicle (Model & Number)</Label>
              <Input value={transferForm.vehicle} onChange={(e) => setTransferForm({ ...transferForm, vehicle: e.target.value })} placeholder="Toyota Innova - BR01AB1234" className="mt-1.5" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Driver Name</Label>
                <Input value={transferForm.driver} onChange={(e) => setTransferForm({ ...transferForm, driver: e.target.value })} placeholder="Ram Kumar" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Driver Phone</Label>
                <Input value={transferForm.driver_phone} onChange={(e) => setTransferForm({ ...transferForm, driver_phone: e.target.value })} placeholder="+91 98765 43210" className="mt-1.5" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Notes / Special Instructions</Label>
              <Textarea value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} placeholder="Special instructions..." rows={2} className="mt-1.5" />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t bg-slate-50">
            <div className="flex gap-2">
              {editingGuest && (
                <>
                  <Button variant="outline" size="sm" onClick={() => copyTransferDetails(editingGuest, editingType)}>
                    <Copy className="h-4 w-4 mr-1" />Copy
                  </Button>
                  {transferForm.driver_phone && (
                    <Button variant="outline" size="sm" className="text-green-600" onClick={() => shareToDriver(editingGuest, editingType)}>
                      <Share2 className="h-4 w-4 mr-1" />WhatsApp
                    </Button>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingGuest(null)}>Cancel</Button>
              <Button
                onClick={() => editingGuest && updateTransfer.mutate({ id: editingGuest.id, type: editingType, transfer: transferForm })}
                disabled={updateTransfer.isPending}
                className="min-w-[120px]"
              >
                {updateTransfer.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Check className="h-4 w-4 mr-2" />Save</>
                )}
              </Button>
            </div>
          </div>
        </ResizableSheetContent>
      </Sheet>
    </div>
  )
}

function TransferTable({
  guests,
  type,
  onEdit,
  formatDate,
  getHotelName,
  getGuestHotel,
  onShare,
  onCopy
}: {
  guests: Guest[]
  type: "pickup" | "drop"
  onEdit: (g: Guest) => void
  formatDate: (d: string | undefined) => string
  getHotelName: (g: Guest) => string
  getGuestHotel: (g: Guest) => Hotel | null
  onShare: (g: Guest) => void
  onCopy: (g: Guest) => void
}) {
  const filtered = guests.filter(g => {
    const booking = g.custom_fields?.booking || {}
    const travel = g.custom_fields?.travel_details || {}
    if (type === "pickup") {
      return booking.pickup_required || travel.pickup_required
    } else {
      return booking.drop_required || travel.drop_required
    }
  })

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-dashed">
        <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No {type}s required</h3>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Guest</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>{type === "pickup" ? "Drop Hotel" : "Pickup Hotel"}</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((guest) => {
            const booking = guest.custom_fields?.booking || {}
            const travel = guest.custom_fields?.travel_details || {}
            const status = type === "pickup" ? booking.pickup_status : booking.drop_status
            const statusInfo = STATUS[status || "pending"]
            const hotelName = getHotelName(guest)
            const hotel = getGuestHotel(guest)

            const speakerRequested = type === "pickup" ? travel.pickup_required : travel.drop_required
            const adminSetup = type === "pickup" ? booking.pickup_required : booking.drop_required
            const isNewRequest = speakerRequested && !adminSetup

            return (
              <TableRow key={guest.id} className={cn("cursor-pointer hover:bg-muted/50", isNewRequest && "bg-blue-50")} onClick={() => onEdit(guest)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium">{guest.attendee_name}</p>
                      <p className="text-xs text-muted-foreground">{guest.attendee_phone}</p>
                    </div>
                    {isNewRequest && (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 bg-blue-50">
                        Speaker Request
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{formatDate(type === "pickup" ? (travel.onward_date || travel.arrival_date) : (travel.return_date || travel.departure_date))}</TableCell>
                <TableCell className="font-mono">{(type === "pickup" ? booking.pickup_time : booking.drop_time) || "-"}</TableCell>
                <TableCell>
                  <div className="max-w-[180px]">
                    <p className="font-medium text-sm truncate">{hotelName}</p>
                    {hotel?.address && (
                      <p className="text-xs text-muted-foreground truncate">{hotel.address}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell><span className="text-sm">{(type === "pickup" ? booking.pickup_vehicle : booking.drop_vehicle) || "-"}</span></TableCell>
                <TableCell>
                  <div className="text-sm">
                    {(type === "pickup" ? booking.pickup_driver : booking.drop_driver) || "-"}
                    {(type === "pickup" ? booking.pickup_driver_phone : booking.drop_driver_phone) && (
                      <p className="text-xs text-muted-foreground">{type === "pickup" ? booking.pickup_driver_phone : booking.drop_driver_phone}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn("text-white text-xs", statusInfo.color)}>{statusInfo.label}</Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCopy(guest)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {(type === "pickup" ? booking.pickup_driver_phone : booking.drop_driver_phone) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => onShare(guest)}>
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
