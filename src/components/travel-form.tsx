"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle,
  Loader2,
  Plane,
  Hotel,
  PlaneTakeoff,
  PlaneLanding,
  Car,
  CreditCard,
  Upload,
  FileText,
  Trash2,
  ExternalLink,
  Check,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { CitySelector } from "@/components/city-selector"
import { SmartFlightAssist } from "@/components/smart-flight-assist"
import { FlightPreferenceUpload } from "@/components/flight-preference-upload"

type TravelDetails = {
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
  hotel_check_in?: string
  hotel_check_out?: string
  hotel_room_type?: string
  special_requirements?: string
  pickup_required?: boolean
  drop_required?: boolean
  self_booked?: boolean
  onward_pnr?: string
  onward_flight_number?: string
  onward_arrival_time?: string
  onward_seat?: string
  return_pnr?: string
  return_flight_number?: string
  return_arrival_time?: string
  return_seat?: string
  from_city?: string
  arrival_date?: string
  departure_date?: string
  mode?: string
}

type CustomFields = {
  needs_travel?: boolean
  travel_details?: TravelDetails
  travel_id?: { id_document_url?: string }
  flight_preference_images?: string[]
  booking?: {
    onward_status?: string
    return_status?: string
    [key: string]: any
  }
  travel_booked?: {
    ticket_url?: string
    [key: string]: any
  }
  [key: string]: any
}

interface TravelFormProps {
  token: string
  apiEndpoint: string // e.g. "/api/respond" or "/api/speaker"
  customFields: CustomFields | null
  queryKey: string[]
  onSaveSuccess?: () => void
}

export function TravelForm({
  token,
  apiEndpoint,
  customFields,
  queryKey,
  onSaveSuccess,
}: TravelFormProps) {
  const queryClient = useQueryClient()

  const [needsTravel, setNeedsTravel] = useState(false)

  // Onward Journey
  const [onwardRequired, setOnwardRequired] = useState(true)
  const [onwardFromCity, setOnwardFromCity] = useState("")
  const [onwardViaCity, setOnwardViaCity] = useState("")
  const [onwardToCity, setOnwardToCity] = useState("")
  const [onwardDate, setOnwardDate] = useState("")
  const [onwardPreferredTime, setOnwardPreferredTime] = useState("")

  // Return Journey
  const [returnRequired, setReturnRequired] = useState(true)
  const [returnFromCity, setReturnFromCity] = useState("")
  const [returnViaCity, setReturnViaCity] = useState("")
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

  // Ground Transport
  const [pickupRequired, setPickupRequired] = useState(false)
  const [dropRequired, setDropRequired] = useState(false)

  // Self-booked
  const [selfBooked, setSelfBooked] = useState(false)
  const [onwardPnr, setOnwardPnr] = useState("")
  const [onwardFlightNumber, setOnwardFlightNumber] = useState("")
  const [onwardArrivalTime, setOnwardArrivalTime] = useState("")
  const [onwardSeat, setOnwardSeat] = useState("")
  const [returnPnr, setReturnPnr] = useState("")
  const [returnFlightNumber, setReturnFlightNumber] = useState("")
  const [returnArrivalTime, setReturnArrivalTime] = useState("")
  const [returnSeat, setReturnSeat] = useState("")

  // ID Document
  const [idDocumentUrl, setIdDocumentUrl] = useState("")
  const [isUploading, setIsUploading] = useState(false)

  // Flight preference screenshots
  const [flightPreferenceImages, setFlightPreferenceImages] = useState<string[]>([])

  // Form lock state
  const [isFormLocked, setIsFormLocked] = useState(false)

  // Initialize form from custom_fields
  useEffect(() => {
    if (!customFields) return
    const cf = customFields
    setNeedsTravel(cf.needs_travel || false)

    if (cf.travel_details) {
      setOnwardRequired(cf.travel_details.onward_required !== false)
      setOnwardFromCity(cf.travel_details.onward_from_city || cf.travel_details.from_city || "")
      setOnwardViaCity(cf.travel_details.onward_via_city || "")
      setOnwardToCity(cf.travel_details.onward_to_city || "")
      setOnwardDate(cf.travel_details.onward_date || cf.travel_details.arrival_date || "")
      setOnwardPreferredTime(cf.travel_details.onward_preferred_time || "")

      setReturnRequired(cf.travel_details.return_required !== false)
      setReturnFromCity(cf.travel_details.return_from_city || "")
      setReturnViaCity(cf.travel_details.return_via_city || "")
      setReturnToCity(cf.travel_details.return_to_city || cf.travel_details.from_city || "")
      setReturnDate(cf.travel_details.return_date || cf.travel_details.departure_date || "")
      setReturnPreferredTime(cf.travel_details.return_preferred_time || "")

      setOnwardDepartureTime(cf.travel_details.onward_departure_time || "")
      setReturnDepartureTime(cf.travel_details.return_departure_time || "")

      setOnwardLeg2Flight(cf.travel_details.onward_leg2_flight || "")
      setOnwardLeg2Time(cf.travel_details.onward_leg2_time || "")
      setReturnLeg2Flight(cf.travel_details.return_leg2_flight || "")
      setReturnLeg2Time(cf.travel_details.return_leg2_time || "")

      setHotelRequired(cf.travel_details.hotel_required || false)
      setHotelCheckIn(cf.travel_details.hotel_check_in || cf.travel_details.arrival_date || "")
      setHotelCheckOut(cf.travel_details.hotel_check_out || cf.travel_details.departure_date || "")
      setHotelRoomType(cf.travel_details.hotel_room_type || "single")
      setSpecialRequirements(cf.travel_details.special_requirements || "")

      setPickupRequired(cf.travel_details.pickup_required || false)
      setDropRequired(cf.travel_details.drop_required || false)

      setSelfBooked(cf.travel_details.self_booked || false)
      setOnwardPnr(cf.travel_details.onward_pnr || "")
      setOnwardFlightNumber(cf.travel_details.onward_flight_number || "")
      setOnwardArrivalTime(cf.travel_details.onward_arrival_time || "")
      setOnwardSeat(cf.travel_details.onward_seat || "")
      setReturnPnr(cf.travel_details.return_pnr || "")
      setReturnFlightNumber(cf.travel_details.return_flight_number || "")
      setReturnArrivalTime(cf.travel_details.return_arrival_time || "")
      setReturnSeat(cf.travel_details.return_seat || "")
    }

    if (cf.travel_id?.id_document_url) {
      setIdDocumentUrl(cf.travel_id.id_document_url)
    }

    if (cf.flight_preference_images) {
      setFlightPreferenceImages(cf.flight_preference_images)
    }

    // Lock form if travel details saved or tickets booked
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
  }, [customFields])

  // Determine if the API uses the speaker-style action format or the respond-style direct format
  const isRespondApi = apiEndpoint.includes("/respond/")

  // Auto-save needs_travel toggle
  const saveNeedsTravelToggle = useMutation({
    mutationFn: async (checked: boolean) => {
      const body = isRespondApi
        ? { needs_travel: checked }
        : { action: "update", data: { needs_travel: checked } }

      const response = await fetch(`${apiEndpoint}/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update")
      }
      return response.json()
    },
    onSuccess: (_, checked) => {
      queryClient.invalidateQueries({ queryKey })
      if (checked) {
        toast.success("Travel assistance requested")
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
          onward_required: onwardRequired,
          onward_from_city: onwardFromCity,
          onward_via_city: onwardViaCity || undefined,
          onward_to_city: onwardToCity,
          onward_date: onwardDate,
          onward_preferred_time: onwardPreferredTime,
          onward_departure_time: onwardDepartureTime,
          onward_leg2_flight: onwardLeg2Flight || undefined,
          onward_leg2_time: onwardLeg2Time || undefined,
          return_required: returnRequired,
          return_from_city: returnFromCity,
          return_via_city: returnViaCity || undefined,
          return_to_city: returnToCity,
          return_date: returnDate,
          return_preferred_time: returnPreferredTime,
          return_departure_time: returnDepartureTime,
          return_leg2_flight: returnLeg2Flight || undefined,
          return_leg2_time: returnLeg2Time || undefined,
          hotel_required: hotelRequired,
          hotel_check_in: hotelCheckIn,
          hotel_check_out: hotelCheckOut,
          hotel_room_type: hotelRoomType,
          special_requirements: specialRequirements,
          pickup_required: pickupRequired,
          drop_required: dropRequired,
          self_booked: selfBooked,
          onward_pnr: onwardPnr || undefined,
          onward_flight_number: onwardFlightNumber || undefined,
          onward_arrival_time: onwardArrivalTime || undefined,
          onward_seat: onwardSeat || undefined,
          return_pnr: returnPnr || undefined,
          return_flight_number: returnFlightNumber || undefined,
          return_arrival_time: returnArrivalTime || undefined,
          return_seat: returnSeat || undefined,
          from_city: onwardFromCity,
          arrival_date: onwardDate,
          departure_date: returnDate,
          mode: "flight",
        } : null,
        travel_id: needsTravel && onwardRequired && idDocumentUrl ? {
          id_document_url: idDocumentUrl,
        } : undefined,
      }

      const body = isRespondApi
        ? saveData
        : { action: "update", data: saveData }

      const response = await fetch(`${apiEndpoint}/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error)
      }
      return result
    },
    onSuccess: () => {
      toast.success("Travel details saved!")
      setIsFormLocked(true)
      queryClient.invalidateQueries({ queryKey })
      onSaveSuccess?.()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Handle ID document upload
  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or PDF file")
      return
    }

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

  const onwardStatus = customFields?.booking?.onward_status
  const returnStatus = customFields?.booking?.return_status
  const isOnwardBooked = onwardStatus === "booked" || onwardStatus === "confirmed"
  const isReturnBooked = returnStatus === "booked" || returnStatus === "confirmed"
  const hasTicketUrl = !!customFields?.travel_booked?.ticket_url
  const cannotChange = isOnwardBooked || isReturnBooked || hasTicketUrl

  return (
    <div className="space-y-6">
      {/* Locked State Banner */}
      {isFormLocked && needsTravel && (
        <div className={cn(
          "flex items-center justify-between p-4 rounded-lg border",
          cannotChange
            ? "bg-emerald-500/20 border-emerald-500/30"
            : "bg-green-500/20 border-green-500/30"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center",
              cannotChange ? "bg-emerald-500/20" : "bg-green-500/20"
            )}>
              <Check className={cn(
                "h-5 w-5",
                cannotChange ? "text-emerald-400" : "text-green-400"
              )} />
            </div>
            <div>
              <p className={cn(
                "font-medium",
                cannotChange ? "text-emerald-400" : "text-green-400"
              )}>
                {cannotChange ? "Ticket Booked" : "Travel Details Saved"}
              </p>
              <p className="text-sm text-white/60">
                {cannotChange
                  ? "Your ticket has been booked. Contact organizers for any changes."
                  : "Our travel team will book your tickets based on these details"}
              </p>
            </div>
          </div>
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
      )}

      {/* Needs Travel Toggle */}
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
            saveNeedsTravelToggle.mutate(checked)
          }}
          disabled={isFormLocked || saveNeedsTravelToggle.isPending}
        />
      </div>

      {/* Self-booked option */}
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
          {/* Onward Flight Details */}
          <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-blue-400 flex items-center gap-2">
                <PlaneTakeoff className="h-5 w-5" />
                Onward Flight Details
              </h3>
              <Switch checked={onwardRequired} onCheckedChange={setOnwardRequired} disabled={isFormLocked} />
            </div>
            {onwardRequired && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">PNR *</Label>
                    <Input placeholder="e.g. ABC123" value={onwardPnr} onChange={(e) => setOnwardPnr(e.target.value.toUpperCase())} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase" maxLength={10} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Flight Number *</Label>
                    <Input placeholder="e.g. 6E-342" value={onwardFlightNumber} onChange={(e) => setOnwardFlightNumber(e.target.value.toUpperCase())} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-white/80 text-sm">Route</Label>
                  <Input placeholder="e.g. Kolkata → Patna" value={onwardFromCity} onChange={(e) => setOnwardFromCity(e.target.value)} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Date *</Label>
                    <Input type="date" value={onwardDate} onChange={(e) => setOnwardDate(e.target.value)} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Departure Time</Label>
                    <Input type="text" maxLength={5} pattern="[0-9]{2}:[0-9]{2}" value={onwardDepartureTime} onChange={(e) => setOnwardDepartureTime(e.target.value)} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Arrival Time</Label>
                    <Input type="text" maxLength={5} pattern="[0-9]{2}:[0-9]{2}" value={onwardArrivalTime} onChange={(e) => setOnwardArrivalTime(e.target.value)} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-white/80 text-sm">Seat Number (Optional)</Label>
                  <Input placeholder="e.g. 12A" value={onwardSeat} onChange={(e) => setOnwardSeat(e.target.value.toUpperCase())} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase w-24" maxLength={4} />
                </div>
              </div>
            )}
          </div>

          {/* Return Flight Details */}
          <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-purple-400 flex items-center gap-2">
                <PlaneLanding className="h-5 w-5" />
                Return Flight Details
              </h3>
              <Switch checked={returnRequired} onCheckedChange={setReturnRequired} disabled={isFormLocked} />
            </div>
            {returnRequired && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">PNR *</Label>
                    <Input placeholder="e.g. XYZ789" value={returnPnr} onChange={(e) => setReturnPnr(e.target.value.toUpperCase())} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase" maxLength={10} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Flight Number *</Label>
                    <Input placeholder="e.g. 6E-343" value={returnFlightNumber} onChange={(e) => setReturnFlightNumber(e.target.value.toUpperCase())} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-white/80 text-sm">Route</Label>
                  <Input placeholder="e.g. Patna → Kolkata" value={returnFromCity} onChange={(e) => setReturnFromCity(e.target.value)} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Date *</Label>
                    <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Departure Time</Label>
                    <Input type="text" maxLength={5} pattern="[0-9]{2}:[0-9]{2}" value={returnDepartureTime} onChange={(e) => setReturnDepartureTime(e.target.value)} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Arrival Time</Label>
                    <Input type="text" maxLength={5} pattern="[0-9]{2}:[0-9]{2}" value={returnArrivalTime} onChange={(e) => setReturnArrivalTime(e.target.value)} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-white/80 text-sm">Seat Number (Optional)</Label>
                  <Input placeholder="e.g. 14B" value={returnSeat} onChange={(e) => setReturnSeat(e.target.value.toUpperCase())} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase w-24" maxLength={4} />
                </div>
              </div>
            )}
            {!returnRequired && <p className="text-sm text-purple-300/60">No return flight</p>}
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
                <Switch checked={pickupRequired} onCheckedChange={setPickupRequired} disabled={isFormLocked} />
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="font-medium text-white">Airport Drop</p>
                  <p className="text-xs text-white/50">Arrange drop from venue/hotel to airport</p>
                </div>
                <Switch checked={dropRequired} onCheckedChange={setDropRequired} disabled={isFormLocked} />
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

      {/* Travel assistance form */}
      {needsTravel && (
        <div className="space-y-6 pt-2">
          {/* ONWARD JOURNEY */}
          <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-blue-400 flex items-center gap-2">
                <PlaneTakeoff className="h-5 w-5" />
                Onward Flight
              </h3>
              <Switch checked={onwardRequired} onCheckedChange={setOnwardRequired} disabled={isFormLocked} />
            </div>

            {onwardRequired && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <CitySelector label="From City *" value={onwardFromCity} onChange={(city) => { setOnwardFromCity(city); if (!returnToCity) setReturnToCity(city); }} placeholder="Departure city" disabled={isFormLocked} />
                  <CitySelector label="Via City (if connecting)" value={onwardViaCity} onChange={setOnwardViaCity} placeholder="Optional" disabled={isFormLocked} />
                  <CitySelector label="To City *" value={onwardToCity} onChange={(city) => { setOnwardToCity(city); if (!returnFromCity) setReturnFromCity(city); }} placeholder="Arrival city" disabled={isFormLocked} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Travel Date *</Label>
                    <Input type="date" value={onwardDate} onChange={(e) => { setOnwardDate(e.target.value); if (!hotelCheckIn) setHotelCheckIn(e.target.value); }} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white disabled:opacity-60" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Departure Time (24hr)</Label>
                    <Input type="text" value={onwardDepartureTime} onChange={(e) => { const val = e.target.value.replace(/[^0-9:]/g, ''); if (val.length <= 5) setOnwardDepartureTime(val); }} disabled={isFormLocked} placeholder="e.g. 11:05" maxLength={5} className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono disabled:opacity-60" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Flight # {onwardViaCity ? "(1st leg)" : ""}</Label>
                    <Input value={onwardPreferredTime} onChange={(e) => setOnwardPreferredTime(e.target.value.toUpperCase())} disabled={isFormLocked} placeholder="e.g. 6E-6966" className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase disabled:opacity-60" />
                  </div>
                </div>

                {/* Leg 2 for connecting flight */}
                {onwardViaCity && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg space-y-3">
                    <p className="text-xs text-yellow-400 font-medium">Leg 2: {onwardViaCity} → {onwardToCity}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-white/80 text-sm">Departure Time (24hr)</Label>
                        <Input type="text" value={onwardLeg2Time} onChange={(e) => { const val = e.target.value.replace(/[^0-9:]/g, ''); if (val.length <= 5) setOnwardLeg2Time(val); }} disabled={isFormLocked} placeholder="e.g. 14:30" maxLength={5} className="bg-white/10 border-yellow-500/30 text-white placeholder:text-white/40 font-mono disabled:opacity-60" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/80 text-sm">Flight # (2nd leg)</Label>
                        <Input value={onwardLeg2Flight} onChange={(e) => setOnwardLeg2Flight(e.target.value.toUpperCase())} disabled={isFormLocked} placeholder="e.g. 6E-342" className="bg-white/10 border-yellow-500/30 text-white placeholder:text-white/40 font-mono uppercase disabled:opacity-60" />
                      </div>
                    </div>
                  </div>
                )}

                <SmartFlightAssist fromCity={onwardFromCity} toCity={onwardToCity} date={onwardDate} flightNumber={onwardPreferredTime} />

                {/* Route Summary */}
                {onwardFromCity && onwardToCity && onwardDate && (
                  <div className="p-3 bg-blue-500/20 rounded-lg border border-blue-500/30 space-y-2">
                    <div>
                      <div className="flex items-center gap-2 text-white/80">
                        <PlaneTakeoff className="h-4 w-4 text-blue-400" />
                        <span className="font-medium">{onwardFromCity}</span>
                        <span className="text-white/50">→</span>
                        <span className={onwardViaCity ? "text-yellow-400" : "font-medium"}>{onwardViaCity || onwardToCity}</span>
                      </div>
                      <p className="text-sm text-white/60 mt-1 ml-6">
                        {new Date(onwardDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                        {onwardPreferredTime && <span className="ml-2 font-mono text-blue-300">{onwardPreferredTime}</span>}
                        {onwardDepartureTime && <span className="ml-1">at {onwardDepartureTime}</span>}
                      </p>
                    </div>
                    {onwardViaCity && (
                      <div className="border-t border-white/10 pt-2">
                        <div className="flex items-center gap-2 text-white/80">
                          <Plane className="h-4 w-4 text-yellow-400" />
                          <span className="text-yellow-400">{onwardViaCity}</span>
                          <span className="text-white/50">→</span>
                          <span className="font-medium">{onwardToCity}</span>
                        </div>
                        <p className="text-sm text-white/60 mt-1 ml-6">
                          {onwardLeg2Flight && <span className="font-mono text-yellow-300">{onwardLeg2Flight}</span>}
                          {onwardLeg2Time && <span className="ml-1">at {onwardLeg2Time}</span>}
                          {!onwardLeg2Flight && !onwardLeg2Time && <span className="text-white/40 italic">Enter 2nd leg details above</span>}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RETURN JOURNEY */}
          <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-purple-400 flex items-center gap-2">
                <PlaneLanding className="h-5 w-5" />
                Return Flight
              </h3>
              <Switch checked={returnRequired} onCheckedChange={setReturnRequired} disabled={isFormLocked} />
            </div>

            {returnRequired && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <CitySelector label="From City *" value={returnFromCity} onChange={setReturnFromCity} placeholder="Departure city" disabled={isFormLocked} />
                  <CitySelector label="Via City (if connecting)" value={returnViaCity} onChange={setReturnViaCity} placeholder="Optional" disabled={isFormLocked} />
                  <CitySelector label="To City *" value={returnToCity} onChange={setReturnToCity} placeholder="Arrival city" disabled={isFormLocked} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Return Date *</Label>
                    <Input type="date" value={returnDate} onChange={(e) => { setReturnDate(e.target.value); if (!hotelCheckOut) setHotelCheckOut(e.target.value); }} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white disabled:opacity-60" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Departure Time (24hr)</Label>
                    <Input type="text" maxLength={5} pattern="[0-9]{2}:[0-9]{2}" value={returnDepartureTime} onChange={(e) => { const val = e.target.value.replace(/[^0-9:]/g, ''); if (val.length <= 5) setReturnDepartureTime(val); }} disabled={isFormLocked} placeholder="e.g. 18:30" className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono disabled:opacity-60" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80 text-sm">Flight # {returnViaCity ? "(1st leg)" : ""}</Label>
                    <Input value={returnPreferredTime} onChange={(e) => setReturnPreferredTime(e.target.value.toUpperCase())} disabled={isFormLocked} placeholder="e.g. 6E-6967" className="bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono uppercase disabled:opacity-60" />
                  </div>
                </div>

                {/* Leg 2 for connecting flight */}
                {returnViaCity && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg space-y-3">
                    <p className="text-xs text-yellow-400 font-medium">Leg 2: {returnViaCity} → {returnToCity}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-white/80 text-sm">Departure Time (24hr)</Label>
                        <Input type="text" value={returnLeg2Time} onChange={(e) => { const val = e.target.value.replace(/[^0-9:]/g, ''); if (val.length <= 5) setReturnLeg2Time(val); }} disabled={isFormLocked} placeholder="e.g. 16:30" maxLength={5} className="bg-white/10 border-yellow-500/30 text-white placeholder:text-white/40 font-mono disabled:opacity-60" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/80 text-sm">Flight # (2nd leg)</Label>
                        <Input value={returnLeg2Flight} onChange={(e) => setReturnLeg2Flight(e.target.value.toUpperCase())} disabled={isFormLocked} placeholder="e.g. 6E-343" className="bg-white/10 border-yellow-500/30 text-white placeholder:text-white/40 font-mono uppercase disabled:opacity-60" />
                      </div>
                    </div>
                  </div>
                )}

                <SmartFlightAssist fromCity={returnFromCity} toCity={returnToCity} date={returnDate} flightNumber={returnPreferredTime} />

                {/* Route Summary */}
                {returnFromCity && returnToCity && returnDate && (
                  <div className="p-3 bg-purple-500/20 rounded-lg border border-purple-500/30 space-y-2">
                    <div>
                      <div className="flex items-center gap-2 text-white/80">
                        <PlaneLanding className="h-4 w-4 text-purple-400" />
                        <span className="font-medium">{returnFromCity}</span>
                        <span className="text-white/50">→</span>
                        <span className={returnViaCity ? "text-yellow-400" : "font-medium"}>{returnViaCity || returnToCity}</span>
                      </div>
                      <p className="text-sm text-white/60 mt-1 ml-6">
                        {new Date(returnDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                        {returnPreferredTime && <span className="ml-2 font-mono text-purple-300">{returnPreferredTime}</span>}
                        {returnDepartureTime && <span className="ml-1">at {returnDepartureTime}</span>}
                      </p>
                    </div>
                    {returnViaCity && (
                      <div className="border-t border-white/10 pt-2">
                        <div className="flex items-center gap-2 text-white/80">
                          <Plane className="h-4 w-4 text-yellow-400" />
                          <span className="text-yellow-400">{returnViaCity}</span>
                          <span className="text-white/50">→</span>
                          <span className="font-medium">{returnToCity}</span>
                        </div>
                        <p className="text-sm text-white/60 mt-1 ml-6">
                          {returnLeg2Flight && <span className="font-mono text-yellow-300">{returnLeg2Flight}</span>}
                          {returnLeg2Time && <span className="ml-1">at {returnLeg2Time}</span>}
                          {!returnLeg2Flight && !returnLeg2Time && <span className="text-white/40 italic">Enter 2nd leg details above</span>}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!returnRequired && <p className="text-sm text-purple-300/60">Return flight not needed</p>}
          </div>

          {/* HOTEL ACCOMMODATION */}
          <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-amber-400 flex items-center gap-2">
                <Hotel className="h-5 w-5" />
                Hotel Accommodation
              </h3>
              <Switch checked={hotelRequired} onCheckedChange={setHotelRequired} disabled={isFormLocked} />
            </div>

            {hotelRequired && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white/80">Check-in Date *</Label>
                    <Input type="date" value={hotelCheckIn} onChange={(e) => setHotelCheckIn(e.target.value)} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white disabled:opacity-60" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/80">Check-out Date *</Label>
                    <Input type="date" value={hotelCheckOut} onChange={(e) => setHotelCheckOut(e.target.value)} disabled={isFormLocked} className="bg-white/10 border-white/20 text-white disabled:opacity-60" />
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
            {!hotelRequired && <p className="text-sm text-amber-300/60">Hotel not needed (local resident or self-arranged)</p>}
          </div>

          {/* GROUND TRANSPORT */}
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
                <Switch checked={pickupRequired} onCheckedChange={setPickupRequired} disabled={isFormLocked} />
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="font-medium text-white">Airport Drop</p>
                  <p className="text-xs text-white/50">Arrange drop from venue/hotel to airport</p>
                </div>
                <Switch checked={dropRequired} onCheckedChange={setDropRequired} disabled={isFormLocked} />
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

          {/* ID DOCUMENT UPLOAD */}
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20" onClick={() => setIdDocumentUrl("")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(idDocumentUrl, "_blank")}>
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
                  <input type="file" className="hidden" accept="image/jpeg,image/png,application/pdf" onChange={handleIdUpload} disabled={isUploading || isFormLocked} />
                </label>
              )}
            </div>
          )}

          {/* Save Button */}
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
        </div>
      )}
    </div>
  )
}
