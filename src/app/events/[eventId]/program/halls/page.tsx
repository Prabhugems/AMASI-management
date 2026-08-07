"use client"

// Venue Overview — the first page in building an event's programme, and the
// source of the Session Builder's location list.
//
// Governing rule from the design: "Whatever is on this page is what the Session
// Builder offers as a location — there is no separate save, sync, or 'finish
// setup' step to forget." So: every add and edit happens inline on this one
// page, saves are immediate, and there is no Next button anywhere.
//
// Replaces a read-only version that derived halls by GROUP BY-ing the free-text
// `sessions.hall` column. That column is legacy; `halls` is the real table.

import { useState, useMemo, useRef, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Building2,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  MonitorPlay,
  AlertCircle,
  Check,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  buildVenueTree,
  canSaveVenueDraft,
  describeVenue,
  nextDisplayOrder,
  toLocationOptions,
  validateVenueDraft,
  VENUE_LABEL_SEPARATOR,
  type VenueHall,
  type VenueRow,
} from "@/lib/venue-tree"

type DeleteImpact = { screens: number; sessions: number; coordinators: number }

/** Which inline form, if any, is open. Only ever one at a time. */
type Editing =
  | { mode: "none" }
  | { mode: "add-hall" }
  | { mode: "add-screen"; parentId: string }
  | { mode: "edit"; row: VenueRow }

export default function VenueOverviewPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState<Editing>({ mode: "none" })
  const [name, setName] = useState("")
  const [capacity, setCapacity] = useState("")
  const [touched, setTouched] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ row: VenueRow; impact: DeleteImpact } | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const { data: event } = useQuery({
    queryKey: ["event-name", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name")
        .eq("id", eventId)
        .maybeSingle()
      return data as { name: string; short_name: string | null } | null
    },
  })

  const { data: rows, isLoading } = useQuery({
    queryKey: ["halls", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/halls`)
      if (!res.ok) throw new Error("Failed to load halls")
      const json = await res.json()
      return (json.data ?? []) as VenueRow[]
    },
  })

  const halls = useMemo(() => buildVenueTree(rows ?? []), [rows])
  const locationOptions = useMemo(() => toLocationOptions(halls), [halls])

  // Focus the name field whenever a form opens, so the keyboard is already
  // where it needs to be.
  useEffect(() => {
    if (editing.mode !== "none") nameRef.current?.focus()
  }, [editing.mode])

  const closeForm = () => {
    setEditing({ mode: "none" })
    setName("")
    setCapacity("")
    setTouched(false)
  }

  const openAddHall = () => {
    closeForm()
    setEditing({ mode: "add-hall" })
  }

  const openAddScreen = (parentId: string) => {
    closeForm()
    setEditing({ mode: "add-screen", parentId })
  }

  const openEdit = (row: VenueRow) => {
    setEditing({ mode: "edit", row })
    setName(row.name)
    setCapacity(row.capacity != null ? String(row.capacity) : "")
    setTouched(false)
  }

  const parentIdForDraft =
    editing.mode === "add-screen"
      ? editing.parentId
      : editing.mode === "edit"
        ? (editing.row.parent_id ?? null)
        : null

  const isScreenDraft = editing.mode === "add-screen" || (editing.mode === "edit" && !!editing.row.parent_id)

  const issues = useMemo(() => {
    if (editing.mode === "none") return []
    return validateVenueDraft(
      {
        id: editing.mode === "edit" ? editing.row.id : undefined,
        name,
        parent_id: parentIdForDraft,
        kind: isScreenDraft ? "screen" : "hall",
      },
      rows ?? []
    )
  }, [editing, name, parentIdForDraft, isScreenDraft, rows])

  // Only surface validation once the coordinator has actually tried to save.
  // Warning on an untouched empty field is nagging, not helping.
  const visibleIssues = touched ? issues : []
  const blockingIssue = visibleIssues.find((i) => i.severity === "blocking")
  const duplicateIssue = visibleIssues.find((i) => i.code === "duplicate_name")

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["halls", eventId] })

  const save = useMutation({
    mutationFn: async () => {
      const parsedCapacity = capacity.trim() === "" ? null : Number(capacity)
      const payload: Record<string, unknown> = {
        name: name.trim(),
        capacity: Number.isFinite(parsedCapacity as number) ? parsedCapacity : null,
      }

      if (editing.mode === "edit") {
        const res = await fetch(`/api/events/${eventId}/halls/${editing.row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json()).error || "Failed to save")
        return
      }

      const siblings = (rows ?? []).filter((r) => (r.parent_id ?? null) === parentIdForDraft)
      const res = await fetch(`/api/events/${eventId}/halls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          parent_id: parentIdForDraft,
          display_order: nextDisplayOrder(siblings),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save")
    },
    onSuccess: () => {
      invalidate()
      closeForm()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async (row: VenueRow) => {
      const res = await fetch(`/api/events/${eventId}/halls/${row.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to remove")
      return (await res.json()).unlinked as DeleteImpact
    },
    onSuccess: (unlinked) => {
      invalidate()
      setConfirmDelete(null)
      // Say what actually happened rather than a bare "Removed" — those
      // sessions now need a new location and the coordinator has to know.
      toast.success(
        unlinked.sessions > 0
          ? `Removed. ${unlinked.sessions} session${unlinked.sessions === 1 ? "" : "s"} now need a location.`
          : "Removed."
      )
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const askRemove = async (row: VenueRow) => {
    const res = await fetch(`/api/events/${eventId}/halls/${row.id}`)
    const impact: DeleteImpact = res.ok
      ? (await res.json()).data.impact
      : { screens: 0, sessions: 0, coordinators: 0 }
    setConfirmDelete({ row, impact })
  }

  const attemptSave = () => {
    setTouched(true)
    if (!canSaveVenueDraft(issues)) return
    save.mutate()
  }

  // -------------------------------------------------------------------------

  const inlineForm = (label: string) => (
    <div className="rounded-xl border border-primary/40 bg-muted/30 p-5">
      <div className="mb-4 text-sm font-semibold">{label}</div>
      <div className="grid gap-3.5 sm:grid-cols-[1.6fr_1fr]">
        <div className="space-y-1.5">
          <label htmlFor="venue-name" className="text-xs font-medium text-muted-foreground">
            {isScreenDraft ? "Screen name" : "Hall name"}
          </label>
          <Input
            id="venue-name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") attemptSave()
              if (e.key === "Escape") closeForm()
            }}
            placeholder={isScreenDraft ? "e.g. Screen 1" : "e.g. Hall A"}
            className={cn(
              blockingIssue && "border-destructive focus-visible:ring-destructive",
              duplicateIssue && !blockingIssue && "border-amber-500 focus-visible:ring-amber-500"
            )}
            aria-invalid={!!blockingIssue}
          />
          {blockingIssue && (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {blockingIssue.message}
            </p>
          )}
          {duplicateIssue && !blockingIssue && (
            <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {duplicateIssue.message}{" "}
                {duplicateIssue.conflictsWith && (
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => {
                      const target = (rows ?? []).find((r) => r.id === duplicateIssue.conflictsWith)
                      if (target) openEdit(target)
                    }}
                  >
                    Edit existing {(rows ?? []).find((r) => r.id === duplicateIssue.conflictsWith)?.name}
                  </button>
                )}
              </span>
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="venue-capacity" className="text-xs font-medium text-muted-foreground">
            Capacity <span className="font-normal text-muted-foreground/70">— optional</span>
          </label>
          <Input
            id="venue-capacity"
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") attemptSave()
              if (e.key === "Escape") closeForm()
            }}
            placeholder="e.g. 400"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" onClick={attemptSave} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          {editing.mode === "edit" ? "Save" : isScreenDraft ? "Save screen" : "Save hall"}
        </Button>
        <button
          type="button"
          onClick={closeForm}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        {editing.mode === "edit" && (editing.row.parent_id ? null : (
          <span className="ml-auto text-xs text-muted-foreground">
            {halls.find((h) => h.id === editing.row.id)?.screens.length
              ? `Its ${halls.find((h) => h.id === editing.row.id)!.screens.length} screens stay as they are.`
              : null}
          </span>
        ))}
      </div>
    </div>
  )

  const hallCard = (h: VenueHall) => {
    const isEditingThis = editing.mode === "edit" && editing.row.id === h.id
    if (isEditingThis) return <div key={h.id}>{inlineForm("Edit hall")}</div>

    return (
      <div key={h.id} className="rounded-xl border bg-card">
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="font-medium">{h.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {[
                  h.capacity != null ? `${h.capacity.toLocaleString("en-IN")} seats` : null,
                  h.screens.length > 0
                    ? `${h.screens.length} screen${h.screens.length === 1 ? "" : "s"}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No capacity set"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(h as VenueRow)}>
              <Pencil className="h-3.5 w-3.5" />
              <span className="sr-only">Edit {h.name}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => askRemove(h as VenueRow)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Remove {h.name}</span>
            </Button>
          </div>
        </div>

        {(h.screens.length > 0 || (editing.mode === "add-screen" && editing.parentId === h.id)) && (
          <div className="space-y-1 border-t px-4 py-3 pl-12">
            {h.screens.map((s) =>
              editing.mode === "edit" && editing.row.id === s.id ? (
                <div key={s.id} className="py-1">
                  {inlineForm("Edit screen")}
                </div>
              ) : (
                <div key={s.id} className="group flex items-center justify-between gap-2 py-1">
                  <div className="flex items-center gap-2 text-sm">
                    <MonitorPlay className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{s.name}</span>
                    {s.capacity != null && (
                      <span className="text-xs text-muted-foreground">
                        {s.capacity.toLocaleString("en-IN")} seats
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit({ ...s, parent_id: h.id, kind: "screen" } as VenueRow)}
                    >
                      <Pencil className="h-3 w-3" />
                      <span className="sr-only">Edit {s.name}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => askRemove({ ...s, parent_id: h.id, kind: "screen" } as VenueRow)}
                    >
                      <Trash2 className="h-3 w-3" />
                      <span className="sr-only">Remove {s.name}</span>
                    </Button>
                  </div>
                </div>
              )
            )}
            {editing.mode === "add-screen" && editing.parentId === h.id && (
              <div className="py-2">{inlineForm("New screen")}</div>
            )}
          </div>
        )}

        {editing.mode === "none" && (
          <div className="border-t px-4 py-2.5">
            <button
              type="button"
              onClick={() => openAddScreen(h.id)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              {h.screens.length > 0 ? "Add another screen" : "Add a screen under this hall"}
            </button>
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Venue Overview</h1>
          <p className="text-sm text-muted-foreground">
            {event?.short_name || event?.name || "Event"}
            {halls.length > 0 && <> · {describeVenue(halls)}</>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5" />
          Saved automatically
        </div>
      </div>

      {halls.length === 0 && editing.mode !== "add-hall" ? (
        <div className="rounded-xl border border-dashed bg-card py-14 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="mb-4 text-sm text-muted-foreground">No halls yet.</p>
          <Button onClick={openAddHall}>
            <Plus className="mr-2 h-4 w-4" />
            Add a hall
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {halls.map(hallCard)}

          {editing.mode === "add-hall" && inlineForm("New hall")}

          {editing.mode === "none" && (
            <Button variant="outline" onClick={openAddHall} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              {halls.length === 0 ? "Add a hall" : "Add another hall"}
            </Button>
          )}
        </div>
      )}

      {/* What the Session Builder will offer. Shown so the link between this
          page and session placement is visible rather than asserted. */}
      {halls.length > 0 && (
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="mb-2.5 text-xs font-medium text-muted-foreground">
            How this looks when picking a location for a session
          </div>
          <div className="space-y-1">
            {locationOptions.map((o) => (
              <div
                key={o.id}
                className={cn(
                  "text-sm",
                  o.depth === 1 && "pl-5",
                  !o.selectable && "text-xs font-medium uppercase tracking-wide text-muted-foreground"
                )}
              >
                {o.depth === 1 ? o.label.split(VENUE_LABEL_SEPARATOR).pop() : o.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-lg">
            <h2 className="font-semibold">
              Remove {confirmDelete.row.name}
              {confirmDelete.impact.screens > 0 && ` and its ${confirmDelete.impact.screens} screens`}?
            </h2>
            {confirmDelete.impact.sessions > 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {confirmDelete.impact.sessions} session
                {confirmDelete.impact.sessions === 1 ? "" : "s"} already placed there will need a new
                location. {confirmDelete.impact.sessions === 1 ? "It stays" : "They stay"} on the
                programme.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Nothing is scheduled here yet.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                Keep it
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate(confirmDelete.row)}
              >
                {remove.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
