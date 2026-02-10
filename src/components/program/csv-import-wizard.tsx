"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Edit2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Database fields that can be mapped
const DB_FIELDS = [
  { key: "topic", label: "Topic / Session Name", required: true },
  { key: "start_time", label: "Start Time", required: true },
  { key: "end_time", label: "End Time", required: false },
  { key: "date", label: "Date", required: false }, // Can be extracted from start_time
  { key: "duration", label: "Duration (Minutes)", required: false },
  { key: "session_track", label: "Session / Track", required: false },
  { key: "faculty_name", label: "Faculty / Speaker Name", required: false },
  { key: "faculty_role", label: "Role (Speaker/Chair/Moderator)", required: false },
  { key: "faculty_email", label: "Faculty Email", required: false },
  { key: "faculty_phone", label: "Faculty Phone", required: false },
  { key: "hall", label: "Hall / Venue", required: false },
  { key: "session_type", label: "Session Type", required: false },
  { key: "needs_travel", label: "Travel (Yes/No)", required: false },
  { key: "needs_accommodation", label: "Accommodation (Yes/No)", required: false },
  { key: "ignore", label: "-- Ignore this column --", required: false },
]

// Common CSV column patterns for auto-detection
const COLUMN_PATTERNS: Record<string, string[]> = {
  topic: ["topic", "session name", "title", "subject", "talk"],
  start_time: ["start", "starting", "begin", "from", "time"],
  end_time: ["end", "ending", "finish", "to", "until"],
  date: ["date", "day"],
  duration: ["duration", "minutes", "length", "min"],
  session_track: ["session", "track", "category", "stream"],
  faculty_name: ["faculty", "speaker", "presenter", "full name", "name"],
  faculty_role: ["role", "designation", "position", "type of participation"],
  faculty_email: ["email", "e-mail", "mail", "email id"],
  faculty_phone: ["phone", "mobile", "cell", "contact", "mobile number"],
  hall: ["hall", "room", "venue", "location", "place"],
  session_type: ["format", "kind"],
  needs_travel: ["travel", "needs travel", "flight"],
  needs_accommodation: ["accommodation", "hotel", "stay", "lodging"],
}

type CSVRow = Record<string, string>

interface CSVImportWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  existingSessionCount: number
  onImportComplete: () => void
}

export function CSVImportWizard({
  open,
  onOpenChange,
  eventId,
  existingSessionCount,
  onImportComplete,
}: CSVImportWizardProps) {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvData, setCsvData] = useState<CSVRow[]>([])
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [clearExisting, setClearExisting] = useState(false)
  const [createSpeakerRegistrations, setCreateSpeakerRegistrations] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; facultyCreated?: number; facultyUpdated?: number; registrationsCreated?: number } | null>(null)

  // New state for editable preview
  const [editedData, setEditedData] = useState<Record<number, any>>({}) // Row edits by index
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set()) // Excluded row indices
  const [showSkipped, setShowSkipped] = useState(false) // Toggle skipped rows view
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null)

  // Parse CSV file
  const parseCSV = useCallback((text: string) => {
    // Remove BOM if present (Excel adds this)
    const cleanText = text.replace(/^\uFEFF/, "")
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim())
    if (lines.length === 0) return { headers: [], data: [] }

    // Parse header row
    const headers = parseCSVLine(lines[0])

    // Parse data rows
    const data: CSVRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.some(v => v.trim())) {
        const row: CSVRow = {}
        headers.forEach((header, idx) => {
          row[header] = values[idx] || ""
        })
        data.push(row)
      }
    }

    return { headers, data }
  }, [])

  // Parse a single CSV line (handles quoted values)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  // Auto-detect field mappings
  const autoDetectMapping = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {}

    headers.forEach(header => {
      const headerLower = header.toLowerCase()

      for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
        if (patterns.some(pattern => headerLower.includes(pattern))) {
          // Don't override if already mapped
          if (!Object.values(mapping).includes(field)) {
            mapping[header] = field
            break
          }
        }
      }

      // Default to ignore if not matched
      if (!mapping[header]) {
        mapping[header] = "ignore"
      }
    })

    return mapping
  }

  // Handle file upload
  const handleFileUpload = async (uploadedFile: File) => {
    setError(null)
    setFile(uploadedFile)

    try {
      const text = await uploadedFile.text()
      const { headers, data } = parseCSV(text)

      if (headers.length === 0 || data.length === 0) {
        setError("CSV file is empty or invalid")
        return
      }

      setCsvHeaders(headers)
      setCsvData(data)
      setFieldMapping(autoDetectMapping(headers))
      setStep("map")
    } catch (_err) {
      setError("Failed to parse CSV file")
    }
  }

  // Update field mapping
  const updateMapping = (csvColumn: string, dbField: string) => {
    setFieldMapping(prev => ({ ...prev, [csvColumn]: dbField }))
  }

  // Validate mapping has required fields
  const validateMapping = (): boolean => {
    const mappedFields = Object.values(fieldMapping)
    const hasTopicMapping = mappedFields.includes("topic")
    const hasTimeMapping = mappedFields.includes("start_time")
    return hasTopicMapping && hasTimeMapping
  }

  // Transform CSV data using mapping
  const transformData = (): any[] => {
    return csvData.map((row, index) => {
      const transformed: any = { event_id: eventId }

      // Get mapped values
      Object.entries(fieldMapping).forEach(([csvCol, dbField]) => {
        if (dbField !== "ignore") {
          const value = row[csvCol]?.trim() || ""

          switch (dbField) {
            case "topic":
              transformed.session_name = value || `Session ${index + 1}`
              break
            case "start_time":
              // Parse date+time from start_time like "30/1/2026 09:00"
              const startMatch = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2})/)
              if (startMatch) {
                const [, day, month, year, hours, minutes] = startMatch
                transformed.session_date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
                transformed.start_time = `${hours.padStart(2, "0")}:${minutes}:00`
              } else {
                // Time range format like "10:00-12:30" or "10:00 - 12:30"
                const timeRangeMatch = value.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/)
                if (timeRangeMatch) {
                  const [, startH, startM, endH, endM] = timeRangeMatch
                  transformed.start_time = `${startH.padStart(2, "0")}:${startM}:00`
                  transformed.end_time = `${endH.padStart(2, "0")}:${endM}:00`
                } else {
                  // Just time format
                  const timeMatch = value.match(/(\d{1,2}):(\d{2})/)
                  if (timeMatch) {
                    transformed.start_time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}:00`
                  }
                }
              }
              break
            case "end_time":
              const endMatch = value.match(/(\d{1,2}):(\d{2})/)
              if (endMatch) {
                transformed.end_time = `${endMatch[1].padStart(2, "0")}:${endMatch[2]}:00`
              } else {
                // Try date+time format
                const fullMatch = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2})/)
                if (fullMatch) {
                  transformed.end_time = `${fullMatch[4].padStart(2, "0")}:${fullMatch[5]}:00`
                }
              }
              break
            case "date":
              // Handle multiple date formats: DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY, YYYY-MM-DD
              // Also handles 2-digit years: DD.MM.YY, DD/MM/YY, DD-MM-YY
              const dateSlashMatch4 = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
              const dateDotMatch4 = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
              const dateDashMatch4 = value.match(/(\d{1,2})-(\d{1,2})-(\d{4})/)
              const dateISOMatch = value.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
              // 2-digit year patterns
              const dateSlashMatch2 = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})(?!\d)/)
              const dateDotMatch2 = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{2})(?!\d)/)
              const dateDashMatch2 = value.match(/(\d{1,2})-(\d{1,2})-(\d{2})(?!\d)/)

              // Helper to convert 2-digit year to 4-digit (assumes 2000s)
              const expandYear = (y: string) => (parseInt(y) > 50 ? `19${y}` : `20${y.padStart(2, "0")}`)

              if (dateISOMatch) {
                // YYYY-MM-DD format
                const [, year, month, day] = dateISOMatch
                transformed.session_date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
              } else if (dateSlashMatch4) {
                // DD/MM/YYYY format
                const [, day, month, year] = dateSlashMatch4
                transformed.session_date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
              } else if (dateDotMatch4) {
                // DD.MM.YYYY format
                const [, day, month, year] = dateDotMatch4
                transformed.session_date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
              } else if (dateDashMatch4) {
                // DD-MM-YYYY format
                const [, day, month, year] = dateDashMatch4
                transformed.session_date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
              } else if (dateSlashMatch2) {
                // DD/MM/YY format (2-digit year)
                const [, day, month, year] = dateSlashMatch2
                transformed.session_date = `${expandYear(year)}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
              } else if (dateDotMatch2) {
                // DD.MM.YY format (2-digit year) - used in some AMASICON rows
                const [, day, month, year] = dateDotMatch2
                transformed.session_date = `${expandYear(year)}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
              } else if (dateDashMatch2) {
                // DD-MM-YY format (2-digit year)
                const [, day, month, year] = dateDashMatch2
                transformed.session_date = `${expandYear(year)}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
              }
              break
            case "duration":
              transformed.duration_minutes = parseInt(value) || null
              break
            case "session_track":
              transformed.specialty_track = value
              transformed.hall = transformed.hall || value // Use as hall if no explicit hall
              break
            case "faculty_name":
              transformed.faculty_name = value
              break
            case "faculty_role":
              // Store the role for categorization (Speaker, Chairperson, Moderator, etc.)
              transformed.faculty_role = value
              break
            case "faculty_email":
              transformed.faculty_email = value
              break
            case "faculty_phone":
              transformed.faculty_phone = value
              break
            case "hall":
              transformed.hall = value
              break
            case "session_type":
              transformed.session_type = value.toLowerCase().replace(/\s+/g, "_")
              break
            case "needs_travel":
              // Parse yes/no/true/false values
              const travelValue = value.toLowerCase().trim()
              transformed.needs_travel = ["yes", "true", "1", "y"].includes(travelValue)
              break
            case "needs_accommodation":
              // Parse yes/no/true/false values
              const accomValue = value.toLowerCase().trim()
              transformed.needs_accommodation = ["yes", "true", "1", "y"].includes(accomValue)
              break
          }
        }
      })

      // Build description from faculty info
      if (transformed.faculty_name) {
        let desc = transformed.faculty_name
        if (transformed.faculty_email) desc += ` | ${transformed.faculty_email}`
        if (transformed.faculty_phone) desc += ` | ${transformed.faculty_phone}`
        transformed.description = desc
      }

      // Set defaults
      if (!transformed.session_type) transformed.session_type = "lecture"
      if (!transformed.end_time && transformed.start_time) {
        transformed.end_time = transformed.start_time
      }

      return transformed
    })
  }

  // Get preview data with edits applied
  const getPreviewData = () => {
    const transformed = transformData()
    return transformed.map((row, idx) => {
      // Apply edits if any
      if (editedData[idx]) {
        return { ...row, ...editedData[idx] }
      }
      return row
    })
  }

  // Get valid sessions (for import)
  const getValidSessions = () => {
    const preview = getPreviewData()
    return preview.filter((t, idx) =>
      !excludedRows.has(idx) && t.session_date && t.start_time && t.session_name
    )
  }

  // Get skipped rows with reasons
  const getSkippedRows = () => {
    const preview = getPreviewData()
    const skipped: { index: number; data: any; reason: string }[] = []

    preview.forEach((row, idx) => {
      if (excludedRows.has(idx)) {
        skipped.push({ index: idx, data: row, reason: "Manually excluded" })
      } else if (!row.session_name) {
        skipped.push({ index: idx, data: row, reason: "Missing topic/name" })
      } else if (!row.session_date) {
        skipped.push({ index: idx, data: row, reason: "Missing or invalid date" })
      } else if (!row.start_time) {
        skipped.push({ index: idx, data: row, reason: "Missing or invalid time" })
      }
    })

    return skipped
  }

  // Update a cell value
  const updateCell = (rowIndex: number, field: string, value: string) => {
    setEditedData(prev => ({
      ...prev,
      [rowIndex]: {
        ...prev[rowIndex],
        [field]: value
      }
    }))
    setEditingCell(null)
  }

  // Toggle row exclusion
  const toggleRowExclusion = (rowIndex: number) => {
    setExcludedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex)
      } else {
        newSet.add(rowIndex)
      }
      return newSet
    })
  }

  // Include a skipped row by fixing its data
  const _includeSkippedRow = (rowIndex: number) => {
    excludedRows.delete(rowIndex)
    setExcludedRows(new Set(excludedRows))
  }

  // Handle import
  const handleImport = async () => {
    setStep("importing")
    setError(null)

    try {
      // Clear existing if selected
      if (clearExisting && existingSessionCount > 0) {
        const deleteResponse = await fetch(`/api/program/clear?event_id=${eventId}`, {
          method: "DELETE",
        })
        if (!deleteResponse.ok) {
          throw new Error("Failed to clear existing sessions")
        }
      }

      // Get valid sessions (with edits applied, excluding skipped)
      const sessions = getValidSessions()

      if (sessions.length === 0) {
        setError("No valid sessions to import")
        setStep("preview")
        return
      }

      // Import sessions
      const response = await fetch("/api/program/import-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          sessions,
          createSpeakerRegistrations,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Import failed")
      }

      setImportResult({
        imported: result.imported,
        skipped: csvData.length - result.imported,
        facultyCreated: result.faculty?.created || 0,
        facultyUpdated: result.faculty?.updated || 0,
        registrationsCreated: result.registrations?.created || 0,
      })

      onImportComplete()
    } catch (err: any) {
      setError(err.message)
      setStep("preview")
    }
  }

  // Reset wizard
  const resetWizard = () => {
    setStep("upload")
    setFile(null)
    setCsvHeaders([])
    setCsvData([])
    setFieldMapping({})
    setClearExisting(false)
    setCreateSpeakerRegistrations(false)
    setError(null)
    setImportResult(null)
    setEditedData({})
    setExcludedRows(new Set())
    setShowSkipped(false)
    setEditingCell(null)
  }

  // Close handler
  const handleClose = () => {
    resetWizard()
    onOpenChange(false)
  }

  const previewData = step === "preview" ? getPreviewData() : []
  const validSessions = step === "preview" ? getValidSessions() : []
  const skippedRows = step === "preview" ? getSkippedRows() : []

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Program from CSV
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 py-2 border-b">
          {["upload", "map", "preview"].map((s, idx) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  step === s || (idx === 0 && step === "importing")
                    ? "bg-primary text-primary-foreground"
                    : ["map", "preview", "importing"].includes(step) && idx < ["upload", "map", "preview"].indexOf(step)
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {["map", "preview", "importing"].includes(step) && idx < ["upload", "map", "preview"].indexOf(step) ? (
                  <Check className="h-4 w-4" />
                ) : (
                  idx + 1
                )}
              </div>
              <span className="ml-2 text-sm capitalize hidden sm:inline">{s}</span>
              {idx < 2 && <ArrowRight className="h-4 w-4 mx-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto py-4">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                onClick={() => document.getElementById("csv-file-input")?.click()}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  Drop your CSV file here or click to browse
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports any CSV format - you'll map the columns in the next step
                </p>
                <Input
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFileUpload(f)
                  }}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive p-3 bg-destructive/10 rounded">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Map Fields */}
          {step === "map" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Found <strong>{csvHeaders.length}</strong> columns and{" "}
                  <strong>{csvData.length}</strong> rows in{" "}
                  <strong>{file?.name}</strong>
                </p>
              </div>

              <div className="grid gap-3">
                <div className="grid grid-cols-[1fr,auto,1fr] gap-2 text-sm font-medium text-muted-foreground pb-2 border-b">
                  <span>CSV Column</span>
                  <span></span>
                  <span>Maps To</span>
                </div>

                {csvHeaders.map((header) => (
                  <div key={header} className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {header}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate">
                        e.g., {csvData[0]?.[header]?.slice(0, 30)}
                        {(csvData[0]?.[header]?.length || 0) > 30 ? "..." : ""}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={fieldMapping[header] || "ignore"}
                      onValueChange={(value) => updateMapping(header, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DB_FIELDS.map((field) => (
                          <SelectItem key={field.key} value={field.key}>
                            {field.label}
                            {field.required && " *"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {!validateMapping() && (
                <div className="flex items-center gap-2 text-amber-600 p-3 bg-amber-50 rounded mt-4">
                  <AlertCircle className="h-4 w-4" />
                  Please map at least "Topic" and "Start Time" fields to continue
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              {/* Summary Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <p className="font-medium">
                    Ready to import <span className="text-green-600">{validSessions.length}</span> sessions
                  </p>
                  {skippedRows.length > 0 && (
                    <button
                      onClick={() => setShowSkipped(!showSkipped)}
                      className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
                    >
                      {showSkipped ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {skippedRows.length} rows will be skipped - click to {showSkipped ? "hide" : "view"} details
                    </button>
                  )}
                </div>

                {existingSessionCount > 0 && (
                  <label className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clearExisting}
                      onChange={(e) => setClearExisting(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-orange-800">
                      Clear {existingSessionCount} existing sessions
                    </span>
                  </label>
                )}
              </div>

              {/* Create Speaker Registrations Option */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b">
                <label className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={createSpeakerRegistrations}
                    onChange={(e) => setCreateSpeakerRegistrations(e.target.checked)}
                    className="rounded"
                  />
                  <div>
                    <span className="text-sm text-blue-800 font-medium block">
                      Create speaker registrations
                    </span>
                    <span className="text-xs text-blue-600">
                      Auto-create speaker tickets for faculty with email addresses (requires Speaker/Faculty ticket type)
                    </span>
                  </div>
                </label>
              </div>

              {/* Skipped Rows Section */}
              {showSkipped && skippedRows.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-amber-800 text-sm">Skipped Rows ({skippedRows.length})</p>
                    <p className="text-xs text-amber-600">Click edit to fix and include</p>
                  </div>
                  <div className="space-y-2 max-h-[150px] overflow-auto">
                    {skippedRows.map(({ index, data, reason }) => (
                      <div key={index} className="flex items-center justify-between gap-2 bg-white p-2 rounded text-sm">
                        <div className="flex-1 min-w-0">
                          <span className="text-muted-foreground">Row {index + 1}:</span>{" "}
                          <span className="font-medium truncate">{data.session_name || "(no name)"}</span>
                          <Badge variant="outline" className="ml-2 text-xs text-amber-700">
                            {reason}
                          </Badge>
                        </div>
                        <button
                          onClick={() => {
                            setShowSkipped(false)
                            // Determine which field to edit based on the reason
                            const fieldToEdit = reason.includes("date")
                              ? "session_date"
                              : reason.includes("time")
                                ? "start_time"
                                : "session_name"
                            setEditingCell({ row: index, field: fieldToEdit })
                            // Scroll to the row after a short delay
                            setTimeout(() => {
                              const rowElement = document.getElementById(`preview-row-${index}`)
                              if (rowElement) {
                                rowElement.scrollIntoView({ behavior: "smooth", block: "center" })
                                rowElement.classList.add("ring-2", "ring-blue-500")
                                setTimeout(() => rowElement.classList.remove("ring-2", "ring-blue-500"), 2000)
                              }
                            }, 100)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table with Edit Support */}
              <div className="border rounded overflow-auto max-h-[350px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2 text-left w-8"></th>
                      <th className="px-2 py-2 text-left w-10">#</th>
                      <th className="px-2 py-2 text-left w-24">Date</th>
                      <th className="px-2 py-2 text-left w-24">Time</th>
                      <th className="px-2 py-2 text-left">Topic</th>
                      <th className="px-2 py-2 text-left w-28">Hall</th>
                      <th className="px-2 py-2 text-left w-32">Faculty</th>
                      <th className="px-2 py-2 text-left w-24">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, idx) => {
                      const isValid = row.session_date && row.start_time && row.session_name
                      const isExcluded = excludedRows.has(idx)
                      const isSkipped = !isValid || isExcluded

                      return (
                        <tr
                          key={idx}
                          id={`preview-row-${idx}`}
                          className={cn(
                            "border-t hover:bg-muted/50 transition-colors",
                            isSkipped && "bg-amber-50/50 text-muted-foreground"
                          )}
                        >
                          {/* Exclude Toggle */}
                          <td className="px-2 py-1.5">
                            <button
                              onClick={() => toggleRowExclusion(idx)}
                              className={cn(
                                "p-1 rounded hover:bg-muted",
                                isExcluded ? "text-red-500" : "text-green-500"
                              )}
                              title={isExcluded ? "Include this row" : "Exclude this row"}
                            >
                              {isExcluded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">{idx + 1}</td>

                          {/* Editable Date */}
                          <td className="px-2 py-1.5">
                            {editingCell?.row === idx && editingCell?.field === "session_date" ? (
                              <Input
                                defaultValue={row.session_date || ""}
                                className="h-7 text-xs"
                                autoFocus
                                onBlur={(e) => updateCell(idx, "session_date", e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") updateCell(idx, "session_date", e.currentTarget.value)
                                  if (e.key === "Escape") setEditingCell(null)
                                }}
                              />
                            ) : (
                              <span
                                onClick={() => setEditingCell({ row: idx, field: "session_date" })}
                                className={cn(
                                  "cursor-pointer hover:bg-blue-50 px-1 rounded",
                                  !row.session_date && "text-red-500 italic"
                                )}
                              >
                                {row.session_date || "Click to add"}
                              </span>
                            )}
                          </td>

                          {/* Time */}
                          <td className="px-2 py-1.5">
                            <span className={!row.start_time ? "text-red-500 italic" : ""}>
                              {row.start_time?.slice(0, 5) || "N/A"} - {row.end_time?.slice(0, 5) || ""}
                            </span>
                          </td>

                          {/* Editable Topic */}
                          <td className="px-2 py-1.5 max-w-[200px]">
                            {editingCell?.row === idx && editingCell?.field === "session_name" ? (
                              <Input
                                defaultValue={row.session_name || ""}
                                className="h-7 text-xs"
                                autoFocus
                                onBlur={(e) => updateCell(idx, "session_name", e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") updateCell(idx, "session_name", e.currentTarget.value)
                                  if (e.key === "Escape") setEditingCell(null)
                                }}
                              />
                            ) : (
                              <span
                                onClick={() => setEditingCell({ row: idx, field: "session_name" })}
                                className={cn(
                                  "cursor-pointer hover:bg-blue-50 px-1 rounded truncate block",
                                  !row.session_name && "text-red-500 italic"
                                )}
                                title={row.session_name}
                              >
                                {row.session_name || "Click to add"}
                              </span>
                            )}
                          </td>

                          {/* Hall */}
                          <td className="px-2 py-1.5 text-xs">
                            {row.hall ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs truncate max-w-[100px]",
                                  row.hall.toLowerCase().includes("common") && "bg-purple-50 text-purple-700",
                                  row.hall.toLowerCase().includes("surgery") && "bg-blue-50 text-blue-700",
                                  row.hall.toLowerCase().includes("gyne") && "bg-pink-50 text-pink-700"
                                )}
                                title={row.hall}
                              >
                                {row.hall.length > 15 ? row.hall.slice(0, 15) + "..." : row.hall}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>

                          {/* Faculty */}
                          <td className="px-2 py-1.5 text-muted-foreground text-xs truncate">
                            {row.faculty_name}
                          </td>

                          {/* Role */}
                          <td className="px-2 py-1.5">
                            {row.faculty_role && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  row.faculty_role.toLowerCase().includes("chair") && "bg-purple-50 text-purple-700",
                                  row.faculty_role.toLowerCase().includes("moderator") && "bg-blue-50 text-blue-700",
                                  row.faculty_role.toLowerCase().includes("speaker") && "bg-green-50 text-green-700",
                                  row.faculty_role.toLowerCase().includes("panel") && "bg-amber-50 text-amber-700",
                                  row.faculty_role.toLowerCase().includes("presenter") && "bg-cyan-50 text-cyan-700"
                                )}
                              >
                                {row.faculty_role}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-muted-foreground">
                Click on Date or Topic cells to edit. Use the eye icon to include/exclude rows.
              </p>

              {error && (
                <div className="flex items-center gap-2 text-destructive p-3 bg-destructive/10 rounded">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Importing */}
          {step === "importing" && !importResult && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4" />
              <p className="text-lg font-medium">Importing sessions...</p>
              <p className="text-sm text-muted-foreground">Please wait</p>
            </div>
          )}

          {/* Import Complete */}
          {step === "importing" && importResult && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-lg font-medium mb-2">Import Complete!</p>
              <p className="text-muted-foreground">
                Successfully imported {importResult.imported} sessions
                {importResult.skipped > 0 && ` (${importResult.skipped} skipped)`}
              </p>
              {(importResult.facultyCreated || importResult.facultyUpdated) ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Faculty: {importResult.facultyCreated} new, {importResult.facultyUpdated} updated
                </p>
              ) : null}
              {importResult.registrationsCreated ? (
                <p className="text-sm text-green-600 mt-1">
                  Speaker registrations: {importResult.registrationsCreated} created
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="border-t pt-4">
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "map" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={() => setStep("preview")} disabled={!validateMapping()}>
                Continue to Preview
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("map")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={validSessions.length === 0}>
                Import {validSessions.length} Sessions
              </Button>
            </>
          )}

          {step === "importing" && importResult && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
