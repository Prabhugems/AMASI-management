"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pencil, RefreshCw, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { type KioskStationStatus } from "@/lib/kiosk-station-status"

// Admin-facing meaning of each status, worded for someone who has never seen
// this system before (no "heartbeat", no "token"). Used both as the footer
// legend and as hover-title text on every rendered status label.
export const STATUS_MEANINGS: Record<KioskStationStatus, string> = {
  pending: "Set up here, but the link has never been opened on a tablet yet.",
  online: "The tablet checked in with us within the last 15 minutes.",
  quiet:
    "No contact for over 15 minutes. The tablet may be asleep, out of signal, or closed. It is not necessarily broken, and any scans it takes offline will still arrive.",
  revoked: "This tablet has been cut off. It stops working immediately.",
}

// State-dependent help text for the Attended switch -- identical wording
// wherever the switch appears (per-row controls in list/grid view, and the
// Add Station dialog's own switch).
export function attendedHelpText(attended: boolean) {
  return attended
    ? "On — a volunteer holds this tablet. It can also serve collection lists like meals and kits, because the volunteer sees the warning if someone has already collected."
    : "Off — this tablet is unattended. It can only serve registration check-in. Delegates use it themselves."
}

// State-dependent help text for the Print automatically switch -- same
// pattern as attendedHelpText above.
export function autoPrintHelpText(autoPrint: boolean) {
  return autoPrint
    ? "On — the badge prints as soon as the delegate is checked in. Faster at a busy desk."
    : "Off — the volunteer taps Print. Use this if badges are checked before printing."
}

export const PRINTER_USB_HELP_TEXT =
  "The printer must be plugged into this tablet by USB. A printer at another desk cannot be used from here."

export type CheckinList = { id: string; name: string; is_active?: boolean; list_purpose?: string }
export type PrintStation = { id: string; name: string; print_settings?: { printer_type?: string } }
export type KioskStation = {
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

export function stationUrl(token: string) {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/kiosk-station/${token}`
}

export function relativeLastSeen(iso: string | null) {
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
export const STATUS_META: Record<KioskStationStatus, { dot: string; label: string; border: string; topBorder: string }> = {
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
export const STATUS_FILTERS: { key: "all" | "online" | "quiet" | "revoked"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "online", label: "Active" },
  { key: "quiet", label: "Quiet" },
  { key: "revoked", label: "Revoked" },
]

// Attention-first sort: a volunteer's tablet that's gone quiet should never
// be buried at the bottom of a long list. Matches the mockup's RANK table.
export const STATUS_RANK: Record<KioskStationStatus, number> = { quiet: 0, pending: 1, online: 2, revoked: 3 }

// Group ordering + section copy for the grouped list/grid views -- same
// "quiet first" priority as STATUS_RANK above, matches the mockup's
// GROUP_DEFS exactly. Deliberately distinct strings from
// STATION_STATUS_LABELS (which is the terse per-row/per-card status word).
export const GROUP_ORDER: KioskStationStatus[] = ["quiet", "pending", "online", "revoked"]
export const GROUP_LABELS: Record<KioskStationStatus, string> = {
  quiet: "Quiet — needs attention",
  pending: "Pending first check-in",
  online: "Active",
  revoked: "Revoked",
}

export const CHIP_LIMIT = 2

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
export function StationListsPicker({
  station,
  lists,
  options,
  counts,
  busy,
  onChange,
  onFocusAttended,
}: {
  station: KioskStation
  lists: CheckinList[]
  options: CheckinList[]
  counts?: Record<string, number>
  busy: boolean
  onChange: (listIds: string[]) => void
  onFocusAttended: () => void
}) {
  const [open, setOpen] = useState(false)
  const listNames = station.list_ids
    .map((id) => {
      const list = lists.find((l) => l.id === id)
      if (!list) return null
      return counts?.[id] !== undefined ? `${list.name} · ${counts[id]}` : list.name
    })
    .filter(Boolean) as string[]
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
export function StationNameEditor({
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
export function StationBehaviourControls({
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

// One-line, read-only summary for the compact list-view row -- editing
// happens on the station's own detail page now, not inline in the list.
export function StationBehaviourSummary({
  station,
  printStationName,
}: {
  station: KioskStation
  printStationName: string | null
}) {
  const parts = [station.attended ? "Attended" : "Unattended"]
  if (station.mode === "checkin_and_print") {
    parts.push(station.auto_print_badge ? "Auto-print" : "Manual print")
    if (printStationName) parts.push(printStationName)
  }
  return <span className="truncate text-xs text-muted-foreground">{parts.join(" · ")}</span>
}

// Shared "New Token" + kebab menu -- identical set of actions in both views.
export function StationActions({
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
