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
  BarChart3,
  Loader2,
  Download,
  Users,
  IndianRupee,
  Ticket,
  Calendar,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"

export default function RegistrationReportsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch registrations
  const { data: registrations, isLoading } = useQuery({
    queryKey: ["registration-reports", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, status, total_amount, created_at, ticket_type:ticket_types(name)")
        .eq("event_id", eventId)

      return data || []
    },
  })

  // Calculate stats
  const stats = useMemo(() => {
    if (!registrations) return null

    const total = registrations.length
    const confirmed = registrations.filter((r: any) => r.status === "confirmed").length
    const revenue = registrations
      .filter((r: any) => r.status === "confirmed")
      .reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0)

    // By ticket type
    const byTicket: Record<string, { count: number; revenue: number }> = {}
    registrations.forEach((r: any) => {
      const ticketName = r.ticket_type?.name || "Unknown"
      if (!byTicket[ticketName]) {
        byTicket[ticketName] = { count: 0, revenue: 0 }
      }
      byTicket[ticketName].count++
      if (r.status === "confirmed") {
        byTicket[ticketName].revenue += r.total_amount || 0
      }
    })

    // By date
    const byDate: Record<string, number> = {}
    registrations.forEach((r: any) => {
      const date = new Date(r.created_at).toISOString().split("T")[0]
      byDate[date] = (byDate[date] || 0) + 1
    })

    // By status
    const byStatus: Record<string, number> = {}
    registrations.forEach((r: any) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1
    })

    return {
      total,
      confirmed,
      revenue,
      avgTicketPrice: confirmed > 0 ? revenue / confirmed : 0,
      byTicket: Object.entries(byTicket).sort(([, a], [, b]) => b.count - a.count),
      byDate: Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a)).slice(0, 10),
      byStatus: Object.entries(byStatus),
    }
  }, [registrations])

  const exportReport = () => {
    if (!stats) return

    let content = "REGISTRATION REPORT\n"
    content += "=".repeat(50) + "\n\n"

    content += "SUMMARY\n"
    content += "-".repeat(30) + "\n"
    content += `Total Registrations: ${stats.total}\n`
    content += `Confirmed: ${stats.confirmed}\n`
    content += `Total Revenue: ₹${stats.revenue.toLocaleString()}\n`
    content += `Avg Ticket Price: ₹${Math.round(stats.avgTicketPrice).toLocaleString()}\n\n`

    content += "BY TICKET TYPE\n"
    content += "-".repeat(30) + "\n"
    stats.byTicket.forEach(([ticket, data]) => {
      content += `${ticket}: ${data.count} (₹${data.revenue.toLocaleString()})\n`
    })

    content += "\nBY STATUS\n"
    content += "-".repeat(30) + "\n"
    stats.byStatus.forEach(([status, count]) => {
      content += `${status}: ${count}\n`
    })

    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `registration-report-${new Date().toISOString().split("T")[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Report exported")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No data available</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Registration Reports</h1>
          <p className="text-muted-foreground">Analytics and insights</p>
        </div>
        <Button variant="outline" onClick={exportReport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Confirmed</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.confirmed}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-purple-600">
            <IndianRupee className="h-4 w-4" />
            <span className="text-sm">Revenue</span>
          </div>
          <p className="text-xl font-bold mt-1">₹{stats.revenue.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-500">
            <Ticket className="h-4 w-4" />
            <span className="text-sm">Avg Price</span>
          </div>
          <p className="text-xl font-bold mt-1">₹{Math.round(stats.avgTicketPrice).toLocaleString()}</p>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Ticket Type */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/50">
            <h3 className="font-semibold flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              By Ticket Type
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.byTicket.map(([ticket, data]) => (
                <TableRow key={ticket}>
                  <TableCell className="font-medium">{ticket}</TableCell>
                  <TableCell className="text-right">{data.count}</TableCell>
                  <TableCell className="text-right">₹{data.revenue.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Recent Registrations by Date */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/50">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Recent Registration Trend
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Registrations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.byDate.map(([date, count]) => (
                <TableRow key={date}>
                  <TableCell className="font-medium">
                    {new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-right">{count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
