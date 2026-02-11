"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Layers,
  Loader2,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Presentation,
} from "lucide-react"
import { toast } from "sonner"

type Track = {
  id: string
  name: string
  description?: string
  chairpersons?: string
  color?: string
  sessions_count?: number
}

const TRACK_COLORS = [
  { value: "#3B82F6", label: "Blue" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#10B981", label: "Green" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#EF4444", label: "Red" },
  { value: "#EC4899", label: "Pink" },
  { value: "#6366F1", label: "Indigo" },
  { value: "#14B8A6", label: "Teal" },
]

export default function TracksPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [showDialog, setShowDialog] = useState(false)
  const [editingTrack, setEditingTrack] = useState<Track | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
  })

  // Fetch tracks
  const { data: tracks, isLoading } = useQuery({
    queryKey: ["tracks-list", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("tracks")
        .select("*")
        .eq("event_id", eventId)
        .order("name")

      return (data || []) as Track[]
    },
  })

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingTrack) {
        const { error } = await (supabase as any)
          .from("tracks")
          .update(data)
          .eq("id", editingTrack.id)
        if (error) throw error
      } else {
        const { error } = await (supabase as any)
          .from("tracks")
          .insert({ ...data, event_id: eventId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks-list", eventId] })
      toast.success(editingTrack ? "Track updated" : "Track created")
      setShowDialog(false)
      resetForm()
    },
    onError: () => {
      toast.error("Failed to save track")
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("tracks")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks-list", eventId] })
      toast.success("Track deleted")
    },
  })

  const resetForm = () => {
    setFormData({ name: "", description: "", color: "#3B82F6" })
    setEditingTrack(null)
  }

  const openEditDialog = (track: Track) => {
    setEditingTrack(track)
    setFormData({
      name: track.name,
      description: track.description || "",
      color: track.color || "#3B82F6",
    })
    setShowDialog(true)
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
          <h1 className="text-2xl font-bold">Tracks</h1>
          <p className="text-muted-foreground">Organize sessions into parallel tracks</p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Track
        </Button>
      </div>

      {/* Tracks Table */}
      {!tracks?.length ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No tracks yet</h3>
          <p className="text-muted-foreground mb-4">Create tracks to organize parallel sessions</p>
          <Button onClick={() => { resetForm(); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Track
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Track</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Chairpersons</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracks.map((track) => (
                <TableRow key={track.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: track.color || "#3B82F6" }}
                      />
                      <span className="font-medium">{track.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {track.description || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px]">
                    {track.chairpersons ? (
                      <span className="text-sm line-clamp-2">{track.chairpersons}</span>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Presentation className="h-4 w-4" />
                      <span>{track.sessions_count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(track)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Delete this track?")) {
                              deleteMutation.mutate(track.id)
                            }
                          }}
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

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTrack ? "Edit Track" : "Add Track"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Technical Track, Business Track"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description"
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {TRACK_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === c.value ? "border-gray-900" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setFormData({ ...formData, color: c.value })}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : editingTrack ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
