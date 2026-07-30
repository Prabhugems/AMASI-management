"use client"

import { useState, useEffect, useMemo, useRef } from "react"
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
import {
  Plus,
  Copy,
  RefreshCw,
  Monitor,
  MoreVertical,
  Search,
  Clock,
  Pencil,
  List,
  LayoutGrid,
  ChevronDown,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { computeStationStatus, STATION_STATUS_LABELS, type KioskStationStatus } from "@/lib/kiosk-station-status"

// Admin-facing meaning of each status, worded for someone who has never seen
// this system before (no "heartbeat", no "token"). Used both as the footer
// legend and as hover-title text on every rendered status label.
const STATUS_MEANINGS: Record<KioskStationStatus, string> = {
  pending: "Set up here, but the link has never been opened on a tablet yet.",
  online: "The tablet checked in with us within the last 15 minutes.",
  quiet:
    "No contact for over 15 minutes. The tablet may be asleep, out of signal, or closed. It is not necessarily broken, and any scans it takes offline will still arrive.",
  revoked: "This tablet has been cut off. It stops working immediately.",
}

// State-dependent help text for the Attended switch -- identical wording
// wherever the switch appears (per-row controls in list/grid view, and the
// Add Station dialog's own switch).
function attendedHelpText(attended: boolean) {
  return attended
    ? "On — a volunteer holds this tablet. It can also serve collection lists like meals and kits, because the volunteer sees the warning if someone has already collected."
    : "Off — this tablet is unattended. It can only serve registration check-in. Delegates use it themselves."
}

// State-dependent help text for the Print automatically switch -- same
// pattern as attendedHelpText above.
function autoPrintHelpText(autoPrint: boolean) {
  return autoPrint
    ? "On — the badge prints as soon as the delegate is checked in. Faster at a busy desk."
    : "Off — the volunteer taps Print. Use this if badges are checked before printing."
}

const PRINTER_USB_HELP_TEXT =
  "The printer must be plugged into this tablet by USB. A printer at another desk cannot be used from here."

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
// `border`/`topBorder` are both spelled out statically (rather than derived
// with a string replace at render time) so Tailwind's class scanner can see
// the full class names in source and include them in the build.
const STATUS_META: Record<KioskStationStatus, { dot: string; label: string; border: string; topBorder: string }> = {
  online: { dot: "bg-success", label: "text-success", border: "border-l-success", topBorder: "border-t-success" },
  quiet: { dot: "bg-warning", label: "text-warning", border: "border-l-warning", topBorder: "border-t-warning" },
  pending: { dot: "bg-info", label: "text-info", border: "border-l-info", topBorder: "border-t-info" },
  revoked: {
    dot: "bg-muted-foreground/40",
    label: "text-muted-foreground",
    border: "border-l-transparent",
    topBorder: "border-t-transparent",
  },
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

// Group ordering + section copy for the grouped list/grid views -- same
// "quiet first" priority as STATUS_RANK above, matches the mockup's
// GROUP_DEFS exactly. Deliberately distinct strings from
// STATION_STATUS_LABELS (which is the terse per-row/per-card status word).
const GROUP_ORDER: KioskStationStatus[] = ["quiet", "pending", "online", "revoked"]
const GROUP_LABELS: Record<KioskStationStatus, string> = {
  quiet: "Quiet — needs attention",
  pending: "Pending first check-in",
  online: "Active",
  revoked: "Revoked",
}

const CHIP_LIMIT = 2

// Shared "lists served by this station" popover -- used identically by the
// list-row and grid-card renderings of a single station, so reassigning a
// station's lists behaves exactly the same regardless of view.
//
// `options` already reflects assignableLists(station.attended) -- when the
// station isn't attended, collection-purpose lists are already filtered out
// before they ever reach this component. This component's own job is only
// to EXPLAIN that filtering (never to duplicate or override it): it groups
// the visible options under "Check-in" / "Collection" headers when attended,
// and surfaces a note + a real focus-jump to the Attended switch when not.
function StationListsPicker({
  station,
  lists,
  options,
  busy,
  onChange,
  onFocusAttended,
}: {
  station: KioskStation
  lists: CheckinList[]
  options: CheckinList[]
  busy: boolean
  onChange: (listIds: string[]) => void
  onFocusAttended: () => void
}) {
  const [open, setOpen] = useState(false)
  const listNames = station.list_ids.map((id) => lists.find((l) => l.id === id)?.name).filter(Boolean) as string[]
  const visibleChips = listNames.slice(0, CHIP_LIMIT)
  const moreCount = listNames.length - visibleChips.length
  const hasCollectionLists = lists.some((l) => l.is_active === true && l.list_purpose === "collection")

  const renderRow = (list: CheckinList) => {
    const checked = station.list_ids.includes(list.id)
    return (
      <label
        key={list.id}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
      >
        <Checkbox
          checked={checked}
          disabled={busy}
          onCheckedChange={(next) => {
            const nextIds = next
              ? [...station.list_ids, list.id]
              : station.list_ids.filter((id) => id !== list.id)
            if (nextIds.length === 0) {
              toast.error("A station needs at least one assigned list")
              return
            }
            onChange(nextIds)
          }}
        />
        <span className="flex-1 truncate">{list.name}</span>
      </label>
    )
  }

  const entryOptions = options.filter((l) => l.list_purpose !== "collection")
  const collectionOptions = options.filter((l) => l.list_purpose === "collection")

  return (
    <div className="min-w-0">
      <Popover open={open} onOpenChange={setOpen}>
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
            {station.attended ? (
              <>
                {entryOptions.length > 0 && (
                  <>
                    <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Check-in
                    </div>
                    {entryOptions.map(renderRow)}
                  </>
                )}
                {collectionOptions.length > 0 && (
                  <>
                    <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Collection — needs a volunteer watching
                    </div>
                    {collectionOptions.map(renderRow)}
                  </>
                )}
              </>
            ) : (
              options.map(renderRow)
            )}
          </div>
          {!station.attended && hasCollectionLists && (
            <p className="mt-2 border-t pt-2 text-[11px] leading-snug text-muted-foreground">
              Collection lists (meals, kits) are hidden because this station is not attended. Turn on{" "}
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                onClick={() => {
                  setOpen(false)
                  onFocusAttended()
                }}
              >
                &quot;Attended by a volunteer&quot;
              </button>{" "}
              to use them.
            </p>
          )}
        </PopoverContent>
      </Popover>
      {listNames.length >= 2 && (
        <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
          This tablet shows a menu so the volunteer picks which job they&apos;re doing.
        </p>
      )}
      {listNames.length === 1 && (
        <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
          With one list, the tablet goes straight to scanning — no menu.
        </p>
      )}
    </div>
  )
}

// Shared inline rename control -- identical click-to-edit behaviour in both
// the list row and the grid card.
function StationNameEditor({
  station,
  isRenaming,
  renameDraft,
  onDraftChange,
  renaming,
  onStart,
  onCancel,
  onSave,
}: {
  station: KioskStation
  isRenaming: boolean
  renameDraft: string
  onDraftChange: (value: string) => void
  renaming: boolean
  onStart: () => void
  onCancel: () => void
  onSave: () => void
}) {
  if (isRenaming) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          value={renameDraft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave()
            if (e.key === "Escape") onCancel()
          }}
          className="h-8 text-sm font-medium"
        />
        <Button size="sm" className="h-8 px-2.5" disabled={renaming} onClick={onSave}>
          Save
        </Button>
        <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={onCancel}>
          Esc
        </Button>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onStart}
      title="Rename station"
      className="group flex items-baseline gap-1.5 text-left"
    >
      <span className="truncate text-sm font-semibold">{station.name}</span>
      <Pencil className="h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-40" />
    </button>
  )
}

// Shared Attended / Print Station / Auto-print controls -- identical in both
// views; only the surrounding layout differs.
function StationBehaviourControls({
  station,
  revoked,
  usbPrintStations,
  attendedSwitchRef,
  onToggleAttended,
  onTogglePrint,
  onReassignPrintStation,
}: {
  station: KioskStation
  revoked: boolean
  usbPrintStations: PrintStation[]
  attendedSwitchRef?: (el: HTMLButtonElement | null) => void
  onToggleAttended: () => void
  onTogglePrint: () => void
  onReassignPrintStation: (printStationId: string) => void
}) {
  return (
    <div className="flex flex-col gap-2.5 text-xs">
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
          <Switch
            ref={attendedSwitchRef}
            checked={station.attended}
            disabled={revoked}
            onCheckedChange={onToggleAttended}
          />
          Attended by a volunteer
        </label>
        <p className="pl-[2.6rem] text-[10.5px] leading-snug text-muted-foreground/80">
          {attendedHelpText(station.attended)}
        </p>
      </div>
      {station.mode === "checkin_and_print" && (
        <>
          <div className="flex flex-col gap-1">
            <Select value={station.print_station_id ?? undefined} onValueChange={onReassignPrintStation}>
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
            <p className="text-[10.5px] leading-snug text-muted-foreground/80">{PRINTER_USB_HELP_TEXT}</p>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className={cn(
                "flex items-center gap-2 text-muted-foreground",
                station.print_station_id && !revoked ? "cursor-pointer" : "cursor-not-allowed opacity-60"
              )}
            >
              <Switch
                checked={station.auto_print_badge}
                disabled={revoked || !station.print_station_id}
                onCheckedChange={onTogglePrint}
              />
              Print automatically
            </label>
            <p className="pl-[2.6rem] text-[10.5px] leading-snug text-muted-foreground/80">
              {autoPrintHelpText(station.auto_print_badge)}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// Shared "New Token" + kebab menu -- identical set of actions in both views.
function StationActions({
  revoked,
  onRegenerate,
  onRename,
  onRevoke,
  onDelete,
}: {
  revoked: boolean
  onRegenerate: () => void
  onRename: () => void
  onRevoke: () => void
  onDelete: () => void
}) {
  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onRegenerate}>
        <RefreshCw className="h-3.5 w-3.5" />
        {revoked ? "Issue new link" : "New link"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="More actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={onRename}>Rename station</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
            Danger zone
          </DropdownMenuLabel>
          <DropdownMenuItem
            disabled={revoked}
            onClick={onRevoke}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            Revoke station
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            Delete station…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

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

  // List/grid view toggle + bulk selection -- all client-side, operating on
  // the already-filtered/searched `stations` array. No new fetch params.
  const [view, setView] = useState<"list" | "grid">("list")
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
  // handleAttendedSwitch/handleCreateAttendedSwitch below), only turning ON
  // gates through this dialog. One shared dialog/state serves both the
  // per-row switch (kind: "station") and the Add Station dialog's own switch
  // (kind: "create"), since the confirmation copy is identical either way.
  const [attendedConfirmTarget, setAttendedConfirmTarget] = useState<
    { kind: "station"; station: KioskStation } | { kind: "create" } | null
  >(null)
  const [attendedConfirmBusy, setAttendedConfirmBusy] = useState(false)

  // DOM refs to each row's Attended switch, keyed by station id -- lets the
  // "hidden collection lists" note inside StationListsPicker do a REAL focus
  // call (scrollIntoView + focus()) rather than just closing the popover.
  // Only one of list-view/grid-view is ever mounted at a time, so a single
  // ref per station id is enough regardless of which view is active.
  const attendedSwitchRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const newAttendedSwitchRef = useRef<HTMLButtonElement | null>(null)
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
  const focusCreateAttendedSwitch = () => {
    requestAnimationFrame(() => {
      newAttendedSwitchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      newAttendedSwitchRef.current?.focus()
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
      setAttendedConfirmTarget({ kind: "station", station })
    }
  }

  // Same asymmetric gating for the Add Station dialog's own Attended switch
  // -- turning it off is just local state, turning it on goes through the
  // same confirm dialog before newAttended actually flips.
  const handleCreateAttendedSwitch = (checked: boolean) => {
    if (!checked) {
      setNewAttended(false)
      return
    }
    setAttendedConfirmTarget({ kind: "create" })
  }

  const confirmAttendedOn = async () => {
    if (!attendedConfirmTarget) return
    if (attendedConfirmTarget.kind === "create") {
      setNewAttended(true)
      setAttendedConfirmTarget(null)
      return
    }
    setAttendedConfirmBusy(true)
    try {
      await performToggleAttended(attendedConfirmTarget.station, true)
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
  const hasCollectionLists = lists.some((l) => l.is_active === true && l.list_purpose === "collection")

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
        <Button onClick={() => setShowCreate(true)}>
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
          <Button onClick={() => setShowCreate(true)}>
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
          ) : view === "list" ? (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <div style={{ minWidth: "1100px" }}>
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
                    <div className="text-right">Actions</div>
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
                                  meta.dot,
                                  status === "online" && "animate-pulse"
                                )}
                              />
                              <div className="min-w-0">
                                <div
                                  className={cn("text-sm font-semibold leading-tight", meta.label)}
                                  title={STATUS_MEANINGS[status]}
                                >
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

                            {/* Check-in lists */}
                            <div className="min-w-0">
                              <StationListsPicker
                                station={station}
                                lists={lists}
                                options={assignableLists(station.attended)}
                                busy={reassigningStationId === station.id}
                                onChange={(ids) => handleReassignLists(station, ids)}
                                onFocusAttended={() => focusAttendedSwitch(station.id)}
                              />
                            </div>

                            {/* Behaviour: attended / print station / auto-print */}
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

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.stations.map((station) => {
                      const status = computeStationStatus(station)
                      const meta = STATUS_META[status]
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
                                meta.dot,
                                status === "online" && "animate-pulse"
                              )}
                            />
                            <span className={cn("text-sm font-semibold", meta.label)} title={STATUS_MEANINGS[status]}>
                              {STATION_STATUS_LABELS[status]}
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
              {!newAttended && hasCollectionLists && (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Collection lists (meals, kits) are hidden because this station is not attended. Turn on{" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                    onClick={focusCreateAttendedSwitch}
                  >
                    &quot;Attended by a volunteer&quot;
                  </button>{" "}
                  below to use them.
                </p>
              )}
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
                  <>
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
                    <p className="text-xs text-muted-foreground">{PRINTER_USB_HELP_TEXT}</p>
                  </>
                )}
              </div>
            )}

            <div className="divide-y rounded-lg border">
              <label className="flex items-center gap-3 p-3 cursor-pointer">
                <Switch ref={newAttendedSwitchRef} checked={newAttended} onCheckedChange={handleCreateAttendedSwitch} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Attended by a volunteer</span>
                  <span className="block text-xs text-muted-foreground">{attendedHelpText(newAttended)}</span>
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
                    <span className="block text-sm font-medium">Print automatically</span>
                    <span className="block text-xs text-muted-foreground">{autoPrintHelpText(newAutoPrint)}</span>
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

      {/* Attended-ON confirmation -- turning OFF applies immediately (see
          handleAttendedSwitch/handleCreateAttendedSwitch), only turning ON
          routes through here. Shared by the per-row switch and the Add
          Station dialog's own switch (attendedConfirmTarget.kind). */}
      <AlertDialog
        open={!!attendedConfirmTarget}
        onOpenChange={(open) => {
          if (!open) setAttendedConfirmTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn on attended mode?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                This lets the tablet serve collection lists — meals, kits, anything a delegate physically picks up.
              </span>
              <span className="mt-2 block">
                Only turn this on if a volunteer is holding the tablet at all times. On an unattended tablet, a
                delegate could scan twice and take two.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button disabled={attendedConfirmBusy} onClick={confirmAttendedOn}>
              {attendedConfirmBusy ? "Turning on…" : "Turn on"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
