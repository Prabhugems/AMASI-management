"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Building2,
  Loader2,
  ChevronLeft,
  Clock,
  Calendar,
  User,
  Presentation,
} from "lucide-react"

type Session = {
  id: string
  session_name: string
  description?: string
  session_type: string
  session_date?: string
  start_time?: string
  end_time?: string
  hall?: string
  specialty_track?: string
}

type DayGroup = {
  date: string
  displayDate: string
  dayName: string
  sessions: Session[]
}

export default function HallDetailPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const hallName = decodeURIComponent(params.hallName as string)
  const supabase = createClient()

  // Fetch sessions for this hall
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["hall-sessions", eventId, hallName],
    queryFn: async () => {
      let query = (supabase as any)
        .from("sessions")
        .select("*")
        .eq("event_id", eventId)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })

      if (hallName === "Unassigned") {
        query = query.is("hall", null)
      } else {
        query = query.eq("hall", hallName)
      }

      const { data } = await query
      return (data || []) as Session[]
    },
  })

  // Group sessions by day
  const dayGroups = useMemo(() => {
    if (!sessions) return []

    const groups = new Map<string, Session[]>()

    sessions.forEach((session) => {
      const date = session.session_date || "unknown"
      if (!groups.has(date)) {
        groups.set(date, [])
      }
      groups.get(date)!.push(session)
    })

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sessions]): DayGroup => {
        const dateObj = new Date(date)
        return {
          date,
          displayDate: dateObj.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          dayName: dateObj.toLocaleDateString("en-IN", { weekday: "long" }),
          sessions,
        }
      })
  }, [sessions])

  const formatTime = (time: string | undefined) => {
    if (!time) return "-"
    // Handle time-only strings like "10:00" or "14:30"
    const parts = time.split(":")
    if (parts.length >= 2) {
      const h = parseInt(parts[0])
      const m = parts[1]
      const ampm = h >= 12 ? "PM" : "AM"
      const h12 = h % 12 || 12
      return `${h12}:${m} ${ampm}`
    }
    return time
  }

  const getSessionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      keynote: "bg-purple-100 text-purple-800 border-purple-200",
      session: "bg-blue-100 text-blue-800 border-blue-200",
      lecture: "bg-blue-100 text-blue-800 border-blue-200",
      workshop: "bg-green-100 text-green-800 border-green-200",
      panel: "bg-amber-100 text-amber-800 border-amber-200",
      break: "bg-gray-100 text-gray-600 border-gray-200",
      networking: "bg-pink-100 text-pink-800 border-pink-200",
    }
    return colors[type?.toLowerCase()] || "bg-gray-100 text-gray-800 border-gray-200"
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/events/${eventId}/program/halls`}>
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{hallName}</h1>
              <p className="text-muted-foreground">
                {sessions?.length || 0} sessions across {dayGroups.length} day{dayGroups.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Day-wise Sessions */}
      {dayGroups.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Presentation className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No sessions found</h3>
          <p className="text-muted-foreground">No sessions are scheduled for this hall</p>
        </div>
      ) : (
        <div className="space-y-8">
          {dayGroups.map((day) => (
            <div key={day.date}>
              {/* Day Header */}
              <div className="flex items-center gap-3 mb-4 sticky top-0 bg-background py-2 z-10">
                <div className="p-2 bg-primary rounded-lg">
                  <Calendar className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{day.displayDate}</h2>
                  <p className="text-sm text-muted-foreground">{day.dayName}</p>
                </div>
                <Badge variant="secondary" className="ml-auto">
                  {day.sessions.length} session{day.sessions.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {/* Sessions Timeline */}
              <div className="space-y-3 pl-4 border-l-2 border-muted ml-4">
                {day.sessions.map((session, index) => (
                  <Card key={session.id} className="ml-4 relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-[1.65rem] top-4 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base font-medium">
                            {session.session_name}
                          </CardTitle>
                          {session.specialty_track && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {session.specialty_track}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`capitalize shrink-0 ${getSessionTypeColor(session.session_type)}`}
                        >
                          {session.session_type?.replace("_", " ") || "Session"}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>
                            {formatTime(session.start_time)} - {formatTime(session.end_time)}
                          </span>
                        </div>
                        {session.description && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span className="line-clamp-1">{session.description}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
