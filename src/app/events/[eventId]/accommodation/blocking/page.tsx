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
  CalendarRange,
  Plus,
  Loader2,
  Building2,
  BedDouble,
  Trash2,
  Edit,
  Calendar,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type HotelType = {
  id: string
  name: string
  total_rooms: number
  available_rooms: number
}

type RoomBlock = {
  id: string
  hotel_id: string
  hotel_name: string
  start_date: string
  end_date: string
  rooms_blocked: number
  room_type: string
  rate_per_night: number
  confirmation_number: string
  notes: string
  status: "tentative" | "confirmed" | "released"
}

export default function RoomBlockingPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [showAddBlock, setShowAddBlock] = useState(false)
  const [editingBlock, setEditingBlock] = useState<RoomBlock | null>(null)
  const [blockForm, setBlockForm] = useState({
    hotel_id: "",
    start_date: "",
    end_date: "",
    rooms_blocked: 0,
    room_type: "standard",
    rate_per_night: 0,
    confirmation_number: "",
    notes: "",
    status: "tentative" as "tentative" | "confirmed" | "released",
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

  // Fetch room blocks from custom_fields of event
  const { data: roomBlocks, isLoading } = useQuery({
    queryKey: ["room-blocks", eventId],
    queryFn: async () => {
      const { data: event } = await (supabase as any)
        .from("events")
        .select("custom_fields")
        .eq("id", eventId)
        .single()

      return (event?.custom_fields?.room_blocks || []) as RoomBlock[]
    },
  })

  // Save room blocks
  const saveBlocks = useMutation({
    mutationFn: async (blocks: RoomBlock[]) => {
      const { data: event } = await (supabase as any)
        .from("events")
        .select("custom_fields")
        .eq("id", eventId)
        .single()

      const { error } = await (supabase as any)
        .from("events")
        .update({
          custom_fields: {
            ...(event?.custom_fields || {}),
            room_blocks: blocks,
          },
        })
        .eq("id", eventId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room-blocks", eventId] })
    },
  })

  // Add block
  const addBlock = () => {
    if (!blockForm.hotel_id || !blockForm.start_date || !blockForm.end_date || blockForm.rooms_blocked <= 0) {
      toast.error("Please fill in all required fields")
      return
    }

    const hotel = hotels?.find(h => h.id === blockForm.hotel_id)
    const newBlock: RoomBlock = {
      id: crypto.randomUUID(),
      hotel_id: blockForm.hotel_id,
      hotel_name: hotel?.name || "",
      start_date: blockForm.start_date,
      end_date: blockForm.end_date,
      rooms_blocked: blockForm.rooms_blocked,
      room_type: blockForm.room_type,
      rate_per_night: blockForm.rate_per_night,
      confirmation_number: blockForm.confirmation_number,
      notes: blockForm.notes,
      status: blockForm.status,
    }

    const updatedBlocks = [...(roomBlocks || []), newBlock]
    saveBlocks.mutate(updatedBlocks, {
      onSuccess: () => {
        toast.success("Room block added")
        setShowAddBlock(false)
        setBlockForm({
          hotel_id: "", start_date: "", end_date: "", rooms_blocked: 0,
          room_type: "standard", rate_per_night: 0, confirmation_number: "", notes: "", status: "tentative"
        })
      },
    })
  }

  // Update block
  const updateBlock = () => {
    if (!editingBlock) return

    const hotel = hotels?.find(h => h.id === blockForm.hotel_id)
    const updatedBlocks = roomBlocks?.map(b =>
      b.id === editingBlock.id
        ? { ...b, ...blockForm, hotel_name: hotel?.name || b.hotel_name }
        : b
    ) || []

    saveBlocks.mutate(updatedBlocks, {
      onSuccess: () => {
        toast.success("Room block updated")
        setEditingBlock(null)
      },
    })
  }

  // Delete block
  const deleteBlock = (id: string) => {
    if (!confirm("Delete this room block?")) return
    const updatedBlocks = roomBlocks?.filter(b => b.id !== id) || []
    saveBlocks.mutate(updatedBlocks, {
      onSuccess: () => toast.success("Room block deleted"),
    })
  }

  const openEditBlock = (block: RoomBlock) => {
    setBlockForm({
      hotel_id: block.hotel_id,
      start_date: block.start_date,
      end_date: block.end_date,
      rooms_blocked: block.rooms_blocked,
      room_type: block.room_type,
      rate_per_night: block.rate_per_night,
      confirmation_number: block.confirmation_number,
      notes: block.notes,
      status: block.status,
    })
    setEditingBlock(block)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  // Stats
  const stats = useMemo(() => {
    const confirmed = roomBlocks?.filter(b => b.status === "confirmed") || []
    const tentative = roomBlocks?.filter(b => b.status === "tentative") || []
    return {
      total: roomBlocks?.length || 0,
      totalRooms: roomBlocks?.reduce((sum, b) => sum + b.rooms_blocked, 0) || 0,
      confirmed: confirmed.length,
      confirmedRooms: confirmed.reduce((sum, b) => sum + b.rooms_blocked, 0),
      tentative: tentative.length,
      tentativeRooms: tentative.reduce((sum, b) => sum + b.rooms_blocked, 0),
    }
  }, [roomBlocks])

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
          <h1 className="text-2xl font-bold">Room Blocking</h1>
          <p className="text-muted-foreground">Block rooms with hotels for your event dates</p>
        </div>
        <Button onClick={() => setShowAddBlock(true)} disabled={!hotels?.length}>
          <Plus className="h-4 w-4 mr-2" />
          Add Room Block
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarRange className="h-4 w-4" />
            <span className="text-sm">Total Blocks</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
          <p className="text-xs text-muted-foreground">{stats.totalRooms} rooms</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <BedDouble className="h-4 w-4" />
            <span className="text-sm">Confirmed</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-600">{stats.confirmed}</p>
          <p className="text-xs text-muted-foreground">{stats.confirmedRooms} rooms</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <BedDouble className="h-4 w-4" />
            <span className="text-sm">Tentative</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-amber-500">{stats.tentative}</p>
          <p className="text-xs text-muted-foreground">{stats.tentativeRooms} rooms</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="text-sm">Hotels</span>
          </div>
          <p className="text-2xl font-bold mt-1">{hotels?.length || 0}</p>
        </div>
      </div>

      {/* Blocks Table */}
      {!roomBlocks?.length ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <CalendarRange className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No room blocks yet</h3>
          <p className="text-muted-foreground mb-4">
            {hotels?.length ? "Create room blocks to reserve rooms at hotels" : "Add hotels first to create room blocks"}
          </p>
          {hotels?.length ? (
            <Button onClick={() => setShowAddBlock(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Block
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Hotel</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Rooms</TableHead>
                <TableHead>Room Type</TableHead>
                <TableHead>Rate/Night</TableHead>
                <TableHead>Confirmation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomBlocks.map((block) => (
                <TableRow key={block.id}>
                  <TableCell className="font-medium">{block.hotel_name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-green-500" />
                        {formatDate(block.start_date)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-red-500" />
                        {formatDate(block.end_date)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold">{block.rooms_blocked}</span>
                  </TableCell>
                  <TableCell className="capitalize">{block.room_type}</TableCell>
                  <TableCell>
                    {block.rate_per_night > 0 ? `₹${block.rate_per_night.toLocaleString()}` : "-"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {block.confirmation_number || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "text-white",
                        block.status === "confirmed" && "bg-green-500",
                        block.status === "tentative" && "bg-amber-500",
                        block.status === "released" && "bg-gray-500"
                      )}
                    >
                      {block.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditBlock(block)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteBlock(block.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Block Dialog */}
      <Dialog open={showAddBlock || !!editingBlock} onOpenChange={(open) => {
        if (!open) { setShowAddBlock(false); setEditingBlock(null) }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBlock ? "Edit Room Block" : "Add Room Block"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div>
              <Label>Hotel *</Label>
              <Select value={blockForm.hotel_id} onValueChange={(v) => setBlockForm({ ...blockForm, hotel_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select hotel" />
                </SelectTrigger>
                <SelectContent>
                  {hotels?.map((hotel) => (
                    <SelectItem key={hotel.id} value={hotel.id}>{hotel.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={blockForm.start_date}
                  onChange={(e) => setBlockForm({ ...blockForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={blockForm.end_date}
                  onChange={(e) => setBlockForm({ ...blockForm, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rooms to Block *</Label>
                <Input
                  type="number"
                  value={blockForm.rooms_blocked || ""}
                  onChange={(e) => setBlockForm({ ...blockForm, rooms_blocked: parseInt(e.target.value) || 0 })}
                  placeholder="50"
                />
              </div>
              <div>
                <Label>Room Type</Label>
                <Select value={blockForm.room_type} onValueChange={(v) => setBlockForm({ ...blockForm, room_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="deluxe">Deluxe</SelectItem>
                    <SelectItem value="suite">Suite</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rate/Night (₹)</Label>
                <Input
                  type="number"
                  value={blockForm.rate_per_night || ""}
                  onChange={(e) => setBlockForm({ ...blockForm, rate_per_night: parseFloat(e.target.value) || 0 })}
                  placeholder="3500"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={blockForm.status} onValueChange={(v: any) => setBlockForm({ ...blockForm, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tentative">Tentative</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="released">Released</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Confirmation Number</Label>
              <Input
                value={blockForm.confirmation_number}
                onChange={(e) => setBlockForm({ ...blockForm, confirmation_number: e.target.value })}
                placeholder="BLOCK-2026-001"
                className="font-mono"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Input
                value={blockForm.notes}
                onChange={(e) => setBlockForm({ ...blockForm, notes: e.target.value })}
                placeholder="Cut-off date, special terms, etc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddBlock(false); setEditingBlock(null) }}>
              Cancel
            </Button>
            <Button
              onClick={editingBlock ? updateBlock : addBlock}
              disabled={saveBlocks.isPending}
            >
              {saveBlocks.isPending ? "Saving..." : editingBlock ? "Update" : "Add Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
