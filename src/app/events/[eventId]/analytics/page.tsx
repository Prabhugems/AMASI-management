"use client"

import { useState, use, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  Eye,
  Users,
  TrendingUp,
  Monitor,
  Smartphone,
  Globe,
  Link as LinkIcon,
  RefreshCw,
  UserPlus,
  ArrowRight,
  Copy,
  Check,
  Plus,
  X,
  Share2,
} from "lucide-react"

interface AnalyticsData {
  summary: {
    totalPageViews: number
    uniqueVisitors: number
    registrations: number
    leads: number
    conversionRate: number
    checkoutConversionRate: number
  }
  deviceBreakdown: {
    desktop: number
    mobile: number
    tablet: number
  }
  topReferrers: { source: string; count: number }[]
  topUtmSources: { source: string; count: number }[]
  chartData: { date: string; views: number; visitors: number }[]
  funnel: {
    eventPageViews: number
    registrationPageViews: number
    checkoutPageViews: number
    registrations: number
  }
  period: {
    days: number
    startDate: string
    endDate: string
  }
}

const PRESET_CHANNELS = [
  { name: "WhatsApp", source: "whatsapp", medium: "social", icon: "💬" },
  { name: "Email", source: "email", medium: "newsletter", icon: "📧" },
  { name: "Facebook", source: "facebook", medium: "social", icon: "📘" },
  { name: "Instagram", source: "instagram", medium: "social", icon: "📸" },
  { name: "SMS", source: "sms", medium: "direct", icon: "📱" },
  { name: "Website", source: "website", medium: "banner", icon: "🌐" },
  { name: "Twitter/X", source: "twitter", medium: "social", icon: "🐦" },
]

function UTMLinkGenerator({ eventSlug, eventShortName }: { eventSlug: string; eventShortName: string }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [customName, setCustomName] = useState("")
  const [customSource, setCustomSource] = useState("")
  const [customLinks, setCustomLinks] = useState<{ name: string; source: string; medium: string }[]>([])

  const campaign = (eventShortName || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const baseUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/register/${eventSlug}`

  const buildUrl = (source: string, medium: string) =>
    `${baseUrl}?utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}`

  const allChannels = [...PRESET_CHANNELS, ...customLinks]

  const copyToClipboard = useCallback(async (url: string, idx: number) => {
    await navigator.clipboard.writeText(url)
    setCopiedIdx(idx)
    toast.success("Link copied!")
    setTimeout(() => setCopiedIdx(null), 2000)
  }, [])

  const addCustomLink = () => {
    if (!customName.trim() || !customSource.trim()) return
    setCustomLinks(prev => [...prev, {
      name: customName.trim(),
      source: customSource.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      medium: "referral",
    }])
    setCustomName("")
    setCustomSource("")
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center gap-3 mb-4">
        <Share2 className="w-5 h-5 text-emerald-600" />
        <h2 className="text-lg font-semibold text-gray-900">UTM Link Generator</h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Share these tracked links to see which channel brings the most registrations.
      </p>

      {/* Preset channels */}
      <div className="space-y-2 mb-5">
        {allChannels.map((ch, idx) => {
          const url = buildUrl(ch.source, ch.medium)
          const isCopied = copiedIdx === idx
          return (
            <div key={idx} className="flex items-center gap-3 group">
              <span className="w-8 text-center text-lg">{"icon" in ch ? (ch as any).icon : "🔗"}</span>
              <span className="w-24 text-sm font-medium text-gray-700 shrink-0">{ch.name}</span>
              <input
                readOnly
                value={url}
                className="flex-1 text-xs bg-gray-50 border rounded-lg px-3 py-2 text-gray-600 truncate focus:outline-none cursor-pointer"
                onClick={() => copyToClipboard(url, idx)}
                title="Click to copy"
              />
              <button
                onClick={() => copyToClipboard(url, idx)}
                className="shrink-0 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Copy link"
              >
                {isCopied ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
              {idx >= PRESET_CHANNELS.length && (
                <button
                  onClick={() => setCustomLinks(prev => prev.filter((_, i) => i !== idx - PRESET_CHANNELS.length))}
                  className="shrink-0 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  title="Remove"
                >
                  <X className="w-4 h-4 text-red-400" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Add custom promoter link */}
      <div className="border-t pt-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Add Custom Promoter Link</p>
        <div className="flex items-center gap-2">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Promoter name (e.g. Dr Sharma)"
            className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
          <input
            value={customSource}
            onChange={(e) => setCustomSource(e.target.value)}
            placeholder="Source ID (e.g. dr_sharma)"
            className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            onKeyDown={(e) => e.key === "Enter" && addCustomLink()}
          />
          <button
            onClick={addCustomLink}
            disabled={!customName.trim() || !customSource.trim()}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Give each promoter a unique link. You'll see their registrations in UTM Sources above.
        </p>
      </div>
    </div>
  )
}

export default function EventAnalyticsPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const [days, setDays] = useState(30)
  const [showUtmGenerator, setShowUtmGenerator] = useState(false)

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch event")
      return res.json()
    },
  })

  // Fetch analytics data
  const { data: analytics, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["event-analytics", eventId, days],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/event/${eventId}?days=${days}`)
      if (!res.ok) throw new Error("Failed to fetch analytics")
      return res.json() as Promise<AnalyticsData>
    },
  })

  // Calculate funnel percentages
  const funnelPercentages = analytics?.funnel ? {
    registerRate: analytics.funnel.eventPageViews > 0
      ? ((analytics.funnel.registrationPageViews / analytics.funnel.eventPageViews) * 100).toFixed(1)
      : "0",
    checkoutRate: analytics.funnel.registrationPageViews > 0
      ? ((analytics.funnel.checkoutPageViews / analytics.funnel.registrationPageViews) * 100).toFixed(1)
      : "0",
    conversionRate: analytics.funnel.checkoutPageViews > 0
      ? ((analytics.funnel.registrations / analytics.funnel.checkoutPageViews) * 100).toFixed(1)
      : "0",
  } : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/events/${eventId}`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-500">{event?.name || "Event"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>

          {event?.slug && (
            <button
              onClick={() => setShowUtmGenerator(!showUtmGenerator)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${showUtmGenerator ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "hover:bg-gray-50"}`}
            >
              <Share2 className="w-4 h-4" />
              UTM Links
            </button>
          )}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* UTM Link Generator */}
      {showUtmGenerator && event?.slug && (
        <UTMLinkGenerator eventSlug={event.slug} eventShortName={event.short_name || event.name} />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : analytics ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm text-gray-500">Page Views</span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                {analytics.summary.totalPageViews.toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm text-gray-500">Unique Visitors</span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                {analytics.summary.uniqueVisitors.toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <UserPlus className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-sm text-gray-500">Registrations</span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                {analytics.summary.registrations.toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm text-gray-500">Conversion Rate</span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                {analytics.summary.conversionRate}%
              </p>
            </div>
          </div>

          {/* Funnel */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h2>
            <div className="flex items-center justify-between">
              {/* Event Page */}
              <div className="flex-1 text-center">
                <div className="w-full bg-blue-500 rounded-t-lg py-4 px-2">
                  <p className="text-white font-bold text-2xl">{analytics.funnel.eventPageViews}</p>
                  <p className="text-blue-100 text-sm">Event Page Views</p>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-300 mx-2" />

              {/* Registration Page */}
              <div className="flex-1 text-center">
                <div className="w-full bg-purple-500 rounded-t-lg py-4 px-2">
                  <p className="text-white font-bold text-2xl">{analytics.funnel.registrationPageViews}</p>
                  <p className="text-purple-100 text-sm">Registration Page</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">{funnelPercentages?.registerRate}% clicked</p>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-300 mx-2" />

              {/* Checkout */}
              <div className="flex-1 text-center">
                <div className="w-full bg-amber-500 rounded-t-lg py-4 px-2">
                  <p className="text-white font-bold text-2xl">{analytics.funnel.checkoutPageViews}</p>
                  <p className="text-amber-100 text-sm">Checkout Page</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">{funnelPercentages?.checkoutRate}% proceeded</p>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-300 mx-2" />

              {/* Registrations */}
              <div className="flex-1 text-center">
                <div className="w-full bg-emerald-500 rounded-t-lg py-4 px-2">
                  <p className="text-white font-bold text-2xl">{analytics.funnel.registrations}</p>
                  <p className="text-emerald-100 text-sm">Registered</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">{funnelPercentages?.conversionRate}% converted</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Device Breakdown */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Device Breakdown</h2>
              <div className="space-y-4">
                {[
                  { label: "Desktop", icon: Monitor, count: analytics.deviceBreakdown.desktop, color: "bg-blue-500" },
                  { label: "Mobile", icon: Smartphone, count: analytics.deviceBreakdown.mobile, color: "bg-purple-500" },
                  { label: "Tablet", icon: Smartphone, count: analytics.deviceBreakdown.tablet, color: "bg-amber-500" },
                ].map((device) => {
                  const total = analytics.deviceBreakdown.desktop + analytics.deviceBreakdown.mobile + analytics.deviceBreakdown.tablet
                  const percentage = total > 0 ? (device.count / total * 100).toFixed(1) : "0"
                  return (
                    <div key={device.label} className="flex items-center gap-3">
                      <device.icon className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{device.label}</span>
                          <span className="text-gray-500">{device.count} ({percentage}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${device.color} rounded-full`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top Referrers */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Referrers</h2>
              {analytics.topReferrers.length > 0 ? (
                <div className="space-y-3">
                  {analytics.topReferrers.map((ref, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium truncate max-w-[200px]">{ref.source}</span>
                      </div>
                      <span className="text-sm text-gray-500">{ref.count} visits</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No referrer data yet</p>
              )}
            </div>

            {/* UTM Sources */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">UTM Sources</h2>
              {analytics.topUtmSources.length > 0 ? (
                <div className="space-y-3">
                  {analytics.topUtmSources.map((utm, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">{utm.source}</span>
                      </div>
                      <span className="text-sm text-gray-500">{utm.count} visits</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No UTM tracking data yet</p>
              )}

              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={() => setShowUtmGenerator(true)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Generate tracked links →
                </button>
              </div>
            </div>

            {/* Leads */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Leads</h2>
                <Link
                  href={`/events/${eventId}/leads`}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  View All →
                </Link>
              </div>
              <div className="text-center py-4">
                <p className="text-4xl font-bold text-gray-900">{analytics.summary.leads}</p>
                <p className="text-gray-500 text-sm mt-1">Interested visitors</p>
              </div>
              <p className="text-xs text-gray-500 text-center">
                People who showed interest but haven't registered yet
              </p>
            </div>
          </div>

          {/* Daily Chart (Simple Table) */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Traffic</h2>
            {analytics.chartData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Date</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">Views</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">Visitors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.chartData.slice(-14).map((day) => (
                      <tr key={day.date} className="border-b last:border-0">
                        <td className="py-2 px-3">{new Date(day.date).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}</td>
                        <td className="text-right py-2 px-3 font-medium">{day.views}</td>
                        <td className="text-right py-2 px-3 text-gray-600">{day.visitors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No traffic data yet. Share your event link to start tracking!</p>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analytics Data Yet</h3>
          <p className="text-gray-500 mb-4">Share your event link to start tracking page views and visitors.</p>
          <p className="text-sm text-gray-400">Analytics will appear here once visitors view your event page.</p>
        </div>
      )}
    </div>
  )
}
