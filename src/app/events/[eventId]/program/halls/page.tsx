"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import {
  Building2,
  Loader2,
  Search,
  Calendar,
  ChevronRight,
} from "lucide-react"

type Session = {
  id: string
  session_name: string
  session_type: string
  session_date?: string
  start_time?: string
  end_time?: string
  hall?: string
  specialty_track?: string
}

type HallInfo = {
  name: string
  sessionCount: number
  days: string[]
}

export default function HallsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [search, setSearch] = useState("")

  // Fetch all sessions to extract halls
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions-for-halls", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sessions")
        .select("id, session_name, session_type, session_date, start_time, end_time, hall, specialty_track")
        .eq("event_id", eventId)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })

      return (data || []) as Session[]
    },
  })

  // Extract unique halls with session counts and days
  const halls = useMemo(() => {
    if (!sessions) return []

    const hallMap = new Map<string, { sessions: Session[]; days: Set<string> }>()

    sessions.forEach((session) => {
      const hallName = session.hall || "Unassigned"
      if (!hallMap.has(hallName)) {
        hallMap.set(hallName, { sessions: [], days: new Set() })
      }
      const hallData = hallMap.get(hallName)!
      hallData.sessions.push(session)
      if (session.session_date) {
        hallData.days.add(session.session_date)
      }
    })

    const hallList: HallInfo[] = Array.from(hallMap.entries()).map(([name, data]) => ({
      name,
      sessionCount: data.sessions.length,
      days: Array.from(data.days).sort(),
    }))

    // Sort by name, but put "Unassigned" at the end
    return hallList.sort((a, b) => {
      if (a.name === "Unassigned") return 1
      if (b.name === "Unassigned") return -1
      return a.name.localeCompare(b.name)
    })
  }, [sessions])

  // Filter halls by search
  const filteredHalls = useMemo(() => {
    if (!search) return halls
    return halls.filter((h) =>
      h.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [halls, search])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Halls</h1>
          <p className="text-muted-foreground">View sessions organized by venue/hall</p>
        </div>
        <div className="text-sm text-muted-foreground">
          {halls.length} halls, {sessions?.length || 0} sessions
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search halls..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Halls Grid */}
      {filteredHalls.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No halls found</h3>
          <p className="text-muted-foreground">
            {search ? "Try a different search term" : "Import sessions with hall information"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHalls.map((hall) => (
            <Link
              key={hall.name}
              href={`/events/${eventId}/program/halls/${encodeURIComponent(hall.name)}`}
              className="bg-card rounded-lg border p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{hall.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {hall.sessionCount} session{hall.sessionCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              {hall.days.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{hall.days.map(d => formatDate(d)).join(", ")}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
