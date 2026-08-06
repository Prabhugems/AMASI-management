"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import * as Sentry from "@sentry/nextjs"
import { ClipboardList, Printer } from "lucide-react"
import { KioskCheckinScreen } from "./KioskCheckinScreen"
import { computeListState, minutesUntilClose, type ScheduledList } from "@/lib/kiosk-list-schedule"
import { cacheStationManifest, getStationManifest, replaceDelegateCache, type StationManifest } from "@/lib/kiosk-offline-store"
import { drainScanQueue } from "@/lib/kiosk-sync-worker"
import { CATEGORY_COLORS } from "@/lib/checkin-list-category"
import { useForceLightTheme } from "@/hooks/use-force-light-theme"
import { BatteryStatusBadge } from "@/components/kiosk/BatteryStatusBadge"

export interface AssignedList extends ScheduledList {
  id: string
  name: string
  list_purpose: string
  category: "entry_access" | "food_drink" | "goods_kits"
  prints_badge: boolean
}

interface KioskStationShellProps {
  eventId: string
  stationToken: string
  stationName: string
  mode: "checkin" | "checkin_and_print"
  // Whether a volunteer is staffing this tablet (kiosk_stations.attended).
  // Gates whether a collection-purpose list (Lunch, Kit Collection) is
  // offered on the menu at all -- see isListUsable below. The server already
  // enforces this independently on every check-in/roster request; this only
  // controls what the MENU offers, so a volunteer isn't sent into a scan
  // screen that can only ever fail.
  attended: boolean
  printStationId?: string
  badgeTemplate?: any
  printSettings?: any
  printMode?: string
  autoPrintBadge: boolean
  initialLists: AssignedList[]
  contactPhone?: string | null
}

function toAssignedLists(manifest: StationManifest): AssignedList[] {
  return manifest.lists.map((l) => ({
    id: l.id,
    name: l.name,
    list_purpose: l.list_purpose,
    category: l.category,
    prints_badge: l.prints_badge,
    kiosk_opens_at: l.kiosk_opens_at,
    kiosk_closes_at: l.kiosk_closes_at,
    kiosk_force_state: l.kiosk_force_state,
  }))
}

// A collection-purpose list (repeat scan means "do not issue again") is only
// ever safe to self-serve on a tablet a volunteer is actively holding -- see
// the attended-station gating already enforced server-side in
// /api/kiosk/checkin and /api/kiosk/delegates. This mirrors that same rule on
// the menu, so an unattended station never offers a tile that can only fail
// at the very last step (previously: the tile showed "Open" and was tappable
// regardless of `attended`, only failing once a volunteer had scanned a
// badge and hit "Self check-in isn't available for this list").
function isListUsable(list: AssignedList, attended: boolean, now: Date = new Date()): boolean {
  if (list.list_purpose === "collection" && !attended) return false
  return computeListState(list, now) === "open"
}

export function KioskStationShell({
  eventId,
  stationToken,
  stationName,
  mode,
  // Renamed at the destructure site (not `attended` directly) -- this is
  // only the SSR-time value. Everywhere else in this component reads the
  // reactive `attended` state declared below, which the manifest poll keeps
  // live. See that state's own comment for why the prop alone isn't enough.
  attended: initialAttended,
  printStationId,
  badgeTemplate,
  printSettings,
  printMode,
  autoPrintBadge,
  initialLists,
  contactPhone,
}: KioskStationShellProps) {
  // Shared kiosk tablets have no per-user theme preference and sit under
  // bright hall lighting -- see the hook for why this overrides the
  // site-wide dark default (work order §2.4). Covers the menu screen; the
  // active-job screen forces it again itself for the direct-URL path, which
  // never mounts this shell at all.
  useForceLightTheme()

  // Bug-audit fix (2026-08): the station-manifest poll has always returned a
  // live `attended` value (station-manifest/route.ts), and refreshManifest
  // below did fetch and cache it -- but this component only ever read the
  // SSR-time `initialAttended` prop, so an admin flipping Attended on/off
  // from the admin panel while a tablet was already running never reached
  // it. These are long-lived installed PWAs by design (CLAUDE.md documents
  // admins doing exactly this mid-event), so that gap could persist for
  // hours. Now kept live by refreshManifest, same as every list field.
  const [attended, setAttended] = useState(initialAttended)

  const [assignedLists, setAssignedLists] = useState<AssignedList[]>(initialLists)
  // A station with exactly one assigned USABLE list skips the menu entirely
  // -- the common case (most stations still serve one list) shouldn't cost
  // an extra tap just because the underlying model now supports many. A
  // sole list that's collection-purpose on an unattended station is NOT
  // usable, so it still shows the (one-tile) menu instead of dropping the
  // volunteer straight into a scan screen that can only fail.
  const [activeListId, setActiveListIdRaw] = useState<string | null>(
    initialLists.length === 1 && isListUsable(initialLists[0], attended) ? initialLists[0].id : null
  )
  // Tracks WHY activeListId is set to what it is: true when it was this
  // component's own "skip the menu" decision, false when a volunteer
  // deliberately tapped a tile. This is what lets the re-derivation effect
  // below tell "the manifest changed, reconsider" apart from "someone is
  // mid-task, do not yank them away" -- see that effect's comment.
  const [autoSelected, setAutoSelected] = useState(
    initialLists.length === 1 && isListUsable(initialLists[0], attended)
  )
  // True only between a volunteer tapping "Switch list"/"Wrong list?" and
  // their NEXT deliberate tile pick. Exists solely so the re-derivation
  // effect below can tell "the volunteer just asked to see the menu" apart
  // from "nothing has been picked yet" -- without it, requesting the menu
  // on a single-list station set activeListId back to null, which the
  // effect's own single-list auto-select branch immediately overwrote
  // before the menu ever rendered, making "Switch list" a no-op on any
  // station with exactly one (usable) list.
  const [menuRequested, setMenuRequested] = useState(false)
  // Event-wide "N checked in" per assigned list, shown as a menu-tile
  // subline. Purely informational -- never gates anything, so a stale or
  // missing entry just means that tile shows no count yet.
  const [listCounts, setListCounts] = useState<Record<string, number>>({})
  const selectList = useCallback((id: string | null, auto: boolean) => {
    setActiveListIdRaw(id)
    setAutoSelected(auto)
    if (id !== null) setMenuRequested(false)
  }, [])
  const requestMenu = useCallback(() => {
    setMenuRequested(true)
    selectList(null, false)
  }, [selectList])
  const [tick, forceTick] = useState(0)

  const refreshManifest = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/kiosk/station-manifest?event_id=${encodeURIComponent(eventId)}&station_token=${encodeURIComponent(stationToken)}`
      )
      if (!res.ok) return
      const manifest = (await res.json()) as StationManifest
      setAssignedLists(toAssignedLists(manifest))
      setAttended(manifest.attended)
      await cacheStationManifest(stationToken, manifest)
    } catch {
      // Offline/transient -- keep whatever's currently in state.
    }
  }, [eventId, stationToken])

  // Cold start: prefer the on-device cached manifest over the server-rendered
  // `initialLists` prop (which can be a stale service-worker-cached HTML
  // render -- see the existing /kiosk-station/ service worker coverage).
  // Then always attempt a live refresh, which wins if it succeeds.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cached = await getStationManifest(stationToken)
        if (cached && !cancelled) {
          setAssignedLists(toAssignedLists(cached))
          setAttended(cached.attended)
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { module: "kiosk-station-shell" } })
      }
      await refreshManifest()
    })()
    const interval = setInterval(refreshManifest, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [refreshManifest])

  // Cache every assigned list's roster at startup, independent of which one
  // is active -- a volunteer switching lists while offline must not find an
  // empty roster.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const list of assignedLists) {
        if (cancelled) return
        try {
          const res = await fetch(
            `/api/kiosk/delegates?event_id=${encodeURIComponent(eventId)}&station_token=${encodeURIComponent(stationToken)}&list_id=${encodeURIComponent(list.id)}`
          )
          if (!res.ok) continue
          const data = (await res.json()) as { delegates: unknown[] }
          if (cancelled) return
          await replaceDelegateCache(list.id, data.delegates as any)
        } catch {
          // Offline/transient -- that list's existing cached roster (if any)
          // stays in use; never blocks caching the remaining lists.
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, stationToken, assignedLists.map((l) => l.id).join(",")])

  // Shell owns draining every assigned list's scan queue -- a scan made on
  // list A that's still pending when the volunteer switches to list B must
  // still sync, even though KioskCheckinScreen unmounts on switch (see
  // KioskCheckinScreen's externallyDriven prop, which disables its own
  // per-list poll when rendered under this shell).
  useEffect(() => {
    let cancelled = false
    async function drainAll() {
      for (const list of assignedLists) {
        if (cancelled) return
        try {
          // A station-shell-owned station always authorizes via stationToken
          // -- there is no per-list access_token on this path (see
          // drainScanQueue's own param comment).
          await drainScanQueue(list.id, eventId, stationToken, undefined, () => {}, () => {})
        } catch (err) {
          Sentry.captureException(err, { tags: { module: "kiosk-station-shell" }, extra: { listId: list.id } })
        }
      }
    }
    if (typeof navigator !== "undefined" && navigator.onLine) void drainAll()
    window.addEventListener("online", drainAll)
    const pollId = setInterval(drainAll, 20000)
    return () => {
      cancelled = true
      window.removeEventListener("online", drainAll)
      clearInterval(pollId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, stationToken, assignedLists.map((l) => l.id).join(",")])

  // Recompute open/closed and the closing-soon banner every 30s -- both are
  // pure functions of the device clock, not of any fetched data.
  useEffect(() => {
    const intervalId = setInterval(() => forceTick((n) => n + 1), 30000)
    return () => clearInterval(intervalId)
  }, [])

  // Poll each assigned list's event-wide checked-in count on the same 30s
  // cadence, but only while the menu itself is showing -- a volunteer
  // mid-scan on a different screen doesn't need this, and it saves a request
  // during the far more common "actively checking people in" state. A fetch
  // failure here keeps whatever counts are already on screen rather than
  // clearing them -- see /api/kiosk/list-counts' own header comment.
  useEffect(() => {
    if (activeListId !== null || assignedLists.length === 0) return
    let cancelled = false
    const fetchCounts = async () => {
      try {
        const listIds = assignedLists.map((l) => l.id).join(",")
        const res = await fetch(
          `/api/kiosk/list-counts?event_id=${encodeURIComponent(eventId)}&station_token=${encodeURIComponent(stationToken)}&list_ids=${encodeURIComponent(listIds)}`
        )
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { counts: Record<string, number> }
        if (!cancelled) setListCounts(data.counts)
      } catch {
        // Offline/transient -- keep whatever counts are already displayed.
      }
    }
    void fetchCounts()
    const intervalId = setInterval(fetchCounts, 30000)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, stationToken, activeListId, assignedLists.map((l) => l.id).join(",")])

  const activeList = assignedLists.find((l) => l.id === activeListId) || null

  // Re-derive the "skip the menu" decision every time the manifest OR the
  // attended flag changes, instead of deciding once at mount and sticking
  // with it forever. Concrete bug this closes: a station configured with
  // exactly one list, then given more lists later (e.g. mid-setup -- "spot a
  // missing list, add it") kept skipping straight to the original single
  // list on any device that had already loaded before the change, until its
  // local caches were manually cleared -- the manifest refresh updated
  // `assignedLists` correctly the whole time, but nothing ever revisited the
  // resulting navigation choice. `attended` is included for the same reason:
  // an admin flipping Attended on/off changes whether the sole list is
  // usable at all, and that must be re-checked exactly like a list-count
  // change would be.
  useEffect(() => {
    if (activeListId !== null && !autoSelected) {
      // A volunteer's own deliberate pick: never auto-navigate them away
      // from it just because the manifest refreshed in the background --
      // EXCEPT when this specific list was removed from the station
      // entirely. That's not "something else changed", it's "this screen
      // is no longer valid" -- continuing to run check-in for a list this
      // station no longer serves would be actively wrong, so that one case
      // applies regardless of how the current list was chosen.
      if (!assignedLists.some((l) => l.id === activeListId)) {
        selectList(null, false)
      }
      return
    }
    if (assignedLists.length === 1 && isListUsable(assignedLists[0], attended) && !menuRequested) {
      if (activeListId !== assignedLists[0].id) selectList(assignedLists[0].id, true)
    } else if (activeListId !== null) {
      selectList(null, false)
    }
  }, [assignedLists, activeListId, autoSelected, attended, menuRequested, selectList])

  // At close time (schedule closed OR the station stopped being attended
  // while a collection list was active), return to the menu automatically --
  // don't require the volunteer to notice and tap "Switch list". Driven by
  // the same 30s tick that recomputes closingSoonMinutes below, so this
  // fires within 30s of the schedule actually closing. This never interrupts
  // a pending scan: KioskCheckinScreen's enqueue already durably wrote to
  // IndexedDB before this effect can fire, and the shell's own
  // drainScanQueue effect keeps syncing every assigned list's queue
  // regardless of which screen (or none) is showing. (This one already
  // re-checks continuously off the 30s tick -- schedule state was never a
  // "decide once" bug, only the single-vs-menu list-count decision above
  // was.)
  useEffect(() => {
    if (activeList && !isListUsable(activeList, attended)) {
      selectList(null, false)
    }
    // `tick` is the effect's real trigger (the 30s schedule-recompute
    // heartbeat); `activeList`/`attended` are included so a list switch, a
    // fresh manifest refresh, or an attended-flag change is also re-checked
    // immediately rather than waiting for the next tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, activeList, attended])

  if (activeList) {
    // Printing is a property of the LIST, not the station -- a
    // checkin_and_print station only actually shows print controls on
    // lists an admin has explicitly flagged. Every other list on the same
    // station (e.g. Lunch, Kit Collection) behaves as checkin-only, even
    // though the station's printer hardware is fully configured.
    const effectiveMode = mode === "checkin_and_print" && activeList.prints_badge ? "checkin_and_print" : "checkin"
    return (
      <KioskCheckinScreen
        key={activeList.id}
        eventId={eventId}
        listId={activeList.id}
        stationToken={stationToken}
        stationName={stationName}
        mode={effectiveMode}
        autoPrintBadge={autoPrintBadge}
        printStationId={printStationId}
        badgeTemplate={badgeTemplate}
        printSettings={printSettings}
        printMode={printMode}
        contactPhone={contactPhone}
        externallyDriven
        onSwitchList={requestMenu}
        closingSoonMinutes={minutesUntilClose(activeList)}
        listClosesAt={activeList.kiosk_closes_at}
        category={activeList.category}
      />
    )
  }

  return (
    <KioskMenuScreen
      stationName={stationName}
      stationToken={stationToken}
      lists={assignedLists}
      attended={attended}
      listCounts={listCounts}
      mode={mode}
      onSelect={(list) => {
        if (!isListUsable(list, attended)) return
        selectList(list.id, false)
      }}
      // Recomputed fresh on every render -- this component already re-renders
      // at least every 30s via the `tick` state below (see that effect's
      // comment), so this stays in sync with the exact same cadence every
      // other schedule computation in this file already uses.
      now={new Date()}
    />
  )
}

function listSubline(list: AssignedList, attended: boolean, now: Date, count?: number): string {
  // Checked first: a collection-purpose list on an unattended station is
  // never usable regardless of its schedule -- this takes priority over the
  // open/closed schedule copy below so the tile always explains the REAL
  // reason it can't be tapped, not a misleading "Open" while still disabled.
  if (list.list_purpose === "collection" && !attended) return "Needs a volunteer watching"
  const state = computeListState(list, now)
  const countSuffix = count === undefined ? "" : ` · ${count.toLocaleString()} checked in`
  if (state === "closed") {
    if (list.kiosk_force_state === "closed") return `Closed${countSuffix}`
    if (list.kiosk_opens_at && now < new Date(list.kiosk_opens_at)) {
      return `Opens ${new Date(list.kiosk_opens_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${countSuffix}`
    }
    if (list.kiosk_closes_at) {
      return `Ended ${new Date(list.kiosk_closes_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${countSuffix}`
    }
    return `Closed${countSuffix}`
  }
  if (list.kiosk_closes_at) {
    return `Closes ${new Date(list.kiosk_closes_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${countSuffix}`
  }
  return `Open${countSuffix}`
}

// Single default icon for every job tile: list NAMES are dynamic,
// admin-configured free text (not a fixed enum), so there's no reliable way
// to pattern-match a name like "Kit collection" or "Lunch" to a specific
// icon. One generic icon for every tile is simpler and correct for
// arbitrary names, matching this file's existing philosophy of never
// assuming specific list names. One exception: a printer icon is shown when
// mode === "checkin_and_print" && list.prints_badge, driven by that flag
// rather than the list's name, so it doesn't conflict with this reasoning.
// Row height every tile clamps to -- kept in sync by eye with the fixed
// TILE_ROW_HEIGHT_PX constant SwipePager's capacity math assumes (see that
// comment). cqh is relative to the kiosk-root's container box (§2 of the
// Kiosk Screen Layout Spec), so this scales with the actual device instead
// of a fixed breakpoint.
function JobTile({
  list,
  now,
  attended,
  open,
  count,
  mode,
  onSelect,
}: {
  list: AssignedList
  now: Date
  attended: boolean
  open: boolean
  count?: number
  mode: "checkin" | "checkin_and_print"
  onSelect: (list: AssignedList) => void
}) {
  // Same padding/icon/text sizing whether open or closed (only colour,
  // opacity, and cursor differ) -- every tile in a mixed open/closed row is
  // naturally the same height as its neighbour instead of the open tiles'
  // larger padding making them taller. min-h clamp keeps every tile's
  // rendered height within the range SwipePager's page-capacity math
  // assumes (see TILE_ROW_HEIGHT_PX below).
  return (
    <button
      type="button"
      disabled={!open}
      onClick={() => onSelect(list)}
      className={`flex items-center gap-[clamp(10px,2cqw,16px)] text-left transition-transform min-h-[clamp(56px,9cqh,92px)] ${
        open
          ? "rounded-xl sm:rounded-2xl bg-primary text-primary-foreground shadow-paper px-[clamp(12px,2.5cqw,20px)] py-[clamp(8px,1.5cqh,14px)] hover:scale-[1.01] active:scale-[0.99]"
          : "rounded-xl border border-border bg-muted/60 px-[clamp(12px,2.5cqw,20px)] py-[clamp(8px,1.5cqh,14px)] opacity-70 cursor-not-allowed"
      }`}
    >
      <span
        className={`flex-none rounded-full flex items-center justify-center text-white size-[clamp(36px,6cqh,48px)] ${
          open ? CATEGORY_COLORS[list.category].solid : "bg-muted"
        }`}
      >
        {mode === "checkin_and_print" && list.prints_badge ? (
          <Printer
            className={open ? "size-[clamp(16px,3cqh,24px)]" : "size-[clamp(16px,3cqh,24px)] text-muted-foreground"}
            strokeWidth={1.9}
          />
        ) : (
          <ClipboardList
            className={open ? "size-[clamp(16px,3cqh,24px)]" : "size-[clamp(16px,3cqh,24px)] text-muted-foreground"}
            strokeWidth={1.9}
          />
        )}
      </span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span
          className={`font-bold tracking-tight truncate text-[clamp(14px,3cqh,24px)] ${
            open ? "" : "text-muted-foreground"
          }`}
        >
          {list.name}
        </span>
        <span
          className={`text-[clamp(11px,1.7cqh,14px)] ${open ? "opacity-90" : "text-muted-foreground/80"}`}
        >
          {listSubline(list, attended, now, count)}
        </span>
      </span>
    </button>
  )
}

// Conservative fixed estimate of a rendered JobTile's height in px, used
// only to decide how many tiles fit on one page before the CSS above has
// actually rendered anything (chicken-and-egg: page count is needed to
// build the pages array in the first place). Deliberately the tile's own
// clamp() UPPER bound, not an average -- underestimating capacity (more
// pages, never truncated ones) is the only safe direction to be wrong in
// this room; overestimating would clip a tile under the content region's
// overflow-hidden.
const TILE_ROW_HEIGHT_PX = 92
const TILE_GAP_PX = 12

// Computes how many JobTiles fit in the visible content region -- no
// scrolling, no admin-configured screen-size picker (Kiosk Screen Layout
// Spec §1.5) -- by measuring the actual box via ResizeObserver and
// recomputing live on resize/orientation change. Single-column only: each
// SwipePager page renders its tiles in one vertical stack (the list-mode
// design this replaces was already single-column, see the `!useGrid`
// branch below), so capacity is purely a row count, never a column
// multiplier -- an earlier version of this function assumed a 2-column
// grid here while the actual render stayed single-column, which
// overestimated capacity and clipped tiles under the content region's
// overflow-hidden instead of paginating them.
function useTilePageCapacity() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [capacity, setCapacity] = useState(6)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const compute = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const rows = Math.max(1, Math.floor((rect.height + TILE_GAP_PX) / (TILE_ROW_HEIGHT_PX + TILE_GAP_PX)))
      setCapacity(rows)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, capacity }
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0 || items.length === 0) return items.length ? [items] : []
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size))
  return pages
}

// Horizontal swipe pagination via native CSS scroll-snap -- gives swipe
// gestures, momentum, and paging for free with no gesture library (Kiosk
// Screen Layout Spec §4). Dots, not arrows: dots communicate "there's more"
// at a glance without needing to be a precise tap target.
function SwipePager<T>({
  pages,
  renderPage,
}: {
  pages: T[][]
  renderPage: (page: T[], pageIndex: number) => React.ReactNode
}) {
  const pagerRef = useRef<HTMLDivElement | null>(null)
  const [activePage, setActivePage] = useState(0)
  useEffect(() => {
    const el = pagerRef.current
    if (!el) return
    const onScroll = () => {
      setActivePage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])
  return (
    <div className="h-full flex flex-col gap-[clamp(4px,1cqh,10px)]">
      <div
        ref={pagerRef}
        className="flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar"
      >
        {pages.map((page, i) => (
          <div
            key={i}
            className="flex-none w-full h-full snap-start overflow-hidden flex flex-col gap-[clamp(8px,1.5cqh,16px)]"
          >
            {renderPage(page, i)}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="flex-none flex items-center justify-center gap-2">
          {pages.map((_, i) => (
            <span
              key={i}
              className={`rounded-full transition-all ${
                i === activePage ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function KioskMenuScreen({
  stationName,
  stationToken,
  lists,
  attended,
  listCounts,
  mode,
  onSelect,
  now,
}: {
  stationName: string
  stationToken: string
  lists: AssignedList[]
  attended: boolean
  listCounts: Record<string, number>
  mode: "checkin" | "checkin_and_print"
  onSelect: (list: AssignedList) => void
  // Bug-audit fix (2026-08): this screen used to keep its own independent
  // 60s clock, driving BOTH the header chip AND which tiles render as open
  // vs closed -- lagging the parent shell's own 30s schedule-recompute tick
  // (used everywhere else in this file for the identical computation) by up
  // to a full minute at a schedule boundary. A list due to open at 12:00:00
  // could still render disabled/un-tappable until 12:00:59, and the reverse
  // case (still shown open after actually closing) failed silently -- the
  // real click handler re-checks with a fresh Date and just no-ops. Now
  // driven by the parent's own tick, so both screens agree within the same
  // 30s window instead of two independently-drifting timers.
  now: Date
}) {
  // Real online/offline signal, mirroring the exact pattern already used in
  // KioskCheckinScreen.tsx (display-only, cheap, no new plumbing) -- no list
  // is active yet on this screen, so there's no sync queue to report on.
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const openLists = lists.filter((l) => isListUsable(l, attended, now))
  const closedLists = lists.filter((l) => !isListUsable(l, attended, now))
  // Design decision confirmed by the project owner: a station with few jobs
  // gets the mockup's 2-column grid (open tiles large and prominent, closed
  // jobs stacked in their own column); a station with many assigned lists
  // switches to a single-column list instead of producing cramped,
  // illegibly-small grid tiles.
  const useGrid = lists.length > 0 && lists.length <= 4
  const timeLabel = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

  // Most-used-first rule (Kiosk Screen Layout Spec §4): open (usable right
  // now) jobs always precede closed ones, so if the full set doesn't fit on
  // one page, it's the closed/long-tail jobs that get pushed to a swipe,
  // never the ones a volunteer actually needs this minute.
  const orderedLists = useMemo(() => [...openLists, ...closedLists], [openLists, closedLists])
  const { ref: pagerContentRef, capacity } = useTilePageCapacity()
  const pages = useMemo(() => chunk(orderedLists, capacity), [orderedLists, capacity])

  return (
    <div className="h-dvh w-dvw overflow-hidden kiosk-scope bg-background flex flex-col [container-type:size]">
      <div className="flex-none flex flex-col px-[clamp(16px,4cqw,48px)] pt-[clamp(16px,3cqh,40px)] pb-[clamp(8px,1.5cqh,16px)] gap-[clamp(8px,1.5cqh,16px)]">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-1.5 min-w-0">
            <p className="text-[clamp(11px,1.6cqh,14px)] font-semibold uppercase tracking-widest text-muted-foreground truncate">
              {stationName}
            </p>
            <h1 className="text-[clamp(20px,4.4cqh,48px)] font-bold tracking-tight text-foreground">
              What are you doing at this desk?
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-2.5 px-[clamp(12px,2cqw,20px)] py-[clamp(8px,1.5cqh,14px)] rounded-full bg-card border border-border shadow-paper">
              <span className="size-3 rounded-full bg-success" />
              <span className="text-[clamp(13px,2cqh,18px)] font-semibold text-foreground">{timeLabel}</span>
            </div>
            {/* Deliberately small and low-emphasis -- for the admin setting
                up this tablet before it ships, never a job a volunteer would
                mistake for a tile (work order §10).
                A real plain <a> here was a genuine hardware-testing bug
                (found live, 2026-08): it forces a full browser page reload,
                which tears down the WebUSB printer connection's JS session
                without ever calling device.close() -- leaving the OS
                thinking the interface is still claimed, so the next connect
                attempt (on this page or back on the main screen) fails with
                "Unable to claim interface". Link keeps this a client-side
                transition in the same tab, so the live USB handle survives
                the navigation. */}
            <Link
              href={`/kiosk-station/${stationToken}/self-test`}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Station self-test
            </Link>
          </div>
        </div>
      </div>

      <div
        ref={pagerContentRef}
        className="flex-1 min-h-0 overflow-hidden px-[clamp(16px,4cqw,48px)] pb-[clamp(8px,1.5cqh,16px)]"
      >
        {lists.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-center text-muted-foreground text-base">No lists assigned to this station yet.</p>
          </div>
        )}

        {lists.length > 0 && useGrid && (
          <div className="h-full grid grid-cols-1 sm:grid-cols-2 gap-[clamp(8px,1.5cqh,16px)] items-stretch content-start">
            {openLists.map((list) => (
              <JobTile
                key={list.id}
                list={list}
                now={now}
                attended={attended}
                open
                count={listCounts[list.id]}
                mode={mode}
                onSelect={onSelect}
              />
            ))}
            {closedLists.length > 0 && (
              <div className="flex flex-col gap-[clamp(8px,1.5cqh,16px)]">
                {closedLists.map((list) => (
                  <JobTile
                    key={list.id}
                    list={list}
                    now={now}
                    attended={attended}
                    open={false}
                    count={listCounts[list.id]}
                    mode={mode}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {lists.length > 0 && !useGrid && (
          <SwipePager
            pages={pages}
            renderPage={(page) => (
              <>
                {page.map((list) => (
                  <JobTile
                    key={list.id}
                    list={list}
                    now={now}
                    attended={attended}
                    open={isListUsable(list, attended, now)}
                    count={listCounts[list.id]}
                    mode={mode}
                    onSelect={onSelect}
                  />
                ))}
              </>
            )}
          />
        )}
      </div>

      <div className="flex-none h-[clamp(56px,11cqh,104px)] bg-sidebar text-sidebar-foreground flex items-center gap-[clamp(12px,2cqw,32px)] px-[clamp(16px,3cqw,40px)]">
        <div className="flex flex-col gap-0.5 w-[clamp(120px,18cqw,220px)] shrink-0">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-sidebar-muted">Station</p>
          <p className="text-[clamp(13px,2.2cqh,20px)] font-semibold truncate">{stationName}</p>
        </div>
        <div className="flex-1 flex items-center gap-3 px-[clamp(10px,1.8cqw,20px)] py-[clamp(6px,1.2cqh,10px)] rounded-xl bg-white/10 border border-white/20 min-w-0">
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-sidebar-muted shrink-0">
            List
          </span>
          <span className="text-[clamp(15px,2.6cqh,24px)] font-bold text-sidebar-muted truncate">
            No job chosen yet
          </span>
        </div>
        <div
          className={`flex items-center gap-2 px-[clamp(10px,1.6cqw,16px)] py-[clamp(6px,1.2cqh,10px)] rounded-full shrink-0 ${
            isOnline ? "bg-emerald-500/20" : "bg-amber-500/20"
          }`}
        >
          <span className={`size-3 rounded-full ${isOnline ? "bg-emerald-400" : "bg-amber-400"}`} />
          <span className="text-[clamp(13px,1.8cqh,18px)] font-semibold">{isOnline ? "Online" : "Offline"}</span>
        </div>
        <BatteryStatusBadge className="text-sidebar-muted text-sm sm:text-base shrink-0" />
      </div>
    </div>
  )
}
