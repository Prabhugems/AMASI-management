"use client"

import { useState, useMemo, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Printer, Clock, Calendar, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

type Session = {
  id: string
  session_name: string
  session_type: string
  session_date: string
  start_time: string
  end_time: string
  hall: string | null
  specialty_track: string | null
  speakers?: string | null
  speakers_text?: string | null
  chairpersons?: string | null
  moderators?: string | null
  description: string | null
  duration_minutes: number | null
}

type Track = {
  id: string
  name: string
  description: string | null
  chairpersons: string | null
  color: string | null
}

type HallCoordinator = {
  id: string
  hall_name: string
  coordinator_name: string
}

type Event = {
  id: string
  name: string
  short_name: string | null
  tagline: string | null
  start_date: string
  end_date: string
  venue_name: string | null
  city: string | null
  logo_url: string | null
  settings?: {
    public_page?: {
      theme?: "modern" | "classic" | "dark" | "minimal"
    }
  }
}

// Extract names only from "Name (email, phone) | Name2" format
const extractNames = (formatted: string | null | undefined) => {
  if (!formatted) return []
  return formatted.split(" | ").map(p => p.split("(")[0].trim())
}

export default function PrintProgramPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [selectedHall, setSelectedHall] = useState<string | null>(null)

  // Fetch event
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name, tagline, start_date, end_date, venue_name, city, logo_url, settings")
        .eq("id", eventId)
        .single()
      return data as Event | null
    },
  })

  // Fetch sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions-print", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("event_id", eventId)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
      return (data || []) as Session[]
    },
  })

  // Fetch tracks
  const { data: tracks } = useQuery({
    queryKey: ["tracks-print", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tracks")
        .select("*")
        .eq("event_id", eventId)
        .order("name")
      return (data || []) as Track[]
    },
  })

  // Fetch hall coordinators
  const { data: coordinators } = useQuery({
    queryKey: ["coordinators-print", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("hall_coordinators")
        .select("id, hall_name, coordinator_name")
        .eq("event_id", eventId)
      return (data || []) as HallCoordinator[]
    },
  })

  // Fetch faculty assignments
  const { data: assignments } = useQuery({
    queryKey: ["assignments-print", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("faculty_assignments")
        .select("faculty_name, role, session_id")
        .eq("event_id", eventId)
        .in("role", ["panelist", "chairperson", "moderator"])
      return (data || []) as { faculty_name: string; role: string; session_id: string }[]
    },
  })

  // Group assignments by session_id and role
  const assignmentsBySession = useMemo(() => {
    if (!assignments) return {}
    const grouped: Record<string, { panelists: string[]; chairpersons: string[]; moderators: string[] }> = {}
    assignments.forEach(a => {
      if (!grouped[a.session_id]) grouped[a.session_id] = { panelists: [], chairpersons: [], moderators: [] }
      if (a.role === "panelist") grouped[a.session_id].panelists.push(a.faculty_name)
      if (a.role === "chairperson") grouped[a.session_id].chairpersons.push(a.faculty_name)
      if (a.role === "moderator") grouped[a.session_id].moderators.push(a.faculty_name)
    })
    return grouped
  }, [assignments])

  // Get unique dates and halls
  const dates = useMemo(() => {
    if (!sessions) return []
    return [...new Set(sessions.map(s => s.session_date))].sort()
  }, [sessions])

  // Group dates into phases
  const datePhases = useMemo(() => {
    if (!sessions || dates.length === 0) return []

    type Phase = { label: string; dates: string[] }
    const phases: Phase[] = []
    let currentPhase: Phase | null = null

    for (const date of dates) {
      const daySessions = sessions.filter(s => s.session_date === date)
      const hasOnline = daySessions.some(s => (s.session_name || "").toLowerCase().includes("online"))
      const hasExam = daySessions.some(s =>
        (s.specialty_track || "").toLowerCase().includes("exam") ||
        (s.session_name || "").toLowerCase().includes("exam")
      )

      let phaseLabel: string
      if (hasExam) {
        phaseLabel = "Examination"
      } else if (hasOnline) {
        phaseLabel = "Online Lectures"
      } else {
        phaseLabel = "Onsite Sessions"
      }

      if (!currentPhase || currentPhase.label !== phaseLabel) {
        currentPhase = { label: phaseLabel, dates: [date] }
        phases.push(currentPhase)
      } else {
        currentPhase.dates.push(date)
      }
    }

    return phases
  }, [sessions, dates])

  const halls = useMemo(() => {
    if (!sessions) return []
    return [...new Set(sessions.map(s => s.hall).filter(Boolean))] as string[]
  }, [sessions])

  const hasHalls = halls.length > 0

  // Set default hall
  useEffect(() => {
    if (halls.length > 0 && !selectedHall) setSelectedHall(halls[0])
  }, [halls, selectedHall])

  // Helper: check if session is a metadata row
  const isMetaSession = (s: Session) => {
    const name = (s.session_name || "").toLowerCase()
    return name.startsWith("session moderator") || name.startsWith("session chairperson")
  }

  // Helper: check if a track is a panel discussion
  const isPanelTrack = (trackName: string) => {
    const name = trackName.toLowerCase()
    return name.includes("panel") || name.includes("discussion")
  }

  // Helper: check if a track is a simple break/utility (Tea, Lunch, Registration, etc.)
  const isCompactTrack = (trackName: string, trackSessions: Session[]) => {
    const name = trackName.toLowerCase()
    if (name.includes("panel")) return false // Don't compact panel discussions
    // These tracks are always compact even with multiple sessions
    const alwaysCompact = name.includes("inauguration") || name.includes("valedictory")
    if (!alwaysCompact && trackSessions.length > 1) return false
    return name.includes("tea") || name.includes("lunch") || name.includes("break") ||
      name.includes("registration") || name.includes("inauguration") || name.includes("valedictory") ||
      name.includes("welcome") || name.includes("closing") || name.includes("exam") ||
      name.includes("video")
  }

  // Get moderator/chairperson info for a given day from meta sessions
  const getDayMeta = (day: string) => {
    if (!sessions) return { moderator: "", chairpersons: "", chairSessionsByTime: [] as Session[] }
    const daySessions = sessions.filter(s => s.session_date === day)
    const modSession = daySessions.find(s => (s.session_name || "").toLowerCase().startsWith("session moderator"))
    const chairSession = daySessions.find(s =>
      (s.session_name || "").toLowerCase().startsWith("session chairperson") &&
      s.specialty_track !== "Session Chair"
    )
    const chairSessions = daySessions.filter(s => s.specialty_track === "Session Chair")

    return {
      moderator: modSession?.moderators || "",
      chairpersons: chairSession?.chairpersons || "",
      chairSessionsByTime: chairSessions,
    }
  }

  // Filter sessions for a specific day and hall
  const getFilteredSessions = (day: string, hall: string | null) => {
    if (!sessions) return []
    return sessions.filter(s => {
      if (s.session_date !== day) return false
      if (hasHalls && s.hall !== hall) return false
      if (isMetaSession(s)) return false
      if (s.specialty_track === "Session Chair") return false
      const sessionName = (s.session_name || "").toLowerCase().trim()
      if (/^hall\s*[a-z0-9]?$/i.test(sessionName)) return false
      if (/^(red|green|blue|yellow|main|conference)\s*hall/i.test(sessionName)) return false
      return true
    })
  }

  // Group sessions by track, sorted chronologically by first session time
  const groupByTrack = (filteredSessions: Session[]) => {
    const grouped: Record<string, { track: Track | null; sessions: Session[] }> = {}

    filteredSessions.forEach(session => {
      const trackName = session.specialty_track || "General"
      if (!grouped[trackName]) {
        const trackData = tracks?.find(t => t.name === trackName) || null
        grouped[trackName] = { track: trackData, sessions: [] }
      }
      grouped[trackName].sessions.push(session)
    })

    Object.values(grouped).forEach(g => {
      g.sessions.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
    })

    // Sort tracks by their first session's start time (chronological order)
    const sorted: Record<string, { track: Track | null; sessions: Session[] }> = {}
    Object.entries(grouped)
      .sort(([, a], [, b]) => {
        const aTime = a.sessions[0]?.start_time || ""
        const bTime = b.sessions[0]?.start_time || ""
        return aTime.localeCompare(bTime)
      })
      .forEach(([key, val]) => { sorted[key] = val })

    return sorted
  }

  // Get hall coordinators for a hall
  const getHallCoordinators = (hall: string | null) => {
    if (!coordinators || !hall) return []
    return coordinators.filter(c => c.hall_name === hall)
  }

  // Get time range for a track
  const getTrackTimeRange = (trackSessions: Session[]) => {
    if (trackSessions.length === 0) return ""
    const sorted = [...trackSessions].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
    const start = formatTime(sorted[0].start_time)
    const end = formatTime(sorted[sorted.length - 1].end_time)
    return `${start} - ${end}`
  }

  const formatTime = (time: string | null) => {
    if (!time) return ""
    const [hours, minutes] = time.split(":")
    const h = parseInt(hours)
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
  }

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start)
    const e = new Date(end)
    return `${s.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${e.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
  }

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading program...</p>
      </div>
    )
  }

  // Build the full structure: for each day, for each hall, group by track
  const printSections: {
    date: string
    dayIndex: number
    phaseLabel: string
    hall: string | null
    hallCoordinators: HallCoordinator[]
    sessionsByTrack: Record<string, { track: Track | null; sessions: Session[] }>
    dayMeta: { moderator: string; chairpersons: string; chairSessionsByTime: Session[] }
  }[] = []

  datePhases.forEach(phase => {
    phase.dates.forEach((date, dayIdxInPhase) => {
      const dayIndex = dates.indexOf(date) + 1
      const dayMeta = getDayMeta(date)

      if (hasHalls) {
        // For print, show all halls (or the selected one)
        const hallsToShow = selectedHall ? [selectedHall] : halls
        hallsToShow.forEach(hall => {
          const filtered = getFilteredSessions(date, hall)
          if (filtered.length === 0) return
          const grouped = groupByTrack(filtered)
          printSections.push({
            date,
            dayIndex,
            phaseLabel: phase.label,
            hall,
            hallCoordinators: getHallCoordinators(hall),
            sessionsByTrack: grouped,
            dayMeta,
          })
        })
      } else {
        const filtered = getFilteredSessions(date, null)
        if (filtered.length === 0) return
        const grouped = groupByTrack(filtered)
        printSections.push({
          date,
          dayIndex,
          phaseLabel: phase.label,
          hall: null,
          hallCoordinators: [],
          sessionsByTrack: grouped,
          dayMeta,
        })
      }
    })
  })

  return (
    <>
      {/* Control Bar - Hidden on Print */}
      <div className="fixed top-0 left-0 right-0 bg-background border-b z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Program
          </Button>
          <div className="flex items-center gap-3">
            {hasHalls && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Hall:</span>
                <select
                  value={selectedHall || ""}
                  onChange={(e) => setSelectedHall(e.target.value || null)}
                  className="border rounded-md px-2 py-1 text-sm"
                >
                  <option value="">All Halls</option>
                  {halls.map(hall => (
                    <option key={hall} value={hall}>{hall}</option>
                  ))}
                </select>
              </div>
            )}
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Save PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Printable Content */}
      <div className="pt-16 print:pt-0">
        <div className="max-w-7xl mx-auto p-6 print:p-0 print:max-w-none">
          <div className="bg-white text-black print:bg-white program-document">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white px-8 py-8 print:px-4 print:py-3">
              <div className="flex items-center gap-4 print:gap-3">
                {event?.logo_url && (
                  <img src={event.logo_url} alt="" className="h-16 w-16 print:h-10 print:w-10 rounded-lg bg-white p-1" />
                )}
                <div>
                  <h1 className="text-2xl md:text-3xl print:text-xl font-bold">
                    {event?.short_name || event?.name || "Conference Program"}
                  </h1>
                  {event?.tagline && (
                    <p className="text-blue-200 mt-1 print:mt-0 print:text-xs">{event.tagline}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 print:gap-3 mt-3 print:mt-1 text-sm print:text-xs text-blue-200">
                    {event?.start_date && event?.end_date && (
                      <span className="flex items-center gap-1.5 print:gap-1">
                        <Calendar className="h-4 w-4 print:h-3 print:w-3" />
                        {formatDateRange(event.start_date, event.end_date)}
                      </span>
                    )}
                    {event?.venue_name && (
                      <span className="flex items-center gap-1.5 print:gap-1">
                        <MapPin className="h-4 w-4 print:h-3 print:w-3" />
                        {event.venue_name}{event.city ? `, ${event.city}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-6 p-6 print:p-3 print:space-y-3">
              {printSections.map((section, sectionIdx) => {
                const prevSection = sectionIdx > 0 ? printSections[sectionIdx - 1] : null
                const showPhaseHeader = !prevSection || prevSection.phaseLabel !== section.phaseLabel
                const showDayHeader = !prevSection || prevSection.date !== section.date

                return (
                  <div key={`${section.date}-${section.hall}`} className="day-section">
                    {/* Phase Header */}
                    {showPhaseHeader && (
                      <div className="mb-4 mt-2 print:mb-2 print:mt-1 phase-header">
                        <div className={cn(
                          "inline-block px-4 py-1.5 print:px-3 print:py-1 rounded-full text-sm font-semibold",
                          section.phaseLabel === "Online Lectures" ? "bg-purple-100 text-purple-700" :
                          section.phaseLabel === "Examination" ? "bg-emerald-100 text-emerald-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {section.phaseLabel}
                        </div>
                      </div>
                    )}

                    {/* Day Header */}
                    {showDayHeader && (
                      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg px-6 py-4 print:px-4 print:py-2 mb-4 print:mb-2 day-header">
                        <h2 className="text-xl print:text-base font-bold text-blue-700">
                          Day {section.dayIndex} — {formatFullDate(section.date)}
                        </h2>
                      </div>
                    )}

                    {/* Hall Header */}
                    {section.hall && (
                      <div className="bg-gray-50 border rounded-lg px-5 py-3 print:px-3 print:py-2 mb-4 print:mb-2 flex items-center justify-between hall-header">
                        <div>
                          <h3 className="text-lg print:text-sm font-bold text-gray-800">{section.hall}</h3>
                          {section.hallCoordinators.length > 0 && (
                            <p className="text-sm print:text-xs text-gray-500 mt-1 print:mt-0">
                              <span className="font-medium">Hall Coordinators:</span>{" "}
                              {section.hallCoordinators.map(c => c.coordinator_name).join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="text-right print:hidden">
                          <p className="text-2xl font-bold text-gray-700">
                            {Object.values(section.sessionsByTrack).reduce((sum, t) => sum + t.sessions.length, 0)}
                          </p>
                          <p className="text-xs text-gray-500">Sessions</p>
                        </div>
                      </div>
                    )}

                    {/* Tracks - flat timeline interleaving compact items between chair groups */}
                    <div className="space-y-4 print:space-y-2">
                      {(() => {
                        // Separate compact items from regular tracks
                        const allEntries = Object.entries(section.sessionsByTrack)
                        const compactItems: { trackName: string; session: Session; color: string; startTime: string }[] = []
                        const regularEntries: [string, { track: Track | null; sessions: Session[] }][] = []

                        allEntries.forEach(([tn, { track: t, sessions: tSessions }]) => {
                          if (isCompactTrack(tn, tSessions)) {
                            // Add each session as a separate compact item
                            tSessions.forEach((sess, si) => {
                              const tnLower = tn.toLowerCase()
                              const isMultiSession = tSessions.length > 1
                              // For multi-session compact tracks (e.g. Inauguration), use session name as label
                              let label = tn
                              if (isMultiSession && sess.session_name) {
                                const sName = sess.session_name
                                // Shorten "Welcome: introduction to ..." to "Welcome Address"
                                if (sName.toLowerCase().startsWith("welcome")) {
                                  label = "Welcome Address"
                                } else {
                                  label = sName
                                }
                              }
                              compactItems.push({
                                trackName: label,
                                session: sess,
                                color: t?.color || "#3B82F6",
                                startTime: sess.start_time || "",
                              })
                            })
                          } else {
                            regularEntries.push([tn, { track: t, sessions: tSessions }])
                          }
                        })

                        compactItems.sort((a, b) => a.startTime.localeCompare(b.startTime))

                        // Build flat timeline: track headers, chair groups, panels, compact items
                        type TimelineItem =
                          | { type: "compact"; key: string; trackName: string; session: Session; color: string }
                          | { type: "track-header"; key: string; trackName: string; track: Track | null; trackSessions: Session[]; timeRange: string; color: string; moderator: string; chairpersons: string; isPanel: boolean }
                          | { type: "chair-group"; key: string; group: { chair: string; sessions: Session[] }; isFirstGroup: boolean }
                          | { type: "panel-content"; key: string; trackSessions: Session[] }

                        const timeline: (TimelineItem & { sortTime: string })[] = []

                        regularEntries.forEach(([trackName, { track, sessions: trackSessions }]) => {
                          const isPanel = isPanelTrack(trackName)
                          const timeRange = getTrackTimeRange(trackSessions)
                          const trackColor = track?.color || "#3B82F6"
                          const trackModeratorName = section.dayMeta.moderator
                          const trackChairpersonNames = track?.chairpersons
                            ? extractNames(track.chairpersons).join(", ")
                            : section.dayMeta.chairpersons || ""

                          const getChairpersonsForSession = (session: Session) => {
                            if (section.dayMeta.chairSessionsByTime && section.dayMeta.chairSessionsByTime.length > 0) {
                              const match = section.dayMeta.chairSessionsByTime.find(cs =>
                                cs.start_time && cs.end_time &&
                                session.start_time >= cs.start_time && session.start_time < cs.end_time
                              )
                              if (match?.chairpersons) return match.chairpersons
                            }
                            return trackChairpersonNames
                          }

                          // Track header - sorted by first session time
                          const firstTime = trackSessions[0]?.start_time || ""
                          timeline.push({
                            type: "track-header",
                            key: `th-${trackName}`,
                            trackName,
                            track,
                            trackSessions,
                            timeRange,
                            color: trackColor,
                            moderator: trackModeratorName,
                            chairpersons: trackChairpersonNames,
                            isPanel,
                            sortTime: firstTime,
                          })

                          if (isPanel) {
                            timeline.push({
                              type: "panel-content",
                              key: `pc-${trackName}`,
                              trackSessions,
                              sortTime: firstTime + "-1",
                            })
                          } else {
                            // Build chair groups
                            const hasChairSlots = section.dayMeta.chairSessionsByTime && section.dayMeta.chairSessionsByTime.length > 0
                            const groups: { chair: string; sessions: Session[] }[] = []
                            if (hasChairSlots) {
                              trackSessions.forEach(session => {
                                const chair = getChairpersonsForSession(session)
                                const existing = groups.find(g => g.chair === chair)
                                if (existing) {
                                  existing.sessions.push(session)
                                } else {
                                  groups.push({ chair, sessions: [session] })
                                }
                              })
                            } else {
                              groups.push({ chair: "", sessions: trackSessions })
                            }

                            groups.forEach((group, gIdx) => {
                              const groupTime = group.sessions[0]?.start_time || ""
                              timeline.push({
                                type: "chair-group",
                                key: `cg-${trackName}-${gIdx}`,
                                group,
                                isFirstGroup: gIdx === 0,
                                sortTime: groupTime + "-1",
                              })
                            })
                          }
                        })

                        // Add compact items to timeline
                        compactItems.forEach(ci => {
                          timeline.push({
                            type: "compact",
                            key: `compact-${ci.trackName}`,
                            trackName: ci.trackName,
                            session: ci.session,
                            color: ci.color,
                            sortTime: ci.startTime,
                          })
                        })

                        // Sort by time
                        timeline.sort((a, b) => a.sortTime.localeCompare(b.sortTime))

                        // Render timeline
                        return timeline.map((item) => {
                          if (item.type === "compact") {
                            const sessionNameLower = (item.session.session_name || "").toLowerCase().trim()
                            const trackNameLower = item.trackName.toLowerCase().trim()
                            const showSessionName = sessionNameLower !== trackNameLower &&
                              !trackNameLower.includes(sessionNameLower) &&
                              !sessionNameLower.includes(trackNameLower)
                            return (
                              <div key={item.key} className="compact-track flex items-center gap-3 px-4 py-2.5 print:py-1.5 bg-amber-50 border-l-4 border-amber-400 rounded-r-md text-sm print-color">
                                <span className="font-bold text-amber-800">{item.trackName}</span>
                                <span className="text-amber-600 font-medium">
                                  {formatTime(item.session.start_time)} - {formatTime(item.session.end_time)}
                                </span>
                                {showSessionName && (
                                  <span className="text-amber-700 italic">{item.session.session_name}</span>
                                )}
                              </div>
                            )
                          }

                          if (item.type === "track-header") {
                            return (
                              <div key={item.key} className="track-section mt-3 print:mt-2">
                                <div
                                  className="flex items-center p-4 print:px-3 print:py-2 border-l-4 rounded-r-md track-header print-color"
                                  style={{ borderLeftColor: item.color, backgroundColor: `${item.color}10` }}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                      <h4 className="font-bold text-lg print:text-sm text-gray-900">{item.trackName}</h4>
                                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full print:hidden">
                                        {item.trackSessions.length} session{item.trackSessions.length !== 1 ? "s" : ""}
                                      </span>
                                    </div>
                                    {item.track?.description && (
                                      <p className="text-sm print:text-xs text-gray-500 mt-0.5 print:mt-0">{item.track.description}</p>
                                    )}
                                    {!item.isPanel && (item.moderator || item.chairpersons) && (
                                      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1.5 print:mt-0.5 text-sm print:text-xs">
                                        {item.moderator && (
                                          <span className="text-gray-600">
                                            <span className="font-semibold text-gray-700">Moderator:</span> {item.moderator}
                                          </span>
                                        )}
                                        {item.chairpersons && (
                                          <span className="text-gray-600">
                                            <span className="font-semibold text-gray-700">Chairpersons:</span> {item.chairpersons}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right ml-4 flex-shrink-0">
                                    <p className="text-sm print:text-xs font-bold text-gray-900">{item.timeRange}</p>
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          if (item.type === "panel-content") {
                            return (
                              <div key={item.key} className="bg-white border border-gray-200 rounded-md overflow-hidden">
                                {item.trackSessions.map((session) => {
                                  const sessionAssignments = assignmentsBySession[session.id]
                                  const panelists = sessionAssignments?.panelists || []
                                  return (
                                    <div key={session.id} className="p-4 print:p-2 print:px-3 border-b last:border-b-0 panel-item">
                                      <h5 className="font-bold text-gray-900 mb-1 print:text-sm">{session.session_name}</h5>
                                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5 print:mb-1">
                                        <Clock className="h-3.5 w-3.5 print:hidden" />
                                        {formatTime(session.start_time)} - {formatTime(session.end_time)}
                                      </div>
                                      {session.moderators && (
                                        <p className="text-sm print:text-xs text-gray-700 mb-1">
                                          <span className="font-semibold">Moderator:</span> {session.moderators}
                                        </p>
                                      )}
                                      {session.chairpersons && (
                                        <p className="text-sm print:text-xs text-gray-700 mb-1">
                                          <span className="font-semibold">Chairpersons:</span> {session.chairpersons}
                                        </p>
                                      )}
                                      {panelists.length > 0 && (
                                        <div className="mt-1.5 print:mt-1">
                                          <p className="text-sm print:text-xs font-semibold text-gray-700 mb-1">Panelists:</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {panelists.map((name, i) => (
                                              <span key={i} className="text-sm print:text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-700">
                                                {name}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          }

                          if (item.type === "chair-group") {
                            let rowIdx = 0
                            const group = item.group
                            return (
                              <div key={item.key} className="chair-group">
                                <div className="chair-group-header">
                                  {group.chair && (
                                    <div className="px-4 py-1.5 print:px-3 print:py-1 bg-blue-50 border-y border-blue-100 text-sm print:text-xs text-blue-800 font-medium print-color">
                                      <span className="font-semibold">Chairpersons:</span> {group.chair}
                                    </div>
                                  )}
                                  {item.isFirstGroup && (
                                    <div className="text-xs font-semibold uppercase tracking-wider bg-gray-50 text-gray-500 border-b">
                                      <div className="flex px-4 py-2 print:px-3 print:py-1">
                                        <div className="w-36 print:w-36 print:pr-2 flex-shrink-0">Time</div>
                                        <div className="flex-1">Topic</div>
                                        <div className="w-40 print:w-32">Speaker</div>
                                      </div>
                                    </div>
                                  )}
                                  {group.sessions.length > 0 && (() => {
                                    const session = group.sessions[0]
                                    rowIdx++
                                    return (
                                      <div key={session.id} className="flex px-4 py-2.5 print:px-3 print:py-1.5 text-sm border-b border-gray-100 bg-white">
                                        <div className="w-36 print:w-36 print:pr-2 flex-shrink-0 font-medium text-gray-900 whitespace-nowrap">
                                          <div className="flex items-center gap-1">
                                            <Clock className="h-3.5 w-3.5 text-gray-400 print:hidden" />
                                            {formatTime(session.start_time)} - {formatTime(session.end_time)}
                                          </div>
                                        </div>
                                        <div className="flex-1 text-gray-800 font-medium pr-4 print:pr-2">{session.session_name}</div>
                                        <div className="w-40 print:w-32 text-gray-600">{session.speakers}</div>
                                      </div>
                                    )
                                  })()}
                                </div>
                                {group.sessions.slice(1).map((session) => {
                                  const currentIdx = rowIdx++
                                  return (
                                    <div
                                      key={session.id}
                                      className={cn(
                                        "flex px-4 py-2.5 print:px-3 print:py-1.5 text-sm border-b border-gray-100 session-row",
                                        currentIdx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                                      )}
                                    >
                                      <div className="w-36 print:w-36 print:pr-2 flex-shrink-0 font-medium text-gray-900 whitespace-nowrap">
                                        <div className="flex items-center gap-1">
                                          <Clock className="h-3.5 w-3.5 text-gray-400 print:hidden" />
                                          {formatTime(session.start_time)} - {formatTime(session.end_time)}
                                        </div>
                                      </div>
                                      <div className="flex-1 text-gray-800 font-medium pr-4 print:pr-2">{session.session_name}</div>
                                      <div className="w-40 print:w-32 text-gray-600">{session.speakers}</div>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          }

                          return null
                        })
                      })()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 print:mt-2 print:pt-2 border-t border-gray-300 text-center px-6 print:px-3 pb-2 print:pb-1">
              <p className="text-xs text-gray-500">
                Program schedule is subject to change. Please check with the registration desk for updates.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 8pt;
            line-height: 1.3;
          }

          .print\\:hidden {
            display: none !important;
          }

          .program-document {
            padding: 0 !important;
          }

          /* Day sections can break across pages */
          .day-section {
            page-break-inside: auto;
            break-inside: auto;
            margin-bottom: 6px;
          }

          /* Phase header: keep with next content */
          .phase-header {
            page-break-after: avoid;
            break-after: avoid;
          }

          /* Day header: keep with content below */
          .day-header {
            page-break-after: avoid;
            break-after: avoid;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* Hall header: keep with tracks below */
          .hall-header {
            page-break-after: avoid;
            break-after: avoid;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* Track sections */
          .track-section {
            page-break-inside: auto;
            break-inside: auto;
            margin-top: 6px !important;
          }

          /* Compact tracks: break-style inline */
          .compact-track {
            page-break-inside: avoid;
            break-inside: avoid;
            margin: 4px 0;
            border-radius: 0 !important;
            padding: 4px 10px !important;
            font-size: 8pt;
            border-left-width: 3px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Track header: keep with first content */
          .track-header {
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: avoid;
            break-after: avoid;
          }

          /* Chair group: allow breaking across pages */
          .chair-group {
            page-break-inside: auto;
            break-inside: auto;
          }

          /* Chair group header (chair bar + column headers + first row):
             NEVER break inside - keeps header with at least one row */
          .chair-group-header {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* Session rows: never break inside a single row */
          .session-row {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* Panel items: never break inside */
          .panel-item {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .print-color {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          @page {
            size: A4 portrait;
            margin: 8mm 10mm 14mm 10mm;

            @bottom-center {
              content: "Page " counter(page) " of " counter(pages);
              font-size: 8pt;
              color: #9ca3af;
            }
          }
        }
      `}</style>
    </>
  )
}
