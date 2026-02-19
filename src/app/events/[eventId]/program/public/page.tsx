"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Download,
  HelpCircle,
  Calendar,
  CalendarPlus,
  MapPin,
  Clock,
  User,
  Users,
  Search,
  ChevronRight,
  Mic2,
  Video,
  MessageSquare,
  Award,
  Filter,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { exportSessionsToCalendar } from "@/lib/calendar-export"

type Session = {
  id: string
  session_name: string
  session_type: string
  session_date: string
  start_time: string
  end_time: string
  duration_minutes: number | null
  hall: string | null
  description: string | null
  specialty_track: string | null
  speakers?: string | null
  speakers_text?: string | null  // With contact details
  chairpersons?: string | null
  chairpersons_text?: string | null  // With contact details
  moderators?: string | null
  moderators_text?: string | null  // With contact details
}

type Track = {
  id: string
  name: string
  description: string | null
  chairpersons: string | null
  color: string | null
}

type Event = {
  id: string
  name: string
  event_number: string | null
  short_name: string | null
  tagline: string | null
  start_date: string
  end_date: string
  venue_name: string | null
  city: string | null
  logo_url: string | null
  settings: {
    public_page?: PublicPageSettings
  } | null
}

type PublicPageSettings = {
  theme?: "modern" | "classic" | "dark" | "minimal"
  show_tracks?: boolean
  tracks?: Array<{ id: string; name: string; color: string; description: string }>
  show_exam_details?: boolean
  exam_theory?: { questions: number; marks: number; duration_minutes: number; negative_marking: boolean }
  exam_practical?: Array<{ id: string; name: string; marks: number }>
  show_faq?: boolean
  faqs?: Array<{ id: string; question: string; answer: string }>
  footer_text?: string
}

// Hall colors for visual distinction
const HALL_COLORS: Record<string, { bg: string; text: string; border: string; light: string }> = {
  "red": { bg: "bg-red-600", text: "text-red-700", border: "border-red-200", light: "bg-red-50" },
  "green": { bg: "bg-green-600", text: "text-green-700", border: "border-green-200", light: "bg-green-50" },
  "blue": { bg: "bg-blue-600", text: "text-blue-700", border: "border-blue-200", light: "bg-blue-50" },
  "yellow": { bg: "bg-amber-500", text: "text-amber-700", border: "border-amber-200", light: "bg-amber-50" },
  "conference": { bg: "bg-purple-600", text: "text-purple-700", border: "border-purple-200", light: "bg-purple-50" },
  "lecture": { bg: "bg-indigo-600", text: "text-indigo-700", border: "border-indigo-200", light: "bg-indigo-50" },
  "default": { bg: "bg-gray-600", text: "text-gray-700", border: "border-gray-200", light: "bg-gray-50" },
}

const getHallColor = (hall: string | null) => {
  if (!hall) return HALL_COLORS.default
  const h = hall.toLowerCase()
  if (h.includes("red")) return HALL_COLORS.red
  if (h.includes("green")) return HALL_COLORS.green
  if (h.includes("blue")) return HALL_COLORS.blue
  if (h.includes("yellow")) return HALL_COLORS.yellow
  if (h.includes("conference")) return HALL_COLORS.conference
  if (h.includes("lecture")) return HALL_COLORS.lecture
  return HALL_COLORS.default
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
    card: "bg-gray-900 border-gray-800 text-white",
    cardHeader: "bg-gray-800 text-white",
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

const getSessionIcon = (sessionName: string, sessionType: string | null) => {
  const name = (sessionName || "").toLowerCase()
  const _type = (sessionType || "").toLowerCase()

  if (name.includes("panel") || name.includes("debate")) return MessageSquare
  if (name.includes("live") || name.includes("video")) return Video
  if (name.includes("award") || name.includes("inaug")) return Award
  if (name.includes("keynote") || name.includes("oration")) return Mic2
  return null
}

export default function PublicProgramPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedHalls, setSelectedHalls] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [groupBy, setGroupBy] = useState<"hall" | "track">("track") // Default to track view

  // Helper to extract just names from formatted string "Name (email, phone) | Name2 (email, phone)"
  const extractNames = (formatted: string | null | undefined) => {
    if (!formatted) return []
    return formatted.split(" | ").map(p => p.split("(")[0].trim())
  }

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, event_number, short_name, tagline, start_date, end_date, venue_name, city, logo_url, settings")
        .eq("id", eventId)
        .single()
      return data as Event | null
    },
  })

  // Fetch sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions", eventId],
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

  // Fetch tracks with metadata
  const { data: tracks } = useQuery({
    queryKey: ["tracks", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tracks")
        .select("*")
        .eq("event_id", eventId)
        .order("name")
      return (data || []) as Track[]
    },
  })

  // Fetch faculty assignments (for panelists)
  const { data: assignments } = useQuery({
    queryKey: ["assignments-public", eventId],
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

  // Get unique dates
  const dates = useMemo(() => {
    if (!sessions) return []
    const uniqueDates = [...new Set(sessions.map(s => s.session_date))].sort()
    return uniqueDates
  }, [sessions])

  // Group dates into phases (Online / Onsite / Examination) based on session content
  const datePhases = useMemo(() => {
    if (!sessions || dates.length === 0) return []

    type Phase = { label: string; dates: string[]; color: string; activeColor: string }
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
      let color: string
      let activeColor: string
      if (hasExam) {
        phaseLabel = "Examination"
        color = "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
        activeColor = "bg-emerald-600 text-white shadow-lg"
      } else if (hasOnline) {
        phaseLabel = "Online Lectures"
        color = "bg-purple-100 text-purple-700 hover:bg-purple-200"
        activeColor = "bg-purple-600 text-white shadow-lg"
      } else {
        phaseLabel = "Onsite Sessions"
        color = "bg-blue-100 text-blue-700 hover:bg-blue-200"
        activeColor = "bg-blue-600 text-white shadow-lg"
      }

      if (!currentPhase || currentPhase.label !== phaseLabel) {
        currentPhase = { label: phaseLabel, dates: [date], color, activeColor }
        phases.push(currentPhase)
      } else {
        currentPhase.dates.push(date)
      }
    }

    return phases
  }, [sessions, dates])

  // Get unique halls
  const halls = useMemo(() => {
    if (!sessions) return []
    const uniqueHalls = [...new Set(sessions.map(s => s.hall).filter(Boolean))] as string[]
    return uniqueHalls.sort()
  }, [sessions])

  // Set default day
  useMemo(() => {
    if (dates.length > 0 && !selectedDay) {
      setSelectedDay(dates[0])
    }
  }, [dates, selectedDay])

  // Helper: check if session is a metadata row (moderator/chairperson assignments)
  const isMetaSession = (s: Session) => {
    const name = (s.session_name || "").toLowerCase()
    return name.startsWith("session moderator") || name.startsWith("session chairperson")
  }

  // Filter sessions
  const filteredSessions = useMemo(() => {
    if (!sessions) return []

    return sessions.filter(session => {
      // Exclude meta sessions (moderator/chairperson rows) - shown in track header instead
      if (isMetaSession(session)) return false
      // Exclude "Session Chair" track (metadata only)
      if (session.specialty_track === "Session Chair") return false
      // Exclude hall coordinator rows
      const sessionName = (session.session_name || "").toLowerCase().trim()
      if (/^hall\s*[a-z0-9]?$/i.test(sessionName)) return false
      if (/^(red|green|blue|yellow|main|conference)\s*hall/i.test(sessionName)) return false

      // Filter by day
      if (selectedDay && session.session_date !== selectedDay) return false

      // Filter by halls
      if (selectedHalls.length > 0 && session.hall && !selectedHalls.includes(session.hall)) return false

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = session.session_name?.toLowerCase().includes(query)
        const matchesSpeakers = session.speakers?.toLowerCase().includes(query)
        const matchesChairs = session.chairpersons?.toLowerCase().includes(query)
        const matchesDesc = session.description?.toLowerCase().includes(query)
        if (!matchesName && !matchesSpeakers && !matchesChairs && !matchesDesc) return false
      }

      return true
    })
  }, [sessions, selectedDay, selectedHalls, searchQuery])

  // Get moderator/chairperson info for the selected day from meta sessions
  const dayMeta = useMemo(() => {
    if (!sessions || !selectedDay) return { moderator: "", chairpersons: "" }
    const daySessions = sessions.filter(s => s.session_date === selectedDay)
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
  }, [sessions, selectedDay])

  // Group sessions by hall for the selected day
  const sessionsByHall = useMemo(() => {
    const grouped: Record<string, Session[]> = {}
    filteredSessions.forEach(session => {
      const hall = session.hall || "Other"
      if (!grouped[hall]) grouped[hall] = []
      grouped[hall].push(session)
    })
    return grouped
  }, [filteredSessions])

  // Export to calendar
  const handleExportCalendar = () => {
    if (!sessions || !event) return
    const calendarSessions = sessions.map(s => ({
      id: s.id,
      title: s.session_name,
      description: s.description || undefined,
      start_time: `${s.session_date}T${s.start_time}`,
      end_time: `${s.session_date}T${s.end_time}`,
      hall: s.hall ? { name: s.hall } : null,
      speakers: s.speakers ? s.speakers.split(",").map(name => ({ name: name.trim() })) : null,
    }))
    exportSessionsToCalendar(calendarSessions, event.name)
  }

  // Group sessions by track for the selected day
  const sessionsByTrack = useMemo(() => {
    const grouped: Record<string, { track: Track | null; sessions: Session[] }> = {}
    filteredSessions.forEach(session => {
      const trackName = session.specialty_track || "Other"
      if (!grouped[trackName]) {
        // Find track metadata
        const trackData = tracks?.find(t => t.name === trackName) || null
        grouped[trackName] = { track: trackData, sessions: [] }
      }
      grouped[trackName].sessions.push(session)
    })
    return grouped
  }, [filteredSessions, tracks])

  // Stats
  const stats = useMemo(() => {
    if (!sessions) return { totalSessions: 0, totalSpeakers: 0, totalDays: 0, totalHalls: 0 }

    const speakerSet = new Set<string>()
    sessions.forEach(s => {
      if (s.speakers) {
        s.speakers.split(",").forEach(sp => speakerSet.add(sp.trim()))
      }
    })

    return {
      totalSessions: sessions.length,
      totalSpeakers: speakerSet.size,
      totalDays: dates.length,
      totalHalls: halls.length,
    }
  }, [sessions, dates, halls])

  const publicSettings = event?.settings?.public_page
  const theme = publicSettings?.theme || "modern"
  const themeConfig = THEME_CONFIG[theme]

  const formatTime = (time: string) => {
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

  const toggleHall = (hall: string) => {
    setSelectedHalls(prev =>
      prev.includes(hall) ? prev.filter(h => h !== hall) : [...prev, hall]
    )
  }

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
      {/* Hero Header */}
      <header className={themeConfig.header}>
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              {event?.logo_url && (
                <img src={event.logo_url} alt="" className="h-16 w-16 rounded-lg bg-white p-1" />
              )}
              <div>
                <h1 className="text-2xl md:text-4xl font-bold">
                  {event?.short_name || event?.name || "Conference Program"}
                </h1>
                {event?.tagline && (
                  <p className={cn("mt-1", themeConfig.headerText)}>{event.tagline}</p>
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
              <Button
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={handleExportCalendar}
              >
                <CalendarPlus className="h-4 w-4 mr-2" />
                Add to Calendar
              </Button>
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" asChild>
                <a href={`/events/${eventId}/program/print`} target="_blank">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </a>
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className={cn("backdrop-blur rounded-xl p-4 text-center", theme === "classic" ? "bg-[#1B6B93]/20" : "bg-white/10")}>
              <p className="text-2xl sm:text-3xl font-bold">{stats.totalDays}</p>
              <p className={cn("text-sm", themeConfig.headerText)}>Days</p>
            </div>
            <div className={cn("backdrop-blur rounded-xl p-4 text-center", theme === "classic" ? "bg-[#1B6B93]/20" : "bg-white/10")}>
              <p className="text-2xl sm:text-3xl font-bold">{stats.totalSessions}</p>
              <p className={cn("text-sm", themeConfig.headerText)}>Sessions</p>
            </div>
            <div className={cn("backdrop-blur rounded-xl p-4 text-center", theme === "classic" ? "bg-[#1B6B93]/20" : "bg-white/10")}>
              <p className="text-2xl sm:text-3xl font-bold">{stats.totalSpeakers}</p>
              <p className={cn("text-sm", themeConfig.headerText)}>Speakers</p>
            </div>
            <div className={cn("backdrop-blur rounded-xl p-4 text-center", theme === "classic" ? "bg-[#1B6B93]/20" : "bg-white/10")}>
              <p className="text-2xl sm:text-3xl font-bold">{stats.totalHalls}</p>
              <p className={cn("text-sm", themeConfig.headerText)}>Halls</p>
            </div>
          </div>
        </div>
      </header>

      {/* Configurable Tracks Section */}
      {publicSettings?.show_tracks && publicSettings.tracks && publicSettings.tracks.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Conference Tracks</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicSettings.tracks.map((track) => {
              const colorMap: Record<string, string> = {
                blue: "bg-blue-600",
                pink: "bg-pink-600",
                purple: "bg-purple-600",
                green: "bg-green-600",
                orange: "bg-orange-600",
                amber: "bg-amber-600",
              }
              return (
                <div key={track.id} className={`${colorMap[track.color] || "bg-gray-600"} text-white rounded-xl p-5`}>
                  <h3 className="font-bold text-lg">{track.name}</h3>
                  <p className="text-white/80 text-sm mt-1">{track.description}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Day Tabs & Filters */}
      <div className={cn("sticky top-0 z-40", themeConfig.nav)}>
        <div className="max-w-7xl mx-auto px-4">
          {/* Day tabs grouped by phase */}
          <div className="flex items-center gap-2 py-3 overflow-x-auto scrollbar-hide">
            {datePhases.map((phase, phaseIdx) => (
              <div key={phase.label} className="flex items-center gap-2">
                {phaseIdx > 0 && <div className="w-px h-8 bg-gray-300 mx-1" />}
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap mr-1">
                  {phase.label}
                </span>
                {phase.dates.map((date, dayIdx) => (
                  <button
                    key={date}
                    onClick={() => setSelectedDay(date)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                      selectedDay === date ? phase.activeColor : phase.color
                    )}
                  >
                    {phase.dates.length > 1 ? `Day ${dayIdx + 1}` : formatDate(date)}
                    <span className="ml-1.5 text-xs opacity-75">{phase.dates.length > 1 ? formatDate(date) : ""}</span>
                  </button>
                ))}
              </div>
            ))}

            <div className="flex-1" />

            {/* Search & Filter */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search sessions, speakers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-48 md:w-64"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>
              {/* Group By Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setGroupBy("track")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    groupBy === "track" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  By Track
                </button>
                <button
                  onClick={() => setGroupBy("hall")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    groupBy === "hall" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  By Hall
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(selectedHalls.length > 0 && "border-blue-500 text-blue-600")}
              >
                <Filter className="h-4 w-4 mr-1" />
                Halls
                {selectedHalls.length > 0 && (
                  <Badge className="ml-1.5 h-5 px-1.5">{selectedHalls.length}</Badge>
                )}
              </Button>
            </div>
          </div>

          {/* Hall filters */}
          {showFilters && (
            <div className="pb-3 flex flex-wrap gap-2">
              {halls.map((hall) => {
                const colors = getHallColor(hall)
                const isSelected = selectedHalls.includes(hall)
                return (
                  <button
                    key={hall}
                    onClick={() => toggleHall(hall)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                      isSelected
                        ? `${colors.bg} text-white`
                        : `${colors.light} ${colors.text} ${colors.border} border`
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", isSelected ? "bg-white" : colors.bg)} />
                    {hall}
                  </button>
                )
              })}
              {selectedHalls.length > 0 && (
                <button
                  onClick={() => setSelectedHalls([])}
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sessions Grid */}
      <section className="max-w-7xl mx-auto px-4 py-6">
        {selectedDay && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {formatFullDate(selectedDay)}
            </h2>
            <p className="text-sm text-gray-500">
              {filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""}
              {selectedHalls.length > 0 && ` in ${selectedHalls.length} hall${selectedHalls.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        )}

        {/* Sessions - Group by Track or Hall */}
        <div className="space-y-6">
          {groupBy === "track" ? (
            // Group by Track View
            Object.entries(sessionsByTrack).map(([trackName, { track, sessions: trackSessions }]) => {
              const trackColor = track?.color || "#3B82F6"
              return (
                <div key={trackName} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  {/* Session Header with Moderator & Chairpersons */}
                  <div className="px-4 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                    <div className="flex items-start gap-3">
                      <span
                        className="w-4 h-4 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: trackColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Session</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-xl text-gray-900">{trackName}</h3>
                          <Badge variant="secondary" className="bg-white">
                            {trackSessions.length} topic{trackSessions.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        {/* Session Description/Title */}
                        {track?.description && (
                          <p className="text-gray-700 mt-1 text-base font-medium">{track.description}</p>
                        )}
                        {/* Moderator & Chairpersons */}
                        {(dayMeta.moderator || track?.chairpersons || dayMeta.chairpersons) && (
                          <div className="mt-3 p-2 bg-white/60 rounded-lg space-y-1">
                            {dayMeta.moderator && (
                              <p className="text-sm text-gray-800 flex items-center gap-2">
                                <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                <span><span className="font-semibold">Moderator:</span> {dayMeta.moderator}</span>
                              </p>
                            )}
                            {(track?.chairpersons || dayMeta.chairpersons) && (
                              <p className="text-sm text-gray-800 flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                <span><span className="font-semibold">Chairpersons:</span> {track?.chairpersons ? extractNames(track.chairpersons).join(", ") : dayMeta.chairpersons}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Individual Topics */}
                  <div className="divide-y">
                    {trackSessions.map((session) => {
                      const SessionIcon = getSessionIcon(session.session_name, session.session_type)
                      const isPanelSession = trackName.toLowerCase().includes("panel") || trackName.toLowerCase().includes("discussion")
                      const panelists: string[] = []
                      return (
                        <div
                          key={session.id}
                          className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => setSelectedSession(session)}
                        >
                          <div className="flex items-start gap-4">
                            {/* Time */}
                            <div className="text-sm text-gray-500 min-w-[140px] whitespace-nowrap">
                              <p className="font-medium">{formatTime(session.start_time)}</p>
                              <p>{formatTime(session.end_time)}</p>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2">
                                {SessionIcon && (
                                  <SessionIcon className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
                                )}
                                <div className="flex-1">
                                  {/* Topic */}
                                  <p className="text-xs font-medium text-gray-400 uppercase">Topic</p>
                                  <h4 className="font-medium text-gray-900 line-clamp-2">
                                    {session.session_name}
                                  </h4>

                                  {/* Speaker - Names only (no contact details in public view) */}
                                  {session.speakers && (
                                    <div className="mt-2">
                                      <p className="text-xs font-medium text-gray-400 uppercase">Speaker</p>
                                      <p className="text-sm text-gray-700 flex items-center gap-1">
                                        <User className="h-3.5 w-3.5 text-gray-500" />
                                        {session.speakers}
                                      </p>
                                    </div>
                                  )}

                                  {/* Panel Discussion details */}
                                  {isPanelSession && (
                                    <div className="mt-2 space-y-2">
                                      {session.moderators && (
                                        <div>
                                          <p className="text-xs font-medium text-gray-400 uppercase">Moderator</p>
                                          <p className="text-sm text-gray-700">{session.moderators}</p>
                                        </div>
                                      )}
                                      {panelists.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-gray-400 uppercase">Panelists</p>
                                          <div className="flex flex-wrap gap-1.5 mt-1">
                                            {panelists.map((name, i) => (
                                              <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-700">
                                                {name}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Hall */}
                                  {session.hall && (
                                    <Badge variant="outline" className="mt-2 text-xs">
                                      <MapPin className="h-3 w-3 mr-1" />
                                      {session.hall}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          ) : (
            // Group by Hall View (Original)
            Object.entries(sessionsByHall).map(([hall, hallSessions]) => {
              const colors = getHallColor(hall)
              return (
                <div key={hall} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  {/* Hall Header */}
                  <div className={cn("px-4 py-3 flex items-center gap-3", colors.light)}>
                    <span className={cn("w-3 h-3 rounded-full", colors.bg)} />
                    <h3 className={cn("font-semibold", colors.text)}>{hall}</h3>
                    <Badge variant="secondary" className="ml-auto">
                      {hallSessions.length} session{hallSessions.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  {/* Sessions */}
                  <div className="divide-y">
                    {hallSessions.map((session) => {
                      const SessionIcon = getSessionIcon(session.session_name, session.session_type)
                      return (
                        <div
                          key={session.id}
                          className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => setSelectedSession(session)}
                        >
                          <div className="flex items-start gap-4">
                            {/* Time */}
                            <div className="text-sm text-gray-500 min-w-[140px] whitespace-nowrap">
                              <p className="font-medium">{formatTime(session.start_time)}</p>
                              <p>{formatTime(session.end_time)}</p>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2">
                                {SessionIcon && (
                                  <SessionIcon className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
                                )}
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900 line-clamp-2">
                                    {session.session_name}
                                  </h4>

                                  {/* Speakers */}
                                  {session.speakers && (
                                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                                      <User className="h-3.5 w-3.5" />
                                      <span className="line-clamp-1">{session.speakers}</span>
                                    </p>
                                  )}

                                  {/* Chairpersons */}
                                  {session.chairpersons && (
                                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      <span className="line-clamp-1">Chair: {session.chairpersons}</span>
                                    </p>
                                  )}

                                  {/* Duration */}
                                  {session.duration_minutes && (
                                    <Badge variant="outline" className="mt-2 text-xs">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {session.duration_minutes} min
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {filteredSessions.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border">
            <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No sessions found</h3>
            <p className="text-gray-500">Try adjusting your filters or search query</p>
          </div>
        )}
      </section>

      {/* Examination Section (Configurable) */}
      {publicSettings?.show_exam_details && publicSettings.exam_theory && (
        <section className="max-w-7xl mx-auto px-4 pb-8">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
            <h2 className="text-xl font-bold text-green-800 mb-4 flex items-center gap-2">
              <Award className="h-5 w-5" />
              Examination Details
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-green-700 mb-2">Theory Examination</h3>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>{publicSettings.exam_theory.questions} MCQ Questions - {publicSettings.exam_theory.marks} Marks</li>
                  <li>{publicSettings.exam_theory.negative_marking ? "Negative marking applies" : "No Negative Marking"}</li>
                  <li>Duration: {publicSettings.exam_theory.duration_minutes} minutes</li>
                </ul>
              </div>
              {publicSettings.exam_practical && publicSettings.exam_practical.length > 0 && (
                <div>
                  <h3 className="font-semibold text-green-700 mb-2">Practical Assessment</h3>
                  <ul className="text-sm text-green-800 space-y-1">
                    {publicSettings.exam_practical.map((comp) => (
                      <li key={comp.id}>{comp.name} - {comp.marks} Marks</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section (Configurable) */}
      {publicSettings?.show_faq && publicSettings.faqs && publicSettings.faqs.length > 0 && (
        <section id="faq" className="max-w-7xl mx-auto px-4 pb-12">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="bg-white rounded-xl shadow-sm border">
            {publicSettings.faqs.map((faq, index) => (
              <AccordionItem key={faq.id} value={`faq-${index}`} className="border-b last:border-0">
                <AccordionTrigger className="px-6 hover:no-underline text-gray-800 font-medium text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 text-gray-600">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-400 text-sm">
            {publicSettings?.footer_text || `${event?.name || "Conference"} - Powered by AMASI`}
          </p>
        </div>
      </footer>

      {/* Session Detail Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedSession && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl pr-8">{selectedSession.session_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {/* Time & Hall */}
                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline" className="text-sm">
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    {formatTime(selectedSession.start_time)} - {formatTime(selectedSession.end_time)}
                  </Badge>
                  {selectedSession.hall && (
                    <Badge className={cn(getHallColor(selectedSession.hall).bg, "text-white")}>
                      <MapPin className="h-3.5 w-3.5 mr-1" />
                      {selectedSession.hall}
                    </Badge>
                  )}
                  {selectedSession.duration_minutes && (
                    <Badge variant="secondary">
                      {selectedSession.duration_minutes} minutes
                    </Badge>
                  )}
                </div>

                {/* Description */}
                {selectedSession.description && (
                  <p className="text-gray-600">{selectedSession.description}</p>
                )}

                {/* Speakers */}
                {selectedSession.speakers && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Speaker{selectedSession.speakers.includes(",") ? "s" : ""}
                    </h4>
                    <div className="space-y-2">
                      {selectedSession.speakers.split(",").map((speaker, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <span className="font-medium">{speaker.trim()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chairpersons */}
                {selectedSession.chairpersons && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Chairperson{selectedSession.chairpersons.includes(",") ? "s" : ""}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedSession.chairpersons.split(",").map((chair, i) => (
                        <Badge key={i} variant="outline" className="py-1.5">
                          {chair.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Moderators */}
                {selectedSession.moderators && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <Mic2 className="h-4 w-4" />
                      Moderator{selectedSession.moderators.includes(",") ? "s" : ""}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedSession.moderators.split(",").map((mod, i) => (
                        <Badge key={i} variant="secondary" className="py-1.5">
                          {mod.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
