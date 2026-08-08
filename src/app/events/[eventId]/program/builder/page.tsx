"use client"

// Session Builder — a programme is a grid of rows, not a stack of forms.
//
// Shaped after the spreadsheet coordinators actually keep: a block with a chair
// at the top, then rows of `time | topic | faculty`, contiguous times, some
// rows deliberately empty (Discussion, LUNCH). Entering that should feel like
// filling in the sheet.
//
// Two corrections from live use are baked in here:
//
//   1. FACULTY BELONGS IN THE ROW. Assignment was originally scoped out of this
//      screen — declare roles here, fill them in Open Slots. Against a real
//      sheet that is wrong: the coordinator already knows who is speaking, and
//      sending them elsewhere to attach the person is the friction.
//
//   2. DAYS COME FROM THE EVENT, not from the dates blocks happen to carry.
//      Deriving them from the data left a new event with no tabs and no default
//      date, silently accepted a block dated outside the event, and then hid it
//      behind a phantom tab. See src/lib/session-builder-days.ts.
//
// Every sub-component sits at module scope: one defined during render is a new
// component type each time, so React remounts it and discards whatever is being
// typed the moment a background query refetches.

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { FacultyPicker, type PickedFaculty } from "@/components/program/faculty-picker"
import { ROLE_LABELS, defaultRosterFor, type FacultyRole } from "@/lib/agenda-roles"
import {
  describeTimeIssues,
  describeUnscheduled,
  findUnscheduledRanges,
  sortTalks,
  validateBlockTimes,
  type BuilderBlock,
  type BuilderTalk,
} from "@/lib/session-builder"
import {
  buildDays,
  defaultDay,
  describeOutOfRange,
  type BuilderDay,
} from "@/lib/session-builder-days"
import { buildVenueTree, toLocationOptions, type VenueRow } from "@/lib/venue-tree"

type Block = BuilderBlock & { session_type: string | null; hall_id: string | null }

type Assignment = {
  id: string
  session_id: string | null
  talk_id: string | null
  faculty_id: string | null
  faculty_name: string
  role: string
}

type LocationOption = ReturnType<typeof toLocationOptions>[number]

const NO_BLOCKS: Block[] = []
const NO_TALKS: BuilderTalk[] = []
const NO_ASSIGNMENTS: Assignment[] = []
const NO_HALLS: VenueRow[] = []
// Stable identity: an object literal fallback would be new on every render and
// would make the day tabs recompute forever.
const NO_WINDOW = { start_date: null, end_date: null }

const TALK_TYPES = [
  { value: "talk", label: "Talk", role: "speaker" as FacultyRole },
  { value: "panel", label: "Panel", role: "moderator" as FacultyRole },
  { value: "discussion", label: "Discussion", role: "discussant" as FacultyRole },
  { value: "video", label: "Video", role: "speaker" as FacultyRole },
  { value: "break", label: "Break", role: "speaker" as FacultyRole },
] as const

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "")
/** The role a row's faculty cell assigns, given the row's type. */
const roleForType = (t: string | null | undefined): FacultyRole =>
  TALK_TYPES.find((x) => x.value === (t ?? "talk"))?.role ?? "speaker"

// ---------------------------------------------------------------------------

function TalkRow({
  talk,
  people,
  warnings,
  saving,
  onPatch,
  onDelete,
  onAssign,
  onUnassign,
}: {
  talk: BuilderTalk
  people: Assignment[]
  warnings: string[]
  saving: boolean
  onPatch: (patch: Partial<BuilderTalk>) => void
  onDelete: () => void
  onAssign: (picked: PickedFaculty) => void
  onUnassign: (assignmentId: string) => void
}) {
  const isBreak = talk.talk_type === "break"
  const primary = people[0]

  return (
    <div className="group border-b last:border-b-0">
      <div className="grid items-center gap-2 px-3 py-1.5 sm:grid-cols-[76px_76px_1fr_200px_92px_28px]">
        <Input
          type="time"
          defaultValue={hhmm(talk.start_time)}
          onBlur={(e) => e.target.value !== hhmm(talk.start_time) && onPatch({ start_time: e.target.value || null })}
          className="h-8 text-xs tabular-nums"
          aria-label="Start time"
        />
        <Input
          type="time"
          defaultValue={hhmm(talk.end_time)}
          onBlur={(e) => e.target.value !== hhmm(talk.end_time) && onPatch({ end_time: e.target.value || null })}
          className="h-8 text-xs tabular-nums"
          aria-label="End time"
        />
        <Input
          defaultValue={talk.title ?? ""}
          onBlur={(e) => e.target.value !== (talk.title ?? "") && onPatch({ title: e.target.value || null })}
          placeholder="Topic"
          className="h-8 text-xs"
          aria-label="Topic"
        />

        {/* A break or discussion legitimately has nobody — that is not a gap. */}
        {isBreak ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <FacultyPicker
            value={primary?.faculty_name ?? null}
            linked={!!primary?.faculty_id}
            placeholder={ROLE_LABELS[roleForType(talk.talk_type)].one}
            onPick={onAssign}
            onClear={primary ? () => onUnassign(primary.id) : undefined}
            disabled={saving}
          />
        )}

        <select
          value={talk.talk_type ?? "talk"}
          onChange={(e) => onPatch({ talk_type: e.target.value })}
          className="h-8 rounded-md border bg-background px-1.5 text-xs"
          aria-label="Row type"
        >
          {TALK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          aria-label="Remove row"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>

      {/* A panel carries more than one person; the extras list under the row. */}
      {people.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-1.5 pl-[168px]">
          {people.slice(1).map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]"
            >
              {p.faculty_name}
              <button type="button" onClick={() => onUnassign(p.id)} aria-label={`Remove ${p.faculty_name}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {warnings.map((w) => (
        <p key={w} className="flex items-start gap-1.5 px-3 pb-1.5 pl-[168px] text-[11px] text-amber-600 dark:text-amber-500">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {w}
        </p>
      ))}
    </div>
  )
}

function BlockCard({
  block,
  talks,
  assignments,
  locationLabel,
  outOfRange,
  isOpen,
  saving,
  onToggle,
  onEditBlock,
  onAddRow,
  onPatchTalk,
  onDeleteTalk,
  onAssign,
  onUnassign,
}: {
  block: Block
  talks: BuilderTalk[]
  assignments: Assignment[]
  locationLabel: Map<string, string>
  outOfRange: string
  isOpen: boolean
  saving: boolean
  onToggle: () => void
  onEditBlock: () => void
  onAddRow: () => void
  onPatchTalk: (talkId: string, patch: Partial<BuilderTalk>) => void
  onDeleteTalk: (talkId: string) => void
  onAssign: (talkId: string | null, role: FacultyRole, picked: PickedFaculty) => void
  onUnassign: (assignmentId: string) => void
}) {
  const issues = validateBlockTimes(block, talks)
  const unscheduled = describeUnscheduled(findUnscheduledRanges(block, talks))
  const chairs = assignments.filter((a) => a.talk_id === null && a.role === "chairperson")
  const staffed = talks.filter((t) => assignments.some((a) => a.talk_id === t.id)).length
  const needsPerson = talks.filter((t) => t.talk_type !== "break").length

  return (
    <div className={cn("rounded-xl border bg-card", outOfRange && "border-amber-500/50")}>
      <div className="flex items-start gap-3 p-3">
        <button type="button" onClick={onToggle} className="mt-0.5" aria-label="Expand block">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
          {hhmm(block.start_time) || "--:--"}
          <div>– {hhmm(block.end_time) || "--:--"}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{block.session_name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {block.hall_id && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {locationLabel.get(block.hall_id) ?? "Unknown location"}
              </span>
            )}
            <span>
              {talks.length} row{talks.length === 1 ? "" : "s"}
              {needsPerson > 0 && ` · ${staffed}/${needsPerson} with faculty`}
            </span>
            {chairs.length > 0 && <span>Chair: {chairs.map((c) => c.faculty_name).join(", ")}</span>}
          </div>
          {outOfRange && (
            <p className="mt-1 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-500">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {outOfRange}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" onClick={onEditBlock}>
          Edit
        </Button>
      </div>

      {isOpen && (
        <div className="border-t">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Chair</span>
            <div className="w-56">
              <FacultyPicker
                value={chairs[0]?.faculty_name ?? null}
                linked={!!chairs[0]?.faculty_id}
                placeholder="Add chairperson"
                onPick={(p) => onAssign(null, "chairperson", p)}
                onClear={chairs[0] ? () => onUnassign(chairs[0].id) : undefined}
                disabled={saving}
              />
            </div>
          </div>

          {talks.length > 0 && (
            <div className="hidden border-y bg-muted/40 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[76px_76px_1fr_200px_92px_28px] sm:gap-2">
              <span>Start</span>
              <span>End</span>
              <span>Topic</span>
              <span>Faculty</span>
              <span>Type</span>
              <span />
            </div>
          )}

          {talks.map((t) => (
            <TalkRow
              key={t.id}
              talk={t}
              people={assignments.filter((a) => a.talk_id === t.id)}
              warnings={issues.filter((i) => i.talk_id === t.id).map((i) => i.message)}
              saving={saving}
              onPatch={(patch) => onPatchTalk(t.id, patch)}
              onDelete={() => onDeleteTalk(t.id)}
              onAssign={(p) => onAssign(t.id, roleForType(t.talk_type), p)}
              onUnassign={onUnassign}
            />
          ))}

          <div className="flex flex-wrap items-center gap-3 px-3 py-2">
            <button
              type="button"
              onClick={onAddRow}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add row
            </button>
            {unscheduled && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {unscheduled}
              </span>
            )}
            {describeTimeIssues(issues) && (
              <span className="ml-auto text-xs text-amber-600 dark:text-amber-500">
                {describeTimeIssues(issues)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BlockForm({
  block,
  defaultDate,
  locations,
  saving,
  onSave,
  onCancel,
}: {
  block: Block | null
  defaultDate: string | null
  locations: LocationOption[]
  saving: boolean
  onSave: (v: Partial<Block> & { id?: string }) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    session_name: block?.session_name ?? "",
    session_date: block?.session_date ?? defaultDate ?? "",
    start_time: hhmm(block?.start_time),
    end_time: hhmm(block?.end_time),
    session_type: block?.session_type ?? "",
    hall_id: block?.hall_id ?? "",
  })
  const [tried, setTried] = useState(false)

  const nameMissing = form.session_name.trim() === ""
  const roster = defaultRosterFor(form.session_type)

  return (
    <div className="rounded-xl border border-primary/40 bg-muted/30 p-4">
      <div className="mb-3 text-sm font-semibold">{block ? "Edit session" : "Add a session"}</div>
      <div className="space-y-3">
        <div>
          <label htmlFor="bn" className="text-xs font-medium text-muted-foreground">Session name</label>
          <Input
            id="bn"
            value={form.session_name}
            onChange={(e) => setForm({ ...form, session_name: e.target.value })}
            placeholder="e.g. Session 1 — Ventral Hernia"
            className={cn("mt-1", tried && nameMissing && "border-destructive")}
          />
          {tried && nameMissing && (
            <p className="mt-1 text-xs text-destructive">Give the session a name before saving</p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="bd" className="text-xs font-medium text-muted-foreground">Day</label>
            <Input id="bd" type="date" value={form.session_date}
              onChange={(e) => setForm({ ...form, session_date: e.target.value })} className="mt-1" />
          </div>
          <div>
            <label htmlFor="bs" className="text-xs font-medium text-muted-foreground">Start</label>
            <Input id="bs" type="time" value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="mt-1" />
          </div>
          <div>
            <label htmlFor="be" className="text-xs font-medium text-muted-foreground">End</label>
            <Input id="be" type="time" value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="mt-1" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="bl" className="text-xs font-medium text-muted-foreground">Location</label>
            <select id="bl" value={form.hall_id}
              onChange={(e) => setForm({ ...form, hall_id: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">No location yet</option>
              {locations.map((o) => (
                <option key={o.id} value={o.id} disabled={!o.selectable}>
                  {o.depth === 1 ? `    ${o.label}` : o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bt" className="text-xs font-medium text-muted-foreground">
              Type <span className="font-normal">— sets the starting roster</span>
            </label>
            <Input id="bt" value={form.session_type}
              onChange={(e) => setForm({ ...form, session_type: e.target.value })}
              placeholder="e.g. symposium" className="mt-1" />
            {!block && roster.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Will start with {roster.map((r) => `${r.required_count} ${ROLE_LABELS[r.role].one}`).join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" disabled={saving} onClick={() => {
          setTried(true)
          if (nameMissing) return
          onSave({ ...form, id: block?.id })
        }}>
          {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Save session
        </Button>
        <button type="button" onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export default function SessionBuilderPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const queryClient = useQueryClient()

  const [day, setDay] = useState<string | null | undefined>(undefined)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingBlock, setEditingBlock] = useState<string | "new" | null>(null)

  const invalidate = () => {
    for (const k of ["builder-blocks", "builder-talks", "builder-assignments"]) {
      queryClient.invalidateQueries({ queryKey: [k, eventId] })
    }
  }

  const eventQ = useQuery({
    queryKey: ["builder-event", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`)
      if (!res.ok) return { start_date: null, end_date: null }
      const j = await res.json()
      const e = j.data ?? j
      return { start_date: e?.start_date ?? null, end_date: e?.end_date ?? null }
    },
  })

  const blocksQ = useQuery({
    queryKey: ["builder-blocks", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/program/sessions`)
      if (!res.ok) throw new Error("Failed to load sessions")
      return ((await res.json()).data ?? []) as Block[]
    },
  })

  const talksQ = useQuery({
    queryKey: ["builder-talks", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/talks`)
      if (!res.ok) throw new Error("Failed to load talks")
      return ((await res.json()).data ?? []) as BuilderTalk[]
    },
  })

  const assignmentsQ = useQuery({
    queryKey: ["builder-assignments", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/program/faculty`)
      if (!res.ok) return NO_ASSIGNMENTS
      return (await res.json()) as Assignment[]
    },
  })

  const hallsQ = useQuery({
    queryKey: ["builder-halls", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/halls`)
      if (!res.ok) return NO_HALLS
      return ((await res.json()).data ?? []) as VenueRow[]
    },
  })

  const eventWindow = eventQ.data ?? NO_WINDOW
  const blocks = blocksQ.data ?? NO_BLOCKS
  const talks = talksQ.data ?? NO_TALKS
  const assignments = assignmentsQ.data ?? NO_ASSIGNMENTS
  const halls = hallsQ.data ?? NO_HALLS

  const locations = useMemo(() => toLocationOptions(buildVenueTree(halls)), [halls])
  const locationLabel = useMemo(() => new Map(locations.map((o) => [o.id, o.label])), [locations])

  const days: BuilderDay[] = useMemo(() => buildDays(eventWindow, blocks), [eventWindow, blocks])
  const activeDay = day === undefined ? defaultDay(days) : day

  const dayBlocks = useMemo(
    () =>
      blocks
        .filter((b) => (b.session_date ?? null) === activeDay)
        .sort((a, b) => (a.start_time ?? "99:99").localeCompare(b.start_time ?? "99:99")),
    [blocks, activeDay]
  )

  const talksByBlock = useMemo(() => {
    const m = new Map<string, BuilderTalk[]>()
    for (const t of talks) {
      const list = m.get(t.session_id) ?? []
      list.push(t)
      m.set(t.session_id, list)
    }
    for (const [k, v] of m) m.set(k, sortTalks(v))
    return m
  }, [talks])

  const saveBlock = useMutation({
    mutationFn: async (v: Partial<Block> & { id?: string }) => {
      const res = await fetch(
        v.id ? `/api/events/${eventId}/program/sessions/${v.id}` : `/api/events/${eventId}/program/sessions`,
        {
          method: v.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_name: v.session_name,
            session_date: v.session_date || null,
            start_time: v.start_time || null,
            end_time: v.end_time || null,
            session_type: v.session_type || null,
            hall_id: v.hall_id || null,
          }),
        }
      )
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save")
    },
    onSuccess: () => {
      invalidate()
      setEditingBlock(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /** New rows start where the previous one ended, like the sheet. */
  const addRow = useMutation({
    mutationFn: async (blockId: string) => {
      const existing = talksByBlock.get(blockId) ?? NO_TALKS
      const block = blocks.find((b) => b.id === blockId)
      const last = existing.at(-1)
      const start = hhmm(last?.end_time) || hhmm(block?.start_time) || null

      const res = await fetch(`/api/events/${eventId}/talks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: blockId, talk_type: "talk", start_time: start }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to add row")
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  const patchTalk = useMutation({
    mutationFn: async ({ talkId, patch }: { talkId: string; patch: Partial<BuilderTalk> }) => {
      const res = await fetch(`/api/events/${eventId}/talks/${talkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save row")
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteTalk = useMutation({
    mutationFn: async (talkId: string) => {
      const res = await fetch(`/api/events/${eventId}/talks/${talkId}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to remove row")
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  const assign = useMutation({
    mutationFn: async (v: {
      sessionId: string
      talkId: string | null
      role: FacultyRole
      picked: PickedFaculty
    }) => {
      const res = await fetch(`/api/events/${eventId}/session-speakers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: v.sessionId,
          talk_id: v.talkId,
          role: v.role,
          faculty_id: v.picked.faculty_id,
          faculty_name: v.picked.faculty_name,
          faculty_email: v.picked.faculty_email,
          status: "pending",
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to assign")
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  const unassign = useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch(`/api/events/${eventId}/session-speakers/${assignmentId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to remove")
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  if (blocksQ.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const saving = assign.isPending || unassign.isPending

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Session Builder</h1>
          <p className="text-sm text-muted-foreground">
            {dayBlocks.length} session{dayBlocks.length === 1 ? "" : "s"} on this day
          </p>
        </div>
        {editingBlock === null && (
          <Button onClick={() => setEditingBlock("new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add a session
          </Button>
        )}
      </div>

      {days.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {days.map((d) => (
            <button
              key={d.date ?? "unscheduled"}
              type="button"
              onClick={() => setDay(d.date)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                d.date === activeDay
                  ? "bg-primary text-primary-foreground"
                  : d.withinEvent
                    ? "border text-muted-foreground hover:text-foreground"
                    : "border border-amber-500/50 text-amber-600"
              )}
            >
              {d.label}
              {d.date && (
                <span className="ml-1.5 opacity-70">
                  {new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
              {d.blockCount > 0 && <span className="ml-1.5 opacity-70">· {d.blockCount}</span>}
            </button>
          ))}
        </div>
      )}

      {editingBlock === "new" && (
        <BlockForm block={null} defaultDate={activeDay} locations={locations}
          saving={saveBlock.isPending} onSave={saveBlock.mutate} onCancel={() => setEditingBlock(null)} />
      )}

      {dayBlocks.length === 0 && editingBlock !== "new" ? (
        <div className="rounded-xl border border-dashed bg-card py-14 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="mb-4 text-sm text-muted-foreground">Nothing scheduled on this day yet.</p>
          <Button onClick={() => setEditingBlock("new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add a session
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {dayBlocks.map((b) =>
            editingBlock === b.id ? (
              <BlockForm key={b.id} block={b} defaultDate={activeDay} locations={locations}
                saving={saveBlock.isPending} onSave={saveBlock.mutate} onCancel={() => setEditingBlock(null)} />
            ) : (
              <BlockCard
                key={b.id}
                block={b}
                talks={talksByBlock.get(b.id) ?? NO_TALKS}
                assignments={assignments.filter((a) => a.session_id === b.id)}
                locationLabel={locationLabel}
                outOfRange={describeOutOfRange(eventWindow, b.session_date)}
                isOpen={expanded.has(b.id)}
                saving={saving}
                onToggle={() =>
                  setExpanded((s) => {
                    const n = new Set(s)
                    if (n.has(b.id)) n.delete(b.id)
                    else n.add(b.id)
                    return n
                  })
                }
                onEditBlock={() => setEditingBlock(b.id)}
                onAddRow={() => addRow.mutate(b.id)}
                onPatchTalk={(talkId, patch) => patchTalk.mutate({ talkId, patch })}
                onDeleteTalk={deleteTalk.mutate}
                onAssign={(talkId, role, picked) =>
                  assign.mutate({ sessionId: b.id, talkId, role, picked })
                }
                onUnassign={unassign.mutate}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
