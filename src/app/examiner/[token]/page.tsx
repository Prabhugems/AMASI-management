"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Search,
  Camera,
  CameraOff,
  Loader2,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  Users,
  Clock,
  AlertTriangle,
  X,
  Edit3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

type MarkColumn = {
  key: string
  label: string
  max: number
}

type ExamInfo = {
  exam_type: string
  pass_marks: number
  mark_columns: MarkColumn[]
}

type EventInfo = {
  id: string
  name: string
}

type Candidate = {
  id: string
  attendee_name: string
  registration_number: string
  ticket_type_name: string | null
  exam_marks: Record<string, any> | null
  exam_result: string | null
  exam_total_marks: number | null
  checked_in: boolean | null
}

type Stats = {
  total: number
  marked: number
  pending: number
}

export default function ExaminerPortalPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null)
  const [examInfo, setExamInfo] = useState<ExamInfo | null>(null)
  const [stats, setStats] = useState<Stats>({ total: 0, marked: 0, pending: 0 })

  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)

  const [marks, setMarks] = useState<Record<string, number | string>>({})
  const [remarks, setRemarks] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [isEditing, setIsEditing] = useState(false)

  const [scannerOpen, setScannerOpen] = useState(false)
  const scannerRef = useRef<any>(null)
  const scannerContainerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const candidateCardRef = useRef<HTMLDivElement>(null)

  // Vibration helper
  const vibrate = useCallback((pattern: number | number[]) => {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern)
    } catch {
      // ignore on unsupported devices
    }
  }, [])

  // Success sound helper
  const playSuccessSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } catch {
      // ignore audio errors
    }
  }, [])

  // Load event info on mount
  useEffect(() => {
    async function loadEvent() {
      try {
        const res = await fetch(`/api/examination/examiner?token=${encodeURIComponent(token)}`)
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || "Invalid token")
          setLoading(false)
          return
        }
        const data = await res.json()
        setEventInfo(data.event)
        setExamInfo(data.examination)
        setStats(data.stats)
        setLoading(false)
      } catch {
        setError("Failed to connect to server")
        setLoading(false)
      }
    }
    loadEvent()
  }, [token])

  // Refresh stats periodically
  useEffect(() => {
    if (!eventInfo) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/examination/examiner?token=${encodeURIComponent(token)}`)
        if (res.ok) {
          const data = await res.json()
          setStats(data.stats)
        }
      } catch {
        // ignore
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [eventInfo, token])

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setCandidates([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(
        `/api/examination/examiner?token=${encodeURIComponent(token)}&q=${encodeURIComponent(q.trim())}`
      )
      if (res.ok) {
        const data = await res.json()
        setCandidates(data.candidates || [])
      }
    } catch {
      // ignore
    }
    setSearching(false)
  }, [token])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(searchQuery)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, doSearch])

  // Select a candidate
  const selectCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate)
    setCandidates([])
    setSearchQuery("")

    if (candidate.exam_marks && candidate.exam_result) {
      // Already has marks - show view mode
      setIsEditing(false)
      const existingMarks: Record<string, number | string> = {}
      examInfo?.mark_columns.forEach((col) => {
        existingMarks[col.key] = candidate.exam_marks?.[col.key] ?? ""
      })
      setMarks(existingMarks)
      setRemarks(candidate.exam_marks?.remarks || "")
    } else {
      // No marks yet - show entry mode
      setIsEditing(true)
      const emptyMarks: Record<string, number | string> = {}
      examInfo?.mark_columns.forEach((col) => {
        emptyMarks[col.key] = ""
      })
      setMarks(emptyMarks)
      setRemarks("")
    }

    setSaveSuccess(false)
    setSaveError("")
  }

  // Enable edit mode
  const enableEditing = () => {
    setIsEditing(true)
    setSaveSuccess(false)
    setSaveError("")
  }

  // Calculate total
  const calculateTotal = () => {
    if (!examInfo) return 0
    return examInfo.mark_columns.reduce((sum, col) => {
      const val = marks[col.key]
      return sum + (val !== "" && val !== undefined ? Number(val) : 0)
    }, 0)
  }

  const total = calculateTotal()
  const isPass = examInfo ? total >= examInfo.pass_marks : false
  const totalMax = examInfo ? examInfo.mark_columns.reduce((s, c) => s + c.max, 0) : 0

  // Handle mark change with auto-tab
  const handleMarkChange = (colKey: string, value: string, maxMark: number) => {
    if (value === "") {
      setMarks((prev) => ({ ...prev, [colKey]: "" }))
      return
    }
    const num = Math.min(Math.max(0, Number(value)), maxMark)
    setMarks((prev) => ({ ...prev, [colKey]: num }))

    // Auto-tab to next field when max value is reached
    if (num === maxMark && examInfo) {
      const colIndex = examInfo.mark_columns.findIndex(c => c.key === colKey)
      if (colIndex >= 0 && colIndex < examInfo.mark_columns.length - 1) {
        const nextKey = examInfo.mark_columns[colIndex + 1].key
        setTimeout(() => {
          const nextInput = document.querySelector(`[data-mark-key="${nextKey}"]`) as HTMLInputElement
          nextInput?.focus()
        }, 50)
      }
    }
  }

  // Save marks
  const handleSave = async () => {
    if (!selectedCandidate || !examInfo) return
    setSaving(true)
    setSaveError("")

    try {
      const marksToSend: Record<string, number | null> = {}
      examInfo.mark_columns.forEach((col) => {
        const val = marks[col.key]
        marksToSend[col.key] = val !== "" && val !== undefined ? Number(val) : null
      })

      const res = await fetch("/api/examination/examiner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          registration_id: selectedCandidate.id,
          marks: marksToSend,
          remarks: remarks || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setSaveError(data.error || "Failed to save")
        setSaving(false)
        return
      }

      const data = await res.json()
      setSaveSuccess(true)
      setIsEditing(false)

      // Success feedback
      vibrate([100, 50, 100])
      playSuccessSound()

      // Update local candidate data
      setSelectedCandidate({
        ...selectedCandidate,
        exam_marks: data.registration.exam_marks,
        exam_result: data.registration.exam_result,
        exam_total_marks: data.registration.exam_total_marks,
      })

      // Update stats
      setStats((prev) => ({
        ...prev,
        marked: prev.marked + (selectedCandidate.exam_result ? 0 : 1),
        pending: prev.pending - (selectedCandidate.exam_result ? 0 : 1),
      }))

      // Auto-clear after 2 seconds
      setTimeout(() => {
        setSelectedCandidate(null)
        setSaveSuccess(false)
        setMarks({})
        setRemarks("")
      }, 2000)
    } catch {
      setSaveError("Network error. Please try again.")
      vibrate(300)
    }
    setSaving(false)
  }

  // Clear selected candidate
  const clearCandidate = () => {
    setSelectedCandidate(null)
    setSaveSuccess(false)
    setSaveError("")
    setMarks({})
    setRemarks("")
    setIsEditing(false)
  }

  // Swipe gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !selectedCandidate) return
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y

    // Only trigger on horizontal swipes (not vertical scrolls)
    if (Math.abs(deltaX) > 100 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
      if (deltaX > 0) {
        // Swipe right - clear candidate (go back)
        clearCandidate()
      }
      // Swipe left - no action, could be used for next candidate if we had a list
    }
    touchStartRef.current = null
  }

  // QR Scanner
  const toggleScanner = async () => {
    if (scannerOpen) {
      // Stop scanner
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop()
        } catch {
          // ignore
        }
        scannerRef.current = null
      }
      setScannerOpen(false)
      return
    }

    setScannerOpen(true)

    // Delay to let the container render
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode")
        const scanner = new Html5Qrcode("examiner-qr-reader")
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText: string) => {
            // On successful scan
            vibrate(100)
            setSearchQuery(decodedText)
            doSearch(decodedText)

            // Stop scanner after successful scan
            try {
              scanner.stop()
            } catch {
              // ignore
            }
            scannerRef.current = null
            setScannerOpen(false)
          },
          () => {
            // ignore scan failures (no QR in frame)
          }
        )
      } catch (err) {
        console.error("Scanner error:", err)
        setScannerOpen(false)
      }
    }, 100)
  }

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  // Progress percentage
  const progressPercent = stats.total > 0 ? Math.round((stats.marked / stats.total) * 100) : 0

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading Examiner Portal...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-40" style={{ backgroundColor: "#1a5276" }}>
        <div className="max-w-lg mx-auto px-4 py-3">
          <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">
            {eventInfo?.name}
          </p>
          <h1 className="text-white text-lg font-bold">Examiner Portal</h1>
          {/* Progress bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 bg-blue-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-300 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-blue-200 text-[10px] font-medium tabular-nums">{progressPercent}%</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm border transition-all duration-300 hover:shadow-md">
            <Users className="h-5 w-5 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{stats.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm border transition-all duration-300 hover:shadow-md">
            <ClipboardCheck className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-600 tabular-nums">{stats.marked}</p>
            <p className="text-xs text-gray-500">Marked</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm border transition-all duration-300 hover:shadow-md">
            <Clock className="h-5 w-5 text-orange-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-orange-500 tabular-nums">{stats.pending}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
        </div>

        {/* Search / Scan Area */}
        {!selectedCandidate && (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Reg number or name..."
                  className="w-full h-14 pl-12 pr-4 text-base bg-white border-2 border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  autoComplete="off"
                  autoCapitalize="off"
                />
                {searching && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-blue-500" />
                )}
              </div>
              <button
                onClick={toggleScanner}
                className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm border-2 transition-all active:scale-95 ${
                  scannerOpen
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                }`}
              >
                {scannerOpen ? <CameraOff className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
              </button>
            </div>

            {/* QR Scanner */}
            {scannerOpen && (
              <div className="bg-white rounded-2xl shadow-md border-2 border-blue-200 overflow-hidden">
                {/* Scanner overlay frame */}
                <div className="relative">
                  <div id="examiner-qr-reader" ref={scannerContainerRef} className="w-full" />
                </div>
                <div className="bg-blue-50 px-4 py-2.5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-xs text-blue-700 font-medium">
                    Point camera at QR code on candidate badge
                  </p>
                </div>
              </div>
            )}

            {/* Search Results */}
            {candidates.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md border-2 border-gray-100 divide-y overflow-hidden">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCandidate(c)}
                    className="w-full text-left px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">Dr. {c.attendee_name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {c.registration_number}
                          {c.ticket_type_name && (
                            <span className="ml-2 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              {c.ticket_type_name}
                            </span>
                          )}
                        </p>
                      </div>
                      {c.exam_result && (
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            c.exam_result === "pass"
                              ? "bg-green-100 text-green-700"
                              : c.exam_result === "fail"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {c.exam_result === "pass" ? "Marked - Pass" : c.exam_result === "fail" ? "Marked - Fail" : c.exam_result}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {searchQuery.trim() && !searching && candidates.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 p-8 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Search className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">No candidates found</p>
                <p className="text-xs text-gray-400 mt-1">Try a different registration number or name</p>
              </div>
            )}

            {/* Initial empty state */}
            {!searchQuery.trim() && !scannerOpen && candidates.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-gray-200 p-8 text-center">
                <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Search className="h-7 w-7 text-blue-400" />
                </div>
                <p className="text-gray-700 font-medium">Search or scan to begin</p>
                <p className="text-xs text-gray-400 mt-1">Enter a registration number or scan the QR code</p>
              </div>
            )}
          </>
        )}

        {/* Selected Candidate Card */}
        {selectedCandidate && examInfo && (
          <div
            className="space-y-4"
            ref={candidateCardRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Swipe hint */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <ChevronRight className="h-3 w-3" />
              <span>Swipe right to go back</span>
            </div>

            {/* Success animation overlay */}
            {saveSuccess && (
              <div className="bg-green-50 border-2 border-green-400 rounded-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full bg-green-200 animate-ping opacity-30" />
                  <div className="relative w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                  </div>
                </div>
                <p className="text-xl font-bold text-green-800">Marks Saved!</p>
                <p className="text-sm text-green-600 mt-1 font-medium">
                  {selectedCandidate.exam_result === "pass" ? "PASS" : "FAIL"} - {selectedCandidate.exam_total_marks}/{totalMax}
                </p>
              </div>
            )}

            {!saveSuccess && (
              <div className="bg-white rounded-2xl shadow-md border-2 border-gray-100 overflow-hidden">
                {/* Candidate Header */}
                <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-white flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Dr. {selectedCandidate.attendee_name}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5 font-mono">
                      {selectedCandidate.registration_number}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedCandidate.ticket_type_name && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                          {selectedCandidate.ticket_type_name}
                        </span>
                      )}
                      {selectedCandidate.checked_in && (
                        <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">
                          Checked In
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={clearCandidate}
                    className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Existing marks display (view mode) */}
                {selectedCandidate.exam_result && !isEditing && (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-sm font-bold px-3 py-1.5 rounded-full ${
                          selectedCandidate.exam_result === "pass"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {selectedCandidate.exam_result === "pass" ? "PASS" : "FAIL"} -{" "}
                        {selectedCandidate.exam_total_marks}/{totalMax}
                      </span>
                      <button
                        onClick={enableEditing}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors active:scale-95"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </button>
                    </div>

                    {examInfo.mark_columns.map((col) => (
                      <div
                        key={col.key}
                        className="flex items-center justify-between py-3 px-3 border border-gray-100 rounded-xl"
                      >
                        <span className="text-sm text-gray-600 font-medium">{col.label}</span>
                        <span className="font-bold text-lg text-gray-900 tabular-nums">
                          {selectedCandidate.exam_marks?.[col.key] ?? "-"}{" "}
                          <span className="text-sm text-gray-400 font-normal">/ {col.max}</span>
                        </span>
                      </div>
                    ))}

                    {selectedCandidate.exam_marks?.remarks && (
                      <div className="pt-2 px-1">
                        <span className="text-xs text-gray-500 font-medium">Remarks:</span>
                        <p className="text-sm text-gray-700 mt-0.5">
                          {String(selectedCandidate.exam_marks.remarks)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Mark Entry Form (edit mode) */}
                {isEditing && (
                  <div className="p-4 space-y-4">
                    {examInfo.mark_columns.map((col) => (
                      <div key={col.key}>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {col.label}{" "}
                          <span className="text-gray-400 font-normal">(max {col.max})</span>
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          data-mark-key={col.key}
                          min={0}
                          max={col.max}
                          value={marks[col.key] ?? ""}
                          onChange={(e) => handleMarkChange(col.key, e.target.value, col.max)}
                          className="w-full h-16 px-5 text-xl font-bold bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all tabular-nums"
                          placeholder={`0 - ${col.max}`}
                        />
                      </div>
                    ))}

                    {/* Total & Pass/Fail Indicator */}
                    <div
                      className={`rounded-2xl p-5 flex items-center justify-between transition-colors duration-300 ${
                        isPass ? "bg-green-50 border-2 border-green-200" : "bg-red-50 border-2 border-red-200"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Marks</p>
                        <p className="text-4xl font-black tabular-nums" style={{ color: isPass ? "#16a34a" : "#dc2626" }}>
                          {total}
                          <span className="text-lg text-gray-400 font-normal"> / {totalMax}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPass ? (
                          <div className="text-center">
                            <div className="relative">
                              <div className="absolute inset-0 rounded-full bg-green-200 animate-ping opacity-30" />
                              <CheckCircle2 className="h-10 w-10 text-green-500 relative" />
                            </div>
                            <span className="text-lg font-black text-green-600 mt-1 block">PASS</span>
                          </div>
                        ) : (
                          <div className="text-center">
                            <XCircle className="h-10 w-10 text-red-500" />
                            <span className="text-lg font-black text-red-600 mt-1 block">FAIL</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 text-center">
                      Pass marks: {examInfo.pass_marks}/{totalMax}
                    </p>

                    {/* Remarks */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Remarks <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full h-14 px-5 text-base bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
                        placeholder="Any remarks..."
                      />
                    </div>

                    {/* Save Error */}
                    {saveError && (
                      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        </div>
                        <p className="text-sm text-red-700 font-medium">{saveError}</p>
                      </div>
                    )}

                    {/* Save Button */}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full h-16 rounded-2xl text-white font-bold text-lg shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
                      style={{ backgroundColor: "#16a34a" }}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-6 w-6 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-6 w-6" />
                          Save Marks
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
