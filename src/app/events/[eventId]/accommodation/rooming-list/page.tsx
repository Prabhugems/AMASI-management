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
  ClipboardList,
  Loader2,
  Building2,
  Download,
  Search,
  Edit,
  Phone,
  BedDouble,
  User,
  Calendar,
  CheckCircle,
  Clock,
} from "lucide-react"
import { toast } from "sonner"

type Guest = {
  id: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  custom_fields: {
    assigned_hotel_id?: string
    travel_details?: {
      arrival_date?: string
      departure_date?: string
    }
    booking?: {
      hotel_status?: string
      hotel_name?: string
      hotel_room_number?: string
      hotel_room_type?: string
      hotel_checkin?: string
      hotel_checkout?: string
      sharing_with?: string
    }
  } | null
}

type HotelType = {
  id: string
  name: string
}

export default function RoomingListPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [hotelFilter, setHotelFilter] = useState<string>("all")
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [roomForm, setRoomForm] = useState({
    hotel_room_number: "",
    hotel_room_type: "standard",
    sharing_with: "",
  })

  // Fetch guests with hotel assignments
  const { data: guests, isLoading } = useQuery({
    queryKey: ["rooming-list-guests", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, attendee_phone, custom_fields")
        .eq("event_id", eventId)
        .order("attendee_name")

      // Only guests with hotel assignments
      return (data || []).filter((g: Guest) =>
        g.custom_fields?.assigned_hotel_id || g.custom_fields?.booking?.hotel_name
      ) as Guest[]
    },
  })

  // Fetch hotels
  const { data: hotels } = useQuery({
    queryKey: ["event-hotels", eventId],
    queryFn: async () => {
      const response = await fetch(`/api/hotels?event_id=${eventId}`)
      if (!response.ok) throw new Error("Failed to fetch hotels")
      return response.json() as Promise<HotelType[]>
    },
  })

  // Update room assignment
  const updateRoom = useMutation({
    mutationFn: async ({ id, room }: { id: string; room: typeof roomForm }) => {
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
              hotel_room_number: room.hotel_room_number,
              hotel_room_type: room.hotel_room_type,
              sharing_with: room.sharing_with,
            },
          },
        })
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Room assignment updated")
      setEditingGuest(null)
      queryClient.invalidateQueries({ queryKey: ["rooming-list-guests", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Filter guests
  const filteredGuests = useMemo(() => {
    if (!guests) return []

    return guests.filter((guest) => {
      const matchesSearch = !search ||
        guest.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
        guest.custom_fields?.booking?.hotel_room_number?.includes(search)

      const hotelId = guest.custom_fields?.assigned_hotel_id
      const matchesHotel = hotelFilter === "all" || hotelId === hotelFilter

      return matchesSearch && matchesHotel
    })
  }, [guests, search, hotelFilter])

  // Group by hotel
  const groupedByHotel = useMemo(() => {
    const groups: Record<string, { name: string; guests: Guest[] }> = {}

    filteredGuests.forEach((guest) => {
      const hotelId = guest.custom_fields?.assigned_hotel_id || "unassigned"
      const hotelName = guest.custom_fields?.booking?.hotel_name || "Unassigned"

      if (!groups[hotelId]) {
        groups[hotelId] = { name: hotelName, guests: [] }
      }
      groups[hotelId].guests.push(guest)
    })

    // Sort guests within each hotel by room number
    Object.values(groups).forEach((group) => {
      group.guests.sort((a, b) => {
        const roomA = a.custom_fields?.booking?.hotel_room_number || "ZZZ"
        const roomB = b.custom_fields?.booking?.hotel_room_number || "ZZZ"
        return roomA.localeCompare(roomB, undefined, { numeric: true })
      })
    })

    return groups
  }, [filteredGuests])

  const openEditRoom = (guest: Guest) => {
    setRoomForm({
      hotel_room_number: guest.custom_fields?.booking?.hotel_room_number || "",
      hotel_room_type: guest.custom_fields?.booking?.hotel_room_type || "standard",
      sharing_with: guest.custom_fields?.booking?.sharing_with || "",
    })
    setEditingGuest(guest)
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  }

  // Export rooming list
  const exportRoomingList = () => {
    const headers = ["Hotel", "Room", "Type", "Guest Name", "Phone", "Check-in", "Check-out", "Sharing With"]

    const rows: string[][] = []
    Object.entries(groupedByHotel).forEach(([, group]) => {
      group.guests.forEach((guest) => {
        rows.push([
          group.name,
          guest.custom_fields?.booking?.hotel_room_number || "",
          guest.custom_fields?.booking?.hotel_room_type || "",
          guest.attendee_name,
          guest.attendee_phone || "",
          guest.custom_fields?.booking?.hotel_checkin || guest.custom_fields?.travel_details?.arrival_date || "",
          guest.custom_fields?.booking?.hotel_checkout || guest.custom_fields?.travel_details?.departure_date || "",
          guest.custom_fields?.booking?.sharing_with || "",
        ])
      })
    })

    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `rooming-list-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Rooming list exported")
  }

  // Stats
  const stats = useMemo(() => {
    const withRoom = guests?.filter(g => g.custom_fields?.booking?.hotel_room_number) || []
    const withoutRoom = guests?.filter(g => !g.custom_fields?.booking?.hotel_room_number) || []
    return {
      total: guests?.length || 0,
      assigned: withRoom.length,
      pending: withoutRoom.length,
    }
  }, [guests])

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rooming List</h1>
          <p className="text-muted-foreground">Room-wise guest assignments</p>
        </div>
        <Button variant="outline" onClick={exportRoomingList} disabled={!guests?.length}>
          <Download className="h-4 w-4 mr-2" />
          Export Rooming List
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="text-sm">Total Guests</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Room Assigned</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-600">{stats.assigned}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Pending Room</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-amber-500">{stats.pending}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={hotelFilter} onValueChange={setHotelFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Hotels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Hotels</SelectItem>
            {hotels?.map((hotel) => (
              <SelectItem key={hotel.id} value={hotel.id}>{hotel.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rooming List by Hotel */}
      {!guests?.length ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No guests assigned to hotels</h3>
          <p className="text-muted-foreground">Assign guests to hotels first from the Guests page</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByHotel).map(([hotelId, group]) => (
            <div key={hotelId} className="bg-card rounded-lg border overflow-hidden">
              {/* Hotel Header */}
              <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">{group.name}</h3>
                  <Badge variant="secondary">{group.guests.length} guests</Badge>
                </div>
              </div>

              {/* Guests Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Room</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Sharing With</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.guests.map((guest) => (
                    <TableRow key={guest.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <BedDouble className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono font-medium">
                            {guest.custom_fields?.booking?.hotel_room_number || (
                              <span className="text-amber-500">-</span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{guest.attendee_name}</p>
                        <p className="text-xs text-muted-foreground">{guest.attendee_email}</p>
                      </TableCell>
                      <TableCell>
                        {guest.attendee_phone ? (
                          <span className="text-sm flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {guest.attendee_phone}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {guest.custom_fields?.booking?.hotel_room_type || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-green-500" />
                            {formatDate(guest.custom_fields?.booking?.hotel_checkin || guest.custom_fields?.travel_details?.arrival_date)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-red-500" />
                            {formatDate(guest.custom_fields?.booking?.hotel_checkout || guest.custom_fields?.travel_details?.departure_date)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {guest.custom_fields?.booking?.sharing_with || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRoom(guest)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      {/* Edit Room Dialog */}
      <Dialog open={!!editingGuest} onOpenChange={(open) => !open && setEditingGuest(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Room - {editingGuest?.attendee_name}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div>
              <Label>Room Number</Label>
              <Input
                value={roomForm.hotel_room_number}
                onChange={(e) => setRoomForm({ ...roomForm, hotel_room_number: e.target.value })}
                placeholder="301"
                className="font-mono"
              />
            </div>
            <div>
              <Label>Room Type</Label>
              <Select
                value={roomForm.hotel_room_type}
                onValueChange={(v) => setRoomForm({ ...roomForm, hotel_room_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="deluxe">Deluxe</SelectItem>
                  <SelectItem value="suite">Suite</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sharing With</Label>
              <Input
                value={roomForm.sharing_with}
                onChange={(e) => setRoomForm({ ...roomForm, sharing_with: e.target.value })}
                placeholder="Guest name if sharing room"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGuest(null)}>Cancel</Button>
            <Button
              onClick={() => editingGuest && updateRoom.mutate({ id: editingGuest.id, room: roomForm })}
              disabled={updateRoom.isPending}
            >
              {updateRoom.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
