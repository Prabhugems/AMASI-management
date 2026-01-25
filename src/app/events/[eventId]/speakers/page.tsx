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
  Send,
  Plane,
  Hotel,
  Loader2,
  ArrowRight,
  AlertCircle,
  Link2,
  FileText,
} from "lucide-react"

export default function SpeakersOverviewPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch speakers
  const { data: speakers, isLoading } = useQuery({
    queryKey: ["speakers-overview", eventId],
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
    const travelBooked = speakers.filter((s: any) => s.custom_fields?.booking?.onward_status === "booked" || s.custom_fields?.booking?.onward_status === "confirmed").length
    const hotelBooked = speakers.filter((s: any) => s.custom_fields?.accommodation?.status === "booked" || s.custom_fields?.accommodation?.status === "confirmed").length
    const docsSubmitted = speakers.filter((s: any) => s.custom_fields?.documents_submitted).length

    return {
      total,
      confirmed,
      pending,
      travelBooked,
      hotelBooked,
      docsSubmitted,
      needTravel: total - travelBooked,
      needHotel: total - hotelBooked,
    }
  }, [speakers])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const basePath = `/events/${eventId}/speakers`

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Speakers Overview</h1>
          <p className="text-muted-foreground">Manage faculty, speakers, and chairpersons</p>
        </div>
        <Link href={`${basePath}/list`}>
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Speaker
          </Button>
        </Link>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total Speakers</span>
          </div>
          <p className="text-3xl font-bold mt-2">{stats?.total || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Confirmed</span>
          </div>
          <p className="text-3xl font-bold mt-2 text-green-600">{stats?.confirmed || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-500">
            <Plane className="h-4 w-4" />
            <span className="text-sm">Travel Booked</span>
          </div>
          <p className="text-3xl font-bold mt-2 text-blue-500">{stats?.travelBooked || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-purple-600">
            <Hotel className="h-4 w-4" />
            <span className="text-sm">Hotel Booked</span>
          </div>
          <p className="text-3xl font-bold mt-2 text-purple-600">{stats?.hotelBooked || 0}</p>
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
                  <p className="font-medium">View All Speakers</p>
                  <p className="text-xs text-muted-foreground">Manage speaker details</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href={`${basePath}/invitations`}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Send className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Send Invitations</p>
                  <p className="text-xs text-muted-foreground">Invite speakers to the event</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href={`${basePath}/portal`}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Link2 className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="font-medium">Portal Links</p>
                  <p className="text-xs text-muted-foreground">Generate speaker portal access</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href={`${basePath}/documents`}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium">Documents</p>
                  <p className="text-xs text-muted-foreground">Collect bios, photos, presentations</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>

        {/* Status Summary */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Status Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-amber-500" />
                <span>Pending Invitations</span>
              </div>
              <span className="font-bold">{stats?.pending || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-amber-500" />
                <span>Need Travel Booking</span>
              </div>
              <span className="font-bold">{stats?.needTravel || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Hotel className="h-4 w-4 text-amber-500" />
                <span>Need Hotel Booking</span>
              </div>
              <span className="font-bold">{stats?.needHotel || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-500" />
                <span>Documents Submitted</span>
              </div>
              <span className="font-bold">{stats?.docsSubmitted || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(stats?.pending || 0) > 0 && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2 text-amber-700">
            <AlertCircle className="h-4 w-4" />
            Pending Actions
          </h3>
          <p className="text-sm text-amber-600 mb-3">
            {stats?.pending} speakers have not confirmed their participation yet.
          </p>
          <Link href={`${basePath}/invitations`}>
            <Button size="sm" variant="outline">Send Reminders</Button>
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
          <p className="font-medium">All Speakers</p>
          <p className="text-xs text-muted-foreground">{stats?.total || 0} total</p>
        </Link>

        <Link
          href={`${basePath}/travel`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Plane className="h-6 w-6 mx-auto text-blue-500 mb-2" />
          <p className="font-medium">Travel</p>
          <p className="text-xs text-muted-foreground">{stats?.travelBooked || 0} booked</p>
        </Link>

        <Link
          href={`${basePath}/accommodation`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Hotel className="h-6 w-6 mx-auto text-purple-500 mb-2" />
          <p className="font-medium">Hotels</p>
          <p className="text-xs text-muted-foreground">{stats?.hotelBooked || 0} booked</p>
        </Link>

        <Link
          href={`${basePath}/reports`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-2" />
          <p className="font-medium">Reports</p>
          <p className="text-xs text-muted-foreground">Analytics</p>
        </Link>
      </div>
    </div>
  )
}
