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
import { Loader2, Download, Award, CheckCircle, Clock, Users, FileDown, Info, Search, Ticket, Filter, UserCheck, Send, Mail, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

export default function DelegatePortalCertificatesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [searchQuery, setSearchQuery] = useState("")
  const [ticketFilter, setTicketFilter] = useState<string>("all")
  const [downloadFilter, setDownloadFilter] = useState<string>("all")
  const [checkinFilter, setCheckinFilter] = useState<string>("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sendingState, setSendingState] = useState<{ active: boolean; sent: number; total: number } | null>(null)
  const [whatsappSendingState, setWhatsappSendingState] = useState<{ active: boolean; sent: number; total: number } | null>(null)

  const { data: registrations, isLoading } = useQuery({
    queryKey: ["delegate-portal-certificates", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, registration_number, attendee_name, attendee_email, attendee_phone, checked_in, certificate_generated_at, certificate_downloaded_at, ticket_type_id, ticket_type:ticket_types(name)")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .order("attendee_name")
      return data || []
    },
    refetchInterval: 30000,
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
    queryKey: ["delegate-portal-cert-download-counts", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("delegate_portal_downloads")
        .select("registration_id")
        .eq("event_id", eventId)
        .eq("download_type", "certificate")
      if (!data) return {} as Record<string, number>
      const counts: Record<string, number> = {}
      data.forEach((d: any) => {
        counts[d.registration_id] = (counts[d.registration_id] || 0) + 1
      })
      return counts
    },
    refetchInterval: 30000,
  })

  const filteredRegistrations = useMemo(() => {
    if (!registrations) return []
    return registrations.filter((reg: any) => {
      if (ticketFilter !== "all" && reg.ticket_type_id !== ticketFilter) return false
      if (downloadFilter === "downloaded" && !reg.certificate_downloaded_at) return false
      if (downloadFilter === "not_yet" && (!reg.certificate_generated_at || reg.certificate_downloaded_at)) return false
      if (downloadFilter === "not_generated" && reg.certificate_generated_at) return false
      if (checkinFilter === "checked_in" && !reg.checked_in) return false
      if (checkinFilter === "not_checked_in" && reg.checked_in) return false
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        reg.attendee_name?.toLowerCase().includes(q) ||
        reg.attendee_email?.toLowerCase().includes(q) ||
        reg.registration_number?.toLowerCase().includes(q)
      )
    })
  }, [registrations, ticketFilter, downloadFilter, checkinFilter, searchQuery])

  const stats = useMemo(() => {
    if (!registrations) return null
    const total = registrations.length
    const checkedIn = registrations.filter((r: any) => r.checked_in).length
    const issued = registrations.filter((r: any) => r.certificate_generated_at).length
    const downloaded = registrations.filter((r: any) => r.certificate_downloaded_at).length
    const rate = issued > 0 ? ((downloaded / issued) * 100).toFixed(1) : "0"
    return { total, checkedIn, issued, downloaded, rate }
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

  const sendCertificateEmail = async (registrationId: string) => {
    try {
      const res = await fetch("/api/certificates/email", {
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
    toast.promise(sendCertificateEmail(reg.id), {
      loading: `Sending certificate to ${reg.attendee_name}...`,
      success: `Certificate email sent to ${reg.attendee_email}`,
      error: `Failed to send certificate to ${reg.attendee_name}`,
    })
  }

  const handleBulkSend = async (ids: string[]) => {
    if (ids.length === 0) return
    setSendingState({ active: true, sent: 0, total: ids.length })
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < ids.length; i++) {
      const ok = await sendCertificateEmail(ids[i])
      if (ok) successCount++
      else failCount++
      setSendingState({ active: true, sent: i + 1, total: ids.length })
    }

    setSendingState(null)
    setSelectedIds(new Set())
    if (failCount === 0) {
      toast.success(`Certificate emails sent to ${successCount} delegate${successCount > 1 ? "s" : ""}`)
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
      .filter((r: any) => r.certificate_generated_at && !r.certificate_downloaded_at)
      .map((r: any) => r.id)
    if (notDownloaded.length === 0) {
      toast.info("All delegates with issued certificates have already downloaded them")
      return
    }
    handleBulkSend(notDownloaded)
  }

  const sendCertificateWhatsApp = async (reg: any) => {
    try {
      const baseUrl = window.location.origin
      const portalLink = `${baseUrl}/my`
      const text = `Hi ${reg.attendee_name}, your certificate is ready! Download it from the delegate portal: ${portalLink}`
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: reg.attendee_phone,
          recipient_name: reg.attendee_name,
          type: "text",
          text,
          event_id: eventId,
          registration_id: reg.id,
        }),
      })
      if (!res.ok) throw new Error("Failed to send")
      return true
    } catch {
      return false
    }
  }

  const handleWhatsAppIndividual = async (reg: any) => {
    toast.promise(sendCertificateWhatsApp(reg), {
      loading: `Sending WhatsApp to ${reg.attendee_name}...`,
      success: `Certificate WhatsApp sent to ${reg.attendee_phone}`,
      error: `Failed to send WhatsApp to ${reg.attendee_name}`,
    })
  }

  const handleBulkWhatsApp = async () => {
    if (!registrations) return
    const withPhone = filteredRegistrations.filter((r: any) => r.attendee_phone && selectedIds.has(r.id))
    if (withPhone.length === 0) {
      toast.error("No selected delegates have phone numbers")
      return
    }
    setWhatsappSendingState({ active: true, sent: 0, total: withPhone.length })
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < withPhone.length; i++) {
      const ok = await sendCertificateWhatsApp(withPhone[i])
      if (ok) successCount++
      else failCount++
      setWhatsappSendingState({ active: true, sent: i + 1, total: withPhone.length })
    }

    setWhatsappSendingState(null)
    setSelectedIds(new Set())
    if (failCount === 0) {
      toast.success(`Certificate WhatsApp sent to ${successCount} delegate${successCount > 1 ? "s" : ""}`)
    } else {
      toast.warning(`Sent ${successCount}, failed ${failCount} of ${withPhone.length}`)
    }
  }

  const exportCSV = () => {
    if (filteredRegistrations.length === 0) {
      toast.error("No rows to export")
      return
    }
    const headers = ["Reg Number", "Name", "Email", "Ticket Type", "Checked In", "Certificate Issued", "Downloaded", "Downloaded At", "Download Count"]
    const rows = filteredRegistrations.map((r: any) => [
      r.registration_number,
      `"${r.attendee_name || ""}"`,
      r.attendee_email,
      r.ticket_type?.name || "",
      r.checked_in ? "Yes" : "No",
      r.certificate_generated_at ? "Yes" : "No",
      r.certificate_downloaded_at ? "Yes" : "No",
      r.certificate_downloaded_at ? format(new Date(r.certificate_downloaded_at), "dd MMM yyyy HH:mm") : "",
      downloadCounts?.[r.id] || 0,
    ])
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `delegate-certificate-downloads-${new Date().toISOString().split("T")[0]}.csv`
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
          <h1 className="text-xl sm:text-2xl font-bold">Certificate Downloads</h1>
          <p className="text-muted-foreground">Track delegate self-service certificate downloads</p>
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
          Download count tracking started when this feature was deployed. The &quot;Downloaded&quot; column uses the existing certificate_downloaded_at timestamp.
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total Confirmed</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold">{stats?.total || 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="h-4 w-4 text-blue-500" />
            <span className="text-sm">Checked In</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats?.checkedIn || 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Award className="h-4 w-4 text-green-500" />
            <span className="text-sm">Certificates Issued</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{stats?.issued || 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <FileDown className="h-4 w-4 text-purple-500" />
            <span className="text-sm">Downloaded</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats?.downloaded || 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="h-4 w-4 text-orange-500" />
            <span className="text-sm">Download Rate</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-orange-600">{stats?.rate}%</p>
          <p className="text-xs text-muted-foreground">of issued certificates</p>
        </div>
      </div>

      {/* Filters */}
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
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="downloaded">Downloaded</SelectItem>
            <SelectItem value="not_yet">Not Yet</SelectItem>
            <SelectItem value="not_generated">Not Generated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={checkinFilter} onValueChange={setCheckinFilter}>
          <SelectTrigger className="w-full md:w-48">
            <UserCheck className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Check-in Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Check-in</SelectItem>
            <SelectItem value="checked_in">Checked In</SelectItem>
            <SelectItem value="not_checked_in">Not Checked In</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" onClick={handleSendSelected} disabled={!!sendingState || !!whatsappSendingState}>
            <Send className="h-4 w-4 mr-2" />
            Send Certificate Email
          </Button>
          <Button size="sm" variant="outline" onClick={handleBulkWhatsApp} disabled={!!sendingState || !!whatsappSendingState}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Send WhatsApp
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Sending Progress */}
      {sendingState && (
        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-green-600" />
          <span className="text-sm text-green-800 dark:text-green-200">
            Sending emails {sendingState.sent}/{sendingState.total}...
          </span>
        </div>
      )}

      {/* WhatsApp Sending Progress */}
      {whatsappSendingState && (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          <span className="text-sm text-emerald-800 dark:text-emerald-200">
            Sending WhatsApp {whatsappSendingState.sent}/{whatsappSendingState.total}...
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
              <TableHead>Ticket</TableHead>
              <TableHead>Checked In</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Downloaded</TableHead>
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
                <TableCell>{reg.ticket_type?.name || "-"}</TableCell>
                <TableCell>
                  {reg.checked_in ? (
                    <span className="text-green-600">Yes</span>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </TableCell>
                <TableCell>
                  {reg.certificate_generated_at ? (
                    <span className="text-green-600 text-sm">{format(new Date(reg.certificate_generated_at), "dd MMM, h:mm a")}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {reg.certificate_downloaded_at ? (
                    <span className="flex items-center gap-1 text-purple-600 text-sm">
                      <FileDown className="h-3.5 w-3.5" />
                      {format(new Date(reg.certificate_downloaded_at), "dd MMM, h:mm a")}
                    </span>
                  ) : reg.certificate_generated_at ? (
                    <span className="text-yellow-600 text-sm">Not yet</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className="font-mono">{downloadCounts?.[reg.id] || 0}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleSendIndividual(reg)}
                      disabled={!!sendingState || !!whatsappSendingState}
                      title="Send certificate email"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    {reg.attendee_phone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600"
                        onClick={() => handleWhatsAppIndividual(reg)}
                        disabled={!!sendingState || !!whatsappSendingState}
                        title="Send certificate via WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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
