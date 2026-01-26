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
  FileBarChart,
  Loader2,
  Download,
  Plane,
  Train,
  Car,
  Users,
  CreditCard,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
} from "lucide-react"
import { toast } from "sonner"

type Guest = {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string
  custom_fields: {
    travel_details?: {
      mode?: string
      arrival_date?: string
      departure_date?: string
    }
    booking?: {
      onward_status?: string
      onward_cost?: number
      onward_airline?: string
      onward_departure_date?: string
      return_status?: string
      return_cost?: number
      return_departure_date?: string
      hotel_cost?: number
      transport_cost?: number
    }
    train_bookings?: { cost?: number }[]
  } | null
}

export default function TravelReportsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch guests
  const { data: guests, isLoading } = useQuery({
    queryKey: ["travel-report-guests", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, registration_number, attendee_name, attendee_email, attendee_phone, custom_fields")
        .eq("event_id", eventId)

      return (data || []).filter((g: any) =>
        g.custom_fields?.travel_details ||
        g.custom_fields?.booking
      ) as Guest[]
    },
  })

  // Stats & breakdown
  const report = useMemo(() => {
    if (!guests) return null

    // Mode breakdown
    const byMode = { flight: 0, train: 0, self: 0, other: 0 }
    guests.forEach(g => {
      const mode = g.custom_fields?.travel_details?.mode || "flight"
      if (mode === "flight") byMode.flight++
      else if (mode === "train") byMode.train++
      else if (mode === "self" || mode === "own") byMode.self++
      else byMode.other++
    })

    // Status breakdown
    const onwardPending = guests.filter(g => !g.custom_fields?.booking?.onward_status || g.custom_fields?.booking?.onward_status === "pending").length
    const onwardBooked = guests.filter(g => g.custom_fields?.booking?.onward_status === "booked").length
    const onwardConfirmed = guests.filter(g => g.custom_fields?.booking?.onward_status === "confirmed").length

    const returnPending = guests.filter(g => !g.custom_fields?.booking?.return_status || g.custom_fields?.booking?.return_status === "pending").length
    const returnBooked = guests.filter(g => g.custom_fields?.booking?.return_status === "booked").length
    const returnConfirmed = guests.filter(g => g.custom_fields?.booking?.return_status === "confirmed").length

    // Costs
    let flightCost = 0
    let trainCost = 0
    let hotelCost = 0
    let transportCost = 0

    guests.forEach(g => {
      const b = g.custom_fields?.booking || {}
      flightCost += (b.onward_cost || 0) + (b.return_cost || 0)
      hotelCost += b.hotel_cost || 0
      transportCost += b.transport_cost || 0

      g.custom_fields?.train_bookings?.forEach(t => {
        trainCost += t.cost || 0
      })
    })

    // Date breakdown
    const byDate: Record<string, { arrivals: number; departures: number }> = {}
    guests.forEach(g => {
      const t = g.custom_fields?.travel_details || {}
      const b = g.custom_fields?.booking || {}
      const arrival = b.onward_departure_date || t.arrival_date
      const departure = b.return_departure_date || t.departure_date

      if (arrival) {
        byDate[arrival] = byDate[arrival] || { arrivals: 0, departures: 0 }
        byDate[arrival].arrivals++
      }
      if (departure) {
        byDate[departure] = byDate[departure] || { arrivals: 0, departures: 0 }
        byDate[departure].departures++
      }
    })

    // Airline breakdown
    const byAirline: Record<string, number> = {}
    guests.forEach(g => {
      const airline = g.custom_fields?.booking?.onward_airline
      if (airline) {
        byAirline[airline] = (byAirline[airline] || 0) + 1
      }
    })

    return {
      total: guests.length,
      byMode,
      status: {
        onward: { pending: onwardPending, booked: onwardBooked, confirmed: onwardConfirmed },
        return: { pending: returnPending, booked: returnBooked, confirmed: returnConfirmed },
      },
      costs: {
        flight: flightCost,
        train: trainCost,
        hotel: hotelCost,
        transport: transportCost,
        total: flightCost + trainCost + hotelCost + transportCost,
      },
      byDate: Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)),
      byAirline: Object.entries(byAirline).sort(([, a], [, b]) => b - a),
    }
  }, [guests])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
  }

  const exportCSV = () => {
    if (!guests) return

    const headers = ["Reg Number", "Name", "Email", "Phone", "Travel Mode", "Arrival Date", "Departure Date", "Onward Status", "Onward Cost", "Return Status", "Return Cost"]
    const rows = guests.map((g: Guest) => {
      const t = g.custom_fields?.travel_details || {}
      const b = g.custom_fields?.booking || {}
      return [
        g.registration_number || "",
        `"${(g.attendee_name || '').replace(/"/g, '""')}"`,
        g.attendee_email || "",
        g.attendee_phone || "",
        t.mode || "flight",
        b.onward_departure_date || t.arrival_date || "",
        b.return_departure_date || t.departure_date || "",
        b.onward_status || "pending",
        b.onward_cost || 0,
        b.return_status || "pending",
        b.return_cost || 0,
      ]
    })

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `travel-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Report exported")
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!report) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-dashed">
        <FileBarChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No travel data</h3>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Travel Reports</h1>
          <p className="text-muted-foreground">Analytics and cost summaries</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span className="text-sm">Travelers</span></div>
          <p className="text-2xl font-bold mt-1">{report.total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-500"><Plane className="h-4 w-4" /><span className="text-sm">By Flight</span></div>
          <p className="text-2xl font-bold mt-1">{report.byMode.flight}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-orange-500"><Train className="h-4 w-4" /><span className="text-sm">By Train</span></div>
          <p className="text-2xl font-bold mt-1">{report.byMode.train}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-500"><Car className="h-4 w-4" /><span className="text-sm">Self Arranged</span></div>
          <p className="text-2xl font-bold mt-1">{report.byMode.self}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-purple-500"><CreditCard className="h-4 w-4" /><span className="text-sm">Total Cost</span></div>
          <p className="text-xl font-bold mt-1">₹{report.costs.total.toLocaleString()}</p>
        </div>
      </div>

      {/* Cost Breakdown & Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Costs */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><CreditCard className="h-4 w-4" />Cost Breakdown</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Plane className="h-4 w-4 text-blue-500" />Flights</span>
              <span className="font-bold">₹{report.costs.flight.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Train className="h-4 w-4 text-orange-500" />Trains</span>
              <span className="font-bold">₹{report.costs.train.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Car className="h-4 w-4 text-green-500" />Transport</span>
              <span className="font-bold">₹{report.costs.transport.toLocaleString()}</span>
            </div>
            <div className="border-t pt-3 flex items-center justify-between font-bold">
              <span>Total</span>
              <span>₹{report.costs.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Booking Status */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4" />Booking Status</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Onward Journey</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-amber-50 rounded p-2 text-center">
                  <p className="text-lg font-bold text-amber-600">{report.status.onward.pending}</p>
                  <p className="text-xs">Pending</p>
                </div>
                <div className="flex-1 bg-blue-50 rounded p-2 text-center">
                  <p className="text-lg font-bold text-blue-600">{report.status.onward.booked}</p>
                  <p className="text-xs">Booked</p>
                </div>
                <div className="flex-1 bg-green-50 rounded p-2 text-center">
                  <p className="text-lg font-bold text-green-600">{report.status.onward.confirmed}</p>
                  <p className="text-xs">Confirmed</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Return Journey</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-amber-50 rounded p-2 text-center">
                  <p className="text-lg font-bold text-amber-600">{report.status.return.pending}</p>
                  <p className="text-xs">Pending</p>
                </div>
                <div className="flex-1 bg-blue-50 rounded p-2 text-center">
                  <p className="text-lg font-bold text-blue-600">{report.status.return.booked}</p>
                  <p className="text-xs">Booked</p>
                </div>
                <div className="flex-1 bg-green-50 rounded p-2 text-center">
                  <p className="text-lg font-bold text-green-600">{report.status.return.confirmed}</p>
                  <p className="text-xs">Confirmed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Date-wise breakdown */}
      {report.byDate.length > 0 && (
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/50">
            <h3 className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" />Daily Movement</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right text-green-600">Arrivals</TableHead>
                <TableHead className="text-right text-red-600">Departures</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.byDate.map(([date, counts]) => (
                <TableRow key={date}>
                  <TableCell className="font-medium">{formatDate(date)}</TableCell>
                  <TableCell className="text-right text-green-600">+{counts.arrivals}</TableCell>
                  <TableCell className="text-right text-red-600">-{counts.departures}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Airline breakdown */}
      {report.byAirline.length > 0 && (
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/50">
            <h3 className="font-semibold flex items-center gap-2"><Plane className="h-4 w-4" />By Airline</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Airline</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.byAirline.map(([airline, count]) => (
                <TableRow key={airline}>
                  <TableCell className="font-medium">{airline}</TableCell>
                  <TableCell className="text-right">{count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
