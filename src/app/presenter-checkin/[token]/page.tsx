"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Building2,
  CheckCircle,
  Clock,
  Loader2,
  QrCode,
  RefreshCw,
  Search,
  Shield,
  User,
  Zap,
  Mic,
  X,
  ScanLine,
  CheckCheck,
  FileText,
  Volume2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode"

type CoordinatorInfo = {
  id: string
  event_id: string
  hall_name: string
  coordinator_name: string
  coordinator_email: string
  portal_token: string
  event?: {
    id: string
    name: string
    short_name?: string
  }
}

type Presenter = {
  id: string
  abstract_number: string
  title: string
  presenting_author_name: string
  presenting_author_email: string
  presenting_author_affiliation?: string
  accepted_as: string
  session_date?: string
  session_time?: string
  session_location?: string
  presenter_checked_in?: boolean
  presentation_completed?: boolean
  presentation_completed_at?: string
}

type ScanResult = {
  success?: boolean
  already_presented?: boolean
  error?: string
  message?: string
  abstract?: {
    id: string
    number: string
    title: string
    presenter: string
    affiliation?: string
    presentation_type?: string
    presented_at?: string
  }
}

export default function PresenterCheckinPage() {
  const params = useParams()
  const token = params.token as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [scannerOpen, setScannerOpen] = useState(false)
  const [manualInput, setManualInput] = useState("")
  const [processing, setProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isOnline, setIsOnline] = useState(true)
  const [_scannerReady, _setScannerReady] = useState(false)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const processingRef = useRef(false)

  // Real-time clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Online status
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Fetch coordinator info
  const { data: coordinator, isLoading, error } = useQuery({
    queryKey: ["presenter-checkin-coordinator", token],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("hall_coordinators")
        .select(`*, event:events(id, name, short_name)`)
        .eq("portal_token", token)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as CoordinatorInfo | null
    },
  })

  // Fetch presenters for today/hall
  const today = currentTime.toISOString().split("T")[0]
  const { data: presenters = [], isLoading: loadingPresenters, refetch } = useQuery({
    queryKey: ["hall-presenters", coordinator?.event_id, coordinator?.hall_name, today],
    enabled: !!coordinator,
    refetchInterval: 15000,
    queryFn: async () => {
      const res = await fetch(
        `/api/abstracts/podium-checkin?event_id=${coordinator!.event_id}&date=${today}&hall=${encodeURIComponent(coordinator!.hall_name)}`
      )
      if (!res.ok) return []
      const data = await res.json()
      return (data.abstracts || []) as Presenter[]
    },
  })

  // Process scan/check-in
  const processCheckin = useCallback(async (scanData: string) => {
    if (processingRef.current || !scanData.trim()) return
    processingRef.current = true
    setProcessing(true)

    try {
      const res = await fetch("/api/abstracts/podium-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_data: scanData.trim(),
          hall_token: token,
          hall_name: coordinator?.hall_name,
        }),
      })

      const data = await res.json()
      setLastResult(data)

      if (data.success) {
        toast.success(data.message || "Presenter marked as presented!")
        // Play success sound
        try {
          const audio = new Audio("/sounds/success.mp3")
          audio.volume = 0.5
          audio.play().catch(() => {})
        } catch (e) {}
        queryClient.invalidateQueries({ queryKey: ["hall-presenters"] })
      } else if (data.already_presented) {
        toast.info(data.message || "Already presented")
        // Play info sound
        try {
          const audio = new Audio("/sounds/info.mp3")
          audio.volume = 0.5
          audio.play().catch(() => {})
        } catch (e) {}
      } else {
        toast.error(data.error || data.message || "Check-in failed")
        // Play error sound
        try {
          const audio = new Audio("/sounds/error.mp3")
          audio.volume = 0.5
          audio.play().catch(() => {})
        } catch (e) {}
      }
    } catch (error) {
      toast.error("Failed to process check-in")
      setLastResult({ error: "Network error" })
    } finally {
      setProcessing(false)
      processingRef.current = false
    }
  }, [coordinator, token, queryClient])

  // Scanner initialization
  useEffect(() => {
    if (!scannerOpen) {
      // Cleanup scanner when dialog closes
      if (scannerRef.current) {
        const state = scannerRef.current.getState()
        if (state === Html5QrcodeScannerState.SCANNING) {
          scannerRef.current.stop().catch(() => {})
        }
        scannerRef.current = null
      }
      return
    }

    // Initialize scanner
    const initScanner = async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader")
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            // On successful scan
            if (!processingRef.current) {
              processCheckin(decodedText)
            }
          },
          () => {
            // QR code scanning failures (ignore)
          }
        )
        _setScannerReady(true)
      } catch (err) {
        console.error("Scanner init error:", err)
        toast.error("Could not access camera")
      }
    }

    const timer = setTimeout(initScanner, 100)
    return () => clearTimeout(timer)
  }, [scannerOpen, processCheckin])

  // Manual check-in mutation
  const manualCheckinMutation = useMutation({
    mutationFn: async (abstractId: string) => {
      const res = await fetch("/api/abstracts/podium-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_data: abstractId,
          hall_token: token,
          hall_name: coordinator?.hall_name,
          notes: "Manual check-in by hall coordinator",
        }),
      })
      return res.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Marked as presented!")
        queryClient.invalidateQueries({ queryKey: ["hall-presenters"] })
      } else if (data.already_presented) {
        toast.info("Already presented")
      } else {
        toast.error(data.error || "Failed")
      }
    },
  })

  // Filter presenters
  const filteredPresenters = presenters.filter((p) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      p.abstract_number?.toLowerCase().includes(q) ||
      p.presenting_author_name?.toLowerCase().includes(q) ||
      p.title?.toLowerCase().includes(q)
    )
  })

  // Stats
  const stats = {
    total: presenters.length,
    presented: presenters.filter((p) => p.presentation_completed).length,
    pending: presenters.filter((p) => !p.presentation_completed).length,
  }

  // Format time
  const formatTime = (t?: string) => {
    if (!t) return "--:--"
    const [h, m] = t.split(":")
    const hr = parseInt(h)
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-emerald-500/30 rounded-full animate-spin border-t-emerald-500" />
            <Mic className="absolute inset-0 m-auto h-8 w-8 text-emerald-500" />
          </div>
          <p className="mt-4 text-white/60">Loading Presenter Check-in...</p>
        </div>
      </div>
    )
  }

  if (error || !coordinator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="text-white/50">Invalid or expired check-in link</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Top Bar */}
      <div className="relative z-50 bg-black/40 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500 animate-pulse" : "bg-red-500")}>
              <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500 animate-ping" : "bg-red-500")} />
            </div>
            <span className="text-xs text-white/50 font-mono">
              {currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          <button onClick={() => refetch()} disabled={loadingPresenters} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <RefreshCw className={cn("h-4 w-4 text-white/50", loadingPresenters && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/25">
              <Mic className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Presenter Check-in
              </h1>
              <p className="text-sm text-white/40">{coordinator.hall_name} • {coordinator.event?.short_name || coordinator.event?.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black font-mono tracking-tighter text-white">
              {currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-xs text-white/40">
              {currentTime.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-5 w-5 text-blue-400" />
              <span className="text-xs text-white/40">Total</span>
            </div>
            <p className="text-3xl font-black text-white">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 backdrop-blur-xl rounded-2xl p-4 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-2">
              <CheckCheck className="h-5 w-5 text-emerald-400" />
              <span className="text-xs text-emerald-400/60">Presented</span>
            </div>
            <p className="text-3xl font-black text-emerald-400">{stats.presented}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 backdrop-blur-xl rounded-2xl p-4 border border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-amber-400" />
              <span className="text-xs text-amber-400/60">Pending</span>
            </div>
            <p className="text-3xl font-black text-amber-400">{stats.pending}</p>
          </div>
        </div>

        {/* Scan Button */}
        <button
          onClick={() => setScannerOpen(true)}
          className="w-full flex items-center justify-center gap-3 p-6 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl text-white font-bold text-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all mb-6"
        >
          <QrCode className="h-8 w-8" />
          Scan Badge / QR Code
        </button>

        {/* Manual Input */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
            <Input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualInput.trim()) {
                  processCheckin(manualInput.trim())
                  setManualInput("")
                }
              }}
              className="bg-white/5 border-white/10 text-white pl-10 h-12 text-lg"
              placeholder="Enter abstract # or scan..."
            />
          </div>
          <Button
            onClick={() => {
              if (manualInput.trim()) {
                processCheckin(manualInput.trim())
                setManualInput("")
              }
            }}
            disabled={processing || !manualInput.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 h-12 px-6"
          >
            {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
          </Button>
        </div>

        {/* Last Result */}
        {lastResult && (
          <div
            className={cn(
              "p-4 rounded-2xl border mb-6 transition-all",
              lastResult.success ? "bg-emerald-500/10 border-emerald-500/30" :
              lastResult.already_presented ? "bg-blue-500/10 border-blue-500/30" :
              "bg-red-500/10 border-red-500/30"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-xl",
                lastResult.success ? "bg-emerald-500/20" :
                lastResult.already_presented ? "bg-blue-500/20" :
                "bg-red-500/20"
              )}>
                {lastResult.success ? (
                  <CheckCircle className="h-6 w-6 text-emerald-400" />
                ) : lastResult.already_presented ? (
                  <CheckCheck className="h-6 w-6 text-blue-400" />
                ) : (
                  <X className="h-6 w-6 text-red-400" />
                )}
              </div>
              <div className="flex-1">
                <p className={cn(
                  "font-semibold",
                  lastResult.success ? "text-emerald-400" :
                  lastResult.already_presented ? "text-blue-400" :
                  "text-red-400"
                )}>
                  {lastResult.message || lastResult.error}
                </p>
                {lastResult.abstract && (
                  <div className="mt-2 text-sm text-white/60">
                    <p><span className="text-white/40">Abstract:</span> {lastResult.abstract.number}</p>
                    <p className="truncate"><span className="text-white/40">Title:</span> {lastResult.abstract.title}</p>
                    <p><span className="text-white/40">Presenter:</span> {lastResult.abstract.presenter}</p>
                    {lastResult.abstract.presentation_type && (
                      <p><span className="text-white/40">Type:</span> {lastResult.abstract.presentation_type}</p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setLastResult(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-white/40" />
              </button>
            </div>
          </div>
        )}

        {/* Search Filter */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/5 border-white/10 text-white pl-10"
            placeholder="Search presenters..."
          />
        </div>

        {/* Presenters List */}
        <div className="space-y-2">
          {loadingPresenters ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-3" />
              <p className="text-white/40">Loading presenters...</p>
            </div>
          ) : filteredPresenters.length === 0 ? (
            <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
              <Mic className="h-12 w-12 mx-auto text-white/20 mb-3" />
              <p className="text-white/60 font-semibold">
                {searchQuery ? "No matching presenters" : "No presenters scheduled"}
              </p>
              <p className="text-white/40 text-sm">
                {searchQuery ? "Try a different search" : "Check back later"}
              </p>
            </div>
          ) : (
            filteredPresenters.map((presenter) => (
              <div
                key={presenter.id}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-2xl border transition-all",
                  presenter.presentation_completed
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
                  presenter.presentation_completed
                    ? "bg-emerald-500 text-white"
                    : "bg-gradient-to-br from-blue-500 to-purple-500 text-white"
                )}>
                  {presenter.presentation_completed ? (
                    <CheckCheck className="h-6 w-6" />
                  ) : (
                    presenter.presenting_author_name?.charAt(0) || "?"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-emerald-400">{presenter.abstract_number}</span>
                    <Badge variant="outline" className="text-[10px] capitalize border-white/20 text-white/60">
                      {presenter.accepted_as}
                    </Badge>
                  </div>
                  <p className="font-semibold text-white truncate">{presenter.presenting_author_name}</p>
                  <p className="text-xs text-white/40 truncate">{presenter.title}</p>
                  {presenter.session_time && (
                    <p className="text-xs text-white/30 mt-1">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {formatTime(presenter.session_time)}
                    </p>
                  )}
                </div>
                {!presenter.presentation_completed && (
                  <Button
                    size="sm"
                    onClick={() => manualCheckinMutation.mutate(presenter.abstract_number)}
                    disabled={manualCheckinMutation.isPending}
                    className="bg-emerald-500 hover:bg-emerald-600"
                  >
                    {manualCheckinMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                  </Button>
                )}
                {presenter.presentation_completed && (
                  <div className="text-right">
                    <p className="text-xs text-emerald-400 font-semibold">PRESENTED</p>
                    {presenter.presentation_completed_at && (
                      <p className="text-[10px] text-white/30">
                        {new Date(presenter.presentation_completed_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* QR Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="max-w-md bg-[#0a0a0f] border-white/10 text-white p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-emerald-400" />
              Scan Presenter Badge
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <div className="relative aspect-square bg-black rounded-2xl overflow-hidden mb-4">
              <div id="qr-reader" className="w-full h-full" />
              {processing && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-emerald-500 mx-auto mb-3" />
                    <p className="text-white/60">Processing...</p>
                  </div>
                </div>
              )}
              {!processing && lastResult?.success && (
                <div className="absolute inset-0 bg-emerald-500/90 flex items-center justify-center animate-in fade-in">
                  <div className="text-center">
                    <CheckCircle className="h-16 w-16 text-white mx-auto mb-3" />
                    <p className="text-white font-bold text-lg">Checked In!</p>
                    <p className="text-white/80 text-sm">{lastResult.abstract?.presenter}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualInput.trim()) {
                    processCheckin(manualInput.trim())
                    setManualInput("")
                  }
                }}
                className="bg-white/5 border-white/10 text-white"
                placeholder="Or type abstract #..."
              />
              <Button
                onClick={() => {
                  if (manualInput.trim()) {
                    processCheckin(manualInput.trim())
                    setManualInput("")
                  }
                }}
                disabled={processing || !manualInput.trim()}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-8">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center">
          <p className="text-white/30 text-xs">
            {coordinator.hall_name} • Presenter Check-in Hub
          </p>
        </div>
      </footer>
    </div>
  )
}
