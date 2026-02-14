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

// Column patterns for header-based auto-detection
// Order matters: more specific patterns checked first to avoid mis-matches
// [field, positivePatterns, negativePatterns]
const COLUMN_PATTERNS: [string, string[], string[]][] = [
  ["topic", ["topic", "session name", "title", "subject", "talk", "agenda", "paper", "presentation title", "programme"], ["email", "track"]],
  ["end_time", ["end time", "end_time", "endtime", "ending", "finish", "until", "to time", "end at"], []], // Before start_time
  ["start_time", ["start time", "start_time", "starttime", "starting", "begin", "from", "from time", "start at", "timing"], ["end"]],
  ["date", ["date", "day", "event date", "session date", "programme date"], ["update", "create", "modified"]],
  ["duration", ["duration", "minutes", "length", "hrs", "hours"], []],
  ["session_track", ["session", "track", "category", "stream", "group", "panel"], ["name", "title", "type"]],
  ["faculty_name", ["faculty", "speaker", "presenter", "full name", "panelist", "panellist", "name of", "resource person", "guest", "instructor", "lecturer"], ["email", "phone", "mobile", "role"]],
  ["faculty_role", ["role", "designation", "position", "type of participation", "participation"], ["faculty", "email"]],
  ["faculty_email", ["email", "e-mail", "mail", "email id", "email address", "e mail"], []],
  ["faculty_phone", ["phone", "mobile", "cell", "contact number", "mobile number", "whatsapp", "telephone", "contact no", "mobile no", "phone no"], ["email"]],
  ["hall", ["hall", "room", "venue", "location", "place", "auditorium", "stage", "theater", "theatre"], []],
  ["session_type", ["format", "kind", "session type", "type of session"], []],
  ["needs_travel", ["travel", "needs travel", "flight", "air travel"], []],
  ["needs_accommodation", ["accommodation", "hotel", "stay", "lodging", "hostel"], []],
]
// Fallback: generic "time" matches start_time if nothing else matched
const FALLBACK_TIME_PATTERN = "time"

// ===== Mapping Template System =====
// Saves admin's column mappings for reuse across uploads
const TEMPLATE_STORAGE_KEY = "csv-mapping-templates"

interface MappingTemplate {
  name: string
  headers: string[]
  mapping: Record<string, string>
  createdAt: string
}

function saveMappingTemplate(template: MappingTemplate) {
  try {
    const templates = loadMappingTemplates()
    const filtered = templates.filter(t => t.name !== template.name)
    filtered.push(template)
    const trimmed = filtered.slice(-20) // Keep max 20 templates
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(trimmed))
  } catch { /* localStorage unavailable */ }
}

function loadMappingTemplates(): MappingTemplate[] {
  try {
    const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function findMatchingTemplate(headers: string[]): MappingTemplate | null {
  const templates = loadMappingTemplates()
  const headerSet = new Set(headers.map(h => h.toLowerCase().trim()))

  let bestMatch: MappingTemplate | null = null
  let bestScore = 0

  for (const template of templates) {
    const templateSet = new Set(template.headers.map(h => h.toLowerCase().trim()))
    const matches = [...headerSet].filter(h => templateSet.has(h)).length
    const score = matches / Math.max(headerSet.size, templateSet.size)

    if (score > bestScore && score >= 0.7) { // At least 70% header overlap
      bestScore = score
      bestMatch = template
    }
  }

  return bestMatch
}

function deleteMappingTemplate(name: string) {
  try {
    const templates = loadMappingTemplates().filter(t => t.name !== name)
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates))
  } catch { /* localStorage unavailable */ }
}

/** Auto-detect CSV delimiter (comma, tab, semicolon, pipe) */
function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 5).filter(l => l.trim())
  if (firstLines.length === 0) return ","

  const delimiters = [",", "\t", ";", "|"]
  const avgCounts: Record<string, number> = {}

  for (const d of delimiters) {
    let total = 0
    for (const line of firstLines) {
      let count = 0
      let inQuotes = false
      for (const char of line) {
        if (char === '"') inQuotes = !inQuotes
        if (!inQuotes && char === d) count++
      }
      total += count
    }
    avgCounts[d] = total / firstLines.length
  }

  // Choose delimiter with highest average count (minimum 1 occurrence)
  let best = ","
  let maxAvg = 0
  for (const [d, avg] of Object.entries(avgCounts)) {
    if (avg > maxAvg && avg >= 1) {
      maxAvg = avg
      best = d
    }
  }

  return best
}

// ===== Universal Date/Time Parsers =====
// These handle ANY format automatically - no code changes needed for new CSV formats

const MONTH_NAMES: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
  apr: "04", april: "04", may: "05", jun: "06", june: "06",
  jul: "07", july: "07", aug: "08", august: "08", sep: "09", september: "09",
  oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12",
}

/** Parse any date string into YYYY-MM-DD. Handles: ISO, DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY, 2-digit years, month names, etc. */
function parseAnyDate(value: string): string | null {
  if (!value?.trim()) return null
  const v = value.trim()

  // ISO: 2026-01-30 or 2026-01-30T09:00:00
  const iso = v.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const [, y, m, d] = iso
    if (parseInt(m) >= 1 && parseInt(m) <= 12 && parseInt(d) >= 1 && parseInt(d) <= 31)
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY (4-digit year)
  const dmy4 = v.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/)
  if (dmy4) {
    const [, d, m, y] = dmy4
    if (parseInt(m) >= 1 && parseInt(m) <= 12 && parseInt(d) >= 1 && parseInt(d) <= 31)
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // DD/MM/YY or DD.MM.YY or DD-MM-YY (2-digit year)
  const dmy2 = v.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2})(?!\d)/)
  if (dmy2) {
    const [, d, m, yr] = dmy2
    const y = parseInt(yr) > 50 ? `19${yr}` : `20${yr.padStart(2, "0")}`
    if (parseInt(m) >= 1 && parseInt(m) <= 12 && parseInt(d) >= 1 && parseInt(d) <= 31)
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // "30 Jan 2026", "30-Jan-2026", "30 January 2026"
  const dayMonth = v.match(/(\d{1,2})[\s\-]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,\s\-]+(\d{2,4})/i)
  if (dayMonth) {
    const m = MONTH_NAMES[dayMonth[2].toLowerCase().slice(0, 3)]
    const y = dayMonth[3].length === 2 ? (parseInt(dayMonth[3]) > 50 ? `19${dayMonth[3]}` : `20${dayMonth[3]}`) : dayMonth[3]
    if (m) return `${y}-${m}-${dayMonth[1].padStart(2, "0")}`
  }

  // "Jan 30, 2026", "January 30 2026"
  const monthDay = v.match(/(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})[,\s]+(\d{2,4})/i)
  if (monthDay) {
    const m = MONTH_NAMES[monthDay[1].toLowerCase().slice(0, 3)]
    const y = monthDay[3].length === 2 ? (parseInt(monthDay[3]) > 50 ? `19${monthDay[3]}` : `20${monthDay[3]}`) : monthDay[3]
    if (m) return `${y}-${m}-${monthDay[2].padStart(2, "0")}`
  }

  return null
}

/** Parse any time string. Returns start time and optional end time in HH:MM:SS format.
 *  Handles: 24h, 12h AM/PM, time ranges, ISO datetime, combined date+time, etc. */
function parseAnyTime(value: string): { start: string; end?: string } | null {
  if (!value?.trim()) return null
  const v = value.trim()

  const to24h = (h: number, period: string): number => {
    if (period.toUpperCase() === "PM" && h < 12) return h + 12
    if (period.toUpperCase() === "AM" && h === 12) return 0
    return h
  }

  // Time range with AM/PM: "9:00 AM - 5:00 PM"
  const rangeAmPm = v.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–to]+\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (rangeAmPm) {
    const sH = to24h(parseInt(rangeAmPm[1]), rangeAmPm[3])
    const eH = to24h(parseInt(rangeAmPm[4]), rangeAmPm[6])
    return {
      start: `${sH.toString().padStart(2, "0")}:${rangeAmPm[2]}:00`,
      end: `${eH.toString().padStart(2, "0")}:${rangeAmPm[5]}:00`,
    }
  }

  // Time range 24h: "10:00-12:30", "10:00 - 12:30", "10:00 – 12:30"
  const range24 = v.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/)
  if (range24) {
    return {
      start: `${range24[1].padStart(2, "0")}:${range24[2]}:00`,
      end: `${range24[3].padStart(2, "0")}:${range24[4]}:00`,
    }
  }

  // Single time with AM/PM: "9:00 AM", "2:30PM"
  const singleAmPm = v.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (singleAmPm) {
    const h = to24h(parseInt(singleAmPm[1]), singleAmPm[3])
    return { start: `${h.toString().padStart(2, "0")}:${singleAmPm[2]}:00` }
  }

  // Time after date/T separator: "2026-01-30T09:00" or "30/1/2026 09:00"
  const afterSep = v.match(/[T\s](\d{1,2}):(\d{2})/)
  if (afterSep) {
    return { start: `${afterSep[1].padStart(2, "0")}:${afterSep[2]}:00` }
  }

  // Simple time at start: "09:00", "9:30"
  const simple = v.match(/^(\d{1,2}):(\d{2})/)
  if (simple) {
    return { start: `${simple[1].padStart(2, "0")}:${simple[2]}:00` }
  }

  // Fallback: any HH:MM in the string
  const fallback = v.match(/(\d{1,2}):(\d{2})/)
  if (fallback) {
    return { start: `${fallback[1].padStart(2, "0")}:${fallback[2]}:00` }
  }

  return null
}

/** Auto-detect column content type by analyzing actual cell values */
function detectColumnContentType(values: string[]): string | null {
  const samples = values.filter(v => v?.trim()).slice(0, 10)
  if (samples.length === 0) return null

  let dates = 0, times = 0, dateAndTime = 0, emails = 0, phones = 0, booleans = 0

  for (const v of samples) {
    const hasDate = parseAnyDate(v) !== null
    const hasTime = parseAnyTime(v) !== null
    if (hasDate && hasTime) dateAndTime++
    else if (hasDate) dates++
    if (hasTime) times++
    if (/@/.test(v) && /\.\w{2,}/.test(v)) emails++
    if (/^\+?\d[\d\s\-()]{7,}$/.test(v.trim())) phones++
    if (/^(yes|no|true|false|y|n|1|0)$/i.test(v.trim())) booleans++
  }

  const threshold = Math.max(1, samples.length * 0.4)
  if (emails >= threshold) return "faculty_email"
  if (phones >= threshold) return "faculty_phone"
  if (dateAndTime >= threshold) return "start_time"
  if (dates >= threshold) return "date"
  if (times >= threshold) return "start_time"
  return null
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

  // Template state
  const [savedTemplates, setSavedTemplates] = useState<MappingTemplate[]>([])
  const [matchedTemplate, setMatchedTemplate] = useState<MappingTemplate | null>(null)
  const [templateName, setTemplateName] = useState("")
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)

  // Parse CSV file (auto-detects delimiter: comma, tab, semicolon, pipe)
  const parseCSV = useCallback((text: string) => {
    // Remove BOM if present (Excel adds this)
    const cleanText = text.replace(/^\uFEFF/, "")
    const delimiter = detectDelimiter(cleanText)
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim())
    if (lines.length === 0) return { headers: [], data: [] }

    // Parse header row
    const headers = parseCSVLine(lines[0], delimiter)

    // Parse data rows
    const data: CSVRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter)
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

  // Parse a single CSV/TSV line (handles quoted values)
  const parseCSVLine = (line: string, delimiter: string = ","): string[] => {
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
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  // Auto-detect field mappings using header patterns, negative patterns, content analysis
  const autoDetectMapping = (headers: string[], data: CSVRow[]): Record<string, string> => {
    const mapping: Record<string, string> = {}

    headers.forEach(header => {
      const headerLower = header.toLowerCase()

      // 1. Header-based matching with positive/negative patterns
      for (const [field, positivePatterns, negativePatterns] of COLUMN_PATTERNS) {
        // Skip if any negative pattern matches (avoids "end time" matching "start_time")
        if (negativePatterns.some(neg => headerLower.includes(neg))) continue

        if (positivePatterns.some(pattern => headerLower.includes(pattern))) {
          if (!Object.values(mapping).includes(field)) {
            mapping[header] = field
            break
          }
        }
      }

      // 2. Fallback: generic "time" → start_time (if not already mapped)
      if (!mapping[header] && headerLower.includes(FALLBACK_TIME_PATTERN) && !Object.values(mapping).includes("start_time")) {
        mapping[header] = "start_time"
      }

      // 3. Content-based detection as last resort (analyze actual cell values)
      if (!mapping[header]) {
        const values = data.map(row => row[header] || "")
        const detectedType = detectColumnContentType(values)
        if (detectedType && !Object.values(mapping).includes(detectedType)) {
          mapping[header] = detectedType
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

      // Load saved templates and check for a match
      const templates = loadMappingTemplates()
      setSavedTemplates(templates)

      const matched = findMatchingTemplate(headers)
      if (matched) {
        setMatchedTemplate(matched)
        // Apply saved template, with auto-detect fallback for any new columns
        const autoMapping = autoDetectMapping(headers, data)
        const templateMapping: Record<string, string> = {}
        headers.forEach(header => {
          templateMapping[header] = matched.mapping[header] || autoMapping[header] || "ignore"
        })
        setFieldMapping(templateMapping)
      } else {
        setMatchedTemplate(null)
        setFieldMapping(autoDetectMapping(headers, data))
      }

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
            case "start_time": {
              // Universal time parser handles ALL formats: ISO, AM/PM, 24h, ranges, combined date+time
              const timeResult = parseAnyTime(value)
              if (timeResult) {
                transformed.start_time = timeResult.start
                if (timeResult.end && !transformed.end_time) {
                  transformed.end_time = timeResult.end
                }
              }
              // Also extract date from combined datetime values (ISO, DD/MM/YYYY HH:MM, etc.)
              const dateFromTime = parseAnyDate(value)
              if (dateFromTime && !transformed.session_date) {
                transformed.session_date = dateFromTime
              }
              break
            }
            case "end_time": {
              // Universal time parser handles ALL formats
              const endResult = parseAnyTime(value)
              if (endResult) {
                transformed.end_time = endResult.start
              }
              // Also extract date if embedded (ISO datetime)
              const endDate = parseAnyDate(value)
              if (endDate && !transformed.session_date) {
                transformed.session_date = endDate
              }
              break
            }
            case "date": {
              // Universal date parser handles ALL formats: ISO, DD/MM/YYYY, dots, dashes, month names, 2-digit years
              const parsedDate = parseAnyDate(value)
              if (parsedDate) {
                transformed.session_date = parsedDate
              }
              break
            }
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
    setMatchedTemplate(null)
    setTemplateName("")
    setShowSaveTemplate(false)
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

              {/* Template applied notification */}
              {matchedTemplate && (
                <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-green-800">
                    Applied saved template: <strong>{matchedTemplate.name}</strong>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs ml-auto"
                    onClick={() => {
                      setMatchedTemplate(null)
                      setFieldMapping(autoDetectMapping(csvHeaders, csvData))
                    }}
                  >
                    Reset to auto-detect
                  </Button>
                </div>
              )}

              {/* Saved templates selector (when no auto-match) */}
              {!matchedTemplate && savedTemplates.length > 0 && (
                <div className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground shrink-0">Apply saved template:</span>
                  <Select onValueChange={(name) => {
                    const template = savedTemplates.find(t => t.name === name)
                    if (template) {
                      const autoMapping = autoDetectMapping(csvHeaders, csvData)
                      const templateMapping: Record<string, string> = {}
                      csvHeaders.forEach(header => {
                        templateMapping[header] = template.mapping[header] || autoMapping[header] || "ignore"
                      })
                      setFieldMapping(templateMapping)
                      setMatchedTemplate(template)
                    }
                  }}>
                    <SelectTrigger className="w-[200px] h-8">
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {savedTemplates.map(t => (
                        <SelectItem key={t.name} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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

              {/* Save mapping as template for future use */}
              {!showSaveTemplate ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowSaveTemplate(true)}
                >
                  Save column mapping for future use
                </Button>
              ) : (
                <div className="flex items-center gap-2 mt-4">
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name (e.g., Airtable Export)"
                    className="h-8 w-64 text-sm"
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={!templateName.trim()}
                    onClick={() => {
                      saveMappingTemplate({
                        name: templateName.trim(),
                        headers: csvHeaders,
                        mapping: fieldMapping,
                        createdAt: new Date().toISOString(),
                      })
                      setSavedTemplates(loadMappingTemplates())
                      setShowSaveTemplate(false)
                      setTemplateName("")
                    }}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                </div>
              )}
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
