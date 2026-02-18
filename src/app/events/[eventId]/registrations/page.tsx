"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Users,
  UserPlus,
  CheckCircle,
  Clock,
  XCircle,
  IndianRupee,
  Loader2,
  ArrowRight,
  Upload,
  Download,
  Mail,
  AlertCircle,
  Ticket,
} from "lucide-react"

export default function RegistrationsOverviewPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch event slug for registration form link
  const { data: event } = useQuery({
    queryKey: ["event-slug", eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("events")
        .select("slug")
        .eq("id", eventId)
        .single()
      if (error) throw error
      return data as { slug: string | null }
    },
    enabled: !!eventId,
  })

  // Fetch registrations
  const { data: registrations, isLoading } = useQuery({
    queryKey: ["registrations-overview", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, status, total_amount, ticket_type:ticket_types(name)")
        .eq("event_id", eventId)

      return data || []
    },
  })

  // Stats
  const stats = useMemo(() => {
    if (!registrations) return null

    const total = registrations.length
    const confirmed = registrations.filter((r: any) => r.status === "confirmed").length
    const pending = registrations.filter((r: any) => r.status === "pending").length
    const cancelled = registrations.filter((r: any) => r.status === "cancelled").length
    const revenue = registrations
      .filter((r: any) => r.status === "confirmed")
      .reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0)

    // By ticket type
    const byTicket: Record<string, number> = {}
    registrations.forEach((r: any) => {
      const ticketName = r.ticket_type?.name || "Unknown"
      byTicket[ticketName] = (byTicket[ticketName] || 0) + 1
    })

    return {
      total,
      confirmed,
      pending,
      cancelled,
      revenue,
      byTicket: Object.entries(byTicket).sort(([, a], [, b]) => b - a),
    }
  }, [registrations])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const basePath = `/events/${eventId}/registrations`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Registrations Overview</h1>
          <p className="text-sm text-muted-foreground">Manage event registrations and attendees</p>
        </div>
        <Button size="sm" onClick={() => window.open(`/register/${event?.slug || eventId}`, '_blank')}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Registration
        </Button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2">{stats?.total || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Confirmed</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-green-600">{stats?.confirmed || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Pending</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-amber-500">{stats?.pending || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-red-500">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">Cancelled</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-red-500">{stats?.cancelled || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-purple-600">
            <IndianRupee className="h-4 w-4" />
            <span className="text-sm">Revenue</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-2 text-purple-600">
            ₹{(stats?.revenue || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Actions */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link
              href={`${basePath}/list`}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">View All Registrations</p>
                  <p className="text-xs text-muted-foreground">Manage and edit registrations</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href={`${basePath}/import`}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Upload className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Import Registrations</p>
                  <p className="text-xs text-muted-foreground">Bulk import from CSV/Excel</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href={`${basePath}/export`}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="font-medium">Export Data</p>
                  <p className="text-xs text-muted-foreground">Download registration data</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href={`${basePath}/communications`}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium">Send Communications</p>
                  <p className="text-xs text-muted-foreground">Email attendees</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>

        {/* By Ticket Type */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">By Ticket Type</h3>
          {!stats?.byTicket?.length ? (
            <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed">
              <Ticket className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No registrations yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.byTicket.slice(0, 5).map(([ticket, count]) => (
                <div key={ticket} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="font-medium">{ticket}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {(stats?.pending || 0) > 0 && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2 text-amber-700">
            <AlertCircle className="h-4 w-4" />
            Pending Registrations
          </h3>
          <p className="text-sm text-amber-600 mb-3">
            {stats?.pending} registrations are awaiting confirmation.
          </p>
          <Link href={`${basePath}/list?status=pending`}>
            <Button size="sm" variant="outline">View Pending</Button>
          </Link>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href={`${basePath}/list`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Users className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">All</p>
          <p className="text-xs text-muted-foreground">{stats?.total || 0} registrations</p>
        </Link>

        <Link
          href={`${basePath}/list?status=confirmed`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <CheckCircle className="h-6 w-6 mx-auto text-green-600 mb-2" />
          <p className="font-medium">Confirmed</p>
          <p className="text-xs text-muted-foreground">{stats?.confirmed || 0}</p>
        </Link>

        <Link
          href={`${basePath}/list?status=pending`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Clock className="h-6 w-6 mx-auto text-amber-500 mb-2" />
          <p className="font-medium">Pending</p>
          <p className="text-xs text-muted-foreground">{stats?.pending || 0}</p>
        </Link>

        <Link
          href={`${basePath}/reports`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <IndianRupee className="h-6 w-6 mx-auto text-purple-600 mb-2" />
          <p className="font-medium">Reports</p>
          <p className="text-xs text-muted-foreground">Analytics</p>
        </Link>
      </div>
    </div>
  )
}
