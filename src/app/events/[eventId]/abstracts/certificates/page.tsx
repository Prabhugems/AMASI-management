"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Award,
  Download,
  Loader2,
  FileText,
  CheckCircle,
  Users,
  Search,
  Filter,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface Abstract {
  id: string
  abstract_number: string
  title: string
  presenting_author_name: string
  presenting_author_email: string
  presenting_author_affiliation: string
  accepted_as: string
  category?: { name: string }
  session_date?: string
  session_location?: string
}

interface Template {
  id: string
  name: string
  is_active: boolean
}

export default function CertificatesPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [templateId, setTemplateId] = useState<string>("")

  // Fetch accepted abstracts
  const { data: abstracts = [], isLoading } = useQuery({
    queryKey: ["accepted-abstracts", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstracts?event_id=${eventId}&status=accepted`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json() as Promise<Abstract[]>
    },
  })

  // Fetch certificate info
  const { data: certInfo } = useQuery({
    queryKey: ["certificate-info", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstracts/certificates?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
  })

  // Filter abstracts
  const filteredAbstracts = abstracts.filter((a) => {
    if (search) {
      const searchLower = search.toLowerCase()
      if (
        !a.title.toLowerCase().includes(searchLower) &&
        !a.presenting_author_name.toLowerCase().includes(searchLower) &&
        !a.abstract_number.toLowerCase().includes(searchLower)
      ) {
        return false
      }
    }
    if (typeFilter !== "all" && a.accepted_as !== typeFilter) {
      return false
    }
    return true
  })

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAbstracts.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredAbstracts.map((a) => a.id))
    }
  }

  const generateCertificates = async () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one abstract")
      return
    }

    setGenerating(true)
    try {
      const res = await fetch("/api/abstracts/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          abstract_ids: selectedIds,
          template_id: templateId || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to generate certificates")
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `presenter-certificates-${new Date().toISOString().split("T")[0]}.pdf`
      link.click()
      URL.revokeObjectURL(url)

      toast.success(`Generated ${selectedIds.length} certificate(s)`)
    } catch (error) {
      toast.error("Failed to generate certificates")
    } finally {
      setGenerating(false)
    }
  }

  const generateAll = async () => {
    if (abstracts.length === 0) {
      toast.error("No accepted abstracts")
      return
    }

    setGenerating(true)
    try {
      const res = await fetch("/api/abstracts/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          abstract_ids: abstracts.map((a) => a.id),
          template_id: templateId || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to generate certificates")
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `all-presenter-certificates-${new Date().toISOString().split("T")[0]}.pdf`
      link.click()
      URL.revokeObjectURL(url)

      toast.success(`Generated ${abstracts.length} certificate(s)`)
    } catch (error) {
      toast.error("Failed to generate certificates")
    } finally {
      setGenerating(false)
    }
  }

  // Stats
  const stats = {
    total: abstracts.length,
    oral: abstracts.filter((a) => a.accepted_as === "oral").length,
    poster: abstracts.filter((a) => a.accepted_as === "poster").length,
    other: abstracts.filter((a) => !["oral", "poster"].includes(a.accepted_as || "")).length,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Presenter Certificates</h1>
          <p className="text-muted-foreground">
            Generate certificates for accepted abstract presenters
          </p>
        </div>
        <Button
          onClick={generateAll}
          disabled={generating || abstracts.length === 0}
          className="gap-2"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download All ({abstracts.length})
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Accepted</span>
              <Award className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Oral</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{stats.oral}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Poster</span>
              <FileText className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold">{stats.poster}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Other</span>
              <CheckCircle className="h-4 w-4 text-gray-500" />
            </div>
            <p className="text-2xl font-bold">{stats.other}</p>
          </CardContent>
        </Card>
      </div>

      {/* Template Selection */}
      {certInfo?.templates && certInfo.templates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Certificate Template</CardTitle>
            <CardDescription>Select a custom template or use the default design</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Default Certificate Design" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Default Certificate Design</SelectItem>
                {certInfo.templates.map((t: Template) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, title, number..."
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="oral">Oral</SelectItem>
            <SelectItem value="poster">Poster</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="eposter">E-Poster</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <Button
            onClick={generateCertificates}
            disabled={generating}
            className="gap-2"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Generate Selected
          </Button>
          <Button variant="ghost" onClick={() => setSelectedIds([])}>
            Clear
          </Button>
        </div>
      )}

      {/* Abstracts Table */}
      {filteredAbstracts.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed">
          <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Accepted Abstracts</h3>
          <p className="text-muted-foreground">
            {search || typeFilter !== "all"
              ? "No abstracts match your filters"
              : "Accept abstracts to generate presenter certificates"}
          </p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.length === filteredAbstracts.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Abstract #</TableHead>
                <TableHead className="min-w-[250px]">Title</TableHead>
                <TableHead>Presenter</TableHead>
                <TableHead>Affiliation</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAbstracts.map((abstract) => (
                <TableRow key={abstract.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(abstract.id)}
                      onCheckedChange={() => toggleSelect(abstract.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {abstract.abstract_number}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium truncate max-w-[250px]">{abstract.title}</p>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{abstract.presenting_author_name}</p>
                      <p className="text-xs text-muted-foreground">{abstract.presenting_author_email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {abstract.presenting_author_affiliation || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {abstract.accepted_as || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {abstract.category?.name || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Available Placeholders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Available Placeholders</CardTitle>
          <CardDescription>
            Use these in custom certificate templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(certInfo?.available_placeholders || []).map((p: string) => (
              <code key={p} className="px-2 py-1 bg-muted rounded text-sm font-mono">
                {p}
              </code>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
