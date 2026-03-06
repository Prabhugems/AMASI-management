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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Search,
  Loader2,
  Users,
  UserCheck,
  Upload,
  Download,
  Plus,
  Pencil,
  Trash2,
  Mail,
  CheckCircle,
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
  const [showImport, setShowImport] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([])
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      setShowAddDialog(false)
      setEditingReviewer(null)
      toast.success(editingReviewer ? "Reviewer updated" : "Reviewer added")
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
      toast.success("Reviewer deleted")
    },
    onError: () => {
      toast.error("Failed to delete reviewer")
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
  }, [reviewers, search])

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
    setEditingReviewer(null)
  }

  const openEdit = (reviewer: Reviewer) => {
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
    setShowAddDialog(true)
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

  const toggleSelectReviewer = (id: string) => {
    setSelectedReviewers(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedReviewers.length === filtered.length) {
      setSelectedReviewers([])
    } else {
      setSelectedReviewers(filtered.map(r => r.id))
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reviewers Pool</h1>
          <p className="text-sm text-muted-foreground">Global pool of reviewers across all events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => {
            resetForm()
            setShowAddDialog(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Reviewer
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
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
            <Mail className="h-5 w-5 text-yellow-500" />
            <span className="text-sm text-muted-foreground">Form Pending</span>
          </div>
          <p className="text-3xl font-bold mt-2 text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-muted-foreground">Form Completed</span>
          </div>
          <p className="text-3xl font-bold mt-2 text-blue-600">{stats.completed}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, institution, specialty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} of {reviewers.length} reviewers
        </span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedReviewers.length === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Institution</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Experience</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No reviewers found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((reviewer) => (
                <TableRow key={reviewer.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedReviewers.includes(reviewer.id)}
                      onCheckedChange={() => toggleSelectReviewer(reviewer.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{reviewer.name}</TableCell>
                  <TableCell className="text-sm">{reviewer.email}</TableCell>
                  <TableCell className="text-sm">{reviewer.institution || "-"}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate" title={reviewer.specialty || ""}>
                    {reviewer.specialty || "-"}
                  </TableCell>
                  <TableCell className="text-sm">{reviewer.years_of_experience || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={reviewer.status === "active" ? "default" : "secondary"}>
                      {reviewer.status}
                    </Badge>
                    {reviewer.form_token && !reviewer.form_completed_at && (
                      <Badge variant="outline" className="ml-1 text-yellow-600">
                        Form Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(reviewer)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this reviewer?")) {
                            deleteMutation.mutate(reviewer.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        if (!open) {
          resetForm()
        }
        setShowAddDialog(open)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingReviewer ? "Edit Reviewer" : "Add Reviewer"}</DialogTitle>
            <DialogDescription>
              {editingReviewer
                ? "Update reviewer details"
                : "Add a new reviewer. If specialty is empty, a form will be sent to collect details."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Dr. John Doe"
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="9876543210"
                />
              </div>
              <div>
                <Label>Institution</Label>
                <Input
                  value={editForm.institution}
                  onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                  placeholder="Hospital/College name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City</Label>
                <Input
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  placeholder="Mumbai"
                />
              </div>
              <div>
                <Label>Years of Experience</Label>
                <Input
                  value={editForm.years_of_experience}
                  onChange={(e) => setEditForm({ ...editForm, years_of_experience: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>
            <div>
              <Label>Specialty</Label>
              <Input
                value={editForm.specialty}
                onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                placeholder="General Surgery, Hernia Surgery, etc."
              />
            </div>
            <div>
              <Label>Notes (Internal)</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Internal notes about this reviewer"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate(editingReviewer ? { ...editForm, id: editingReviewer.id } : editForm)}
              disabled={saveMutation.isPending || !editForm.name || !editForm.email}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingReviewer ? "Update" : "Add Reviewer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import Reviewers</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import reviewers to the global pool
            </DialogDescription>
          </DialogHeader>
          <CSVImportDynamic
            fields={csvFields}
            onImport={async (data) => {
              const result = await importMutation.mutateAsync(data)
              return { success: result.success || 0, failed: result.failed || 0, errors: [] }
            }}
            isLoading={importMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
