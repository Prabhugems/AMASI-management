"use client"

import { useState, useEffect } from "react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { QrImage } from "@/components/QrImage"
import { toast } from "sonner"
import { Plus, Copy, RefreshCw, Ban, Trash2, Monitor } from "lucide-react"

type CheckinList = { id: string; name: string }
type KioskStation = {
  id: string
  event_id: string
  name: string
  mode: "checkin" | "print"
  list_id: string | null
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
  const [loading, setLoading] = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newListId, setNewListId] = useState("")
  const [creating, setCreating] = useState(false)

  // Hand-off modal: shows a freshly-minted plaintext token exactly once
  // (on create or regenerate) -- never re-fetchable afterward.
  const [handoff, setHandoff] = useState<{ name: string; token: string } | null>(null)

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
      ])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const handleCreate = async () => {
    if (!newName.trim() || !newListId) return
    setCreating(true)
    try {
      const res = await fetch("/api/kiosk-stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, name: newName.trim(), list_id: newListId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to create station")
        return
      }
      setShowCreate(false)
      setNewName("")
      setNewListId("")
      setHandoff({ name: data.name, token: data.access_token })
      await loadStations()
    } finally {
      setCreating(false)
    }
  }

  const handleRegenerate = async (station: KioskStation) => {
    const res = await fetch(`/api/kiosk-stations/${station.id}/access-token`, { method: "POST" })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to regenerate token")
      return
    }
    setHandoff({ name: station.name, token: data.access_token })
    await loadStations()
  }

  const handleRevoke = async (station: KioskStation) => {
    const res = await fetch(`/api/kiosk-stations/${station.id}/access-token`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to revoke station")
      return
    }
    toast.success(`${station.name} revoked`)
    await loadStations()
  }

  const handleDelete = async (station: KioskStation) => {
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
                <p className="font-medium">{station.name}</p>
                <p className="text-xs text-muted-foreground">
                  {lists.find((l) => l.id === station.list_id)?.name || "No list assigned"}
                  {" · "}
                  {station.revoked_at ? "Revoked" : relativeLastSeen(station.last_seen_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
              <label className="text-sm font-medium">Check-in list</label>
              <Select value={newListId} onValueChange={setNewListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={creating || !newName.trim() || !newListId} className="w-full">
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
