"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Loader2, BarChart3, Users, Mail, MapPin, GraduationCap, Hash, ArrowRight, AlertTriangle, Clock, FileText } from "lucide-react"
import { AnimatedStatCard } from "@/components/examination/exam-ui"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"

type Registration = {
  id: string
  registration_id: string
  name: string
  email: string
  phone: string | null
  exam_result: string | null
  exam_total_marks: number | null
  exam_marks: Record<string, any> | null
  convocation_number: string | null
  convocation_address: Record<string, any> | null
  ticket_type_name: string | null
}

export default function ConvocationPortalPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const basePath = `/events/${eventId}/examination`

  const { data: registrations, isLoading } = useQuery({
    queryKey: ["convocation-portal-analytics", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/examination/registrations?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch registrations")
      return (await res.json()) as Registration[]
    },
    enabled: !!eventId,
    staleTime: 30_000,
    refetchInterval: 30000,
  })

  const stats = useMemo(() => {
    if (!registrations) return null

    const all = registrations
    const totalPassed = all.filter((r) => r.exam_result === "pass" || r.exam_result === "without_exam").length
    const convocationAssigned = all.filter((r) => r.convocation_number).length
    const emailsSentPass = all.filter((r) => r.exam_marks?.email_sent_pass).length
    const addressCollected = all.filter((r) => r.convocation_address).length

    const withheld = all.filter((r) => r.exam_result === "withheld")
    const withoutExam = all.filter(
      (r) => r.exam_result === "without_exam" || (r.exam_result === "pass" && r.exam_marks?.remarks === "WITHOUT EXAM")
    )

    const formFilled = all.filter((r) => r.convocation_address).length

    // Recent email activity
    const recentEmails = all
      .filter((r) => r.exam_marks?.email_sent_pass || r.exam_marks?.email_sent_fail || r.exam_marks?.email_sent_withheld)
      .map((r) => {
        const emailType = r.exam_marks?.email_sent_pass
          ? "pass"
          : r.exam_marks?.email_sent_fail
          ? "fail"
          : "withheld"
        const timestamp =
          r.exam_marks?.email_sent_pass || r.exam_marks?.email_sent_fail || r.exam_marks?.email_sent_withheld
        return { name: r.name, email: r.email, type: emailType, timestamp }
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)

    return {
      totalPassed,
      convocationAssigned,
      emailsSentPass,
      addressCollected,
      withheld,
      withoutExam,
      formFilled,
      recentEmails,
    }
  }, [registrations])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const trackingCards = [
    {
      title: "Result Email Sent",
      icon: Mail,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      barColor: "bg-blue-500",
      value: stats?.emailsSentPass || 0,
      total: stats?.totalPassed || 0,
      label: "delegates received their result email",
      href: `${basePath}/results`,
    },
    {
      title: "Convocation Form Filled",
      icon: FileText,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      barColor: "bg-green-500",
      value: stats?.formFilled || 0,
      total: stats?.totalPassed || 0,
      label: "filled their convocation form",
      href: `${basePath}/address`,
    },
    {
      title: "Address Collected",
      icon: MapPin,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      barColor: "bg-purple-500",
      value: stats?.addressCollected || 0,
      total: stats?.totalPassed || 0,
      label: "submitted dispatch address",
      href: `${basePath}/address`,
    },
    {
      title: "AMASICON Registration",
      icon: Users,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
      barColor: "bg-orange-500",
      value: 0,
      total: stats?.totalPassed || 0,
      label: "Track conference registrations",
      href: "#",
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Convocation Portal
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track convocation progress: result emails, form submissions, and address collection.
        </p>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AnimatedStatCard
          label="Total Passed"
          value={stats?.totalPassed || 0}
          color="text-green-600"
          icon={<GraduationCap className="h-5 w-5 text-green-600" />}
        />
        <AnimatedStatCard
          label="Convocation Assigned"
          value={stats?.convocationAssigned || 0}
          color="text-blue-600"
          icon={<Hash className="h-5 w-5 text-blue-600" />}
        />
        <AnimatedStatCard
          label="Result Emails Sent"
          value={stats?.emailsSentPass || 0}
          color="text-purple-600"
          icon={<Mail className="h-5 w-5 text-purple-600" />}
        />
        <AnimatedStatCard
          label="Address Collected"
          value={stats?.addressCollected || 0}
          color="text-orange-600"
          icon={<MapPin className="h-5 w-5 text-orange-600" />}
        />
      </div>

      {/* Tracking Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {trackingCards.map((card) => {
          const Icon = card.icon
          const pct = card.total > 0 ? ((card.value / card.total) * 100).toFixed(1) : "0"
          return (
            <Link key={card.title} href={card.href} className="group">
              <div className={`${card.bgColor} border rounded-lg p-5 transition-shadow hover:shadow-md`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${card.color}`} />
                    <h3 className="font-semibold text-sm">{card.title}</h3>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold ${card.color}`}>{card.value}</span>
                    <span className="text-sm text-muted-foreground">/ {card.total}</span>
                  </div>
                  <div className="h-2 bg-white/60 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${card.barColor}`}
                      style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {pct}% &middot; {card.label}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Withheld Section */}
      {stats && stats.withheld.length > 0 && (
        <div className="space-y-3">
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Withheld Candidates ({stats.withheld.length})
                </h3>
              </div>
              <Link href={`${basePath}/results`}>
                <Button variant="outline" size="sm" className="gap-2 border-yellow-300 text-yellow-800 hover:bg-yellow-100">
                  <Users className="h-4 w-4" />
                  Check Membership
                </Button>
              </Link>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {stats.withheld.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-1.5 px-2 bg-white/50 dark:bg-white/5 rounded text-sm">
                  <div>
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground ml-2">{r.email}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{r.phone || "-"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Without Exam Section */}
      {stats && stats.withoutExam.length > 0 && (
        <div className="space-y-3">
          <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-slate-600" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                  Without Exam ({stats.withoutExam.length})
                </h3>
              </div>
              <Link href={`${basePath}/convocation`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowRight className="h-4 w-4" />
                  View All
                </Button>
              </Link>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {stats.withoutExam.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-1.5 px-2 bg-white/50 dark:bg-white/5 rounded text-sm">
                  <div>
                    <span className="font-medium">{r.name}</span>
                    {r.convocation_number && (
                      <span className="ml-2 font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">{r.convocation_number}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{r.email}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Timeline */}
      {stats && stats.recentEmails.length > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Recent Email Activity</h3>
          </div>
          <div className="space-y-3">
            {stats.recentEmails.map((activity, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="flex-shrink-0">
                  {activity.type === "pass" && (
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                  )}
                  {activity.type === "fail" && (
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                  )}
                  {activity.type === "withheld" && (
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{activity.name}</span>
                  <span className="text-muted-foreground ml-1">
                    received{" "}
                    <span
                      className={
                        activity.type === "pass"
                          ? "text-green-600 font-medium"
                          : activity.type === "fail"
                          ? "text-red-600 font-medium"
                          : "text-yellow-600 font-medium"
                      }
                    >
                      {activity.type}
                    </span>{" "}
                    email
                  </span>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {activity.timestamp ? format(new Date(activity.timestamp), "dd MMM, h:mm a") : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
