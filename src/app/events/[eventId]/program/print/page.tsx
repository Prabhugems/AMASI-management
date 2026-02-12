"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Printer, LayoutGrid, List } from "lucide-react"
import { useRef, useState } from "react"

type Session = {
  id: string
  event_id: string
  session_name: string
  session_type: string
  session_date: string
  start_time: string
  end_time: string
  duration_minutes: number | null
  hall: string | null
  description: string | null
  specialty_track: string | null
}

type Event = {
  id: string
  name: string
  start_date: string
  end_date: string
  venue: string | null
  venue_name?: string | null
  city: string | null
  event_number?: string | null
}

// Hall configuration for tracks
const HALL_CONFIG: Record<string, { name: string; color: string; parallel: string }> = {
  surgery: { name: "Main Hall", color: "bg-blue-600", parallel: "Main Hall - Surgery" },
  gyne: { name: "Hall B - Gynecology", color: "bg-pink-600", parallel: "Hall B - Gynecology" },
  exam: { name: "Examination Hall", color: "bg-green-600", parallel: "Examination Hall" },
  general: { name: "Main Hall", color: "bg-gray-600", parallel: "Main Hall" },
}

export default function PrintProgramPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()
  const printRef = useRef<HTMLDivElement>(null)
  const [showSpeakerDetails, setShowSpeakerDetails] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid")

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, start_date, end_date, venue_name, city, event_number")
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

  // Determine track type from hall and specialty_track fields
  const getTrackType = (session: Session): string => {
    const hall = session.hall?.toLowerCase() || ""
    const track = session.specialty_track?.toLowerCase() || ""

    // Check hall field first (from CSV Hall column)
    if (hall) {
      if (hall.includes("common") || hall.includes("both")) return "general"
      if (hall.includes("surgery") || hall.includes("surgeon")) return "surgery"
      if (hall.includes("gyne") || hall.includes("gynec")) return "gyne"
    }

    // Check specialty_track field (from CSV Session column)
    if (track) {
      if (track.includes("gyne")) return "gyne"
      if (track.includes("exam")) return "exam"
      return "surgery"
    }

    return "general"
  }

  // Group sessions by date and track
  const getSessionsGrouped = () => {
    if (!sessions) return {}

    const grouped: Record<string, Record<string, Session[]>> = {}

    sessions.forEach((session) => {
      // Exclude hall coordinator rows (session_name is just a hall name like "HALL A", "RED HALL", etc.)
      const sessionName = (session.session_name || "").toLowerCase().trim()
      if (/^hall\s*[a-z0-9]?$/i.test(sessionName)) return
      if (/^(red|green|blue|yellow|main|conference)\s*hall/i.test(sessionName)) return

      const date = session.session_date
      const trackType = getTrackType(session)

      if (!grouped[date]) grouped[date] = {}
      if (!grouped[date][trackType]) grouped[date][trackType] = []
      grouped[date][trackType].push(session)
    })

    return grouped
  }

  const sessionsByDateAndTrack = getSessionsGrouped()
  const sortedDates = Object.keys(sessionsByDateAndTrack).sort()

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
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const parseSpeakerInfo = (session: Session) => {
    const desc = session.description || ""
    const parts = desc.split(" | ")
    return {
      name: parts[0] || "",
      email: parts[1] || "",
      phone: parts[2] || "",
    }
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

  // Check if any day has multiple tracks (parallel sessions)
  const hasParallelTracks = sortedDates.some((date) => {
    const tracks = Object.keys(sessionsByDateAndTrack[date] || {})
    return tracks.length > 1
  })

  return (
    <>
      {/* Control Bar - Hidden on Print */}
      <div className="fixed top-0 left-0 right-0 bg-background border-b z-50 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Program
          </Button>
          <div className="flex items-center gap-3">
            {hasParallelTracks && (
              <div className="flex items-center border rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded ${viewMode === "grid" ? "bg-primary text-primary-foreground" : ""}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded ${viewMode === "list" ? "bg-primary text-primary-foreground" : ""}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showSpeakerDetails}
                onChange={(e) => setShowSpeakerDetails(e.target.checked)}
                className="rounded"
              />
              Show Contact
            </label>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Save PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Printable Content */}
      <div className="pt-16 print:pt-0" ref={printRef}>
        <div className="max-w-6xl mx-auto p-6 print:p-0 print:max-w-none">
          <div className="bg-white text-black print:bg-white program-document">
            {/* Header */}
            <div className="text-center mb-6 pb-4 border-b-4 border-blue-800">
              <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-blue-900 mb-1">
                {event?.name || "Event Program"}
              </h1>
              {event?.venue_name && (
                <p className="text-base text-gray-700">
                  {event.venue_name}{event.city ? `, ${event.city}` : ""}
                </p>
              )}
              {event?.start_date && event?.end_date && (
                <p className="text-sm text-gray-600 mt-1">
                  {formatShortDate(event.start_date)} - {formatShortDate(event.end_date)}
                </p>
              )}
            </div>

            {/* Program Title */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wider">
                Scientific Program
              </h2>
            </div>

            {/* Program Content */}
            <div className="space-y-8">
              {sortedDates.map((date, dayIndex) => {
                const tracks = sessionsByDateAndTrack[date]
                const trackTypes = Object.keys(tracks).sort((a, b) => {
                  // Surgery first, then Gyne, then Exam
                  const order = { surgery: 0, general: 0, gyne: 1, exam: 2 }
                  return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0)
                })
                const isMultiTrack = trackTypes.length > 1 && viewMode === "grid"

                return (
                  <div key={date} className="day-section">
                    {/* Day Header */}
                    <div className="bg-blue-900 text-white px-4 py-2 mb-4">
                      <h3 className="text-lg font-bold">
                        Day {dayIndex + 1} — {formatDate(date)}
                      </h3>
                    </div>

                    {/* Multi-track Grid View */}
                    {isMultiTrack ? (
                      <div className={`grid gap-4 ${trackTypes.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                        {trackTypes.map((trackType) => {
                          const trackSessions = tracks[trackType]
                          const config = HALL_CONFIG[trackType] || HALL_CONFIG.general

                          return (
                            <div key={trackType} className="border rounded">
                              {/* Track Header - use parallel name when showing side by side */}
                              <div className={`${config.color} text-white px-3 py-2 text-center font-semibold text-sm`}>
                                {config.parallel}
                              </div>

                              {/* Sessions */}
                              <table className="w-full border-collapse text-xs">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border px-2 py-1 text-left w-16">Time</th>
                                    <th className="border px-2 py-1 text-left">Topic</th>
                                    <th className="border px-2 py-1 text-left w-28">Faculty</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {trackSessions.map((session, idx) => {
                                    const speaker = parseSpeakerInfo(session)
                                    const isExam = session.session_name.toLowerCase().includes("exam")

                                    return (
                                      <tr key={session.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                        <td className="border px-2 py-1 whitespace-nowrap align-top">
                                          <div className="font-semibold">{formatTime(session.start_time)}</div>
                                          <div className="text-gray-500">{formatTime(session.end_time)}</div>
                                        </td>
                                        <td className="border px-2 py-1 align-top">
                                          <div className={isExam ? "font-medium text-green-700" : "font-medium"}>
                                            {session.session_name}
                                          </div>
                                          {session.specialty_track && (
                                            <div className="text-gray-500 text-xs mt-0.5">
                                              {session.specialty_track}
                                            </div>
                                          )}
                                        </td>
                                        <td className="border px-2 py-1 align-top">
                                          {speaker.name && (
                                            <div className="font-medium">{speaker.name}</div>
                                          )}
                                          {showSpeakerDetails && speaker.phone && (
                                            <div className="text-gray-500">{speaker.phone}</div>
                                          )}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      /* Single Track List View */
                      <div className="space-y-4">
                        {trackTypes.map((trackType) => {
                          const trackSessions = tracks[trackType]
                          const config = HALL_CONFIG[trackType] || HALL_CONFIG.general

                          return (
                            <div key={trackType}>
                              {trackTypes.length > 1 && (
                                <div className={`${config.color} text-white px-3 py-1.5 mb-2 font-semibold text-sm`}>
                                  {config.name}
                                </div>
                              )}

                              <table className="w-full border-collapse text-sm">
                                <thead>
                                  <tr className="bg-blue-100">
                                    <th className="border border-blue-300 px-2 py-2 text-left w-20 font-bold text-blue-900">
                                      Time
                                    </th>
                                    <th className="border border-blue-300 px-2 py-2 text-left font-bold text-blue-900">
                                      Topic
                                    </th>
                                    <th className="border border-blue-300 px-2 py-2 text-left w-40 font-bold text-blue-900">
                                      Faculty
                                    </th>
                                    <th className="border border-blue-300 px-2 py-2 text-center w-12 font-bold text-blue-900">
                                      Min
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {trackSessions.map((session, idx) => {
                                    const speaker = parseSpeakerInfo(session)
                                    const isExam = session.session_name.toLowerCase().includes("exam") ||
                                      session.session_name.toLowerCase().includes("quiz")

                                    return (
                                      <tr key={session.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${isExam ? "bg-green-50" : ""}`}>
                                        <td className="border border-gray-300 px-2 py-1.5 align-top whitespace-nowrap">
                                          <div className="font-semibold text-xs">{formatTime(session.start_time)}</div>
                                          <div className="text-gray-500 text-xs">{formatTime(session.end_time)}</div>
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1.5 align-top">
                                          <div className="font-medium">{session.session_name}</div>
                                          {session.specialty_track && viewMode === "list" && (
                                            <div className="text-xs text-gray-500 mt-0.5">{session.specialty_track}</div>
                                          )}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1.5 align-top">
                                          {speaker.name && (
                                            <>
                                              <div className="font-medium text-gray-800">{speaker.name}</div>
                                              {showSpeakerDetails && speaker.phone && (
                                                <div className="text-xs text-gray-500">{speaker.phone}</div>
                                              )}
                                            </>
                                          )}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1.5 text-center align-top text-xs">
                                          {session.duration_minutes || "-"}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t-2 border-gray-300 text-center">
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
            font-size: 10pt;
          }

          .print\\:hidden {
            display: none !important;
          }

          .program-document {
            padding: 0 !important;
          }

          .day-section {
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 15px;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }
      `}</style>
    </>
  )
}
