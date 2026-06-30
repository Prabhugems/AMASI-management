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

// Per-hall colour themes (assigned by hall order: LT-1 -> blue, LT-2 -> rose, ...)
const HALL_PALETTE = [
  { bar: "bg-blue-500", pill: "bg-blue-100 text-blue-800 ring-blue-300", box: "border-blue-200", head: "bg-blue-50", headText: "text-blue-900" },
  { bar: "bg-rose-500", pill: "bg-rose-100 text-rose-800 ring-rose-300", box: "border-rose-200", head: "bg-rose-50", headText: "text-rose-900" },
  { bar: "bg-emerald-500", pill: "bg-emerald-100 text-emerald-800 ring-emerald-300", box: "border-emerald-200", head: "bg-emerald-50", headText: "text-emerald-900" },
  { bar: "bg-amber-500", pill: "bg-amber-100 text-amber-900 ring-amber-300", box: "border-amber-200", head: "bg-amber-50", headText: "text-amber-900" },
  { bar: "bg-violet-500", pill: "bg-violet-100 text-violet-800 ring-violet-300", box: "border-violet-200", head: "bg-violet-50", headText: "text-violet-900" },
] as const

const NEUTRAL = { bar: "bg-gray-400", pill: "bg-gray-100 text-gray-700 ring-gray-300", box: "border-gray-200", head: "bg-gray-50", headText: "text-gray-800" }
type HallTheme = typeof HALL_PALETTE[number] | typeof NEUTRAL

function extractNames(formatted: string | null | undefined): string {
  if (!formatted) return ""
  return formatted
    .split(/\s*\|\s*/)
    .map((p) => p.split("(")[0].trim())
    .filter(Boolean)
    .join(", ")
}

function formatTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : ""
}

function timeRange(s: Session): string {
  const a = formatTime(s.start_time)
  const b = formatTime(s.end_time)
  return b ? `${a}–${b}` : a
}

function dayLabel(dateStr: string, index: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, (m || 1) - 1, d || 1)
  const long = date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  return `Day ${index + 1} — ${long}`
}

function isBand(s: Session): boolean {
  const type = (s.session_type || "").toLowerCase()
  const hasFaculty = !!(s.speakers || s.chairpersons || s.moderators)
  return !hasFaculty && type !== "lecture"
}

type Block =
  | { kind: "session"; hall: string | null; chairs: string; lectures: Session[]; seq: number }
  | { kind: "band"; session: Session }

// Split a day's rows into session boxes (consecutive same hall + same chairpersons)
// and standalone bands (breaks / exams). Session boxes are numbered per hall.
function buildBlocks(rows: Session[]): Block[] {
  const out: Block[] = []
  const seqByHall = new Map<string, number>()
  let cur: Extract<Block, { kind: "session" }> | null = null
  for (const s of rows) {
    if (isBand(s)) {
      cur = null
      out.push({ kind: "band", session: s })
      continue
    }
    const chairs = extractNames(s.chairpersons)
    const key = `${s.hall || ""}||${chairs}`
    if (!cur || `${cur.hall || ""}||${cur.chairs}` !== key) {
      const hk = s.hall || ""
      const seq = (seqByHall.get(hk) || 0) + 1
      seqByHall.set(hk, seq)
      cur = { kind: "session", hall: s.hall, chairs, lectures: [], seq }
      out.push(cur)
    }
    cur.lectures.push(s)
  }
  return out
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

  const hallList = useMemo(
    () => (sessions ? ([...new Set(sessions.map((s) => s.hall).filter(Boolean))] as string[]) : []),
    [sessions],
  )
  const hallStyle = (hall: string | null): HallTheme => {
    if (!hall) return NEUTRAL
    const i = hallList.indexOf(hall)
    return i < 0 ? NEUTRAL : HALL_PALETTE[i % HALL_PALETTE.length]
  }

  const days = useMemo(() => {
    if (!sessions) return [] as { date: string; blocks: Block[] }[]
    const byDate = new Map<string, Session[]>()
    for (const s of sessions) {
      if (!byDate.has(s.session_date)) byDate.set(s.session_date, [])
      byDate.get(s.session_date)!.push(s)
    }
    return [...byDate.keys()].sort().map((date) => ({ date, blocks: buildBlocks(byDate.get(date)!) }))
  }, [sessions])

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div
        className="mx-auto max-w-4xl bg-white px-6 py-8 shadow-sm print:max-w-none print:shadow-none print:px-0 print:py-0"
        style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
      >
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>

        <div className="mb-4 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{event?.name || "Scientific Programme"}</h1>
          {event?.venue_name && (
            <p className="mt-1 text-sm text-gray-600">
              {event.venue_name}
              {event.city ? `, ${event.city}` : ""}
            </p>
          )}
        </div>

        {hallList.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-y border-gray-200 py-2 text-xs">
            {hallList.map((h) => (
              <span key={h} className="inline-flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded-sm", hallStyle(h).bar)} />
                <span className="font-semibold text-gray-700">{h}</span>
              </span>
            ))}
          </div>
        )}

        {isLoading && <p className="py-10 text-center text-gray-500">Loading programme…</p>}
        {!isLoading && days.length === 0 && (
          <p className="py-10 text-center text-gray-500">No sessions found for this event.</p>
        )}

        <div className="space-y-6">
          {days.map((day, di) => (
            <section key={day.date}>
              <h2 className="mb-3 rounded bg-slate-800 px-3 py-2 text-sm font-bold text-white print:bg-slate-800 print:text-white">
                {dayLabel(day.date, di)}
              </h2>
              <div className="space-y-3">
                {day.blocks.map((b, bi) =>
                  b.kind === "band" ? (
                    <div key={`band-${bi}`} className="flex items-center justify-center gap-3 py-1 text-sm uppercase tracking-wide text-gray-700">
                      <span className="h-px flex-1 bg-gray-200" />
                      <span className="font-bold">
                        {b.session.session_name}
                        <span className="ml-2 font-semibold normal-case text-gray-500">{timeRange(b.session)}</span>
                      </span>
                      <span className="h-px flex-1 bg-gray-200" />
                    </div>
                  ) : (
                    <SessionBox key={`sess-${bi}`} block={b} theme={hallStyle(b.hall)} />
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function SessionBox({ block, theme }: { block: Extract<Block, { kind: "session" }>; theme: HallTheme }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border break-inside-avoid", theme.box)}>
      {/* Box header: hall + chairpersons (shown once for the whole session) */}
      <div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-1.5 text-xs", theme.head, theme.headText)}>
        <span className="inline-flex items-center gap-2 font-semibold">
          {block.hall && (
            <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset", theme.pill)}>
              {block.hall}
            </span>
          )}
          <span>Session {block.seq}</span>
        </span>
        {block.chairs && (
          <span className="text-gray-600">
            <span className="font-semibold">Chairpersons:</span> {block.chairs}
          </span>
        )}
      </div>
      {/* Lectures */}
      <table className="w-full border-collapse text-sm">
        <tbody>
          {block.lectures.map((l) => {
            const speaker = extractNames(l.speakers)
            return (
              <tr key={l.id} className="border-t border-gray-100 align-top">
                <td className="w-24 py-1.5 pr-3 pl-3 whitespace-nowrap text-gray-600">{timeRange(l)}</td>
                <td className="py-1.5 pr-3 font-medium text-gray-900">{l.session_name}</td>
                <td className={cn("w-56 py-1.5 pr-3 text-gray-700", !speaker && "text-gray-400")}>{speaker || "—"}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
