"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Grid3X3,
  Plus,
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  Search,
  Building2,
  MapPin,
  Plug,
  Wifi,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Sponsor = {
  id: string
  name: string
  logo_url: string | null
}

type Stall = {
  id: string
  stall_number: string
  stall_name: string | null
  size: string | null
  location: string | null
  status: string
  amenities: string[]
  price: number
  sponsor_id: string | null
  notes: string | null
  sponsors?: Sponsor | null
}

const STATUS_OPTIONS = [
  { value: "available", label: "Available", color: "bg-green-500" },
  { value: "reserved", label: "Reserved", color: "bg-amber-500" },
  { value: "assigned", label: "Assigned", color: "bg-blue-500" },
  { value: "setup_complete", label: "Setup Done", color: "bg-purple-500" },
]

const SIZE_OPTIONS = ["3x3", "6x3", "9x3", "6x6", "9x6", "Custom"]
const LOCATION_OPTIONS = ["Hall A", "Hall B", "Hall C", "Outdoor", "Lobby"]
const AMENITY_OPTIONS = [
  { value: "power", label: "Power Outlet", icon: Plug },
  { value: "wifi", label: "WiFi", icon: Wifi },
  { value: "table", label: "Table" },
  { value: "chairs", label: "Chairs" },
  { value: "backdrop", label: "Backdrop" },
  { value: "lighting", label: "Lighting" },
]

export default function StallsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterLocation, setFilterLocation] = useState<string>("all")
  const [showDialog, setShowDialog] = useState(false)
  const [editingStall, setEditingStall] = useState<Stall | null>(null)
  const [deleteStall, setDeleteStall] = useState<Stall | null>(null)
  const [bulkAddCount, setBulkAddCount] = useState(0)
  const [showBulkDialog, setShowBulkDialog] = useState(false)

  const [form, setForm] = useState({
    stall_number: "",
    stall_name: "",
    size: "3x3",
    location: "Hall A",
    status: "available",
    amenities: [] as string[],
    price: 0,
    sponsor_id: "",
    notes: "",
  })

  // Fetch sponsors (all for mapping, filter for dropdown)
  const { data: sponsors } = useQuery({
    queryKey: ["sponsors-all", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sponsors")
        .select("id, name, logo_url, status")
        .eq("event_id", eventId)
        .order("name")
      return (data || []) as (Sponsor & { status: string })[]
    },
  })

  // Filter confirmed sponsors for assignment dropdown
  const confirmedSponsors = useMemo(() => {
    return sponsors?.filter(s => s.status === "confirmed") || []
  }, [sponsors])

  // Fetch stalls raw
  const { data: stallsRaw, isLoading } = useQuery({
    queryKey: ["stalls-raw", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("stalls")
        .select("*")
        .eq("event_id", eventId)
        .order("stall_number")
      return (data || []) as (Omit<Stall, 'sponsors'>)[]
    },
  })

  // Map sponsors by ID
  const sponsorMap = useMemo(() => {
    if (!sponsors) return {}
    return sponsors.reduce((acc, s) => {
      acc[s.id] = s
      return acc
    }, {} as Record<string, Sponsor>)
  }, [sponsors])

  // Combine stalls with sponsor data
  const stalls = useMemo(() => {
    if (!stallsRaw) return []
    return stallsRaw.map(stall => ({
      ...stall,
      sponsors: stall.sponsor_id ? sponsorMap[stall.sponsor_id] || null : null
    })) as Stall[]
  }, [stallsRaw, sponsorMap])

  // Create stall
  const createStall = useMutation({
    mutationFn: async (data: typeof form) => {
      const { error } = await (supabase as any)
        .from("stalls")
        .insert({
          event_id: eventId,
          stall_number: data.stall_number,
          stall_name: data.stall_name || null,
          size: data.size,
          location: data.location,
          status: data.status,
          amenities: data.amenities,
          price: data.price,
          sponsor_id: data.sponsor_id || null,
          notes: data.notes || null,
        })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Stall created")
      queryClient.invalidateQueries({ queryKey: ["stalls", eventId] })
      setShowDialog(false)
      resetForm()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Bulk create stalls
  const bulkCreateStalls = useMutation({
    mutationFn: async (count: number) => {
      const existingNumbers = stalls?.map(s => parseInt(s.stall_number.replace(/\D/g, ''))) || []
      const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0

      const inserts = Array.from({ length: count }, (_, i) => ({
        event_id: eventId,
        stall_number: `S${(maxNumber + i + 1).toString().padStart(3, '0')}`,
        size: form.size,
        location: form.location,
        status: "available",
        amenities: form.amenities,
        price: form.price,
      }))

      const { error } = await (supabase as any)
        .from("stalls")
        .insert(inserts)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(`${bulkAddCount} stalls created`)
      queryClient.invalidateQueries({ queryKey: ["stalls", eventId] })
      setShowBulkDialog(false)
      setBulkAddCount(0)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Update stall
  const updateStall = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof form }) => {
      const { error } = await (supabase as any)
        .from("stalls")
        .update({
          stall_number: data.stall_number,
          stall_name: data.stall_name || null,
          size: data.size,
          location: data.location,
          status: data.status,
          amenities: data.amenities,
          price: data.price,
          sponsor_id: data.sponsor_id || null,
          notes: data.notes || null,
        })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Stall updated")
      queryClient.invalidateQueries({ queryKey: ["stalls", eventId] })
      setShowDialog(false)
      setEditingStall(null)
      resetForm()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Delete stall
  const deleteStallMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("stalls")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Stall deleted")
      queryClient.invalidateQueries({ queryKey: ["stalls", eventId] })
      setDeleteStall(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Quick assign sponsor
  const quickAssign = useMutation({
    mutationFn: async ({ stallId, sponsorId }: { stallId: string; sponsorId: string | null }) => {
      const { error } = await (supabase as any)
        .from("stalls")
        .update({
          sponsor_id: sponsorId,
          status: sponsorId ? "assigned" : "available",
        })
        .eq("id", stallId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stalls", eventId] })
      toast.success("Stall updated")
    },
  })

  const resetForm = () => {
    setForm({
      stall_number: "",
      stall_name: "",
      size: "3x3",
      location: "Hall A",
      status: "available",
      amenities: [],
      price: 0,
      sponsor_id: "",
      notes: "",
    })
  }

  const openEditDialog = (stall: Stall) => {
    setForm({
      stall_number: stall.stall_number,
      stall_name: stall.stall_name || "",
      size: stall.size || "3x3",
      location: stall.location || "Hall A",
      status: stall.status,
      amenities: stall.amenities || [],
      price: stall.price,
      sponsor_id: stall.sponsor_id || "",
      notes: stall.notes || "",
    })
    setEditingStall(stall)
    setShowDialog(true)
  }

  const handleSubmit = () => {
    if (!form.stall_number.trim()) {
      toast.error("Stall number is required")
      return
    }
    if (editingStall) {
      updateStall.mutate({ id: editingStall.id, data: form })
    } else {
      createStall.mutate(form)
    }
  }

  const toggleAmenity = (amenity: string) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }))
  }

  // Filter stalls
  const filteredStalls = useMemo(() => {
    if (!stalls) return []
    return stalls.filter(s => {
      const matchesSearch =
        s.stall_number.toLowerCase().includes(search.toLowerCase()) ||
        s.stall_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.sponsors?.name.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = filterStatus === "all" || s.status === filterStatus
      const matchesLocation = filterLocation === "all" || s.location === filterLocation
      return matchesSearch && matchesStatus && matchesLocation
    })
  }, [stalls, search, filterStatus, filterLocation])

  // Stats
  const stats = useMemo(() => {
    const total = stalls?.length || 0
    const available = stalls?.filter(s => s.status === "available").length || 0
    const assigned = stalls?.filter(s => s.sponsor_id).length || 0
    const revenue = stalls?.filter(s => s.sponsor_id).reduce((sum, s) => sum + Number(s.price), 0) || 0
    return { total, available, assigned, revenue }
  }, [stalls])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stalls</h1>
          <p className="text-muted-foreground">Manage exhibition booths and assignments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulkDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Bulk Add
          </Button>
          <Button onClick={() => { resetForm(); setEditingStall(null); setShowDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Stall
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Stalls</p>
          <p className="text-3xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-green-600">Available</p>
          <p className="text-3xl font-bold mt-1 text-green-600">{stats.available}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-blue-600">Assigned</p>
          <p className="text-3xl font-bold mt-1 text-blue-600">{stats.assigned}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Stall Revenue</p>
          <p className="text-2xl font-bold mt-1">₹{stats.revenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search stalls..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {LOCATION_OPTIONS.map(loc => (
              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredStalls.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Stalls Found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {stalls?.length === 0 ? "Create stalls for your exhibition" : "No stalls match your filters"}
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => setShowBulkDialog(true)}>
              Bulk Add Stalls
            </Button>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Stall
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Stall #</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStalls.map((stall) => {
                const statusInfo = STATUS_OPTIONS.find(s => s.value === stall.status)

                return (
                  <TableRow key={stall.id}>
                    <TableCell>
                      <div>
                        <p className="font-mono font-medium">{stall.stall_number}</p>
                        {stall.stall_name && (
                          <p className="text-xs text-muted-foreground">{stall.stall_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{stall.size || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {stall.location || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {stall.sponsors ? (
                        <div className="flex items-center gap-2">
                          {stall.sponsors.logo_url ? (
                            <img
                              src={stall.sponsors.logo_url}
                              alt=""
                              className="w-6 h-6 object-contain rounded"
                            />
                          ) : (
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">{stall.sponsors.name}</span>
                        </div>
                      ) : (
                        <Select
                          value=""
                          onValueChange={(v) => quickAssign.mutate({ stallId: stall.id, sponsorId: v })}
                        >
                          <SelectTrigger className="h-8 w-[180px] text-xs">
                            <SelectValue placeholder="Assign sponsor..." />
                          </SelectTrigger>
                          <SelectContent>
                            {confirmedSponsors?.map(sp => (
                              <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ₹{Number(stall.price).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-white", statusInfo?.color)}>
                        {statusInfo?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(stall)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {stall.sponsor_id && (
                            <DropdownMenuItem onClick={() => quickAssign.mutate({ stallId: stall.id, sponsorId: null })}>
                              <Building2 className="h-4 w-4 mr-2" />
                              Unassign
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteStall(stall)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
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

      {/* Add/Edit Stall Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingStall(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStall ? "Edit Stall" : "Add Stall"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stall Number *</Label>
                <Input
                  value={form.stall_number}
                  onChange={(e) => setForm({ ...form, stall_number: e.target.value })}
                  placeholder="e.g., S001"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Custom Name</Label>
                <Input
                  value={form.stall_name}
                  onChange={(e) => setForm({ ...form, stall_name: e.target.value })}
                  placeholder="Optional"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Size</Label>
                <Select value={form.size} onValueChange={(v) => setForm({ ...form, size: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location</Label>
                <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_OPTIONS.map(loc => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price (₹)</Label>
                <Input
                  type="number"
                  value={form.price || ""}
                  onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Assign to Sponsor</Label>
              <Select value={form.sponsor_id} onValueChange={(v) => setForm({ ...form, sponsor_id: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select sponsor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {confirmedSponsors?.map(sp => (
                    <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Amenities</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {AMENITY_OPTIONS.map(amenity => (
                  <label
                    key={amenity.value}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors",
                      form.amenities.includes(amenity.value) ? "bg-primary/10 border-primary" : "hover:bg-muted"
                    )}
                  >
                    <Checkbox
                      checked={form.amenities.includes(amenity.value)}
                      onCheckedChange={() => toggleAmenity(amenity.value)}
                    />
                    <span className="text-sm">{amenity.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createStall.isPending || updateStall.isPending}
            >
              {(createStall.isPending || updateStall.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingStall ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Add Stalls</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Number of Stalls</Label>
              <Input
                type="number"
                value={bulkAddCount || ""}
                onChange={(e) => setBulkAddCount(parseInt(e.target.value) || 0)}
                placeholder="e.g., 20"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Size</Label>
                <Select value={form.size} onValueChange={(v) => setForm({ ...form, size: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location</Label>
                <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_OPTIONS.map(loc => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Price per Stall (₹)</Label>
              <Input
                type="number"
                value={form.price || ""}
                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
            <Button
              onClick={() => bulkCreateStalls.mutate(bulkAddCount)}
              disabled={bulkCreateStalls.isPending || bulkAddCount <= 0}
            >
              {bulkCreateStalls.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create {bulkAddCount} Stalls
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteStall} onOpenChange={(open) => !open && setDeleteStall(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Stall
            </DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete stall <strong>{deleteStall?.stall_number}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStall(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteStall && deleteStallMutation.mutate(deleteStall.id)}
              disabled={deleteStallMutation.isPending}
            >
              {deleteStallMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
