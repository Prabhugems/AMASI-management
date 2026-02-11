"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  UserPlus,
  GraduationCap,
  Mail,
  Phone,
  MoreVertical,
  Trash2,
  Loader2,
  Users,
  Send,
  Copy,
  Check,
  Calendar,
  Link2,
  CheckCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  LayoutGrid,
  List,
  Pencil,
  Bell,
  Plane,
  CreditCard,
  Hotel,
  MapPin,
  Car,
  Download,
  ArrowUpDown,
  CheckSquare,
  FileSpreadsheet,
  MessageSquare,
  Tag,
  TicketCheck,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Sheet,
  ResizableSheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type Speaker = {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  attendee_designation: string | null
  status: string
  confirmed_at: string | null
  custom_fields: {
    topic?: string
    portal_token?: string
    needs_travel?: boolean
    invitation_sent?: string
    last_activity?: string
    notes?: string
    travel_details?: {
      mode?: string
      arrival_date?: string
      departure_date?: string
      from_city?: string
      hotel_required?: boolean
      hotel_nights?: number
      pickup_required?: boolean
      drop_required?: boolean
    }
    travel_id?: {
      full_name_as_passport?: string
      date_of_birth?: string
      gender?: string
      passport_number?: string
      passport_expiry?: string
      frequent_flyer_number?: string
      preferred_airline?: string
      seat_preference?: string
      meal_preference?: string
    }
    booking?: {
      flight_status?: "pending" | "booked" | "confirmed"
      flight_pnr?: string
      flight_number?: string
      flight_departure?: string
      flight_arrival?: string
      hotel_status?: "pending" | "booked" | "confirmed"
      hotel_name?: string
      hotel_confirmation?: string
      hotel_checkin?: string
      hotel_checkout?: string
    }
  } | null
  created_at: string
  ticket_type: { name: string } | null
}

type Session = {
  id: string
  session_name: string
  session_date: string
  start_time: string
  end_time: string
  hall: string | null
  description: string | null
}

type Faculty = {
  id: string
  title: string | null
  name: string
  email: string
  phone: string | null
  institution: string | null
}

type TicketType = {
  id: string
  name: string
  price: number
}

const FACULTY_ROLES = [
  { value: "Speaker", label: "Speaker" },
  { value: "Chairperson", label: "Chairperson" },
  { value: "Moderator", label: "Moderator" },
  { value: "Panelist", label: "Panelist" },
  { value: "Faculty", label: "Faculty" },
]

export default function SpeakersPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [travelFilter, setTravelFilter] = useState<"all" | "needs_travel" | "needs_hotel" | "id_submitted" | "no_travel">("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const [sortBy, setSortBy] = useState<"name" | "date" | "status" | "session">("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [viewMode, setViewMode] = useState<"grid" | "table">("table")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [selectedFacultyId, setSelectedFacultyId] = useState("")
  const [facultySearch, setFacultySearch] = useState("")
  const [inviteTicketId, setInviteTicketId] = useState("")
  const [inviteRole, setInviteRole] = useState("Speaker")
  const [inviteTopic, setInviteTopic] = useState("")
  const [portalLink, setPortalLink] = useState<string | null>(null)

  // Edit session time state
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [editDate, setEditDate] = useState("")
  const [editStartTime, setEditStartTime] = useState("")
  const [editEndTime, setEditEndTime] = useState("")
  const [notifySpeaker, setNotifySpeaker] = useState(true)
  const [notifyCommittee, setNotifyCommittee] = useState(false)
  const [changeReason, setChangeReason] = useState("")
  const [committeeEmails, setCommitteeEmails] = useState("")

  // Fetch sessions for this event (to show speaker's topics)
  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ["event-sessions", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id, session_name, session_date, start_time, end_time, hall, description")
        .eq("event_id", eventId)
        .order("session_date")
        .order("start_time")
      return (data || []) as Session[]
    },
  })

  // Create a map of email to sessions
  const speakerSessionsMap = useMemo(() => {
    const map = new Map<string, Session[]>()
    sessions?.forEach((session) => {
      if (session.description) {
        const parts = session.description.split(" | ")
        const email = parts[1]?.trim()?.toLowerCase()
        if (email) {
          const existing = map.get(email) || []
          existing.push(session)
          map.set(email, existing)
        }
      }
    })
    return map
  }, [sessions])

  // Fetch speakers
  const { data: speakers, isLoading } = useQuery({
    queryKey: ["event-speakers", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select(`
          id,
          registration_number,
          attendee_name,
          attendee_email,
          attendee_phone,
          attendee_designation,
          status,
          confirmed_at,
          custom_fields,
          created_at,
          ticket_type:ticket_types(name)
        `)
        .eq("event_id", eventId)
        .order("attendee_name", { ascending: true })

      // Filter to only speaker-type registrations
      const filtered = (data || []).filter((reg: any) => {
        const ticketName = reg.ticket_type?.name?.toLowerCase() || ""
        const designation = reg.attendee_designation?.toLowerCase() || ""
        return (
          ticketName.includes("speaker") ||
          ticketName.includes("faculty") ||
          designation === "speaker" ||
          designation === "chairperson" ||
          designation === "moderator" ||
          designation === "panelist" ||
          designation === "faculty"
        )
      })

      return filtered as Speaker[]
    },
  })

  // Filtered and sorted speakers
  const filteredSpeakers = useMemo(() => {
    let result = speakers || []

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((s) =>
        s.attendee_name?.toLowerCase().includes(searchLower) ||
        s.attendee_email?.toLowerCase().includes(searchLower)
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter)
    }

    // Role filter
    if (roleFilter !== "all") {
      result = result.filter((s) =>
        s.attendee_designation?.toLowerCase() === roleFilter.toLowerCase()
      )
    }

    // Travel filter
    if (travelFilter === "needs_travel") {
      result = result.filter((s) => s.custom_fields?.needs_travel)
    } else if (travelFilter === "needs_hotel") {
      result = result.filter((s) => s.custom_fields?.travel_details?.hotel_required)
    } else if (travelFilter === "id_submitted") {
      result = result.filter((s) => s.custom_fields?.needs_travel && s.custom_fields?.travel_id?.full_name_as_passport)
    } else if (travelFilter === "no_travel") {
      result = result.filter((s) => !s.custom_fields?.needs_travel)
    }

    // Sorting
    result = [...result].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case "name":
          comparison = a.attendee_name.localeCompare(b.attendee_name)
          break
        case "date":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case "status":
          const statusOrder = { confirmed: 0, pending: 1, declined: 2, cancelled: 3 }
          comparison = (statusOrder[a.status as keyof typeof statusOrder] || 4) -
                      (statusOrder[b.status as keyof typeof statusOrder] || 4)
          break
        case "session":
          const aSessions = speakerSessionsMap.get(a.attendee_email.toLowerCase()) || []
          const bSessions = speakerSessionsMap.get(b.attendee_email.toLowerCase()) || []
          const aDate = aSessions[0]?.session_date || "9999"
          const bDate = bSessions[0]?.session_date || "9999"
          comparison = aDate.localeCompare(bDate)
          break
      }
      return sortOrder === "asc" ? comparison : -comparison
    })

    return result
  }, [speakers, search, statusFilter, roleFilter, travelFilter, sortBy, sortOrder, speakerSessionsMap])

  // Bulk selection helpers
  const allSelected = filteredSpeakers.length > 0 && selectedIds.size === filteredSpeakers.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredSpeakers.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredSpeakers.map(s => s.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  // Export to Excel
  const exportToExcel = async () => {
    setIsExporting(true)
    try {
      const speakersToExport = selectedIds.size > 0
        ? filteredSpeakers.filter(s => selectedIds.has(s.id))
        : filteredSpeakers

      const rows = speakersToExport.map(s => {
        const sessions = speakerSessionsMap.get(s.attendee_email.toLowerCase()) || []
        return {
          Name: s.attendee_name,
          Email: s.attendee_email,
          Phone: s.attendee_phone || "",
          Role: s.attendee_designation || "Speaker",
          Status: s.status,
          Sessions: sessions.map(sess => sess.session_name).join("; "),
          "Needs Travel": s.custom_fields?.needs_travel ? "Yes" : "No",
          "Needs Hotel": s.custom_fields?.travel_details?.hotel_required ? "Yes" : "No",
          "From City": s.custom_fields?.travel_details?.from_city || "",
          "Arrival Date": s.custom_fields?.travel_details?.arrival_date || "",
          "Departure Date": s.custom_fields?.travel_details?.departure_date || "",
          "ID Name": s.custom_fields?.travel_id?.full_name_as_passport || "",
          "DOB": s.custom_fields?.travel_id?.date_of_birth || "",
          "Gender": s.custom_fields?.travel_id?.gender || "",
          "Passport/ID": s.custom_fields?.travel_id?.passport_number || "",
          "Flight PNR": s.custom_fields?.booking?.flight_pnr || "",
          "Flight Status": s.custom_fields?.booking?.flight_status || "",
          "Hotel Name": s.custom_fields?.booking?.hotel_name || "",
          "Hotel Status": s.custom_fields?.booking?.hotel_status || "",
        }
      })

      // Create CSV
      const headers = Object.keys(rows[0] || {})
      const csv = [
        headers.join(","),
        ...rows.map(row =>
          headers.map(h => {
            const val = row[h as keyof typeof row] || ""
            return `"${String(val).replace(/"/g, '""')}"`
          }).join(",")
        )
      ].join("\n")

      // Download
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `speakers-export-${new Date().toISOString().split("T")[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)

      toast.success(`Exported ${rows.length} speakers`)
    } catch (_error) {
      toast.error("Export failed")
    } finally {
      setIsExporting(false)
    }
  }

  // Fetch faculty for invite - server-side search for scalability
  const { data: facultyList, isLoading: isFacultyLoading, error: facultyError } = useQuery({
    queryKey: ["faculty-search", facultySearch, isInviteModalOpen],
    queryFn: async () => {
      let query = (supabase as any)
        .from("faculty")
        .select("id, title, name, email, phone, institution")
        .eq("status", "active")
        .order("name")
        .limit(50)

      // Server-side search if there's a search term
      if (facultySearch.trim()) {
        const search = facultySearch.trim()
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,institution.ilike.%${search}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error("Faculty fetch error:", error)
        throw error
      }
      return (data || []) as Faculty[]
    },
    enabled: isInviteModalOpen,
    staleTime: 1000 * 60, // Cache for 1 minute
  })

  // Fetch ticket types
  const { data: ticketTypes } = useQuery({
    queryKey: ["speaker-tickets", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ticket_types")
        .select("id, name, price")
        .eq("event_id", eventId)
        .or("name.ilike.%speaker%,name.ilike.%faculty%")
        .order("name")
      return (data || []) as TicketType[]
    },
    enabled: isInviteModalOpen,
  })

  // Fetch event details for invitation emails
  const { data: eventDetails } = useQuery({
    queryKey: ["event-details", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("id, name, start_date, end_date, venue_name")
        .eq("id", eventId)
        .single()
      return data
    },
  })

  // Create from sessions mutation
  const createFromSessions = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/program/create-speaker-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      return result
    },
    onSuccess: (data) => {
      toast.success(`Created ${data.created} speaker registrations`)
      queryClient.invalidateQueries({ queryKey: ["event-speakers", eventId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Invite faculty mutation
  const selectedFaculty = facultyList?.find(f => f.id === selectedFacultyId)

  const inviteFaculty = useMutation({
    mutationFn: async () => {
      if (!selectedFaculty || !inviteTicketId) {
        throw new Error("Please select faculty and ticket type")
      }

      const { data: existing } = await (supabase as any)
        .from("registrations")
        .select("id")
        .eq("event_id", eventId)
        .eq("attendee_email", selectedFaculty.email)
        .single()

      if (existing) {
        throw new Error("This faculty is already registered for this event")
      }

      const date = new Date()
      const dateStr = date.getFullYear().toString() +
        (date.getMonth() + 1).toString().padStart(2, "0") +
        date.getDate().toString().padStart(2, "0")
      const random = Math.floor(1000 + Math.random() * 9000)
      const registrationNumber = `SPK-${dateStr}-${random}`
      const portalToken = crypto.randomUUID()

      const { data: newReg, error } = await (supabase as any)
        .from("registrations")
        .insert({
          event_id: eventId,
          ticket_type_id: inviteTicketId,
          registration_number: registrationNumber,
          attendee_name: selectedFaculty.name,
          attendee_email: selectedFaculty.email,
          attendee_phone: selectedFaculty.phone || null,
          attendee_designation: inviteRole,
          attendee_country: "India",
          quantity: 1,
          unit_price: 0,
          tax_amount: 0,
          discount_amount: 0,
          total_amount: 0,
          status: "pending",
          payment_status: "completed",
          custom_fields: {
            topic: inviteTopic || null,
            portal_token: portalToken,
            invitation_sent: new Date().toISOString(),
          },
        })
        .select()
        .single()

      if (error) throw error
      return { portalToken, registration: newReg }
    },
    onSuccess: (data) => {
      const link = `${window.location.origin}/speaker/${data.portalToken}`
      setPortalLink(link)
      toast.success(`${selectedFaculty?.name} invited as ${inviteRole}`)
      queryClient.invalidateQueries({ queryKey: ["event-speakers", eventId] })
      setSelectedFacultyId("")
      setFacultySearch("")
      setInviteTicketId("")
      setInviteRole("Speaker")
      setInviteTopic("")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete speaker mutation
  const deleteSpeaker = useMutation({
    mutationFn: async (speakerId: string) => {
      const { error } = await (supabase as any)
        .from("registrations")
        .delete()
        .eq("id", speakerId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Speaker removed")
      queryClient.invalidateQueries({ queryKey: ["event-speakers", eventId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { status }
      if (status === "confirmed") {
        updateData.confirmed_at = new Date().toISOString()
      }
      const { error } = await (supabase as any)
        .from("registrations")
        .update(updateData)
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Status updated")
      queryClient.invalidateQueries({ queryKey: ["event-speakers", eventId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Update travel requirement
  const updateTravel = useMutation({
    mutationFn: async ({ id, needsTravel }: { id: string; needsTravel: boolean }) => {
      // Get current custom_fields first
      const { data: current } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", id)
        .single()

      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(current?.custom_fields || {}),
            needs_travel: needsTravel,
          },
        })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Travel requirement updated")
      queryClient.invalidateQueries({ queryKey: ["event-speakers", eventId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Update airport transfer settings
  const updateAirportTransfer = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: "pickup_required" | "drop_required"; value: boolean }) => {
      const { data: current } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", id)
        .single()

      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(current?.custom_fields || {}),
            travel_details: {
              ...(current?.custom_fields?.travel_details || {}),
              [field]: value,
            },
          },
        })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: (_, { field, value }) => {
      const label = field === "pickup_required" ? "Airport pickup" : "Airport drop"
      toast.success(`${label} ${value ? "enabled" : "disabled"}`)
      queryClient.invalidateQueries({ queryKey: ["event-speakers", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Bulk update status
  const bulkUpdateStatus = useMutation({
    mutationFn: async (status: string) => {
      const ids = Array.from(selectedIds)
      const updateData: any = { status }
      if (status === "confirmed") {
        updateData.confirmed_at = new Date().toISOString()
      }
      const { error } = await (supabase as any)
        .from("registrations")
        .update(updateData)
        .in("id", ids)
      if (error) throw error
      return ids.length
    },
    onSuccess: (count) => {
      toast.success(`Updated ${count} speakers`)
      setSelectedIds(new Set())
      queryClient.invalidateQueries({ queryKey: ["event-speakers", eventId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Send invitation email to a single speaker
  const sendInvitation = useMutation({
    mutationFn: async (speaker: Speaker) => {
      if (!eventDetails) throw new Error("Event details not loaded")
      const portalToken = speaker.custom_fields?.portal_token
      if (!portalToken) throw new Error("No portal token for this speaker")

      // Get speaker's sessions
      const speakerSessions = speakerSessionsMap.get(speaker.attendee_email.toLowerCase()) || []

      const response = await fetch("/api/email/speaker-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: speaker.id,
          speaker_name: speaker.attendee_name,
          speaker_email: speaker.attendee_email,
          event_id: eventId,
          event_name: eventDetails.name,
          event_start_date: eventDetails.start_date,
          event_end_date: eventDetails.end_date,
          event_venue: eventDetails.venue_name,
          portal_token: portalToken,
          sessions: speakerSessions.map(s => ({
            session_name: s.session_name,
            session_date: s.session_date,
            start_time: s.start_time,
            end_time: s.end_time,
            hall: s.hall,
          })),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      toast.success("Invitation email sent!")
      queryClient.invalidateQueries({ queryKey: ["event-speakers", eventId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Bulk send invitations
  const bulkSendInvitations = useMutation({
    mutationFn: async () => {
      if (!eventDetails) throw new Error("Event details not loaded")
      const ids = Array.from(selectedIds)

      const response = await fetch("/api/email/speaker-invitation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_ids: ids,
          event_id: eventId,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      return result.results
    },
    onSuccess: (results) => {
      const msg = `Sent: ${results.sent}, Failed: ${results.failed}, Skipped: ${results.skipped}`
      if (results.failed > 0) {
        toast.warning(`Invitations: ${msg}`)
      } else {
        toast.success(`Invitations sent! ${msg}`)
      }
      setSelectedIds(new Set())
      queryClient.invalidateQueries({ queryKey: ["event-speakers", eventId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Update booking details
  const updateBooking = useMutation({
    mutationFn: async ({ id, booking }: { id: string; booking: any }) => {
      const { data: current } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", id)
        .single()

      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(current?.custom_fields || {}),
            booking: {
              ...(current?.custom_fields?.booking || {}),
              ...booking,
            },
          },
        })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Booking details updated")
      queryClient.invalidateQueries({ queryKey: ["event-speakers", eventId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Update session time mutation
  const updateSessionTime = useMutation({
    mutationFn: async () => {
      if (!editingSession) throw new Error("No session selected")

      const response = await fetch("/api/sessions/update-time", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: editingSession.id,
          new_date: editDate !== editingSession.session_date ? editDate : undefined,
          new_start_time: editStartTime !== editingSession.start_time ? editStartTime : undefined,
          new_end_time: editEndTime !== editingSession.end_time ? editEndTime : undefined,
          notify_speaker: notifySpeaker,
          notify_committee: notifyCommittee,
          change_reason: changeReason,
          committee_emails: notifyCommittee
            ? committeeEmails.split(",").map(e => e.trim()).filter(Boolean)
            : [],
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      return result
    },
    onSuccess: (data) => {
      const notified = data.notifications?.filter((n: any) => n.success).length || 0
      toast.success(`Session time updated${notified > 0 ? ` and ${notified} notification(s) sent` : ""}`)
      setEditingSession(null)
      refetchSessions()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Open edit session dialog
  const openEditSession = (session: Session) => {
    setEditingSession(session)
    setEditDate(session.session_date)
    setEditStartTime(session.start_time)
    setEditEndTime(session.end_time || "")
    setNotifySpeaker(true)
    setNotifyCommittee(false)
    setChangeReason("")
    setCommitteeEmails("")
  }

  // Copy portal link
  const copyPortalLink = (speaker: Speaker) => {
    const token = speaker.custom_fields?.portal_token
    if (token) {
      const link = `${window.location.origin}/speaker/${token}`
      navigator.clipboard.writeText(link)
      setCopiedId(speaker.id)
      toast.success("Portal link copied!")
      setTimeout(() => setCopiedId(null), 2000)
    } else {
      toast.error("No portal link available")
    }
  }

  // Stats
  const stats = useMemo(() => {
    const total = speakers?.length || 0
    const pending = speakers?.filter(s => s.status === "pending").length || 0
    const confirmed = speakers?.filter(s => s.status === "confirmed").length || 0
    const declined = speakers?.filter(s => s.status === "declined" || s.status === "cancelled").length || 0
    const needsTravel = speakers?.filter(s => s.custom_fields?.needs_travel).length || 0
    const travelComplete = speakers?.filter(s => s.custom_fields?.needs_travel && s.custom_fields?.travel_id?.full_name_as_passport).length || 0
    return { total, pending, confirmed, declined, needsTravel, travelComplete }
  }, [speakers])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed": return <CheckCircle className="h-4 w-4 text-green-500" />
      case "pending": return <Clock className="h-4 w-4 text-amber-500" />
      case "declined":
      case "cancelled": return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-500/10 text-green-600 border-green-500/20"
      case "pending": return "bg-amber-500/10 text-amber-600 border-amber-500/20"
      case "declined":
      case "cancelled": return "bg-red-500/10 text-red-600 border-red-500/20"
      default: return "bg-gray-500/10 text-gray-600 border-gray-500/20"
    }
  }

  const formatTime = (time: string) => {
    if (!time) return ""
    const [hours, minutes] = time.split(":")
    const h = parseInt(hours)
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Speakers & Faculty</h1>
          <p className="text-sm text-muted-foreground">
            Manage speakers and their session assignments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export
          </Button>
          {speakers && speakers.length === 0 && (
            <Button
              variant="outline"
              onClick={() => createFromSessions.mutate()}
              disabled={createFromSessions.isPending}
            >
              {createFromSessions.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Import from Program
            </Button>
          )}
          <Button onClick={() => setIsInviteModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Speaker
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkUpdateStatus.mutate("confirmed")}
              disabled={bulkUpdateStatus.isPending}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-green-500" />
              Confirm All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkUpdateStatus.mutate("pending")}
              disabled={bulkUpdateStatus.isPending}
            >
              <Clock className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Mark Pending
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={exportToExcel}
              disabled={isExporting}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              Export Selected
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => bulkSendInvitations.mutate()}
              disabled={bulkSendInvitations.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {bulkSendInvitations.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1.5" />
              )}
              Send Invitations
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto"
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => { setStatusFilter("all"); setTravelFilter("all"); }}
          className={cn(
            "bg-card rounded-lg border p-3 text-left transition-all hover:shadow-md",
            statusFilter === "all" && travelFilter === "all" && "ring-2 ring-primary"
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </button>

        <button
          onClick={() => { setStatusFilter("pending"); setTravelFilter("all"); }}
          className={cn(
            "bg-card rounded-lg border p-3 text-left transition-all hover:shadow-md",
            statusFilter === "pending" && "ring-2 ring-amber-500"
          )}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Pending</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.pending}</p>
        </button>

        <button
          onClick={() => { setStatusFilter("confirmed"); setTravelFilter("all"); }}
          className={cn(
            "bg-card rounded-lg border p-3 text-left transition-all hover:shadow-md",
            statusFilter === "confirmed" && "ring-2 ring-green-500"
          )}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Confirmed</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.confirmed}</p>
        </button>

        <button
          onClick={() => { setStatusFilter("all"); setTravelFilter("all"); }}
          className={cn(
            "bg-card rounded-lg border p-3 text-left transition-all hover:shadow-md",
            stats.declined > 0 && "border-red-200"
          )}
        >
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground">Declined</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.declined}</p>
        </button>

        <button
          onClick={() => { setStatusFilter("all"); setTravelFilter("needs_travel"); }}
          className={cn(
            "bg-card rounded-lg border p-3 text-left transition-all hover:shadow-md",
            travelFilter === "needs_travel" && "ring-2 ring-blue-500"
          )}
        >
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Need Travel</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.needsTravel}</p>
        </button>

        <div className="bg-card rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">ID Submitted</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {stats.travelComplete}<span className="text-sm font-normal text-muted-foreground">/{stats.needsTravel}</span>
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Role Filter */}
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[130px]">
            <Tag className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {FACULTY_ROLES.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort Options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowUpDown className="h-4 w-4" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => { setSortBy("name"); setSortOrder("asc"); }}>
              <span className={sortBy === "name" && sortOrder === "asc" ? "font-medium" : ""}>Name A-Z</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSortBy("name"); setSortOrder("desc"); }}>
              <span className={sortBy === "name" && sortOrder === "desc" ? "font-medium" : ""}>Name Z-A</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setSortBy("date"); setSortOrder("desc"); }}>
              <span className={sortBy === "date" && sortOrder === "desc" ? "font-medium" : ""}>Recently Added</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSortBy("date"); setSortOrder("asc"); }}>
              <span className={sortBy === "date" && sortOrder === "asc" ? "font-medium" : ""}>Oldest First</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setSortBy("status"); setSortOrder("asc"); }}>
              <span className={sortBy === "status" ? "font-medium" : ""}>By Status</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSortBy("session"); setSortOrder("asc"); }}>
              <span className={sortBy === "session" ? "font-medium" : ""}>By Session Date</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {(statusFilter !== "all" || travelFilter !== "all" || roleFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStatusFilter("all"); setTravelFilter("all"); setRoleFilter("all"); }}
            className="text-muted-foreground"
          >
            Clear filters
          </Button>
        )}

        {/* Clickable Travel Filters */}
        <div className="hidden md:flex items-center gap-1 text-xs">
          <button
            onClick={() => setTravelFilter(travelFilter === "needs_travel" ? "all" : "needs_travel")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all",
              travelFilter === "needs_travel"
                ? "bg-blue-500 text-white"
                : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
            )}
          >
            <Plane className="h-3 w-3" />
            Flight
          </button>
          <button
            onClick={() => setTravelFilter(travelFilter === "needs_hotel" ? "all" : "needs_hotel")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all",
              travelFilter === "needs_hotel"
                ? "bg-purple-500 text-white"
                : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
            )}
          >
            <Hotel className="h-3 w-3" />
            Hotel
          </button>
          <button
            onClick={() => setTravelFilter(travelFilter === "id_submitted" ? "all" : "id_submitted")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all",
              travelFilter === "id_submitted"
                ? "bg-green-500 text-white"
                : "bg-green-500/10 text-green-600 hover:bg-green-500/20"
            )}
          >
            <Check className="h-3 w-3" />
            ID Done
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredSpeakers.length} speaker{filteredSpeakers.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center border rounded-lg p-1">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSpeakers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 bg-card rounded-lg border border-dashed">
          <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No speakers yet</h3>
          <p className="text-muted-foreground mb-4 text-center max-w-md">
            Import speakers from your program or add them individually
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => createFromSessions.mutate()}
              disabled={createFromSessions.isPending}
            >
              {createFromSessions.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Import from Program
            </Button>
            <Button variant="outline" onClick={() => setIsInviteModalOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Speaker
            </Button>
          </div>
        </div>
      ) : viewMode === "table" ? (
        /* Table View */
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                    className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                  />
                </TableHead>
                <TableHead className="w-[250px]">Speaker</TableHead>
                <TableHead className="w-[90px]">Role</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead className="w-[80px]">Travel</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[100px]">Portal</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSpeakers.map((speaker) => {
                const speakerSessions = speakerSessionsMap.get(speaker.attendee_email.toLowerCase()) || []
                const isSelected = selectedIds.has(speaker.id)
                return (
                  <TableRow
                    key={speaker.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      isSelected && "bg-primary/5"
                    )}
                    onClick={() => setSelectedSpeaker(speaker)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(speaker.id)}
                        aria-label={`Select ${speaker.attendee_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                          {speaker.attendee_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{speaker.attendee_name}</p>
                          <p className="text-xs text-muted-foreground">{speaker.attendee_email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          speaker.attendee_designation === "Chairperson" && "border-purple-500/50 bg-purple-500/10 text-purple-600",
                          speaker.attendee_designation === "Moderator" && "border-blue-500/50 bg-blue-500/10 text-blue-600",
                          speaker.attendee_designation === "Panelist" && "border-cyan-500/50 bg-cyan-500/10 text-cyan-600",
                          (speaker.attendee_designation === "Speaker" || !speaker.attendee_designation) && "border-gray-500/50 bg-gray-500/10 text-gray-600",
                          speaker.attendee_designation === "Faculty" && "border-amber-500/50 bg-amber-500/10 text-amber-600"
                        )}
                      >
                        {speaker.attendee_designation || "Speaker"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {speakerSessions.length > 0 ? (
                        <div className="space-y-1">
                          {speakerSessions.slice(0, 2).map((session, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="text-muted-foreground">
                                {new Date(session.session_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} {formatTime(session.start_time)}
                              </span>
                              <span className="mx-1">•</span>
                              <span className="truncate">{session.session_name.slice(0, 40)}{session.session_name.length > 40 ? "..." : ""}</span>
                            </div>
                          ))}
                          {speakerSessions.length > 2 && (
                            <p className="text-xs text-muted-foreground">+{speakerSessions.length - 2} more sessions</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No sessions assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {speaker.custom_fields?.needs_travel ? (
                        <div className="flex items-center gap-1.5">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500/10" title="Needs flight">
                            <Plane className="h-3.5 w-3.5 text-blue-500" />
                          </span>
                          {speaker.custom_fields?.travel_details?.hotel_required && (
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-500/10" title="Needs hotel">
                              <Hotel className="h-3.5 w-3.5 text-purple-500" />
                            </span>
                          )}
                          {speaker.custom_fields?.travel_id?.full_name_as_passport && (
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-green-500/10" title="ID submitted">
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80",
                              getStatusColor(speaker.status)
                            )}>
                              {getStatusIcon(speaker.status)}
                              <span className="capitalize">{speaker.status}</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => updateStatus.mutate({ id: speaker.id, status: "pending" })}>
                              <Clock className="h-4 w-4 mr-2 text-amber-500" />
                              Pending
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus.mutate({ id: speaker.id, status: "confirmed" })}>
                              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                              Confirmed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus.mutate({ id: speaker.id, status: "declined" })}>
                              <XCircle className="h-4 w-4 mr-2 text-red-500" />
                              Declined
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {speaker.status === "confirmed" && speaker.confirmed_at && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(speaker.confirmed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyPortalLink(speaker)}
                        className="h-8"
                      >
                        {copiedId === speaker.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                        <span className="ml-1.5">Copy Link</span>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            const token = speaker.custom_fields?.portal_token
                            if (token) window.open(`/speaker/${token}`, "_blank")
                          }}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Portal
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => sendInvitation.mutate(speaker)}
                            disabled={sendInvitation.isPending || !speaker.custom_fields?.portal_token}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send Invitation
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Remove this speaker?")) {
                                deleteSpeaker.mutate(speaker.id)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSpeakers.map((speaker) => {
            const speakerSessions = speakerSessionsMap.get(speaker.attendee_email.toLowerCase()) || []
            return (
              <div
                key={speaker.id}
                className="bg-card rounded-lg border p-4 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedSpeaker(speaker)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary relative">
                      {speaker.attendee_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      {speaker.custom_fields?.needs_travel && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
                          <Plane className="h-2.5 w-2.5 text-white" />
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{speaker.attendee_name}</p>
                      <p className="text-xs text-muted-foreground">{speaker.attendee_email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={cn("text-xs", getStatusColor(speaker.status))}>
                      {speaker.status}
                    </Badge>
                    {speaker.custom_fields?.needs_travel && (
                      <div className="flex items-center gap-0.5">
                        {speaker.custom_fields?.travel_details?.hotel_required && (
                          <Hotel className="h-3 w-3 text-purple-500" />
                        )}
                        {speaker.custom_fields?.travel_id?.full_name_as_passport && (
                          <Check className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {speakerSessions.length > 0 && (
                  <div className="mb-3 p-2 bg-muted/50 rounded text-sm">
                    <p className="font-medium text-xs text-muted-foreground mb-1">
                      {speakerSessions.length} Session{speakerSessions.length > 1 ? "s" : ""}
                    </p>
                    {speakerSessions.slice(0, 1).map((session, idx) => (
                      <p key={idx} className="truncate">{session.session_name}</p>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => copyPortalLink(speaker)}
                  >
                    {copiedId === speaker.id ? (
                      <Check className="h-4 w-4 mr-1 text-green-500" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-1" />
                    )}
                    Portal Link
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateStatus.mutate({ id: speaker.id, status: "confirmed" })}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark Confirmed
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Remove this speaker?")) {
                            deleteSpeaker.mutate(speaker.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Speaker Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={(open) => {
        setIsInviteModalOpen(open)
        if (!open) setPortalLink(null)
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {portalLink ? <Check className="h-5 w-5 text-green-500" /> : <UserPlus className="h-5 w-5" />}
              {portalLink ? "Speaker Added!" : "Add Speaker"}
            </DialogTitle>
          </DialogHeader>

          {portalLink ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm text-green-600 font-medium mb-2">
                  Speaker added successfully!
                </p>
                <p className="text-xs text-muted-foreground">
                  Share this portal link with the speaker:
                </p>
              </div>

              <div className="space-y-2">
                <Label>Speaker Portal Link</Label>
                <div className="flex gap-2">
                  <Input value={portalLink} readOnly className="text-xs font-mono" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(portalLink)
                      toast.success("Link copied!")
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => { setIsInviteModalOpen(false); setPortalLink(null) }}>
                  Done
                </Button>
                <Button variant="outline" onClick={() => setPortalLink(null)}>
                  Add Another
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Select Faculty</Label>
                    <span className="text-xs text-muted-foreground">
                      {isFacultyLoading ? "Searching..." : facultyList ? `${facultyList.length} results` : ""}
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, or institution..."
                      value={facultySearch}
                      onChange={(e) => {
                        setFacultySearch(e.target.value)
                        setSelectedFacultyId("") // Clear selection when searching
                      }}
                      className="pl-9"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>

                  {/* Faculty Results List */}
                  <div className="border rounded-lg max-h-[250px] overflow-y-auto">
                    {facultyError ? (
                      <div className="p-4 text-center text-sm text-red-500">
                        Error loading faculty: {(facultyError as Error).message}
                      </div>
                    ) : isFacultyLoading ? (
                      <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading faculty...
                      </div>
                    ) : !facultyList || facultyList.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        {facultySearch.trim()
                          ? `No faculty found for "${facultySearch}"`
                          : "Type to search faculty by name, email, or institution"
                        }
                      </div>
                    ) : (
                      facultyList.map((faculty) => (
                        <div
                          key={faculty.id}
                          onClick={() => setSelectedFacultyId(faculty.id)}
                          className={cn(
                            "p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 transition-colors",
                            selectedFacultyId === faculty.id && "bg-primary/10 border-primary"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {faculty.title ? `${faculty.title} ` : ""}{faculty.name}
                              </p>
                              <p className="text-sm text-muted-foreground">{faculty.email}</p>
                              {faculty.institution && (
                                <p className="text-xs text-muted-foreground">{faculty.institution}</p>
                              )}
                            </div>
                            {selectedFacultyId === faculty.id && (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {facultyList && facultyList.length >= 50 && (
                      <div className="p-2 text-center text-xs text-muted-foreground bg-muted/30">
                        Showing first 50 results. Type more to narrow down.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FACULTY_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Ticket Type</Label>
                    <Select value={inviteTicketId} onValueChange={setInviteTicketId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ticketTypes?.map((ticket) => (
                          <SelectItem key={ticket.id} value={ticket.id}>
                            {ticket.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Topic (Optional)</Label>
                  <Input
                    placeholder="Session topic..."
                    value={inviteTopic}
                    onChange={(e) => setInviteTopic(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInviteModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => inviteFaculty.mutate()}
                  disabled={!selectedFacultyId || !inviteTicketId || inviteFaculty.isPending}
                >
                  {inviteFaculty.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Add Speaker
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Speaker Detail Sheet */}
      <Sheet open={!!selectedSpeaker} onOpenChange={(open) => !open && setSelectedSpeaker(null)}>
        <ResizableSheetContent defaultWidth={500} minWidth={400} maxWidth={800} storageKey="speakers-sheet-width" className="overflow-y-auto">
          {selectedSpeaker && (
            <>
              <SheetHeader className="pb-4 border-b">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-semibold text-primary">
                    {selectedSpeaker.attendee_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <SheetTitle className="text-xl">{selectedSpeaker.attendee_name}</SheetTitle>
                    <p className="text-sm text-muted-foreground">{selectedSpeaker.attendee_designation || "Speaker"}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="py-6 space-y-6">
                {/* Quick Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const token = selectedSpeaker.custom_fields?.portal_token
                      if (token) {
                        const link = `${window.location.origin}/speaker/${token}`
                        const subject = encodeURIComponent("Speaker Portal - AMASI Event")
                        const body = encodeURIComponent(`Dear ${selectedSpeaker.attendee_name},\n\nPlease use the following link to access your speaker portal:\n\n${link}\n\nBest regards`)
                        window.open(`mailto:${selectedSpeaker.attendee_email}?subject=${subject}&body=${body}`)
                      }
                    }}
                  >
                    <Mail className="h-4 w-4 mr-1.5" />
                    Send Email
                  </Button>
                  {selectedSpeaker.attendee_phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const phone = selectedSpeaker.attendee_phone?.replace(/\D/g, "")
                        const token = selectedSpeaker.custom_fields?.portal_token
                        const link = token ? `${window.location.origin}/speaker/${token}` : ""
                        const message = encodeURIComponent(`Hello ${selectedSpeaker.attendee_name}, here is your speaker portal link: ${link}`)
                        window.open(`https://wa.me/91${phone}?text=${message}`, "_blank")
                      }}
                    >
                      <MessageSquare className="h-4 w-4 mr-1.5" />
                      WhatsApp
                    </Button>
                  )}
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Contact Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${selectedSpeaker.attendee_email}`} className="text-primary hover:underline">
                        {selectedSpeaker.attendee_email}
                      </a>
                    </div>
                    {selectedSpeaker.attendee_phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${selectedSpeaker.attendee_phone}`} className="hover:underline">
                          {selectedSpeaker.attendee_phone}
                        </a>
                      </div>
                    )}
                    {selectedSpeaker.custom_fields?.invitation_sent && (
                      <p className="text-xs text-muted-foreground">
                        Invited on {new Date(selectedSpeaker.custom_fields.invitation_sent).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Invitation Status</h3>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedSpeaker.status)}
                    <span className={cn(
                      "px-3 py-1 rounded-full text-sm font-medium capitalize",
                      getStatusColor(selectedSpeaker.status)
                    )}>
                      {selectedSpeaker.status}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant={selectedSpeaker.status === "confirmed" ? "default" : "outline"}
                      onClick={() => {
                        updateStatus.mutate({ id: selectedSpeaker.id, status: "confirmed" })
                        setSelectedSpeaker({ ...selectedSpeaker, status: "confirmed" })
                      }}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedSpeaker.status === "pending" ? "default" : "outline"}
                      onClick={() => {
                        updateStatus.mutate({ id: selectedSpeaker.id, status: "pending" })
                        setSelectedSpeaker({ ...selectedSpeaker, status: "pending" })
                      }}
                      className="flex-1"
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      Pending
                    </Button>
                  </div>
                </div>

                {/* Travel & Accommodation Toggle */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Travel & Accommodation</h3>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Plane className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Needs Travel Assistance</p>
                        <p className="text-xs text-muted-foreground">Flight/Hotel booking required</p>
                      </div>
                    </div>
                    <Switch
                      checked={selectedSpeaker.custom_fields?.needs_travel || false}
                      onCheckedChange={(checked) => {
                        updateTravel.mutate({ id: selectedSpeaker.id, needsTravel: checked })
                        setSelectedSpeaker({
                          ...selectedSpeaker,
                          custom_fields: {
                            ...selectedSpeaker.custom_fields,
                            needs_travel: checked,
                          },
                        })
                      }}
                    />
                  </div>
                </div>

                {/* Sessions */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Assigned Sessions ({speakerSessionsMap.get(selectedSpeaker.attendee_email.toLowerCase())?.length || 0})
                  </h3>
                  <div className="space-y-2">
                    {(speakerSessionsMap.get(selectedSpeaker.attendee_email.toLowerCase()) || []).map((session) => (
                      <div
                        key={session.id}
                        className="p-3 bg-muted/50 rounded-lg border group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm flex-1">{session.session_name}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditSession(session)
                            }}
                            title="Edit session time"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(session.session_date).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(session.start_time)} - {formatTime(session.end_time)}
                          </span>
                        </div>
                        {session.hall && (
                          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {session.hall}
                          </div>
                        )}
                      </div>
                    ))}
                    {(speakerSessionsMap.get(selectedSpeaker.attendee_email.toLowerCase()) || []).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No sessions assigned</p>
                    )}
                  </div>
                </div>

                {/* Portal Link */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Speaker Portal</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => copyPortalLink(selectedSpeaker)}
                    >
                      {copiedId === selectedSpeaker.id ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-2" />
                      )}
                      Copy Portal Link
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const token = selectedSpeaker.custom_fields?.portal_token
                        if (token) window.open(`/speaker/${token}`, "_blank")
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Travel & Booking Details */}
                {selectedSpeaker.custom_fields?.needs_travel && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Plane className="h-4 w-4" />
                      Travel Details
                    </h3>
                    <div className="p-3 bg-muted/50 rounded-lg border space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Mode</span>
                        <span className="capitalize">{selectedSpeaker.custom_fields.travel_details?.mode || "Flight"}</span>
                      </div>
                      {selectedSpeaker.custom_fields.travel_details?.from_city && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> From
                          </span>
                          <span>{selectedSpeaker.custom_fields.travel_details.from_city}</span>
                        </div>
                      )}
                      {selectedSpeaker.custom_fields.travel_details?.arrival_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Arrival</span>
                          <span>{new Date(selectedSpeaker.custom_fields.travel_details.arrival_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                      )}
                      {selectedSpeaker.custom_fields.travel_details?.departure_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Departure</span>
                          <span>{new Date(selectedSpeaker.custom_fields.travel_details.departure_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                      )}
                      {selectedSpeaker.custom_fields.travel_details?.hotel_required && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Hotel className="h-3 w-3" /> Hotel
                          </span>
                          <span>{selectedSpeaker.custom_fields.travel_details.hotel_nights} nights</span>
                        </div>
                      )}
                    </div>

                    {/* Airport Transfers */}
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200 space-y-3">
                      <h4 className="text-xs font-medium text-green-700 flex items-center gap-1.5">
                        <Car className="h-3.5 w-3.5" />
                        Airport Transfers
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm">Airport Pickup</span>
                            <p className="text-xs text-muted-foreground">On arrival</p>
                          </div>
                          <Switch
                            checked={selectedSpeaker.custom_fields.travel_details?.pickup_required || false}
                            onCheckedChange={(checked) => {
                              updateAirportTransfer.mutate({
                                id: selectedSpeaker.id,
                                field: "pickup_required",
                                value: checked
                              })
                              setSelectedSpeaker({
                                ...selectedSpeaker,
                                custom_fields: {
                                  ...selectedSpeaker.custom_fields,
                                  travel_details: {
                                    ...selectedSpeaker.custom_fields?.travel_details,
                                    pickup_required: checked
                                  }
                                }
                              })
                            }}
                            disabled={updateAirportTransfer.isPending}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm">Airport Drop</span>
                            <p className="text-xs text-muted-foreground">On departure</p>
                          </div>
                          <Switch
                            checked={selectedSpeaker.custom_fields.travel_details?.drop_required || false}
                            onCheckedChange={(checked) => {
                              updateAirportTransfer.mutate({
                                id: selectedSpeaker.id,
                                field: "drop_required",
                                value: checked
                              })
                              setSelectedSpeaker({
                                ...selectedSpeaker,
                                custom_fields: {
                                  ...selectedSpeaker.custom_fields,
                                  travel_details: {
                                    ...selectedSpeaker.custom_fields?.travel_details,
                                    drop_required: checked
                                  }
                                }
                              })
                            }}
                            disabled={updateAirportTransfer.isPending}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Booking ID Details */}
                    {selectedSpeaker.custom_fields.travel_id && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5" />
                          Booking Details (for ticket booking)
                        </h4>
                        <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20 space-y-2 text-sm">
                          {selectedSpeaker.custom_fields.travel_id.full_name_as_passport && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Name (ID)</span>
                              <span className="font-medium">{selectedSpeaker.custom_fields.travel_id.full_name_as_passport}</span>
                            </div>
                          )}
                          {selectedSpeaker.custom_fields.travel_id.date_of_birth && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">DOB</span>
                              <span>{new Date(selectedSpeaker.custom_fields.travel_id.date_of_birth).toLocaleDateString("en-IN")}</span>
                            </div>
                          )}
                          {selectedSpeaker.custom_fields.travel_id.gender && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Gender</span>
                              <span className="capitalize">{selectedSpeaker.custom_fields.travel_id.gender}</span>
                            </div>
                          )}
                          {selectedSpeaker.custom_fields.travel_id.passport_number && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">ID/Passport</span>
                              <span className="font-mono text-xs">{selectedSpeaker.custom_fields.travel_id.passport_number}</span>
                            </div>
                          )}
                          {selectedSpeaker.custom_fields.travel_id.frequent_flyer_number && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">FF Number</span>
                              <span className="font-mono text-xs">{selectedSpeaker.custom_fields.travel_id.frequent_flyer_number}</span>
                            </div>
                          )}
                          {selectedSpeaker.custom_fields.travel_id.preferred_airline && selectedSpeaker.custom_fields.travel_id.preferred_airline !== "any" && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Airline</span>
                              <span className="capitalize">{selectedSpeaker.custom_fields.travel_id.preferred_airline.replace("_", " ")}</span>
                            </div>
                          )}
                          {selectedSpeaker.custom_fields.travel_id.seat_preference && selectedSpeaker.custom_fields.travel_id.seat_preference !== "no_preference" && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Seat</span>
                              <span className="capitalize">{selectedSpeaker.custom_fields.travel_id.seat_preference}</span>
                            </div>
                          )}
                          {selectedSpeaker.custom_fields.travel_id.meal_preference && selectedSpeaker.custom_fields.travel_id.meal_preference !== "regular" && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Meal</span>
                              <span className="capitalize">{selectedSpeaker.custom_fields.travel_id.meal_preference.replace("_", " ")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!selectedSpeaker.custom_fields.travel_id?.full_name_as_passport && (
                      <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                        Speaker hasn't provided booking details yet
                      </p>
                    )}

                    {/* Booking Status Tracker */}
                    <div className="space-y-3 pt-3 border-t">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <TicketCheck className="h-3.5 w-3.5" />
                        Booking Status
                      </h4>

                      {/* Flight Booking */}
                      <div className="p-3 bg-muted/30 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium flex items-center gap-1.5">
                            <Plane className="h-3.5 w-3.5" /> Flight
                          </span>
                          <Select
                            value={selectedSpeaker.custom_fields?.booking?.flight_status || "pending"}
                            onValueChange={(value) => {
                              updateBooking.mutate({
                                id: selectedSpeaker.id,
                                booking: { flight_status: value }
                              })
                              setSelectedSpeaker({
                                ...selectedSpeaker,
                                custom_fields: {
                                  ...selectedSpeaker.custom_fields,
                                  booking: {
                                    ...selectedSpeaker.custom_fields?.booking,
                                    flight_status: value as any,
                                  }
                                }
                              })
                            }}
                          >
                            <SelectTrigger className="w-[120px] h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-gray-400" />
                                  Pending
                                </span>
                              </SelectItem>
                              <SelectItem value="booked">
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                                  Booked
                                </span>
                              </SelectItem>
                              <SelectItem value="confirmed">
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-green-500" />
                                  Confirmed
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {(selectedSpeaker.custom_fields?.booking?.flight_status === "booked" ||
                          selectedSpeaker.custom_fields?.booking?.flight_status === "confirmed") && (
                          <div className="space-y-2 pt-2">
                            <Input
                              placeholder="PNR Number"
                              className="h-8 text-sm"
                              defaultValue={selectedSpeaker.custom_fields?.booking?.flight_pnr || ""}
                              onBlur={(e) => {
                                if (e.target.value !== selectedSpeaker.custom_fields?.booking?.flight_pnr) {
                                  updateBooking.mutate({
                                    id: selectedSpeaker.id,
                                    booking: { flight_pnr: e.target.value }
                                  })
                                }
                              }}
                            />
                            <Input
                              placeholder="Flight Number (e.g., AI-123)"
                              className="h-8 text-sm"
                              defaultValue={selectedSpeaker.custom_fields?.booking?.flight_number || ""}
                              onBlur={(e) => {
                                if (e.target.value !== selectedSpeaker.custom_fields?.booking?.flight_number) {
                                  updateBooking.mutate({
                                    id: selectedSpeaker.id,
                                    booking: { flight_number: e.target.value }
                                  })
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Hotel Booking */}
                      {selectedSpeaker.custom_fields?.travel_details?.hotel_required && (
                        <div className="p-3 bg-muted/30 rounded-lg border space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium flex items-center gap-1.5">
                              <Hotel className="h-3.5 w-3.5" /> Hotel
                            </span>
                            <Select
                              value={selectedSpeaker.custom_fields?.booking?.hotel_status || "pending"}
                              onValueChange={(value) => {
                                updateBooking.mutate({
                                  id: selectedSpeaker.id,
                                  booking: { hotel_status: value }
                                })
                                setSelectedSpeaker({
                                  ...selectedSpeaker,
                                  custom_fields: {
                                    ...selectedSpeaker.custom_fields,
                                    booking: {
                                      ...selectedSpeaker.custom_fields?.booking,
                                      hotel_status: value as any,
                                    }
                                  }
                                })
                              }}
                            >
                              <SelectTrigger className="w-[120px] h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-gray-400" />
                                    Pending
                                  </span>
                                </SelectItem>
                                <SelectItem value="booked">
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                                    Booked
                                  </span>
                                </SelectItem>
                                <SelectItem value="confirmed">
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-green-500" />
                                    Confirmed
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {(selectedSpeaker.custom_fields?.booking?.hotel_status === "booked" ||
                            selectedSpeaker.custom_fields?.booking?.hotel_status === "confirmed") && (
                            <div className="space-y-2 pt-2">
                              <Input
                                placeholder="Hotel Name"
                                className="h-8 text-sm"
                                defaultValue={selectedSpeaker.custom_fields?.booking?.hotel_name || ""}
                                onBlur={(e) => {
                                  if (e.target.value !== selectedSpeaker.custom_fields?.booking?.hotel_name) {
                                    updateBooking.mutate({
                                      id: selectedSpeaker.id,
                                      booking: { hotel_name: e.target.value }
                                    })
                                  }
                                }}
                              />
                              <Input
                                placeholder="Confirmation Number"
                                className="h-8 text-sm"
                                defaultValue={selectedSpeaker.custom_fields?.booking?.hotel_confirmation || ""}
                                onBlur={(e) => {
                                  if (e.target.value !== selectedSpeaker.custom_fields?.booking?.hotel_confirmation) {
                                    updateBooking.mutate({
                                      id: selectedSpeaker.id,
                                      booking: { hotel_confirmation: e.target.value }
                                    })
                                  }
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      if (confirm("Remove this speaker from the event?")) {
                        deleteSpeaker.mutate(selectedSpeaker.id)
                        setSelectedSpeaker(null)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Speaker
                  </Button>
                </div>
              </div>
            </>
          )}
        </ResizableSheetContent>
      </Sheet>

      {/* Edit Session Time Dialog */}
      <Dialog open={!!editingSession} onOpenChange={(open) => !open && setEditingSession(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Edit Session Time
            </DialogTitle>
          </DialogHeader>

          {editingSession && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium text-sm">{editingSession.session_name}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Reason for Change (Optional)</Label>
                  <Textarea
                    placeholder="E.g., Speaker requested different time slot"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notifications
                  </h4>

                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Notify Speaker</p>
                      <p className="text-xs text-muted-foreground">Send email to speaker about the change</p>
                    </div>
                    <Switch
                      checked={notifySpeaker}
                      onCheckedChange={setNotifySpeaker}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Notify Scientific Committee</p>
                      <p className="text-xs text-muted-foreground">Send update to committee members</p>
                    </div>
                    <Switch
                      checked={notifyCommittee}
                      onCheckedChange={setNotifyCommittee}
                    />
                  </div>

                  {notifyCommittee && (
                    <div className="space-y-2">
                      <Label>Committee Emails (comma-separated)</Label>
                      <Textarea
                        placeholder="committee@example.com, chair@example.com"
                        value={committeeEmails}
                        onChange={(e) => setCommitteeEmails(e.target.value)}
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditingSession(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => updateSessionTime.mutate()}
                  disabled={updateSessionTime.isPending}
                >
                  {updateSessionTime.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Update & Notify
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
