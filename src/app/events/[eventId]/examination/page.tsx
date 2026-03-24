"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useExamSettings } from "@/hooks/use-exam-settings"
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  FileSpreadsheet,
  Search,
  Save,
  Loader2,
  Users,
  Download,
  FileDown,
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
// jsPDF and autoTable are dynamically imported when needed (PDF generation)
import {
  AnimatedStatCard,
  HighlightText,
  EmptyState,
  ResultBadge,
  KbdHint,
  useExportProgress,
} from "@/components/examination/exam-ui"

type Registration = {
  id: string
  registration_id: string
  name: string
  email: string
  phone: string | null
  ticket_type_id: string | null
  ticket_type_name: string | null
  exam_marks: Record<string, number | null> | null
  exam_result: string | null
  exam_total_marks: number | null
  remarks: string | null
  checked_in: boolean | null
}

type TicketType = {
  id: string
  name: string
}

export default function MarksheetPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const { data: examSettings, isLoading: settingsLoading } = useExamSettings(eventId)

  const [search, setSearch] = useState("")
  const [ticketFilter, setTicketFilter] = useState<string>("all")
  const [resultFilter, setResultFilter] = useState<string>("all")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMarks, setEditMarks] = useState<Record<string, number | null>>({})
  const [editRemarks, setEditRemarks] = useState("")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [checkingMembership, setCheckingMembership] = useState(false)
  const [downloadType, setDownloadType] = useState<"scoring" | "attendance" | "csv">("scoring")
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])

  const markInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { startExport, endExport, ExportOverlay } = useExportProgress()

  // Keyboard shortcuts
  useKeyboardShortcut("Escape", () => {
    if (editingId) cancelEdit()
  }, { enabled: !!editingId })

  useKeyboardShortcut("k", () => {
    searchInputRef.current?.focus()
  }, { meta: true })

  // Fetch registrations via API (admin client bypasses RLS)
  const { data: registrations, isLoading } = useQuery({
    queryKey: ["exam-registrations", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/examination/registrations?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch registrations")
      const data = await res.json()
      return (data || []).map((r: any) => ({
        ...r,
        remarks: r.exam_marks?.remarks || null,
      })) as Registration[]
    },
    enabled: !!eventId,
    staleTime: 30_000,
  })

  // Derive ticket types from registrations
  const ticketTypes: TicketType[] = registrations
    ? Array.from(
        new Map(
          registrations
            .filter((r) => r.ticket_type_id)
            .map((r) => [r.ticket_type_id!, { id: r.ticket_type_id!, name: r.ticket_type_name || "Unknown" }])
        ).values()
      )
    : []

  const filtered = (registrations || []).filter((r) => {
    if (ticketFilter !== "all" && r.ticket_type_id !== ticketFilter) return false
    if (resultFilter !== "all") {
      if (resultFilter === "pending") {
        if (r.exam_result) return false
      } else if (r.exam_result !== resultFilter) return false
    }
    if (!search) return true
    const s = search.toLowerCase()
    return r.name?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.registration_id?.toLowerCase().includes(s)
  })

  const calculateTotal = useCallback((marks: Record<string, number | null>) => {
    if (!examSettings) return 0
    return examSettings.mark_columns.reduce((sum, col) => sum + (marks[col.key] || 0), 0)
  }, [examSettings])

  const startEdit = (reg: Registration) => {
    setEditingId(reg.id)
    const marks: Record<string, number | null> = {}
    examSettings?.mark_columns.forEach(col => {
      marks[col.key] = reg.exam_marks?.[col.key] ?? null
    })
    setEditMarks(marks)
    setEditRemarks(String(reg.exam_marks?.remarks || ""))

    // Focus first input after render
    setTimeout(() => {
      const firstKey = examSettings?.mark_columns[0]?.key
      if (firstKey) markInputRefs.current[firstKey]?.focus()
    }, 50)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditMarks({})
    setEditRemarks("")
  }

  const saveMarks = async (regId: string) => {
    if (!examSettings) return
    setSavingId(regId)
    try {
      const total = calculateTotal(editMarks)
      const result = total >= examSettings.pass_marks ? "pass" : "fail"

      const res = await fetch("/api/examination/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: regId,
          exam_marks: { ...editMarks, remarks: editRemarks || null },
          exam_total_marks: total,
          exam_result: result,
        }),
      })
      if (!res.ok) throw new Error("Failed to save marks")
      await queryClient.invalidateQueries({ queryKey: ["exam-registrations", eventId] })
      setEditingId(null)
    } catch (error) {
      console.error("Failed to save marks:", error)
    }
    setSavingId(null)
  }

  const markAbsent = async (regId: string) => {
    setSavingId(regId)
    try {
      const res = await fetch("/api/examination/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: regId,
          exam_marks: null,
          exam_total_marks: null,
          exam_result: "absent",
        }),
      })
      if (!res.ok) throw new Error("Failed to mark absent")
      await queryClient.invalidateQueries({ queryKey: ["exam-registrations", eventId] })
    } catch (error) {
      console.error("Failed to mark absent:", error)
    }
    setSavingId(null)
  }

  // Handle mark input change with auto-tab
  const handleMarkChange = (colKey: string, value: string, maxMark: number) => {
    if (value === "") {
      setEditMarks(prev => ({ ...prev, [colKey]: null }))
      return
    }
    const num = Math.min(Number(value), maxMark)
    setEditMarks(prev => ({ ...prev, [colKey]: num }))

    // Auto-tab to next field when max value is entered
    if (num === maxMark && examSettings) {
      const colIndex = examSettings.mark_columns.findIndex(c => c.key === colKey)
      if (colIndex >= 0 && colIndex < examSettings.mark_columns.length - 1) {
        const nextKey = examSettings.mark_columns[colIndex + 1].key
        setTimeout(() => markInputRefs.current[nextKey]?.focus(), 50)
      }
    }
  }

  // Handle Enter key on mark inputs to save
  const handleMarkKeyDown = (e: React.KeyboardEvent, regId: string) => {
    if (e.key === "Enter") {
      e.preventDefault()
      saveMarks(regId)
    }
    if (e.key === "Escape") {
      e.preventDefault()
      cancelEdit()
    }
  }

  // Open download dialog
  const openDownloadDialog = (type: "scoring" | "attendance" | "csv") => {
    if (!examSettings) return
    setDownloadType(type)
    // Default: all columns selected
    setSelectedColumns(examSettings.mark_columns.map(c => c.key))
    setDownloadDialogOpen(true)
  }

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const getSelectedMarkColumns = () => {
    if (!examSettings) return []
    return examSettings.mark_columns.filter(c => selectedColumns.includes(c.key))
  }

  const getTicketLabel = () => {
    return ticketFilter === "all"
      ? "All Candidates"
      : ticketTypes?.find(t => t.id === ticketFilter)?.name || "Candidates"
  }

  // PDF Generation - Scoring Sheet
  const downloadScoringSheet = async () => {
    if (!examSettings || !filtered.length) return
    const cols = getSelectedMarkColumns()
    if (!cols.length) { alert("Please select at least one column"); return }

    startExport("Generating Scoring Sheet PDF...")

    const jsPDF = (await import("jspdf")).default
    const autoTable = (await import("jspdf-autotable")).default

    setTimeout(() => {
      const doc = new jsPDF()
      const ticketLabel = getTicketLabel()
      const selectedTotal = cols.reduce((s, c) => s + c.max, 0)
      const ROWS_PER_PAGE = 25
      const headers = ["#", "Registration No.", "Name", ...cols.map(col => `${col.label} [${col.max}]`), "Remarks"]
      const allRows = filtered.map((reg, i) => [String(i + 1), reg.registration_id, reg.name, ...cols.map(() => ""), ""])
      const totalPages = Math.ceil(allRows.length / ROWS_PER_PAGE)
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) doc.addPage()

        doc.setFontSize(16)
        doc.text(`Scoring Sheet - ${ticketLabel}`, 14, 15)
        doc.setFontSize(10)
        doc.text(`${examSettings.exam_type.toUpperCase()} Examination | ${cols.map(c => `${c.label}(${c.max})`).join(" + ")} = ${selectedTotal} marks | Page ${page + 1} of ${totalPages}`, 14, 22)

        const pageRows = allRows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE)

        autoTable(doc, {
          head: [headers],
          body: pageRows,
          startY: 28,
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.5, lineColor: [0, 0, 0], fontStyle: "bold", fontSize: 8 },
          columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 30 }, 2: { cellWidth: 45 } },
        })

        // Per-page count
        const from = page * ROWS_PER_PAGE + 1
        const to = Math.min((page + 1) * ROWS_PER_PAGE, allRows.length)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalY = (doc as any).lastAutoTable?.finalY || 180

        doc.setFontSize(9)
        doc.setTextColor(100)
        doc.text(`Showing ${from} - ${to} of ${allRows.length} candidates`, 14, finalY + 8)
        doc.setTextColor(0)

        // Examiner signature block
        const sigY = pageHeight - 20
        doc.setFontSize(10)
        doc.text("Examiner's Name: ___________________________", 14, sigY)
        doc.text("Signature: ___________________________", pageWidth / 2 + 10, sigY)
      }

      doc.save(`scoring-sheet-${ticketLabel.toLowerCase().replace(/\s/g, "-")}.pdf`)
      setDownloadDialogOpen(false)
      endExport()
    }, 100)
  }

  // PDF Generation - Attendance Sheet
  const downloadAttendanceSheet = async () => {
    if (!filtered.length) return
    startExport("Generating Attendance Sheet PDF...")

    const jsPDF = (await import("jspdf")).default
    const autoTable = (await import("jspdf-autotable")).default

    setTimeout(() => {
      const doc = new jsPDF()
      const ticketLabel = getTicketLabel()
      const ROWS_PER_PAGE = 25
      const headers = ["#", "Registration No.", "Name", "Signature"]
      const allRows = filtered.map((reg, i) => [String(i + 1), reg.registration_id, reg.name, ""])
      const totalPages = Math.ceil(allRows.length / ROWS_PER_PAGE)
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) doc.addPage()

        doc.setFontSize(16)
        doc.text(`Attendance Sheet - ${ticketLabel}`, 14, 15)
        doc.setFontSize(10)
        doc.text(`${(examSettings?.exam_type || "FMAS").toUpperCase()} Examination | Page ${page + 1} of ${totalPages} | Total Candidates: ${allRows.length}`, 14, 22)

        const pageRows = allRows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE)

        autoTable(doc, {
          head: [headers],
          body: pageRows,
          startY: 28,
          styles: { fontSize: 10, cellPadding: 5 },
          headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.5, lineColor: [0, 0, 0], fontStyle: "bold" },
          columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 35 }, 2: { cellWidth: 60 }, 3: { cellWidth: 60 } },
        })

        // Per-page count and signature below table
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalY = (doc as any).lastAutoTable?.finalY || 240
        const from = page * ROWS_PER_PAGE + 1
        const to = Math.min((page + 1) * ROWS_PER_PAGE, allRows.length)

        doc.setFontSize(9)
        doc.setTextColor(100)
        doc.text(`Showing ${from} - ${to} of ${allRows.length} candidates`, 14, finalY + 8)
        doc.setTextColor(0)

        // Invigilator signature block - always at bottom with enough spacing
        const sigY = Math.max(finalY + 20, pageHeight - 30)
        doc.setFontSize(10)
        doc.text("Invigilator's Name: ___________________________", 14, sigY)
        doc.text("Signature: ___________________________", pageWidth / 2 + 10, sigY)
        doc.text("Date: _______________", 14, sigY + 10)
        doc.text("Remarks: ___________________________", pageWidth / 2 + 10, sigY + 10)
      }

      doc.save(`attendance-sheet-${ticketLabel.toLowerCase().replace(/\s/g, "-")}.pdf`)
      setDownloadDialogOpen(false)
      endExport()
    }, 100)
  }

  // CSV Template download
  const downloadCSVTemplate = () => {
    if (!examSettings || !filtered.length) return
    const cols = getSelectedMarkColumns()
    if (!cols.length) { alert("Please select at least one column"); return }

    startExport("Generating CSV...")

    setTimeout(() => {
      const headers = ["registration_id", "name", "email", ...cols.map(c => `${c.label.toLowerCase().replace(/\s/g, "_")}_${c.max}`), "remarks"]
      const rows = filtered.map((reg) => [reg.registration_id, reg.name, reg.email, ...cols.map(c => reg.exam_marks?.[c.key] ?? ""), String(reg.exam_marks?.remarks || "")])
      const csv = [headers.join(","), ...rows.map((r: any[]) => r.map((v: any) => `"${v}"`).join(","))].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `marks-template-${getTicketLabel().toLowerCase().replace(/\s/g, "-")}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setDownloadDialogOpen(false)
      endExport()
    }, 100)
  }

  // Stats
  const total = filtered.length
  const passed = filtered.filter(r => r.exam_result === "pass").length
  const failed = filtered.filter(r => r.exam_result === "fail").length
  const absent = filtered.filter(r => r.exam_result === "absent").length
  const withheld = filtered.filter(r => r.exam_result === "withheld").length
  const pending = total - passed - failed - absent - withheld
  const totalMax = examSettings?.mark_columns.reduce((s, c) => s + c.max, 0) || 0

  if (settingsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <ExportOverlay />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            Marksheet
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {examSettings?.exam_type.toUpperCase()} Examination - {examSettings?.mark_columns.map(c => `${c.label}(${c.max})`).join(" + ")} = {totalMax} marks
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Button onClick={() => openDownloadDialog("attendance")} variant="outline" size="sm" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Attendance PDF
          </Button>
          <Button onClick={() => openDownloadDialog("scoring")} variant="outline" size="sm" className="gap-2">
            <FileDown className="h-4 w-4" />
            Scoring PDF
          </Button>
          <Button onClick={() => openDownloadDialog("csv")} variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            CSV Template
          </Button>
        </div>
      </div>

      {/* Stats - Animated & Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: "Total", value: total, color: "", filter: "all" },
          { label: "Passed", value: passed, color: "text-green-600", filter: "pass" },
          { label: "Failed", value: failed, color: "text-red-600", filter: "fail" },
          { label: "Withheld", value: withheld, color: "text-yellow-600", filter: "withheld" },
          { label: "Absent", value: absent, color: "text-orange-600", filter: "absent" },
          { label: "Pending", value: pending, color: "text-blue-600", filter: "pending" },
        ].map((stat) => (
          <AnimatedStatCard
            key={stat.filter}
            label={stat.label}
            value={stat.value}
            color={stat.color}
            active={resultFilter === stat.filter && stat.filter !== "all"}
            onClick={() => setResultFilter(resultFilter === stat.filter ? "all" : stat.filter)}
          />
        ))}
      </div>

      {/* Check Membership - shown when Withheld filter active */}
      {resultFilter === "withheld" && withheld > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200 text-sm">
              {withheld} candidates withheld — check if they got AMASI membership
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
              Checks live AMASI API and auto-declares result for those with membership
            </p>
          </div>
          <Button
            onClick={async () => {
              setCheckingMembership(true)
              try {
                const res = await fetch("/api/examination/check-withheld", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ event_id: eventId }),
                })
                const result = await res.json()
                if (!res.ok) throw new Error(result.error)
                alert(`Membership check complete!\n\nDeclared PASS: ${result.declared}\nStill withheld: ${result.stillWithheld}${result.declaredList?.length ? "\n\nDeclared:\n" + result.declaredList.join("\n") : ""}${result.stillWithheldList?.length ? "\n\nStill no membership:\n" + result.stillWithheldList.join("\n") : ""}`)
                await queryClient.invalidateQueries({ queryKey: ["exam-registrations", eventId] })
              } catch (e: any) {
                alert("Failed: " + e.message)
              }
              setCheckingMembership(false)
            }}
            disabled={checkingMembership}
            variant="outline"
            className="gap-2 border-yellow-300 text-yellow-800 hover:bg-yellow-100 whitespace-nowrap"
          >
            {checkingMembership ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Check Membership
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 no-print">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search by name, email or reg ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <KbdHint>Cmd+K</KbdHint>
          </span>
        </div>
        <Select value={ticketFilter} onValueChange={setTicketFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Tickets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ticket Types</SelectItem>
            {ticketTypes?.map(tt => (
              <SelectItem key={tt.id} value={tt.id}>{tt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12 mx-auto" />}
          title="No candidates found"
          description={search ? `No results for "${search}". Try a different search term.` : resultFilter !== "all" ? `No candidates with "${resultFilter}" status in current filter.` : "No registrations found for this event."}
        />
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Ticket</TableHead>
                  {examSettings?.mark_columns.map(col => (
                    <TableHead key={col.key} className="text-center">
                      {col.label}<br/><span className="text-xs font-normal">({col.max})</span>
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Total<br/><span className="text-xs font-normal">({totalMax})</span></TableHead>
                  <TableHead className="text-center">Result</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="no-print">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((reg, i) => {
                  const isEditing = editingId === reg.id
                  const regTotal = isEditing ? calculateTotal(editMarks) : reg.exam_total_marks

                  return (
                    <TableRow
                      key={reg.id}
                      className={cn(
                        "transition-colors duration-150",
                        isEditing && "bg-blue-50 dark:bg-blue-950/20 shadow-inner",
                        !isEditing && "hover:bg-muted/50"
                      )}
                    >
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">
                          <HighlightText text={reg.name} search={search} />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <HighlightText text={reg.registration_id} search={search} />
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs bg-secondary px-2 py-1 rounded">{reg.ticket_type_name || "-"}</span>
                      </TableCell>

                      {/* Dynamic Mark Columns */}
                      {examSettings?.mark_columns.map(col => (
                        <TableCell key={col.key} className="text-center">
                          {isEditing ? (
                            <Input
                              ref={(el) => { markInputRefs.current[col.key] = el }}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={col.max}
                              value={editMarks[col.key] ?? ""}
                              onChange={(e) => handleMarkChange(col.key, e.target.value, col.max)}
                              onKeyDown={(e) => handleMarkKeyDown(e, reg.id)}
                              className="w-16 text-center h-8 text-sm font-semibold"
                            />
                          ) : (
                            <span className="text-sm">{reg.exam_marks?.[col.key] ?? "-"}</span>
                          )}
                        </TableCell>
                      ))}

                      {/* Total */}
                      <TableCell className="text-center">
                        <span className={cn(
                          "font-semibold text-sm",
                          regTotal !== null && regTotal !== undefined && examSettings
                            ? regTotal >= examSettings.pass_marks ? "text-green-600" : "text-red-600"
                            : ""
                        )}>
                          {regTotal ?? "-"}
                        </span>
                      </TableCell>

                      {/* Result */}
                      <TableCell className="text-center">
                        <ResultBadge result={reg.exam_result} />
                      </TableCell>

                      {/* Remarks */}
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editRemarks}
                            onChange={(e) => setEditRemarks(e.target.value)}
                            onKeyDown={(e) => handleMarkKeyDown(e, reg.id)}
                            placeholder="Remarks"
                            className="w-28 h-8 text-sm"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">{String(reg.exam_marks?.remarks || "") || "-"}</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="no-print">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Button size="sm" onClick={() => saveMarks(reg.id)} disabled={savingId === reg.id} className="h-7 text-xs gap-1">
                              {savingId === reg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3" />Save</>}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 text-xs">
                              Cancel <KbdHint>Esc</KbdHint>
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => startEdit(reg)} className="h-7 text-xs">
                              {reg.exam_marks ? "Edit" : "Enter"}
                            </Button>
                            {!reg.exam_result && !reg.checked_in && (
                              <Button size="sm" variant="ghost" onClick={() => markAbsent(reg.id)} disabled={savingId === reg.id} className="h-7 text-xs text-orange-600">
                                Absent
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Download Dialog with Column Selection */}
      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {downloadType === "scoring" && "Download Scoring Sheet PDF"}
              {downloadType === "attendance" && "Download Attendance Sheet PDF"}
              {downloadType === "csv" && "Download CSV Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Ticket Type Selector */}
            <div>
              <label className="text-sm font-medium mb-1 block">Select Ticket Type</label>
              <Select value={ticketFilter} onValueChange={setTicketFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Ticket Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Candidates</SelectItem>
                  {ticketTypes?.map(tt => (
                    <SelectItem key={tt.id} value={tt.id}>{tt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info */}
            <div className="text-sm text-muted-foreground">
              <p><strong>Ticket:</strong> {getTicketLabel()}</p>
              <p><strong>Candidates:</strong> {filtered.length}</p>
            </div>

            {/* Column Selection (not for attendance) */}
            {downloadType !== "attendance" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Select Columns</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedColumns(examSettings?.mark_columns.map(c => c.key) || [])}
                      className="text-xs text-primary hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedColumns([])}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="space-y-2 p-3 bg-secondary/30 rounded-lg">
                  {examSettings?.mark_columns.map(col => (
                    <label key={col.key} className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={selectedColumns.includes(col.key)}
                        onCheckedChange={() => toggleColumn(col.key)}
                      />
                      <span className="text-sm flex-1">{col.label}</span>
                      <span className="text-xs text-muted-foreground">max {col.max}</span>
                    </label>
                  ))}
                </div>
                {selectedColumns.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Selected: {getSelectedMarkColumns().map(c => c.label).join(", ")} = {getSelectedMarkColumns().reduce((s, c) => s + c.max, 0)} marks
                  </p>
                )}
              </div>
            )}

            {/* Download Button */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDownloadDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (downloadType === "scoring") downloadScoringSheet()
                  else if (downloadType === "attendance") downloadAttendanceSheet()
                  else if (downloadType === "csv") downloadCSVTemplate()
                }}
                className="gap-2"
                disabled={downloadType !== "attendance" && selectedColumns.length === 0}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
