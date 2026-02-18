"use client"

import { useState, useEffect } from "react"
import {
  Calendar,
  MapPin,
  Users,
  MoreHorizontal,
  Plus,
  Clock,
  Eye,
  Edit,
  Copy,
  Trash2,
  Settings,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useQuery } from "@tanstack/react-query"


// Animated Progress Bar
function AnimatedProgress({
  value,
  color,
  delay = 0,
  isDark,
}: {
  value: number
  color: string
  delay?: number
  isDark: boolean
}) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), delay + 300)
    return () => clearTimeout(timer)
  }, [value, delay])

  const colors: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
    rose: "from-rose-500 to-pink-500",
    blue: "from-blue-500 to-cyan-500",
    primary: "bg-gradient-primary",
  }

  const isPrimary = color === "primary"

  return (
    <div className="flex items-center gap-3">
      <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${isPrimary ? "bg-gradient-primary" : `bg-gradient-to-r ${colors[color]}`}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={`text-sm font-bold tabular-nums min-w-[40px] ${isDark ? "text-white" : "text-gray-900"}`}>
        {value}%
      </span>
    </div>
  )
}

// Status Badge
function StatusBadge({ status, isDark }: { status: string; isDark: boolean }) {
  const config: Record<string, { bg: string; text: string; dot: string; label: string; pulse: boolean }> = {
    active: {
      bg: isDark ? "bg-emerald-500/20" : "bg-emerald-100",
      text: isDark ? "text-emerald-400" : "text-emerald-700",
      dot: "bg-emerald-500",
      label: "Active",
      pulse: true,
    },
    planning: {
      bg: isDark ? "bg-amber-500/20" : "bg-amber-100",
      text: isDark ? "text-amber-400" : "text-amber-700",
      dot: "bg-amber-500",
      label: "Planning",
      pulse: false,
    },
    registration_open: {
      bg: isDark ? "bg-blue-500/20" : "bg-blue-100",
      text: isDark ? "text-blue-400" : "text-blue-700",
      dot: "bg-blue-500",
      label: "Registration",
      pulse: true,
    },
    ongoing: {
      bg: isDark ? "bg-emerald-500/20" : "bg-emerald-100",
      text: isDark ? "text-emerald-400" : "text-emerald-700",
      dot: "bg-emerald-500",
      label: "Ongoing",
      pulse: true,
    },
    setup: {
      bg: isDark ? "bg-blue-500/20" : "bg-blue-100",
      text: isDark ? "text-blue-400" : "text-blue-700",
      dot: "bg-blue-500",
      label: "Setup",
      pulse: false,
    },
    completed: {
      bg: isDark ? "bg-slate-500/20" : "bg-gray-100",
      text: isDark ? "text-slate-400" : "text-gray-600",
      dot: "bg-slate-500",
      label: "Completed",
      pulse: false,
    },
    draft: {
      bg: "bg-primary-20",
      text: "text-primary",
      dot: "bg-primary",
      label: "Draft",
      pulse: false,
    },
    cancelled: {
      bg: isDark ? "bg-rose-500/20" : "bg-rose-100",
      text: isDark ? "text-rose-400" : "text-rose-700",
      dot: "bg-rose-500",
      label: "Cancelled",
      pulse: false,
    },
  }

  const statusConfig = config[status] || config.draft

  return (
    <span
      className={`
      inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold
      ${statusConfig.bg} ${statusConfig.text}
      transition-all duration-300
    `}
    >
      <span className="relative flex h-2 w-2">
        {statusConfig.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusConfig.dot} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${statusConfig.dot}`} />
      </span>
      {statusConfig.label}
    </span>
  )
}

// Faculty Avatars
function FacultyAvatars({
  confirmed,
  pending,
  declined,
  isDark,
}: {
  confirmed: number
  pending: number
  declined: number
  isDark: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Avatar Stack */}
      <div className="flex -space-x-2">
        {[...Array(Math.min(3, confirmed))].map((_, i) => (
          <div
            key={i}
            className={`
              w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold
              ${isDark ? "border-slate-800 bg-emerald-500" : "border-white bg-emerald-500"}
              text-white
            `}
          >
            {String.fromCharCode(65 + i)}
          </div>
        ))}
        {confirmed > 3 && (
          <div
            className={`
            w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold
            ${isDark ? "border-slate-800 bg-slate-700 text-white" : "border-white bg-gray-200 text-gray-600"}
          `}
          >
            +{confirmed - 3}
          </div>
        )}
      </div>

      {/* Counts */}
      <div className="flex items-center gap-1 text-xs">
        <span className={`px-1.5 py-0.5 rounded ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
          {confirmed}
        </span>
        {pending > 0 && (
          <span className={`px-1.5 py-0.5 rounded ${isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"}`}>
            {pending}
          </span>
        )}
        {declined > 0 && (
          <span className={`px-1.5 py-0.5 rounded ${isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-700"}`}>
            {declined}
          </span>
        )}
      </div>
    </div>
  )
}

// Event Row
function EventRow({
  event,
  index,
  isDark,
  isLast,
}: {
  event: {
    id: string
    name: string
    short_name: string | null
    event_type: string
    city: string | null
    state: string | null
    start_date: string | null
    status: string
    confirmed_faculty: number
    pending_faculty: number
    declined_faculty: number
    total_delegates: number
    progress: number
  }
  index: number
  isDark: boolean
  isLast: boolean
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 100)
    return () => clearTimeout(timer)
  }, [index])

  const progressColors = ["emerald", "amber", "rose", "blue", "primary"]

  const getDaysAway = (dateStr: string | null) => {
    if (!dateStr) return "TBD"
    const date = new Date(dateStr)
    const today = new Date()
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < -1) return `Day ${Math.abs(diff) + 1}`
    if (diff === -1) return "Day 2"
    if (diff === 0) return "Today"
    if (diff === 1) return "Tomorrow"
    return `${diff} days away`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBD"
    return new Date(dateStr).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <tr
      className={`
        group
        transition-all duration-500 ease-out
        ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}
        ${isHovered ? (isDark ? "bg-slate-800/50" : "bg-gray-50/80") : ""}
        ${!isLast ? (isDark ? "border-b border-slate-700/50" : "border-b border-gray-100") : ""}
      `}
      style={{ transitionDelay: `${index * 100}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setShowMenu(false)
      }}
    >
      {/* Event Name & Info */}
      <td className="py-4 px-6">
        <Link href={`/events/${event.id}`} className="flex items-center gap-4">
          {/* Event Icon */}
          <div
            className={`
            p-3 rounded-xl transition-all duration-300 bg-primary-20
            ${isHovered ? "scale-110" : ""}
          `}
          >
            <Calendar className="w-5 h-5 text-primary" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3
                className={`font-bold transition-colors duration-300 ${isDark ? "text-white" : "text-gray-900"} ${
                  isHovered ? "text-primary" : ""
                }`}
              >
                {event.short_name || event.name}
              </h3>
              <ArrowUpRight
                className={`
                w-4 h-4 transition-all duration-300 text-primary
                ${isHovered ? "opacity-100" : "opacity-0"}
              `}
              />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>{event.event_type}</span>
              {event.city && (
                <>
                  <span className={`text-xs ${isDark ? "text-slate-600" : "text-gray-300"}`}>•</span>
                  <span className={`text-sm flex items-center gap-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                    <MapPin className="w-3 h-3" />
                    {event.city}
                    {event.state && `, ${event.state}`}
                  </span>
                </>
              )}
            </div>
          </div>
        </Link>
      </td>

      {/* Date */}
      <td className="py-4 px-4">
        <div>
          <p className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{formatDate(event.start_date)}</p>
          <p className={`text-sm flex items-center gap-1 mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
            <Clock className="w-3 h-3" />
            {getDaysAway(event.start_date)}
          </p>
        </div>
      </td>

      {/* Faculty */}
      <td className="py-4 px-4">
        <FacultyAvatars
          confirmed={event.confirmed_faculty || 0}
          pending={event.pending_faculty || 0}
          declined={event.declined_faculty || 0}
          isDark={isDark}
        />
      </td>

      {/* Delegates */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <Users className={`w-4 h-4 ${isDark ? "text-slate-400" : "text-gray-400"}`} />
          <span className={`font-bold text-lg ${isDark ? "text-white" : "text-gray-900"}`}>
            {(event.total_delegates || 0).toLocaleString()}
          </span>
        </div>
      </td>

      {/* Progress */}
      <td className="py-4 px-4 min-w-[180px]">
        <AnimatedProgress
          value={event.progress || 0}
          color={progressColors[index % progressColors.length]}
          delay={index * 100}
          isDark={isDark}
        />
      </td>

      {/* Status */}
      <td className="py-4 px-4">
        <StatusBadge status={event.status} isDark={isDark} />
      </td>

      {/* Actions */}
      <td className="py-4 px-4 relative">
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`
              p-2 rounded-lg transition-all duration-300
              ${isDark ? "hover:bg-slate-700 text-slate-400 hover:text-white" : "hover:bg-gray-200 text-gray-400 hover:text-gray-700"}
              ${isHovered ? "opacity-100" : "opacity-50"}
            `}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div
              className={`
              absolute right-0 top-full mt-2 w-48 rounded-xl overflow-hidden z-50
              ${isDark ? "bg-slate-800 border border-slate-700 shadow-xl shadow-black/30" : "bg-white border border-gray-200 shadow-xl shadow-gray-200/50"}
              animate-fade-in
            `}
            >
              {[
                { icon: Eye, label: "View Details", href: `/events/${event.id}` },
                { icon: Edit, label: "Edit Event", href: `/events/${event.id}/edit` },
                { icon: Copy, label: "Duplicate", href: "#" },
                { icon: Settings, label: "Settings", href: `/events/${event.id}/settings` },
                { icon: Trash2, label: "Delete", href: "#", danger: true },
              ].map((item, i) => (
                <Link
                  key={i}
                  href={item.href}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-sm font-medium
                    transition-colors duration-200
                    ${isDark ? "text-slate-300 hover:bg-slate-700 hover:text-white" : "text-gray-700 hover:bg-gray-50"}
                    ${item.danger ? (isDark ? "hover:text-rose-400" : "hover:text-rose-600") : ""}
                  `}
                  onClick={(e) => {
                    if (item.href === "#") e.preventDefault()
                  }}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// Main Component
export function EventsTable() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === "dark" : false

  // Fetch events from Supabase
  const { data: events, isLoading } = useQuery({
    queryKey: ["dashboard-events"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/active-events")
      if (!res.ok) throw new Error("Failed to fetch active events")
      return await res.json()
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const displayEvents: any[] = events || []

  return (
    <div
      className={`
      rounded-2xl overflow-hidden
      ${isDark ? "bg-slate-900/50 border border-slate-800 backdrop-blur-sm" : "bg-white border border-gray-200 shadow-xl shadow-gray-200/50"}
    `}
    >
      {/* Header */}
      <div className={`p-6 flex items-center justify-between ${isDark ? "border-b border-slate-800" : "border-b border-gray-100"}`}>
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gradient-primary shadow-primary-glow">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className={`text-lg font-bold leading-tight ${isDark ? "text-white" : "text-gray-900"}`}>Active Events</h2>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>Your upcoming and ongoing events</p>
          </div>
        </div>
        <Link
          href="/events/new"
          className="relative overflow-hidden flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-gradient-primary text-white shadow-primary-glow transition-all duration-300 hover:scale-105 hover:shadow-primary-glow-lg"
        >
          <Plus className="w-5 h-5" />
          <span>New Event</span>
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={isDark ? "bg-slate-800/50" : "bg-gray-50"}>
              <th className={`py-4 px-6 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                Event
              </th>
              <th className={`py-4 px-4 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                Date
              </th>
              <th className={`py-4 px-4 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                Faculty
              </th>
              <th className={`py-4 px-4 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                Attendees
              </th>
              <th className={`py-4 px-4 text-left text-xs font-bold uppercase tracking-wider min-w-[180px] ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                Progress
              </th>
              <th className={`py-4 px-4 text-left text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                Status
              </th>
              <th className={`py-4 px-4 w-[60px] ${isDark ? "text-slate-400" : "text-gray-500"}`}>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className={`py-12 text-center ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                  Loading events...
                </td>
              </tr>
            ) : displayEvents.length === 0 ? (
              <tr>
                <td colSpan={7} className={`py-12 text-center ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">No active events</p>
                  <p className="text-sm mt-1">Create a new event to get started</p>
                </td>
              </tr>
            ) : (
              displayEvents.map((event, index) => (
                <EventRow key={event.id} event={event} index={index} isDark={isDark} isLast={index === displayEvents.length - 1} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        className={`
        flex items-center justify-between px-6 py-4
        ${isDark ? "bg-slate-800/50 border-t border-slate-700/50" : "bg-gray-50 border-t border-gray-100"}
      `}
      >
        <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
          <Clock className="w-4 h-4 inline mr-2" />
          Updated just now
        </p>
        <Link
          href="/events"
          className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors duration-300"
        >
          View all events
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
