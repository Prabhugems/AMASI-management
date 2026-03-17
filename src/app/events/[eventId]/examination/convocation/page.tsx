"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
} from "lucide-react"

type Registration = {
  id: string
  registration_id: string
  name: string
  email: string
  exam_result: string | null
  exam_total_marks: number | null
  convocation_number: string | null
  ticket_type_name: string | null
}

export default function ConvocationPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [autoPrefix, setAutoPrefix] = useState("FMAS")
  const [autoStartNum, setAutoStartNum] = useState(1)
  const [autoAssigning, setAutoAssigning] = useState(false)

  // Fetch passed candidates via API
  const { data: registrations, isLoading } = useQuery({
    queryKey: ["exam-convocation", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/examination/registrations?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch registrations")
      const data = await res.json()
      return (data || [])
        .filter((r: any) => r.exam_result === "pass")
        .sort((a: any, b: any) => (b.exam_total_marks || 0) - (a.exam_total_marks || 0))
        .map((r: any) => ({
          ...r,
          ticket_type_name: r.ticket_type_name || null,
        })) as Registration[]
    },
    enabled: !!eventId,
  })

  const filtered = (registrations || []).filter((r) => {
    if (!search) return true
    const s = search.toLowerCase()
    return r.name?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.convocation_number?.toLowerCase().includes(s)
  })

  const assigned = registrations?.filter(r => r.convocation_number).length || 0
  const unassigned = (registrations?.length || 0) - assigned

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

  const autoAssignNumbers = async () => {
    if (!registrations?.length) return
    setAutoAssigning(true)
    try {
      const unassignedRegs = registrations.filter(r => !r.convocation_number)
      for (let i = 0; i < unassignedRegs.length; i++) {
        const num = autoStartNum + i + assigned // offset by already assigned
        const convNum = `${autoPrefix}/${String(num).padStart(4, "0")}`
        const res = await fetch("/api/examination/registrations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: unassignedRegs[i].id, convocation_number: convNum }),
        })
        if (!res.ok) throw new Error("Failed to assign")
      }
      await queryClient.invalidateQueries({ queryKey: ["exam-convocation", eventId] })
    } catch (error) {
      console.error("Failed to auto-assign:", error)
    }
    setAutoAssigning(false)
  }

  const downloadCSV = () => {
    if (!filtered.length) return
    const headers = ["Convocation No.", "Name", "Email", "Total Marks", "Reg ID"]
    const rows = filtered.map(r => [
      r.convocation_number || "",
      r.name,
      r.email,
      r.exam_total_marks ?? "",
      r.registration_id,
    ])
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `convocation-list-${eventId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
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
        <Button onClick={downloadCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download List
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Passed</p>
          <p className="text-2xl font-bold text-green-600">{registrations?.length || 0}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">Number Assigned</p>
          <p className="text-2xl font-bold text-blue-600">{assigned}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-orange-600">{unassigned}</p>
        </div>
      </div>

      {/* Auto Assign */}
      {unassigned > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl p-4">
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Auto-assign convocation numbers ({unassigned} pending)
          </h3>
          <div className="flex items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Prefix</label>
              <Input
                value={autoPrefix}
                onChange={(e) => setAutoPrefix(e.target.value)}
                placeholder="FMAS"
                className="w-28 h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Start Number</label>
              <Input
                type="number"
                value={autoStartNum}
                onChange={(e) => setAutoStartNum(Number(e.target.value))}
                className="w-24 h-9"
              />
            </div>
            <div className="text-xs text-muted-foreground pb-2">
              Preview: {autoPrefix}/{String(autoStartNum).padStart(4, "0")}
            </div>
            <Button onClick={autoAssignNumbers} disabled={autoAssigning} size="sm" className="gap-2">
              {autoAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}
              Assign to {unassigned} candidates
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search candidates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No passed candidates found</p>
          <p className="text-sm mt-1">Enter marks and results in the Marksheet tab first.</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead className="text-center">Total Marks</TableHead>
                <TableHead>Convocation Number</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((reg, i) => (
                <TableRow key={reg.id}>
                  <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{reg.name}</p>
                    <p className="text-xs text-muted-foreground">{reg.email}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs bg-secondary px-2 py-1 rounded">{reg.ticket_type_name || "-"}</span>
                  </TableCell>
                  <TableCell className="text-center font-semibold text-green-600">
                    {reg.exam_total_marks ?? "-"}
                  </TableCell>
                  <TableCell>
                    {editingId === reg.id ? (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="e.g. FMAS/0001"
                        className="w-40 h-8 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm font-mono">
                        {reg.convocation_number || <span className="text-muted-foreground">Not assigned</span>}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === reg.id ? (
                      <div className="flex items-center gap-1">
                        <Button size="sm" onClick={() => saveConvocationNumber(reg.id)} disabled={savingId === reg.id} className="h-7 text-xs">
                          {savingId === reg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" />Save</>}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">Cancel</Button>
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
    </div>
  )
}
