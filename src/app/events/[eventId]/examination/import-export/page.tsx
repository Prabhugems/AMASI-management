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
  Camera,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

type OcrRow = {
  reg_no: string
  name: string
  marks: Record<string, number | null>
  status: "marked" | "absent" | "exempted" | "blank"
  remarks: string | null
  confidence: "high" | "low"
}

type OcrPreviewRow = OcrRow & {
  matched_id: string | null
  matched_name: string | null
  include: boolean
}

export default function ImportExportPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: examSettings } = useExamSettings(eventId)

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null)

  // OCR state
  const ocrFileInputRef = useRef<HTMLInputElement>(null)
  const [ocrFiles, setOcrFiles] = useState<File[]>([])
  const [ocrProcessing, setOcrProcessing] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrRows, setOcrRows] = useState<OcrPreviewRow[]>([])
  const [ocrSaving, setOcrSaving] = useState(false)
  const [ocrResult, setOcrResult] = useState<{ success: number; errors: string[] } | null>(null)

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

  // ---- OCR handlers ----

  const handleOcrFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    if (files.length > 8) {
      setOcrError("Maximum 8 images per request")
      return
    }
    setOcrFiles(files)
    setOcrError(null)
    setOcrRows([])
    setOcrResult(null)
  }

  const removeOcrFile = (idx: number) => {
    setOcrFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const runOcr = async () => {
    if (!ocrFiles.length || !registrations) return
    setOcrProcessing(true)
    setOcrError(null)
    setOcrResult(null)

    try {
      const fd = new FormData()
      fd.append("event_id", eventId)
      ocrFiles.forEach((f) => fd.append("images", f))

      const res = await fetch("/api/examination/ocr-marks", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        setOcrError(data.error || "OCR failed")
        setOcrProcessing(false)
        return
      }

      // Build a lookup of registration_id -> {db_id, name}
      const regLookup = new Map<string, { id: string; name: string }>()
      registrations.forEach((r: any) => {
        if (r.registration_id) {
          regLookup.set(String(r.registration_id).trim().toUpperCase(), { id: r.id, name: r.name })
        }
      })

      const rows: OcrPreviewRow[] = (data.rows as OcrRow[]).map((row) => {
        const key = String(row.reg_no || "").trim().toUpperCase()
        const match = regLookup.get(key)
        return {
          ...row,
          matched_id: match?.id ?? null,
          matched_name: match?.name ?? null,
          // Default-include only "marked" rows that match a registration
          include: row.status === "marked" && !!match,
        }
      })
      setOcrRows(rows)
    } catch (err) {
      console.error(err)
      setOcrError("Network error during OCR")
    }
    setOcrProcessing(false)
  }

  const updateOcrRowMark = (rowIdx: number, key: string, value: string) => {
    setOcrRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r
        const num = value === "" ? null : Number(value)
        return { ...r, marks: { ...r.marks, [key]: Number.isNaN(num as number) ? null : num } }
      })
    )
  }

  const updateOcrRowReg = (rowIdx: number, value: string) => {
    setOcrRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r
        const key = value.trim().toUpperCase()
        const match = registrations?.find((reg: any) => String(reg.registration_id).trim().toUpperCase() === key)
        return {
          ...r,
          reg_no: value,
          matched_id: match?.id ?? null,
          matched_name: match?.name ?? null,
        }
      })
    )
  }

  const toggleOcrRow = (rowIdx: number) => {
    setOcrRows((prev) =>
      prev.map((r, i) => (i === rowIdx ? { ...r, include: !r.include } : r))
    )
  }

  const saveOcrRows = async () => {
    if (!examSettings) return
    const toSave = ocrRows.filter((r) => r.include && r.matched_id)
    if (!toSave.length) {
      setOcrError("Nothing selected to save")
      return
    }

    setOcrSaving(true)
    setOcrError(null)

    let success = 0
    const errors: string[] = []

    for (const row of toSave) {
      // Validate marks
      const marksToSave: Record<string, number | string | null> = {}
      let total = 0
      let valid = true
      for (const col of examSettings.mark_columns) {
        const v = row.marks[col.key]
        if (v == null || Number.isNaN(v)) {
          valid = false
          break
        }
        const clamped = Math.min(Math.max(0, Math.round(v)), col.max)
        marksToSave[col.key] = clamped
        total += clamped
      }
      if (!valid) {
        errors.push(`${row.reg_no}: missing marks`)
        continue
      }
      if (row.remarks) marksToSave.remarks = row.remarks

      const result = total >= examSettings.pass_marks ? "pass" : "fail"

      const res = await fetch("/api/examination/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.matched_id,
          exam_marks: marksToSave,
          exam_total_marks: total,
          exam_result: result,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        errors.push(`${row.reg_no}: ${err.error}`)
      } else {
        success++
      }
    }

    setOcrResult({ success, errors })
    setOcrSaving(false)
    await queryClient.invalidateQueries({ queryKey: ["exam-registrations", eventId] })
  }

  const resetOcr = () => {
    setOcrFiles([])
    setOcrRows([])
    setOcrError(null)
    setOcrResult(null)
    if (ocrFileInputRef.current) ocrFileInputRef.current.value = ""
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

      {/* OCR Photo Import (AI) */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              OCR Photo Import (AI)
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a photo of a handwritten marksheet. Claude vision extracts the rows; you review and edit before saving.
            </p>
          </div>
          {(ocrFiles.length > 0 || ocrRows.length > 0) && (
            <Button size="sm" variant="ghost" onClick={resetOcr} className="gap-1.5">
              <X className="h-4 w-4" />Reset
            </Button>
          )}
        </div>

        {/* File picker */}
        {ocrRows.length === 0 && (
          <>
            <input
              ref={ocrFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleOcrFilesSelected}
              className="hidden"
            />
            <Button
              onClick={() => ocrFileInputRef.current?.click()}
              variant="outline"
              className="w-full gap-2"
              disabled={ocrProcessing}
            >
              <Camera className="h-4 w-4" />
              {ocrFiles.length ? `${ocrFiles.length} image(s) selected` : "Choose marksheet photos"}
            </Button>

            {ocrFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ocrFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-secondary rounded-lg px-3 py-1.5">
                    <span className="truncate max-w-[200px]">{f.name}</span>
                    <button onClick={() => removeOcrFile(i)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={runOcr}
              disabled={!ocrFiles.length || ocrProcessing}
              className="w-full gap-2"
            >
              {ocrProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reading marksheet with AI…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Extract marks
                </>
              )}
            </Button>
          </>
        )}

        {ocrError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{ocrError}</p>
          </div>
        )}

        {/* Preview & edit */}
        {ocrRows.length > 0 && examSettings && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {ocrRows.length} rows extracted ·{" "}
                <span className="text-green-700 font-medium">
                  {ocrRows.filter((r) => r.include && r.matched_id).length} ready to save
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Edit any cell before saving. Rows with low confidence are highlighted.
              </p>
            </div>

            <div className="border rounded-lg overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="bg-secondary sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-10">
                      <input
                        type="checkbox"
                        checked={ocrRows.every((r) => r.include)}
                        onChange={(e) =>
                          setOcrRows((prev) => prev.map((r) => ({ ...r, include: e.target.checked && !!r.matched_id })))
                        }
                      />
                    </th>
                    <th className="p-2 text-left">Reg No</th>
                    <th className="p-2 text-left">Name (from sheet)</th>
                    <th className="p-2 text-left">Match</th>
                    {examSettings.mark_columns.map((c) => (
                      <th key={c.key} className="p-2 text-center">
                        {c.label}<span className="text-muted-foreground font-normal"> /{c.max}</span>
                      </th>
                    ))}
                    <th className="p-2 text-center">Total</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ocrRows.map((row, idx) => {
                    const total = examSettings.mark_columns.reduce(
                      (s, c) => s + ((row.marks[c.key] as number) || 0),
                      0
                    )
                    const isPass = total >= examSettings.pass_marks
                    const lowConf = row.confidence === "low"
                    const noMatch = !row.matched_id
                    return (
                      <tr
                        key={idx}
                        className={cn(
                          "border-t",
                          lowConf && "bg-amber-50 dark:bg-amber-950/10",
                          noMatch && "bg-red-50 dark:bg-red-950/10"
                        )}
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={row.include}
                            disabled={!row.matched_id || row.status !== "marked"}
                            onChange={() => toggleOcrRow(idx)}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.reg_no}
                            onChange={(e) => updateOcrRowReg(idx, e.target.value)}
                            className="w-28 px-2 py-1 border rounded font-mono text-xs"
                          />
                        </td>
                        <td className="p-2 text-xs text-muted-foreground truncate max-w-[140px]">
                          {row.name}
                        </td>
                        <td className="p-2 text-xs">
                          {row.matched_name ? (
                            <span className="text-green-700 font-medium">{row.matched_name}</span>
                          ) : (
                            <span className="text-red-600">No match</span>
                          )}
                        </td>
                        {examSettings.mark_columns.map((c) => (
                          <td key={c.key} className="p-2 text-center">
                            <input
                              type="number"
                              min={0}
                              max={c.max}
                              value={row.marks[c.key] ?? ""}
                              onChange={(e) => updateOcrRowMark(idx, c.key, e.target.value)}
                              className="w-14 px-1 py-1 border rounded text-center tabular-nums"
                            />
                          </td>
                        ))}
                        <td className={cn("p-2 text-center font-bold tabular-nums", isPass ? "text-green-700" : "text-red-600")}>
                          {row.status === "marked" ? total : "—"}
                        </td>
                        <td className="p-2 text-xs">
                          {row.status === "marked" && <span className={isPass ? "text-green-700" : "text-red-600"}>{isPass ? "PASS" : "FAIL"}</span>}
                          {row.status === "absent" && <span className="text-orange-600">ABSENT</span>}
                          {row.status === "exempted" && <span className="text-blue-600">EXEMPTED</span>}
                          {row.status === "blank" && <span className="text-muted-foreground">blank</span>}
                          {lowConf && <span className="ml-1 text-amber-600">⚠</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveOcrRows} disabled={ocrSaving} className="flex-1 gap-2">
                {ocrSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Save {ocrRows.filter((r) => r.include && r.matched_id).length} marks
                  </>
                )}
              </Button>
            </div>

            {ocrResult && (
              <div
                className={cn(
                  "p-4 rounded-lg border",
                  ocrResult.errors.length > 0
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200"
                    : "bg-green-50 dark:bg-green-950/20 border-green-200"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {ocrResult.errors.length > 0 ? (
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  <p className="font-medium text-sm">{ocrResult.success} marks saved</p>
                </div>
                {ocrResult.errors.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {ocrResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-amber-700">
                        {err}
                      </p>
                    ))}
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
