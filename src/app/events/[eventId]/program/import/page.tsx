"use client"

import { useState, useMemo, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  ArrowRight,
  MapPin,
  Clock,
  User,
  Users,
  Calendar,
  Eye,
  Phone,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type CSVRow = Record<string, string>
type ColumnMapping = {
  date: string
  time: string
  topic: string
  hall: string
  session: string
  speaker: string
  role: string
}

const DEFAULT_MAPPING: ColumnMapping = {
  date: "",
  time: "",
  topic: "",
  hall: "",
  session: "",
  speaker: "",
  role: "",
}

// Helper to check if a mapping value is valid (not empty and not skipped)
const isValidMapping = (value: string) => value && value !== "__skip__"

// Date format patterns
const DATE_FORMATS = [
  { pattern: /(\d{1,2})\.(\d{1,2})\.(\d{4})/, name: "DD.MM.YYYY", parse: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` },
  { pattern: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, name: "DD/MM/YYYY", parse: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` },
  { pattern: /(\d{4})-(\d{2})-(\d{2})/, name: "YYYY-MM-DD", parse: (m: RegExpMatchArray) => m[0] },
  { pattern: /(\d{1,2})-(\d{1,2})-(\d{4})/, name: "DD-MM-YYYY", parse: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` },
]

// Time format patterns
const TIME_FORMATS = [
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
  const [useAIImport, setUseAIImport] = useState(true) // Default to AI import
  const [detectedDateFormat, setDetectedDateFormat] = useState<string>("")
  const [detectedTimeFormat, setDetectedTimeFormat] = useState<string>("")
  const [useAdvancedMode, setUseAdvancedMode] = useState(false) // Show manual mapping steps

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

      // Time column
      if ((h.includes("time") || h === "time") && !autoMapping.time) autoMapping.time = header

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
    })

    setMapping(autoMapping)

    // Detect date format from first row
    if (autoMapping.date && data[0]) {
      const sampleDate = data[0][autoMapping.date]
      for (const format of DATE_FORMATS) {
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
  const processedData = useMemo(() => {
    if (!isValidMapping(mapping.date) || !isValidMapping(mapping.time) || !isValidMapping(mapping.topic)) return []

    const sessionMap = new Map<string, any>()

    csvData.forEach(row => {
      // Parse date
      let parsedDate = ""
      const dateStr = row[mapping.date] || ""
      for (const format of DATE_FORMATS) {
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

      // Get other fields
      const topic = row[mapping.topic] || ""
      const hall = isValidMapping(mapping.hall) ? row[mapping.hall] || "" : ""
      const sessionTrack = isValidMapping(mapping.session) ? row[mapping.session] || "" : ""
      const speaker = isValidMapping(mapping.speaker) ? row[mapping.speaker] || "" : ""
      const role = isValidMapping(mapping.role) ? row[mapping.role] || "Speaker" : "Speaker"

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
          speakers: [],
          chairpersons: [],
          moderators: [],
        })
      }

      // Add person
      const session = sessionMap.get(sessionKey)
      if (speaker) {
        const roleLower = role.toLowerCase()
        if (roleLower.includes("chair") || roleLower.includes("coordinator")) {
          if (!session.chairpersons.includes(speaker)) session.chairpersons.push(speaker)
        } else if (roleLower.includes("moderator")) {
          if (!session.moderators.includes(speaker)) session.moderators.push(speaker)
        } else {
          if (!session.speakers.includes(speaker)) session.speakers.push(speaker)
        }
      }
    })

    return Array.from(sessionMap.values()).map(s => ({
      ...s,
      speakers: s.speakers.join(", ") || null,
      chairpersons: s.chairpersons.join(", ") || null,
      moderators: s.moderators.join(", ") || null,
    }))
  }, [csvData, mapping])

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

    // Count faculty with contact info
    let facultyWithContact = 0
    if (hasEmailColumn || hasPhoneColumn) {
      const seenFaculty = new Set<string>()
      csvData.forEach(row => {
        const name = row[mapping.speaker]?.trim()
        if (name && !seenFaculty.has(name.toLowerCase())) {
          seenFaculty.add(name.toLowerCase())
          const hasEmail = Object.entries(row).some(([k, v]) => k.toLowerCase().includes("email") && v?.trim())
          const hasPhone = Object.entries(row).some(([k, v]) => (k.toLowerCase().includes("mobile") || k.toLowerCase().includes("phone")) && v?.trim())
          if (hasEmail || hasPhone) facultyWithContact++
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
    }
  }, [processedData, columns, csvData, mapping.speaker])

  // Track import result for showing analysis
  const [importResult, setImportResult] = useState<any>(null)

  // Quick AI Import - skip all manual steps
  const quickAIImport = useMutation({
    mutationFn: async (uploadedFile: File) => {
      const formData = new FormData()
      formData.append("file", uploadedFile)
      formData.append("event_id", eventId)
      if (clearExisting) formData.append("clear_existing", "true")

      const response = await fetch("/api/program/ai-import", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "AI Import failed")
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

      if (data.imported) {
        const { sessions, halls, faculty } = data.imported
        toast.success(
          `AI Import Complete: ${sessions} sessions, ${halls} halls, ${faculty.created} new faculty`,
          { duration: 6000 }
        )
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Handle Quick AI Import file selection
  const handleQuickAIImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return
    setFile(uploadedFile)
    quickAIImport.mutate(uploadedFile)
  }

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append("file", file!)
      formData.append("event_id", eventId)
      if (clearExisting) formData.append("clear_existing", "true")

      // Use AI import endpoint if enabled
      const endpoint = useAIImport ? "/api/program/ai-import" : "/api/program/import"

      const response = await fetch(endpoint, {
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

      // Store result for display
      setImportResult(data)
      setStep("importing") // Show results step

      // Show detailed success message
      if (useAIImport && data.imported) {
        const { sessions, halls, coordinators, faculty } = data.imported
        const analysisMsg = data.analysis?.issuesSummary?.total > 0
          ? ` | ${data.analysis.issuesSummary.total} timing issues found`
          : ""
        toast.success(
          `AI Import Complete: ${sessions} sessions, ${halls} halls, ${faculty.created} faculty${analysisMsg}`,
          { duration: 6000 }
        )
      } else {
        const facultyInfo = data.faculty
          ? ` | Faculty: ${data.faculty.created} created, ${data.faculty.updated} updated`
          : ""
        toast.success(data.message || `Imported ${data.imported} sessions${facultyInfo}`, {
          duration: 5000,
        })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Import Program</h1>
        <p className="text-muted-foreground">Upload a CSV file to import sessions</p>
      </div>

      {/* Steps indicator - only show in advanced mode or when on mapping/preview steps */}
      {(useAdvancedMode || step === "mapping" || step === "preview") && (
        <div className="flex items-center gap-4 mb-8">
          {["upload", "mapping", "preview"].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                step === s ? "bg-primary text-primary-foreground" :
                ["mapping", "preview"].indexOf(step) > i ? "bg-green-500 text-white" :
                "bg-muted text-muted-foreground"
              )}>
                {["mapping", "preview"].indexOf(step) > i ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn("ml-2 text-sm capitalize", step === s && "font-medium")}>
                {s}
              </span>
              {i < 2 && <ArrowRight className="h-4 w-4 mx-4 text-muted-foreground" />}
            </div>
          ))}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI-Powered Program Import
            </CardTitle>
            <CardDescription>
              Upload your CSV file and let AI automatically detect columns, create sessions, and import faculty
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Clear existing option */}
            <div className="mb-6 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Clear existing sessions before import</Label>
                  <p className="text-sm text-muted-foreground">
                    Delete all existing sessions and coordinators for this event
                  </p>
                </div>
                <Switch checked={clearExisting} onCheckedChange={setClearExisting} />
              </div>
              {clearExisting && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  All existing sessions and coordinators will be deleted
                </div>
              )}
            </div>

            {/* Upload area */}
            <div className={cn(
              "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
              quickAIImport.isPending ? "border-purple-300 bg-purple-50/50 dark:bg-purple-950/20" : "hover:border-purple-300"
            )}>
              {quickAIImport.isPending ? (
                <>
                  <Loader2 className="h-12 w-12 mx-auto text-purple-600 animate-spin mb-4" />
                  <p className="text-purple-700 dark:text-purple-300 font-medium">
                    AI is analyzing your CSV...
                  </p>
                  <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
                    Detecting columns, creating halls & coordinators, importing faculty
                  </p>
                </>
              ) : (
                <label className="cursor-pointer block">
                  <div className="p-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/50 dark:to-blue-900/50 rounded-full w-fit mx-auto mb-4">
                    <Upload className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-muted-foreground mb-2">
                    Click anywhere here to select your CSV file
                  </p>
                  <p className="text-sm text-purple-600 dark:text-purple-400 mb-4">
                    AI will automatically detect and import everything
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleQuickAIImport}
                    className="hidden"
                  />
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                    <Upload className="h-4 w-4" />
                    Select CSV File
                  </div>
                </label>
              )}
            </div>

            {/* Feature highlights */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-sm">Auto Column Detection</span>
                </div>
                <p className="text-xs text-muted-foreground">AI detects Date, Time, Topic, Hall, Speaker columns</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm">Faculty + Coordinators</span>
                </div>
                <p className="text-xs text-muted-foreground">Creates faculty records and hall coordinators</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="font-medium text-sm">Conflict Detection</span>
                </div>
                <p className="text-xs text-muted-foreground">Identifies timing overlaps and faculty conflicts</p>
              </div>
            </div>

            {/* Supported formats */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Supported CSV formats:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Date formats: DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD</li>
                <li>Time formats: HH:MM - HH:MM (range) or HH:MM (single)</li>
                <li>Columns: Date, Time, Topic, Hall, Session/Track, Speaker Name, Role, Email, Mobile</li>
              </ul>
            </div>

            {/* Advanced mode toggle */}
            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => setUseAdvancedMode(!useAdvancedMode)}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {useAdvancedMode ? "Hide" : "Show"} advanced options (manual column mapping)
              </button>

              {useAdvancedMode && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-3">
                    Use manual mapping if AI detection doesn't work correctly for your CSV format.
                  </p>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="max-w-xs"
                  />
                </div>
              )}
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
              <div className="flex gap-4">
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
              </div>

              <div className="md:col-span-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Role Column
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Recommended</Badge>
                </Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Used to identify Speaker, Chairperson, Moderator, Presenter, Panelist, etc.
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
                <p className="text-3xl font-bold">{stats.sessions}</p>
                <p className="text-sm text-muted-foreground">Sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-3xl font-bold">{stats.days}</p>
                <p className="text-sm text-muted-foreground">Days</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-3xl font-bold">{stats.halls}</p>
                <p className="text-sm text-muted-foreground">Halls</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-3xl font-bold">{stats.speakers}</p>
                <p className="text-sm text-muted-foreground">Speakers</p>
              </CardContent>
            </Card>
            {stats.hasContactInfo && (
              <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
                <CardContent className="pt-4">
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.facultyWithContact}</p>
                  <p className="text-sm text-purple-600/70 dark:text-purple-400/70 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> With Contact
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Faculty contact info detected */}
          {stats.hasContactInfo && (
            <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                    <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-purple-900 dark:text-purple-200">
                      Faculty Contact Info Detected
                    </p>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      {stats.facultyWithContact} faculty members will be created with their email/phone numbers.
                      They'll appear in the Hall Coordinator portal with Call/WhatsApp buttons.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Options */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* AI Import Toggle */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                    <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <Label className="font-medium text-purple-900 dark:text-purple-200">AI-Powered Import</Label>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Auto-detect columns, create halls & coordinators, import faculty contacts
                    </p>
                  </div>
                </div>
                <Switch checked={useAIImport} onCheckedChange={setUseAIImport} />
              </div>

              {/* Clear Existing */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Clear existing sessions</Label>
                  <p className="text-sm text-muted-foreground">
                    Delete all existing sessions for this event before importing
                  </p>
                </div>
                <Switch checked={clearExisting} onCheckedChange={setClearExisting} />
              </div>
              {clearExisting && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  All existing sessions {useAIImport ? "and coordinators " : ""}will be deleted
                </div>
              )}
            </CardContent>
          </Card>

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

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("mapping")}>
              Back to Mapping
            </Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || processedData.length === 0}
              size="lg"
              className={useAIImport ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" : ""}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {useAIImport ? "AI Analyzing & Importing..." : "Importing..."}
                </>
              ) : (
                <>
                  {useAIImport ? <Sparkles className="h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  {useAIImport ? `AI Import ${processedData.length} Sessions` : `Import ${processedData.length} Sessions`}
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
                  <h2 className="text-2xl font-bold text-green-900 dark:text-green-200">Import Complete!</h2>
                  <p className="text-green-700 dark:text-green-300">{importResult.message}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Import Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-3xl font-bold">{importResult.imported?.sessions || 0}</p>
                <p className="text-sm text-muted-foreground">Sessions Imported</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-3xl font-bold">{importResult.imported?.halls || 0}</p>
                <p className="text-sm text-muted-foreground">Halls Detected</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-3xl font-bold">{importResult.imported?.faculty?.created || 0}</p>
                <p className="text-sm text-muted-foreground">Faculty Created</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-3xl font-bold">{importResult.imported?.coordinators || 0}</p>
                <p className="text-sm text-muted-foreground">Coordinators Added</p>
              </CardContent>
            </Card>
          </div>

          {/* Schedule Summary */}
          {importResult.analysis?.scheduleSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Schedule Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{importResult.analysis.scheduleSummary.totalDays}</p>
                    <p className="text-xs text-muted-foreground">Days</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{importResult.analysis.scheduleSummary.totalSessions}</p>
                    <p className="text-xs text-muted-foreground">Total Sessions</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{importResult.analysis.scheduleSummary.totalHalls}</p>
                    <p className="text-xs text-muted-foreground">Halls</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{importResult.analysis.scheduleSummary.totalFaculty}</p>
                    <p className="text-xs text-muted-foreground">Faculty Members</p>
                  </div>
                </div>

                {/* Days Breakdown */}
                {importResult.analysis.scheduleSummary.daysBreakdown?.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Sessions</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Halls Used</TableHead>
                          <TableHead>Speakers</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.analysis.scheduleSummary.daysBreakdown.map((day: any) => (
                          <TableRow key={day.date}>
                            <TableCell className="font-medium">{day.date}</TableCell>
                            <TableCell>{day.sessions}</TableCell>
                            <TableCell>{day.totalHours} hrs</TableCell>
                            <TableCell>{day.hallsUsed}</TableCell>
                            <TableCell>{day.uniqueSpeakers}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timing Issues */}
          {importResult.analysis?.timingIssues?.length > 0 && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-5 w-5" />
                  Timing Issues Detected ({importResult.analysis.issuesSummary.total})
                </CardTitle>
                <div className="flex flex-wrap gap-2 mt-1">
                  {importResult.analysis.issuesSummary.overlaps > 0 && (
                    <Badge variant="destructive">{importResult.analysis.issuesSummary.overlaps} Overlaps</Badge>
                  )}
                  {importResult.analysis.issuesSummary.facultyConflicts > 0 && (
                    <Badge variant="destructive">{importResult.analysis.issuesSummary.facultyConflicts} Faculty Conflicts</Badge>
                  )}
                  {importResult.analysis.issuesSummary.gaps > 0 && (
                    <Badge variant="secondary">{importResult.analysis.issuesSummary.gaps} Gaps</Badge>
                  )}
                  {importResult.analysis.issuesSummary.longSessions > 0 && (
                    <Badge variant="secondary">{importResult.analysis.issuesSummary.longSessions} Long Sessions</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Hall</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.analysis.timingIssues.slice(0, 20).map((issue: any, i: number) => (
                        <TableRow key={i} className={issue.type === "overlap" || issue.type === "faculty_conflict" ? "bg-red-50 dark:bg-red-950/20" : ""}>
                          <TableCell>
                            <Badge variant={issue.type === "overlap" || issue.type === "faculty_conflict" ? "destructive" : "secondary"}>
                              {issue.type.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>{issue.hall}</TableCell>
                          <TableCell>{issue.date}</TableCell>
                          <TableCell className="text-sm">{issue.details}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Detection Info */}
          {importResult.ai_detection && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  AI Column Detection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {importResult.ai_detection.columns.map((col: any) => (
                    <Badge key={col.header} variant="outline" className="text-xs">
                      {col.header} → <span className="font-bold ml-1">{col.detected_as}</span>
                      <span className="ml-1 text-muted-foreground">({col.confidence}%)</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
            <Button onClick={() => router.push(`/events/${eventId}/program/sessions`)}>
              View Sessions
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
