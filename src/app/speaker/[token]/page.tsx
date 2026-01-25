"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Calendar,
  MapPin,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  Plane,
  Hotel,
  Clock,
  Building2,
  Mic,
  User,
  AlertCircle,
  CreditCard,
  Utensils,
  Upload,
  FileText,
  Trash2,
  ExternalLink,
  PlaneTakeoff,
  PlaneLanding,
  Car,
  Copy,
  Check,
  Printer,
  Download,
  ArrowDown,
  Circle,
  CalendarPlus,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { cn } from "@/lib/utils"
import { FlightSelector } from "@/components/flight-selector"
import { CitySelector } from "@/components/city-selector"
import { SmartFlightAssist } from "@/components/smart-flight-assist"
import { InsertChat } from "@/components/insert-chat"

type Session = {
  id: string
  session_name: string
  session_date: string
  start_time: string
  end_time: string
  hall: string | null
  specialty_track: string | null
  description: string | null
}

// Flight Preference Upload Component
function FlightPreferenceUpload({
  token,
  uploadedImages,
  setUploadedImages,
  disabled = false
}: {
  token: string
  uploadedImages: string[]
  setUploadedImages: (images: string[]) => void
  disabled?: boolean
}) {
  const [isUploading, setIsUploading] = useState(false)
  const queryClient = useQueryClient()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or WebP image")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB")
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("bucket", "event-assets")
      formData.append("folder", `speaker-docs/flight-preferences/${token}`)

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const uploadResult = await uploadResponse.json()
      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error)
      }

      const newImages = [...uploadedImages, uploadResult.url]
      setUploadedImages(newImages)

      toast.success("Screenshot uploaded! Click 'Save Travel Requirements' to save.")
    } catch (error: any) {
      toast.error(error.message || "Failed to upload")
    } finally {
      setIsUploading(false)
    }
  }

  const removeImage = (index: number) => {
    const newImages = uploadedImages.filter((_, i) => i !== index)
    setUploadedImages(newImages)
    toast.success("Screenshot removed. Click 'Save Travel Requirements' to save.")
  }

  return (
    <div className="space-y-3">
      {/* Uploaded Images */}
      {uploadedImages.length > 0 && (
        <div className="space-y-2">
          {uploadedImages.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Flight preference ${index + 1}`}
                className="w-full rounded-lg border border-white/20"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-black/50 hover:bg-black/70"
                  onClick={() => window.open(url, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                {!disabled && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeImage(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button - only show if not disabled */}
      {!disabled && (
        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-green-500/30 rounded-lg cursor-pointer bg-green-500/5 hover:bg-green-500/10 transition-colors">
          <div className="flex flex-col items-center justify-center">
            {isUploading ? (
              <Loader2 className="h-8 w-8 text-green-400 animate-spin" />
            ) : (
              <>
                <Upload className="h-8 w-8 text-green-400 mb-1" />
                <p className="text-sm text-green-400">Upload flight screenshot</p>
                <p className="text-xs text-white/50">JPG, PNG (max 5MB)</p>
              </>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUpload}
            disabled={isUploading}
          />
        </label>
      )}
    </div>
  )
}

type Registration = {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  attendee_institution: string | null
  attendee_designation: string | null
  status: string
  custom_fields: {
    topic?: string
    portal_token?: string
    invitation_sent?: string
    needs_travel?: boolean
    flight_preference_images?: string[]
    travel_details?: {
      mode?: string
      arrival_date?: string
      departure_date?: string
      from_city?: string
      flight_preference?: string
      // Onward journey
      onward_required?: boolean
      onward_from_city?: string
      onward_via_city?: string
      onward_to_city?: string
      onward_date?: string
      onward_preferred_time?: string
      onward_departure_time?: string
      // Onward Leg 2 (connecting flight)
      onward_leg2_flight?: string
      onward_leg2_time?: string
      // Return journey
      return_required?: boolean
      return_from_city?: string
      return_via_city?: string
      return_to_city?: string
      return_date?: string
      return_preferred_time?: string
      return_departure_time?: string
      // Return Leg 2 (connecting flight)
      return_leg2_flight?: string
      return_leg2_time?: string
      // Hotel
      hotel_required?: boolean
      hotel_nights?: number
      hotel_check_in?: string
      hotel_check_out?: string
      hotel_room_type?: string
      special_requirements?: string
      // Ground Transport
      pickup_required?: boolean
      drop_required?: boolean
      // Self-booked itinerary fields
      self_booked?: boolean
      onward_pnr?: string
      onward_flight_number?: string
      onward_arrival_time?: string
      onward_seat?: string
      return_pnr?: string
      return_flight_number?: string
      return_arrival_time?: string
      return_seat?: string
    }
    // Travel ID details for booking
    travel_id?: {
      id_document_url?: string
    }
    // Booking details entered by travel manager
    booking?: {
      // Onward Flight
      onward_status?: string
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
      // Return Flight
      return_status?: string
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
      // Hotel
      hotel_status?: string
      hotel_name?: string
      hotel_address?: string
      hotel_phone?: string
      hotel_confirmation?: string
      hotel_checkin?: string
      hotel_checkout?: string
      hotel_room_type?: string
      // Ground Transport
      pickup_required?: boolean
      pickup_details?: string
      drop_required?: boolean
      drop_details?: string
      // Legacy
      flight_status?: string
      flight_pnr?: string
      flight_number?: string
    }
    // Travel booked info (for speaker to view ticket/pickup details)
    travel_booked?: {
      ticket_url?: string
      flight_pnr?: string
      pickup_details?: {
        driver_name?: string
        driver_phone?: string
        vehicle_number?: string
        pickup_location?: string
      }
    }
    abstract?: string
    bio?: string
    response_date?: string
  } | null
  event: {
    id: string
    name: string
    short_name: string | null
    start_date: string
    end_date: string
    venue_name: string | null
    city: string | null
  }
  ticket_type: {
    name: string
  }
}

export default function SpeakerPortalPage() {
  const params = useParams()
  const token = params.token as string
  const queryClient = useQueryClient()

  const [needsTravel, setNeedsTravel] = useState(false)

  // Onward Journey
  const [onwardRequired, setOnwardRequired] = useState(true)
  const [onwardFromCity, setOnwardFromCity] = useState("")
  const [onwardViaCity, setOnwardViaCity] = useState("") // For connecting flights
  const [onwardToCity, setOnwardToCity] = useState("")
  const [onwardDate, setOnwardDate] = useState("")
  const [onwardPreferredTime, setOnwardPreferredTime] = useState("") // Flight number like 6E-6348

  // Return Journey
  const [returnRequired, setReturnRequired] = useState(true)
  const [returnFromCity, setReturnFromCity] = useState("")
  const [returnViaCity, setReturnViaCity] = useState("") // For connecting flights
  const [returnToCity, setReturnToCity] = useState("")
  const [returnDate, setReturnDate] = useState("")
  const [returnPreferredTime, setReturnPreferredTime] = useState("")

  // Flight times
  const [onwardDepartureTime, setOnwardDepartureTime] = useState("")
  const [returnDepartureTime, setReturnDepartureTime] = useState("")

  // Connecting flight (Leg 2) details
  const [onwardLeg2Flight, setOnwardLeg2Flight] = useState("")
  const [onwardLeg2Time, setOnwardLeg2Time] = useState("")
  const [returnLeg2Flight, setReturnLeg2Flight] = useState("")
  const [returnLeg2Time, setReturnLeg2Time] = useState("")

  // Hotel
  const [hotelRequired, setHotelRequired] = useState(false)
  const [hotelCheckIn, setHotelCheckIn] = useState("")
  const [hotelCheckOut, setHotelCheckOut] = useState("")
  const [hotelRoomType, setHotelRoomType] = useState("single")
  const [specialRequirements, setSpecialRequirements] = useState("")

  // Ground Transport (Pickup/Drop)
  const [pickupRequired, setPickupRequired] = useState(false)
  const [dropRequired, setDropRequired] = useState(false)

  // Self-booked itinerary (when speaker books their own ticket)
  const [selfBooked, setSelfBooked] = useState(false)
  // Onward itinerary
  const [onwardPnr, setOnwardPnr] = useState("")
  const [onwardFlightNumber, setOnwardFlightNumber] = useState("")
  const [onwardArrivalTime, setOnwardArrivalTime] = useState("")
  const [onwardSeat, setOnwardSeat] = useState("")
  // Return itinerary
  const [returnPnr, setReturnPnr] = useState("")
  const [returnFlightNumber, setReturnFlightNumber] = useState("")
  const [returnArrivalTime, setReturnArrivalTime] = useState("")
  const [returnSeat, setReturnSeat] = useState("")

  // ID Document for booking
  const [idDocumentUrl, setIdDocumentUrl] = useState("")
  const [isUploading, setIsUploading] = useState(false)

  // Flight preference screenshots
  const [flightPreferenceImages, setFlightPreferenceImages] = useState<string[]>([])

  // Form lock state - locked after saving
  const [isFormLocked, setIsFormLocked] = useState(false)

  // Fetch invitation details via API
  const { data, isLoading, error } = useQuery({
    queryKey: ["speaker-portal", token],
    queryFn: async () => {
      const response = await fetch(`/api/speaker/${token}`)
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to load invitation")
      }
      return result as { registration: Registration; sessions: Session[] }
    },
  })

  const registration = data?.registration
  const sessions = data?.sessions || []

  // Initialize form state when data loads
  useEffect(() => {
    if (registration?.custom_fields) {
      const cf = registration.custom_fields
      console.log("Loading travel data from DB:", cf)
      setNeedsTravel(cf.needs_travel || false)

      if (cf.travel_details) {
        // Onward Journey
        setOnwardRequired(cf.travel_details.onward_required !== false)
        setOnwardFromCity(cf.travel_details.onward_from_city || cf.travel_details.from_city || "")
        setOnwardViaCity(cf.travel_details.onward_via_city || "")
        setOnwardToCity(cf.travel_details.onward_to_city || "")
        setOnwardDate(cf.travel_details.onward_date || cf.travel_details.arrival_date || "")
        setOnwardPreferredTime(cf.travel_details.onward_preferred_time || "")

        // Return Journey
        setReturnRequired(cf.travel_details.return_required !== false)
        setReturnFromCity(cf.travel_details.return_from_city || "")
        setReturnViaCity(cf.travel_details.return_via_city || "")
        setReturnToCity(cf.travel_details.return_to_city || cf.travel_details.from_city || "")
        setReturnDate(cf.travel_details.return_date || cf.travel_details.departure_date || "")
        setReturnPreferredTime(cf.travel_details.return_preferred_time || "")

        // Flight departure times
        setOnwardDepartureTime(cf.travel_details.onward_departure_time || "")
        setReturnDepartureTime(cf.travel_details.return_departure_time || "")

        // Connecting flight leg 2 details
        setOnwardLeg2Flight(cf.travel_details.onward_leg2_flight || "")
        setOnwardLeg2Time(cf.travel_details.onward_leg2_time || "")
        setReturnLeg2Flight(cf.travel_details.return_leg2_flight || "")
        setReturnLeg2Time(cf.travel_details.return_leg2_time || "")

        // Hotel
        setHotelRequired(cf.travel_details.hotel_required || false)
        setHotelCheckIn(cf.travel_details.hotel_check_in || cf.travel_details.arrival_date || "")
        setHotelCheckOut(cf.travel_details.hotel_check_out || cf.travel_details.departure_date || "")
        setHotelRoomType(cf.travel_details.hotel_room_type || "single")
        setSpecialRequirements(cf.travel_details.special_requirements || "")

        // Ground Transport
        setPickupRequired(cf.travel_details.pickup_required || false)
        setDropRequired(cf.travel_details.drop_required || false)

        // Self-booked itinerary
        setSelfBooked(cf.travel_details.self_booked || false)
        // Onward itinerary
        setOnwardPnr(cf.travel_details.onward_pnr || "")
        setOnwardFlightNumber(cf.travel_details.onward_flight_number || "")
        setOnwardArrivalTime(cf.travel_details.onward_arrival_time || "")
        setOnwardSeat(cf.travel_details.onward_seat || "")
        // Return itinerary
        setReturnPnr(cf.travel_details.return_pnr || "")
        setReturnFlightNumber(cf.travel_details.return_flight_number || "")
        setReturnArrivalTime(cf.travel_details.return_arrival_time || "")
        setReturnSeat(cf.travel_details.return_seat || "")
      }

      // Initialize ID document URL
      if (cf.travel_id?.id_document_url) {
        setIdDocumentUrl(cf.travel_id.id_document_url)
      }

      // Initialize flight preference images
      if (cf.flight_preference_images) {
        setFlightPreferenceImages(cf.flight_preference_images)
      }

      // Lock form if:
      // 1. Travel details have been saved by speaker, OR
      // 2. Any booking status is "booked" or "confirmed" (admin has booked tickets)
      const hasSavedTravelDetails = cf.needs_travel && cf.travel_details && (
        cf.travel_details.onward_from_city ||
        cf.travel_details.onward_date ||
        cf.travel_details.from_city ||
        cf.travel_details.arrival_date ||
        cf.travel_details.return_from_city ||
        cf.travel_details.return_date ||
        cf.travel_details.departure_date
      )
      const isOnwardBooked = cf.booking?.onward_status === "booked" || cf.booking?.onward_status === "confirmed"
      const isReturnBooked = cf.booking?.return_status === "booked" || cf.booking?.return_status === "confirmed"
      const hasTicket = !!cf.travel_booked?.ticket_url

      if (hasSavedTravelDetails || isOnwardBooked || isReturnBooked || hasTicket) {
        setIsFormLocked(true)
      }
    }

  }, [registration])


  // Accept invitation
  const acceptInvitation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/speaker/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error)
      }
    },
    onSuccess: () => {
      toast.success("Thank you! Your participation is confirmed.")
      queryClient.invalidateQueries({ queryKey: ["speaker-portal", token] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Decline invitation
  const declineInvitation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/speaker/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error)
      }
    },
    onSuccess: () => {
      toast.success("We're sorry you can't make it. Thank you for letting us know.")
      queryClient.invalidateQueries({ queryKey: ["speaker-portal", token] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Auto-save needs_travel toggle (so speaker appears in travel dashboard immediately)
  const saveNeedsTravelToggle = useMutation({
    mutationFn: async (checked: boolean) => {
      const response = await fetch(`/api/speaker/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          data: {
            needs_travel: checked,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update")
      }

      return response.json()
    },
    onSuccess: (_, checked) => {
      queryClient.invalidateQueries({ queryKey: ["speaker-portal", token] })
      if (checked) {
        toast.success("Travel assistance requested - you'll appear in the travel dashboard")
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Save travel details
  const saveTravelDetails = useMutation({
    mutationFn: async () => {
      const saveData = {
        needs_travel: needsTravel,
        flight_preference_images: flightPreferenceImages.length > 0 ? flightPreferenceImages : undefined,
        travel_details: needsTravel ? {
          // Onward Journey (Leg 1)
          onward_required: onwardRequired,
          onward_from_city: onwardFromCity,
          onward_via_city: onwardViaCity || undefined,
          onward_to_city: onwardToCity,
          onward_date: onwardDate,
          onward_preferred_time: onwardPreferredTime,
          onward_departure_time: onwardDepartureTime,
          // Onward Leg 2 (if connecting)
          onward_leg2_flight: onwardLeg2Flight || undefined,
          onward_leg2_time: onwardLeg2Time || undefined,
          // Return Journey (Leg 1)
          return_required: returnRequired,
          return_from_city: returnFromCity,
          return_via_city: returnViaCity || undefined,
          return_to_city: returnToCity,
          return_date: returnDate,
          return_preferred_time: returnPreferredTime,
          return_departure_time: returnDepartureTime,
          // Return Leg 2 (if connecting)
          return_leg2_flight: returnLeg2Flight || undefined,
          return_leg2_time: returnLeg2Time || undefined,
          // Hotel
          hotel_required: hotelRequired,
          hotel_check_in: hotelCheckIn,
          hotel_check_out: hotelCheckOut,
          hotel_room_type: hotelRoomType,
          special_requirements: specialRequirements,
          // Ground Transport
          pickup_required: pickupRequired,
          drop_required: dropRequired,
          // Self-booked itinerary
          self_booked: selfBooked,
          // Onward itinerary (entered by speaker)
          onward_pnr: onwardPnr || undefined,
          onward_flight_number: onwardFlightNumber || undefined,
          onward_arrival_time: onwardArrivalTime || undefined,
          onward_seat: onwardSeat || undefined,
          // Return itinerary (entered by speaker)
          return_pnr: returnPnr || undefined,
          return_flight_number: returnFlightNumber || undefined,
          return_arrival_time: returnArrivalTime || undefined,
          return_seat: returnSeat || undefined,
          // Legacy fields
          from_city: onwardFromCity,
          arrival_date: onwardDate,
          departure_date: returnDate,
          mode: "flight",
        } : null,
        travel_id: needsTravel && onwardRequired && idDocumentUrl ? {
          id_document_url: idDocumentUrl,
        } : undefined,
      }

      console.log("Saving travel details:", saveData)

      const response = await fetch(`/api/speaker/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          data: saveData,
        }),
      })

      const result = await response.json()
      console.log("Save response:", result)

      if (!response.ok) {
        throw new Error(result.error)
      }
      return result
    },
    onSuccess: () => {
      toast.success("Travel details saved!")
      setIsFormLocked(true)
      queryClient.invalidateQueries({ queryKey: ["speaker-portal", token] })
    },
    onError: (error: Error) => {
      console.error("Save error:", error)
      toast.error(error.message)
    },
  })

  const formatDate = (dateStr: string) => {
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

  // Generate Google Calendar URL for a session
  const getGoogleCalendarUrl = (session: Session) => {
    const startDate = new Date(session.session_date)
    const [startHours, startMinutes] = (session.start_time || "09:00").split(":")
    startDate.setHours(parseInt(startHours), parseInt(startMinutes), 0)

    const endDate = new Date(session.session_date)
    const [endHours, endMinutes] = (session.end_time || "10:00").split(":")
    endDate.setHours(parseInt(endHours), parseInt(endMinutes), 0)

    // Format dates as YYYYMMDDTHHMMSS
    const formatGCalDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
    }

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: session.session_name,
      dates: `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`,
      details: session.description || `Session at ${event?.name || "Event"}`,
      location: [session.hall, event?.venue_name].filter(Boolean).join(", "),
    })

    return `https://www.google.com/calendar/render?${params.toString()}`
  }

  // Download iCal feed for all sessions
  const downloadCalendar = () => {
    if (!event) return
    const url = `/api/events/${event.id}/calendar?speaker=${encodeURIComponent(registration?.attendee_email || "")}`
    window.open(url, "_blank")
  }

  // Handle ID document upload
  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or PDF file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB")
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("bucket", "event-assets")
      formData.append("folder", `speaker-docs/id-documents/${token}`)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error)
      }

      setIdDocumentUrl(result.url)
      toast.success("ID document uploaded successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to upload file")
    } finally {
      setIsUploading(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-white/70">Loading your invitation...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !registration) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/10 backdrop-blur border-white/20">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Invalid Link</h2>
            <p className="text-white/70">
              This invitation link is invalid or has expired. Please contact the organizers for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const event = registration.event

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 print:bg-white print:min-h-0">
      <Toaster position="top-center" richColors />
      {/* AI Chatbot for speaker assistance */}
      <InsertChat
        userEmail={registration.attendee_email}
        userFirstName={registration.attendee_name?.split(" ")[0]}
        userLastName={registration.attendee_name?.split(" ").slice(1).join(" ")}
        metadata={{ event: event.name, type: "speaker" }}
      />
      {/* Header - Hide in print */}
      <div className="bg-white/5 backdrop-blur border-b border-white/10 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{event.short_name || event.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-white/70 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(event.start_date)}
                </span>
                {event.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {event.city}
                  </span>
                )}
              </div>
            </div>
            <Badge
              className={cn(
                "text-sm px-3 py-1",
                registration.status === "confirmed"
                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                  : registration.status === "declined"
                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                  : "bg-amber-500/20 text-amber-400 border-amber-500/30"
              )}
            >
              {registration.status === "confirmed" ? "Confirmed" :
               registration.status === "declined" ? "Declined" : "Pending Response"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 print:p-0 print:max-w-none">
        {/* Welcome Message - Hide in print */}
        <Card className="bg-white/10 backdrop-blur border-white/20 print:hidden">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5" />
              Welcome, {registration.attendee_name}
            </CardTitle>
            <CardDescription className="text-white/70">
              You have been invited as <strong className="text-white">{registration.attendee_designation || "Speaker"}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-white/70 text-sm">
              <span className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {registration.attendee_email}
              </span>
              {registration.attendee_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {registration.attendee_phone}
                </span>
              )}
            </div>

            {/* Response Buttons */}
            {registration.status === "pending" && (
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => acceptInvitation.mutate()}
                  disabled={acceptInvitation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {acceptInvitation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Accept Invitation
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm("Are you sure you want to decline this invitation?")) {
                      declineInvitation.mutate()
                    }
                  }}
                  disabled={declineInvitation.isPending}
                  className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                >
                  {declineInvitation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Decline
                </Button>
              </div>
            )}

            {registration.status === "confirmed" && (
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Your participation is confirmed!</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sessions - Hide in print */}
        <Card className="bg-white/10 backdrop-blur border-white/20 print:hidden">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Your Sessions ({sessions.length})
            </CardTitle>
            <CardDescription className="text-white/70 flex items-center justify-between">
              <span>Sessions you are assigned to present</span>
              {sessions.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs gap-1.5"
                  onClick={downloadCalendar}
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Subscribe to Calendar
                </Button>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-white/50 text-center py-4">No sessions assigned yet</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-medium text-white">{session.session_name}</h4>
                        <div className="flex items-center gap-4 mt-2 text-sm text-white/60">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(session.session_date).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(session.start_time)} - {formatTime(session.end_time)}
                          </span>
                          {session.hall && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5" />
                              {session.hall}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.specialty_track && (
                          <Badge variant="outline" className="text-xs text-white/70 border-white/30">
                            {session.specialty_track}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-white/60 hover:text-white hover:bg-white/10"
                          onClick={() => window.open(getGoogleCalendarUrl(session), "_blank")}
                        >
                          <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                          Add to Calendar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Complete Journey Itinerary - Show if any booking status is booked/confirmed OR has PNR/hotel */}
        {registration.custom_fields?.booking && (
          registration.custom_fields.booking.onward_status === "booked" ||
          registration.custom_fields.booking.onward_status === "confirmed" ||
          registration.custom_fields.booking.return_status === "booked" ||
          registration.custom_fields.booking.return_status === "confirmed" ||
          registration.custom_fields.booking.onward_pnr ||
          registration.custom_fields.booking.return_pnr ||
          registration.custom_fields.booking.flight_pnr ||
          registration.custom_fields.booking.hotel_name ||
          registration.custom_fields.booking.hotel_status === "booked" ||
          registration.custom_fields.booking.hotel_status === "confirmed"
        ) && (
          <Card className="bg-white/10 backdrop-blur border-white/20 print:bg-white print:text-black" id="journey-itinerary">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2 print:text-black">
                    <Calendar className="h-5 w-5 text-blue-400 print:text-blue-600" />
                    Complete Journey Itinerary
                  </CardTitle>
                  <CardDescription className="text-white/70 print:text-gray-600">
                    {registration.attendee_name} • {event.name}
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
              {/* Timeline Container */}
              <div className="relative">
                {/* Vertical Timeline Line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-green-500 via-amber-500 to-purple-500 print:bg-gray-300" />

                {/* No Onward Flight Message - Show when return is booked but onward is not */}
                {(registration.custom_fields.booking?.return_status === "booked" ||
                  registration.custom_fields.booking?.return_status === "confirmed") &&
                  registration.custom_fields.booking?.onward_status !== "booked" &&
                  registration.custom_fields.booking?.onward_status !== "confirmed" &&
                  !registration.custom_fields.booking?.onward_pnr && (
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

                {/* 1. ARRIVAL FLIGHT */}
                {(registration.custom_fields.booking?.onward_status === "booked" ||
                  registration.custom_fields.booking?.onward_status === "confirmed" ||
                  registration.custom_fields.booking?.onward_pnr ||
                  registration.custom_fields.booking?.flight_pnr) && (() => {
                  const booking = registration.custom_fields.booking || {}
                  const travel = registration.custom_fields.travel_details || {}
                  return (
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
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(booking.onward_pnr || booking.flight_pnr || "")
                                toast.success("PNR copied!")
                              }}
                              className="text-white/50 hover:text-white print:hidden"
                            >
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
                          <a
                            href={booking.onward_eticket}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 print:text-blue-600"
                          >
                            <Download className="h-4 w-4" /> Download E-Ticket
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  )
                })()}

                {/* 2. AIRPORT PICKUP */}
                {registration.custom_fields.booking?.pickup_required && (
                  <div className="relative pl-12 pb-6">
                    <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <Car className="h-3 w-3 text-white" />
                    </div>
                    <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20 print:bg-green-50 print:border-green-200">
                      <h4 className="font-semibold text-green-400 print:text-green-700 mb-2 flex items-center gap-2">
                        <Car className="h-4 w-4" /> AIRPORT PICKUP
                      </h4>
                      <p className="text-white/80 print:text-gray-700 text-sm">
                        {registration.custom_fields.booking?.pickup_details || "Pickup arranged - details will be shared"}
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. HOTEL CHECK-IN */}
                {registration.custom_fields.booking?.hotel_name && (
                  <div className="relative pl-12 pb-6">
                    <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <Hotel className="h-3 w-3 text-white" />
                    </div>
                    <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20 print:bg-amber-50 print:border-amber-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-amber-400 print:text-amber-700">
                          HOTEL CHECK-IN
                          <span className="text-xs font-normal text-white/60 print:text-gray-500 ml-2">
                            {registration.custom_fields.booking?.hotel_checkin && formatDate(registration.custom_fields.booking.hotel_checkin)}
                          </span>
                        </h4>
                        <Badge className="bg-amber-500/30 text-amber-300 print:bg-amber-100 print:text-amber-700">
                          {registration.custom_fields.booking?.hotel_status || "Confirmed"}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <Building2 className="h-4 w-4 text-amber-400 print:text-amber-600 mt-0.5" />
                          <div>
                            <p className="text-white print:text-black font-medium">{registration.custom_fields.booking.hotel_name}</p>
                            {registration.custom_fields.booking?.hotel_address && (
                              <p className="text-white/60 print:text-gray-500 text-xs">{registration.custom_fields.booking.hotel_address}</p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 pt-2">
                          {registration.custom_fields.booking?.hotel_confirmation && (
                            <div>
                              <p className="text-white/50 print:text-gray-500 text-xs">Confirmation</p>
                              <p className="text-white print:text-black font-mono">{registration.custom_fields.booking.hotel_confirmation}</p>
                            </div>
                          )}
                          {registration.custom_fields.booking?.hotel_room_type && (
                            <div>
                              <p className="text-white/50 print:text-gray-500 text-xs">Room Type</p>
                              <p className="text-white print:text-black capitalize">{registration.custom_fields.booking.hotel_room_type}</p>
                            </div>
                          )}
                          {registration.custom_fields.booking?.hotel_phone && (
                            <div>
                              <p className="text-white/50 print:text-gray-500 text-xs">Hotel Phone</p>
                              <p className="text-white print:text-black">{registration.custom_fields.booking.hotel_phone}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. EVENT SESSIONS */}
                {sessions && sessions.length > 0 && (
                  <div className="relative pl-12 pb-6">
                    <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                      <Mic className="h-3 w-3 text-white" />
                    </div>
                    <div className="p-4 bg-indigo-500/10 rounded-lg border border-indigo-500/20 print:bg-indigo-50 print:border-indigo-200">
                      <h4 className="font-semibold text-indigo-400 print:text-indigo-700 mb-3">
                        EVENT SESSIONS
                      </h4>
                      <div className="space-y-2">
                        {sessions.map((session) => (
                          <div key={session.id} className="flex items-center gap-3 text-sm">
                            <div className="w-20 text-white/60 print:text-gray-500">
                              {formatDate(session.session_date)}
                            </div>
                            <div className="w-24 font-mono text-white/80 print:text-gray-700">
                              {formatTime(session.start_time)}
                            </div>
                            <div className="flex-1 text-white print:text-black">
                              {session.session_name}
                            </div>
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

                {/* 5. HOTEL CHECK-OUT */}
                {registration.custom_fields.booking?.hotel_name && registration.custom_fields.booking?.hotel_checkout && (
                  <div className="relative pl-12 pb-6">
                    <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center">
                      <Hotel className="h-3 w-3 text-white" />
                    </div>
                    <div className="p-3 bg-amber-600/10 rounded-lg border border-amber-600/20 print:bg-amber-50 print:border-amber-200">
                      <h4 className="font-semibold text-amber-400 print:text-amber-700 text-sm flex items-center gap-2">
                        HOTEL CHECK-OUT
                        <span className="text-xs font-normal text-white/60 print:text-gray-500">
                          {formatDate(registration.custom_fields.booking.hotel_checkout)}
                        </span>
                      </h4>
                    </div>
                  </div>
                )}

                {/* 6. AIRPORT DROP */}
                {registration.custom_fields.booking?.drop_required && (
                  <div className="relative pl-12 pb-6">
                    <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                      <Car className="h-3 w-3 text-white" />
                    </div>
                    <div className="p-4 bg-green-600/10 rounded-lg border border-green-600/20 print:bg-green-50 print:border-green-200">
                      <h4 className="font-semibold text-green-400 print:text-green-700 mb-2 flex items-center gap-2">
                        <Car className="h-4 w-4" /> AIRPORT DROP
                      </h4>
                      <p className="text-white/80 print:text-gray-700 text-sm">
                        {registration.custom_fields.booking?.drop_details || "Drop arranged - details will be shared"}
                      </p>
                    </div>
                  </div>
                )}

                {/* 7. DEPARTURE FLIGHT */}
                {(registration.custom_fields.booking?.return_status === "booked" ||
                  registration.custom_fields.booking?.return_status === "confirmed" ||
                  registration.custom_fields.booking?.return_pnr) &&
                  registration.custom_fields.booking?.return_status !== "not_required" && (() => {
                  const booking = registration.custom_fields.booking || {}
                  const travel = registration.custom_fields.travel_details || {}
                  return (
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
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(booking.return_pnr || "")
                                toast.success("PNR copied!")
                              }}
                              className="text-white/50 hover:text-white print:hidden"
                            >
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
                          <a
                            href={booking.return_eticket}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1 print:text-purple-600"
                          >
                            <Download className="h-4 w-4" /> Download E-Ticket
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  )
                })()}
              </div>

              {/* Footer Note */}
              <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10 text-center print:bg-gray-50 print:border-gray-200">
                <p className="text-white/60 text-sm print:text-gray-600">
                  For any changes or assistance, contact the organizing team.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Travel & Accommodation - Only show if confirmed, hide in print */}
        {registration.status === "confirmed" && (
          <Card className="bg-white/10 backdrop-blur border-white/20 print:hidden">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Plane className="h-5 w-5" />
                Travel & Accommodation
              </CardTitle>
              <CardDescription className="text-white/70">
                Let us know your travel requirements so we can book your tickets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Locked State Banner */}
              {isFormLocked && needsTravel && (() => {
                const onwardStatus = registration?.custom_fields?.booking?.onward_status
                const returnStatus = registration?.custom_fields?.booking?.return_status
                const isOnwardBooked = onwardStatus === "booked" || onwardStatus === "confirmed"
                const isReturnBooked = returnStatus === "booked" || returnStatus === "confirmed"
                const hasTicketUrl = !!registration?.custom_fields?.travel_booked?.ticket_url
                const cannotChange = isOnwardBooked || isReturnBooked || hasTicketUrl

                return (
                  <div className={cn(
                    "flex items-center justify-between p-4 rounded-lg border",
                    cannotChange
                      ? "bg-emerald-500/20 border-emerald-500/30"
                      : "bg-green-500/20 border-green-500/30"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center",
                        cannotChange
                          ? "bg-emerald-500/20"
                          : "bg-green-500/20"
                      )}>
                        <Check className={cn(
                          "h-5 w-5",
                          cannotChange
                            ? "text-emerald-400"
                            : "text-green-400"
                        )} />
                      </div>
                      <div>
                        <p className={cn(
                          "font-medium",
                          cannotChange
                            ? "text-emerald-400"
                            : "text-green-400"
                        )}>
                          {cannotChange
                            ? "Ticket Booked"
                            : "Travel Details Saved"}
                        </p>
                        <p className="text-sm text-white/60">
                          {cannotChange
                            ? "Your ticket has been booked. Contact organizers for any changes."
                            : "Our travel team will book your tickets based on these details"}
                        </p>
                      </div>
                    </div>
                    {/* Only show Request Change if not yet booked */}
                    {!cannotChange && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFormLocked(false)}
                        className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                      >
                        Request Change
                      </Button>
                    )}
                  </div>
                )
              })()}

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <p className="font-medium text-white">Do you need travel assistance?</p>
                  <p className="text-sm text-white/60">We will book flights and hotel for you</p>
                </div>
                <Switch
                  checked={needsTravel}
                  onCheckedChange={(checked) => {
                    setNeedsTravel(checked)
                    if (checked) setSelfBooked(false)
                    // Auto-save to database so speaker appears in travel dashboard immediately
                    saveNeedsTravelToggle.mutate(checked)
                  }}
                  disabled={isFormLocked || saveNeedsTravelToggle.isPending}
                />
              </div>

              {/* Self-booked option - show when not requesting travel assistance */}
              {!needsTravel && (
                <div className="flex items-center justify-between p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                  <div>
                    <p className="font-medium text-cyan-400">Have you booked your own ticket?</p>
                    <p className="text-sm text-white/60">Enter your flight details so we can coordinate pickup/drop</p>
                  </div>
                  <Switch
                    checked={selfBooked}
                    onCheckedChange={setSelfBooked}
                    disabled={isFormLocked}
                  />
                </div>
              )}

              {/* Self-booked itinerary entry */}
              {!needsTravel && selfBooked && (
                <div className="space-y-6 pt-2">
                  {/* Onward Journey Itinerary */}
                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-blue-400 flex items-center gap-2">
                        <PlaneTakeoff className="h-5 w-5" />
                        Onward Flight Details
                      </h3>
                      <Switch
                        checked={onwardRequired}
                        onCheckedChange={setOnwardRequired}
                        disabled={isFormLocked}
                      />
                    </div>

                    {onwardRequired && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">PNR *</Label>
                            <Input
                              placeholder="e.g. ABC123"
                              value={onwardPnr}
                              onChange={(e) => setOnwardPnr(e.target.value.toUpperCase())}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase"
                              maxLength={10}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Flight Number *</Label>
                            <Input
                              placeholder="e.g. 6E-342"
                              value={onwardFlightNumber}
                              onChange={(e) => setOnwardFlightNumber(e.target.value.toUpperCase())}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-white/80 text-sm">Route</Label>
                          <Input
                            placeholder="e.g. Kolkata → Patna"
                            value={onwardFromCity}
                            onChange={(e) => setOnwardFromCity(e.target.value)}
                            disabled={isFormLocked}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Date *</Label>
                            <Input
                              type="date"
                              value={onwardDate}
                              onChange={(e) => setOnwardDate(e.target.value)}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Departure Time</Label>
                            <Input
                              type="text" maxLength={5} pattern="[0-9]{2}:[0-9]{2}"
                              value={onwardDepartureTime}
                              onChange={(e) => setOnwardDepartureTime(e.target.value)}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Arrival Time</Label>
                            <Input
                              type="text" maxLength={5} pattern="[0-9]{2}:[0-9]{2}"
                              value={onwardArrivalTime}
                              onChange={(e) => setOnwardArrivalTime(e.target.value)}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-white/80 text-sm">Seat Number (Optional)</Label>
                          <Input
                            placeholder="e.g. 12A"
                            value={onwardSeat}
                            onChange={(e) => setOnwardSeat(e.target.value.toUpperCase())}
                            disabled={isFormLocked}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase w-24"
                            maxLength={4}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Return Journey Itinerary */}
                  <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-purple-400 flex items-center gap-2">
                        <PlaneLanding className="h-5 w-5" />
                        Return Flight Details
                      </h3>
                      <Switch
                        checked={returnRequired}
                        onCheckedChange={setReturnRequired}
                        disabled={isFormLocked}
                      />
                    </div>

                    {returnRequired && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">PNR *</Label>
                            <Input
                              placeholder="e.g. XYZ789"
                              value={returnPnr}
                              onChange={(e) => setReturnPnr(e.target.value.toUpperCase())}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase"
                              maxLength={10}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Flight Number *</Label>
                            <Input
                              placeholder="e.g. 6E-343"
                              value={returnFlightNumber}
                              onChange={(e) => setReturnFlightNumber(e.target.value.toUpperCase())}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-white/80 text-sm">Route</Label>
                          <Input
                            placeholder="e.g. Patna → Kolkata"
                            value={returnFromCity}
                            onChange={(e) => setReturnFromCity(e.target.value)}
                            disabled={isFormLocked}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Date *</Label>
                            <Input
                              type="date"
                              value={returnDate}
                              onChange={(e) => setReturnDate(e.target.value)}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Departure Time</Label>
                            <Input
                              type="text" maxLength={5} pattern="[0-9]{2}:[0-9]{2}"
                              value={returnDepartureTime}
                              onChange={(e) => setReturnDepartureTime(e.target.value)}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Arrival Time</Label>
                            <Input
                              type="text" maxLength={5} pattern="[0-9]{2}:[0-9]{2}"
                              value={returnArrivalTime}
                              onChange={(e) => setReturnArrivalTime(e.target.value)}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-white/80 text-sm">Seat Number (Optional)</Label>
                          <Input
                            placeholder="e.g. 14B"
                            value={returnSeat}
                            onChange={(e) => setReturnSeat(e.target.value.toUpperCase())}
                            disabled={isFormLocked}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase w-24"
                            maxLength={4}
                          />
                        </div>
                      </div>
                    )}

                    {!returnRequired && (
                      <p className="text-sm text-purple-300/60">No return flight</p>
                    )}
                  </div>

                  {/* Ground Transport for self-booked */}
                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                    <h3 className="font-semibold text-green-400 flex items-center gap-2 mb-4">
                      <Car className="h-5 w-5" />
                      Airport Transfers
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div>
                          <p className="font-medium text-white">Airport Pickup</p>
                          <p className="text-xs text-white/50">Arrange pickup from airport to venue/hotel</p>
                        </div>
                        <Switch
                          checked={pickupRequired}
                          onCheckedChange={setPickupRequired}
                          disabled={isFormLocked}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div>
                          <p className="font-medium text-white">Airport Drop</p>
                          <p className="text-xs text-white/50">Arrange drop from venue/hotel to airport</p>
                        </div>
                        <Switch
                          checked={dropRequired}
                          onCheckedChange={setDropRequired}
                          disabled={isFormLocked}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save Button for self-booked */}
                  {!isFormLocked && (
                    <>
                      <Button
                        onClick={() => saveTravelDetails.mutate()}
                        disabled={saveTravelDetails.isPending}
                        className="w-full bg-cyan-600 hover:bg-cyan-700"
                        size="lg"
                      >
                        {saveTravelDetails.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Save Flight Details
                      </Button>
                      <p className="text-xs text-white/50 text-center">
                        We'll use these details to coordinate your airport pickup/drop.
                      </p>
                    </>
                  )}
                </div>
              )}

              {needsTravel && (
                <div className="space-y-6 pt-2">

                  {/* ONWARD JOURNEY - Flight Selector */}
                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-blue-400 flex items-center gap-2">
                        <PlaneTakeoff className="h-5 w-5" />
                        Onward Flight
                      </h3>
                      <Switch
                        checked={onwardRequired}
                        onCheckedChange={setOnwardRequired}
                        disabled={isFormLocked}
                      />
                    </div>

                    {onwardRequired && (
                      <div className="space-y-4">
                        {/* Route Selection - From / Via / To */}
                        <div className="grid grid-cols-3 gap-3">
                          <CitySelector
                            label="From City *"
                            value={onwardFromCity}
                            onChange={(city) => {
                              setOnwardFromCity(city)
                              // Auto-set return destination
                              if (!returnToCity) {
                                setReturnToCity(city)
                              }
                            }}
                            placeholder="Departure city"
                            disabled={isFormLocked}
                          />
                          <CitySelector
                            label="Via City (if connecting)"
                            value={onwardViaCity}
                            onChange={setOnwardViaCity}
                            placeholder="Optional"
                            disabled={isFormLocked}
                          />
                          <CitySelector
                            label="To City *"
                            value={onwardToCity}
                            onChange={(city) => {
                              setOnwardToCity(city)
                              // Auto-set return origin
                              if (!returnFromCity) {
                                setReturnFromCity(city)
                              }
                            }}
                            placeholder="Arrival city"
                            disabled={isFormLocked}
                          />
                        </div>

                        {/* Date, Time, Flight Number */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Travel Date *</Label>
                            <Input
                              type="date"
                              value={onwardDate}
                              onChange={(e) => {
                                setOnwardDate(e.target.value)
                                if (!hotelCheckIn) setHotelCheckIn(e.target.value)
                              }}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white disabled:opacity-60"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Departure Time (24hr)</Label>
                            <Input
                              type="text"
                              value={onwardDepartureTime}
                              onChange={(e) => {
                                // Allow only numbers and colon, format as HH:MM
                                const val = e.target.value.replace(/[^0-9:]/g, '')
                                if (val.length <= 5) setOnwardDepartureTime(val)
                              }}
                              disabled={isFormLocked}
                              placeholder="e.g. 11:05"
                              maxLength={5}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono disabled:opacity-60"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Flight # {onwardViaCity ? "(1st leg)" : ""}</Label>
                            <Input
                              value={onwardPreferredTime}
                              onChange={(e) => setOnwardPreferredTime(e.target.value.toUpperCase())}
                              disabled={isFormLocked}
                              placeholder="e.g. 6E-6966"
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase disabled:opacity-60"
                            />
                          </div>
                        </div>

                        {/* Leg 2 fields for connecting flight */}
                        {onwardViaCity && (
                          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg space-y-3">
                            <p className="text-xs text-yellow-400 font-medium">
                              ✈ Leg 2: {onwardViaCity} → {onwardToCity}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-white/80 text-sm">Departure Time (24hr)</Label>
                                <Input
                                  type="text"
                                  value={onwardLeg2Time}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9:]/g, '')
                                    if (val.length <= 5) setOnwardLeg2Time(val)
                                  }}
                                  disabled={isFormLocked}
                                  placeholder="e.g. 14:30"
                                  maxLength={5}
                                  className="bg-white/10 border-yellow-500/30 text-white placeholder:text-white/40 font-mono disabled:opacity-60"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-white/80 text-sm">Flight # (2nd leg)</Label>
                                <Input
                                  value={onwardLeg2Flight}
                                  onChange={(e) => setOnwardLeg2Flight(e.target.value.toUpperCase())}
                                  disabled={isFormLocked}
                                  placeholder="e.g. 6E-342"
                                  className="bg-white/10 border-yellow-500/30 text-white placeholder:text-white/40 font-mono uppercase disabled:opacity-60"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Smart Flight Assist */}
                        <SmartFlightAssist
                          fromCity={onwardFromCity}
                          toCity={onwardToCity}
                          date={onwardDate}
                          flightNumber={onwardPreferredTime}
                        />

                        {/* Route Summary */}
                        {onwardFromCity && onwardToCity && onwardDate && (
                          <div className="p-3 bg-blue-500/20 rounded-lg border border-blue-500/30 space-y-2">
                            {/* Leg 1 */}
                            <div>
                              <div className="flex items-center gap-2 text-white/80">
                                <PlaneTakeoff className="h-4 w-4 text-blue-400" />
                                <span className="font-medium">{onwardFromCity}</span>
                                <span className="text-white/50">→</span>
                                <span className={onwardViaCity ? "text-yellow-400" : "font-medium"}>{onwardViaCity || onwardToCity}</span>
                              </div>
                              <p className="text-sm text-white/60 mt-1 ml-6">
                                {new Date(onwardDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                                {onwardPreferredTime && (
                                  <span className="ml-2 font-mono text-blue-300">{onwardPreferredTime}</span>
                                )}
                                {onwardDepartureTime && (
                                  <span className="ml-1">at {onwardDepartureTime}</span>
                                )}
                              </p>
                            </div>
                            {/* Leg 2 (if connecting) */}
                            {onwardViaCity && (
                              <div className="border-t border-white/10 pt-2">
                                <div className="flex items-center gap-2 text-white/80">
                                  <Plane className="h-4 w-4 text-yellow-400" />
                                  <span className="text-yellow-400">{onwardViaCity}</span>
                                  <span className="text-white/50">→</span>
                                  <span className="font-medium">{onwardToCity}</span>
                                </div>
                                <p className="text-sm text-white/60 mt-1 ml-6">
                                  {onwardLeg2Flight && (
                                    <span className="font-mono text-yellow-300">{onwardLeg2Flight}</span>
                                  )}
                                  {onwardLeg2Time && (
                                    <span className="ml-1">at {onwardLeg2Time}</span>
                                  )}
                                  {!onwardLeg2Flight && !onwardLeg2Time && (
                                    <span className="text-white/40 italic">Enter 2nd leg details above</span>
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* RETURN JOURNEY */}
                  {/* RETURN JOURNEY - Flight Selector */}
                  <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-purple-400 flex items-center gap-2">
                        <PlaneLanding className="h-5 w-5" />
                        Return Flight
                      </h3>
                      <Switch
                        checked={returnRequired}
                        onCheckedChange={setReturnRequired}
                        disabled={isFormLocked}
                      />
                    </div>

                    {returnRequired && (
                      <div className="space-y-4">
                        {/* Route Selection - From / Via / To */}
                        <div className="grid grid-cols-3 gap-3">
                          <CitySelector
                            label="From City *"
                            value={returnFromCity}
                            onChange={setReturnFromCity}
                            placeholder="Departure city"
                            disabled={isFormLocked}
                          />
                          <CitySelector
                            label="Via City (if connecting)"
                            value={returnViaCity}
                            onChange={setReturnViaCity}
                            placeholder="Optional"
                            disabled={isFormLocked}
                          />
                          <CitySelector
                            label="To City *"
                            value={returnToCity}
                            onChange={setReturnToCity}
                            placeholder="Arrival city"
                            disabled={isFormLocked}
                          />
                        </div>

                        {/* Date, Time, Flight Number */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Return Date *</Label>
                            <Input
                              type="date"
                              value={returnDate}
                              onChange={(e) => {
                                setReturnDate(e.target.value)
                                if (!hotelCheckOut) setHotelCheckOut(e.target.value)
                              }}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white disabled:opacity-60"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Departure Time (24hr)</Label>
                            <Input
                              type="text" maxLength={5} pattern="[0-9]{2}:[0-9]{2}"
                              value={returnDepartureTime}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9:]/g, '')
                                if (val.length <= 5) setReturnDepartureTime(val)
                              }}
                              disabled={isFormLocked}
                              placeholder="e.g. 18:30"
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono disabled:opacity-60"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-white/80 text-sm">Flight # {returnViaCity ? "(1st leg)" : ""}</Label>
                            <Input
                              value={returnPreferredTime}
                              onChange={(e) => setReturnPreferredTime(e.target.value.toUpperCase())}
                              disabled={isFormLocked}
                              placeholder="e.g. 6E-6967"
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase disabled:opacity-60"
                            />
                          </div>
                        </div>

                        {/* Leg 2 fields for connecting flight */}
                        {returnViaCity && (
                          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg space-y-3">
                            <p className="text-xs text-yellow-400 font-medium">
                              ✈ Leg 2: {returnViaCity} → {returnToCity}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-white/80 text-sm">Departure Time (24hr)</Label>
                                <Input
                                  type="text"
                                  value={returnLeg2Time}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9:]/g, '')
                                    if (val.length <= 5) setReturnLeg2Time(val)
                                  }}
                                  disabled={isFormLocked}
                                  placeholder="e.g. 16:30"
                                  maxLength={5}
                                  className="bg-white/10 border-yellow-500/30 text-white placeholder:text-white/40 font-mono disabled:opacity-60"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-white/80 text-sm">Flight # (2nd leg)</Label>
                                <Input
                                  value={returnLeg2Flight}
                                  onChange={(e) => setReturnLeg2Flight(e.target.value.toUpperCase())}
                                  disabled={isFormLocked}
                                  placeholder="e.g. 6E-343"
                                  className="bg-white/10 border-yellow-500/30 text-white placeholder:text-white/40 font-mono uppercase disabled:opacity-60"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Smart Flight Assist */}
                        <SmartFlightAssist
                          fromCity={returnFromCity}
                          toCity={returnToCity}
                          date={returnDate}
                          flightNumber={returnPreferredTime}
                        />

                        {/* Route Summary */}
                        {returnFromCity && returnToCity && returnDate && (
                          <div className="p-3 bg-purple-500/20 rounded-lg border border-purple-500/30 space-y-2">
                            {/* Leg 1 */}
                            <div>
                              <div className="flex items-center gap-2 text-white/80">
                                <PlaneLanding className="h-4 w-4 text-purple-400" />
                                <span className="font-medium">{returnFromCity}</span>
                                <span className="text-white/50">→</span>
                                <span className={returnViaCity ? "text-yellow-400" : "font-medium"}>{returnViaCity || returnToCity}</span>
                              </div>
                              <p className="text-sm text-white/60 mt-1 ml-6">
                                {new Date(returnDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                                {returnPreferredTime && (
                                  <span className="ml-2 font-mono text-purple-300">{returnPreferredTime}</span>
                                )}
                                {returnDepartureTime && (
                                  <span className="ml-1">at {returnDepartureTime}</span>
                                )}
                              </p>
                            </div>
                            {/* Leg 2 (if connecting) */}
                            {returnViaCity && (
                              <div className="border-t border-white/10 pt-2">
                                <div className="flex items-center gap-2 text-white/80">
                                  <Plane className="h-4 w-4 text-yellow-400" />
                                  <span className="text-yellow-400">{returnViaCity}</span>
                                  <span className="text-white/50">→</span>
                                  <span className="font-medium">{returnToCity}</span>
                                </div>
                                <p className="text-sm text-white/60 mt-1 ml-6">
                                  {returnLeg2Flight && (
                                    <span className="font-mono text-yellow-300">{returnLeg2Flight}</span>
                                  )}
                                  {returnLeg2Time && (
                                    <span className="ml-1">at {returnLeg2Time}</span>
                                  )}
                                  {!returnLeg2Flight && !returnLeg2Time && (
                                    <span className="text-white/40 italic">Enter 2nd leg details above</span>
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {!returnRequired && (
                      <p className="text-sm text-purple-300/60">Return flight not needed</p>
                    )}
                  </div>

                  {/* HOTEL ACCOMMODATION */}
                  <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-amber-400 flex items-center gap-2">
                        <Hotel className="h-5 w-5" />
                        Hotel Accommodation
                      </h3>
                      <Switch
                        checked={hotelRequired}
                        onCheckedChange={setHotelRequired}
                        disabled={isFormLocked}
                      />
                    </div>

                    {hotelRequired && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-white/80">Check-in Date *</Label>
                            <Input
                              type="date"
                              value={hotelCheckIn}
                              onChange={(e) => setHotelCheckIn(e.target.value)}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white disabled:opacity-60"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/80">Check-out Date *</Label>
                            <Input
                              type="date"
                              value={hotelCheckOut}
                              onChange={(e) => setHotelCheckOut(e.target.value)}
                              disabled={isFormLocked}
                              className="bg-white/10 border-white/20 text-white disabled:opacity-60"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-white/80">Room Type</Label>
                          <Select value={hotelRoomType} onValueChange={setHotelRoomType} disabled={isFormLocked}>
                            <SelectTrigger className="bg-white/10 border-white/20 text-white disabled:opacity-60">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">Single Room</SelectItem>
                              <SelectItem value="double">Double Room</SelectItem>
                              <SelectItem value="twin">Twin Room</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {!hotelRequired && (
                      <p className="text-sm text-amber-300/60">Hotel not needed (local resident or self-arranged)</p>
                    )}
                  </div>

                  {/* GROUND TRANSPORT - Pickup/Drop */}
                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                    <h3 className="font-semibold text-green-400 flex items-center gap-2 mb-4">
                      <Car className="h-5 w-5" />
                      Airport Transfers
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div>
                          <p className="font-medium text-white">Airport Pickup</p>
                          <p className="text-xs text-white/50">Arrange pickup from airport to venue/hotel</p>
                        </div>
                        <Switch
                          checked={pickupRequired}
                          onCheckedChange={setPickupRequired}
                          disabled={isFormLocked}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div>
                          <p className="font-medium text-white">Airport Drop</p>
                          <p className="text-xs text-white/50">Arrange drop from venue/hotel to airport</p>
                        </div>
                        <Switch
                          checked={dropRequired}
                          onCheckedChange={setDropRequired}
                          disabled={isFormLocked}
                        />
                      </div>
                    </div>
                  </div>

                  {/* FLIGHT PREFERENCE - Upload Screenshot */}
                  {onwardRequired && (
                    <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                      <h3 className="font-semibold text-green-400 flex items-center gap-2 mb-3">
                        <Plane className="h-5 w-5" />
                        Preferred Flights (Optional)
                      </h3>
                      <p className="text-sm text-white/60 mb-3">
                        Search flights on Google/MakeMyTrip and upload a screenshot of your preferred options.
                        Our travel team will try to book the same flights.
                      </p>
                      <FlightPreferenceUpload
                        token={token}
                        uploadedImages={flightPreferenceImages}
                        setUploadedImages={setFlightPreferenceImages}
                        disabled={isFormLocked}
                      />
                    </div>
                  )}

                  {/* SPECIAL REQUIREMENTS */}
                  <div className="space-y-2">
                    <Label className="text-white/80">Special Requirements (Optional)</Label>
                    <Textarea
                      placeholder="Any dietary restrictions, accessibility needs, wheelchair assistance, etc."
                      value={specialRequirements}
                      onChange={(e) => setSpecialRequirements(e.target.value)}
                      disabled={isFormLocked}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 disabled:opacity-60"
                      rows={2}
                    />
                  </div>

                  {/* ID DOCUMENT UPLOAD - Only if onward flight required */}
                  {onwardRequired && (
                    <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center gap-2 text-white mb-3">
                        <CreditCard className="h-5 w-5" />
                        <div>
                          <p className="font-semibold">ID Document</p>
                          <p className="text-sm text-white/60">Upload your ID/Aadhar for ticket booking</p>
                        </div>
                      </div>

                      {idDocumentUrl ? (
                        <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                          <FileText className="h-5 w-5 text-green-400" />
                          <span className="flex-1 text-sm text-green-400 truncate">Document uploaded</span>
                          {!isFormLocked && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              onClick={() => setIdDocumentUrl("")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(idDocumentUrl, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <label className={cn(
                          "flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-white/20 rounded-lg bg-white/5 transition-colors",
                          isFormLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-white/10"
                        )}>
                          <div className="flex flex-col items-center justify-center">
                            {isUploading ? (
                              <Loader2 className="h-6 w-6 text-white/50 animate-spin" />
                            ) : (
                              <>
                                <Upload className="h-6 w-6 text-white/50 mb-1" />
                                <p className="text-xs text-white/60">Upload JPG, PNG or PDF (max 5MB)</p>
                              </>
                            )}
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/jpeg,image/png,application/pdf"
                            onChange={handleIdUpload}
                            disabled={isUploading || isFormLocked}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {/* Save Button - only show when form is not locked */}
                  {!isFormLocked && (
                    <>
                      <Button
                        onClick={() => saveTravelDetails.mutate()}
                        disabled={saveTravelDetails.isPending}
                        className="w-full bg-green-600 hover:bg-green-700"
                        size="lg"
                      >
                        {saveTravelDetails.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Save Travel Requirements
                      </Button>

                      <p className="text-xs text-white/50 text-center">
                        Our travel team will book your tickets based on these details and send you the itinerary.
                      </p>
                    </>
                  )}

                  {/* TICKET DOWNLOAD - Show when ticket is uploaded by travel team */}
                  {registration?.custom_fields?.travel_booked?.ticket_url && (
                    <div className="p-4 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Plane className="h-5 w-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="font-medium text-emerald-400">Your Ticket is Ready!</p>
                            <p className="text-sm text-white/60">
                              {registration.custom_fields.travel_booked.flight_pnr && (
                                <>PNR: <span className="font-mono text-emerald-300">{registration.custom_fields.travel_booked.flight_pnr}</span></>
                              )}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => window.open(registration.custom_fields?.travel_booked?.ticket_url, "_blank")}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Download Ticket
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* PICKUP DETAILS - Show when assigned by admin */}
                  {registration?.custom_fields?.travel_booked?.pickup_details && (
                    <div className="p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
                      <h3 className="font-semibold text-blue-400 flex items-center gap-2 mb-3">
                        <Car className="h-5 w-5" />
                        Pickup Details
                      </h3>
                      <div className="space-y-2 text-sm">
                        {registration.custom_fields.travel_booked.pickup_details.driver_name && (
                          <p className="text-white/80">
                            <span className="text-white/50">Driver:</span> {registration.custom_fields.travel_booked.pickup_details.driver_name}
                          </p>
                        )}
                        {registration.custom_fields.travel_booked.pickup_details.driver_phone && (
                          <p className="text-white/80">
                            <span className="text-white/50">Phone:</span>{" "}
                            <a href={`tel:${registration.custom_fields.travel_booked.pickup_details.driver_phone}`} className="text-blue-400">
                              {registration.custom_fields.travel_booked.pickup_details.driver_phone}
                            </a>
                          </p>
                        )}
                        {registration.custom_fields.travel_booked.pickup_details.vehicle_number && (
                          <p className="text-white/80">
                            <span className="text-white/50">Vehicle:</span> {registration.custom_fields.travel_booked.pickup_details.vehicle_number}
                          </p>
                        )}
                        {registration.custom_fields.travel_booked.pickup_details.pickup_location && (
                          <p className="text-white/80">
                            <span className="text-white/50">Pickup:</span> {registration.custom_fields.travel_booked.pickup_details.pickup_location}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer - Hide in print */}
        <div className="text-center text-white/50 text-sm py-4 print:hidden">
          <p>Need help? Contact the organizing team</p>
          <p className="mt-1">Powered by AMASI Event Management</p>
        </div>
      </div>
    </div>
  )
}
