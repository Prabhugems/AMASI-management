"use client"

import { useState, useRef } from "react"
import { toast } from "sonner"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useExamSettings } from "@/hooks/use-exam-settings"
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  GraduationCap,
  Search,
  Save,
  Download,
  Loader2,
  Hash,
  Users,
  Wand2,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { COMPANY_CONFIG } from "@/lib/config"
import { cn } from "@/lib/utils"
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
  exam_result: string | null
  exam_total_marks: number | null
  exam_marks: Record<string, any> | null
  convocation_number: string | null
  ticket_type_name: string | null
  amasi_number?: number | null
}

export default function ConvocationPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()
  const { data: examSettings } = useExamSettings(eventId)

  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncingAirtable, setSyncingAirtable] = useState(false)
  const [activeTab, setActiveTab] = useState("exam")
  const [sortBy, setSortBy] = useState<"convocation" | "name" | "reg" | "marks" | "amasi">("convocation")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [filterAssigned, setFilterAssigned] = useState<"all" | "assigned" | "unassigned">("all")

  const searchInputRef = useRef<HTMLInputElement>(null)
  const { startExport, endExport, ExportOverlay } = useExportProgress()

  useKeyboardShortcut("k", () => {
    searchInputRef.current?.focus()
  }, { meta: true })

  useKeyboardShortcut("Escape", () => {
    if (editingId) setEditingId(null)
  }, { enabled: !!editingId })

  const { data: allRegistrations, isLoading } = useQuery({
    queryKey: ["exam-convocation", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/examination/registrations?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch registrations")
      const data = await res.json()
      return (data || []).map((r: any) => ({
        ...r,
        amasi_number: r.exam_marks?.amasi_number || r.amasi_number || null,
      })) as Registration[]
    },
    enabled: !!eventId,
    staleTime: 30_000,
  })

  // Helper: case-insensitive check for "WITHOUT EXAM" remarks
  const isWithoutExam = (r: Registration) => {
    const remarks = r.exam_marks?.remarks
    return typeof remarks === "string" && remarks.trim().toUpperCase() === "WITHOUT EXAM"
  }

  // Split into exam passed and without_exam (only those with AMASI number)
  const examPassed = (allRegistrations || [])
    .filter((r) => r.exam_result === "pass" && !isWithoutExam(r) && r.amasi_number)

  const withoutExam = (allRegistrations || [])
    .filter((r) => ((r.exam_result === "pass" && isWithoutExam(r)) || r.exam_result === "without_exam") && r.amasi_number)

  // Candidates without AMASI should not appear in convocation
  const noAmasi = (allRegistrations || [])
    .filter((r) => (r.exam_result === "pass" || r.exam_result === "without_exam") && !r.amasi_number)

  const currentList = activeTab === "exam" ? examPassed : withoutExam

  // Auto-switch tab if search matches candidate in the other tab
  const matchesSearch = (r: Registration, s: string) =>
    r.name?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.convocation_number?.toLowerCase().includes(s) || r.registration_id?.toLowerCase().includes(s) || r.phone?.includes(s) || String(r.amasi_number || "").includes(s)

  const otherTabHint = (() => {
    if (!search) return null
    const s = search.toLowerCase()
    const inCurrent = currentList.some((r) => matchesSearch(r, s))
    if (inCurrent) return null
    const otherList = activeTab === "exam" ? withoutExam : examPassed
    const count = otherList.filter((r) => matchesSearch(r, s)).length
    if (count > 0) return { tab: activeTab === "exam" ? "without_exam" : "exam", count }
    // Also check noAmasi list
    const noAmasiCount = noAmasi.filter((r) => matchesSearch(r, s)).length
    if (noAmasiCount > 0) return { tab: "no_amasi", count: noAmasiCount }
    return null
  })()

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortBy(col); setSortDir("asc") }
  }

  const filtered = currentList
    .filter((r) => {
      // Assignment filter
      if (filterAssigned === "assigned" && !r.convocation_number) return false
      if (filterAssigned === "unassigned" && r.convocation_number) return false
      // Search
      if (!search) return true
      const s = search.toLowerCase()
      return r.name?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.convocation_number?.toLowerCase().includes(s) || r.registration_id?.toLowerCase().includes(s) || r.phone?.includes(s) || String(r.amasi_number || "").includes(s)
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      switch (sortBy) {
        case "convocation":
          return dir * (a.convocation_number || "zzz").localeCompare(b.convocation_number || "zzz")
        case "name":
          return dir * (a.name || "").localeCompare(b.name || "")
        case "reg":
          return dir * (a.registration_id || "").localeCompare(b.registration_id || "")
        case "marks":
          return dir * ((a.exam_total_marks || 0) - (b.exam_total_marks || 0))
        case "amasi":
          return dir * ((a.amasi_number || 0) - (b.amasi_number || 0))
        default:
          return 0
      }
    })

  const assigned = currentList.filter(r => r.convocation_number).length
  const unassigned = currentList.length - assigned

  // Get prefix/start from settings
  const examPrefix = examSettings?.convocation_prefix || "122AEC"
  const examStart = examSettings?.convocation_start || 1001
  const wecPrefix = examSettings?.without_exam_prefix || "122WEC"
  const wecStart = examSettings?.without_exam_start || 1001

  const currentPrefix = activeTab === "exam" ? examPrefix : wecPrefix
  const currentStart = activeTab === "exam" ? examStart : wecStart

  const saveConvocationNumber = async (regId: string) => {
    setSavingId(regId)
    try {
      const res = await fetch("/api/examination/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: regId, convocation_number: editValue.trim() || null }),
      })
      if (!res.ok) throw new Error("Failed to save")
      await queryClient.invalidateQueries({ queryKey: ["exam-convocation", eventId] })
      setEditingId(null)
    } catch (error) {
      console.error("Failed to save convocation number:", error)
    }
    setSavingId(null)
  }

  const handleConvocationKeyDown = (e: React.KeyboardEvent, regId: string) => {
    if (e.key === "Enter") {
      e.preventDefault()
      saveConvocationNumber(regId)
    }
    if (e.key === "Escape") {
      e.preventDefault()
      setEditingId(null)
    }
  }

  const autoAssignNumbers = async () => {
    if (!currentList.length) return
    setAutoAssigning(true)
    try {
      const unassignedRegs = currentList.filter(r => !r.convocation_number)
      // Compute the next available number across the WHOLE event (any tab/prefix
      // in use) so manual assignments and out-of-order numbering can't cause
      // 409 collisions. Start from currentStart, then skip any number already taken.
      const usedNumbers = new Set<number>()
      for (const r of allRegistrations || []) {
        if (!r.convocation_number) continue
        if (!r.convocation_number.startsWith(currentPrefix)) continue
        const n = parseInt(r.convocation_number.slice(currentPrefix.length), 10)
        if (!isNaN(n)) usedNumbers.add(n)
      }
      let next = currentStart
      for (let i = 0; i < unassignedRegs.length; i++) {
        while (usedNumbers.has(next)) next++
        const convNum = `${currentPrefix}${next}`
        usedNumbers.add(next)
        const res = await fetch("/api/examination/registrations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: unassignedRegs[i].id, convocation_number: convNum }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Failed to assign ${convNum}`)
        }
        next++
      }
      await queryClient.invalidateQueries({ queryKey: ["exam-convocation", eventId] })
    } catch (error) {
      console.error("Failed to auto-assign:", error)
      alert(`Auto-assign failed: ${(error as Error).message}`)
    }
    setAutoAssigning(false)
  }

  const syncAmasiNumbers = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/examination/sync-amasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      alert(`Synced!\n\n${COMPANY_CONFIG.name} numbers matched: ${result.matched}\nPhone numbers filled: ${result.phoneFilled || 0}\nNot found: ${result.notFound}${result.notFound > 0 ? "\n\nNot found:\n" + result.notFoundEmails.join("\n") : ""}`)
      await queryClient.invalidateQueries({ queryKey: ["exam-convocation", eventId] })
    } catch (error) {
      console.error("Sync failed:", error)
    }
    setSyncing(false)
  }

  const syncAirtableRecords = async () => {
    setSyncingAirtable(true)
    try {
      // Find registrations with convocation number but no fillout link
      const missing = (allRegistrations || []).filter(
        (r: any) => r.convocation_number && !r.exam_marks?.fillout_link && (r.exam_result === "pass" || r.exam_result === "without_exam")
      )
      if (!missing.length) {
        toast.info("All records already synced to Airtable")
        setSyncingAirtable(false)
        return
      }
      // Call the exam-daily-sync cron to create missing Airtable records
      const res = await fetch("/api/cron/exam-daily-sync")
      const result = await res.json()
      toast.success(`Airtable sync complete!\nCreated: ${result.results?.airtableCreated || 0}\nErrors: ${result.results?.errors?.length || 0}`)
      await queryClient.invalidateQueries({ queryKey: ["exam-convocation", eventId] })
    } catch (error) {
      toast.error("Airtable sync failed")
      console.error("Airtable sync error:", error)
    }
    setSyncingAirtable(false)
  }

  const downloadCSV = () => {
    if (!filtered.length) return
    startExport("Generating CSV...")

    setTimeout(() => {
      const label = activeTab === "exam" ? "Exam Convocation" : "Without Exam Convocation"
      const markCols = examSettings?.mark_columns || []
      const headers = ["#", "Convocation No.", `${COMPANY_CONFIG.name} No.`, "Registration No.", "Name", "Email", "Phone", "Ticket Type", ...markCols.map(c => c.label), "Total Marks", "Result"]
      const rows = filtered.map((r, i) => [
        i + 1,
        r.convocation_number || "",
        r.amasi_number || "",
        r.registration_id,
        r.name,
        r.email,
        r.phone || "",
        r.ticket_type_name || "",
        ...markCols.map(c => r.exam_marks?.[c.key] ?? ""),
        r.exam_total_marks ?? "",
        r.exam_result === "pass" ? "PASS" : r.exam_result === "without_exam" ? "WITHOUT EXAM" : r.exam_result?.toUpperCase() || "",
      ])
      const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${label.toLowerCase().replace(/\s/g, "-")}-${eventId}.csv`
      a.click()
      URL.revokeObjectURL(url)
      endExport()
    }, 100)
  }

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy === col) return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
    return <ArrowUpDown className="h-3 w-3 opacity-30" />
  }

  return (
    <div className="p-6 space-y-6">
      <ExportOverlay />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Convocation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Assign convocation numbers to passed candidates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={syncAirtableRecords} variant="outline" className="gap-2" disabled={syncingAirtable}>
            {syncingAirtable ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Airtable
          </Button>
          <Button onClick={syncAmasiNumbers} variant="outline" className="gap-2" disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync {COMPANY_CONFIG.name} No.
          </Button>
          <Button onClick={downloadCSV} variant="outline" className="gap-2" disabled={!filtered.length}>
            <Download className="h-4 w-4" />
            Download List
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="exam" className="gap-2">
            Exam Passed ({examPassed.length})
          </TabsTrigger>
          <TabsTrigger value="without_exam" className="gap-2">
            Without Exam ({withoutExam.length})
          </TabsTrigger>
        </TabsList>

        {["exam", "without_exam"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            {/* Stats - Animated */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <AnimatedStatCard
                label="Total"
                value={currentList.length}
                color="text-green-600"
              />
              <AnimatedStatCard
                label="Assigned"
                value={assigned}
                color="text-blue-600"
              />
              <AnimatedStatCard
                label="Pending"
                value={unassigned}
                color="text-orange-600"
              />
            </div>

            {/* Warning: candidates without AMASI */}
            {noAmasi.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-xl p-4 mb-6">
                <p className="font-medium text-yellow-800 dark:text-yellow-200 text-sm">
                  {noAmasi.length} candidate(s) have no AMASI membership — cannot assign convocation numbers until membership is confirmed.
                </p>
                <ul className="mt-2 text-xs text-yellow-700 dark:text-yellow-300 space-y-1 max-h-32 overflow-y-auto">
                  {noAmasi.map((r) => (
                    <li key={r.id}>{r.name} — {r.email}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Auto Assign */}
            {unassigned > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl p-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Wand2 className="h-4 w-4" />
                  Auto-assign convocation numbers ({unassigned} pending)
                </h3>
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    Series: <span className="font-mono font-bold">{currentPrefix}{currentStart + assigned}</span> to <span className="font-mono font-bold">{currentPrefix}{currentStart + assigned + unassigned - 1}</span>
                  </div>
                  <Button onClick={autoAssignNumbers} disabled={autoAssigning} size="sm" className="gap-2">
                    {autoAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}
                    Assign to {unassigned} candidates
                  </Button>
                </div>
              </div>
            )}

            {/* Search + Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search name, email, phone, AMASI no, convocation no..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <KbdHint>Cmd+K</KbdHint>
                </span>
              </div>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                {(["all", "assigned", "unassigned"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterAssigned(f)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                      filterAssigned === f ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f === "all" ? `All (${currentList.length})` : f === "assigned" ? `Assigned (${assigned})` : `Pending (${unassigned})`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Showing {filtered.length} of {currentList.length}</p>
            </div>

            {/* Cross-tab search hint */}
            {otherTabHint && (
              <div className="mb-4">
                {otherTabHint.tab === "no_amasi" ? (
                  <p className="text-xs text-orange-600">
                    {otherTabHint.count} match(es) found in candidates without AMASI membership (see warning above).
                  </p>
                ) : (
                  <button
                    onClick={() => setActiveTab(otherTabHint.tab)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {otherTabHint.count} match(es) found in the &quot;{otherTabHint.tab === "exam" ? "Exam Passed" : "Without Exam"}&quot; tab — click to switch.
                  </button>
                )}
              </div>
            )}

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Users className="h-12 w-12 mx-auto" />}
                title="No candidates found"
                description={search ? `No results for "${search}".` : filterAssigned === "unassigned" ? "All candidates have been assigned convocation numbers." : filterAssigned === "assigned" ? "No convocation numbers assigned yet." : "No passed candidates found for this tab."}
              />
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("reg")}>
                        <span className="flex items-center gap-1">Reg No. <SortIcon col="reg" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("amasi")}>
                        <span className="flex items-center gap-1">{COMPANY_CONFIG.name} No. <SortIcon col="amasi" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                        <span className="flex items-center gap-1">Candidate <SortIcon col="name" /></span>
                      </TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("marks")}>
                        <span className="flex items-center justify-center gap-1">Marks <SortIcon col="marks" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("convocation")}>
                        <span className="flex items-center gap-1">Convocation No. <SortIcon col="convocation" /></span>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((reg, i) => (
                      <TableRow
                        key={reg.id}
                        className={cn(
                          "transition-colors duration-150 hover:bg-muted/50",
                          editingId === reg.id && "bg-blue-50 dark:bg-blue-950/20"
                        )}
                      >
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell className="font-mono text-sm">
                          <HighlightText text={reg.registration_id} search={search} />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {reg.amasi_number ? (
                            <HighlightText text={String(reg.amasi_number)} search={search} />
                          ) : (
                            <span className="text-xs text-red-500">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">
                            <HighlightText text={reg.name} search={search} />
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <HighlightText text={reg.email} search={search} />
                          </p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{reg.phone || "-"}</TableCell>
                        <TableCell>
                          <span className="text-xs bg-secondary px-2 py-1 rounded">{reg.ticket_type_name || "-"}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {reg.exam_total_marks != null ? (
                            <span className="font-semibold text-green-600 tabular-nums">{reg.exam_total_marks}/{examSettings?.mark_columns.reduce((s, c) => s + c.max, 0) || "-"}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === reg.id ? (
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => handleConvocationKeyDown(e, reg.id)}
                              placeholder={`${currentPrefix}${currentStart}`}
                              className="w-40 h-8 text-sm font-mono"
                              autoFocus
                            />
                          ) : (
                            <span className="text-sm font-mono font-semibold">
                              {reg.convocation_number ? (
                                <HighlightText text={reg.convocation_number} search={search} />
                              ) : (
                                <span className="text-muted-foreground font-normal">Not assigned</span>
                              )}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === reg.id ? (
                            <div className="flex items-center gap-1">
                              <Button size="sm" onClick={() => saveConvocationNumber(reg.id)} disabled={savingId === reg.id} className="h-7 text-xs">
                                {savingId === reg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" />Save</>}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">
                                Cancel <KbdHint>Esc</KbdHint>
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => { setEditingId(reg.id); setEditValue(reg.convocation_number || "") }}
                            >
                              {reg.convocation_number ? "Edit" : "Assign"}
                            </Button>
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
