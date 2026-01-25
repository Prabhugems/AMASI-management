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
  CheckCircle,
  Clock,
  Plane,
  Hotel,
  FileText,
} from "lucide-react"
import { toast } from "sonner"

export default function SpeakerReportsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch speakers
  const { data: speakers, isLoading } = useQuery({
    queryKey: ["speaker-reports", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_designation, custom_fields")
        .eq("event_id", eventId)
        .or("attendee_designation.ilike.%speaker%,attendee_designation.ilike.%faculty%,attendee_designation.ilike.%chairperson%,attendee_designation.ilike.%moderator%")

      return data || []
    },
  })

  // Stats
  const stats = useMemo(() => {
    if (!speakers) return null

    const total = speakers.length
    const confirmed = speakers.filter((s: any) => s.custom_fields?.invitation_status === "confirmed").length
    const pending = speakers.filter((s: any) => !s.custom_fields?.invitation_status || s.custom_fields?.invitation_status === "pending").length
    const travelBooked = speakers.filter((s: any) =>
      s.custom_fields?.booking?.onward_status === "booked" ||
      s.custom_fields?.booking?.onward_status === "confirmed"
    ).length
    const hotelBooked = speakers.filter((s: any) =>
      s.custom_fields?.accommodation?.status === "booked" ||
      s.custom_fields?.accommodation?.status === "confirmed"
    ).length
    const docsComplete = speakers.filter((s: any) =>
      s.custom_fields?.bio_submitted && s.custom_fields?.photo_submitted
    ).length

    // By designation
    const byDesignation: Record<string, number> = {}
    speakers.forEach((s: any) => {
      const designation = s.attendee_designation || "Other"
      byDesignation[designation] = (byDesignation[designation] || 0) + 1
    })

    return {
      total,
      confirmed,
      pending,
      travelBooked,
      hotelBooked,
      docsComplete,
      byDesignation: Object.entries(byDesignation).sort(([, a], [, b]) => b - a),
    }
  }, [speakers])

  const exportReport = () => {
    if (!stats) return

    let content = "SPEAKER REPORT\n"
    content += "=".repeat(50) + "\n\n"

    content += "SUMMARY\n"
    content += "-".repeat(30) + "\n"
    content += `Total Speakers: ${stats.total}\n`
    content += `Confirmed: ${stats.confirmed}\n`
    content += `Pending Confirmation: ${stats.pending}\n`
    content += `Travel Booked: ${stats.travelBooked}\n`
    content += `Hotel Booked: ${stats.hotelBooked}\n`
    content += `Documents Complete: ${stats.docsComplete}\n\n`

    content += "BY DESIGNATION\n"
    content += "-".repeat(30) + "\n"
    stats.byDesignation.forEach(([designation, count]) => {
      content += `${designation}: ${count}\n`
    })

    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `speaker-report-${new Date().toISOString().split("T")[0]}.txt`
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
          <h1 className="text-2xl font-bold">Speaker Reports</h1>
          <p className="text-muted-foreground">Analytics and statistics</p>
        </div>
        <Button variant="outline" onClick={exportReport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Confirmed</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.confirmed}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Pending</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.pending}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-500">
            <Plane className="h-4 w-4" />
            <span className="text-sm">Travel Booked</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.travelBooked}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-purple-500">
            <Hotel className="h-4 w-4" />
            <span className="text-sm">Hotel Booked</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.hotelBooked}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-orange-500">
            <FileText className="h-4 w-4" />
            <span className="text-sm">Docs Complete</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.docsComplete}</p>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Confirmation Progress</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Confirmed</span>
              <span className="font-medium">{stats.confirmed} / {stats.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-green-600 h-3 rounded-full"
                style={{ width: `${stats.total ? (stats.confirmed / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Travel Booking Progress</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Booked</span>
              <span className="font-medium">{stats.travelBooked} / {stats.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full"
                style={{ width: `${stats.total ? (stats.travelBooked / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* By Designation */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/50">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            By Designation
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Designation</TableHead>
              <TableHead className="text-right">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.byDesignation.map(([designation, count]) => (
              <TableRow key={designation}>
                <TableCell className="font-medium">{designation}</TableCell>
                <TableCell className="text-right">{count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
