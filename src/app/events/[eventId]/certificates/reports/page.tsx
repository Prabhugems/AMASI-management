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
  Award,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

export default function CertificateReportsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch registrations with certificate status
  const { data: registrations, isLoading } = useQuery({
    queryKey: ["certificate-reports", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, registration_number, attendee_name, attendee_email, status, certificate_generated_at, certificate_url, checked_in, ticket_type:ticket_types(name)")
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
    const checkedIn = registrations.filter((r: any) => r.checked_in).length
    const generated = registrations.filter((r: any) => r.certificate_generated_at).length
    const pending = checkedIn - generated
    const notCheckedIn = total - checkedIn

    // By ticket type
    const byTicket: Record<string, { total: number; checkedIn: number; generated: number }> = {}
    registrations.forEach((r: any) => {
      const ticketName = r.ticket_type?.name || "Unknown"
      if (!byTicket[ticketName]) {
        byTicket[ticketName] = { total: 0, checkedIn: 0, generated: 0 }
      }
      byTicket[ticketName].total++
      if (r.checked_in) byTicket[ticketName].checkedIn++
      if (r.certificate_generated_at) byTicket[ticketName].generated++
    })

    return {
      total,
      checkedIn,
      generated,
      pending: pending > 0 ? pending : 0,
      notCheckedIn,
      percentGenerated: checkedIn > 0 ? ((generated / checkedIn) * 100).toFixed(1) : 0,
      byTicket,
    }
  }, [registrations])

  const exportCSV = () => {
    if (!registrations) return

    const headers = ["Reg Number", "Name", "Email", "Ticket Type", "Checked In", "Certificate Status", "Generated At"]
    const rows = registrations.map((r: any) => [
      r.registration_number,
      `"${r.attendee_name || ''}"`,
      r.attendee_email,
      r.ticket_type?.name || "",
      r.checked_in ? "Yes" : "No",
      r.certificate_generated_at ? "Issued" : (r.checked_in ? "Pending" : "Not Eligible"),
      r.certificate_generated_at ? format(new Date(r.certificate_generated_at), "dd MMM yyyy HH:mm") : "",
    ])

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `certificate-report-${new Date().toISOString().split("T")[0]}.csv`
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Certificate Reports</h1>
          <p className="text-muted-foreground">Certificate issuance status overview</p>
        </div>
        <Button onClick={exportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Award className="h-4 w-4" />
            <span className="text-sm">Total Confirmed</span>
          </div>
          <p className="text-2xl font-bold">{stats?.total || 0}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="h-4 w-4 text-blue-500" />
            <span className="text-sm">Checked In</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats?.checkedIn || 0}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Award className="h-4 w-4 text-green-500" />
            <span className="text-sm">Certificates Issued</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats?.generated || 0}</p>
          <p className="text-xs text-muted-foreground">{stats?.percentGenerated}% of checked-in</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">Pending</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <XCircle className="h-4 w-4 text-gray-400" />
            <span className="text-sm">Not Checked In</span>
          </div>
          <p className="text-2xl font-bold text-gray-500">{stats?.notCheckedIn || 0}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-card border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Certificate Issuance Progress</h3>
        <div className="h-4 bg-muted rounded-full overflow-hidden flex">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${stats?.checkedIn ? ((stats.generated / stats.checkedIn) * 100) : 0}%` }}
            title="Issued"
          />
          <div
            className="h-full bg-yellow-500 transition-all"
            style={{ width: `${stats?.checkedIn ? ((stats.pending / stats.checkedIn) * 100) : 0}%` }}
            title="Pending"
          />
        </div>
        <div className="flex gap-4 mt-2 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-500 rounded" /> Issued
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-yellow-500 rounded" /> Pending
          </span>
        </div>
      </div>

      {/* Registrations Table */}
      <div className="bg-card border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reg Number</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Ticket Type</TableHead>
              <TableHead>Checked In</TableHead>
              <TableHead>Certificate</TableHead>
              <TableHead>Issued At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations?.map((reg: any) => (
              <TableRow key={reg.id}>
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
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Issued
                    </span>
                  ) : reg.checked_in ? (
                    <span className="flex items-center gap-1 text-yellow-600">
                      <Clock className="h-4 w-4" />
                      Pending
                    </span>
                  ) : (
                    <span className="text-gray-400">Not Eligible</span>
                  )}
                </TableCell>
                <TableCell>
                  {reg.certificate_generated_at
                    ? format(new Date(reg.certificate_generated_at), "dd MMM yyyy HH:mm")
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
            {(!registrations || registrations.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
