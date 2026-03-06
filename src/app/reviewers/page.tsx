"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Search,
  Loader2,
  Users,
  UserCheck,
  Upload,
  Download,
  Plus,
  Trash2,
  Mail,
  CheckCircle,
  X,
  Phone,
  Building,
  MapPin,
  Clock,
  FileText,
  Send,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { CSVImportDynamic } from "@/components/ui/csv-import-dynamic"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type Reviewer = {
  id: string
  name: string
  email: string
  phone: string | null
  institution: string | null
  city: string | null
  specialty: string | null
  years_of_experience: string | null
  status: string
  notes: string | null
  form_token: string | null
  form_completed_at: string | null
  created_at: string
  updated_at: string
}

const csvFields = [
  { key: "name", label: "Name", required: true, description: "Full name of the reviewer" },
  { key: "email", label: "Email", required: true, description: "Email address" },
  { key: "phone", label: "Phone Number", description: "Contact number" },
  { key: "institution", label: "Institution/Hospital", description: "Organization name" },
  { key: "city", label: "City", description: "City location" },
  { key: "specialty", label: "Specialty Interests", description: "Areas of expertise" },
  { key: "years_of_experience", label: "Years of Experience", description: "Years in the field" },
  { key: "status", label: "Availability Status", description: "Yes/Maybe = active, No = inactive" },
  { key: "notes", label: "Notes (Internal)", description: "Internal notes" },
]

export default function ReviewersPoolPage() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showImport, setShowImport] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedReviewer, setSelectedReviewer] = useState<Reviewer | null>(null)
  const [isEditing, setIsEditing] = useState(false)
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

  // Fetch all reviewers from global pool
  const { data: reviewers = [], isLoading } = useQuery({
    queryKey: ["reviewers-pool"],
    queryFn: async () => {
      const res = await fetch("/api/reviewers-pool")
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json() as Promise<Reviewer[]>
    },
  })

  // Add/update reviewer mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof editForm & { id?: string }) => {
      const method = data.id ? "PUT" : "POST"
      const res = await fetch("/api/reviewers-pool", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      setShowAddDialog(false)
      setIsEditing(false)
      if (selectedReviewer) {
        setSelectedReviewer(data)
      }
      toast.success(selectedReviewer ? "Reviewer updated" : "Reviewer added")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete reviewer mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reviewers-pool?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      setSelectedReviewer(null)
      toast.success("Reviewer deleted")
    },
    onError: () => {
      toast.error("Failed to delete reviewer")
    },
  })

  // Clear all mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/reviewers-pool?id=all`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to clear")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      setSelectedReviewer(null)
      toast.success("All reviewers cleared")
    },
    onError: () => {
      toast.error("Failed to clear reviewers")
    },
  })

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const res = await fetch("/api/reviewers-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Import failed")
      }
      return res.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      setShowImport(false)
      toast.success(`Imported ${result.success} reviewers`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Filter reviewers
  const filtered = useMemo(() => {
    return reviewers.filter((r) => {
      // Status filter
      if (statusFilter === "active" && r.status !== "active") return false
      if (statusFilter === "inactive" && r.status !== "inactive") return false
      if (statusFilter === "pending" && !(r.form_token && !r.form_completed_at)) return false
      if (statusFilter === "completed" && !r.form_completed_at) return false

      // Search filter
      if (search) {
        const s = search.toLowerCase()
        if (
          !r.name?.toLowerCase().includes(s) &&
          !r.email?.toLowerCase().includes(s) &&
          !r.institution?.toLowerCase().includes(s) &&
          !r.specialty?.toLowerCase().includes(s) &&
          !r.city?.toLowerCase().includes(s)
        ) {
          return false
        }
      }
      return true
    })
  }, [reviewers, search, statusFilter])

  // Stats
  const stats = useMemo(() => ({
    total: reviewers.length,
    active: reviewers.filter((r) => r.status === "active").length,
    pending: reviewers.filter((r) => r.form_token && !r.form_completed_at).length,
    completed: reviewers.filter((r) => r.form_completed_at).length,
  }), [reviewers])

  const resetForm = () => {
    setEditForm({
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
  }

  const startEditing = () => {
    if (selectedReviewer) {
      setEditForm({
        name: selectedReviewer.name,
        email: selectedReviewer.email,
        phone: selectedReviewer.phone || "",
        institution: selectedReviewer.institution || "",
        city: selectedReviewer.city || "",
        specialty: selectedReviewer.specialty || "",
        years_of_experience: selectedReviewer.years_of_experience || "",
        status: selectedReviewer.status,
        notes: selectedReviewer.notes || "",
      })
      setIsEditing(true)
    }
  }

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.error("No reviewers to export")
      return
    }
    const headers = ["Name", "Email", "Phone", "Institution", "City", "Specialty", "Years of Experience", "Status", "Form Status", "Notes"]
    const rows = filtered.map((r) => [
      `"${r.name || ""}"`,
      r.email,
      r.phone || "",
      `"${r.institution || ""}"`,
      r.city || "",
      `"${r.specialty || ""}"`,
      r.years_of_experience || "",
      r.status,
      r.form_completed_at ? "Completed" : r.form_token ? "Pending" : "N/A",
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ])
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reviewers-pool-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    toast.success(`Exported ${filtered.length} reviewers`)
  }

  const getFormUrl = (token: string) => `${window.location.origin}/reviewer-form/${token}`

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reviewers Pool</h1>
            <p className="text-sm text-muted-foreground">Global pool of reviewers across all events</p>
          </div>
          <div className="flex items-center gap-2">
            {reviewers.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (confirm(`Delete ALL ${reviewers.length} reviewers? This cannot be undone.`)) {
                    clearAllMutation.mutate()
                  }
                }}
                disabled={clearAllMutation.isPending}
              >
                {clearAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setShowAddDialog(true) }}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mt-4">
          <button
            onClick={() => setStatusFilter("all")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${statusFilter === "all" ? "bg-primary/10 text-primary" : "hover:bg-gray-100"}`}
          >
            <Users className="h-4 w-4" />
            <span className="font-medium">{stats.total}</span>
            <span className="text-sm text-muted-foreground">Total</span>
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${statusFilter === "active" ? "bg-green-100 text-green-700" : "hover:bg-gray-100"}`}
          >
            <UserCheck className="h-4 w-4" />
            <span className="font-medium">{stats.active}</span>
            <span className="text-sm text-muted-foreground">Active</span>
          </button>
          <button
            onClick={() => setStatusFilter("pending")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${statusFilter === "pending" ? "bg-yellow-100 text-yellow-700" : "hover:bg-gray-100"}`}
          >
            <Mail className="h-4 w-4" />
            <span className="font-medium">{stats.pending}</span>
            <span className="text-sm text-muted-foreground">Pending</span>
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${statusFilter === "completed" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"}`}
          >
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">{stats.completed}</span>
            <span className="text-sm text-muted-foreground">Completed</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* List */}
        <div className="w-1/2 border-r flex flex-col bg-gray-50">
          {/* Search */}
          <div className="p-3 border-b bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reviewers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Users className="h-12 w-12 mb-2 opacity-50" />
                <p>{reviewers.length === 0 ? "No reviewers yet" : "No matching reviewers"}</p>
                {reviewers.length === 0 && (
                  <Button variant="link" onClick={() => setShowImport(true)}>
                    Import CSV
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((reviewer) => (
                  <button
                    key={reviewer.id}
                    onClick={() => { setSelectedReviewer(reviewer); setIsEditing(false) }}
                    className={`w-full text-left p-4 hover:bg-white transition-colors ${
                      selectedReviewer?.id === reviewer.id ? "bg-white border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{reviewer.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{reviewer.email}</p>
                        {reviewer.institution && (
                          <p className="text-xs text-muted-foreground truncate mt-1">{reviewer.institution}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-2">
                        <Badge variant={reviewer.status === "active" ? "default" : "secondary"} className="text-xs">
                          {reviewer.status}
                        </Badge>
                        {reviewer.form_token && !reviewer.form_completed_at && (
                          <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-2 border-t bg-white text-xs text-muted-foreground text-center">
            {filtered.length} of {reviewers.length} reviewers
          </div>
        </div>

        {/* Detail Panel */}
        <div className="w-1/2 bg-white overflow-auto">
          {selectedReviewer ? (
            <div className="p-6">
              {isEditing ? (
                /* Edit Form */
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Edit Reviewer</h2>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input
                        value={editForm.city}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Institution</Label>
                    <Input
                      value={editForm.institution}
                      onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Specialty</Label>
                      <Input
                        value={editForm.specialty}
                        onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Years of Experience</Label>
                      <Input
                        value={editForm.years_of_experience}
                        onChange={(e) => setEditForm({ ...editForm, years_of_experience: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Status</Label>
                    <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      onClick={() => saveMutation.mutate({ ...editForm, id: selectedReviewer.id })}
                      disabled={saveMutation.isPending}
                      className="flex-1"
                    >
                      {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                /* Detail View */
                <div>
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold">{selectedReviewer.name}</h2>
                      <p className="text-muted-foreground">{selectedReviewer.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={startEditing}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm("Delete this reviewer?")) {
                            deleteMutation.mutate(selectedReviewer.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Status */}
                    <div className="flex gap-2">
                      <Badge variant={selectedReviewer.status === "active" ? "default" : "secondary"}>
                        {selectedReviewer.status}
                      </Badge>
                      {selectedReviewer.form_completed_at ? (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Form Completed
                        </Badge>
                      ) : selectedReviewer.form_token ? (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                          <Mail className="h-3 w-3 mr-1" />
                          Form Pending
                        </Badge>
                      ) : null}
                    </div>

                    {/* Contact Info */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      {selectedReviewer.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedReviewer.phone}</span>
                        </div>
                      )}
                      {selectedReviewer.institution && (
                        <div className="flex items-center gap-3">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedReviewer.institution}</span>
                        </div>
                      )}
                      {selectedReviewer.city && (
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedReviewer.city}</span>
                        </div>
                      )}
                      {selectedReviewer.years_of_experience && (
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedReviewer.years_of_experience} years experience</span>
                        </div>
                      )}
                    </div>

                    {/* Specialty */}
                    {selectedReviewer.specialty && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Specialty</h3>
                        <p className="text-sm">{selectedReviewer.specialty}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedReviewer.notes && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Internal Notes</h3>
                        <p className="text-sm bg-yellow-50 p-3 rounded-lg">{selectedReviewer.notes}</p>
                      </div>
                    )}

                    {/* Form Link */}
                    {selectedReviewer.form_token && !selectedReviewer.form_completed_at && (
                      <div className="border-t pt-4 mt-4">
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Form Link</h3>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={getFormUrl(selectedReviewer.form_token)}
                            className="text-xs font-mono"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(getFormUrl(selectedReviewer.form_token!))
                              toast.success("Link copied!")
                            }}
                          >
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(getFormUrl(selectedReviewer.form_token!), "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="border-t pt-4 mt-4 text-xs text-muted-foreground">
                      <p>Added: {new Date(selectedReviewer.created_at).toLocaleDateString()}</p>
                      {selectedReviewer.updated_at !== selectedReviewer.created_at && (
                        <p>Updated: {new Date(selectedReviewer.updated_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="h-12 w-12 mb-2 opacity-50" />
              <p>Select a reviewer to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Reviewer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        if (!open) resetForm()
        setShowAddDialog(open)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Reviewer</DialogTitle>
            <DialogDescription>
              Add a new reviewer to the pool. If specialty is empty, a form will be sent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Institution</Label>
                <Input
                  value={editForm.institution}
                  onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Specialty</Label>
              <Input
                value={editForm.specialty}
                onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                placeholder="Leave empty to send form"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate(editForm)}
              disabled={saveMutation.isPending || !editForm.name || !editForm.email}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Reviewer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <CSVImportDynamic
            title="Import Reviewers"
            description="Upload a CSV file with reviewer information"
            standardFields={csvFields}
            templateFileName="reviewers-template.csv"
            onImport={async (data) => {
              const result = await importMutation.mutateAsync(data)
              return { success: result.success || 0, failed: result.failed || 0, errors: [] }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
