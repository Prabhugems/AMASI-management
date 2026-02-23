"use client"

import { useMemo, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Loader2, Download, BadgeCheck, CheckCircle, Clock, Users, Info, Search, Send, Mail, Ticket, Filter } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

export default function DelegatePortalBadgesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [searchQuery, setSearchQuery] = useState("")
  const [ticketFilter, setTicketFilter] = useState<string>("all")
  const [downloadFilter, setDownloadFilter] = useState<string>("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sendingState, setSendingState] = useState<{ active: boolean; sent: number; total: number } | null>(null)

  const { data: registrations, isLoading } = useQuery({
    queryKey: ["delegate-portal-badges", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, registration_number, attendee_name, attendee_email, badge_generated_at, badge_downloaded_by_delegate_at, ticket_type_id, ticket_type:ticket_types(name)")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .order("attendee_name")
      return data || []
    },
  })

  const { data: ticketTypes } = useQuery({
    queryKey: ["event-ticket-types", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ticket_types")
        .select("id, name")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
      return data || []
    },
    enabled: !!eventId,
  })

  const { data: downloadCounts } = useQuery({
    queryKey: ["delegate-portal-badge-download-counts", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("delegate_portal_downloads")
        .select("registration_id")
        .eq("event_id", eventId)
        .eq("download_type", "badge")
      if (!data) return {} as Record<string, number>
      const counts: Record<string, number> = {}
      data.forEach((d: any) => {
        counts[d.registration_id] = (counts[d.registration_id] || 0) + 1
      })
      return counts
    },
  })

  const filteredRegistrations = useMemo(() => {
    if (!registrations) return []
    return registrations.filter((reg: any) => {
      if (ticketFilter !== "all" && reg.ticket_type_id !== ticketFilter) return false
      if (downloadFilter === "downloaded" && !reg.badge_downloaded_by_delegate_at) return false
      if (downloadFilter === "not_downloaded" && reg.badge_downloaded_by_delegate_at) return false
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        reg.attendee_name?.toLowerCase().includes(q) ||
        reg.attendee_email?.toLowerCase().includes(q) ||
        reg.registration_number?.toLowerCase().includes(q)
      )
    })
  }, [registrations, ticketFilter, downloadFilter, searchQuery])

  const stats = useMemo(() => {
    if (!registrations) return null
    const total = registrations.length
    const generated = registrations.filter((r: any) => r.badge_generated_at).length
    const downloaded = registrations.filter((r: any) => r.badge_downloaded_by_delegate_at).length
    const rate = generated > 0 ? ((downloaded / generated) * 100).toFixed(1) : "0"
    return { total, generated, downloaded, rate }
  }, [registrations])

  const allFilteredSelected = filteredRegistrations.length > 0 && filteredRegistrations.every((r: any) => selectedIds.has(r.id))

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filteredRegistrations.forEach((r: any) => next.delete(r.id))
      } else {
        filteredRegistrations.forEach((r: any) => next.add(r.id))
      }
      return next
    })
  }, [allFilteredSelected, filteredRegistrations])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const sendBadgeEmail = async (registrationId: string) => {
    try {
      const res = await fetch("/api/badges/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: registrationId, event_id: eventId }),
      })
      if (!res.ok) throw new Error("Failed to send")
      return true
    } catch {
      return false
    }
  }

  const handleSendIndividual = async (reg: any) => {
    toast.promise(sendBadgeEmail(reg.id), {
      loading: `Sending badge to ${reg.attendee_name}...`,
      success: `Badge email sent to ${reg.attendee_email}`,
      error: `Failed to send badge to ${reg.attendee_name}`,
    })
  }

  const handleBulkSend = async (ids: string[]) => {
    if (ids.length === 0) return
    setSendingState({ active: true, sent: 0, total: ids.length })
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < ids.length; i++) {
      const ok = await sendBadgeEmail(ids[i])
      if (ok) successCount++
      else failCount++
      setSendingState({ active: true, sent: i + 1, total: ids.length })
    }

    setSendingState(null)
    setSelectedIds(new Set())
    if (failCount === 0) {
      toast.success(`Badge emails sent to ${successCount} delegate${successCount > 1 ? "s" : ""}`)
    } else {
      toast.warning(`Sent ${successCount}, failed ${failCount} of ${ids.length}`)
    }
  }

  const handleSendSelected = () => {
    const ids = Array.from(selectedIds)
    handleBulkSend(ids)
  }

  const handleEmailNotDownloaded = () => {
    if (!registrations) return
    const notDownloaded = registrations
      .filter((r: any) => r.badge_generated_at && !r.badge_downloaded_by_delegate_at)
      .map((r: any) => r.id)
    if (notDownloaded.length === 0) {
      toast.info("All delegates with generated badges have already downloaded them")
      return
    }
    handleBulkSend(notDownloaded)
  }

  const exportCSV = () => {
    if (!registrations) return
    const headers = ["Reg Number", "Name", "Email", "Ticket Type", "Badge Generated", "Delegate Downloaded", "Downloaded At", "Download Count"]
    const rows = registrations.map((r: any) => [
      r.registration_number,
      `"${r.attendee_name || ""}"`,
      r.attendee_email,
      r.ticket_type?.name || "",
      r.badge_generated_at ? "Yes" : "No",
      r.badge_downloaded_by_delegate_at ? "Yes" : "No",
      r.badge_downloaded_by_delegate_at ? format(new Date(r.badge_downloaded_by_delegate_at), "dd MMM yyyy HH:mm") : "",
      downloadCounts?.[r.id] || 0,
    ])
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `delegate-badge-downloads-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    toast.success("Report exported")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Badge Downloads</h1>
          <p className="text-muted-foreground">Track delegate self-service badge downloads</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleEmailNotDownloaded} variant="outline" disabled={!!sendingState}>
            <Mail className="h-4 w-4 mr-2" />
            Email Not Downloaded
          </Button>
          <Button onClick={exportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
        <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <span className="text-amber-800 dark:text-amber-200">
          Download tracking started when this feature was deployed. Historical downloads before that point are not included.
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total Confirmed</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold">{stats?.total || 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BadgeCheck className="h-4 w-4 text-blue-500" />
            <span className="text-sm">Badges Generated</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats?.generated || 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">Downloaded by Delegate</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{stats?.downloaded || 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="h-4 w-4 text-purple-500" />
            <span className="text-sm">Download Rate</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats?.rate}%</p>
          <p className="text-xs text-muted-foreground">of generated badges</p>
        </div>
      </div>

      {/* Filters & Actions Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, reg #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={ticketFilter} onValueChange={setTicketFilter}>
          <SelectTrigger className="w-full md:w-48">
            <Ticket className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Tickets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tickets</SelectItem>
            {ticketTypes?.map((tt: any) => (
              <SelectItem key={tt.id} value={tt.id}>
                {tt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={downloadFilter} onValueChange={setDownloadFilter}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Download Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="downloaded">Downloaded</SelectItem>
            <SelectItem value="not_downloaded">Not Downloaded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" onClick={handleSendSelected} disabled={!!sendingState}>
            <Send className="h-4 w-4 mr-2" />
            Send Badge Email
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Sending Progress */}
      {sendingState && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-sm text-blue-800 dark:text-blue-200">
            Sending {sendingState.sent}/{sendingState.total}...
          </span>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allFilteredSelected && filteredRegistrations.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Reg #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Badge Generated</TableHead>
              <TableHead>Delegate Downloaded</TableHead>
              <TableHead>Count</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRegistrations.map((reg: any) => (
              <TableRow key={reg.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(reg.id)}
                    onCheckedChange={() => toggleSelect(reg.id)}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm">{reg.registration_number}</TableCell>
                <TableCell className="font-medium">{reg.attendee_name}</TableCell>
                <TableCell className="text-sm">{reg.attendee_email}</TableCell>
                <TableCell>{reg.ticket_type?.name || "-"}</TableCell>
                <TableCell>
                  {reg.badge_generated_at ? (
                    <span className="text-green-600 text-sm">{format(new Date(reg.badge_generated_at), "dd MMM, h:mm a")}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {reg.badge_downloaded_by_delegate_at ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {format(new Date(reg.badge_downloaded_by_delegate_at), "dd MMM, h:mm a")}
                    </span>
                  ) : reg.badge_generated_at ? (
                    <span className="text-yellow-600 text-sm">Not yet</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className="font-mono">{downloadCounts?.[reg.id] || 0}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleSendIndividual(reg)}
                    disabled={!!sendingState}
                    title="Send badge email"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredRegistrations.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {registrations?.length === 0 ? "No confirmed registrations found" : "No results match your filters"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
