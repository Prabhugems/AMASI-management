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
  Ticket,
  IndianRupee,
  TrendingUp,
  Package,
} from "lucide-react"
import { toast } from "sonner"

export default function TicketReportsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch ticket types with sales data
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["ticket-reports", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ticket_types")
        .select("id, name, price, quantity_total, quantity_sold, status")
        .eq("event_id", eventId)
        .order("sort_order")

      return data || []
    },
  })

  // Calculate stats
  const stats = useMemo(() => {
    if (!tickets) return null

    const totalTickets = tickets.length
    const totalCapacity = tickets.reduce((sum: number, t: any) => sum + (t.quantity_total || 0), 0)
    const totalSold = tickets.reduce((sum: number, t: any) => sum + (t.quantity_sold || 0), 0)
    const totalRevenue = tickets.reduce((sum: number, t: any) => sum + ((t.quantity_sold || 0) * (t.price || 0)), 0)
    const activeTickets = tickets.filter((t: any) => t.status === "active").length

    return {
      totalTickets,
      totalCapacity,
      totalSold,
      totalRevenue,
      activeTickets,
      occupancyRate: totalCapacity > 0 ? ((totalSold / totalCapacity) * 100).toFixed(1) : 0,
    }
  }, [tickets])

  const exportCSV = () => {
    if (!tickets) return

    const headers = ["Ticket Name", "Price", "Capacity", "Sold", "Available", "Revenue", "Status"]
    const rows = tickets.map((t: any) => [
      t.name,
      t.price || 0,
      t.quantity_total || 0,
      t.quantity_sold || 0,
      (t.quantity_total || 0) - (t.quantity_sold || 0),
      (t.quantity_sold || 0) * (t.price || 0),
      t.status,
    ])

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ticket-report-${new Date().toISOString().split("T")[0]}.csv`
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
          <h1 className="text-2xl font-bold">Ticket Reports</h1>
          <p className="text-muted-foreground">Sales and capacity overview</p>
        </div>
        <Button onClick={exportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Ticket className="h-4 w-4" />
            <span className="text-sm">Ticket Types</span>
          </div>
          <p className="text-2xl font-bold">{stats?.totalTickets || 0}</p>
          <p className="text-xs text-muted-foreground">{stats?.activeTickets || 0} active</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Package className="h-4 w-4" />
            <span className="text-sm">Total Capacity</span>
          </div>
          <p className="text-2xl font-bold">{stats?.totalCapacity || 0}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Total Sold</span>
          </div>
          <p className="text-2xl font-bold">{stats?.totalSold || 0}</p>
          <p className="text-xs text-muted-foreground">{stats?.occupancyRate}% capacity</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <IndianRupee className="h-4 w-4" />
            <span className="text-sm">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold">₹{(stats?.totalRevenue || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Ticket Details Table */}
      <div className="bg-card border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket Name</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
              <TableHead className="text-right">Sold</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets?.map((ticket: any) => (
              <TableRow key={ticket.id}>
                <TableCell className="font-medium">{ticket.name}</TableCell>
                <TableCell className="text-right">₹{(ticket.price || 0).toLocaleString()}</TableCell>
                <TableCell className="text-right">{ticket.quantity_total || 0}</TableCell>
                <TableCell className="text-right">{ticket.quantity_sold || 0}</TableCell>
                <TableCell className="text-right">
                  {(ticket.quantity_total || 0) - (ticket.quantity_sold || 0)}
                </TableCell>
                <TableCell className="text-right">
                  ₹{((ticket.quantity_sold || 0) * (ticket.price || 0)).toLocaleString()}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    ticket.status === "active" ? "bg-green-100 text-green-800" :
                    ticket.status === "paused" ? "bg-yellow-100 text-yellow-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {ticket.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {(!tickets || tickets.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No tickets found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
