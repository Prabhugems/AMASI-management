"use client"

import { useState, useMemo, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  Check,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  MapPin,
  Clock,
  User,
  Users,
  Calendar,
  Eye,
  Phone,
  Mail,
  Sparkles,
  CheckCircle2,
  Info,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type CSVRow = Record<string, string>
type ColumnMapping = {
  date: string
  time: string
  endTime: string
  topic: string
  hall: string
  session: string
  speaker: string
  role: string
  email: string
  phone: string
}

const DEFAULT_MAPPING: ColumnMapping = {
  date: "",
  time: "",
  endTime: "",
  topic: "",
  hall: "",
  session: "",
  speaker: "",
  role: "",
  email: "",
  phone: "",
}

// Helper to check if a mapping value is valid (not empty and not skipped)
const isValidMapping = (value: string) => value && value !== "__skip__"

// Simple email validation
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

// Sample value preview component
function SampleValue({ column, data }: { column: string; data: CSVRow[] }) {
  if (!column || column === "__skip__") return null
  const sample = data.slice(0, 3).map(row => row[column]?.trim()).filter(Boolean)
  if (sample.length === 0) return <p className="text-xs text-amber-600 mt-1">No values found in this column</p>
  return (
    <p className="text-xs text-muted-foreground mt-1 truncate">
      e.g. <span className="font-mono bg-muted px-1 rounded">{sample[0]}</span>
      {sample.length > 1 && <>, <span className="font-mono bg-muted px-1 rounded">{sample[1]}</span></>}
    </p>
  )
}

// Date format patterns - slash formats have both MM/DD and DD/MM variants
const DATE_FORMATS_DD_FIRST = [
  { pattern: /(\d{1,2})\.(\d{1,2})\.(\d{4})/, name: "DD.MM.YYYY", parse: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` },
  { pattern: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, name: "DD/MM/YYYY", parse: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` },
  { pattern: /(\d{4})-(\d{2})-(\d{2})/, name: "YYYY-MM-DD", parse: (m: RegExpMatchArray) => m[0] },
  { pattern: /(\d{1,2})-(\d{1,2})-(\d{4})/, name: "DD-MM-YYYY", parse: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` },
]

const DATE_FORMATS_MM_FIRST = [
  { pattern: /(\d{1,2})\.(\d{1,2})\.(\d{4})/, name: "MM.DD.YYYY", parse: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` },
  { pattern: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, name: "MM/DD/YYYY", parse: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` },
  { pattern: /(\d{4})-(\d{2})-(\d{2})/, name: "YYYY-MM-DD", parse: (m: RegExpMatchArray) => m[0] },
  { pattern: /(\d{1,2})-(\d{1,2})-(\d{4})/, name: "MM-DD-YYYY", parse: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` },
]

// Auto-detect if dates are MM/DD or DD/MM by scanning all values
function detectDateOrder(dates: string[]): "mm_first" | "dd_first" {
  let maxFirst = 0, maxSecond = 0
  for (const d of dates) {
    const match = d.match(/(\d{1,2})[./-](\d{1,2})[./-]\d{4}/)
    if (match) {
      maxFirst = Math.max(maxFirst, parseInt(match[1]))
      maxSecond = Math.max(maxSecond, parseInt(match[2]))
    }
  }
  // If first number exceeds 12, it must be a day (DD/MM)
  if (maxFirst > 12) return "dd_first"
  // If second number exceeds 12, first must be month (MM/DD)
  if (maxSecond > 12) return "mm_first"
  // Ambiguous: default to DD/MM (common in India, most of the world)
  return "dd_first"
}

// Convert 12-hour to 24-hour
const to24h = (h: number, period: string): number => {
  if (period.toUpperCase() === "PM" && h < 12) return h + 12
  if (period.toUpperCase() === "AM" && h === 12) return 0
  return h
}

// Time format patterns — AM/PM patterns first, then 24h fallbacks
const TIME_FORMATS = [
  { pattern: /(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–to]+\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i, name: "HH:MM AM/PM - HH:MM AM/PM (range)",
    parseStart: (m: RegExpMatchArray) => `${to24h(parseInt(m[1]), m[3]).toString().padStart(2, "0")}:${m[2]}:00`,
    parseEnd: (m: RegExpMatchArray) => `${to24h(parseInt(m[4]), m[6]).toString().padStart(2, "0")}:${m[5]}:00` },
  { pattern: /(\d{1,2}):(\d{2})\s*(AM|PM)/i, name: "HH:MM AM/PM (single)",
    parseStart: (m: RegExpMatchArray) => `${to24h(parseInt(m[1]), m[3]).toString().padStart(2, "0")}:${m[2]}:00`,
    parseEnd: null },
  { pattern: /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/, name: "HH:MM - HH:MM (range)", parseStart: (m: RegExpMatchArray) => `${m[1].padStart(2, "0")}:${m[2]}:00`, parseEnd: (m: RegExpMatchArray) => `${m[3].padStart(2, "0")}:${m[4]}:00` },
  { pattern: /(\d{1,2}):(\d{2})/, name: "HH:MM (single)", parseStart: (m: RegExpMatchArray) => `${m[1].padStart(2, "0")}:${m[2]}:00`, parseEnd: null },
]

export default function ProgramImportPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<CSVRow[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING)
  const [clearExisting, setClearExisting] = useState(false)
  const [dateOrder, setDateOrder] = useState<"mm_first" | "dd_first">("dd_first")
  const [detectedDateFormat, setDetectedDateFormat] = useState<string>("")
  const [detectedTimeFormat, setDetectedTimeFormat] = useState<string>("")

  // AI validation state
  type ValidationIssue = {
    severity: "error" | "warning" | "info"
    session_name: string
    current_time: string
    suggested_time: string
    reason: string
  }
  const [aiIssues, setAiIssues] = useState<ValidationIssue[]>([])
  const [aiSummary, setAiSummary] = useState<string>("")
  const [aiValidating, setAiValidating] = useState(false)
  const [aiError, setAiError] = useState<string>("")
  const [timeOverrides, setTimeOverrides] = useState<Map<string, { start_time: string; end_time: string }>>(new Map())

  // Parse CSV file
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return

    setFile(uploadedFile)

    const text = await uploadedFile.text()
    const lines = text.split("\n").filter(line => line.trim())

    if (lines.length < 2) {
      toast.error("CSV file must have at least a header and one data row")
      return
    }

    // Parse CSV (handling quoted values)
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []
      let current = ""
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
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

    // Remove BOM if present
    const headerLine = lines[0].replace(/^\uFEFF/, "")
    const headers = parseCSVLine(headerLine)
    setColumns(headers)

    // Parse data rows
    const data: CSVRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      const row: CSVRow = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ""
      })
      data.push(row)
    }
    setCsvData(data)

    // Auto-detect column mappings
    const autoMapping = { ...DEFAULT_MAPPING }

    headers.forEach(header => {
      const h = header.toLowerCase().trim()

      // Date column
      if (h.includes("date") && !autoMapping.date) autoMapping.date = header

      // Time column (start time) - skip if it's explicitly an "ending" or "end" time
      if ((h.includes("time") || h === "time") && !autoMapping.time && !h.includes("ending") && !h.includes("end time")) autoMapping.time = header

      // End Time column (separate from start time)
      if (!autoMapping.endTime && (h.includes("ending") || (h.includes("end") && h.includes("time")))) autoMapping.endTime = header

      // Topic/Title column
      if ((h.includes("topic") || h.includes("title") || h.includes("session name")) && !autoMapping.topic) autoMapping.topic = header

      // Hall/Venue column
      if ((h.includes("hall") || h.includes("venue") || h.includes("room")) && !autoMapping.hall) autoMapping.hall = header

      // Session/Track column
      if ((h.includes("session") || h.includes("track")) && !h.includes("name") && !h.includes("topic") && !autoMapping.session) autoMapping.session = header

      // Speaker/Name column - be more specific
      if (!autoMapping.speaker) {
        if (h === "name" || h === "speaker" || h === "faculty" || h === "full name" ||
            h.includes("speaker name") || h.includes("faculty name") ||
            (h.includes("name") && !h.includes("session") && !h.includes("hall") && !h.includes("event"))) {
          autoMapping.speaker = header
        }
      }

      // Role column - IMPORTANT for categorizing speakers/chairpersons
      if (!autoMapping.role) {
        if (h === "role" || h.includes("role") || h.includes("designation") || h.includes("position")) {
          autoMapping.role = header
        }
      }

      // Email column
      if (!autoMapping.email) {
        if (h.includes("email") || h.includes("e-mail") || h.includes("mail id")) {
          autoMapping.email = header
        }
      }

      // Phone/Mobile column
      if (!autoMapping.phone) {
        if (h.includes("phone") || h.includes("mobile") || h.includes("contact") || h.includes("cell") || h.includes("tel")) {
          autoMapping.phone = header
        }
      }
    })

    setMapping(autoMapping)

    // Detect date format and order (MM/DD vs DD/MM)
    if (autoMapping.date && data[0]) {
      const allDates = data.map(row => row[autoMapping.date] || "").filter(Boolean)
      const order = detectDateOrder(allDates)
      setDateOrder(order)

      const formats = order === "mm_first" ? DATE_FORMATS_MM_FIRST : DATE_FORMATS_DD_FIRST
      const sampleDate = data[0][autoMapping.date]
      for (const format of formats) {
        if (format.pattern.test(sampleDate)) {
          setDetectedDateFormat(format.name)
          break
        }
      }
    }

    // Detect time format from first row
    if (autoMapping.time && data[0]) {
      const sampleTime = data[0][autoMapping.time]
      for (const format of TIME_FORMATS) {
        if (format.pattern.test(sampleTime)) {
          setDetectedTimeFormat(format.name)
          break
        }
      }
    }

    setStep("mapping")
    toast.success(`Loaded ${data.length} rows from CSV`)
  }, [])

  // Process data for preview
  const DATE_FORMATS = dateOrder === "mm_first" ? DATE_FORMATS_MM_FIRST : DATE_FORMATS_DD_FIRST

  const processedData = useMemo(() => {
    if (!isValidMapping(mapping.date) || !isValidMapping(mapping.time) || !isValidMapping(mapping.topic)) return []

    const formats = dateOrder === "mm_first" ? DATE_FORMATS_MM_FIRST : DATE_FORMATS_DD_FIRST
    const sessionMap = new Map<string, any>()

    csvData.forEach(row => {
      // Parse date
      let parsedDate = ""
      const dateStr = row[mapping.date] || ""
      for (const format of formats) {
        const match = dateStr.match(format.pattern)
        if (match) {
          parsedDate = format.parse(match)
          break
        }
      }

      // Parse time
      let startTime = ""
      let endTime = ""
      const timeStr = row[mapping.time] || ""
      for (const format of TIME_FORMATS) {
        const match = timeStr.match(format.pattern)
        if (match) {
          startTime = format.parseStart(match)
          endTime = format.parseEnd ? format.parseEnd(match) : startTime
          break
        }
      }

      // Check for separate end time column
      if (startTime && (endTime === startTime || !endTime) && isValidMapping(mapping.endTime)) {
        const endTimeStr = row[mapping.endTime] || ""
        for (const format of TIME_FORMATS) {
          const match = endTimeStr.match(format.pattern)
          if (match) {
            endTime = format.parseStart(match)
            break
          }
        }
      }

      // Get other fields
      const topic = row[mapping.topic] || ""
      const hall = isValidMapping(mapping.hall) ? row[mapping.hall] || "" : ""
      const sessionTrack = isValidMapping(mapping.session) ? row[mapping.session] || "" : ""
      const speaker = isValidMapping(mapping.speaker) ? row[mapping.speaker] || "" : ""
      const role = isValidMapping(mapping.role) ? row[mapping.role] || "Speaker" : "Speaker"
      const email = isValidMapping(mapping.email) ? row[mapping.email] || "" : ""
      const phone = isValidMapping(mapping.phone) ? row[mapping.phone] || "" : ""

      if (!topic || !parsedDate || !startTime) return

      // Create session key
      const sessionKey = `${parsedDate}|${hall}|${sessionTrack}|${startTime}|${topic}`

      if (!sessionMap.has(sessionKey)) {
        // Calculate duration
        let duration: number | null = null
        if (startTime && endTime) {
          const [sh, sm] = startTime.split(":").map(Number)
          const [eh, em] = endTime.split(":").map(Number)
          duration = (eh * 60 + em) - (sh * 60 + sm)
          if (duration < 0) duration = null
        }

        sessionMap.set(sessionKey, {
          session_date: parsedDate,
          start_time: startTime,
          end_time: endTime,
          duration_minutes: duration,
          session_name: topic,
          hall: hall || null,
          specialty_track: sessionTrack || null,
          speakers: [] as { name: string; email: string; phone: string }[],
          chairpersons: [] as { name: string; email: string; phone: string }[],
          moderators: [] as { name: string; email: string; phone: string }[],
        })
      }

      // Add person with contact info
      const session = sessionMap.get(sessionKey)
      if (speaker) {
        const personExists = (arr: { name: string }[]) => arr.some(p => p.name === speaker)
        const personDetail = { name: speaker, email, phone }
        const roleLower = role.toLowerCase()
        if (roleLower.includes("chair") || roleLower.includes("coordinator")) {
          if (!personExists(session.chairpersons)) session.chairpersons.push(personDetail)
        } else if (roleLower.includes("moderator")) {
          if (!personExists(session.moderators)) session.moderators.push(personDetail)
        } else {
          if (!personExists(session.speakers)) session.speakers.push(personDetail)
        }
      }
    })

    return Array.from(sessionMap.values()).map(s => {
      const allPeople = [...s.speakers, ...s.chairpersons, ...s.moderators] as { name: string; email: string; phone: string }[]

      // Apply AI time overrides if present
      const override = timeOverrides.get(s.session_name)
      const startTime = override?.start_time || s.start_time
      const endTime = override?.end_time || s.end_time

      // Recalculate duration if overridden
      let duration = s.duration_minutes
      if (override && startTime && endTime) {
        const [sh, sm] = startTime.split(":").map(Number)
        const [eh, em] = endTime.split(":").map(Number)
        duration = (eh * 60 + em) - (sh * 60 + sm)
        if (duration < 0) duration = null
      }

      return {
        ...s,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: duration,
        speakers: s.speakers.map((p: any) => p.name).join(", ") || null,
        chairpersons: s.chairpersons.map((p: any) => p.name).join(", ") || null,
        moderators: s.moderators.map((p: any) => p.name).join(", ") || null,
        speakersWithContact: s.speakers.filter((p: any) => p.email).length,
        // For preview: show emails/phones of all people in this session
        _emails: allPeople.map(p => p.email).filter(Boolean).join(", ") || null,
        _phones: allPeople.map(p => p.phone).filter(Boolean).join(", ") || null,
        _invalidEmails: allPeople.filter(p => p.email && !isValidEmail(p.email)).map(p => p.email),
      }
    })
  }, [csvData, mapping, dateOrder, timeOverrides])

  // Stats
  const stats = useMemo(() => {
    const dates = new Set(processedData.map(s => s.session_date))
    const halls = new Set(processedData.map(s => s.hall).filter(Boolean))
    const speakers = new Set<string>()
    processedData.forEach(s => {
      if (s.speakers) s.speakers.split(",").forEach((sp: string) => speakers.add(sp.trim()))
    })

    // Check if CSV has email/phone columns
    const hasEmailColumn = columns.some(c => c.toLowerCase().includes("email"))
    const hasPhoneColumn = columns.some(c => c.toLowerCase().includes("mobile") || c.toLowerCase().includes("phone"))

    // Count faculty with contact info and validate emails
    let facultyWithContact = 0
    let validEmails = 0
    let invalidEmails = 0
    let missingEmails = 0
    if (hasEmailColumn || hasPhoneColumn) {
      const seenFaculty = new Set<string>()
      csvData.forEach(row => {
        const name = row[mapping.speaker]?.trim()
        if (name && !seenFaculty.has(name.toLowerCase())) {
          seenFaculty.add(name.toLowerCase())
          const emailVal = isValidMapping(mapping.email) ? row[mapping.email]?.trim() : ""
          const hasPhone = Object.entries(row).some(([k, v]) => (k.toLowerCase().includes("mobile") || k.toLowerCase().includes("phone")) && v?.trim())
          if (emailVal || hasPhone) facultyWithContact++
          // Email validation
          if (emailVal) {
            if (isValidEmail(emailVal)) validEmails++
            else invalidEmails++
          } else {
            missingEmails++
          }
        }
      })
    }

    return {
      sessions: processedData.length,
      days: dates.size,
      halls: halls.size,
      speakers: speakers.size,
      hasContactInfo: hasEmailColumn || hasPhoneColumn,
      facultyWithContact,
      validEmails,
      invalidEmails,
      missingEmails,
    }
  }, [processedData, columns, csvData, mapping.speaker])

  // Track import result for showing analysis
  const [importResult, setImportResult] = useState<any>(null)

  // Import mutation - always uses regular import with email/phone support
  const importMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append("file", file!)
      formData.append("event_id", eventId)
      formData.append("mapping", JSON.stringify(mapping))
      formData.append("date_order", dateOrder)
      if (clearExisting) formData.append("clear_existing", "true")

      const response = await fetch("/api/program/import", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Import failed")
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      queryClient.invalidateQueries({ queryKey: ["registrations"] })
      queryClient.invalidateQueries({ queryKey: ["hall-coordinators"] })
      queryClient.invalidateQueries({ queryKey: ["faculty"] })

      setImportResult(data)
      setStep("importing")

      const facultyInfo = data.faculty
        ? ` | ${data.faculty.created} faculty created, ${data.faculty.updated} updated`
        : ""
      toast.success(data.message || `Imported ${data.imported} sessions${facultyInfo}`, {
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Import Program</h1>
        <p className="text-muted-foreground">Upload a CSV file to import sessions</p>
      </div>

      {/* Steps indicator */}
      {step !== "importing" && (
        <div className="flex items-center gap-4 mb-8">
          {[
            { key: "upload", label: "Upload" },
            { key: "mapping", label: "Map Columns" },
            { key: "preview", label: "Preview" },
          ].map((s, i) => {
            const stepOrder = ["upload", "mapping", "preview"]
            const currentIdx = stepOrder.indexOf(step)
            return (
              <div key={s.key} className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  step === s.key ? "bg-primary text-primary-foreground" :
                  currentIdx > i ? "bg-green-500 text-white" :
                  "bg-muted text-muted-foreground"
                )}>
                  {currentIdx > i ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn("ml-2 text-sm", step === s.key && "font-medium")}>
                  {s.label}
                </span>
                {i < 2 && <ArrowRight className="h-4 w-4 mx-4 text-muted-foreground" />}
              </div>
            )
          })}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Program CSV
            </CardTitle>
            <CardDescription>
              Upload your CSV file with sessions, speakers, and contact details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Clear existing option */}
            <div className="mb-6 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Clear existing sessions before import</Label>
                  <p className="text-sm text-muted-foreground">
                    Delete all existing sessions for this event
                  </p>
                </div>
                <Switch checked={clearExisting} onCheckedChange={setClearExisting} />
              </div>
              {clearExisting && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  All existing sessions will be deleted
                </div>
              )}
            </div>

            {/* Upload area */}
            <label className="cursor-pointer block">
              <div className="border-2 border-dashed rounded-lg p-12 text-center transition-colors hover:border-primary/50 hover:bg-muted/30">
                <div className="p-4 bg-muted rounded-full w-fit mx-auto mb-4">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-2">
                  Click to select your CSV file
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Columns will be auto-detected on the next step
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  <Upload className="h-4 w-4" />
                  Select CSV File
                </div>
              </div>
            </label>

            {/* Feature highlights */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm">Auto Column Detection</span>
                </div>
                <p className="text-xs text-muted-foreground">Detects Date, Time, Topic, Hall, Speaker, Email, Phone columns</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-sm">Email & Phone Import</span>
                </div>
                <p className="text-xs text-muted-foreground">Faculty emails imported for sending invitations directly</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">Faculty Registration</span>
                </div>
                <p className="text-xs text-muted-foreground">Creates faculty records with contact info automatically</p>
              </div>
            </div>

            {/* Supported formats */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Supported CSV formats:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Date formats: DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD</li>
                <li>Time formats: HH:MM AM/PM, HH:MM - HH:MM (range), HH:MM (single)</li>
                <li>Columns: Date, Time, Topic, Hall, Session/Track, Speaker Name, Role, Email, Mobile Number</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <CardDescription>
              Match your CSV columns to the required fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File info */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-muted-foreground">{csvData.length} rows</p>
              </div>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setStep("upload")}>
                Change file
              </Button>
            </div>

            {/* Detected formats */}
            {(detectedDateFormat || detectedTimeFormat) && (
              <div className="flex flex-wrap gap-4 items-center">
                {detectedDateFormat && (
                  <Badge variant="outline" className="text-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Date format: {detectedDateFormat}
                  </Badge>
                )}
                {detectedTimeFormat && (
                  <Badge variant="outline" className="text-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Time format: {detectedTimeFormat}
                  </Badge>
                )}
                {/* Date order toggle */}
                {detectedDateFormat && !detectedDateFormat.startsWith("YYYY") && (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-sm text-muted-foreground">Date order:</span>
                    <Select value={dateOrder} onValueChange={(v: "mm_first" | "dd_first") => {
                      setDateOrder(v)
                      const formats = v === "mm_first" ? DATE_FORMATS_MM_FIRST : DATE_FORMATS_DD_FIRST
                      const sampleDate = csvData[0]?.[mapping.date] || ""
                      for (const format of formats) {
                        if (format.pattern.test(sampleDate)) {
                          setDetectedDateFormat(format.name)
                          break
                        }
                      }
                    }}>
                      <SelectTrigger className="w-[180px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mm_first">MM/DD (Jun 3 = 6/3)</SelectItem>
                        <SelectItem value="dd_first">DD/MM (Mar 6 = 6/3)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Mapping fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date Column <span className="text-destructive">*</span>
                </Label>
                <Select value={mapping.date} onValueChange={(v) => setMapping({ ...mapping, date: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <SampleValue column={mapping.date} data={csvData} />
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time Column <span className="text-destructive">*</span>
                </Label>
                <Select value={mapping.time} onValueChange={(v) => setMapping({ ...mapping, time: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <SampleValue column={mapping.time} data={csvData} />
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  End Time Column
                </Label>
                <p className="text-xs text-muted-foreground mb-1">
                  If start &amp; end times are in separate columns
                </p>
                <Select value={mapping.endTime} onValueChange={(v) => setMapping({ ...mapping, endTime: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">-- Skip (use time range) --</SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  Topic/Title Column <span className="text-destructive">*</span>
                </Label>
                <Select value={mapping.topic} onValueChange={(v) => setMapping({ ...mapping, topic: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Hall/Venue Column
                </Label>
                <Select value={mapping.hall} onValueChange={(v) => setMapping({ ...mapping, hall: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">-- Skip --</SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  Session/Track Column
                </Label>
                <Select value={mapping.session} onValueChange={(v) => setMapping({ ...mapping, session: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">-- Skip --</SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Speaker/Name Column
                </Label>
                <Select value={mapping.speaker} onValueChange={(v) => setMapping({ ...mapping, speaker: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">-- Skip --</SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <SampleValue column={mapping.speaker} data={csvData} />
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Role Column
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Recommended</Badge>
                </Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Used to identify Speaker, Chairperson, Moderator, etc.
                </p>
                <Select value={mapping.role} onValueChange={(v) => setMapping({ ...mapping, role: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">-- Skip (treat all as Speakers) --</SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <SampleValue column={mapping.role} data={csvData} />
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Column
                  <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">For Invitations</Badge>
                </Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Faculty email for sending invitations
                </p>
                <Select value={mapping.email} onValueChange={(v) => setMapping({ ...mapping, email: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">-- Skip --</SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <SampleValue column={mapping.email} data={csvData} />
                {isValidMapping(mapping.email) && (() => {
                  const emails = csvData.map(r => r[mapping.email]?.trim()).filter(Boolean)
                  const valid = emails.filter(isValidEmail).length
                  const invalid = emails.length - valid
                  return invalid > 0 ? (
                    <p className="text-xs text-destructive mt-1">
                      {invalid} invalid email{invalid > 1 ? "s" : ""} found — check mapping is correct
                    </p>
                  ) : emails.length > 0 ? (
                    <p className="text-xs text-green-600 mt-1">
                      All {valid} emails are valid
                    </p>
                  ) : null
                })()}
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone/Mobile Column
                </Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Faculty phone for WhatsApp/calling
                </p>
                <Select value={mapping.phone} onValueChange={(v) => setMapping({ ...mapping, phone: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">-- Skip --</SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <SampleValue column={mapping.phone} data={csvData} />
              </div>
            </div>

            {/* Sample data preview */}
            <div>
              <h4 className="font-medium mb-2">Sample Data (first 3 rows)</h4>
              <div className="border rounded-lg overflow-auto max-h-48">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.slice(0, 6).map(col => (
                        <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {columns.slice(0, 6).map(col => (
                          <TableCell key={col} className="whitespace-nowrap text-sm">
                            {row[col]?.substring(0, 30)}{row[col]?.length > 30 ? "..." : ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={!isValidMapping(mapping.date) || !isValidMapping(mapping.time) || !isValidMapping(mapping.topic)}
              >
                Continue to Preview
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl sm:text-3xl font-bold">{stats.sessions}</p>
                <p className="text-sm text-muted-foreground">Sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl sm:text-3xl font-bold">{stats.days}</p>
                <p className="text-sm text-muted-foreground">Days</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl sm:text-3xl font-bold">{stats.halls}</p>
                <p className="text-sm text-muted-foreground">Halls</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl sm:text-3xl font-bold">{stats.speakers}</p>
                <p className="text-sm text-muted-foreground">Speakers</p>
              </CardContent>
            </Card>
            {stats.hasContactInfo && (
              <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
                <CardContent className="pt-4">
                  <p className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.facultyWithContact}</p>
                  <p className="text-sm text-purple-600/70 dark:text-purple-400/70 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> With Contact
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Faculty contact info detected */}
          {stats.hasContactInfo && (
            <Card className={stats.invalidEmails > 0 ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" : "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stats.invalidEmails > 0 ? "bg-amber-100 dark:bg-amber-900/50" : "bg-green-100 dark:bg-green-900/50"}`}>
                    <Mail className={`h-5 w-5 ${stats.invalidEmails > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`} />
                  </div>
                  <div>
                    <p className={`font-medium ${stats.invalidEmails > 0 ? "text-amber-900 dark:text-amber-200" : "text-green-900 dark:text-green-200"}`}>
                      Email &amp; Phone Detected
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {stats.facultyWithContact} faculty have contact info.
                      {stats.validEmails > 0 && <span className="text-green-600"> {stats.validEmails} valid emails.</span>}
                      {stats.invalidEmails > 0 && <span className="text-destructive font-medium"> {stats.invalidEmails} invalid emails — check your Email column mapping!</span>}
                      {stats.missingEmails > 0 && <span className="text-amber-600"> {stats.missingEmails} without email.</span>}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Options */}
          {clearExisting && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              All existing sessions will be cleared before importing these {processedData.length} sessions
            </div>
          )}

          {/* Preview table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview ({processedData.length} sessions)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Session Name</TableHead>
                      <TableHead>Hall</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Speakers</TableHead>
                      {isValidMapping(mapping.email) && <TableHead>Email</TableHead>}
                      {isValidMapping(mapping.phone) && <TableHead>Phone</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedData.slice(0, 50).map((session, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap">{session.session_date}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {session.start_time?.substring(0, 5)} - {session.end_time?.substring(0, 5)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{session.session_name}</TableCell>
                        <TableCell>{session.hall || "-"}</TableCell>
                        <TableCell>{session.duration_minutes ? `${session.duration_minutes} min` : "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">{session.speakers || "-"}</TableCell>
                        {isValidMapping(mapping.email) && (
                          <TableCell className="max-w-xs truncate">
                            {session._emails ? (
                              session._invalidEmails?.length > 0 ? (
                                <span className="text-destructive">{session._emails}</span>
                              ) : (
                                <span className="text-green-600">{session._emails}</span>
                              )
                            ) : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                        )}
                        {isValidMapping(mapping.phone) && (
                          <TableCell className="max-w-xs truncate">
                            {session._phones || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {processedData.length > 50 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Showing first 50 of {processedData.length} sessions
                </p>
              )}
            </CardContent>
          </Card>

          {/* AI Validation */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-medium">AI Schedule Validator</p>
                    <p className="text-sm text-muted-foreground">
                      Detect AM/PM confusion, unreasonable times, and scheduling errors
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    setAiValidating(true)
                    setAiError("")
                    setAiIssues([])
                    setAiSummary("")
                    try {
                      const res = await fetch("/api/program/ai-validate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          sessions: processedData.map(s => ({
                            session_name: s.session_name,
                            session_date: s.session_date,
                            start_time: s.start_time,
                            end_time: s.end_time,
                            hall: s.hall,
                          })),
                        }),
                      })
                      if (!res.ok) {
                        const err = await res.json()
                        setAiError(err.error || "Validation failed")
                        return
                      }
                      const result = await res.json()
                      setAiIssues(result.issues || [])
                      setAiSummary(result.summary || "")
                      if (result.issues?.length === 0) {
                        toast.success("No issues found!")
                      } else {
                        toast.info(`Found ${result.issues.length} issue(s)`)
                      }
                    } catch {
                      setAiError("Could not reach AI validation service")
                    } finally {
                      setAiValidating(false)
                    }
                  }}
                  disabled={aiValidating || processedData.length === 0}
                >
                  {aiValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Validate with AI
                    </>
                  )}
                </Button>
              </div>

              {/* AI Error */}
              {aiError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {aiError}
                </div>
              )}

              {/* AI Summary */}
              {aiSummary && !aiError && (
                <div className={cn(
                  "mt-3 p-3 rounded-lg text-sm flex items-center gap-2",
                  aiIssues.length === 0
                    ? "bg-green-50 border border-green-200 text-green-800"
                    : "bg-amber-50 border border-amber-200 text-amber-800"
                )}>
                  {aiIssues.length === 0 ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  )}
                  {aiSummary}
                </div>
              )}

              {/* AI Issues */}
              {aiIssues.length > 0 && (
                <div className="mt-3 space-y-2">
                  {aiIssues.map((issue, i) => (
                    <div
                      key={i}
                      className={cn(
                        "p-3 rounded-lg border flex items-start justify-between gap-3",
                        issue.severity === "error" && "bg-red-50 border-red-200",
                        issue.severity === "warning" && "bg-amber-50 border-amber-200",
                        issue.severity === "info" && "bg-blue-50 border-blue-200",
                      )}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        {issue.severity === "error" && <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />}
                        {issue.severity === "warning" && <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />}
                        {issue.severity === "info" && <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{issue.session_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {issue.current_time} → {issue.suggested_time} — {issue.reason}
                          </p>
                        </div>
                      </div>
                      {issue.suggested_time && issue.suggested_time !== issue.current_time && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 text-xs"
                          disabled={timeOverrides.has(issue.session_name)}
                          onClick={() => {
                            const newMap = new Map(timeOverrides)
                            // Convert suggested HH:MM to HH:MM:00, keep original end_time offset
                            const suggested = issue.suggested_time.length === 5 ? `${issue.suggested_time}:00` : issue.suggested_time
                            const current = issue.current_time.length === 5 ? `${issue.current_time}:00` : issue.current_time
                            // Find the session to get its end time and calculate offset
                            const session = processedData.find(s => s.session_name === issue.session_name)
                            let newEnd = suggested
                            if (session) {
                              const [ch, cm] = current.split(":").map(Number)
                              const [eh, em] = session.end_time.split(":").map(Number)
                              const offset = (eh * 60 + em) - (ch * 60 + cm)
                              const [sh, sm] = suggested.split(":").map(Number)
                              const newEndMinutes = sh * 60 + sm + offset
                              const nh = Math.floor(newEndMinutes / 60)
                              const nm = newEndMinutes % 60
                              newEnd = `${nh.toString().padStart(2, "0")}:${nm.toString().padStart(2, "0")}:00`
                            }
                            newMap.set(issue.session_name, { start_time: suggested, end_time: newEnd })
                            setTimeOverrides(newMap)
                            toast.success(`Fixed: ${issue.session_name}`)
                          }}
                        >
                          {timeOverrides.has(issue.session_name) ? (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Applied
                            </>
                          ) : (
                            "Apply Fix"
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("mapping")}>
              Back to Mapping
            </Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || processedData.length === 0}
              size="lg"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {processedData.length} Sessions
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Import Results */}
      {step === "importing" && importResult && (
        <div className="space-y-6">
          {/* Success Header */}
          <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full">
                  <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-green-900 dark:text-green-200">Import Complete!</h2>
                  <p className="text-green-700 dark:text-green-300">{importResult.message}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Import Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl sm:text-3xl font-bold">{importResult.imported || 0}</p>
                <p className="text-sm text-muted-foreground">Sessions Imported</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl sm:text-3xl font-bold">{importResult.uniqueSessions || 0}</p>
                <p className="text-sm text-muted-foreground">Unique Sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl sm:text-3xl font-bold">{importResult.faculty?.created || 0}</p>
                <p className="text-sm text-muted-foreground">Faculty Created</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl sm:text-3xl font-bold">{importResult.faculty?.withContact || 0}</p>
                <p className="text-sm text-muted-foreground">With Email/Phone</p>
              </CardContent>
            </Card>
          </div>

          {/* Skipped duplicates info */}
          {importResult.skippedDuplicates > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {importResult.skippedDuplicates} duplicate sessions were skipped (already exist)
            </div>
          )}

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Next Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3 items-start">
                  <Badge className="shrink-0 bg-blue-100 text-blue-700">1</Badge>
                  <p>Go to <strong>Speakers page</strong> to sync faculty assignments (auto-runs on first visit)</p>
                </div>
                <div className="flex gap-3 items-start">
                  <Badge className="shrink-0 bg-blue-100 text-blue-700">2</Badge>
                  <p>Go to <strong>Confirmations</strong> to send invitations to speakers with email addresses</p>
                </div>
                <div className="flex gap-3 items-start">
                  <Badge className="shrink-0 bg-blue-100 text-blue-700">3</Badge>
                  <p>Speakers without emails will be skipped during invitation sending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => {
              setStep("upload")
              setFile(null)
              setCsvData([])
              setImportResult(null)
            }}>
              Import Another File
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push(`/events/${eventId}/program/sessions`)}>
                View Sessions
              </Button>
              <Button onClick={() => router.push(`/events/${eventId}/program/confirmations`)}>
                Send Invitations
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
