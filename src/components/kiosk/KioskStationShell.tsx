"use client"

import { useState, useEffect, useCallback } from "react"
import * as Sentry from "@sentry/nextjs"
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
  const [activeListId, setActiveListId] = useState<string | null>(
    initialLists.length === 1 ? initialLists[0].id : null
  )
  const [, forceTick] = useState(0)

  const refreshManifest = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/kiosk/station-manifest?event_id=${encodeURIComponent(eventId)}&station_token=${encodeURIComponent(stationToken)}`
      )
      if (!res.ok) return
      const manifest = (await res.json()) as StationManifest
      setAssignedLists(toAssignedLists(manifest))
      await cacheStationManifest(manifest)
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
        const cached = await getStationManifest()
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
    const tick = setInterval(() => forceTick((n) => n + 1), 30000)
    return () => clearInterval(tick)
  }, [])

  const activeList = assignedLists.find((l) => l.id === activeListId) || null

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
        onSwitchList={() => setActiveListId(null)}
        closingSoonMinutes={minutesUntilClose(activeList)}
      />
    )
  }

  return (
    <KioskMenuScreen
      stationName={stationName}
      lists={assignedLists}
      onSelect={(list) => {
        if (computeListState(list) !== "open") return
        setActiveListId(list.id)
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

function KioskMenuScreen({
  stationName,
  lists,
  onSelect,
}: {
  stationName: string
  lists: AssignedList[]
  onSelect: (list: AssignedList) => void
}) {
  const now = new Date()
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <div className="bg-gray-800/50 border-b border-white/10 px-4 sm:px-8 py-4 sm:py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">{stationName}</h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">Choose what you&apos;re here for</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-xl mx-auto space-y-3">
          {lists.length === 0 && (
            <p className="text-center text-gray-400 text-sm">No lists assigned to this station yet.</p>
          )}
          {lists.map((list) => {
            const open = computeListState(list, now) === "open"
            return (
              <button
                key={list.id}
                type="button"
                disabled={!open}
                onClick={() => onSelect(list)}
                className={`w-full text-left rounded-2xl border-2 p-5 transition-all flex items-center justify-between gap-4 ${
                  open
                    ? "border-white/10 bg-gray-800/50 hover:border-emerald-500/50"
                    : "border-white/5 bg-gray-900/50 opacity-60 cursor-not-allowed"
                }`}
              >
                <span className="text-lg font-semibold text-white">{list.name}</span>
                <span className={`text-xs font-medium shrink-0 ${open ? "text-emerald-400" : "text-gray-500"}`}>
                  {listSubline(list, now)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
