"use client"

import { useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useExamSettings } from "@/hooks/use-exam-settings"
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Search,
  Loader2,
  Users,
  UserCheck,
  UserX,
  Download,
  ClipboardList,
} from "lucide-react"
// jsPDF and autoTable are dynamically imported when needed (PDF generation)
import {
  AnimatedStatCard,
  HighlightText,
  EmptyState,
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
  checked_in: boolean | null
}

type TicketType = {
  id: string
  name: string
}

export default function AttendancePage() {
  const params = useParams()
  const eventId = params.eventId as string

  const { data: examSettings, isLoading: settingsLoading } = useExamSettings(eventId)

  const [search, setSearch] = useState("")
  const [ticketFilter, setTicketFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState("all")

  const searchInputRef = useRef<HTMLInputElement>(null)
  const { startExport, endExport, ExportOverlay } = useExportProgress()

  useKeyboardShortcut("k", () => {
    searchInputRef.current?.focus()
  }, { meta: true })

  const { data: registrations, isLoading } = useQuery({
    queryKey: ["exam-registrations", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/examination/registrations?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch registrations")
      const data = await res.json()
      return data as Registration[]
    },
    enabled: !!eventId,
    staleTime: 30_000,
  })

  // Derive ticket types
  const ticketTypes: TicketType[] = registrations
    ? Array.from(
        new Map(
          registrations
            .filter((r) => r.ticket_type_id)
            .map((r) => [r.ticket_type_id!, { id: r.ticket_type_id!, name: r.ticket_type_name || "Unknown" }])
        ).values()
      )
    : []

  // Filter by ticket type and search
  const baseFiltered = (registrations || []).filter((r) => {
    if (ticketFilter !== "all" && r.ticket_type_id !== ticketFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return r.name?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.registration_id?.toLowerCase().includes(s)
  })

  // Split by check-in status: checked_in = present, rest = absent
  const presentList = baseFiltered.filter((r) => r.checked_in)
  const absentList = baseFiltered.filter((r) => !r.checked_in)

  const displayList = activeTab === "present" ? presentList : activeTab === "absent" ? absentList : baseFiltered

  // Stats
  const total = baseFiltered.length
  const presentCount = presentList.length
  const absentCount = absentList.length
  const attendanceRate = total > 0 ? Math.round((presentCount / total) * 100) : 0

  const getTicketLabel = () => {
    return ticketFilter === "all"
      ? "All Candidates"
      : ticketTypes?.find(t => t.id === ticketFilter)?.name || "Candidates"
  }

  // PDF download
  const downloadAttendancePDF = async () => {
    if (!displayList.length) return
    startExport("Generating Attendance PDF...")

    const jsPDF = (await import("jspdf")).default
    const autoTable = (await import("jspdf-autotable")).default

    setTimeout(() => {
      const doc = new jsPDF()
      const ticketLabel = getTicketLabel()
      const tabLabel = activeTab === "present" ? "Present" : activeTab === "absent" ? "Absentees" : activeTab === "pending" ? "Pending" : "Attendance"

      doc.setFontSize(16)
      doc.text(`${tabLabel} List - ${ticketLabel}`, 14, 15)
      doc.setFontSize(10)
      doc.text(`${(examSettings?.exam_type || "FMAS").toUpperCase()} Examination | Total: ${displayList.length}`, 14, 22)

      const headers = ["#", "Registration No.", "Name", "Ticket Type", "Status"]
      const rows = displayList.map((reg, i) => [
        String(i + 1),
        reg.registration_id,
        reg.name,
        reg.ticket_type_name || "-",
        reg.checked_in ? "Present" : "Absent",
      ])

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 28,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [41, 37, 36], fontSize: 8 },
        columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 35 }, 2: { cellWidth: 55 } },
      })

      doc.save(`${tabLabel.toLowerCase()}-list-${ticketLabel.toLowerCase().replace(/\s/g, "-")}.pdf`)
      endExport()
    }, 100)
  }

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
            <ClipboardList className="h-6 w-6" />
            Attendance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {examSettings?.exam_type.toUpperCase()} Examination - Mark attendance and view absentees
          </p>
        </div>
        <Button onClick={downloadAttendancePDF} variant="outline" size="sm" className="gap-2 no-print" disabled={!displayList.length}>
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {/* Stats - Animated & Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AnimatedStatCard
          label="Total"
          value={total}
          onClick={() => setActiveTab(activeTab === "all" ? "all" : "all")}
          active={activeTab === "all"}
        />
        <AnimatedStatCard
          label="Present (Checked In)"
          value={presentCount}
          color="text-green-600"
          onClick={() => setActiveTab(activeTab === "present" ? "all" : "present")}
          active={activeTab === "present"}
        />
        <AnimatedStatCard
          label="Absent"
          value={absentCount}
          color="text-orange-600"
          onClick={() => setActiveTab(activeTab === "absent" ? "all" : "absent")}
          active={activeTab === "absent"}
        />
        <div className="bg-card border rounded-xl p-4 text-left stagger-item">
          <p className="text-sm text-muted-foreground">Attendance Rate</p>
          <p className={cn(
            "text-2xl font-bold tabular-nums",
            attendanceRate >= 80 ? "text-green-600" : attendanceRate >= 50 ? "text-yellow-600" : "text-red-600"
          )}>
            {attendanceRate}%
          </p>
          {/* Mini progress bar */}
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out",
                attendanceRate >= 80 ? "bg-green-500" : attendanceRate >= 50 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
        </div>
      </div>

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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="no-print">
          <TabsTrigger value="all" className="gap-2">
            <Users className="h-4 w-4" />
            All ({total})
          </TabsTrigger>
          <TabsTrigger value="present" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Present ({presentCount})
          </TabsTrigger>
          <TabsTrigger value="absent" className="gap-2">
            <UserX className="h-4 w-4" />
            Absent ({absentCount})
          </TabsTrigger>
        </TabsList>

        {["all", "present", "absent"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            {displayList.length === 0 ? (
              <EmptyState
                icon={<Users className="h-12 w-12 mx-auto" />}
                title={tab === "present" ? "No checked-in candidates" : tab === "absent" ? "Everyone is present!" : "No candidates found"}
                description={search ? `No results for "${search}".` : tab === "present" ? "No candidates have checked in yet." : tab === "absent" ? "All registered candidates have checked in." : "No registrations match your filters."}
              />
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Registration No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Ticket Type</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayList.map((reg, i) => (
                      <TableRow
                        key={reg.id}
                        className={cn(
                          "transition-colors duration-150 hover:bg-muted/50",
                          reg.checked_in && "bg-green-50/30 dark:bg-green-950/10"
                        )}
                      >
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell className="font-mono text-sm">
                          <HighlightText text={reg.registration_id} search={search} />
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">
                            <HighlightText text={reg.name} search={search} />
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <HighlightText text={reg.email} search={search} />
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs bg-secondary px-2 py-1 rounded">{reg.ticket_type_name || "-"}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {reg.checked_in ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full">
                              <UserCheck className="h-3 w-3" />Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2.5 py-1 rounded-full">
                              <UserX className="h-3 w-3" />Absent
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
