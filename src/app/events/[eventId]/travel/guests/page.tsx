"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  Plane,
  MoreVertical,
  Loader2,
  CheckCircle,
  Clock,
  Mail,
  ExternalLink,
  Download,
  Check,
  X,
  User,
  PlaneTakeoff,
  PlaneLanding,
  FileCheck,
  CheckSquare,
  Square,
  Send,
  Hotel,
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
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  custom_fields: {
    portal_token?: string
    needs_travel?: boolean
    flight_preference_images?: string[]
    travel_details?: {
      mode?: string
      // Legacy fields
      arrival_date?: string
      departure_date?: string
      from_city?: string
      // Onward journey
      onward_required?: boolean
      onward_from_city?: string
      onward_to_city?: string
      onward_date?: string
      onward_preferred_time?: string
      onward_departure_time?: string
      // Return journey
      return_required?: boolean
      return_from_city?: string
      return_to_city?: string
      return_date?: string
      return_preferred_time?: string
      return_departure_time?: string
      // Hotel
      hotel_required?: boolean
      hotel_check_in?: string
      hotel_check_out?: string
      hotel_room_type?: string
      special_requirements?: string
      // Airport Transfers
      pickup_required?: boolean
      drop_required?: boolean
    }
    travel_id?: {
      id_document_url?: string
    }
    booking?: {
      onward_status?: string
      onward_pnr?: string
      onward_flight_number?: string
      return_status?: string
      return_pnr?: string
      return_flight_number?: string
    }
  } | null
}

const BOOKING_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-amber-500", icon: Clock },
  booked: { label: "Booked", color: "bg-blue-500", icon: CheckCircle },
  confirmed: { label: "Confirmed", color: "bg-green-500", icon: Check },
  cancelled: { label: "Cancelled", color: "bg-red-500", icon: X },
  not_required: { label: "N/A", color: "bg-gray-400", icon: X },
}

export default function TravelGuestsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [idFilter, setIdFilter] = useState<string>("all")
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set())
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null)

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

  // Fetch speakers needing travel
  const { data: speakers, isLoading } = useQuery({
    queryKey: ["travel-guests", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("*")
        .eq("event_id", eventId)
        .or("attendee_designation.ilike.%speaker%,attendee_designation.ilike.%faculty%,attendee_designation.ilike.%chairperson%,attendee_designation.ilike.%moderator%")
        .order("attendee_name")

      return (data || []).filter((s: Speaker) => s.custom_fields?.needs_travel) as Speaker[]
    },
  })

  // Filter speakers
  const filteredSpeakers = useMemo(() => {
    if (!speakers) return []

    return speakers.filter((speaker) => {
      const matchesSearch = !search ||
        speaker.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
        speaker.attendee_email.toLowerCase().includes(search.toLowerCase())

      const onwardStatus = speaker.custom_fields?.booking?.onward_status || "pending"
      const matchesStatus = statusFilter === "all" || onwardStatus === statusFilter

      const hasId = !!speaker.custom_fields?.travel_id?.id_document_url
      const matchesId = idFilter === "all" ||
        (idFilter === "submitted" && hasId) ||
        (idFilter === "missing" && !hasId)

      return matchesSearch && matchesStatus && matchesId
    })
  }, [speakers, search, statusFilter, idFilter])

  // Stats
  const stats = useMemo(() => {
    if (!speakers) return { total: 0, pending: 0, booked: 0, confirmed: 0, idSubmitted: 0, idMissing: 0 }

    const idSubmitted = speakers.filter(s => s.custom_fields?.travel_id?.id_document_url).length

    return {
      total: speakers.length,
      pending: speakers.filter(s => (s.custom_fields?.booking?.onward_status || "pending") === "pending").length,
      booked: speakers.filter(s => s.custom_fields?.booking?.onward_status === "booked").length,
      confirmed: speakers.filter(s => s.custom_fields?.booking?.onward_status === "confirmed").length,
      idSubmitted,
      idMissing: speakers.length - idSubmitted,
    }
  }, [speakers])

  // Quick status update mutation
  const quickUpdateStatus = useMutation({
    mutationFn: async ({ id, status, type }: { id: string; status: string; type: "onward" | "return" }) => {
      const { data: current } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", id)
        .single()

      const updateField = type === "onward" ? "onward_status" : "return_status"
      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(current?.custom_fields || {}),
            booking: {
              ...(current?.custom_fields?.booking || {}),
              [updateField]: status,
            },
          },
        })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: (_, { status, type }) => {
      toast.success(`${type === "onward" ? "Onward" : "Return"} status updated to ${status}`)
      queryClient.invalidateQueries({ queryKey: ["travel-guests", eventId] })
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
      queryClient.invalidateQueries({ queryKey: ["travel-guests", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const toggleGuestSelection = (guestId: string) => {
    const newSelection = new Set(selectedGuests)
    if (newSelection.has(guestId)) newSelection.delete(guestId)
    else newSelection.add(guestId)
    setSelectedGuests(newSelection)
  }

  const clearSelection = () => setSelectedGuests(new Set())

  // Send bulk travel request email
  const [sendingRequests, setSendingRequests] = useState(false)
  const sendBulkRequest = async () => {
    const pendingGuests = Array.from(selectedGuests)
      .map(id => speakers?.find(s => s.id === id))
      .filter(s => s && !s.custom_fields?.travel_id?.id_document_url) as Speaker[]

    if (pendingGuests.length === 0) {
      toast.error("All selected guests already have ID submitted")
      return
    }

    setSendingRequests(true)
    let successCount = 0
    let failCount = 0

    const baseUrl = window.location.origin
    const eventName = event?.short_name || event?.name || "Event"
    const eventDate = event?.start_date || ""
    const eventVenue = event?.venue_name ? `${event.venue_name}${event.city ? `, ${event.city}` : ""}` : ""

    for (const guest of pendingGuests) {
      try {
        const portalToken = guest.custom_fields?.portal_token
        const portalUrl = portalToken
          ? `${baseUrl}/speaker/${portalToken}`
          : `${baseUrl}/speaker?email=${encodeURIComponent(guest.attendee_email)}`

        const response = await fetch("/api/email/request-travel-details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registration_id: guest.id,
            event_id: eventId,
            speaker_name: guest.attendee_name,
            speaker_email: guest.attendee_email,
            event_name: eventName,
            event_date: eventDate,
            event_venue: eventVenue,
            portal_url: portalUrl,
          }),
        })

        if (response.ok) {
          successCount++
        } else {
          failCount++
        }
      } catch (error) {
        console.error("Error sending travel request:", error)
        failCount++
      }
    }

    setSendingRequests(false)
    queryClient.invalidateQueries({ queryKey: ["travel-guests", eventId] })

    if (successCount > 0) {
      toast.success(`Sent travel request to ${successCount} guest${successCount > 1 ? "s" : ""}`)
    }
    if (failCount > 0) {
      toast.error(`Failed to send to ${failCount} guest${failCount > 1 ? "s" : ""}`)
    }
    clearSelection()
  }

  const exportToCSV = () => {
    const headers = ["Name", "Email", "Phone", "From City", "Arrival", "Departure", "Onward Status", "Return Status", "ID Submitted"]

    const rows = filteredSpeakers.map(s => [
      s.attendee_name,
      s.attendee_email,
      s.attendee_phone || "",
      s.custom_fields?.travel_details?.from_city || "",
      s.custom_fields?.travel_details?.arrival_date || "",
      s.custom_fields?.travel_details?.departure_date || "",
      s.custom_fields?.booking?.onward_status || "pending",
      s.custom_fields?.booking?.return_status || "pending",
      s.custom_fields?.travel_id?.id_document_url ? "Yes" : "No",
    ])

    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `travel-guests-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Guest list exported")
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Travel Guests</h1>
          <p className="text-muted-foreground">Manage travel requirements for {speakers?.length || 0} guests</p>
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
          <Button size="sm" variant="outline" onClick={clearSelection}>Clear</Button>
          <Button size="sm" onClick={sendBulkRequest} disabled={sendingRequests}>
            {sendingRequests ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {sendingRequests ? "Sending..." : "Send Travel Request"}
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn("bg-card rounded-lg border p-3 text-left hover:shadow-md", statusFilter === "all" && "ring-2 ring-primary")}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="text-xs">Total</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.total}</p>
        </button>
        <button
          onClick={() => setStatusFilter("pending")}
          className={cn("bg-card rounded-lg border p-3 text-left hover:shadow-md", statusFilter === "pending" && "ring-2 ring-amber-500")}
        >
          <div className="flex items-center gap-2 text-amber-500">
            <Clock className="h-4 w-4" />
            <span className="text-xs">Pending</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.pending}</p>
        </button>
        <button
          onClick={() => setStatusFilter("booked")}
          className={cn("bg-card rounded-lg border p-3 text-left hover:shadow-md", statusFilter === "booked" && "ring-2 ring-blue-500")}
        >
          <div className="flex items-center gap-2 text-blue-500">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs">Booked</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.booked}</p>
        </button>
        <button
          onClick={() => setStatusFilter("confirmed")}
          className={cn("bg-card rounded-lg border p-3 text-left hover:shadow-md", statusFilter === "confirmed" && "ring-2 ring-green-500")}
        >
          <div className="flex items-center gap-2 text-green-500">
            <Check className="h-4 w-4" />
            <span className="text-xs">Confirmed</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.confirmed}</p>
        </button>
        <button
          onClick={() => setIdFilter(idFilter === "submitted" ? "all" : "submitted")}
          className={cn("bg-card rounded-lg border p-3 text-left hover:shadow-md", idFilter === "submitted" && "ring-2 ring-green-500")}
        >
          <div className="flex items-center gap-2 text-green-600">
            <FileCheck className="h-4 w-4" />
            <span className="text-xs">ID Submitted</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.idSubmitted}</p>
        </button>
        <button
          onClick={() => setIdFilter(idFilter === "missing" ? "all" : "missing")}
          className={cn("bg-card rounded-lg border p-3 text-left hover:shadow-md", idFilter === "missing" && "ring-2 ring-red-500")}
        >
          <div className="flex items-center gap-2 text-red-500">
            <X className="h-4 w-4" />
            <span className="text-xs">ID Missing</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.idMissing}</p>
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search guests..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        {(statusFilter !== "all" || idFilter !== "all" || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setIdFilter("all"); setSearch("") }}>
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{filteredSpeakers.length} guests</span>
      </div>

      {/* Table */}
      {filteredSpeakers.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Plane className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No guests found</h3>
          <p className="text-muted-foreground">{speakers?.length === 0 ? "No speakers require travel" : "Adjust filters"}</p>
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
                      if (selectedGuests.size === filteredSpeakers.length) clearSelection()
                      else setSelectedGuests(new Set(filteredSpeakers.map(s => s.id)))
                    }}
                  >
                    {selectedGuests.size === filteredSpeakers.length && filteredSpeakers.length > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </Button>
                </TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Onward</TableHead>
                <TableHead>Return</TableHead>
                <TableHead className="text-center">ID</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSpeakers.map((speaker) => {
                const onwardStatus = speaker.custom_fields?.booking?.onward_status || "pending"
                const returnStatus = speaker.custom_fields?.booking?.return_status || "pending"
                const hasId = !!speaker.custom_fields?.travel_id?.id_document_url
                const isSelected = selectedGuests.has(speaker.id)

                return (
                  <TableRow key={speaker.id} className={cn("cursor-pointer hover:bg-muted/50", isSelected && "bg-blue-50")} onClick={() => setSelectedSpeaker(speaker)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleGuestSelection(speaker.id)} />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{speaker.attendee_name}</p>
                      <p className="text-xs text-muted-foreground">{speaker.attendee_email}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {speaker.custom_fields?.travel_details?.onward_from_city ||
                         speaker.custom_fields?.travel_details?.from_city || "-"}
                      </span>
                      {speaker.custom_fields?.travel_details?.onward_preferred_time && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {speaker.custom_fields.travel_details.onward_preferred_time}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        <div className="flex items-center gap-1">
                          <PlaneTakeoff className="h-3 w-3 text-green-500" />
                          {formatDate(speaker.custom_fields?.travel_details?.onward_date ||
                                      speaker.custom_fields?.travel_details?.arrival_date)}
                          {speaker.custom_fields?.travel_details?.onward_departure_time && (
                            <span className="text-muted-foreground ml-1">
                              {speaker.custom_fields.travel_details.onward_departure_time}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <PlaneLanding className="h-3 w-3 text-red-500" />
                          {formatDate(speaker.custom_fields?.travel_details?.return_date ||
                                      speaker.custom_fields?.travel_details?.departure_date)}
                          {speaker.custom_fields?.travel_details?.return_departure_time && (
                            <span className="text-muted-foreground ml-1">
                              {speaker.custom_fields.travel_details.return_departure_time}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-white text-xs", BOOKING_STATUS[onwardStatus]?.color || "bg-gray-500")}>
                        {BOOKING_STATUS[onwardStatus]?.label || onwardStatus}
                      </Badge>
                      {speaker.custom_fields?.booking?.onward_pnr && (
                        <p className="text-xs font-mono mt-1">{speaker.custom_fields.booking.onward_pnr}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-white text-xs", BOOKING_STATUS[returnStatus]?.color || "bg-gray-500")}>
                        {BOOKING_STATUS[returnStatus]?.label || returnStatus}
                      </Badge>
                      {speaker.custom_fields?.booking?.return_pnr && (
                        <p className="text-xs font-mono mt-1">{speaker.custom_fields.booking.return_pnr}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {hasId ? (
                        <Badge className="bg-green-500 text-white"><FileCheck className="h-3 w-3" /></Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-500 border-red-300"><X className="h-3 w-3" /></Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onwardStatus !== "booked" && (
                            <DropdownMenuItem onClick={() => quickUpdateStatus.mutate({ id: speaker.id, status: "booked", type: "onward" })}>
                              <CheckCircle className="h-4 w-4 mr-2 text-blue-500" />
                              Onward: Booked
                            </DropdownMenuItem>
                          )}
                          {onwardStatus !== "confirmed" && (
                            <DropdownMenuItem onClick={() => quickUpdateStatus.mutate({ id: speaker.id, status: "confirmed", type: "onward" })}>
                              <Check className="h-4 w-4 mr-2 text-green-500" />
                              Onward: Confirmed
                            </DropdownMenuItem>
                          )}
                          {onwardStatus !== "pending" && (
                            <DropdownMenuItem onClick={() => quickUpdateStatus.mutate({ id: speaker.id, status: "pending", type: "onward" })}>
                              <Clock className="h-4 w-4 mr-2 text-amber-500" />
                              Onward: Pending
                            </DropdownMenuItem>
                          )}
                          {onwardStatus !== "not_required" && (
                            <DropdownMenuItem onClick={() => quickUpdateStatus.mutate({ id: speaker.id, status: "not_required", type: "onward" })}>
                              <X className="h-4 w-4 mr-2 text-gray-500" />
                              Onward: Not Required
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {returnStatus !== "booked" && (
                            <DropdownMenuItem onClick={() => quickUpdateStatus.mutate({ id: speaker.id, status: "booked", type: "return" })}>
                              <CheckCircle className="h-4 w-4 mr-2 text-blue-500" />
                              Return: Booked
                            </DropdownMenuItem>
                          )}
                          {returnStatus !== "confirmed" && (
                            <DropdownMenuItem onClick={() => quickUpdateStatus.mutate({ id: speaker.id, status: "confirmed", type: "return" })}>
                              <Check className="h-4 w-4 mr-2 text-green-500" />
                              Return: Confirmed
                            </DropdownMenuItem>
                          )}
                          {returnStatus !== "pending" && (
                            <DropdownMenuItem onClick={() => quickUpdateStatus.mutate({ id: speaker.id, status: "pending", type: "return" })}>
                              <Clock className="h-4 w-4 mr-2 text-amber-500" />
                              Return: Pending
                            </DropdownMenuItem>
                          )}
                          {returnStatus !== "not_required" && (
                            <DropdownMenuItem onClick={() => quickUpdateStatus.mutate({ id: speaker.id, status: "not_required", type: "return" })}>
                              <X className="h-4 w-4 mr-2 text-gray-500" />
                              Return: Not Required
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            const token = speaker.custom_fields?.portal_token
                            if (token) window.open(`/speaker/${token}`, "_blank")
                          }}>
                            <ExternalLink className="h-4 w-4 mr-2" />View Portal
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(`mailto:${speaker.attendee_email}`, "_blank")}>
                            <Mail className="h-4 w-4 mr-2" />Send Email
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

      {/* Guest Details Sheet */}
      <Sheet open={!!selectedSpeaker} onOpenChange={(open) => !open && setSelectedSpeaker(null)}>
        <ResizableSheetContent defaultWidth={400} minWidth={350} maxWidth={700} storageKey="guests-sheet-width" className="overflow-y-auto">
          {selectedSpeaker && (
            <>
              <SheetHeader>
                <SheetTitle>Travel Details</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedSpeaker.attendee_name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedSpeaker.attendee_email}</p>
                    {selectedSpeaker.attendee_phone && <p className="text-sm text-muted-foreground">{selectedSpeaker.attendee_phone}</p>}
                  </div>
                </div>

                {/* Onward Journey */}
                <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <PlaneTakeoff className="h-4 w-4 text-blue-600" />
                    Onward Journey
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Route:</span>
                      <p className="font-medium">
                        {selectedSpeaker.custom_fields?.travel_details?.onward_from_city ||
                         selectedSpeaker.custom_fields?.travel_details?.from_city || "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span>
                      <p className="font-medium">
                        {formatDate(selectedSpeaker.custom_fields?.travel_details?.onward_date ||
                                    selectedSpeaker.custom_fields?.travel_details?.arrival_date)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time:</span>
                      <p className="font-medium">
                        {selectedSpeaker.custom_fields?.travel_details?.onward_departure_time || "-"}
                      </p>
                    </div>
                    {selectedSpeaker.custom_fields?.travel_details?.onward_preferred_time && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Preferred Flight(s):</span>
                        <p className="font-medium font-mono">
                          {selectedSpeaker.custom_fields.travel_details.onward_preferred_time}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Return Journey */}
                <div className="space-y-3 p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <PlaneLanding className="h-4 w-4 text-purple-600" />
                    Return Journey
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Route:</span>
                      <p className="font-medium">
                        {selectedSpeaker.custom_fields?.travel_details?.return_from_city || "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span>
                      <p className="font-medium">
                        {formatDate(selectedSpeaker.custom_fields?.travel_details?.return_date ||
                                    selectedSpeaker.custom_fields?.travel_details?.departure_date)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time:</span>
                      <p className="font-medium">
                        {selectedSpeaker.custom_fields?.travel_details?.return_departure_time || "-"}
                      </p>
                    </div>
                    {selectedSpeaker.custom_fields?.travel_details?.return_preferred_time && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Preferred Flight(s):</span>
                        <p className="font-medium font-mono">
                          {selectedSpeaker.custom_fields.travel_details.return_preferred_time}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hotel Requirements */}
                {selectedSpeaker.custom_fields?.travel_details?.hotel_required && (
                  <div className="space-y-3 p-4 bg-amber-50 rounded-lg">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Hotel className="h-4 w-4 text-amber-600" />
                      Hotel Required
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Check-in:</span>
                        <p className="font-medium">{formatDate(selectedSpeaker.custom_fields.travel_details.hotel_check_in)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Check-out:</span>
                        <p className="font-medium">{formatDate(selectedSpeaker.custom_fields.travel_details.hotel_check_out)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Room Type:</span>
                        <p className="font-medium capitalize">{selectedSpeaker.custom_fields.travel_details.hotel_room_type || "-"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Special Requirements */}
                {selectedSpeaker.custom_fields?.travel_details?.special_requirements && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <span className="text-xs text-muted-foreground">Special Requirements:</span>
                    <p className="text-sm">{selectedSpeaker.custom_fields.travel_details.special_requirements}</p>
                  </div>
                )}

                {/* Airport Transfers */}
                <div className="space-y-3 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Car className="h-4 w-4 text-green-600" />
                    Airport Transfers
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Airport Pickup</p>
                        <p className="text-xs text-muted-foreground">Pick up from airport on arrival</p>
                      </div>
                      <Switch
                        checked={selectedSpeaker.custom_fields?.travel_details?.pickup_required || false}
                        onCheckedChange={(checked) =>
                          updateAirportTransfer.mutate({
                            id: selectedSpeaker.id,
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
                        <p className="text-xs text-muted-foreground">Drop to airport on departure</p>
                      </div>
                      <Switch
                        checked={selectedSpeaker.custom_fields?.travel_details?.drop_required || false}
                        onCheckedChange={(checked) =>
                          updateAirportTransfer.mutate({
                            id: selectedSpeaker.id,
                            field: "drop_required",
                            value: checked
                          })
                        }
                        disabled={updateAirportTransfer.isPending}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-sm">Booking Status</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Onward</p>
                      <div className="flex items-center gap-1">
                        <Badge className={cn("text-white mt-1", BOOKING_STATUS[selectedSpeaker.custom_fields?.booking?.onward_status || "pending"]?.color)}>
                          {BOOKING_STATUS[selectedSpeaker.custom_fields?.booking?.onward_status || "pending"]?.label}
                        </Badge>
                        {/* Warning if booked but no travel details */}
                        {(selectedSpeaker.custom_fields?.booking?.onward_status === "booked" || selectedSpeaker.custom_fields?.booking?.onward_status === "confirmed") &&
                          !selectedSpeaker.custom_fields?.travel_details?.onward_from_city &&
                          !selectedSpeaker.custom_fields?.travel_details?.onward_date &&
                          !selectedSpeaker.custom_fields?.travel_details?.from_city && (
                          <span className="text-amber-500 text-xs" title="Status is booked but no travel details">⚠️</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Return</p>
                      <div className="flex items-center gap-1">
                        <Badge className={cn("text-white mt-1", BOOKING_STATUS[selectedSpeaker.custom_fields?.booking?.return_status || "pending"]?.color)}>
                          {BOOKING_STATUS[selectedSpeaker.custom_fields?.booking?.return_status || "pending"]?.label}
                        </Badge>
                        {/* Warning if booked but no travel details */}
                        {(selectedSpeaker.custom_fields?.booking?.return_status === "booked" || selectedSpeaker.custom_fields?.booking?.return_status === "confirmed") &&
                          !selectedSpeaker.custom_fields?.travel_details?.return_from_city &&
                          !selectedSpeaker.custom_fields?.travel_details?.return_date &&
                          !selectedSpeaker.custom_fields?.travel_details?.departure_date && (
                          <span className="text-amber-500 text-xs" title="Status is booked but no travel details">⚠️</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Button className="w-full" onClick={() => {
                  const token = selectedSpeaker.custom_fields?.portal_token
                  if (token) window.open(`/speaker/${token}`, "_blank")
                }}>
                  <ExternalLink className="h-4 w-4 mr-2" />View Full Details
                </Button>
              </div>
            </>
          )}
        </ResizableSheetContent>
      </Sheet>
    </div>
  )
}
