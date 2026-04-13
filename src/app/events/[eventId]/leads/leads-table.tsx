"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Search,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import type { Lead, LeadStatus } from "./leads-types"
import { LEAD_STATUSES, LEAD_SOURCES } from "./leads-types"
import { LeadsBulkActions } from "./leads-bulk-actions"

type SortField = "name" | "email" | "status" | "source" | "created_at"
type SortOrder = "asc" | "desc"

interface LeadsTableProps {
  leads: Lead[]
  eventId: string
  isLoading: boolean
  onSelectLead: (lead: Lead) => void
  onRefresh: () => void
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffDay > 30) {
    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }
  if (diffDay > 0) return `${diffDay}d ago`
  if (diffHour > 0) return `${diffHour}h ago`
  if (diffMin > 0) return `${diffMin}m ago`
  return "Just now"
}

function getStatusStyle(status: string) {
  const found = LEAD_STATUSES.find((s) => s.value === status)
  if (found) return { color: found.color, bgColor: found.bgColor, label: found.label }
  return { color: "text-muted-foreground", bgColor: "bg-muted", label: status }
}

export function LeadsTable({
  leads,
  eventId,
  isLoading,
  onSelectLead,
  onRefresh,
}: LeadsTableProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Client-side filter
  const filteredLeads = useMemo(() => {
    let result = leads

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.email.toLowerCase().includes(q) ||
          l.name?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((l) => l.status === statusFilter)
    }

    // Source filter
    if (sourceFilter !== "all") {
      result = result.filter((l) => l.source === sourceFilter)
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "name":
          cmp = (a.name || "").localeCompare(b.name || "")
          break
        case "email":
          cmp = a.email.localeCompare(b.email)
          break
        case "status":
          cmp = a.status.localeCompare(b.status)
          break
        case "source":
          cmp = a.source.localeCompare(b.source)
          break
        case "created_at":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortOrder === "asc" ? cmp : -cmp
    })

    return result
  }, [leads, search, statusFilter, sourceFilter, sortField, sortOrder])

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
      } else {
        setSortField(field)
        setSortOrder("asc")
      }
    },
    [sortField]
  )

  const allSelected =
    filteredLeads.length > 0 && filteredLeads.every((l) => selectedIds.has(l.id))

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)))
    }
  }, [allSelected, filteredLeads])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const exportCSV = useCallback(() => {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Source",
      "Status",
      "UTM Source",
      "UTM Medium",
      "UTM Campaign",
      "Notes",
      "Created At",
    ]
    const rows = filteredLeads.map((l) => [
      l.name || "",
      l.email,
      l.phone || "",
      l.source,
      l.status,
      l.utm_source || "",
      l.utm_medium || "",
      l.utm_campaign || "",
      l.notes || "",
      new Date(l.created_at).toLocaleString(),
    ])
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `leads-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredLeads])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    )
  }

  const handleBulkComplete = useCallback(() => {
    setSelectedIds(new Set())
    onRefresh()
  }, [onRefresh])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredLeads.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
        {search || statusFilter !== "all" || sourceFilter !== "all"
          ? ` (filtered from ${leads.length})`
          : ""}
      </p>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {leads.length === 0 ? "No Leads Yet" : "No Matching Leads"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {leads.length === 0
              ? "Leads will appear here when visitors show interest in your event."
              : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center hover:text-foreground transition-colors"
                    onClick={() => toggleSort("name")}
                  >
                    Contact
                    <SortIcon field="name" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center hover:text-foreground transition-colors"
                    onClick={() => toggleSort("source")}
                  >
                    Source
                    <SortIcon field="source" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center hover:text-foreground transition-colors"
                    onClick={() => toggleSort("status")}
                  >
                    Status
                    <SortIcon field="status" />
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell">UTM</TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center hover:text-foreground transition-colors"
                    onClick={() => toggleSort("created_at")}
                  >
                    Created
                    <SortIcon field="created_at" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => {
                const statusStyle = getStatusStyle(lead.status)
                const isSelected = selectedIds.has(lead.id)
                return (
                  <TableRow
                    key={lead.id}
                    data-state={isSelected ? "selected" : undefined}
                    className="cursor-pointer"
                    onClick={() => onSelectLead(lead)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(lead.id)}
                        aria-label={`Select ${lead.name || lead.email}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[180px]">
                        <p className="font-medium text-foreground leading-tight">
                          {lead.name || "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground">{lead.email}</p>
                        {lead.phone && (
                          <p className="text-xs text-muted-foreground/70">{lead.phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize font-normal">
                        {lead.source.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle.bgColor} ${statusStyle.color}`}
                      >
                        {statusStyle.label}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {lead.utm_source ? (
                        <span className="text-sm text-muted-foreground">
                          {lead.utm_source}
                          {lead.utm_medium ? ` / ${lead.utm_medium}` : ""}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatRelativeDate(lead.created_at)}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bulk actions bar */}
      <LeadsBulkActions
        selectedIds={Array.from(selectedIds)}
        eventId={eventId}
        onComplete={handleBulkComplete}
        onClear={() => setSelectedIds(new Set())}
      />
    </div>
  )
}
