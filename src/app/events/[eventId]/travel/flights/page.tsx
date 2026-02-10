"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  Plane,
  Loader2,
  CheckCircle,
  Clock,
  Check,
  Download,
  Search,
  PlaneTakeoff,
  PlaneLanding,
  Calendar,
  Phone,
  Mail,
  User,
  Sparkles,
  AlertTriangle,
  FileText,
  Car,
} from "lucide-react"
import { useRef, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Guest = {
  id: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  custom_fields: {
    photo_url?: string
    needs_travel?: boolean
    travel_details?: {
      // Legacy
      from_city?: string
      arrival_date?: string
      departure_date?: string
      // Onward
      onward_from_city?: string
      onward_to_city?: string
      onward_date?: string
      onward_preferred_time?: string
      onward_departure_time?: string
      // Return
      return_from_city?: string
      return_to_city?: string
      return_date?: string
      return_preferred_time?: string
      return_departure_time?: string
      // Airport Transfers
      pickup_required?: boolean
      drop_required?: boolean
    }
    booking?: {
      onward_status?: string
      onward_pnr?: string
      onward_airline?: string
      onward_flight_number?: string
      onward_departure_date?: string
      onward_departure_time?: string
      onward_arrival_time?: string
      onward_from_city?: string
      onward_to_city?: string
      onward_seat?: string
      onward_cost?: number
      onward_eticket?: string
      return_status?: string
      return_pnr?: string
      return_airline?: string
      return_flight_number?: string
      return_departure_date?: string
      return_departure_time?: string
      return_arrival_time?: string
      return_from_city?: string
      return_to_city?: string
      return_seat?: string
      return_cost?: number
      return_eticket?: string
    }
  } | null
}

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-amber-500" },
  booked: { label: "Booked", color: "bg-blue-500" },
  confirmed: { label: "Confirmed", color: "bg-green-500" },
  cancelled: { label: "Cancelled", color: "bg-red-500" },
  not_required: { label: "N/A", color: "bg-gray-400" },
}

export default function FlightsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("onward")
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [editingType, setEditingType] = useState<"onward" | "return">("onward")

  const [flightForm, setFlightForm] = useState({
    status: "pending",
    pnr: "",
    airline: "",
    flight_number: "",
    from_city: "",
    to_city: "",
    departure_date: "",
    departure_time: "",
    arrival_time: "",
    seat: "",
    cost: 0,
    eticket: "",
  })

  // AI Ticket Extraction State
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionResult, setExtractionResult] = useState<{
    success: boolean
    confidence: number
    discrepancies?: Array<{ field: string; requested: string | null; booked: string | null; severity: string }>
    pickup_timing?: { arrival_time: string | null; suggested_pickup_time: string | null; notes: string[] }
    drop_timing?: { departure_time: string | null; suggested_drop_time: string | null; notes: string[] }
  } | null>(null)

  // Fetch guests with flight requirements
  const { data: guests, isLoading } = useQuery({
    queryKey: ["flight-guests", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, attendee_phone, custom_fields")
        .eq("event_id", eventId)
        .order("attendee_name")

      return (data || []).filter((g: Guest) =>
        g.custom_fields?.needs_travel ||
        g.custom_fields?.travel_details?.from_city ||
        g.custom_fields?.travel_details?.onward_from_city ||
        g.custom_fields?.booking?.onward_status
      ) as Guest[]
    },
  })

  // Update flight
  const updateFlight = useMutation({
    mutationFn: async ({ id, type, flight }: { id: string; type: "onward" | "return"; flight: typeof flightForm }) => {
      const { data: current } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", id)
        .single()

      const prefix = type
      const bookingUpdate = {
        [`${prefix}_status`]: flight.status,
        [`${prefix}_pnr`]: flight.pnr,
        [`${prefix}_airline`]: flight.airline,
        [`${prefix}_flight_number`]: flight.flight_number,
        [`${prefix}_from_city`]: flight.from_city,
        [`${prefix}_to_city`]: flight.to_city,
        [`${prefix}_departure_date`]: flight.departure_date,
        [`${prefix}_departure_time`]: flight.departure_time,
        [`${prefix}_arrival_time`]: flight.arrival_time,
        [`${prefix}_seat`]: flight.seat,
        [`${prefix}_cost`]: flight.cost,
        [`${prefix}_eticket`]: flight.eticket,
      }

      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(current?.custom_fields || {}),
            booking: {
              ...(current?.custom_fields?.booking || {}),
              ...bookingUpdate,
            },
          },
        })
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Flight updated")
      setEditingGuest(null)
      queryClient.invalidateQueries({ queryKey: ["flight-guests", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Quick status update
  const quickUpdateStatus = useMutation({
    mutationFn: async ({ id, status, type }: { id: string; status: string; type: "onward" | "return" }) => {
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
              [`${type}_status`]: status,
            },
          },
        })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: (_, { status }) => {
      toast.success(`Status: ${status}`)
      queryClient.invalidateQueries({ queryKey: ["flight-guests", eventId] })
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
      queryClient.invalidateQueries({ queryKey: ["flight-guests", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // AI Ticket Extraction Handler
  const handleTicketUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !editingGuest) return

    setIsExtracting(true)
    setExtractionResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("ticket_type", "flight")

      // Build requested itinerary for cross-check
      const travel = editingGuest.custom_fields?.travel_details || {}
      const requestedItinerary = editingType === "onward" ? {
        departure_city: travel.onward_from_city || travel.from_city,
        arrival_city: travel.onward_to_city,
        departure_date: travel.onward_date || travel.arrival_date,
        passenger_name: editingGuest.attendee_name,
      } : {
        departure_city: travel.return_from_city,
        arrival_city: travel.return_to_city || travel.from_city,
        departure_date: travel.return_date || travel.departure_date,
        passenger_name: editingGuest.attendee_name,
      }
      formData.append("requested_itinerary", JSON.stringify(requestedItinerary))

      const response = await fetch("/api/travel/extract-ticket", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (result.success && result.flight_details) {
        const details = result.flight_details

        // Auto-fill the form with extracted data
        setFlightForm(prev => ({
          ...prev,
          pnr: details.pnr || details.booking_reference || prev.pnr,
          airline: details.airline || prev.airline,
          flight_number: details.flight_number || prev.flight_number,
          from_city: details.departure_airport || details.departure_city || prev.from_city,
          to_city: details.arrival_airport || details.arrival_city || prev.to_city,
          departure_date: details.departure_date || prev.departure_date,
          departure_time: details.departure_time || prev.departure_time,
          arrival_time: details.arrival_time || prev.arrival_time,
          seat: details.seat_number || prev.seat,
          status: details.pnr ? "booked" : prev.status,
        }))

        // Store extraction result for UI display
        setExtractionResult({
          success: true,
          confidence: result.confidence,
          discrepancies: result.cross_check?.discrepancies,
          pickup_timing: result.cross_check?.pickup_timing,
          drop_timing: result.cross_check?.drop_timing,
        })

        toast.success(`Ticket extracted! (${result.confidence}% confidence)`)
      } else {
        toast.error(result.error || "Could not extract ticket details")
        setExtractionResult({ success: false, confidence: 0 })
      }
    } catch (error: any) {
      toast.error("Failed to extract ticket: " + (error.message || "Unknown error"))
      setExtractionResult({ success: false, confidence: 0 })
    } finally {
      setIsExtracting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }, [editingGuest, editingType])

  // Filter guests
  const filteredGuests = useMemo(() => {
    if (!guests) return []
    return guests.filter(g =>
      g.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
      g.attendee_email.toLowerCase().includes(search.toLowerCase()) ||
      g.custom_fields?.booking?.onward_pnr?.includes(search) ||
      g.custom_fields?.booking?.return_pnr?.includes(search)
    )
  }, [guests, search])

  // Stats
  const stats = useMemo(() => {
    if (!guests) return { onward: { pending: 0, booked: 0, confirmed: 0 }, return: { pending: 0, booked: 0, confirmed: 0 }, totalCost: 0 }

    const onwardStats = { pending: 0, booked: 0, confirmed: 0 }
    const returnStats = { pending: 0, booked: 0, confirmed: 0 }
    let totalCost = 0

    guests.forEach(g => {
      const onwardStatus = g.custom_fields?.booking?.onward_status || "pending"
      const returnStatus = g.custom_fields?.booking?.return_status || "pending"

      if (onwardStatus === "pending") onwardStats.pending++
      else if (onwardStatus === "booked") onwardStats.booked++
      else if (onwardStatus === "confirmed") onwardStats.confirmed++
      // not_required doesn't count towards pending

      if (returnStatus === "pending") returnStats.pending++
      else if (returnStatus === "booked") returnStats.booked++
      else if (returnStatus === "confirmed") returnStats.confirmed++
      // not_required doesn't count towards pending

      totalCost += (g.custom_fields?.booking?.onward_cost || 0) + (g.custom_fields?.booking?.return_cost || 0)
    })

    return { onward: onwardStats, return: returnStats, totalCost }
  }, [guests])

  const openEditFlight = (guest: Guest, type: "onward" | "return") => {
    const booking = guest.custom_fields?.booking || {}
    const travel = guest.custom_fields?.travel_details || {}

    // Reset extraction result when opening new panel
    setExtractionResult(null)

    if (type === "onward") {
      setFlightForm({
        status: booking.onward_status || "pending",
        pnr: booking.onward_pnr || "",
        airline: booking.onward_airline || "",
        flight_number: booking.onward_flight_number || travel.onward_preferred_time || "",
        from_city: booking.onward_from_city || travel.onward_from_city || travel.from_city || "",
        to_city: booking.onward_to_city || travel.onward_to_city || "",
        departure_date: booking.onward_departure_date || travel.onward_date || travel.arrival_date || "",
        departure_time: booking.onward_departure_time || travel.onward_departure_time || "",
        arrival_time: booking.onward_arrival_time || "",
        seat: booking.onward_seat || "",
        cost: booking.onward_cost || 0,
        eticket: booking.onward_eticket || "",
      })
    } else {
      setFlightForm({
        status: booking.return_status || "pending",
        pnr: booking.return_pnr || "",
        airline: booking.return_airline || "",
        flight_number: booking.return_flight_number || travel.return_preferred_time || "",
        from_city: booking.return_from_city || travel.return_from_city || "",
        to_city: booking.return_to_city || travel.return_to_city || travel.from_city || "",
        departure_date: booking.return_departure_date || travel.return_date || travel.departure_date || "",
        departure_time: booking.return_departure_time || travel.return_departure_time || "",
        arrival_time: booking.return_arrival_time || "",
        seat: booking.return_seat || "",
        cost: booking.return_cost || 0,
        eticket: booking.return_eticket || "",
      })
    }
    setEditingType(type)
    setEditingGuest(guest)
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  }

  const exportFlights = () => {
    const headers = ["Name", "Type", "Status", "PNR", "Flight", "From", "To", "Date", "Dep Time", "Arr Time", "Cost"]
    const rows: string[][] = []

    filteredGuests.forEach(g => {
      const booking = g.custom_fields?.booking || {}
      if (booking.onward_status) {
        rows.push([g.attendee_name, "Onward", booking.onward_status, booking.onward_pnr || "", booking.onward_flight_number || "", booking.onward_from_city || "", booking.onward_to_city || "", booking.onward_departure_date || "", booking.onward_departure_time || "", booking.onward_arrival_time || "", String(booking.onward_cost || 0)])
      }
      if (booking.return_status && booking.return_status !== "not_required") {
        rows.push([g.attendee_name, "Return", booking.return_status, booking.return_pnr || "", booking.return_flight_number || "", booking.return_from_city || "", booking.return_to_city || "", booking.return_departure_date || "", booking.return_departure_time || "", booking.return_arrival_time || "", String(booking.return_cost || 0)])
      }
    })

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `flights-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Flights exported")
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flights</h1>
          <p className="text-muted-foreground">Manage flight bookings</p>
        </div>
        <Button variant="outline" onClick={exportFlights}>
          <Download className="h-4 w-4 mr-2" />Export
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Plane className="h-4 w-4" />
            <span className="text-sm">Total Flights</span>
          </div>
          <p className="text-2xl font-bold mt-1">{guests?.length || 0}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Pending</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.onward.pending + stats.return.pending}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <Check className="h-4 w-4" />
            <span className="text-sm">Booked</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.onward.booked + stats.onward.confirmed + stats.return.booked + stats.return.confirmed}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-sm">Total Cost</span>
          </div>
          <p className="text-xl font-bold mt-1">₹{stats.totalCost.toLocaleString()}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or PNR..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="onward" className="gap-2"><PlaneTakeoff className="h-4 w-4" />Onward ({stats.onward.pending + stats.onward.booked + stats.onward.confirmed})</TabsTrigger>
          <TabsTrigger value="return" className="gap-2"><PlaneLanding className="h-4 w-4" />Return ({stats.return.pending + stats.return.booked + stats.return.confirmed})</TabsTrigger>
        </TabsList>

        <TabsContent value="onward" className="mt-4">
          <FlightTable
            guests={filteredGuests}
            type="onward"
            onEdit={(g) => openEditFlight(g, "onward")}
            formatDate={formatDate}
            onQuickStatus={(id, status) => quickUpdateStatus.mutate({ id, status, type: "onward" })}
          />
        </TabsContent>

        <TabsContent value="return" className="mt-4">
          <FlightTable
            guests={filteredGuests}
            type="return"
            onEdit={(g) => openEditFlight(g, "return")}
            formatDate={formatDate}
            onQuickStatus={(id, status) => quickUpdateStatus.mutate({ id, status, type: "return" })}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Flight Sheet - Side by Side (Resizable) */}
      <Sheet open={!!editingGuest} onOpenChange={(open) => !open && setEditingGuest(null)}>
        <ResizableSheetContent defaultWidth={750} minWidth={500} maxWidth={1000} storageKey="flight-sheet-width" className="overflow-y-auto p-0">
          {/* Header with gradient */}
          <div className={cn(
            "px-6 py-4 border-b",
            editingType === "onward" ? "bg-gradient-to-r from-blue-50 to-blue-100/50" : "bg-gradient-to-r from-purple-50 to-purple-100/50"
          )}>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  editingType === "onward" ? "bg-blue-500" : "bg-purple-500"
                )}>
                  {editingType === "onward" ? <PlaneTakeoff className="h-5 w-5 text-white" /> : <PlaneLanding className="h-5 w-5 text-white" />}
                </div>
                <div>
                  <p className="text-lg font-semibold">{editingGuest?.attendee_name}</p>
                  <p className="text-sm font-normal text-muted-foreground">{editingType === "onward" ? "Onward" : "Return"} Flight Booking</p>
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>

          <div className="grid grid-cols-2 gap-0 divide-x">
            {/* LEFT: Speaker's Request */}
            <div className="p-5 bg-slate-50/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-md bg-blue-100">
                  <Plane className="h-4 w-4 text-blue-600" />
                </div>
                <h3 className="font-semibold text-sm">Speaker's Request</h3>
              </div>
              {editingGuest && (() => {
                const travel = editingGuest.custom_fields?.travel_details
                const photoUrl = editingGuest.custom_fields?.photo_url
                const requestedRoute = editingType === "onward"
                  ? (travel?.onward_from_city || travel?.from_city)
                  : travel?.return_from_city
                const requestedFlight = editingType === "onward"
                  ? travel?.onward_preferred_time
                  : travel?.return_preferred_time
                const requestedDate = editingType === "onward"
                  ? (travel?.onward_date || travel?.arrival_date)
                  : (travel?.return_date || travel?.departure_date)
                const requestedTime = editingType === "onward"
                  ? travel?.onward_departure_time
                  : travel?.return_departure_time

                return (
                  <div className="space-y-4">
                    {/* Speaker Photo & Contact Card */}
                    <div className="p-4 bg-white rounded-xl border shadow-sm">
                      <div className="flex items-start gap-3">
                        {photoUrl ? (
                          <img src={photoUrl} alt={editingGuest.attendee_name} className="w-16 h-16 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center border">
                            <User className="h-8 w-8 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{editingGuest.attendee_name}</p>
                          {editingGuest.attendee_phone && (
                            <a href={`tel:${editingGuest.attendee_phone}`} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline mt-1">
                              <Phone className="h-3 w-3" />
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

                    <div className="p-4 bg-white rounded-xl border shadow-sm">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Route</p>
                      <p className="font-semibold text-lg">{requestedRoute || "-"}</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border shadow-sm">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Preferred Flight(s)</p>
                      <p className="font-mono font-semibold">{requestedFlight || "-"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-white rounded-xl border shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
                        </div>
                        <p className="font-medium">{requestedDate ? new Date(requestedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-"}</p>
                      </div>
                      <div className="p-4 bg-white rounded-xl border shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Time</p>
                        </div>
                        <p className="font-mono font-medium">{requestedTime || "-"}</p>
                      </div>
                    </div>

                    {/* Airport Transfers */}
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Car className="h-4 w-4 text-green-600" />
                        <p className="text-sm font-medium text-green-800">Airport Transfers</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Airport Pickup</p>
                            <p className="text-xs text-muted-foreground">Pick up on arrival</p>
                          </div>
                          <Switch
                            checked={travel?.pickup_required || false}
                            onCheckedChange={(checked) =>
                              updateAirportTransfer.mutate({
                                id: editingGuest.id,
                                field: "pickup_required",
                                value: checked
                              })
                            }
                            disabled={updateAirportTransfer.isPending}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Airport Drop</p>
                            <p className="text-xs text-muted-foreground">Drop on departure</p>
                          </div>
                          <Switch
                            checked={travel?.drop_required || false}
                            onCheckedChange={(checked) =>
                              updateAirportTransfer.mutate({
                                id: editingGuest.id,
                                field: "drop_required",
                                value: checked
                              })
                            }
                            disabled={updateAirportTransfer.isPending}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* RIGHT: Booking Form */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-green-100">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-sm">Booking Details</h3>
                </div>

                {/* AI Ticket Upload Button */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleTicketUpload}
                    className="hidden"
                    id="ticket-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs border-purple-200 hover:bg-purple-50 hover:border-purple-300"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isExtracting}
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 text-purple-500" />
                        AI Scan Ticket
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Extraction Result & Cross-Check */}
              {extractionResult && extractionResult.success && (
                <div className="mb-4 space-y-3">
                  {/* Cross-check Discrepancies */}
                  {extractionResult.discrepancies && extractionResult.discrepancies.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-700 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium text-sm">Itinerary Mismatch</span>
                      </div>
                      <div className="space-y-1.5">
                        {extractionResult.discrepancies.map((d, i) => (
                          <div key={i} className="text-xs flex items-start gap-2">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded font-medium",
                              d.severity === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {d.field}
                            </span>
                            <span className="text-muted-foreground">
                              Requested: <strong>{d.requested || "-"}</strong> → Booked: <strong>{d.booked || "-"}</strong>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pickup/Drop Timing Suggestions */}
                  {(extractionResult.pickup_timing?.notes?.length || extractionResult.drop_timing?.notes?.length) && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 text-blue-700 mb-2">
                        <Car className="h-4 w-4" />
                        <span className="font-medium text-sm">Transfer Timing</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {editingType === "onward" && extractionResult.drop_timing?.notes?.map((note, i) => (
                          <p key={i} className="text-blue-700">{note}</p>
                        ))}
                        {editingType === "return" && extractionResult.pickup_timing?.notes?.map((note, i) => (
                          <p key={i} className="text-blue-700">{note}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confidence */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      AI Extraction
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full font-medium",
                      extractionResult.confidence >= 80 ? "bg-green-100 text-green-700" :
                      extractionResult.confidence >= 60 ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {extractionResult.confidence}% confidence
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {/* Status Row */}
                <div className="p-3 bg-slate-50 rounded-lg">
                  <Label className="text-xs text-muted-foreground block mb-1.5">Status</Label>
                  <Select value={flightForm.status} onValueChange={(v) => setFlightForm({ ...flightForm, status: v })}>
                    <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">⏳ Pending</SelectItem>
                      <SelectItem value="booked">📋 Booked</SelectItem>
                      <SelectItem value="confirmed">✅ Confirmed</SelectItem>
                      <SelectItem value="cancelled">❌ Cancelled</SelectItem>
                      <SelectItem value="not_required">➖ Not Required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Airline & Flight */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground block mb-1">Airline(s)</Label>
                    <Input value={flightForm.airline} onChange={(e) => setFlightForm({ ...flightForm, airline: e.target.value })} placeholder="IndiGo" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground block mb-1">Flight No(s)</Label>
                    <Input value={flightForm.flight_number} onChange={(e) => setFlightForm({ ...flightForm, flight_number: e.target.value })} placeholder="6E-1234" className="font-mono" />
                  </div>
                </div>

                {/* Route */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground block mb-1">Route</Label>
                    <Input value={flightForm.from_city} onChange={(e) => setFlightForm({ ...flightForm, from_city: e.target.value })} placeholder="DEL-BLR" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground block mb-1">Destination</Label>
                    <Input value={flightForm.to_city} onChange={(e) => setFlightForm({ ...flightForm, to_city: e.target.value })} placeholder="PAT" />
                  </div>
                </div>

                {/* Date & Times */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground block mb-1">Date</Label>
                    <Input type="date" value={flightForm.departure_date} onChange={(e) => setFlightForm({ ...flightForm, departure_date: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground block mb-1">Departure</Label>
                    <Input
                      value={flightForm.departure_time}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9:]/g, '')
                        if (val.length <= 5) setFlightForm({ ...flightForm, departure_time: val })
                      }}
                      placeholder="08:30"
                      maxLength={5}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground block mb-1">Arrival</Label>
                    <Input
                      value={flightForm.arrival_time}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9:]/g, '')
                        if (val.length <= 5) setFlightForm({ ...flightForm, arrival_time: val })
                      }}
                      placeholder="14:45"
                      maxLength={5}
                      className="font-mono"
                    />
                  </div>
                </div>

                {/* PNR & Seat */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground block mb-1">PNR(s)</Label>
                    <Input value={flightForm.pnr} onChange={(e) => setFlightForm({ ...flightForm, pnr: e.target.value })} placeholder="ABC123" className="font-mono uppercase" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground block mb-1">Seat(s)</Label>
                    <Input value={flightForm.seat} onChange={(e) => setFlightForm({ ...flightForm, seat: e.target.value })} placeholder="12A" />
                  </div>
                </div>

                {/* E-Ticket */}
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">E-Ticket URL</Label>
                  <Input value={flightForm.eticket} onChange={(e) => setFlightForm({ ...flightForm, eticket: e.target.value })} placeholder="https://..." />
                </div>

                {/* Cost */}
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">Total Cost (₹)</Label>
                  <Input type="number" value={flightForm.cost || ""} onChange={(e) => setFlightForm({ ...flightForm, cost: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
            <Button variant="outline" onClick={() => setEditingGuest(null)}>Cancel</Button>
            <Button
              onClick={() => editingGuest && updateFlight.mutate({ id: editingGuest.id, type: editingType, flight: flightForm })}
              disabled={updateFlight.isPending}
              className="min-w-[120px]"
            >
              {updateFlight.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><Check className="h-4 w-4 mr-2" />Save Booking</>
              )}
            </Button>
          </div>
        </ResizableSheetContent>
      </Sheet>
    </div>
  )
}

// Flight table component
function FlightTable({ guests, type, onEdit, formatDate, onQuickStatus }: { guests: Guest[]; type: "onward" | "return"; onEdit: (g: Guest) => void; formatDate: (d: string | undefined) => string; onQuickStatus?: (id: string, status: string) => void }) {
  // Get speaker's requested data (from travel_details) - always show what speaker asked for
  const getSpeakerRequest = (g: Guest, field: string): string | undefined => {
    const travel = g.custom_fields?.travel_details || {}

    if (type === "onward") {
      if (field === "from_city") return travel.onward_from_city || travel.from_city
      if (field === "to_city") return travel.onward_to_city
      if (field === "departure_date") return travel.onward_date || travel.arrival_date
      if (field === "departure_time") return travel.onward_departure_time
      if (field === "flight_number") return travel.onward_preferred_time
    } else {
      if (field === "from_city") return travel.return_from_city
      if (field === "to_city") return travel.return_to_city
      if (field === "departure_date") return travel.return_date || travel.departure_date
      if (field === "departure_time") return travel.return_departure_time
      if (field === "flight_number") return travel.return_preferred_time
    }
    return undefined
  }

  // Get booking data (admin-entered actual booking)
  const getBookingData = (g: Guest, field: string) => {
    const booking = g.custom_fields?.booking || {}
    return (booking as any)[`${type}_${field}`]
  }

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Guest</TableHead>
            <TableHead>Route (Request)</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Flight</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>PNR</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {guests.map((guest) => {
            const status = getBookingData(guest, "status") || "pending"
            const statusInfo = BOOKING_STATUS[status] || BOOKING_STATUS.pending

            return (
              <TableRow key={guest.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onEdit(guest)}>
                <TableCell>
                  <p className="font-medium">{guest.attendee_name}</p>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{getSpeakerRequest(guest, "from_city") || "-"}</span>
                </TableCell>
                <TableCell>{formatDate(getSpeakerRequest(guest, "departure_date"))}</TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{getSpeakerRequest(guest, "flight_number") || getBookingData(guest, "flight_number") || "-"}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{getSpeakerRequest(guest, "departure_time") || getBookingData(guest, "departure_time") || "-"}</span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{getBookingData(guest, "pnr") || "-"}</span>
                </TableCell>
                <TableCell>
                  <Badge className={cn("text-white text-xs", statusInfo.color)}>{statusInfo.label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {status === "pending" && onQuickStatus && (
                      <>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-gray-500" onClick={() => onQuickStatus(guest.id, "not_required")}>
                          N/A
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-blue-600" onClick={() => onQuickStatus(guest.id, "booked")}>
                          <CheckCircle className="h-3 w-3 mr-1" />Booked
                        </Button>
                      </>
                    )}
                    {status === "booked" && onQuickStatus && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-green-600" onClick={() => onQuickStatus(guest.id, "confirmed")}>
                        <Check className="h-3 w-3 mr-1" />Confirm
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
