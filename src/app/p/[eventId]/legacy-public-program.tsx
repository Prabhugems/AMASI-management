"use client"

import { useState, useMemo, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
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
  HelpCircle,
  Calendar,
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
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { COMPANY_CONFIG } from "@/lib/config"

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
  speakers_text?: string | null
  chairpersons?: string | null
  chairpersons_text?: string | null
  moderators?: string | null
  moderators_text?: string | null
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
  slug: string | null
  event_number: string | null
  short_name: string | null
  edition: number | null
  tagline: string | null
  start_date: string
  end_date: string
  venue_name: string | null
  city: string | null
  logo_url: string | null
  banner_url: string | null
  primary_color: string | null
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

const DEFAULT_ACCENT = "#0f766e"

// Append an 8-bit alpha to a 6-digit hex (e.g. tint("#10b981","1f")). Pass-through otherwise.
const withAlpha = (hex: string, alpha: string) =>
  /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alpha}` : hex

const hashStr = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// Soft, deterministic avatar palette so each speaker gets a stable colour.
const AVATAR_COLORS = [
  { bg: "#e0f2fe", text: "#075985" },
  { bg: "#dcfce7", text: "#166534" },
  { bg: "#fae8ff", text: "#86198f" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#ffe4e6", text: "#9f1239" },
  { bg: "#ede9fe", text: "#5b21b6" },
  { bg: "#cffafe", text: "#155e75" },
  { bg: "#fee2e2", text: "#991b1b" },
]
const avatarColor = (name: string) => AVATAR_COLORS[hashStr(name) % AVATAR_COLORS.length]

const getInitials = (name: string) => {
  const parts = name.replace(/^dr\.?\s*/i, "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase()
}

// Use alternation, not a bracketed character class, to strip a leading "Venue -"
// prefix — a colon inside square brackets trips Tailwind's JIT class scanner.
const cleanVenue = (v: string | null | undefined) =>
  (v || "").replace(/^\s*venue\s*(?:[-–]|:)\s*/i, "").trim()

// Hall accent chips (used only for the hall filter + modal tag)
const HALL_COLORS: Record<string, { bg: string; text: string; border: string; light: string }> = {
  red: { bg: "bg-rose-600", text: "text-rose-700", border: "border-rose-200", light: "bg-rose-50" },
  green: { bg: "bg-emerald-600", text: "text-emerald-700", border: "border-emerald-200", light: "bg-emerald-50" },
  blue: { bg: "bg-sky-600", text: "text-sky-700", border: "border-sky-200", light: "bg-sky-50" },
  yellow: { bg: "bg-amber-500", text: "text-amber-700", border: "border-amber-200", light: "bg-amber-50" },
  conference: { bg: "bg-violet-600", text: "text-violet-700", border: "border-violet-200", light: "bg-violet-50" },
  lecture: { bg: "bg-indigo-600", text: "text-indigo-700", border: "border-indigo-200", light: "bg-indigo-50" },
  default: { bg: "bg-slate-600", text: "text-slate-700", border: "border-slate-200", light: "bg-slate-50" },
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

const getSessionIcon = (sessionName: string, sessionType: string | null) => {
  const name = (sessionName || "").toLowerCase()
  const _type = (sessionType || "").toLowerCase()
  if (name.includes("panel") || name.includes("debate")) return MessageSquare
  if (name.includes("live") || name.includes("video")) return Video
  if (name.includes("award") || name.includes("inaug")) return Award
  if (name.includes("keynote") || name.includes("oration")) return Mic2
  return null
}

// Small initials avatar used in lists + modal
function SpeakerAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const c = avatarColor(name)
  const dim = size === "md" ? "h-9 w-9 text-[0.7rem]" : "h-7 w-7 text-[0.62rem]"
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-full font-bold ring-2 ring-white shrink-0", dim)}
      style={{ backgroundColor: c.bg, color: c.text }}
      aria-hidden
    >
      {getInitials(name)}
    </span>
  )
}

function SpeakerLine({ names }: { names: string[] }) {
  if (names.length === 0) return null
  const shown = names.slice(0, 3)
  return (
    <div className="mt-2.5 flex items-center gap-2">
      <span className="flex -space-x-1.5">
        {shown.map((n, i) => (
          <SpeakerAvatar key={i} name={n} />
        ))}
      </span>
      <span className="text-sm text-slate-600 leading-snug">
        {names.join(", ")}
      </span>
    </div>
  )
}

export default function LegacyPublicProgram() {
  const params = useParams()
  const eventId = params.eventId as string

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedHalls, setSelectedHalls] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [groupBy, setGroupBy] = useState<"hall" | "track">("track")

  const extractNames = (formatted: string | null | undefined) => {
    if (!formatted) return []
    return formatted.split(" | ").map((p) => p.split("(")[0].trim()).filter(Boolean)
  }
  const splitNames = (s: string | null | undefined) =>
    (s || "").split(",").map((p) => p.trim()).filter(Boolean)

  const { data: programData, isLoading } = useQuery({
    queryKey: ["public-program", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/public/program/${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch program")
      return res.json() as Promise<{ event: Event; sessions: Session[]; tracks: Track[] }>
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const event = programData?.event
  const sessions = programData?.sessions || []
  const tracks = programData?.tracks || []

  const accent = event?.primary_color && /^#[0-9a-fA-F]{6}$/.test(event.primary_color)
    ? event.primary_color
    : DEFAULT_ACCENT

  // Set the document title to the event name (was a generic app title before).
  useEffect(() => {
    if (event?.name) document.title = `${event.name} · Programme`
  }, [event?.name])

  const dates = useMemo(() => {
    if (!sessions) return []
    return [...new Set(sessions.map((s) => s.session_date))].sort()
  }, [sessions])

  const halls = useMemo(() => {
    if (!sessions) return []
    return ([...new Set(sessions.map((s) => s.hall).filter(Boolean))] as string[]).sort()
  }, [sessions])

  useMemo(() => {
    if (dates.length > 0 && !selectedDay) setSelectedDay(dates[0])
  }, [dates, selectedDay])

  const filteredSessions = useMemo(() => {
    if (!sessions) return []
    return sessions.filter((session) => {
      const sessionName = (session.session_name || "").toLowerCase().trim()
      if (/^hall\s*[a-z0-9]?$/i.test(sessionName)) return false
      if (/^(red|green|blue|yellow|main|conference)\s*hall/i.test(sessionName)) return false
      if (selectedDay && session.session_date !== selectedDay) return false
      if (selectedHalls.length > 0 && session.hall && !selectedHalls.includes(session.hall)) return false
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

  const sessionsByHall = useMemo(() => {
    const grouped: Record<string, Session[]> = {}
    filteredSessions.forEach((session) => {
      const hall = session.hall || "Other"
      if (!grouped[hall]) grouped[hall] = []
      grouped[hall].push(session)
    })
    return grouped
  }, [filteredSessions])

  const sessionsByTrack = useMemo(() => {
    const grouped: Record<string, { track: Track | null; sessions: Session[] }> = {}
    filteredSessions.forEach((session) => {
      const trackName = session.specialty_track || "Other"
      if (!grouped[trackName]) {
        const trackData = tracks?.find((t) => t.name === trackName) || null
        grouped[trackName] = { track: trackData, sessions: [] }
      }
      grouped[trackName].sessions.push(session)
    })
    return grouped
  }, [filteredSessions, tracks])

  const stats = useMemo(() => {
    if (!sessions) return { totalSessions: 0, totalSpeakers: 0, totalDays: 0, totalHalls: 0 }
    const speakerSet = new Set<string>()
    sessions.forEach((s) => {
      if (s.speakers) s.speakers.split(",").forEach((sp) => speakerSet.add(sp.trim()))
    })
    return {
      totalSessions: sessions.length,
      totalSpeakers: speakerSet.size,
      totalDays: dates.length,
      totalHalls: halls.length,
    }
  }, [sessions, dates, halls])

  const publicSettings = event?.settings?.public_page

  const formatTime = (time: string) => {
    if (!time) return ""
    const [hours, minutes] = time.split(":")
    const h = parseInt(hours)
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
  const formatFullDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start)
    const e = new Date(end)
    return `${s.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
  }

  const toggleHall = (hall: string) =>
    setSelectedHalls((prev) => (prev.includes(hall) ? prev.filter((h) => h !== hall) : [...prev, hall]))

  const registerHref = `/register/${event?.slug || eventId}`
  const titleText = event?.short_name || event?.name || "Conference Programme"
  // Big decorative edition number, derived from the event short name/name.
  const editionNum = (event?.short_name || event?.name || "").match(/\d{2,4}/)?.[0] || null
  const monogram = editionNum || (event?.short_name || event?.name || "AM").replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase()

  const statItems = [
    { label: "Days", value: stats.totalDays },
    { label: "Sessions", value: stats.totalSessions },
    { label: "Faculty", value: stats.totalSpeakers },
    { label: "Halls", value: stats.totalHalls },
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="h-[320px] bg-slate-900 animate-pulse" />
        <div className="max-w-6xl mx-auto px-4 -mt-12">
          <div className="h-24 bg-white rounded-2xl shadow-lg animate-pulse" />
          <div className="mt-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-white rounded-2xl border animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      {/* ===== Hero ===== */}
      <header className="relative overflow-hidden bg-slate-950">
        {event?.banner_url && (
          <img src={event.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        )}
        {/* brand-colour glows */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(70% 90% at 88% -20%, ${withAlpha(accent, "66")}, transparent 60%), radial-gradient(60% 70% at -10% 120%, ${withAlpha(accent, "30")}, transparent 55%)`,
          }}
        />
        {/* dot texture */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        {/* giant edition monogram */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 select-none font-black leading-none tracking-tighter sm:block"
          style={{ fontSize: "18rem", color: "#ffffff", opacity: 0.04 }}
        >
          {monogram}
        </span>

        <div className="relative max-w-6xl mx-auto px-4 pt-12 pb-24 sm:pt-16 sm:pb-28">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              {/* eyebrow */}
              <div className="mb-4 flex items-center gap-3">
                {event?.logo_url ? (
                  <img src={event.logo_url} alt="" className="h-11 w-11 rounded-xl bg-white p-1 object-contain" />
                ) : (
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black text-white ring-1 ring-white/20"
                    style={{ backgroundColor: accent }}
                  >
                    {monogram.slice(0, 3)}
                  </span>
                )}
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-white/60">
                  {COMPANY_CONFIG.name}
                </span>
              </div>

              <h1 className="text-3xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
                {titleText}
              </h1>
              {event?.tagline && (
                <p className="mt-3 max-w-xl text-base text-white/70">{event.tagline}</p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/80">
                {event?.start_date && event?.end_date && (
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" style={{ color: accent }} />
                    {formatDateRange(event.start_date, event.end_date)}
                  </span>
                )}
                {(event?.venue_name || event?.city) && (
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" style={{ color: accent }} />
                    <span className="break-words">
                      {[cleanVenue(event?.venue_name), event?.city].filter(Boolean).join(", ")}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <Button
              asChild
              className="h-12 shrink-0 px-7 text-base font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] hover:opacity-95"
              style={{ backgroundColor: accent }}
            >
              <a href={registerHref}>
                Register Now
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* ===== Stat strip (overlaps hero) ===== */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 -mt-12">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-900/5 sm:grid-cols-4 sm:divide-y-0">
          {statItems.map((s) => (
            <div key={s.label} className="px-6 py-5 text-center">
              <p className="text-3xl font-bold tracking-tight" style={{ color: accent }}>
                {s.value}
              </p>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Configurable Tracks */}
      {publicSettings?.show_tracks && publicSettings.tracks && publicSettings.tracks.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pt-12">
          <h2 className="mb-4 text-lg font-bold text-slate-800">Conference Tracks</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {publicSettings.tracks.map((track) => {
              const colorMap: Record<string, string> = {
                blue: "#2563eb", pink: "#db2777", purple: "#7c3aed",
                green: "#16a34a", orange: "#ea580c", amber: "#d97706",
              }
              const c = colorMap[track.color] || "#475569"
              return (
                <div key={track.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <span className="mb-3 inline-block h-1.5 w-10 rounded-full" style={{ backgroundColor: c }} />
                  <h3 className="text-lg font-bold text-slate-900">{track.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{track.description}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ===== Sticky day tabs + filters ===== */}
      <div className="sticky top-0 z-40 mt-12 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center">
            <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 scrollbar-hide">
              {dates.map((date, index) => {
                const active = selectedDay === date
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDay(date)}
                    className={cn(
                      "flex min-h-[42px] items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-all",
                      active ? "text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                    style={active ? { backgroundColor: accent } : undefined}
                  >
                    Day {index + 1}
                    <span className="ml-1.5 text-xs opacity-70">{formatDate(date)}</span>
                  </button>
                )
              })}
            </div>

            <div className="hidden flex-1 lg:block" />

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 lg:flex-initial">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search sessions, faculty…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border-slate-200 bg-white pl-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-300 lg:w-60"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                )}
              </div>
              <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
                {(["track", "hall"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={cn(
                      "min-h-[34px] rounded-md px-3 text-xs font-medium transition-all",
                      groupBy === g ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                    style={groupBy === g ? { color: accent } : undefined}
                  >
                    {g === "track" ? "By Track" : "By Hall"}
                  </button>
                ))}
              </div>
              {halls.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="min-h-[34px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  style={selectedHalls.length > 0 ? { color: accent, borderColor: accent } : undefined}
                >
                  <Filter className="mr-1 h-4 w-4" />
                  Halls
                  {selectedHalls.length > 0 && <Badge className="ml-1.5 h-5 px-1.5">{selectedHalls.length}</Badge>}
                </Button>
              )}
            </div>
          </div>

          {showFilters && halls.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-3">
              {halls.map((hall) => {
                const colors = getHallColor(hall)
                const isSelected = selectedHalls.includes(hall)
                return (
                  <button
                    key={hall}
                    onClick={() => toggleHall(hall)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                      isSelected ? `${colors.bg} text-white` : `${colors.light} ${colors.text} ${colors.border} border`
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", isSelected ? "bg-white" : colors.bg)} />
                    {hall}
                  </button>
                )
              })}
              {selectedHalls.length > 0 && (
                <button
                  onClick={() => setSelectedHalls([])}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== Sessions ===== */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        {selectedDay && (
          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{formatFullDate(selectedDay)}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""}
              {selectedHalls.length > 0 && ` · ${selectedHalls.length} hall${selectedHalls.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        )}

        <div className="space-y-6">
          {groupBy === "track"
            ? Object.entries(sessionsByTrack).map(([trackName, { track, sessions: trackSessions }]) => {
                const trackColor = track?.color || accent
                const heading = trackName === "Other" ? "Programme" : trackName
                return (
                  <div key={trackName} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                    {/* Track header */}
                    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4" style={{ backgroundColor: withAlpha(typeof trackColor === "string" && trackColor.startsWith("#") ? trackColor : accent, "0d") }}>
                      <span className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: trackColor }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">{heading}</h3>
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                            {trackSessions.length} topic{trackSessions.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {track?.description && <p className="mt-1 text-sm font-medium text-slate-600">{track.description}</p>}
                        {track?.chairpersons && (
                          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                            <Users className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
                            <span className="font-medium text-slate-600">Chairs:</span> {extractNames(track.chairpersons).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {trackSessions.map((session) => {
                        const SessionIcon = getSessionIcon(session.session_name, session.session_type)
                        const speakers = splitNames(session.speakers)
                        return (
                          <button
                            key={session.id}
                            onClick={() => setSelectedSession(session)}
                            className="group flex w-full items-stretch gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                          >
                            {/* time rail */}
                            <div className="flex shrink-0 gap-3">
                              <div className="w-[58px] sm:w-[66px]">
                                <p className="text-sm font-bold text-slate-900">{formatTime(session.start_time)}</p>
                                <p className="text-xs text-slate-400">{formatTime(session.end_time)}</p>
                              </div>
                              <span className="w-0.5 rounded-full" style={{ backgroundColor: withAlpha(accent, "40") }} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                {SessionIcon && <SessionIcon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />}
                                <h4 className="font-semibold leading-snug text-slate-900">{session.session_name}</h4>
                              </div>
                              <SpeakerLine names={speakers} />
                              {session.hall && (
                                <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                                  <MapPin className="h-3 w-3" />
                                  {session.hall}
                                </span>
                              )}
                            </div>

                            <ChevronRight className="h-5 w-5 shrink-0 self-center text-slate-300 transition-transform group-hover:translate-x-0.5" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            : Object.entries(sessionsByHall).map(([hall, hallSessions]) => {
                const colors = getHallColor(hall)
                return (
                  <div key={hall} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                    <div className={cn("flex items-center gap-3 px-5 py-3", colors.light)}>
                      <span className={cn("h-3 w-3 rounded-full", colors.bg)} />
                      <h3 className={cn("font-bold", colors.text)}>{hall === "Other" ? "Programme" : hall}</h3>
                      <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                        {hallSessions.length} session{hallSessions.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {hallSessions.map((session) => {
                        const SessionIcon = getSessionIcon(session.session_name, session.session_type)
                        const speakers = splitNames(session.speakers)
                        const chairs = splitNames(session.chairpersons)
                        return (
                          <button
                            key={session.id}
                            onClick={() => setSelectedSession(session)}
                            className="group flex w-full items-stretch gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                          >
                            <div className="flex shrink-0 gap-3">
                              <div className="w-[58px] sm:w-[66px]">
                                <p className="text-sm font-bold text-slate-900">{formatTime(session.start_time)}</p>
                                <p className="text-xs text-slate-400">{formatTime(session.end_time)}</p>
                              </div>
                              <span className="w-0.5 rounded-full" style={{ backgroundColor: withAlpha(accent, "40") }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                {SessionIcon && <SessionIcon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />}
                                <h4 className="font-semibold leading-snug text-slate-900">{session.session_name}</h4>
                              </div>
                              <SpeakerLine names={speakers} />
                              {chairs.length > 0 && (
                                <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                                  <Users className="h-3 w-3" /> Chair: {chairs.join(", ")}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="h-5 w-5 shrink-0 self-center text-slate-300 transition-transform group-hover:translate-x-0.5" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
        </div>

        {filteredSessions.length === 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center">
            <Search className="mx-auto mb-4 h-12 w-12 text-slate-200" />
            <h3 className="mb-1 text-lg font-semibold text-slate-700">No sessions found</h3>
            <p className="text-slate-400">Try adjusting your filters or search</p>
          </div>
        )}
      </section>

      {/* Examination */}
      {publicSettings?.show_exam_details && publicSettings.exam_theory && (
        <section className="max-w-6xl mx-auto px-4 pb-8">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-emerald-800">
              <Award className="h-5 w-5" /> Examination Details
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 font-semibold text-emerald-700">Theory Examination</h3>
                <ul className="space-y-1 text-sm text-emerald-800">
                  <li>{publicSettings.exam_theory.questions} MCQ Questions · {publicSettings.exam_theory.marks} Marks</li>
                  <li>{publicSettings.exam_theory.negative_marking ? "Negative marking applies" : "No negative marking"}</li>
                  <li>Duration: {publicSettings.exam_theory.duration_minutes} minutes</li>
                </ul>
              </div>
              {publicSettings.exam_practical && publicSettings.exam_practical.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold text-emerald-700">Practical Assessment</h3>
                  <ul className="space-y-1 text-sm text-emerald-800">
                    {publicSettings.exam_practical.map((comp) => (
                      <li key={comp.id}>{comp.name} · {comp.marks} Marks</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {publicSettings?.show_faq && publicSettings.faqs && publicSettings.faqs.length > 0 && (
        <section id="faq" className="max-w-6xl mx-auto px-4 pb-12">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800">
            <HelpCircle className="h-5 w-5" /> Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            {publicSettings.faqs.map((faq, index) => (
              <AccordionItem key={faq.id} value={`faq-${index}`} className="border-b border-slate-100 last:border-0">
                <AccordionTrigger className="px-6 text-left font-medium text-slate-800 hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 text-slate-600">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {/* CTA */}
      <section className="relative overflow-hidden" style={{ backgroundColor: accent }}>
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "20px 20px" }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to join us?</h2>
          <p className="mx-auto mt-2 max-w-md text-white/80">
            Secure your spot at {event?.short_name || event?.name || "the conference"}.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 h-12 bg-white px-8 text-base font-semibold shadow-lg hover:bg-white/90"
            style={{ color: accent }}
          >
            <a href={registerHref}>
              Register Now
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-slate-400">
          {publicSettings?.footer_text || `${event?.name || "Conference"} · Powered by ${COMPANY_CONFIG.name}`}
        </div>
      </footer>

      {/* Session detail dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          {selectedSession && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8 text-xl leading-snug">{selectedSession.session_name}</DialogTitle>
              </DialogHeader>
              <div className="mt-4 space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-sm">
                    <Clock className="mr-1 h-3.5 w-3.5" />
                    {formatTime(selectedSession.start_time)} – {formatTime(selectedSession.end_time)}
                  </Badge>
                  {selectedSession.hall && (
                    <Badge className={cn(getHallColor(selectedSession.hall).bg, "text-white")}>
                      <MapPin className="mr-1 h-3.5 w-3.5" />
                      {selectedSession.hall}
                    </Badge>
                  )}
                  {selectedSession.duration_minutes && (
                    <Badge variant="secondary">{selectedSession.duration_minutes} minutes</Badge>
                  )}
                </div>

                {selectedSession.description && <p className="text-slate-600">{selectedSession.description}</p>}

                {selectedSession.speakers && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                      <User className="h-4 w-4" />
                      Faculty
                    </h4>
                    <div className="space-y-2">
                      {splitNames(selectedSession.speakers).map((speaker, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                          <SpeakerAvatar name={speaker} size="md" />
                          <span className="font-medium text-slate-800">{speaker}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSession.chairpersons && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                      <Users className="h-4 w-4" />
                      Chairperson{splitNames(selectedSession.chairpersons).length > 1 ? "s" : ""}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {splitNames(selectedSession.chairpersons).map((chair, i) => (
                        <Badge key={i} variant="outline" className="py-1.5">{chair}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSession.moderators && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                      <Mic2 className="h-4 w-4" />
                      Moderator{splitNames(selectedSession.moderators).length > 1 ? "s" : ""}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {splitNames(selectedSession.moderators).map((mod, i) => (
                        <Badge key={i} variant="secondary" className="py-1.5">{mod}</Badge>
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
