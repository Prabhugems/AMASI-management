"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  List,
  Loader2,
  Plus,
  Trash2,
  CheckCircle,
  QrCode,
  Monitor,
  Coffee,
  UtensilsCrossed,
  Utensils,
  CalendarDays,
  Users,
  Save,
  Clock,
  Ticket,
  ChevronRight,
  Package,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type CheckinList = {
  id: string
  name: string
  description?: string
  is_active: boolean
  list_purpose: "entry" | "collection"
  prints_badge: boolean
  ticket_type_ids?: string[]
  addon_ids?: string[]
  starts_at?: string
  ends_at?: string
  kiosk_opens_at?: string
  kiosk_closes_at?: string
  kiosk_force_state?: "open" | "closed" | null
  created_at: string
  access_token?: string
}

type TicketType = {
  id: string
  name: string
}

type Addon = {
  id: string
  name: string
}

// Local copies of the same conversion helpers used by
// src/app/events/[eventId]/tickets/discounts/page.tsx for `valid_until` --
// NOT exported from there, small per-page duplication is this codebase's
// existing tolerance (see that file for the canonical implementation).
// Only applied to kiosk_opens_at/kiosk_closes_at below -- the pre-existing
// starts_at/ends_at fields deliberately keep their raw `.slice(0, 16)`
// round-trip (a separate, already-live soft-warning-only system, out of
// scope here). Without this conversion, a `datetime-local` value gets
// interpreted as UTC on insert (this project's Postgres session timezone),
// silently offsetting the schedule by the admin's own UTC offset -- and this
// is the HARD-GATING kiosk schedule, not a soft warning.
function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalDatetimeInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export default function CheckinListsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
    // "" = not yet chosen. No default — the volunteer amber card is wrong
    // for one of the two purposes, so this has to be an explicit pick.
    list_purpose: "" as "" | "entry" | "collection",
    prints_badge: false,
    ticket_type_ids: [] as string[],
    addon_ids: [] as string[],
    starts_at: "",
    ends_at: "",
    kiosk_opens_at: "",
    kiosk_closes_at: "",
    kiosk_force_state: null as "open" | "closed" | null,
  })

  // Fetch lists — goes through the API route (admin client) rather than a
  // direct browser-session Supabase query: checkin_lists' RLS has no SELECT
  // policy for browser sessions either (not just INSERT, despite the
  // narrower framing in the mutation comment below), so a direct client
  // query here always silently returned zero rows regardless of the actual
  // data -- this page showed "No lists yet" for every event, always.
  const { data: lists, isLoading } = useQuery({
    queryKey: ["checkin-lists-manage", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/checkin-lists?event_id=${encodeURIComponent(eventId)}`)
      if (!res.ok) return []
      const data = await res.json()
      return (data || []) as CheckinList[]
    },
  })

  // Fetch ticket types (all including hidden for check-in restrictions)
  const { data: ticketTypes } = useQuery({
    queryKey: ["ticket-types-all", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_types")
        .select("id, name")
        .eq("event_id", eventId)
        .order("sort_order")
      return (data || []) as TicketType[]
    },
  })

  // Fetch addons for the event
  const { data: addons } = useQuery({
    queryKey: ["addons-all", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("addons")
        .select("id, name")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("sort_order")
      return (data || []) as Addon[]
    },
  })

  // Load selected list data into form
  useEffect(() => {
    if (selectedListId && lists) {
      const list = lists.find(l => l.id === selectedListId)
      if (list) {
        setFormData({
          name: list.name,
          description: list.description || "",
          is_active: list.is_active,
          list_purpose: list.list_purpose,
          prints_badge: list.prints_badge,
          ticket_type_ids: list.ticket_type_ids || [],
          addon_ids: list.addon_ids || [],
          starts_at: list.starts_at ? list.starts_at.slice(0, 16) : "",
          ends_at: list.ends_at ? list.ends_at.slice(0, 16) : "",
          kiosk_opens_at: toLocalDatetimeInput(list.kiosk_opens_at ?? null),
          kiosk_closes_at: toLocalDatetimeInput(list.kiosk_closes_at ?? null),
          kiosk_force_state: list.kiosk_force_state ?? null,
        })
      }
    }
  }, [selectedListId, lists])

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        is_active: data.is_active,
        list_purpose: data.list_purpose,
        prints_badge: data.prints_badge,
        ticket_type_ids: data.ticket_type_ids.length > 0 ? data.ticket_type_ids : null,
        addon_ids: data.addon_ids.length > 0 ? data.addon_ids : null,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
        kiosk_opens_at: fromLocalDatetimeInput(data.kiosk_opens_at),
        kiosk_closes_at: fromLocalDatetimeInput(data.kiosk_closes_at),
        kiosk_force_state: data.kiosk_force_state,
      }
      // Go through the API route — checkin_lists has an RLS policy that
      // blocks browser-session inserts; the API uses the admin client.
      if (data.id) {
        const res = await fetch("/api/checkin-lists", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: data.id, ...payload }),
        })
        if (!res.ok) throw new Error((await res.json()).error || "Update failed")
        return res.json()
      } else {
        const res = await fetch("/api/checkin-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: eventId, ...payload }),
        })
        if (!res.ok) throw new Error((await res.json()).error || "Create failed")
        return res.json()
      }
    },
    onSuccess: (newList) => {
      queryClient.invalidateQueries({ queryKey: ["checkin-lists-manage", eventId] })
      queryClient.invalidateQueries({ queryKey: ["checkin-lists-active", eventId] })

      // Show "Saved" on button
      setShowSaved(true)
      setTimeout(() => setShowSaved(false), 2000)

      if (isCreating) {
        toast.success("List created")
        setIsCreating(false)
        setSelectedListId(null)
      } else {
        if (newList?.cleanedUp > 0) {
          toast.success(`List updated. ${newList.cleanedUp} orphaned check-in${newList.cleanedUp > 1 ? 's' : ''} removed.`)
        } else {
          toast.success("Saved")
        }
      }
    },
    onError: () => {
      toast.error("Failed to save list")
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/checkin-lists?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkin-lists-manage", eventId] })
      toast.success("List deleted")
      setSelectedListId(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete list")
    },
  })

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      is_active: true,
      list_purpose: "",
      prints_badge: false,
      ticket_type_ids: [],
      addon_ids: [],
      starts_at: "",
      ends_at: "",
      kiosk_opens_at: "",
      kiosk_closes_at: "",
      kiosk_force_state: null,
    })
  }

  const handleCreateNew = () => {
    setSelectedListId(null)
    setIsCreating(true)
    resetForm()
  }

  const handleSelectList = (id: string) => {
    setIsCreating(false)
    setSelectedListId(id)
  }

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!formData.list_purpose) {
      toast.error("Choose Entry or Collection before saving")
      return
    }
    if (isCreating) {
      saveMutation.mutate(formData as typeof formData & { list_purpose: "entry" | "collection" })
    } else if (selectedListId) {
      saveMutation.mutate({ ...formData, id: selectedListId } as typeof formData & { id: string; list_purpose: "entry" | "collection" })
    }
  }

  const handleDelete = () => {
    if (selectedListId && confirm("Are you sure you want to delete this list?")) {
      deleteMutation.mutate(selectedListId)
    }
  }

  const getListIcon = (name: string) => {
    const lowerName = name.toLowerCase()
    if (lowerName.includes("breakfast") || lowerName.includes("tea") || lowerName.includes("coffee")) {
      return Coffee
    }
    if (lowerName.includes("lunch")) {
      return UtensilsCrossed
    }
    if (lowerName.includes("dinner")) {
      return Utensils
    }
    if (lowerName.includes("workshop") || lowerName.includes("session")) {
      return CalendarDays
    }
    return Users
  }

  const getGradient = (index: number) => {
    const gradients = [
      "from-orange-500 to-amber-500",
      "from-blue-500 to-cyan-500",
      "from-purple-500 to-pink-500",
      "from-green-500 to-emerald-500",
      "from-red-500 to-rose-500",
      "from-indigo-500 to-violet-500",
    ]
    return gradients[index % gradients.length]
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const selectedList = lists?.find(l => l.id === selectedListId)

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-card/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Check-in Lists</h1>
            <p className="text-muted-foreground text-sm">Manage lists for different sessions or areas</p>
          </div>
        </div>
      </div>

      {/* Main Content - Side by Side */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - List */}
        <div className="w-80 border-r bg-muted/30 flex flex-col">
          {/* Add New Button */}
          <div className="p-4 border-b">
            <Button onClick={handleCreateNew} className="w-full gap-2" variant={isCreating ? "secondary" : "default"}>
              <Plus className="h-4 w-4" />
              New Check-in List
            </Button>
          </div>

          {/* Lists */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {!lists?.length && !isCreating ? (
              <div className="text-center py-12 px-4">
                <List className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No lists yet</p>
                <p className="text-xs text-muted-foreground mt-1">Click above to create one</p>
              </div>
            ) : (
              lists?.map((list, index) => {
                const Icon = getListIcon(list.name)
                const isSelected = selectedListId === list.id && !isCreating
                return (
                  <button
                    key={list.id}
                    onClick={() => handleSelectList(list.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl transition-all group",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                        isSelected
                          ? "bg-white/20"
                          : `bg-gradient-to-br ${getGradient(index)} text-white`
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{list.name}</div>
                        <div className={cn(
                          "text-xs truncate",
                          isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {list.description || "No description"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {list.is_active ? (
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            isSelected ? "bg-green-300" : "bg-green-500"
                          )} />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                        )}
                        <ChevronRight className={cn(
                          "h-4 w-4 transition-transform",
                          isSelected ? "text-primary-foreground" : "text-muted-foreground",
                          isSelected && "translate-x-1"
                        )} />
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Panel - Edit Form */}
        <div className="flex-1 overflow-y-auto">
          {!selectedListId && !isCreating ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <List className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Select a list to edit</p>
                <p className="text-sm text-muted-foreground/70 mt-1">or create a new one</p>
              </div>
            </div>
          ) : (
            <div className="p-6 max-w-2xl">
              {/* Form Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold">
                    {isCreating ? "Create New List" : "Edit List"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {isCreating ? "Add a new check-in list" : `Editing: ${selectedList?.name}`}
                  </p>
                </div>
                {!isCreating && selectedListId && (
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/events/${eventId}/checkin/${selectedListId}/scan`}>
                        <QrCode className="h-4 w-4 mr-2" />
                        Scanner
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/kiosk/${eventId}/${selectedListId}${selectedList?.access_token ? `?token=${selectedList.access_token}` : ""}`}
                        target="_blank"
                      >
                        <Monitor className="h-4 w-4 mr-2" />
                        Kiosk
                      </Link>
                    </Button>
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="bg-card rounded-2xl border p-5 space-y-4">
                  <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                    <List className="h-4 w-4" />
                    Basic Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Name *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Breakfast, Lunch, Dinner"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Description</Label>
                      <Input
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Optional description"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>

                {/* Ticket Types */}
                {ticketTypes && ticketTypes.length > 0 && (
                  <div className="bg-card rounded-2xl border p-5 space-y-4">
                    <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                      <Ticket className="h-4 w-4" />
                      Ticket Type Restrictions
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {ticketTypes.map((tt) => (
                        <button
                          key={tt.id}
                          type="button"
                          onClick={() => {
                            if (formData.ticket_type_ids.includes(tt.id)) {
                              setFormData({
                                ...formData,
                                ticket_type_ids: formData.ticket_type_ids.filter((id) => id !== tt.id),
                              })
                            } else {
                              setFormData({
                                ...formData,
                                ticket_type_ids: [...formData.ticket_type_ids, tt.id],
                              })
                            }
                          }}
                          className={cn(
                            "px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all",
                            formData.ticket_type_ids.includes(tt.id)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 border-transparent hover:border-primary/30"
                          )}
                        >
                          {tt.name}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leave empty to allow all ticket types
                    </p>
                  </div>
                )}

                {/* Addon Restrictions */}
                {addons && addons.length > 0 && (
                  <div className="bg-card rounded-2xl border p-5 space-y-4">
                    <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                      <Package className="h-4 w-4" />
                      Addon Restrictions
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {addons.map((addon) => (
                        <button
                          key={addon.id}
                          type="button"
                          onClick={() => {
                            if (formData.addon_ids.includes(addon.id)) {
                              setFormData({
                                ...formData,
                                addon_ids: formData.addon_ids.filter((id) => id !== addon.id),
                              })
                            } else {
                              setFormData({
                                ...formData,
                                addon_ids: [...formData.addon_ids, addon.id],
                              })
                            }
                          }}
                          className={cn(
                            "px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all",
                            formData.addon_ids.includes(addon.id)
                              ? "bg-purple-600 text-white border-purple-600"
                              : "bg-muted/50 border-transparent hover:border-purple-400/30"
                          )}
                        >
                          {addon.name}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Only attendees who purchased these addons can check in to this list
                    </p>
                  </div>
                )}

                {/* Schedule */}
                <div className="bg-card rounded-2xl border p-5 space-y-4">
                  <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                    <Clock className="h-4 w-4" />
                    Schedule (Optional)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Starts At</Label>
                      <Input
                        type="datetime-local"
                        value={formData.starts_at}
                        onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Ends At</Label>
                      <Input
                        type="datetime-local"
                        value={formData.ends_at}
                        onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>

                {/* Kiosk schedule -- a completely separate system from the
                    Schedule card above (starts_at/ends_at is a soft warning
                    only, live today). This hard-gates whether the list is
                    even tappable on a shared kiosk's on-device menu. */}
                <div className="bg-card rounded-2xl border p-5 space-y-4">
                  <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                    <Monitor className="h-4 w-4" />
                    Kiosk Menu Schedule (Optional)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Controls whether this list is tappable on a shared kiosk station's menu — separate from the Schedule above.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Opens At</Label>
                      <Input
                        type="datetime-local"
                        value={formData.kiosk_opens_at}
                        onChange={(e) => setFormData({ ...formData, kiosk_opens_at: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Closes At</Label>
                      <Input
                        type="datetime-local"
                        value={formData.kiosk_closes_at}
                        onChange={(e) => setFormData({ ...formData, kiosk_closes_at: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["follow", "open", "closed"] as const).map((option) => {
                      const value = option === "follow" ? null : option
                      const isSelected = formData.kiosk_force_state === value
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setFormData({ ...formData, kiosk_force_state: value })}
                          className={cn(
                            "rounded-lg border-2 py-2 text-xs font-medium transition-all",
                            isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                          )}
                        >
                          {option === "follow" ? "Follow schedule" : option === "open" ? "Force open" : "Force closed"}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Purpose — required, no default. Drives which amber card a
                    repeat scan on this list shows at the desk. */}
                <div className="bg-card rounded-2xl border p-5 space-y-3">
                  <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                    Purpose <span className="text-destructive normal-case tracking-normal">(required)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, list_purpose: "entry" })}
                      className={cn(
                        "text-left rounded-xl border-2 p-4 transition-all",
                        formData.list_purpose === "entry"
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-border hover:border-emerald-500/40"
                      )}
                    >
                      <p className="font-medium">Entry</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Hall, session, re-entry. A repeat scan means &quot;let them in&quot; — never blocks anyone.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, list_purpose: "collection" })}
                      className={cn(
                        "text-left rounded-xl border-2 p-4 transition-all",
                        formData.list_purpose === "collection"
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-border hover:border-amber-500/40"
                      )}
                    >
                      <p className="font-medium">Collection</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Kit, badge, meal, exam paper. A repeat scan means &quot;already collected — do not issue again.&quot;
                      </p>
                    </button>
                  </div>
                  {!formData.list_purpose && (
                    <p className="text-xs text-destructive">Pick one — there is no default.</p>
                  )}
                </div>

                {/* Settings */}
                <div className="bg-card rounded-2xl border p-5 space-y-4">
                  <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                    Settings
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <Label className="font-medium">Active</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Show this list in Overview for check-ins</p>
                      </div>
                      <Switch
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <Label className="font-medium">Prints badge</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Only turn this on for the desk that actually prints badges. Other check-in jobs (meals, kit
                          collection) never need it, even on a station with a printer configured.
                        </p>
                      </div>
                      <Switch
                        checked={formData.prints_badge}
                        onCheckedChange={(checked) => setFormData({ ...formData, prints_badge: checked })}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4">
                  {!isCreating && (
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete List
                    </Button>
                  )}
                  <div className={cn("flex gap-3", isCreating && "ml-auto")}>
                    {isCreating && (
                      <Button variant="outline" onClick={() => {
                        setIsCreating(false)
                        if (lists?.length) {
                          setSelectedListId(lists[0].id)
                        }
                      }}>
                        Cancel
                      </Button>
                    )}
                    <Button
                      onClick={handleSave}
                      disabled={!formData.name.trim() || !formData.list_purpose || saveMutation.isPending || showSaved}
                      className={cn(
                        "min-w-[120px] transition-all",
                        showSaved && "bg-green-600 hover:bg-green-600"
                      )}
                    >
                      {saveMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : showSaved ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Saved!
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          {isCreating ? "Create List" : "Save Changes"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
