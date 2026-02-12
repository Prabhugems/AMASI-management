"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  CheckCircle,
  XCircle,
  Loader2,
  QrCode,
  Search,
  Camera,
  Keyboard,
  Volume2,
  VolumeX,
  RotateCcw,
  SwitchCamera,
  Clock,
  Building2,
  Ticket,
  Hash,
  AlertCircle,
} from "lucide-react"
import { Html5Qrcode } from "html5-qrcode"

interface CheckinList {
  id: string
  name: string
  event_id: string
  events: {
    id: string
    name: string
  }
}

interface Attendee {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_designation?: string
  attendee_institution?: string
  ticket_type?: { name: string }
  checked_in: boolean
  checked_in_at?: string
}

interface RecentCheckin {
  id: string
  name: string
  regNumber: string
  ticketType?: string
  institution?: string
  time: Date
  success: boolean
}

type ScanMode = "manual" | "camera"

export default function StaffCheckinPage() {
  const params = useParams()
  const accessToken = params.accessToken as string

  const [loading, setLoading] = useState(true)
  const [checkinList, setCheckinList] = useState<CheckinList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [processing, setProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<{
    success: boolean
    message: string
    attendee?: Attendee
    alreadyCheckedIn?: boolean
  } | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [stats, setStats] = useState({ total: 0, checkedIn: 0 })
  const [scanMode, setScanMode] = useState<ScanMode>("camera")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scannerReady, setScannerReady] = useState(false)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [recentCheckins, setRecentCheckins] = useState<RecentCheckin[]>([])
  const autoContinueTimerRef = useRef<NodeJS.Timeout | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScannedRef = useRef<string>("")
  const scanCooldownRef = useRef<boolean>(false)

  // Validate access token and get checkin list info
  useEffect(() => {
    async function validateAccess() {
      try {
        const res = await fetch(`/api/checkin/access/${accessToken}`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Invalid access link")
        }
        const data = await res.json()
        setCheckinList(data.checkinList)
        setStats(data.stats || { total: 0, checkedIn: 0 })
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (accessToken) {
      validateAccess()
    }
  }, [accessToken])

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    return () => {
      audioContextRef.current?.close()
    }
  }, [])

  // Focus input on load and after each scan (manual mode only)
  useEffect(() => {
    if (!loading && !error && inputRef.current && scanMode === "manual" && !lastResult) {
      inputRef.current.focus()
    }
  }, [loading, error, lastResult, scanMode])

  const playSound = useCallback((type: "success" | "error") => {
    if (!soundEnabled || !audioContextRef.current) return
    try {
      const ctx = audioContextRef.current
      if (ctx.state === "suspended") {
        ctx.resume()
      }

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      if (type === "success") {
        // Pleasant success beep (two ascending tones)
        oscillator.frequency.setValueAtTime(880, ctx.currentTime)
        oscillator.frequency.setValueAtTime(1108, ctx.currentTime + 0.1)
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.3)
      } else {
        // Error buzzer
        oscillator.frequency.setValueAtTime(220, ctx.currentTime)
        oscillator.type = "square"
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.4)
      }

      // Vibrate on mobile
      if (navigator.vibrate) {
        navigator.vibrate(type === "success" ? [100, 50, 100] : [200, 100, 200])
      }
    } catch (_e) {
      // Ignore sound errors
    }
  }, [soundEnabled])

  const handleScan = useCallback(async (value: string) => {
    if (!value.trim() || processing || !checkinList) return

    // Prevent duplicate scans
    if (scanCooldownRef.current) return
    scanCooldownRef.current = true
    setTimeout(() => { scanCooldownRef.current = false }, 2000)

    setProcessing(true)
    setLastResult(null)

    try {
      // Check if it's a verification URL or direct token
      let token = value.trim()

      // Extract token from URL if it's a full URL
      const urlMatch = value.match(/\/v\/([A-Za-z0-9]+)/)
      if (urlMatch) {
        token = urlMatch[1]
      }

      // Try to check in using the token
      const res = await fetch(`/api/verify/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkin_list_id: checkinList.id,
          access_token: accessToken,
          action: "check_in",
          performed_by: "Staff (via access link)",
        }),
      })

      const data = await res.json()

      if (data.success) {
        playSound("success")
        setLastResult({
          success: true,
          message: "Checked in successfully!",
          attendee: data.registration,
        })
        setStats(prev => ({ ...prev, checkedIn: prev.checkedIn + 1 }))
        lastScannedRef.current = token
        // Add to recent check-ins
        setRecentCheckins(prev => [{
          id: data.registration?.id || Date.now().toString(),
          name: data.registration?.attendee_name || "Unknown",
          regNumber: data.registration?.registration_number || token,
          ticketType: data.registration?.ticket_type?.name,
          institution: data.registration?.attendee_institution,
          time: new Date(),
          success: true,
        }, ...prev].slice(0, 20))
      } else {
        playSound("error")
        setLastResult({
          success: false,
          message: data.error || "Check-in failed",
          alreadyCheckedIn: data.alreadyCheckedIn || false,
          attendee: data.registration,
        })
        // Track failed attempts too
        setRecentCheckins(prev => [{
          id: Date.now().toString(),
          name: data.registration?.attendee_name || data.error || "Failed",
          regNumber: data.registration?.registration_number || token,
          time: new Date(),
          success: false,
        }, ...prev].slice(0, 20))
      }
    } catch (_err) {
      playSound("error")
      setLastResult({
        success: false,
        message: "Network error. Please try again.",
      })
    } finally {
      setProcessing(false)
      setInputValue("")
    }
  }, [processing, checkinList, accessToken, playSound])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleScan(inputValue)
    }
  }

  const resetResult = useCallback(() => {
    setLastResult(null)
    lastScannedRef.current = ""
    if (autoContinueTimerRef.current) {
      clearTimeout(autoContinueTimerRef.current)
      autoContinueTimerRef.current = null
    }
    if (scanMode === "manual" && inputRef.current) {
      inputRef.current.focus()
    }
  }, [scanMode])

  // Auto-continue effect - always auto-continue after 5 seconds
  useEffect(() => {
    if (lastResult) {
      autoContinueTimerRef.current = setTimeout(() => {
        resetResult()
      }, 5000) // Always 5 seconds
    }
    return () => {
      if (autoContinueTimerRef.current) {
        clearTimeout(autoContinueTimerRef.current)
      }
    }
  }, [lastResult, resetResult])

  // Camera scanner setup
  const startScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch (_e) {
        // Ignore
      }
    }

    setCameraError(null)
    setScannerReady(false)

    try {
      const scanner = new Html5Qrcode("qr-reader")
      scannerRef.current = scanner

      await scanner.start(
        { facingMode },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          if (decodedText !== lastScannedRef.current && !scanCooldownRef.current) {
            handleScan(decodedText)
          }
        },
        () => {}
      )
      setScannerReady(true)
    } catch (err: any) {
      console.error("Camera error:", err)
      setCameraError(
        err.message?.includes("Permission")
          ? "Camera permission denied. Please allow camera access."
          : "Could not access camera. Try manual entry instead."
      )
    }
  }, [facingMode, handleScan])

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current = null
      } catch (_e) {
        // Ignore
      }
    }
    setScannerReady(false)
  }, [])

  // Start/stop scanner based on mode
  useEffect(() => {
    if (scanMode === "camera" && checkinList && !lastResult) {
      startScanner()
    } else {
      stopScanner()
    }

    return () => {
      stopScanner()
    }
  }, [scanMode, checkinList, lastResult, startScanner, stopScanner])

  // Restart scanner when facing mode changes
  useEffect(() => {
    if (scanMode === "camera" && scannerReady) {
      startScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only restart scanner when facingMode changes; adding scanMode/scannerReady/startScanner would cause unnecessary restarts
  }, [facingMode])

  const switchCamera = async () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment")
  }

  const _toggleMode = () => {
    setScanMode(prev => prev === "camera" ? "manual" : "camera")
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  }

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-white/70 mt-6 font-medium">Connecting...</p>
        </div>
      </div>
    )
  }

  if (error || !checkinList) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center shadow-2xl">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">
            {error || "This check-in link is invalid or has expired."}
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Please contact the event organizer for a valid access link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-white font-bold text-lg">{checkinList.name}</h1>
            <p className="text-white/60 text-sm">{checkinList.events?.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl transition-all ${
                soundEnabled
                  ? "text-white/60 hover:text-white hover:bg-white/10"
                  : "text-white/30"
              }`}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-1.5 ml-2 px-3 py-1.5 bg-emerald-500/20 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs text-emerald-400 font-medium">Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-black/10 px-4 py-3">
        <div className="flex items-center justify-center gap-8 max-w-2xl mx-auto">
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-400">{stats.checkedIn}</p>
            <p className="text-xs text-white/50 font-medium">Checked In</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-white/50 font-medium">Total</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-3xl font-bold text-cyan-400">
              {stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0}%
            </p>
            <p className="text-xs text-white/50 font-medium">Progress</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-md mx-auto mt-3">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${stats.total > 0 ? (stats.checkedIn / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
          <button
            onClick={() => setScanMode("camera")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              scanMode === "camera"
                ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Camera className="w-5 h-5" />
            Camera
          </button>
          <button
            onClick={() => setScanMode("manual")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              scanMode === "manual"
                ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Keyboard className="w-5 h-5" />
            Manual
          </button>
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-6xl mx-auto w-full">
        {/* Scanner Column */}
        <div className="flex-1 flex flex-col items-center justify-center">
        {/* Result Display */}
        {lastResult && (
          <div className={`w-full max-w-md animate-in fade-in zoom-in-95 duration-300`}>
            <div
              className={`p-8 rounded-3xl text-center relative overflow-hidden ${
                lastResult.success
                  ? "bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border-2 border-emerald-500/50"
                  : lastResult.alreadyCheckedIn
                  ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-500/50"
                  : "bg-gradient-to-br from-red-500/20 to-pink-500/20 border-2 border-red-500/50"
              }`}
            >
              {/* Background glow */}
              <div className={`absolute inset-0 ${
                lastResult.success ? "bg-emerald-500/5" : lastResult.alreadyCheckedIn ? "bg-amber-500/5" : "bg-red-500/5"
              }`} />

              <div className="relative">
                {lastResult.success ? (
                  <>
                    <div className="w-24 h-24 mx-auto mb-4 relative">
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
                      <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-12 h-12 text-white" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {lastResult.attendee?.attendee_name}
                    </h2>
                    {lastResult.attendee?.ticket_type && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 rounded-full mb-2">
                        <Ticket className="w-3.5 h-3.5 text-emerald-300" />
                        <span className="text-emerald-300 text-sm font-medium">
                          {lastResult.attendee.ticket_type.name}
                        </span>
                      </div>
                    )}
                    {lastResult.attendee?.attendee_institution && (
                      <p className="text-white/60 text-sm flex items-center justify-center gap-1.5 mb-2">
                        <Building2 className="w-3.5 h-3.5" />
                        {lastResult.attendee.attendee_institution}
                      </p>
                    )}
                    <div className="flex items-center justify-center gap-1.5 text-white/40 text-xs">
                      <Hash className="w-3 h-3" />
                      <span className="font-mono">{lastResult.attendee?.registration_number}</span>
                    </div>
                    <p className="text-emerald-300 text-sm mt-3 font-medium">{lastResult.message}</p>
                  </>
                ) : lastResult.alreadyCheckedIn ? (
                  <>
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Already Checked In</h2>
                    {lastResult.attendee && (
                      <p className="text-white text-lg font-semibold mb-1">
                        {lastResult.attendee.attendee_name}
                      </p>
                    )}
                    <p className="text-amber-200">{lastResult.message}</p>
                    {lastResult.attendee && (
                      <div className="flex items-center justify-center gap-1.5 text-white/40 text-xs mt-2">
                        <Hash className="w-3 h-3" />
                        <span className="font-mono">{lastResult.attendee.registration_number}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <XCircle className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Check-in Failed</h2>
                    <p className="text-red-200">{lastResult.message}</p>
                  </>
                )}

                <div className="mt-6">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden max-w-[200px] mx-auto">
                    <div
                      className={`h-full rounded-full ${
                        lastResult.success ? "bg-emerald-400" : lastResult.alreadyCheckedIn ? "bg-amber-400" : "bg-red-400"
                      }`}
                      style={{
                        animation: "shrink 5s linear forwards",
                      }}
                    />
                  </div>
                  <button
                    onClick={resetResult}
                    className="mt-4 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center gap-2 mx-auto transition-all font-medium"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Scan Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Camera Scanner */}
        {!lastResult && scanMode === "camera" && (
          <div className="w-full max-w-md">
            <div className="bg-black/30 backdrop-blur-sm rounded-3xl overflow-hidden border border-white/10">
              {cameraError ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-red-300 mb-4">{cameraError}</p>
                  <button
                    onClick={() => startScanner()}
                    className="px-6 py-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors font-medium"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <div id="qr-reader" className="w-full" style={{ minHeight: "300px" }} />
                    {!scannerReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                        <div className="text-center">
                          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
                          <p className="text-white/60 mt-3">Starting camera...</p>
                        </div>
                      </div>
                    )}
                    {/* Camera controls */}
                    {scannerReady && (
                      <div className="absolute bottom-4 right-4 left-4 flex justify-between items-center">
                        <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                          facingMode === "user"
                            ? "bg-emerald-500/80 text-white"
                            : "bg-black/50 text-white/70"
                        }`}>
                          {facingMode === "user" ? "Kiosk Mode" : "Staff Mode"}
                        </div>
                        <button
                          onClick={switchCamera}
                          className="flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                        >
                          <SwitchCamera className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {facingMode === "environment" ? "Front" : "Back"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-4 text-center border-t border-white/10">
                    <p className="text-white/60 text-sm">
                      {facingMode === "user"
                        ? "Hold your badge QR code to the camera"
                        : "Point camera at the badge QR code"
                      }
                    </p>
                  </div>
                </>
              )}
            </div>

            {processing && (
              <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Processing...</span>
              </div>
            )}
          </div>
        )}

        {/* Manual Input */}
        {!lastResult && scanMode === "manual" && (
          <div className="w-full max-w-md">
            <div className="bg-black/30 backdrop-blur-sm rounded-3xl p-8 text-center border border-white/10">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-white text-xl font-bold mb-2">Manual Entry</h2>
              <p className="text-white/50 text-sm mb-6">
                Use a barcode scanner or enter the registration number
              </p>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter reg number..."
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-center text-lg font-mono tracking-wider"
                  disabled={processing}
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="characters"
                />
              </div>

              {inputValue && (
                <button
                  onClick={() => handleScan(inputValue)}
                  disabled={processing}
                  className="mt-4 w-full px-4 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50"
                >
                  Check In
                </button>
              )}

              {processing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">Processing...</span>
                </div>
              )}
            </div>

            {/* Quick tips */}
            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-white/40 text-xs text-center">
                Tip: Use a USB/Bluetooth barcode scanner for faster check-ins
              </p>
            </div>
          </div>
        )}
        </div>

        {/* Recent Check-ins Sidebar */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl border border-white/10 h-full max-h-[500px] lg:max-h-[600px] flex flex-col">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/60">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium text-sm">Recent Scans</span>
                </div>
                <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">
                  {recentCheckins.length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {recentCheckins.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-white/20" />
                  </div>
                  <p className="text-white/30 text-sm">No scans yet</p>
                  <p className="text-white/20 text-xs mt-1">Scanned attendees will appear here</p>
                </div>
              ) : (
                recentCheckins.map((checkin, idx) => (
                  <div
                    key={checkin.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      checkin.success
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : "bg-red-500/10 border border-red-500/20"
                    } ${idx === 0 ? "ring-2 ring-emerald-500/30 animate-in fade-in slide-in-from-top-2 duration-300" : ""}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      checkin.success ? "bg-emerald-500/30 text-emerald-300" : "bg-red-500/30 text-red-300"
                    }`}>
                      {checkin.success ? getInitials(checkin.name) : "!"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${checkin.success ? "text-emerald-200" : "text-red-200"}`}>
                        {checkin.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <span>{checkin.ticketType || checkin.regNumber}</span>
                        <span>•</span>
                        <span>{formatTime(checkin.time)}</span>
                      </div>
                    </div>
                    {checkin.success ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-black/20 px-4 py-3 text-center border-t border-white/10">
        <p className="text-white/30 text-xs">
          Staff Check-in • {checkinList.name}
        </p>
      </div>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
