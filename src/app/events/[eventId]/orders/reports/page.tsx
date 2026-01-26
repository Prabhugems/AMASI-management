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
  Receipt,
  IndianRupee,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

export default function OrderReportsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch orders (payments) for this event
  const { data: orders, isLoading } = useQuery({
    queryKey: ["order-reports", eventId],
    queryFn: async () => {
      const { data: payments } = await (supabase as any)
        .from("payments")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })

      if (!payments || payments.length === 0) return []

      // Fetch registrations for these payments
      const paymentIds = payments.map((p: any) => p.id)
      const { data: regs } = await (supabase as any)
        .from("registrations")
        .select("id, payment_id, registration_number, attendee_name, attendee_email, attendee_phone, unit_price, total_amount, ticket_type:ticket_types(name, price)")
        .in("payment_id", paymentIds)

      // Fetch addons for registrations
      const regIds = regs?.map((r: any) => r.id) || []
      const { data: addons } = await (supabase as any)
        .from("registration_addons")
        .select("registration_id, quantity, unit_price, total_price, addon:addons(name, price)")
        .in("registration_id", regIds)

      // Map addons by registration
      const addonsByReg: Record<string, any[]> = {}
      addons?.forEach((a: any) => {
        if (!addonsByReg[a.registration_id]) addonsByReg[a.registration_id] = []
        const qty = a.quantity || 1
        const addonPrice = a.addon?.price || 0
        addonsByReg[a.registration_id].push({
          name: a.addon?.name || "Add-on",
          quantity: qty,
          unit_price: a.unit_price || addonPrice,
          price: a.total_price || (addonPrice * qty),
        })
      })

      // Map registrations to payments
      return payments.map((payment: any) => {
        const paymentRegs = regs?.filter((r: any) => r.payment_id === payment.id) || []
        const allAddons: any[] = []
        paymentRegs.forEach((r: any) => {
          const regAddons = addonsByReg[r.id] || []
          allAddons.push(...regAddons)
        })
        // Calculate ticket amount (sum of unit prices)
        const ticketAmount = paymentRegs.reduce((sum: number, r: any) => sum + (r.unit_price || r.ticket_type?.price || 0), 0)

        return {
          ...payment,
          registrations: paymentRegs,
          addons: allAddons,
          ticket_count: paymentRegs.length,
          ticket_names: paymentRegs.map((r: any) => r.ticket_type?.name || "").filter(Boolean).join(", "),
          ticket_prices: paymentRegs.map((r: any) => r.unit_price || r.ticket_type?.price || 0).join(", "),
          ticket_amount: ticketAmount,
          attendee_names: paymentRegs.map((r: any) => r.attendee_name || "").filter(Boolean).join(", "),
          registration_numbers: paymentRegs.map((r: any) => r.registration_number || "").filter(Boolean).join(", "),
          addon_names: allAddons.map((a: any) => a.name).join(", "),
          addon_total: allAddons.reduce((sum: number, a: any) => sum + (a.price || 0), 0),
        }
      })
    },
  })

  // Calculate stats
  const stats = useMemo(() => {
    if (!orders) return null

    const total = orders.length
    const completed = orders.filter((o: any) => o.status === "completed").length
    const pending = orders.filter((o: any) => o.status === "pending").length
    const failed = orders.filter((o: any) => o.status === "failed").length
    const refunded = orders.filter((o: any) => o.status === "refunded").length

    const totalRevenue = orders
      .filter((o: any) => o.status === "completed")
      .reduce((sum: number, o: any) => sum + (o.net_amount || 0), 0)

    const totalTax = orders
      .filter((o: any) => o.status === "completed")
      .reduce((sum: number, o: any) => sum + (o.tax_amount || 0), 0)

    const totalDiscount = orders
      .filter((o: any) => o.status === "completed")
      .reduce((sum: number, o: any) => sum + (o.discount_amount || 0), 0)

    // By payment method
    const byMethod: Record<string, { count: number; revenue: number }> = {}
    orders.filter((o: any) => o.status === "completed").forEach((o: any) => {
      const method = o.payment_method || "unknown"
      if (!byMethod[method]) byMethod[method] = { count: 0, revenue: 0 }
      byMethod[method].count++
      byMethod[method].revenue += o.net_amount || 0
    })

    // By date
    const byDate: Record<string, { count: number; revenue: number }> = {}
    orders.filter((o: any) => o.status === "completed").forEach((o: any) => {
      const date = o.created_at ? new Date(o.created_at).toISOString().split("T")[0] : "unknown"
      if (!byDate[date]) byDate[date] = { count: 0, revenue: 0 }
      byDate[date].count++
      byDate[date].revenue += o.net_amount || 0
    })

    return {
      total,
      completed,
      pending,
      failed,
      refunded,
      totalRevenue,
      totalTax,
      totalDiscount,
      avgOrderValue: completed > 0 ? totalRevenue / completed : 0,
      byMethod,
      byDate: Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a)).slice(0, 10),
    }
  }, [orders])

  const exportCSV = () => {
    if (!orders) return

    const headers = [
      "Order Number",
      "Payer Name",
      "Payer Email",
      "Payer Phone",
      "Registration Numbers",
      "Ticket Count",
      "Ticket Types",
      "Ticket Prices",
      "Ticket Amount",
      "Attendee Names",
      "Addons",
      "Addon Amount",
      "Subtotal",
      "Tax",
      "Discount",
      "Net Amount",
      "Status",
      "Payment Method",
      "Razorpay Order ID",
      "Razorpay Payment ID",
      "Order Date",
      "Completed At",
    ]
    const rows = orders.map((o: any) => [
      o.payment_number || "",
      `"${(o.payer_name || '').replace(/"/g, '""')}"`,
      o.payer_email || "",
      o.payer_phone || "",
      `"${(o.registration_numbers || '').replace(/"/g, '""')}"`,
      o.ticket_count || 0,
      `"${(o.ticket_names || '').replace(/"/g, '""')}"`,
      `"${(o.ticket_prices || '').replace(/"/g, '""')}"`,
      o.ticket_amount || 0,
      `"${(o.attendee_names || '').replace(/"/g, '""')}"`,
      `"${(o.addon_names || '').replace(/"/g, '""')}"`,
      o.addon_total || 0,
      o.amount || 0,
      o.tax_amount || 0,
      o.discount_amount || 0,
      o.net_amount || 0,
      o.status || "",
      o.payment_method || "",
      o.razorpay_order_id || "",
      o.razorpay_payment_id || "",
      o.created_at ? format(new Date(o.created_at), "dd/MM/yyyy HH:mm") : "",
      o.completed_at ? format(new Date(o.completed_at), "dd/MM/yyyy HH:mm") : "",
    ])

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `order-report-${new Date().toISOString().split("T")[0]}.csv`
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order Reports</h1>
          <p className="text-muted-foreground">Payment and revenue analytics</p>
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
            <Receipt className="h-4 w-4" />
            <span className="text-sm">Total Orders</span>
          </div>
          <p className="text-2xl font-bold">{stats?.total || 0}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">Completed</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats?.completed || 0}</p>
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
            <IndianRupee className="h-4 w-4 text-blue-500" />
            <span className="text-sm">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{(stats?.totalRevenue || 0).toLocaleString()}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            <span className="text-sm">Avg Order Value</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{Math.round(stats?.avgOrderValue || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Payment Method */}
        {stats?.byMethod && Object.keys(stats.byMethod).length > 0 && (
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-3">By Payment Method</h3>
            <div className="space-y-2">
              {Object.entries(stats.byMethod).map(([method, data]) => (
                <div key={method} className="flex items-center justify-between">
                  <span className="capitalize">{method}</span>
                  <span className="text-sm">
                    {data.count} orders ({data.revenue.toLocaleString()})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tax & Discount Summary */}
        <div className="bg-card border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Financial Summary</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Gross Revenue</span>
              <span className="font-medium">{((stats?.totalRevenue || 0) + (stats?.totalDiscount || 0)).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-green-600">
              <span>Discounts Given</span>
              <span>-{(stats?.totalDiscount || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Tax Collected</span>
              <span>{(stats?.totalTax || 0).toLocaleString()}</span>
            </div>
            <div className="border-t pt-2 flex items-center justify-between font-bold">
              <span>Net Revenue</span>
              <span>{(stats?.totalRevenue || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-card border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Payer</TableHead>
              <TableHead>Reg Numbers</TableHead>
              <TableHead>Tickets</TableHead>
              <TableHead>Addons</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.slice(0, 100).map((order: any) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-sm">{order.payment_number}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{order.payer_name}</p>
                    <p className="text-xs text-muted-foreground">{order.payer_email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-mono text-xs">{order.registration_numbers || "-"}</p>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm">{order.ticket_count} ticket(s)</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">{order.ticket_names || "-"}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {order.addon_names ? (
                    <p className="text-xs truncate max-w-[120px]">{order.addon_names}</p>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">{(order.net_amount || 0).toLocaleString()}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    order.status === "completed" ? "bg-green-100 text-green-800" :
                    order.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                    order.status === "failed" ? "bg-red-100 text-red-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {order.status}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {order.created_at ? format(new Date(order.created_at), "dd MMM yyyy") : "-"}
                </TableCell>
              </TableRow>
            ))}
            {(!orders || orders.length === 0) && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No orders found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
