"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
  Search,
  Loader2,
  Users,
  UserCheck,
  ClipboardCheck,
  BarChart3,
  Upload,
  Plus,
  Pencil,
  Trash2,
  Shield,
  Shuffle,
  RefreshCw,
  XCircle,
  CalendarClock,
} from "lucide-react"
import { toast } from "sonner"
import { CSVImportDynamic } from "@/components/ui/csv-import-dynamic"

type Reviewer = {
  id: string
  event_id: string
  name: string
  email: string
  phone: string | null
  institution: string | null
  city: string | null
  specialty: string | null
  years_of_experience: string | null
  status: string
  notes: string | null
  assigned_abstracts: string[]
  review_count: number
  created_at: string
  updated_at: string
}

const csvFields = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "phone", label: "Phone Number" },
  { key: "institution", label: "Institution/Hospital" },
  { key: "city", label: "City" },
  { key: "specialty", label: "Specialty Interests" },
  { key: "years_of_experience", label: "Years of Experience" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Notes (Internal)" },
]

export default function ReviewersPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showImport, setShowImport] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingReviewer, setEditingReviewer] = useState<Reviewer | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    institution: "",
    city: "",
    specialty: "",
    years_of_experience: "",
    status: "active",
    notes: "",
  })

  // Fetch reviewers
  const { data: reviewers = [], isLoading } = useQuery({
    queryKey: ["abstract-reviewers", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch reviewers")
      return res.json() as Promise<Reviewer[]>
    },
  })

  // Fetch settings for restrict_reviewers toggle
  const { data: settings } = useQuery({
    queryKey: ["abstract-settings", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-settings/${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch settings")
      return res.json()
    },
  })

  // Toggle restrict_reviewers
  const toggleRestrict = useMutation({
    mutationFn: async (value: boolean) => {
      const res = await fetch(`/api/abstract-settings/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restrict_reviewers: value }),
      })
      if (!res.ok) throw new Error("Failed to update settings")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-settings", eventId] })
      toast.success("Reviewer restriction updated")
    },
    onError: () => toast.error("Failed to update setting"),
  })

  // Update reviewer
  const updateReviewer = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update reviewer")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      toast.success("Reviewer updated")
      setEditingReviewer(null)
    },
    onError: () => toast.error("Failed to update reviewer"),
  })

  // Delete reviewer
  const deleteReviewer = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete reviewer")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      toast.success("Reviewer removed")
    },
    onError: () => toast.error("Failed to remove reviewer"),
  })

  // Auto-assign abstracts
  const autoAssign = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}/assign`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to auto-assign")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      toast.success(`Assigned ${data.total_abstracts} abstracts across ${data.total_reviewers} reviewers`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Reassign pending
  const reassignPending = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}/assign`, {
        method: "PUT",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to reassign")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      if (data.reassigned_count === 0) {
        toast.info("No unreviewed abstracts to reassign")
      } else {
        toast.success(`Reassigned ${data.reassigned_count} abstracts`)
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Clear all assignments
  const clearAssignments = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}/assign`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to clear assignments")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      toast.success("All assignments cleared")
    },
    onError: () => toast.error("Failed to clear assignments"),
  })

  // Update review deadline
  const updateDeadline = useMutation({
    mutationFn: async (deadline: string | null) => {
      const res = await fetch(`/api/abstract-settings/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_deadline: deadline }),
      })
      if (!res.ok) throw new Error("Failed to update deadline")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-settings", eventId] })
      toast.success("Review deadline updated")
    },
    onError: () => toast.error("Failed to update deadline"),
  })

  // Add reviewer
  const addReviewer = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to add reviewer")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      toast.success("Reviewer added")
      setShowAddDialog(false)
      setEditForm({
        name: "", email: "", phone: "", institution: "", city: "",
        specialty: "", years_of_experience: "", status: "active", notes: "",
      })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Filtered reviewers
  const filtered = useMemo(() => {
    return reviewers.filter((r) => {
      const matchesSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase()) ||
        (r.institution || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.specialty || "").toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === "all" || r.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [reviewers, search, statusFilter])

  // Stats
  const stats = useMemo(() => {
    const active = reviewers.filter((r) => r.status === "active").length
    const totalReviews = reviewers.reduce((sum, r) => sum + r.review_count, 0)
    const reviewersWithReviews = reviewers.filter((r) => r.review_count > 0).length
    const avgReviews = reviewersWithReviews > 0
      ? (totalReviews / reviewersWithReviews).toFixed(1)
      : "0"

    return {
      total: reviewers.length,
      active,
      totalReviews,
      avgReviews,
    }
  }, [reviewers])

  const handleEditClick = (reviewer: Reviewer) => {
    setEditingReviewer(reviewer)
    setEditForm({
      name: reviewer.name,
      email: reviewer.email,
      phone: reviewer.phone || "",
      institution: reviewer.institution || "",
      city: reviewer.city || "",
      specialty: reviewer.specialty || "",
      years_of_experience: reviewer.years_of_experience || "",
      status: reviewer.status,
      notes: reviewer.notes || "",
    })
  }

  const handleSaveEdit = () => {
    if (!editingReviewer) return
    updateReviewer.mutate({ id: editingReviewer.id, ...editForm })
  }

  const handleCSVImport = async (data: Record<string, any>[]) => {
    const res = await fetch(`/api/abstract-reviewers/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || "Import failed")
    }
    const result = await res.json()
    queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
    return result
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (showImport) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={() => setShowImport(false)} className="mb-4">
          &larr; Back to Reviewers
        </Button>
        <CSVImportDynamic
          title="Import Reviewers"
          description="Upload a CSV file with reviewer details. Map the columns to the standard fields below."
          standardFields={csvFields}
          onImport={handleCSVImport}
          templateFileName="reviewers_template.csv"
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reviewers</h1>
          <p className="text-sm text-muted-foreground">Manage registered reviewers for this event</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Auto-assign abstracts to all active reviewers? This will distribute unassigned abstracts evenly.")) {
                autoAssign.mutate()
              }
            }}
            disabled={autoAssign.isPending}
          >
            {autoAssign.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shuffle className="h-4 w-4 mr-2" />}
            Auto Assign
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Reassign all unreviewed abstracts to other reviewers?")) {
                reassignPending.mutate()
              }
            }}
            disabled={reassignPending.isPending}
          >
            {reassignPending.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Reassign Pending
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Clear ALL abstract assignments from all reviewers?")) {
                clearAssignments.mutate()
              }
            }}
            disabled={clearAssignments.isPending}
          >
            {clearAssignments.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
            Clear
          </Button>
          <Button variant="outline" onClick={() => {
            setEditForm({
              name: "", email: "", phone: "", institution: "", city: "",
              specialty: "", years_of_experience: "", status: "active", notes: "",
            })
            setShowAddDialog(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Reviewer
          </Button>
          <Button onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">Total Reviewers</span>
          </div>
          <p className="text-3xl font-bold mt-2">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-green-500" />
            <span className="text-sm text-muted-foreground">Active</span>
          </div>
          <p className="text-3xl font-bold mt-2 text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-muted-foreground">Reviews Submitted</span>
          </div>
          <p className="text-3xl font-bold mt-2 text-blue-600">{stats.totalReviews}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            <span className="text-sm text-muted-foreground">Avg Reviews/Reviewer</span>
          </div>
          <p className="text-3xl font-bold mt-2 text-purple-600">{stats.avgReviews}</p>
        </div>
      </div>

      {/* Restrict toggle */}
      <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-medium text-sm">Restrict portal to registered reviewers</p>
            <p className="text-xs text-muted-foreground">
              When enabled, only emails registered here can access the reviewer portal
            </p>
          </div>
        </div>
        <Switch
          checked={settings?.restrict_reviewers ?? false}
          onCheckedChange={(checked) => toggleRestrict.mutate(checked)}
          disabled={toggleRestrict.isPending}
        />
      </div>

      {/* Review Deadline */}
      <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-blue-600" />
          <div>
            <p className="font-medium text-sm">Review Deadline</p>
            <p className="text-xs text-muted-foreground">
              Unreviewed abstracts will be auto-reassigned after this deadline
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="datetime-local"
            className="w-[220px]"
            value={settings?.review_deadline ? new Date(settings.review_deadline).toISOString().slice(0, 16) : ""}
            onChange={(e) => {
              const val = e.target.value
              updateDeadline.mutate(val ? new Date(val).toISOString() : null)
            }}
          />
          {settings?.review_deadline && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateDeadline.mutate(null)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, institution..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filtered.length} reviewer{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No reviewers found</h3>
          <p className="text-muted-foreground mb-4">
            {reviewers.length === 0
              ? "Import reviewers from a CSV file to get started"
              : "Try adjusting your search or filters"}
          </p>
          {reviewers.length === 0 && (
            <Button onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Institution</th>
                  <th className="text-left px-4 py-3 font-medium">Specialty</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Assigned</th>
                  <th className="text-center px-4 py-3 font-medium">Pending</th>
                  <th className="text-center px-4 py-3 font-medium">Reviews</th>
                  <th className="text-center px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((reviewer) => (
                  <tr key={reviewer.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{reviewer.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{reviewer.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{reviewer.institution || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{reviewer.specialty || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={reviewer.status === "active" ? "default" : "secondary"}>
                        {reviewer.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{(reviewer.assigned_abstracts || []).length}</td>
                    <td className="px-4 py-3 text-center font-medium text-amber-600">
                      {Math.max(0, (reviewer.assigned_abstracts || []).length - reviewer.review_count)}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{reviewer.review_count}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(reviewer)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Remove this reviewer?")) {
                              deleteReviewer.mutate(reviewer.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Reviewer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Reviewer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Full name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email *</label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="email@example.com"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">City</label>
                <Input
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Institution</label>
              <Input
                value={editForm.institution}
                onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Specialty</label>
                <Input
                  value={editForm.specialty}
                  onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Years of Experience</label>
                <Input
                  value={editForm.years_of_experience}
                  onChange={(e) => setEditForm({ ...editForm, years_of_experience: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Notes (Internal)</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
                placeholder="Internal notes..."
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              onClick={() => addReviewer.mutate(editForm)}
              disabled={!editForm.name.trim() || !editForm.email.trim() || addReviewer.isPending}
            >
              {addReviewer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Reviewer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingReviewer} onOpenChange={(open) => !open && setEditingReviewer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Reviewer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">City</label>
                <Input
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Institution</label>
              <Input
                value={editForm.institution}
                onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Specialty</label>
                <Input
                  value={editForm.specialty}
                  onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Years of Experience</label>
                <Input
                  value={editForm.years_of_experience}
                  onChange={(e) => setEditForm({ ...editForm, years_of_experience: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Notes (Internal)</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReviewer(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateReviewer.isPending}>
              {updateReviewer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
