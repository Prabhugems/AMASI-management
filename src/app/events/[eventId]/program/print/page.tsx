"use client"

import { useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Printer } from "lucide-react"
import { cn } from "@/lib/utils"

type Session = {
  id: string
  session_name: string
  session_type: string | null
  session_date: string
  start_time: string | null
  end_time: string | null
  hall: string | null
  speakers?: string | null
  chairpersons?: string | null
  moderators?: string | null
}

type Event = {
  id: string
  name: string
  short_name: string | null
  start_date: string
  end_date: string
  venue_name: string | null
  city: string | null
}

// "Name (email, phone) | Name2" -> "Name, Name2"
function extractNames(formatted: string | null | undefined): string {
  if (!formatted) return ""
  return formatted
    .split(/\s*\|\s*/)
    .map((p) => p.split("(")[0].trim())
    .filter(Boolean)
    .join(", ")
}

function formatTime(t: string | null | undefined): string {
  if (!t) return ""
  return t.slice(0, 5)
}

function dayLabel(dateStr: string, index: number): string {
  // dateStr is "YYYY-MM-DD"; build a local date to avoid TZ shifts
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, (m || 1) - 1, d || 1)
  const long = date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  return `Day ${index + 1} — ${long}`
}

// Non-lecture rows (breaks, exams, inauguration) render as a muted full-width band
function isBand(s: Session): boolean {
  const type = (s.session_type || "").toLowerCase()
  const hasFaculty = !!(s.speakers || s.chairpersons || s.moderators)
  return !hasFaculty && type !== "lecture"
}

export default function PrintProgramPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name, start_date, end_date, venue_name, city")
        .eq("id", eventId)
        .single()
      return data as Event | null
    },
  })

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions-print", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id, session_name, session_type, session_date, start_time, end_time, hall, speakers, chairpersons, moderators")
        .eq("event_id", eventId)
        .order("session_date", { ascending: true })
        .order("hall", { ascending: true, nullsFirst: false })
        .order("start_time", { ascending: true })
      return (data || []) as Session[]
    },
  })

  // Group sessions by date (ordered). Within a day: hall, then time (from query order).
  const grouped = useMemo(() => {
    if (!sessions) return [] as { date: string; rows: Session[] }[]
    const byDate = new Map<string, Session[]>()
    for (const s of sessions) {
      if (!byDate.has(s.session_date)) byDate.set(s.session_date, [])
      byDate.get(s.session_date)!.push(s)
    }
    return [...byDate.keys()].sort().map((date) => ({ date, rows: byDate.get(date)! }))
  }, [sessions])

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-4xl bg-white px-6 py-8 shadow-sm print:max-w-none print:shadow-none print:px-0 print:py-0">
        {/* Toolbar — hidden when printing */}
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>

        {/* Header */}
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{event?.name || "Scientific Programme"}</h1>
          {event?.venue_name && (
            <p className="mt-1 text-sm text-gray-600">
              {event.venue_name}
              {event.city ? `, ${event.city}` : ""}
            </p>
          )}
        </header>

        {isLoading && <p className="py-10 text-center text-gray-500">Loading programme…</p>}
        {!isLoading && grouped.length === 0 && (
          <p className="py-10 text-center text-gray-500">No sessions found for this event.</p>
        )}

        {grouped.length > 0 && (
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 text-left text-gray-700">
                <th className="w-28 py-2 pr-3 font-semibold">Time</th>
                <th className="py-2 pr-3 font-semibold">Topic</th>
                <th className="py-2 pr-3 font-semibold">Speaker</th>
                <th className="hidden py-2 font-semibold lg:table-cell">Chairpersons</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group, gi) => (
                <FragmentRows key={group.date} group={group} index={gi} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function FragmentRows({ group, index }: { group: { date: string; rows: Session[] }; index: number }) {
  return (
    <>
      {/* Day group header */}
      <tr>
        <th
          colSpan={4}
          className="border-y border-gray-300 bg-gray-100 px-2 py-2 text-left text-sm font-bold text-gray-900 print:bg-gray-100"
        >
          {dayLabel(group.date, index)}
        </th>
      </tr>
      {group.rows.map((s) => {
        if (isBand(s)) {
          return (
            <tr key={s.id} className="border-b border-gray-100">
              <td className="py-2 pr-3 align-top text-gray-500">
                {formatTime(s.start_time)}
                {s.end_time ? `–${formatTime(s.end_time)}` : ""}
              </td>
              <td colSpan={3} className="py-2 text-center text-xs font-medium uppercase tracking-wide text-gray-500">
                {s.session_name}
                {s.hall ? <span className="ml-2 normal-case text-gray-400">· {s.hall}</span> : null}
              </td>
            </tr>
          )
        }
        const speaker = extractNames(s.speakers)
        const chairs = extractNames(s.chairpersons)
        return (
          <tr key={s.id} className="border-b border-gray-100 align-top">
            <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
              {formatTime(s.start_time)}
              {s.end_time ? <span className="text-gray-400">–{formatTime(s.end_time)}</span> : ""}
            </td>
            <td className="py-2 pr-3">
              <div className="font-medium text-gray-900">{s.session_name}</div>
              {/* Hall + (on small screens) chairpersons fold in here */}
              <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-gray-500 lg:hidden">
                {s.hall && <span>{s.hall}</span>}
                {chairs && <span>Chairs: {chairs}</span>}
              </div>
              {s.hall && (
                <span className="mt-0.5 hidden text-xs text-gray-400 lg:inline">{s.hall}</span>
              )}
            </td>
            <td className={cn("py-2 pr-3 text-gray-700", !speaker && "text-gray-400")}>
              {speaker || "—"}
            </td>
            <td className="hidden py-2 text-gray-600 lg:table-cell">{chairs || "—"}</td>
          </tr>
        )
      })}
    </>
  )
}
