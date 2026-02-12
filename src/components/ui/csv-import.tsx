"use client"

import { useState, useRef, useCallback } from "react"
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle2, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ColumnMapping {
  csvColumn: string
  dbColumn: string
  required?: boolean
}

interface ImportResult {
  success: number
  failed: number
  errors: { row: number; error: string }[]
}

interface CSVImportProps {
  title: string
  description: string
  templateColumns: { name: string; description: string; required?: boolean; example?: string }[]
  columnMappings: ColumnMapping[]
  onImport: (data: Record<string, any>[]) => Promise<ImportResult>
  templateFileName?: string
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"' && !inQuotes) {
      inQuotes = true
    } else if (char === '"' && inQuotes) {
      if (line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = false
      }
    } else if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, any>[] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""))

  const rows: Record<string, any>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === headers.length) {
      const row: Record<string, any> = {}
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || ""
      })
      rows.push(row)
    }
  }

  return { headers, rows }
}

export function CSVImport({
  title,
  description,
  templateColumns,
  columnMappings,
  onImport,
  templateFileName = "import_template.csv",
}: CSVImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<Record<string, any>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setError(null)
    setFile(selectedFile)
    setIsUploading(true)

    try {
      const text = await selectedFile.text()
      const { headers, rows } = parseCSV(text)

      if (rows.length === 0) {
        setError("No data found in the file")
        setIsUploading(false)
        return
      }

      setHeaders(headers)
      setParsedData(rows)
      setStep("preview")
    } catch (_err) {
      setError("Failed to parse the file. Please ensure it's a valid CSV.")
    } finally {
      setIsUploading(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && (droppedFile.type === "text/csv" || droppedFile.name.endsWith(".csv"))) {
      handleFileSelect(droppedFile)
    } else {
      setError("Please upload a CSV file")
    }
  }, [handleFileSelect])

  const handleImport = async () => {
    setIsImporting(true)
    setError(null)

    try {
      // Map CSV columns to DB columns
      const mappedData = parsedData.map(row => {
        const mapped: Record<string, any> = {}
        columnMappings.forEach(mapping => {
          const value = row[mapping.csvColumn]
          if (value !== undefined && value !== "") {
            mapped[mapping.dbColumn] = value
          }
        })
        return mapped
      })

      const result = await onImport(mappedData)
      setImportResult(result)
      setStep("result")
    } catch (err: any) {
      setError(err.message || "Import failed")
    } finally {
      setIsImporting(false)
    }
  }

  const downloadTemplate = () => {
    const headers = templateColumns.map(c => c.name).join(",")
    const example = templateColumns.map(c => c.example || "").join(",")
    const csv = `${headers}\n${example}`
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = templateFileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const reset = () => {
    setFile(null)
    setParsedData([])
    setHeaders([])
    setImportResult(null)
    setError(null)
    setStep("upload")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={cn(
              "relative border-2 border-dashed rounded-xl p-8 text-center transition-all",
              "hover:border-primary hover:bg-primary/5",
              isUploading ? "border-primary bg-primary/5" : "border-border"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-3">
              {isUploading ? (
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
              )}
              <div>
                <p className="font-medium text-foreground">
                  {isUploading ? "Processing..." : "Drop your CSV file here"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              </div>
            </div>
          </div>

          {/* Template Info */}
          <div className="bg-secondary/30 rounded-xl p-4">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Required Columns
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {templateColumns.map((col) => (
                <div key={col.name} className="text-sm">
                  <span className={col.required ? "font-medium text-foreground" : "text-muted-foreground"}>
                    {col.name}
                  </span>
                  {col.required && <span className="text-destructive ml-1">*</span>}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-muted-foreground">{parsedData.length} rows found</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>

          {/* Preview Table */}
          <div className="border rounded-xl overflow-hidden">
            <div className="max-h-[300px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                    {headers.slice(0, 5).map((header) => (
                      <th key={header} className="px-3 py-2 text-left font-medium text-muted-foreground">
                        {header}
                      </th>
                    ))}
                    {headers.length > 5 && (
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">...</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedData.slice(0, 5).map((row, index) => (
                    <tr key={index} className="hover:bg-secondary/30">
                      <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                      {headers.slice(0, 5).map((header) => (
                        <td key={header} className="px-3 py-2 truncate max-w-[150px]">
                          {row[header] || "-"}
                        </td>
                      ))}
                      {headers.length > 5 && <td className="px-3 py-2">...</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedData.length > 5 && (
              <div className="px-3 py-2 bg-secondary/30 text-sm text-muted-foreground text-center">
                ... and {parsedData.length - 5} more rows
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {parsedData.length} Rows
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === "result" && importResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-center">
              <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-2xl font-bold text-success">{importResult.success}</p>
              <p className="text-sm text-muted-foreground">Successfully imported</p>
            </div>
            <div className={cn(
              "rounded-xl p-4 text-center",
              importResult.failed > 0
                ? "bg-destructive/10 border border-destructive/20"
                : "bg-secondary/50 border border-border"
            )}>
              <AlertCircle className={cn(
                "h-8 w-8 mx-auto mb-2",
                importResult.failed > 0 ? "text-destructive" : "text-muted-foreground"
              )} />
              <p className={cn(
                "text-2xl font-bold",
                importResult.failed > 0 ? "text-destructive" : "text-muted-foreground"
              )}>
                {importResult.failed}
              </p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </div>

          {/* Errors */}
          {importResult.errors.length > 0 && (
            <div className="border border-destructive/20 rounded-xl overflow-hidden">
              <div className="bg-destructive/10 px-4 py-2">
                <h4 className="font-medium text-destructive">Errors ({importResult.errors.length})</h4>
              </div>
              <div className="max-h-[200px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Row</th>
                      <th className="px-3 py-2 text-left font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {importResult.errors.map((err, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2">{err.row}</td>
                        <td className="px-3 py-2 text-destructive">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={reset}>
              Import More
            </Button>
            <Button onClick={() => window.history.back()}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
