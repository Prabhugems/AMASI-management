"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ArrowLeft,
  GraduationCap,
  Loader2,
  Pencil,
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  Award,
  Star,
  Calendar,
  CheckCircle,
  XCircle,
  Download,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

export default function FacultyDetailPage() {
  const params = useParams()
  const facultyId = params.id as string

  const supabase = createClient()

  const [downloadingEventId, setDownloadingEventId] = useState<string | null>(
    null
  )

  // Fetch faculty data
  const { data: faculty, isLoading } = useQuery({
    queryKey: ["faculty", facultyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("faculty")
        .select("*")
        .eq("id", facultyId)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!facultyId,
  })

  // Fetch faculty assignments
  const { data: assignments } = useQuery({
    queryKey: ["faculty-assignments", facultyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("faculty_assignments")
        .select(
          "id, event_id, role, session_name, topic_title, session_date, start_time, hall, status"
        )
        .eq("faculty_id", facultyId)
        .order("session_date", { ascending: true })

      if (error) throw error
      return data as {
        id: string
        event_id: string
        role: string
        session_name: string | null
        topic_title: string | null
        session_date: string | null
        start_time: string | null
        hall: string | null
        status: string
      }[]
    },
    enabled: !!facultyId,
  })

  // Get unique event IDs from assignments
  const eventIds = assignments
    ? [...new Set(assignments.map((a) => a.event_id))]
    : []

  // Fetch event details for those IDs
  const { data: assignmentEvents } = useQuery({
    queryKey: ["assignment-events", eventIds],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("events")
        .select("id, name, start_date, end_date")
        .in("id", eventIds)

      if (error) throw error
      return data as {
        id: string
        name: string
        start_date: string | null
        end_date: string | null
      }[]
    },
    enabled: eventIds.length > 0,
  })

  // Group assignments by event
  const assignmentsByEvent = assignments
    ? assignments.reduce(
        (acc, a) => {
          if (!acc[a.event_id]) acc[a.event_id] = []
          acc[a.event_id].push(a)
          return acc
        },
        {} as Record<string, typeof assignments>
      )
    : {}

  const handleDownloadInvitation = async (eventId: string) => {
    setDownloadingEventId(eventId)
    try {
      const res = await fetch(
        `/api/faculty/${facultyId}/invitation-pdf?event_id=${eventId}`
      )
      if (!res.ok) throw new Error("Download failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] || "invitation.pdf"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Failed to download invitation PDF:", err)
    } finally {
      setDownloadingEventId(null)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (!faculty) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">Faculty not found</p>
          <Button asChild>
            <Link href="/faculty">Back to Faculty</Link>
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>
      case "blacklisted":
        return <Badge variant="destructive">Blacklisted</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/faculty">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Faculty
              </Link>
            </Button>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <GraduationCap className="h-6 w-6" />
                Faculty Details
              </h1>
              <p className="text-sm text-muted-foreground">
                {faculty.title ? `${faculty.title} ` : ""}{faculty.name}
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href={`/faculty/${facultyId}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Faculty
            </Link>
          </Button>
        </div>

        {/* Personal Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                {faculty.title ? `${faculty.title} ` : ""}{faculty.name}
              </CardTitle>
              {getStatusBadge(faculty.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </p>
                <p className="font-medium">{faculty.email || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone
                </p>
                <p className="font-medium">{faculty.phone || "N/A"}</p>
              </div>
            </div>

            {faculty.whatsapp && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">WhatsApp</p>
                <p className="font-medium">{faculty.whatsapp}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Professional Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              Professional Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Designation</p>
                <p className="font-medium">{faculty.designation || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="font-medium">{faculty.department || "N/A"}</p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Institution</p>
              <p className="font-medium">{faculty.institution || "N/A"}</p>
            </div>

            {faculty.specialty && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Specialty
                </p>
                <p className="font-medium">{faculty.specialty}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location */}
        {(faculty.city || faculty.state || faculty.country) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">
                {[faculty.city, faculty.state, faculty.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Status & Reviewer */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="h-5 w-5" />
              Status & Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-secondary/30">
              <div className="flex items-center gap-3">
                <Star className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium">Reviewer Status</p>
                  <p className="text-sm text-muted-foreground">
                    {faculty.is_reviewer
                      ? "Can review abstracts and papers"
                      : "Not a reviewer"}
                  </p>
                </div>
              </div>
              {faculty.is_reviewer ? (
                <CheckCircle className="h-6 w-6 text-amber-500" />
              ) : (
                <XCircle className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Event Assignments */}
        {assignments && assignments.length > 0 && assignmentEvents && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                Event Assignments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(assignmentsByEvent).map(
                ([eventId, eventAssignments]) => {
                  const evt = assignmentEvents.find(
                    (e) => e.id === eventId
                  )
                  if (!evt) return null
                  return (
                    <div key={eventId} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground">
                            {evt.name}
                          </p>
                          {evt.start_date && (
                            <p className="text-sm text-muted-foreground">
                              {new Date(
                                evt.start_date
                              ).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                              {evt.end_date &&
                                evt.end_date !== evt.start_date &&
                                ` - ${new Date(
                                  evt.end_date
                                ).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}`}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleDownloadInvitation(eventId)
                          }
                          disabled={downloadingEventId === eventId}
                        >
                          {downloadingEventId === eventId ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Download Invitation
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {eventAssignments.map((a) => (
                          <Badge
                            key={a.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {a.role.charAt(0).toUpperCase() +
                              a.role.slice(1)}
                            {a.session_name
                              ? ` — ${a.session_name}`
                              : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                }
              )}
            </CardContent>
          </Card>
        )}

        {/* Bio */}
        {faculty.bio && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Bio / Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {faculty.bio}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Timestamps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Record Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">
                  {faculty.created_at
                    ? new Date(faculty.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Last Updated</p>
                <p className="font-medium">
                  {faculty.updated_at
                    ? new Date(faculty.updated_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A"}
                </p>
              </div>
            </div>
            {faculty.source && (
              <div className="mt-4 space-y-1">
                <p className="text-muted-foreground">Source</p>
                <p className="font-medium capitalize">
                  {faculty.source.replace(/_/g, " ")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
