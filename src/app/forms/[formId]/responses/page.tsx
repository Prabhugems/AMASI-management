"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import Link from "next/link"
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Search,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  MoreHorizontal,
  Mail,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { FormSubmission, Form, FormField } from "@/lib/types"

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  reviewed: { label: "Reviewed", icon: Eye, color: "bg-blue-100 text-blue-700" },
  approved: { label: "Approved", icon: CheckCircle2, color: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-red-100 text-red-700" },
}

export default function FormResponsesPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const formId = params.formId as string

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null)
  const [page, setPage] = useState(1)

  // Fetch form details
  const { data: formData } = useQuery({
    queryKey: ["form", formId],
    queryFn: async () => {
      const response = await fetch("/api/forms/" + formId)
      if (!response.ok) throw new Error("Failed to fetch form")
      return response.json()
    },
  })

  // Fetch submissions
  const { data: submissionsData, isLoading, refetch } = useQuery({
    queryKey: ["form-submissions", formId, page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        form_id: formId,
        page: String(page),
        limit: "50",
      })
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      const response = await fetch("/api/forms/submissions?" + params.toString())
      if (!response.ok) throw new Error("Failed to fetch submissions")
      return response.json()
    },
  })

  const form: Form | null = formData || null
  const fields: FormField[] = formData?.fields || []
  const submissions: FormSubmission[] = submissionsData?.data || []
  const totalPages = submissionsData?.totalPages || 1

  // Update submission status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch("/api/forms/submissions/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error("Failed to update status")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-submissions", formId] })
      toast.success("Status updated")
    },
    onError: () => {
      toast.error("Failed to update status")
    },
  })

  // Delete submission
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch("/api/forms/submissions/" + id, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-submissions", formId] })
      toast.success("Submission deleted")
      setSelectedSubmission(null)
    },
    onError: () => {
      toast.error("Failed to delete submission")
    },
  })

  // Export to CSV
  const handleExport = () => {
    if (!submissions.length || !fields.length) return

    const headers = ["Submitted At", "Status", "Email", ...fields.map((f) => f.label)]
    const rows = submissions.map((sub) => {
      return [
        format(new Date(sub.submitted_at), "yyyy-MM-dd HH:mm"),
        sub.status,
        sub.submitter_email || "",
        ...fields.map((f) => {
          const value = sub.responses[f.id]
          if (Array.isArray(value)) {
            return value.map((v) => (typeof v === "object" ? (v?.name || v?.url || JSON.stringify(v)) : v)).join("; ")
          }
          if (typeof value === "object" && value !== null) return JSON.stringify(value)
          return String(value || "")
        }),
      ]
    })

    const csv = [headers, ...rows].map((row) => row.map((cell) => "\"" + String(cell).replace(/"/g, '""') + "\"").join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = (form?.name || "submissions") + "-" + format(new Date(), "yyyy-MM-dd") + ".csv"
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exported to CSV")
  }

  // Filter submissions by search
  const filteredSubmissions = submissions.filter((sub) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    if (sub.submitter_email?.toLowerCase().includes(searchLower)) return true
    if (sub.submitter_name?.toLowerCase().includes(searchLower)) return true
    return Object.values(sub.responses).some((v) => {
      if (Array.isArray(v)) return v.some((item) => String(typeof item === "object" ? JSON.stringify(item) : item).toLowerCase().includes(searchLower))
      if (typeof v === "object" && v !== null) return JSON.stringify(v).toLowerCase().includes(searchLower)
      return String(v).toLowerCase().includes(searchLower)
    })
  })

  const getFieldValue = (submission: FormSubmission, fieldId: string) => {
    const value = submission.responses[fieldId]
    if (value === undefined || value === null) return "-"
    if (Array.isArray(value)) return value.join(", ")
    if (typeof value === "boolean") return value ? "Yes" : "No"
    return String(value)
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={form?.event_id ? "/events/" + form.event_id + "/forms" : "/forms"}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">{form?.name || "Form"} Responses</h1>
                <p className="text-sm text-muted-foreground">
                  {submissionsData?.total || 0} total submissions
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={!submissions.length}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button size="sm" asChild>
                <Link href={"/forms/" + formId + "/edit"}>Edit Form</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search responses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="container mx-auto px-4 pb-8">
        <div className="bg-background rounded-lg border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No submissions yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Submitted</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Email</TableHead>
                  {fields.slice(0, 3).map((field) => (
                    <TableHead key={field.id} className="max-w-[200px]">
                      {field.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission) => {
                  const config = statusConfig[submission.status as keyof typeof statusConfig]
                  return (
                    <TableRow
                      key={submission.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedSubmission(submission)}
                    >
                      <TableCell className="text-sm">
                        {format(new Date(submission.submitted_at), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1", config?.color)}>
                          {config?.icon && <config.icon className="w-3 h-3" />}
                          {config?.label || submission.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          {submission.submitter_email || "-"}
                        </div>
                      </TableCell>
                      {fields.slice(0, 3).map((field) => (
                        <TableCell key={field.id} className="max-w-[200px] truncate">
                          {getFieldValue(submission, field.id)}
                        </TableCell>
                      ))}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedSubmission(submission); }}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: submission.id, status: "approved" }); }}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: submission.id, status: "rejected" }); }}
                            >
                              <XCircle className="w-4 h-4 mr-2 text-red-600" />
                              Reject
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(submission.id); }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
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
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Submission Detail Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-6">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p className="font-medium">
                    {format(new Date(selectedSubmission.submitted_at), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Select
                    value={selectedSubmission.status}
                    onValueChange={(value) => {
                      updateStatusMutation.mutate({ id: selectedSubmission.id, status: value })
                      setSelectedSubmission({ ...selectedSubmission, status: value as any })
                    }}
                  >
                    <SelectTrigger className="w-32 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selectedSubmission.submitter_email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedSubmission.submitter_email}</p>
                  </div>
                )}
                {selectedSubmission.submitter_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedSubmission.submitter_name}</p>
                  </div>
                )}
              </div>

              {/* Responses */}
              <div className="space-y-4">
                <h3 className="font-semibold">Responses</h3>
                {fields.map((field) => {
                  if (["heading", "paragraph", "divider"].includes(field.field_type)) return null
                  const value = getFieldValue(selectedSubmission, field.id)
                  return (
                    <div key={field.id} className="border-b pb-3">
                      <p className="text-sm text-muted-foreground">{field.label}</p>
                      <p className="font-medium mt-1 whitespace-pre-wrap">{value}</p>
                    </div>
                  )
                })}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(selectedSubmission.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
