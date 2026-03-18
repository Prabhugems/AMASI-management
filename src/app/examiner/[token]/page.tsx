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
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">{error}</p>
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
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm border">
            <Users className="h-5 w-5 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm border">
            <ClipboardCheck className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-600">{stats.marked}</p>
            <p className="text-xs text-gray-500">Marked</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm border">
            <Clock className="h-5 w-5 text-orange-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-orange-500">{stats.pending}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
        </div>

        {/* Search / Scan Area */}
        {!selectedCandidate && (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Reg number or name..."
                  className="w-full h-14 pl-11 pr-4 text-base bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-blue-500" />
                )}
              </div>
              <button
                onClick={toggleScanner}
                className={`h-14 w-14 rounded-xl flex items-center justify-center shadow-sm border transition-colors ${
                  scannerOpen
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {scannerOpen ? <CameraOff className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
              </button>
            </div>

            {/* QR Scanner */}
            {scannerOpen && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div id="examiner-qr-reader" ref={scannerContainerRef} className="w-full" />
                <p className="text-center text-xs text-gray-500 py-2">
                  Point camera at QR code on candidate badge
                </p>
              </div>
            )}

            {/* Search Results */}
            {candidates.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border divide-y">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCandidate(c)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Dr. {c.attendee_name}</p>
                        <p className="text-sm text-gray-500">
                          {c.registration_number}
                          {c.ticket_type_name && (
                            <span className="ml-2 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                              {c.ticket_type_name}
                            </span>
                          )}
                        </p>
                      </div>
                      {c.exam_result && (
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
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
              <div className="bg-white rounded-xl shadow-sm border p-6 text-center">
                <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No candidates found</p>
              </div>
            )}
          </>
        )}

        {/* Selected Candidate Card */}
        {selectedCandidate && examInfo && (
          <div className="space-y-4">
            {/* Success animation overlay */}
            {saveSuccess && (
              <div className="bg-green-50 border-2 border-green-400 rounded-2xl p-6 text-center animate-in fade-in zoom-in duration-300">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-bold text-green-800">Marks Saved!</p>
                <p className="text-sm text-green-600 mt-1">
                  {selectedCandidate.exam_result === "pass" ? "PASS" : "FAIL"} - {selectedCandidate.exam_total_marks}/{totalMax}
                </p>
              </div>
            )}

            {!saveSuccess && (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                {/* Candidate Header */}
                <div className="p-4 border-b bg-gray-50 flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Dr. {selectedCandidate.attendee_name}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {selectedCandidate.registration_number}
                    </p>
                    {selectedCandidate.ticket_type_name && (
                      <span className="inline-block mt-1.5 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                        {selectedCandidate.ticket_type_name}
                      </span>
                    )}
                    {selectedCandidate.checked_in && (
                      <span className="inline-block mt-1.5 ml-1.5 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">
                        Checked In
                      </span>
                    )}
                  </div>
                  <button
                    onClick={clearCandidate}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </button>
                    </div>

                    {examInfo.mark_columns.map((col) => (
                      <div
                        key={col.key}
                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                      >
                        <span className="text-sm text-gray-600">{col.label}</span>
                        <span className="font-semibold text-gray-900">
                          {selectedCandidate.exam_marks?.[col.key] ?? "-"}{" "}
                          <span className="text-gray-400 font-normal">/ {col.max}</span>
                        </span>
                      </div>
                    ))}

                    {selectedCandidate.exam_marks?.remarks && (
                      <div className="pt-2">
                        <span className="text-xs text-gray-500">Remarks:</span>
                        <p className="text-sm text-gray-700">
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
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {col.label}{" "}
                          <span className="text-gray-400 font-normal">(max {col.max})</span>
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={col.max}
                          value={marks[col.key] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === "") {
                              setMarks((prev) => ({ ...prev, [col.key]: "" }))
                            } else {
                              const num = Math.min(Math.max(0, Number(val)), col.max)
                              setMarks((prev) => ({ ...prev, [col.key]: num }))
                            }
                          }}
                          className="w-full h-14 px-4 text-lg font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
                          placeholder={`0 - ${col.max}`}
                        />
                      </div>
                    ))}

                    {/* Total & Pass/Fail Indicator */}
                    <div
                      className={`rounded-xl p-4 flex items-center justify-between ${
                        isPass ? "bg-green-50 border-2 border-green-200" : "bg-red-50 border-2 border-red-200"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Marks</p>
                        <p className="text-3xl font-bold" style={{ color: isPass ? "#16a34a" : "#dc2626" }}>
                          {total}
                          <span className="text-lg text-gray-400 font-normal"> / {totalMax}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPass ? (
                          <>
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                            <span className="text-lg font-bold text-green-600">PASS</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-8 w-8 text-red-500" />
                            <span className="text-lg font-bold text-red-600">FAIL</span>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 text-center">
                      Pass marks: {examInfo.pass_marks}/{totalMax}
                    </p>

                    {/* Remarks */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Remarks <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full h-14 px-4 text-base bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
                        placeholder="Any remarks..."
                      />
                    </div>

                    {/* Save Error */}
                    {saveError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-700">{saveError}</p>
                      </div>
                    )}

                    {/* Save Button */}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full h-14 rounded-xl text-white font-bold text-lg shadow-lg transition-all active:scale-95 disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
                      style={{ backgroundColor: "#16a34a" }}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-5 w-5" />
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
