"use client"

import { useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useExamSettings } from "@/hooks/use-exam-settings"
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
  CheckCircle2,
  AlertCircle,
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
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

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
  const downloadScoringSheet = () => {
    if (!examSettings || !filtered.length) return
    const cols = getSelectedMarkColumns()
    if (!cols.length) { alert("Please select at least one column"); return }

    const doc = new jsPDF({ orientation: "landscape" })
    const ticketLabel = getTicketLabel()
    const selectedTotal = cols.reduce((s, c) => s + c.max, 0)

    doc.setFontSize(16)
    doc.text(`Scoring Sheet - ${ticketLabel}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`${examSettings.exam_type.toUpperCase()} Examination | Columns: ${cols.map(c => `${c.label}(${c.max})`).join(" + ")} = ${selectedTotal} marks`, 14, 22)

    const headers = ["#", "Registration No.", "Name", ...cols.map(col => `${col.label} [${col.max}]`), "Total", "Remarks"]
    const rows = filtered.map((reg, i) => [String(i + 1), reg.registration_id, reg.name, ...cols.map(() => ""), "", ""])

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 28,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [41, 37, 36], fontSize: 8 },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 30 }, 2: { cellWidth: 45 } },
    })

    doc.save(`scoring-sheet-${ticketLabel.toLowerCase().replace(/\s/g, "-")}.pdf`)
    setDownloadDialogOpen(false)
  }

  // PDF Generation - Attendance Sheet
  const downloadAttendanceSheet = () => {
    if (!filtered.length) return
    const doc = new jsPDF()
    const ticketLabel = getTicketLabel()

    doc.setFontSize(16)
    doc.text(`Attendance Sheet - ${ticketLabel}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`${(examSettings?.exam_type || "FMAS").toUpperCase()} Examination`, 14, 22)

    const headers = ["#", "Registration No.", "Name", "Signature"]
    const rows = filtered.map((reg, i) => [String(i + 1), reg.registration_id, reg.name, ""])

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 28,
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [41, 37, 36] },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 35 }, 2: { cellWidth: 60 }, 3: { cellWidth: 60 } },
    })

    doc.save(`attendance-sheet-${ticketLabel.toLowerCase().replace(/\s/g, "-")}.pdf`)
    setDownloadDialogOpen(false)
  }

  // CSV Template download
  const downloadCSVTemplate = () => {
    if (!examSettings || !filtered.length) return
    const cols = getSelectedMarkColumns()
    if (!cols.length) { alert("Please select at least one column"); return }

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
        <div className="flex items-center gap-2">
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

      {/* Stats - Clickable to filter */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: "Total", value: total, color: "", filter: "all" },
          { label: "Passed", value: passed, color: "text-green-600", filter: "pass" },
          { label: "Failed", value: failed, color: "text-red-600", filter: "fail" },
          { label: "Withheld", value: withheld, color: "text-yellow-600", filter: "withheld" },
          { label: "Absent", value: absent, color: "text-orange-600", filter: "absent" },
          { label: "Pending", value: pending, color: "text-blue-600", filter: "pending" },
        ].map((stat) => (
          <button
            key={stat.filter}
            onClick={() => setResultFilter(resultFilter === stat.filter ? "all" : stat.filter)}
            className={cn(
              "bg-card border rounded-xl p-4 text-left transition-all hover:shadow-md",
              resultFilter === stat.filter && stat.filter !== "all" && "ring-2 ring-primary border-primary"
            )}
          >
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
          </button>
        ))}
      </div>

      {/* Check Membership - shown when Withheld filter active */}
      {resultFilter === "withheld" && withheld > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-xl p-4 flex items-center justify-between">
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
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or reg ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
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
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No candidates found</p>
        </div>
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((reg, i) => {
                  const isEditing = editingId === reg.id
                  const regTotal = isEditing ? calculateTotal(editMarks) : reg.exam_total_marks

                  return (
                    <TableRow key={reg.id} className={cn(isEditing && "bg-blue-50 dark:bg-blue-950/20")}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{reg.name}</p>
                        <p className="text-xs text-muted-foreground">{reg.registration_id}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs bg-secondary px-2 py-1 rounded">{reg.ticket_type_name || "-"}</span>
                      </TableCell>

                      {/* Dynamic Mark Columns */}
                      {examSettings?.mark_columns.map(col => (
                        <TableCell key={col.key} className="text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              min={0}
                              max={col.max}
                              value={editMarks[col.key] ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : Math.min(Number(e.target.value), col.max)
                                setEditMarks(prev => ({ ...prev, [col.key]: val }))
                              }}
                              className="w-16 text-center h-8 text-sm"
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
                        {reg.exam_result === "pass" && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            <CheckCircle2 className="h-3 w-3" />Pass
                          </span>
                        )}
                        {reg.exam_result === "fail" && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-100 text-red-700 px-2 py-1 rounded-full">
                            <AlertCircle className="h-3 w-3" />Fail
                          </span>
                        )}
                        {reg.exam_result === "absent" && (
                          <span className="text-xs font-medium bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Absent</span>
                        )}
                        {reg.exam_result === "withheld" && (
                          <span className="text-xs font-medium bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Withheld</span>
                        )}
                        {!reg.exam_result && <span className="text-xs text-muted-foreground">Pending</span>}
                      </TableCell>

                      {/* Remarks */}
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editRemarks}
                            onChange={(e) => setEditRemarks(e.target.value)}
                            placeholder="Remarks"
                            className="w-28 h-8 text-sm"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">{String(reg.exam_marks?.remarks || "") || "-"}</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Button size="sm" onClick={() => saveMarks(reg.id)} disabled={savingId === reg.id} className="h-7 text-xs">
                              {savingId === reg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" />Save</>}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 text-xs">Cancel</Button>
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
