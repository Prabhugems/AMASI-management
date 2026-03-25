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
  UtensilsCrossed,
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
        .select("*, ticket_type:ticket_types(name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })

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

  // Parse food preference from custom_fields
  const parseFoodPref = (r: any): "Veg" | "Non-Veg" | "Not Specified" => {
    const cf = r.custom_fields
    if (!cf || typeof cf !== "object") return "Not Specified"
    const raw = cf.food_preference ?? cf.Preferred_Food ?? cf.preferred_food ?? cf.Food_Preference ?? cf.foodPreference
    if (!raw) return "Not Specified"
    const val = String(raw).trim().toLowerCase().replace(/[\s_-]+/g, "")
    if (val === "veg" || val === "vegetarian") return "Veg"
    if (val === "nonveg" || val === "nonvegetarian") return "Non-Veg"
    return "Not Specified"
  }

  // Food preference stats
  const foodStats = useMemo(() => {
    if (!registrations) return null

    const overall: Record<string, number> = { "Veg": 0, "Non-Veg": 0, "Not Specified": 0 }
    const byTicket: Record<string, Record<string, number>> = {}

    registrations.forEach((r: any) => {
      const pref = parseFoodPref(r)
      overall[pref]++

      const ticketName = r.ticket_type?.name || "Unknown"
      if (!byTicket[ticketName]) {
        byTicket[ticketName] = { "Veg": 0, "Non-Veg": 0, "Not Specified": 0 }
      }
      byTicket[ticketName][pref]++
    })

    return {
      overall,
      byTicket: Object.entries(byTicket).sort(([a], [b]) => a.localeCompare(b)),
    }
  }, [registrations])

  const exportFoodCSV = () => {
    if (!foodStats) return

    const lines: string[] = []
    lines.push("Food Preference Summary")
    lines.push("")
    lines.push("Preference,Count")
    lines.push(`Veg,${foodStats.overall["Veg"]}`)
    lines.push(`Non-Veg,${foodStats.overall["Non-Veg"]}`)
    lines.push(`Not Specified,${foodStats.overall["Not Specified"]}`)
    lines.push("")
    lines.push("Breakdown by Ticket Type")
    lines.push("Ticket Type,Veg,Non-Veg,Not Specified,Total")
    foodStats.byTicket.forEach(([ticket, counts]) => {
      const total = counts["Veg"] + counts["Non-Veg"] + counts["Not Specified"]
      lines.push(`"${ticket}",${counts["Veg"]},${counts["Non-Veg"]},${counts["Not Specified"]},${total}`)
    })

    const csv = lines.join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `food-preference-summary-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Food preference report exported")
  }

  const exportCSV = () => {
    if (!registrations) return

    const headers = ["Reg Number", "Name", "Email", "Phone", "Institution", "Designation", "Ticket Type", "Status", "Amount", "Registered At"]
    const rows = registrations.map((r: any) => [
      r.registration_number || "",
      `"${(r.attendee_name || '').replace(/"/g, '""')}"`,
      r.attendee_email || "",
      r.attendee_phone || "",
      `"${(r.attendee_institution || '').replace(/"/g, '""')}"`,
      `"${(r.attendee_designation || '').replace(/"/g, '""')}"`,
      r.ticket_type?.name || "",
      r.status || "",
      r.total_amount || 0,
      r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN") : "",
    ])

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `registration-report-${new Date().toISOString().split("T")[0]}.csv`
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Registration Reports</h1>
          <p className="text-muted-foreground">Analytics and insights</p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Confirmed</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.confirmed}</p>
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
          <div className="overflow-x-auto">
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
        </div>

        {/* Recent Registrations by Date */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/50">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Recent Registration Trend
            </h3>
          </div>
          <div className="overflow-x-auto">
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

      {/* Food Preference Summary */}
      {foodStats && (
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/50 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4" />
              Food Preference Summary
            </h3>
            <Button variant="outline" size="sm" onClick={exportFoodCSV}>
              <Download className="h-3 w-3 mr-1" />
              Export CSV
            </Button>
          </div>
          <div className="p-4 space-y-4">
            {/* Overall counts */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                <p className="text-sm text-muted-foreground">Veg</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{foodStats.overall["Veg"]}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                <p className="text-sm text-muted-foreground">Non-Veg</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{foodStats.overall["Non-Veg"]}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Not Specified</p>
                <p className="text-2xl font-bold">{foodStats.overall["Not Specified"]}</p>
              </div>
            </div>

            {/* Breakdown by ticket type */}
            {foodStats.byTicket.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket Type</TableHead>
                      <TableHead className="text-right">Veg</TableHead>
                      <TableHead className="text-right">Non-Veg</TableHead>
                      <TableHead className="text-right">Not Specified</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {foodStats.byTicket.map(([ticket, counts]) => (
                      <TableRow key={ticket}>
                        <TableCell className="font-medium">{ticket}</TableCell>
                        <TableCell className="text-right">{counts["Veg"]}</TableCell>
                        <TableCell className="text-right">{counts["Non-Veg"]}</TableCell>
                        <TableCell className="text-right">{counts["Not Specified"]}</TableCell>
                        <TableCell className="text-right font-medium">
                          {counts["Veg"] + counts["Non-Veg"] + counts["Not Specified"]}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
