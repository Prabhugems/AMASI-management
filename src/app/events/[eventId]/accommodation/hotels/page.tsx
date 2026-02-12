"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Building2,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Loader2,
  Users,
  BedDouble,
  Search,
} from "lucide-react"
import { toast } from "sonner"

type HotelType = {
  id: string
  event_id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  contact_person: string | null
  total_rooms: number
  standard_rooms: number
  deluxe_rooms: number
  suite_rooms: number
  standard_rate: number
  deluxe_rate: number
  suite_rate: number
  check_in_time: string
  check_out_time: string
  notes: string | null
  assigned_rooms: number
  available_rooms: number
}

const initialForm = {
  name: "",
  address: "",
  phone: "",
  email: "",
  contact_person: "",
  total_rooms: 0,
  standard_rooms: 0,
  deluxe_rooms: 0,
  suite_rooms: 0,
  standard_rate: 0,
  deluxe_rate: 0,
  suite_rate: 0,
  check_in_time: "14:00",
  check_out_time: "12:00",
  notes: "",
}

export default function HotelsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [showAddHotel, setShowAddHotel] = useState(false)
  const [editingHotel, setEditingHotel] = useState<HotelType | null>(null)
  const [hotelForm, setHotelForm] = useState(initialForm)

  // Fetch hotels
  const { data: hotels, isLoading } = useQuery({
    queryKey: ["event-hotels", eventId],
    queryFn: async () => {
      const response = await fetch(`/api/hotels?event_id=${eventId}`)
      if (!response.ok) throw new Error("Failed to fetch hotels")
      return response.json() as Promise<HotelType[]>
    },
  })

  // Add hotel
  const addHotel = useMutation({
    mutationFn: async (hotel: typeof hotelForm) => {
      const response = await fetch("/api/hotels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...hotel, event_id: eventId }),
      })
      if (!response.ok) throw new Error("Failed to add hotel")
      return response.json()
    },
    onSuccess: () => {
      toast.success("Hotel added successfully")
      setShowAddHotel(false)
      setHotelForm(initialForm)
      queryClient.invalidateQueries({ queryKey: ["event-hotels", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Update hotel
  const updateHotel = useMutation({
    mutationFn: async (hotel: Partial<HotelType>) => {
      const response = await fetch("/api/hotels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hotel),
      })
      if (!response.ok) throw new Error("Failed to update hotel")
      return response.json()
    },
    onSuccess: () => {
      toast.success("Hotel updated successfully")
      setEditingHotel(null)
      setHotelForm(initialForm)
      queryClient.invalidateQueries({ queryKey: ["event-hotels", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Delete hotel
  const deleteHotel = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/hotels?id=${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete hotel")
      return response.json()
    },
    onSuccess: () => {
      toast.success("Hotel removed")
      queryClient.invalidateQueries({ queryKey: ["event-hotels", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const openEditHotel = (hotel: HotelType) => {
    setHotelForm({
      name: hotel.name,
      address: hotel.address || "",
      phone: hotel.phone || "",
      email: hotel.email || "",
      contact_person: hotel.contact_person || "",
      total_rooms: hotel.total_rooms,
      standard_rooms: hotel.standard_rooms,
      deluxe_rooms: hotel.deluxe_rooms,
      suite_rooms: hotel.suite_rooms,
      standard_rate: hotel.standard_rate,
      deluxe_rate: hotel.deluxe_rate,
      suite_rate: hotel.suite_rate,
      check_in_time: hotel.check_in_time || "14:00",
      check_out_time: hotel.check_out_time || "12:00",
      notes: hotel.notes || "",
    })
    setEditingHotel(hotel)
  }

  const filteredHotels = hotels?.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.address?.toLowerCase().includes(search.toLowerCase())
  ) || []

  // Stats
  const totalRooms = hotels?.reduce((sum, h) => sum + h.total_rooms, 0) || 0
  const assignedRooms = hotels?.reduce((sum, h) => sum + h.assigned_rooms, 0) || 0
  const availableRooms = totalRooms - assignedRooms

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
          <h1 className="text-xl sm:text-2xl font-bold">Hotels</h1>
          <p className="text-muted-foreground">Manage hotel inventory for this event</p>
        </div>
        <Button onClick={() => setShowAddHotel(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Hotel
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="text-sm">Hotels</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{hotels?.length || 0}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BedDouble className="h-4 w-4" />
            <span className="text-sm">Total Rooms</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{totalRooms}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <BedDouble className="h-4 w-4" />
            <span className="text-sm">Available</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1 text-green-600">{availableRooms}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-600">
            <Users className="h-4 w-4" />
            <span className="text-sm">Assigned</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1 text-blue-600">{assignedRooms}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search hotels..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Hotel Cards */}
      {!filteredHotels.length ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No hotels configured</h3>
          <p className="text-muted-foreground mb-4">Add hotels to manage room inventory</p>
          <Button onClick={() => setShowAddHotel(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Hotel
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHotels.map((hotel) => (
            <div key={hotel.id} className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{hotel.name}</h3>
                  {hotel.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{hotel.address}</span>
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditHotel(hotel)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Hotel
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => {
                        if (confirm("Remove this hotel?")) deleteHotel.mutate(hotel.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Hotel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Room Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold">{hotel.total_rooms}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-600">{hotel.available_rooms}</p>
                  <p className="text-[10px] text-muted-foreground">Available</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-blue-600">{hotel.assigned_rooms}</p>
                  <p className="text-[10px] text-muted-foreground">Assigned</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${hotel.total_rooms > 0 ? (hotel.assigned_rooms / hotel.total_rooms) * 100 : 0}%` }}
                />
              </div>

              {/* Contact */}
              <div className="space-y-1 text-xs text-muted-foreground">
                {hotel.contact_person && <p>Contact: {hotel.contact_person}</p>}
                {hotel.phone && (
                  <p className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {hotel.phone}
                  </p>
                )}
                {hotel.email && (
                  <p className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {hotel.email}
                  </p>
                )}
              </div>

              {/* Rates */}
              {(hotel.standard_rate > 0 || hotel.deluxe_rate > 0 || hotel.suite_rate > 0) && (
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex flex-wrap gap-2">
                  {hotel.standard_rate > 0 && <span>Std: ₹{hotel.standard_rate}</span>}
                  {hotel.deluxe_rate > 0 && <span>Dlx: ₹{hotel.deluxe_rate}</span>}
                  {hotel.suite_rate > 0 && <span>Suite: ₹{hotel.suite_rate}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Hotel Dialog */}
      <Dialog open={showAddHotel || !!editingHotel} onOpenChange={(open) => {
        if (!open) { setShowAddHotel(false); setEditingHotel(null); setHotelForm(initialForm) }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingHotel ? "Edit Hotel" : "Add New Hotel"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Hotel Name *</Label>
                <Input
                  value={hotelForm.name}
                  onChange={(e) => setHotelForm({ ...hotelForm, name: e.target.value })}
                  placeholder="Hotel Maurya"
                />
              </div>
              <div className="col-span-2">
                <Label>Address</Label>
                <Input
                  value={hotelForm.address}
                  onChange={(e) => setHotelForm({ ...hotelForm, address: e.target.value })}
                  placeholder="Full address"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={hotelForm.phone}
                  onChange={(e) => setHotelForm({ ...hotelForm, phone: e.target.value })}
                  placeholder="+91 612-1234567"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={hotelForm.email}
                  onChange={(e) => setHotelForm({ ...hotelForm, email: e.target.value })}
                  placeholder="reservations@hotel.com"
                />
              </div>
              <div className="col-span-2">
                <Label>Contact Person</Label>
                <Input
                  value={hotelForm.contact_person}
                  onChange={(e) => setHotelForm({ ...hotelForm, contact_person: e.target.value })}
                  placeholder="Manager name"
                />
              </div>
            </div>

            {/* Room Inventory */}
            <div className="border-t pt-4 mt-2">
              <h4 className="font-medium mb-3">Room Inventory</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <Label>Total Rooms</Label>
                  <Input
                    type="number"
                    value={hotelForm.total_rooms || ""}
                    onChange={(e) => setHotelForm({ ...hotelForm, total_rooms: parseInt(e.target.value) || 0 })}
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label>Standard</Label>
                  <Input
                    type="number"
                    value={hotelForm.standard_rooms || ""}
                    onChange={(e) => setHotelForm({ ...hotelForm, standard_rooms: parseInt(e.target.value) || 0 })}
                    placeholder="60"
                  />
                </div>
                <div>
                  <Label>Deluxe</Label>
                  <Input
                    type="number"
                    value={hotelForm.deluxe_rooms || ""}
                    onChange={(e) => setHotelForm({ ...hotelForm, deluxe_rooms: parseInt(e.target.value) || 0 })}
                    placeholder="30"
                  />
                </div>
                <div>
                  <Label>Suite</Label>
                  <Input
                    type="number"
                    value={hotelForm.suite_rooms || ""}
                    onChange={(e) => setHotelForm({ ...hotelForm, suite_rooms: parseInt(e.target.value) || 0 })}
                    placeholder="10"
                  />
                </div>
              </div>
            </div>

            {/* Rates */}
            <div className="border-t pt-4 mt-2">
              <h4 className="font-medium mb-3">Room Rates (₹/night)</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Standard Rate</Label>
                  <Input
                    type="number"
                    value={hotelForm.standard_rate || ""}
                    onChange={(e) => setHotelForm({ ...hotelForm, standard_rate: parseFloat(e.target.value) || 0 })}
                    placeholder="3500"
                  />
                </div>
                <div>
                  <Label>Deluxe Rate</Label>
                  <Input
                    type="number"
                    value={hotelForm.deluxe_rate || ""}
                    onChange={(e) => setHotelForm({ ...hotelForm, deluxe_rate: parseFloat(e.target.value) || 0 })}
                    placeholder="5000"
                  />
                </div>
                <div>
                  <Label>Suite Rate</Label>
                  <Input
                    type="number"
                    value={hotelForm.suite_rate || ""}
                    onChange={(e) => setHotelForm({ ...hotelForm, suite_rate: parseFloat(e.target.value) || 0 })}
                    placeholder="8000"
                  />
                </div>
              </div>
            </div>

            {/* Check-in/out Times */}
            <div className="border-t pt-4 mt-2">
              <h4 className="font-medium mb-3">Timings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Check-in Time</Label>
                  <Input
                    type="time"
                    value={hotelForm.check_in_time}
                    onChange={(e) => setHotelForm({ ...hotelForm, check_in_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Check-out Time</Label>
                  <Input
                    type="time"
                    value={hotelForm.check_out_time}
                    onChange={(e) => setHotelForm({ ...hotelForm, check_out_time: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes</Label>
              <Textarea
                value={hotelForm.notes}
                onChange={(e) => setHotelForm({ ...hotelForm, notes: e.target.value })}
                placeholder="Special instructions, booking contacts, etc."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddHotel(false); setEditingHotel(null) }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!hotelForm.name) { toast.error("Hotel name is required"); return }
                if (editingHotel) {
                  updateHotel.mutate({ id: editingHotel.id, ...hotelForm })
                } else {
                  addHotel.mutate(hotelForm)
                }
              }}
              disabled={addHotel.isPending || updateHotel.isPending}
            >
              {(addHotel.isPending || updateHotel.isPending) ? "Saving..." : editingHotel ? "Update" : "Add Hotel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
