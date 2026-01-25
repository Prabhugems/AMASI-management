"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  SlideOver,
  SlideOverSection,
  SlideOverTabs,
  SlideOverFooter,
} from "@/components/ui/slide-over"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Plus,
  Ticket,
  Edit2,
  Trash2,
  Loader2,
  IndianRupee,
  Users,
  Calendar,
  ExternalLink,
  Eye,
  EyeOff,
  Clock,
  TrendingUp,
  Zap,
  Link,
  Copy,
  Check,
  BarChart3,
  Settings,
  ArrowUpRight,
  FileText,
  CopyPlus,
  Package,
  Info,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface TicketType {
  id: string
  event_id: string
  name: string
  description: string | null
  price: number
  currency: string
  quantity_total: number | null
  quantity_sold: number
  min_per_order: number
  max_per_order: number
  sale_start_date: string | null
  sale_end_date: string | null
  status: "draft" | "active" | "paused" | "sold_out" | "expired"
  is_hidden: boolean
  requires_approval: boolean
  tax_percentage: number
  sort_order: number
  form_id: string | null
  exclusivity_group: string | null // Tickets in same group: only ONE can be selected
  created_at: string
}

interface FormType {
  id: string
  name: string
  slug: string
  status: string
}

interface AddonType {
  id: string
  name: string
  price: number
  is_active: boolean
}

const initialFormData = {
  name: "",
  description: "",
  price: 0,
  quantity_total: null as number | null,
  min_per_order: 1,
  max_per_order: 10,
  sale_start_date: "",
  sale_end_date: "",
  status: "draft" as "draft" | "active" | "paused" | "sold_out" | "expired",
  is_hidden: false,
  requires_approval: false,
  tax_percentage: 18,
  form_id: null as string | null,
  exclusivity_group: "" as string,
  linked_addon_ids: [] as string[],
}

export default function TicketsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("details")
  const [dialogTab, setDialogTab] = useState("basic")
  const [copiedLink, setCopiedLink] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event-basic", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name, slug")
        .eq("id", eventId)
        .single()
      return data as { id: string; name: string; short_name: string; slug: string } | null
    },
    enabled: !!eventId,
  })

  // Fetch available forms (event-specific + global published forms)
  const { data: availableForms } = useQuery({
    queryKey: ["available-forms", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, name, slug, status, event_id")
        .or(`event_id.eq.${eventId},event_id.is.null`)
        .eq("status", "published")
        .order("name")

      if (error) throw error
      return data as FormType[]
    },
    enabled: !!eventId,
  })

  // Fetch event addons
  const { data: eventAddons } = useQuery({
    queryKey: ["event-addons", eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("addons")
        .select("id, name, price, is_active")
        .eq("event_id", eventId)
        .order("name")

      if (error) throw error
      return data as AddonType[]
    },
    enabled: !!eventId,
  })

  // Fetch addon-ticket links for editing
  const { data: addonTicketLinks } = useQuery({
    queryKey: ["addon-ticket-links", eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("addon_ticket_links")
        .select("addon_id, ticket_type_id")

      if (error) throw error
      return data as { addon_id: string; ticket_type_id: string }[]
    },
    enabled: !!eventId,
  })

  // Fetch tickets with actual sales data from registrations
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["event-tickets", eventId],
    queryFn: async () => {
      // Get ticket types
      const { data: ticketTypes, error } = await (supabase as any)
        .from("ticket_types")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })

      if (error) throw error

      // Get actual sales data per ticket from registrations
      const { data: salesData } = await (supabase as any)
        .from("registrations")
        .select("ticket_type_id, total_amount")
        .eq("event_id", eventId)

      // Calculate actual sold count and revenue per ticket
      const salesByTicket: Record<string, { count: number; revenue: number }> = {}
      if (salesData) {
        salesData.forEach((reg: any) => {
          if (!salesByTicket[reg.ticket_type_id]) {
            salesByTicket[reg.ticket_type_id] = { count: 0, revenue: 0 }
          }
          salesByTicket[reg.ticket_type_id].count++
          salesByTicket[reg.ticket_type_id].revenue += parseFloat(reg.total_amount) || 0
        })
      }

      // Merge actual sales into ticket data
      return ticketTypes.map((t: any) => ({
        ...t,
        quantity_sold: salesByTicket[t.id]?.count || 0,
        actual_revenue: salesByTicket[t.id]?.revenue || 0,
      })) as (TicketType & { actual_revenue: number })[]
    },
    enabled: !!eventId,
  })

  // Calculate stats from actual registration data
  const stats = {
    totalTickets: tickets?.length || 0,
    activeTickets: tickets?.filter(t => t.status === "active").length || 0,
    totalSold: tickets?.reduce((sum, t) => sum + t.quantity_sold, 0) || 0,
    totalRevenue: tickets?.reduce((sum, t: any) => sum + (t.actual_revenue || 0), 0) || 0,
  }

  // Calculate status counts for filter tabs
  const now = new Date()
  const statusCounts = {
    all: tickets?.length || 0,
    active: tickets?.filter(t => t.status === "active").length || 0,
    paused: tickets?.filter(t => t.status === "paused").length || 0,
    scheduled: tickets?.filter(t =>
      t.sale_start_date && new Date(t.sale_start_date) > now && t.status !== "draft"
    ).length || 0,
    sold_out: tickets?.filter(t =>
      t.status === "sold_out" || (t.quantity_total && t.quantity_sold >= t.quantity_total)
    ).length || 0,
    draft: tickets?.filter(t => t.status === "draft").length || 0,
    expired: tickets?.filter(t =>
      t.sale_end_date && new Date(t.sale_end_date) < now
    ).length || 0,
  }

  // Filter tickets based on selected status
  const filteredTickets = tickets?.filter(ticket => {
    if (statusFilter === "all") return true
    if (statusFilter === "active") return ticket.status === "active"
    if (statusFilter === "paused") return ticket.status === "paused"
    if (statusFilter === "scheduled") {
      return ticket.sale_start_date && new Date(ticket.sale_start_date) > now && ticket.status !== "draft"
    }
    if (statusFilter === "sold_out") {
      return ticket.status === "sold_out" || (ticket.quantity_total && ticket.quantity_sold >= ticket.quantity_total)
    }
    if (statusFilter === "draft") return ticket.status === "draft"
    if (statusFilter === "expired") {
      return ticket.sale_end_date && new Date(ticket.sale_end_date) < now
    }
    return true
  })

  // Mutations
  const saveTicket = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      let ticketId = data.id

      if (data.id) {
        // Update existing ticket
        const updateData = {
          name: data.name,
          description: data.description || null,
          price: data.price,
          quantity_total: data.quantity_total,
          min_per_order: data.min_per_order,
          max_per_order: data.max_per_order,
          sale_start_date: data.sale_start_date || null,
          sale_end_date: data.sale_end_date || null,
          status: data.status,
          is_hidden: data.is_hidden,
          requires_approval: data.requires_approval,
          tax_percentage: data.tax_percentage,
          form_id: data.form_id || null,
          exclusivity_group: data.exclusivity_group || null,
        }
        const { data: result, error } = await (supabase as any)
          .from("ticket_types")
          .update(updateData)
          .eq("id", data.id)
          .select()
        if (error) throw error
      } else {
        // Create new ticket
        const { data: newTicket, error } = await (supabase as any)
          .from("ticket_types")
          .insert({
            event_id: eventId,
            name: data.name,
            description: data.description || null,
            price: data.price,
            quantity_total: data.quantity_total,
            min_per_order: data.min_per_order,
            max_per_order: data.max_per_order,
            sale_start_date: data.sale_start_date || null,
            sale_end_date: data.sale_end_date || null,
            status: data.status,
            is_hidden: data.is_hidden,
            requires_approval: data.requires_approval,
            tax_percentage: data.tax_percentage,
            form_id: data.form_id || null,
            exclusivity_group: data.exclusivity_group || null,
            sort_order: (tickets?.length || 0) + 1,
          })
          .select()
          .single()
        if (error) throw error
        ticketId = newTicket?.id
      }

      // Update addon-ticket links if ticket ID exists
      if (ticketId && data.linked_addon_ids) {
        // Delete existing links for this ticket
        await (supabase as any)
          .from("addon_ticket_links")
          .delete()
          .eq("ticket_type_id", ticketId)

        // Insert new links if any addons are selected
        if (data.linked_addon_ids.length > 0) {
          const links = data.linked_addon_ids.map((addonId) => ({
            addon_id: addonId,
            ticket_type_id: ticketId,
          }))
          await (supabase as any).from("addon_ticket_links").insert(links)
        }
      }

      return ticketId
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["event-tickets", eventId] })
      await queryClient.invalidateQueries({ queryKey: ["addon-ticket-links", eventId] })
      setIsCreateOpen(false)
      setEditingTicket(null)
      setFormData(initialFormData)
      // Refresh selected ticket data after edit
      if (editingTicket && selectedTicket?.id === editingTicket.id) {
        // Fetch fresh data for the selected ticket
        const { data } = await (supabase as any)
          .from("ticket_types")
          .select("*")
          .eq("id", editingTicket.id)
          .single()
        if (data) {
          setSelectedTicket(data)
        }
      }
      toast.success(editingTicket ? "Ticket updated" : "Ticket created")
    },
  })

  const deleteTicket = useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await (supabase as any)
        .from("ticket_types")
        .delete()
        .eq("id", ticketId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-tickets", eventId] })
      setDeleteConfirm(null)
      setSelectedTicket(null)
      toast.success("Ticket deleted")
    },
  })

  const toggleStatus = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "active" ? "paused" : "active"
      const { error } = await (supabase as any)
        .from("ticket_types")
        .update({ status: newStatus })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-tickets", eventId] })
    },
  })

  const toggleVisibility = useMutation({
    mutationFn: async ({ id, isHidden }: { id: string; isHidden: boolean }) => {
      const { error } = await (supabase as any)
        .from("ticket_types")
        .update({ is_hidden: !isHidden })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-tickets", eventId] })
    },
  })

  const duplicateTicket = useMutation({
    mutationFn: async (ticket: TicketType) => {
      const { error, data } = await (supabase as any)
        .from("ticket_types")
        .insert({
          event_id: eventId,
          name: `${ticket.name} (Copy)`,
          description: ticket.description,
          price: ticket.price,
          currency: ticket.currency,
          quantity_total: ticket.quantity_total,
          quantity_sold: 0, // Reset sold count
          min_per_order: ticket.min_per_order,
          max_per_order: ticket.max_per_order,
          sale_start_date: ticket.sale_start_date,
          sale_end_date: ticket.sale_end_date,
          status: "draft", // Start as draft
          is_hidden: ticket.is_hidden,
          requires_approval: ticket.requires_approval,
          tax_percentage: ticket.tax_percentage,
          form_id: ticket.form_id,
          exclusivity_group: ticket.exclusivity_group,
          sort_order: (tickets?.length || 0) + 1,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (newTicket) => {
      queryClient.invalidateQueries({ queryKey: ["event-tickets", eventId] })
      setSelectedTicket(null)
      toast.success("Ticket duplicated! Edit it to customize.")
    },
  })

  const getTicketLink = (ticketId: string) => {
    if (!event?.slug) return ""
    return `${baseUrl}/register/${event.slug}?ticket=${ticketId}`
  }

  const copyTicketLink = (ticketId: string) => {
    navigator.clipboard.writeText(getTicketLink(ticketId))
    setCopiedLink(true)
    toast.success("Link copied!")
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const openPreview = () => {
    if (event?.slug) {
      window.open(`/register/${event.slug}`, "_blank")
    }
  }

  const openEditDialog = (ticket: TicketType) => {
    setEditingTicket(ticket)
    // Get linked addon IDs for this ticket
    const linkedAddons = addonTicketLinks
      ?.filter(link => link.ticket_type_id === ticket.id)
      .map(link => link.addon_id) || []

    setFormData({
      name: ticket.name,
      description: ticket.description || "",
      price: ticket.price,
      quantity_total: ticket.quantity_total,
      min_per_order: ticket.min_per_order ?? 1,
      max_per_order: ticket.max_per_order ?? 10,
      sale_start_date: ticket.sale_start_date?.split("T")[0] || "",
      sale_end_date: ticket.sale_end_date?.split("T")[0] || "",
      status: ticket.status,
      is_hidden: ticket.is_hidden,
      requires_approval: ticket.requires_approval,
      tax_percentage: ticket.tax_percentage,
      form_id: ticket.form_id,
      exclusivity_group: ticket.exclusivity_group || "",
      linked_addon_ids: linkedAddons,
    })
    setDialogTab("basic")
    setIsCreateOpen(true)
  }

  const openCreateDialog = () => {
    setEditingTicket(null)
    setFormData(initialFormData)
    setDialogTab("basic")
    setIsCreateOpen(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      case "paused": return "bg-amber-500/10 text-amber-600 border-amber-500/20"
      case "draft": return "bg-slate-500/10 text-slate-600 border-slate-500/20"
      case "sold_out": return "bg-rose-500/10 text-rose-600 border-rose-500/20"
      default: return "bg-slate-500/10 text-slate-600 border-slate-500/20"
    }
  }

  const getAvailability = (ticket: TicketType) => {
    if (!ticket.quantity_total) return { available: "Unlimited", percentage: 0, oversold: 0 }
    const rawAvailable = ticket.quantity_total - ticket.quantity_sold
    const available = rawAvailable < 0 ? 0 : rawAvailable
    const oversold = rawAvailable < 0 ? Math.abs(rawAvailable) : 0
    const percentage = Math.min(100, Math.round((ticket.quantity_sold / ticket.quantity_total) * 100))
    return { available, percentage, oversold }
  }

  return (
    <div className="flex h-full">
      {/* Left Panel - Ticket List */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-300",
        selectedTicket ? "mr-0" : ""
      )}>
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
              <p className="text-muted-foreground mt-1">Manage ticket types for your event</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={openPreview} disabled={!event?.slug}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-secondary/30 rounded-xl p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Ticket className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalTickets}</p>
                  <p className="text-xs text-muted-foreground">Ticket Types</p>
                </div>
              </div>
            </div>
            <div className="bg-secondary/30 rounded-xl p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeTickets}</p>
                  <p className="text-xs text-muted-foreground">On Sale</p>
                </div>
              </div>
            </div>
            <div className="bg-secondary/30 rounded-xl p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalSold}</p>
                  <p className="text-xs text-muted-foreground">Sold</p>
                </div>
              </div>
            </div>
            <div className="bg-secondary/30 rounded-xl p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                </div>
              </div>
            </div>
          </div>

          {/* Setup Guidance Banner - Show when no active tickets */}
          {stats.activeTickets === 0 && stats.totalTickets > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-600 dark:text-amber-400">No tickets on sale</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You have {stats.totalTickets} ticket type{stats.totalTickets > 1 ? "s" : ""} but none are currently on sale.
                    To start selling tickets:
                  </p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                    <li>Click on a ticket below to open the editor</li>
                    <li>Change the <strong>Status</strong> from Paused/Draft to <strong>Active</strong></li>
                    <li>Save your changes</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Setup Guidance Banner - Show when no tickets at all */}
          {stats.totalTickets === 0 && (
            <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Ticket className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-600 dark:text-blue-400">Create your first ticket</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start by creating ticket types for your event. Each ticket type can have different prices, quantities, and availability dates.
                  </p>
                  <Button size="sm" className="mt-3" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Ticket
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="px-6 border-b border-border">
          <div className="flex items-center gap-1 overflow-x-auto pb-px">
            {[
              { id: "all", label: "All", count: statusCounts.all },
              { id: "active", label: "On Sale", count: statusCounts.active },
              { id: "paused", label: "Paused", count: statusCounts.paused },
              { id: "scheduled", label: "Scheduled", count: statusCounts.scheduled },
              { id: "sold_out", label: "Sold Out", count: statusCounts.sold_out },
              { id: "draft", label: "Drafts", count: statusCounts.draft },
              { id: "expired", label: "Archived", count: statusCounts.expired },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  statusFilter === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={cn(
                    "ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                    statusFilter === tab.id
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Ticket List */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : tickets?.length === 0 ? (
            <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
              <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                <Ticket className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No tickets yet</h3>
              <p className="text-muted-foreground mb-6">Create your first ticket type to start selling.</p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Create Ticket
              </Button>
            </div>
          ) : filteredTickets?.length === 0 ? (
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
              <div className="h-12 w-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-3">
                <Ticket className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-medium mb-1">No {statusFilter === "all" ? "" : statusFilter.replace("_", " ")} tickets</h3>
              <p className="text-sm text-muted-foreground">
                {statusFilter === "active" && "No tickets are currently on sale."}
                {statusFilter === "paused" && "No tickets are paused."}
                {statusFilter === "scheduled" && "No tickets are scheduled for future sale."}
                {statusFilter === "sold_out" && "No tickets are sold out."}
                {statusFilter === "draft" && "No draft tickets."}
                {statusFilter === "expired" && "No archived/expired tickets."}
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setStatusFilter("all")}>
                View All Tickets
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTickets?.map((ticket) => {
                const { available, percentage, oversold } = getAvailability(ticket)
                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={cn(
                      "group p-4 rounded-xl border cursor-pointer transition-all duration-200",
                      selectedTicket?.id === ticket.id
                        ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                        : "bg-card border-border hover:border-primary/20 hover:bg-secondary/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Status indicator */}
                        <div className={cn(
                          "h-2 w-2 rounded-full flex-shrink-0",
                          ticket.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                        )} />

                        {/* Ticket info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground truncate">{ticket.name}</h3>
                            {ticket.is_hidden && (
                              <Badge variant="outline" className="text-[10px] gap-1 flex-shrink-0">
                                <EyeOff className="h-3 w-3" />
                                Private
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {ticket.price === 0 ? "Free" : `₹${ticket.price.toLocaleString()}`}
                            </span>
                            <span>•</span>
                            <span>{ticket.quantity_sold} sold</span>
                            {ticket.quantity_total && (
                              <>
                                <span>•</span>
                                <span className={oversold > 0 ? "text-amber-500" : percentage >= 90 ? "text-rose-500" : ""}>
                                  {oversold > 0 ? `+${oversold} oversold` : available === 0 ? "Sold out" : `${available} left`}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick actions */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Switch
                          checked={ticket.status === "active"}
                          onCheckedChange={() => toggleStatus.mutate({ id: ticket.id, currentStatus: ticket.status })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      {/* Arrow indicator */}
                      <ArrowUpRight className={cn(
                        "h-4 w-4 ml-4 transition-all",
                        selectedTicket?.id === ticket.id ? "text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                      )} />
                    </div>

                    {/* Progress bar */}
                    {ticket.quantity_total && (
                      <div className="mt-3 ml-6">
                        <div className="h-1 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              percentage >= 90 ? "bg-rose-500" : percentage >= 70 ? "bg-amber-500" : "bg-primary"
                            )}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Add button */}
              <button
                onClick={openCreateDialog}
                className="w-full p-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Ticket
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Slide Over Details */}
      <SlideOver
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket?.name}
        subtitle={selectedTicket?.status === "active" ? "On Sale" : "Not on sale"}
        width="xl"
        showOverlay={false}
      >
        {selectedTicket && (
          <>
            {/* Tabs */}
            <SlideOverTabs
              tabs={[
                { id: "details", label: "Details" },
                { id: "analytics", label: "Analytics" },
                { id: "settings", label: "Settings" },
              ]}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            {activeTab === "details" && (
              <>
                {/* Quick Stats */}
                <SlideOverSection>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-secondary/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{selectedTicket.quantity_sold}</p>
                      <p className="text-xs text-muted-foreground">Sold</p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {selectedTicket.quantity_total
                          ? Math.max(0, selectedTicket.quantity_total - selectedTicket.quantity_sold)
                          : "∞"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedTicket.quantity_total && selectedTicket.quantity_sold > selectedTicket.quantity_total
                          ? `Oversold by ${selectedTicket.quantity_sold - selectedTicket.quantity_total}`
                          : "Available"}
                      </p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">
                        ₹{((selectedTicket as any).actual_revenue || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                    </div>
                  </div>
                </SlideOverSection>

                {/* Pricing */}
                <SlideOverSection title="Pricing" className="border-t border-border">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Price</span>
                      <span className="font-medium">
                        {selectedTicket.price === 0 ? "Free" : `₹${selectedTicket.price.toLocaleString()}`}
                      </span>
                    </div>
                    {selectedTicket.tax_percentage > 0 && selectedTicket.price > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">GST ({selectedTicket.tax_percentage}%)</span>
                          <span className="font-medium">
                            ₹{((selectedTicket.price * selectedTicket.tax_percentage) / 100).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-border">
                          <span className="font-medium">Total Price</span>
                          <span className="font-bold text-primary">
                            ₹{(selectedTicket.price * (1 + selectedTicket.tax_percentage / 100)).toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </SlideOverSection>

                {/* Availability */}
                <SlideOverSection title="Availability" className="border-t border-border">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantity</span>
                      <span className="font-medium">
                        {selectedTicket.quantity_total || "Unlimited"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Per Order</span>
                      <span className="font-medium">
                        {selectedTicket.min_per_order} - {selectedTicket.max_per_order}
                      </span>
                    </div>
                    {selectedTicket.sale_start_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sale Starts</span>
                        <span className="font-medium">
                          {format(new Date(selectedTicket.sale_start_date), "d MMM yyyy")}
                        </span>
                      </div>
                    )}
                    {selectedTicket.sale_end_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sale Ends</span>
                        <span className="font-medium">
                          {format(new Date(selectedTicket.sale_end_date), "d MMM yyyy")}
                        </span>
                      </div>
                    )}
                  </div>
                </SlideOverSection>

                {/* Direct Link */}
                {selectedTicket.is_hidden && (
                  <SlideOverSection title="Private Link" className="border-t border-border">
                    <div className="flex items-center gap-2">
                      <Input
                        value={getTicketLink(selectedTicket.id)}
                        readOnly
                        className="text-xs bg-secondary/50"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyTicketLink(selectedTicket.id)}
                      >
                        {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Share this link to allow access to this private ticket
                    </p>
                  </SlideOverSection>
                )}

                {/* Description */}
                {selectedTicket.description && (
                  <SlideOverSection title="Description" className="border-t border-border">
                    <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
                  </SlideOverSection>
                )}
              </>
            )}

            {activeTab === "analytics" && (
              <SlideOverSection>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h4 className="font-medium mb-2">Sales Analytics</h4>
                  <p className="text-sm text-muted-foreground">
                    Detailed analytics coming soon
                  </p>
                </div>
              </SlideOverSection>
            )}

            {activeTab === "settings" && (
              <SlideOverSection>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Ticket Status</p>
                      <p className="text-xs text-muted-foreground">Turn on to start selling</p>
                    </div>
                    <Switch
                      checked={selectedTicket.status === "active"}
                      onCheckedChange={() => toggleStatus.mutate({ id: selectedTicket.id, currentStatus: selectedTicket.status })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Hidden Ticket</p>
                      <p className="text-xs text-muted-foreground">Only accessible via direct link</p>
                    </div>
                    <Switch
                      checked={selectedTicket.is_hidden}
                      onCheckedChange={() => toggleVisibility.mutate({ id: selectedTicket.id, isHidden: selectedTicket.is_hidden })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Requires Approval</p>
                      <p className="text-xs text-muted-foreground">Manual approval for each registration</p>
                    </div>
                    <Badge variant="outline">
                      {selectedTicket.requires_approval ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              </SlideOverSection>
            )}

            {/* Footer Actions */}
            <SlideOverFooter className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                onClick={() => setDeleteConfirm(selectedTicket.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => duplicateTicket.mutate(selectedTicket)}
                  disabled={duplicateTicket.isPending}
                >
                  {duplicateTicket.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CopyPlus className="h-4 w-4 mr-2" />
                  )}
                  Duplicate
                </Button>
                <Button size="sm" onClick={() => openEditDialog(selectedTicket)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </SlideOverFooter>
          </>
        )}
      </SlideOver>

      {/* Create/Edit Dialog with Tabs */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle>{editingTicket ? "Edit Ticket" : "Create Ticket"}</DialogTitle>
              <Badge variant="outline" className={formData.status === "active" ? "bg-emerald-50 text-emerald-600" : ""}>
                {formData.status === "active" ? "Active" : formData.status === "draft" ? "Draft" : formData.status}
              </Badge>
            </div>
            <DialogDescription className="sr-only">
              {editingTicket ? "Edit ticket type details" : "Create a new ticket type for this event"}
            </DialogDescription>
          </DialogHeader>

          {/* Tabs Navigation */}
          <Tabs value={dialogTab} onValueChange={setDialogTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
              <TabsTrigger value="basic" className="text-xs gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="pricing" className="text-xs gap-1.5">
                <IndianRupee className="h-3.5 w-3.5" />
                Pricing
              </TabsTrigger>
              <TabsTrigger value="addons" className="text-xs gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Add-ons
              </TabsTrigger>
              <TabsTrigger value="form" className="text-xs gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Form
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs gap-1.5">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto py-4">
              {/* Basic Tab */}
              <TabsContent value="basic" className="mt-0 space-y-4">
                <div>
                  <label className="text-sm font-medium">Ticket Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Early Bird, Regular, VIP"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Quantity of tickets available</label>
                  <Input
                    type="number"
                    value={formData.quantity_total || ""}
                    onChange={(e) => setFormData({ ...formData, quantity_total: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="∞"
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave blank for unlimited tickets</p>
                </div>

                <div>
                  <label className="text-sm font-medium">Ticket description</label>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    This information will be displayed along with your ticket in the registration page
                  </p>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What's included with this ticket?"
                    rows={3}
                    className="mt-1.5"
                  />
                </div>
              </TabsContent>

              {/* Pricing Tab */}
              <TabsContent value="pricing" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Price (₹)</label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Set to 0 for free tickets</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">GST (%)</label>
                    <Input
                      type="number"
                      value={formData.tax_percentage}
                      onChange={(e) => setFormData({ ...formData, tax_percentage: parseFloat(e.target.value) || 0 })}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                {formData.price > 0 && (
                  <div className="p-4 bg-secondary/30 rounded-xl">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base Price</span>
                      <span>₹{formData.price.toLocaleString()}</span>
                    </div>
                    {formData.tax_percentage > 0 && (
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-muted-foreground">GST ({formData.tax_percentage}%)</span>
                        <span>₹{((formData.price * formData.tax_percentage) / 100).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium mt-2 pt-2 border-t">
                      <span>Total Price</span>
                      <span className="text-primary">₹{(formData.price * (1 + formData.tax_percentage / 100)).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Min per Order</label>
                    <Input
                      type="number"
                      value={formData.min_per_order}
                      onChange={(e) => setFormData({ ...formData, min_per_order: parseInt(e.target.value) || 1 })}
                      min={1}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Max per Order</label>
                    <Input
                      type="number"
                      value={formData.max_per_order}
                      onChange={(e) => setFormData({ ...formData, max_per_order: parseInt(e.target.value) || 10 })}
                      min={1}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Add-ons Tab */}
              <TabsContent value="addons" className="mt-0 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select which add-ons should be available for purchase with this ticket type.
                    Unselected add-ons will not be shown during registration.
                  </p>

                  {eventAddons && eventAddons.length > 0 ? (
                    <div className="space-y-2">
                      {eventAddons.map((addon) => (
                        <div
                          key={addon.id}
                          className={cn(
                            "flex items-center justify-between p-3 border rounded-lg transition-colors",
                            formData.linked_addon_ids.includes(addon.id)
                              ? "bg-primary/5 border-primary/30"
                              : "bg-secondary/30 border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={formData.linked_addon_ids.includes(addon.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({
                                    ...formData,
                                    linked_addon_ids: [...formData.linked_addon_ids, addon.id],
                                  })
                                } else {
                                  setFormData({
                                    ...formData,
                                    linked_addon_ids: formData.linked_addon_ids.filter((id) => id !== addon.id),
                                  })
                                }
                              }}
                            />
                            <div>
                              <p className="font-medium text-sm">{addon.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {addon.price === 0 ? "Free" : `₹${addon.price.toLocaleString()}`}
                              </p>
                            </div>
                          </div>
                          {!addon.is_active && (
                            <Badge variant="outline" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No add-ons created for this event yet.</p>
                      <p className="text-xs mt-1">Go to Add-ons section to create some.</p>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">
                    <strong>Tip:</strong> If no add-ons are selected, all active add-ons will be available for this ticket.
                    Select specific add-ons to restrict availability.
                  </p>
                </div>
              </TabsContent>

              {/* Form Tab */}
              <TabsContent value="form" className="mt-0 space-y-4">
                <div>
                  <label className="text-sm font-medium">Registration Form</label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Attach a custom form that will appear when this ticket is selected during registration.
                  </p>
                  <Select
                    value={formData.form_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, form_id: value === "none" ? null : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a form (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No additional form</SelectItem>
                      {availableForms?.map((form) => (
                        <SelectItem key={form.id} value={form.id}>
                          {form.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableForms?.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      No published forms available. Go to Forms section to create one.
                    </p>
                  )}
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700">
                    <strong>Note:</strong> Basic attendee information (name, email, phone) is always collected.
                    Use custom forms for additional fields like dietary preferences, T-shirt sizes, etc.
                  </p>
                </div>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="mt-0 space-y-4">
                {/* Sale Period */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Sale Period
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground">Start Date</label>
                      <Input
                        type="date"
                        value={formData.sale_start_date}
                        onChange={(e) => setFormData({ ...formData, sale_start_date: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">End Date</label>
                      <Input
                        type="date"
                        value={formData.sale_end_date}
                        onChange={(e) => setFormData({ ...formData, sale_end_date: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Visibility & Approval */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Hidden Ticket</p>
                      <p className="text-xs text-muted-foreground">Only accessible via direct link</p>
                    </div>
                    <Switch
                      checked={formData.is_hidden}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_hidden: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Requires Approval</p>
                      <p className="text-xs text-muted-foreground">Manual approval needed for each registration</p>
                    </div>
                    <Switch
                      checked={formData.requires_approval}
                      onCheckedChange={(checked) => setFormData({ ...formData, requires_approval: checked })}
                    />
                  </div>
                </div>

                {/* Exclusivity Group */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Exclusivity Group</h4>
                  <p className="text-xs text-muted-foreground">
                    Tickets in the same group are mutually exclusive - only ONE can be selected per order.
                  </p>
                  <Input
                    placeholder="e.g., exam-specialty, vip-access"
                    value={formData.exclusivity_group}
                    onChange={(e) => setFormData({ ...formData, exclusivity_group: e.target.value })}
                  />
                </div>

                {/* Status */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Ticket Status</h4>
                  <Select
                    value={formData.status}
                    onValueChange={(value: typeof formData.status) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft - Not visible</SelectItem>
                      <SelectItem value="active">Active - On sale</SelectItem>
                      <SelectItem value="paused">Paused - Temporarily hidden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveTicket.mutate({ ...formData, id: editingTicket?.id })}
              disabled={!formData.name || saveTicket.isPending}
            >
              {saveTicket.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : editingTicket ? (
                "Save Changes"
              ) : (
                "Create Ticket"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Ticket?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Existing registrations will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteTicket.mutate(deleteConfirm)}
              disabled={deleteTicket.isPending}
            >
              {deleteTicket.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
