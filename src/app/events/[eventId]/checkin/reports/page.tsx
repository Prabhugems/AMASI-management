"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  CheckCircle,
  Clock,
  TrendingUp,
  Ticket,
  List,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  AlertTriangle,
  Copy,
} from "lucide-react"
import { toast } from "sonner"

interface StationActivity {
  stationId: string
  stationName: string
  lastSeenAt: string | null
  recentlySeen: boolean
  lastHourCount: number
  quietWhileActive: boolean
}

interface DuplicateEntry {
  id: string
  attendeeName: string
  registrationNumber: string
  listName: string
  originalStation: string
  originalTime: string | null
  duplicateStation: string
  duplicateTime: string
  crossDesk: boolean
}

type Registration = {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone?: string
  attendee_designation?: string
  checked_in: boolean
  checked_in_at?: string
  ticket_type?: { id: string; name: string }
}

type CheckinList = {
  id: string
  name: string
}

type CheckinRecord = {
  id: string
  checkin_list_id: string
  registration_id: string
  checked_in_at: string
  checked_in_by: string | null
  checked_out_at: string | null
  registration?: Registration
}

export default function CheckinReportsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [dateFilter, setDateFilter] = useState<string>("")

  // Fetch check-in lists
  const { data: checkinLists } = useQuery({
    queryKey: ["checkin-lists-report", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("checkin_lists")
        .select("id, name")
        .eq("event_id", eventId)
        .order("sort_order")
      return (data || []) as CheckinList[]
    },
  })

  // Fetch registrations
  const { data: registrations, isLoading: loadingRegistrations, refetch } = useQuery({
    queryKey: ["checkin-report-registrations", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, registration_number, attendee_name, attendee_email, attendee_phone, attendee_designation, checked_in, checked_in_at, ticket_type:ticket_types(id, name)")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .order("attendee_name")
      return (data || []) as Registration[]
    },
  })

  // Fetch check-in records for per-list stats
  const { data: checkinRecords, refetch: refetchRecords } = useQuery({
    queryKey: ["checkin-records-report", eventId],
    queryFn: async () => {
      // Get all check-in records for this event's lists
      const { data: lists } = await (supabase as any)
        .from("checkin_lists")
        .select("id")
        .eq("event_id", eventId)

      if (!lists || lists.length === 0) return []

      const listIds = lists.map((l: any) => l.id)

      const { data } = await (supabase as any)
        .from("checkin_records")
        .select(`
          id,
          checkin_list_id,
          registration_id,
          checked_in_at,
          checked_in_by,
          checked_out_at,
          registration:registrations(id, attendee_name, ticket_type:ticket_types(id, name))
        `)
        .in("checkin_list_id", listIds)
        .is("checked_out_at", null)
      return (data || []) as CheckinRecord[]
    },
  })

  // Calculate stats - use checkin_records as source of truth
  const stats = useMemo(() => {
    if (!registrations) return null

    // Get unique registration IDs that have checked in (from checkin_records)
    const checkedInRegIds = new Set(
      (checkinRecords || []).map((r) => r.registration_id)
    )

    const total = registrations.length
    const checkedIn = checkedInRegIds.size
    const remaining = total - checkedIn
    const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0

    // By ticket type - use checkin_records to determine who is checked in
    const byTicket: Record<string, { total: number; checkedIn: number }> = {}
    registrations.forEach((r) => {
      const ticketName = r.ticket_type?.name || "Unknown"
      if (!byTicket[ticketName]) {
        byTicket[ticketName] = { total: 0, checkedIn: 0 }
      }
      byTicket[ticketName].total++
      if (checkedInRegIds.has(r.id)) {
        byTicket[ticketName].checkedIn++
      }
    })

    // By hour - use checkin_records timestamps
    const byHour: Record<number, number> = {}
    for (let i = 0; i < 24; i++) {
      byHour[i] = 0
    }

    // Group check-in records by registration to avoid counting duplicates per hour
    const processedByHour = new Set<string>()
    ;(checkinRecords || []).forEach((record) => {
      if (record.checked_in_at) {
        const checkinDate = new Date(record.checked_in_at)

        // Apply date filter if set
        if (dateFilter) {
          const filterDate = new Date(dateFilter)
          if (
            checkinDate.getFullYear() !== filterDate.getFullYear() ||
            checkinDate.getMonth() !== filterDate.getMonth() ||
            checkinDate.getDate() !== filterDate.getDate()
          ) {
            return
          }
        }

        // Use registration_id + date to avoid counting same person multiple times per day
        const dateKey = `${record.registration_id}-${checkinDate.toDateString()}`
        if (!processedByHour.has(dateKey)) {
          processedByHour.add(dateKey)
          const hour = checkinDate.getHours()
          byHour[hour] = (byHour[hour] || 0) + 1
        }
      }
    })

    // By check-in list
    const byList: Record<string, { name: string; checkedIn: number }> = {}
    if (checkinLists && checkinRecords) {
      checkinLists.forEach((list) => {
        byList[list.id] = { name: list.name, checkedIn: 0 }
      })
      checkinRecords.forEach((record) => {
        if (byList[record.checkin_list_id]) {
          byList[record.checkin_list_id].checkedIn++
        }
      })
    }

    // Find peak hour
    let peakHour = 0
    let peakCount = 0
    Object.entries(byHour).forEach(([hour, count]) => {
      if (count > peakCount) {
        peakCount = count
        peakHour = parseInt(hour)
      }
    })

    return {
      total,
      checkedIn,
      remaining,
      percentage,
      byTicket: Object.entries(byTicket).sort(([, a], [, b]) => b.total - a.total),
      byHour,
      byList: Object.entries(byList).sort(([, a], [, b]) => b.checkedIn - a.checkedIn),
      peakHour,
      peakCount,
      checkedInRegIds, // Pass this for export filtering
    }
  }, [registrations, checkinRecords, checkinLists, dateFilter])

  // Get max hourly count for bar chart scaling
  const maxHourlyCount = useMemo(() => {
    if (!stats) return 1
    return Math.max(...Object.values(stats.byHour), 1)
  }, [stats])

  // §7.1 reconciliation, per list AND per station -- distinct from the
  // "By Check-in List" table above, which only shows checked-in count
  // against ALL registrations. This uses each list's own ticket_type_ids/
  // addon_ids filter for "eligible" (the closest real denominator this
  // schema has to "paid"/"ordered"/"stocked"), broken down by which
  // station did the checking-in -- how a desk scanning into the wrong
  // list gets caught.
  const { data: reconciliation } = useQuery({
    queryKey: ["reports-reconciliation", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/reconciliation?event_id=${encodeURIComponent(eventId)}`)
      if (!res.ok) throw new Error("Failed to load reconciliation report")
      return (await res.json()).data as {
        listId: string
        listName: string
        eligible: number
        checkedIn: number
        remaining: number
        percentage: number
        byStation: { station: string; count: number }[]
      }[]
    },
  })

  // §7.3 arrival rate / station activity.
  const { data: stationActivity } = useQuery({
    queryKey: ["reports-arrival-rate", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/arrival-rate?event_id=${encodeURIComponent(eventId)}`)
      if (!res.ok) throw new Error("Failed to load arrival-rate report")
      return (await res.json()).data as { stations: StationActivity[] }
    },
    refetchInterval: 60_000,
  })

  // §7.2 cross-desk duplicates.
  const { data: duplicates } = useQuery({
    queryKey: ["reports-duplicates", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/duplicates?event_id=${encodeURIComponent(eventId)}`)
      if (!res.ok) throw new Error("Failed to load duplicate report")
      return (await res.json()).data as DuplicateEntry[]
    },
  })

  // Export as text report
  const exportTextReport = () => {
    if (!stats) return

    let content = "CHECK-IN REPORT\n"
    content += "=".repeat(50) + "\n"
    content += `Generated: ${new Date().toLocaleString()}\n\n`

    content += "SUMMARY\n"
    content += "-".repeat(30) + "\n"
    content += `Total Attendees: ${stats.total}\n`
    content += `Checked In: ${stats.checkedIn}\n`
    content += `Remaining: ${stats.remaining}\n`
    content += `Completion: ${stats.percentage}%\n\n`

    content += "BY TICKET TYPE\n"
    content += "-".repeat(30) + "\n"
    stats.byTicket.forEach(([ticket, data]) => {
      const pct = Math.round((data.checkedIn / data.total) * 100)
      content += `${ticket}: ${data.checkedIn}/${data.total} (${pct}%)\n`
    })

    if (stats.byList.length > 0) {
      content += "\nBY CHECK-IN LIST\n"
      content += "-".repeat(30) + "\n"
      stats.byList.forEach(([, data]) => {
        content += `${data.name}: ${data.checkedIn} check-ins\n`
      })
    }

    content += "\nBY HOUR\n"
    content += "-".repeat(30) + "\n"
    Object.entries(stats.byHour)
      .filter(([, count]) => count > 0)
      .forEach(([hour, count]) => {
        content += `${hour.toString().padStart(2, "0")}:00 - ${count} check-ins\n`
      })

    if (stats.peakCount > 0) {
      content += `\nPeak Hour: ${stats.peakHour.toString().padStart(2, "0")}:00 (${stats.peakCount} check-ins)\n`
    }

    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `checkin-report-${new Date().toISOString().split("T")[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Report exported")
  }

  // Get check-in details for a registration from checkin_records
  const getCheckinDetails = (regId: string) => {
    const records = (checkinRecords || []).filter((r) => r.registration_id === regId)
    if (records.length === 0) return { lists: "", times: "", checkedInBy: "" }

    // Get list names from checkinLists
    const listNames = records.map((record) => {
      const list = (checkinLists || []).find((l) => l.id === record.checkin_list_id)
      return list?.name || "Unknown"
    })

    // Get earliest check-in time and who checked them in
    const times = records.map((r) => r.checked_in_at).filter(Boolean).sort()
    const earliestTime = times[0]
    const checkedInByList = records.map((r) => r.checked_in_by).filter(Boolean)
    const checkedInBy = [...new Set(checkedInByList)].join(", ")

    return {
      lists: listNames.join(", "),
      times: earliestTime ? new Date(earliestTime).toLocaleString() : "",
      checkedInBy,
    }
  }

  // Export as CSV with full attendee details
  const exportCSV = () => {
    if (!registrations || !stats) return

    const headers = [
      "Registration Number",
      "Name",
      "Email",
      "Phone",
      "Designation",
      "Ticket Type",
      "Checked In",
      "Checked In Lists",
      "Checked In At",
      "Checked In By",
    ]

    const rows = registrations.map((r) => {
      const isCheckedIn = stats.checkedInRegIds.has(r.id)
      const { lists, times, checkedInBy } = getCheckinDetails(r.id)
      return [
        r.registration_number,
        r.attendee_name,
        r.attendee_email,
        r.attendee_phone || "",
        r.attendee_designation || "",
        r.ticket_type?.name || "",
        isCheckedIn ? "Yes" : "No",
        lists,
        times,
        checkedInBy,
      ]
    })

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `checkin-attendees-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV exported")
  }

  // Export checked-in only CSV
  const exportCheckedInCSV = () => {
    if (!registrations || !stats) return

    const checkedInRegs = registrations.filter((r) => stats.checkedInRegIds.has(r.id))

    const headers = [
      "Registration Number",
      "Name",
      "Email",
      "Phone",
      "Designation",
      "Ticket Type",
      "Checked In Lists",
      "Checked In At",
      "Checked In By",
    ]

    const rows = checkedInRegs.map((r) => {
      const { lists, times, checkedInBy } = getCheckinDetails(r.id)
      return [
        r.registration_number,
        r.attendee_name,
        r.attendee_email,
        r.attendee_phone || "",
        r.attendee_designation || "",
        r.ticket_type?.name || "",
        lists,
        times,
        checkedInBy,
      ]
    })

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `checked-in-attendees-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Checked-in attendees exported")
  }

  // Export not checked-in CSV
  const exportNotCheckedInCSV = () => {
    if (!registrations || !stats) return

    const notCheckedInRegs = registrations.filter((r) => !stats.checkedInRegIds.has(r.id))

    const headers = [
      "Registration Number",
      "Name",
      "Email",
      "Phone",
      "Designation",
      "Ticket Type",
    ]

    const rows = notCheckedInRegs.map((r) => [
      r.registration_number,
      r.attendee_name,
      r.attendee_email,
      r.attendee_phone || "",
      r.attendee_designation || "",
      r.ticket_type?.name || "",
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `not-checked-in-attendees-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Not checked-in attendees exported")
  }

  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? "PM" : "AM"
    const h = hour % 12 || 12
    return `${h}${ampm}`
  }

  if (loadingRegistrations) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Check-in Reports</h1>
          <p className="text-muted-foreground">Analytics, statistics and exports</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetch(); refetchRecords(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total Attendees</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Checked In</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-1 text-emerald-700">{stats.checkedIn}</p>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Remaining</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-1 text-amber-700">{stats.remaining}</p>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div className="flex items-center gap-2 text-blue-600">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Completion</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-1 text-blue-700">{stats.percentage}%</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Overall Progress</h3>
          <span className="text-sm text-muted-foreground">
            {stats.checkedIn} of {stats.total} attendees
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-6">
          <div
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-6 rounded-full transition-all flex items-center justify-center"
            style={{ width: `${Math.max(stats.percentage, 2)}%` }}
          >
            {stats.percentage >= 10 && (
              <span className="text-sm text-white font-semibold">{stats.percentage}%</span>
            )}
          </div>
        </div>
      </div>

      {/* Hourly Distribution Chart */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/50 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Hourly Check-in Distribution
          </h3>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-40 h-8 text-sm"
              placeholder="Filter by date"
            />
            {dateFilter && (
              <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>
                Clear
              </Button>
            )}
          </div>
        </div>
        <div className="p-4">
          {stats.peakCount > 0 && (
            <p className="text-sm text-muted-foreground mb-4">
              Peak hour: <span className="font-medium text-foreground">{formatHour(stats.peakHour)}</span> with {stats.peakCount} check-ins
            </p>
          )}
          <div className="flex items-end gap-1 h-40">
            {Object.entries(stats.byHour).map(([hour, count]) => (
              <div key={hour} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-full rounded-t transition-all ${
                    count > 0 ? "bg-blue-500" : "bg-gray-200"
                  }`}
                  style={{
                    height: `${(count / maxHourlyCount) * 100}%`,
                    minHeight: count > 0 ? "4px" : "2px",
                  }}
                  title={`${formatHour(parseInt(hour))}: ${count} check-ins`}
                />
                <span className="text-[10px] text-muted-foreground mt-1 -rotate-45 origin-left">
                  {parseInt(hour) % 3 === 0 ? formatHour(parseInt(hour)) : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <TableHead>Ticket Type</TableHead>
                <TableHead className="text-right">Checked In</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.byTicket.map(([ticket, data]) => {
                const pct = Math.round((data.checkedIn / data.total) * 100)
                return (
                  <TableRow key={ticket}>
                    <TableCell className="font-medium">{ticket}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">
                      {data.checkedIn}
                    </TableCell>
                    <TableCell className="text-right">{data.total}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-sm w-10">{pct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          </div>
        </div>

        {/* By Check-in List */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/50">
            <h3 className="font-semibold flex items-center gap-2">
              <List className="h-4 w-4" />
              By Check-in List
            </h3>
          </div>
          {stats.byList.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No check-in lists created
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>List Name</TableHead>
                  <TableHead className="text-right">Check-ins</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.byList.map(([id, data]) => (
                  <TableRow key={id}>
                    <TableCell className="font-medium">{data.name}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">
                      {data.checkedIn}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </div>

      {/* §7.3 Station activity */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/50">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Station Activity
          </h3>
        </div>
        {!stationActivity?.stations.length ? (
          <div className="p-8 text-center text-muted-foreground">No kiosk stations on this event yet</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Station</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Scans (last hour)</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stationActivity.stations.map((s) => (
                  <TableRow key={s.stationId}>
                    <TableCell className="font-medium">{s.stationName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleTimeString() : "Never"}
                      {s.recentlySeen && (
                        <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                          <span className="size-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{s.lastHourCount}</TableCell>
                    <TableCell>
                      {s.quietWhileActive && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                          <AlertTriangle className="size-3.5" /> Active but very few scans
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* §7.1 Reconciliation, per list and per station */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/50">
          <h3 className="font-semibold flex items-center gap-2">
            <List className="h-4 w-4" />
            Reconciliation, per list and per station
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            &ldquo;Eligible&rdquo; = confirmed registrations matching this list&apos;s ticket types. No stock/order
            count exists in this schema for meals or kits, so this is the closest real denominator.
          </p>
        </div>
        {!reconciliation?.length ? (
          <div className="p-8 text-center text-muted-foreground">No check-in lists created</div>
        ) : (
          <div className="divide-y">
            {reconciliation.map((row) => (
              <div key={row.listId} className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="font-medium">{row.listName}</p>
                  <p className="text-sm">
                    <span className="font-semibold text-emerald-600">{row.checkedIn}</span>
                    <span className="text-muted-foreground"> / {row.eligible} eligible ({row.percentage}%)</span>
                  </p>
                </div>
                {row.byStation.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.byStation.map((s) => (
                      <span key={s.station} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                        {s.station}: {s.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* §7.2 Cross-desk duplicates */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/50">
          <h3 className="font-semibold flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Cross-desk Duplicates
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kiosk-caught duplicates only, for now — evidence when a count is questioned.
          </p>
        </div>
        {!duplicates?.length ? (
          <div className="p-8 text-center text-muted-foreground">No duplicates caught</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Delegate</TableHead>
                  <TableHead>List</TableHead>
                  <TableHead>Original</TableHead>
                  <TableHead>Duplicate attempt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicates.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <p className="font-medium">{d.attendeeName}</p>
                      <p className="text-xs text-muted-foreground">{d.registrationNumber}</p>
                    </TableCell>
                    <TableCell className="text-sm">{d.listName}</TableCell>
                    <TableCell className="text-sm">
                      {d.originalStation}
                      {d.originalTime && (
                        <p className="text-xs text-muted-foreground">{new Date(d.originalTime).toLocaleString()}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.duplicateStation}
                      <p className="text-xs text-muted-foreground">{new Date(d.duplicateTime).toLocaleString()}</p>
                      {!d.crossDesk && <span className="text-xs text-muted-foreground italic">same desk</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Export Options */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Data
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button variant="outline" onClick={exportTextReport} className="h-auto py-3 flex-col">
            <FileText className="h-5 w-5 mb-1" />
            <span className="text-sm">Summary Report</span>
            <span className="text-xs text-muted-foreground">.txt</span>
          </Button>
          <Button variant="outline" onClick={exportCSV} className="h-auto py-3 flex-col">
            <FileSpreadsheet className="h-5 w-5 mb-1" />
            <span className="text-sm">All Attendees</span>
            <span className="text-xs text-muted-foreground">.csv</span>
          </Button>
          <Button variant="outline" onClick={exportCheckedInCSV} className="h-auto py-3 flex-col">
            <CheckCircle className="h-5 w-5 mb-1 text-emerald-500" />
            <span className="text-sm">Checked In</span>
            <span className="text-xs text-muted-foreground">.csv ({stats.checkedIn})</span>
          </Button>
          <Button variant="outline" onClick={exportNotCheckedInCSV} className="h-auto py-3 flex-col">
            <Clock className="h-5 w-5 mb-1 text-amber-500" />
            <span className="text-sm">Not Checked In</span>
            <span className="text-xs text-muted-foreground">.csv ({stats.remaining})</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
