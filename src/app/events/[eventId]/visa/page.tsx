"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  Search,
  Download,
  FileText,
  Send,
  Stamp,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type VisaRequest = {
  id: string
  applicant_name: string
  applicant_email: string | null
  passport_number: string | null
  nationality: string | null
  passport_expiry: string | null
  visa_type: string
  embassy_country: string | null
  travel_dates_from: string | null
  travel_dates_to: string | null
  letter_type: string
  letter_status: string
  letter_url: string | null
  letter_generated_at: string | null
  letter_sent_at: string | null
  registration_id: string | null
  notes: string | null
  created_at: string
  registrations?: { id: string; attendee_name: string; attendee_email: string } | null
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "bg-amber-500" },
  { value: "generated", label: "Generated", color: "bg-blue-500" },
  { value: "sent", label: "Sent", color: "bg-green-500" },
]

const emptyForm = {
  applicant_name: "",
  applicant_email: "",
  passport_number: "",
  nationality: "",
  passport_expiry: "",
  visa_type: "conference",
  embassy_country: "",
  travel_dates_from: "",
  travel_dates_to: "",
  letter_type: "invitation",
  notes: "",
}

export default function VisaPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [showDialog, setShowDialog] = useState(false)
  const [editingRequest, setEditingRequest] = useState<VisaRequest | null>(null)
  const [deleteRequest, setDeleteRequest] = useState<VisaRequest | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { data: requests, isLoading } = useQuery({
    queryKey: ["visa-requests", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/visa`)
      if (!res.ok) throw new Error("Failed to fetch visa requests")
      return res.json() as Promise<VisaRequest[]>
    },
  })

  const createRequest = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`/api/events/${eventId}/visa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to create visa request")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Visa request created")
      queryClient.invalidateQueries({ queryKey: ["visa-requests", eventId] })
      setShowDialog(false)
      setForm(emptyForm)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateRequest = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof form }) => {
      const res = await fetch(`/api/events/${eventId}/visa/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Visa request updated")
      queryClient.invalidateQueries({ queryKey: ["visa-requests", eventId] })
      setShowDialog(false)
      setEditingRequest(null)
      setForm(emptyForm)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${eventId}/visa/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Visa request deleted")
      queryClient.invalidateQueries({ queryKey: ["visa-requests", eventId] })
      setDeleteRequest(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const generateLetter = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${eventId}/visa/${id}/generate-letter`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to generate letter")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Invitation letter generated")
      queryClient.invalidateQueries({ queryKey: ["visa-requests", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const sendLetter = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${eventId}/visa/${id}/send-letter`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to send")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message || "Letter sent")
      queryClient.invalidateQueries({ queryKey: ["visa-requests", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const filtered = useMemo(() => {
    if (!requests) return []
    return requests.filter((r) => {
      const matchesSearch =
        r.applicant_name.toLowerCase().includes(search.toLowerCase()) ||
        r.applicant_email?.toLowerCase().includes(search.toLowerCase()) ||
        r.nationality?.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = filterStatus === "all" || r.letter_status === filterStatus
      return matchesSearch && matchesStatus
    })
  }, [requests, search, filterStatus])

  const stats = useMemo(() => {
    if (!requests) return { total: 0, pending: 0, generated: 0, sent: 0 }
    return {
      total: requests.length,
      pending: requests.filter((r) => r.letter_status === "pending").length,
      generated: requests.filter((r) => r.letter_status === "generated").length,
      sent: requests.filter((r) => r.letter_status === "sent").length,
    }
  }, [requests])

  const openEdit = (req: VisaRequest) => {
    setForm({
      applicant_name: req.applicant_name,
      applicant_email: req.applicant_email || "",
      passport_number: req.passport_number || "",
      nationality: req.nationality || "",
      passport_expiry: req.passport_expiry || "",
      visa_type: req.visa_type,
      embassy_country: req.embassy_country || "",
      travel_dates_from: req.travel_dates_from || "",
      travel_dates_to: req.travel_dates_to || "",
      letter_type: req.letter_type,
      notes: req.notes || "",
    })
    setEditingRequest(req)
    setShowDialog(true)
  }

  const handleSubmit = () => {
    if (!form.applicant_name.trim()) {
      toast.error("Applicant name is required")
      return
    }
    if (editingRequest) {
      updateRequest.mutate({ id: editingRequest.id, data: form })
    } else {
      createRequest.mutate(form)
    }
  }

  const exportRequests = () => {
    const headers = ["Name", "Email", "Nationality", "Passport #", "Embassy", "Travel From", "Travel To", "Status"]
    const rows = filtered.map((r) => [
      r.applicant_name,
      r.applicant_email || "",
      r.nationality || "",
      r.passport_number || "",
      r.embassy_country || "",
      r.travel_dates_from || "",
      r.travel_dates_to || "",
      r.letter_status,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `visa-requests-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exported")
  }

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Visa & Invitation Letters</h1>
          <p className="text-muted-foreground">Manage visa invitation letter requests</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportRequests}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => { setForm(emptyForm); setEditingRequest(null); setShowDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Request
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Generated</p>
          <p className="text-2xl font-bold text-blue-600">{stats.generated}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Sent</p>
          <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, nationality..."
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
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <Stamp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Visa Requests</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {requests?.length === 0 ? "No requests yet" : "No requests match your filters"}
          </p>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Request
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Applicant</TableHead>
                <TableHead>Nationality</TableHead>
                <TableHead>Embassy</TableHead>
                <TableHead>Travel Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((req) => {
                const statusInfo = STATUS_OPTIONS.find((s) => s.value === req.letter_status)
                return (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{req.applicant_name}</p>
                        {req.applicant_email && (
                          <p className="text-xs text-muted-foreground">{req.applicant_email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{req.nationality || "-"}</TableCell>
                    <TableCell className="text-sm">{req.embassy_country || "-"}</TableCell>
                    <TableCell className="text-sm">
                      {req.travel_dates_from
                        ? `${new Date(req.travel_dates_from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${req.travel_dates_to ? new Date(req.travel_dates_to).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-white", statusInfo?.color)}>
                        {statusInfo?.label || req.letter_status}
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
                          {req.letter_status === "pending" && (
                            <DropdownMenuItem
                              onClick={() => generateLetter.mutate(req.id)}
                              disabled={generateLetter.isPending}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Generate Letter
                            </DropdownMenuItem>
                          )}
                          {req.applicant_email && req.letter_status !== "sent" && (
                            <DropdownMenuItem
                              onClick={() => sendLetter.mutate(req.id)}
                              disabled={sendLetter.isPending}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Send Letter
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openEdit(req)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => setDeleteRequest(req)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingRequest(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRequest ? "Edit Visa Request" : "New Visa Request"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Applicant Name *</Label>
                <Input
                  value={form.applicant_name}
                  onChange={(e) => setForm({ ...form, applicant_name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.applicant_email}
                  onChange={(e) => setForm({ ...form, applicant_email: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Nationality</Label>
                <Input
                  value={form.nationality}
                  onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Passport Number</Label>
                <Input
                  value={form.passport_number}
                  onChange={(e) => setForm({ ...form, passport_number: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Passport Expiry</Label>
                <Input
                  type="date"
                  value={form.passport_expiry}
                  onChange={(e) => setForm({ ...form, passport_expiry: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Embassy Country</Label>
                <Input
                  value={form.embassy_country}
                  onChange={(e) => setForm({ ...form, embassy_country: e.target.value })}
                  placeholder="Country of visa application"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Visa Type</Label>
                <Select value={form.visa_type} onValueChange={(v) => setForm({ ...form, visa_type: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conference">Conference</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="tourist">Tourist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Travel From</Label>
                <Input
                  type="date"
                  value={form.travel_dates_from}
                  onChange={(e) => setForm({ ...form, travel_dates_from: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Travel To</Label>
                <Input
                  type="date"
                  value={form.travel_dates_to}
                  onChange={(e) => setForm({ ...form, travel_dates_to: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createRequest.isPending || updateRequest.isPending}>
              {(createRequest.isPending || updateRequest.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRequest ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteRequest} onOpenChange={(open) => !open && setDeleteRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Visa Request
            </DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete the request for <strong>{deleteRequest?.applicant_name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRequest(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteRequest && deleteMutation.mutate(deleteRequest.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
