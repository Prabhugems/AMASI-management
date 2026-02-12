"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery, useMutation } from "@tanstack/react-query"
import {
  ArrowLeft,
  Search,
  QrCode,
  Users,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
  Clock,
  Share2,
  Copy,
  Check,
  Filter,
  UserCheck,
  UserX,
  Smartphone,
  X
} from "lucide-react"

interface Registration {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  attendee_institution: string | null
  attendee_designation: string | null
  ticket_type_id: string
  status: string
  checked_in: boolean
  checked_in_at: string | null
  checked_in_by: string | null
  ticket_types: { id: string; name: string } | null
}

interface TicketType {
  id: string
  name: string
}

interface Stats {
  list: { id: string; name: string; description: string | null }
  total: number
  checkedIn: number
  notCheckedIn: number
  percentage: number
  byTicketType: Array<{
    id: string
    name: string
    total: number
    checkedIn: number
    percentage: number
  }>
}

export default function CheckinListAttendeesPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const listId = params.listId as string

  const [search, setSearch] = useState("")
  const [ticketFilter, setTicketFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showShareModal, setShowShareModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Fetch event
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`)
      return res.json() as Promise<{ id: string; name: string; short_name: string | null }>
    }
  })

  // Fetch stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["checkin-stats", listId],
    queryFn: async () => {
      const res = await fetch(`/api/checkin/stats?event_id=${eventId}&checkin_list_id=${listId}`)
      return res.json() as Promise<Stats>
    },
    refetchInterval: 5000
  })

  // Fetch ticket types
  const { data: ticketTypes } = useQuery({
    queryKey: ["ticket-types", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/tickets?event_id=${eventId}`)
      const json = await res.json()
      return (json.data || []) as TicketType[]
    }
  })

  // Fetch registrations
  const { data: registrationsData, isLoading, refetch } = useQuery({
    queryKey: ["checkin-registrations", eventId, listId, search, ticketFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        event_id: eventId,
        checkin_list_id: listId,
        limit: "500"
      })
      if (search) params.set("q", search)
      if (ticketFilter !== "all") params.set("ticket_type_id", ticketFilter)
      if (statusFilter !== "all") params.set("checked_in", statusFilter === "checked_in" ? "true" : "false")

      const res = await fetch(`/api/checkin?${params}`)
      return res.json() as Promise<{ data: Registration[]; total: number }>
    },
    refetchInterval: 5000
  })

  // Check-in mutation
  const checkinMutation = useMutation({
    mutationFn: async ({ registrationId, action }: { registrationId: string; action: string }) => {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          checkin_list_id: listId,
          registration_id: registrationId,
          action
        })
      })
      return res.json()
    },
    onSuccess: () => {
      refetch()
      refetchStats()
    }
  })

  // Bulk check-in mutation
  const bulkCheckinMutation = useMutation({
    mutationFn: async ({ action }: { action: string }) => {
      const res = await fetch("/api/checkin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          checkin_list_id: listId,
          registration_ids: Array.from(selectedIds),
          action
        })
      })
      return res.json()
    },
    onSuccess: () => {
      setSelectedIds(new Set())
      refetch()
      refetchStats()
    }
  })

  const registrations = registrationsData?.data || []

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === registrations.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(registrations.map((r) => r.id)))
    }
  }

  const exportCSV = () => {
    const data = registrations.map((r) => ({
      "Registration #": r.registration_number,
      Name: r.attendee_name,
      Email: r.attendee_email,
      Phone: r.attendee_phone || "",
      Institution: r.attendee_institution || "",
      "Ticket Type": r.ticket_types?.name || "",
      "Checked In": r.checked_in ? "Yes" : "No",
      "Checked In At": r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : ""
    }))

    const headers = Object.keys(data[0] || {})
    const csv = [
      headers.join(","),
      ...data.map((row: Record<string, string>) => headers.map((h) => `"${row[h] || ""}"`).join(","))
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${stats?.list.name || "checkin"}-list.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const staffScanUrl = typeof window !== "undefined"
    ? `${window.location.origin}/events/${eventId}/checkin/${listId}/scan`
    : ""

  const copyLink = async () => {
    await navigator.clipboard.writeText(staffScanUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-orange-500",
      "bg-cyan-500",
      "bg-red-500",
      "bg-indigo-500"
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/events/${eventId}/checkin`}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{stats?.list?.name || "Check-in List"}</h1>
                <p className="text-sm text-gray-500">{event?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
              <button
                onClick={() => router.push(`/events/${eventId}/checkin/${listId}/scan`)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/25"
              >
                <QrCode className="w-5 h-5" />
                <span className="hidden sm:inline">Scan</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total - Click to show all */}
          <button
            onClick={() => setStatusFilter("all")}
            className={`bg-white rounded-2xl p-4 border-2 shadow-sm text-left transition-all ${
              statusFilter === "all" ? "border-blue-500 ring-2 ring-blue-500/20" : "border-gray-100 hover:border-gray-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{stats?.total || 0}</div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
            </div>
          </button>

          {/* Checked In - Click to filter */}
          <button
            onClick={() => setStatusFilter(statusFilter === "checked_in" ? "all" : "checked_in")}
            className={`bg-white rounded-2xl p-4 border-2 shadow-sm text-left transition-all ${
              statusFilter === "checked_in" ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-gray-100 hover:border-emerald-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-600">{stats?.checkedIn || 0}</div>
                <div className="text-sm text-gray-500">Checked In</div>
              </div>
            </div>
          </button>

          {/* Remaining - Click to filter */}
          <button
            onClick={() => setStatusFilter(statusFilter === "not_checked_in" ? "all" : "not_checked_in")}
            className={`bg-white rounded-2xl p-4 border-2 shadow-sm text-left transition-all ${
              statusFilter === "not_checked_in" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-gray-100 hover:border-amber-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                <UserX className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-amber-600">{stats?.notCheckedIn || 0}</div>
                <div className="text-sm text-gray-500">Remaining</div>
              </div>
            </div>
          </button>

          {/* Progress */}
          <div className="bg-white rounded-2xl p-4 border-2 border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <span className="text-white font-bold text-lg">{stats?.percentage || 0}%</span>
              </div>
              <div>
                <div className="h-2.5 w-20 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                    style={{ width: `${stats?.percentage || 0}%` }}
                  />
                </div>
                <div className="text-sm text-gray-500 mt-1">Progress</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="max-w-7xl mx-auto px-4 pb-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, phone, or registration #..."
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-colors ${
                  showFilters || ticketFilter !== "all" || statusFilter !== "all"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {(ticketFilter !== "all" || statusFilter !== "all") && (
                  <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                )}
              </button>

              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>

              <button
                onClick={() => { refetch(); refetchStats() }}
                className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter dropdowns */}
          {showFilters && (
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
              <select
                value={ticketFilter}
                onChange={(e) => setTicketFilter(e.target.value)}
                className="px-4 py-2 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Tickets</option>
                {ticketTypes?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="checked_in">Checked In</option>
                <option value="not_checked_in">Not Checked In</option>
              </select>

              {(ticketFilter !== "all" || statusFilter !== "all") && (
                <button
                  onClick={() => {
                    setTicketFilter("all")
                    setStatusFilter("all")
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
              <span className="text-sm font-semibold text-blue-700">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => bulkCheckinMutation.mutate({ action: "check_in" })}
                disabled={bulkCheckinMutation.isPending}
                className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium transition-colors"
              >
                Check In All
              </button>
              <button
                onClick={() => bulkCheckinMutation.mutate({ action: "check_out" })}
                disabled={bulkCheckinMutation.isPending}
                className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 font-medium transition-colors"
              >
                Check Out All
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Attendee List */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="relative w-12 h-12 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
              </div>
              <p className="mt-4 text-gray-500">Loading attendees...</p>
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-16 h-16 text-gray-200 mx-auto" />
              <p className="mt-4 text-gray-500 font-medium">No attendees found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-4 text-left w-12">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === registrations.length && registrations.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Attendee</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Ticket</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Time</th>
                      <th className="px-4 py-4 text-right text-sm font-semibold text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {registrations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(reg.id)}
                            onChange={() => toggleSelect(reg.id)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 ${getAvatarColor(reg.attendee_name)} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
                              {getInitials(reg.attendee_name)}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{reg.attendee_name}</div>
                              <div className="text-sm text-gray-500">{reg.attendee_email}</div>
                              <div className="text-xs text-gray-400 font-mono">{reg.registration_number}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex px-2.5 py-1 bg-gray-100 text-gray-700 text-sm rounded-lg font-medium">
                            {reg.ticket_types?.name}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {reg.checked_in ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm rounded-full font-medium">
                              <CheckCircle className="w-4 h-4" />
                              Checked In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-full font-medium">
                              <XCircle className="w-4 h-4" />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {reg.checked_in_at ? (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4" />
                              {new Date(reg.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => checkinMutation.mutate({
                              registrationId: reg.id,
                              action: reg.checked_in ? "check_out" : "check_in"
                            })}
                            disabled={checkinMutation.isPending}
                            className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${
                              reg.checked_in
                                ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                : "bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-green-500/25"
                            } disabled:opacity-50`}
                          >
                            {reg.checked_in ? "Undo" : "Check In"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile List */}
              <div className="md:hidden divide-y">
                {registrations.map((reg) => (
                  <div key={reg.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(reg.id)}
                        onChange={() => toggleSelect(reg.id)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 mt-1"
                      />
                      <div className={`w-12 h-12 ${getAvatarColor(reg.attendee_name)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
                        {getInitials(reg.attendee_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-gray-900">{reg.attendee_name}</div>
                            <div className="text-sm text-gray-500 truncate">{reg.attendee_email}</div>
                          </div>
                          {reg.checked_in ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium flex-shrink-0">
                              <CheckCircle className="w-3 h-3" />
                              In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium flex-shrink-0">
                              Pending
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs font-mono text-gray-400">{reg.registration_number}</span>
                          <span className="text-xs text-gray-300">•</span>
                          <span className="text-xs text-gray-500">{reg.ticket_types?.name}</span>
                        </div>
                        <button
                          onClick={() => checkinMutation.mutate({
                            registrationId: reg.id,
                            action: reg.checked_in ? "check_out" : "check_in"
                          })}
                          disabled={checkinMutation.isPending}
                          className={`mt-3 w-full px-4 py-2.5 text-sm rounded-xl font-medium transition-all ${
                            reg.checked_in
                              ? "bg-gray-100 text-gray-700"
                              : "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-green-500/25"
                          } disabled:opacity-50`}
                        >
                          {reg.checked_in ? "Undo Check-in" : "Check In"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Share with Staff</h2>
                <p className="text-sm text-gray-500 mt-1">Send this link to your check-in staff</p>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                  <Smartphone className="w-10 h-10 text-blue-600" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Scanner Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={staffScanUrl}
                    readOnly
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600"
                  />
                  <button
                    onClick={copyLink}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      copied
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Instructions for Staff</h4>
                <ol className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                    Open the link on your phone
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                    Type registration number or scan QR code
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                    Attendee is automatically checked in
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
