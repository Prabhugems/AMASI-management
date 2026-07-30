"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { QrImage } from "@/components/QrImage"
import { toast } from "sonner"
import { Plus, Copy, RefreshCw, Monitor, MoreVertical, Search, Clock, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { computeStationStatus, STATION_STATUS_LABELS, type KioskStationStatus } from "@/lib/kiosk-station-status"

type CheckinList = { id: string; name: string; is_active?: boolean; list_purpose?: string }
type PrintStation = { id: string; name: string; print_settings?: { printer_type?: string } }
type KioskStation = {
  id: string
  event_id: string
  name: string
  mode: "checkin" | "print" | "checkin_and_print"
  list_ids: string[]
  print_station_id: string | null
  auto_print_badge: boolean
  attended: boolean
  last_seen_at: string | null
  revoked_at: string | null
  created_at: string
}

function stationUrl(token: string) {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/kiosk-station/${token}`
}

function relativeLastSeen(iso: string | null) {
  if (!iso) return "Never connected"
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Active just now"
  if (mins < 60) return `Active ${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Active ${hours}h ago`
  return `Active ${Math.floor(hours / 24)}d ago`
}

// Visual meta per discrete status category (see src/lib/kiosk-station-status.ts
// for the derivation). "pending" has no filter tab (matches the mockup's
// FILTERS array) but still needs dot/label styling since it shows under "All".
const STATUS_META: Record<KioskStationStatus, { dot: string; label: string; border: string }> = {
  online: { dot: "bg-success", label: "text-success", border: "border-l-success" },
  quiet: { dot: "bg-warning", label: "text-warning", border: "border-l-warning" },
  pending: { dot: "bg-info", label: "text-info", border: "border-l-info" },
  revoked: { dot: "bg-muted-foreground/40", label: "text-muted-foreground", border: "border-l-transparent" },
}

// Filter tabs shown above the table -- deliberately omits "pending" (matches
// the mockup's own FILTERS array): a never-connected station still shows up
// under "All", it just doesn't get its own tab.
const STATUS_FILTERS: { key: "all" | "online" | "quiet" | "revoked"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "online", label: "Active" },
  { key: "quiet", label: "Quiet" },
  { key: "revoked", label: "Revoked" },
]

// Attention-first sort: a volunteer's tablet that's gone quiet should never
// be buried at the bottom of a long list. Matches the mockup's RANK table.
const STATUS_RANK: Record<KioskStationStatus, number> = { quiet: 0, pending: 1, online: 2, revoked: 3 }

const CHIP_LIMIT = 2

export default function KioskStationsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [stations, setStations] = useState<KioskStation[]>([])
  const [lists, setLists] = useState<CheckinList[]>([])
  const [printStations, setPrintStations] = useState<PrintStation[]>([])
  const [loading, setLoading] = useState(true)
  // Guards against a lost-update race: a second checkbox click for the same
  // station, fired before the first PATCH+reload round-trip resolves, would
  // compute nextIds from a stale `station.list_ids` closure and silently
  // discard the in-flight change. Disabling that station's checkboxes while
  // a reassignment is in flight prevents the stale computation from firing.
  const [reassigningStationId, setReassigningStationId] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newListIds, setNewListIds] = useState<string[]>([])
  const [newMode, setNewMode] = useState<"checkin" | "checkin_and_print">("checkin")
  const [newPrintStationId, setNewPrintStationId] = useState("")
  const [newAutoPrint, setNewAutoPrint] = useState(false)
  const [newAttended, setNewAttended] = useState(false)
  const [creating, setCreating] = useState(false)

  // Hand-off modal: shows a freshly-minted plaintext token exactly once
  // (on create or regenerate) -- never re-fetchable afterward.
  const [handoff, setHandoff] = useState<{ name: string; token: string } | null>(null)

  // Search + status filter (client-side only, operating on the already-
  // fetched `stations` array).
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "quiet" | "revoked">("all")

  // Inline rename (click station name -> input with Save/Cancel).
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [renaming, setRenaming] = useState(false)

  // Danger-zone confirmation, shared between Revoke and Delete -- only
  // Delete requires the acknowledgment checkbox (matches the mockup's
  // confirmNeedsAck: c.kind === 'delete').
  const [confirmState, setConfirmState] = useState<{ kind: "revoke" | "delete"; station: KioskStation } | null>(null)
  const [deleteAck, setDeleteAck] = useState(false)
  const [confirmBusy, setConfirmBusy] = useState(false)

  // A collection-purpose list rejects every kiosk self-check-in scan on an
  // unattended device (see /api/kiosk/checkin) -- so it's only offered as an
  // assignment target once the station is (or is being created as)
  // attended, meaning a volunteer is always present to operate it. An
  // inactive list shouldn't be a target for a brand-new device either way.
  // `lists` itself stays unfiltered so name lookups (e.g. a station's
  // currently-assigned list) keep working even if that list has since gone
  // inactive.
  // NOTE: this is intentionally coupled to `attended` defaulting to false
  // for every existing station. Ticking "Attended" and assigning a
  // collection list here makes the station accept those scans successfully,
  // but does NOT yet give the volunteer any distinct on-device "already
  // collected" duplicate-scan warning for collection lists -- that's a
  // separate, not-yet-built screen, deliberately deferred pending an
  // architecture decision elsewhere in this codebase. Don't assume flipping
  // this toggle alone delivers the full feature.
  function assignableLists(attended: boolean) {
    return lists.filter((l) => l.is_active === true && (attended || l.list_purpose !== "collection"))
  }

  // Only USB-type Print Stations can drive kiosk auto-print (see
  // /api/kiosk-stations validation) -- network/other printer types aren't
  // reachable from the kiosk device itself, so they're not offered here.
  const usbPrintStations = printStations.filter((p) => p?.print_settings?.printer_type === "usb")

  const loadStations = async () => {
    const res = await fetch(`/api/kiosk-stations?event_id=${eventId}`)
    const data = await res.json()
    setStations(data.stations || [])
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      await Promise.all([
        loadStations(),
        fetch(`/api/checkin-lists?event_id=${eventId}`)
          .then((r) => r.json())
          .then((d) => setLists(d.lists || d || [])),
        fetch(`/api/print-stations?event_id=${eventId}`)
          .then((r) => r.json())
          .then((d) => setPrintStations(Array.isArray(d) ? d : [])),
      ])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const handleCreate = async () => {
    if (!newName.trim() || newListIds.length === 0) return
    if (newMode === "checkin_and_print" && !newPrintStationId) return
    setCreating(true)
    try {
      const res = await fetch("/api/kiosk-stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          name: newName.trim(),
          list_ids: newListIds,
          mode: newMode,
          attended: newAttended,
          ...(newMode === "checkin_and_print" && { print_station_id: newPrintStationId, auto_print_badge: newAutoPrint }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to create station")
        return
      }
      setShowCreate(false)
      setNewName("")
      setNewListIds([])
      setNewMode("checkin")
      setNewPrintStationId("")
      setNewAutoPrint(false)
      setNewAttended(false)
      setHandoff({ name: data.name, token: data.access_token })
      await loadStations()
    } finally {
      setCreating(false)
    }
  }

  const handleRegenerate = async (station: KioskStation) => {
    if (!confirm(`Generate a new token for "${station.name}"? The current token will stop working immediately, bricking the device until it's re-provisioned with the new one.`)) return
    const res = await fetch(`/api/kiosk-stations/${station.id}/access-token`, { method: "POST" })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to regenerate token")
      return
    }
    setHandoff({ name: station.name, token: data.access_token })
    await loadStations()
  }

  const handleReassignLists = async (station: KioskStation, listIds: string[]) => {
    setReassigningStationId(station.id)
    try {
      const res = await fetch(`/api/kiosk-stations/${station.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list_ids: listIds }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to change lists")
        return
      }
      toast.success(`${station.name} reassigned`)
      await loadStations()
    } finally {
      setReassigningStationId(null)
    }
  }

  const handleReassignPrintStation = async (station: KioskStation, printStationId: string) => {
    const res = await fetch(`/api/kiosk-stations/${station.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ print_station_id: printStationId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to change print station")
      return
    }
    toast.success(`${station.name} reassigned to ${printStations.find((p) => p.id === printStationId)?.name || "the new print station"}`)
    await loadStations()
  }

  const handleToggleAutoPrint = async (station: KioskStation) => {
    const next = !station.auto_print_badge
    const res = await fetch(`/api/kiosk-stations/${station.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_print_badge: next }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to change auto-print")
      return
    }
    toast.success(`${station.name}: auto-print ${next ? "on" : "off"}`)
    await loadStations()
  }

  const handleToggleAttended = async (station: KioskStation) => {
    const next = !station.attended
    const res = await fetch(`/api/kiosk-stations/${station.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: next }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to change attended")
      return
    }
    toast.success(`${station.name}: attended ${next ? "on" : "off"}`)
    await loadStations()
  }

  // handleRevoke / handleDelete used to gate on a native confirm() -- now
  // they just open the shared danger-zone AlertDialog (confirmState below);
  // the actual API calls happen in runConfirm().
  const handleRevoke = (station: KioskStation) => {
    setConfirmState({ kind: "revoke", station })
  }

  const handleDelete = (station: KioskStation) => {
    setDeleteAck(false)
    setConfirmState({ kind: "delete", station })
  }

  const runConfirm = async () => {
    if (!confirmState) return
    const { kind, station } = confirmState
    if (kind === "delete" && !deleteAck) return
    setConfirmBusy(true)
    try {
      if (kind === "revoke") {
        const res = await fetch(`/api/kiosk-stations/${station.id}/access-token`, { method: "DELETE" })
        if (!res.ok) {
          toast.error("Failed to revoke station")
          return
        }
        toast.success(`${station.name} revoked`)
      } else {
        const res = await fetch(`/api/kiosk-stations/${station.id}`, { method: "DELETE" })
        if (!res.ok) {
          toast.error("Failed to delete station")
          return
        }
        toast.success(`${station.name} deleted`)
      }
      setConfirmState(null)
      setDeleteAck(false)
      await loadStations()
    } finally {
      setConfirmBusy(false)
    }
  }

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(stationUrl(token))
    toast.success("Link copied")
  }

  const startRename = (station: KioskStation) => {
    setRenamingId(station.id)
    setRenameDraft(station.name)
  }
  const cancelRename = () => {
    setRenamingId(null)
    setRenameDraft("")
  }
  const saveRename = async (station: KioskStation) => {
    const trimmed = renameDraft.trim()
    if (!trimmed) {
      cancelRename()
      return
    }
    if (trimmed === station.name) {
      cancelRename()
      return
    }
    setRenaming(true)
    try {
      const res = await fetch(`/api/kiosk-stations/${station.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to rename station")
        return
      }
      toast.success("Station renamed")
      setRenamingId(null)
      await loadStations()
    } finally {
      setRenaming(false)
    }
  }

  // Tab counts always reflect the full station set, independent of the
  // current search text -- matches the mockup's `counts`, computed from
  // `S.stations` rather than the filtered `shown` list.
  const statusCounts = useMemo(() => {
    const counts = { all: stations.length, online: 0, quiet: 0, revoked: 0 }
    for (const s of stations) {
      const status = computeStationStatus(s)
      if (status === "online" || status === "quiet" || status === "revoked") counts[status]++
    }
    return counts
  }, [stations])

  const visibleStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return stations
      .filter((s) => {
        const status = computeStationStatus(s)
        if (statusFilter !== "all" && status !== statusFilter) return false
        if (q && !s.name.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => STATUS_RANK[computeStationStatus(a)] - STATUS_RANK[computeStationStatus(b)])
  }, [stations, searchQuery, statusFilter])

  const gridCols = "150px minmax(200px,1fr) 260px 190px 190px"

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Kiosk Stations
          </h1>
          <p className="text-sm text-muted-foreground">
            Provision a physical device once — it authenticates with its own token from then on.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Station
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : stations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No kiosk stations yet.</p>
      ) : (
        <div className="space-y-3">
          {/* Search + status filter tabs */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === f.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                  <span className="text-[11px] tabular-nums opacity-70">{statusCounts[f.key]}</span>
                </button>
              ))}
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stations…"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              {visibleStations.length} of {stations.length} stations
            </div>
          </div>

          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ minWidth: "1080px" }}>
                <div
                  className="grid gap-4 border-b bg-muted/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <div>Status</div>
                  <div>Station</div>
                  <div>Check-in Lists</div>
                  <div>Behaviour</div>
                  <div className="text-right">Actions</div>
                </div>

                {visibleStations.map((station) => {
                  const status = computeStationStatus(station)
                  const meta = STATUS_META[status]
                  const listNames = station.list_ids
                    .map((id) => lists.find((l) => l.id === id)?.name)
                    .filter(Boolean) as string[]
                  const visibleChips = listNames.slice(0, CHIP_LIMIT)
                  const moreCount = listNames.length - visibleChips.length
                  const revoked = !!station.revoked_at
                  const isRenaming = renamingId === station.id

                  return (
                    <div
                      key={station.id}
                      className={cn(
                        "grid gap-4 items-start border-b border-l-4 px-5 py-4 last:border-b-0 transition-colors hover:bg-muted/40",
                        meta.border,
                        revoked && "opacity-70"
                      )}
                      style={{ gridTemplateColumns: gridCols }}
                    >
                      {/* Status */}
                      <div className="flex gap-2">
                        <span
                          className={cn(
                            "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full",
                            meta.dot,
                            status === "online" && "animate-pulse"
                          )}
                        />
                        <div className="min-w-0">
                          <div className={cn("text-sm font-semibold leading-tight", meta.label)}>
                            {STATION_STATUS_LABELS[status]}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            <span className="min-w-0 truncate">
                              {revoked ? "Revoked" : relativeLastSeen(station.last_seen_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Station name + printer */}
                      <div className="min-w-0 flex flex-col gap-1">
                        {isRenaming ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              autoFocus
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveRename(station)
                                if (e.key === "Escape") cancelRename()
                              }}
                              className="h-8 text-sm font-medium"
                            />
                            <Button size="sm" className="h-8 px-2.5" disabled={renaming} onClick={() => saveRename(station)}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={cancelRename}>
                              Esc
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startRename(station)}
                            title="Rename station"
                            className="group flex items-baseline gap-1.5 text-left"
                          >
                            <span className="truncate text-sm font-semibold">{station.name}</span>
                            <Pencil className="h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-40" />
                          </button>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-normal">
                            {station.mode === "checkin_and_print" ? "Check-in + Print" : "Check-in"}
                          </span>
                          {station.attended && (
                            <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-normal">Attended</span>
                          )}
                        </div>
                      </div>

                      {/* Check-in lists */}
                      <div className="min-w-0">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="flex w-full flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-transparent px-1 py-1 -mx-1 text-left transition-colors hover:border-border hover:bg-muted/50"
                            >
                              {listNames.length === 0 ? (
                                <span className="rounded-md border border-dashed border-warning/50 px-2 py-0.5 text-xs text-warning">
                                  Assign lists
                                </span>
                              ) : (
                                <>
                                  {visibleChips.map((name) => (
                                    <span
                                      key={name}
                                      className="rounded-md border bg-muted px-2 py-0.5 text-xs whitespace-nowrap text-foreground/80"
                                    >
                                      {name}
                                    </span>
                                  ))}
                                  {moreCount > 0 && (
                                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs whitespace-nowrap text-primary">
                                      +{moreCount} more
                                    </span>
                                  )}
                                </>
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-3">
                            <div className="mb-2 flex items-center justify-between border-b pb-2">
                              <span className="text-xs font-semibold">Lists served by this station</span>
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {station.list_ids.length} of {lists.length} selected
                              </span>
                            </div>
                            <div className="max-h-64 space-y-0.5 overflow-y-auto">
                              {assignableLists(station.attended).map((list) => {
                                const checked = station.list_ids.includes(list.id)
                                return (
                                  <label
                                    key={list.id}
                                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      disabled={reassigningStationId === station.id}
                                      onCheckedChange={(next) => {
                                        const nextIds = next
                                          ? [...station.list_ids, list.id]
                                          : station.list_ids.filter((id) => id !== list.id)
                                        if (nextIds.length === 0) {
                                          toast.error("A station needs at least one assigned list")
                                          return
                                        }
                                        handleReassignLists(station, nextIds)
                                      }}
                                    />
                                    <span className="flex-1 truncate">{list.name}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Behaviour: attended / print station / auto-print */}
                      <div className="flex flex-col gap-2 text-xs">
                        <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                          <Switch
                            checked={station.attended}
                            disabled={revoked}
                            onCheckedChange={() => handleToggleAttended(station)}
                          />
                          Attended
                        </label>
                        {station.mode === "checkin_and_print" && (
                          <>
                            <Select
                              value={station.print_station_id ?? undefined}
                              onValueChange={(value) => handleReassignPrintStation(station, value)}
                            >
                              <SelectTrigger className="h-7 w-full text-xs">
                                <SelectValue placeholder="No printer" />
                              </SelectTrigger>
                              <SelectContent>
                                {usbPrintStations.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <label
                              className={cn(
                                "flex items-center gap-2 text-muted-foreground",
                                station.print_station_id && !revoked ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                              )}
                            >
                              <Switch
                                checked={station.auto_print_badge}
                                disabled={revoked || !station.print_station_id}
                                onCheckedChange={() => handleToggleAutoPrint(station)}
                              />
                              Auto-print
                            </label>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => handleRegenerate(station)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          {revoked ? "Re-issue token" : "New Token"}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="More actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => startRename(station)}>Rename station</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
                              Danger zone
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              disabled={revoked}
                              onClick={() => handleRevoke(station)}
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              Revoke token
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(station)}
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              Delete station…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}

                {visibleStations.length === 0 && (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <p className="text-sm text-muted-foreground">No stations match this filter.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStatusFilter("all")
                        setSearchQuery("")
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            A station goes <span className="text-warning">Quiet</span> after 15 minutes without a heartbeat. Revoking a
            token stops that tablet immediately; the station keeps its configuration.
          </p>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Kiosk Station</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Station name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Front Desk 3" />
              <p className="text-xs text-muted-foreground">Shown on the tablet so the volunteer knows which desk they&apos;re on.</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Check-in lists</label>
                <span className="text-xs text-muted-foreground">{newListIds.length} selected</span>
              </div>
              <div className="space-y-0.5 rounded-lg border p-1.5 max-h-48 overflow-y-auto">
                {assignableLists(newAttended).map((list) => (
                  <label key={list.id} className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={newListIds.includes(list.id)}
                      onCheckedChange={(checked) =>
                        setNewListIds(checked ? [...newListIds, list.id] : newListIds.filter((id) => id !== list.id))
                      }
                    />
                    <span className="flex-1">{list.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mode</label>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={newMode === "checkin"} onChange={() => setNewMode("checkin")} />
                  Check-in only
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={newMode === "checkin_and_print"} onChange={() => setNewMode("checkin_and_print")} />
                  Check-in + Print Badge
                </label>
              </div>
            </div>

            {newMode === "checkin_and_print" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Print Station</label>
                {usbPrintStations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No USB-type Print Station found for this event. Create one on the Print Station page first.
                  </p>
                ) : (
                  <Select value={newPrintStationId} onValueChange={setNewPrintStationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a print station" />
                    </SelectTrigger>
                    <SelectContent>
                      {usbPrintStations.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="divide-y rounded-lg border">
              <label className="flex items-center gap-3 p-3 cursor-pointer">
                <Switch checked={newAttended} onCheckedChange={setNewAttended} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Attended</span>
                  <span className="block text-xs text-muted-foreground">
                    A volunteer always operates this tablet — lets it serve collection-purpose lists (kits, meals) too, not just entry lists.
                  </span>
                </span>
              </label>
              {newMode === "checkin_and_print" && (
                <label
                  className={cn(
                    "flex items-center gap-3 p-3",
                    usbPrintStations.length === 0 || !newPrintStationId ? "opacity-60" : "cursor-pointer"
                  )}
                >
                  <Switch
                    checked={newAutoPrint}
                    disabled={!newPrintStationId}
                    onCheckedChange={setNewAutoPrint}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Auto-print badge on check-in</span>
                    <span className="block text-xs text-muted-foreground">
                      Requires an Android device with a directly-connected USB printer. Other devices will show check-in only, even if this station is configured for printing.
                    </span>
                  </span>
                </label>
              )}
            </div>

            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || newListIds.length === 0 || (newMode === "checkin_and_print" && !newPrintStationId)}
              className="w-full"
            >
              {creating ? "Creating…" : "Create Station"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hand-off modal -- the ONLY place the plaintext token is ever shown */}
      <Dialog open={!!handoff} onOpenChange={() => setHandoff(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{handoff?.name} — Set Up This Device</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Open this link on the tablet, then &quot;Add to Home Screen&quot;. This is the only time this link is shown —
              if lost, use &quot;New Token&quot; to generate a replacement.
            </p>
            {handoff && (
              <>
                <div className="flex justify-center">
                  <QrImage value={stationUrl(handoff.token)} size={192} />
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={stationUrl(handoff.token)} className="font-mono text-xs" />
                  <Button variant="outline" onClick={() => copyLink(handoff.token)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Danger-zone confirmation, shared between Revoke and Delete. Only
          Delete requires the "I understand this cannot be undone" ack. */}
      <AlertDialog
        open={!!confirmState}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmState(null)
            setDeleteAck(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmState?.kind === "revoke" ? "Revoke token for this station?" : "Delete this station?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState?.kind === "revoke"
                ? `"${confirmState.station.name}" will stop checking people in the moment you confirm. Any volunteer holding that tablet sees a sign-in screen. You can issue a new token afterwards.`
                : confirmState
                ? `"${confirmState.station.name}" and its list assignments, printer link and token will be removed. Check-ins already recorded are kept.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmState?.kind === "delete" && (
            <label className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm cursor-pointer">
              <Checkbox
                checked={deleteAck}
                onCheckedChange={(v) => setDeleteAck(v === true)}
                className="mt-0.5"
              />
              I understand this cannot be undone.
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteAck(false)}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={confirmBusy || (confirmState?.kind === "delete" && !deleteAck)}
              onClick={runConfirm}
            >
              {confirmState?.kind === "revoke" ? "Revoke token" : "Delete station"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
