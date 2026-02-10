"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Search,
  Loader2,
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Download,
  Filter,
  RefreshCw,
  AlertCircle,
  Star,
  Users,
  BarChart3,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Abstract {
  id: string
  event_id: string
  abstract_number: string
  title: string
  abstract_text: string
  keywords: string[]
  presentation_type: string
  presenting_author_name: string
  presenting_author_email: string
  presenting_author_affiliation: string | null
  status: string
  decision_date: string | null
  accepted_as: string | null
  category_id: string | null
  submitted_at: string
  category?: { id: string; name: string }
  authors?: { id: string; name: string; email: string; affiliation: string; author_order: number; is_presenting: boolean }[]
  reviews?: { id: string; overall_score: number; recommendation: string; reviewer_name: string; reviewed_at: string }[]
}

interface Category {
  id: string
  name: string
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  submitted: { bg: "bg-blue-100", text: "text-blue-700", label: "Submitted" },
  under_review: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Under Review" },
  revision_requested: { bg: "bg-orange-100", text: "text-orange-700", label: "Revision Requested" },
  accepted: { bg: "bg-green-100", text: "text-green-700", label: "Accepted" },
  rejected: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
  withdrawn: { bg: "bg-gray-100", text: "text-gray-600", label: "Withdrawn" },
}

export default function AbstractsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Fetch abstracts
  const { data: abstracts = [], isLoading, refetch } = useQuery({
    queryKey: ["abstracts", eventId, search, statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ event_id: eventId })
      if (search) params.append("search", search)
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (categoryFilter !== "all") params.append("category_id", categoryFilter)

      const res = await fetch(`/api/abstracts?${params}`)
      if (!res.ok) throw new Error("Failed to fetch abstracts")
      return res.json() as Promise<Abstract[]>
    },
  })

  // Fetch categories for filter
  const { data: categories = [] } = useQuery({
    queryKey: ["abstract-categories", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-categories?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch categories")
      return res.json() as Promise<Category[]>
    },
  })

  // Bulk decision mutation
  const bulkDecisionMutation = useMutation({
    mutationFn: async ({ decision, accepted_as }: { decision: string; accepted_as?: string }) => {
      const res = await fetch(`/api/abstracts/bulk/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abstract_ids: selectedIds, decision, accepted_as }),
      })
      if (!res.ok) throw new Error("Failed to update")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstracts", eventId] })
      setSelectedIds([])
    },
  })

  // Single abstract decision mutation
  const singleDecisionMutation = useMutation({
    mutationFn: async ({ abstractId, decision, accepted_as }: { abstractId: string; decision: string; accepted_as?: string }) => {
      const res = await fetch(`/api/abstracts/${abstractId}/decision`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, accepted_as }),
      })
      if (!res.ok) throw new Error("Failed to update")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstracts", eventId] })
    },
  })

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === abstracts.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(abstracts.map((a) => a.id))
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const getAverageScore = (reviews?: Abstract["reviews"]) => {
    if (!reviews || reviews.length === 0) return null
    const scores = reviews.filter((r) => r.overall_score).map((r) => r.overall_score)
    if (scores.length === 0) return null
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  }

  // Stats
  const stats = {
    total: abstracts.length,
    submitted: abstracts.filter((a) => a.status === "submitted").length,
    underReview: abstracts.filter((a) => a.status === "under_review").length,
    accepted: abstracts.filter((a) => a.status === "accepted").length,
    rejected: abstracts.filter((a) => a.status === "rejected").length,
    revisionRequested: abstracts.filter((a) => a.status === "revision_requested").length,
    pendingDecision: abstracts.filter((a) => ["submitted", "under_review"].includes(a.status)).length,
    avgScore: (() => {
      const scores = abstracts
        .filter(a => a.reviews && a.reviews.length > 0)
        .map(a => {
          const s = a.reviews!.filter(r => r.overall_score).map(r => r.overall_score)
          return s.length > 0 ? s.reduce((x, y) => x + y, 0) / s.length : 0
        })
        .filter(s => s > 0)
      return scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—"
    })(),
    withReviews: abstracts.filter(a => a.reviews && a.reviews.length > 0).length,
    byCategory: categories.reduce((acc, cat) => {
      acc[cat.name] = abstracts.filter(a => a.category?.id === cat.id).length
      return acc
    }, {} as Record<string, number>),
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Abstract #", "Title", "Author Name", "Author Email", "Affiliation",
      "Category", "Presentation Type", "Status", "Avg Score", "Reviews Count",
      "Submitted Date", "Decision Date", "Accepted As", "Keywords"
    ]

    const rows = abstracts.map(a => {
      const avgScore = getAverageScore(a.reviews) || ""
      return [
        a.abstract_number,
        `"${a.title.replace(/"/g, '""')}"`,
        a.presenting_author_name,
        a.presenting_author_email,
        a.presenting_author_affiliation || "",
        a.category?.name || "",
        a.presentation_type,
        a.status,
        avgScore,
        a.reviews?.length || 0,
        formatDate(a.submitted_at),
        a.decision_date ? formatDate(a.decision_date) : "",
        a.accepted_as || "",
        (a.keywords || []).join("; ")
      ].join(",")
    })

    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `abstracts-${eventId}-${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Abstract Submissions</h1>
          <p className="text-muted-foreground mt-1">
            Manage and review abstract submissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards - Row 1: Status Overview */}
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total</p>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-600">New</p>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-yellow-600">In Review</p>
            <Users className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.underReview}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-orange-600">Revision</p>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-orange-600">{stats.revisionRequested}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-600">Accepted</p>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-600">Rejected</p>
            <XCircle className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
        </div>
      </div>

      {/* Stats Cards - Row 2: Review Progress */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-white/80">Pending Decision</p>
            <Clock className="h-5 w-5 text-white/60" />
          </div>
          <p className="text-3xl font-bold">{stats.pendingDecision}</p>
          <p className="text-xs text-white/60 mt-1">abstracts awaiting decision</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Review Progress</p>
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <p className="text-3xl font-bold">{stats.withReviews}<span className="text-lg text-muted-foreground">/{stats.total}</span></p>
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${stats.total > 0 ? (stats.withReviews / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Average Score</p>
            <Star className="h-5 w-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold">{stats.avgScore}<span className="text-lg text-muted-foreground">/10</span></p>
          <p className="text-xs text-muted-foreground mt-1">across {stats.withReviews} reviewed</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Acceptance Rate</p>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold">
            {stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">{stats.accepted} of {stats.total} accepted</p>
        </div>
      </div>

      {/* Category Breakdown (if multiple categories) */}
      {Object.keys(stats.byCategory).length > 1 && (
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            By Category
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.byCategory).map(([name, count]) => (
              <div key={name} className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <span className="text-sm font-medium">{name}</span>
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, number, author..."
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="revision_requested">Revision Requested</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="withdrawn">Withdrawn</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkDecisionMutation.mutate({ decision: "accepted", accepted_as: "oral" })}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4 text-green-600" />
            Accept as Oral
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkDecisionMutation.mutate({ decision: "accepted", accepted_as: "poster" })}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4 text-green-600" />
            Accept as Poster
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkDecisionMutation.mutate({ decision: "rejected" })}
            className="gap-2"
          >
            <XCircle className="h-4 w-4 text-red-600" />
            Reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds([])}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : abstracts.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Abstracts Yet</h3>
          <p className="text-muted-foreground">
            {search || statusFilter !== "all" || categoryFilter !== "all"
              ? "No abstracts match your filters"
              : "Abstracts will appear here when submitted"}
          </p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.length === abstracts.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Abstract #</TableHead>
                <TableHead className="min-w-[300px]">Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {abstracts.map((abstract) => {
                const status = statusColors[abstract.status] || statusColors.submitted
                const avgScore = getAverageScore(abstract.reviews)

                return (
                  <TableRow
                    key={abstract.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/events/${eventId}/abstracts/${abstract.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(abstract.id)}
                        onCheckedChange={() => toggleSelect(abstract.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {abstract.abstract_number}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[300px]">
                        <p className="font-medium truncate">{abstract.title}</p>
                        {abstract.keywords && abstract.keywords.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {abstract.keywords.slice(0, 3).join(", ")}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{abstract.presenting_author_name}</p>
                        <p className="text-xs text-muted-foreground">{abstract.presenting_author_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{abstract.category?.name || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm capitalize">{abstract.presentation_type}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {avgScore ? (
                        <span className={cn(
                          "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                          parseFloat(avgScore) >= 7 ? "bg-green-100 text-green-700" :
                          parseFloat(avgScore) >= 5 ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {avgScore}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex px-2 py-1 text-xs font-medium rounded-full",
                        status.bg, status.text
                      )}>
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(abstract.submitted_at)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/events/${eventId}/abstracts/${abstract.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-green-600"
                            onClick={() => singleDecisionMutation.mutate({ abstractId: abstract.id, decision: "accepted", accepted_as: "oral" })}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Accept
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => singleDecisionMutation.mutate({ abstractId: abstract.id, decision: "rejected" })}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-orange-600"
                            onClick={() => singleDecisionMutation.mutate({ abstractId: abstract.id, decision: "revision_requested" })}
                          >
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Request Revision
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
    </div>
  )
}
