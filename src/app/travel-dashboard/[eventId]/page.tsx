"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  ResizableSheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Plane,
  Loader2,
  Search,
  ArrowLeft,
  PlaneTakeoff,
  PlaneLanding,
  Phone,
  Mail,
  CheckCircle,
  Check,
  Copy,
  Hotel,
  User,
  Calendar,
  MapPin,
  Car,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Speaker = {
  id: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  custom_fields: {
    needs_travel?: boolean
    travel_details?: {
      onward_from_city?: string
      onward_via_city?: string
      onward_to_city?: string
      onward_date?: string
      onward_preferred_time?: string
      onward_departure_time?: string
      onward_leg2_flight?: string
      onward_leg2_time?: string
      return_from_city?: string
      return_via_city?: string
      return_to_city?: string
      return_date?: string
      return_preferred_time?: string
      return_departure_time?: string
      return_leg2_flight?: string
      return_leg2_time?: string
      hotel_required?: boolean
      hotel_name?: string
      hotel_check_in?: string
      hotel_check_out?: string
      pickup_required?: boolean
      drop_required?: boolean
    }
    booking?: {
      onward_status?: string
      onward_pnr?: string
      onward_flight_number?: string
      return_status?: string
      return_pnr?: string
      return_flight_number?: string
      hotel_name?: string
      hotel_address?: string
      hotel_phone?: string
    }
    travel_id?: {
      full_name_as_passport?: string
    }
  }
}

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-warning text-warning-foreground" },
  booked: { label: "Booked", color: "bg-info text-white" },
  confirmed: { label: "Confirmed", color: "bg-success text-white" },
  cancelled: { label: "Cancelled", color: "bg-destructive text-white" },
  not_required: { label: "N/A", color: "bg-muted text-muted-foreground" },
}

export default function EventTravelDashboard() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Redirect transport users to the focused travel section
  useEffect(() => {
    const checkAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) return

      type TeamMemberType = { role: string | null; permissions: string[] | null }
      const { data: teamMemberData } = await supabase
        .from("team_members")
        .select("role, permissions")
        .eq("email", session.user.email.toLowerCase())
        .eq("is_active", true)
        .single()
      const teamMember = teamMemberData as TeamMemberType | null

      if (teamMember) {
        const role = teamMember.role || ""
        // If user is transport/travel but NOT admin, redirect to focused view
        if ((role.includes("travel") || role.includes("transport")) && !role.includes("admin")) {
          router.replace(`/events/${eventId}/travel`)
        }
      }
    }
    checkAndRedirect()
  }, [supabase, router, eventId])

  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("onward")
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null)

  // Fetch event
  const { data: event } = useQuery({
    queryKey: ["travel-event", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("id, name, short_name, start_date, end_date, venue_name, city")
        .eq("id", eventId)
        .single()
      return data as { id: string; name: string; short_name: string; start_date: string; end_date: string; venue_name: string; city: string } | null
    },
  })

  // Fetch speakers
  const { data: speakers, isLoading: speakersLoading } = useQuery({
    queryKey: ["travel-speakers", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, attendee_phone, custom_fields")
        .eq("event_id", eventId)
        .order("attendee_name")

      return (data || []).filter((s: Speaker) => s.custom_fields?.needs_travel) as Speaker[]
    },
  })

  // Quick status update
  const updateStatus = useMutation({
    mutationFn: async ({ id, type, status }: { id: string; type: "onward" | "return"; status: string }) => {
      const { data: current } = await supabase
        .from("registrations")
        .select("custom_fields")
        .eq("id", id)
        .single() as { data: { custom_fields: any } | null }

      const updatedBooking = {
        ...current?.custom_fields?.booking,
        [`${type}_status`]: status,
      }

      await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...current?.custom_fields,
            booking: updatedBooking,
          },
        })
        .eq("id", id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travel-speakers", eventId] })
      toast.success("Status updated")
    },
  })

  const filteredSpeakers = (speakers || []).filter(s =>
    s.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
    s.attendee_email.toLowerCase().includes(search.toLowerCase())
  )

  // Stats
  const stats = {
    total: filteredSpeakers.length,
    onwardPending: filteredSpeakers.filter(s => !s.custom_fields?.booking?.onward_status || s.custom_fields?.booking?.onward_status === "pending").length,
    returnPending: filteredSpeakers.filter(s => !s.custom_fields?.booking?.return_status || s.custom_fields?.booking?.return_status === "pending").length,
    hotelRequired: filteredSpeakers.filter(s => s.custom_fields?.travel_details?.hotel_required).length,
    pickupRequired: filteredSpeakers.filter(s => s.custom_fields?.travel_details?.pickup_required).length,
    dropRequired: filteredSpeakers.filter(s => s.custom_fields?.travel_details?.drop_required).length,
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-"
    try {
      return format(new Date(dateStr), "dd MMM")
    } catch {
      return dateStr
    }
  }

  const calculateNights = (checkIn?: string, checkOut?: string): number | null => {
    if (!checkIn || !checkOut) return null
    try {
      const checkInDate = new Date(checkIn)
      const checkOutDate = new Date(checkOut)
      // Validate dates are valid
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) return null
      const diffTime = checkOutDate.getTime() - checkInDate.getTime()
      // If negative or unreasonably large (> 365 days), return null
      if (diffTime < 0 || diffTime > 365 * 24 * 60 * 60 * 1000) return null
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    } catch {
      return null
    }
  }

  const copyToClipboard = (speaker: Speaker) => {
    const travel = speaker.custom_fields?.travel_details || {}
    const travelId = speaker.custom_fields?.travel_id || {}

    const onwardRoute = travel.onward_via_city
      ? `${travel.onward_from_city || "-"} → ${travel.onward_via_city} → ${travel.onward_to_city || "-"}`
      : `${travel.onward_from_city || "-"} → ${travel.onward_to_city || "-"}`

    const returnRoute = travel.return_via_city
      ? `${travel.return_from_city || "-"} → ${travel.return_via_city} → ${travel.return_to_city || "-"}`
      : `${travel.return_from_city || "-"} → ${travel.return_to_city || "-"}`

    const lines = [
      `=== TRAVEL BOOKING REQUEST ===`,
      ``,
      `PASSENGER: ${travelId.full_name_as_passport || speaker.attendee_name}`,
      `Email: ${speaker.attendee_email}`,
      `Phone: ${speaker.attendee_phone || "-"}`,
      ``,
      `ONWARD: ${onwardRoute}`,
      `Date: ${formatDate(travel.onward_date)}`,
      `Flight: ${travel.onward_preferred_time || "-"} @ ${travel.onward_departure_time || "-"}`,
      travel.onward_via_city ? `Leg 2: ${travel.onward_leg2_flight || "-"} @ ${travel.onward_leg2_time || "-"}` : "",
      ``,
      `RETURN: ${returnRoute}`,
      `Date: ${formatDate(travel.return_date)}`,
      `Flight: ${travel.return_preferred_time || "-"} @ ${travel.return_departure_time || "-"}`,
      travel.return_via_city ? `Leg 2: ${travel.return_leg2_flight || "-"} @ ${travel.return_leg2_time || "-"}` : "",
      ``,
      travel.hotel_required ? `HOTEL: ${speaker.custom_fields?.booking?.hotel_name || travel.hotel_name || "TBD"} (${formatDate(travel.hotel_check_in)} to ${formatDate(travel.hotel_check_out)})` : "",
      travel.pickup_required ? `PICKUP: ${travel.onward_to_city} Airport → ${speaker.custom_fields?.booking?.hotel_name || travel.hotel_name || "Hotel"} @ ${formatDate(travel.onward_date)} ${travel.onward_departure_time || ""}` : "",
      travel.drop_required ? `DROP: ${speaker.custom_fields?.booking?.hotel_name || travel.hotel_name || "Hotel"} → ${travel.return_from_city} Airport @ ${formatDate(travel.return_date)} ${travel.return_departure_time || ""}` : "",
    ].filter(Boolean).join("\n")

    navigator.clipboard.writeText(lines)
    toast.success("Copied to clipboard!")
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/travel-dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plane className="h-6 w-6 text-primary" />
              {event?.short_name || event?.name || "Travel"}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {event?.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(event.start_date)}
                </span>
              )}
              {event?.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.city}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="paper-card p-4">
            <p className="text-xs text-muted-foreground">Total Guests</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="paper-card p-4">
            <p className="text-xs text-muted-foreground">Onward Pending</p>
            <p className="text-2xl font-bold text-warning">{stats.onwardPending}</p>
          </div>
          <div className="paper-card p-4">
            <p className="text-xs text-muted-foreground">Return Pending</p>
            <p className="text-2xl font-bold text-warning">{stats.returnPending}</p>
          </div>
          <div className="paper-card p-4">
            <p className="text-xs text-muted-foreground">Need Hotel</p>
            <p className="text-2xl font-bold text-info">{stats.hotelRequired}</p>
          </div>
          <div className="paper-card p-4">
            <p className="text-xs text-muted-foreground">Need Pickup</p>
            <p className="text-2xl font-bold text-destructive">{stats.pickupRequired}</p>
          </div>
          <div className="paper-card p-4">
            <p className="text-xs text-muted-foreground">Need Drop</p>
            <p className="text-2xl font-bold text-destructive">{stats.dropRequired}</p>
          </div>
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
          <Badge variant="outline">
            {filteredSpeakers.length} speakers
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="onward">
              <PlaneTakeoff className="h-4 w-4 mr-2" />
              Onward ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="return">
              <PlaneLanding className="h-4 w-4 mr-2" />
              Return ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="hotel">
              <Hotel className="h-4 w-4 mr-2" />
              Hotel ({stats.hotelRequired})
            </TabsTrigger>
            <TabsTrigger value="transfers">
              <Car className="h-4 w-4 mr-2" />
              Transfers ({stats.pickupRequired + stats.dropRequired})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="onward" className="mt-4">
            <div className="paper-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Flight</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {speakersLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredSpeakers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No speakers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSpeakers.map((speaker) => {
                      const travel = speaker.custom_fields?.travel_details || {}
                      const booking = speaker.custom_fields?.booking || {}
                      const status = booking.onward_status || "pending"
                      const statusInfo = BOOKING_STATUS[status] || BOOKING_STATUS.pending

                      return (
                        <TableRow
                          key={speaker.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedSpeaker(speaker)}
                        >
                          <TableCell>
                            <p className="font-medium">{speaker.attendee_name}</p>
                            <p className="text-xs text-muted-foreground">{speaker.attendee_email}</p>
                          </TableCell>
                          <TableCell>
                            <span>
                              {travel.onward_from_city || "-"}
                              {travel.onward_via_city && (
                                <span className="text-orange-500 font-medium"> → {travel.onward_via_city}</span>
                              )}
                              {" → "}
                              {travel.onward_to_city || "-"}
                            </span>
                          </TableCell>
                          <TableCell>{formatDate(travel.onward_date)}</TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{travel.onward_preferred_time || "-"}</span>
                          </TableCell>
                          <TableCell>{travel.onward_departure_time || "-"}</TableCell>
                          <TableCell>
                            <Badge className={cn("text-xs", statusInfo.color)}>
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              {status === "pending" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => updateStatus.mutate({ id: speaker.id, type: "onward", status: "not_required" })}
                                  >
                                    N/A
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-info"
                                    onClick={() => updateStatus.mutate({ id: speaker.id, type: "onward", status: "booked" })}
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />Booked
                                  </Button>
                                </>
                              )}
                              {status === "booked" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-success"
                                  onClick={() => updateStatus.mutate({ id: speaker.id, type: "onward", status: "confirmed" })}
                                >
                                  <Check className="h-3 w-3 mr-1" />Confirm
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="return" className="mt-4">
            <div className="paper-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Flight</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSpeakers.map((speaker) => {
                    const travel = speaker.custom_fields?.travel_details || {}
                    const booking = speaker.custom_fields?.booking || {}
                    const status = booking.return_status || "pending"
                    const statusInfo = BOOKING_STATUS[status] || BOOKING_STATUS.pending

                    return (
                      <TableRow
                        key={speaker.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedSpeaker(speaker)}
                      >
                        <TableCell>
                          <p className="font-medium">{speaker.attendee_name}</p>
                          <p className="text-xs text-muted-foreground">{speaker.attendee_email}</p>
                        </TableCell>
                        <TableCell>
                          <span>
                            {travel.return_from_city || "-"}
                            {travel.return_via_city && (
                              <span className="text-orange-500 font-medium"> → {travel.return_via_city}</span>
                            )}
                            {" → "}
                            {travel.return_to_city || "-"}
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(travel.return_date)}</TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{travel.return_preferred_time || "-"}</span>
                        </TableCell>
                        <TableCell>{travel.return_departure_time || "-"}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", statusInfo.color)}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => updateStatus.mutate({ id: speaker.id, type: "return", status: "not_required" })}
                                >
                                  N/A
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-info"
                                  onClick={() => updateStatus.mutate({ id: speaker.id, type: "return", status: "booked" })}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />Booked
                                </Button>
                              </>
                            )}
                            {status === "booked" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-success"
                                onClick={() => updateStatus.mutate({ id: speaker.id, type: "return", status: "confirmed" })}
                              >
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
          </TabsContent>

          <TabsContent value="hotel" className="mt-4">
            <div className="paper-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Nights</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSpeakers.filter(s => s.custom_fields?.travel_details?.hotel_required).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No hotel requirements
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSpeakers
                      .filter(s => s.custom_fields?.travel_details?.hotel_required)
                      .map((speaker) => {
                        const travel = speaker.custom_fields?.travel_details || {}
                        const nights = calculateNights(travel.hotel_check_in, travel.hotel_check_out)

                        return (
                          <TableRow key={speaker.id} className="cursor-pointer" onClick={() => setSelectedSpeaker(speaker)}>
                            <TableCell>
                              <p className="font-medium">{speaker.attendee_name}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm text-muted-foreground">{speaker.attendee_email}</p>
                              {speaker.attendee_phone && (
                                <p className="text-sm">{speaker.attendee_phone}</p>
                              )}
                            </TableCell>
                            <TableCell>{formatDate(travel.hotel_check_in)}</TableCell>
                            <TableCell>{formatDate(travel.hotel_check_out)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{nights !== null ? `${nights} night${nights !== 1 ? 's' : ''}` : "-"}</Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="transfers" className="mt-4">
            <div className="paper-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Hotel</TableHead>
                    <TableHead>Pickup (Airport → Hotel)</TableHead>
                    <TableHead>Drop (Hotel → Airport)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSpeakers.filter(s =>
                    s.custom_fields?.travel_details?.pickup_required ||
                    s.custom_fields?.travel_details?.drop_required
                  ).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No transfer requirements
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSpeakers
                      .filter(s =>
                        s.custom_fields?.travel_details?.pickup_required ||
                        s.custom_fields?.travel_details?.drop_required
                      )
                      .map((speaker) => {
                        const travel = speaker.custom_fields?.travel_details || {}

                        return (
                          <TableRow key={speaker.id} className="cursor-pointer" onClick={() => setSelectedSpeaker(speaker)}>
                            <TableCell>
                              <p className="font-medium">{speaker.attendee_name}</p>
                            </TableCell>
                            <TableCell>
                              {speaker.attendee_phone && (
                                <a href={`tel:${speaker.attendee_phone}`} className="text-primary hover:underline">
                                  {speaker.attendee_phone}
                                </a>
                              )}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const booking = speaker.custom_fields?.booking || {}
                                const hotelName = booking.hotel_name || travel.hotel_name
                                return hotelName ? (
                                  <div>
                                    <p className="font-medium text-info">{hotelName}</p>
                                    {booking.hotel_address && (
                                      <p className="text-xs text-muted-foreground line-clamp-1">{booking.hotel_address}</p>
                                    )}
                                    {travel.hotel_check_in && (
                                      <p className="text-xs text-muted-foreground">
                                        {formatDate(travel.hotel_check_in)} - {formatDate(travel.hotel_check_out)}
                                      </p>
                                    )}
                                  </div>
                                ) : travel.hotel_required ? (
                                  <Badge variant="outline" className="text-warning">TBD</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )
                              })()}
                            </TableCell>
                            <TableCell>
                              {travel.pickup_required ? (
                                <div>
                                  <Badge className="bg-success text-white mb-1">Required</Badge>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(travel.onward_date)}
                                    {travel.onward_departure_time && ` @ ${travel.onward_departure_time}`}
                                  </p>
                                  <p className="text-xs font-medium">
                                    {travel.onward_to_city} → {speaker.custom_fields?.booking?.hotel_name || travel.hotel_name || "Hotel"}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {travel.drop_required ? (
                                <div>
                                  <Badge className="bg-success text-white mb-1">Required</Badge>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(travel.return_date)}
                                    {travel.return_departure_time && ` @ ${travel.return_departure_time}`}
                                  </p>
                                  <p className="text-xs font-medium">
                                    {speaker.custom_fields?.booking?.hotel_name || travel.hotel_name || "Hotel"} → {travel.return_from_city}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Speaker Detail Sheet */}
      <Sheet open={!!selectedSpeaker} onOpenChange={() => setSelectedSpeaker(null)}>
        <ResizableSheetContent defaultWidth={500} minWidth={400} maxWidth={800} storageKey="travel-dashboard-sheet-width" className="">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedSpeaker?.attendee_name}
            </SheetTitle>
          </SheetHeader>

          {selectedSpeaker && (
            <div className="mt-6 space-y-6">
              {/* Contact Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {selectedSpeaker.attendee_email}
                </div>
                {selectedSpeaker.attendee_phone && (
                  <a
                    href={`tel:${selectedSpeaker.attendee_phone}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {selectedSpeaker.attendee_phone}
                  </a>
                )}
              </div>

              {/* Onward Journey */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold text-primary mb-3 flex items-center gap-2">
                  <PlaneTakeoff className="h-4 w-4" />
                  Onward Journey
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Route</span>
                    <p>
                      {selectedSpeaker.custom_fields?.travel_details?.onward_from_city || "-"}
                      {selectedSpeaker.custom_fields?.travel_details?.onward_via_city && (
                        <span className="text-orange-500 font-medium"> → {selectedSpeaker.custom_fields.travel_details.onward_via_city}</span>
                      )}
                      {" → "}
                      {selectedSpeaker.custom_fields?.travel_details?.onward_to_city || "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date</span>
                    <p>{formatDate(selectedSpeaker.custom_fields?.travel_details?.onward_date)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Leg 1 Flight</span>
                    <p className="font-mono">
                      {selectedSpeaker.custom_fields?.travel_details?.onward_preferred_time || "-"}
                      {selectedSpeaker.custom_fields?.travel_details?.onward_departure_time && (
                        <span className="text-muted-foreground"> @ {selectedSpeaker.custom_fields.travel_details.onward_departure_time}</span>
                      )}
                    </p>
                  </div>
                  {selectedSpeaker.custom_fields?.travel_details?.onward_via_city && (
                    <div>
                      <span className="text-orange-500">Leg 2 Flight</span>
                      <p className="font-mono">
                        {selectedSpeaker.custom_fields?.travel_details?.onward_leg2_flight || "-"}
                        {selectedSpeaker.custom_fields?.travel_details?.onward_leg2_time && (
                          <span className="text-muted-foreground"> @ {selectedSpeaker.custom_fields.travel_details.onward_leg2_time}</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Return Journey */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold text-info mb-3 flex items-center gap-2">
                  <PlaneLanding className="h-4 w-4" />
                  Return Journey
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Route</span>
                    <p>
                      {selectedSpeaker.custom_fields?.travel_details?.return_from_city || "-"}
                      {selectedSpeaker.custom_fields?.travel_details?.return_via_city && (
                        <span className="text-orange-500 font-medium"> → {selectedSpeaker.custom_fields.travel_details.return_via_city}</span>
                      )}
                      {" → "}
                      {selectedSpeaker.custom_fields?.travel_details?.return_to_city || "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date</span>
                    <p>{formatDate(selectedSpeaker.custom_fields?.travel_details?.return_date)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Leg 1 Flight</span>
                    <p className="font-mono">
                      {selectedSpeaker.custom_fields?.travel_details?.return_preferred_time || "-"}
                      {selectedSpeaker.custom_fields?.travel_details?.return_departure_time && (
                        <span className="text-muted-foreground"> @ {selectedSpeaker.custom_fields.travel_details.return_departure_time}</span>
                      )}
                    </p>
                  </div>
                  {selectedSpeaker.custom_fields?.travel_details?.return_via_city && (
                    <div>
                      <span className="text-orange-500">Leg 2 Flight</span>
                      <p className="font-mono">
                        {selectedSpeaker.custom_fields?.travel_details?.return_leg2_flight || "-"}
                        {selectedSpeaker.custom_fields?.travel_details?.return_leg2_time && (
                          <span className="text-muted-foreground"> @ {selectedSpeaker.custom_fields.travel_details.return_leg2_time}</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Hotel & Transfers */}
              {(selectedSpeaker.custom_fields?.travel_details?.hotel_required ||
                selectedSpeaker.custom_fields?.travel_details?.pickup_required ||
                selectedSpeaker.custom_fields?.travel_details?.drop_required) && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold text-destructive mb-3 flex items-center gap-2">
                    <Hotel className="h-4 w-4" />
                    Hotel & Transfers
                  </h4>
                  {(() => {
                    const travel = selectedSpeaker.custom_fields?.travel_details || {}
                    const booking = selectedSpeaker.custom_fields?.booking || {}
                    const hotelName = booking.hotel_name || travel.hotel_name || "Hotel TBD"

                    return (
                      <div className="space-y-3 text-sm">
                        {travel.hotel_required && (
                          <div className="p-3 bg-background rounded-lg">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-info text-base">{hotelName}</p>
                                {booking.hotel_address && (
                                  <p className="text-xs text-muted-foreground">{booking.hotel_address}</p>
                                )}
                                {booking.hotel_phone && (
                                  <a href={`tel:${booking.hotel_phone}`} className="text-xs text-primary hover:underline">
                                    {booking.hotel_phone}
                                  </a>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDate(travel.hotel_check_in)} - {formatDate(travel.hotel_check_out)}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {(() => {
                                  const nights = calculateNights(travel.hotel_check_in, travel.hotel_check_out)
                                  return nights !== null ? `${nights} night${nights !== 1 ? 's' : ''}` : '-'
                                })()}
                              </Badge>
                            </div>
                          </div>
                        )}
                        {travel.pickup_required && (
                          <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                            <div>
                              <p className="font-medium text-success">Airport Pickup</p>
                              <p className="text-xs font-medium">
                                {travel.onward_to_city} Airport → {hotelName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(travel.onward_date)}
                                {travel.onward_departure_time && ` @ ${travel.onward_departure_time}`}
                              </p>
                            </div>
                            <Badge className="bg-success text-white text-xs">Required</Badge>
                          </div>
                        )}
                        {travel.drop_required && (
                          <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                            <div>
                              <p className="font-medium text-warning">Airport Drop</p>
                              <p className="text-xs font-medium">
                                {hotelName} → {travel.return_from_city} Airport
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(travel.return_date)}
                                {travel.return_departure_time && ` @ ${travel.return_departure_time}`}
                              </p>
                            </div>
                            <Badge className="bg-warning text-white text-xs">Required</Badge>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => copyToClipboard(selectedSpeaker)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Details
                </Button>
                {selectedSpeaker.attendee_phone && (
                  <Button
                    className="flex-1 bg-success hover:bg-success/90"
                    onClick={() => window.open(`https://wa.me/${selectedSpeaker.attendee_phone?.replace(/\D/g, '')}`, '_blank')}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                )}
              </div>
            </div>
          )}
        </ResizableSheetContent>
      </Sheet>
    </DashboardLayout>
  )
}
