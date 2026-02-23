"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Loader2, BadgeCheck, Award, MessageSquare, ArrowRight, Info } from "lucide-react"

export default function DelegatePortalOverviewPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const basePath = `/events/${eventId}/delegate-portal`

  const { data: registrations, isLoading: regsLoading } = useQuery({
    queryKey: ["delegate-portal-overview-regs", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, badge_generated_at, badge_downloaded_by_delegate_at, certificate_generated_at, certificate_downloaded_at, checked_in")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
      return data || []
    },
  })

  const { data: downloads, isLoading: dlLoading } = useQuery({
    queryKey: ["delegate-portal-overview-downloads", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("delegate_portal_downloads")
        .select("id, download_type")
        .eq("event_id", eventId)
      return data || []
    },
  })

  const { data: feedbackForms, isLoading: feedbackLoading } = useQuery({
    queryKey: ["delegate-portal-overview-feedback", eventId],
    queryFn: async () => {
      const { data: forms } = await (supabase as any)
        .from("forms")
        .select("id, name")
        .eq("event_id", eventId)
        .eq("form_type", "feedback")
        .eq("status", "published")
      if (!forms || forms.length === 0) return { forms: 0, totalSubmissions: 0 }
      const formIds = forms.map((f: any) => f.id)
      const { count } = await (supabase as any)
        .from("form_submissions")
        .select("*", { count: "exact", head: true })
        .in("form_id", formIds)
      return { forms: forms.length, totalSubmissions: count || 0 }
    },
  })

  const stats = useMemo(() => {
    if (!registrations) return null
    const total = registrations.length
    const badgesGenerated = registrations.filter((r: any) => r.badge_generated_at).length
    const badgesDownloaded = registrations.filter((r: any) => r.badge_downloaded_by_delegate_at).length
    const certsIssued = registrations.filter((r: any) => r.certificate_generated_at).length
    const certsDownloaded = registrations.filter((r: any) => r.certificate_downloaded_at).length
    const badgeDownloadCount = downloads?.filter((d: any) => d.download_type === "badge").length || 0
    const certDownloadCount = downloads?.filter((d: any) => d.download_type === "certificate").length || 0
    return { total, badgesGenerated, badgesDownloaded, certsIssued, certsDownloaded, badgeDownloadCount, certDownloadCount }
  }, [registrations, downloads])

  const isLoading = regsLoading || dlLoading || feedbackLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const cards = [
    {
      title: "Badge Downloads",
      icon: BadgeCheck,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      value: stats?.badgesDownloaded || 0,
      total: stats?.badgesGenerated || 0,
      label: "delegates downloaded their badge",
      totalLabel: "badges generated",
      href: `${basePath}/badges`,
    },
    {
      title: "Certificate Downloads",
      icon: Award,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      value: stats?.certsDownloaded || 0,
      total: stats?.certsIssued || 0,
      label: "delegates downloaded their certificate",
      totalLabel: "certificates issued",
      href: `${basePath}/certificates`,
    },
    {
      title: "Feedback Submitted",
      icon: MessageSquare,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      value: feedbackForms?.totalSubmissions || 0,
      total: stats?.total || 0,
      label: "feedback submissions",
      totalLabel: "confirmed attendees",
      href: `${basePath}/feedback`,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Delegate Portal Analytics</h1>
        <p className="text-muted-foreground">Track delegate self-service activity: badge downloads, certificate downloads, and feedback submissions.</p>
      </div>

      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
        <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <span className="text-amber-800 dark:text-amber-200">
          Download tracking started when this feature was deployed. Historical downloads before that point are not included in the counts.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon
          const pct = card.total > 0 ? ((card.value / card.total) * 100).toFixed(1) : "0"
          return (
            <Link key={card.title} href={card.href} className="group">
              <div className={`${card.bgColor} border rounded-lg p-5 transition-shadow hover:shadow-md`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${card.color}`} />
                    <h3 className="font-semibold">{card.title}</h3>
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
                      className={`h-full rounded-full transition-all ${
                        card.color.includes("blue") ? "bg-blue-500" :
                        card.color.includes("green") ? "bg-green-500" : "bg-purple-500"
                      }`}
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
    </div>
  )
}
