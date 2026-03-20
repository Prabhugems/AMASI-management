"use client"

import { useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
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
  Trophy,
  Search,
  Download,
  Loader2,
  Users,
  Mail,
  Printer,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { COMPANY_CONFIG } from "@/lib/config"
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
  ticket_type_name: string | null
  exam_marks: Record<string, number | null> | null
  exam_result: string | null
  exam_total_marks: number | null
  convocation_number: string | null
}

export default function ResultsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const { data: examSettings } = useExamSettings(eventId)

  const [search, setSearch] = useState("")
  const [filterResult, setFilterResult] = useState<string>("all")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { startExport, endExport, ExportOverlay } = useExportProgress()

  useKeyboardShortcut("k", () => {
    searchInputRef.current?.focus()
  }, { meta: true })

  useKeyboardShortcut("p", () => {
    window.print()
  }, { meta: true })

  const { data: registrations, isLoading } = useQuery({
    queryKey: ["exam-results", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/examination/registrations?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch registrations")
      const data = await res.json()
      return (data || [])
        .filter((r: any) => r.exam_result)
        .sort((a: any, b: any) => (b.exam_total_marks || 0) - (a.exam_total_marks || 0))
        .map((r: any) => ({
          ...r,
          ticket_type_name: r.ticket_type_name || null,
        })) as Registration[]
    },
    enabled: !!eventId,
  })

  const filtered = (registrations || []).filter((r) => {
    if (filterResult !== "all" && r.exam_result !== filterResult) return false
    if (!search) return true
    const s = search.toLowerCase()
    return r.name?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.registration_id?.toLowerCase().includes(s)
  })

  const downloadCSV = () => {
    if (!filtered.length || !examSettings) return
    startExport("Generating CSV...")

    setTimeout(() => {
      const headers = [
        "Reg ID", "Name", "Email", "Phone", "Ticket",
        ...examSettings.mark_columns.map(c => c.label),
        "Total", "Result", "Remarks", "Convocation No."
      ]
      const rows = filtered.map(r => [
        r.registration_id, r.name, r.email, r.phone || "", r.ticket_type_name || "",
        ...examSettings.mark_columns.map(c => r.exam_marks?.[c.key] ?? ""),
        r.exam_total_marks ?? "", r.exam_result || "", r.exam_marks?.remarks || "", r.convocation_number || "",
      ])
      const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `exam-results-${eventId}.csv`
      a.click()
      URL.revokeObjectURL(url)
      endExport()
    }, 100)
  }

  const [sendingType, setSendingType] = useState<"pass" | "fail" | "withheld" | null>(null)

  const sendEmails = async (type: "pass" | "fail" | "withheld") => {
    const msg = type === "pass"
      ? "Send congratulations email to ALL passed candidates with convocation number and form link?"
      : type === "withheld"
      ? `Send ${COMPANY_CONFIG.name} membership required email to ALL withheld candidates?`
      : "Send fail notification email to ALL failed candidates?"
    if (!confirm(msg)) return
    setSendingType(type)
    try {
      const res = await fetch("/api/examination/send-pass-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, type, venue: "Vapi" }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      alert(`${type === "pass" ? "Pass" : type === "withheld" ? "Withheld" : "Fail"} emails!\n\nSent: ${result.sent}\nAlready sent: ${result.alreadySent || 0}\nFailed: ${result.failed}\nSkipped: ${result.skipped}${result.errors?.length ? "\n\nErrors:\n" + result.errors.join("\n") : ""}`)
    } catch (error: any) {
      alert("Failed: " + error.message)
    }
    setSendingType(null)
  }

  const passed = registrations?.filter(r => r.exam_result === "pass").length || 0
  const failed = registrations?.filter(r => r.exam_result === "fail").length || 0
  const absent = registrations?.filter(r => r.exam_result === "absent").length || 0
  const withheld = registrations?.filter(r => r.exam_result === "withheld").length || 0
  const totalMax = examSettings?.mark_columns.reduce((s, c) => s + c.max, 0) || 0

  return (
    <div className="p-6 space-y-6" id="results-page">
      <ExportOverlay />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            Results
          </h1>
          <p className="text-muted-foreground text-sm mt-1">View and download examination results</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Button onClick={() => sendEmails("pass")} variant="default" className="gap-2" disabled={sendingType !== null}>
            {sendingType === "pass" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send Pass Emails
          </Button>
          <Button onClick={() => sendEmails("withheld")} variant="outline" className="gap-2 text-yellow-600 hover:text-yellow-700" disabled={sendingType !== null}>
            {sendingType === "withheld" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send Withheld Emails
          </Button>
          <Button onClick={() => sendEmails("fail")} variant="outline" className="gap-2 text-red-600 hover:text-red-700" disabled={sendingType !== null}>
            {sendingType === "fail" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send Fail Emails
          </Button>
          <Button onClick={downloadCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />Download CSV
          </Button>
          <Button onClick={() => window.print()} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" />Print
          </Button>
        </div>
      </div>

      {/* Stats - Animated & Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Passed", value: passed, color: "text-green-600", filter: "pass", bg: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900" },
          { label: "Failed", value: failed, color: "text-red-600", filter: "fail", bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900" },
          { label: "Withheld", value: withheld, color: "text-yellow-600", filter: "withheld", bg: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900" },
          { label: "Absent", value: absent, color: "text-orange-600", filter: "absent", bg: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900" },
          { label: "All", value: (registrations?.length || 0), color: "", filter: "all", bg: "bg-card" },
        ].map((stat) => (
          <AnimatedStatCard
            key={stat.filter}
            label={stat.label}
            value={stat.value}
            color={stat.color}
            bgColor={stat.bg}
            active={filterResult === stat.filter && stat.filter !== "all"}
            onClick={() => setFilterResult(filterResult === stat.filter ? "all" : stat.filter)}
          />
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 no-print">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search candidates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <KbdHint>Cmd+K</KbdHint>
          </span>
        </div>
        <Select value={filterResult} onValueChange={setFilterResult}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="pass">Passed</SelectItem>
            <SelectItem value="fail">Failed</SelectItem>
            <SelectItem value="withheld">Withheld</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12 mx-auto" />}
          title="No results found"
          description={search ? `No results matching "${search}".` : filterResult !== "all" ? `No candidates with "${filterResult}" result.` : "No examination results available yet."}
        />
      ) : (
        <div className="border rounded-xl overflow-hidden print:border-gray-300">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="print:bg-gray-100">
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Ticket</TableHead>
                  {examSettings?.mark_columns.map(col => (
                    <TableHead key={col.key} className="text-center">{col.label}</TableHead>
                  ))}
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Result</TableHead>
                  <TableHead>Convocation No.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((reg, i) => (
                  <TableRow
                    key={reg.id}
                    className={cn(
                      "transition-colors duration-150 hover:bg-muted/50",
                      reg.exam_result === "pass" && "bg-green-50/50 dark:bg-green-950/10 print:bg-green-50"
                    )}
                  >
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">
                        <HighlightText text={reg.name} search={search} />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <HighlightText text={reg.email} search={search} />
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{reg.phone || "-"}</TableCell>
                    <TableCell><span className="text-xs bg-secondary px-2 py-1 rounded">{reg.ticket_type_name || "-"}</span></TableCell>
                    {examSettings?.mark_columns.map(col => (
                      <TableCell key={col.key} className="text-center text-sm">{reg.exam_marks?.[col.key] ?? "-"}</TableCell>
                    ))}
                    <TableCell className="text-center">
                      <span className={cn(
                        "font-bold tabular-nums",
                        reg.exam_result === "pass" ? "text-green-600" : "text-red-600"
                      )}>
                        {reg.exam_total_marks ?? "-"}
                        <span className="text-xs text-muted-foreground font-normal">/{totalMax}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <ResultBadge result={reg.exam_result} />
                    </TableCell>
                    <TableCell className="text-sm font-mono">{reg.convocation_number || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
