"use client"

import { useState, useMemo, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Award, Calendar, MapPin, Save, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/ui/empty-state"
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

interface SessionRow {
  id: string
  event_id: string
  session_name: string | null
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall: string | null
  specialty_track: string | null
}

interface CmeRow {
  id: string
  session_id: string
  event_id: string
  cme_credits: number | string | null
  cme_category: string | null
  accrediting_body: string | null
  activity_code: string | null
  requires_completion_quiz: boolean
  quiz_form_id: string | null
  notes: string | null
}

interface SessionCmePair {
  session: SessionRow
  cme: CmeRow | null
}

interface EditableRow {
  session_id: string
  cme_credits: string
  cme_category: string
  accrediting_body: string
  requires_completion_quiz: boolean
}

function toEditable(pair: SessionCmePair): EditableRow {
  const credits = pair.cme?.cme_credits
  const creditsStr =
    credits === null || credits === undefined || credits === ""
      ? ""
      : String(Number(typeof credits === "string" ? Number(credits) : credits).toFixed(2)).replace(
          /\.?0+$/,
          ""
        ) || "0"
  return {
    session_id: pair.session.id,
    cme_credits: creditsStr,
    cme_category: pair.cme?.cme_category ?? "",
    accrediting_body: pair.cme?.accrediting_body ?? "",
    requires_completion_quiz: pair.cme?.requires_completion_quiz ?? false,
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ""
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    })
  } catch {
    return dateStr
  }
}

function rowsDiffer(a: EditableRow, b: EditableRow): boolean {
  return (
    a.cme_credits !== b.cme_credits ||
    a.cme_category !== b.cme_category ||
    a.accrediting_body !== b.accrediting_body ||
    a.requires_completion_quiz !== b.requires_completion_quiz
  )
}

export default function SpeakerCmePage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => ["session-cme", eventId], [eventId])

  const [search, setSearch] = useState("")
  const [trackFilter, setTrackFilter] = useState<string>("all")
  const [edits, setEdits] = useState<Record<string, EditableRow>>({})
  const [original, setOriginal] = useState<Record<string, EditableRow>>({})

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/session-cme`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Failed to load CME data")
      }
      const json = (await res.json()) as { data: SessionCmePair[] }
      return json.data ?? []
    },
  })

  // Sync edit buffer when fresh data arrives
  useEffect(() => {
    if (!data) return
    const next: Record<string, EditableRow> = {}
    for (const pair of data) {
      next[pair.session.id] = toEditable(pair)
    }
    setEdits(next)
    setOriginal(next)
  }, [data])

  const tracks = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    for (const pair of data) {
      if (pair.session.specialty_track) set.add(pair.session.specialty_track)
    }
    return Array.from(set).sort()
  }, [data])

  const filteredPairs = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.filter((pair) => {
      if (q) {
        const name = (pair.session.session_name || "").toLowerCase()
        if (!name.includes(q)) return false
      }
      if (trackFilter !== "all") {
        if ((pair.session.specialty_track || "") !== trackFilter) return false
      }
      return true
    })
  }, [data, search, trackFilter])

  const totalCredits = useMemo(() => {
    let sum = 0
    for (const id of Object.keys(edits)) {
      const n = Number(edits[id].cme_credits)
      if (Number.isFinite(n)) sum += n
    }
    return Math.round(sum * 100) / 100
  }, [edits])

  const dirtyIds = useMemo(() => {
    const ids: string[] = []
    for (const id of Object.keys(edits)) {
      const a = edits[id]
      const b = original[id]
      if (!b || rowsDiffer(a, b)) ids.push(id)
    }
    return ids
  }, [edits, original])

  const saveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const rows = ids.map((id) => {
        const r = edits[id]
        const credits = r.cme_credits.trim() === "" ? 0 : Number(r.cme_credits)
        return {
          session_id: r.session_id,
          cme_credits: credits,
          cme_category: r.cme_category || null,
          accrediting_body: r.accrediting_body || null,
          requires_completion_quiz: r.requires_completion_quiz,
        }
      })
      const res = await fetch(`/api/events/${eventId}/session-cme`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Failed to save CME rows")
      }
      return res.json()
    },
    onSuccess: (_d, ids) => {
      toast.success(
        ids.length === 1 ? "CME saved" : `Saved CME for ${ids.length} sessions`
      )
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to save CME rows")
    },
  })

  const updateEdit = (id: string, patch: Partial<EditableRow>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const validateCredits = (value: string): string | null => {
    if (value.trim() === "") return null
    const n = Number(value)
    if (!Number.isFinite(n)) return "Must be a number"
    if (n < 0) return "Must be >= 0"
    if (n > 99.99) return "Must be <= 99.99"
    return null
  }

  const saveRow = (id: string) => {
    const err = validateCredits(edits[id].cme_credits)
    if (err) {
      toast.error(`Credits: ${err}`)
      return
    }
    saveMutation.mutate([id])
  }

  const saveAll = () => {
    if (dirtyIds.length === 0) {
      toast.info("Nothing to save")
      return
    }
    for (const id of dirtyIds) {
      const err = validateCredits(edits[id].cme_credits)
      if (err) {
        toast.error(`Row ${edits[id].session_id.slice(0, 8)}: ${err}`)
        return
      }
    }
    saveMutation.mutate(dirtyIds)
  }

  // ---------- Render states ----------

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Award}
          title="Failed to load CME data"
          description={(error as Error).message}
        />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Award className="h-6 w-6 text-indigo-500" />
            CME credits
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assign Continuing Medical Education credits to each session.
          </p>
        </div>
        <Card className="p-6">
          <EmptyState
            icon={Calendar}
            title="No sessions yet"
            description="Create sessions in Program first."
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Award className="h-6 w-6 text-indigo-500" />
            CME credits
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assign Continuing Medical Education credits to each session. Edits stay local
            until you click <span className="font-medium">Save</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-400"
          >
            Total CME credits assigned: {totalCredits}
          </Badge>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search session name..."
            className="pl-8"
            aria-label="Search sessions"
          />
        </div>
        <Select value={trackFilter} onValueChange={setTrackFilter}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by track">
            <SelectValue placeholder="All tracks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tracks</SelectItem>
            {tracks.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={saveAll}
          disabled={dirtyIds.length === 0 || saveMutation.isPending}
          className="sm:ml-auto"
        >
          <Save className="h-4 w-4 mr-2" />
          Save all ({dirtyIds.length})
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[240px]">Session</TableHead>
              <TableHead className="min-w-[120px]">Track</TableHead>
              <TableHead className="w-[120px]">CME credits</TableHead>
              <TableHead className="min-w-[140px]">Category</TableHead>
              <TableHead className="min-w-[160px]">Accrediting body</TableHead>
              <TableHead className="w-[110px]">Requires quiz</TableHead>
              <TableHead className="w-[100px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPairs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="py-8">
                    <EmptyState
                      icon={Search}
                      title="No matching sessions"
                      description="Try clearing search or track filter."
                      size="sm"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredPairs.map((pair) => {
                const id = pair.session.id
                const row = edits[id]
                if (!row) return null
                const baseRow = original[id]
                const isDirty = !baseRow || rowsDiffer(row, baseRow)
                const sessionName =
                  pair.session.session_name || `Session ${id.slice(0, 8)}`
                const rowLabel = `CME for ${sessionName}`
                return (
                  <TableRow key={id} className={isDirty ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}>
                    <TableCell className="align-top">
                      <div className="font-medium">{sessionName}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {pair.session.session_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(pair.session.session_date)}
                            {pair.session.start_time
                              ? ` · ${pair.session.start_time.slice(0, 5)}`
                              : ""}
                          </span>
                        )}
                        {pair.session.hall && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {pair.session.hall}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      {pair.session.specialty_track ? (
                        <Badge variant="outline" className="text-xs">
                          {pair.session.specialty_track}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={99.99}
                        step={0.25}
                        value={row.cme_credits}
                        onChange={(e) =>
                          updateEdit(id, { cme_credits: e.target.value })
                        }
                        className="h-9 w-24"
                        aria-label={`${rowLabel}: credits`}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        value={row.cme_category}
                        onChange={(e) =>
                          updateEdit(id, { cme_category: e.target.value })
                        }
                        placeholder="e.g. Category 1"
                        className="h-9"
                        aria-label={`${rowLabel}: category`}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        value={row.accrediting_body}
                        onChange={(e) =>
                          updateEdit(id, { accrediting_body: e.target.value })
                        }
                        placeholder="e.g. TNMC"
                        className="h-9"
                        aria-label={`${rowLabel}: accrediting body`}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Switch
                        checked={row.requires_completion_quiz}
                        onCheckedChange={(checked) =>
                          updateEdit(id, { requires_completion_quiz: checked })
                        }
                        aria-label={`${rowLabel}: requires completion quiz`}
                      />
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <Button
                        size="sm"
                        variant={isDirty ? "default" : "ghost"}
                        disabled={!isDirty || saveMutation.isPending}
                        onClick={() => saveRow(id)}
                        aria-label={`Save ${rowLabel}`}
                      >
                        Save
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
