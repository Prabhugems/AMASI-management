"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { QrImage } from "@/components/QrImage"
import { toast } from "sonner"
import { Plus, Copy, RefreshCw, Ban, Trash2, Monitor } from "lucide-react"

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

  const handleRevoke = async (station: KioskStation) => {
    if (!confirm(`Revoke "${station.name}"'s access? The device will stop working until you generate a new token.`)) return
    const res = await fetch(`/api/kiosk-stations/${station.id}/access-token`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to revoke station")
      return
    }
    toast.success(`${station.name} revoked`)
    await loadStations()
  }

  const handleDelete = async (station: KioskStation) => {
    if (!confirm(`Delete "${station.name}"? This cannot be undone and will immediately stop this device from working.`)) return
    const res = await fetch(`/api/kiosk-stations/${station.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to delete station")
      return
    }
    toast.success(`${station.name} deleted`)
    await loadStations()
  }

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(stationUrl(token))
    toast.success("Link copied")
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
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
          {stations.map((station) => (
            <div key={station.id} className="border rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium flex items-center gap-2">
                  {station.name}
                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full border text-muted-foreground">
                    {station.mode === "checkin_and_print" ? "Check-in + Print" : "Check-in"}
                  </span>
                  {station.attended && (
                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full border text-muted-foreground">
                      Attended
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {station.list_ids.map((id) => lists.find((l) => l.id === id)?.name).filter(Boolean).join(", ") || "No list assigned"}
                  {" · "}
                  {station.revoked_at ? "Revoked" : relativeLastSeen(station.last_seen_at)}
                </p>
                {station.mode === "checkin_and_print" && (
                  <p className="text-xs text-muted-foreground">
                    {printStations.find((p) => p.id === station.print_station_id)?.name || "No print station assigned"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-xs max-w-52 justify-start truncate">
                      {station.list_ids.length > 0
                        ? station.list_ids.map((id) => lists.find((l) => l.id === id)?.name).filter(Boolean).join(", ")
                        : "No lists assigned"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 space-y-2">
                    {assignableLists(station.attended).map((list) => {
                      const checked = station.list_ids.includes(list.id)
                      return (
                        <label key={list.id} className="flex items-center gap-2 text-sm">
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
                          {list.name}
                        </label>
                      )
                    })}
                  </PopoverContent>
                </Popover>
                {station.mode === "checkin_and_print" && (
                  <>
                    <Select
                      value={station.print_station_id ?? undefined}
                      onValueChange={(value) => handleReassignPrintStation(station, value)}
                    >
                      <SelectTrigger className="w-40 h-9 text-xs">
                        <SelectValue placeholder="Change print station" />
                      </SelectTrigger>
                      <SelectContent>
                        {usbPrintStations.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => handleToggleAutoPrint(station)}>
                      Auto-print {station.auto_print_badge ? "on" : "off"}
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => handleToggleAttended(station)}>
                  Attended {station.attended ? "on" : "off"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleRegenerate(station)}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  New Token
                </Button>
                {!station.revoked_at && (
                  <Button variant="outline" size="sm" onClick={() => handleRevoke(station)}>
                    <Ban className="h-4 w-4 mr-1" />
                    Revoke
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleDelete(station)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Kiosk Station</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Front Desk Tablet" />
            </div>
            <div>
              <label className="text-sm font-medium">Check-in lists</label>
              <div className="mt-1.5 space-y-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
                {assignableLists(newAttended).map((list) => (
                  <label key={list.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newListIds.includes(list.id)}
                      onCheckedChange={(checked) =>
                        setNewListIds(checked ? [...newListIds, list.id] : newListIds.filter((id) => id !== list.id))
                      }
                    />
                    {list.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Mode</label>
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
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newAttended} onChange={(e) => setNewAttended(e.target.checked)} />
                Attended
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                A volunteer always operates this tablet — lets it serve collection-purpose lists (kits, meals) too, not just entry lists.
              </p>
            </div>
            {newMode === "checkin_and_print" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Print Station</label>
                  {usbPrintStations.length === 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">
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
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newAutoPrint} onChange={(e) => setNewAutoPrint(e.target.checked)} />
                  Auto-print badge on check-in
                </label>
                <p className="text-xs text-muted-foreground">
                  Requires an Android device with a directly-connected USB printer. Other devices will show check-in only, even if this station is configured for printing.
                </p>
              </div>
            )}
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || newListIds.length === 0 || (newMode === "checkin_and_print" && !newPrintStationId)}
              className="w-full"
            >
              Create Station
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
    </div>
  )
}
