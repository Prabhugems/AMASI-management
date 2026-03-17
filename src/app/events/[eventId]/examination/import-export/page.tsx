"use client"

import { useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useExamSettings } from "@/hooks/use-exam-settings"
import { Button } from "@/components/ui/button"
import {
  Upload,
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function ImportExportPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: examSettings } = useExamSettings(eventId)

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null)

  const { data: registrations } = useQuery({
    queryKey: ["exam-registrations", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/examination/registrations?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch registrations")
      return await res.json()
    },
    enabled: !!eventId,
  })

  const downloadTemplate = () => {
    if (!examSettings) { alert("Please configure exam settings first (Settings tab)"); return }
    if (!registrations?.length) { alert("No registrations found for this event"); return }
    const headers = [
      "registration_id", "name", "email",
      ...examSettings.mark_columns.map(c => `${c.label.toLowerCase().replace(/\s/g, "_")}_${c.max}`),
      "remarks",
    ]
    const rows = registrations.map((r: any) => [
      r.registration_id, r.name, r.email,
      ...examSettings.mark_columns.map(c => r.exam_marks?.[c.key] ?? ""),
      r.exam_marks?.remarks || "",
    ])
    const csv = [headers.join(","), ...rows.map((r: any[]) => r.map((v: any) => `"${v}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `marks-template-${eventId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadFullData = () => {
    if (!examSettings) { alert("Please configure exam settings first (Settings tab)"); return }
    if (!registrations?.length) { alert("No registrations found for this event"); return }
    const headers = [
      "registration_id", "name", "email", "phone", "ticket",
      ...examSettings.mark_columns.map(c => c.label),
      "total", "result", "remarks",
      "convocation_number", "address_line1", "address_line2", "city", "state", "pincode", "country",
    ]
    const rows = registrations.map((r: any) => {
      const addr = r.convocation_address || {}
      return [
        r.registration_id, r.name, r.email, r.phone || "", "",
        ...examSettings.mark_columns.map(c => r.exam_marks?.[c.key] ?? ""),
        r.exam_total_marks ?? "", r.exam_result || "", r.exam_marks?.remarks || "",
        r.convocation_number || "", addr.address_line1 || "", addr.address_line2 || "",
        addr.city || "", addr.state || "", addr.pincode || "", addr.country || "",
      ]
    })
    const csv = [headers.join(","), ...rows.map((r: any[]) => r.map((v: any) => `"${v}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `exam-full-data-${eventId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !registrations || !examSettings) return

    setImporting(true)
    setImportResult(null)

    try {
      const text = await file.text()
      const lines = text.split("\n").filter(l => l.trim())
      const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim().toLowerCase())

      const regIdIndex = headers.findIndex(h => h.includes("registration_id"))
      if (regIdIndex === -1) {
        setImportResult({ success: 0, errors: ["Missing 'registration_id' column in CSV"] })
        setImporting(false)
        return
      }

      // Map CSV column indices to mark column keys
      const columnMap: { key: string; csvIndex: number; max: number }[] = []
      examSettings.mark_columns.forEach(col => {
        const idx = headers.findIndex(h =>
          h.includes(col.key) || h.includes(col.label.toLowerCase().replace(/\s/g, "_"))
        )
        if (idx !== -1) columnMap.push({ key: col.key, csvIndex: idx, max: col.max })
      })

      const remarksIndex = headers.findIndex(h => h.includes("remarks"))
      const regMap = new Map(registrations.map((r: any) => [r.registration_id, r.id]))

      let success = 0
      const errors: string[] = []

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.replace(/"/g, "").trim())
        const regId = cols[regIdIndex]
        const dbId = regMap.get(regId)

        if (!dbId) {
          errors.push(`Row ${i + 1}: '${regId}' not found`)
          continue
        }

        const marks: Record<string, number | null | string> = {}
        let hasAnyMark = false

        for (const cm of columnMap) {
          const val = cols[cm.csvIndex]
          if (!val || val === "") { marks[cm.key] = null; continue }
          const n = Number(val)
          if (isNaN(n)) { marks[cm.key] = null; continue }
          marks[cm.key] = Math.min(Math.max(0, n), cm.max)
          hasAnyMark = true
        }

        if (!hasAnyMark) continue

        if (remarksIndex !== -1 && cols[remarksIndex]) {
          marks.remarks = cols[remarksIndex]
        }

        const total = examSettings.mark_columns.reduce((sum, col) => sum + ((marks[col.key] as number) || 0), 0)
        const result = total >= examSettings.pass_marks ? "pass" : "fail"

        const res = await fetch("/api/examination/registrations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: dbId, exam_marks: marks, exam_total_marks: total, exam_result: result }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }))
          errors.push(`Row ${i + 1}: ${err.error}`)
        } else {
          success++
        }
      }

      setImportResult({ success, errors })
      await queryClient.invalidateQueries({ queryKey: ["exam-registrations", eventId] })
    } catch (error) {
      console.error("Import failed:", error)
      setImportResult({ success: 0, errors: ["Failed to parse CSV file"] })
    }

    setImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" />
          Import / Export
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Bulk upload marks or download examination data</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Download */}
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />Download
          </h2>
          <div className="space-y-3">
            <div className="flex items-start justify-between p-4 bg-secondary/30 rounded-lg">
              <div>
                <p className="font-medium text-sm">Marks Template</p>
                <p className="text-xs text-muted-foreground mt-1">
                  CSV with candidate list and columns: {examSettings?.mark_columns.map(c => `${c.label}(${c.max})`).join(", ")}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={downloadTemplate} className="gap-2 flex-shrink-0">
                <FileDown className="h-4 w-4" />Template
              </Button>
            </div>
            <div className="flex items-start justify-between p-4 bg-secondary/30 rounded-lg">
              <div>
                <p className="font-medium text-sm">Full Exam Data</p>
                <p className="text-xs text-muted-foreground mt-1">Marks, results, convocation numbers, and addresses.</p>
              </div>
              <Button size="sm" variant="outline" onClick={downloadFullData} className="gap-2 flex-shrink-0">
                <FileDown className="h-4 w-4" />Full Data
              </Button>
            </div>
          </div>
        </div>

        {/* Upload */}
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-green-600" />Import Marks
          </h2>
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200"><strong>Instructions:</strong></p>
            <ul className="text-xs text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-disc pl-4">
              <li>Download the marks template first</li>
              <li>Fill in marks (leave blank to skip)</li>
              <li>Columns: {examSettings?.mark_columns.map(c => `${c.label}(max ${c.max})`).join(", ")}</li>
              <li>Pass mark: {examSettings?.pass_marks} - result is auto-calculated</li>
            </ul>
          </div>
          <div className="space-y-3">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} disabled={importing} className="w-full gap-2">
              {importing ? <><Loader2 className="h-4 w-4 animate-spin" />Importing...</> : <><Upload className="h-4 w-4" />Upload Marks CSV</>}
            </Button>
            {importResult && (
              <div className={cn(
                "p-4 rounded-lg border",
                importResult.errors.length > 0
                  ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200"
                  : "bg-green-50 dark:bg-green-950/20 border-green-200"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  {importResult.errors.length > 0 ? <AlertCircle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  <p className="font-medium text-sm">{importResult.success} marks imported</p>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, i) => <p key={i} className="text-xs text-amber-700">{err}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
