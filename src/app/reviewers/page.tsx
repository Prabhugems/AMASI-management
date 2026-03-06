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
  Award,
  GraduationCap,
  BadgeCheck,
  Crown,
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
  // AMASI membership/faculty info (enriched from API)
  amasi_membership_number: string | null
  is_amasi_member: boolean
  member_status: string | null
  is_amasi_faculty: boolean
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
                    className={`w-full text-left p-4 hover:bg-white transition-all ${
                      selectedReviewer?.id === reviewer.id
                        ? "bg-white border-l-4 border-l-primary shadow-sm"
                        : "border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold truncate">{reviewer.name}</p>
                          {reviewer.is_amasi_member && (
                            <Award className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" title="AMASI Member" />
                          )}
                          {reviewer.is_amasi_faculty && (
                            <GraduationCap className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" title="AMASI Faculty" />
                          )}
                          {reviewer.form_completed_at && (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" title="Form Completed" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{reviewer.email}</p>
                        {reviewer.institution && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            <Building className="h-3 w-3 inline mr-1" />
                            {reviewer.institution}
                          </p>
                        )}
                        {reviewer.specialty && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {reviewer.specialty.split(",").slice(0, 2).map((s, i) => (
                              <span
                                key={i}
                                className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700"
                              >
                                {s.trim()}
                              </span>
                            ))}
                            {reviewer.specialty.split(",").length > 2 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{reviewer.specialty.split(",").length - 2} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant={reviewer.status === "active" ? "default" : "secondary"}
                          className={`text-[10px] ${reviewer.status === "active" ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}`}
                        >
                          {reviewer.status}
                        </Badge>
                        {reviewer.form_token && !reviewer.form_completed_at && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50">
                            Form Pending
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
                  {/* Header Card */}
                  <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-blue-50 rounded-xl p-5 mb-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                          {selectedReviewer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{selectedReviewer.name}</h2>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {selectedReviewer.email}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge
                              className={`text-xs ${selectedReviewer.status === "active"
                                ? "bg-green-100 text-green-700 hover:bg-green-100"
                                : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {selectedReviewer.status === "active" ? "Active" : "Inactive"}
                            </Badge>
                            {selectedReviewer.is_amasi_member && (
                              <Badge className="bg-purple-100 text-purple-700 text-xs">
                                <Award className="h-3 w-3 mr-1" />
                                AMASI Member
                              </Badge>
                            )}
                            {selectedReviewer.is_amasi_faculty && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs">
                                <GraduationCap className="h-3 w-3 mr-1" />
                                Faculty
                              </Badge>
                            )}
                            {selectedReviewer.form_completed_at ? (
                              <Badge className="bg-blue-100 text-blue-700 text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            ) : selectedReviewer.form_token ? (
                              <Badge className="bg-amber-100 text-amber-700 text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            ) : null}
                          </div>
                        </div>
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
                  </div>

                  <div className="space-y-5">

                    {/* Contact Info Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {selectedReviewer.phone && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Phone className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">Phone</span>
                          </div>
                          <p className="text-sm font-medium">{selectedReviewer.phone}</p>
                        </div>
                      )}
                      {selectedReviewer.city && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">City</span>
                          </div>
                          <p className="text-sm font-medium">{selectedReviewer.city}</p>
                        </div>
                      )}
                      {selectedReviewer.institution && (
                        <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Building className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">Institution</span>
                          </div>
                          <p className="text-sm font-medium">{selectedReviewer.institution}</p>
                        </div>
                      )}
                      {selectedReviewer.years_of_experience && (
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 col-span-2">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">Experience</span>
                          </div>
                          <p className="text-sm font-medium">{selectedReviewer.years_of_experience} years</p>
                        </div>
                      )}
                    </div>

                    {/* AMASI Membership & Faculty */}
                    {(selectedReviewer.is_amasi_member || selectedReviewer.is_amasi_faculty) && (
                      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Crown className="h-5 w-5 text-amber-600" />
                          <h3 className="font-semibold text-amber-800">AMASI Association</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {selectedReviewer.is_amasi_member && (
                            <div className="bg-white/70 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Award className="h-4 w-4 text-purple-600" />
                                <span className="text-xs font-medium text-purple-700">Member</span>
                              </div>
                              {selectedReviewer.amasi_membership_number ? (
                                <p className="text-sm font-bold text-purple-800">
                                  #{selectedReviewer.amasi_membership_number}
                                </p>
                              ) : (
                                <p className="text-sm text-purple-600">Active Member</p>
                              )}
                              {selectedReviewer.member_status && (
                                <Badge className="mt-1 text-[10px] bg-purple-100 text-purple-700">
                                  {selectedReviewer.member_status}
                                </Badge>
                              )}
                            </div>
                          )}
                          {selectedReviewer.is_amasi_faculty && (
                            <div className="bg-white/70 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <GraduationCap className="h-4 w-4 text-orange-600" />
                                <span className="text-xs font-medium text-orange-700">Faculty</span>
                              </div>
                              <p className="text-sm font-bold text-orange-800">AMASI Faculty</p>
                              <Badge className="mt-1 text-[10px] bg-orange-100 text-orange-700">
                                <BadgeCheck className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Specialty Tags */}
                    {selectedReviewer.specialty && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Specialties</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedReviewer.specialty.split(",").map((s, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                            >
                              {s.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedReviewer.notes && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Internal Notes</h3>
                        <p className="text-sm bg-yellow-50 p-3 rounded-lg">{selectedReviewer.notes}</p>
                      </div>
                    )}

                    {/* Form Section */}
                    {selectedReviewer.form_token && (
                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium text-muted-foreground">Registration Form</h3>
                          {selectedReviewer.form_completed_at ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Completed {new Date(selectedReviewer.form_completed_at).toLocaleDateString()}
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                              <Clock className="h-3 w-3 mr-1" />
                              Awaiting Response
                            </Badge>
                          )}
                        </div>

                        {!selectedReviewer.form_completed_at && (
                          <>
                            <div className="bg-gray-50 rounded-lg p-3 mb-3">
                              <p className="text-xs text-muted-foreground mb-2">Share this link with the reviewer:</p>
                              <code className="text-xs bg-white px-2 py-1 rounded border block truncate">
                                {getFormUrl(selectedReviewer.form_token)}
                              </code>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  navigator.clipboard.writeText(getFormUrl(selectedReviewer.form_token!))
                                  toast.success("Link copied!")
                                }}
                              >
                                Copy Link
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(getFormUrl(selectedReviewer.form_token!), "_blank")}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => window.open(`mailto:${selectedReviewer.email}?subject=AMASI Reviewer Registration&body=Please complete your registration: ${getFormUrl(selectedReviewer.form_token!)}`)}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Email
                              </Button>
                            </div>
                          </>
                        )}
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
