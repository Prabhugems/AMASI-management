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
  allow_multiple_checkins: boolean
  ticket_type_ids?: string[]
  addon_ids?: string[]
  starts_at?: string
  ends_at?: string
  created_at: string
}

type TicketType = {
  id: string
  name: string
}

type Addon = {
  id: string
  name: string
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
    allow_multiple_checkins: false,
    ticket_type_ids: [] as string[],
    addon_ids: [] as string[],
    starts_at: "",
    ends_at: "",
  })

  // Fetch lists
  const { data: lists, isLoading } = useQuery({
    queryKey: ["checkin-lists-manage", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("checkin_lists")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order")

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
          allow_multiple_checkins: list.allow_multiple_checkins,
          ticket_type_ids: list.ticket_type_ids || [],
          addon_ids: list.addon_ids || [],
          starts_at: list.starts_at ? list.starts_at.slice(0, 16) : "",
          ends_at: list.ends_at ? list.ends_at.slice(0, 16) : "",
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
        allow_multiple_checkins: data.allow_multiple_checkins,
        ticket_type_ids: data.ticket_type_ids.length > 0 ? data.ticket_type_ids : null,
        addon_ids: data.addon_ids.length > 0 ? data.addon_ids : null,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
      }
      if (data.id) {
        const { error } = await (supabase as any)
          .from("checkin_lists")
          .update(payload)
          .eq("id", data.id)
        if (error) throw error
      } else {
        const { data: newList, error } = await (supabase as any)
          .from("checkin_lists")
          .insert({ ...payload, event_id: eventId })
          .select()
          .single()
        if (error) throw error
        return newList
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
      const { error } = await (supabase as any)
        .from("checkin_lists")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkin-lists-manage", eventId] })
      toast.success("List deleted")
      setSelectedListId(null)
    },
  })

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      is_active: true,
      allow_multiple_checkins: false,
      ticket_type_ids: [],
      addon_ids: [],
      starts_at: "",
      ends_at: "",
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
    if (isCreating) {
      saveMutation.mutate(formData)
    } else if (selectedListId) {
      saveMutation.mutate({ ...formData, id: selectedListId })
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Check-in Lists</h1>
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
                      <Link href={`/kiosk/${eventId}/${selectedListId}`} target="_blank">
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
                        <Label className="font-medium">Allow Multiple Check-ins</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Allow same person to check in multiple times</p>
                      </div>
                      <Switch
                        checked={formData.allow_multiple_checkins}
                        onCheckedChange={(checked) => setFormData({ ...formData, allow_multiple_checkins: checked })}
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
                      disabled={!formData.name.trim() || saveMutation.isPending || showSaved}
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
