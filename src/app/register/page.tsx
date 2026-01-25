"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useTheme } from "next-themes"
import Link from "next/link"
import { format, isAfter, isBefore, startOfMonth, endOfMonth, addMonths } from "date-fns"
import {
  Calendar,
  MapPin,
  Users,
  ArrowRight,
  Search,
  Sparkles,
  Ticket,
  Filter,
  X,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react"

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
  // Joined data
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
  { value: "5000_15000", label: "₹5,000 - ₹15,000" },
  { value: "above_15000", label: "Above ₹15,000" },
]

const SORT_OPTIONS = [
  { value: "date_asc", label: "Date (Earliest)" },
  { value: "date_desc", label: "Date (Latest)" },
  { value: "price_asc", label: "Price (Low to High)" },
  { value: "price_desc", label: "Price (High to Low)" },
  { value: "name_asc", label: "Name (A-Z)" },
]

function EventCard({ event, isDark, index }: { event: PublicEvent; isDark: boolean; index: number }) {
  const [isHovered, setIsHovered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 100)
    return () => clearTimeout(timer)
  }, [index])

  // Get price range from tickets
  const prices = event.ticket_types
    ?.filter((t) => t.status === "active")
    .map((t) => t.price) || []
  const minPrice = prices.length > 0 ? Math.min(...prices) : null
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null

  const priceDisplay =
    minPrice !== null
      ? minPrice === maxPrice
        ? `₹${minPrice.toLocaleString()}`
        : `₹${minPrice.toLocaleString()} - ₹${maxPrice?.toLocaleString()}`
      : "Free"

  return (
    <Link href={`/register/${event.slug || event.id}`}>
      <div
        className={`
          paper-card card-animated group relative overflow-hidden cursor-pointer
          transition-all duration-500 ease-out
          ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
          ${isHovered ? "scale-[1.02]" : ""}
        `}
        style={{ transitionDelay: `${index * 100}ms` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Banner Image */}
        <div className="relative h-48 overflow-hidden">
          {event.banner_url ? (
            <img
              src={event.banner_url}
              alt={event.name}
              className={`
                w-full h-full object-cover
                transition-transform duration-700
                ${isHovered ? "scale-110" : "scale-100"}
              `}
            />
          ) : (
            <div
              className={`
                w-full h-full bg-gradient-primary
                flex items-center justify-center
              `}
            >
              <span className="text-6xl font-black text-white/20">
                {event.short_name?.[0] || event.name[0]}
              </span>
            </div>
          )}

          {/* Overlay gradient */}
          <div
            className={`
              absolute inset-0 bg-gradient-to-t from-black/60 to-transparent
              transition-opacity duration-300
              ${isHovered ? "opacity-80" : "opacity-60"}
            `}
          />

          {/* Event Type Badge */}
          <div className="absolute top-4 left-4">
            <span
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                text-xs font-semibold backdrop-blur-sm
                bg-white/20 text-white
              `}
            >
              <Sparkles className="w-3 h-3" />
              {event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
            </span>
          </div>

          {/* Price Badge */}
          <div className="absolute top-4 right-4">
            <span
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                text-xs font-bold backdrop-blur-sm
                bg-black/40 text-white
              `}
            >
              <Ticket className="w-3 h-3" />
              {priceDisplay}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Title */}
          <h3
            className={`
              text-xl font-bold mb-2 line-clamp-2 text-foreground
              transition-colors duration-300
              ${isHovered ? "text-primary" : ""}
            `}
          >
            {event.name}
          </h3>

          {/* Tagline */}
          {event.tagline && (
            <p className="text-sm mb-4 line-clamp-2 text-muted-foreground">
              {event.tagline}
            </p>
          )}

          {/* Meta */}
          <div className="space-y-2 mb-4">
            {/* Date */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {format(new Date(event.start_date), "d MMM yyyy")}
                {event.end_date && event.end_date !== event.start_date && (
                  <> - {format(new Date(event.end_date), "d MMM yyyy")}</>
                )}
              </span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {event.venue_name ? `${event.venue_name}, ` : ""}
                {event.city}
                {event.state && `, ${event.state}`}
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="text-sm font-semibold text-primary transition-colors duration-300">
              Register Now
            </span>
            <div
              className={`
                p-2 rounded-full transition-all duration-300 bg-secondary
                ${isHovered ? "bg-gradient-primary text-white translate-x-1" : ""}
              `}
            >
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Shine effect */}
        <div
          className={`
            absolute inset-0 -translate-x-full pointer-events-none
            bg-gradient-to-r from-transparent via-white/10 to-transparent
            transition-transform duration-700 skew-x-12
            ${isHovered ? "translate-x-full" : ""}
          `}
        />
      </div>
    </Link>
  )
}

function FilterDropdown({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = options.find(o => o.value === value)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary text-sm font-medium transition-colors border border-border"
      >
        <span className="text-muted-foreground">{label}:</span>
        <span className="text-foreground">{selected?.label}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-48 py-2 rounded-xl bg-card border border-border shadow-lg z-20">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-secondary/50 transition-colors ${
                  value === option.value ? 'text-primary font-medium bg-primary/5' : 'text-foreground'
                }`}
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

export default function RegisterPage() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  // Filter states
  const [eventType, setEventType] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [priceFilter, setPriceFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date_asc")

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === "dark" : false

  // Count active filters
  const activeFilterCount = [eventType, dateFilter, priceFilter].filter(f => f !== "all").length

  const supabase = createClient()

  // Fetch events with registration open
  const { data: events, isLoading } = useQuery({
    queryKey: ["public-events", search],
    queryFn: async () => {
      // First fetch events
      let query = supabase
        .from("events")
        .select(`
          id,
          name,
          short_name,
          slug,
          tagline,
          description,
          event_type,
          start_date,
          end_date,
          city,
          state,
          venue_name,
          banner_url,
          logo_url,
          status
        `)
        .in("status", ["registration_open", "planning", "ongoing"])
        .order("start_date", { ascending: true })

      if (search) {
        query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,short_name.ilike.%${search}%`)
      }

      const { data: eventsData, error: eventsError } = await query

      if (eventsError) {
        console.error("Failed to fetch events:", eventsError.message || eventsError)
        return []
      }

      if (!eventsData || eventsData.length === 0) {
        return []
      }

      // Cast to proper type
      type EventRow = {
        id: string
        name: string
        short_name: string
        slug: string
        tagline: string | null
        description: string | null
        event_type: string
        start_date: string
        end_date: string
        city: string
        state: string | null
        venue_name: string | null
        banner_url: string | null
        logo_url: string | null
        status: string
      }
      const typedEvents = eventsData as EventRow[]

      // Try to fetch ticket types separately
      const eventIds = typedEvents.map((e) => e.id)
      const { data: ticketsData } = await (supabase as any)
        .from("ticket_types")
        .select("id, name, price, status, event_id")
        .in("event_id", eventIds)
        .eq("status", "active")

      // Merge tickets with events
      const eventsWithTickets = typedEvents.map((event) => ({
        ...event,
        ticket_types: ticketsData?.filter((t: any) => t.event_id === event.id) || [],
      }))

      return eventsWithTickets as PublicEvent[]
    },
  })

  // Apply filters and sorting client-side
  const filteredEvents = useMemo(() => {
    if (!events) return []

    let result = [...events]

    // Filter by event type
    if (eventType !== "all") {
      result = result.filter(e => e.event_type === eventType)
    }

    // Filter by date
    const now = new Date()
    if (dateFilter === "this_month") {
      const monthEnd = endOfMonth(now)
      result = result.filter(e => {
        const eventDate = new Date(e.start_date)
        return isBefore(eventDate, monthEnd) && isAfter(eventDate, now)
      })
    } else if (dateFilter === "next_month") {
      const nextMonthStart = startOfMonth(addMonths(now, 1))
      const nextMonthEnd = endOfMonth(addMonths(now, 1))
      result = result.filter(e => {
        const eventDate = new Date(e.start_date)
        return isAfter(eventDate, nextMonthStart) && isBefore(eventDate, nextMonthEnd)
      })
    } else if (dateFilter === "next_3_months") {
      const threeMonthsEnd = endOfMonth(addMonths(now, 3))
      result = result.filter(e => {
        const eventDate = new Date(e.start_date)
        return isBefore(eventDate, threeMonthsEnd)
      })
    }

    // Filter by price
    if (priceFilter !== "all") {
      result = result.filter(e => {
        const prices = e.ticket_types?.filter(t => t.status === "active").map(t => t.price) || []
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0

        switch (priceFilter) {
          case "free":
            return minPrice === 0
          case "under_5000":
            return minPrice > 0 && minPrice < 5000
          case "5000_15000":
            return minPrice >= 5000 && minPrice <= 15000
          case "above_15000":
            return minPrice > 15000
          default:
            return true
        }
      })
    }

    // Sort
    result.sort((a, b) => {
      const aMinPrice = Math.min(...(a.ticket_types?.filter(t => t.status === "active").map(t => t.price) || [0]))
      const bMinPrice = Math.min(...(b.ticket_types?.filter(t => t.status === "active").map(t => t.price) || [0]))

      switch (sortBy) {
        case "date_asc":
          return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        case "date_desc":
          return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        case "price_asc":
          return aMinPrice - bMinPrice
        case "price_desc":
          return bMinPrice - aMinPrice
        case "name_asc":
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return result
  }, [events, eventType, dateFilter, priceFilter, sortBy])

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1
          className={`
            text-4xl md:text-5xl font-black mb-4
            ${isDark ? "text-white" : "text-gray-900"}
          `}
        >
          Upcoming{" "}
          <span className="bg-gradient-primary bg-clip-text text-transparent">
            AMASI Events
          </span>
        </h1>
        <p
          className={`
            text-lg max-w-2xl mx-auto
            ${isDark ? "text-slate-400" : "text-gray-600"}
          `}
        >
          Register for conferences, workshops, and courses organized by the
          Association of Minimal Access Surgeons of India
        </p>
      </div>

      {/* Search & Filters */}
      <div className="max-w-4xl mx-auto mb-8 space-y-4">
        {/* Search Bar */}
        <div className="paper-card relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events by name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 border-0"
          />
        </div>

        {/* Filter Toggle & Quick Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
              showFilters || activeFilterCount > 0
                ? 'bg-primary text-white border-primary'
                : 'bg-secondary/50 hover:bg-secondary border-border text-foreground'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Quick Filter Pills (visible when filters active) */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {eventType !== "all" && (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
                  {EVENT_TYPES.find(t => t.value === eventType)?.label}
                  <button onClick={() => setEventType("all")} className="hover:bg-primary/20 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {dateFilter !== "all" && (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
                  {DATE_FILTERS.find(t => t.value === dateFilter)?.label}
                  <button onClick={() => setDateFilter("all")} className="hover:bg-primary/20 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {priceFilter !== "all" && (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
                  {PRICE_FILTERS.find(t => t.value === priceFilter)?.label}
                  <button onClick={() => setPriceFilter("all")} className="hover:bg-primary/20 rounded-full p-0.5">
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
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Sort Dropdown (always visible) */}
          <div className="ml-auto">
            <FilterDropdown
              label="Sort"
              value={sortBy}
              options={SORT_OPTIONS}
              onChange={setSortBy}
            />
          </div>
        </div>

        {/* Expanded Filters Panel */}
        {showFilters && (
          <div className="paper-card p-4">
            <div className="flex flex-wrap gap-4">
              <FilterDropdown
                label="Event Type"
                value={eventType}
                options={EVENT_TYPES}
                onChange={setEventType}
              />
              <FilterDropdown
                label="Date"
                value={dateFilter}
                options={DATE_FILTERS}
                onChange={setDateFilter}
              />
              <FilterDropdown
                label="Price"
                value={priceFilter}
                options={PRICE_FILTERS}
                onChange={setPriceFilter}
              />
            </div>
          </div>
        )}

        {/* Results Count */}
        {!isLoading && filteredEvents && (
          <p className="text-sm text-muted-foreground">
            Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
            {activeFilterCount > 0 && ` (filtered)`}
          </p>
        )}
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="paper-card overflow-hidden animate-pulse">
              <div className="h-48 bg-secondary" />
              <div className="p-6 space-y-4">
                <div className="h-6 rounded bg-secondary" />
                <div className="h-4 rounded w-3/4 bg-secondary" />
                <div className="h-4 rounded w-1/2 bg-secondary" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredEvents && filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event, index) => (
            <EventCard key={event.id} event={event} isDark={isDark} index={index} />
          ))}
        </div>
      ) : events && events.length > 0 ? (
        <div className="paper-card text-center py-16">
          <Filter className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold mb-2 text-foreground">
            No Matching Events
          </h3>
          <p className="text-muted-foreground mb-4">
            No events match your current filters. Try adjusting your criteria.
          </p>
          <button
            onClick={() => {
              setEventType("all")
              setDateFilter("all")
              setPriceFilter("all")
              setSearch("")
            }}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="paper-card text-center py-16">
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold mb-2 text-foreground">
            No Events Available
          </h3>
          <p className="text-muted-foreground">
            There are no events with open registration at the moment. Check back soon!
          </p>
        </div>
      )}
    </div>
  )
}
