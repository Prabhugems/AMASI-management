"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MapPin,
  MessageSquare,
  Mic,
  Star,
  XCircle,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"

type RatingDistribution = Record<"1" | "2" | "3" | "4" | "5", number>

type Assignment = {
  id: string
  session_id: string | null
  session_name: string | null
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall: string | null
  role: string
  topic_title: string | null
  status: string
  ratings: {
    count: number
    avg_overall: number
    avg_content: number
    avg_delivery: number
    distribution: RatingDistribution
  }
  qa: Array<{
    id: string
    question: string
    answer: string | null
    upvotes: number | null
    asked_at: string | null
  }>
  attendance: {
    checked_in_at: string | null
    arrived_late: boolean
    no_show: boolean
    recorded: boolean
  }
  cme_credits: number
  content_count: number
}

type DashboardResponse = {
  event: { id: string; name: string; start_date: string | null; end_date: string | null } | null
  assignments: Assignment[]
  totals: {
    total_sessions: number
    total_ratings: number
    avg_overall: number
    total_cme_credits: number
    total_qa_received: number
    honorarium: {
      amount: number
      currency: string
      status: string
      paid_at?: string | null
    } | null
  }
  is_post_event: boolean
}

export default function SpeakerDashboardPage() {
  const params = useParams()
  const token = params.token as string

  const { data, isLoading, error } = useQuery<DashboardResponse>({
    queryKey: ["speaker-dashboard", token],
    queryFn: async () => {
      const res = await fetch(`/api/speaker/${token}/dashboard`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load dashboard")
      return json as DashboardResponse
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4">
        <div className="max-w-5xl mx-auto py-8 space-y-4" role="status" aria-label="Loading dashboard">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/10 backdrop-blur border-white/20">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-amber-400" />
            <h2 className="text-xl font-semibold text-white mb-2">Unable to load dashboard</h2>
            <p className="text-white/70 text-sm">{(error as Error).message}</p>
            <Link
              href={`/speaker/${token}`}
              className="mt-4 inline-block text-sm text-white/80 hover:text-white underline"
            >
              Back to portal
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const event = data?.event ?? null
  const assignments = data?.assignments ?? []
  const totals = data?.totals
  const isPostEvent = !!data?.is_post_event

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      <Toaster richColors position="top-right" />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <Link
              href={`/speaker/${token}`}
              className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to speaker portal
            </Link>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
              Post-event dashboard
            </h1>
            {event && (
              <p className="text-sm text-white/70 mt-1">{event.name}</p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
            onClick={() => toast.info("Attendance certificate download is coming soon")}
          >
            <Download className="h-4 w-4 mr-2" />
            Download attendance certificate
          </Button>
        </div>

        {!isPostEvent && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-sky-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-base font-semibold text-sky-100">
                Your dashboard will populate as the event runs
              </p>
              <p className="text-sm text-sky-100/80 mt-0.5">
                {event?.end_date
                  ? `Final summary lands after ${formatDate(event.end_date)}.`
                  : "Final summary will arrive after the event closes."}
              </p>
            </div>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            icon={<Mic className="h-4 w-4 text-white/70" />}
            label="Sessions"
            value={String(totals?.total_sessions ?? 0)}
          />
          <KpiCard
            icon={<Star className="h-4 w-4 text-amber-300" />}
            label="Average rating"
            valueNode={
              <div className="flex flex-col gap-1">
                <Stars value={totals?.avg_overall ?? 0} size="lg" />
                <span className="text-xs text-white/60">
                  {totals && totals.total_ratings > 0
                    ? `${(totals.avg_overall).toFixed(1)} from ${totals.total_ratings} response${totals.total_ratings === 1 ? "" : "s"}`
                    : "No responses yet"}
                </span>
              </div>
            }
          />
          <KpiCard
            icon={<MessageSquare className="h-4 w-4 text-white/70" />}
            label="Q&A received"
            value={String(totals?.total_qa_received ?? 0)}
          />
          <KpiCard
            icon={<Award className="h-4 w-4 text-emerald-300" />}
            label="CME credits"
            value={(totals?.total_cme_credits ?? 0).toFixed(1)}
            subtitle="for attendees"
          />
        </div>

        {assignments.length === 0 ? (
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="py-10">
              <EmptyState
                icon={Mic}
                title="No sessions on file for you yet"
                description="Once your organizer schedules your sessions, they'll show up here."
                className="text-white [&_h3]:text-white [&_p]:text-white/70 [&>div:first-child]:bg-white/10"
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {assignments.map((a) => (
              <AssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        )}

        {totals?.honorarium && (
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base sm:text-lg">Honorarium</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-2xl font-semibold text-white">
                    {formatCurrency(totals.honorarium.amount, totals.honorarium.currency)}
                  </div>
                  {totals.honorarium.paid_at && (
                    <div className="text-xs text-white/60 mt-1">
                      Paid on {formatDate(totals.honorarium.paid_at)}
                    </div>
                  )}
                </div>
                <HonorariumBadge status={totals.honorarium.status} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  valueNode,
  subtitle,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  valueNode?: React.ReactNode
  subtitle?: string
}) {
  return (
    <Card className="bg-white/10 backdrop-blur border-white/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-white/70 mb-2">
          {icon}
          <span>{label}</span>
        </div>
        {valueNode ? (
          valueNode
        ) : (
          <div className="text-2xl font-semibold text-white">{value}</div>
        )}
        {subtitle && !valueNode && (
          <div className="text-xs text-white/60 mt-1">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  )
}

function AssignmentCard({ assignment }: { assignment: Assignment }) {
  const [showAllQa, setShowAllQa] = useState(false)
  const visibleQa = showAllQa ? assignment.qa : assignment.qa.slice(0, 5)
  const distMax = Math.max(
    1,
    ...([1, 2, 3, 4, 5] as const).map((k) => assignment.ratings.distribution[String(k) as "1"])
  )

  return (
    <Card className="bg-white/10 backdrop-blur border-white/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-white text-base sm:text-lg">
              {assignment.topic_title || assignment.session_name || "Untitled session"}
            </CardTitle>
            {assignment.topic_title && assignment.session_name && (
              <p className="text-sm text-white/60 mt-0.5">{assignment.session_name}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
              {assignment.session_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(assignment.session_date)}
                </span>
              )}
              {assignment.start_time && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {assignment.start_time}
                  {assignment.end_time ? `–${assignment.end_time}` : ""}
                </span>
              )}
              {assignment.hall && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {assignment.hall}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Badge
              variant="outline"
              className="capitalize text-white/80 border-white/30 bg-transparent"
            >
              {assignment.role}
            </Badge>
            <AttendancePill attendance={assignment.attendance} />
            {assignment.cme_credits > 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 hover:bg-emerald-500/20">
                <Award className="h-3 w-3 mr-1" />
                {assignment.cme_credits.toFixed(1)} CME
              </Badge>
            )}
            {assignment.content_count > 0 && (
              <Badge
                variant="outline"
                className="text-white/80 border-white/30 bg-transparent"
              >
                <FileText className="h-3 w-3 mr-1" />
                {assignment.content_count} file{assignment.content_count === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ratings sub-card */}
        <div className="rounded-md border border-white/15 bg-white/5 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-amber-300" />
            <span className="text-sm font-medium text-white">Ratings</span>
            <span className="text-xs text-white/60">
              {assignment.ratings.count > 0
                ? `${assignment.ratings.count} response${assignment.ratings.count === 1 ? "" : "s"}`
                : "No responses yet"}
            </span>
          </div>
          {assignment.ratings.count > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <RatingRow
                  label="Overall"
                  value={assignment.ratings.avg_overall}
                  highlight
                />
                <RatingRow label="Content" value={assignment.ratings.avg_content} />
                <RatingRow label="Delivery" value={assignment.ratings.avg_delivery} />
              </div>
              <div className="space-y-1">
                {([5, 4, 3, 2, 1] as const).map((k) => {
                  const count = assignment.ratings.distribution[String(k) as "1"]
                  const pct = distMax > 0 ? (count / distMax) * 100 : 0
                  return (
                    <div key={k} className="flex items-center gap-2 text-xs">
                      <span className="text-white/70 w-6 text-right tabular-nums">{k}★</span>
                      <div className="flex-1 h-2 bg-white/10 rounded overflow-hidden">
                        <div
                          className="h-full bg-amber-400/70 rounded"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-white/60 w-6 tabular-nums">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/50">
              Feedback will appear here as attendees submit responses.
            </p>
          )}
        </div>

        {/* Q&A sub-card */}
        <div className="rounded-md border border-white/15 bg-white/5 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-white/70" />
            <span className="text-sm font-medium text-white">Audience Q&A</span>
            <span className="text-xs text-white/60">
              {assignment.qa.length} published
            </span>
          </div>
          {assignment.qa.length === 0 ? (
            <p className="text-xs text-white/50">No published questions yet.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {visibleQa.map((q) => (
                  <li
                    key={q.id}
                    className="rounded-md border border-white/10 bg-white/5 p-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-white/50 mt-0.5 tabular-nums">
                        ↑{q.upvotes ?? 0}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/90">{q.question}</p>
                        {q.answer && (
                          <p className="text-xs text-white/70 mt-1.5 pl-2 border-l border-white/20">
                            <span className="font-medium text-white/80">Answer: </span>
                            {q.answer}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {assignment.qa.length > 5 && (
                <button
                  type="button"
                  className="mt-3 text-xs text-white/70 hover:text-white underline"
                  onClick={() => setShowAllQa((v) => !v)}
                >
                  {showAllQa ? "Show less" : `Show all ${assignment.qa.length}`}
                </button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function RatingRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("text-xs", highlight ? "text-white" : "text-white/70")}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <Stars value={value} size={highlight ? "md" : "sm"} />
        <span
          className={cn(
            "text-xs tabular-nums",
            highlight ? "text-white" : "text-white/70"
          )}
        >
          {value > 0 ? value.toFixed(1) : "–"}
        </span>
      </div>
    </div>
  )
}

function Stars({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3 w-3"
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.25
        const half = !filled && value >= i - 0.75
        return (
          <Star
            key={i}
            className={cn(
              sizeClass,
              filled
                ? "fill-amber-400 text-amber-400"
                : half
                ? "fill-amber-400/50 text-amber-400/50"
                : "text-white/30"
            )}
          />
        )
      })}
    </div>
  )
}

function AttendancePill({
  attendance,
}: {
  attendance: Assignment["attendance"]
}) {
  if (!attendance.recorded) {
    return (
      <Badge
        variant="outline"
        className="text-white/60 border-white/20 bg-transparent"
      >
        Not recorded
      </Badge>
    )
  }
  if (attendance.no_show) {
    return (
      <Badge className="bg-red-500/20 text-red-200 border border-red-400/30 hover:bg-red-500/20">
        <XCircle className="h-3 w-3 mr-1" />
        No show
      </Badge>
    )
  }
  if (attendance.arrived_late) {
    return (
      <Badge className="bg-amber-500/20 text-amber-200 border border-amber-400/30 hover:bg-amber-500/20">
        <Clock className="h-3 w-3 mr-1" />
        Late
      </Badge>
    )
  }
  return (
    <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 hover:bg-emerald-500/20">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      Checked in
    </Badge>
  )
}

function HonorariumBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase()
  if (s === "paid") {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 hover:bg-emerald-500/20">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Paid
      </Badge>
    )
  }
  if (s === "processing" || s === "in_progress" || s === "in-progress") {
    return (
      <Badge className="bg-sky-500/20 text-sky-200 border border-sky-400/30 hover:bg-sky-500/20">
        Processing
      </Badge>
    )
  }
  if (s === "cancelled" || s === "canceled" || s === "rejected") {
    return (
      <Badge className="bg-red-500/20 text-red-200 border border-red-400/30 hover:bg-red-500/20">
        {s === "rejected" ? "Rejected" : "Cancelled"}
      </Badge>
    )
  }
  return (
    <Badge className="bg-amber-500/20 text-amber-200 border border-amber-400/30 hover:bg-amber-500/20">
      Pending
    </Badge>
  )
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(0)}`
  }
}
