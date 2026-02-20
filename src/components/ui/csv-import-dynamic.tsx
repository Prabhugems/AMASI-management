"use client"

import { useState, useRef, useCallback, type ReactNode } from "react"
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle2, Download, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ImportResult {
  success: number
  failed: number
  errors: { row: number; error: string }[]
}

interface StandardField {
  key: string
  label: string
  required?: boolean
  description?: string
}

export interface PreviewExtra {
  header: ReactNode
  cell: (rowIndex: number) => ReactNode
  getRowData: (rowIndex: number) => Record<string, any>
}

interface CSVImportDynamicProps {
  title: string
  description: string
  standardFields: StandardField[]
  onImport: (data: Record<string, any>[]) => Promise<ImportResult>
  templateFileName?: string
  previewExtra?: PreviewExtra
  previewToolbar?: ReactNode
  showAllRowsInPreview?: boolean
}

export function CSVImportDynamic({
  title,
  description,
  standardFields,
  onImport,
  templateFileName = "import_template.csv",
  previewExtra,
  previewToolbar,
  showAllRowsInPreview = false,
}: CSVImportDynamicProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<Record<string, any>[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({})
  const [isUploading, setIsUploading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "result">("upload")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseCSV = (text: string): { headers: string[]; rows: Record<string, any>[] } => {
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

  const parseCSVLine = (line: string): string[] => {
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

  // Auto-map columns based on common patterns
  const autoMapColumns = (headers: string[]): Record<string, string> => {
    const mappings: Record<string, string> = {}

    // Order matters! More specific patterns should come first
    const patterns: [string, string[]][] = [
      // Ticket name MUST be checked before "name" to avoid false matches
      ["ticket_name", ["ticket name", "ticket type", "ticket"]],
      ["registered_on", ["registered on", "registration date", "order date"]],
      ["total_amount", ["total amount", "amount paid", "amount", "total", "payment", "price", "fee", "ticket price", "order amount"]],
      ["email", ["email", "email address", "e-mail", "mail"]],
      ["phone", ["phone", "mobile", "mobile number", "phone number", "contact", "cell"]],
      ["status", ["status", "registration status"]],
      // "name" checked last to avoid matching "ticket name"
      ["name", ["name", "full name", "attendee name", "participant name"]],
    ]

    // Columns to skip by default (serial numbers, order IDs, payment info we don't need)
    const skipPatterns = ["s.no", "s. no", "sr.no", "sr. no", "serial", "sl.no", "sl. no", "order id", "payment status", "payment method", "currency"]

    // Columns to save as custom field with renamed key
    const renamePatterns: Record<string, string> = {
      "registered id": "Original ID",
      "registration id": "Original ID",
      "reg id": "Original ID",
      "reg no": "Original ID",
    }

    headers.forEach(header => {
      const lowerHeader = header.toLowerCase().trim()

      // Check if should be skipped
      if (skipPatterns.some(k => lowerHeader === k || lowerHeader.includes(k))) {
        mappings[header] = "skip"
        return
      }

      // Check if should be renamed as custom field
      for (const [pattern, newName] of Object.entries(renamePatterns)) {
        if (lowerHeader === pattern || lowerHeader.includes(pattern)) {
          mappings[header] = `custom:${newName}`
          return
        }
      }

      // Check standard field patterns (order matters - more specific first)
      for (const [field, keywords] of patterns) {
        if (keywords.some(k => lowerHeader === k)) {
          mappings[header] = field
          return
        }
      }

      // Second pass: check if header contains any keyword (less strict)
      for (const [field, keywords] of patterns) {
        if (keywords.some(k => lowerHeader.includes(k) && k.length > 3)) {
          mappings[header] = field
          return
        }
      }

      // If not mapped to standard field, mark as custom
      mappings[header] = `custom:${header}`
    })

    return mappings
  }

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

      setCsvHeaders(headers)
      setParsedData(rows)

      // Auto-map columns
      const autoMappings = autoMapColumns(headers)
      setColumnMappings(autoMappings)

      setStep("mapping")
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

  const updateMapping = (csvColumn: string, targetField: string) => {
    setColumnMappings(prev => ({
      ...prev,
      [csvColumn]: targetField
    }))
  }

  const handleImport = async () => {
    // Validate required fields are mapped
    const requiredFields = standardFields.filter(f => f.required)
    const mappedFields = Object.values(columnMappings)

    for (const field of requiredFields) {
      if (!mappedFields.includes(field.key)) {
        setError(`Required field "${field.label}" is not mapped to any CSV column`)
        return
      }
    }

    setIsImporting(true)
    setError(null)

    try {
      // Transform data based on mappings
      const mappedData = parsedData.map((row, index) => {
        const mapped: Record<string, any> = {}
        const customFields: Record<string, any> = {}

        Object.entries(columnMappings).forEach(([csvColumn, targetField]) => {
          const value = row[csvColumn]
          if (value === undefined || value === "") return

          if (targetField === "skip") {
            // Skip this column
            return
          } else if (targetField.startsWith("custom:")) {
            // Store in custom fields
            const fieldName = targetField.replace("custom:", "")
            customFields[fieldName] = value
          } else {
            // Standard field
            mapped[targetField] = value
          }
        })

        // Add custom fields to form_responses
        if (Object.keys(customFields).length > 0) {
          mapped.form_responses = customFields
        }

        // Merge extra data from previewExtra (e.g. per-row ticket_type_id)
        if (previewExtra) {
          Object.assign(mapped, previewExtra.getRowData(index))
        }

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
    const headers = standardFields.map(f => f.label).join(",")
    const csv = `${headers}\n`
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
    setCsvHeaders([])
    setColumnMappings({})
    setImportResult(null)
    setError(null)
    setStep("upload")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const _getMappingOptions = () => {
    const options = [
      { value: "skip", label: "⊘ Skip this column", group: "action" },
    ]

    standardFields.forEach(field => {
      options.push({
        value: field.key,
        label: field.required ? `${field.label} *` : field.label,
        group: "standard"
      })
    })

    return options
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

      {/* Progress Steps */}
      <div className="flex items-center gap-2 text-sm">
        {["Upload", "Map Columns", "Preview", "Complete"].map((s, i) => {
          const stepIndex = ["upload", "mapping", "preview", "result"].indexOf(step)
          const isActive = i === stepIndex
          const isComplete = i < stepIndex
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium",
                isActive ? "bg-primary text-primary-foreground" :
                isComplete ? "bg-success text-white" :
                "bg-secondary text-muted-foreground"
              )}>
                {isComplete ? "✓" : i + 1}
              </div>
              <span className={cn(
                isActive ? "text-foreground font-medium" : "text-muted-foreground"
              )}>{s}</span>
              {i < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
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

          <div className="bg-secondary/30 rounded-xl p-4">
            <h4 className="font-medium text-sm mb-2">How it works:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Upload any CSV file with attendee data</li>
              <li>Map your CSV columns to standard fields</li>
              <li>Unmapped columns are saved as custom fields</li>
              <li>Preview and import your data</li>
            </ol>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {csvHeaders.length} columns, {parsedData.length} rows
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="h-4 w-4 mr-1" />
              Start Over
            </Button>
          </div>

          <div className="bg-secondary/30 rounded-xl p-4">
            <h4 className="font-medium text-sm mb-3">Map CSV Columns to Fields</h4>
            <p className="text-xs text-muted-foreground mb-4">
              We've auto-detected some mappings. Adjust as needed. Unmapped columns will be saved as custom fields.
            </p>

            <div className="space-y-3">
              {csvHeaders.map(header => {
                const currentMapping = columnMappings[header] || ""
                const isCustom = currentMapping.startsWith("custom:")
                const isSkipped = currentMapping === "skip"
                const isStandard = !isCustom && !isSkipped && currentMapping !== ""

                // Get sample value
                const sampleValue = parsedData[0]?.[header] || ""

                return (
                  <div key={header} className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{header}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Sample: {sampleValue || "(empty)"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="w-48">
                      <select
                        value={currentMapping}
                        onChange={(e) => updateMapping(header, e.target.value)}
                        className={cn(
                          "w-full px-3 py-2 rounded-md border text-sm",
                          "bg-background focus:outline-none focus:ring-2 focus:ring-primary",
                          isSkipped && "text-muted-foreground",
                          isCustom && "text-amber-600 dark:text-amber-400",
                          isStandard && "text-success"
                        )}
                      >
                        <option value={`custom:${header}`}>📦 Custom: {header}</option>
                        <option value="skip">⊘ Skip</option>
                        <optgroup label="Standard Fields">
                          {standardFields.map(field => (
                            <option key={field.key} value={field.key}>
                              {field.required ? `${field.label} *` : field.label}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-success"></div>
              <span>Standard Field</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-amber-500"></div>
              <span>Custom Field</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-gray-400"></div>
              <span>Skipped</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={() => setStep("preview")}>
              Continue to Preview
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Preview Import Data</p>
              <p className="text-sm text-muted-foreground">
                Review the mapped data before importing
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep("mapping")}>
              ← Back to Mapping
            </Button>
          </div>

          {/* Mapping Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-success/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-success">
                {Object.values(columnMappings).filter(v => !v.startsWith("custom:") && v !== "skip").length}
              </p>
              <p className="text-xs text-muted-foreground">Standard Fields</p>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {Object.values(columnMappings).filter(v => v.startsWith("custom:")).length}
              </p>
              <p className="text-xs text-muted-foreground">Custom Fields</p>
            </div>
            <div className="bg-secondary rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-muted-foreground">
                {Object.values(columnMappings).filter(v => v === "skip").length}
              </p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-primary">{parsedData.length}</p>
              <p className="text-xs text-muted-foreground">Total Rows</p>
            </div>
          </div>

          {/* Preview Toolbar (e.g. bulk-assign bar) */}
          {previewToolbar}

          {/* Preview Table */}
          <div className="border rounded-xl overflow-hidden">
            <div className={cn("overflow-auto", showAllRowsInPreview ? "max-h-[500px]" : "max-h-[300px]")}>
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 sticky top-0 z-10">
                  <tr>
                    {previewExtra && (
                      <th className="px-3 py-2 text-left font-medium">{previewExtra.header}</th>
                    )}
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                    {csvHeaders.filter(h => columnMappings[h] !== "skip").slice(0, 5).map((header) => {
                      const mapping = columnMappings[header]
                      const isCustom = mapping?.startsWith("custom:")
                      return (
                        <th key={header} className="px-3 py-2 text-left font-medium">
                          <span className={isCustom ? "text-amber-600 dark:text-amber-400" : "text-success"}>
                            {isCustom ? mapping.replace("custom:", "") : standardFields.find(f => f.key === mapping)?.label || header}
                          </span>
                        </th>
                      )
                    })}
                    {csvHeaders.filter(h => columnMappings[h] !== "skip").length > 5 && (
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">...</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(showAllRowsInPreview ? parsedData : parsedData.slice(0, 5)).map((row, index) => (
                    <tr key={index} className="hover:bg-secondary/30">
                      {previewExtra && (
                        <td className="px-3 py-2">{previewExtra.cell(index)}</td>
                      )}
                      <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                      {csvHeaders.filter(h => columnMappings[h] !== "skip").slice(0, 5).map((header) => (
                        <td key={header} className="px-3 py-2 truncate max-w-[150px]">
                          {row[header] || "-"}
                        </td>
                      ))}
                      {csvHeaders.filter(h => columnMappings[h] !== "skip").length > 5 && (
                        <td className="px-3 py-2">...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!showAllRowsInPreview && parsedData.length > 5 && (
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

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setStep("mapping")}>
              Back
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

      {/* Step 4: Result */}
      {step === "result" && importResult && (
        <div className="space-y-4">
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
