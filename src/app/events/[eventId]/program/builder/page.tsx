"use client"

// Session Builder — the two-level agenda. A block holds its talks.
//
// A new route rather than a rewrite of program/schedule: that page is in live
// use for AMASICON 2026, and this one depends on `talks`, which only became a
// real table today. Both coexist until this is verified against real data, then
// the old one is retired deliberately.
//
// Scope boundary, drawn by the design's own copy. State 1a: "Who does this
// session need? Set the roles you'll be inviting faculty into." So the Builder
// DECLARES what a block and its talks need; Open Slots and Invitations do the
// FILLING. Fill status is shown here ("Moderator 1 of 1 filled") but this is
// not where you pick the person.
//
// Time problems are warnings, never blocks — state 2g, "2 warnings — you can
// still save". A real programme is edited out of order.
//
// Every sub-component lives at module scope rather than inside the page. A
// component defined during render is a NEW component type on every render, so
// React unmounts and remounts it — which for the stateful forms below means
// whatever the coordinator was typing is discarded the moment any query
// refetches in the background.

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
import {
  FACULTY_ROLES,
  ROLE_LABELS,
  defaultRosterFor,
  type FacultyRole,
} from "@/lib/agenda-roles"
import {
  describeBlockSummary,
  describeRollup,
  describeTimeIssues,
  describeUnscheduled,
  findUnscheduledRanges,
  rollupBlockRoles,
  sortTalks,
  validateBlockTimes,
  type BuilderAssignment,
  type BuilderBlock,
  type BuilderRequirement,
  type BuilderTalk,
} from "@/lib/session-builder"
import { buildVenueTree, toLocationOptions, type VenueRow } from "@/lib/venue-tree"

type Block = BuilderBlock & {
  session_type: string | null
  hall_id: string | null
}

type LocationOption = ReturnType<typeof toLocationOptions>[number]

type RoleDraft = { role: FacultyRole; required_count: number }

const TALK_TYPES = [
  { value: "talk", label: "Talk" },
  { value: "panel", label: "Panel" },
  { value: "discussion", label: "Open discussion" },
  { value: "video", label: "Video" },
  { value: "break", label: "Break" },
] as const

// Stable identities. `?? []` inside the component body would mint a new array
// every render, so every useMemo keyed on it would recompute forever.
const NO_BLOCKS: Block[] = []
const NO_TALKS: BuilderTalk[] = []
const NO_REQS: BuilderRequirement[] = []
const NO_ASSIGNMENTS: BuilderAssignment[] = []
const NO_HALLS: VenueRow[] = []

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "--:--")
const timeValue = (t: string | null | undefined) => (t ? t.slice(0, 5) : "")

// ---------------------------------------------------------------------------

function RoleEditor({
  sessionId,
  talkId,
  requirements,
  assignments,
  onSave,
}: {
  sessionId: string
  talkId: string | null
  requirements: BuilderRequirement[]
  assignments: BuilderAssignment[]
  onSave: (v: { session_id: string; talk_id: string | null; requirements: RoleDraft[] }) => void
}) {
  const mine = requirements.filter(
    (r) => r.session_id === sessionId && (r.talk_id ?? null) === talkId
  )
  const fills = rollupBlockRoles(sessionId, requirements, assignments).byTalk.get(talkId) ?? []

  const setCount = (role: FacultyRole, count: number) => {
    const next: RoleDraft[] = mine
      .filter((r) => r.role !== role)
      .map((r) => ({ role: r.role, required_count: r.required_count }))
    if (count > 0) next.push({ role, required_count: count })
    onSave({ session_id: sessionId, talk_id: talkId, requirements: next })
  }

  return (
    <div className="space-y-2">
      {mine.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No roles set — this {talkId ? "talk" : "block"} won&apos;t show up in Open Slots until you
          add at least one.
        </p>
      ) : (
        fills.map((f) => (
          <div key={f.role} className="flex items-center gap-2 text-sm">
            <span className="w-24 shrink-0 font-medium">{f.role_label}</span>
            <span
              className={cn(
                "text-xs",
                f.filled >= f.required ? "text-emerald-600" : "text-amber-600"
              )}
            >
              {f.filled} of {f.required} filled
            </span>
            <Input
              key={`${f.role}-${f.required}`}
              type="number"
              min={0}
              max={50}
              defaultValue={f.required}
              onBlur={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n) && n >= 0 && n !== f.required) setCount(f.role, n)
              }}
              className="ml-auto h-7 w-16 text-xs"
              aria-label={`How many ${f.role_label}`}
            />
          </div>
        ))
      )}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {FACULTY_ROLES.filter((r) => !mine.some((m) => m.role === r)).map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setCount(role, 1)}
            className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
          >
            <Plus className="mr-1 inline h-3 w-3" />
            {ROLE_LABELS[role].one}
          </button>
        ))}
      </div>
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
    start_time: timeValue(block?.start_time),
    end_time: timeValue(block?.end_time),
    session_type: block?.session_type ?? "",
    hall_id: block?.hall_id ?? "",
  })
  const [tried, setTried] = useState(false)

  const nameMissing = form.session_name.trim() === ""
  const endBeforeStart =
    form.start_time !== "" && form.end_time !== "" && form.end_time <= form.start_time
  const problems = [nameMissing, endBeforeStart].filter(Boolean).length

  const roster = defaultRosterFor(form.session_type)

  return (
    <div className="rounded-xl border border-primary/40 bg-muted/30 p-4">
      <div className="mb-3 text-sm font-semibold">
        {block ? "Edit session block" : "Add a session block"}
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="block-name" className="text-xs font-medium text-muted-foreground">
            Block name
          </label>
          <Input
            id="block-name"
            value={form.session_name}
            onChange={(e) => setForm({ ...form, session_name: e.target.value })}
            placeholder="e.g. GALL BLADDER"
            className={cn("mt-1", tried && nameMissing && "border-destructive")}
          />
          {tried && nameMissing && (
            <p className="mt-1 text-xs text-destructive">Give the session a name before saving</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="block-day" className="text-xs font-medium text-muted-foreground">
              Day
            </label>
            <Input
              id="block-day"
              type="date"
              value={form.session_date}
              onChange={(e) => setForm({ ...form, session_date: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="block-start" className="text-xs font-medium text-muted-foreground">
              Start
            </label>
            <Input
              id="block-start"
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="block-end" className="text-xs font-medium text-muted-foreground">
              End
            </label>
            <Input
              id="block-end"
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className={cn("mt-1", tried && endBeforeStart && "border-destructive")}
            />
            {tried && endBeforeStart && (
              <p className="mt-1 text-xs text-destructive">
                End time should be after the start time
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="block-location" className="text-xs font-medium text-muted-foreground">
              Location
            </label>
            <select
              id="block-location"
              value={form.hall_id}
              onChange={(e) => setForm({ ...form, hall_id: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">No location yet — you can add one later</option>
              {locations.map((o) => (
                <option key={o.id} value={o.id} disabled={!o.selectable}>
                  {o.depth === 1 ? `    ${o.label}` : o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="block-type" className="text-xs font-medium text-muted-foreground">
              Type <span className="font-normal">— sets the starting roster</span>
            </label>
            <Input
              id="block-type"
              value={form.session_type}
              onChange={(e) => setForm({ ...form, session_type: e.target.value })}
              placeholder="e.g. symposium"
              className="mt-1"
            />
            {!block && roster.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Will start with{" "}
                {roster.map((r) => `${r.required_count} ${ROLE_LABELS[r.role].one}`).join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          size="sm"
          disabled={saving}
          onClick={() => {
            setTried(true)
            if (problems > 0) return
            onSave({ ...form, id: block?.id })
          }}
        >
          {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Save block
        </Button>
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={onCancel}
        >
          Cancel
        </button>
        {tried && problems > 1 && (
          <span className="ml-auto text-xs text-destructive">{problems} things to fix</span>
        )}
      </div>
    </div>
  )
}

function TalkForm({
  sessionId,
  talk,
  saving,
  onSave,
  onCancel,
}: {
  sessionId: string
  talk: BuilderTalk | null
  saving: boolean
  onSave: (v: Partial<BuilderTalk> & { session_id: string; id?: string }) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    title: talk?.title ?? "",
    talk_type: talk?.talk_type ?? "talk",
    start_time: timeValue(talk?.start_time),
    end_time: timeValue(talk?.end_time),
  })

  return (
    <div className="rounded-lg border border-primary/40 bg-background p-3">
      <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr_auto]">
        <Input
          type="time"
          value={form.start_time}
          onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          className="h-8 w-28 text-xs"
          aria-label="Talk start time"
        />
        <Input
          type="time"
          value={form.end_time}
          onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          className="h-8 w-28 text-xs"
          aria-label="Talk end time"
        />
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Talk title"
          className="h-8 text-xs"
        />
        <select
          value={form.talk_type ?? "talk"}
          onChange={(e) => setForm({ ...form, talk_type: e.target.value })}
          className="h-8 rounded-md border bg-background px-2 text-xs"
          aria-label="Talk type"
        >
          {TALK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={saving}
          onClick={() => onSave({ ...form, session_id: sessionId, id: talk?.id })}
        >
          {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
          Save talk
        </Button>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function BlockCard({
  block,
  talks,
  requirements,
  assignments,
  locationLabel,
  isOpen,
  onToggle,
  editingTalkId,
  addingTalk,
  savingTalk,
  onEditBlock,
  onEditTalk,
  onAddTalk,
  onCancelTalk,
  onSaveTalk,
  onDeleteTalk,
  onSaveRoles,
}: {
  block: Block
  talks: BuilderTalk[]
  requirements: BuilderRequirement[]
  assignments: BuilderAssignment[]
  locationLabel: Map<string, string>
  isOpen: boolean
  onToggle: () => void
  editingTalkId: string | null
  addingTalk: boolean
  savingTalk: boolean
  onEditBlock: () => void
  onEditTalk: (id: string) => void
  onAddTalk: () => void
  onCancelTalk: () => void
  onSaveTalk: (v: Partial<BuilderTalk> & { session_id: string; id?: string }) => void
  onDeleteTalk: (id: string) => void
  onSaveRoles: (v: { session_id: string; talk_id: string | null; requirements: RoleDraft[] }) => void
}) {
  const rollup = rollupBlockRoles(block.id, requirements, assignments)
  const issues = validateBlockTimes(block, talks)
  const unscheduled = describeUnscheduled(findUnscheduledRanges(block, talks))
  const warnings = describeTimeIssues(issues)

  return (
    <div className="rounded-xl border bg-card">
      <button type="button" className="flex w-full items-start gap-3 p-4 text-left" onClick={onToggle}>
        {isOpen ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">
          {hhmm(block.start_time)}
          <div>– {hhmm(block.end_time)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{block.session_name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {block.hall_id && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {locationLabel.get(block.hall_id) ?? "Unknown location"}
              </span>
            )}
            <span>{describeBlockSummary(talks.length, rollup)}</span>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
            rollup.required === 0
              ? "bg-muted text-muted-foreground"
              : rollup.unfilled === 0
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-amber-500/10 text-amber-600"
          )}
        >
          {describeRollup(rollup)}
        </span>
      </button>

      {isOpen && (
        <div className="space-y-3 border-t px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Who this block needs
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onEditBlock}>
              Edit block
            </Button>
          </div>
          <RoleEditor
            sessionId={block.id}
            talkId={null}
            requirements={requirements}
            assignments={assignments}
            onSave={onSaveRoles}
          />

          <div className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Talks in this block
          </div>

          {talks.length === 0 && !addingTalk && (
            <p className="text-xs text-muted-foreground">
              No talks yet. Add them one by one — each talk carries its own time, title and roles. A
              block with no talks is fine too (breaks, lunch).
            </p>
          )}

          {talks.map((t) =>
            editingTalkId === t.id ? (
              <TalkForm
                key={t.id}
                sessionId={block.id}
                talk={t}
                saving={savingTalk}
                onSave={onSaveTalk}
                onCancel={onCancelTalk}
              />
            ) : (
              <div key={t.id} className="rounded-lg border bg-background p-3">
                <div className="flex items-start gap-3">
                  <div className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {hhmm(t.start_time)} – {hhmm(t.end_time)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{t.title || "Untitled talk"}</div>
                    {t.talk_type && t.talk_type !== "talk" && (
                      <span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {TALK_TYPES.find((x) => x.value === t.talk_type)?.label ?? t.talk_type}
                      </span>
                    )}
                    <div className="mt-2">
                      <RoleEditor
                        sessionId={block.id}
                        talkId={t.id}
                        requirements={requirements}
                        assignments={assignments}
                        onSave={onSaveRoles}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onEditTalk(t.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onDeleteTalk(t.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      <span className="sr-only">Remove talk</span>
                    </Button>
                  </div>
                </div>
                {issues
                  .filter((i) => i.talk_id === t.id)
                  .map((i) => (
                    <p
                      key={i.code}
                      className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500"
                    >
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {i.message}
                    </p>
                  ))}
              </div>
            )
          )}

          {addingTalk && (
            <TalkForm
              sessionId={block.id}
              talk={null}
              saving={savingTalk}
              onSave={onSaveTalk}
              onCancel={onCancelTalk}
            />
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {!addingTalk && editingTalkId === null && (
              <button
                type="button"
                onClick={onAddTalk}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                {talks.length === 0 ? "Add a talk" : "Add another talk"}
              </button>
            )}
            {unscheduled && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {unscheduled}
              </span>
            )}
            {warnings && (
              <span className="ml-auto text-xs text-amber-600 dark:text-amber-500">{warnings}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

export default function SessionBuilderPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const queryClient = useQueryClient()

  const [day, setDay] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingBlock, setEditingBlock] = useState<string | "new" | null>(null)
  const [editingTalk, setEditingTalk] = useState<string | null>(null)
  const [addingTalkTo, setAddingTalkTo] = useState<string | null>(null)

  const invalidate = () => {
    for (const k of ["builder-blocks", "builder-talks", "builder-reqs"]) {
      queryClient.invalidateQueries({ queryKey: [k, eventId] })
    }
  }

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

  const reqsQ = useQuery({
    queryKey: ["builder-reqs", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/role-requirements`)
      if (!res.ok) throw new Error("Failed to load role requirements")
      return ((await res.json()).data ?? []) as BuilderRequirement[]
    },
  })

  const assignmentsQ = useQuery({
    queryKey: ["builder-assignments", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/program/faculty`)
      if (!res.ok) return NO_ASSIGNMENTS
      return (await res.json()) as BuilderAssignment[]
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

  const blocks = blocksQ.data ?? NO_BLOCKS
  const talks = talksQ.data ?? NO_TALKS
  const requirements = reqsQ.data ?? NO_REQS
  const assignments = assignmentsQ.data ?? NO_ASSIGNMENTS
  const halls = hallsQ.data ?? NO_HALLS

  const locations = useMemo(() => toLocationOptions(buildVenueTree(halls)), [halls])
  const locationLabel = useMemo(
    () => new Map(locations.map((o) => [o.id, o.label])),
    [locations]
  )

  const days = useMemo(
    () => [...new Set(blocks.map((b) => b.session_date).filter(Boolean) as string[])].sort(),
    [blocks]
  )

  const activeDay = day ?? days[0] ?? null

  const dayBlocks = useMemo(
    () =>
      blocks
        .filter((b) => (activeDay ? b.session_date === activeDay : !b.session_date))
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

  const unfilledToday = useMemo(
    () =>
      dayBlocks.reduce((n, b) => n + rollupBlockRoles(b.id, requirements, assignments).unfilled, 0),
    [dayBlocks, requirements, assignments]
  )

  const saveBlock = useMutation({
    mutationFn: async (v: Partial<Block> & { id?: string }) => {
      const res = await fetch(
        v.id
          ? `/api/events/${eventId}/program/sessions/${v.id}`
          : `/api/events/${eventId}/program/sessions`,
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

  const saveTalk = useMutation({
    mutationFn: async (v: Partial<BuilderTalk> & { session_id: string; id?: string }) => {
      const body: Record<string, unknown> = {
        title: v.title || null,
        talk_type: v.talk_type || "talk",
        start_time: v.start_time || null,
        end_time: v.end_time || null,
      }
      if (!v.id) body.session_id = v.session_id
      const res = await fetch(
        v.id ? `/api/events/${eventId}/talks/${v.id}` : `/api/events/${eventId}/talks`,
        {
          method: v.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save talk")
    },
    onSuccess: () => {
      invalidate()
      setEditingTalk(null)
      setAddingTalkTo(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteTalk = useMutation({
    mutationFn: async (talkId: string) => {
      const res = await fetch(`/api/events/${eventId}/talks/${talkId}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to remove talk")
      return (await res.json()).removed as { assignments: number; requirements: number }
    },
    onSuccess: (removed) => {
      invalidate()
      toast.success(
        removed.assignments > 0
          ? `Talk removed, along with ${removed.assignments} assignment${removed.assignments === 1 ? "" : "s"}.`
          : "Talk removed."
      )
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveRoles = useMutation({
    mutationFn: async (v: {
      session_id: string
      talk_id: string | null
      requirements: RoleDraft[]
    }) => {
      const res = await fetch(`/api/events/${eventId}/role-requirements`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save roles")
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

  if (blocksQ.isError) {
    return (
      <div className="p-6 text-sm text-destructive">
        Couldn&apos;t load the programme. {(blocksQ.error as Error).message}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Session Builder</h1>
          <p className="text-sm text-muted-foreground">
            {dayBlocks.length} block{dayBlocks.length === 1 ? "" : "s"}
            {unfilledToday > 0 &&
              ` · ${unfilledToday} unfilled role${unfilledToday === 1 ? "" : "s"}`}
          </p>
        </div>
        {editingBlock === null && (
          <Button onClick={() => setEditingBlock("new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add a block
          </Button>
        )}
      </div>

      {days.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {days.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                d === activeDay
                  ? "bg-primary text-primary-foreground"
                  : "border text-muted-foreground hover:text-foreground"
              )}
            >
              Day {i + 1}
              <span className="ml-1.5 opacity-70">
                {new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </button>
          ))}
        </div>
      )}

      {editingBlock === "new" && (
        <BlockForm
          block={null}
          defaultDate={activeDay}
          locations={locations}
          saving={saveBlock.isPending}
          onSave={saveBlock.mutate}
          onCancel={() => setEditingBlock(null)}
        />
      )}

      {dayBlocks.length === 0 && editingBlock !== "new" ? (
        <div className="rounded-xl border border-dashed bg-card py-14 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="mb-4 text-sm text-muted-foreground">
            Nothing scheduled{activeDay ? " on this day" : ""} yet.
          </p>
          <Button onClick={() => setEditingBlock("new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add a block
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {dayBlocks.map((b) =>
            editingBlock === b.id ? (
              <BlockForm
                key={b.id}
                block={b}
                defaultDate={activeDay}
                locations={locations}
                saving={saveBlock.isPending}
                onSave={saveBlock.mutate}
                onCancel={() => setEditingBlock(null)}
              />
            ) : (
              <BlockCard
                key={b.id}
                block={b}
                talks={talksByBlock.get(b.id) ?? NO_TALKS}
                requirements={requirements}
                assignments={assignments}
                locationLabel={locationLabel}
                isOpen={expanded.has(b.id)}
                onToggle={() =>
                  setExpanded((s) => {
                    const n = new Set(s)
                    if (n.has(b.id)) n.delete(b.id)
                    else n.add(b.id)
                    return n
                  })
                }
                editingTalkId={editingTalk}
                addingTalk={addingTalkTo === b.id}
                savingTalk={saveTalk.isPending}
                onEditBlock={() => setEditingBlock(b.id)}
                onEditTalk={setEditingTalk}
                onAddTalk={() => setAddingTalkTo(b.id)}
                onCancelTalk={() => {
                  setEditingTalk(null)
                  setAddingTalkTo(null)
                }}
                onSaveTalk={saveTalk.mutate}
                onDeleteTalk={deleteTalk.mutate}
                onSaveRoles={saveRoles.mutate}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
