"use client"

import { useState, useMemo } from "react"
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
  Car,
  Loader2,
  CheckCircle,
  Clock,
  Phone,
  Calendar,
  Check,
  User,
  AlertCircle,
  MapPin,
  ArrowDown,
  ArrowUp,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Guest = {
  id: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  custom_fields: {
    photo_url?: string
    travel_details?: {
      mode?: string
      pickup_required?: boolean
      drop_required?: boolean
      onward_date?: string
      onward_to_city?: string
      return_date?: string
      return_from_city?: string
    }
    booking?: {
      onward_arrival_time?: string
      onward_to_city?: string
      return_departure_time?: string
      return_from_city?: string
      pickup_required?: boolean
      pickup_status?: string
      pickup_driver_name?: string
      pickup_driver_phone?: string
      pickup_vehicle?: string
      pickup_time?: string
      pickup_location?: string
      pickup_notes?: string
      drop_required?: boolean
      drop_status?: string
      drop_driver_name?: string
      drop_driver_phone?: string
      drop_vehicle?: string
      drop_time?: string
      drop_location?: string
      drop_notes?: string
    }
  } | null
}

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-amber-500" },
  arranged: { label: "Arranged", color: "bg-blue-500" },
  confirmed: { label: "Confirmed", color: "bg-green-500" },
  cancelled: { label: "Cancelled", color: "bg-red-500" },
}

export default function CabAgentPortal() {
  const params = useParams()
  const token = params.token as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"pickup" | "drop">("pickup")
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [editingType, setEditingType] = useState<"pickup" | "drop">("pickup")

  const [transferForm, setTransferForm] = useState({
    status: "pending",
    driver_name: "",
    driver_phone: "",
    vehicle: "",
    time: "",
    location: "",
    notes: "",
  })

  // Fetch data
  const { data: apiData, isLoading, error } = useQuery({
    queryKey: ["cab-agent-data", token],
    queryFn: async () => {
      const response = await fetch(`/api/travel-agent/speakers?event_id=${token}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      return result as { event: any; speakers: Guest[] }
    },
  })

  const event = apiData?.event
  const guests = apiData?.speakers

  // Filter by type
  const filteredGuests = useMemo(() => {
    if (!guests) return []
    return guests.filter((g) => {
      const booking = g.custom_fields?.booking || {}
      const travel = g.custom_fields?.travel_details || {}
      const matchesSearch = !search || g.attendee_name.toLowerCase().includes(search.toLowerCase())

      if (activeTab === "pickup") {
        return matchesSearch && (booking.pickup_required || travel.pickup_required)
      } else {
        return matchesSearch && (booking.drop_required || travel.drop_required)
      }
    })
  }, [guests, search, activeTab])

  // Stats
  const stats = useMemo(() => {
    if (!guests) return { pickup: { total: 0, pending: 0, arranged: 0 }, drop: { total: 0, pending: 0, arranged: 0 } }

    const pickupGuests = guests.filter(g => g.custom_fields?.booking?.pickup_required || g.custom_fields?.travel_details?.pickup_required)
    const dropGuests = guests.filter(g => g.custom_fields?.booking?.drop_required || g.custom_fields?.travel_details?.drop_required)

    return {
      pickup: {
        total: pickupGuests.length,
        pending: pickupGuests.filter(g => !g.custom_fields?.booking?.pickup_status || g.custom_fields?.booking?.pickup_status === "pending").length,
        arranged: pickupGuests.filter(g => ["arranged", "confirmed"].includes(g.custom_fields?.booking?.pickup_status || "")).length,
      },
      drop: {
        total: dropGuests.length,
        pending: dropGuests.filter(g => !g.custom_fields?.booking?.drop_status || g.custom_fields?.booking?.drop_status === "pending").length,
        arranged: dropGuests.filter(g => ["arranged", "confirmed"].includes(g.custom_fields?.booking?.drop_status || "")).length,
      },
    }
  }, [guests])

  // Update transfer
  const updateTransfer = useMutation({
    mutationFn: async ({ id, type, transfer }: { id: string; type: "pickup" | "drop"; transfer: typeof transferForm }) => {
      const bookingUpdate = {
        [`${type}_status`]: transfer.status,
        [`${type}_driver_name`]: transfer.driver_name,
        [`${type}_driver_phone`]: transfer.driver_phone,
        [`${type}_vehicle`]: transfer.vehicle,
        [`${type}_time`]: transfer.time,
        [`${type}_location`]: transfer.location,
        [`${type}_notes`]: transfer.notes,
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
      toast.success("Transfer updated")
      setEditingGuest(null)
      queryClient.invalidateQueries({ queryKey: ["cab-agent-data", token] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const openEditPanel = (guest: Guest, type: "pickup" | "drop") => {
    const booking = guest.custom_fields?.booking || {}

    setTransferForm({
      status: type === "pickup" ? (booking.pickup_status || "pending") : (booking.drop_status || "pending"),
      driver_name: type === "pickup" ? (booking.pickup_driver_name || "") : (booking.drop_driver_name || ""),
      driver_phone: type === "pickup" ? (booking.pickup_driver_phone || "") : (booking.drop_driver_phone || ""),
      vehicle: type === "pickup" ? (booking.pickup_vehicle || "") : (booking.drop_vehicle || ""),
      time: type === "pickup" ? (booking.pickup_time || "") : (booking.drop_time || ""),
      location: type === "pickup" ? (booking.pickup_location || "") : (booking.drop_location || ""),
      notes: type === "pickup" ? (booking.pickup_notes || "") : (booking.drop_notes || ""),
    })
    setEditingType(type)
    setEditingGuest(guest)
  }

  const formatDate = (d: string | undefined) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-"

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold">Invalid Link</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-green-600 to-green-700 text-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Car className="h-6 w-6" />
                <h1 className="text-xl font-bold">Cab/Transfer Agent Portal</h1>
              </div>
              <p className="text-sm text-green-100 mt-1">{event.name} • {event.city}</p>
            </div>
            <Badge className="bg-white/20 text-white border-0">
              <Calendar className="h-3.5 w-3.5 mr-1" />
              {formatDate(event.start_date)} - {formatDate(event.end_date)}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pickup" | "drop")}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="pickup" className="gap-2">
              <ArrowDown className="h-4 w-4" />
              Pickup ({stats.pickup.total})
            </TabsTrigger>
            <TabsTrigger value="drop" className="gap-2">
              <ArrowUp className="h-4 w-4" />
              Drop ({stats.drop.total})
            </TabsTrigger>
          </TabsList>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2"><Car className="h-5 w-5 text-green-500" /><span className="text-sm text-muted-foreground">Total</span></div>
              <p className="text-3xl font-bold mt-2">{activeTab === "pickup" ? stats.pickup.total : stats.drop.total}</p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-amber-500" /><span className="text-sm text-muted-foreground">Pending</span></div>
              <p className="text-3xl font-bold mt-2 text-amber-600">{activeTab === "pickup" ? stats.pickup.pending : stats.drop.pending}</p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /><span className="text-sm text-muted-foreground">Arranged</span></div>
              <p className="text-3xl font-bold mt-2 text-green-600">{activeTab === "pickup" ? stats.pickup.arranged : stats.drop.arranged}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md mt-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search guest..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>

          <TabsContent value="pickup" className="mt-4">
            <TransferTable guests={filteredGuests} type="pickup" onEdit={(g) => openEditPanel(g, "pickup")} formatDate={formatDate} />
          </TabsContent>

          <TabsContent value="drop" className="mt-4">
            <TransferTable guests={filteredGuests} type="drop" onEdit={(g) => openEditPanel(g, "drop")} formatDate={formatDate} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Sheet */}
      <Sheet open={!!editingGuest} onOpenChange={(open) => !open && setEditingGuest(null)}>
        <ResizableSheetContent defaultWidth={600} minWidth={450} maxWidth={900} storageKey="cab-agent-sheet-width" className="overflow-y-auto p-0">
          <div className={cn(
            "px-6 py-4 border-b",
            editingType === "pickup" ? "bg-gradient-to-r from-green-50 to-green-100/50" : "bg-gradient-to-r from-red-50 to-red-100/50"
          )}>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", editingType === "pickup" ? "bg-green-500" : "bg-red-500")}>
                  {editingType === "pickup" ? <ArrowDown className="h-5 w-5 text-white" /> : <ArrowUp className="h-5 w-5 text-white" />}
                </div>
                <div>
                  <p className="text-lg font-semibold">{editingGuest?.attendee_name}</p>
                  <p className="text-sm font-normal text-muted-foreground">{editingType === "pickup" ? "Airport Pickup" : "Airport Drop"}</p>
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>

          <div className="grid grid-cols-2 gap-0 divide-x">
            {/* LEFT: Guest Info */}
            <div className="p-5 bg-slate-50/50">
              <h3 className="font-semibold text-sm mb-4">Guest Details</h3>
              {editingGuest && (() => {
                const booking = editingGuest.custom_fields?.booking || {}
                const travel = editingGuest.custom_fields?.travel_details || {}
                const photoUrl = editingGuest.custom_fields?.photo_url

                const arrivalInfo = editingType === "pickup" ? {
                  location: booking.onward_to_city || travel.onward_to_city,
                  date: travel.onward_date,
                  time: booking.onward_arrival_time,
                } : {
                  location: booking.return_from_city || travel.return_from_city,
                  date: travel.return_date,
                  time: booking.return_departure_time,
                }

                return (
                  <div className="space-y-4">
                    {/* Photo & Contact */}
                    <div className="p-4 bg-white rounded-xl border shadow-sm">
                      <div className="flex items-start gap-3">
                        {photoUrl ? (
                          <img src={photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center border">
                            <User className="h-8 w-8 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">{editingGuest.attendee_name}</p>
                          {editingGuest.attendee_phone && (
                            <a href={`tel:${editingGuest.attendee_phone}`} className="flex items-center gap-1.5 text-sm text-green-600 hover:underline font-medium">
                              <Phone className="h-3.5 w-3.5" />{editingGuest.attendee_phone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Flight/Train Info */}
                    <div className="p-4 bg-white rounded-xl border shadow-sm">
                      <p className="text-xs text-muted-foreground mb-2">{editingType === "pickup" ? "Arrival" : "Departure"} Info</p>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-green-500" />
                        <span className="font-semibold">{arrivalInfo.location || "-"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Date:</span>
                          <span className="ml-1 font-medium">{formatDate(arrivalInfo.date)}</span>
                        </div>
                        {arrivalInfo.time && (
                          <div>
                            <span className="text-muted-foreground">Time:</span>
                            <span className="ml-1 font-mono font-medium">{arrivalInfo.time}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                      <p className="text-blue-700">
                        {editingType === "pickup"
                          ? "Guest arriving - arrange pickup from airport/station"
                          : "Guest departing - arrange drop to airport/station"
                        }
                      </p>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* RIGHT: Transfer Form */}
            <div className="p-5">
              <h3 className="font-semibold text-sm mb-4">Transfer Details</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <Label>Status</Label>
                  <Select value={transferForm.status} onValueChange={(v) => setTransferForm({ ...transferForm, status: v })}>
                    <SelectTrigger className="w-[130px] bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="arranged">Arranged</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div><Label className="text-xs">Driver Name</Label><Input value={transferForm.driver_name} onChange={(e) => setTransferForm({ ...transferForm, driver_name: e.target.value })} placeholder="Driver name" className="mt-1" /></div>

                <div><Label className="text-xs">Driver Phone</Label><Input value={transferForm.driver_phone} onChange={(e) => setTransferForm({ ...transferForm, driver_phone: e.target.value })} placeholder="+91 98765 43210" className="mt-1" /></div>

                <div><Label className="text-xs">Vehicle Details</Label><Input value={transferForm.vehicle} onChange={(e) => setTransferForm({ ...transferForm, vehicle: e.target.value })} placeholder="Innova - MH 01 AB 1234" className="mt-1" /></div>

                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">{editingType === "pickup" ? "Pickup" : "Drop"} Time</Label><Input value={transferForm.time} onChange={(e) => setTransferForm({ ...transferForm, time: e.target.value })} placeholder="08:30" className="mt-1 font-mono" /></div>
                  <div><Label className="text-xs">Location</Label><Input value={transferForm.location} onChange={(e) => setTransferForm({ ...transferForm, location: e.target.value })} placeholder="Terminal 2" className="mt-1" /></div>
                </div>

                <div><Label className="text-xs">Notes</Label><Textarea value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} placeholder="Additional instructions..." rows={3} className="mt-1" /></div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
            <Button variant="outline" onClick={() => setEditingGuest(null)}>Cancel</Button>
            <Button onClick={() => editingGuest && updateTransfer.mutate({ id: editingGuest.id, type: editingType, transfer: transferForm })} disabled={updateTransfer.isPending}>
              {updateTransfer.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </ResizableSheetContent>
      </Sheet>
    </div>
  )
}

// Table component
function TransferTable({ guests, type, onEdit, formatDate }: { guests: Guest[]; type: "pickup" | "drop"; onEdit: (g: Guest) => void; formatDate: (d: string | undefined) => string }) {
  if (guests.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-dashed">
        <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p>No {type} requests found</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className={type === "pickup" ? "bg-green-50" : "bg-red-50"}>
            <TableHead>Guest</TableHead>
            <TableHead>{type === "pickup" ? "Arrival" : "Departure"}</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {guests.map((guest) => {
            const booking = guest.custom_fields?.booking || {}
            const travel = guest.custom_fields?.travel_details || {}
            const status = type === "pickup" ? (booking.pickup_status || "pending") : (booking.drop_status || "pending")
            const driverName = type === "pickup" ? booking.pickup_driver_name : booking.drop_driver_name
            const location = type === "pickup"
              ? (booking.onward_to_city || travel.onward_to_city)
              : (booking.return_from_city || travel.return_from_city)
            const date = type === "pickup" ? travel.onward_date : travel.return_date

            return (
              <TableRow key={guest.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onEdit(guest)}>
                <TableCell>
                  <div>
                    <p className="font-medium">{guest.attendee_name}</p>
                    <p className="text-xs text-muted-foreground">{guest.attendee_phone}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-green-500" />
                    <span>{location || "-"}</span>
                  </div>
                </TableCell>
                <TableCell>{formatDate(date)}</TableCell>
                <TableCell>{driverName || <span className="text-muted-foreground">-</span>}</TableCell>
                <TableCell className="text-center">
                  <Badge className={cn("text-white text-xs", STATUS[status]?.color)}>{STATUS[status]?.label}</Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
