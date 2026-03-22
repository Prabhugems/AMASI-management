"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Loader2,
  Calendar,
  Clock,
  MapPin,
  User,
  FileText,
  Video,
  Presentation,
  Award,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ScheduledAbstract = {
  id: string
  abstract_number: string
  title: string
  presenting_author_name: string
  presenting_author_affiliation: string | null
  presentation_type: string
  award_type: string
  accepted_as: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  scheduled_hall: string | null
  schedule_order: number | null
  category: {
    name: string
  } | null
}

type Event = {
  id: string
  name: string
  short_name: string | null
  start_date: string | null
  end_date: string | null
  venue: string | null
  city: string | null
}

export default function ProgramPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [expandedAbstract, setExpandedAbstract] = useState<string | null>(null)

  // Fetch program data
  const { data, isLoading, error } = useQuery({
    queryKey: ["program", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/program/${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch program")
      return res.json()
    },
  })

  const event: Event | null = data?.event || null
  const abstracts: ScheduledAbstract[] = data?.abstracts || []

  // Get unique dates
  const dates = useMemo(() => {
    const uniqueDates = new Set(abstracts.map((a) => a.scheduled_date).filter(Boolean))
    return Array.from(uniqueDates).sort() as string[]
  }, [abstracts])

  // Get unique halls (used in groupedByDate)
  const _halls = useMemo(() => {
    const uniqueHalls = new Set(abstracts.map((a) => a.scheduled_hall).filter(Boolean))
    return Array.from(uniqueHalls).sort() as string[]
  }, [abstracts])

  // Filter abstracts
  const filtered = useMemo(() => {
    return abstracts
      .filter((a) => {
        const matchesSearch =
          !search ||
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.abstract_number.toLowerCase().includes(search.toLowerCase()) ||
          a.presenting_author_name.toLowerCase().includes(search.toLowerCase())

        const matchesType =
          typeFilter === "all" || a.presentation_type === typeFilter

        const matchesDate =
          dateFilter === "all" || a.scheduled_date === dateFilter

        return matchesSearch && matchesType && matchesDate
      })
      .sort((a, b) => {
        // Sort by date, then time, then order
        if (a.scheduled_date !== b.scheduled_date) {
          return (a.scheduled_date || "").localeCompare(b.scheduled_date || "")
        }
        if (a.scheduled_time !== b.scheduled_time) {
          return (a.scheduled_time || "").localeCompare(b.scheduled_time || "")
        }
        return (a.schedule_order || 0) - (b.schedule_order || 0)
      })
  }, [abstracts, search, typeFilter, dateFilter])

  // Group by date and hall
  const groupedByDate = useMemo(() => {
    const groups: Record<string, Record<string, ScheduledAbstract[]>> = {}

    filtered.forEach((abstract) => {
      const date = abstract.scheduled_date || "Unscheduled"
      const hall = abstract.scheduled_hall || "Main Hall"

      if (!groups[date]) groups[date] = {}
      if (!groups[date][hall]) groups[date][hall] = []
      groups[date][hall].push(abstract)
    })

    return groups
  }, [filtered])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr || dateStr === "Unscheduled") return dateStr
    return new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return ""
    const [hours, minutes] = timeStr.split(":")
    const h = parseInt(hours)
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="mt-3 text-muted-foreground">Loading program...</p>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-xl font-semibold mb-2">Program Not Available</h1>
          <p className="text-muted-foreground">The program for this event is not yet published.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg">
              <Calendar className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{event.short_name || event.name}</h1>
              <p className="text-muted-foreground">Scientific Program</p>
            </div>
          </div>

          {(event.start_date || event.venue) && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {event.start_date && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>
                    {new Date(event.start_date).toLocaleDateString("en-IN", { month: "long", day: "numeric" })}
                    {event.end_date && event.end_date !== event.start_date &&
                      ` - ${new Date(event.end_date).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}`
                    }
                  </span>
                </div>
              )}
              {event.venue && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>{event.venue}{event.city && `, ${event.city}`}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 p-4 bg-white rounded-2xl shadow-sm border">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, author, or number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          {dates.length > 1 && (
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[180px] h-10">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Dates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                {dates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-10">
              <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="paper">Paper</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="poster">Poster</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="px-3 py-1.5">
            {filtered.length} presentation{filtered.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Program Content */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No presentations found</h3>
            <p className="text-muted-foreground">
              {abstracts.length === 0
                ? "The program hasn't been published yet"
                : "Try adjusting your search or filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedByDate).map(([date, halls]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">{formatDate(date)}</h2>
                </div>

                {/* Halls */}
                <div className="space-y-6">
                  {Object.entries(halls).map(([hall, hallAbstracts]) => (
                    <div key={hall} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                      {/* Hall Header */}
                      <div className="px-4 py-3 bg-gradient-to-r from-primary/5 to-purple-500/5 border-b flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-primary">{hall}</span>
                        <Badge variant="outline" className="ml-auto">
                          {hallAbstracts.length} presentation{hallAbstracts.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>

                      {/* Presentations */}
                      <div className="divide-y">
                        {hallAbstracts.map((abstract) => {
                          const isExpanded = expandedAbstract === abstract.id
                          return (
                            <div
                              key={abstract.id}
                              className="p-4 hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-start gap-4">
                                {/* Time */}
                                <div className="w-20 shrink-0 text-center">
                                  {abstract.scheduled_time ? (
                                    <div className="text-sm font-semibold text-primary">
                                      {formatTime(abstract.scheduled_time)}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground">TBA</div>
                                  )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-xs text-primary font-semibold">
                                          {abstract.abstract_number}
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-xs capitalize",
                                            abstract.presentation_type === "paper" && "border-blue-300 text-blue-700",
                                            abstract.presentation_type === "video" && "border-red-300 text-red-700",
                                            abstract.presentation_type === "poster" && "border-green-300 text-green-700"
                                          )}
                                        >
                                          {abstract.presentation_type === "paper" && <FileText className="h-3 w-3 mr-1" />}
                                          {abstract.presentation_type === "video" && <Video className="h-3 w-3 mr-1" />}
                                          {abstract.presentation_type === "poster" && <Presentation className="h-3 w-3 mr-1" />}
                                          {abstract.presentation_type}
                                        </Badge>
                                        {abstract.award_type === "best" && (
                                          <Badge className="text-xs bg-amber-500/20 text-amber-700 border-amber-300">
                                            <Award className="h-3 w-3 mr-1" />
                                            Award
                                          </Badge>
                                        )}
                                        {abstract.category?.name && (
                                          <Badge variant="secondary" className="text-xs">
                                            {abstract.category.name}
                                          </Badge>
                                        )}
                                      </div>
                                      <h3 className="font-medium text-gray-900 line-clamp-2">
                                        {abstract.title}
                                      </h3>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setExpandedAbstract(isExpanded ? null : abstract.id)}
                                      className="shrink-0"
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>

                                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                    <User className="h-3.5 w-3.5" />
                                    <span>{abstract.presenting_author_name}</span>
                                    {abstract.presenting_author_affiliation && (
                                      <>
                                        <span className="text-muted-foreground/50">|</span>
                                        <span className="text-xs">{abstract.presenting_author_affiliation}</span>
                                      </>
                                    )}
                                  </div>

                                  {/* Expanded Details */}
                                  {isExpanded && (
                                    <div className="mt-4 p-4 bg-muted/30 rounded-xl">
                                      <p className="text-sm text-muted-foreground">
                                        {abstract.accepted_as && (
                                          <span className="block mb-2">
                                            <strong>Accepted as:</strong> {abstract.accepted_as}
                                          </span>
                                        )}
                                        <span className="text-xs">
                                          More details will be available in the conference proceedings.
                                        </span>
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>Scientific Program - {event.name}</p>
          <p className="mt-1">Schedule is subject to change. Please check back for updates.</p>
        </div>
      </div>
    </div>
  )
}
