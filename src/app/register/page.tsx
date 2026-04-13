"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { format, isAfter, isBefore, startOfMonth, endOfMonth, addMonths } from "date-fns"
import {
  Calendar,
  MapPin,
  ArrowRight,
  Search,
  Ticket,
  X,
  ChevronDown,
  SlidersHorizontal,
  Users,
} from "lucide-react"
import { COMPANY_CONFIG } from "@/lib/config"

interface PublicEvent {
  id: string
  name: string
  short_name: string
  slug: string
  tagline?: string
  description?: string
  event_type: string
  start_date: string
  end_date: string
  city: string
  state?: string
  venue_name?: string
  banner_url?: string
  logo_url?: string
  status: string
  ticket_types?: {
    id: string
    name: string
    price: number
    status: string
  }[]
}

const EVENT_TYPES = [
  { value: "all", label: "All Types" },
  { value: "conference", label: "Conference" },
  { value: "workshop", label: "Workshop" },
  { value: "course", label: "Course" },
  { value: "webinar", label: "Webinar" },
  { value: "symposium", label: "Symposium" },
]

const DATE_FILTERS = [
  { value: "all", label: "Any Date" },
  { value: "this_month", label: "This Month" },
  { value: "next_month", label: "Next Month" },
  { value: "next_3_months", label: "Next 3 Months" },
]

const PRICE_FILTERS = [
  { value: "all", label: "Any Price" },
  { value: "free", label: "Free" },
  { value: "under_5000", label: "Under ₹5,000" },
  { value: "5000_15000", label: "₹5,000 – ₹15,000" },
  { value: "above_15000", label: "Above ₹15,000" },
]

const SORT_OPTIONS = [
  { value: "date_asc", label: "Date (Earliest)" },
  { value: "date_desc", label: "Date (Latest)" },
  { value: "price_asc", label: "Price (Low → High)" },
  { value: "price_desc", label: "Price (High → Low)" },
  { value: "name_asc", label: "Name (A–Z)" },
]

/* ─── Event Card ─── */
function EventCard({ event, index }: { event: PublicEvent; index: number }) {
  const [isHovered, setIsHovered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 80)
    return () => clearTimeout(timer)
  }, [index])

  const prices =
    event.ticket_types?.filter((t) => t.status === "active").map((t) => t.price) || []
  const minPrice = prices.length > 0 ? Math.min(...prices) : null
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null
  const isFree = minPrice === 0 && maxPrice === 0

  const priceDisplay = isFree
    ? "Free"
    : minPrice !== null
      ? minPrice === maxPrice
        ? `₹${minPrice.toLocaleString("en-IN")}`
        : `₹${minPrice.toLocaleString("en-IN")} – ₹${maxPrice?.toLocaleString("en-IN")}`
      : "Free"

  const eventTypeLabel = event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)

  return (
    <Link href={`/register/${event.slug || event.id}`}>
      <div
        className={`
          group relative overflow-hidden rounded-2xl cursor-pointer
          transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
          ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{
          background: '#FFFFFF',
          border: `1px solid ${isHovered ? 'rgba(22, 101, 52, 0.2)' : 'rgba(28, 25, 23, 0.06)'}`,
          boxShadow: isHovered
            ? '0 20px 40px -12px rgba(28, 25, 23, 0.12), 0 0 0 1px rgba(22, 101, 52, 0.08)'
            : '0 1px 3px rgba(28, 25, 23, 0.04)',
          transitionDelay: `${index * 80}ms`,
          transform: isHovered ? 'translateY(-4px)' : isVisible ? 'translateY(0)' : 'translateY(24px)',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Image */}
        <div className="relative h-52 overflow-hidden">
          {event.banner_url ? (
            <img
              src={event.banner_url}
              alt={event.name}
              className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
              style={{ transform: isHovered ? 'scale(1.06)' : 'scale(1)' }}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(145deg, #14532D 0%, #166534 40%, #22C55E 100%)',
              }}
            >
              <span
                className="reg-serif text-7xl font-bold"
                style={{ color: 'rgba(255,255,255,0.12)' }}
              >
                {event.short_name?.[0] || event.name[0]}
              </span>
            </div>
          )}

          {/* Gradient overlay */}
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              background: 'linear-gradient(to top, rgba(28,25,23,0.55) 0%, rgba(28,25,23,0.05) 50%, transparent 100%)',
              opacity: isHovered ? 0.9 : 0.7,
            }}
          />

          {/* Event type tag — top left */}
          <div className="absolute top-4 left-4">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide uppercase"
              style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(12px)',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {eventTypeLabel}
            </span>
          </div>

          {/* Price tag — top right */}
          <div className="absolute top-4 right-4">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide"
              style={{
                background: isFree ? 'rgba(22,163,74,0.9)' : 'rgba(28,25,23,0.75)',
                backdropFilter: 'blur(12px)',
                color: '#FFFFFF',
              }}
            >
              <Ticket className="w-3 h-3" />
              {priceDisplay}
            </span>
          </div>

          {/* Event logo */}
          {event.logo_url && (
            <div className="absolute bottom-4 left-4">
              <img
                src={event.logo_url}
                alt=""
                className="h-11 w-11 rounded-lg bg-white/95 object-contain shadow-md"
                style={{ border: '2px solid rgba(255,255,255,0.8)' }}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 pb-6">
          <h3
            className="reg-serif text-[17px] font-bold leading-snug mb-2 line-clamp-2 transition-colors duration-300"
            style={{ color: isHovered ? '#166534' : '#1C1917' }}
          >
            {event.name}
          </h3>

          {event.tagline && (
            <p
              className="text-[13px] leading-relaxed mb-4 line-clamp-2"
              style={{ color: '#78716C' }}
            >
              {event.tagline}
            </p>
          )}

          {/* Meta info */}
          <div className="space-y-2 mb-5">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#A8A29E' }} />
              <span className="text-[13px] font-medium" style={{ color: '#57534E' }}>
                {format(new Date(event.start_date), "d MMM yyyy")}
                {event.end_date && event.end_date !== event.start_date && (
                  <> – {format(new Date(event.end_date), "d MMM yyyy")}</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#A8A29E' }} />
              <span className="text-[13px] font-medium" style={{ color: '#57534E' }}>
                {event.venue_name ? `${event.venue_name}, ` : ""}
                {event.city}
                {event.state && `, ${event.state}`}
              </span>
            </div>
          </div>

          {/* CTA strip */}
          <div
            className="flex items-center justify-between pt-4"
            style={{ borderTop: '1px solid rgba(28, 25, 23, 0.06)' }}
          >
            <span
              className="text-[13px] font-semibold tracking-wide transition-colors duration-300"
              style={{ color: isHovered ? '#166534' : '#57534E' }}
            >
              Register Now
            </span>
            <div
              className="p-2 rounded-full transition-all duration-300"
              style={{
                background: isHovered ? '#166534' : 'rgba(28, 25, 23, 0.04)',
                color: isHovered ? '#FFFFFF' : '#78716C',
                transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
              }}
            >
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

/* ─── Filter Dropdown ─── */
function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200"
        style={{
          background: value !== "all" ? 'rgba(22, 101, 52, 0.06)' : 'rgba(28, 25, 23, 0.03)',
          border: `1px solid ${value !== "all" ? 'rgba(22, 101, 52, 0.15)' : 'rgba(28, 25, 23, 0.08)'}`,
          color: '#1C1917',
        }}
      >
        <span style={{ color: '#A8A29E' }}>{label}:</span>
        <span>{selected?.label}</span>
        <ChevronDown
          className="w-3.5 h-3.5 transition-transform duration-200"
          style={{
            color: '#A8A29E',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div
            className="absolute top-full left-0 mt-2 w-full sm:w-52 py-1.5 rounded-xl z-20 overflow-hidden"
            style={{
              background: '#FFFFFF',
              border: '1px solid rgba(28, 25, 23, 0.08)',
              boxShadow: '0 12px 40px -8px rgba(28, 25, 23, 0.12), 0 4px 12px -4px rgba(28, 25, 23, 0.08)',
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className="w-full px-4 py-2.5 text-left text-[13px] transition-colors duration-150"
                style={{
                  color: value === option.value ? '#166534' : '#1C1917',
                  fontWeight: value === option.value ? 600 : 400,
                  background: value === option.value ? 'rgba(22, 101, 52, 0.04)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (value !== option.value) e.currentTarget.style.background = 'rgba(28,25,23,0.03)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = value === option.value ? 'rgba(22, 101, 52, 0.04)' : 'transparent'
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Main Page ─── */
export default function RegisterPage() {
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [eventType, setEventType] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [priceFilter, setPriceFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date_asc")

  const activeFilterCount = [eventType, dateFilter, priceFilter].filter((f) => f !== "all").length

  const supabase = createClient()

  // Fetch events with registration open
  const { data: events, isLoading } = useQuery({
    queryKey: ["public-events", search],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select(`
          id, name, short_name, slug, tagline, description, event_type,
          start_date, end_date, city, state, venue_name, banner_url, logo_url, status
        `)
        .in("status", ["registration_open", "planning", "ongoing"])
        .order("start_date", { ascending: true })

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,city.ilike.%${search}%,short_name.ilike.%${search}%`
        )
      }

      const { data: eventsData, error: eventsError } = await query

      if (eventsError) {
        console.error("Failed to fetch events:", eventsError.message || eventsError)
        return []
      }

      if (!eventsData || eventsData.length === 0) return []

      type EventRow = {
        id: string; name: string; short_name: string; slug: string
        tagline: string | null; description: string | null; event_type: string
        start_date: string; end_date: string; city: string; state: string | null
        venue_name: string | null; banner_url: string | null; logo_url: string | null
        status: string
      }
      const typedEvents = eventsData as EventRow[]

      const eventIds = typedEvents.map((e) => e.id)
      const { data: ticketsData } = await (supabase as any)
        .from("ticket_types")
        .select("id, name, price, status, event_id")
        .in("event_id", eventIds)
        .eq("status", "active")

      const eventsWithTickets = typedEvents.map((event) => ({
        ...event,
        ticket_types: ticketsData?.filter((t: any) => t.event_id === event.id) || [],
      }))

      return eventsWithTickets as PublicEvent[]
    },
  })

  // Client-side filtering + sorting
  const filteredEvents = useMemo(() => {
    if (!events) return []
    let result = [...events]

    if (eventType !== "all") {
      result = result.filter((e) => e.event_type === eventType)
    }

    const now = new Date()
    if (dateFilter === "this_month") {
      const monthEnd = endOfMonth(now)
      result = result.filter((e) => {
        const d = new Date(e.start_date)
        return isBefore(d, monthEnd) && isAfter(d, now)
      })
    } else if (dateFilter === "next_month") {
      const s = startOfMonth(addMonths(now, 1))
      const end = endOfMonth(addMonths(now, 1))
      result = result.filter((e) => {
        const d = new Date(e.start_date)
        return isAfter(d, s) && isBefore(d, end)
      })
    } else if (dateFilter === "next_3_months") {
      const end = endOfMonth(addMonths(now, 3))
      result = result.filter((e) => isBefore(new Date(e.start_date), end))
    }

    if (priceFilter !== "all") {
      result = result.filter((e) => {
        const prices = e.ticket_types?.filter((t) => t.status === "active").map((t) => t.price) || []
        const min = prices.length > 0 ? Math.min(...prices) : 0
        switch (priceFilter) {
          case "free": return min === 0
          case "under_5000": return min > 0 && min < 5000
          case "5000_15000": return min >= 5000 && min <= 15000
          case "above_15000": return min > 15000
          default: return true
        }
      })
    }

    result.sort((a, b) => {
      const aMin = Math.min(...(a.ticket_types?.filter((t) => t.status === "active").map((t) => t.price) || [0]))
      const bMin = Math.min(...(b.ticket_types?.filter((t) => t.status === "active").map((t) => t.price) || [0]))
      switch (sortBy) {
        case "date_asc": return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        case "date_desc": return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        case "price_asc": return aMin - bMin
        case "price_desc": return bMin - aMin
        case "name_asc": return a.name.localeCompare(b.name)
        default: return 0
      }
    })

    return result
  }, [events, eventType, dateFilter, priceFilter, sortBy])

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-12">
      {/* ─── Hero ─── */}
      <div className="text-center mb-16">
        {/* Decorative line */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-px w-8" style={{ background: '#D97706' }} />
          <span
            className="text-[11px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: '#D97706' }}
          >
            {COMPANY_CONFIG.name} Events
          </span>
          <div className="h-px w-8" style={{ background: '#D97706' }} />
        </div>

        <h1
          className="reg-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-5"
          style={{ color: '#1C1917', lineHeight: 1.1 }}
        >
          Conferences &<br className="hidden sm:block" /> Workshops
        </h1>
        <p
          className="text-base sm:text-lg max-w-xl mx-auto leading-relaxed"
          style={{ color: '#78716C' }}
        >
          Register for events organized by the {COMPANY_CONFIG.fullName}
        </p>
      </div>

      {/* ─── Search & Filters ─── */}
      <div className="max-w-3xl mx-auto mb-12 space-y-4">
        {/* Search bar */}
        <div
          className="relative rounded-2xl overflow-hidden transition-all duration-300 focus-within:shadow-md"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(28, 25, 23, 0.08)',
            boxShadow: '0 1px 3px rgba(28, 25, 23, 0.04)',
          }}
        >
          <Search
            className="absolute left-5 top-1/2 -translate-y-1/2 w-[18px] h-[18px]"
            style={{ color: '#A8A29E' }}
          />
          <input
            type="text"
            placeholder="Search by event name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-14 pr-5 py-4 bg-transparent text-[15px] placeholder:text-[#C4C0BB] focus:outline-none"
            style={{ color: '#1C1917' }}
          />
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200"
            style={{
              background: showFilters || activeFilterCount > 0 ? '#166534' : 'rgba(28, 25, 23, 0.03)',
              color: showFilters || activeFilterCount > 0 ? '#FFFFFF' : '#1C1917',
              border: `1px solid ${showFilters || activeFilterCount > 0 ? '#166534' : 'rgba(28, 25, 23, 0.08)'}`,
            }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span
                className="ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold"
                style={{ background: 'rgba(255,255,255,0.25)' }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Active filter pills */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {eventType !== "all" && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium"
                  style={{ background: 'rgba(22, 101, 52, 0.06)', color: '#166534' }}
                >
                  {EVENT_TYPES.find((t) => t.value === eventType)?.label}
                  <button
                    onClick={() => setEventType("all")}
                    className="rounded-full p-0.5 transition-colors hover:bg-green-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {dateFilter !== "all" && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium"
                  style={{ background: 'rgba(22, 101, 52, 0.06)', color: '#166534' }}
                >
                  {DATE_FILTERS.find((t) => t.value === dateFilter)?.label}
                  <button
                    onClick={() => setDateFilter("all")}
                    className="rounded-full p-0.5 transition-colors hover:bg-green-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {priceFilter !== "all" && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium"
                  style={{ background: 'rgba(22, 101, 52, 0.06)', color: '#166534' }}
                >
                  {PRICE_FILTERS.find((t) => t.value === priceFilter)?.label}
                  <button
                    onClick={() => setPriceFilter("all")}
                    className="rounded-full p-0.5 transition-colors hover:bg-green-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setEventType("all")
                  setDateFilter("all")
                  setPriceFilter("all")
                }}
                className="text-[12px] font-medium underline underline-offset-2 transition-colors duration-200"
                style={{ color: '#A8A29E' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#1C1917')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#A8A29E')}
              >
                Clear all
              </button>
            </div>
          )}

          {/* Sort dropdown */}
          <div className="ml-auto">
            <FilterDropdown label="Sort" value={sortBy} options={SORT_OPTIONS} onChange={setSortBy} />
          </div>
        </div>

        {/* Expanded filters panel */}
        {showFilters && (
          <div
            className="p-4 rounded-2xl"
            style={{
              background: '#FFFFFF',
              border: '1px solid rgba(28, 25, 23, 0.06)',
              boxShadow: '0 1px 3px rgba(28, 25, 23, 0.04)',
            }}
          >
            <div className="flex flex-wrap gap-3">
              <FilterDropdown label="Type" value={eventType} options={EVENT_TYPES} onChange={setEventType} />
              <FilterDropdown label="Date" value={dateFilter} options={DATE_FILTERS} onChange={setDateFilter} />
              <FilterDropdown label="Price" value={priceFilter} options={PRICE_FILTERS} onChange={setPriceFilter} />
            </div>
          </div>
        )}

        {/* Results count */}
        {!isLoading && filteredEvents && (
          <p className="text-[13px]" style={{ color: '#A8A29E' }}>
            {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
            {activeFilterCount > 0 && " (filtered)"}
          </p>
        )}
      </div>

      {/* ─── Events Grid ─── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl animate-pulse"
              style={{ background: '#FFFFFF', border: '1px solid rgba(28, 25, 23, 0.06)' }}
            >
              <div className="h-52" style={{ background: 'rgba(28, 25, 23, 0.04)' }} />
              <div className="p-5 space-y-4">
                <div className="h-5 rounded-lg w-4/5" style={{ background: 'rgba(28, 25, 23, 0.06)' }} />
                <div className="h-4 rounded-lg w-3/5" style={{ background: 'rgba(28, 25, 23, 0.04)' }} />
                <div className="h-4 rounded-lg w-2/5" style={{ background: 'rgba(28, 25, 23, 0.04)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filteredEvents && filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event, index) => (
            <EventCard key={event.id} event={event} index={index} />
          ))}
        </div>
      ) : events && events.length > 0 ? (
        /* No matching filters */
        <div
          className="rounded-2xl text-center py-20 px-6"
          style={{ background: '#FFFFFF', border: '1px solid rgba(28, 25, 23, 0.06)' }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(28, 25, 23, 0.04)' }}
          >
            <Search className="w-6 h-6" style={{ color: '#A8A29E' }} />
          </div>
          <h3 className="reg-serif text-xl font-bold mb-2" style={{ color: '#1C1917' }}>
            No Matching Events
          </h3>
          <p className="text-[14px] mb-6" style={{ color: '#78716C' }}>
            No events match your current filters. Try adjusting your criteria.
          </p>
          <button
            onClick={() => {
              setEventType("all")
              setDateFilter("all")
              setPriceFilter("all")
              setSearch("")
            }}
            className="px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200"
            style={{ background: '#166534', color: '#FFFFFF' }}
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        /* No events at all */
        <div
          className="rounded-2xl text-center py-20 px-6"
          style={{ background: '#FFFFFF', border: '1px solid rgba(28, 25, 23, 0.06)' }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(28, 25, 23, 0.04)' }}
          >
            <Users className="w-6 h-6" style={{ color: '#A8A29E' }} />
          </div>
          <h3 className="reg-serif text-xl font-bold mb-2" style={{ color: '#1C1917' }}>
            No Events Available
          </h3>
          <p className="text-[14px]" style={{ color: '#78716C' }}>
            There are no events with open registration at the moment. Check back soon!
          </p>
        </div>
      )}
    </div>
  )
}
