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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Building2,
  Loader2,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Copy,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  Mail,
  Phone,
  Users,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

type HallCoordinator = {
  id: string
  event_id: string
  hall_name: string
  coordinator_name: string
  coordinator_email: string
  coordinator_phone?: string
  portal_token: string
  created_at: string
}

export default function CoordinatorsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [editingCoordinator, setEditingCoordinator] = useState<HallCoordinator | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    hall_name: "",
    coordinator_name: "",
    coordinator_email: "",
    coordinator_phone: "",
  })

  // Fetch coordinators
  const { data: coordinators, isLoading } = useQuery({
    queryKey: ["hall-coordinators", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("hall_coordinators")
        .select("*")
        .eq("event_id", eventId)
        .order("hall_name")

      return (data || []) as HallCoordinator[]
    },
  })

  // Fetch unique halls from sessions
  const { data: halls } = useQuery({
    queryKey: ["halls-for-coordinators", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sessions")
        .select("hall")
        .eq("event_id", eventId)
        .not("hall", "is", null)

      const uniqueHalls = [...new Set((data || []).map((s: any) => s.hall))] as string[]
      return uniqueHalls.sort()
    },
  })

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingCoordinator) {
        const { error } = await (supabase as any)
          .from("hall_coordinators")
          .update({
            hall_name: data.hall_name,
            coordinator_name: data.coordinator_name,
            coordinator_email: data.coordinator_email,
            coordinator_phone: data.coordinator_phone || null,
          })
          .eq("id", editingCoordinator.id)
        if (error) throw error
      } else {
        const { error } = await (supabase as any)
          .from("hall_coordinators")
          .insert({
            event_id: eventId,
            hall_name: data.hall_name,
            coordinator_name: data.coordinator_name,
            coordinator_email: data.coordinator_email,
            coordinator_phone: data.coordinator_phone || null,
            portal_token: crypto.randomUUID(),
          })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hall-coordinators", eventId] })
      toast.success(editingCoordinator ? "Coordinator updated" : "Coordinator added")
      setShowDialog(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save coordinator")
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("hall_coordinators")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hall-coordinators", eventId] })
      toast.success("Coordinator removed")
    },
  })

  // Regenerate token mutation
  const regenerateTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      const newToken = crypto.randomUUID()
      const { error } = await (supabase as any)
        .from("hall_coordinators")
        .update({ portal_token: newToken })
        .eq("id", id)
      if (error) throw error
      return newToken
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hall-coordinators", eventId] })
      toast.success("New portal link generated")
    },
  })

  const resetForm = () => {
    setFormData({
      hall_name: "",
      coordinator_name: "",
      coordinator_email: "",
      coordinator_phone: "",
    })
    setEditingCoordinator(null)
  }

  const openEditDialog = (coordinator: HallCoordinator) => {
    setEditingCoordinator(coordinator)
    setFormData({
      hall_name: coordinator.hall_name,
      coordinator_name: coordinator.coordinator_name,
      coordinator_email: coordinator.coordinator_email,
      coordinator_phone: coordinator.coordinator_phone || "",
    })
    setShowDialog(true)
  }

  // Filter coordinators
  const filteredCoordinators = useMemo(() => {
    if (!coordinators) return []
    return coordinators.filter((c) =>
      c.hall_name.toLowerCase().includes(search.toLowerCase()) ||
      c.coordinator_name.toLowerCase().includes(search.toLowerCase()) ||
      c.coordinator_email.toLowerCase().includes(search.toLowerCase())
    )
  }, [coordinators, search])

  // Halls without coordinators
  const hallsWithoutCoordinators = useMemo(() => {
    if (!halls || !coordinators) return []
    const assignedHalls = new Set(coordinators.map((c) => c.hall_name))
    return halls.filter((h) => !assignedHalls.has(h))
  }, [halls, coordinators])

  const getPortalUrl = (token: string) => {
    return `${typeof window !== "undefined" ? window.location.origin : ""}/hall-coordinator/${token}`
  }

  const copyLink = (coordinator: HallCoordinator) => {
    const url = getPortalUrl(coordinator.portal_token)
    navigator.clipboard.writeText(url)
    setCopiedId(coordinator.id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success("Portal link copied")
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
          <h1 className="text-2xl font-bold">Hall Coordinators</h1>
          <p className="text-muted-foreground">Assign coordinators to manage sessions in each hall</p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Coordinator
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Users className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-800">Hall Coordinator Portal</h3>
            <p className="text-sm text-blue-600 mt-1">
              Each coordinator gets a unique link to access their portal where they can
              view sessions, update status, and add notes. Share the portal link with your coordinators.
            </p>
          </div>
        </div>
      </div>

      {/* Halls without coordinators warning */}
      {hallsWithoutCoordinators.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-800 mb-2">Halls without coordinators</h3>
          <div className="flex flex-wrap gap-2">
            {hallsWithoutCoordinators.map((hall) => (
              <Badge key={hall} variant="outline" className="bg-white">
                <Building2 className="h-3 w-3 mr-1" />
                {hall}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search coordinators..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Coordinators Table */}
      {filteredCoordinators.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No coordinators yet</h3>
          <p className="text-muted-foreground mb-4">Add coordinators to manage your halls</p>
          <Button onClick={() => { resetForm(); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Coordinator
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Hall</TableHead>
                <TableHead>Coordinator</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCoordinators.map((coordinator) => (
                <TableRow key={coordinator.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{coordinator.hall_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{coordinator.coordinator_name}</p>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {coordinator.coordinator_email}
                      </p>
                      {coordinator.coordinator_phone && (
                        <p className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {coordinator.coordinator_phone}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyLink(coordinator)}
                      >
                        {copiedId === coordinator.id ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <a
                          href={getPortalUrl(coordinator.portal_token)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
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
                        <DropdownMenuItem onClick={() => openEditDialog(coordinator)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => regenerateTokenMutation.mutate(coordinator.id)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          New Portal Link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Remove this coordinator?")) {
                              deleteMutation.mutate(coordinator.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
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
            <DialogTitle>{editingCoordinator ? "Edit Coordinator" : "Add Coordinator"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Hall *</Label>
              {halls && halls.length > 0 ? (
                <Select
                  value={formData.hall_name}
                  onValueChange={(v) => setFormData({ ...formData, hall_name: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a hall" />
                  </SelectTrigger>
                  <SelectContent>
                    {halls.map((hall) => (
                      <SelectItem key={hall} value={hall}>
                        {hall}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={formData.hall_name}
                  onChange={(e) => setFormData({ ...formData, hall_name: e.target.value })}
                  placeholder="Hall name"
                />
              )}
            </div>
            <div>
              <Label>Coordinator Name *</Label>
              <Input
                value={formData.coordinator_name}
                onChange={(e) => setFormData({ ...formData, coordinator_name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.coordinator_email}
                onChange={(e) => setFormData({ ...formData, coordinator_email: e.target.value })}
                placeholder="coordinator@example.com"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.coordinator_phone}
                onChange={(e) => setFormData({ ...formData, coordinator_phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.hall_name || !formData.coordinator_name || !formData.coordinator_email || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : editingCoordinator ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
