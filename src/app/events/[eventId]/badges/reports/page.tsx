"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Loader2,
  Download,
  BadgeCheck,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

export default function BadgeReportsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch registrations with badge status
  const { data: registrations, isLoading } = useQuery({
    queryKey: ["badge-reports", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, registration_number, attendee_name, attendee_email, status, badge_generated_at, badge_url, ticket_type:ticket_types(name)")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .order("attendee_name")

      return data || []
    },
  })

  // Calculate stats
  const stats = useMemo(() => {
    if (!registrations) return null

    const total = registrations.length
    const generated = registrations.filter((r: any) => r.badge_generated_at).length
    const pending = total - generated

    // By ticket type
    const byTicket: Record<string, { total: number; generated: number }> = {}
    registrations.forEach((r: any) => {
      const ticketName = r.ticket_type?.name || "Unknown"
      if (!byTicket[ticketName]) {
        byTicket[ticketName] = { total: 0, generated: 0 }
      }
      byTicket[ticketName].total++
      if (r.badge_generated_at) {
        byTicket[ticketName].generated++
      }
    })

    return {
      total,
      generated,
      pending,
      percentGenerated: total > 0 ? ((generated / total) * 100).toFixed(1) : 0,
      byTicket,
    }
  }, [registrations])

  const exportCSV = () => {
    if (!registrations) return

    const headers = ["Reg Number", "Name", "Email", "Ticket Type", "Badge Status", "Generated At"]
    const rows = registrations.map((r: any) => [
      r.registration_number,
      `"${r.attendee_name || ''}"`,
      r.attendee_email,
      r.ticket_type?.name || "",
      r.badge_generated_at ? "Generated" : "Pending",
      r.badge_generated_at ? format(new Date(r.badge_generated_at), "dd MMM yyyy HH:mm") : "",
    ])

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `badge-report-${new Date().toISOString().split("T")[0]}.csv`
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Badge Reports</h1>
          <p className="text-muted-foreground">Badge generation status overview</p>
        </div>
        <Button onClick={exportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BadgeCheck className="h-4 w-4" />
            <span className="text-sm">Total Confirmed</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold">{stats?.total || 0}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">Badges Generated</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{stats?.generated || 0}</p>
          <p className="text-xs text-muted-foreground">{stats?.percentGenerated}%</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">Pending</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats?.pending || 0}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">Completion</span>
          </div>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${stats?.percentGenerated || 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* By Ticket Type */}
      {stats?.byTicket && Object.keys(stats.byTicket).length > 0 && (
        <div className="bg-card border rounded-lg p-4">
          <h3 className="font-semibold mb-3">By Ticket Type</h3>
          <div className="space-y-2">
            {Object.entries(stats.byTicket).map(([ticket, data]) => (
              <div key={ticket} className="flex items-center justify-between">
                <span>{ticket}</span>
                <span className="text-sm text-muted-foreground">
                  {data.generated}/{data.total} generated
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registrations Table */}
      <div className="bg-card border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reg Number</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Ticket Type</TableHead>
              <TableHead>Badge Status</TableHead>
              <TableHead>Generated At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations?.map((reg: any) => (
              <TableRow key={reg.id}>
                <TableCell className="font-mono text-sm">{reg.registration_number}</TableCell>
                <TableCell className="font-medium">{reg.attendee_name}</TableCell>
                <TableCell>{reg.ticket_type?.name || "-"}</TableCell>
                <TableCell>
                  {reg.badge_generated_at ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Generated
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-600">
                      <Clock className="h-4 w-4" />
                      Pending
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {reg.badge_generated_at
                    ? format(new Date(reg.badge_generated_at), "dd MMM yyyy HH:mm")
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
            {(!registrations || registrations.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
