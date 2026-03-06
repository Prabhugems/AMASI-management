"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Search,
  Loader2,
  Users,
  UserCheck,
  Upload,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Building2,
} from "lucide-react"
import { toast } from "sonner"
import { CSVImportDynamic } from "@/components/ui/csv-import-dynamic"
import { Label } from "@/components/ui/label"

type Reviewer = {
  id: string
  event_id: string
  event_name?: string
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
  review_count?: number
  created_at: string
}

type Event = {
  id: string
  name: string
  short_name: string
}

const csvFields = [
  { key: "name", label: "Name", required: true, description: "Full name of the reviewer" },
  { key: "email", label: "Email", required: true, description: "Email address" },
  { key: "phone", label: "Phone Number", description: "Contact number" },
  { key: "institution", label: "Institution/Hospital", description: "Organization name" },
  { key: "city", label: "City", description: "City location" },
  { key: "specialty", label: "Specialty Interests", description: "Areas of expertise (comma-separated)" },
  { key: "years_of_experience", label: "Years of Experience", description: "Years in the field" },
  { key: "status", label: "Availability Status", description: "Yes/Maybe = active, No = inactive" },
  { key: "notes", label: "Notes (Internal)", description: "Internal notes" },
]

export default function ReviewersPage() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [eventFilter, setEventFilter] = useState("all")
  const [showImport, setShowImport] = useState(false)
  const [importEventId, setImportEventId] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([])
  const [copyToEventId, setCopyToEventId] = useState("")
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
    event_id: "",
  })

  // Fetch all events
  const { data: events = [] } = useQuery({
    queryKey: ["all-events"],
    queryFn: async () => {
      const res = await fetch("/api/events")
      if (!res.ok) throw new Error("Failed to fetch events")
      const data = await res.json()
      return (data.events || data) as Event[]
    },
  })

  // Fetch all reviewers across all events
  const { data: allReviewers = [], isLoading } = useQuery({
    queryKey: ["all-reviewers"],
    queryFn: async () => {
      // Fetch reviewers for each event
      const reviewerPromises = events.map(async (event) => {
        const res = await fetch(`/api/abstract-reviewers/${event.id}`)
        if (!res.ok) return []
        const reviewers = await res.json()
        return reviewers.map((r: Reviewer) => ({ ...r, event_name: event.name }))
      })
      const results = await Promise.all(reviewerPromises)
      return results.flat() as Reviewer[]
    },
    enabled: events.length > 0,
  })

  // Add reviewer mutation
  const addReviewer = useMutation({
    mutationFn: async (data: typeof editForm) => {
      if (!data.event_id) throw new Error("Please select an event")
      const res = await fetch(`/api/abstract-reviewers/${data.event_id}`, {
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
      queryClient.invalidateQueries({ queryKey: ["all-reviewers"] })
      toast.success("Reviewer added")
      setShowAddDialog(false)
      resetForm()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Update reviewer mutation
  const updateReviewer = useMutation({
    mutationFn: async (data: { id: string; event_id: string } & typeof editForm) => {
      const res = await fetch(`/api/abstract-reviewers/${data.event_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update reviewer")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-reviewers"] })
      toast.success("Reviewer updated")
      setEditingReviewer(null)
    },
    onError: () => toast.error("Failed to update reviewer"),
  })

  // Delete reviewer mutation
  const deleteReviewer = useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete reviewer")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-reviewers"] })
      toast.success("Reviewer removed")
    },
    onError: () => toast.error("Failed to remove reviewer"),
  })

  // Copy reviewers to another event
  const copyReviewers = useMutation({
    mutationFn: async ({ reviewerIds, targetEventId }: { reviewerIds: string[]; targetEventId: string }) => {
      const reviewersToCopy = allReviewers.filter(r => reviewerIds.includes(r.id))
      const res = await fetch(`/api/abstract-reviewers/${targetEventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewersToCopy.map(r => ({
          name: r.name,
          email: r.email,
          phone: r.phone,
          institution: r.institution,
          city: r.city,
          specialty: r.specialty,
          years_of_experience: r.years_of_experience,
          status: r.status,
          notes: r.notes,
        }))),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to copy reviewers")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["all-reviewers"] })
      toast.success(`Copied ${data.success} reviewers to event`)
      setShowCopyDialog(false)
      setSelectedReviewers([])
      setCopyToEventId("")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resetForm = () => {
    setEditForm({
      name: "", email: "", phone: "", institution: "", city: "",
      specialty: "", years_of_experience: "", status: "active", notes: "", event_id: "",
    })
  }

  // Filtered reviewers
  const filtered = useMemo(() => {
    return allReviewers.filter((r) => {
      const matchesSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase()) ||
        (r.institution || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.specialty || "").toLowerCase().includes(search.toLowerCase())

      const matchesEvent = eventFilter === "all" || r.event_id === eventFilter
      return matchesSearch && matchesEvent
    })
  }, [allReviewers, search, eventFilter])

  // Stats
  const stats = useMemo(() => {
    const uniqueEmails = new Set(allReviewers.map(r => r.email.toLowerCase()))
    const active = allReviewers.filter(r => r.status === "active").length
    return {
      total: allReviewers.length,
      unique: uniqueEmails.size,
      active,
      events: events.length,
    }
  }, [allReviewers, events])

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
      event_id: reviewer.event_id,
    })
  }

  const handleCSVImport = async (data: Record<string, any>[]) => {
    if (!importEventId) throw new Error("Please select an event first")

    // Transform status values
    const transformed = data.map(r => ({
      ...r,
      status: r.status?.toLowerCase() === "yes" || r.status?.toLowerCase() === "maybe" ? "active" :
              r.status?.toLowerCase() === "no" ? "inactive" : r.status || "active"
    }))

    const res = await fetch(`/api/abstract-reviewers/${importEventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transformed),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || "Import failed")
    }
    const result = await res.json()
    queryClient.invalidateQueries({ queryKey: ["all-reviewers"] })
    return result
  }

  const toggleSelectReviewer = (id: string) => {
    setSelectedReviewers(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const selectAllFiltered = () => {
    const allIds = filtered.map(r => r.id)
    setSelectedReviewers(allIds)
  }

  if (showImport) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Button variant="outline" onClick={() => setShowImport(false)} className="mb-4">
          &larr; Back to Reviewers
        </Button>

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Label className="text-sm font-medium">Select Event to Import Into *</Label>
          <Select value={importEventId} onValueChange={setImportEventId}>
            <SelectTrigger className="mt-2 w-full max-w-md">
              <SelectValue placeholder="Select an event..." />
            </SelectTrigger>
            <SelectContent>
              {events.map(event => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">
            Reviewers will be imported into this event. You can copy them to other events later.
          </p>
        </div>

        {importEventId ? (
          <CSVImportDynamic
            title="Import Reviewers"
            description="Upload a CSV file with reviewer details. Status values: Yes/Maybe = active, No = inactive"
            standardFields={csvFields}
            onImport={handleCSVImport}
            templateFileName="reviewers_template.csv"
          />
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Please select an event above to start importing</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reviewers Pool</h1>
          <p className="text-sm text-muted-foreground">Manage reviewers across all events</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedReviewers.length > 0 && (
            <Button variant="outline" onClick={() => setShowCopyDialog(true)}>
              <Copy className="h-4 w-4 mr-2" />
              Copy {selectedReviewers.length} to Event
            </Button>
          )}
          <Button variant="outline" onClick={() => {
            resetForm()
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
            <span className="text-sm text-muted-foreground">Total Entries</span>
          </div>
          <p className="text-3xl font-bold mt-2">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-muted-foreground">Unique Reviewers</span>
          </div>
          <p className="text-3xl font-bold mt-2 text-blue-600">{stats.unique}</p>
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
            <Building2 className="h-5 w-5 text-purple-500" />
            <span className="text-sm text-muted-foreground">Events</span>
          </div>
          <p className="text-3xl font-bold mt-2 text-purple-600">{stats.events}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, institution, specialty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by event" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {events.map(event => (
              <SelectItem key={event.id} value={event.id}>
                {event.short_name || event.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={selectAllFiltered}>
          Select All ({filtered.length})
        </Button>
        {selectedReviewers.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedReviewers([])}>
            Clear Selection
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {filtered.length} reviewer{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No reviewers found</h3>
          <p className="text-muted-foreground mb-4">
            {allReviewers.length === 0
              ? "Import reviewers from a CSV file to get started"
              : "Try adjusting your search or filters"}
          </p>
          {allReviewers.length === 0 && (
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
                  <th className="text-left px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedReviewers.length === filtered.length && filtered.length > 0}
                      onChange={() => {
                        if (selectedReviewers.length === filtered.length) {
                          setSelectedReviewers([])
                        } else {
                          selectAllFiltered()
                        }
                      }}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Institution</th>
                  <th className="text-left px-4 py-3 font-medium">Specialty</th>
                  <th className="text-left px-4 py-3 font-medium">Event</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((reviewer) => (
                  <tr key={reviewer.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedReviewers.includes(reviewer.id)}
                        onChange={() => toggleSelectReviewer(reviewer.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{reviewer.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{reviewer.email}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {reviewer.institution || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {reviewer.specialty || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {reviewer.event_name || "Unknown"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={reviewer.status === "active" ? "default" : "secondary"}>
                        {reviewer.status}
                      </Badge>
                    </td>
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
                              deleteReviewer.mutate({ id: reviewer.id, eventId: reviewer.event_id })
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
            <DialogDescription>Add a new reviewer to an event</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Event *</Label>
              <Select value={editForm.event_id} onValueChange={(v) => setEditForm({ ...editForm, event_id: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select event..." />
                </SelectTrigger>
                <SelectContent>
                  {events.map(event => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Full name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="email@example.com"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Institution</Label>
              <Input
                value={editForm.institution}
                onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Specialty</Label>
              <Input
                value={editForm.specialty}
                onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                placeholder="e.g., General & GI Surgery, Hernia Surgery"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              onClick={() => addReviewer.mutate(editForm)}
              disabled={!editForm.name.trim() || !editForm.email.trim() || !editForm.event_id || addReviewer.isPending}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Institution</Label>
              <Input
                value={editForm.institution}
                onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Specialty</Label>
              <Input
                value={editForm.specialty}
                onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Status</Label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReviewer(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingReviewer) {
                  updateReviewer.mutate({ id: editingReviewer.id, ...editForm })
                }
              }}
              disabled={updateReviewer.isPending}
            >
              {updateReviewer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy to Event Dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Reviewers to Event</DialogTitle>
            <DialogDescription>
              Copy {selectedReviewers.length} selected reviewer(s) to another event
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Target Event *</Label>
              <Select value={copyToEventId} onValueChange={setCopyToEventId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select event..." />
                </SelectTrigger>
                <SelectContent>
                  {events.map(event => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Existing reviewers with the same email will be updated.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>Cancel</Button>
            <Button
              onClick={() => copyReviewers.mutate({ reviewerIds: selectedReviewers, targetEventId: copyToEventId })}
              disabled={!copyToEventId || copyReviewers.isPending}
            >
              {copyReviewers.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Copy Reviewers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
