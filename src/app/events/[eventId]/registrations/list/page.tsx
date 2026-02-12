"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  UserCheck,
  MoreHorizontal,
  Eye,
  Mail,
  Trash2,
  Loader2,
  IndianRupee,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  RefreshCw,
  QrCode,
  Send,
  UserPlus,
  Ticket,
  Phone,
  Building2,
  Edit2,
  Upload,
  FileSpreadsheet,
  ExternalLink,
  Printer,
  Package,
  MessageSquare,
  MailCheck,
  MailOpen,
  MousePointerClick,
  AlertCircle,
  Award,
  FileDown,
  ImageIcon,
  X,
  BadgeCheck,
  Users,
  CheckSquare,
  FileText,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { SlideOver, SlideOverSection, SlideOverFooter } from "@/components/ui/slide-over"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { HelpTooltip } from "@/components/ui/help-tooltip"
import { logActivityClient } from "@/lib/activity-logger-client"

interface Registration {
  id: string
  event_id: string
  ticket_type_id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  attendee_institution: string | null
  attendee_designation: string | null
  unit_price: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  currency: string
  status: "pending" | "confirmed" | "cancelled" | "refunded"
  payment_status: "pending" | "completed" | "failed" | "refunded"
  checked_in: boolean
  checked_in_at: string | null
  confirmed_at: string | null
  discount_code_id: string | null
  notes: string | null
  created_at: string
  updated_at: string | null
  badge_url: string | null
  badge_generated_at: string | null
  certificate_url: string | null
  certificate_generated_at: string | null
  ticket_type?: {
    name: string
    price: number
  }
}

interface TicketType {
  id: string
  name: string
  price: number
}

export default function RegistrationsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [ticketFilter, setTicketFilter] = useState<string>("all")
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [_activeTab, _setActiveTab] = useState("details")
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editData, setEditData] = useState<Partial<Registration>>({})
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importTicketId, setImportTicketId] = useState<string>("")
  const [importCsvData, setImportCsvData] = useState("")
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [importResult, setImportResult] = useState<any>(null)
  const [isPrintingBadge, setIsPrintingBadge] = useState<string | null>(null)
  const [isEmailingBadge, setIsEmailingBadge] = useState<string | null>(null)
  const [isGeneratingBadge, setIsGeneratingBadge] = useState<string | null>(null)
  const [_isGeneratingCertificate, _setIsGeneratingCertificate] = useState<string | null>(null)
  const [isSwitchTicketOpen, setIsSwitchTicketOpen] = useState(false)
  const [switchToTicketId, setSwitchToTicketId] = useState<string>("")
  const [isTransferEventOpen, setIsTransferEventOpen] = useState(false)
  const [transferToEventId, setTransferToEventId] = useState<string>("")
  const [transferToTicketId, setTransferToTicketId] = useState<string>("")

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [_isBulkActionOpen, setIsBulkActionOpen] = useState(false)
  const [_bulkAction, _setBulkAction] = useState<string>("")
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  // Add addon state
  const [isAddAddonOpen, setIsAddAddonOpen] = useState(false)
  const [selectedAddonId, setSelectedAddonId] = useState<string>("")
  const [selectedVariantId, setSelectedVariantId] = useState<string>("")
  const [addonQuantity, setAddonQuantity] = useState(1)
  const [_isAddingAddon, _setIsAddingAddon] = useState(false)

  // Fetch default badge template
  const { data: badgeTemplates } = useQuery({
    queryKey: ["badge-templates", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/badge-templates?event_id=${eventId}`)
      if (!res.ok) return []
      return res.json()
    },
  })

  // Helper function to find the correct badge template for a registration
  // Priority: 1) Template with matching ticket_type_id, 2) Default template, 3) None
  const findBadgeTemplate = (ticketTypeId: string) => {
    if (!badgeTemplates || badgeTemplates.length === 0) return null

    // First: Try to find a template that explicitly includes this ticket type
    const specificTemplate = badgeTemplates.find((t: any) =>
      t.ticket_type_ids && t.ticket_type_ids.includes(ticketTypeId)
    )
    if (specificTemplate) return specificTemplate

    // Second: Fall back to default template (but ONLY if it's a general default, not ticket-specific)
    const defaultTemplate = badgeTemplates.find((t: any) =>
      t.is_default && (!t.ticket_type_ids || t.ticket_type_ids.length === 0)
    )
    if (defaultTemplate) return defaultTemplate

    // Third: Use any template marked as default (even if it has ticket_type_ids)
    const anyDefault = badgeTemplates.find((t: any) => t.is_default)
    if (anyDefault) {
      // Log warning - using default that might not be appropriate
      console.warn(`Using default template "${anyDefault.name}" for ticket_type_id ${ticketTypeId} - no specific match found`)
    }
    return anyDefault
  }

  // Print badge for single registration
  const printBadge = async (registration: Registration) => {
    // Find the appropriate template for this registration's ticket type
    const template = findBadgeTemplate(registration.ticket_type_id)

    if (!template) {
      console.log("Badge templates data:", badgeTemplates)
      toast.error(`No badge template found for this ticket type. Please create or assign a badge template.`)
      return
    }

    setIsPrintingBadge(registration.id)
    try {
      const res = await fetch("/api/badges/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          template_id: template.id,
          single_registration_id: registration.id,
        }),
      })

      if (!res.ok) throw new Error("Failed to generate badge")

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `badge-${registration.registration_number}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success("Badge downloaded!")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsPrintingBadge(null)
    }
  }

  // Email badge to individual registration
  const emailBadge = async (registration: Registration) => {
    if (registration.status !== "confirmed") {
      toast.error("Cannot email badge - registration is not confirmed")
      return
    }

    setIsEmailingBadge(registration.id)
    try {
      const res = await fetch("/api/badges/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: registration.id,
          event_id: eventId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to send badge email")
      }

      toast.success(`Badge sent to ${registration.attendee_email}`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsEmailingBadge(null)
    }
  }

  // Generate and store badge for registration
  const generateBadge = async (registration: Registration) => {
    const template = findBadgeTemplate(registration.ticket_type_id)

    if (!template) {
      toast.error("No badge template found for this ticket type. Please create or assign a badge template.")
      return
    }

    setIsGeneratingBadge(registration.id)
    try {
      const res = await fetch("/api/badges/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          template_id: template.id,
          single_registration_id: registration.id,
          store_badges: true,
        }),
      })

      if (!res.ok) throw new Error("Failed to generate badge")

      toast.success("Badge generated successfully!")
      queryClient.invalidateQueries({ queryKey: ["event-registrations", eventId] })

      // Refresh selected registration data
      if (selectedRegistration?.id === registration.id) {
        const { data: updated } = await supabase
          .from("registrations")
          .select("*, ticket_type:ticket_types(name, price)")
          .eq("id", registration.id)
          .single()
        if (updated) setSelectedRegistration(updated as Registration)
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsGeneratingBadge(null)
    }
  }

  // Fetch registrations for this event
  const { data: registrations, isLoading } = useQuery({
    queryKey: ["event-registrations", eventId, statusFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from("registrations")
        .select(`
          *,
          ticket_type:ticket_types(name, price)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Registration[]
    },
    enabled: !!eventId,
  })

  // Fetch ticket types for filtering
  const { data: ticketTypes } = useQuery({
    queryKey: ["event-ticket-types", eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ticket_types")
        .select("id, name, price")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })

      if (error) throw error
      return data as TicketType[]
    },
    enabled: !!eventId,
  })

  // Fetch event slug for View Page button
  const { data: event } = useQuery({
    queryKey: ["event-slug", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("slug")
        .eq("id", eventId)
        .single()

      if (error) throw error
      return data as { slug: string | null }
    },
    enabled: !!eventId,
  })

  // Fetch addons for selected registration
  const { data: registrationAddons } = useQuery({
    queryKey: ["registration-addons", selectedRegistration?.id],
    queryFn: async () => {
      if (!selectedRegistration?.id) return []
      const { data, error } = await (supabase as any)
        .from("registration_addons")
        .select(`
          id,
          quantity,
          unit_price,
          total_price,
          addon:addons(id, name, is_course, price)
        `)
        .eq("registration_id", selectedRegistration.id)

      if (error) throw error
      // Use stored prices, fallback to addon price if not set
      return (data || []).map((item: any) => {
        const qty = item.quantity || 1
        const addonPrice = item.addon?.price || 0
        return {
          ...item,
          unit_price: item.unit_price || addonPrice,
          total_price: item.total_price || (addonPrice * qty),
        }
      })
    },
    enabled: !!selectedRegistration?.id,
  })

  // Fetch available addons for the event (for adding to registration)
  const { data: availableAddons } = useQuery({
    queryKey: ["event-addons", eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("addons")
        .select(`
          id,
          name,
          price,
          max_quantity,
          has_variants,
          variants:addon_variants(id, name, price_adjustment, is_available)
        `)
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("sort_order")

      if (error) throw error
      return data || []
    },
    enabled: !!eventId && isAddAddonOpen,
  })

  // Add addon mutation
  const addAddonMutation = useMutation({
    mutationFn: async (data: {
      registrationId: string
      addonId: string
      variantId?: string
      quantity: number
    }) => {
      const addon = availableAddons?.find((a: any) => a.id === data.addonId)
      const variant = addon?.variants?.find((v: any) => v.id === data.variantId)
      const unitPrice = addon?.price + (variant?.price_adjustment || 0)

      const response = await fetch(`/api/registrations/${data.registrationId}/addons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addons: [{
            addonId: data.addonId,
            variantId: data.variantId || null,
            quantity: data.quantity,
            unitPrice: unitPrice,
            totalPrice: unitPrice * data.quantity,
          }]
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to add addon")
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registration-addons", selectedRegistration?.id] })
      setIsAddAddonOpen(false)
      setSelectedAddonId("")
      setSelectedVariantId("")
      setAddonQuantity(1)
      toast.success("Add-on added successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete addon mutation
  const deleteAddonMutation = useMutation({
    mutationFn: async (data: { registrationId: string; addonId: string; variantId?: string }) => {
      const url = new URL(`/api/registrations/${data.registrationId}/addons`, window.location.origin)
      url.searchParams.set("addon_id", data.addonId)
      if (data.variantId) url.searchParams.set("variant_id", data.variantId)

      const response = await fetch(url.toString(), { method: "DELETE" })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to remove addon")
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registration-addons", selectedRegistration?.id] })
      toast.success("Add-on removed")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Fetch email logs for selected registration
  const { data: emailLogs } = useQuery({
    queryKey: ["registration-emails", selectedRegistration?.id],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("email_logs")
          .select("*")
          .eq("registration_id", selectedRegistration!.id)
          .order("sent_at", { ascending: false })

        if (error) {
          // Silently handle if table doesn't exist
          console.warn("email_logs query error:", error.message)
          return []
        }
        return data || []
      } catch {
        return []
      }
    },
    enabled: !!selectedRegistration?.id,
  })

  // Fetch check-in history for selected registration
  const { data: _checkinHistory } = useQuery({
    queryKey: ["registration-checkins", selectedRegistration?.id],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("checkin_audit_log")
          .select("*")
          .eq("registration_id", selectedRegistration!.id)
          .order("created_at", { ascending: false })

        if (error) {
          // Silently handle if table doesn't exist
          console.warn("checkin_audit_log query error:", error.message)
          return []
        }
        return data || []
      } catch {
        return []
      }
    },
    enabled: !!selectedRegistration?.id,
  })

  // Fetch related registrations (same email)
  const { data: relatedRegistrations } = useQuery({
    queryKey: ["related-registrations", selectedRegistration?.attendee_email, eventId],
    queryFn: async () => {
      if (!selectedRegistration?.attendee_email) return []
      const { data, error } = await (supabase as any)
        .from("registrations")
        .select(`
          id,
          registration_number,
          attendee_name,
          status,
          created_at,
          ticket_type:ticket_types(name)
        `)
        .eq("event_id", eventId)
        .ilike("attendee_email", selectedRegistration.attendee_email)
        .neq("id", selectedRegistration.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.warn("related registrations query error:", error.message)
        return []
      }
      return data || []
    },
    enabled: !!selectedRegistration?.attendee_email && !!selectedRegistration?.id,
  })

  // Update registration status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("registrations")
        .update({ status })
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations", eventId] })
      setSelectedRegistration(null)
    },
  })

  // Check-in mutation
  const _checkIn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          checked_in: true,
          checked_in_at: new Date().toISOString()
        })
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations", eventId] })
    },
  })

  // Delete registration mutation
  const deleteRegistration = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("registrations")
        .delete()
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations", eventId] })
      setDeleteConfirm(null)
    },
  })

  // Edit registration mutation
  const editRegistration = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Registration> }) => {
      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          attendee_name: data.updates.attendee_name,
          attendee_email: data.updates.attendee_email,
          attendee_phone: data.updates.attendee_phone,
          attendee_institution: data.updates.attendee_institution,
          attendee_designation: data.updates.attendee_designation,
          notes: data.updates.notes,
        })
        .eq("id", data.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations", eventId] })
      setIsEditOpen(false)
      setSelectedRegistration(null)
      toast.success("Attendee updated successfully")
    },
  })

  const openEditDialog = () => {
    if (selectedRegistration) {
      setEditData({
        attendee_name: selectedRegistration.attendee_name,
        attendee_email: selectedRegistration.attendee_email,
        attendee_phone: selectedRegistration.attendee_phone || "",
        attendee_institution: selectedRegistration.attendee_institution || "",
        attendee_designation: selectedRegistration.attendee_designation || "",
        notes: selectedRegistration.notes || "",
      })
      setIsEditOpen(true)
    }
  }

  // Switch ticket mutation
  const switchTicket = useMutation({
    mutationFn: async (data: { registrationId: string; newTicketId: string }) => {
      const response = await fetch(`/api/registrations/${data.registrationId}/switch-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_ticket_type_id: data.newTicketId }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to switch ticket")
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations", eventId] })
      queryClient.invalidateQueries({ queryKey: ["event-ticket-types", eventId] })
      setIsSwitchTicketOpen(false)
      setSwitchToTicketId("")
      setSelectedRegistration(null)
      toast.success(data.message || "Ticket switched successfully")
      if (data.priceChange?.difference !== 0) {
        const diff = data.priceChange.difference
        toast.info(`Price ${diff > 0 ? "increased" : "decreased"} by ${Math.abs(diff)}`)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const openSwitchTicketDialog = () => {
    if (selectedRegistration) {
      setSwitchToTicketId("")
      setIsSwitchTicketOpen(true)
    }
  }

  // Fetch all events for transfer
  const { data: allEvents } = useQuery({
    queryKey: ["all-events-for-transfer"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("events")
        .select("id, name, short_name, start_date, end_date")
        .neq("id", eventId)
        .order("start_date", { ascending: false })
        .limit(50)

      if (error) throw error
      return data as { id: string; name: string; short_name: string; start_date: string; end_date: string }[]
    },
    enabled: isTransferEventOpen,
  })

  // Fetch tickets for selected transfer event
  const { data: transferEventTickets } = useQuery({
    queryKey: ["transfer-event-tickets", transferToEventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ticket_types")
        .select("id, name, price, quantity_total, quantity_sold, status")
        .eq("event_id", transferToEventId)
        .eq("status", "active")
        .order("sort_order", { ascending: true })

      if (error) throw error
      return data as { id: string; name: string; price: number; quantity_total: number; quantity_sold: number; status: string }[]
    },
    enabled: !!transferToEventId,
  })

  // Transfer to event mutation
  const transferEvent = useMutation({
    mutationFn: async (data: { registrationId: string; newEventId: string; newTicketId: string }) => {
      const response = await fetch(`/api/registrations/${data.registrationId}/transfer-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_event_id: data.newEventId,
          new_ticket_type_id: data.newTicketId,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to transfer registration")
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations", eventId] })
      queryClient.invalidateQueries({ queryKey: ["event-ticket-types", eventId] })
      setIsTransferEventOpen(false)
      setTransferToEventId("")
      setTransferToTicketId("")
      setSelectedRegistration(null)
      toast.success(data.message || "Registration transferred successfully")
      toast.info(`New registration #: ${data.transfer?.newRegistrationNumber}`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const openTransferEventDialog = () => {
    if (selectedRegistration) {
      setTransferToEventId("")
      setTransferToTicketId("")
      setIsTransferEventOpen(true)
    }
  }

  // Import mutation
  const importRegistrations = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/registrations/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          ticket_type_id: importTicketId,
          registrations: importPreview,
          status: "confirmed",
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Import failed")
      }
      return response.json()
    },
    onSuccess: (data) => {
      setImportResult(data)
      queryClient.invalidateQueries({ queryKey: ["event-registrations", eventId] })
      queryClient.invalidateQueries({ queryKey: ["event-ticket-types", eventId] })
      toast.success(`Imported ${data.summary.created} attendees successfully!`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Parse CSV data (Tito-style with ticket column)
  const parseCsvData = (csv: string) => {
    const lines = csv.trim().split("\n").filter(line => line.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase())

    // Find column indices
    const colMap: Record<string, number> = {}
    const colNames = ["ticket", "name", "full_name", "fullname", "email", "email_address",
      "phone", "mobile", "contact", "designation", "title", "role",
      "institution", "organization", "company", "city", "state", "country", "notify"]

    headers.forEach((h, idx) => {
      // Handle Q: prefixed custom questions
      if (h.startsWith("q:")) {
        colMap[h] = idx
      } else {
        const match = colNames.find(c => h === c || h.includes(c))
        if (match) colMap[match] = idx
      }
    })

    const data = []
    for (let i = 1; i < lines.length; i++) {
      // Parse CSV properly (handle quoted values with commas)
      const values = parseCSVLine(lines[i])
      if (values.length === 0) continue

      const row: any = {}

      // Map values to fields
      row.ticket = values[colMap["ticket"]] || ""
      row.name = values[colMap["name"]] || values[colMap["full_name"]] || values[colMap["fullname"]] || values[0] || ""
      row.email = values[colMap["email"]] || values[colMap["email_address"]] || values[1] || ""
      row.phone = values[colMap["phone"]] || values[colMap["mobile"]] || values[colMap["contact"]] || ""
      row.designation = values[colMap["designation"]] || values[colMap["title"]] || values[colMap["role"]] || ""
      row.institution = values[colMap["institution"]] || values[colMap["organization"]] || values[colMap["company"]] || ""
      row.city = values[colMap["city"]] || ""
      row.state = values[colMap["state"]] || ""
      row.country = values[colMap["country"]] || ""
      row.notify = values[colMap["notify"]] || ""

      // Add Q: prefixed custom fields
      Object.entries(colMap).forEach(([key, idx]) => {
        if (key.startsWith("q:") && values[idx]) {
          row[key] = values[idx]
        }
      })

      if (row.name?.trim()) {
        data.push(row)
      }
    }
    return data
  }

  // Parse a single CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const handleCsvChange = (csv: string) => {
    setImportCsvData(csv)
    setImportResult(null)
    const parsed = parseCsvData(csv)
    setImportPreview(parsed)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      handleCsvChange(text)
    }
    reader.readAsText(file)
  }

  const downloadTemplate = () => {
    window.open(`/api/registrations/import?event_id=${eventId}&format=csv`, "_blank")
  }

  const resetImport = () => {
    setImportCsvData("")
    setImportPreview([])
    setImportResult(null)
    setImportTicketId("")
  }

  // Filter registrations by search and ticket type
  const filteredRegistrations = registrations?.filter((reg) => {
    // Ticket type filter
    if (ticketFilter !== "all" && reg.ticket_type_id !== ticketFilter) {
      return false
    }
    // Search filter
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      reg.attendee_name.toLowerCase().includes(query) ||
      reg.attendee_email.toLowerCase().includes(query) ||
      reg.registration_number.toLowerCase().includes(query) ||
      reg.attendee_institution?.toLowerCase().includes(query)
    )
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-success/20 text-success"
      case "pending":
        return "bg-warning/20 text-warning"
      case "cancelled":
        return "bg-destructive/20 text-destructive"
      case "refunded":
        return "bg-info/20 text-info"
      default:
        return "bg-secondary text-secondary-foreground"
    }
  }

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />
      case "pending":
        return <Clock className="h-4 w-4 text-warning" />
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />
      case "refunded":
        return <RefreshCw className="h-4 w-4 text-info" />
      default:
        return null
    }
  }

  // Bulk selection helpers
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    if (filteredRegistrations) {
      setSelectedIds(new Set(filteredRegistrations.map(r => r.id)))
    }
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const isAllSelected = filteredRegistrations &&
    filteredRegistrations.length > 0 &&
    selectedIds.size === filteredRegistrations.length

  // Bulk action handlers
  const executeBulkAction = async (action: string) => {
    if (selectedIds.size === 0) {
      toast.error("No items selected")
      return
    }

    setBulkActionLoading(true)
    const ids = Array.from(selectedIds)
    let successCount = 0
    let failCount = 0

    try {
      switch (action) {
        case "confirm":
          for (const id of ids) {
            const { error } = await (supabase as any)
              .from("registrations")
              .update({ status: "confirmed", payment_status: "completed" })
              .eq("id", id)
            if (error) failCount++
            else successCount++
          }
          toast.success(`Confirmed ${successCount} registration(s)`)
          logActivityClient({
            action: "bulk_action",
            entityType: "registration",
            eventId,
            description: `Bulk confirmed ${successCount} registration(s)`,
            metadata: { bulkAction: "confirm", count: successCount },
          })
          break

        case "cancel":
          for (const id of ids) {
            const { error } = await (supabase as any)
              .from("registrations")
              .update({ status: "cancelled" })
              .eq("id", id)
            if (error) failCount++
            else successCount++
          }
          toast.success(`Cancelled ${successCount} registration(s)`)
          logActivityClient({
            action: "bulk_action",
            entityType: "registration",
            eventId,
            description: `Bulk cancelled ${successCount} registration(s)`,
            metadata: { bulkAction: "cancel", count: successCount },
          })
          break

        case "checkin":
          for (const id of ids) {
            const { error } = await (supabase as any)
              .from("registrations")
              .update({ checked_in: true, checked_in_at: new Date().toISOString() })
              .eq("id", id)
            if (error) failCount++
            else successCount++
          }
          toast.success(`Checked in ${successCount} attendee(s)`)
          logActivityClient({
            action: "bulk_action",
            entityType: "registration",
            eventId,
            description: `Bulk checked in ${successCount} attendee(s)`,
            metadata: { bulkAction: "check_in", count: successCount },
          })
          break

        case "checkout":
          for (const id of ids) {
            const { error } = await (supabase as any)
              .from("registrations")
              .update({ checked_in: false, checked_in_at: null })
              .eq("id", id)
            if (error) failCount++
            else successCount++
          }
          toast.success(`Checked out ${successCount} attendee(s)`)
          logActivityClient({
            action: "bulk_action",
            entityType: "registration",
            eventId,
            description: `Bulk checked out ${successCount} attendee(s)`,
            metadata: { bulkAction: "check_out", count: successCount },
          })
          break

        case "generate_badges":
          // Group registrations by ticket_type_id to use correct template for each
          const selectedRegs = registrations?.filter((r) => ids.includes(r.id)) || []
          const regsByTicketType: Record<string, string[]> = {}

          for (const reg of selectedRegs) {
            const ticketTypeId = reg.ticket_type_id
            if (!regsByTicketType[ticketTypeId]) {
              regsByTicketType[ticketTypeId] = []
            }
            regsByTicketType[ticketTypeId].push(reg.id)
          }

          let badgeSuccessCount = 0
          let badgeFailCount = 0
          const noTemplateTickets: string[] = []

          // Generate badges for each ticket type group with the correct template
          for (const [ticketTypeId, regIds] of Object.entries(regsByTicketType)) {
            const template = findBadgeTemplate(ticketTypeId)
            if (!template) {
              badgeFailCount += regIds.length
              const ticketName = selectedRegs.find(r => r.ticket_type_id === ticketTypeId)?.ticket_type?.name || ticketTypeId
              if (!noTemplateTickets.includes(ticketName)) {
                noTemplateTickets.push(ticketName)
              }
              continue
            }

            const badgeResponse = await fetch("/api/badges/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event_id: eventId,
                template_id: template.id,
                registration_ids: regIds,
                store_badges: true,
              }),
            })

            if (badgeResponse.ok) {
              badgeSuccessCount += regIds.length
            } else {
              badgeFailCount += regIds.length
            }
          }

          if (noTemplateTickets.length > 0) {
            toast.error(`No badge template for: ${noTemplateTickets.join(", ")}`)
          }
          if (badgeSuccessCount > 0) {
            logActivityClient({
              action: "bulk_action",
              entityType: "badge",
              eventId,
              description: `Bulk generated ${badgeSuccessCount} badge(s)`,
              metadata: { bulkAction: "generate_badge", count: badgeSuccessCount },
            })
          }
          if (badgeFailCount > 0 && noTemplateTickets.length === 0) {
            toast.error(`Failed to generate ${badgeFailCount} badge(s)`)
          }
          break

        case "send_email":
          // This would need a custom email dialog, for now just show a message
          toast.info("Use the Email Templates page to send bulk emails")
          break

        case "export":
          const exportRegs = registrations?.filter(r => selectedIds.has(r.id)) || []
          const csvContent = [
            ["Reg#", "Name", "Email", "Phone", "Institution", "Ticket", "Amount", "Status", "Payment", "Checked In"].join(","),
            ...exportRegs.map(r => [
              r.registration_number,
              `"${r.attendee_name}"`,
              r.attendee_email,
              r.attendee_phone || "",
              `"${r.attendee_institution || ""}"`,
              `"${r.ticket_type?.name || ""}"`,
              r.total_amount,
              r.status,
              r.payment_status,
              r.checked_in ? "Yes" : "No"
            ].join(","))
          ].join("\n")

          const blob = new Blob([csvContent], { type: "text/csv" })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `registrations-export-${new Date().toISOString().split("T")[0]}.csv`
          a.click()
          URL.revokeObjectURL(url)
          toast.success(`Exported ${exportRegs.length} registration(s)`)
          logActivityClient({
            action: "export",
            entityType: "registration",
            eventId,
            description: `Exported ${exportRegs.length} registration(s)`,
            metadata: { count: exportRegs.length },
          })
          break

        case "delete":
          if (!confirm(`Are you sure you want to delete ${ids.length} registration(s)? This cannot be undone.`)) {
            setBulkActionLoading(false)
            return
          }
          for (const id of ids) {
            const { error } = await (supabase as any)
              .from("registrations")
              .delete()
              .eq("id", id)
            if (error) failCount++
            else successCount++
          }
          toast.success(`Deleted ${successCount} registration(s)`)
          logActivityClient({
            action: "bulk_action",
            entityType: "registration",
            eventId,
            description: `Bulk deleted ${successCount} registration(s)`,
            metadata: { bulkAction: "delete", count: successCount },
          })
          break
      }

      if (failCount > 0) {
        toast.error(`${failCount} operation(s) failed`)
      }

      // Refresh data and clear selection
      queryClient.invalidateQueries({ queryKey: ["registrations", eventId] })
      clearSelection()
    } catch (error) {
      console.error("Bulk action error:", error)
      toast.error("An error occurred during bulk action")
    } finally {
      setBulkActionLoading(false)
      setIsBulkActionOpen(false)
    }
  }

  // Calculate stats
  const stats = {
    total: registrations?.length || 0,
    confirmed: registrations?.filter((r) => r.status === "confirmed").length || 0,
    pending: registrations?.filter((r) => r.status === "pending").length || 0,
    checkedIn: registrations?.filter((r) => r.checked_in).length || 0,
    totalRevenue: registrations?.reduce((sum, r) => sum + r.total_amount, 0) || 0,
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Attendees</h1>
          <p className="text-muted-foreground">
            Manage event registrations and attendees
          </p>
        </div>
        <div className="flex items-center gap-2">
          {event?.slug && (
            <Button
              variant="outline"
              onClick={() => window.open(`/register/${event.slug}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Page
            </Button>
          )}
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/events/${eventId}/registrations/import`}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Link>
          </Button>
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Attendee
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="paper-card p-4">
          <div className="flex items-center gap-1">
            <p className="text-sm text-muted-foreground">Total</p>
            <HelpTooltip content="Total number of registrations including all statuses (confirmed, pending, cancelled, refunded)" />
          </div>
          <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="paper-card p-4">
          <div className="flex items-center gap-1">
            <p className="text-sm text-muted-foreground">Confirmed</p>
            <HelpTooltip content="Registrations with completed payment. These attendees are ready to attend the event." />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-success">{stats.confirmed}</p>
        </div>
        <div className="paper-card p-4">
          <div className="flex items-center gap-1">
            <p className="text-sm text-muted-foreground">Pending</p>
            <HelpTooltip content="Registrations awaiting payment. Send reminder emails or mark as confirmed for free tickets." />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-warning">{stats.pending}</p>
        </div>
        <div className="paper-card p-4">
          <div className="flex items-center gap-1">
            <p className="text-sm text-muted-foreground">Checked In</p>
            <HelpTooltip content="Attendees who have checked in at the event venue. Use the Check-in tab to manage." />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-info">{stats.checkedIn}</p>
        </div>
        <div className="paper-card p-4">
          <div className="flex items-center gap-1">
            <p className="text-sm text-muted-foreground">Revenue</p>
            <HelpTooltip content="Total amount collected from all confirmed registrations (after discounts and taxes)" />
          </div>
          <p className="text-xl sm:text-2xl font-bold">₹{stats.totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              <span className="font-medium text-primary">{selectedIds.size} selected</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => executeBulkAction("confirm")}>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                  Confirm Selected
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => executeBulkAction("cancel")}>
                  <XCircle className="h-4 w-4 mr-2 text-red-600" />
                  Cancel Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={() => executeBulkAction("generate_badges")}
              disabled={bulkActionLoading}
            >
              <BadgeCheck className="h-4 w-4 mr-2" />
              Generate Badges
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => executeBulkAction("export")}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => executeBulkAction("delete")}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>

            {bulkActionLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, registration #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={ticketFilter} onValueChange={setTicketFilter}>
          <SelectTrigger className="w-full md:w-48">
            <Ticket className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Tickets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tickets</SelectItem>
            {ticketTypes?.map((tt) => (
              <SelectItem key={tt.id} value={tt.id}>
                {tt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Registrations List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredRegistrations?.length === 0 ? (
        <div className="paper-card card-animated">
          <div className="p-12 text-center">
            <UserCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No registrations yet</h3>
            <p className="text-muted-foreground">
              Attendees will appear here when they register for tickets
            </p>
          </div>
        </div>
      ) : (
        <div className="paper-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="p-4 w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={(checked) => {
                        if (checked) selectAll()
                        else clearSelection()
                      }}
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    Registration
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    Attendee
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    Ticket
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    Amount
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistrations?.map((reg) => (
                  <tr
                    key={reg.id}
                    className={cn(
                      "border-b border-border hover:bg-secondary/20 transition-colors cursor-pointer",
                      selectedRegistration?.id === reg.id && "bg-primary/5",
                      selectedIds.has(reg.id) && "bg-primary/10"
                    )}
                    onClick={() => setSelectedRegistration(reg)}
                  >
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(reg.id)}
                        onCheckedChange={() => toggleSelection(reg.id)}
                      />
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-mono text-sm">{reg.registration_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(reg.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{reg.attendee_name}</p>
                        <p className="text-sm text-muted-foreground">{reg.attendee_email}</p>
                        {reg.attendee_institution && (
                          <p className="text-xs text-muted-foreground">
                            {reg.attendee_institution}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="font-normal">
                        {reg.ticket_type?.name || "Unknown"}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          ₹{reg.total_amount.toLocaleString()}
                        </span>
                        {getPaymentStatusIcon(reg.payment_status)}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-medium border-0 capitalize",
                          getStatusColor(reg.status)
                        )}
                      >
                        {reg.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedRegistration(reg)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              printBadge(reg)
                            }}
                            disabled={isPrintingBadge === reg.id}
                          >
                            {isPrintingBadge === reg.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Printer className="h-4 w-4 mr-2" />
                            )}
                            Print Badge
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              emailBadge(reg)
                            }}
                            disabled={isEmailingBadge === reg.id || reg.status !== "confirmed"}
                          >
                            {isEmailingBadge === reg.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Email Badge
                          </DropdownMenuItem>
                          {reg.status === "pending" && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatus.mutate({ id: reg.id, status: "confirmed" })
                              }
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Confirm
                            </DropdownMenuItem>
                          )}
                          {reg.status !== "cancelled" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() =>
                                updateStatus.mutate({ id: reg.id, status: "cancelled" })
                              }
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteConfirm(reg.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Registration Detail SlideOver */}
      <SlideOver
        open={!!selectedRegistration}
        onClose={() => setSelectedRegistration(null)}
        title={selectedRegistration?.registration_number || "Attendee Details"}
      >
        {selectedRegistration && (
          <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-sm font-medium border-0 capitalize",
                    getStatusColor(selectedRegistration.status)
                  )}
                >
                  {selectedRegistration.status}
                </Badge>
                {selectedRegistration.status === "confirmed" && selectedRegistration.confirmed_at && (
                  <span className="text-[10px] text-muted-foreground">
                    Confirmed {format(new Date(selectedRegistration.confirmed_at), "dd MMM yyyy")}
                  </span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {format(new Date(selectedRegistration.created_at), "dd MMM yyyy, h:mm a")}
              </span>
            </div>

            {/* Attendee Info */}
            <SlideOverSection title="Attendee" icon={UserCheck}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {selectedRegistration.attendee_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{selectedRegistration.attendee_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedRegistration.attendee_email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {selectedRegistration.attendee_phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${selectedRegistration.attendee_phone}`} className="hover:text-primary">
                        {selectedRegistration.attendee_phone}
                      </a>
                    </div>
                  )}
                  {selectedRegistration.attendee_institution && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      <span>{selectedRegistration.attendee_institution}</span>
                    </div>
                  )}
                  {selectedRegistration.attendee_designation && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span>{selectedRegistration.attendee_designation}</span>
                    </div>
                  )}
                </div>
              </div>
            </SlideOverSection>

            {/* Related Registrations (same email) */}
            {relatedRegistrations && relatedRegistrations.length > 0 && (
              <SlideOverSection title={`Related Registrations (${relatedRegistrations.length})`} icon={Users}>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    Other registrations with the same email address
                  </p>
                  {relatedRegistrations.map((reg: any) => (
                    <button
                      key={reg.id}
                      onClick={() => {
                        const fullReg = registrations?.find(r => r.id === reg.id)
                        if (fullReg) setSelectedRegistration(fullReg)
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div>
                        <p className="font-medium text-sm">{reg.registration_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {reg.ticket_type?.name || "Ticket"} · {format(new Date(reg.created_at), "d MMM yyyy")}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          reg.status === "confirmed" && "bg-success/10 text-success border-success/30",
                          reg.status === "pending" && "bg-warning/10 text-warning border-warning/30",
                          reg.status === "cancelled" && "bg-destructive/10 text-destructive border-destructive/30"
                        )}
                      >
                        {reg.status}
                      </Badge>
                    </button>
                  ))}
                </div>
              </SlideOverSection>
            )}

            {/* Ticket Info */}
            <SlideOverSection title="Ticket" icon={Ticket}>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="font-medium">{selectedRegistration.ticket_type?.name || "Standard Ticket"}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  ₹{selectedRegistration.unit_price.toLocaleString()}
                  {selectedRegistration.tax_amount > 0 && (
                    <span> + ₹{selectedRegistration.tax_amount.toLocaleString()} GST</span>
                  )}
                </p>
              </div>
            </SlideOverSection>

            {/* Add-ons */}
            <SlideOverSection title="Add-ons" icon={Package}>
              {registrationAddons && registrationAddons.length > 0 ? (
                <div className="space-y-2">
                  {registrationAddons.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 group">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {item.addon?.name || "Add-on"}
                          {item.addon_variant?.name && (
                            <span className="text-muted-foreground ml-1">
                              ({item.addon_variant.name})
                            </span>
                          )}
                        </p>
                        {item.quantity > 1 && (
                          <p className="text-xs text-muted-foreground">
                            Qty: {item.quantity} × ₹{item.unit_price.toLocaleString()}
                          </p>
                        )}
                        {item.addon?.is_course && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            Course
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          ₹{item.total_price.toLocaleString()}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteAddonMutation.mutate({
                            registrationId: selectedRegistration.id,
                            addonId: item.addon?.id,
                            variantId: item.addon_variant?.id,
                          })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No add-ons purchased</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={() => setIsAddAddonOpen(true)}
              >
                <Package className="h-4 w-4 mr-2" />
                Add Add-on
              </Button>
            </SlideOverSection>

            {/* Payment Summary */}
            <SlideOverSection title="Payment" icon={IndianRupee}>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ticket</span>
                  <span>₹{selectedRegistration.unit_price.toLocaleString()}</span>
                </div>
                {registrationAddons && registrationAddons.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Add-ons</span>
                    <span>₹{registrationAddons.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0).toLocaleString()}</span>
                  </div>
                )}
                {selectedRegistration.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax (GST)</span>
                    <span>₹{selectedRegistration.tax_amount.toLocaleString()}</span>
                  </div>
                )}
                {selectedRegistration.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-success">-₹{selectedRegistration.discount_amount.toLocaleString()}</span>
                  </div>
                )}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-primary">₹{(
                      selectedRegistration.total_amount +
                      (registrationAddons?.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0) || 0)
                    ).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {getPaymentStatusIcon(selectedRegistration.payment_status)}
                  <span className="text-sm capitalize">{selectedRegistration.payment_status}</span>
                </div>
              </div>
            </SlideOverSection>

            {/* Badge & Documents */}
            <SlideOverSection title="Documents" icon={FileDown}>
              <div className="space-y-3">
                {/* Badge */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      selectedRegistration.badge_url ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
                    )}>
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Badge</p>
                      {selectedRegistration.badge_generated_at ? (
                        <p className="text-xs text-muted-foreground">
                          Generated {format(new Date(selectedRegistration.badge_generated_at), "dd MMM, h:mm a")}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not generated</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedRegistration.badge_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(selectedRegistration.badge_url!, "_blank")}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    ) : badgeTemplates && badgeTemplates.length > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateBadge(selectedRegistration)}
                        disabled={isGeneratingBadge === selectedRegistration.id}
                      >
                        {isGeneratingBadge === selectedRegistration.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <BadgeCheck className="w-4 h-4 mr-1" />
                            Generate
                          </>
                        )}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No template</span>
                    )}
                  </div>
                </div>

                {/* Certificate */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      selectedRegistration.certificate_url ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
                    )}>
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Certificate</p>
                      {selectedRegistration.certificate_generated_at ? (
                        <p className="text-xs text-muted-foreground">
                          Generated {format(new Date(selectedRegistration.certificate_generated_at), "dd MMM, h:mm a")}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not generated</p>
                      )}
                    </div>
                  </div>
                  {selectedRegistration.certificate_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(selectedRegistration.certificate_url!, "_blank")}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </SlideOverSection>

            {/* Check-in Status */}
            <SlideOverSection title="Check-in Status" icon={QrCode}>
              <div className="p-3 rounded-lg bg-muted/30">
                {selectedRegistration.checked_in ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-green-700">Checked In</p>
                      {selectedRegistration.checked_in_at && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(selectedRegistration.checked_in_at), "dd MMM yyyy, h:mm a")}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Not checked in</p>
                      <p className="text-xs text-muted-foreground">Awaiting arrival</p>
                    </div>
                  </div>
                )}
              </div>
            </SlideOverSection>

            {/* Communication Timeline */}
            <SlideOverSection title="Communication" icon={MessageSquare}>
              <div className="space-y-3">
                {emailLogs && emailLogs.length > 0 ? (
                  emailLogs.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        log.status === "bounced" ? "bg-destructive/10 text-destructive" :
                        log.opened_at ? "bg-green-100 text-green-600" :
                        log.delivered_at ? "bg-blue-100 text-blue-600" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {log.status === "bounced" ? <AlertCircle className="w-4 h-4" /> :
                         log.clicked_at ? <MousePointerClick className="w-4 h-4" /> :
                         log.opened_at ? <MailOpen className="w-4 h-4" /> :
                         log.delivered_at ? <MailCheck className="w-4 h-4" /> :
                         <Mail className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {log.email_type === "registration_confirmation" ? "Registration Confirmation" :
                           log.email_type === "speaker_invitation" ? "Speaker Invitation" :
                           log.email_type === "reminder" ? "Reminder" :
                           log.subject || log.email_type}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            Sent {format(new Date(log.sent_at), "dd MMM, h:mm a")}
                          </Badge>
                          {log.delivered_at && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                              Delivered
                            </Badge>
                          )}
                          {log.opened_at && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200">
                              Opened {log.open_count > 1 ? `(${log.open_count}x)` : ""}
                            </Badge>
                          )}
                          {log.clicked_at && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                              Clicked
                            </Badge>
                          )}
                          {log.status === "bounced" && (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                              Bounced
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No emails sent yet</p>
                )}
              </div>
            </SlideOverSection>

            {/* Notes */}
            {selectedRegistration.notes && (
              <SlideOverSection title="Notes" icon={FileText}>
                <p className="text-sm">{selectedRegistration.notes}</p>
              </SlideOverSection>
            )}

            {/* Actions */}
            <SlideOverFooter>
              <Button variant="outline" size="sm">
                <Send className="w-4 h-4 mr-2" />
                Resend Email
              </Button>
              <Button variant="outline" size="sm" onClick={openEditDialog}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => printBadge(selectedRegistration)}
                disabled={isPrintingBadge === selectedRegistration.id}
              >
                {isPrintingBadge === selectedRegistration.id ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4 mr-2" />
                )}
                Print Badge
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => emailBadge(selectedRegistration)}
                disabled={isEmailingBadge === selectedRegistration.id || selectedRegistration.status !== "confirmed"}
              >
                {isEmailingBadge === selectedRegistration.id ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Email Badge
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`/api/registrations/${selectedRegistration.id}/final-receipt`, "_blank")
                }}
              >
                <FileDown className="w-4 h-4 mr-2" />
                Final Receipt
              </Button>
              {!selectedRegistration.checked_in && (
                <>
                  <Button variant="outline" size="sm" onClick={openSwitchTicketDialog}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Switch Course
                  </Button>
                  <Button variant="outline" size="sm" onClick={openTransferEventDialog}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Transfer Event
                  </Button>
                </>
              )}
              {selectedRegistration.status === "pending" && (
                <Button
                  size="sm"
                  onClick={() => {
                    updateStatus.mutate({ id: selectedRegistration.id, status: "confirmed" })
                    setSelectedRegistration(null)
                  }}
                  disabled={updateStatus.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm
                </Button>
              )}
            </SlideOverFooter>
          </div>
        )}
      </SlideOver>

      {/* Edit Attendee Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Attendee</DialogTitle>
            <DialogDescription className="sr-only">Edit attendee information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editData.attendee_name || ""}
                onChange={(e) => setEditData({ ...editData, attendee_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editData.attendee_email || ""}
                onChange={(e) => setEditData({ ...editData, attendee_email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editData.attendee_phone || ""}
                onChange={(e) => setEditData({ ...editData, attendee_phone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-institution">Institution</Label>
                <Input
                  id="edit-institution"
                  value={editData.attendee_institution || ""}
                  onChange={(e) => setEditData({ ...editData, attendee_institution: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-designation">Designation</Label>
                <Input
                  id="edit-designation"
                  value={editData.attendee_designation || ""}
                  onChange={(e) => setEditData({ ...editData, attendee_designation: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editData.notes || ""}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                rows={3}
                placeholder="Internal notes (not visible to attendee)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedRegistration) {
                  editRegistration.mutate({
                    id: selectedRegistration.id,
                    updates: editData,
                  })
                }
              }}
              disabled={editRegistration.isPending}
            >
              {editRegistration.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Registration?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this registration? This action cannot
              be undone. Consider cancelling the registration instead if you want to
              preserve the record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteRegistration.mutate(deleteConfirm)}
              disabled={deleteRegistration.isPending}
            >
              {deleteRegistration.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Switch Ticket/Course Dialog */}
      <Dialog open={isSwitchTicketOpen} onOpenChange={setIsSwitchTicketOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Switch Course / Ticket
            </DialogTitle>
            <DialogDescription>
              Change the registered course for {selectedRegistration?.attendee_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-secondary/50 rounded-lg">
              <p className="text-sm font-medium">Current Course</p>
              <p className="text-lg">{selectedRegistration?.ticket_type?.name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedRegistration?.total_amount?.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Switch to Course</Label>
              <Select value={switchToTicketId} onValueChange={setSwitchToTicketId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new course..." />
                </SelectTrigger>
                <SelectContent>
                  {ticketTypes
                    ?.filter((t) => t.id !== selectedRegistration?.ticket_type_id)
                    .map((ticket) => (
                      <SelectItem key={ticket.id} value={ticket.id}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{ticket.name}</span>
                          <span className="text-muted-foreground">
                            {ticket.price?.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {switchToTicketId && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium">New Course</p>
                <p className="text-lg">
                  {ticketTypes?.find((t) => t.id === switchToTicketId)?.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {ticketTypes?.find((t) => t.id === switchToTicketId)?.price?.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSwitchTicketOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedRegistration && switchToTicketId) {
                  switchTicket.mutate({
                    registrationId: selectedRegistration.id,
                    newTicketId: switchToTicketId,
                  })
                }
              }}
              disabled={!switchToTicketId || switchTicket.isPending}
            >
              {switchTicket.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Switching...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Switch Course
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer to Event Dialog */}
      <Dialog open={isTransferEventOpen} onOpenChange={setIsTransferEventOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Transfer to Another Event
            </DialogTitle>
            <DialogDescription>
              Move {selectedRegistration?.attendee_name}'s registration to a different event
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current Registration Info */}
            <div className="p-3 bg-secondary/50 rounded-lg">
              <p className="text-sm font-medium">Current Registration</p>
              <p className="text-lg">{selectedRegistration?.ticket_type?.name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedRegistration?.total_amount?.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
              </p>
            </div>

            {/* Select Event */}
            <div className="space-y-2">
              <Label>Transfer to Event</Label>
              <Select
                value={transferToEventId}
                onValueChange={(v) => {
                  setTransferToEventId(v)
                  setTransferToTicketId("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event..." />
                </SelectTrigger>
                <SelectContent>
                  {allEvents?.map((evt) => (
                    <SelectItem key={evt.id} value={evt.id}>
                      <div className="flex flex-col">
                        <span>{evt.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {evt.start_date ? format(new Date(evt.start_date), "dd MMM yyyy") : "No date"}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Select Ticket in new event */}
            {transferToEventId && (
              <div className="space-y-2">
                <Label>Select Course/Ticket</Label>
                <Select value={transferToTicketId} onValueChange={setTransferToTicketId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ticket..." />
                  </SelectTrigger>
                  <SelectContent>
                    {transferEventTickets?.map((ticket) => {
                      const available = (ticket.quantity_total || 0) - (ticket.quantity_sold || 0)
                      return (
                        <SelectItem
                          key={ticket.id}
                          value={ticket.id}
                          disabled={available < 1}
                        >
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{ticket.name}</span>
                            <span className="text-muted-foreground">
                              {ticket.price?.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                              {available < 5 && <span className="text-orange-500 ml-2">({available} left)</span>}
                            </span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Preview */}
            {transferToTicketId && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium">New Registration</p>
                <p className="text-lg">
                  {allEvents?.find((e) => e.id === transferToEventId)?.name}
                </p>
                <p className="text-sm">
                  {transferEventTickets?.find((t) => t.id === transferToTicketId)?.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {transferEventTickets?.find((t) => t.id === transferToTicketId)?.price?.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransferEventOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedRegistration && transferToEventId && transferToTicketId) {
                  transferEvent.mutate({
                    registrationId: selectedRegistration.id,
                    newEventId: transferToEventId,
                    newTicketId: transferToTicketId,
                  })
                }
              }}
              disabled={!transferToEventId || !transferToTicketId || transferEvent.isPending}
            >
              {transferEvent.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Transfer Registration
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog (Tito-style) */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { if (!open) resetImport(); setIsImportOpen(open); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Attendees
            </DialogTitle>
            <DialogDescription className="sr-only">Import attendees from a CSV file</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Step 1: Download Template */}
            <div className="p-4 bg-secondary/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Step 1: Download Template</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Get the CSV template with all available ticket types
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>

            {/* Step 2: Upload or Paste */}
            <div>
              <Label className="text-sm font-medium">Step 2: Upload CSV or Paste Data</Label>
              <p className="text-xs text-muted-foreground mb-3">
                The <strong>ticket</strong> column must match your ticket type names exactly
              </p>

              {/* File Upload */}
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors mb-3">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop CSV file here or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports .csv files</p>
                </label>
              </div>

              {/* Or Paste */}
              <div className="relative">
                <div className="absolute inset-x-0 top-0 flex items-center justify-center -translate-y-1/2">
                  <span className="bg-background px-2 text-xs text-muted-foreground">or paste directly</span>
                </div>
                <Textarea
                  value={importCsvData}
                  onChange={(e) => handleCsvChange(e.target.value)}
                  placeholder={`ticket,name,email,phone,designation,institution,notify
Speaker,Dr. John Smith,john@example.com,+91 9876543210,Professor,Medical College,Y
Speaker,Dr. Jane Doe,jane@example.com,,Associate Professor,Hospital,N`}
                  rows={5}
                  className="font-mono text-xs mt-2"
                />
              </div>

              {/* Available Tickets */}
              <div className="mt-3 text-xs text-muted-foreground">
                <span className="font-medium">Available ticket types: </span>
                {ticketTypes?.map((t, i) => (
                  <span key={t.id}>
                    <code className="bg-secondary px-1 py-0.5 rounded">{t.name}</code>
                    {i < (ticketTypes?.length || 0) - 1 && ", "}
                  </span>
                ))}
              </div>
            </div>

            {/* Fallback Ticket Selection */}
            <div>
              <Label className="text-sm font-medium">Fallback Ticket (Optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Used when ticket column is empty or missing
              </p>
              <Select value={importTicketId} onValueChange={setImportTicketId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select default ticket..." />
                </SelectTrigger>
                <SelectContent>
                  {ticketTypes?.map((ticket) => (
                    <SelectItem key={ticket.id} value={ticket.id}>
                      {ticket.name} {ticket.price === 0 ? "(Free)" : `(₹${ticket.price})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            {importPreview.length > 0 && (
              <div>
                <Label className="text-sm font-medium">
                  Step 3: Preview ({importPreview.length} attendees)
                </Label>
                <div className="mt-2 border rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">#</th>
                        <th className="text-left px-3 py-2 font-medium">Ticket</th>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Email</th>
                        <th className="text-left px-3 py-2 font-medium">Notify</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importPreview.slice(0, 15).map((row, idx) => (
                        <tr key={idx} className="hover:bg-secondary/30">
                          <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-xs">
                              {row.ticket || "Default"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{row.email}</td>
                          <td className="px-3 py-2">
                            {row.notify?.toUpperCase() === "Y" ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {importPreview.length > 15 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-2 text-center text-muted-foreground">
                            ... and {importPreview.length - 15} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className={cn(
                "p-4 rounded-lg",
                importResult.summary.failed > 0 ? "bg-warning/10" : "bg-success/10"
              )}>
                <p className="font-medium mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  Import Complete
                </p>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-success">{importResult.summary.created}</p>
                    <p className="text-muted-foreground text-xs">Created</p>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-warning">{importResult.summary.skipped}</p>
                    <p className="text-muted-foreground text-xs">Skipped</p>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-destructive">{importResult.summary.failed}</p>
                    <p className="text-muted-foreground text-xs">Failed</p>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-info">{importResult.summary.notifications_queued || 0}</p>
                    <p className="text-muted-foreground text-xs">Emails</p>
                  </div>
                </div>
                {importResult.errors?.length > 0 && (
                  <div className="mt-4 p-3 bg-destructive/10 rounded-lg text-xs">
                    <p className="font-medium mb-2 text-destructive">Errors:</p>
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {importResult.errors.slice(0, 10).map((err: string, idx: number) => (
                        <li key={idx} className="text-muted-foreground">{err}</li>
                      ))}
                      {importResult.errors.length > 10 && (
                        <li className="text-muted-foreground">... and {importResult.errors.length - 10} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>
              {importResult ? "Close" : "Cancel"}
            </Button>
            {!importResult && (
              <Button
                onClick={() => importRegistrations.mutate()}
                disabled={importPreview.length === 0 || importRegistrations.isPending}
              >
                {importRegistrations.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {importPreview.length} Attendees
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Addon Dialog */}
      <Dialog open={isAddAddonOpen} onOpenChange={(open) => {
        setIsAddAddonOpen(open)
        if (!open) {
          setSelectedAddonId("")
          setSelectedVariantId("")
          setAddonQuantity(1)
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Add Add-on
            </DialogTitle>
            <DialogDescription>
              Add an add-on to this registration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Add-on</Label>
              <Select value={selectedAddonId} onValueChange={(value) => {
                setSelectedAddonId(value)
                setSelectedVariantId("")
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an add-on..." />
                </SelectTrigger>
                <SelectContent>
                  {availableAddons?.map((addon: any) => (
                    <SelectItem key={addon.id} value={addon.id}>
                      {addon.name} - ₹{addon.price.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Show variants if addon has them */}
            {selectedAddonId && (() => {
              const addon = availableAddons?.find((a: any) => a.id === selectedAddonId)
              if (addon?.has_variants && addon?.variants?.length > 0) {
                return (
                  <div className="space-y-2">
                    <Label>Select Variant</Label>
                    <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a variant..." />
                      </SelectTrigger>
                      <SelectContent>
                        {addon.variants.filter((v: any) => v.is_available).map((variant: any) => (
                          <SelectItem key={variant.id} value={variant.id}>
                            {variant.name}
                            {variant.price_adjustment !== 0 && (
                              <span className="text-muted-foreground ml-2">
                                ({variant.price_adjustment > 0 ? '+' : ''}₹{variant.price_adjustment})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              }
              return null
            })()}

            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={addonQuantity}
                onChange={(e) => setAddonQuantity(parseInt(e.target.value) || 1)}
              />
            </div>

            {selectedAddonId && (
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Unit Price</span>
                  <span>
                    ₹{(() => {
                      const addon = availableAddons?.find((a: any) => a.id === selectedAddonId)
                      const variant = addon?.variants?.find((v: any) => v.id === selectedVariantId)
                      return (addon?.price + (variant?.price_adjustment || 0)).toLocaleString()
                    })()}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-medium mt-2 pt-2 border-t">
                  <span>Total</span>
                  <span>
                    ₹{(() => {
                      const addon = availableAddons?.find((a: any) => a.id === selectedAddonId)
                      const variant = addon?.variants?.find((v: any) => v.id === selectedVariantId)
                      const unitPrice = addon?.price + (variant?.price_adjustment || 0)
                      return (unitPrice * addonQuantity).toLocaleString()
                    })()}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddAddonOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedAddonId || !selectedRegistration) return
                const addon = availableAddons?.find((a: any) => a.id === selectedAddonId)
                if (addon?.has_variants && addon?.variants?.length > 0 && !selectedVariantId) {
                  toast.error("Please select a variant")
                  return
                }
                addAddonMutation.mutate({
                  registrationId: selectedRegistration.id,
                  addonId: selectedAddonId,
                  variantId: selectedVariantId || undefined,
                  quantity: addonQuantity,
                })
              }}
              disabled={!selectedAddonId || addAddonMutation.isPending}
            >
              {addAddonMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Add Add-on
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
