"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
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
  Search,
  Loader2,
  Presentation,
  FileText,
  Video,
  CheckCircle,
  AlertCircle,
  Download,
  ExternalLink,
  RefreshCw,
  ChevronLeft,
  Users,
  Clock,
  Upload,
  BarChart3,
  Send,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { toast } from "sonner"

type Abstract = {
  id: string
  abstract_number: string
  title: string
  presenting_author_name: string
  presenting_author_email: string
  status: string
  accepted_as: string | null
  presentation_type: string
  presentation_url: string | null
  presentation_name: string | null
  presentation_uploaded_at: string | null
}

export default function PresentationsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [search, setSearch] = useState("")
  const [uploadFilter, setUploadFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  // Fetch accepted abstracts with presentation status
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["abstracts-presentations", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstracts?event_id=${eventId}&status=accepted`)
      if (!res.ok) throw new Error("Failed to fetch abstracts")
      const data = await res.json()
      return data || []
    },
  })

  const abstracts: Abstract[] = data || []

  // Filter abstracts
  const filtered = useMemo(() => {
    return abstracts.filter((a) => {
      const matchesSearch =
        !search ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.abstract_number.toLowerCase().includes(search.toLowerCase()) ||
        a.presenting_author_name.toLowerCase().includes(search.toLowerCase())

      const hasUpload = !!a.presentation_url
      const matchesUpload =
        uploadFilter === "all" ||
        (uploadFilter === "uploaded" && hasUpload) ||
        (uploadFilter === "pending" && !hasUpload)

      const matchesType =
        typeFilter === "all" || a.presentation_type === typeFilter

      return matchesSearch && matchesUpload && matchesType
    })
  }, [abstracts, search, uploadFilter, typeFilter])

  // Stats
  const stats = useMemo(() => {
    const total = abstracts.length
    const uploaded = abstracts.filter((a) => a.presentation_url).length
    const pending = total - uploaded
    const papers = abstracts.filter((a) => a.presentation_type === "paper").length
    const videos = abstracts.filter((a) => a.presentation_type === "video").length
    const posters = abstracts.filter((a) => a.presentation_type === "poster").length

    return { total, uploaded, pending, papers, videos, posters }
  }, [abstracts])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const sendReminder = async (abstract: Abstract) => {
    try {
      const res = await fetch("/api/abstracts/presentation-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abstract_id: abstract.id,
        }),
      })
      if (!res.ok) throw new Error("Failed to send reminder")
      toast.success(`Reminder sent to ${abstract.presenting_author_email}`)
    } catch {
      toast.error("Failed to send reminder")
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading presentations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href={`/events/${eventId}/abstracts`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Abstracts
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Presentation className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Presentation Uploads</h1>
            <p className="text-sm text-muted-foreground">
              Track presentation uploads for accepted abstracts
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-primary">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Accepted</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-emerald-600">{stats.uploaded}</p>
              <p className="text-sm text-muted-foreground">Uploaded</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          {stats.total > 0 && (
            <div className="mt-3 h-2 rounded-full bg-emerald-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${(stats.uploaded / stats.total) * 100}%` }}
              />
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-lg font-semibold text-blue-600">{stats.papers}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Video className="h-4 w-4 text-red-500" />
              <span className="text-lg font-semibold text-red-500">{stats.videos}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Presentation className="h-4 w-4 text-green-600" />
              <span className="text-lg font-semibold text-green-600">{stats.posters}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">By Type</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl bg-muted/30 border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, number, or author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <Select value={uploadFilter} onValueChange={setUploadFilter}>
          <SelectTrigger className="w-[150px] h-10">
            <Upload className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Upload Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="uploaded">Uploaded</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] h-10">
            <BarChart3 className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="paper">Paper</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="poster">Poster</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="px-3 py-1.5">
          {filtered.length} abstract{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Abstracts List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed bg-muted/20">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Presentation className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No abstracts found</h3>
          <p className="text-muted-foreground">
            {abstracts.length === 0
              ? "No accepted abstracts yet"
              : "Try adjusting your search or filters"}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-sm">Abstract</th>
                <th className="text-left p-4 font-medium text-sm">Author</th>
                <th className="text-left p-4 font-medium text-sm">Type</th>
                <th className="text-left p-4 font-medium text-sm">Upload Status</th>
                <th className="text-left p-4 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((abstract) => {
                const hasUpload = !!abstract.presentation_url
                return (
                  <tr key={abstract.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div>
                        <span className="font-mono text-sm text-primary font-semibold">
                          {abstract.abstract_number}
                        </span>
                        <p className="text-sm font-medium line-clamp-1 mt-1">
                          {abstract.title}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{abstract.presenting_author_name}</p>
                          <p className="text-xs text-muted-foreground">{abstract.presenting_author_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          abstract.presentation_type === "paper" && "border-blue-300 text-blue-700 bg-blue-50",
                          abstract.presentation_type === "video" && "border-red-300 text-red-700 bg-red-50",
                          abstract.presentation_type === "poster" && "border-green-300 text-green-700 bg-green-50"
                        )}
                      >
                        {abstract.presentation_type === "paper" && <FileText className="h-3 w-3 mr-1" />}
                        {abstract.presentation_type === "video" && <Video className="h-3 w-3 mr-1" />}
                        {abstract.presentation_type === "poster" && <Presentation className="h-3 w-3 mr-1" />}
                        {abstract.presentation_type}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {hasUpload ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          <div>
                            <p className="text-sm font-medium text-emerald-700">Uploaded</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(abstract.presentation_uploaded_at)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          <span className="text-sm text-amber-700">Pending</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {hasUpload ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(abstract.presentation_url!, "_blank")}
                              title="View presentation"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              title="Download"
                            >
                              <a href={abstract.presentation_url!} download={abstract.presentation_name}>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sendReminder(abstract)}
                            title="Send reminder"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Remind
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
