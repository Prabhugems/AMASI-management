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
  Train,
  Loader2,
  CheckCircle,
  Clock,
  Phone,
  Calendar,
  Check,
  User,
  AlertCircle,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Speaker = {
  id: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  custom_fields: {
    photo_url?: string
    travel_details?: {
      mode?: string
      train_from_station?: string
      train_to_station?: string
      train_date?: string
      train_preferred?: string
      train_class?: string
    }
    train_bookings?: Array<{
      status?: string
      pnr?: string
      train_number?: string
      train_name?: string
      from_station?: string
      to_station?: string
      departure_date?: string
      departure_time?: string
      arrival_time?: string
      coach?: string
      seat?: string
      class?: string
      cost?: number
    }>
  } | null
}

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-amber-500" },
  booked: { label: "Booked", color: "bg-blue-500" },
  confirmed: { label: "Confirmed", color: "bg-green-500" },
  cancelled: { label: "Cancelled", color: "bg-red-500" },
}

export default function TrainAgentPortal() {
  const params = useParams()
  const token = params.token as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "booked">("all")
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null)

  // AI Extraction
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [_extractionResult, setExtractionResult] = useState<any>(null)

  const [trainForm, setTrainForm] = useState({
    status: "pending",
    pnr: "",
    train_number: "",
    train_name: "",
    from_station: "",
    to_station: "",
    departure_date: "",
    departure_time: "",
    arrival_time: "",
    coach: "",
    seat: "",
    class: "",
    cost: 0,
  })

  // Fetch data
  const { data: apiData, isLoading, error } = useQuery({
    queryKey: ["train-agent-data", token],
    queryFn: async () => {
      const response = await fetch(`/api/travel-agent/speakers?event_id=${token}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      return result as { event: any; speakers: Speaker[] }
    },
  })

  const event = apiData?.event
  const speakers = apiData?.speakers?.filter(s => s.custom_fields?.travel_details?.mode === "train")

  const filteredSpeakers = useMemo(() => {
    if (!speakers) return []
    return speakers.filter((s) => {
      const matchesSearch = !search || s.attendee_name.toLowerCase().includes(search.toLowerCase())
      const status = s.custom_fields?.train_bookings?.[0]?.status || "pending"
      const matchesStatus = statusFilter === "all" || status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [speakers, search, statusFilter])

  const stats = useMemo(() => {
    if (!speakers) return { total: 0, pending: 0, booked: 0 }
    return {
      total: speakers.length,
      pending: speakers.filter(s => (s.custom_fields?.train_bookings?.[0]?.status || "pending") === "pending").length,
      booked: speakers.filter(s => ["booked", "confirmed"].includes(s.custom_fields?.train_bookings?.[0]?.status || "")).length,
    }
  }, [speakers])

  // AI Extraction
  const handleTicketUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editingSpeaker) return

    setIsExtracting(true)
    setExtractionResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("ticket_type", "train")

      const response = await fetch("/api/travel/extract-ticket", { method: "POST", body: formData })
      const result = await response.json()

      if (result.success && result.train_details) {
        const d = result.train_details
        setTrainForm(prev => ({
          ...prev,
          pnr: d.pnr || prev.pnr,
          train_number: d.train_number || prev.train_number,
          train_name: d.train_name || prev.train_name,
          from_station: d.departure_station || prev.from_station,
          to_station: d.arrival_station || prev.to_station,
          departure_date: d.departure_date || prev.departure_date,
          departure_time: d.departure_time || prev.departure_time,
          arrival_time: d.arrival_time || prev.arrival_time,
          coach: d.coach || prev.coach,
          seat: d.seat_number || prev.seat,
          class: d.class || prev.class,
          status: d.pnr ? "booked" : prev.status,
        }))
        setExtractionResult({ success: true, confidence: result.confidence })
        toast.success(`Ticket extracted! (${result.confidence}% confidence)`)
      } else {
        toast.error(result.error || "Could not extract ticket")
      }
    } catch {
      toast.error("Failed to extract ticket")
    } finally {
      setIsExtracting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [editingSpeaker])

  // Update booking
  const updateBooking = useMutation({
    mutationFn: async ({ id, train }: { id: string; train: typeof trainForm }) => {
      const response = await fetch("/api/travel-agent/update-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: id,
          event_id: event?.id,
          booking: { train_bookings: [train] },
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      toast.success("Train booking updated")
      setEditingSpeaker(null)
      queryClient.invalidateQueries({ queryKey: ["train-agent-data", token] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const openEditPanel = (speaker: Speaker) => {
    const train = speaker.custom_fields?.train_bookings?.[0] || {}
    const travel = speaker.custom_fields?.travel_details || {}
    setExtractionResult(null)
    setTrainForm({
      status: train.status || "pending",
      pnr: train.pnr || "",
      train_number: train.train_number || travel.train_preferred || "",
      train_name: train.train_name || "",
      from_station: train.from_station || travel.train_from_station || "",
      to_station: train.to_station || travel.train_to_station || "",
      departure_date: train.departure_date || travel.train_date || "",
      departure_time: train.departure_time || "",
      arrival_time: train.arrival_time || "",
      coach: train.coach || "",
      seat: train.seat || "",
      class: train.class || travel.train_class || "",
      cost: train.cost || 0,
    })
    setEditingSpeaker(speaker)
  }

  const formatDate = (d: string | undefined) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-"

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
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
      <header className="bg-gradient-to-r from-orange-600 to-orange-700 text-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Train className="h-6 w-6" />
                <h1 className="text-xl font-bold">Train Agent Portal</h1>
              </div>
              <p className="text-sm text-orange-100 mt-1">{event.name} • {event.city}</p>
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
          <button onClick={() => setStatusFilter("all")} className={cn("bg-white rounded-lg border p-4 text-left hover:shadow-md", statusFilter === "all" && "ring-2 ring-orange-500")}>
            <div className="flex items-center gap-2"><Train className="h-5 w-5 text-orange-500" /><span className="text-sm text-muted-foreground">Total</span></div>
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
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Table */}
        {filteredSpeakers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed">
            <Train className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p>No train travelers found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-orange-50">
                  <TableHead>Passenger</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Preferred Train</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSpeakers.map((speaker) => {
                  const travel = speaker.custom_fields?.travel_details || {}
                  const booking = speaker.custom_fields?.train_bookings?.[0] || {}
                  const status = booking.status || "pending"

                  return (
                    <TableRow key={speaker.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openEditPanel(speaker)}>
                      <TableCell>
                        <p className="font-medium">{speaker.attendee_name}</p>
                        <p className="text-xs text-muted-foreground">{speaker.attendee_phone}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Train className="h-3.5 w-3.5 text-orange-500" />
                          {travel.train_from_station || "-"} → {travel.train_to_station || "-"}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(travel.train_date)}</TableCell>
                      <TableCell><span className="font-mono text-sm">{travel.train_preferred || "-"}</span></TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("text-white text-xs", BOOKING_STATUS[status]?.color)}>{BOOKING_STATUS[status]?.label}</Badge>
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
        <ResizableSheetContent defaultWidth={650} minWidth={450} maxWidth={950} storageKey="train-agent-sheet-width" className="overflow-y-auto p-0">
          <div className="px-6 py-4 border-b bg-gradient-to-r from-orange-50 to-orange-100/50">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500"><Train className="h-5 w-5 text-white" /></div>
                <div>
                  <p className="text-lg font-semibold">{editingSpeaker?.attendee_name}</p>
                  <p className="text-sm font-normal text-muted-foreground">Train Booking</p>
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>

          <div className="grid grid-cols-2 gap-0 divide-x">
            {/* LEFT: Request */}
            <div className="p-5 bg-slate-50/50">
              <h3 className="font-semibold text-sm mb-4">Passenger Request</h3>
              {editingSpeaker && (() => {
                const travel = editingSpeaker.custom_fields?.travel_details
                const photoUrl = editingSpeaker.custom_fields?.photo_url
                return (
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-xl border shadow-sm">
                      <div className="flex items-start gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {photoUrl ? <img src={photoUrl} alt="" className="w-14 h-14 rounded-lg object-cover border" /> : <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center border"><User className="h-6 w-6 text-slate-400" /></div>}
                        <div>
                          <p className="font-semibold">{editingSpeaker.attendee_name}</p>
                          {editingSpeaker.attendee_phone && <a href={`tel:${editingSpeaker.attendee_phone}`} className="text-sm text-orange-600"><Phone className="h-3 w-3 inline mr-1" />{editingSpeaker.attendee_phone}</a>}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-white rounded-xl border shadow-sm">
                      <p className="text-xs text-muted-foreground mb-1">Route</p>
                      <p className="font-semibold">{travel?.train_from_station || "-"} → {travel?.train_to_station || "-"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-white rounded-xl border shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Date</p>
                        <p className="font-medium">{formatDate(travel?.train_date)}</p>
                      </div>
                      <div className="p-4 bg-white rounded-xl border shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Class</p>
                        <p className="font-medium">{travel?.train_class || "-"}</p>
                      </div>
                    </div>
                    {travel?.train_preferred && (
                      <div className="p-4 bg-white rounded-xl border shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Preferred Train</p>
                        <p className="font-mono font-semibold">{travel.train_preferred}</p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* RIGHT: Booking Form */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">Booking Details</h3>
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleTicketUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => fileInputRef.current?.click()} disabled={isExtracting}>
                    {isExtracting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-purple-500" />}
                    AI Scan
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <Label>Status</Label>
                  <Select value={trainForm.status} onValueChange={(v) => setTrainForm({ ...trainForm, status: v })}>
                    <SelectTrigger className="w-[130px] bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="booked">Booked</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Train No</Label><Input value={trainForm.train_number} onChange={(e) => setTrainForm({ ...trainForm, train_number: e.target.value })} className="mt-1 font-mono" /></div>
                  <div><Label className="text-xs">Train Name</Label><Input value={trainForm.train_name} onChange={(e) => setTrainForm({ ...trainForm, train_name: e.target.value })} className="mt-1" /></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">From</Label><Input value={trainForm.from_station} onChange={(e) => setTrainForm({ ...trainForm, from_station: e.target.value })} className="mt-1" /></div>
                  <div><Label className="text-xs">To</Label><Input value={trainForm.to_station} onChange={(e) => setTrainForm({ ...trainForm, to_station: e.target.value })} className="mt-1" /></div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Date</Label><Input type="date" value={trainForm.departure_date} onChange={(e) => setTrainForm({ ...trainForm, departure_date: e.target.value })} className="mt-1" /></div>
                  <div><Label className="text-xs">Departure</Label><Input value={trainForm.departure_time} onChange={(e) => setTrainForm({ ...trainForm, departure_time: e.target.value })} placeholder="08:30" className="mt-1 font-mono" /></div>
                  <div><Label className="text-xs">Arrival</Label><Input value={trainForm.arrival_time} onChange={(e) => setTrainForm({ ...trainForm, arrival_time: e.target.value })} placeholder="14:45" className="mt-1 font-mono" /></div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">PNR</Label><Input value={trainForm.pnr} onChange={(e) => setTrainForm({ ...trainForm, pnr: e.target.value.toUpperCase() })} className="mt-1 font-mono" /></div>
                  <div><Label className="text-xs">Coach</Label><Input value={trainForm.coach} onChange={(e) => setTrainForm({ ...trainForm, coach: e.target.value.toUpperCase() })} className="mt-1" /></div>
                  <div><Label className="text-xs">Seat</Label><Input value={trainForm.seat} onChange={(e) => setTrainForm({ ...trainForm, seat: e.target.value })} className="mt-1" /></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Class</Label><Input value={trainForm.class} onChange={(e) => setTrainForm({ ...trainForm, class: e.target.value })} placeholder="3AC, 2AC, SL" className="mt-1" /></div>
                  <div><Label className="text-xs">Cost (₹)</Label><Input type="number" value={trainForm.cost || ""} onChange={(e) => setTrainForm({ ...trainForm, cost: parseFloat(e.target.value) || 0 })} className="mt-1" /></div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
            <Button variant="outline" onClick={() => setEditingSpeaker(null)}>Cancel</Button>
            <Button onClick={() => editingSpeaker && updateBooking.mutate({ id: editingSpeaker.id, train: trainForm })} disabled={updateBooking.isPending}>
              {updateBooking.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </ResizableSheetContent>
      </Sheet>
    </div>
  )
}
