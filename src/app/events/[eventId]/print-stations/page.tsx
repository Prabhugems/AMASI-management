"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  Plus,
  QrCode,
  Printer,
  CheckCircle,
  Pencil,
  Trash2,
  ArrowLeft,
  Activity,
  BarChart3,
  Sparkles,
  Copy,
  ExternalLink,
  Check,
  X,
  Link2,
  RefreshCw,
  Layers,
  Tag,
  FileText,
  Key,
  Power,
  PowerOff,
  Monitor,
  Download
} from "lucide-react"

interface PrintStation {
  id: string
  name: string
  description: string | null
  print_mode: "label" | "overlay" | "full_badge"
  badge_template_id: string | null
  print_settings: {
    paper_size: string
    orientation: string
    rotation?: number
    printer_ip?: string
    printer_port?: number
    margins: { top: number; right: number; bottom: number; left: number }
    scale: number
    copies: number
  }
  is_active: boolean
  allow_reprint: boolean
  max_reprints: number
  auto_print: boolean
  require_checkin: boolean
  access_token: string
  token_expires_at: string | null
  ticket_type_ids: string[] | null
  total_prints: number
  unique_prints: number
  created_at: string
  badge_templates: { id: string; name: string } | null
  stats: {
    totalPrints: number
    uniquePrints: number
    totalRegistrations: number
    progress: number
  }
}

interface BadgeTemplate {
  id: string
  name: string
}

interface TicketType {
  id: string
  name: string
}

const PRINT_MODES = [
  { value: "label", label: "Label", description: "Quick adhesive labels (custom size)", icon: Tag },
  { value: "overlay", label: "Overlay Print", description: "Variable data on pre-printed stock", icon: Layers },
  { value: "full_badge", label: "Full Badge", description: "Complete badge with design", icon: FileText }
]

const PAPER_SIZES = [
  { value: "4x2", label: "Label 4×2\"" },
  { value: "4x3", label: "Label 4×3\"" },
  { value: "4x6", label: "Badge 4×6\"" },
  { value: "a6", label: "A6 (105×148mm)" },
  { value: "a5", label: "A5 (148×210mm)" },
  { value: "custom", label: "Custom Size" }
]

export default function PrintStationHubPage() {
  const params = useParams()
  const _router = useRouter()
  const queryClient = useQueryClient()
  const eventId = params.eventId as string

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingStation, setEditingStation] = useState<PrintStation | null>(null)
  const [showQRModal, setShowQRModal] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showDesktopAppModal, setShowDesktopAppModal] = useState<PrintStation | null>(null)
  const [desktopCopied, setDesktopCopied] = useState(false)

  // Form state
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formPrintMode, setFormPrintMode] = useState<string>("full_badge")
  const [formTemplateId, setFormTemplateId] = useState<string>("")
  const [formPaperSize, setFormPaperSize] = useState("4x6")
  const [formOrientation, setFormOrientation] = useState("portrait")
  const [formRotation, setFormRotation] = useState(0) // 0, 90, 180, 270
  const [formPrinterIp, setFormPrinterIp] = useState("") // Zebra printer IP
  const [formAllowReprint, setFormAllowReprint] = useState(true)
  const [formMaxReprints, setFormMaxReprints] = useState(3)
  const [formAutoPrint, setFormAutoPrint] = useState(false)
  const [formRequireCheckin, setFormRequireCheckin] = useState(false)
  const [formTicketTypeIds, setFormTicketTypeIds] = useState<string[]>([])
  const [formTokenExpiry, setFormTokenExpiry] = useState("")
  const [testingPrinter, setTestingPrinter] = useState(false)
  const [printerTestResult, setPrinterTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Test printer connection
  const testPrinterConnection = async () => {
    if (!formPrinterIp) {
      setPrinterTestResult({ success: false, message: "Please enter a printer IP address" })
      return
    }

    setTestingPrinter(true)
    setPrinterTestResult(null)

    try {
      const res = await fetch("/api/print-stations/zpl-print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printer_ip: formPrinterIp,
          printer_port: 9100,
          test_print: true
        })
      })
      const data = await res.json()

      if (data.success) {
        setPrinterTestResult({ success: true, message: "Test print sent successfully! Check your printer." })
      } else {
        setPrinterTestResult({ success: false, message: data.error || "Failed to connect to printer" })
      }
    } catch (error: any) {
      setPrinterTestResult({ success: false, message: error.message || "Connection failed" })
    } finally {
      setTestingPrinter(false)
    }
  }

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`)
      return res.json()
    }
  })

  // Fetch print stations
  const { data: stations, isLoading } = useQuery({
    queryKey: ["print-stations", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/print-stations?event_id=${eventId}`)
      const data = await res.json()
      // Handle error response or ensure array
      if (data?.error || !Array.isArray(data)) {
        return [] as PrintStation[]
      }
      return data as PrintStation[]
    },
    refetchInterval: 5000
  })

  // Fetch badge templates
  const { data: templates } = useQuery({
    queryKey: ["badge-templates", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/badge-templates?event_id=${eventId}`)
      const data = await res.json()
      return (data.data || data || []) as BadgeTemplate[]
    }
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

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/print-stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-stations", eventId] })
      resetForm()
      setShowCreateModal(false)
    }
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/print-stations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-stations", eventId] })
      resetForm()
      setEditingStation(null)
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/print-stations?id=${id}`, { method: "DELETE" })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-stations", eventId] })
    }
  })

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/print-stations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "toggle_active" })
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-stations", eventId] })
    }
  })

  // Regenerate token mutation
  const regenTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/print-stations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "regenerate_token" })
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-stations", eventId] })
    }
  })

  const resetForm = () => {
    setFormName("")
    setFormDescription("")
    setFormPrintMode("full_badge")
    setFormTemplateId("")
    setFormPaperSize("4x6")
    setFormOrientation("portrait")
    setFormRotation(0)
    setFormPrinterIp("")
    setFormAllowReprint(true)
    setFormMaxReprints(3)
    setFormAutoPrint(false)
    setFormRequireCheckin(false)
    setFormTicketTypeIds([])
    setFormTokenExpiry("")
    setPrinterTestResult(null)
  }

  const openEditModal = (station: PrintStation) => {
    setEditingStation(station)
    setFormName(station.name)
    setFormDescription(station.description || "")
    setFormPrintMode(station.print_mode)
    setFormTemplateId(station.badge_template_id || "")
    setFormPaperSize(station.print_settings?.paper_size || "4x6")
    setFormOrientation(station.print_settings?.orientation || "portrait")
    setFormRotation(station.print_settings?.rotation || 0)
    setFormPrinterIp(station.print_settings?.printer_ip || "")
    setFormAllowReprint(station.allow_reprint)
    setFormMaxReprints(station.max_reprints)
    setFormAutoPrint(station.auto_print)
    setFormRequireCheckin(station.require_checkin)
    setFormTicketTypeIds(station.ticket_type_ids || [])
    setFormTokenExpiry(station.token_expires_at ? station.token_expires_at.slice(0, 16) : "")
    setPrinterTestResult(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const data = {
      event_id: eventId,
      name: formName,
      description: formDescription || null,
      print_mode: formPrintMode,
      badge_template_id: formTemplateId || null,
      print_settings: {
        paper_size: formPaperSize,
        orientation: formOrientation,
        rotation: formRotation,
        printer_ip: formPrinterIp || null,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        scale: 100,
        copies: 1
      },
      allow_reprint: formAllowReprint,
      max_reprints: formMaxReprints,
      auto_print: formAutoPrint,
      require_checkin: formRequireCheckin,
      ticket_type_ids: formTicketTypeIds.length > 0 ? formTicketTypeIds : null,
      token_expires_at: formTokenExpiry || null
    }

    if (editingStation) {
      updateMutation.mutate({ ...data, id: editingStation.id })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this print station? All print history will be lost.")) {
      deleteMutation.mutate(id)
    }
  }

  const getPrintUrl = (token: string) => {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/print/${token}`
  }

  const copyLink = async (token: string, stationId: string) => {
    await navigator.clipboard.writeText(getPrintUrl(token))
    setCopiedId(stationId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const copyDesktopSettings = async (station: PrintStation) => {
    const settings = {
      serverUrl: typeof window !== "undefined" ? window.location.origin : "",
      stationToken: station.access_token,
      printerIp: station.print_settings?.printer_ip || "",
      printerPort: station.print_settings?.printer_port || 9100,
      stationName: station.name
    }
    await navigator.clipboard.writeText(JSON.stringify(settings, null, 2))
    setDesktopCopied(true)
    setTimeout(() => setDesktopCopied(false), 2000)
  }

  const openInNewWindow = (token: string) => {
    window.open(getPrintUrl(token), "_blank", "width=600,height=800")
  }

  const getPrintModeIcon = (mode: string) => {
    const modeInfo = PRINT_MODES.find(m => m.value === mode)
    const Icon = modeInfo?.icon || FileText
    return <Icon className="w-5 h-5" />
  }

  const getPrintModeLabel = (mode: string) => {
    return PRINT_MODES.find(m => m.value === mode)?.label || mode
  }

  const getPrintModeColor = (mode: string) => {
    switch (mode) {
      case "label": return "from-amber-500 to-orange-500"
      case "overlay": return "from-purple-500 to-pink-500"
      case "full_badge": return "from-blue-500 to-cyan-500"
      default: return "from-gray-500 to-gray-600"
    }
  }

  // Calculate totals
  const stationsList = Array.isArray(stations) ? stations : []
  const totalStats = stationsList.reduce(
    (acc, s) => ({
      totalPrints: acc.totalPrints + (s.stats?.totalPrints || 0),
      uniquePrints: acc.uniquePrints + (s.stats?.uniquePrints || 0)
    }),
    { totalPrints: 0, uniquePrints: 0 }
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-xl border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/events/${eventId}`}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Printer className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Print Station Hub</h1>
                  <p className="text-sm text-muted-foreground">{event?.name || "Loading..."}</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/25 font-medium"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">New Station</span>
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-border"></div>
              <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-6 text-muted-foreground font-medium">Loading print stations...</p>
          </div>
        </div>
      ) : !stationsList.length ? (
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center py-20 bg-card rounded-3xl border border-border shadow-sm">
            <div className="w-32 h-32 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-16 h-16 text-purple-500" />
            </div>
            <h3 className="mt-8 text-3xl font-bold">Create Your First Print Station</h3>
            <p className="mt-4 text-muted-foreground max-w-md mx-auto text-lg">
              Set up print stations for on-spot badge printing. Share links with staff for kiosk-style printing.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              {PRINT_MODES.map(mode => (
                <button
                  key={mode.value}
                  onClick={() => {
                    setFormPrintMode(mode.value)
                    setFormPaperSize(mode.value === "label" ? "4x2" : "4x6")
                    setShowCreateModal(true)
                  }}
                  className={`group flex items-center gap-3 px-6 py-4 bg-gradient-to-r ${getPrintModeColor(mode.value)} text-white rounded-2xl hover:opacity-90 transition-all shadow-xl font-medium`}
                >
                  <mode.icon className="w-6 h-6" />
                  <div className="text-left">
                    <div>{mode.label}</div>
                    <div className="text-xs opacity-80">{mode.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-card rounded-2xl p-5 border-2 border-border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Printer className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-4xl font-bold">{stationsList.length}</div>
                  <div className="text-sm text-muted-foreground font-medium">Stations</div>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-5 border-2 border-border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20">
                  <CheckCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-emerald-600">{totalStats.uniquePrints}</div>
                  <div className="text-sm text-muted-foreground font-medium">Badges Printed</div>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-5 border-2 border-border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <BarChart3 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-blue-600">{totalStats.totalPrints}</div>
                  <div className="text-sm text-muted-foreground font-medium">Total Prints</div>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-5 border-2 border-border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Activity className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-amber-600">
                    {stationsList.filter(s => s.is_active).length}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">Active</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stations Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {stationsList.map((station) => (
              <div
                key={station.id}
                className={`bg-card rounded-2xl border-2 overflow-hidden shadow-sm transition-all ${
                  station.is_active ? "border-border" : "border-destructive/30 opacity-70"
                }`}
              >
                {/* Header */}
                <div className="p-5 border-b border-border">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${getPrintModeColor(station.print_mode)} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                        {getPrintModeIcon(station.print_mode)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{station.name}</h3>
                          {station.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-xs font-medium rounded-full border border-emerald-500/20">
                              <Power className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-destructive/10 text-destructive text-xs font-medium rounded-full border border-destructive/20">
                              <PowerOff className="w-3 h-3" />
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-sm text-muted-foreground">{getPrintModeLabel(station.print_mode)}</span>
                          {station.badge_templates && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground">{station.badge_templates.name}</span>
                            </>
                          )}
                          {station.print_settings?.printer_ip && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="inline-flex items-center gap-1 text-sm text-blue-600">
                                <Printer className="w-3 h-3" />
                                {station.print_settings.printer_ip}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="px-5 py-4 bg-muted/30 border-b border-border">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-2xl font-bold">0</div>
                      <div className="text-xs text-muted-foreground">Active Devices</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{station.stats?.totalPrints || 0}</div>
                      <div className="text-xs text-muted-foreground">Total Prints</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-600">{station.stats?.uniquePrints || 0}</div>
                      <div className="text-xs text-muted-foreground">Participants</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{station.stats?.progress || 0}%</div>
                      <div className="text-xs text-muted-foreground">Progress</div>
                    </div>
                  </div>
                </div>

                {/* Shareable Link */}
                <div className="px-5 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-muted-foreground" />
                    <code className="flex-1 text-xs text-muted-foreground font-mono truncate">
                      {getPrintUrl(station.access_token)}
                    </code>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openInNewWindow(station.access_token)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r ${getPrintModeColor(station.print_mode)} text-white rounded-xl font-medium hover:opacity-90 transition-all`}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in New Window
                    </button>
                    <button
                      onClick={() => copyLink(station.access_token, station.id)}
                      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors border ${
                        copiedId === station.id
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : "bg-muted hover:bg-muted/80 border-border"
                      }`}
                    >
                      {copiedId === station.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedId === station.id ? "Copied!" : "Copy Link"}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowDesktopAppModal(station)}
                      className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 rounded-lg text-sm font-medium transition-colors border border-indigo-500/20"
                    >
                      <Monitor className="w-4 h-4" />
                      Desktop App
                    </button>
                    <button
                      onClick={() => setShowQRModal(station.access_token)}
                      className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors border border-border"
                    >
                      <QrCode className="w-4 h-4" />
                      QR Code
                    </button>
                    <button
                      onClick={() => openEditModal(station)}
                      className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors border border-border"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => toggleMutation.mutate(station.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors border border-border"
                    >
                      {station.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      {station.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => regenTokenMutation.mutate(station.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors border border-border"
                    >
                      <Key className="w-4 h-4" />
                      New Token
                    </button>
                    <button
                      onClick={() => handleDelete(station.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg text-sm font-medium transition-colors border border-destructive/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingStation) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card rounded-3xl w-full max-w-lg shadow-2xl border-2 border-border my-8">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-bold">
                {editingStation ? "Edit Print Station" : "Create Print Station"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {editingStation ? "Update station settings" : "Create a new print station with shareable link"}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold mb-2">List Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Main Registration Desk"
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder-muted-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Print Mode *</label>
                <select
                  value={formPrintMode}
                  onChange={(e) => {
                    setFormPrintMode(e.target.value)
                    if (e.target.value === "label") setFormPaperSize("4x2")
                    else setFormPaperSize("4x6")
                  }}
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                >
                  {PRINT_MODES.map(mode => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label} - {mode.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Badge/Label Template</label>
                <select
                  value={formTemplateId}
                  onChange={(e) => setFormTemplateId(e.target.value)}
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                >
                  <option value="">Select a template...</option>
                  {templates?.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Paper Size</label>
                  <select
                    value={formPaperSize}
                    onChange={(e) => setFormPaperSize(e.target.value)}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    {PAPER_SIZES.map(size => (
                      <option key={size.value} value={size.value}>{size.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Orientation</label>
                  <select
                    value={formOrientation}
                    onChange={(e) => setFormOrientation(e.target.value)}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Rotation</label>
                  <select
                    value={formRotation}
                    onChange={(e) => setFormRotation(parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    <option value="0">0°</option>
                    <option value="90">90°</option>
                    <option value="180">180° (Zebra)</option>
                    <option value="270">270°</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Zebra Printer IP
                  <span className="font-normal text-muted-foreground ml-1">(for direct network printing)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formPrinterIp}
                    onChange={(e) => {
                      setFormPrinterIp(e.target.value)
                      setPrinterTestResult(null)
                    }}
                    placeholder="e.g., 192.168.1.100"
                    className="flex-1 px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={testPrinterConnection}
                    disabled={testingPrinter || !formPrinterIp}
                    className="px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
                  >
                    {testingPrinter ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Printer className="w-4 h-4" />
                        Test
                      </>
                    )}
                  </button>
                </div>
                {printerTestResult && (
                  <div className={`mt-2 p-3 rounded-lg text-sm flex items-center gap-2 ${
                    printerTestResult.success
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  }`}>
                    {printerTestResult.success ? (
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <X className="w-4 h-4 flex-shrink-0" />
                    )}
                    {printerTestResult.message}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">Enter IP to enable direct ZPL printing to Zebra printer. Each station can have a different printer.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Ticket Types
                  <span className="font-normal text-muted-foreground ml-1">(leave empty for all)</span>
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto bg-muted border border-border rounded-xl p-3">
                  {ticketTypes?.map((ticket) => (
                    <label key={ticket.id} className="flex items-center gap-3 p-2 hover:bg-background rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formTicketTypeIds.includes(ticket.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormTicketTypeIds([...formTicketTypeIds, ticket.id])
                          } else {
                            setFormTicketTypeIds(formTicketTypeIds.filter((id) => id !== ticket.id))
                          }
                        }}
                        className="w-4 h-4 rounded text-purple-500 bg-background border-border focus:ring-purple-500"
                      />
                      <span className="text-sm">{ticket.name}</span>
                    </label>
                  ))}
                  {!ticketTypes?.length && (
                    <p className="text-sm text-muted-foreground text-center py-2">No ticket types available</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-muted rounded-xl border border-border cursor-pointer hover:bg-muted/80">
                  <input
                    type="checkbox"
                    checked={formAutoPrint}
                    onChange={(e) => setFormAutoPrint(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-500"
                  />
                  <div>
                    <div className="font-medium text-sm">Auto Print on Scan</div>
                    <div className="text-xs text-muted-foreground">Print immediately when attendee is scanned</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-muted rounded-xl border border-border cursor-pointer hover:bg-muted/80">
                  <input
                    type="checkbox"
                    checked={formRequireCheckin}
                    onChange={(e) => setFormRequireCheckin(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-500"
                  />
                  <div>
                    <div className="font-medium text-sm">Check-in on Print</div>
                    <div className="text-xs text-muted-foreground">Automatically check-in attendee when printing</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-muted rounded-xl border border-border cursor-pointer hover:bg-muted/80">
                  <input
                    type="checkbox"
                    checked={formAllowReprint}
                    onChange={(e) => setFormAllowReprint(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-500"
                  />
                  <div>
                    <div className="font-medium text-sm">Allow Reprints</div>
                    <div className="text-xs text-muted-foreground">Allow printing badge multiple times</div>
                  </div>
                </label>
              </div>

              {formAllowReprint && (
                <div>
                  <label className="block text-sm font-semibold mb-2">Max Reprints</label>
                  <input
                    type="number"
                    value={formMaxReprints}
                    onChange={(e) => setFormMaxReprints(parseInt(e.target.value) || 1)}
                    min={1}
                    max={10}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-2">Token Expiry (Optional)</label>
                <input
                  type="datetime-local"
                  value={formTokenExpiry}
                  onChange={(e) => setFormTokenExpiry(e.target.value)}
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <p className="text-xs text-muted-foreground mt-1">The print station will stop working after this date</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setShowCreateModal(false)
                    setEditingStation(null)
                  }}
                  className="flex-1 px-5 py-3 bg-muted text-foreground rounded-xl hover:bg-muted/80 font-medium transition-colors border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 font-medium transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingStation
                    ? "Update Station"
                    : "Create Print Station"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-3xl w-full max-w-sm shadow-2xl border-2 border-border">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">QR Code</h2>
                <p className="text-sm text-muted-foreground mt-1">Scan to open print station</p>
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getPrintUrl(showQRModal))}`}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
              <p className="mt-4 text-sm text-muted-foreground text-center">
                Staff can scan this QR code to open the print station on their device
              </p>
              <div className="mt-4 flex gap-2 w-full">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getPrintUrl(showQRModal))
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-muted rounded-xl hover:bg-muted/80 font-medium transition-colors border border-border"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
                <button
                  onClick={() => setShowQRModal(null)}
                  className="flex-1 px-4 py-2.5 bg-purple-500 text-white rounded-xl hover:bg-purple-600 font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop App Modal */}
      {showDesktopAppModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-3xl w-full max-w-md shadow-2xl border-2 border-border">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-indigo-500" />
                  Desktop Print App
                </h2>
                <p className="text-sm text-muted-foreground mt-1">For offline badge printing at events</p>
              </div>
              <button
                onClick={() => setShowDesktopAppModal(null)}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Download Section */}
              <div>
                <h3 className="font-semibold text-sm mb-3">Download Printo App</h3>
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href="https://github.com/amabornsurgeons/printo/releases/latest/download/Printo-1.0.0-arm64.dmg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 px-4 py-4 bg-gradient-to-br from-gray-800 to-gray-900 text-white rounded-xl font-medium hover:opacity-90 transition-all"
                  >
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <span className="text-sm">Mac (Apple Silicon)</span>
                    <Download className="w-4 h-4 opacity-60" />
                  </a>
                  <a
                    href="https://github.com/amabornsurgeons/printo/releases/latest/download/Printo-Setup-1.0.0.exe"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 px-4 py-4 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:opacity-90 transition-all"
                  >
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 12V6.75l6-1.32v6.48L3 12zm.83 1l5.93.2v6.3l-5.94-1.3V13zm7-6.5l8.17-1.8v8.13l-8.17.16V6.5zm0 7l8.17.17v7.63L10.83 23V13.5z"/>
                    </svg>
                    <span className="text-sm">Windows</span>
                    <Download className="w-4 h-4 opacity-60" />
                  </a>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Printo v1.0.0 • Network & USB Zebra printer support
                </p>
              </div>

              {/* Settings Section */}
              <div>
                <h3 className="font-semibold text-sm mb-3">Settings for Desktop App</h3>
                <div className="space-y-3 bg-muted/50 rounded-xl p-4 border border-border">
                  <div>
                    <label className="text-xs text-muted-foreground">Server URL</label>
                    <div className="font-mono text-sm bg-background px-3 py-2 rounded-lg border border-border mt-1">
                      {typeof window !== "undefined" ? window.location.origin : ""}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Station Token</label>
                    <div className="font-mono text-sm bg-background px-3 py-2 rounded-lg border border-border mt-1 break-all">
                      {showDesktopAppModal.access_token}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Printer IP</label>
                    <div className="font-mono text-sm bg-background px-3 py-2 rounded-lg border border-border mt-1">
                      {showDesktopAppModal.print_settings?.printer_ip || "10.0.1.12"}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Port</label>
                    <div className="font-mono text-sm bg-background px-3 py-2 rounded-lg border border-border mt-1">
                      {showDesktopAppModal.print_settings?.printer_port || 9100}
                    </div>
                  </div>
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={() => copyDesktopSettings(showDesktopAppModal)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                  desktopCopied
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                    : "bg-indigo-500 text-white hover:bg-indigo-600"
                }`}
              >
                {desktopCopied ? (
                  <>
                    <Check className="w-5 h-5" />
                    Settings Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy Settings to Clipboard
                  </>
                )}
              </button>

              <p className="text-xs text-muted-foreground text-center">
                Download the app, then paste these settings in the Settings tab
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
