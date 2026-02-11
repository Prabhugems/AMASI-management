"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Award,
  Plus,
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  GripVertical,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"

type Tier = {
  id: string
  name: string
  display_order: number
  color: string
  benefits: string[]
  logo_size: string
  stall_size: string | null
  complimentary_passes: number
  price: number
}

const COLORS = [
  { value: "#a855f7", label: "Purple" },
  { value: "#eab308", label: "Gold" },
  { value: "#94a3b8", label: "Silver" },
  { value: "#d97706", label: "Bronze" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#ef4444", label: "Red" },
  { value: "#ec4899", label: "Pink" },
]

const LOGO_SIZES = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra Large" },
]

const DEFAULT_TIERS = [
  { name: "Platinum", color: "#a855f7", logo_size: "xlarge", complimentary_passes: 10, price: 500000 },
  { name: "Gold", color: "#eab308", logo_size: "large", complimentary_passes: 6, price: 300000 },
  { name: "Silver", color: "#94a3b8", logo_size: "medium", complimentary_passes: 4, price: 150000 },
  { name: "Bronze", color: "#d97706", logo_size: "small", complimentary_passes: 2, price: 75000 },
]

export default function TiersPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [showDialog, setShowDialog] = useState(false)
  const [editingTier, setEditingTier] = useState<Tier | null>(null)
  const [deleteTier, setDeleteTier] = useState<Tier | null>(null)

  const [form, setForm] = useState({
    name: "",
    color: COLORS[0].value,
    benefits: "",
    logo_size: "medium",
    stall_size: "",
    complimentary_passes: 0,
    price: 0,
  })

  // Fetch tiers
  const { data: tiers, isLoading } = useQuery({
    queryKey: ["sponsor-tiers", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sponsor_tiers")
        .select("*")
        .eq("event_id", eventId)
        .order("display_order")
      return (data || []) as Tier[]
    },
  })

  // Create tier
  const createTier = useMutation({
    mutationFn: async (data: typeof form) => {
      const { error } = await (supabase as any)
        .from("sponsor_tiers")
        .insert({
          event_id: eventId,
          name: data.name,
          color: data.color,
          benefits: data.benefits ? data.benefits.split("\n").filter(b => b.trim()) : [],
          logo_size: data.logo_size,
          stall_size: data.stall_size || null,
          complimentary_passes: data.complimentary_passes,
          price: data.price,
          display_order: (tiers?.length || 0) + 1,
        })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Tier created")
      queryClient.invalidateQueries({ queryKey: ["sponsor-tiers", eventId] })
      setShowDialog(false)
      resetForm()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Update tier
  const updateTier = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof form }) => {
      const { error } = await (supabase as any)
        .from("sponsor_tiers")
        .update({
          name: data.name,
          color: data.color,
          benefits: data.benefits ? data.benefits.split("\n").filter(b => b.trim()) : [],
          logo_size: data.logo_size,
          stall_size: data.stall_size || null,
          complimentary_passes: data.complimentary_passes,
          price: data.price,
        })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Tier updated")
      queryClient.invalidateQueries({ queryKey: ["sponsor-tiers", eventId] })
      setShowDialog(false)
      setEditingTier(null)
      resetForm()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Delete tier
  const deleteTierMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("sponsor_tiers")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Tier deleted")
      queryClient.invalidateQueries({ queryKey: ["sponsor-tiers", eventId] })
      setDeleteTier(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Add default tiers
  const addDefaults = useMutation({
    mutationFn: async () => {
      const inserts = DEFAULT_TIERS.map((tier, i) => ({
        event_id: eventId,
        name: tier.name,
        color: tier.color,
        logo_size: tier.logo_size,
        complimentary_passes: tier.complimentary_passes,
        price: tier.price,
        display_order: i + 1,
        benefits: [],
      }))
      const { error } = await (supabase as any)
        .from("sponsor_tiers")
        .insert(inserts)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Default tiers added")
      queryClient.invalidateQueries({ queryKey: ["sponsor-tiers", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const resetForm = () => {
    setForm({
      name: "",
      color: COLORS[0].value,
      benefits: "",
      logo_size: "medium",
      stall_size: "",
      complimentary_passes: 0,
      price: 0,
    })
  }

  const openEditDialog = (tier: Tier) => {
    setForm({
      name: tier.name,
      color: tier.color,
      benefits: tier.benefits?.join("\n") || "",
      logo_size: tier.logo_size,
      stall_size: tier.stall_size || "",
      complimentary_passes: tier.complimentary_passes,
      price: tier.price,
    })
    setEditingTier(tier)
    setShowDialog(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    if (editingTier) {
      updateTier.mutate({ id: editingTier.id, data: form })
    } else {
      createTier.mutate(form)
    }
  }

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
          <h1 className="text-2xl font-bold">Sponsor Tiers</h1>
          <p className="text-muted-foreground">Define sponsorship levels and benefits</p>
        </div>
        <div className="flex gap-2">
          {tiers?.length === 0 && (
            <Button variant="outline" onClick={() => addDefaults.mutate()} disabled={addDefaults.isPending}>
              Add Default Tiers
            </Button>
          )}
          <Button onClick={() => { resetForm(); setEditingTier(null); setShowDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tier
          </Button>
        </div>
      </div>

      {/* Tiers Table */}
      {!tiers || tiers.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Sponsor Tiers</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create sponsorship tiers like Platinum, Gold, Silver, Bronze
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => addDefaults.mutate()} disabled={addDefaults.isPending}>
              Use Default Tiers
            </Button>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Custom
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Tier Name</TableHead>
                <TableHead>Logo Size</TableHead>
                <TableHead>Stall Size</TableHead>
                <TableHead className="text-center">Passes</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: tier.color }}
                      />
                      <div>
                        <p className="font-medium">{tier.name}</p>
                        {tier.benefits?.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {tier.benefits.length} benefits
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{tier.logo_size}</TableCell>
                  <TableCell>{tier.stall_size || "-"}</TableCell>
                  <TableCell className="text-center">{tier.complimentary_passes}</TableCell>
                  <TableCell className="text-right font-mono">
                    ₹{Number(tier.price).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(tier)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteTier(tier)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tier Cards Preview */}
      {tiers && tiers.length > 0 && (
        <div>
          <h3 className="font-semibold mb-4">Tier Preview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tiers.map(tier => (
              <div
                key={tier.id}
                className="rounded-lg border-2 p-4 text-center"
                style={{ borderColor: tier.color }}
              >
                <div
                  className="w-8 h-8 rounded-full mx-auto mb-2"
                  style={{ backgroundColor: tier.color }}
                />
                <p className="font-bold" style={{ color: tier.color }}>{tier.name}</p>
                <p className="text-2xl font-bold mt-2">₹{(tier.price / 1000)}K</p>
                <p className="text-xs text-muted-foreground">{tier.complimentary_passes} passes</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingTier(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTier ? "Edit Tier" : "Add Sponsor Tier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tier Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Platinum"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Color</Label>
                <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                  <SelectTrigger className="mt-1">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: form.color }} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {COLORS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: c.value }} />
                          {c.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Logo Size</Label>
                <Select value={form.logo_size} onValueChange={(v) => setForm({ ...form, logo_size: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOGO_SIZES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stall Size</Label>
                <Input
                  value={form.stall_size}
                  onChange={(e) => setForm({ ...form, stall_size: e.target.value })}
                  placeholder="e.g., 6x3"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Complimentary Passes</Label>
                <Input
                  type="number"
                  value={form.complimentary_passes || ""}
                  onChange={(e) => setForm({ ...form, complimentary_passes: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
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
              <Label>Benefits (one per line)</Label>
              <Textarea
                value={form.benefits}
                onChange={(e) => setForm({ ...form, benefits: e.target.value })}
                placeholder="Logo on banner&#10;Website listing&#10;Social media mention"
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createTier.isPending || updateTier.isPending}
            >
              {(createTier.isPending || updateTier.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingTier ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTier} onOpenChange={(open) => !open && setDeleteTier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Tier
            </DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete <strong>{deleteTier?.name}</strong>?
            Sponsors in this tier will become unassigned.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTier(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTier && deleteTierMutation.mutate(deleteTier.id)}
              disabled={deleteTierMutation.isPending}
            >
              {deleteTierMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
