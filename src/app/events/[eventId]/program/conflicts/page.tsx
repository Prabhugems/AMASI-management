"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  Loader2,
  Search,
  Users,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Session = {
  id: string
  session_name: string
  session_date: string
  start_time: string
  end_time: string
  hall: string
  speakers: string | null
  chairpersons: string | null
  moderators: string | null
}

type FacultyConflict = {
  facultyName: string
  sessions: {
    id: string
    name: string
    hall: string
    date: string
    startTime: string
    endTime: string
  }[]
}

type HallOverlap = {
  hall: string
  date: string
  session1: { id: string; name: string; start: string; end: string }
  session2: { id: string; name: string; start: string; end: string }
  overlapMinutes: number
}

export default function ConflictsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [filter, setFilter] = useState<"all" | "faculty" | "overlap">("all")
  const [search, setSearch] = useState("")

  // Fetch all sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions-conflicts", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sessions")
        .select("id, session_name, session_date, start_time, end_time, hall, speakers, chairpersons, moderators")
        .eq("event_id", eventId)
        .order("session_date")
        .order("start_time")

      return (data || []) as Session[]
    },
  })

  // Helper to convert time to minutes
  const timeToMinutes = (time: string): number => {
    if (!time) return 0
    const [h, m] = time.split(":").map(Number)
    return h * 60 + m
  }

  // Helper to format time
  const formatTime = (time: string) => {
    if (!time) return "-"
    return time.substring(0, 5)
  }

  // Analyze conflicts
  const analysis = useMemo(() => {
    if (!sessions) return { facultyConflicts: [], hallOverlaps: [] }

    // Build faculty schedule map
    const facultySchedules = new Map<string, { session: Session; role: string }[]>()

    sessions.forEach(session => {
      const addFaculty = (name: string, role: string) => {
        const key = name.toLowerCase().trim()
        if (!facultySchedules.has(key)) facultySchedules.set(key, [])
        facultySchedules.get(key)!.push({ session, role })
      }

      // Add speakers
      session.speakers?.split(",").forEach(s => {
        const name = s.trim()
        if (name) addFaculty(name, "Speaker")
      })

      // Add chairpersons
      session.chairpersons?.split(",").forEach(s => {
        const name = s.trim()
        if (name) addFaculty(name, "Chairperson")
      })

      // Add moderators
      session.moderators?.split(",").forEach(s => {
        const name = s.trim()
        if (name) addFaculty(name, "Moderator")
      })
    })

    // Find faculty conflicts
    const facultyConflicts: FacultyConflict[] = []

    for (const [key, schedules] of facultySchedules) {
      // Group by date
      const byDate = new Map<string, typeof schedules>()
      schedules.forEach(s => {
        const date = s.session.session_date
        if (!byDate.has(date)) byDate.set(date, [])
        byDate.get(date)!.push(s)
      })

      // Check for overlaps on each date
      for (const [date, daySchedules] of byDate) {
        // Sort by start time
        const sorted = daySchedules.sort((a, b) =>
          timeToMinutes(a.session.start_time) - timeToMinutes(b.session.start_time)
        )

        for (let i = 0; i < sorted.length - 1; i++) {
          const current = sorted[i]
          const next = sorted[i + 1]

          const currentEnd = timeToMinutes(current.session.end_time)
          const nextStart = timeToMinutes(next.session.start_time)

          // Check if they overlap and are in different halls
          if (currentEnd > nextStart && current.session.hall !== next.session.hall) {
            // Find or create conflict entry for this faculty
            let conflict = facultyConflicts.find(c => c.facultyName.toLowerCase() === key)
            if (!conflict) {
              conflict = { facultyName: current.session.speakers?.split(",")[0]?.trim() || key, sessions: [] }
              facultyConflicts.push(conflict)
            }

            // Add both sessions if not already added
            const addSession = (s: typeof current) => {
              if (!conflict!.sessions.find(x => x.id === s.session.id)) {
                conflict!.sessions.push({
                  id: s.session.id,
                  name: s.session.session_name,
                  hall: s.session.hall,
                  date: s.session.session_date,
                  startTime: s.session.start_time,
                  endTime: s.session.end_time,
                })
              }
            }
            addSession(current)
            addSession(next)
          }
        }
      }
    }

    // Find hall overlaps
    const hallOverlaps: HallOverlap[] = []
    const hallSessions = new Map<string, Session[]>()

    sessions.forEach(session => {
      if (session.hall && session.session_date) {
        const key = `${session.session_date}|${session.hall}`
        if (!hallSessions.has(key)) hallSessions.set(key, [])
        hallSessions.get(key)!.push(session)
      }
    })

    for (const [key, hallSessionList] of hallSessions) {
      const sorted = hallSessionList.sort((a, b) =>
        timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
      )

      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i]
        const next = sorted[i + 1]

        const currentEnd = timeToMinutes(current.end_time)
        const nextStart = timeToMinutes(next.start_time)

        if (currentEnd > nextStart) {
          hallOverlaps.push({
            hall: current.hall,
            date: current.session_date,
            session1: {
              id: current.id,
              name: current.session_name,
              start: current.start_time,
              end: current.end_time,
            },
            session2: {
              id: next.id,
              name: next.session_name,
              start: next.start_time,
              end: next.end_time,
            },
            overlapMinutes: currentEnd - nextStart,
          })
        }
      }
    }

    return { facultyConflicts, hallOverlaps }
  }, [sessions])

  // Filter conflicts
  const filteredFacultyConflicts = useMemo(() => {
    if (!search) return analysis.facultyConflicts
    return analysis.facultyConflicts.filter(c =>
      c.facultyName.toLowerCase().includes(search.toLowerCase()) ||
      c.sessions.some(s => s.name.toLowerCase().includes(search.toLowerCase()))
    )
  }, [analysis.facultyConflicts, search])

  const filteredHallOverlaps = useMemo(() => {
    if (!search) return analysis.hallOverlaps
    return analysis.hallOverlaps.filter(o =>
      o.hall.toLowerCase().includes(search.toLowerCase()) ||
      o.session1.name.toLowerCase().includes(search.toLowerCase()) ||
      o.session2.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [analysis.hallOverlaps, search])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totalIssues = analysis.facultyConflicts.length + analysis.hallOverlaps.length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          Schedule Conflicts
        </h1>
        <p className="text-muted-foreground">Review and resolve scheduling conflicts</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className={cn(
            "cursor-pointer transition-all",
            filter === "all" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("all")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Total Issues</span>
            </div>
            <p className="text-3xl font-bold">{totalIssues}</p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "cursor-pointer transition-all border-red-200 dark:border-red-800",
            filter === "faculty" && "ring-2 ring-red-500"
          )}
          onClick={() => setFilter("faculty")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Faculty Conflicts</span>
            </div>
            <p className="text-3xl font-bold text-red-600">{analysis.facultyConflicts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Same person in 2 halls</p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "cursor-pointer transition-all border-amber-200 dark:border-amber-800",
            filter === "overlap" && "ring-2 ring-amber-500"
          )}
          onClick={() => setFilter("overlap")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Hall Overlaps</span>
            </div>
            <p className="text-3xl font-bold text-amber-600">{analysis.hallOverlaps.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Sessions overlap in same hall</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, session, or hall..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {totalIssues === 0 ? (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-green-800 dark:text-green-200">No Conflicts Found!</h2>
                <p className="text-green-700 dark:text-green-300">Your schedule has no timing conflicts.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Faculty Conflicts */}
          {(filter === "all" || filter === "faculty") && filteredFacultyConflicts.length > 0 && (
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <Users className="h-5 w-5" />
                  Faculty Conflicts ({filteredFacultyConflicts.length})
                </CardTitle>
                <CardDescription>
                  These faculty members are scheduled in multiple halls at overlapping times
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {filteredFacultyConflicts.map((conflict, idx) => (
                  <div key={idx} className="border rounded-lg p-4 bg-red-50/50 dark:bg-red-950/20">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-5 w-5 text-red-600" />
                      <span className="font-semibold text-lg">{conflict.facultyName}</span>
                      <Badge variant="destructive">{conflict.sessions.length} overlapping sessions</Badge>
                    </div>

                    <div className="grid gap-2">
                      {conflict.sessions.map((session, sIdx) => (
                        <div
                          key={session.id}
                          className="flex items-center gap-4 p-2 bg-white dark:bg-gray-900 rounded border"
                        >
                          <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-[100px]">
                            <Calendar className="h-3 w-3" />
                            {session.date}
                          </div>
                          <div className="flex items-center gap-1 text-sm font-medium min-w-[120px]">
                            <Clock className="h-3 w-3" />
                            {formatTime(session.startTime)} - {formatTime(session.endTime)}
                          </div>
                          <div className="flex items-center gap-1 text-sm min-w-[120px]">
                            <MapPin className="h-3 w-3 text-blue-600" />
                            <span className="font-medium text-blue-600">{session.hall}</span>
                          </div>
                          <div className="text-sm flex-1 truncate">{session.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Hall Overlaps */}
          {(filter === "all" || filter === "overlap") && filteredHallOverlaps.length > 0 && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Clock className="h-5 w-5" />
                  Hall Overlaps ({filteredHallOverlaps.length})
                </CardTitle>
                <CardDescription>
                  Sessions in the same hall that overlap in time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Hall</TableHead>
                      <TableHead>Session 1</TableHead>
                      <TableHead>Session 2</TableHead>
                      <TableHead>Overlap</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHallOverlaps.slice(0, 50).map((overlap, idx) => (
                      <TableRow key={idx} className="bg-amber-50/50 dark:bg-amber-950/20">
                        <TableCell className="font-medium">{overlap.date}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-blue-600" />
                            {overlap.hall}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{overlap.session1.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(overlap.session1.start)} - {formatTime(overlap.session1.end)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{overlap.session2.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(overlap.session2.start)} - {formatTime(overlap.session2.end)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">{overlap.overlapMinutes} min</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredHallOverlaps.length > 50 && (
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    Showing first 50 of {filteredHallOverlaps.length} overlaps
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
