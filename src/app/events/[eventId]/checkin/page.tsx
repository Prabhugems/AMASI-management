"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  Plus,
  QrCode,
  Users,
  CheckCircle,
  Clock,
  Pencil,
  Trash2,
  Coffee,
  UtensilsCrossed,
  Utensils,
  CalendarDays,
  ArrowLeft,
  Zap,
  Activity,
  BarChart3,
  List,
  Sparkles,
  Copy,
  ExternalLink,
  Check,
  X,
  Link2,
  Smartphone,
  Play,
  TrendingUp,
  Eye,
  ScanLine,
  RefreshCw,
  Timer,
  UserCheck,
  ChevronRight,
  Wifi,
  Radio,
  CircleDot
} from "lucide-react"
import { HelpTooltip } from "@/components/ui/help-tooltip"

interface CheckinList {
  id: string
  name: string
  description: string | null
  ticket_type_ids: string[] | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  allow_multiple_checkins: boolean
  sort_order: number
  access_token?: string  // For staff access without login (like Tito)
  stats: {
    total: number
    checkedIn: number
    remaining: number
    percentage: number
  }
}

interface TicketType {
  id: string
  name: string
}

interface RecentCheckin {
  id: string
  registration_number: string
  attendee_name: string
  checked_in_at: string
  ticket_type: string
}

export default function CheckinHubPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const eventId = params.eventId as string

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingList, setEditingList] = useState<CheckinList | null>(null)
  const [showQRModal, setShowQRModal] = useState<string | null>(null)
  const [showStaffShareModal, setShowStaffShareModal] = useState<CheckinList | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedStaffLink, setCopiedStaffLink] = useState(false)
  const [selectedList, setSelectedList] = useState<string | null>(null)
  const [showSaved, setShowSaved] = useState(false)

  // Form state
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formTicketTypeIds, setFormTicketTypeIds] = useState<string[]>([])
  const [formStartsAt, setFormStartsAt] = useState("")
  const [formEndsAt, setFormEndsAt] = useState("")
  const [formIsActive, setFormIsActive] = useState(true)
  const [formAllowMultipleCheckins, setFormAllowMultipleCheckins] = useState(false)

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`)
      const data = await res.json()
      return data as { id: string; name: string; short_name: string | null } | null
    }
  })

  // Fetch check-in lists (only active ones for Overview)
  const { data: checkinLists, isLoading } = useQuery({
    queryKey: ["checkin-lists-active", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/checkin-lists?event_id=${eventId}&active_only=true`)
      const data = await res.json()
      return Array.isArray(data) ? data as CheckinList[] : []
    },
    refetchInterval: 3000
  })

  // Fetch ticket types (include hidden for check-in restrictions)
  const { data: ticketTypes } = useQuery({
    queryKey: ["ticket-types-all", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/tickets?event_id=${eventId}&include_hidden=true`)
      const json = await res.json()
      return (json.data || []) as TicketType[]
    }
  })

  // Fetch recent check-ins for selected list
  const { data: recentCheckins } = useQuery({
    queryKey: ["recent-checkins", selectedList],
    queryFn: async () => {
      if (!selectedList) return []
      const res = await fetch(`/api/checkin/stats?event_id=${eventId}&checkin_list_id=${selectedList}`)
      const data = await res.json()
      return (data.recentCheckins || []) as RecentCheckin[]
    },
    enabled: !!selectedList,
    refetchInterval: 3000
  })

  // Auto-select first list
  useEffect(() => {
    if (checkinLists?.length && !selectedList) {
      setSelectedList(checkinLists[0].id)
    }
  }, [checkinLists, selectedList])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/checkin-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkin-lists-active", eventId] })
      setShowSaved(true)
      setTimeout(() => {
        setShowSaved(false)
        resetForm()
        setShowCreateModal(false)
      }, 1500)
    }
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/checkin-lists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkin-lists-active", eventId] })
      setShowSaved(true)
      setTimeout(() => {
        setShowSaved(false)
        resetForm()
        setEditingList(null)
      }, 1500)
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/checkin-lists?id=${id}`, {
        method: "DELETE"
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkin-lists", eventId] })
    }
  })

  const resetForm = () => {
    setFormName("")
    setFormDescription("")
    setFormTicketTypeIds([])
    setFormStartsAt("")
    setFormEndsAt("")
    setFormIsActive(true)
    setFormAllowMultipleCheckins(false)
  }

  const openEditModal = (list: CheckinList) => {
    setEditingList(list)
    setFormName(list.name)
    setFormDescription(list.description || "")
    setFormTicketTypeIds(list.ticket_type_ids || [])
    setFormStartsAt(list.starts_at ? list.starts_at.slice(0, 16) : "")
    setFormEndsAt(list.ends_at ? list.ends_at.slice(0, 16) : "")
    setFormIsActive(list.is_active)
    setFormAllowMultipleCheckins(list.allow_multiple_checkins)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      event_id: eventId,
      name: formName,
      description: formDescription || null,
      ticket_type_ids: formTicketTypeIds.length > 0 ? formTicketTypeIds : null,
      starts_at: formStartsAt || null,
      ends_at: formEndsAt || null,
      is_active: formIsActive,
      allow_multiple_checkins: formAllowMultipleCheckins
    }
    if (editingList) {
      updateMutation.mutate({ ...data, id: editingList.id })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this check-in list?")) {
      deleteMutation.mutate(id)
      if (selectedList === id) {
        setSelectedList(null)
      }
    }
  }

  const getScanUrl = (listId: string) => {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/events/${eventId}/checkin/${listId}/scan`
  }

  // Staff access URL (no login required - like Tito)
  const getStaffAccessUrl = (accessToken: string) => {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/checkin/access/${accessToken}`
  }

  const copyLink = async (listId: string) => {
    await navigator.clipboard.writeText(getScanUrl(listId))
    setCopiedId(listId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const copyStaffAccessLink = async (accessToken: string) => {
    await navigator.clipboard.writeText(getStaffAccessUrl(accessToken))
    setCopiedStaffLink(true)
    setTimeout(() => setCopiedStaffLink(false), 2000)
  }

  const openInNewWindow = (listId: string) => {
    window.open(getScanUrl(listId), "_blank", "width=500,height=800")
  }

  const openStaffAccessInNewWindow = (accessToken: string) => {
    window.open(getStaffAccessUrl(accessToken), "_blank", "width=500,height=800")
  }

  const getListIcon = (name: string, size = "w-6 h-6") => {
    const lowerName = name.toLowerCase()
    if (lowerName.includes("breakfast") || lowerName.includes("tea") || lowerName.includes("coffee")) {
      return <Coffee className={size} />
    }
    if (lowerName.includes("lunch")) {
      return <UtensilsCrossed className={size} />
    }
    if (lowerName.includes("dinner")) {
      return <Utensils className={size} />
    }
    if (lowerName.includes("workshop") || lowerName.includes("session")) {
      return <CalendarDays className={size} />
    }
    return <Users className={size} />
  }

  const getGradient = (index: number) => {
    const gradients = [
      "from-orange-500 to-amber-500",
      "from-blue-500 to-cyan-500",
      "from-purple-500 to-pink-500",
      "from-green-500 to-emerald-500",
      "from-red-500 to-rose-500",
      "from-indigo-500 to-violet-500"
    ]
    return gradients[index % gradients.length]
  }

  const getAccentColor = (index: number) => {
    const colors = ["orange", "blue", "purple", "green", "red", "indigo"]
    return colors[index % colors.length]
  }

  // Calculate totals
  const totalStats = checkinLists?.reduce(
    (acc, list) => ({
      total: acc.total + (list.stats?.total || 0),
      checkedIn: acc.checkedIn + (list.stats?.checkedIn || 0),
      remaining: acc.remaining + (list.stats?.remaining || 0)
    }),
    { total: 0, checkedIn: 0, remaining: 0 }
  ) || { total: 0, checkedIn: 0, remaining: 0 }

  const selectedListData = checkinLists?.find(l => l.id === selectedList)
  const selectedListIndex = checkinLists?.findIndex(l => l.id === selectedList) || 0

  // Calculate time ago
  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return "just now"
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Check-in Overview</h1>
            <p className="text-muted-foreground text-sm">{event?.name || "Loading..."}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm text-emerald-500 font-medium">Live</span>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-border"></div>
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-6 text-muted-foreground font-medium">Loading check-in hub...</p>
          </div>
        </div>
      ) : !checkinLists?.length ? (
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center py-20 bg-card rounded-3xl border border-border shadow-sm">
            <div className="w-32 h-32 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-16 h-16 text-emerald-500" />
            </div>
            <h3 className="mt-8 text-3xl font-bold">No Check-in Lists Yet</h3>
            <p className="mt-4 text-muted-foreground max-w-md mx-auto text-lg">
              Create lists to track attendance for different sessions like Breakfast, Lunch, Dinner.
            </p>
            <Link
              href={`/events/${eventId}/checkin/lists`}
              className="mt-10 inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-2xl hover:from-emerald-600 hover:to-cyan-600 transition-all shadow-xl shadow-emerald-500/25 font-medium text-lg"
            >
              <Plus className="w-6 h-6" />
              <span>Create Check-in Lists</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-card rounded-2xl p-5 border-2 border-border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <BarChart3 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-4xl font-bold">{checkinLists.length}</div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground font-medium">
                    Active Lists
                    <HelpTooltip content="Check-in lists let you track different entry points (Main, VIP, Lunch, etc.). Create lists from the Settings tab." />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-5 border-2 border-border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20">
                  <UserCheck className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-emerald-600">{totalStats.checkedIn}</div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground font-medium">
                    Total Checked In
                    <HelpTooltip content="Unique attendees who have checked in across all lists. Staff can scan QR codes or search by name." />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-5 border-2 border-border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Timer className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-amber-600">{totalStats.remaining}</div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground font-medium">
                    Pending
                    <HelpTooltip content="Confirmed attendees who haven't checked in yet. Numbers update in real-time." />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-5 border-2 border-border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-purple-600">
                    {totalStats.total > 0 ? Math.round((totalStats.checkedIn / totalStats.total) * 100) : 0}%
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground font-medium">
                    Overall Progress
                    <HelpTooltip content="Percentage of confirmed attendees who have checked in. Aim for 85-95% attendance." />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Lists Panel */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Check-in Lists</h2>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["checkin-lists", eventId] })}
                  className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {checkinLists.map((list, index) => (
                  <div
                    key={list.id}
                    onClick={() => setSelectedList(list.id)}
                    className={`group bg-card rounded-2xl border-2 overflow-hidden cursor-pointer transition-all shadow-sm ${
                      selectedList === list.id
                        ? "border-emerald-500 ring-2 ring-emerald-500/20"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 bg-gradient-to-br ${getGradient(index)} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                            {getListIcon(list.name, "w-7 h-7")}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{list.name}</h3>
                            {list.description && (
                              <p className="text-sm text-muted-foreground mt-0.5">{list.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Circular Progress */}
                        <div className="relative w-16 h-16 flex-shrink-0">
                          <svg className="w-16 h-16 -rotate-90">
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="6"
                              className="text-muted/50"
                            />
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              fill="none"
                              stroke="url(#gradient)"
                              strokeWidth="6"
                              strokeLinecap="round"
                              strokeDasharray={`${(list.stats?.percentage || 0) * 1.76} 176`}
                              className="transition-all duration-500"
                            />
                            <defs>
                              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#10b981" />
                                <stop offset="100%" stopColor="#06b6d4" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold">{list.stats?.percentage || 0}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className="bg-muted/50 rounded-xl px-4 py-3 border border-border">
                          <div className="text-2xl font-bold text-emerald-600">{list.stats?.checkedIn || 0}</div>
                          <div className="text-xs text-muted-foreground font-medium">Checked In</div>
                        </div>
                        <div className="bg-muted/50 rounded-xl px-4 py-3 border border-border">
                          <div className="text-2xl font-bold">{list.stats?.total || 0}</div>
                          <div className="text-xs text-muted-foreground font-medium">Total</div>
                        </div>
                        <div className="bg-muted/50 rounded-xl px-4 py-3 border border-border">
                          <div className="text-2xl font-bold text-amber-600">{list.stats?.remaining || 0}</div>
                          <div className="text-xs text-muted-foreground font-medium">Remaining</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/events/${eventId}/checkin/${list.id}/scan`)
                          }}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r ${getGradient(index)} text-white rounded-xl font-medium transition-all hover:opacity-90`}
                        >
                          <ScanLine className="w-5 h-5" />
                          Open Scanner
                        </button>
                        <Link
                          href={`/events/${eventId}/checkin/${list.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-muted hover:bg-muted/80 rounded-xl font-medium transition-colors border border-border"
                        >
                          <Eye className="w-5 h-5" />
                          <span className="hidden sm:inline">View List</span>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openInNewWindow(list.id)
                          }}
                          className="p-3 bg-muted hover:bg-muted/80 rounded-xl transition-colors border border-border"
                          title="Open in New Window"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowQRModal(list.id)
                          }}
                          className="p-3 bg-muted hover:bg-muted/80 rounded-xl transition-colors border border-border"
                          title="Show QR Code"
                        >
                          <QrCode className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            copyLink(list.id)
                          }}
                          className={`p-3 rounded-xl transition-colors border ${
                            copiedId === list.id
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : "bg-muted hover:bg-muted/80 border-border"
                          }`}
                          title="Copy Link"
                        >
                          {copiedId === list.id ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        </button>
                        <Link
                          href={`/kiosk/${eventId}/${list.id}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="p-3 bg-muted hover:bg-muted/80 rounded-xl transition-colors border border-border"
                          title="Open Kiosk"
                        >
                          <Smartphone className="w-5 h-5" />
                        </Link>
                        {list.access_token && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowStaffShareModal(list)
                            }}
                            className="p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-xl transition-colors border border-blue-500/30"
                            title="Share with Staff (No Login Required)"
                          >
                            <Users className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditModal(list)
                          }}
                          className="p-3 bg-muted hover:bg-muted/80 rounded-xl transition-colors border border-border"
                          title="Edit"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(list.id)
                          }}
                          className="p-3 bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-xl transition-colors border border-border"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Live Activity</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Wifi className="w-3 h-3" />
                  Auto-refresh
                </div>
              </div>

              <div className="bg-card rounded-2xl border-2 border-border overflow-hidden shadow-sm">
                {selectedListData && (
                  <div className="p-4 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 bg-gradient-to-br ${getGradient(selectedListIndex)} rounded-xl flex items-center justify-center text-white`}>
                        {getListIcon(selectedListData.name, "w-5 h-5")}
                      </div>
                      <div>
                        <div className="font-semibold">{selectedListData.name}</div>
                        <div className="text-xs text-muted-foreground">Recent check-ins</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 max-h-[500px] overflow-y-auto">
                  {!recentCheckins?.length ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                        <Activity className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="mt-4 text-muted-foreground text-sm">No recent check-ins</p>
                      <p className="text-muted-foreground/60 text-xs mt-1">Activity will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentCheckins.map((checkin, idx) => (
                        <div
                          key={checkin.id}
                          className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                            idx === 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-muted/50"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                            idx === 0 ? "bg-emerald-500" : "bg-muted-foreground"
                          }`}>
                            {checkin.attendee_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{checkin.attendee_name}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">#{checkin.registration_number}</span>
                              <span>•</span>
                              <span>{checkin.ticket_type}</span>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {timeAgo(checkin.checked_in_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedList && (
                  <div className="p-4 border-t border-border bg-muted/30">
                    <button
                      onClick={() => router.push(`/events/${eventId}/checkin/${selectedList}/scan`)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-cyan-600 transition-all"
                    >
                      <Play className="w-5 h-5" />
                      Start Scanning
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Share */}
              {selectedList && (
                <div className="bg-card rounded-2xl border-2 border-border p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Link2 className="w-4 h-4" />
                    <span className="font-medium">Quick Share</span>
                  </div>
                  <div className="flex gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded-lg text-xs text-muted-foreground font-mono truncate border border-border">
                      {getScanUrl(selectedList)}
                    </code>
                    <button
                      onClick={() => copyLink(selectedList)}
                      className={`p-2 rounded-lg transition-colors border ${
                        copiedId === selectedList
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground border-border"
                      }`}
                    >
                      {copiedId === selectedList ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setShowQRModal(selectedList)}
                      className="p-2 bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg transition-colors border border-border"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Staff Share Button */}
                  {selectedListData?.access_token && (
                    <button
                      onClick={() => setShowStaffShareModal(selectedListData)}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-xl font-medium transition-colors border border-blue-500/30"
                    >
                      <Users className="w-4 h-4" />
                      Share with Staff (No Login)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* QR Code Modal (for logged-in staff) */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-3xl w-full max-w-sm shadow-2xl border-2 border-border">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">QR Code</h2>
                <p className="text-sm text-muted-foreground mt-1">Scan to open scanner</p>
              </div>
              <button
                onClick={() => setShowQRModal(null)}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center">
              <div className="bg-white p-4 rounded-2xl shadow-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getScanUrl(showQRModal))}`}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
              <p className="mt-4 text-sm text-muted-foreground text-center">
                Staff can scan this QR code to open the check-in scanner on their device
              </p>
              <div className="mt-4 flex gap-2 w-full">
                <button
                  onClick={() => copyLink(showQRModal)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-muted rounded-xl hover:bg-muted/80 font-medium transition-colors border border-border"
                >
                  {copiedId === showQRModal ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedId === showQRModal ? "Copied!" : "Copy Link"}
                </button>
                <button
                  onClick={() => setShowQRModal(null)}
                  className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share with Staff Modal (no login required - like Tito) */}
      {showStaffShareModal && showStaffShareModal.access_token && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-3xl w-full max-w-md shadow-2xl border-2 border-border">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Share with Staff</h2>
                <p className="text-sm text-muted-foreground mt-1">{showStaffShareModal.name}</p>
              </div>
              <button
                onClick={() => setShowStaffShareModal(null)}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6">
              {/* Info Banner */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
                <div className="flex gap-3">
                  <Users className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">No login required!</p>
                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
                      Share this link with volunteers. They can open it on their phone and start checking people in immediately.
                    </p>
                  </div>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center mb-6">
                <div className="bg-white p-4 rounded-2xl shadow-lg">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getStaffAccessUrl(showStaffShareModal.access_token))}`}
                    alt="Staff Access QR Code"
                    className="w-48 h-48"
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground text-center">
                  Volunteers scan this to access check-in
                </p>
              </div>

              {/* Link Display */}
              <div className="bg-muted rounded-xl p-3 mb-4">
                <p className="text-xs text-muted-foreground mb-1">Staff Access Link</p>
                <p className="text-sm font-mono break-all text-foreground/80">
                  {getStaffAccessUrl(showStaffShareModal.access_token)}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => copyStaffAccessLink(showStaffShareModal.access_token!)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 font-medium transition-colors"
                >
                  {copiedStaffLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedStaffLink ? "Copied!" : "Copy Link"}
                </button>
                <button
                  onClick={() => openStaffAccessInNewWindow(showStaffShareModal.access_token!)}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-muted rounded-xl hover:bg-muted/80 font-medium transition-colors border border-border"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open
                </button>
              </div>

              {/* Share Options */}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Quick Share</p>
                <div className="flex gap-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Check-in access for ${showStaffShareModal.name}: ${getStaffAccessUrl(showStaffShareModal.access_token)}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium transition-colors"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`mailto:?subject=Check-in Access - ${showStaffShareModal.name}&body=${encodeURIComponent(`Here's your check-in access link:\n\n${getStaffAccessUrl(showStaffShareModal.access_token)}\n\nOpen this link on your phone to start checking people in. No login required!`)}`}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-muted rounded-lg hover:bg-muted/80 text-sm font-medium transition-colors border border-border"
                  >
                    Email
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingList) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-3xl w-full max-w-lg shadow-2xl border-2 border-border">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {editingList ? "Edit Check-in List" : "Create Check-in List"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {editingList ? "Update list details" : "Add a new check-in list"}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingList(null)
                  resetForm()
                }}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Breakfast, Lunch, Dinner"
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {ticketTypes && ticketTypes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Restrict to Ticket Types</label>
                  <div className="flex flex-wrap gap-2">
                    {ticketTypes.map((tt) => (
                      <button
                        key={tt.id}
                        type="button"
                        onClick={() => {
                          if (formTicketTypeIds.includes(tt.id)) {
                            setFormTicketTypeIds(formTicketTypeIds.filter((id) => id !== tt.id))
                          } else {
                            setFormTicketTypeIds([...formTicketTypeIds, tt.id])
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          formTicketTypeIds.includes(tt.id)
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-muted border-border hover:border-emerald-500/50"
                        }`}
                      >
                        {tt.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Leave empty to allow all ticket types
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Starts At</label>
                  <input
                    type="datetime-local"
                    value={formStartsAt}
                    onChange={(e) => setFormStartsAt(e.target.value)}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Ends At</label>
                  <input
                    type="datetime-local"
                    value={formEndsAt}
                    onChange={(e) => setFormEndsAt(e.target.value)}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <label className="text-sm font-medium">Allow Multiple Check-ins</label>
                  <p className="text-xs text-muted-foreground">Allow same person to check in multiple times</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormAllowMultipleCheckins(!formAllowMultipleCheckins)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    formAllowMultipleCheckins ? "bg-emerald-500" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      formAllowMultipleCheckins ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingList(null)
                    resetForm()
                  }}
                  className="flex-1 px-4 py-3 bg-muted rounded-xl hover:bg-muted/80 font-medium transition-colors border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formName.trim() || createMutation.isPending || updateMutation.isPending || showSaved}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-50 ${
                    showSaved
                      ? "bg-green-600 text-white"
                      : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
                  }`}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : showSaved
                    ? "Saved!"
                    : editingList
                    ? "Update List"
                    : "Create List"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
