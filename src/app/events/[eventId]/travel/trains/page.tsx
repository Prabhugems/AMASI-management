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
  Train,
  Loader2,
  CheckCircle,
  Clock,
  Check,
  Download,
  Search,
  Edit,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type TrainBooking = {
  id: string
  guest_id: string
  guest_name: string
  guest_email: string
  type: "onward" | "return"
  status: string
  pnr: string
  train_number: string
  train_name: string
  from_station: string
  to_station: string
  departure_date: string
  departure_time: string
  arrival_time: string
  coach: string
  seat: string
  cost: number
}

type Guest = {
  id: string
  attendee_name: string
  attendee_email: string
  custom_fields: {
    travel_details?: {
      mode?: string
      from_city?: string
    }
    train_bookings?: TrainBooking[]
  } | null
}

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-amber-500" },
  booked: { label: "Booked", color: "bg-blue-500" },
  confirmed: { label: "Confirmed", color: "bg-green-500" },
  waitlisted: { label: "Waitlisted", color: "bg-orange-500" },
  cancelled: { label: "Cancelled", color: "bg-red-500" },
}

export default function TrainsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [showAddBooking, setShowAddBooking] = useState(false)
  const [editingBooking, setEditingBooking] = useState<TrainBooking | null>(null)
  const [selectedGuestId, setSelectedGuestId] = useState("")

  const [trainForm, setTrainForm] = useState({
    type: "onward" as "onward" | "return",
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
    cost: 0,
  })

  // Fetch guests with train travel
  const { data: guests, isLoading } = useQuery({
    queryKey: ["train-guests", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, custom_fields")
        .eq("event_id", eventId)
        .order("attendee_name")

      return (data || []).filter((g: Guest) =>
        g.custom_fields?.travel_details?.mode === "train" ||
        g.custom_fields?.train_bookings?.length
      ) as Guest[]
    },
  })

  // All train bookings
  const trainBookings = useMemo(() => {
    if (!guests) return []
    const bookings: TrainBooking[] = []
    guests.forEach(g => {
      g.custom_fields?.train_bookings?.forEach(b => {
        bookings.push({ ...b, guest_id: g.id, guest_name: g.attendee_name, guest_email: g.attendee_email })
      })
    })
    return bookings
  }, [guests])

  // Save train booking
  const saveBooking = useMutation({
    mutationFn: async ({ guestId, booking, isNew }: { guestId: string; booking: typeof trainForm; isNew: boolean }) => {
      const { data: current } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", guestId)
        .single()

      let bookings = current?.custom_fields?.train_bookings || []

      if (isNew) {
        bookings = [...bookings, { ...booking, id: crypto.randomUUID() }]
      } else if (editingBooking) {
        bookings = bookings.map((b: TrainBooking) => b.id === editingBooking.id ? { ...b, ...booking } : b)
      }

      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(current?.custom_fields || {}),
            train_bookings: bookings,
          },
        })
        .eq("id", guestId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success(editingBooking ? "Booking updated" : "Booking added")
      setShowAddBooking(false)
      setEditingBooking(null)
      setSelectedGuestId("")
      queryClient.invalidateQueries({ queryKey: ["train-guests", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const openEditBooking = (booking: TrainBooking) => {
    setTrainForm({
      type: booking.type,
      status: booking.status,
      pnr: booking.pnr,
      train_number: booking.train_number,
      train_name: booking.train_name,
      from_station: booking.from_station,
      to_station: booking.to_station,
      departure_date: booking.departure_date,
      departure_time: booking.departure_time,
      arrival_time: booking.arrival_time,
      coach: booking.coach,
      seat: booking.seat,
      cost: booking.cost,
    })
    setSelectedGuestId(booking.guest_id)
    setEditingBooking(booking)
  }

  const filteredBookings = trainBookings.filter(b =>
    b.guest_name.toLowerCase().includes(search.toLowerCase()) ||
    b.pnr?.includes(search) ||
    b.train_number?.includes(search)
  )

  // Stats
  const stats = useMemo(() => {
    return {
      total: trainBookings.length,
      pending: trainBookings.filter(b => b.status === "pending").length,
      confirmed: trainBookings.filter(b => b.status === "confirmed").length,
      waitlisted: trainBookings.filter(b => b.status === "waitlisted").length,
      totalCost: trainBookings.reduce((sum, b) => sum + (b.cost || 0), 0),
    }
  }, [trainBookings])

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  }

  const exportTrains = () => {
    const headers = ["Guest", "Type", "Status", "PNR", "Train", "From", "To", "Date", "Departure", "Coach/Seat", "Cost"]
    const rows = filteredBookings.map(b => [
      b.guest_name, b.type, b.status, b.pnr, `${b.train_number} ${b.train_name}`,
      b.from_station, b.to_station, b.departure_date, b.departure_time, `${b.coach}/${b.seat}`, String(b.cost || 0)
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `trains-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Train bookings exported")
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trains</h1>
          <p className="text-muted-foreground">Manage train bookings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportTrains}><Download className="h-4 w-4 mr-2" />Export</Button>
          <Button onClick={() => { setShowAddBooking(true); setTrainForm({ type: "onward", status: "pending", pnr: "", train_number: "", train_name: "", from_station: "", to_station: "", departure_date: "", departure_time: "", arrival_time: "", coach: "", seat: "", cost: 0 }) }}>
            <Plus className="h-4 w-4 mr-2" />Add Booking
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><Train className="h-4 w-4" /><span className="text-sm">Total</span></div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-500"><Clock className="h-4 w-4" /><span className="text-sm">Pending</span></div>
          <p className="text-2xl font-bold mt-1">{stats.pending}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600"><Check className="h-4 w-4" /><span className="text-sm">Confirmed</span></div>
          <p className="text-2xl font-bold mt-1">{stats.confirmed}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-orange-500"><Clock className="h-4 w-4" /><span className="text-sm">Waitlisted</span></div>
          <p className="text-2xl font-bold mt-1">{stats.waitlisted}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><span className="text-sm">Total Cost</span></div>
          <p className="text-xl font-bold mt-1">₹{stats.totalCost.toLocaleString()}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, PNR, train..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Table */}
      {filteredBookings.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Train className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No train bookings</h3>
          <p className="text-muted-foreground">Add train bookings for guests traveling by train</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Guest</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Train</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>PNR</TableHead>
                <TableHead>Seat</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBookings.map((booking) => (
                <TableRow key={booking.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEditBooking(booking)}>
                  <TableCell><p className="font-medium">{booking.guest_name}</p></TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{booking.type}</Badge></TableCell>
                  <TableCell>
                    <p className="font-mono text-sm">{booking.train_number}</p>
                    <p className="text-xs text-muted-foreground">{booking.train_name}</p>
                  </TableCell>
                  <TableCell><span className="text-sm">{booking.from_station} → {booking.to_station}</span></TableCell>
                  <TableCell>{formatDate(booking.departure_date)}</TableCell>
                  <TableCell><span className="text-sm">{booking.departure_time || "-"}</span></TableCell>
                  <TableCell><span className="font-mono text-sm">{booking.pnr || "-"}</span></TableCell>
                  <TableCell><span className="text-sm">{booking.coach}/{booking.seat || "-"}</span></TableCell>
                  <TableCell>
                    <Badge className={cn("text-white text-xs", BOOKING_STATUS[booking.status]?.color || "bg-gray-500")}>
                      {BOOKING_STATUS[booking.status]?.label || booking.status}
                    </Badge>
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Sheet - Side by Side */}
      <Sheet open={showAddBooking || !!editingBooking} onOpenChange={(open) => { if (!open) { setShowAddBooking(false); setEditingBooking(null) } }}>
        <ResizableSheetContent defaultWidth={550} minWidth={400} maxWidth={900} storageKey="trains-sheet-width" className="overflow-y-auto p-0">
          {/* Header with gradient */}
          <div className="px-6 py-4 border-b bg-gradient-to-r from-orange-50 to-orange-100/50">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500">
                  <Train className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-lg font-semibold">{editingBooking ? "Edit" : "Add"} Train Booking</p>
                  {editingBooking && <p className="text-sm font-normal text-muted-foreground">{editingBooking.guest_name}</p>}
                </div>
              </SheetTitle>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-5">
            {!editingBooking && (
              <div>
                <Label className="text-xs text-muted-foreground">Guest</Label>
                <Select value={selectedGuestId} onValueChange={setSelectedGuestId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select guest" /></SelectTrigger>
                  <SelectContent>
                    {guests?.map(g => <SelectItem key={g.id} value={g.id}>{g.attendee_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Label className="font-medium">Type</Label>
                <Select value={trainForm.type} onValueChange={(v: any) => setTrainForm({ ...trainForm, type: v })}>
                  <SelectTrigger className="w-[120px] bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onward">🚂 Onward</SelectItem>
                    <SelectItem value="return">🚃 Return</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Label className="font-medium">Status</Label>
                <Select value={trainForm.status} onValueChange={(v) => setTrainForm({ ...trainForm, status: v })}>
                  <SelectTrigger className="w-[130px] bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">⏳ Pending</SelectItem>
                    <SelectItem value="booked">📋 Booked</SelectItem>
                    <SelectItem value="confirmed">✅ Confirmed</SelectItem>
                    <SelectItem value="waitlisted">⏱️ Waitlisted</SelectItem>
                    <SelectItem value="cancelled">❌ Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Train Number</Label>
                <Input value={trainForm.train_number} onChange={(e) => setTrainForm({ ...trainForm, train_number: e.target.value })} placeholder="12309" className="mt-1.5 font-mono" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Train Name</Label>
                <Input value={trainForm.train_name} onChange={(e) => setTrainForm({ ...trainForm, train_name: e.target.value })} placeholder="Rajdhani Express" className="mt-1.5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">From Station</Label>
                <Input value={trainForm.from_station} onChange={(e) => setTrainForm({ ...trainForm, from_station: e.target.value })} placeholder="NDLS" className="mt-1.5 font-mono uppercase" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">To Station</Label>
                <Input value={trainForm.to_station} onChange={(e) => setTrainForm({ ...trainForm, to_station: e.target.value })} placeholder="PNBE" className="mt-1.5 font-mono uppercase" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input type="date" value={trainForm.departure_date} onChange={(e) => setTrainForm({ ...trainForm, departure_date: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Departure</Label>
                <Input
                  value={trainForm.departure_time}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9:]/g, '')
                    if (val.length <= 5) setTrainForm({ ...trainForm, departure_time: val })
                  }}
                  placeholder="08:30"
                  maxLength={5}
                  className="mt-1.5 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Arrival</Label>
                <Input
                  value={trainForm.arrival_time}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9:]/g, '')
                    if (val.length <= 5) setTrainForm({ ...trainForm, arrival_time: val })
                  }}
                  placeholder="14:45"
                  maxLength={5}
                  className="mt-1.5 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">PNR</Label>
                <Input value={trainForm.pnr} onChange={(e) => setTrainForm({ ...trainForm, pnr: e.target.value })} placeholder="1234567890" className="font-mono mt-1.5 uppercase" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Coach/Seat</Label>
                <Input value={`${trainForm.coach}/${trainForm.seat}`} onChange={(e) => { const [c, s] = e.target.value.split("/"); setTrainForm({ ...trainForm, coach: c || "", seat: s || "" }) }} placeholder="A1/23" className="mt-1.5 font-mono" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Cost (₹)</Label>
                <Input type="number" value={trainForm.cost || ""} onChange={(e) => setTrainForm({ ...trainForm, cost: parseFloat(e.target.value) || 0 })} className="mt-1.5" />
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
            <Button variant="outline" onClick={() => { setShowAddBooking(false); setEditingBooking(null) }}>Cancel</Button>
            <Button
              onClick={() => {
                const guestId = editingBooking?.guest_id || selectedGuestId
                if (!guestId) { toast.error("Select a guest"); return }
                saveBooking.mutate({ guestId, booking: trainForm, isNew: !editingBooking })
              }}
              disabled={saveBooking.isPending}
              className="min-w-[120px]"
            >
              {saveBooking.isPending ? (
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
