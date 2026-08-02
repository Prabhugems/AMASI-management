"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
import { QrImage } from "@/components/QrImage"
import { toast } from "sonner"
import {
  Plus,
  Copy,
  Monitor,
  Search,
  Clock,
  List,
  LayoutGrid,
  ChevronDown,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { computeStationStatus, isStaleQuiet, STATION_STATUS_LABELS } from "@/lib/kiosk-station-status"
import {
  STATUS_MEANINGS,
  stationUrl,
  relativeLastSeen,
  STATUS_META,
  STATUS_FILTERS,
  STATUS_RANK,
  GROUP_ORDER,
  GROUP_LABELS,
  CHIP_LIMIT,
  StationListsPicker,
  StationNameEditor,
  StationBehaviourControls,
  StationBehaviourSummary,
  StationActions,
  AttendedOnConfirmDialog,
  type CheckinList,
  type PrintStation,
  type KioskStation,
} from "@/components/kiosk-admin/station-controls"
import { AddStationWizard } from "@/components/kiosk-admin/add-station-wizard"
import { useMediaQuery } from "@/hooks/use-media-query"

export default function KioskStationsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [stations, setStations] = useState<KioskStation[]>([])
  const [lists, setLists] = useState<CheckinList[]>([])
  const [printStations, setPrintStations] = useState<PrintStation[]>([])
  const [listCounts, setListCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  // Guards against a lost-update race: a second checkbox click for the same
  // station, fired before the first PATCH+reload round-trip resolves, would
  // compute nextIds from a stale `station.list_ids` closure and silently
  // discard the in-flight change. Disabling that station's checkboxes while
  // a reassignment is in flight prevents the stale computation from firing.
  const [reassigningStationId, setReassigningStationId] = useState<string | null>(null)

  const [addWizardOpen, setAddWizardOpen] = useState(false)

  // Hand-off modal: shows a freshly-minted plaintext token exactly once
  // (on create or regenerate) -- never re-fetchable afterward.
  const [handoff, setHandoff] = useState<{ name: string; token: string } | null>(null)

  // Search + status filter (client-side only, operating on the already-
  // fetched `stations` array).
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "quiet" | "revoked">("all")

  // List/grid view toggle + bulk selection -- all client-side, operating on
  // the already-filtered/searched `stations` array. No new fetch params.
  const [view, setView] = useState<"list" | "grid">("list")
  // List is a fixed-pixel desktop table (~1018px minimum); below 1024px it
  // forces Grid instead, which is already responsive down to one column.
  // See docs/superpowers/specs/2026-08-02-kiosk-stations-responsive-layout-design.md.
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const effectiveView = isDesktop ? view : "grid"
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkListPickerOpen, setBulkListPickerOpen] = useState(false)
  const [bulkAssigning, setBulkAssigning] = useState(false)

  // Inline rename (click station name -> input with Save/Cancel).
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [renaming, setRenaming] = useState(false)

  // Danger-zone confirmation, shared between Revoke and Delete, and between
  // the single-station kebab-menu action and the bulk-action bar. `stations`
  // always carries an array; a single-station action just passes a
  // one-element array, so runConfirm() has exactly one code path for both
  // cases. Delete's confirmation mechanism is a typed-text match rather than
  // an acknowledgment checkbox (see deleteConfirmText below) -- for a single
  // station the admin must type that station's exact name; for a bulk
  // selection there's no single name to match, so the fixed word "DELETE" is
  // required instead (matches the existing "type the exact name to confirm"
  // convention used elsewhere in this app -- e.g. event deletion, team member
  // deletion -- for the single-target case; "DELETE" is the fallback for the
  // no-single-name bulk case).
  const [confirmState, setConfirmState] = useState<{ kind: "revoke" | "delete"; stations: KioskStation[] } | null>(
    null
  )
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [confirmBusy, setConfirmBusy] = useState(false)

  // New Token confirmation -- a real AlertDialog (replacing a former native
  // confirm()) for the single destructive action left that didn't already
  // have one. Deliberately a separate dialog/state from confirmState above:
  // New Token isn't "revoke or delete", it's its own action with its own
  // copy, even though it reuses the same visual pattern.
  const [regenerateConfirmStation, setRegenerateConfirmStation] = useState<KioskStation | null>(null)
  const [regenerateBusy, setRegenerateBusy] = useState(false)

  // Attended-ON confirmation -- turning OFF still applies immediately (see
  // handleAttendedSwitch below), only turning ON gates through this dialog.
  // Always represents an existing station now: the Add Station wizard has
  // its own separate, purely-local confirm state (see add-station-wizard.tsx)
  // since there's no station yet to PATCH during creation.
  const [attendedConfirmTarget, setAttendedConfirmTarget] = useState<KioskStation | null>(null)
  const [attendedConfirmBusy, setAttendedConfirmBusy] = useState(false)

  // DOM refs to each row's Attended switch, keyed by station id -- lets the
  // "hidden collection lists" note inside StationListsPicker do a REAL focus
  // call (scrollIntoView + focus()) rather than just closing the popover.
  // Only one of list-view/grid-view is ever mounted at a time, so a single
  // ref per station id is enough regardless of which view is active.
  const attendedSwitchRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const focusAttendedSwitch = (stationId: string) => {
    // Deferred a frame so the popover this was clicked from has finished
    // closing (and released focus/pointer-events) before we move focus --
    // otherwise Radix's own popover-close focus return can fight this.
    requestAnimationFrame(() => {
      const el = attendedSwitchRefs.current[stationId]
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
      el?.focus()
    })
  }

  // First-run guidance banner -- shown above the table/grid until either the
  // admin dismisses it, or any station on this event reaches "online"
  // (Active) status, whichever happens first. Persisted per-event in
  // localStorage (matches the dismissal convention already used by
  // StickyAnnouncement in src/components/ui/announcement-banner.tsx) so it
  // stays hidden across reloads once dismissed -- this is a fresh minimal
  // implementation, not shared infrastructure, since no exact
  // "hide-until-condition-or-dismissed" helper already existed to reuse.
  const firstRunStorageKey = `kiosk-stations-firstrun-dismissed:${eventId}`
  const [firstRunDismissed, setFirstRunDismissed] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    setFirstRunDismissed(window.localStorage.getItem(firstRunStorageKey) === "true")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])
  const dismissFirstRun = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(firstRunStorageKey, "true")
    setFirstRunDismissed(true)
  }

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
        fetch(`/api/kiosk-stations/list-counts?event_id=${eventId}`)
          .then((r) => r.json())
          .then((d) => setListCounts(d.counts || {})),
      ])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  // "New Token" now opens a proper AlertDialog (regenerateConfirmStation)
  // instead of a blocking native confirm() -- the actual API call only runs
  // once the admin clicks "Issue new link" in that dialog (performRegenerate
  // below).
  const handleRegenerate = (station: KioskStation) => {
    setRegenerateConfirmStation(station)
  }

  const performRegenerate = async (station: KioskStation) => {
    setRegenerateBusy(true)
    try {
      const res = await fetch(`/api/kiosk-stations/${station.id}/access-token`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to issue a new link")
        return
      }
      setRegenerateConfirmStation(null)
      setHandoff({ name: station.name, token: data.access_token })
      await loadStations()
    } finally {
      setRegenerateBusy(false)
    }
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

  // Bulk "Assign list" -- adds the chosen list to every currently-selected
  // station that doesn't already have it (never removes an existing
  // assignment, and never drops a station's last-remaining list here since
  // this is purely additive). Reuses the same per-station PATCH endpoint as
  // the single-station picker, looped sequentially. A collection-purpose
  // list assigned to an unattended station in the batch isn't blocked (the
  // single-station "assignable lists" filter doesn't apply to a bulk
  // operation that may target a mix of attended/unattended stations) but
  // does get flagged with a follow-up warning toast rather than silently
  // succeeding or silently skipping.
  const handleBulkAssignList = async (list: CheckinList) => {
    const targets = stations.filter((s) => selectedIds.includes(s.id) && !s.list_ids.includes(list.id))
    if (targets.length === 0) {
      toast.success(`All selected stations already serve "${list.name}"`)
      setBulkListPickerOpen(false)
      return
    }
    setBulkAssigning(true)
    try {
      let succeeded = 0
      for (const station of targets) {
        try {
          const res = await fetch(`/api/kiosk-stations/${station.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ list_ids: [...station.list_ids, list.id] }),
          })
          if (res.ok) succeeded++
        } catch {
          // network failure for this station -- counted as not-succeeded below
        }
      }
      const failed = targets.length - succeeded
      if (failed === 0) {
        toast.success(`"${list.name}" assigned to ${succeeded} station${succeeded === 1 ? "" : "s"}`)
      } else {
        toast.error(`Assigned "${list.name}" to ${succeeded} of ${targets.length} stations — ${failed} failed`)
      }
      if (list.list_purpose === "collection") {
        const unattendedCount = targets.filter((s) => !s.attended).length
        if (unattendedCount > 0) {
          toast.warning(
            `${unattendedCount} of those station${unattendedCount === 1 ? " isn't" : "s aren't"} marked Attended -- a collection-purpose list rejects self-service scans there until Attended is turned on.`
          )
        }
      }
      setBulkListPickerOpen(false)
      setSelectedIds([])
      await loadStations()
    } finally {
      setBulkAssigning(false)
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

  // The actual PATCH, shared by both the "turn off" (immediate) and
  // "turn on" (post-confirmation) paths below.
  const performToggleAttended = async (station: KioskStation, next: boolean) => {
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

  // Turning Attended OFF applies immediately, same as every other routine
  // toggle. Turning it ON is the one asymmetric case (matches how
  // Revoke/Delete already require confirmation while routine toggles don't)
  // -- it opens attendedConfirmTarget instead of PATCHing right away.
  const handleAttendedSwitch = (station: KioskStation) => {
    if (station.attended) {
      performToggleAttended(station, false)
    } else {
      setAttendedConfirmTarget(station)
    }
  }

  const confirmAttendedOn = async () => {
    if (!attendedConfirmTarget) return
    setAttendedConfirmBusy(true)
    try {
      await performToggleAttended(attendedConfirmTarget, true)
    } finally {
      setAttendedConfirmBusy(false)
      setAttendedConfirmTarget(null)
    }
  }

  // handleRevoke / handleDelete open the shared danger-zone AlertDialog
  // (confirmState below) for one or more stations -- the single-station
  // kebab-menu actions pass a one-element array, the bulk-action bar passes
  // the full selection. The actual API calls happen in runConfirm().
  const handleRevoke = (targets: KioskStation[]) => {
    setConfirmState({ kind: "revoke", stations: targets })
  }

  const handleDelete = (targets: KioskStation[]) => {
    setDeleteConfirmText("")
    setConfirmState({ kind: "delete", stations: targets })
  }

  // Delete's typed-confirmation target: the station's own name for a single
  // station, or the fixed word "DELETE" when multiple stations are selected
  // at once (no single name to match in that case).
  const deleteConfirmExpected =
    confirmState?.kind === "delete"
      ? confirmState.stations.length > 1
        ? "DELETE"
        : (confirmState.stations[0]?.name ?? "").trim()
      : ""
  const deleteConfirmSatisfied =
    confirmState?.kind !== "delete" || deleteConfirmText.trim() === deleteConfirmExpected

  const runConfirm = async () => {
    if (!confirmState) return
    const { kind, stations: targets } = confirmState
    if (kind === "delete" && !deleteConfirmSatisfied) return
    setConfirmBusy(true)
    try {
      let succeeded = 0
      let firstError = ""
      for (const station of targets) {
        try {
          const res =
            kind === "revoke"
              ? await fetch(`/api/kiosk-stations/${station.id}/access-token`, { method: "DELETE" })
              : await fetch(`/api/kiosk-stations/${station.id}`, { method: "DELETE" })
          if (res.ok) {
            succeeded++
          } else if (!firstError) {
            const data = await res.json().catch(() => ({}) as { error?: string })
            firstError = data.error || `Failed to ${kind} ${station.name}`
          }
        } catch {
          if (!firstError) firstError = `Failed to ${kind} ${station.name}`
        }
      }
      const failed = targets.length - succeeded
      const verb = kind === "revoke" ? "revoked" : "deleted"
      if (targets.length === 1) {
        if (succeeded === 1) {
          toast.success(`${targets[0].name} ${verb}`)
        } else {
          toast.error(firstError || `Failed to ${kind} station`)
        }
      } else if (failed === 0) {
        toast.success(`${succeeded} stations ${verb}`)
      } else {
        toast.error(`${kind === "revoke" ? "Revoked" : "Deleted"} ${succeeded} of ${targets.length} — ${failed} failed`)
      }
      setConfirmState(null)
      setDeleteConfirmText("")
      setSelectedIds([])
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

  // First-run banner auto-hides the moment ANY station on this event reaches
  // Active, on top of the manual dismissal handled by firstRunDismissed/
  // dismissFirstRun above -- checks the full station set, not just one.
  const anyStationActive = statusCounts.online > 0
  useEffect(() => {
    if (anyStationActive) dismissFirstRun()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyStationActive])
  const showFirstRunBanner = !loading && stations.length > 0 && !firstRunDismissed && !anyStationActive

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

  // Grouped-by-status sections, derived from the already-filtered/searched
  // `visibleStations` -- search/status-filter narrows first, THEN groups.
  // A group with zero stations after filtering is omitted entirely.
  const groups = useMemo(() => {
    return GROUP_ORDER.map((key) => ({
      key,
      label: GROUP_LABELS[key],
      meta: STATUS_META[key],
      stations: visibleStations.filter((s) => computeStationStatus(s) === key),
    })).filter((g) => g.stations.length > 0)
  }, [visibleStations])

  const selectedStations = useMemo(() => stations.filter((s) => selectedIds.includes(s.id)), [stations, selectedIds])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // "Select all" targets the currently-VISIBLE stations (`visibleStations`),
  // not the full unfiltered set -- matches the mockup's onSelectAll, which
  // operates on `shown`.
  const allVisibleSelected = visibleStations.length > 0 && visibleStations.every((s) => selectedIds.includes(s.id))
  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? [] : visibleStations.map((s) => s.id))
  }
  const clearSelection = () => {
    setSelectedIds([])
    setBulkListPickerOpen(false)
  }

  const gridCols = "28px 150px minmax(200px,1fr) 260px 190px 190px"

  const confirmStations = confirmState?.stations ?? []
  const confirmIsBulk = confirmStations.length > 1
  const confirmNames = confirmStations.map((s) => `"${s.name}"`).join(", ")

  const activeLists = lists.filter((l) => l.is_active === true)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Kiosk Stations
          </h1>
          <p className="text-sm text-muted-foreground">
            A station is one physical tablet at one desk. Set it up once here, then open its link on the tablet — it
            stays signed in on its own and never needs a password again.
          </p>
        </div>
        <Button onClick={() => setAddWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Station
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : stations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card py-14 text-center">
          <p className="text-sm font-semibold">No stations yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Add one station for each tablet you&apos;ll hand to a volunteer. Give it the desk&apos;s name, tick the
            lists that desk handles, and connect a printer if badges are printed there.
          </p>
          <Button onClick={() => setAddWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Station
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {showFirstRunBanner && (
            <div className="relative rounded-2xl border border-info/30 bg-info/5 p-4 text-sm">
              <button
                type="button"
                onClick={dismissFirstRun}
                title="Dismiss"
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="pr-6 font-semibold">Setting up for an event?</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
                <li>Add one station per tablet, named after its desk</li>
                <li>Tick the lists that desk handles</li>
                <li>Turn on &quot;Attended&quot; if a volunteer holds it</li>
                <li>Open the station&apos;s link on the tablet, and add it to the home screen</li>
                <li>Print one test badge before the tablet leaves</li>
              </ol>
              <p className="mt-2 text-muted-foreground">
                After that the volunteer just taps the icon — no login, no link.
              </p>
            </div>
          )}
          {/* Search + status filter tabs + view toggle */}
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
            <div className="ml-auto flex items-center gap-3">
              <div className="text-xs text-muted-foreground">
                {visibleStations.length} of {stations.length} stations
              </div>
              {isDesktop && (
                <div className="flex gap-1 rounded-lg bg-muted p-1">
                  <button
                    type="button"
                    title="List view"
                    onClick={() => setView("list")}
                    className={cn(
                      "flex h-7 w-8 items-center justify-center rounded-md transition-colors",
                      view === "list"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Grid view"
                    onClick={() => setView("grid")}
                    className={cn(
                      "flex h-7 w-8 items-center justify-center rounded-md transition-colors",
                      view === "grid"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sticky bulk-action bar -- only shown once 1+ stations are selected */}
          {selectedIds.length > 0 && (
            <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 backdrop-blur">
              <span className="text-sm font-semibold">
                {selectedIds.length} station{selectedIds.length === 1 ? "" : "s"} selected
              </span>
              <span className="h-4 w-px bg-border" />
              <Popover open={bulkListPickerOpen} onOpenChange={setBulkListPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={bulkAssigning}>
                    Assign list
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start">
                  <div className="mb-1 px-1.5 py-1 text-xs font-semibold text-muted-foreground">
                    Add a list to {selectedIds.length} station{selectedIds.length === 1 ? "" : "s"}
                  </div>
                  <div className="max-h-64 space-y-0.5 overflow-y-auto">
                    {activeLists.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">No active check-in lists.</p>
                    ) : (
                      activeLists.map((list) => {
                        const allHaveIt =
                          selectedStations.length > 0 && selectedStations.every((s) => s.list_ids.includes(list.id))
                        return (
                          <button
                            key={list.id}
                            type="button"
                            disabled={bulkAssigning}
                            onClick={() => handleBulkAssignList(list)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className="flex-1 truncate">{list.name}</span>
                            {allHaveIt && (
                              <span className="text-[10px] text-muted-foreground">All assigned</span>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  onClick={() => handleRevoke(selectedStations)}
                >
                  Revoke stations
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  onClick={() => handleDelete(selectedStations)}
                >
                  Delete
                </Button>
                <span className="h-4 w-px bg-border" />
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearSelection}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {visibleStations.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card py-12 text-center">
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
          ) : effectiveView === "list" ? (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <div>
                  <div
                    className="grid gap-4 border-b bg-muted/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    style={{ gridTemplateColumns: gridCols }}
                  >
                    <div className="flex items-center">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all visible stations"
                      />
                    </div>
                    <div>Status</div>
                    <div>Station</div>
                    <div>Check-in Lists</div>
                    <div>Behaviour</div>
                    <div className="whitespace-nowrap text-right">Actions</div>
                  </div>

                  {groups.map((group) => (
                    <div key={group.key}>
                      <div className="flex items-center gap-2 border-b bg-muted/20 px-5 py-2">
                        <span className={cn("h-1.5 w-1.5 rounded-full", group.meta.dot)} />
                        <span className={cn("text-[10.5px] font-semibold uppercase tracking-wide", group.meta.label)}>
                          {group.label}
                        </span>
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {group.stations.length} {group.stations.length === 1 ? "station" : "stations"}
                        </span>
                      </div>

                      {group.stations.map((station) => {
                        const status = computeStationStatus(station)
                        const meta = STATUS_META[status]
                        const stale = isStaleQuiet(station)
                        const revoked = !!station.revoked_at
                        const isRenaming = renamingId === station.id
                        const selected = selectedIds.includes(station.id)

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
                            {/* Select */}
                            <div className="flex items-center pt-1.5">
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() => toggleSelect(station.id)}
                                aria-label={`Select ${station.name}`}
                              />
                            </div>

                            {/* Status */}
                            <div className="flex gap-2">
                              <span
                                className={cn(
                                  "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full",
                                  stale ? "bg-destructive" : meta.dot,
                                  status === "online" && "animate-pulse"
                                )}
                              />
                              <div className="min-w-0">
                                <div
                                  className={cn("text-sm font-semibold leading-tight", stale ? "text-destructive" : meta.label)}
                                  title={
                                    stale
                                      ? `${STATUS_MEANINGS[status]} Unreachable for over a day — likely off or disconnected, not just asleep.`
                                      : STATUS_MEANINGS[status]
                                  }
                                >
                                  {STATION_STATUS_LABELS[status]}
                                  {stale && <span className="ml-1 font-normal text-destructive/80">· stale</span>}
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
                              <div className="flex min-w-0 items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <StationNameEditor
                                    station={station}
                                    isRenaming={isRenaming}
                                    renameDraft={renameDraft}
                                    onDraftChange={setRenameDraft}
                                    renaming={renaming}
                                    onStart={() => startRename(station)}
                                    onCancel={cancelRename}
                                    onSave={() => saveRename(station)}
                                  />
                                </div>
                                <Link
                                  href={`/events/${eventId}/kiosk-stations/${station.id}`}
                                  className="shrink-0 text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                                >
                                  Manage
                                </Link>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span
                                  className="rounded-full border px-1.5 py-0.5 text-[10px] font-normal"
                                  title={
                                    station.mode === "checkin_and_print"
                                      ? "Scans delegates in and prints their badge."
                                      : "Scans delegates in. No badge printing."
                                  }
                                >
                                  {station.mode === "checkin_and_print" ? "Check-in + Print" : "Check-in"}
                                </span>
                                {station.attended && (
                                  <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-normal">
                                    Attended
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Check-in lists, with live counts */}
                            <div className="min-w-0">
                              <StationListsPicker
                                station={station}
                                lists={lists}
                                options={assignableLists(station.attended)}
                                counts={listCounts}
                                busy={reassigningStationId === station.id}
                                onChange={(ids) => handleReassignLists(station, ids)}
                                onFocusAttended={() => router.push(`/events/${eventId}/kiosk-stations/${station.id}`)}
                              />
                            </div>

                            {/* Behaviour: one-line summary -- editing moved to the station's detail page */}
                            <StationBehaviourSummary
                              station={station}
                              printStationName={printStations.find((p) => p.id === station.print_station_id)?.name ?? null}
                            />

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-1.5">
                              <StationActions
                                revoked={revoked}
                                onRegenerate={() => handleRegenerate(station)}
                                onRename={() => startRename(station)}
                                onRevoke={() => handleRevoke([station])}
                                onDelete={() => handleDelete([station])}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.key}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full", group.meta.dot)} />
                    <span className={cn("text-[11px] font-semibold uppercase tracking-wide", group.meta.label)}>
                      {group.label}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {group.stations.length} {group.stations.length === 1 ? "station" : "stations"}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {group.stations.map((station) => {
                      const status = computeStationStatus(station)
                      const meta = STATUS_META[status]
                      const stale = isStaleQuiet(station)
                      const revoked = !!station.revoked_at
                      const isRenaming = renamingId === station.id
                      const selected = selectedIds.includes(station.id)

                      return (
                        <div
                          key={station.id}
                          className={cn("rounded-2xl border bg-card overflow-hidden", revoked && "opacity-70")}
                        >
                          <div className={cn("flex items-center gap-2 border-b border-t-4 px-4 py-3", meta.topBorder)}>
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() => toggleSelect(station.id)}
                              aria-label={`Select ${station.name}`}
                            />
                            <span
                              className={cn(
                                "h-2 w-2 flex-shrink-0 rounded-full",
                                stale ? "bg-destructive" : meta.dot,
                                status === "online" && "animate-pulse"
                              )}
                            />
                            <span
                              className={cn("text-sm font-semibold", stale ? "text-destructive" : meta.label)}
                              title={
                                stale
                                  ? `${STATUS_MEANINGS[status]} Unreachable for over a day — likely off or disconnected, not just asleep.`
                                  : STATUS_MEANINGS[status]
                              }
                            >
                              {STATION_STATUS_LABELS[status]}
                              {stale && <span className="ml-1 font-normal text-destructive/80">· stale</span>}
                            </span>
                            <span className="ml-auto flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span className="min-w-0 truncate">
                                {revoked ? "Revoked" : relativeLastSeen(station.last_seen_at)}
                              </span>
                            </span>
                          </div>

                          <div className="flex flex-col gap-3 p-4">
                            <div className="flex flex-col gap-1">
                              <StationNameEditor
                                station={station}
                                isRenaming={isRenaming}
                                renameDraft={renameDraft}
                                onDraftChange={setRenameDraft}
                                renaming={renaming}
                                onStart={() => startRename(station)}
                                onCancel={cancelRename}
                                onSave={() => saveRename(station)}
                              />
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span
                                  className="rounded-full border px-1.5 py-0.5 text-[10px] font-normal"
                                  title={
                                    station.mode === "checkin_and_print"
                                      ? "Scans delegates in and prints their badge."
                                      : "Scans delegates in. No badge printing."
                                  }
                                >
                                  {station.mode === "checkin_and_print" ? "Check-in + Print" : "Check-in"}
                                </span>
                                {station.attended && (
                                  <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-normal">
                                    Attended
                                  </span>
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Check-in Lists
                              </div>
                              <StationListsPicker
                                station={station}
                                lists={lists}
                                options={assignableLists(station.attended)}
                                busy={reassigningStationId === station.id}
                                onChange={(ids) => handleReassignLists(station, ids)}
                                onFocusAttended={() => focusAttendedSwitch(station.id)}
                              />
                            </div>

                            <StationBehaviourControls
                              station={station}
                              revoked={revoked}
                              usbPrintStations={usbPrintStations}
                              attendedSwitchRef={(el) => {
                                attendedSwitchRefs.current[station.id] = el
                              }}
                              onToggleAttended={() => handleAttendedSwitch(station)}
                              onTogglePrint={() => handleToggleAutoPrint(station)}
                              onReassignPrintStation={(id) => handleReassignPrintStation(station, id)}
                            />
                          </div>

                          <div className="flex items-center gap-1.5 border-t bg-muted/30 px-4 py-3">
                            <StationActions
                              revoked={revoked}
                              onRegenerate={() => handleRegenerate(station)}
                              onRename={() => startRename(station)}
                              onRevoke={() => handleRevoke([station])}
                              onDelete={() => handleDelete([station])}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1 rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground/80">What the status means</p>
            <p>
              <span className="font-medium text-info">Pending</span> — {STATUS_MEANINGS.pending}
            </p>
            <p>
              <span className="font-medium text-success">Active</span> — {STATUS_MEANINGS.online}
            </p>
            <p>
              <span className="font-medium text-warning">Quiet</span> — {STATUS_MEANINGS.quiet}
            </p>
            <p>
              <span className="font-medium text-muted-foreground">Revoked</span> — {STATUS_MEANINGS.revoked}
            </p>
          </div>
        </div>
      )}

      <AddStationWizard
        open={addWizardOpen}
        onOpenChange={setAddWizardOpen}
        eventId={eventId}
        stations={stations}
        lists={lists}
        usbPrintStations={usbPrintStations}
        onCreated={(station) => {
          setHandoff({ name: station.name, token: station.access_token })
          loadStations()
        }}
      />

      {/* Hand-off modal -- the ONLY place the plaintext token is ever shown */}
      <Dialog open={!!handoff} onOpenChange={() => setHandoff(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{handoff?.name} — Set Up This Device</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Open this link on the tablet, then &quot;Add to Home Screen&quot;. This is the only time this link is shown —
              if lost, use &quot;New link&quot; to generate a replacement.
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

      {/* Danger-zone confirmation, shared between Revoke and Delete, and
          between a single station and a bulk selection. Delete requires
          typing an exact confirmation string rather than an acknowledgment
          checkbox: the station's own name for a single station, or the
          fixed word "DELETE" for a bulk selection (no single name to match
          in that case) -- see deleteConfirmExpected/deleteConfirmSatisfied
          above. */}
      <AlertDialog
        open={!!confirmState}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmState(null)
            setDeleteConfirmText("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmState?.kind === "revoke"
                ? confirmIsBulk
                  ? `Revoke these ${confirmStations.length} stations?`
                  : "Revoke this station?"
                : confirmState?.kind === "delete"
                ? confirmIsBulk
                  ? `Delete ${confirmStations.length} stations?`
                  : "Delete this station?"
                : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState?.kind === "revoke" ? (
                confirmIsBulk ? (
                  <>
                    <span className="block">
                      These tablets stop working right away. Use this if a tablet is lost or stolen. Any scans already
                      saved on them will be lost if they cannot get online again.
                    </span>
                    <span className="mt-2 block">
                      The stations keep their settings — you can issue new links later.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block">
                      The tablet stops working right away. Use this if a tablet is lost or stolen. Any scans already
                      saved on it will be lost if it cannot get online again.
                    </span>
                    <span className="mt-2 block">The station keeps its settings — you can issue a new link later.</span>
                  </>
                )
              ) : confirmState?.kind === "delete" ? (
                confirmIsBulk ? (
                  `${confirmNames} and their list assignments, printer links and sign-in links will be removed. Check-ins already recorded are kept.`
                ) : (
                  `${confirmNames} and its list assignments, printer link and sign-in link will be removed. Check-ins already recorded are kept.`
                )
              ) : (
                ""
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmState?.kind === "delete" && (
            <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <label className="text-sm font-medium">
                {confirmIsBulk
                  ? `Type "DELETE" to confirm:`
                  : <>Type <strong>&quot;{deleteConfirmExpected}&quot;</strong> to confirm:</>}
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteConfirmExpected}
                className="border-destructive/50"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={confirmBusy || (confirmState?.kind === "delete" && !deleteConfirmSatisfied)}
              onClick={runConfirm}
            >
              {confirmState?.kind === "revoke"
                ? confirmIsBulk
                  ? `Revoke ${confirmStations.length} stations`
                  : "Revoke"
                : confirmIsBulk
                ? `Delete ${confirmStations.length} stations`
                : "Delete station"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Token confirmation -- separate dialog/state from the danger-zone
          one above (confirmState). Replaces the former native confirm(). */}
      <AlertDialog
        open={!!regenerateConfirmStation}
        onOpenChange={(open) => {
          if (!open) setRegenerateConfirmStation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue a new link?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                The current link stops working immediately. Any tablet using it will need the new link.
              </span>
              <span className="mt-2 block">The station keeps its name, lists, and printer.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              disabled={regenerateBusy}
              onClick={() => {
                if (regenerateConfirmStation) performRegenerate(regenerateConfirmStation)
              }}
            >
              {regenerateBusy ? "Issuing…" : "Issue new link"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AttendedOnConfirmDialog
        open={!!attendedConfirmTarget}
        busy={attendedConfirmBusy}
        onOpenChange={(open) => {
          if (!open) setAttendedConfirmTarget(null)
        }}
        onConfirm={confirmAttendedOn}
      />
    </div>
  )
}
