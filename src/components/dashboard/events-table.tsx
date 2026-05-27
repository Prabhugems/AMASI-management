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
  Settings,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { FEATURES } from "@/lib/config"

function AnimatedProgress({ value, delay = 0 }: { value: number; delay?: number }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), delay + 300)
    return () => clearTimeout(timer)
  }, [value, delay])

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-1000 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums min-w-[32px] text-muted-foreground">
        {value}%
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    active: { cls: "bg-emerald-50 text-emerald-700", label: "Active" },
    planning: { cls: "bg-amber-50 text-amber-700", label: "Planning" },
    registration_open: { cls: "bg-cyan-50 text-cyan-700", label: "Registration" },
    ongoing: { cls: "bg-emerald-50 text-emerald-700", label: "Ongoing" },
    setup: { cls: "bg-blue-50 text-blue-700", label: "Setup" },
    completed: { cls: "bg-muted text-muted-foreground", label: "Completed" },
    draft: { cls: "bg-muted text-muted-foreground", label: "Draft" },
    cancelled: { cls: "bg-rose-50 text-rose-700", label: "Cancelled" },
  }
  const c = config[status] || config.draft
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.cls}`}>
      {c.label}
    </span>
  )
}

function FacultyAvatars({
  confirmed,
  pending,
  declined,
}: {
  confirmed: number
  pending: number
  declined: number
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {[...Array(Math.min(3, confirmed))].map((_, i) => (
          <div
            key={i}
            className="w-7 h-7 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground"
          >
            {String.fromCharCode(65 + i)}
          </div>
        ))}
        {confirmed > 3 && (
          <div className="w-7 h-7 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold bg-muted text-muted-foreground">
            +{confirmed - 3}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 text-[11px]">
        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
          {confirmed}
        </span>
        {pending > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
            {pending}
          </span>
        )}
        {declined > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-medium">
            {declined}
          </span>
        )}
      </div>
    </div>
  )
}

type EventData = {
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

function getDaysAway(dateStr: string | null) {
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

function formatDate(dateStr: string | null) {
  if (!dateStr) return "TBD"
  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function EventRow({ event, index, isLast }: { event: EventData; index: number; isLast: boolean }) {
  const [isVisible, setIsVisible] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 80)
    return () => clearTimeout(timer)
  }, [index])

  return (
    <tr
      className={`
        group transition-all duration-400 ease-out
        ${isVisible ? "opacity-100" : "opacity-0 translate-y-2"}
        hover:bg-accent
        ${!isLast ? "border-b border-border" : ""}
      `}
      style={{ transitionDelay: `${index * 80}ms` }}
      onMouseLeave={() => setShowMenu(false)}
    >
      <td className="py-3.5 px-5">
        <Link href={`/events/${event.id}`} className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-muted group-hover:bg-cyan-50 transition-colors">
            <Calendar className="w-4 h-4 text-muted-foreground group-hover:text-cyan-600 transition-colors" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-foreground group-hover:text-cyan-600 transition-colors truncate">
              {event.short_name || event.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-gray-400">{event.event_type}</span>
              {event.city && (
                <>
                  <span className="text-xs text-muted-foreground/50">&middot;</span>
                  <span className="text-xs text-gray-400 flex items-center gap-0.5">
                    <MapPin className="w-3 h-3" />
                    {event.city}{event.state && `, ${event.state}`}
                  </span>
                </>
              )}
            </div>
          </div>
        </Link>
      </td>

      <td className="py-3.5 px-4">
        <p className="text-sm font-medium whitespace-nowrap text-foreground">{formatDate(event.start_date)}</p>
        <p className="text-xs whitespace-nowrap text-gray-400 mt-0.5 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {getDaysAway(event.start_date)}
        </p>
      </td>

      {FEATURES.faculty && (
        <td className="py-3.5 px-4">
          <FacultyAvatars
            confirmed={event.confirmed_faculty || 0}
            pending={event.pending_faculty || 0}
            declined={event.declined_faculty || 0}
          />
        </td>
      )}

      <td className="py-3.5 px-4">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-semibold text-sm tabular-nums text-foreground">
            {(event.total_delegates || 0).toLocaleString()}
          </span>
        </div>
      </td>

      <td className="py-3.5 px-4 min-w-[160px]">
        <AnimatedProgress value={event.progress || 0} delay={index * 80} />
      </td>

      <td className="py-3.5 px-4">
        <StatusBadge status={event.status} />
      </td>

      <td className="py-3.5 px-4 relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {showMenu && (
          <div className="absolute right-4 top-full mt-1 w-44 rounded-xl overflow-hidden z-50 bg-card border border-border shadow-xl">
            {[
              { icon: Eye, label: "View Details", href: `/events/${event.id}` },
              { icon: Edit, label: "Edit Event", href: `/events/${event.id}/settings` },
              { icon: Settings, label: "Settings", href: `/events/${event.id}/settings` },
            ].map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </td>
    </tr>
  )
}

function EventCard({ event, index }: { event: EventData; index: number }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 80)
    return () => clearTimeout(timer)
  }, [index])

  return (
    <Link
      href={`/events/${event.id}`}
      className={`
        block p-4 transition-all duration-400 ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}
        active:bg-accent
      `}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-muted shrink-0">
            <Calendar className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate text-foreground">
              {event.short_name || event.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-gray-400">{event.event_type}</span>
              {event.city && (
                <>
                  <span className="text-xs text-muted-foreground/50">&middot;</span>
                  <span className="text-xs text-gray-400">{event.city}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <StatusBadge status={event.status} />
      </div>

      <div className="flex items-center gap-1.5 mb-2.5 text-sm">
        <Clock className="w-3.5 h-3.5 shrink-0 text-gray-400" />
        <span className="font-medium whitespace-nowrap text-foreground">{formatDate(event.start_date)}</span>
        <span className="text-muted-foreground/50">&middot;</span>
        <span className="whitespace-nowrap text-xs text-gray-400">{getDaysAway(event.start_date)}</span>
      </div>

      <div className="flex items-center gap-4 mb-2.5">
        {FEATURES.faculty && (
          <FacultyAvatars
            confirmed={event.confirmed_faculty || 0}
            pending={event.pending_faculty || 0}
            declined={event.declined_faculty || 0}
          />
        )}
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-sm font-semibold text-foreground">
            {(event.total_delegates || 0).toLocaleString()}
          </span>
        </div>
      </div>

      <AnimatedProgress value={event.progress || 0} delay={index * 80} />
    </Link>
  )
}

export function EventsTable() {
  const { data: events, isLoading } = useQuery({
    queryKey: ["dashboard-events"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/active-events")
      if (!res.ok) throw new Error("Failed to fetch active events")
      return await res.json()
    },
    staleTime: 2 * 60 * 1000,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const displayEvents: any[] = events || []

  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border">
      {/* Header */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-lg bg-muted">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">Active Events</h2>
            <p className="text-xs text-gray-400 hidden sm:block">Your upcoming and ongoing events</p>
          </div>
        </div>
        {(FEATURES.multipleEvents || !displayEvents || displayEvents.length === 0) && (
          <Link
            href="/events/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Event</span>
          </Link>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-border">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="p-4 animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg shrink-0 bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted/60" />
                </div>
              </div>
              <div className="h-3 w-2/3 rounded bg-muted/60" />
              <div className="h-1.5 w-full rounded-full bg-muted" />
            </div>
          ))
        ) : displayEvents.length === 0 ? (
          <div className="py-12 text-center">
            <div className="inline-flex p-4 rounded-full mb-3 bg-muted">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">No active events</p>
            <p className="text-sm mt-1 px-4 text-gray-400">
              Create a new event to start managing conferences
            </p>
          </div>
        ) : (
          displayEvents.map((event, index) => (
            <EventCard key={event.id} event={event} index={index} />
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 px-5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Event</th>
              <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Date</th>
              {FEATURES.faculty && (
                <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Faculty</th>
              )}
              <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Attendees</th>
              <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 min-w-[160px]">Progress</th>
              <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
              <th className="py-3 px-4 w-[48px]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="animate-pulse border-b border-border">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-muted" />
                      <div className="space-y-2">
                        <div className="w-32 h-4 rounded bg-muted" />
                        <div className="w-20 h-3 rounded bg-muted/60" />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4"><div className="w-20 h-4 rounded bg-muted" /></td>
                  {FEATURES.faculty && (
                    <td className="py-3.5 px-4">
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map((j) => <div key={j} className="w-7 h-7 rounded-full bg-muted border-2 border-card" />)}
                      </div>
                    </td>
                  )}
                  <td className="py-3.5 px-4"><div className="w-10 h-4 rounded bg-muted" /></td>
                  <td className="py-3.5 px-4"><div className="w-full h-1.5 rounded-full bg-muted" /></td>
                  <td className="py-3.5 px-4"><div className="w-16 h-5 rounded-full bg-muted" /></td>
                  <td className="py-3.5 px-4"><div className="w-6 h-6 rounded bg-muted" /></td>
                </tr>
              ))
            ) : displayEvents.length === 0 ? (
              <tr>
                <td colSpan={FEATURES.faculty ? 7 : 6} className="py-16 text-center">
                  <div className="inline-flex p-5 rounded-full mb-4 bg-muted">
                    <Calendar className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-lg text-foreground">No active events</p>
                  <p className="text-sm mt-1 max-w-xs mx-auto text-gray-400">
                    Create a new event to start managing conferences, workshops, and courses
                  </p>
                </td>
              </tr>
            ) : (
              displayEvents.map((event, index) => (
                <EventRow key={event.id} event={event} index={index} isLast={index === displayEvents.length - 1} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Updated just now
        </p>
        <Link
          href="/events"
          className="flex items-center gap-1.5 text-sm font-semibold text-cyan-600 hover:text-cyan-500 transition-colors"
        >
          View all events
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
