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
  Package,
  IndianRupee,
  TrendingUp,
  ShoppingCart,
} from "lucide-react"
import { toast } from "sonner"

export default function AddonReportsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch addons
  const { data: addons, isLoading: loadingAddons } = useQuery({
    queryKey: ["addon-reports", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("addons")
        .select("id, name, price, quantity_total, is_course, status")
        .eq("event_id", eventId)

      return data || []
    },
  })

  // Fetch addon sales
  const { data: sales, isLoading: loadingSales } = useQuery({
    queryKey: ["addon-sales-reports", eventId],
    queryFn: async () => {
      const { data: addonIds } = await (supabase as any)
        .from("addons")
        .select("id")
        .eq("event_id", eventId)

      if (!addonIds || addonIds.length === 0) return []

      const { data } = await (supabase as any)
        .from("registration_addons")
        .select("addon_id, quantity, price")
        .in("addon_id", addonIds.map((a: any) => a.id))

      return data || []
    },
  })

  // Calculate stats
  const stats = useMemo(() => {
    if (!addons || !sales) return null

    // Sales by addon
    const salesByAddon: Record<string, { quantity: number; revenue: number }> = {}
    sales.forEach((s: any) => {
      if (!salesByAddon[s.addon_id]) {
        salesByAddon[s.addon_id] = { quantity: 0, revenue: 0 }
      }
      salesByAddon[s.addon_id].quantity += s.quantity || 1
      salesByAddon[s.addon_id].revenue += parseFloat(s.price) || 0
    })

    const totalAddons = addons.length
    const totalSold = Object.values(salesByAddon).reduce((sum, s) => sum + s.quantity, 0)
    const totalRevenue = Object.values(salesByAddon).reduce((sum, s) => sum + s.revenue, 0)
    const courses = addons.filter((a: any) => a.is_course).length

    return {
      totalAddons,
      totalSold,
      totalRevenue,
      courses,
      salesByAddon,
    }
  }, [addons, sales])

  const exportCSV = () => {
    if (!addons || !stats) return

    const headers = ["Addon Name", "Type", "Price", "Sold", "Revenue", "Status"]
    const rows = addons.map((a: any) => {
      const addonSales = stats.salesByAddon[a.id] || { quantity: 0, revenue: 0 }
      return [
        a.name,
        a.is_course ? "Course" : "Addon",
        a.price || 0,
        addonSales.quantity,
        addonSales.revenue,
        a.status || "active",
      ]
    })

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `addon-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    toast.success("Report exported")
  }

  const isLoading = loadingAddons || loadingSales

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
          <h1 className="text-2xl font-bold">Addon Reports</h1>
          <p className="text-muted-foreground">Addon and course sales overview</p>
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
            <Package className="h-4 w-4" />
            <span className="text-sm">Total Addons</span>
          </div>
          <p className="text-2xl font-bold">{stats?.totalAddons || 0}</p>
          <p className="text-xs text-muted-foreground">{stats?.courses || 0} courses</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-sm">Total Sold</span>
          </div>
          <p className="text-2xl font-bold">{stats?.totalSold || 0}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <IndianRupee className="h-4 w-4" />
            <span className="text-sm">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold">₹{(stats?.totalRevenue || 0).toLocaleString()}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Avg per Addon</span>
          </div>
          <p className="text-2xl font-bold">
            {stats?.totalAddons ? Math.round((stats?.totalSold || 0) / stats.totalAddons) : 0}
          </p>
        </div>
      </div>

      {/* Addon Details Table */}
      <div className="bg-card border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Addon Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Sold</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {addons?.map((addon: any) => {
              const addonSales = stats?.salesByAddon[addon.id] || { quantity: 0, revenue: 0 }
              return (
                <TableRow key={addon.id}>
                  <TableCell className="font-medium">{addon.name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      addon.is_course ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {addon.is_course ? "Course" : "Addon"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">₹{(addon.price || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{addonSales.quantity}</TableCell>
                  <TableCell className="text-right">₹{addonSales.revenue.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      addon.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}>
                      {addon.status || "active"}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
            {(!addons || addons.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No addons found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
