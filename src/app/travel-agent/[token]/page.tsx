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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
  Hotel,
  Loader2,
  CheckCircle,
  Clock,
  Phone,
  MapPin,
  Calendar,
  Edit,
  ExternalLink,
  Check,
  X,
  User,
  Car,
  Send,
  PlaneTakeoff,
  PlaneLanding,
  Upload,
  Trash2,
  AlertCircle,
  Sparkles,
  AlertTriangle,
  Copy,
  FileText,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
      onward_via_city?: string
      onward_to_city?: string
      onward_date?: string
      onward_preferred_time?: string
      onward_departure_time?: string
      onward_leg2_flight?: string
      onward_leg2_time?: string
      return_required?: boolean
      return_from_city?: string
      return_via_city?: string
      return_to_city?: string
      return_date?: string
      return_preferred_time?: string
      return_departure_time?: string
      return_leg2_flight?: string
      return_leg2_time?: string
      hotel_required?: boolean
      hotel_nights?: number
      hotel_check_in?: string
      hotel_check_out?: string
      hotel_room_type?: string
      special_requirements?: string
    }
    travel_id?: {
      id_document_url?: string
      full_name_as_passport?: string
      date_of_birth?: string
      gender?: string
      passport_number?: string
      preferred_airline?: string
      seat_preference?: string
      meal_preference?: string
      frequent_flyer_number?: string
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
      return_eticket?: string
      hotel_status?: "pending" | "booked" | "confirmed"
      hotel_name?: string
      hotel_address?: string
      hotel_phone?: string
      hotel_confirmation?: string
      hotel_checkin?: string
      hotel_checkout?: string
      hotel_room_type?: string
      pickup_required?: boolean
      pickup_details?: string
      drop_required?: boolean
      drop_details?: string
      internal_notes?: string
      voucher_sent?: boolean
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

export default function TravelAgentPortal() {
  const params = useParams()
  const token = params.token as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "booked" | "confirmed">("all")
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null)
  const [uploadingOnward, setUploadingOnward] = useState(false)
  const [uploadingReturn, setUploadingReturn] = useState(false)

  // Booking form state
  const [bookingForm, setBookingForm] = useState({
    onward_status: "pending" as "pending" | "booked" | "confirmed" | "cancelled",
    onward_pnr: "",
    onward_airline: "",
    onward_flight_number: "",
    onward_from_city: "",
    onward_to_city: "",
    onward_departure_date: "",
    onward_departure_time: "",
    onward_arrival_date: "",
    onward_arrival_time: "",
    onward_seat: "",
    onward_eticket: "",
    return_status: "pending" as "pending" | "booked" | "confirmed" | "cancelled" | "not_required",
    return_pnr: "",
    return_airline: "",
    return_flight_number: "",
    return_from_city: "",
    return_to_city: "",
    return_departure_date: "",
    return_departure_time: "",
    return_arrival_date: "",
    return_arrival_time: "",
    return_seat: "",
    return_eticket: "",
    hotel_status: "pending" as "pending" | "booked" | "confirmed",
    hotel_name: "",
    hotel_address: "",
    hotel_phone: "",
    hotel_confirmation: "",
    hotel_checkin: "",
    hotel_checkout: "",
    hotel_room_type: "",
    pickup_required: false,
    pickup_details: "",
    drop_required: false,
    drop_details: "",
  })

  // AI Ticket Extraction State
  const ticketFileRef = useRef<HTMLInputElement>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractionResult, setExtractionResult] = useState<{
    success: boolean
    confidence: number
    onward?: {
      matched: boolean
      discrepancies?: any[]
      pnr?: string
      airline?: string
      flight_number?: string
      departure_city?: string
      departure_airport?: string
      arrival_city?: string
      arrival_airport?: string
      departure_date?: string
      departure_time?: string
      arrival_time?: string
      seat_number?: string
    }
    return?: {
      matched: boolean
      discrepancies?: any[]
      pnr?: string
      airline?: string
      flight_number?: string
      departure_city?: string
      departure_airport?: string
      arrival_city?: string
      arrival_airport?: string
      departure_date?: string
      departure_time?: string
      arrival_time?: string
      seat_number?: string
    }
    journeys_found?: number
  } | null>(null)

  // Ticket Type Selection Dialog
  const [ticketDialog, setTicketDialog] = useState<{
    open: boolean
    file: File | null
  }>({ open: false, file: null })

  // Handle file selection - show ticket type dialog
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setTicketDialog({ open: true, file })
    }
  }, [])

  // Process ticket extraction with selected category
  const processTicketExtraction = useCallback(async (ticketCategory: "oneway" | "roundtrip" | "multicity") => {
    if (!editingSpeaker || !ticketDialog.file) return

    // Store file reference before closing dialog
    const file = ticketDialog.file
    setTicketDialog({ open: false, file: null })
    setExtracting(true)
    setExtractionResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("ticket_category", ticketCategory)

      // Add speaker's travel requests for matching
      const travel = editingSpeaker.custom_fields?.travel_details || {}

      // Only send onward request if speaker requested onward travel
      if (travel.onward_required) {
        const onwardRequest = {
          departure_city: travel.onward_from_city || travel.from_city,
          arrival_city: travel.onward_to_city,
          departure_date: travel.onward_date || travel.arrival_date,
        }
        formData.append("requested_onward", JSON.stringify(onwardRequest))
      }

      // Only send return request if speaker requested return travel
      if (travel.return_required) {
        const returnRequest = {
          departure_city: travel.return_from_city,
          arrival_city: travel.return_to_city || travel.from_city,
          departure_date: travel.return_date || travel.departure_date,
        }
        formData.append("requested_return", JSON.stringify(returnRequest))
      }

      const response = await fetch("/api/travel/extract-ticket", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        // Update onward form if matched
        if (result.onward?.matched) {
          const o = result.onward
          setBookingForm(prev => ({
            ...prev,
            onward_pnr: o.pnr || prev.onward_pnr,
            onward_airline: o.airline || prev.onward_airline,
            onward_flight_number: o.flight_number || prev.onward_flight_number,
            onward_from_city: o.departure_airport || o.departure_city || prev.onward_from_city,
            onward_to_city: o.arrival_airport || o.arrival_city || prev.onward_to_city,
            onward_departure_date: o.departure_date || prev.onward_departure_date,
            onward_departure_time: o.departure_time || prev.onward_departure_time,
            onward_arrival_date: o.departure_date || prev.onward_arrival_date, // Same as departure for domestic flights
            onward_arrival_time: o.arrival_time || prev.onward_arrival_time,
            onward_seat: o.seat_number || prev.onward_seat,
            onward_status: o.pnr ? "booked" : prev.onward_status,
          }))
        }

        // Update return form if matched
        if (result.return?.matched) {
          const r = result.return
          setBookingForm(prev => ({
            ...prev,
            return_pnr: r.pnr || prev.return_pnr,
            return_airline: r.airline || prev.return_airline,
            return_flight_number: r.flight_number || prev.return_flight_number,
            return_from_city: r.departure_airport || r.departure_city || prev.return_from_city,
            return_to_city: r.arrival_airport || r.arrival_city || prev.return_to_city,
            return_departure_date: r.departure_date || prev.return_departure_date,
            return_departure_time: r.departure_time || prev.return_departure_time,
            return_arrival_date: r.departure_date || prev.return_arrival_date, // Same as departure for domestic flights
            return_arrival_time: r.arrival_time || prev.return_arrival_time,
            return_seat: r.seat_number || prev.return_seat,
            return_status: r.pnr ? "booked" : prev.return_status,
          }))
        }

        // Set extraction result for display
        setExtractionResult({
          success: true,
          confidence: result.confidence,
          journeys_found: result.journeys_found,
          onward: result.onward,
          return: result.return,
        })

        // Show toast based on results
        const onwardOk = result.onward?.matched
        const returnOk = result.return?.matched
        if (ticketCategory === "roundtrip") {
          if (onwardOk && returnOk) {
            toast.success("Both journeys matched and extracted!")
          } else if (onwardOk) {
            toast.success("Onward journey matched! Return journey not matched.")
          } else if (returnOk) {
            toast.success("Return journey matched! Onward journey not matched.")
          } else {
            toast.error("No journeys matched speaker's request. Please check the ticket.")
          }
        } else {
          if (onwardOk || returnOk) {
            toast.success(`Ticket matched & extracted! (${result.confidence}% confidence)`)
          } else {
            toast.error("Ticket does not match speaker's request.")
          }
        }
      } else {
        toast.error(result.error || "Could not extract ticket details")
        setExtractionResult({ success: false, confidence: 0 })
      }
    } catch (error: any) {
      console.error("Ticket extraction error:", error)
      toast.error(`Failed to extract ticket: ${error?.message || "Unknown error"}`)
      setExtractionResult({ success: false, confidence: 0 })
    } finally {
      setExtracting(false)
      if (ticketFileRef.current) ticketFileRef.current.value = ""
    }
  }, [editingSpeaker, ticketDialog.file])

  // Fetch event and speakers via API (bypasses RLS)
  const { data: apiData, isLoading: dataLoading, error: dataError } = useQuery({
    queryKey: ["travel-agent-data", token],
    queryFn: async () => {
      const response = await fetch(`/api/travel-agent/speakers?event_id=${token}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to load data")
      }

      return result as { event: any; speakers: Speaker[] }
    },
  })

  const event = apiData?.event
  const speakers = apiData?.speakers
  const eventLoading = dataLoading
  const speakersLoading = dataLoading
  const eventError = dataError

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

  // Upload ticket handler
  const handleTicketUpload = async (file: File, type: "onward" | "return") => {
    if (type === "onward") setUploadingOnward(true)
    else setUploadingReturn(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("bucket", "event-assets")
      formData.append("folder", `tickets/${event?.id}`)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      if (type === "onward") {
        setBookingForm(prev => ({ ...prev, onward_eticket: result.url }))
      } else {
        setBookingForm(prev => ({ ...prev, return_eticket: result.url }))
      }
      toast.success("Ticket uploaded!")
    } catch (error: any) {
      toast.error(error.message || "Upload failed")
    } finally {
      if (type === "onward") setUploadingOnward(false)
      else setUploadingReturn(false)
    }
  }

  // Update booking mutation - uses API route to bypass RLS
  const updateBooking = useMutation({
    mutationFn: async ({ id, booking }: { id: string; booking: typeof bookingForm }) => {
      const response = await fetch("/api/travel-agent/update-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: id,
          event_id: event?.id,
          booking,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      toast.success("Booking updated successfully")
      setEditingSpeaker(null)
      queryClient.invalidateQueries({ queryKey: ["travel-agent-data", token] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Send itinerary email mutation
  const sendItinerary = useMutation({
    mutationFn: async (speaker: Speaker) => {
      const booking = speaker.custom_fields?.booking || {}
      const response = await fetch("/api/email/travel-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: speaker.id,
          speaker_name: speaker.attendee_name,
          speaker_email: speaker.attendee_email,
          event_name: event?.name || "Event",
          event_start_date: event?.start_date || "",
          event_end_date: event?.end_date || "",
          event_venue: event?.venue_name,
          booking,
        }),
      })
      const result = await response.json()
      if (!result.success && !result.dev_mode) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      toast.success("Itinerary email sent to speaker")
      queryClient.invalidateQueries({ queryKey: ["travel-agent-data", token] })
    },
    onError: (error: Error) => {
      toast.error(`Failed to send: ${error.message}`)
    },
  })

  // Open edit modal
  const openEditModal = (speaker: Speaker) => {
    const booking = speaker.custom_fields?.booking || {}
    const travelDetails = speaker.custom_fields?.travel_details || {}

    setBookingForm({
      onward_status: booking.onward_status || "pending",
      onward_pnr: booking.onward_pnr || "",
      onward_airline: booking.onward_airline || "",
      onward_flight_number: booking.onward_flight_number || travelDetails.onward_preferred_time || "",
      onward_from_city: booking.onward_from_city || travelDetails.onward_from_city || travelDetails.from_city || "",
      onward_to_city: booking.onward_to_city || travelDetails.onward_to_city || "",
      onward_departure_date: booking.onward_departure_date || travelDetails.onward_date || "",
      onward_departure_time: booking.onward_departure_time || travelDetails.onward_departure_time || "",
      onward_arrival_date: booking.onward_arrival_date || "",
      onward_arrival_time: booking.onward_arrival_time || "",
      onward_seat: booking.onward_seat || "",
      onward_eticket: booking.onward_eticket || "",
      return_status: booking.return_status || "pending",
      return_pnr: booking.return_pnr || "",
      return_airline: booking.return_airline || "",
      return_flight_number: booking.return_flight_number || travelDetails.return_preferred_time || "",
      return_from_city: booking.return_from_city || travelDetails.return_from_city || "",
      return_to_city: booking.return_to_city || travelDetails.return_to_city || travelDetails.from_city || "",
      return_departure_date: booking.return_departure_date || travelDetails.return_date || "",
      return_departure_time: booking.return_departure_time || travelDetails.return_departure_time || "",
      return_arrival_date: booking.return_arrival_date || "",
      return_arrival_time: booking.return_arrival_time || "",
      return_seat: booking.return_seat || "",
      return_eticket: booking.return_eticket || "",
      hotel_status: booking.hotel_status || "pending",
      hotel_name: booking.hotel_name || "",
      hotel_address: booking.hotel_address || "",
      hotel_phone: booking.hotel_phone || "",
      hotel_confirmation: booking.hotel_confirmation || "",
      hotel_checkin: booking.hotel_checkin || travelDetails.hotel_check_in || "",
      hotel_checkout: booking.hotel_checkout || travelDetails.hotel_check_out || "",
      hotel_room_type: booking.hotel_room_type || "",
      pickup_required: booking.pickup_required || false,
      pickup_details: booking.pickup_details || "",
      drop_required: booking.drop_required || false,
      drop_details: booking.drop_details || "",
    })
    setExtractionResult(null) // Clear previous extraction results
    setEditingSpeaker(speaker)
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  // Copy travel details to clipboard for booking agents
  const copyTravelDetails = () => {
    if (!editingSpeaker) return

    const travel = editingSpeaker.custom_fields?.travel_details || {}
    const travelId = editingSpeaker.custom_fields?.travel_id || {}

    // Build route string with via city if connecting
    const onwardRoute = travel.onward_via_city
      ? `${travel.onward_from_city || travel.from_city || "-"} → ${travel.onward_via_city} → ${travel.onward_to_city || "-"}`
      : `${travel.onward_from_city || travel.from_city || "-"} → ${travel.onward_to_city || "-"}`

    const returnRoute = travel.return_via_city
      ? `${travel.return_from_city || "-"} → ${travel.return_via_city} → ${travel.return_to_city || travel.from_city || "-"}`
      : `${travel.return_from_city || "-"} → ${travel.return_to_city || travel.from_city || "-"}`

    const lines = [
      `=== TRAVEL BOOKING REQUEST ===`,
      ``,
      `PASSENGER DETAILS:`,
      `Name: ${travelId.full_name_as_passport || editingSpeaker.attendee_name}`,
      `Email: ${editingSpeaker.attendee_email}`,
      `Phone: ${editingSpeaker.attendee_phone || "-"}`,
      travelId.date_of_birth ? `DOB: ${formatDate(travelId.date_of_birth)}` : "",
      travelId.gender ? `Gender: ${travelId.gender}` : "",
      travelId.passport_number ? `ID/Passport: ${travelId.passport_number}` : "",
      ``,
      `ONWARD JOURNEY:`,
      `Route: ${onwardRoute}`,
      `Date: ${formatDate(travel.onward_date || travel.arrival_date)}`,
      `Leg 1 Flight: ${travel.onward_preferred_time || "-"}`,
      `Leg 1 Time: ${travel.onward_departure_time || "-"}`,
      travel.onward_via_city && travel.onward_leg2_flight ? `Leg 2 Flight: ${travel.onward_leg2_flight}` : "",
      travel.onward_via_city && travel.onward_leg2_time ? `Leg 2 Time: ${travel.onward_leg2_time}` : "",
      ``,
      `RETURN JOURNEY:`,
      `Route: ${returnRoute}`,
      `Date: ${formatDate(travel.return_date || travel.departure_date)}`,
      `Leg 1 Flight: ${travel.return_preferred_time || "-"}`,
      `Leg 1 Time: ${travel.return_departure_time || "-"}`,
      travel.return_via_city && travel.return_leg2_flight ? `Leg 2 Flight: ${travel.return_leg2_flight}` : "",
      travel.return_via_city && travel.return_leg2_time ? `Leg 2 Time: ${travel.return_leg2_time}` : "",
      ``,
      travel.hotel_required ? `HOTEL REQUIRED: Yes` : "",
      travel.hotel_required ? `Check-in: ${formatDate(travel.hotel_check_in)}` : "",
      travel.hotel_required ? `Check-out: ${formatDate(travel.hotel_check_out)}` : "",
      travel.hotel_room_type ? `Room Type: ${travel.hotel_room_type}` : "",
      ``,
      travelId.preferred_airline ? `Preferred Airline: ${travelId.preferred_airline}` : "",
      travelId.seat_preference ? `Seat Preference: ${travelId.seat_preference}` : "",
      travelId.meal_preference ? `Meal Preference: ${travelId.meal_preference}` : "",
      travelId.frequent_flyer_number ? `FF Number: ${travelId.frequent_flyer_number}` : "",
    ].filter(Boolean).join("\n")

    navigator.clipboard.writeText(lines)
    toast.success("Travel details copied to clipboard!")
  }

  // Download PDF itinerary
  const downloadPDF = () => {
    if (!editingSpeaker) return
    window.open(`/api/itinerary/${editingSpeaker.id}/pdf`, "_blank")
  }

  // Loading state
  if (eventLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading travel portal...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (eventError || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-muted-foreground">
            This travel agent link is invalid or has expired. Please contact the event organizer for a new link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Plane className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Travel Agent Portal</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {event.name} • {event.city}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                {formatDate(event.start_date)} - {formatDate(event.end_date)}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setStatusFilter("all")}
            className={cn(
              "bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md",
              statusFilter === "all" && "ring-2 ring-primary"
            )}
          >
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total Speakers</span>
            </div>
            <p className="text-3xl font-bold mt-2">{stats.total}</p>
          </button>

          <button
            onClick={() => setStatusFilter("pending")}
            className={cn(
              "bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md",
              statusFilter === "pending" && "ring-2 ring-amber-500"
            )}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-sm text-muted-foreground">Pending Bookings</span>
            </div>
            <p className="text-3xl font-bold mt-2 text-amber-600">{stats.pending}</p>
          </button>

          <button
            onClick={() => setStatusFilter("booked")}
            className={cn(
              "bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md",
              statusFilter === "booked" && "ring-2 ring-green-500"
            )}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
            <p className="text-3xl font-bold mt-2 text-green-600">{stats.booked}</p>
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredSpeakers.length} speaker{filteredSpeakers.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Speakers Table */}
        {speakersLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSpeakers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed">
            <Plane className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No speakers found</h3>
            <p className="text-muted-foreground">
              {speakers?.length === 0
                ? "No speakers need travel assistance for this event"
                : "Try adjusting your search or filter"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Speaker</TableHead>
                  <TableHead>Travel Request</TableHead>
                  <TableHead>Preferred Flight</TableHead>
                  <TableHead className="text-center">Flight Status</TableHead>
                  <TableHead className="text-center">Hotel</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSpeakers.map((speaker) => {
                  const flightStatus = speaker.custom_fields?.booking?.onward_status || "pending"
                  const hotelStatus = speaker.custom_fields?.booking?.hotel_status || "pending"
                  const needsHotel = speaker.custom_fields?.travel_details?.hotel_required
                  const FlightIcon = BOOKING_STATUS[flightStatus].icon

                  return (
                    <TableRow key={speaker.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-medium">{speaker.attendee_name}</p>
                          <p className="text-xs text-muted-foreground">{speaker.attendee_email}</p>
                          {speaker.attendee_phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3" />
                              {speaker.attendee_phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <PlaneTakeoff className="h-3.5 w-3.5 text-blue-500" />
                            <span>{speaker.custom_fields?.travel_details?.onward_from_city || "-"}</span>
                            {speaker.custom_fields?.travel_details?.onward_via_city && (
                              <>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-orange-600 font-medium">{speaker.custom_fields.travel_details.onward_via_city}</span>
                              </>
                            )}
                            <span className="text-muted-foreground">→</span>
                            <span>{speaker.custom_fields?.travel_details?.onward_to_city || "-"}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(speaker.custom_fields?.travel_details?.onward_date)}
                          </div>
                          {speaker.custom_fields?.travel_details?.return_required !== false && (
                            <>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <PlaneLanding className="h-3.5 w-3.5 text-purple-500" />
                                <span>{speaker.custom_fields?.travel_details?.return_from_city || "-"}</span>
                                {speaker.custom_fields?.travel_details?.return_via_city && (
                                  <>
                                    <span className="text-muted-foreground">→</span>
                                    <span className="text-orange-600 font-medium">{speaker.custom_fields.travel_details.return_via_city}</span>
                                  </>
                                )}
                                <span className="text-muted-foreground">→</span>
                                <span>{speaker.custom_fields?.travel_details?.return_to_city || "-"}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(speaker.custom_fields?.travel_details?.return_date)}
                              </div>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {speaker.custom_fields?.travel_details?.onward_preferred_time && (
                            <div className="space-y-0.5">
                              <div className="font-mono text-sm bg-blue-50 px-2 py-0.5 rounded inline-block">
                                Leg1: {speaker.custom_fields.travel_details.onward_preferred_time}
                                {speaker.custom_fields.travel_details.onward_departure_time && (
                                  <span className="text-muted-foreground ml-1">
                                    @ {speaker.custom_fields.travel_details.onward_departure_time}
                                  </span>
                                )}
                              </div>
                              {speaker.custom_fields.travel_details.onward_leg2_flight && (
                                <div className="font-mono text-sm bg-orange-50 px-2 py-0.5 rounded inline-block">
                                  Leg2: {speaker.custom_fields.travel_details.onward_leg2_flight}
                                  {speaker.custom_fields.travel_details.onward_leg2_time && (
                                    <span className="text-muted-foreground ml-1">
                                      @ {speaker.custom_fields.travel_details.onward_leg2_time}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          {speaker.custom_fields?.travel_details?.return_preferred_time && (
                            <div className="space-y-0.5">
                              <div className="font-mono text-sm bg-purple-50 px-2 py-0.5 rounded inline-block">
                                Leg1: {speaker.custom_fields.travel_details.return_preferred_time}
                                {speaker.custom_fields.travel_details.return_departure_time && (
                                  <span className="text-muted-foreground ml-1">
                                    @ {speaker.custom_fields.travel_details.return_departure_time}
                                  </span>
                                )}
                              </div>
                              {speaker.custom_fields.travel_details.return_leg2_flight && (
                                <div className="font-mono text-sm bg-orange-50 px-2 py-0.5 rounded inline-block">
                                  Leg2: {speaker.custom_fields.travel_details.return_leg2_flight}
                                  {speaker.custom_fields.travel_details.return_leg2_time && (
                                    <span className="text-muted-foreground ml-1">
                                      @ {speaker.custom_fields.travel_details.return_leg2_time}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          {speaker.custom_fields?.flight_preference_images && speaker.custom_fields.flight_preference_images.length > 0 && (
                            <a
                              href={speaker.custom_fields.flight_preference_images[0]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View screenshot
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("text-white text-xs", BOOKING_STATUS[flightStatus].color)}>
                          <FlightIcon className="h-3 w-3 mr-1" />
                          {BOOKING_STATUS[flightStatus].label}
                        </Badge>
                        {speaker.custom_fields?.booking?.onward_eticket && (
                          <a
                            href={speaker.custom_fields.booking.onward_eticket}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-blue-600 hover:underline mt-1"
                          >
                            View ticket
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {needsHotel ? (
                          <Badge className={cn("text-white text-xs", BOOKING_STATUS[hotelStatus].color)}>
                            {BOOKING_STATUS[hotelStatus].label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Not Required
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(speaker)}
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => sendItinerary.mutate(speaker)}
                            disabled={sendItinerary.isPending}
                            title="Send itinerary email"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Edit Booking Modal */}
      <Dialog open={!!editingSpeaker} onOpenChange={(open) => !open && setEditingSpeaker(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div>{editingSpeaker?.attendee_name}</div>
                <div className="text-sm font-normal text-muted-foreground">{editingSpeaker?.attendee_email}</div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* AI Ticket Scanner - Single Button */}
          <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-purple-800 flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Ticket Scanner
                </h4>
                <p className="text-sm text-purple-600 mt-1">
                  Upload ticket PDF to auto-extract all booking details
                </p>
              </div>
              <div>
                <input
                  ref={ticketFileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  onClick={() => ticketFileRef.current?.click()}
                  disabled={extracting}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {extracting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Scan Ticket
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Extraction Results Summary */}
            {extractionResult && extractionResult.success && (
              <div className="mt-4 space-y-3">
                {/* Onward Result */}
                {extractionResult.onward && (
                  <div className={cn(
                    "p-3 rounded-lg border",
                    extractionResult.onward.matched
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      {extractionResult.onward.matched ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                      <span className={cn(
                        "font-medium text-sm",
                        extractionResult.onward.matched ? "text-green-700" : "text-red-700"
                      )}>
                        Onward Journey {extractionResult.onward.matched ? "Matched!" : "Not Matched"}
                      </span>
                    </div>
                    {extractionResult.onward.matched ? (
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div><span className="text-gray-500">PNR:</span> <span className="font-mono font-medium">{extractionResult.onward.pnr || "-"}</span></div>
                        <div><span className="text-gray-500">Flight:</span> <span className="font-medium">{extractionResult.onward.flight_number || "-"}</span></div>
                        <div><span className="text-gray-500">From:</span> <span className="font-medium">{extractionResult.onward.departure_airport || extractionResult.onward.departure_city || "-"}</span></div>
                        <div><span className="text-gray-500">To:</span> <span className="font-medium">{extractionResult.onward.arrival_airport || extractionResult.onward.arrival_city || "-"}</span></div>
                        <div><span className="text-gray-500">Date:</span> <span className="font-medium">{extractionResult.onward.departure_date || "-"}</span></div>
                        <div><span className="text-gray-500">Dep:</span> <span className="font-medium">{extractionResult.onward.departure_time || "-"}</span></div>
                        <div><span className="text-gray-500">Arr:</span> <span className="font-medium">{extractionResult.onward.arrival_time || "-"}</span></div>
                        <div><span className="text-gray-500">Seat:</span> <span className="font-medium">{extractionResult.onward.seat_number || "-"}</span></div>
                      </div>
                    ) : extractionResult.onward.discrepancies && (
                      <div className="text-xs space-y-1">
                        {extractionResult.onward.discrepancies.map((d: any, i: number) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-gray-500">{d.field}:</span>
                            <span className="text-green-600">Requested: {d.requested}</span>
                            <span className="text-red-600">Found: {d.extracted}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Return Result */}
                {extractionResult.return && (
                  <div className={cn(
                    "p-3 rounded-lg border",
                    extractionResult.return.matched
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      {extractionResult.return.matched ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                      <span className={cn(
                        "font-medium text-sm",
                        extractionResult.return.matched ? "text-green-700" : "text-red-700"
                      )}>
                        Return Journey {extractionResult.return.matched ? "Matched!" : "Not Matched"}
                      </span>
                    </div>
                    {extractionResult.return.matched ? (
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div><span className="text-gray-500">PNR:</span> <span className="font-mono font-medium">{extractionResult.return.pnr || "-"}</span></div>
                        <div><span className="text-gray-500">Flight:</span> <span className="font-medium">{extractionResult.return.flight_number || "-"}</span></div>
                        <div><span className="text-gray-500">From:</span> <span className="font-medium">{extractionResult.return.departure_airport || extractionResult.return.departure_city || "-"}</span></div>
                        <div><span className="text-gray-500">To:</span> <span className="font-medium">{extractionResult.return.arrival_airport || extractionResult.return.arrival_city || "-"}</span></div>
                        <div><span className="text-gray-500">Date:</span> <span className="font-medium">{extractionResult.return.departure_date || "-"}</span></div>
                        <div><span className="text-gray-500">Dep:</span> <span className="font-medium">{extractionResult.return.departure_time || "-"}</span></div>
                        <div><span className="text-gray-500">Arr:</span> <span className="font-medium">{extractionResult.return.arrival_time || "-"}</span></div>
                        <div><span className="text-gray-500">Seat:</span> <span className="font-medium">{extractionResult.return.seat_number || "-"}</span></div>
                      </div>
                    ) : extractionResult.return.discrepancies && (
                      <div className="text-xs space-y-1">
                        {extractionResult.return.discrepancies.map((d: any, i: number) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-gray-500">{d.field}:</span>
                            <span className="text-green-600">Requested: {d.requested}</span>
                            <span className="text-red-600">Found: {d.extracted}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs text-gray-500 text-right">
                  {extractionResult.journeys_found} journey(s) found • {extractionResult.confidence}% confidence
                </div>
              </div>
            )}
          </div>

          {/* Speaker's Travel Request Summary */}
          {editingSpeaker?.custom_fields?.travel_details && (
            <div className="space-y-3 mt-4">
              {/* Onward Request */}
              {editingSpeaker.custom_fields.travel_details.onward_required !== false && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2 text-sm">
                    <PlaneTakeoff className="h-4 w-4" />
                    Onward Flight Request
                    {editingSpeaker.custom_fields.travel_details.onward_via_city && (
                      <span className="text-orange-600 text-xs font-normal">(Connecting)</span>
                    )}
                  </h4>
                  <div className="grid grid-cols-6 gap-3 text-sm">
                    <div>
                      <span className="text-blue-600 text-xs">From</span>
                      <p className="text-blue-900 font-semibold">{editingSpeaker.custom_fields.travel_details.onward_from_city || "-"}</p>
                    </div>
                    {editingSpeaker.custom_fields.travel_details.onward_via_city && (
                      <div>
                        <span className="text-orange-600 text-xs">Via</span>
                        <p className="text-orange-700 font-semibold">{editingSpeaker.custom_fields.travel_details.onward_via_city}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-blue-600 text-xs">To</span>
                      <p className="text-blue-900 font-semibold">{editingSpeaker.custom_fields.travel_details.onward_to_city || "-"}</p>
                    </div>
                    <div>
                      <span className="text-blue-600 text-xs">Date</span>
                      <p className="text-blue-900 font-semibold">{formatDate(editingSpeaker.custom_fields.travel_details.onward_date)}</p>
                    </div>
                    <div>
                      <span className="text-blue-600 text-xs">Leg 1 Flight</span>
                      <p className="text-blue-900 font-semibold font-mono">{editingSpeaker.custom_fields.travel_details.onward_preferred_time || "-"}</p>
                      {editingSpeaker.custom_fields.travel_details.onward_departure_time && (
                        <p className="text-blue-700 text-xs">@ {editingSpeaker.custom_fields.travel_details.onward_departure_time}</p>
                      )}
                    </div>
                    {editingSpeaker.custom_fields.travel_details.onward_via_city && (
                      <div>
                        <span className="text-orange-600 text-xs">Leg 2 Flight</span>
                        <p className="text-orange-700 font-semibold font-mono">{editingSpeaker.custom_fields.travel_details.onward_leg2_flight || "-"}</p>
                        {editingSpeaker.custom_fields.travel_details.onward_leg2_time && (
                          <p className="text-orange-600 text-xs">@ {editingSpeaker.custom_fields.travel_details.onward_leg2_time}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Return Request */}
              {editingSpeaker.custom_fields.travel_details.return_required !== false && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2 text-sm">
                    <PlaneLanding className="h-4 w-4" />
                    Return Flight Request
                    {editingSpeaker.custom_fields.travel_details.return_via_city && (
                      <span className="text-orange-600 text-xs font-normal">(Connecting)</span>
                    )}
                  </h4>
                  <div className="grid grid-cols-6 gap-3 text-sm">
                    <div>
                      <span className="text-purple-600 text-xs">From</span>
                      <p className="text-purple-900 font-semibold">{editingSpeaker.custom_fields.travel_details.return_from_city || "-"}</p>
                    </div>
                    {editingSpeaker.custom_fields.travel_details.return_via_city && (
                      <div>
                        <span className="text-orange-600 text-xs">Via</span>
                        <p className="text-orange-700 font-semibold">{editingSpeaker.custom_fields.travel_details.return_via_city}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-purple-600 text-xs">To</span>
                      <p className="text-purple-900 font-semibold">{editingSpeaker.custom_fields.travel_details.return_to_city || "-"}</p>
                    </div>
                    <div>
                      <span className="text-purple-600 text-xs">Date</span>
                      <p className="text-purple-900 font-semibold">{formatDate(editingSpeaker.custom_fields.travel_details.return_date)}</p>
                    </div>
                    <div>
                      <span className="text-purple-600 text-xs">Leg 1 Flight</span>
                      <p className="text-purple-900 font-semibold font-mono">{editingSpeaker.custom_fields.travel_details.return_preferred_time || "-"}</p>
                      {editingSpeaker.custom_fields.travel_details.return_departure_time && (
                        <p className="text-purple-700 text-xs">@ {editingSpeaker.custom_fields.travel_details.return_departure_time}</p>
                      )}
                    </div>
                    {editingSpeaker.custom_fields.travel_details.return_via_city && (
                      <div>
                        <span className="text-orange-600 text-xs">Leg 2 Flight</span>
                        <p className="text-orange-700 font-semibold font-mono">{editingSpeaker.custom_fields.travel_details.return_leg2_flight || "-"}</p>
                        {editingSpeaker.custom_fields.travel_details.return_leg2_time && (
                          <p className="text-orange-600 text-xs">@ {editingSpeaker.custom_fields.travel_details.return_leg2_time}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hotel Request */}
              {editingSpeaker.custom_fields.travel_details.hotel_required && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2 text-sm">
                    <Hotel className="h-4 w-4" />
                    Hotel Request
                  </h4>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-amber-600 text-xs">Check-in</span>
                      <p className="text-amber-900 font-semibold">{formatDate(editingSpeaker.custom_fields.travel_details.hotel_check_in)}</p>
                    </div>
                    <div>
                      <span className="text-amber-600 text-xs">Check-out</span>
                      <p className="text-amber-900 font-semibold">{formatDate(editingSpeaker.custom_fields.travel_details.hotel_check_out)}</p>
                    </div>
                    <div>
                      <span className="text-amber-600 text-xs">Room Type</span>
                      <p className="text-amber-900 font-semibold capitalize">{editingSpeaker.custom_fields.travel_details.hotel_room_type || "Single"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Flight Screenshots */}
              {editingSpeaker.custom_fields.flight_preference_images && editingSpeaker.custom_fields.flight_preference_images.length > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2 text-sm">
                    <Plane className="h-4 w-4" />
                    Speaker&apos;s Flight Preferences
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {editingSpeaker.custom_fields.flight_preference_images.map((url: string, index: number) => (
                      <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Flight preference ${index + 1}`} className="w-full rounded border hover:opacity-80" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* ID Document */}
              {editingSpeaker.custom_fields.travel_id?.id_document_url && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    ID Document
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(editingSpeaker.custom_fields?.travel_id?.id_document_url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View ID Document
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Booking Form Tabs */}
          <Tabs defaultValue="onward" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="onward" className="flex items-center gap-1.5">
                <PlaneTakeoff className="h-4 w-4" />
                Onward
              </TabsTrigger>
              <TabsTrigger value="return" className="flex items-center gap-1.5">
                <PlaneLanding className="h-4 w-4" />
                Return
              </TabsTrigger>
              <TabsTrigger value="hotel" className="flex items-center gap-1.5">
                <Hotel className="h-4 w-4" />
                Hotel
              </TabsTrigger>
              <TabsTrigger value="transport" className="flex items-center gap-1.5">
                <Car className="h-4 w-4" />
                Transport
              </TabsTrigger>
            </TabsList>

            {/* Onward Flight Tab */}
            <TabsContent value="onward" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-blue-600">Onward Journey Booking</h3>
                <Select
                  value={bookingForm.onward_status}
                  onValueChange={(v: any) => setBookingForm({ ...bookingForm, onward_status: v })}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Airline</Label>
                  <Input
                    value={bookingForm.onward_airline}
                    onChange={(e) => setBookingForm({ ...bookingForm, onward_airline: e.target.value })}
                    placeholder="IndiGo, Air India..."
                  />
                </div>
                <div>
                  <Label>Flight Number</Label>
                  <Input
                    value={bookingForm.onward_flight_number}
                    onChange={(e) => setBookingForm({ ...bookingForm, onward_flight_number: e.target.value.toUpperCase() })}
                    placeholder="6E 1234"
                  />
                </div>
                <div>
                  <Label>PNR</Label>
                  <Input
                    value={bookingForm.onward_pnr}
                    onChange={(e) => setBookingForm({ ...bookingForm, onward_pnr: e.target.value.toUpperCase() })}
                    placeholder="ABC123"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
                  <Label className="text-blue-700 font-medium">Departure</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">City</Label>
                      <Input
                        value={bookingForm.onward_from_city}
                        onChange={(e) => setBookingForm({ ...bookingForm, onward_from_city: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="date"
                        value={bookingForm.onward_departure_date}
                        onChange={(e) => setBookingForm({ ...bookingForm, onward_departure_date: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Time</Label>
                      <Input
                        type="text" maxLength={5} placeholder="HH:MM"
                        value={bookingForm.onward_departure_time}
                        onChange={(e) => setBookingForm({ ...bookingForm, onward_departure_time: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3 p-3 bg-green-50 rounded-lg">
                  <Label className="text-green-700 font-medium">Arrival</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">City</Label>
                      <Input
                        value={bookingForm.onward_to_city}
                        onChange={(e) => setBookingForm({ ...bookingForm, onward_to_city: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="date"
                        value={bookingForm.onward_arrival_date}
                        onChange={(e) => setBookingForm({ ...bookingForm, onward_arrival_date: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Time</Label>
                      <Input
                        type="text" maxLength={5} placeholder="HH:MM"
                        value={bookingForm.onward_arrival_time}
                        onChange={(e) => setBookingForm({ ...bookingForm, onward_arrival_time: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Seat Number</Label>
                  <Input
                    value={bookingForm.onward_seat}
                    onChange={(e) => setBookingForm({ ...bookingForm, onward_seat: e.target.value.toUpperCase() })}
                    placeholder="12A"
                  />
                </div>
                <div>
                  <Label>E-Ticket</Label>
                  {bookingForm.onward_eticket ? (
                    <div className="flex items-center gap-2">
                      <a href={bookingForm.onward_eticket} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-blue-600 hover:underline truncate">
                        View Ticket
                      </a>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setBookingForm({ ...bookingForm, onward_eticket: "" })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 h-10 px-4 border border-dashed rounded-md cursor-pointer hover:bg-muted/50">
                      {uploadingOnward ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /><span className="text-sm">Upload Ticket</span></>}
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleTicketUpload(file, "onward") }} disabled={uploadingOnward} />
                    </label>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Return Flight Tab */}
            <TabsContent value="return" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-purple-600">Return Journey Booking</h3>
                <Select
                  value={bookingForm.return_status}
                  onValueChange={(v: any) => setBookingForm({ ...bookingForm, return_status: v })}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="not_required">Not Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bookingForm.return_status !== "not_required" && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Airline</Label>
                      <Input
                        value={bookingForm.return_airline}
                        onChange={(e) => setBookingForm({ ...bookingForm, return_airline: e.target.value })}
                        placeholder="IndiGo, Air India..."
                      />
                    </div>
                    <div>
                      <Label>Flight Number</Label>
                      <Input
                        value={bookingForm.return_flight_number}
                        onChange={(e) => setBookingForm({ ...bookingForm, return_flight_number: e.target.value.toUpperCase() })}
                        placeholder="6E 5678"
                      />
                    </div>
                    <div>
                      <Label>PNR</Label>
                      <Input
                        value={bookingForm.return_pnr}
                        onChange={(e) => setBookingForm({ ...bookingForm, return_pnr: e.target.value.toUpperCase() })}
                        placeholder="XYZ789"
                        className="font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3 p-3 bg-purple-50 rounded-lg">
                      <Label className="text-purple-700 font-medium">Departure</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">City</Label>
                          <Input
                            value={bookingForm.return_from_city}
                            onChange={(e) => setBookingForm({ ...bookingForm, return_from_city: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Date</Label>
                          <Input
                            type="date"
                            value={bookingForm.return_departure_date}
                            onChange={(e) => setBookingForm({ ...bookingForm, return_departure_date: e.target.value })}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Time</Label>
                          <Input
                            type="text" maxLength={5} placeholder="HH:MM"
                            value={bookingForm.return_departure_time}
                            onChange={(e) => setBookingForm({ ...bookingForm, return_departure_time: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 p-3 bg-orange-50 rounded-lg">
                      <Label className="text-orange-700 font-medium">Arrival</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">City</Label>
                          <Input
                            value={bookingForm.return_to_city}
                            onChange={(e) => setBookingForm({ ...bookingForm, return_to_city: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Date</Label>
                          <Input
                            type="date"
                            value={bookingForm.return_arrival_date}
                            onChange={(e) => setBookingForm({ ...bookingForm, return_arrival_date: e.target.value })}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Time</Label>
                          <Input
                            type="text" maxLength={5} placeholder="HH:MM"
                            value={bookingForm.return_arrival_time}
                            onChange={(e) => setBookingForm({ ...bookingForm, return_arrival_time: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Seat Number</Label>
                      <Input
                        value={bookingForm.return_seat}
                        onChange={(e) => setBookingForm({ ...bookingForm, return_seat: e.target.value.toUpperCase() })}
                        placeholder="14B"
                      />
                    </div>
                    <div>
                      <Label>E-Ticket</Label>
                      {bookingForm.return_eticket ? (
                        <div className="flex items-center gap-2">
                          <a href={bookingForm.return_eticket} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-purple-600 hover:underline truncate">
                            View Ticket
                          </a>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setBookingForm({ ...bookingForm, return_eticket: "" })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 h-10 px-4 border border-dashed rounded-md cursor-pointer hover:bg-muted/50">
                          {uploadingReturn ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /><span className="text-sm">Upload Ticket</span></>}
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleTicketUpload(file, "return") }} disabled={uploadingReturn} />
                        </label>
                      )}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Hotel Tab */}
            <TabsContent value="hotel" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-amber-600">Hotel Booking</h3>
                <Select
                  value={bookingForm.hotel_status}
                  onValueChange={(v: any) => setBookingForm({ ...bookingForm, hotel_status: v })}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Hotel Name</Label>
                  <Input
                    value={bookingForm.hotel_name}
                    onChange={(e) => setBookingForm({ ...bookingForm, hotel_name: e.target.value })}
                    placeholder="Hotel Maurya, Patna"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Hotel Address</Label>
                  <Input
                    value={bookingForm.hotel_address}
                    onChange={(e) => setBookingForm({ ...bookingForm, hotel_address: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Hotel Phone</Label>
                  <Input
                    value={bookingForm.hotel_phone}
                    onChange={(e) => setBookingForm({ ...bookingForm, hotel_phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Confirmation Number</Label>
                  <Input
                    value={bookingForm.hotel_confirmation}
                    onChange={(e) => setBookingForm({ ...bookingForm, hotel_confirmation: e.target.value })}
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label>Check-in Date</Label>
                  <Input
                    type="date"
                    value={bookingForm.hotel_checkin}
                    onChange={(e) => setBookingForm({ ...bookingForm, hotel_checkin: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Check-out Date</Label>
                  <Input
                    type="date"
                    value={bookingForm.hotel_checkout}
                    onChange={(e) => setBookingForm({ ...bookingForm, hotel_checkout: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Transport Tab */}
            <TabsContent value="transport" className="space-y-4 mt-4">
              <h3 className="font-semibold text-green-600">Ground Transportation</h3>

              <div className="space-y-4">
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Airport Pickup Required</Label>
                    <Switch
                      checked={bookingForm.pickup_required}
                      onCheckedChange={(checked) => setBookingForm({ ...bookingForm, pickup_required: checked })}
                    />
                  </div>
                  {bookingForm.pickup_required && (
                    <Textarea
                      value={bookingForm.pickup_details}
                      onChange={(e) => setBookingForm({ ...bookingForm, pickup_details: e.target.value })}
                      placeholder="Driver name, vehicle number, contact..."
                      rows={3}
                    />
                  )}
                </div>

                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Airport Drop Required</Label>
                    <Switch
                      checked={bookingForm.drop_required}
                      onCheckedChange={(checked) => setBookingForm({ ...bookingForm, drop_required: checked })}
                    />
                  </div>
                  {bookingForm.drop_required && (
                    <Textarea
                      value={bookingForm.drop_details}
                      onChange={(e) => setBookingForm({ ...bookingForm, drop_details: e.target.value })}
                      placeholder="Driver name, vehicle number, pickup time..."
                      rows={3}
                    />
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
            <div className="flex gap-2 mr-auto">
              <Button variant="outline" size="sm" onClick={copyTravelDetails} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copy Details
              </Button>
              <Button variant="outline" size="sm" onClick={downloadPDF} className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                PDF
              </Button>
            </div>
            <Button variant="outline" onClick={() => setEditingSpeaker(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (editingSpeaker) sendItinerary.mutate(editingSpeaker)
              }}
              disabled={sendItinerary.isPending}
            >
              {sendItinerary.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send Itinerary Email
            </Button>
            <Button
              onClick={() => {
                if (editingSpeaker) updateBooking.mutate({ id: editingSpeaker.id, booking: bookingForm })
              }}
              disabled={updateBooking.isPending}
            >
              {updateBooking.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Type Selection Dialog */}
      <Dialog open={ticketDialog.open} onOpenChange={(open) => {
        if (!open) {
          setTicketDialog({ open: false, file: null })
          if (ticketFileRef.current) ticketFileRef.current.value = ""
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              What type of ticket is this?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select the ticket type. The system will automatically match journeys with the speaker&apos;s travel request.
            </p>
            <div className="space-y-3">
              {/* One-way Ticket */}
              <button
                className="w-full p-4 border-2 rounded-lg text-left hover:bg-blue-50 hover:border-blue-400 transition-all group"
                onClick={() => processTicketExtraction("oneway")}
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <PlaneTakeoff className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">One-way Ticket</div>
                    <div className="text-sm text-muted-foreground">Single journey: A → B</div>
                  </div>
                </div>
              </button>

              {/* Round-trip Ticket */}
              <button
                className="w-full p-4 border-2 rounded-lg text-left hover:bg-purple-50 hover:border-purple-400 transition-all group"
                onClick={() => processTicketExtraction("roundtrip")}
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <div className="relative">
                      <PlaneTakeoff className="h-5 w-5 text-purple-600 absolute -top-1 -left-1" />
                      <PlaneLanding className="h-5 w-5 text-purple-600 absolute -bottom-1 -right-1" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">Round-trip Ticket</div>
                    <div className="text-sm text-muted-foreground">Two journeys: A → B and B → A</div>
                  </div>
                </div>
              </button>

              {/* Multi-city Ticket */}
              <button
                className="w-full p-4 border-2 rounded-lg text-left hover:bg-orange-50 hover:border-orange-400 transition-all group"
                onClick={() => processTicketExtraction("multicity")}
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                    <MapPin className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">Multi-city Ticket</div>
                    <div className="text-sm text-muted-foreground">Multiple stops: A → B → C</div>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-muted-foreground">
              <strong>Tip:</strong> The system will automatically match the extracted journeys with {editingSpeaker?.attendee_name}&apos;s travel request and fill in all booking details.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
