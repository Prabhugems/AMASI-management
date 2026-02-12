"use client"

import { useState, use } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  ArrowLeft,
  Users,
  Mail,
  Search,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
} from "lucide-react"

interface Lead {
  id: string
  email: string
  name: string | null
  phone: string | null
  source: string
  status: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  created_at: string
  converted_at: string | null
  notes: string | null
}

export default function EventLeadsPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [_selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch event")
      return res.json()
    },
  })

  // Fetch leads
  const { data: leadsData, isLoading, refetch } = useQuery({
    queryKey: ["event-leads", eventId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        event_id: eventId,
        ...(statusFilter !== "all" && { status: statusFilter }),
      })
      const res = await fetch(`/api/analytics/leads?${params}`)
      if (!res.ok) throw new Error("Failed to fetch leads")
      return res.json()
    },
  })

  // Update lead status
  const updateLead = useMutation({
    mutationFn: async ({ leadId, status, notes }: { leadId: string; status?: string; notes?: string }) => {
      const res = await fetch("/api/analytics/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, status, notes }),
      })
      if (!res.ok) throw new Error("Failed to update lead")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-leads", eventId] })
      setSelectedLead(null)
    },
  })

  const leads: Lead[] = leadsData?.data || []
  const filteredLeads = search
    ? leads.filter(
        (l) =>
          l.email.toLowerCase().includes(search.toLowerCase()) ||
          l.name?.toLowerCase().includes(search.toLowerCase())
      )
    : leads

  const statusColors: Record<string, { bg: string; text: string; icon: any }> = {
    new: { bg: "bg-blue-100", text: "text-blue-700", icon: Clock },
    contacted: { bg: "bg-amber-100", text: "text-amber-700", icon: Mail },
    converted: { bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle },
    unsubscribed: { bg: "bg-gray-100", text: "text-gray-700", icon: XCircle },
  }

  const exportToCSV = () => {
    const headers = ["Email", "Name", "Phone", "Source", "Status", "UTM Source", "UTM Medium", "UTM Campaign", "Created At"]
    const rows = leads.map((l) => [
      l.email,
      l.name || "",
      l.phone || "",
      l.source,
      l.status,
      l.utm_source || "",
      l.utm_medium || "",
      l.utm_campaign || "",
      new Date(l.created_at).toLocaleString(),
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${event?.name || "event"}-leads-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/events/${eventId}/analytics`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-gray-500">{event?.name || "Event"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            disabled={leads.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Converted</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Leads", count: leadsData?.count || 0, color: "bg-blue-500" },
          { label: "New", count: leads.filter((l) => l.status === "new").length, color: "bg-blue-500" },
          { label: "Contacted", count: leads.filter((l) => l.status === "contacted").length, color: "bg-amber-500" },
          { label: "Converted", count: leads.filter((l) => l.status === "converted").length, color: "bg-emerald-500" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : filteredLeads.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Contact</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Source</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">UTM</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Date</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const statusStyle = statusColors[lead.status] || statusColors.new
                const StatusIcon = statusStyle.icon
                return (
                  <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{lead.name || "—"}</p>
                        <p className="text-sm text-gray-500">{lead.email}</p>
                        {lead.phone && (
                          <p className="text-sm text-gray-400">{lead.phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600 capitalize">{lead.source.replace("_", " ")}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        <StatusIcon className="w-3 h-3" />
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {lead.utm_source ? (
                        <span className="text-sm text-gray-600">
                          {lead.utm_source}
                          {lead.utm_medium && ` / ${lead.utm_medium}`}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">
                        {new Date(lead.created_at).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {lead.status === "new" && (
                          <button
                            onClick={() => updateLead.mutate({ leadId: lead.id, status: "contacted" })}
                            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                          >
                            Mark Contacted
                          </button>
                        )}
                        <a
                          href={`mailto:${lead.email}`}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Mail className="w-4 h-4 text-gray-400" />
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Leads Yet</h3>
            <p className="text-gray-500">
              Leads will appear here when visitors show interest in your event.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
