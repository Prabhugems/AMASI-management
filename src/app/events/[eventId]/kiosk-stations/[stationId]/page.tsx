"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Clock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { computeStationStatus, STATION_STATUS_LABELS } from "@/lib/kiosk-station-status"
import {
  STATUS_META,
  relativeLastSeen,
  StationNameEditor,
  StationListsPicker,
  StationBehaviourControls,
  StationActions,
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

  const loadStation = async () => {
    const res = await fetch(`/api/kiosk-stations/${stationId}`)
    if (!res.ok) return
    setStation(await res.json())
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
      await Promise.all([
        loadStation(),
        fetch(`/api/checkin-lists?event_id=${eventId}`)
          .then((r) => r.json())
          .then((d) => setLists(d.lists || d || [])),
        fetch(`/api/print-stations?event_id=${eventId}`)
          .then((r) => r.json())
          .then((d) => setPrintStations(Array.isArray(d) ? d : [])),
        loadActivity(),
      ])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, stationId])

  function assignableLists(attended: boolean) {
    return lists.filter((l) => l.is_active === true && (attended || l.list_purpose !== "collection"))
  }
  const usbPrintStations = printStations.filter((p) => p?.print_settings?.printer_type === "usb")

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
      toast.success("New link issued")
      await loadStation()
    } finally {
      setRegenerateBusy(false)
    }
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

  if (loading || !station) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>
  }

  const revoked = !!station.revoked_at
  const status = computeStationStatus(station)

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8 space-y-8">
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
            <Clock className="h-3 w-3" />
            {revoked ? "Revoked" : relativeLastSeen(station.last_seen_at)}
          </div>
        </div>
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

      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Check-in lists</h2>
        <StationListsPicker
          station={station}
          lists={lists}
          options={assignableLists(station.attended)}
          busy={reassigning}
          onChange={handleReassignLists}
          onFocusAttended={() => {}}
        />
      </section>

      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Behaviour</h2>
        <StationBehaviourControls
          station={station}
          revoked={revoked}
          usbPrintStations={usbPrintStations}
          onToggleAttended={handleAttendedSwitch}
          onTogglePrint={handleToggleAutoPrint}
          onReassignPrintStation={handleReassignPrintStation}
        />
      </section>

      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {activity.map((item, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span>
                  {item.registration_name || "Unknown"} — {item.list_name || "Unknown list"}
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

      {/* Attended-ON confirm -- same copy as page.tsx's attendedConfirmTarget dialog */}
      <AlertDialog open={attendedConfirmOpen} onOpenChange={setAttendedConfirmOpen}>
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
