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
  CreditCard,
  Wallet,
  ArrowDownRight,
  Banknote,
  Globe,
} from "lucide-react"
import { toast } from "sonner"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  razorpay: "Razorpay (Online)",
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  free: "Free",
}

/** Format currency amount as whole number */
const fmtAmt = (v: number | null | undefined) =>
  `₹${Math.round(v || 0).toLocaleString("en-IN")}`

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
        .select("*, ticket_type:ticket_types(name, price)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })

      return data || []
    },
  })

  // Fetch payments for this event
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["payment-reports", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("payments")
        .select("*")
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

  // Revenue dashboard stats (from payments table)
  const revenueStats = useMemo(() => {
    if (!payments || !registrations) return null

    // Completed payments = actual revenue
    const completedPayments = payments.filter(
      (p: any) => p.status === "completed"
    )
    const totalRevenue = completedPayments.reduce(
      (sum: number, p: any) => sum + (p.amount || 0),
      0
    )

    // Online (razorpay) vs offline (cash/bank_transfer)
    const onlineRevenue = completedPayments
      .filter((p: any) => p.payment_method === "razorpay")
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
    const offlineRevenue = completedPayments
      .filter((p: any) => p.payment_method === "cash" || p.payment_method === "bank_transfer")
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

    // Refunded
    const refundedPayments = payments.filter(
      (p: any) => p.status === "refunded" || p.status === "partially_refunded"
    )
    const refundedAmount = refundedPayments.reduce(
      (sum: number, p: any) => sum + (p.amount || 0),
      0
    )

    const netRevenue = totalRevenue - refundedAmount

    // Revenue by ticket type (from confirmed registrations)
    const byTicketType: Record<
      string,
      { name: string; quantity: number; unitPrice: number; totalRevenue: number }
    > = {}
    registrations
      .filter((r: any) => r.status === "confirmed")
      .forEach((r: any) => {
        const ticketName = r.ticket_type?.name || "Unknown"
        const ticketPrice = r.ticket_type?.price || 0
        if (!byTicketType[ticketName]) {
          byTicketType[ticketName] = {
            name: ticketName,
            quantity: 0,
            unitPrice: ticketPrice,
            totalRevenue: 0,
          }
        }
        byTicketType[ticketName].quantity++
        byTicketType[ticketName].totalRevenue += r.total_amount || 0
      })

    const ticketTypeRevenue = Object.values(byTicketType).sort(
      (a, b) => b.totalRevenue - a.totalRevenue
    )

    // Daily revenue for last 30 days
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

    const dailyRevenueMap: Record<string, number> = {}
    // Initialize all 30 days
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo)
      d.setDate(d.getDate() + i)
      dailyRevenueMap[d.toISOString().split("T")[0]] = 0
    }
    // Fill in actual revenue from completed payments
    completedPayments.forEach((p: any) => {
      const date = new Date(p.completed_at || p.created_at)
        .toISOString()
        .split("T")[0]
      if (dailyRevenueMap[date] !== undefined) {
        dailyRevenueMap[date] += p.amount || 0
      }
    })
    const dailyRevenue = Object.entries(dailyRevenueMap).sort(([a], [b]) =>
      a.localeCompare(b)
    )
    const maxDailyRevenue = Math.max(
      ...dailyRevenue.map(([, v]) => v),
      1
    )

    // Payment method breakdown
    const byMethod: Record<
      string,
      { count: number; amount: number }
    > = {}
    completedPayments.forEach((p: any) => {
      const method = p.payment_method || "unknown"
      if (!byMethod[method]) {
        byMethod[method] = { count: 0, amount: 0 }
      }
      byMethod[method].count++
      byMethod[method].amount += p.amount || 0
    })
    const paymentMethods = Object.entries(byMethod).sort(
      ([, a], [, b]) => b.amount - a.amount
    )

    return {
      totalRevenue,
      onlineRevenue,
      offlineRevenue,
      refundedAmount,
      netRevenue,
      ticketTypeRevenue,
      dailyRevenue,
      maxDailyRevenue,
      paymentMethods,
      totalPayments: completedPayments.length,
    }
  }, [payments, registrations])

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

  const exportRevenueCSV = () => {
    if (!revenueStats) return

    const lines: string[] = []
    lines.push("Revenue Dashboard Report")
    lines.push("")
    lines.push("Revenue Summary")
    lines.push(`Total Revenue,${revenueStats.totalRevenue}`)
    lines.push(`Online Revenue,${revenueStats.onlineRevenue}`)
    lines.push(`Offline Revenue,${revenueStats.offlineRevenue}`)
    lines.push(`Refunded Amount,${revenueStats.refundedAmount}`)
    lines.push(`Net Revenue,${revenueStats.netRevenue}`)
    lines.push("")
    lines.push("Revenue by Ticket Type")
    lines.push("Ticket Name,Quantity,Unit Price,Total Revenue,% of Total")
    revenueStats.ticketTypeRevenue.forEach((t) => {
      const pct = revenueStats.totalRevenue > 0
        ? ((t.totalRevenue / revenueStats.totalRevenue) * 100).toFixed(1)
        : "0.0"
      lines.push(`"${t.name}",${t.quantity},${t.unitPrice},${t.totalRevenue},${pct}%`)
    })
    lines.push("")
    lines.push("Payment Method Breakdown")
    lines.push("Method,Count,Amount")
    revenueStats.paymentMethods.forEach(([method, data]) => {
      lines.push(`"${PAYMENT_METHOD_LABELS[method] || method}",${data.count},${data.amount}`)
    })
    lines.push("")
    lines.push("Daily Revenue (Last 30 Days)")
    lines.push("Date,Revenue")
    revenueStats.dailyRevenue.forEach(([date, amount]) => {
      lines.push(`${date},${amount}`)
    })

    const csv = lines.join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `revenue-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Revenue report exported")
  }

  if (isLoading || paymentsLoading) {
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
          <p className="text-xl font-bold mt-1">{fmtAmt(stats.revenue)}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-500">
            <Ticket className="h-4 w-4" />
            <span className="text-sm">Avg Price</span>
          </div>
          <p className="text-xl font-bold mt-1">{fmtAmt(stats.avgTicketPrice)}</p>
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
                  <TableCell className="text-right">{fmtAmt(data.revenue)}</TableCell>
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

      {/* ==================== REVENUE DASHBOARD ==================== */}
      {revenueStats && (
        <>
          {/* Revenue Dashboard Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t">
            <div>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-purple-600" />
                Revenue Dashboard
              </h2>
              <p className="text-sm text-muted-foreground">
                Payment analytics from {revenueStats.totalPayments} completed transaction{revenueStats.totalPayments !== 1 ? "s" : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={exportRevenueCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export Revenue CSV
            </Button>
          </div>

          {/* Revenue Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-2 text-purple-600">
                <IndianRupee className="h-4 w-4" />
                <span className="text-sm">Total Revenue</span>
              </div>
              <p className="text-xl font-bold mt-1">{fmtAmt(revenueStats.totalRevenue)}</p>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-2 text-blue-600">
                <Globe className="h-4 w-4" />
                <span className="text-sm">Online</span>
              </div>
              <p className="text-xl font-bold mt-1">{fmtAmt(revenueStats.onlineRevenue)}</p>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-2 text-amber-600">
                <Banknote className="h-4 w-4" />
                <span className="text-sm">Offline</span>
              </div>
              <p className="text-xl font-bold mt-1">{fmtAmt(revenueStats.offlineRevenue)}</p>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-2 text-red-500">
                <ArrowDownRight className="h-4 w-4" />
                <span className="text-sm">Refunded</span>
              </div>
              <p className="text-xl font-bold mt-1">{fmtAmt(revenueStats.refundedAmount)}</p>
            </div>
            <div className="bg-card rounded-lg border p-4 col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Net Revenue</span>
              </div>
              <p className="text-xl font-bold mt-1 text-green-700 dark:text-green-400">
                {fmtAmt(revenueStats.netRevenue)}
              </p>
            </div>
          </div>

          {/* Revenue by Ticket Type + Payment Method Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue by Ticket Type */}
            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/50">
                <h3 className="font-semibold flex items-center gap-2">
                  <Ticket className="h-4 w-4" />
                  Revenue by Ticket Type
                </h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueStats.ticketTypeRevenue.map((t) => {
                      const pct =
                        revenueStats.totalRevenue > 0
                          ? ((t.totalRevenue / revenueStats.totalRevenue) * 100).toFixed(1)
                          : "0.0"
                      return (
                        <TableRow key={t.name}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell className="text-right">{t.quantity}</TableCell>
                          <TableCell className="text-right">
                            {fmtAmt(t.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {fmtAmt(t.totalRevenue)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-950/40 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300">
                              {pct}%
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {revenueStats.ticketTypeRevenue.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          No ticket revenue data
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/50">
                <h3 className="font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Method Breakdown
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {revenueStats.paymentMethods.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No payment data</p>
                ) : (
                  revenueStats.paymentMethods.map(([method, data]) => {
                    const pct =
                      revenueStats.totalRevenue > 0
                        ? (data.amount / revenueStats.totalRevenue) * 100
                        : 0
                    return (
                      <div key={method} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <PaymentMethodIcon method={method} />
                            <span className="font-medium">
                              {PAYMENT_METHOD_LABELS[method] || method}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span>{data.count} txn{data.count !== 1 ? "s" : ""}</span>
                            <span className="font-medium text-foreground">
                              {fmtAmt(data.amount)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(pct, 1)}%`,
                              backgroundColor: getMethodColor(method),
                            }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Daily Revenue Chart */}
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/50">
              <h3 className="font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Daily Revenue (Last 30 Days)
              </h3>
            </div>
            <div className="p-4">
              <div className="flex items-end gap-[3px] h-48">
                {revenueStats.dailyRevenue.map(([date, amount]) => {
                  const heightPct =
                    revenueStats.maxDailyRevenue > 0
                      ? (amount / revenueStats.maxDailyRevenue) * 100
                      : 0
                  const dateObj = new Date(date)
                  const dayLabel = dateObj.getDate().toString()
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6

                  return (
                    <div
                      key={date}
                      className="flex-1 flex flex-col items-center justify-end group relative min-w-0"
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                        <div className="bg-popover text-popover-foreground border rounded-md shadow-md px-2.5 py-1.5 text-xs whitespace-nowrap">
                          <div className="font-medium">
                            {dateObj.toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-muted-foreground">
                            {fmtAmt(amount)}
                          </div>
                        </div>
                      </div>

                      {/* Bar */}
                      <div
                        className="w-full rounded-t transition-all duration-300 group-hover:opacity-80"
                        style={{
                          height: amount > 0 ? `${Math.max(heightPct, 2)}%` : "2px",
                          backgroundColor: amount > 0 ? (isWeekend ? "#8b5cf6" : "#6366f1") : "transparent",
                          minHeight: amount > 0 ? "4px" : "2px",
                          borderBottom: amount === 0 ? "2px solid hsl(var(--border))" : "none",
                        }}
                      />
                      {/* Date label - show every 5th day or first/last */}
                      <span className="text-[9px] text-muted-foreground mt-1 leading-none hidden sm:block">
                        {parseInt(dayLabel) === 1 ||
                        parseInt(dayLabel) % 5 === 0 ||
                        date === revenueStats.dailyRevenue[revenueStats.dailyRevenue.length - 1]?.[0]
                          ? dayLabel
                          : ""}
                      </span>
                    </div>
                  )
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span>
                  {new Date(revenueStats.dailyRevenue[0]?.[0]).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#6366f1" }} />
                    <span>Weekday</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#8b5cf6" }} />
                    <span>Weekend</span>
                  </div>
                </div>
                <span>
                  {new Date(
                    revenueStats.dailyRevenue[revenueStats.dailyRevenue.length - 1]?.[0]
                  ).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

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

// Helper: Icon for payment method
function PaymentMethodIcon({ method }: { method: string }) {
  switch (method) {
    case "razorpay":
      return <CreditCard className="h-4 w-4 text-blue-600" />
    case "cash":
      return <Banknote className="h-4 w-4 text-green-600" />
    case "bank_transfer":
      return <Wallet className="h-4 w-4 text-amber-600" />
    case "free":
      return <Ticket className="h-4 w-4 text-gray-500" />
    default:
      return <CreditCard className="h-4 w-4 text-muted-foreground" />
  }
}

// Helper: Color for payment method bar
function getMethodColor(method: string): string {
  switch (method) {
    case "razorpay":
      return "#3b82f6" // blue-500
    case "cash":
      return "#22c55e" // green-500
    case "bank_transfer":
      return "#f59e0b" // amber-500
    case "free":
      return "#9ca3af" // gray-400
    default:
      return "#6366f1" // indigo-500
  }
}
