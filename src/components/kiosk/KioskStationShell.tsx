"use client"

import { useState, useEffect, useCallback } from "react"
import * as Sentry from "@sentry/nextjs"
import { ClipboardList } from "lucide-react"
import { KioskCheckinScreen } from "./KioskCheckinScreen"
import { computeListState, minutesUntilClose, type ScheduledList } from "@/lib/kiosk-list-schedule"
import { cacheStationManifest, getStationManifest, replaceDelegateCache, type StationManifest } from "@/lib/kiosk-offline-store"
import { drainScanQueue } from "@/lib/kiosk-sync-worker"

export interface AssignedList extends ScheduledList {
  id: string
  name: string
}

interface KioskStationShellProps {
  eventId: string
  stationToken: string
  stationName: string
  mode: "checkin" | "checkin_and_print"
  printStationId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  badgeTemplate?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  printSettings?: any
  printMode?: string
  autoPrintBadge: boolean
  initialLists: AssignedList[]
}

function toAssignedLists(manifest: StationManifest): AssignedList[] {
  return manifest.lists.map((l) => ({
    id: l.id,
    name: l.name,
    kiosk_opens_at: l.kiosk_opens_at,
    kiosk_closes_at: l.kiosk_closes_at,
    kiosk_force_state: l.kiosk_force_state,
  }))
}

export function KioskStationShell({
  eventId,
  stationToken,
  stationName,
  mode,
  printStationId,
  badgeTemplate,
  printSettings,
  printMode,
  autoPrintBadge,
  initialLists,
}: KioskStationShellProps) {
  const [assignedLists, setAssignedLists] = useState<AssignedList[]>(initialLists)
  // A station with exactly one assigned list skips the menu entirely -- the
  // common case (most stations still serve one list) shouldn't cost an
  // extra tap just because the underlying model now supports many.
  const [activeListId, setActiveListIdRaw] = useState<string | null>(
    initialLists.length === 1 ? initialLists[0].id : null
  )
  // Tracks WHY activeListId is set to what it is: true when it was this
  // component's own "skip the menu" decision, false when a volunteer
  // deliberately tapped a tile. This is what lets the re-derivation effect
  // below tell "the manifest changed, reconsider" apart from "someone is
  // mid-task, do not yank them away" -- see that effect's comment.
  const [autoSelected, setAutoSelected] = useState(initialLists.length === 1)
  const selectList = useCallback((id: string | null, auto: boolean) => {
    setActiveListIdRaw(id)
    setAutoSelected(auto)
  }, [])
  const [tick, forceTick] = useState(0)

  const refreshManifest = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/kiosk/station-manifest?event_id=${encodeURIComponent(eventId)}&station_token=${encodeURIComponent(stationToken)}`
      )
      if (!res.ok) return
      const manifest = (await res.json()) as StationManifest
      setAssignedLists(toAssignedLists(manifest))
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
        if (cached && !cancelled) setAssignedLists(toAssignedLists(cached))
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          await drainScanQueue(list.id, eventId, stationToken, () => {}, () => {})
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

  const activeList = assignedLists.find((l) => l.id === activeListId) || null

  // Re-derive the "skip the menu" decision every time the manifest changes,
  // instead of deciding once at mount and sticking with it forever. Concrete
  // bug this closes: a station configured with exactly one list, then given
  // more lists later (e.g. mid-setup -- "spot a missing list, add it") kept
  // skipping straight to the original single list on any device that had
  // already loaded before the change, until its local caches were manually
  // cleared -- the manifest refresh updated `assignedLists` correctly the
  // whole time, but nothing ever revisited the resulting navigation choice.
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
    if (assignedLists.length === 1) {
      if (activeListId !== assignedLists[0].id) selectList(assignedLists[0].id, true)
    } else if (activeListId !== null) {
      selectList(null, false)
    }
  }, [assignedLists, activeListId, autoSelected, selectList])

  // At close time, return to the menu automatically -- don't require the
  // volunteer to notice and tap "Switch list". Driven by the same 30s tick
  // that recomputes closingSoonMinutes below, so this fires within 30s of
  // the schedule actually closing. This never interrupts a pending scan:
  // KioskCheckinScreen's enqueue already durably wrote to IndexedDB before
  // this effect can fire, and the shell's own drainScanQueue effect keeps
  // syncing every assigned list's queue regardless of which screen (or
  // none) is showing. (This one already re-checks continuously off the 30s
  // tick -- schedule state was never a "decide once" bug, only the
  // single-vs-menu list-count decision above was.)
  useEffect(() => {
    if (activeList && computeListState(activeList) === "closed") {
      selectList(null, false)
    }
    // `tick` is the effect's real trigger (the 30s schedule-recompute
    // heartbeat); `activeList` is included so a list switch or a fresh
    // manifest refresh is also re-checked immediately rather than waiting
    // for the next tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, activeList])

  if (activeList) {
    return (
      <KioskCheckinScreen
        key={activeList.id}
        eventId={eventId}
        listId={activeList.id}
        stationToken={stationToken}
        stationName={stationName}
        mode={mode}
        autoPrintBadge={autoPrintBadge}
        printStationId={printStationId}
        badgeTemplate={badgeTemplate}
        printSettings={printSettings}
        printMode={printMode}
        externallyDriven
        onSwitchList={() => selectList(null, false)}
        closingSoonMinutes={minutesUntilClose(activeList)}
        listClosesAt={activeList.kiosk_closes_at}
      />
    )
  }

  return (
    <KioskMenuScreen
      stationName={stationName}
      lists={assignedLists}
      onSelect={(list) => {
        if (computeListState(list) !== "open") return
        selectList(list.id, false)
      }}
    />
  )
}

function listSubline(list: AssignedList, now: Date): string {
  const state = computeListState(list, now)
  if (state === "closed") {
    if (list.kiosk_force_state === "closed") return "Closed"
    if (list.kiosk_opens_at && now < new Date(list.kiosk_opens_at)) {
      return `Opens ${new Date(list.kiosk_opens_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    }
    if (list.kiosk_closes_at) {
      return `Ended ${new Date(list.kiosk_closes_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    }
    return "Closed"
  }
  if (list.kiosk_closes_at) {
    return `Closes ${new Date(list.kiosk_closes_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
  }
  return "Open"
}

// Single default icon for every job tile: list NAMES are dynamic,
// admin-configured free text (not a fixed enum), so there's no reliable way
// to pattern-match a name like "Kit collection" or "Lunch" to a specific
// icon. One generic icon for every tile is simpler and correct for
// arbitrary names, matching this file's existing philosophy of never
// assuming specific list names.
function JobTile({
  list,
  now,
  open,
  onSelect,
}: {
  list: AssignedList
  now: Date
  open: boolean
  onSelect: (list: AssignedList) => void
}) {
  return (
    <button
      type="button"
      disabled={!open}
      onClick={() => onSelect(list)}
      className={`flex items-center gap-5 sm:gap-6 text-left transition-transform ${
        open
          ? "rounded-2xl sm:rounded-3xl bg-primary text-primary-foreground shadow-paper-lg px-6 sm:px-8 py-6 sm:py-7 hover:scale-[1.01] active:scale-[0.99]"
          : "rounded-2xl border border-border bg-muted/60 px-5 sm:px-7 py-4 sm:py-5 opacity-70 cursor-not-allowed"
      }`}
    >
      <span
        className={`flex-none rounded-full flex items-center justify-center ${
          open ? "size-16 sm:size-[76px] bg-white/20" : "size-12 sm:size-[60px] bg-muted"
        }`}
      >
        <ClipboardList
          className={open ? "size-8 sm:size-9" : "size-6 sm:size-7 text-muted-foreground"}
          strokeWidth={1.9}
        />
      </span>
      <span className="flex flex-col gap-1 min-w-0">
        <span
          className={`font-bold tracking-tight truncate ${
            open ? "text-2xl sm:text-4xl" : "text-xl sm:text-3xl text-muted-foreground"
          }`}
        >
          {list.name}
        </span>
        <span className={open ? "text-base sm:text-lg opacity-90" : "text-sm sm:text-base text-muted-foreground/80"}>
          {listSubline(list, now)}
        </span>
      </span>
    </button>
  )
}

function KioskMenuScreen({
  stationName,
  lists,
  onSelect,
}: {
  stationName: string
  lists: AssignedList[]
  onSelect: (list: AssignedList) => void
}) {
  // Live clock for the header chip -- this screen doesn't accept a `now`/
  // `tick` prop from the parent shell (KioskStationShell's own 30s tick
  // drives schedule recomputation, not this component), so it keeps its own
  // minimal state, updated once a minute (plenty for a clock display).
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

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

  const openLists = lists.filter((l) => computeListState(l, now) === "open")
  const closedLists = lists.filter((l) => computeListState(l, now) !== "open")
  // Design decision confirmed by the project owner: a station with few jobs
  // gets the mockup's 2-column grid (open tiles large and prominent, closed
  // jobs stacked in their own column); a station with many assigned lists
  // switches to a single-column list instead of producing cramped,
  // illegibly-small grid tiles.
  const useGrid = lists.length > 0 && lists.length <= 4
  const timeLabel = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="flex-1 flex flex-col px-6 sm:px-12 py-8 sm:py-10 gap-6 sm:gap-8 min-h-0 overflow-y-auto">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-1.5 min-w-0">
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground truncate">
              {stationName}
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
              What are you doing at this desk?
            </h1>
          </div>
          <div className="flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-card border border-border shadow-paper shrink-0">
            <span className="size-3 rounded-full bg-success" />
            <span className="text-lg font-semibold text-foreground">{timeLabel}</span>
          </div>
        </div>

        {lists.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-center text-muted-foreground text-base">No lists assigned to this station yet.</p>
          </div>
        )}

        {lists.length > 0 && useGrid && (
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5 min-h-0 items-stretch">
            {openLists.map((list) => (
              <JobTile key={list.id} list={list} now={now} open onSelect={onSelect} />
            ))}
            {closedLists.length > 0 && (
              <div className="flex flex-col gap-5">
                {closedLists.map((list) => (
                  <JobTile key={list.id} list={list} now={now} open={false} onSelect={onSelect} />
                ))}
              </div>
            )}
          </div>
        )}

        {lists.length > 0 && !useGrid && (
          <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
            {lists.map((list) => (
              <JobTile
                key={list.id}
                list={list}
                now={now}
                open={computeListState(list, now) === "open"}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-none h-24 sm:h-[104px] bg-sidebar text-sidebar-foreground flex items-center gap-6 sm:gap-8 px-6 sm:px-10">
        <div className="flex flex-col gap-0.5 w-[180px] sm:w-[220px] shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-sidebar-muted">Station</p>
          <p className="text-lg sm:text-xl font-semibold truncate">{stationName}</p>
        </div>
        <div className="flex-1 flex items-center gap-3 px-4 sm:px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-widest text-sidebar-muted shrink-0">List</span>
          <span className="text-xl sm:text-2xl font-bold text-sidebar-muted truncate">No job chosen yet</span>
        </div>
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full shrink-0 ${
            isOnline ? "bg-emerald-500/20" : "bg-amber-500/20"
          }`}
        >
          <span className={`size-3 rounded-full ${isOnline ? "bg-emerald-400" : "bg-amber-400"}`} />
          <span className="text-base sm:text-lg font-semibold">{isOnline ? "Online" : "Offline"}</span>
        </div>
      </div>
    </div>
  )
}
