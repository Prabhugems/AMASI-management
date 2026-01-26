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
  Calendar,
  Clock,
  Users,
  Presentation,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

export default function ProgramReportsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["program-reports", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sessions")
        .select("id, title, session_type, date, start_time, end_time, hall_name, speakers")
        .eq("event_id", eventId)
        .order("date")
        .order("start_time")

      return data || []
    },
  })

  // Calculate stats
  const stats = useMemo(() => {
    if (!sessions) return null

    const totalSessions = sessions.length

    // By type
    const byType: Record<string, number> = {}
    sessions.forEach((s: any) => {
      const type = s.session_type || "Other"
      byType[type] = (byType[type] || 0) + 1
    })

    // By date
    const byDate: Record<string, number> = {}
    sessions.forEach((s: any) => {
      const date = s.date || "Unscheduled"
      byDate[date] = (byDate[date] || 0) + 1
    })

    // By hall
    const byHall: Record<string, number> = {}
    sessions.forEach((s: any) => {
      const hall = s.hall_name || "TBD"
      byHall[hall] = (byHall[hall] || 0) + 1
    })

    // Total speakers
    let totalSpeakers = 0
    sessions.forEach((s: any) => {
      if (s.speakers && Array.isArray(s.speakers)) {
        totalSpeakers += s.speakers.length
      }
    })

    return {
      totalSessions,
      totalSpeakers,
      byType,
      byDate,
      byHall,
      uniqueDays: Object.keys(byDate).length,
      uniqueHalls: Object.keys(byHall).length,
    }
  }, [sessions])

  const exportCSV = () => {
    if (!sessions) return

    const headers = ["Title", "Type", "Date", "Start Time", "End Time", "Hall", "Speakers"]
    const rows = sessions.map((s: any) => [
      `"${s.title || ''}"`,
      s.session_type || "",
      s.date || "",
      s.start_time || "",
      s.end_time || "",
      s.hall_name || "",
      Array.isArray(s.speakers) ? s.speakers.length : 0,
    ])

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `program-report-${new Date().toISOString().split("T")[0]}.csv`
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
          <h1 className="text-2xl font-bold">Program Reports</h1>
          <p className="text-muted-foreground">Sessions and schedule overview</p>
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
            <Presentation className="h-4 w-4" />
            <span className="text-sm">Total Sessions</span>
          </div>
          <p className="text-2xl font-bold">{stats?.totalSessions || 0}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total Speakers</span>
          </div>
          <p className="text-2xl font-bold">{stats?.totalSpeakers || 0}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Event Days</span>
          </div>
          <p className="text-2xl font-bold">{stats?.uniqueDays || 0}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Halls/Rooms</span>
          </div>
          <p className="text-2xl font-bold">{stats?.uniqueHalls || 0}</p>
        </div>
      </div>

      {/* Session Type Breakdown */}
      {stats?.byType && Object.keys(stats.byType).length > 0 && (
        <div className="bg-card border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Sessions by Type</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byType).map(([type, count]) => (
              <span key={type} className="px-3 py-1 bg-muted rounded-full text-sm">
                {type}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sessions Table */}
      <div className="bg-card border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Hall</TableHead>
              <TableHead className="text-right">Speakers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions?.map((session: any) => (
              <TableRow key={session.id}>
                <TableCell className="font-medium max-w-xs truncate">{session.title}</TableCell>
                <TableCell>
                  <span className="px-2 py-1 bg-muted rounded text-xs">
                    {session.session_type || "Other"}
                  </span>
                </TableCell>
                <TableCell>
                  {session.date ? format(new Date(session.date), "dd MMM") : "-"}
                </TableCell>
                <TableCell>
                  {session.start_time || "-"} - {session.end_time || "-"}
                </TableCell>
                <TableCell>{session.hall_name || "-"}</TableCell>
                <TableCell className="text-right">
                  {Array.isArray(session.speakers) ? session.speakers.length : 0}
                </TableCell>
              </TableRow>
            ))}
            {(!sessions || sessions.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No sessions found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
