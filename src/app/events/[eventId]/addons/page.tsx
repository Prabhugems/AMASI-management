"use client"

import { useState, useRef } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Plus,
  Package,
  Edit2,
  Trash2,
  Loader2,
  IndianRupee,
  GripVertical,
  MoreVertical,
  X,
  Image as ImageIcon,
  Layers,
  Link2,
  Ticket,
  GraduationCap,
  Award,
  Users,
  Clock,
  User,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface AddonVariant {
  id?: string
  name: string
  price: number
  stock: number | null
  sort_order: number
  is_active: boolean
}

interface TicketLink {
  ticket_type_id: string
  max_quantity_per_attendee: number
  is_required: boolean
}

interface Addon {
  id: string
  event_id: string
  name: string
  description: string | null
  price: number
  max_quantity: number | null
  is_active: boolean
  sort_order: number
  image_url: string | null
  has_variants: boolean
  variant_type: string | null
  // Course fields
  is_course: boolean
  certificate_template_id: string | null
  course_description: string | null
  course_duration: string | null
  course_instructor: string | null
  created_at: string
  variants?: AddonVariant[]
  ticket_links?: TicketLink[]
  // Computed
  participants_count?: number
}

interface CertificateTemplate {
  id: string
  name: string
}

interface TicketType {
  id: string
  name: string
  price: number
  status: string
}

const initialFormData = {
  name: "",
  description: "",
  price: 0,
  max_quantity: null as number | null,
  is_active: true,
  image_url: null as string | null,
  has_variants: false,
  variant_type: "",
  is_free: true,
  // Course fields
  is_course: false,
  certificate_template_id: null as string | null,
  course_description: "",
  course_duration: "",
  course_instructor: "",
}

const initialVariant: AddonVariant = {
  name: "",
  price: 0,
  stock: null,
  sort_order: 0,
  is_active: true,
}

export default function AddonsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  const [variants, setVariants] = useState<AddonVariant[]>([])
  const [ticketLinks, setTicketLinks] = useState<TicketLink[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("basic")
  const [uploading, setUploading] = useState(false)

  // Fetch addons with variants, ticket links, and sales data
  const { data: addons, isLoading } = useQuery({
    queryKey: ["event-addons", eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("addons")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })

      if (error) throw error

      // Fetch sales data directly from registration_addons
      const salesByAddon: Record<string, { sold: number; revenue: number }> = {}
      if (data && data.length > 0) {
        const addonIds = data.map((a: any) => a.id)
        const { data: salesData } = await (supabase as any)
          .from("registration_addons")
          .select("addon_id, quantity, unit_price, total_price, addon:addons(price)")
          .in("addon_id", addonIds)

        if (salesData) {
          salesData.forEach((sale: any) => {
            if (!salesByAddon[sale.addon_id]) {
              salesByAddon[sale.addon_id] = { sold: 0, revenue: 0 }
            }
            const qty = sale.quantity || 1
            const addonPrice = sale.addon?.price || 0
            // total_price is already qty * unit_price, or calculate from unit_price/addon price
            const totalPrice = sale.total_price || (sale.unit_price ? sale.unit_price * qty : addonPrice * qty)
            salesByAddon[sale.addon_id].sold += qty
            salesByAddon[sale.addon_id].revenue += totalPrice
          })
        }
      }

      // Fetch variants for each addon
      const addonsWithVariants = await Promise.all(
        (data as Addon[]).map(async (addon) => {
          if (addon.has_variants) {
            const { data: variantsData } = await (supabase as any)
              .from("addon_variants")
              .select("*")
              .eq("addon_id", addon.id)
              .order("sort_order")
            addon.variants = variantsData || []
          }

          // Fetch ticket links
          const { data: linksData } = await (supabase as any)
            .from("addon_ticket_links")
            .select("ticket_type_id, max_quantity_per_attendee, is_required")
            .eq("addon_id", addon.id)
          addon.ticket_links = linksData || []

          // Add sales data
          const sales = salesByAddon[addon.id] || { sold: 0, revenue: 0 }
          return {
            ...addon,
            quantity_sold: sales.sold,
            total_revenue: sales.revenue,
          }
        })
      )

      return addonsWithVariants as (Addon & { quantity_sold: number; total_revenue: number })[]
    },
    enabled: !!eventId,
  })

  // Fetch ticket types for linking
  const { data: ticketTypes } = useQuery({
    queryKey: ["event-ticket-types", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ticket_types")
        .select("id, name, price, status")
        .eq("event_id", eventId)
        .order("sort_order")
      return (data || []) as TicketType[]
    },
    enabled: !!eventId,
  })

  // Fetch certificate templates for course addons
  const { data: certificateTemplates } = useQuery({
    queryKey: ["event-certificate-templates", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("certificate_templates")
        .select("id, name")
        .eq("event_id", eventId)
        .order("name")
      return (data || []) as CertificateTemplate[]
    },
    enabled: !!eventId,
  })

  // Stats
  const stats = {
    total: addons?.length || 0,
    active: addons?.filter(a => a.is_active).length || 0,
    totalSold: addons?.reduce((sum, a) => sum + (a.quantity_sold || 0), 0) || 0,
    totalRevenue: addons?.reduce((sum, a) => sum + (a.total_revenue || 0), 0) || 0,
  }

  // Upload image
  const uploadImage = async (file: File) => {
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `addon-${Date.now()}.${fileExt}`
      const filePath = `addons/${eventId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('event-assets')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('event-assets')
        .getPublicUrl(filePath)

      setFormData(prev => ({ ...prev, image_url: publicUrl }))
      toast.success("Image uploaded")
    } catch (error) {
      console.error("Upload error:", error)
      toast.error("Failed to upload image")
    } finally {
      setUploading(false)
    }
  }

  // Save addon
  const saveAddon = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const addonPayload = {
        name: data.name,
        description: data.description || null,
        price: data.is_free ? 0 : data.price,
        max_quantity: data.max_quantity,
        is_active: data.is_active,
        image_url: data.image_url,
        has_variants: data.has_variants,
        variant_type: data.has_variants ? data.variant_type : null,
        // Course fields
        is_course: data.is_course,
        certificate_template_id: data.is_course ? data.certificate_template_id : null,
        course_description: data.is_course ? data.course_description || null : null,
        course_duration: data.is_course ? data.course_duration || null : null,
        course_instructor: data.is_course ? data.course_instructor || null : null,
        updated_at: new Date().toISOString(),
      }

      let addonId = data.id

      if (data.id) {
        // Update existing addon
        const { error } = await (supabase as any)
          .from("addons")
          .update(addonPayload)
          .eq("id", data.id)
        if (error) throw error
      } else {
        // Create new addon
        const { data: newAddon, error } = await (supabase as any)
          .from("addons")
          .insert({
            ...addonPayload,
            event_id: eventId,
            sort_order: (addons?.length || 0) + 1,
          })
          .select()
          .single()
        if (error) throw error
        addonId = newAddon.id
      }

      // Save variants if has_variants is true
      if (data.has_variants && addonId) {
        // Delete existing variants
        await (supabase as any)
          .from("addon_variants")
          .delete()
          .eq("addon_id", addonId)

        // Insert new variants
        if (variants.length > 0) {
          const variantsToInsert = variants.map((v, idx) => ({
            addon_id: addonId,
            name: v.name,
            price: v.price || 0,
            stock: v.stock,
            sort_order: idx,
            is_active: v.is_active,
          }))
          await (supabase as any)
            .from("addon_variants")
            .insert(variantsToInsert)
        }
      }

      // Save ticket links
      if (addonId) {
        // Delete existing links
        await (supabase as any)
          .from("addon_ticket_links")
          .delete()
          .eq("addon_id", addonId)

        // Insert new links
        if (ticketLinks.length > 0) {
          const linksToInsert = ticketLinks.map(l => ({
            addon_id: addonId,
            ticket_type_id: l.ticket_type_id,
            max_quantity_per_attendee: l.max_quantity_per_attendee,
            is_required: l.is_required,
          }))
          await (supabase as any)
            .from("addon_ticket_links")
            .insert(linksToInsert)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-addons", eventId] })
      setIsDialogOpen(false)
      setEditingAddon(null)
      setFormData(initialFormData)
      setVariants([])
      setTicketLinks([])
      setActiveTab("basic")
      toast.success(editingAddon ? "Addon updated" : "Addon created")
    },
    onError: (error) => {
      console.error("Save error:", error)
      toast.error("Failed to save addon")
    },
  })

  // Delete addon
  const deleteAddon = useMutation({
    mutationFn: async (addonId: string) => {
      const { error } = await (supabase as any)
        .from("addons")
        .delete()
        .eq("id", addonId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-addons", eventId] })
      setDeleteConfirm(null)
      toast.success("Addon deleted")
    },
    onError: () => {
      toast.error("Failed to delete addon")
    },
  })

  // Toggle active status
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("addons")
        .update({ is_active: !is_active, updated_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-addons", eventId] })
    },
  })

  const openEditDialog = (addon: Addon) => {
    setEditingAddon(addon)
    setFormData({
      name: addon.name,
      description: addon.description || "",
      price: addon.price,
      max_quantity: addon.max_quantity,
      is_active: addon.is_active,
      image_url: addon.image_url,
      has_variants: addon.has_variants,
      variant_type: addon.variant_type || "",
      is_free: addon.price === 0,
      // Course fields
      is_course: addon.is_course || false,
      certificate_template_id: addon.certificate_template_id,
      course_description: addon.course_description || "",
      course_duration: addon.course_duration || "",
      course_instructor: addon.course_instructor || "",
    })
    setVariants(addon.variants || [])
    setTicketLinks(addon.ticket_links || [])
    setActiveTab("basic")
    setIsDialogOpen(true)
  }

  const openCreateDialog = () => {
    setEditingAddon(null)
    setFormData(initialFormData)
    setVariants([])
    setTicketLinks([])
    setActiveTab("basic")
    setIsDialogOpen(true)
  }

  const addVariant = () => {
    setVariants([...variants, { ...initialVariant, sort_order: variants.length }])
  }

  const updateVariant = (index: number, field: keyof AddonVariant, value: any) => {
    const updated = [...variants]
    updated[index] = { ...updated[index], [field]: value }
    setVariants(updated)
  }

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index))
  }

  const toggleTicketLink = (ticketId: string) => {
    const existing = ticketLinks.find(l => l.ticket_type_id === ticketId)
    if (existing) {
      setTicketLinks(ticketLinks.filter(l => l.ticket_type_id !== ticketId))
    } else {
      setTicketLinks([...ticketLinks, {
        ticket_type_id: ticketId,
        max_quantity_per_attendee: 1,
        is_required: false,
      }])
    }
  }

  const updateTicketLink = (ticketId: string, field: keyof TicketLink, value: any) => {
    setTicketLinks(ticketLinks.map(l =>
      l.ticket_type_id === ticketId ? { ...l, [field]: value } : l
    ))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Addons</h1>
          <p className="text-muted-foreground mt-1">
            Additional items attendees can purchase with their tickets
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Addon
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Addons</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalSold}</p>
              <p className="text-xs text-muted-foreground">Total Sold</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <IndianRupee className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Addons List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : addons?.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
          <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No addons yet</h3>
          <p className="text-muted-foreground mb-6">
            Create addons like T-shirts, workshops, lunch, certificates, etc.
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Addon
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {addons?.map((addon) => (
            <div
              key={addon.id}
              className={cn(
                "group p-4 rounded-xl border bg-card transition-all duration-200",
                "hover:border-primary/20 hover:bg-secondary/30"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Image or placeholder */}
                  {addon.image_url ? (
                    <img
                      src={addon.image_url}
                      alt={addon.name}
                      className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}

                  {/* Addon info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{addon.name}</h3>
                      {!addon.is_active && (
                        <Badge variant="outline" className="text-[10px]">Inactive</Badge>
                      )}
                      {addon.is_course && (
                        <Badge className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">
                          <GraduationCap className="h-3 w-3 mr-1" />
                          Course
                        </Badge>
                      )}
                      {addon.has_variants && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Layers className="h-3 w-3 mr-1" />
                          {addon.variants?.length || 0} variants
                        </Badge>
                      )}
                      {addon.ticket_links && addon.ticket_links.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          <Link2 className="h-3 w-3 mr-1" />
                          {addon.ticket_links.length} tickets
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className={cn(
                        "font-medium",
                        addon.price === 0 ? "text-emerald-600" : "text-foreground"
                      )}>
                        {addon.price === 0 ? "Free" : `₹${addon.price.toLocaleString()}`}
                      </span>
                      <span>•</span>
                      <span>{addon.quantity_sold || 0} sold</span>
                      {addon.total_revenue > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600">₹{addon.total_revenue.toLocaleString()}</span>
                        </>
                      )}
                      {addon.description && (
                        <>
                          <span>•</span>
                          <span className="truncate">{addon.description}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={addon.is_active}
                    onCheckedChange={() => toggleActive.mutate({ id: addon.id, is_active: addon.is_active })}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(addon)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {addon.is_course && (
                        <DropdownMenuItem asChild>
                          <Link href={`/events/${eventId}/addons/${addon.id}/participants`}>
                            <Users className="h-4 w-4 mr-2" />
                            View Participants
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setDeleteConfirm(addon.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Variants preview */}
              {addon.has_variants && addon.variants && addon.variants.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex flex-wrap gap-2">
                    {addon.variants.map((variant) => (
                      <span
                        key={variant.id || variant.name}
                        className="px-2 py-1 bg-secondary rounded text-xs"
                      >
                        {variant.name}
                        {variant.price > 0 && (
                          <span className="text-muted-foreground ml-1">
                            (+₹{variant.price})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add button */}
          <button
            onClick={openCreateDialog}
            className="w-full p-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Addon
          </button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingAddon ? "Edit Addon" : "Create Addon"}</DialogTitle>
            <DialogDescription>
              {editingAddon ? "Update addon details" : "Add a new addon for attendees to purchase"}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="variants" disabled={!formData.has_variants}>Variants</TabsTrigger>
              <TabsTrigger value="course" disabled={!formData.is_course}>Course</TabsTrigger>
              <TabsTrigger value="tickets">Tickets</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto py-4">
              <TabsContent value="basic" className="mt-0 space-y-6">
                {/* Type selector */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, has_variants: false })}
                    className={cn(
                      "flex-1 p-4 rounded-xl border-2 text-left transition-all",
                      !formData.has_variants
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Package className="h-6 w-6 mb-2" />
                    <p className="font-medium">Single Add-on</p>
                    <p className="text-xs text-muted-foreground">Simple addon without options</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, has_variants: true })}
                    className={cn(
                      "flex-1 p-4 rounded-xl border-2 text-left transition-all",
                      formData.has_variants
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Layers className="h-6 w-6 mb-2" />
                    <p className="font-medium">Add-on with Variants</p>
                    <p className="text-xs text-muted-foreground">Like T-shirt with sizes</p>
                  </button>
                </div>

                {/* Image upload */}
                <div>
                  <Label className="mb-2 block">Add-on Image</Label>
                  <div className="flex items-start gap-4">
                    {formData.image_url ? (
                      <div className="relative">
                        <img
                          src={formData.image_url}
                          alt="Addon"
                          className="h-24 w-24 rounded-lg object-cover"
                        />
                        <button
                          onClick={() => setFormData({ ...formData, image_url: null })}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="h-24 w-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors"
                      >
                        {uploading ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <>
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Upload</span>
                          </>
                        )}
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadImage(file)
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Logo should be jpg, jpeg or png format and at least 150 px height.
                    </p>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <Label>Add-on Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Workshop Access, Lunch, T-Shirt"
                    className="mt-1.5"
                  />
                </div>

                {/* Description */}
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What's included?"
                    className="mt-1.5"
                    rows={2}
                  />
                </div>

                {/* Pricing */}
                <div>
                  <Label className="mb-3 block">Pricing</Label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_free: true, price: 0 })}
                      className={cn(
                        "flex-1 p-4 rounded-xl border-2 text-center transition-all",
                        formData.is_free
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <p className="font-medium">Free</p>
                      <p className="text-xs text-muted-foreground">Offer at no cost</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_free: false })}
                      className={cn(
                        "flex-1 p-4 rounded-xl border-2 text-center transition-all",
                        !formData.is_free
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <p className="font-medium">Paid</p>
                      <p className="text-xs text-muted-foreground">Set a price</p>
                    </button>
                  </div>

                  {!formData.is_free && (
                    <div className="mt-4">
                      <Label>Price (₹)</Label>
                      <div className="relative mt-1.5">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                          className="pl-9"
                          min={0}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Variant type (if has variants) */}
                {formData.has_variants && (
                  <div>
                    <Label>Variant Type</Label>
                    <Input
                      value={formData.variant_type}
                      onChange={(e) => setFormData({ ...formData, variant_type: e.target.value })}
                      placeholder="e.g., Size, Color, Type"
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This label will appear above the variant options
                    </p>
                  </div>
                )}

                {/* Max quantity */}
                <div>
                  <Label>Max Quantity per Order</Label>
                  <Input
                    type="number"
                    value={formData.max_quantity || ""}
                    onChange={(e) => setFormData({ ...formData, max_quantity: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Unlimited"
                    className="mt-1.5"
                    min={1}
                  />
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">Active</p>
                    <p className="text-xs text-muted-foreground">Show on registration page</p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                {/* Course toggle */}
                <div className="flex items-center justify-between p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-sm">This is a Course</p>
                      <p className="text-xs text-muted-foreground">Issue separate certificates for participants</p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.is_course}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_course: checked })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="variants" className="mt-0 space-y-4">
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <p className="text-sm font-medium mb-1">
                    {formData.variant_type || "Variants"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Add options like sizes (S, M, L, XL) or types
                  </p>
                </div>

                {variants.map((variant, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-card rounded-lg border">
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      value={variant.name}
                      onChange={(e) => updateVariant(index, "name", e.target.value)}
                      placeholder="Variant name (e.g., S, M, L)"
                      className="flex-1"
                    />
                    <div className="w-28">
                      <div className="relative">
                        <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          type="number"
                          value={variant.price || ""}
                          onChange={(e) => updateVariant(index, "price", parseFloat(e.target.value) || 0)}
                          placeholder="Extra ₹"
                          className="pl-6 text-sm"
                          min={0}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariant(index)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button variant="outline" onClick={addVariant} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variant
                </Button>
              </TabsContent>

              <TabsContent value="course" className="mt-0 space-y-6">
                <div className="p-4 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <GraduationCap className="h-5 w-5 text-blue-500" />
                    <p className="text-sm font-medium">Course Settings</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure course details and certificate for participants
                  </p>
                </div>

                {/* Certificate Template */}
                <div>
                  <Label className="flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Certificate Template
                  </Label>
                  <Select
                    value={formData.certificate_template_id || "none"}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      certificate_template_id: value === "none" ? null : value
                    })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select certificate template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No certificate</SelectItem>
                      {certificateTemplates?.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Participants will receive this certificate upon completion
                  </p>
                  {certificateTemplates?.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      No certificate templates found. Create one in Certificates section first.
                    </p>
                  )}
                </div>

                {/* Course Instructor */}
                <div>
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Course Instructor
                  </Label>
                  <Input
                    value={formData.course_instructor}
                    onChange={(e) => setFormData({ ...formData, course_instructor: e.target.value })}
                    placeholder="e.g., Dr. John Smith"
                    className="mt-1.5"
                  />
                </div>

                {/* Course Duration */}
                <div>
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Course Duration
                  </Label>
                  <Input
                    value={formData.course_duration}
                    onChange={(e) => setFormData({ ...formData, course_duration: e.target.value })}
                    placeholder="e.g., 2 hours, Half day, 3 days"
                    className="mt-1.5"
                  />
                </div>

                {/* Course Description */}
                <div>
                  <Label>Course Description</Label>
                  <Textarea
                    value={formData.course_description}
                    onChange={(e) => setFormData({ ...formData, course_description: e.target.value })}
                    placeholder="Detailed description of the course content, objectives, etc."
                    className="mt-1.5"
                    rows={4}
                  />
                </div>
              </TabsContent>

              <TabsContent value="tickets" className="mt-0 space-y-4">
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <p className="text-sm font-medium mb-1">Link to Tickets</p>
                  <p className="text-xs text-muted-foreground">
                    Select which tickets can have this addon. Leave empty for all tickets.
                  </p>
                </div>

                {ticketTypes?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No ticket types created yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ticketTypes?.map((ticket) => {
                      const link = ticketLinks.find(l => l.ticket_type_id === ticket.id)
                      const isLinked = !!link

                      return (
                        <div
                          key={ticket.id}
                          className={cn(
                            "p-4 rounded-lg border transition-all",
                            isLinked ? "border-primary/50 bg-primary/5" : "border-border"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isLinked}
                                onCheckedChange={() => toggleTicketLink(ticket.id)}
                              />
                              <div>
                                <p className="font-medium">{ticket.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {ticket.price === 0 ? "Free" : `₹${ticket.price}`}
                                </p>
                              </div>
                            </div>
                            {isLinked && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Max qty:</span>
                                <Input
                                  type="number"
                                  value={link?.max_quantity_per_attendee || 1}
                                  onChange={(e) => updateTicketLink(
                                    ticket.id,
                                    "max_quantity_per_attendee",
                                    parseInt(e.target.value) || 1
                                  )}
                                  className="w-16 h-8 text-sm"
                                  min={1}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  If no tickets are selected, this addon will be available for all ticket types.
                </p>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="border-t pt-4">
            {(() => {
              // Determine available tabs in order
              const tabs = ["basic"]
              if (formData.has_variants) tabs.push("variants")
              if (formData.is_course) tabs.push("course")
              tabs.push("tickets")

              const currentIndex = tabs.indexOf(activeTab)
              const isFirstTab = currentIndex === 0
              const isLastTab = currentIndex === tabs.length - 1

              const goNext = () => {
                if (!isLastTab) {
                  setActiveTab(tabs[currentIndex + 1])
                }
              }

              const goBack = () => {
                if (!isFirstTab) {
                  setActiveTab(tabs[currentIndex - 1])
                }
              }

              return (
                <>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <div className="flex-1" />
                  {!isFirstTab && (
                    <Button variant="outline" onClick={goBack}>
                      Back
                    </Button>
                  )}
                  {isLastTab ? (
                    <Button
                      onClick={() => saveAddon.mutate({ ...formData, id: editingAddon?.id })}
                      disabled={!formData.name || saveAddon.isPending}
                    >
                      {saveAddon.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                      ) : editingAddon ? (
                        "Save Changes"
                      ) : (
                        "Create Addon"
                      )}
                    </Button>
                  ) : (
                    <Button onClick={goNext} disabled={activeTab === "basic" && !formData.name}>
                      Next
                    </Button>
                  )}
                </>
              )
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Addon?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Existing registrations with this addon will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteAddon.mutate(deleteConfirm)}
              disabled={deleteAddon.isPending}
            >
              {deleteAddon.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
