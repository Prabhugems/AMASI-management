"use client"

import { useState, useMemo, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChevronDown,
  ChevronRight,
  Calendar,
  MapPin,
  Clock,
  Search,
  X,
  Download,
  Expand,
  Minimize2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { InsertChat } from "@/components/insert-chat"

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
  chairpersons?: string | null
  moderators?: string | null
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

// Theme configurations
const THEME_CONFIG = {
  modern: {
    page: "bg-gray-50",
    header: "bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white",
    headerText: "text-blue-200",
    nav: "bg-white border-b shadow-sm",
    card: "bg-white border shadow-sm",
    cardHeader: "bg-gray-50",
    text: "text-gray-900",
    textMuted: "text-gray-500",
    accent: "bg-blue-600 text-white",
  },
  classic: {
    page: "bg-[#1a1a2e]",
    header: "bg-[#FDF6E3] text-gray-900 border-b-2 border-gray-300",
    headerText: "text-gray-600",
    nav: "bg-[#FDF6E3] border-b border-gray-300",
    card: "bg-[#FDF6E3] border-gray-300",
    cardHeader: "bg-[#1B6B93] text-white",
    text: "text-gray-800",
    textMuted: "text-gray-600",
    accent: "bg-[#14919B] text-white",
  },
  dark: {
    page: "bg-gray-950",
    header: "bg-gradient-to-br from-gray-900 to-gray-800 text-white",
    headerText: "text-gray-400",
    nav: "bg-gray-900 border-b border-gray-800",
    card: "bg-gray-900 border-gray-800",
    cardHeader: "bg-gray-800",
    text: "text-white",
    textMuted: "text-gray-400",
    accent: "bg-blue-600 text-white",
  },
  minimal: {
    page: "bg-white",
    header: "bg-white text-gray-900 border-b",
    headerText: "text-gray-500",
    nav: "bg-gray-50 border-b",
    card: "bg-white border",
    cardHeader: "bg-gray-50",
    text: "text-gray-900",
    textMuted: "text-gray-500",
    accent: "bg-gray-900 text-white",
  },
}

// Hall colors for visual distinction
const HALL_COLORS: Record<string, { bg: string; text: string; accent: string; light: string }> = {
  "red": { bg: "bg-red-600", text: "text-red-700", accent: "border-red-500", light: "bg-red-50" },
  "green": { bg: "bg-green-600", text: "text-green-700", accent: "border-green-500", light: "bg-green-50" },
  "blue": { bg: "bg-blue-600", text: "text-blue-700", accent: "border-blue-500", light: "bg-blue-50" },
  "yellow": { bg: "bg-amber-500", text: "text-amber-700", accent: "border-amber-500", light: "bg-amber-50" },
  "orange": { bg: "bg-orange-500", text: "text-orange-700", accent: "border-orange-500", light: "bg-orange-50" },
  "purple": { bg: "bg-purple-600", text: "text-purple-700", accent: "border-purple-500", light: "bg-purple-50" },
  "pink": { bg: "bg-pink-600", text: "text-pink-700", accent: "border-pink-500", light: "bg-pink-50" },
  "default": { bg: "bg-slate-600", text: "text-slate-700", accent: "border-slate-500", light: "bg-slate-50" },
}

const getHallColors = (hall: string | null) => {
  if (!hall) return HALL_COLORS.default
  const h = hall.toLowerCase()
  for (const [key, colors] of Object.entries(HALL_COLORS)) {
    if (h.includes(key)) return colors
  }
  return HALL_COLORS.default
}

// Extract names only from "Name (email, phone) | Name2" format
const extractNames = (formatted: string | null | undefined) => {
  if (!formatted) return []
  return formatted.split(" | ").map(p => p.split("(")[0].trim())
}

export default function DelegateViewPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedHall, setSelectedHall] = useState<string | null>(null)
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")

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

  // Get theme from settings
  const theme = event?.settings?.public_page?.theme || "modern"
  const themeConfig = THEME_CONFIG[theme]

  // Fetch sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions-delegate", eventId],
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
    queryKey: ["tracks-delegate", eventId],
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
    queryKey: ["coordinators-delegate", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("hall_coordinators")
        .select("id, hall_name, coordinator_name")
        .eq("event_id", eventId)
      return (data || []) as HallCoordinator[]
    },
  })

  // Get unique dates and halls
  const dates = useMemo(() => {
    if (!sessions) return []
    return [...new Set(sessions.map(s => s.session_date))].sort()
  }, [sessions])

  const halls = useMemo(() => {
    if (!sessions) return []
    return [...new Set(sessions.map(s => s.hall).filter(Boolean))] as string[]
  }, [sessions])

  // Set defaults
  useEffect(() => {
    if (dates.length > 0 && !selectedDay) setSelectedDay(dates[0])
    if (halls.length > 0 && !selectedHall) setSelectedHall(halls[0])
  }, [dates, halls, selectedDay, selectedHall])

  // Filter and group sessions
  const filteredSessions = useMemo(() => {
    if (!sessions || !selectedDay || !selectedHall) return []
    return sessions.filter(s => {
      // Match day and hall
      if (s.session_date !== selectedDay || s.hall !== selectedHall) return false
      // Exclude hall coordinator rows
      const sessionName = (s.session_name || "").toLowerCase().trim()
      if (/^hall\s*[a-z0-9]?$/i.test(sessionName)) return false
      if (/^(red|green|blue|yellow|main|conference)\s*hall/i.test(sessionName)) return false
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = s.session_name?.toLowerCase().includes(query)
        const matchesSpeakers = s.speakers?.toLowerCase().includes(query)
        const matchesChairs = s.chairpersons?.toLowerCase().includes(query)
        if (!matchesName && !matchesSpeakers && !matchesChairs) return false
      }
      return true
    })
  }, [sessions, selectedDay, selectedHall, searchQuery])

  // Group by track/session
  const sessionsByTrack = useMemo(() => {
    const grouped: Record<string, { track: Track | null; sessions: Session[] }> = {}

    filteredSessions.forEach(session => {
      const trackName = session.specialty_track || "General"
      if (!grouped[trackName]) {
        const trackData = tracks?.find(t => t.name === trackName) || null
        grouped[trackName] = { track: trackData, sessions: [] }
      }
      grouped[trackName].sessions.push(session)
    })

    // Sort sessions within each track by start_time
    Object.values(grouped).forEach(g => {
      g.sessions.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
    })

    return grouped
  }, [filteredSessions, tracks])

  // Get hall coordinators for selected hall
  const hallCoordinators = useMemo(() => {
    if (!coordinators || !selectedHall) return []
    return coordinators.filter(c => c.hall_name === selectedHall)
  }, [coordinators, selectedHall])

  // Stats
  const stats = useMemo(() => {
    return {
      totalSessions: filteredSessions.length,
      totalTracks: Object.keys(sessionsByTrack).length,
    }
  }, [filteredSessions, sessionsByTrack])

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

  const getDayNumber = (dateStr: string) => {
    return dates.indexOf(dateStr) + 1
  }

  // Get time range for a track
  const getTrackTimeRange = (trackSessions: Session[]) => {
    if (trackSessions.length === 0) return ""
    const sorted = [...trackSessions].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
    const start = formatTime(sorted[0].start_time)
    const end = formatTime(sorted[sorted.length - 1].end_time)
    return `${start} - ${end}`
  }

  // Check if session is a panel discussion
  const isPanelDiscussion = (session: Session) => {
    const name = (session.session_name || "").toLowerCase()
    return name.includes("panel") || name.includes("discussion") || session.moderators
  }

  // Toggle track expansion
  const toggleTrack = (trackName: string) => {
    setExpandedTracks(prev => {
      const next = new Set(prev)
      if (next.has(trackName)) {
        next.delete(trackName)
      } else {
        next.add(trackName)
      }
      return next
    })
  }

  const expandAll = () => setExpandedTracks(new Set(Object.keys(sessionsByTrack)))
  const collapseAll = () => setExpandedTracks(new Set())

  const hallColors = getHallColors(selectedHall)

  if (isLoading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", themeConfig.header)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-current border-t-transparent mx-auto mb-4 opacity-50" />
          <p className="text-lg opacity-80">Loading Program...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen", themeConfig.page)}>
      {/* AI Chatbot for delegate assistance */}
      <InsertChat metadata={{ event: event?.name || "", type: "delegate" }} />
      {/* Hero Header */}
      <header className={themeConfig.header}>
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              {event?.logo_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={event.logo_url} alt="" className="h-16 w-16 rounded-lg bg-white p-1" />
              )}
              <div>
                <h1 className="text-2xl md:text-4xl font-bold">
                  {event?.short_name || event?.name || "Conference Program"}
                </h1>
                {event?.tagline && (
                  <p className="text-blue-200 mt-1">{event.tagline}</p>
                )}
                <div className={cn("flex flex-wrap items-center gap-4 mt-3 text-sm", themeConfig.headerText)}>
                  {event?.start_date && event?.end_date && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {formatDateRange(event.start_date, event.end_date)}
                    </span>
                  )}
                  {event?.venue_name && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {event.venue_name}{event.city ? `, ${event.city}` : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" asChild>
                <a href={`/events/${eventId}/program/print`} target="_blank">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Day Tabs & Hall Selector */}
      <div className={cn("sticky top-0 z-40", themeConfig.nav)}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-2 py-3 overflow-x-auto">
            {/* Day Tabs */}
            {dates.map((date, index) => (
              <button
                key={date}
                onClick={() => setSelectedDay(date)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                  selectedDay === date
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                Day {index + 1}
                <span className="ml-1.5 text-xs opacity-75">{formatDate(date)}</span>
              </button>
            ))}

            <div className="w-px h-8 bg-gray-300 mx-2" />

            {/* Hall Tabs */}
            {halls.map(hall => {
              const colors = getHallColors(hall)
              const isSelected = selectedHall === hall
              return (
                <button
                  key={hall}
                  onClick={() => setSelectedHall(hall)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border-2",
                    isSelected
                      ? `${colors.bg} text-white shadow-lg border-transparent`
                      : `bg-white ${colors.text} ${colors.accent} hover:${colors.light}`
                  )}
                >
                  {hall}
                </button>
              )
            })}

            <div className="flex-1" />

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-48 md:w-64"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Hall Info Card */}
        <div className={cn("rounded-xl p-6 mb-6 border-l-4", hallColors.light, hallColors.accent)}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={cn("text-2xl font-bold", hallColors.text)}>
                {selectedHall}
              </h2>
              <p className="text-gray-600 mt-1">
                Day {selectedDay ? getDayNumber(selectedDay) : 1} - {selectedDay ? formatFullDate(selectedDay) : ""}
              </p>
              {hallCoordinators.length > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  <span className="font-medium">Hall Coordinators:</span>{" "}
                  {hallCoordinators.map(c => c.coordinator_name).join(", ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className={cn("text-3xl font-bold", hallColors.text)}>{stats.totalSessions}</p>
                <p className="text-sm text-gray-500">Sessions</p>
              </div>
              <div className="text-center">
                <p className={cn("text-3xl font-bold", hallColors.text)}>{stats.totalTracks}</p>
                <p className="text-sm text-gray-500">Tracks</p>
              </div>
            </div>
          </div>
        </div>

        {/* Expand/Collapse Controls */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {stats.totalSessions} session{stats.totalSessions !== 1 ? "s" : ""} in {stats.totalTracks} track{stats.totalTracks !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              <Expand className="h-4 w-4 mr-1" />
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              <Minimize2 className="h-4 w-4 mr-1" />
              Collapse All
            </Button>
          </div>
        </div>

        {/* Sessions by Track */}
        <div className="space-y-4">
          {Object.entries(sessionsByTrack).map(([trackName, { track, sessions: trackSessions }]) => {
            const isExpanded = expandedTracks.has(trackName)
            const isPanel = trackSessions.some(isPanelDiscussion)
            const timeRange = getTrackTimeRange(trackSessions)
            const trackColor = track?.color || "#3B82F6"

            // Get chairpersons from track
            const trackChairpersons = track?.chairpersons
              ? extractNames(track.chairpersons)
              : []

            return (
              <div key={trackName} className={cn("rounded-xl overflow-hidden", themeConfig.card)}>
                {/* Track Header - Clickable */}
                <button
                  onClick={() => toggleTrack(trackName)}
                  className="w-full text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center p-4">
                    <span
                      className="w-1 h-12 rounded-full mr-4"
                      style={{ backgroundColor: trackColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-gray-900">{trackName}</h3>
                        <Badge variant="secondary" className="bg-gray-100">
                          {trackSessions.length} session{trackSessions.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      {track?.description && (
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{track.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{timeRange}</p>
                        <p className="text-xs text-gray-500">Time Range</p>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t">
                    {/* Column Headers */}
                    <div className={cn("text-xs font-medium uppercase tracking-wider", themeConfig.cardHeader, theme === "classic" ? "text-white" : themeConfig.textMuted)}>
                      <div className="flex px-4 py-3">
                        <div className="w-32">Time</div>
                        <div className="flex-1">Topic</div>
                        <div className="w-48">{isPanel ? "Moderator" : "Speaker"}</div>
                        <div className="w-48">{isPanel ? "Panelists" : "Chairperson"}</div>
                      </div>
                    </div>

                    {/* Session Rows */}
                    {trackSessions.map((session, idx) => {
                      const isSessionPanel = isPanelDiscussion(session)

                      // Rotate chairpersons for each row
                      const chairpersonForRow = trackChairpersons.length > 0
                        ? trackChairpersons[idx % trackChairpersons.length]
                        : session.chairpersons || ""

                      return (
                        <div
                          key={session.id}
                          className={cn(
                            "flex px-4 py-3 text-sm border-t",
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          )}
                        >
                          {/* Time */}
                          <div className="w-32 font-medium text-gray-900">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-gray-400" />
                              {formatTime(session.start_time)} - {formatTime(session.end_time)}
                            </div>
                          </div>

                          {/* Topic */}
                          <div className="flex-1 text-gray-800 font-medium pr-4">
                            {session.session_name}
                          </div>

                          {/* Speaker/Moderator */}
                          <div className="w-48 text-gray-600">
                            {isSessionPanel ? session.moderators : session.speakers}
                          </div>

                          {/* Chairperson/Panelists */}
                          <div className="w-48 text-gray-600">
                            {isSessionPanel ? (
                              <div className="text-xs leading-relaxed">
                                {session.speakers?.split(",").map((p, i) => (
                                  <span key={i} className="inline-block mr-1">{p.trim()}{i < (session.speakers?.split(",").length || 0) - 1 ? "," : ""}</span>
                                ))}
                              </div>
                            ) : (
                              chairpersonForRow
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Empty State */}
        {Object.keys(sessionsByTrack).length === 0 && (
          <div className={cn("text-center py-16 rounded-xl", themeConfig.card)}>
            <Search className={cn("h-12 w-12 mx-auto mb-4", themeConfig.textMuted)} />
            <h3 className={cn("text-lg font-medium mb-2", themeConfig.text)}>No sessions found</h3>
            <p className={themeConfig.textMuted}>
              {searchQuery
                ? "Try adjusting your search query"
                : "No sessions available for this day and hall"}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
