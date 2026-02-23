"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Loader2, Download, BadgeCheck, CheckCircle, Clock, Users, Info } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

export default function DelegatePortalBadgesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const { data: registrations, isLoading } = useQuery({
    queryKey: ["delegate-portal-badges", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, registration_number, attendee_name, attendee_email, badge_generated_at, badge_downloaded_by_delegate_at, ticket_type:ticket_types(name)")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .order("attendee_name")
      return data || []
    },
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

  const stats = useMemo(() => {
    if (!registrations) return null
    const total = registrations.length
    const generated = registrations.filter((r: any) => r.badge_generated_at).length
    const downloaded = registrations.filter((r: any) => r.badge_downloaded_by_delegate_at).length
    const rate = generated > 0 ? ((downloaded / generated) * 100).toFixed(1) : "0"
    return { total, generated, downloaded, rate }
  }, [registrations])

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
        <Button onClick={exportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
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

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reg #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Badge Generated</TableHead>
              <TableHead>Delegate Downloaded</TableHead>
              <TableHead>Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations?.map((reg: any) => (
              <TableRow key={reg.id}>
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
              </TableRow>
            ))}
            {(!registrations || registrations.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No confirmed registrations found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
