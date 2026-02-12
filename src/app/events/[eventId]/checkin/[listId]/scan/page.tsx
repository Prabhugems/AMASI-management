"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery, useMutation } from "@tanstack/react-query"
import {
  ArrowLeft,
  QrCode,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  List,
  RotateCcw,
  Trash2,
  LogOut,
  LogIn,
  Wifi,
  WifiOff,
  Keyboard,
  Clock,
  Ticket,
  X,
  Share2,
  ChevronDown,
  ChevronUp,
  Smartphone
} from "lucide-react"

interface ScanResult {
  type: "success" | "error" | "warning" | "already"
  message: string
  registrationId?: string
  attendee?: {
    name: string
    email: string
    ticket: string
    registration_number: string
    institution?: string
  }
}

interface Stats {
  list: { id: string; name: string; description: string | null }
  total: number
  checkedIn: number
  notCheckedIn: number
  percentage: number
  byTicketType?: { id: string; name: string; total: number; checkedIn: number; percentage: number }[]
}

interface RecentScan {
  id: string
  name: string
  registrationNumber: string
  registrationId?: string
  time: string
  status: "success" | "error" | "already"
}

export default function CheckinScanPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const listId = params.listId as string

  const [manualSearch, setManualSearch] = useState("")
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])
  const [checkoutMode, setCheckoutMode] = useState(false)
  const [showKeyboardHints, setShowKeyboardHints] = useState(false)
  const [showTicketStats, setShowTicketStats] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showMobileRecent, setShowMobileRecent] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [lastCheckedInId, setLastCheckedInId] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const successAudioRef = useRef<HTMLAudioElement | null>(null)
  const errorAudioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio
  useEffect(() => {
    successAudioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2NgI17cF1qfIGKhX9zam15f4eFg3htYnOBhoaAfHBrcX+ChYR/eXNwdX5/gYCAf3x5eHp8foCBgYGAf358e3t9foCAgoOCgYB+fHt7fH1+f4GCgoKBgH59fHx8fX5/gIGBgYGAf359fHx8fX5/gIGBgYGAgH59fHx8fX5/gICBgYGAgH59fHx9fX5/gICBgYGAf359fX19fn9/gICBgYCAf359fX19fn9/gICAgICAgH59fX19fn5/f4CAgICAgH9+fX19fX5+f3+AgICAgIB/fn19fX1+fn9/gICAgICAf359fX19fn5/f4CAgICAgH9+fX19fX5+f3+AgICAf4B/fn19fX1+fn9/gICAgH+Af359fX19fn5/f4CAgIB/gH9+fX19fX5+f3+AgICAf4B/fn19fX5+fn9/gICAgH+Af359fX1+fn5/f4CAgIB/gH9+fX19fn5+f3+AgICAf4B/fn59fX5+fn9/gICAgH+Af359fX1+fn5/f4CAgIB/gH9+fn19fn5+f3+AgICAf4B/fn59fX5+fn9/gICAgH+Af35+fX1+fn5/f4CAgIB/gH9+fn59fn5+f3+AgICAf4B/fn59fX5+fn9/gICAgH+Af359fX5+fn5/f4CAgIB/gH9+fn19fn5+f4CAgICAf4B/fn59fX5+fn9/gICAgH+Af35+fX1+fn5/f4CAgIB/gH9+fn59fn5+f3+AgICAf39/fn59fX5+fn9/gICAgH9/f35+fX1+fn5/f4CAgIB/f39+fn59fn5+f3+AgICAf39/fn59fX5+fn9/gICAgH9/f35+fn1+fn5/f4CAgIB/f39+fn59fn5+f3+AgIB/f39/fn59fX5+fn9/gICAgH9/f35+fn1+fn5/f4CAgH9/f39+fn59fn5+f3+AgIB/f39/fn5+fX5+fn9/gICAf39/f35+fn1+fn5/f4CAgH9/f39+fn59fn5+f3+AgIB/f39/fn5+fX5+fn9/gICAf39/f35+fn5+fn5/f4CAgH9/f39+fn59fn5+f3+AgIB/f39/fn5+fX5+fn9/gICAf39/f35+fn5+fn5/f4CAf39/f39+fn59fn5+f3+AgIB/f39/fn5+fX5+fn9/gIB/f39/f35+fn1+fn5/f4CAf39/f39+fn59fn5+f39/gH9/f39/fn5+fX5+fn9/f4B/f39/f35+fn5+fn5/f3+Af39/f39+fn59fn5+f39/gH9/f39/fn5+fn5+fn9/f4B/f39/f35+fn1+fn5/f3+Af39/f39+fn5+fn5+f39/gH9/f39/fn5+fn5+fn9/f4B/f39/f35+fn5+fn5/f3+Af39/f39+fn5+fn5+f39/gH9/f39/fn5+fn5+fn9/f4B/f39/f35+fn5+fn5/f3+Af39/f39+fn5+fn5+f39/gH9/f39/fn5+fn5+fn9/f4B/f39/f35+fn5+fn5/f3+A")
    errorAudioRef.current = new Audio("data:audio/wav;base64,UklGRjIEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQ4EAABpZnmBgYCAdnJxcHJ2fIOGhoWCfXl4eHl8gIWIiYmHhIF9e3p6e36ChoeHhoSBfnt5eXp9gIOGhoaDgH17eXh5fH+ChYWFg4F+e3l4eXx/goWFhYOAf3x6eXl7foGEhYWDgYB9e3l5enx/goSEhIOAf3x6eXl7fX+Cg4SDgYB9e3p5eXt+gIKDg4KBf3x7enl6fH6Ag4ODgoB/fXt6eXp8foGCg4OCgH59e3p5ent9gIGCg4KBf317enp6e31/gYKCgoGAf317enp6e31/gYKCgoGAf317enp6fH1/gIGCgYGAf317enp6e31/gIGBgYGAf317e3p6e31/gIGBgYGAf3x7e3p7fH1/gIGBgYCAf3x7e3p7fH1/gIGBgYCAf3x7e3p7fH1/gIGBgYCAf3x7e3t7fH1/gIGBgYB/f3x7e3t7fH5/gIGBgYB/f3x7e3t7fH5/gIGBgIB/f3x7e3t7fH5/gICBgIB/f3x7e3t7fH5/gICBgIB/f3x7e3t8fH5/gICAgIB/f3x8e3t8fH5/gICAgIB/f3x8e3t8fH5/gICAgIB/f3x8e3x8fH5/gICAgH9/f3x8e3x8fH5/gICAgH9/f3x8fHx8fH5/gICAgH9/f3x8fHx8fH5/gICAgH9/f3x8fHx8fX5/gICAgH9/f3x8fHx8fX5/gICAf39/f3x8fHx8fX5/f4CAf39/f3x8fHx9fX5/f4CAf39/f3x8fHx9fX5/f4CAf39/f3x8fHx9fX5/f4CAf39/f318fHx9fX5/f4B/f39/f318fHx9fX5/f4B/f39/f318fH19fX5/f4B/f39/f318fH19fX5/f4B/f39/f318fH19fX5/f4B/f39/f319fH19fX5/f4B/f39/f319fX19fX5/f4B/f39/f319fX19fX5/f39/f39/f319fX19fX5/f39/f39/f319fX19fX5/f39/f39/f319fX19fX5/f39/f39/f319fX19fn5/f39/f39/f319fX19fn5/f39/f39/f319fX1+fn5/f39/f39/f319fX1+fn5/f39/f39/f319fX1+fn5/f39/f39/f31+fX1+fn5/f39/f39/f31+fX1+fn5/f39/f39/f31+fn1+fn5/f39/f39/f31+fn1+fn5/f39/f39/f31+fn5+fn5/f39/f39/f31+fn5+fn5/f39/f39/f35+fn5+fn5/f39/f39/f35+fn5+fn5/f39/f39/f35+fn5+fn5/f39/f39/f35+fn5+fn5/f39/f3+Af35+fn5+fn5/f39/f3+Af35+fn5+fn5/f39/f3+Af35+fn5+fn5/f39/f3+Af35+fn5+fn9/f39/f3+Af35+fn5+fn9/f39/f3+Af35+fn5+fn9/f39/f3+Af35+fn5+f39/f39/f3+Af35+fn5+f39/f39/")
  }, [])

  // Online/offline detection
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

  // Fullscreen change detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  // Vibrate on mobile
  const vibrate = (pattern: number | number[]) => {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern)
    }
  }

  // Play sound
  const playSound = (type: "success" | "error") => {
    if (!soundEnabled) return
    if (type === "success" && successAudioRef.current) {
      successAudioRef.current.currentTime = 0
      successAudioRef.current.play().catch(() => {})
    } else if (type === "error" && errorAudioRef.current) {
      errorAudioRef.current.currentTime = 0
      errorAudioRef.current.play().catch(() => {})
    }
  }

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

  // Check-in/checkout mutation
  const checkinMutation = useMutation({
    mutationFn: async (registrationNumber: string) => {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          checkin_list_id: listId,
          registration_number: registrationNumber,
          action: checkoutMode ? "check_out" : "check_in"
        })
      })
      return res.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        const isCheckout = checkoutMode || data.action === "checked_out"

        if (data.action === "already_checked_in") {
          setScanResult({
            type: "already",
            message: data.message || "Already checked in",
            registrationId: data.registration?.id,
            attendee: {
              name: data.registration?.attendee_name,
              email: data.registration?.attendee_email,
              ticket: data.registration?.ticket_types?.name,
              registration_number: data.registration?.registration_number,
              institution: data.registration?.attendee_institution
            }
          })
          playSound("error")
          vibrate(200)
          addRecentScan(data.registration?.attendee_name, data.registration?.registration_number, data.registration?.id, "already")
        } else if (data.action === "already_checked_out") {
          setScanResult({
            type: "warning",
            message: data.message || "Not checked in",
            attendee: {
              name: data.registration?.attendee_name,
              email: data.registration?.attendee_email,
              ticket: data.registration?.ticket_types?.name,
              registration_number: data.registration?.registration_number,
              institution: data.registration?.attendee_institution
            }
          })
          playSound("error")
          vibrate(200)
          addRecentScan(data.registration?.attendee_name, data.registration?.registration_number, data.registration?.id, "error")
        } else {
          setScanResult({
            type: "success",
            message: isCheckout ? `Checked out from ${data.list_name}` : `Checked in to ${data.list_name}`,
            registrationId: data.registration?.id,
            attendee: {
              name: data.registration?.attendee_name,
              email: data.registration?.attendee_email,
              ticket: data.registration?.ticket_types?.name,
              registration_number: data.registration?.registration_number,
              institution: data.registration?.attendee_institution
            }
          })
          playSound("success")
          vibrate([100, 50, 100])
          addRecentScan(data.registration?.attendee_name, data.registration?.registration_number, data.registration?.id, "success")
          if (!isCheckout) {
            setLastCheckedInId(data.registration?.id)
          }
        }
      } else {
        setScanResult({
          type: "error",
          message: data.error || "Check-in failed"
        })
        playSound("error")
        vibrate([200, 100, 200])
        addRecentScan("Unknown", "", undefined, "error")
      }
      refetchStats()
      // Start countdown
      setCountdown(5)
    },
    onError: (error: any) => {
      setScanResult({
        type: "error",
        message: error.message || "Check-in failed"
      })
      playSound("error")
      vibrate([200, 100, 200])
      addRecentScan("Unknown", "", undefined, "error")
    }
  })

  // Undo mutation
  const undoMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          checkin_list_id: listId,
          registration_id: registrationId,
          action: "check_out"
        })
      })
      return res.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        setScanResult({
          type: "warning",
          message: `Undone: ${data.registration?.attendee_name} checked out`
        })
        setLastCheckedInId(null)
        refetchStats()
      }
    }
  })

  const handleUndo = useCallback(() => {
    if (lastCheckedInId) {
      undoMutation.mutate(lastCheckedInId)
    }
  }, [lastCheckedInId, undoMutation])

  const addRecentScan = (name: string, registrationNumber: string, registrationId: string | undefined, status: "success" | "error" | "already") => {
    setRecentScans((prev) => [
      {
        id: Date.now().toString(),
        name,
        registrationNumber,
        registrationId,
        time: new Date().toLocaleTimeString(),
        status
      },
      ...prev.slice(0, 19) // Keep last 20 scans
    ])
  }

  const clearRecentScans = () => {
    setRecentScans([])
  }

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualSearch.trim()) {
      checkinMutation.mutate(manualSearch.trim())
      setManualSearch("")
    }
  }

  // Countdown timer for auto-clear
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0) {
      setScanResult(null)
      setCountdown(null)
      searchInputRef.current?.focus()
    }
  }, [countdown])

  // Focus on search input
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (document.activeElement === searchInputRef.current) {
        if (e.key === "Escape") {
          setScanResult(null)
          setCountdown(null)
        }
        return
      }

      switch (e.key.toLowerCase()) {
        case "m":
          setSoundEnabled((prev) => !prev)
          break
        case "f":
          toggleFullscreen()
          break
        case "c":
          setCheckoutMode((prev) => !prev)
          break
        case "u":
          if (lastCheckedInId) handleUndo()
          break
        case "s":
        case "/":
          searchInputRef.current?.focus()
          e.preventDefault()
          break
        case "escape":
          setScanResult(null)
          setCountdown(null)
          break
        case "?":
          setShowKeyboardHints((prev) => !prev)
          break
        case "t":
          setShowTicketStats((prev) => !prev)
          break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [lastCheckedInId, handleUndo])

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Get scan URL for sharing
  const getScanUrl = () => {
    if (typeof window === "undefined") return ""
    return window.location.href
  }

  // Copy link to clipboard
  const copyLink = async () => {
    await navigator.clipboard.writeText(getScanUrl())
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Link
                href={`/events/${eventId}/checkin/${listId}`}
                className="p-1.5 sm:p-2 hover:bg-gray-700 rounded-lg flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-lg font-bold truncate">{stats?.list.name || "Check-in Scanner"}</h1>
                  {checkoutMode && (
                    <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-medium rounded-full flex-shrink-0">
                      CHECK-OUT
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-400 truncate">{event?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Connection Status */}
              <div className={`p-2 rounded-lg ${isOnline ? "text-green-400" : "text-red-400"}`} title={isOnline ? "Online" : "Offline"}>
                {isOnline ? <Wifi className="w-4 h-4 sm:w-5 sm:h-5" /> : <WifiOff className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>

              {/* Check-out Mode Toggle */}
              <button
                onClick={() => setCheckoutMode(!checkoutMode)}
                className={`p-2 rounded-lg ${checkoutMode ? "bg-red-600 text-white" : "hover:bg-gray-700"}`}
                title={checkoutMode ? "Switch to Check-in Mode (C)" : "Switch to Check-out Mode (C)"}
              >
                {checkoutMode ? <LogOut className="w-4 h-4 sm:w-5 sm:h-5" /> : <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>

              {/* Undo Button */}
              {lastCheckedInId && (
                <button
                  onClick={handleUndo}
                  className="p-2 hover:bg-gray-700 rounded-lg text-yellow-400"
                  title="Undo Last Check-in (U)"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              <button
                onClick={() => router.push(`/events/${eventId}/checkin/${listId}`)}
                className="p-2 hover:bg-gray-700 rounded-lg hidden sm:block"
                title="View List"
              >
                <List className="w-5 h-5" />
              </button>

              <button
                onClick={() => setShowShareModal(true)}
                className="p-2 hover:bg-gray-700 rounded-lg"
                title="Share Scanner Link"
              >
                <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-lg ${soundEnabled ? "hover:bg-gray-700" : "text-red-400 hover:bg-gray-700"}`}
                title={soundEnabled ? "Mute (M)" : "Unmute (M)"}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>

              <button
                onClick={() => setShowKeyboardHints(!showKeyboardHints)}
                className="p-2 hover:bg-gray-700 rounded-lg hidden sm:block"
                title="Keyboard Shortcuts (?)"
              >
                <Keyboard className="w-5 h-5" />
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-gray-700 rounded-lg"
                title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
              >
                {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardHints && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowKeyboardHints(false)}>
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Keyboard Shortcuts</h3>
              <button onClick={() => setShowKeyboardHints(false)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Search / Focus Input</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">S</kbd>
                  <span className="text-gray-500">or</span>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">/</kbd>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Toggle Sound</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">M</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Toggle Fullscreen</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">F</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Toggle Check-out Mode</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">C</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Undo Last Check-in</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">U</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Toggle Ticket Stats</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">T</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Clear Result / Close</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">Esc</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Show This Help</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">?</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowShareModal(false)}>
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Share Scanner</h3>
              <button onClick={() => setShowShareModal(false)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-4">Share this link with staff to let them scan attendees on their mobile devices.</p>
            <div className="bg-gray-900 p-3 rounded-lg mb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <code className="text-sm text-blue-400 truncate flex-1">{getScanUrl()}</code>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  copyLink()
                  setShowShareModal(false)
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
              >
                Copy Link
              </button>
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Close
              </button>
            </div>
            <div className="mt-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getScanUrl())}&bgcolor=1f2937&color=ffffff`}
                alt="QR Code"
                className="w-48 h-48 rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-56px)] sm:min-h-[calc(100vh-64px)]">
        {/* Main Scanner Area */}
        <div className="flex-1 p-3 sm:p-8">
          {/* Mode Indicator */}
          {checkoutMode && (
            <div className="max-w-xl mx-auto mb-4 p-3 bg-red-900/50 border border-red-500 rounded-xl text-center">
              <div className="flex items-center justify-center gap-2 text-red-400">
                <LogOut className="w-5 h-5" />
                <span className="font-medium">CHECK-OUT MODE ACTIVE</span>
              </div>
              <p className="text-xs text-red-400/70 mt-1">Scanning will check out attendees instead of checking them in</p>
            </div>
          )}

          {/* Stats Bar */}
          <div className="flex items-center justify-center gap-3 sm:gap-8 mb-4 sm:mb-8">
            <div className="text-center">
              <div className="text-2xl sm:text-5xl font-bold text-green-400">{stats?.checkedIn || 0}</div>
              <div className="text-[10px] sm:text-sm text-gray-400">Checked In</div>
            </div>
            <div className="text-3xl sm:text-6xl text-gray-600">/</div>
            <div className="text-center">
              <div className="text-2xl sm:text-5xl font-bold">{stats?.total || 0}</div>
              <div className="text-[10px] sm:text-sm text-gray-400">Total</div>
            </div>
            <div className="ml-2 sm:ml-8 text-center">
              <div className="text-2xl sm:text-5xl font-bold text-amber-400">{stats?.notCheckedIn || 0}</div>
              <div className="text-[10px] sm:text-sm text-gray-400">Remaining</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="max-w-xl mx-auto mb-4 sm:mb-8">
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${stats?.percentage || 0}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-400">
              <span>{stats?.percentage || 0}% complete</span>
              <button
                onClick={() => setShowTicketStats(!showTicketStats)}
                className="flex items-center gap-1 hover:text-white transition-colors"
              >
                <Ticket className="w-4 h-4" />
                <span className="hidden sm:inline">By ticket type</span>
                {showTicketStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Ticket Type Stats (Collapsible) */}
          {showTicketStats && stats?.byTicketType && (
            <div className="max-w-xl mx-auto mb-6 p-4 bg-gray-800 rounded-xl">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Stats by Ticket Type</h4>
              <div className="space-y-3">
                {stats.byTicketType.map((ticket) => (
                  <div key={ticket.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{ticket.name}</span>
                        <span className="text-gray-400">{ticket.checkedIn}/{ticket.total}</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${ticket.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{ticket.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Input */}
          <form onSubmit={handleManualSearch} className="max-w-xl mx-auto mb-4 sm:mb-8">
            <div className="relative">
              {checkoutMode ? (
                <LogOut className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-red-400" />
              ) : (
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
              )}
              <input
                ref={searchInputRef}
                type="text"
                value={manualSearch}
                onChange={(e) => setManualSearch(e.target.value)}
                placeholder={checkoutMode ? "Scan to check out attendee..." : "Scan QR code or type registration number..."}
                className={`w-full pl-14 pr-4 py-4 bg-gray-800 border rounded-xl text-lg focus:outline-none focus:ring-2 transition-all ${
                  checkoutMode
                    ? "border-red-500/50 focus:ring-red-500 placeholder-red-400/50"
                    : "border-gray-700 focus:ring-blue-500"
                }`}
                autoFocus
              />
              {checkinMutation.isPending && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center hidden sm:block">
              Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">S</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">/</kbd> to focus • <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">?</kbd> for all shortcuts
            </p>
          </form>

          {/* Scan Result */}
          {scanResult && (
            <div
              className={`max-w-xl mx-auto p-4 sm:p-6 rounded-2xl relative overflow-hidden ${
                scanResult.type === "success"
                  ? "bg-gradient-to-br from-green-900/80 to-emerald-900/80 border-2 border-green-500"
                  : scanResult.type === "already"
                  ? "bg-gradient-to-br from-yellow-900/80 to-amber-900/80 border-2 border-yellow-500"
                  : scanResult.type === "warning"
                  ? "bg-gradient-to-br from-orange-900/80 to-amber-900/80 border-2 border-orange-500"
                  : "bg-gradient-to-br from-red-900/80 to-rose-900/80 border-2 border-red-500"
              }`}
            >
              {/* Countdown Timer */}
              {countdown !== null && (
                <div className="absolute top-4 right-4 flex items-center gap-2 text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">{countdown}s</span>
                </div>
              )}

              <div className="flex items-start gap-4">
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center flex-shrink-0 ${
                    scanResult.type === "success"
                      ? "bg-green-500 shadow-lg shadow-green-500/50"
                      : scanResult.type === "already"
                      ? "bg-yellow-500 shadow-lg shadow-yellow-500/50"
                      : scanResult.type === "warning"
                      ? "bg-orange-500 shadow-lg shadow-orange-500/50"
                      : "bg-red-500 shadow-lg shadow-red-500/50"
                  }`}
                >
                  {scanResult.type === "success" ? (
                    <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                  ) : scanResult.type === "already" ? (
                    <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                  ) : scanResult.type === "warning" ? (
                    <RotateCcw className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                  ) : (
                    <XCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-xl sm:text-2xl font-bold ${
                      scanResult.type === "success"
                        ? "text-green-400"
                        : scanResult.type === "already"
                        ? "text-yellow-400"
                        : scanResult.type === "warning"
                        ? "text-orange-400"
                        : "text-red-400"
                    }`}
                  >
                    {scanResult.type === "success"
                      ? checkoutMode ? "Check-out Successful" : "Check-in Successful"
                      : scanResult.type === "already"
                      ? "Already Checked In"
                      : scanResult.type === "warning"
                      ? "Undo Successful"
                      : "Check-in Failed"}
                  </div>
                  {scanResult.attendee && (
                    <div className="mt-3 space-y-1">
                      <div className="text-xl sm:text-2xl font-bold text-white truncate">{scanResult.attendee.name}</div>
                      {scanResult.attendee.institution && (
                        <div className="text-gray-300">{scanResult.attendee.institution}</div>
                      )}
                      <div className="text-gray-400 truncate">{scanResult.attendee.email}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 rounded-full text-sm">
                          <Ticket className="w-3 h-3" />
                          {scanResult.attendee.ticket}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 rounded-full text-sm font-mono">
                          #{scanResult.attendee.registration_number}
                        </span>
                      </div>
                    </div>
                  )}
                  {!scanResult.attendee && (
                    <div className="mt-2 text-gray-300">{scanResult.message}</div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              {scanResult.type === "success" && !checkoutMode && scanResult.registrationId && (
                <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
                  <button
                    onClick={handleUndo}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Undo
                  </button>
                  <button
                    onClick={() => {
                      setScanResult(null)
                      setCountdown(null)
                      searchInputRef.current?.focus()
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {!scanResult && (
            <div className="max-w-xl mx-auto text-center text-gray-500">
              <div className={`w-20 h-20 sm:w-32 sm:h-32 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${
                checkoutMode ? "bg-red-900/30" : "bg-gray-800"
              }`}>
                {checkoutMode ? (
                  <LogOut className="w-12 h-12 sm:w-16 sm:h-16 text-red-400/50" />
                ) : (
                  <QrCode className="w-12 h-12 sm:w-16 sm:h-16 opacity-30" />
                )}
              </div>
              <p className="text-lg">
                {checkoutMode ? "Scan to check out an attendee" : "Scan a QR code or enter registration number"}
              </p>
              <p className="text-sm mt-2">The input field is auto-focused for barcode scanners</p>
            </div>
          )}
        </div>

        {/* Mobile Recent Scans Toggle */}
        <button
          onClick={() => setShowMobileRecent(!showMobileRecent)}
          className="lg:hidden fixed bottom-4 right-4 p-4 bg-gray-800 rounded-full shadow-lg border border-gray-700 z-40"
        >
          <Clock className="w-6 h-6" />
          {recentScans.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
              {recentScans.length}
            </span>
          )}
        </button>

        {/* Recent Scans Sidebar */}
        <div className={`
          ${showMobileRecent ? "fixed inset-0 z-50 bg-gray-900" : "hidden"}
          lg:block lg:relative lg:w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto
        `}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-300">Recent Scans</h3>
            <div className="flex items-center gap-2">
              {recentScans.length > 0 && (
                <button
                  onClick={clearRecentScans}
                  className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setShowMobileRecent(false)}
                className="lg:hidden p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {recentScans.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No scans yet</p>
              <p className="text-gray-600 text-xs mt-1">Scan results will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentScans.map((scan, index) => (
                <div
                  key={scan.id}
                  className={`p-3 rounded-xl transition-all ${
                    index === 0 ? "ring-2 ring-white/10" : ""
                  } ${
                    scan.status === "success"
                      ? "bg-green-900/30"
                      : scan.status === "already"
                      ? "bg-yellow-900/30"
                      : "bg-red-900/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      scan.status === "success"
                        ? "bg-green-500/20"
                        : scan.status === "already"
                        ? "bg-yellow-500/20"
                        : "bg-red-500/20"
                    }`}>
                      {scan.status === "success" ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : scan.status === "already" ? (
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{scan.name}</div>
                      {scan.registrationNumber && (
                        <div className="text-xs text-gray-400 font-mono">#{scan.registrationNumber}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">{scan.time}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
