"use client"

import { useState, useMemo, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
  Search,
  Plane,
  Loader2,
  CheckCircle,
  Clock,
  Phone,
  Mail,
  Calendar,
  ExternalLink,
  Check,
  X,
  User,
  Send,
  PlaneTakeoff,
  PlaneLanding,
  Upload,
  Trash2,
  AlertCircle,
  Sparkles,
  AlertTriangle,
  FileText,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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
    flight_preference_images?: string[]
    travel_details?: {
      mode?: string
      arrival_date?: string
      departure_date?: string
      from_city?: string
      to_city?: string
      onward_required?: boolean
      onward_from_city?: string
      onward_to_city?: string
      onward_date?: string
      onward_preferred_time?: string
      onward_departure_time?: string
      return_required?: boolean
      return_from_city?: string
      return_to_city?: string
      return_date?: string
      return_preferred_time?: string
      return_departure_time?: string
    }
    travel_id?: {
      id_document_url?: string
    }
    booking?: {
      onward_status?: "pending" | "booked" | "confirmed" | "cancelled"
      onward_pnr?: string
      onward_airline?: string
      onward_flight_number?: string
      onward_from_city?: string
      onward_to_city?: string
      onward_departure_date?: string
      onward_departure_time?: string
      onward_arrival_date?: string
      onward_arrival_time?: string
      onward_seat?: string
      onward_cost?: number
      onward_eticket?: string
      return_status?: "pending" | "booked" | "confirmed" | "cancelled" | "not_required"
      return_pnr?: string
      return_airline?: string
      return_flight_number?: string
      return_from_city?: string
      return_to_city?: string
      return_departure_date?: string
      return_departure_time?: string
      return_arrival_date?: string
      return_arrival_time?: string
      return_seat?: string
      return_cost?: number
      return_eticket?: string
    }
  } | null
}

const BOOKING_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-amber-500", icon: Clock },
  booked: { label: "Booked", color: "bg-blue-500", icon: CheckCircle },
  confirmed: { label: "Confirmed", color: "bg-green-500", icon: Check },
  cancelled: { label: "Cancelled", color: "bg-red-500", icon: X },
  not_required: { label: "Not Required", color: "bg-gray-500", icon: X },
}

export default function FlightAgentPortal() {
  const params = useParams()
  const token = params.token as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "booked" | "confirmed">("all")
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null)
  const [editingType, setEditingType] = useState<"onward" | "return">("onward")

  // AI Extraction state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionResult, setExtractionResult] = useState<any>(null)

  // Booking form state
  const [bookingForm, setBookingForm] = useState({
    status: "pending" as string,
    pnr: "",
    airline: "",
    flight_number: "",
    from_city: "",
    to_city: "",
    departure_date: "",
    departure_time: "",
    arrival_date: "",
    arrival_time: "",
    seat: "",
    cost: 0,
    eticket: "",
  })

  // Fetch event and speakers via API
  const { data: apiData, isLoading: dataLoading, error: dataError } = useQuery({
    queryKey: ["flight-agent-data", token],
    queryFn: async () => {
      const response = await fetch(`/api/travel-agent/speakers?event_id=${token}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to load data")
      return result as { event: any; speakers: Speaker[] }
    },
  })

  const event = apiData?.event
  const speakers = apiData?.speakers?.filter(s =>
    s.custom_fields?.travel_details?.mode === "flight" ||
    !s.custom_fields?.travel_details?.mode
  )

  // Filter speakers
  const filteredSpeakers = useMemo(() => {
    if (!speakers) return []
    return speakers.filter((speaker) => {
      const matchesSearch = !search ||
        speaker.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
        speaker.attendee_email.toLowerCase().includes(search.toLowerCase())
      const flightStatus = speaker.custom_fields?.booking?.onward_status || "pending"
      const matchesStatus = statusFilter === "all" || flightStatus === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [speakers, search, statusFilter])

  // Stats
  const stats = useMemo(() => {
    if (!speakers) return { total: 0, pending: 0, booked: 0 }
    return {
      total: speakers.length,
      pending: speakers.filter(s => (s.custom_fields?.booking?.onward_status || "pending") === "pending").length,
      booked: speakers.filter(s => ["booked", "confirmed"].includes(s.custom_fields?.booking?.onward_status || "")).length,
    }
  }, [speakers])

  // AI Ticket Extraction
  const handleTicketUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !editingSpeaker) return

    setIsExtracting(true)
    setExtractionResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("ticket_type", "flight")

      const travel = editingSpeaker.custom_fields?.travel_details || {}
      const requestedItinerary = editingType === "onward" ? {
        departure_city: travel.onward_from_city || travel.from_city,
        arrival_city: travel.onward_to_city,
        departure_date: travel.onward_date || travel.arrival_date,
        passenger_name: editingSpeaker.attendee_name,
      } : {
        departure_city: travel.return_from_city,
        arrival_city: travel.return_to_city || travel.from_city,
        departure_date: travel.return_date || travel.departure_date,
        passenger_name: editingSpeaker.attendee_name,
      }
      formData.append("requested_itinerary", JSON.stringify(requestedItinerary))

      const response = await fetch("/api/travel/extract-ticket", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (result.success && result.flight_details) {
        const details = result.flight_details
        setBookingForm(prev => ({
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
        setExtractionResult({
          success: true,
          confidence: result.confidence,
          discrepancies: result.cross_check?.discrepancies,
        })
        toast.success(`Ticket extracted! (${result.confidence}% confidence)`)
      } else {
        toast.error(result.error || "Could not extract ticket details")
      }
    } catch (error: any) {
      toast.error("Failed to extract ticket")
    } finally {
      setIsExtracting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [editingSpeaker, editingType])

  // Update booking mutation
  const updateBooking = useMutation({
    mutationFn: async ({ id, type, booking }: { id: string; type: "onward" | "return"; booking: typeof bookingForm }) => {
      const prefix = type
      const bookingUpdate = {
        [`${prefix}_status`]: booking.status,
        [`${prefix}_pnr`]: booking.pnr,
        [`${prefix}_airline`]: booking.airline,
        [`${prefix}_flight_number`]: booking.flight_number,
        [`${prefix}_from_city`]: booking.from_city,
        [`${prefix}_to_city`]: booking.to_city,
        [`${prefix}_departure_date`]: booking.departure_date,
        [`${prefix}_departure_time`]: booking.departure_time,
        [`${prefix}_arrival_date`]: booking.arrival_date,
        [`${prefix}_arrival_time`]: booking.arrival_time,
        [`${prefix}_seat`]: booking.seat,
        [`${prefix}_cost`]: booking.cost,
        [`${prefix}_eticket`]: booking.eticket,
      }

      const response = await fetch("/api/travel-agent/update-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: id,
          event_id: event?.id,
          booking: bookingUpdate,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      toast.success("Flight booking updated")
      setEditingSpeaker(null)
      queryClient.invalidateQueries({ queryKey: ["flight-agent-data", token] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Open edit panel
  const openEditPanel = (speaker: Speaker, type: "onward" | "return") => {
    const booking = speaker.custom_fields?.booking || {}
    const travel = speaker.custom_fields?.travel_details || {}
    setExtractionResult(null)

    if (type === "onward") {
      setBookingForm({
        status: booking.onward_status || "pending",
        pnr: booking.onward_pnr || "",
        airline: booking.onward_airline || "",
        flight_number: booking.onward_flight_number || travel.onward_preferred_time || "",
        from_city: booking.onward_from_city || travel.onward_from_city || travel.from_city || "",
        to_city: booking.onward_to_city || travel.onward_to_city || "",
        departure_date: booking.onward_departure_date || travel.onward_date || "",
        departure_time: booking.onward_departure_time || travel.onward_departure_time || "",
        arrival_date: booking.onward_arrival_date || "",
        arrival_time: booking.onward_arrival_time || "",
        seat: booking.onward_seat || "",
        cost: booking.onward_cost || 0,
        eticket: booking.onward_eticket || "",
      })
    } else {
      setBookingForm({
        status: booking.return_status || "pending",
        pnr: booking.return_pnr || "",
        airline: booking.return_airline || "",
        flight_number: booking.return_flight_number || travel.return_preferred_time || "",
        from_city: booking.return_from_city || travel.return_from_city || "",
        to_city: booking.return_to_city || travel.return_to_city || travel.from_city || "",
        departure_date: booking.return_departure_date || travel.return_date || "",
        departure_time: booking.return_departure_time || travel.return_departure_time || "",
        arrival_date: booking.return_arrival_date || "",
        arrival_time: booking.return_arrival_time || "",
        seat: booking.return_seat || "",
        cost: booking.return_cost || 0,
        eticket: booking.return_eticket || "",
      })
    }
    setEditingType(type)
    setEditingSpeaker(speaker)
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-muted-foreground">Loading flight portal...</p>
        </div>
      </div>
    )
  }

  if (dataError || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-muted-foreground">This flight agent link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Plane className="h-6 w-6" />
                <h1 className="text-xl font-bold">Flight Agent Portal</h1>
              </div>
              <p className="text-sm text-blue-100 mt-1">{event.name} • {event.city}</p>
            </div>
            <Badge className="bg-white/20 text-white border-0">
              <Calendar className="h-3.5 w-3.5 mr-1" />
              {formatDate(event.start_date)} - {formatDate(event.end_date)}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <button onClick={() => setStatusFilter("all")} className={cn("bg-white rounded-lg border p-4 text-left hover:shadow-md", statusFilter === "all" && "ring-2 ring-blue-500")}>
            <div className="flex items-center gap-2"><Plane className="h-5 w-5 text-blue-500" /><span className="text-sm text-muted-foreground">Total Flights</span></div>
            <p className="text-3xl font-bold mt-2">{stats.total}</p>
          </button>
          <button onClick={() => setStatusFilter("pending")} className={cn("bg-white rounded-lg border p-4 text-left hover:shadow-md", statusFilter === "pending" && "ring-2 ring-amber-500")}>
            <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-amber-500" /><span className="text-sm text-muted-foreground">Pending</span></div>
            <p className="text-3xl font-bold mt-2 text-amber-600">{stats.pending}</p>
          </button>
          <button onClick={() => setStatusFilter("booked")} className={cn("bg-white rounded-lg border p-4 text-left hover:shadow-md", statusFilter === "booked" && "ring-2 ring-green-500")}>
            <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /><span className="text-sm text-muted-foreground">Booked</span></div>
            <p className="text-3xl font-bold mt-2 text-green-600">{stats.booked}</p>
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </div>

        {/* Table */}
        {filteredSpeakers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed">
            <Plane className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No speakers found</h3>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-50">
                  <TableHead>Speaker</TableHead>
                  <TableHead>Onward Request</TableHead>
                  <TableHead>Return Request</TableHead>
                  <TableHead className="text-center">Onward Status</TableHead>
                  <TableHead className="text-center">Return Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSpeakers.map((speaker) => {
                  const travel = speaker.custom_fields?.travel_details || {}
                  const booking = speaker.custom_fields?.booking || {}
                  const onwardStatus = booking.onward_status || "pending"
                  const returnStatus = booking.return_status || "pending"

                  return (
                    <TableRow key={speaker.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-medium">{speaker.attendee_name}</p>
                          <p className="text-xs text-muted-foreground">{speaker.attendee_phone || speaker.attendee_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button onClick={() => openEditPanel(speaker, "onward")} className="text-left hover:bg-blue-50 p-2 rounded -m-2">
                          <div className="flex items-center gap-1.5 text-sm">
                            <PlaneTakeoff className="h-3.5 w-3.5 text-blue-500" />
                            <span>{travel.onward_from_city || "-"} → {travel.onward_to_city || "-"}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{formatDate(travel.onward_date)}</div>
                          {travel.onward_preferred_time && (
                            <div className="text-xs font-mono text-blue-600 mt-0.5">{travel.onward_preferred_time}</div>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        {travel.return_required !== false ? (
                          <button onClick={() => openEditPanel(speaker, "return")} className="text-left hover:bg-purple-50 p-2 rounded -m-2">
                            <div className="flex items-center gap-1.5 text-sm">
                              <PlaneLanding className="h-3.5 w-3.5 text-purple-500" />
                              <span>{travel.return_from_city || "-"} → {travel.return_to_city || "-"}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">{formatDate(travel.return_date)}</div>
                            {travel.return_preferred_time && (
                              <div className="text-xs font-mono text-purple-600 mt-0.5">{travel.return_preferred_time}</div>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not required</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <button onClick={() => openEditPanel(speaker, "onward")}>
                          <Badge className={cn("text-white text-xs", BOOKING_STATUS[onwardStatus].color)}>
                            {BOOKING_STATUS[onwardStatus].label}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        {travel.return_required !== false ? (
                          <button onClick={() => openEditPanel(speaker, "return")}>
                            <Badge className={cn("text-white text-xs", BOOKING_STATUS[returnStatus].color)}>
                              {BOOKING_STATUS[returnStatus].label}
                            </Badge>
                          </button>
                        ) : (
                          <Badge variant="outline" className="text-xs">N/A</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Edit Sheet */}
      <Sheet open={!!editingSpeaker} onOpenChange={(open) => !open && setEditingSpeaker(null)}>
        <ResizableSheetContent defaultWidth={700} minWidth={500} maxWidth={1000} storageKey="flight-agent-sheet-width" className="overflow-y-auto p-0">
          <div className={cn(
            "px-6 py-4 border-b",
            editingType === "onward" ? "bg-gradient-to-r from-blue-50 to-blue-100/50" : "bg-gradient-to-r from-purple-50 to-purple-100/50"
          )}>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", editingType === "onward" ? "bg-blue-500" : "bg-purple-500")}>
                  {editingType === "onward" ? <PlaneTakeoff className="h-5 w-5 text-white" /> : <PlaneLanding className="h-5 w-5 text-white" />}
                </div>
                <div>
                  <p className="text-lg font-semibold">{editingSpeaker?.attendee_name}</p>
                  <p className="text-sm font-normal text-muted-foreground">{editingType === "onward" ? "Onward" : "Return"} Flight</p>
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>

          <div className="grid grid-cols-2 gap-0 divide-x">
            {/* LEFT: Speaker's Request */}
            <div className="p-5 bg-slate-50/50">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Plane className="h-4 w-4 text-blue-600" />
                Speaker's Request
              </h3>
              {editingSpeaker && (() => {
                const travel = editingSpeaker.custom_fields?.travel_details
                const photoUrl = editingSpeaker.custom_fields?.photo_url
                const route = editingType === "onward"
                  ? `${travel?.onward_from_city || travel?.from_city || "-"} → ${travel?.onward_to_city || "-"}`
                  : `${travel?.return_from_city || "-"} → ${travel?.return_to_city || travel?.from_city || "-"}`
                const date = editingType === "onward" ? travel?.onward_date : travel?.return_date
                const flight = editingType === "onward" ? travel?.onward_preferred_time : travel?.return_preferred_time
                const time = editingType === "onward" ? travel?.onward_departure_time : travel?.return_departure_time

                return (
                  <div className="space-y-4">
                    {/* Photo & Contact */}
                    <div className="p-4 bg-white rounded-xl border shadow-sm">
                      <div className="flex items-start gap-3">
                        {photoUrl ? (
                          <img src={photoUrl} alt="" className="w-14 h-14 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center border">
                            <User className="h-6 w-6 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{editingSpeaker.attendee_name}</p>
                          {editingSpeaker.attendee_phone && (
                            <a href={`tel:${editingSpeaker.attendee_phone}`} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                              <Phone className="h-3 w-3" />{editingSpeaker.attendee_phone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-xl border shadow-sm">
                      <p className="text-xs text-muted-foreground mb-1">Route</p>
                      <p className="font-semibold text-lg">{route}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-white rounded-xl border shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Date</p>
                        <p className="font-medium">{date ? formatDate(date) : "-"}</p>
                      </div>
                      <div className="p-4 bg-white rounded-xl border shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Time</p>
                        <p className="font-mono font-medium">{time || "-"}</p>
                      </div>
                    </div>
                    {flight && (
                      <div className="p-4 bg-white rounded-xl border shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Preferred Flight</p>
                        <p className="font-mono font-semibold">{flight}</p>
                      </div>
                    )}

                    {/* Flight Screenshots */}
                    {editingSpeaker.custom_fields?.flight_preference_images?.length ? (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-xs text-green-700 font-medium mb-2">Flight Screenshots</p>
                        <div className="grid gap-2">
                          {editingSpeaker.custom_fields.flight_preference_images.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="" className="w-full rounded border hover:opacity-80" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* ID Document */}
                    {editingSpeaker.custom_fields?.travel_id?.id_document_url && (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => window.open(editingSpeaker.custom_fields?.travel_id?.id_document_url, "_blank")}>
                        <ExternalLink className="h-4 w-4 mr-2" />View ID Document
                      </Button>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* RIGHT: Booking Form */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Booking Details
                </h3>
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleTicketUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="gap-2 text-xs border-purple-200 hover:bg-purple-50" onClick={() => fileInputRef.current?.click()} disabled={isExtracting}>
                    {isExtracting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-purple-500" />}
                    AI Scan
                  </Button>
                </div>
              </div>

              {/* Extraction Result */}
              {extractionResult?.success && extractionResult.discrepancies?.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-700 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium text-sm">Mismatch Detected</span>
                  </div>
                  {extractionResult.discrepancies.map((d: any, i: number) => (
                    <div key={i} className="text-xs">
                      <span className="font-medium">{d.field}:</span> {d.requested} → {d.booked}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <Label className="font-medium">Status</Label>
                  <Select value={bookingForm.status} onValueChange={(v) => setBookingForm({ ...bookingForm, status: v })}>
                    <SelectTrigger className="w-[140px] bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="booked">Booked</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      {editingType === "return" && <SelectItem value="not_required">Not Required</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Airline</Label><Input value={bookingForm.airline} onChange={(e) => setBookingForm({ ...bookingForm, airline: e.target.value })} className="mt-1" /></div>
                  <div><Label className="text-xs">Flight No</Label><Input value={bookingForm.flight_number} onChange={(e) => setBookingForm({ ...bookingForm, flight_number: e.target.value.toUpperCase() })} className="mt-1 font-mono" /></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">From</Label><Input value={bookingForm.from_city} onChange={(e) => setBookingForm({ ...bookingForm, from_city: e.target.value })} className="mt-1" /></div>
                  <div><Label className="text-xs">To</Label><Input value={bookingForm.to_city} onChange={(e) => setBookingForm({ ...bookingForm, to_city: e.target.value })} className="mt-1" /></div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Date</Label><Input type="date" value={bookingForm.departure_date} onChange={(e) => setBookingForm({ ...bookingForm, departure_date: e.target.value })} className="mt-1" /></div>
                  <div><Label className="text-xs">Departure</Label><Input value={bookingForm.departure_time} onChange={(e) => setBookingForm({ ...bookingForm, departure_time: e.target.value })} placeholder="08:30" maxLength={5} className="mt-1 font-mono" /></div>
                  <div><Label className="text-xs">Arrival</Label><Input value={bookingForm.arrival_time} onChange={(e) => setBookingForm({ ...bookingForm, arrival_time: e.target.value })} placeholder="14:45" maxLength={5} className="mt-1 font-mono" /></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">PNR</Label><Input value={bookingForm.pnr} onChange={(e) => setBookingForm({ ...bookingForm, pnr: e.target.value.toUpperCase() })} className="mt-1 font-mono uppercase" /></div>
                  <div><Label className="text-xs">Seat</Label><Input value={bookingForm.seat} onChange={(e) => setBookingForm({ ...bookingForm, seat: e.target.value.toUpperCase() })} className="mt-1" /></div>
                </div>

                <div><Label className="text-xs">E-Ticket URL</Label><Input value={bookingForm.eticket} onChange={(e) => setBookingForm({ ...bookingForm, eticket: e.target.value })} className="mt-1" /></div>

                <div><Label className="text-xs">Cost (₹)</Label><Input type="number" value={bookingForm.cost || ""} onChange={(e) => setBookingForm({ ...bookingForm, cost: parseFloat(e.target.value) || 0 })} className="mt-1" /></div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
            <Button variant="outline" onClick={() => setEditingSpeaker(null)}>Cancel</Button>
            <Button onClick={() => editingSpeaker && updateBooking.mutate({ id: editingSpeaker.id, type: editingType, booking: bookingForm })} disabled={updateBooking.isPending}>
              {updateBooking.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Save Booking
            </Button>
          </div>
        </ResizableSheetContent>
      </Sheet>
    </div>
  )
}
