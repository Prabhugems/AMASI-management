"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { ArrowLeft, Clock, Copy } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { computeStationStatus, STATION_STATUS_LABELS } from "@/lib/kiosk-station-status"
import {
  STATUS_META,
  relativeLastSeen,
  stationUrl,
  StationNameEditor,
  StationListsPicker,
  StationBehaviourControls,
  StationActions,
  AttendedOnConfirmDialog,
  type CheckinList,
  type PrintStation,
  type KioskStation,
} from "@/components/kiosk-admin/station-controls"

interface ActivityItem {
  type: "check_in" | "duplicate"
  registration_name: string | null
  registration_number: string | null
  list_name: string | null
  at: string
}

export default function KioskStationDetailPage() {
  const { eventId, stationId } = useParams<{ eventId: string; stationId: string }>()

  const [station, setStation] = useState<KioskStation | null>(null)
  const [lists, setLists] = useState<CheckinList[]>([])
  const [printStations, setPrintStations] = useState<PrintStation[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  // Tracks a non-ok response from the VERY FIRST station load (404
  // deleted/mistyped id, 400 bad UUID, 403 no permission) -- without this,
  // those all fell through to `!station` and rendered an infinite
  // "Loading..." spinner forever, since nothing ever set `station` and
  // nothing explained why. Any bookmarked or stale station URL would hang
  // silently.
  //
  // Deliberately NOT set by `loadStation()` itself -- every mutation handler
  // below (rename, reassign lists, toggle attended, reassign printer,
  // toggle auto-print, regenerate, revoke) calls `await loadStation()` as a
  // post-mutation refresh. If THAT refresh transiently fails (network blip,
  // a momentary 401/403, rate limit) after the initial load already
  // succeeded, the right behavior is to keep showing the working page with
  // its last-known-good `station` -- not to blank the entire UI. Only the
  // initial `load()` effect below is allowed to flip this to true, and only
  // when a station was never successfully loaded even once.
  const [initialLoadFailed, setInitialLoadFailed] = useState(false)

  // Returns whether the fetch succeeded, so callers can distinguish "this
  // was the first load and it failed" (fatal) from "this was a refresh and
  // it failed" (silently keep the stale-but-valid station).
  const loadStation = async (): Promise<boolean> => {
    const res = await fetch(`/api/kiosk-stations/${stationId}`)
    if (!res.ok) return false
    setStation(await res.json())
    return true
  }

  const loadActivity = async () => {
    const res = await fetch(`/api/kiosk-stations/${stationId}/activity`)
    if (!res.ok) return
    const data = await res.json()
    setActivity(data.activity || [])
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [stationLoaded] = await Promise.all([
        loadStation(),
        fetch(`/api/checkin-lists?event_id=${eventId}`)
          .then((r) => r.json())
          .then((d) => setLists(d.lists || d || [])),
        fetch(`/api/print-stations?event_id=${eventId}`)
          .then((r) => r.json())
          .then((d) => setPrintStations(Array.isArray(d) ? d : [])),
        loadActivity(),
      ])
      if (!stationLoaded) setInitialLoadFailed(true)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, stationId])

  function assignableLists(attended: boolean) {
    return lists.filter((l) => l.is_active === true && (attended || l.list_purpose !== "collection"))
  }
  const usbPrintStations = printStations.filter((p) => p?.print_settings?.printer_type === "usb")

  // Focus-jump target for StationListsPicker's "hidden collection lists"
  // note -- unlike the list page (where the Attended switch lives in a
  // different row/card and genuinely needs a scroll+focus jump), the
  // Behaviour section with the real switch is already on THIS page, so this
  // just scrolls/focuses it directly instead of being a no-op.
  const attendedSwitchRef = useRef<HTMLButtonElement | null>(null)
  const focusAttendedSwitch = () => {
    requestAnimationFrame(() => {
      attendedSwitchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      attendedSwitchRef.current?.focus()
    })
  }

  // Rename
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState("")
  const [renaming, setRenaming] = useState(false)
  const startRename = () => {
    if (!station) return
    setIsRenaming(true)
    setRenameDraft(station.name)
  }
  const cancelRename = () => setIsRenaming(false)
  const saveRename = async () => {
    if (!station) return
    const trimmed = renameDraft.trim()
    if (!trimmed || trimmed === station.name) {
      setIsRenaming(false)
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
      setIsRenaming(false)
      await loadStation()
    } finally {
      setRenaming(false)
    }
  }

  // Lists / attended / printer / auto-print
  const [reassigning, setReassigning] = useState(false)
  const handleReassignLists = async (listIds: string[]) => {
    if (!station) return
    setReassigning(true)
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
      await loadStation()
    } finally {
      setReassigning(false)
    }
  }

  const performToggleAttended = async (next: boolean) => {
    if (!station) return
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
    await loadStation()
  }
  const [attendedConfirmOpen, setAttendedConfirmOpen] = useState(false)
  const [attendedConfirmBusy, setAttendedConfirmBusy] = useState(false)
  const handleAttendedSwitch = () => {
    if (!station) return
    if (station.attended) {
      performToggleAttended(false)
    } else {
      setAttendedConfirmOpen(true)
    }
  }
  const confirmAttendedOn = async () => {
    setAttendedConfirmBusy(true)
    try {
      await performToggleAttended(true)
    } finally {
      setAttendedConfirmBusy(false)
      setAttendedConfirmOpen(false)
    }
  }

  const handleReassignPrintStation = async (printStationId: string) => {
    if (!station) return
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
    await loadStation()
  }

  const handleToggleAutoPrint = async () => {
    if (!station) return
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
    await loadStation()
  }

  // New link / Revoke / Delete
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false)
  const [regenerateBusy, setRegenerateBusy] = useState(false)
  // Hand-off modal -- the ONLY place the plaintext token is ever shown.
  // `POST .../access-token` returns `access_token` exactly once (GET
  // /api/kiosk-stations/[id] deliberately never selects it back), so it must
  // be captured here or it's gone forever -- matches the list page's
  // `handoff` state/dialog exactly.
  const [handoff, setHandoff] = useState<{ name: string; token: string } | null>(null)
  const performRegenerate = async () => {
    if (!station) return
    setRegenerateBusy(true)
    try {
      const res = await fetch(`/api/kiosk-stations/${station.id}/access-token`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to issue a new link")
        return
      }
      setRegenerateConfirmOpen(false)
      setHandoff({ name: station.name, token: data.access_token })
      await loadStation()
    } finally {
      setRegenerateBusy(false)
    }
  }
  const copyLink = (token: string) => {
    navigator.clipboard.writeText(stationUrl(token))
    toast.success("Link copied")
  }

  const [dangerAction, setDangerAction] = useState<"revoke" | "delete" | null>(null)
  const [dangerBusy, setDangerBusy] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const deleteConfirmSatisfied = dangerAction !== "delete" || deleteConfirmText.trim() === (station?.name ?? "").trim()

  const runDangerAction = async () => {
    if (!station || !dangerAction) return
    if (dangerAction === "delete" && !deleteConfirmSatisfied) return
    setDangerBusy(true)
    try {
      const res =
        dangerAction === "revoke"
          ? await fetch(`/api/kiosk-stations/${station.id}/access-token`, { method: "DELETE" })
          : await fetch(`/api/kiosk-stations/${station.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        toast.error(data.error || `Failed to ${dangerAction} station`)
        return
      }
      toast.success(`${station.name} ${dangerAction === "revoke" ? "revoked" : "deleted"}`)
      setDangerAction(null)
      setDeleteConfirmText("")
      if (dangerAction === "delete") {
        window.location.href = `/events/${eventId}/kiosk-stations`
      } else {
        await loadStation()
      }
    } finally {
      setDangerBusy(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>
  }

  if (initialLoadFailed || !station) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
        <Link
          href={`/events/${eventId}/kiosk-stations`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kiosk Stations
        </Link>
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card py-14 text-center">
          <p className="text-sm font-semibold">Station not found</p>
          <p className="max-w-md text-sm text-muted-foreground">
            It may have been deleted, or the link is incorrect. Go back to Kiosk Stations and pick it from the list.
          </p>
        </div>
      </div>
    )
  }

  const revoked = !!station.revoked_at
  const status = computeStationStatus(station)

  return (
    <div className="mx-auto max-w-6xl p-6 sm:p-8 space-y-6">
      <Link
        href={`/events/${eventId}/kiosk-stations`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kiosk Stations
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <StationNameEditor
            station={station}
            isRenaming={isRenaming}
            renameDraft={renameDraft}
            onDraftChange={setRenameDraft}
            renaming={renaming}
            onStart={startRename}
            onCancel={cancelRename}
            onSave={saveRename}
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", STATUS_META[status].dot)} />
            {STATION_STATUS_LABELS[status]}
            {/* Revoked already reads "Revoked" from the status label above --
                showing it again here (as the old `revoked ? "Revoked" : ...`
                fallback did) was redundant. Only show the clock/last-seen
                line when there's an actual last-seen to report. */}
            {!revoked && (
              <>
                <Clock className="h-3 w-3" />
                {relativeLastSeen(station.last_seen_at)}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <StationActions
            revoked={revoked}
            onRegenerate={() => setRegenerateConfirmOpen(true)}
            onRename={startRename}
            onRevoke={() => setDangerAction("revoke")}
            onDelete={() => {
              setDeleteConfirmText("")
              setDangerAction("delete")
            }}
          />
        </div>
      </div>

      {/* Settings (lists + behaviour) sit side-by-side with activity on wide
          screens instead of one narrow stacked column -- the page previously
          capped at max-w-3xl and stayed a single centered column regardless
          of viewport width, leaving most of a normal monitor empty. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <section className="space-y-3 rounded-xl border p-5">
            <h2 className="text-sm font-semibold">Check-in lists</h2>
            <StationListsPicker
              station={station}
              lists={lists}
              options={assignableLists(station.attended)}
              busy={reassigning}
              onChange={handleReassignLists}
              onFocusAttended={focusAttendedSwitch}
            />
          </section>

          <section className="space-y-3 rounded-xl border p-5">
            <h2 className="text-sm font-semibold">Behaviour</h2>
            <StationBehaviourControls
              station={station}
              revoked={revoked}
              usbPrintStations={usbPrintStations}
              attendedSwitchRef={(el) => {
                attendedSwitchRef.current = el
              }}
              onToggleAttended={handleAttendedSwitch}
              onTogglePrint={handleToggleAutoPrint}
              onReassignPrintStation={handleReassignPrintStation}
            />
          </section>
        </div>

        <section className="space-y-3 rounded-xl border p-5">
          <h2 className="text-sm font-semibold">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((item, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span>
                    {item.registration_name || "Unknown"}
                    {item.registration_number && (
                      <span className="text-muted-foreground"> ({item.registration_number})</span>
                    )}
                    {" — "}
                    {item.list_name || "Unknown list"}
                    {item.type === "duplicate" && (
                      <span className="ml-2 text-xs text-amber-600">already collected, turned away</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* New link confirm -- same copy as page.tsx's regenerateConfirmStation dialog */}
      <AlertDialog open={regenerateConfirmOpen} onOpenChange={setRegenerateConfirmOpen}>
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
            <Button disabled={regenerateBusy} onClick={performRegenerate}>
              {regenerateBusy ? "Issuing…" : "Issue new link"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hand-off modal -- the ONLY place the plaintext token is ever shown.
          Same content/copy as page.tsx's handoff dialog. */}
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

      <AttendedOnConfirmDialog
        open={attendedConfirmOpen}
        busy={attendedConfirmBusy}
        onOpenChange={setAttendedConfirmOpen}
        onConfirm={confirmAttendedOn}
      />

      {/* Revoke / Delete confirm -- same copy as page.tsx's confirmState dialog,
          simplified to the always-single-station case (no bulk here). */}
      <AlertDialog
        open={!!dangerAction}
        onOpenChange={(open) => {
          if (!open) {
            setDangerAction(null)
            setDeleteConfirmText("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dangerAction === "revoke" ? "Revoke this station?" : "Delete this station?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dangerAction === "revoke" ? (
                <>
                  <span className="block">
                    The tablet stops working right away. Use this if a tablet is lost or stolen. Any scans already
                    saved on it will be lost if it cannot get online again.
                  </span>
                  <span className="mt-2 block">The station keeps its settings — you can issue a new link later.</span>
                </>
              ) : (
                `${station.name} and its list assignments, printer link and sign-in link will be removed. Check-ins already recorded are kept.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dangerAction === "delete" && (
            <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <label className="text-sm font-medium">
                Type <strong>&quot;{station.name}&quot;</strong> to confirm:
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={station.name}
                className="border-destructive/50"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={dangerBusy || (dangerAction === "delete" && !deleteConfirmSatisfied)}
              onClick={runDangerAction}
            >
              {dangerAction === "revoke" ? "Revoke" : "Delete station"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
