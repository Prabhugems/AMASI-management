"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  ResizableSheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Send,
  Loader2,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  Mail,
  Users,
  AlertCircle,
  X,
  ExternalLink,
  Copy,
  Calendar,
  MapPin,
  User,
  Link2,
  RefreshCw,
  Eye,
  Phone,
  MessageCircle,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Speaker = {
  id: string
  attendee_name: string
  attendee_email: string
  attendee_designation?: string
  attendee_phone?: string
  attendee_institution?: string
  custom_fields: {
    invitation_status?: string
    invitation_sent_at?: string
    portal_token?: string
    portal_last_accessed?: string
    invitation_email_id?: string
    invitation_send_count?: number
    portal_view_count?: number
  } | null
}

type FacultyAssignment = {
  id: string
  session_id: string
  faculty_name: string
  faculty_email: string
  role: string
  topic_title: string | null
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall: string | null
  session_name: string | null
  status: string
  invitation_sent_at: string | null
  responded_at: string | null
  response_notes: string | null
}

function formatTime(time: string | null) {
  if (!time || !time.includes(":")) return time || ""
  const [hours, minutes] = time.split(":")
  const h = parseInt(hours)
  if (isNaN(h)) return time
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes || "00"} ${ampm}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatDateTime(isoStr: string) {
  return new Date(isoStr).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export default function SpeakerInvitationsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "pending" | "sent" | "viewed" | "confirmed" | "declined">("all")
  const [selectedSpeakers, setSelectedSpeakers] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [lastSendResult, setLastSendResult] = useState<{ sent: number; failed: number; skipped: number; errors: string[]; provider?: string } | null>(null)
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null)
  const [resending, setResending] = useState(false)
  const [resendingWhatsApp, setResendingWhatsApp] = useState(false)

  // Fetch event details
  const { data: eventData } = useQuery({
    queryKey: ["event-detail", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("id, name")
        .eq("id", eventId)
        .single()
      return data as { id: string; name: string } | null
    },
  })

  // Fetch speakers
  const { data: speakers, isLoading } = useQuery({
    queryKey: ["speaker-invitations", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, attendee_designation, attendee_phone, attendee_institution, custom_fields")
        .eq("event_id", eventId)
        .or("attendee_designation.ilike.%speaker%,attendee_designation.ilike.%faculty%,attendee_designation.ilike.%chairperson%,attendee_designation.ilike.%moderator%")
        .order("attendee_name")

      return (data || []) as Speaker[]
    },
  })

  // Fetch faculty assignments for the selected speaker
  const { data: speakerAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["speaker-assignments", eventId, selectedSpeaker?.attendee_email],
    queryFn: async () => {
      if (!selectedSpeaker?.attendee_email) return []
      const { data } = await (supabase as any)
        .from("faculty_assignments")
        .select("id, session_id, faculty_name, faculty_email, role, topic_title, session_date, start_time, end_time, hall, session_name, status, invitation_sent_at, responded_at, response_notes")
        .eq("event_id", eventId)
        .ilike("faculty_email", selectedSpeaker.attendee_email)
        .order("session_date")
        .order("start_time")

      return (data || []) as FacultyAssignment[]
    },
    enabled: !!selectedSpeaker?.attendee_email,
  })

  // Filter speakers
  const filteredSpeakers = useMemo(() => {
    if (!speakers) return []
    return speakers.filter(s => {
      const matchesSearch =
        s.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
        (s.attendee_email || "").toLowerCase().includes(search.toLowerCase())

      const status = s.custom_fields?.invitation_status || "pending"
      const hasViewed = (s.custom_fields?.portal_view_count || 0) > 0
      const matchesFilter =
        filter === "all" ||
        (filter === "pending" && status === "pending") ||
        (filter === "sent" && status === "sent") ||
        (filter === "viewed" && hasViewed) ||
        (filter === "confirmed" && status === "confirmed") ||
        (filter === "declined" && status === "declined")

      return matchesSearch && matchesFilter
    })
  }, [speakers, search, filter])

  // Stats
  const stats = useMemo(() => {
    if (!speakers) return { total: 0, pending: 0, sent: 0, viewed: 0, confirmed: 0, declined: 0 }
    const pending = speakers.filter(s => !s.custom_fields?.invitation_status || s.custom_fields?.invitation_status === "pending").length
    const sent = speakers.filter(s => s.custom_fields?.invitation_status === "sent").length
    const viewed = speakers.filter(s => (s.custom_fields?.portal_view_count || 0) > 0).length
    const confirmed = speakers.filter(s => s.custom_fields?.invitation_status === "confirmed").length
    const declined = speakers.filter(s => s.custom_fields?.invitation_status === "declined").length
    return { total: speakers.length, pending, sent, viewed, confirmed, declined }
  }, [speakers])

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedSpeakers)
    if (newSelection.has(id)) newSelection.delete(id)
    else newSelection.add(id)
    setSelectedSpeakers(newSelection)
  }

  const sendInvitations = async () => {
    if (selectedSpeakers.size === 0) return
    setSending(true)

    try {
      const speakersToSend = Array.from(selectedSpeakers)

      const response = await fetch("/api/email/speaker-invitation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_ids: speakersToSend,
          event_id: eventId,
        }),
      })

      const result = await response.json()

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["speaker-invitations", eventId] })

        if (result.results) {
          const { sent, failed, skipped, errors, provider } = result.results
          setLastSendResult({ sent, failed, skipped, errors: errors || [], provider })
          if (failed > 0 || skipped > 0) {
            toast.warning(`Sent: ${sent}, Failed: ${failed}, Skipped: ${skipped} — see details below`)
          } else {
            toast.success(`Successfully sent invitations to ${sent} speakers`)
          }
        } else {
          toast.success(`Sent invitations to ${selectedSpeakers.size} speakers`)
        }
        setSelectedSpeakers(new Set())
      } else {
        toast.error(result.error || "Failed to send invitations")
      }
    } catch (error: any) {
      console.error("Error sending invitations:", error)
      toast.error(error?.message || "Failed to send invitations", { duration: 10000 })
    } finally {
      setSending(false)
    }
  }

  const resendInvitation = async (speaker: Speaker) => {
    if (!speaker.attendee_email) {
      toast.error("No email address — cannot send invitation")
      return
    }
    setResending(true)
    try {
      const response = await fetch("/api/email/speaker-invitation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_ids: [speaker.id],
          event_id: eventId,
        }),
      })

      const result = await response.json()
      if (result.success && result.results?.sent > 0) {
        toast.success(`Invitation re-sent to ${speaker.attendee_name}`)
        queryClient.invalidateQueries({ queryKey: ["speaker-invitations", eventId] })
        // Update the selected speaker's data
        const updated = speakers?.find(s => s.id === speaker.id)
        if (updated) setSelectedSpeaker({ ...updated, custom_fields: { ...updated.custom_fields, invitation_status: "sent", invitation_sent_at: new Date().toISOString() } })
      } else {
        const errorMsg = result.results?.errors?.[0] || result.error || "Failed to send"
        toast.error(errorMsg)
      }
    } catch {
      toast.error("Failed to resend invitation")
    } finally {
      setResending(false)
    }
  }

  const sendWhatsAppInvitations = async () => {
    if (selectedSpeakers.size === 0) return
    setSendingWhatsApp(true)

    const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] }

    try {
      const speakersToSend = (speakers || []).filter(s => selectedSpeakers.has(s.id))

      for (const speaker of speakersToSend) {
        if (!speaker.attendee_phone) {
          results.skipped++
          results.errors.push(`${speaker.attendee_name}: No phone number`)
          continue
        }

        const portalToken = speaker.custom_fields?.portal_token
        if (!portalToken) {
          results.skipped++
          results.errors.push(`${speaker.attendee_name}: No portal token (send email invitation first)`)
          continue
        }

        const portalUrl = `https://collegeofmas.org.in/speaker/${portalToken}`

        try {
          const response = await fetch("/api/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: speaker.attendee_phone,
              recipient_name: speaker.attendee_name,
              type: "template",
              template_name: "speaker_invitation",
              body_values: {
                Speaker_Name: speaker.attendee_name,
                "2": eventData?.name || "Event",
                Portal_URL: portalUrl,
              },
              event_id: eventId,
              registration_id: speaker.id,
            }),
          })

          const result = await response.json()
          if (result.success) {
            results.sent++
          } else {
            results.failed++
            results.errors.push(`${speaker.attendee_name}: ${result.error}`)
          }
        } catch (err: any) {
          results.failed++
          results.errors.push(`${speaker.attendee_name}: ${err.message}`)
        }
      }

      setLastSendResult({ ...results, provider: "gallabox" })
      if (results.sent > 0) {
        toast.success(`WhatsApp sent to ${results.sent} speakers`)
      }
      if (results.failed > 0 || results.skipped > 0) {
        toast.warning(`WhatsApp: Sent ${results.sent}, Failed ${results.failed}, Skipped ${results.skipped}`)
      }
      setSelectedSpeakers(new Set())
    } catch (error: any) {
      toast.error(error?.message || "Failed to send WhatsApp invitations")
    } finally {
      setSendingWhatsApp(false)
    }
  }

  const resendWhatsApp = async (speaker: Speaker) => {
    if (!speaker.attendee_phone) {
      toast.error("No phone number — cannot send WhatsApp")
      return
    }
    const portalToken = speaker.custom_fields?.portal_token
    if (!portalToken) {
      toast.error("No portal token — send email invitation first")
      return
    }

    setResendingWhatsApp(true)
    try {
      const portalUrl = `https://collegeofmas.org.in/speaker/${portalToken}`
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: speaker.attendee_phone,
          recipient_name: speaker.attendee_name,
          type: "template",
          template_name: "speaker_invitation",
          body_values: {
            Speaker_Name: speaker.attendee_name,
            Event_Name: "122 FMAS Skill Course and FMAS Exam",
            Portal_URL: portalUrl,
          },
          event_id: eventId,
          registration_id: speaker.id,
        }),
      })

      const result = await response.json()
      if (result.success) {
        toast.success(`WhatsApp sent to ${speaker.attendee_name}`)
      } else {
        toast.error(result.error || "Failed to send WhatsApp")
      }
    } catch {
      toast.error("Failed to send WhatsApp")
    } finally {
      setResendingWhatsApp(false)
    }
  }

  const copyPortalLink = (token: string) => {
    const url = `https://collegeofmas.org.in/speaker/${token}`
    navigator.clipboard.writeText(url)
    toast.success("Portal link copied to clipboard")
  }

  const downloadBroadcastTemplate = async () => {
    try {
      const speakersToExport = selectedSpeakers.size > 0
        ? (speakers || []).filter(s => selectedSpeakers.has(s.id))
        : filteredSpeakers

      if (speakersToExport.length === 0) {
        toast.error("No speakers to export. Select speakers or adjust filters.")
        return
      }

      const withPortal = speakersToExport.filter(s => s.custom_fields?.portal_token)

      if (withPortal.length === 0) {
        toast.error("No speakers with portal token found. Send email invitations first.")
        return
      }

      const withPhone = withPortal.filter(s => s.attendee_phone)
      if (withPhone.length === 0) {
        toast.error(`${withPortal.length} speakers have portal tokens but none have phone numbers. Add phone numbers first.`)
        return
      }

      const xlsxModule = await import("xlsx") as any
      // Handle webpack's CJS/ESM interop - check where utils actually lives
      const XLSX = xlsxModule.utils ? xlsxModule : xlsxModule.default
      if (!XLSX?.utils) {
        toast.error("Failed to load Excel library. Please try again.")
        console.error("xlsx module structure:", Object.keys(xlsxModule), "default keys:", xlsxModule.default ? Object.keys(xlsxModule.default) : "no default")
        return
      }
      const eventName = eventData?.name || "Event"

      const data = withPhone.map(s => ({
        Name: s.attendee_name,
        Phone: s.attendee_phone!,
        Speaker_Name: s.attendee_name,
        Event_Name: eventName,
        Portal_URL: `https://collegeofmas.org.in/speaker/${s.custom_fields!.portal_token}`,
      }))

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Broadcast")
      const fileName = `whatsapp-broadcast-${eventName.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 40)}.xlsx`

      // Use Blob-based download for better browser compatibility
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Broadcast template downloaded for ${withPhone.length} speakers`)
    } catch (error) {
      console.error("Broadcast template download error:", error)
      toast.error("Failed to generate broadcast template. Check console for details.")
    }
  }

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />Confirmed</Badge>
      case "sent":
        return <Badge className="bg-blue-500 text-white"><Mail className="h-3 w-3 mr-1" />Sent</Badge>
      case "declined":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>
      default:
        return <Badge variant="outline" className="text-amber-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
    }
  }

  const getAssignmentStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500/10 text-green-700 border-green-200" variant="outline">Confirmed</Badge>
      case "invited":
        return <Badge className="bg-blue-500/10 text-blue-700 border-blue-200" variant="outline">Invited</Badge>
      case "declined":
        return <Badge className="bg-red-500/10 text-red-700 border-red-200" variant="outline">Declined</Badge>
      case "change_requested":
        return <Badge className="bg-amber-500/10 text-amber-700 border-amber-200" variant="outline">Change Requested</Badge>
      default:
        return <Badge variant="outline">Pending</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Speaker Invitations</h1>
        <p className="text-muted-foreground">Send and track speaker invitations</p>
      </div>

      {/* Last send result details */}
      {lastSendResult && (lastSendResult.failed > 0 || lastSendResult.skipped > 0) && (
        <div className={`rounded-lg border p-4 ${lastSendResult.failed > 0 ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className={`h-5 w-5 mt-0.5 shrink-0 ${lastSendResult.failed > 0 ? "text-red-600" : "text-amber-600"}`} />
              <div>
                <p className="font-medium">
                  Invitation Results: {lastSendResult.sent} sent, {lastSendResult.failed} failed, {lastSendResult.skipped} skipped
                  {lastSendResult.provider && <span className="text-xs font-normal text-muted-foreground ml-2">(via {lastSendResult.provider})</span>}
                </p>
                {lastSendResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Reasons:</p>
                    <ul className="text-sm space-y-1 max-h-40 overflow-auto">
                      {lastSendResult.errors.map((err, i) => (
                        <li key={i} className="text-muted-foreground flex items-start gap-1">
                          <span className="text-destructive shrink-0">•</span> {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => setLastSendResult(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "all" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("all")}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "pending" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("pending")}
        >
          <div className="flex items-center gap-2 text-amber-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Pending</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.pending}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "sent" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("sent")}
        >
          <div className="flex items-center gap-2 text-blue-500">
            <Mail className="h-4 w-4" />
            <span className="text-sm">Sent</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.sent}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "viewed" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("viewed")}
        >
          <div className="flex items-center gap-2 text-purple-500">
            <Eye className="h-4 w-4" />
            <span className="text-sm">Viewed</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.viewed}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "confirmed" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("confirmed")}
        >
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Confirmed</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.confirmed}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "declined" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("declined")}
        >
          <div className="flex items-center gap-2 text-red-500">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">Declined</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.declined}</p>
        </div>
      </div>

      {/* Actions */}
      {selectedSpeakers.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/20 dark:border-blue-800">
          <Send className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-800 dark:text-blue-300">{selectedSpeakers.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setSelectedSpeakers(new Set())}>
            Clear
          </Button>
          <Button size="sm" onClick={sendInvitations} disabled={sending || sendingWhatsApp}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            {sending ? "Sending..." : "Send Email"}
          </Button>
          <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/20" onClick={sendWhatsAppInvitations} disabled={sending || sendingWhatsApp}>
            {sendingWhatsApp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
            {sendingWhatsApp ? "Sending..." : "Send WhatsApp"}
          </Button>
        </div>
      )}

      {/* Search + Download */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search speakers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="sm" onClick={downloadBroadcastTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Broadcast Template
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedSpeakers.size === filteredSpeakers.length && filteredSpeakers.length > 0}
                  onCheckedChange={() => {
                    if (selectedSpeakers.size === filteredSpeakers.length) {
                      setSelectedSpeakers(new Set())
                    } else {
                      setSelectedSpeakers(new Set(filteredSpeakers.map(s => s.id)))
                    }
                  }}
                />
              </TableHead>
              <TableHead>Speaker</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Sent</TableHead>
              <TableHead className="text-center">Views</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSpeakers.map((speaker) => (
              <TableRow
                key={speaker.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  selectedSpeaker?.id === speaker.id && "bg-primary/5"
                )}
                onClick={() => setSelectedSpeaker(speaker)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedSpeakers.has(speaker.id)}
                    onCheckedChange={() => toggleSelection(speaker.id)}
                  />
                </TableCell>
                <TableCell>
                  <p className="font-medium">{speaker.attendee_name}</p>
                  <p className="text-xs text-muted-foreground">{speaker.attendee_email || <span className="text-amber-500 italic">No email</span>}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {speaker.attendee_designation || "-"}
                </TableCell>
                <TableCell>
                  {getStatusBadge(speaker.custom_fields?.invitation_status)}
                </TableCell>
                <TableCell className="text-center">
                  {(speaker.custom_fields?.invitation_send_count || 0) > 0 ? (
                    <Badge variant="secondary" className="text-xs">{speaker.custom_fields!.invitation_send_count}x</Badge>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {(speaker.custom_fields?.portal_view_count || 0) > 0 ? (
                    <span className="inline-flex items-center gap-1 text-purple-600">
                      <Eye className="h-3.5 w-3.5" />
                      <span className="text-sm font-medium">{speaker.custom_fields!.portal_view_count}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Speaker Detail Side Panel */}
      <Sheet open={!!selectedSpeaker} onOpenChange={(open) => { if (!open) setSelectedSpeaker(null) }}>
        <ResizableSheetContent side="right" defaultWidth={480} storageKey="speaker-detail-width">
          {selectedSpeaker && (
            <div className="p-4 space-y-6">
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg shrink-0">
                    {selectedSpeaker.attendee_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="text-left">{selectedSpeaker.attendee_name}</SheetTitle>
                    <SheetDescription className="text-left">
                      {selectedSpeaker.attendee_designation || "Speaker"}
                      {selectedSpeaker.attendee_institution && (
                        <span className="block text-xs">{selectedSpeaker.attendee_institution}</span>
                      )}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              {/* Contact Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact</h3>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    {selectedSpeaker.attendee_email ? (
                      <span>{selectedSpeaker.attendee_email}</span>
                    ) : (
                      <span className="text-amber-500 italic">No email address</span>
                    )}
                  </div>
                  {selectedSpeaker.attendee_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{selectedSpeaker.attendee_phone}</span>
                      <a
                        href={`tel:${selectedSpeaker.attendee_phone}`}
                        className="text-blue-500 hover:text-blue-600 text-xs"
                      >
                        Call
                      </a>
                      <a
                        href={`https://wa.me/${selectedSpeaker.attendee_phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-700 text-xs"
                      >
                        WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Invitation Tracking */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Invitation Tracking</h3>
                <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    {getStatusBadge(selectedSpeaker.custom_fields?.invitation_status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Times Sent</span>
                    {(selectedSpeaker.custom_fields?.invitation_send_count || 0) > 0 ? (
                      <Badge variant="secondary">{selectedSpeaker.custom_fields!.invitation_send_count}x</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never sent</span>
                    )}
                  </div>
                  {selectedSpeaker.custom_fields?.invitation_sent_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Sent</span>
                      <span className="text-sm">{formatDateTime(selectedSpeaker.custom_fields.invitation_sent_at)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Portal Views</span>
                    {(selectedSpeaker.custom_fields?.portal_view_count || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 text-purple-600">
                        <Eye className="h-3.5 w-3.5" />
                        <span className="text-sm font-medium">{selectedSpeaker.custom_fields!.portal_view_count}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not viewed</span>
                    )}
                  </div>
                  {selectedSpeaker.custom_fields?.portal_last_accessed && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Viewed</span>
                      <span className="text-sm">{formatDateTime(selectedSpeaker.custom_fields.portal_last_accessed)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Speaker Portal */}
              {selectedSpeaker.custom_fields?.portal_token && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Speaker Portal</h3>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs font-mono text-muted-foreground truncate">
                        /speaker/{selectedSpeaker.custom_fields.portal_token.slice(0, 8)}...
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      asChild
                    >
                      <a
                        href={`https://collegeofmas.org.in/speaker/${selectedSpeaker.custom_fields.portal_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Open Portal
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Assigned Sessions */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Assigned Sessions
                </h3>
                {assignmentsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : speakerAssignments && speakerAssignments.length > 0 ? (
                  <div className="space-y-2">
                    {speakerAssignments.map((a) => (
                      <div key={a.id} className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm">{a.session_name || a.topic_title || "Untitled Session"}</p>
                          {getAssignmentStatusBadge(a.status)}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs px-1.5 py-0">{a.role}</Badge>
                        </div>
                        {(a.session_date || a.start_time) && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {a.session_date && formatDate(a.session_date)}
                            {a.start_time && (
                              <span> {formatTime(a.start_time)}{a.end_time ? ` - ${formatTime(a.end_time)}` : ""}</span>
                            )}
                          </div>
                        )}
                        {a.hall && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {a.hall}
                          </div>
                        )}
                        {a.response_notes && (
                          <div className="mt-1 p-2 bg-background rounded text-xs text-muted-foreground border">
                            <span className="font-medium">Response:</span> {a.response_notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic bg-muted/50 rounded-lg p-3">
                    No faculty assignments found for this speaker.
                  </p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="space-y-3 pt-2 border-t">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Quick Actions</h3>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => resendInvitation(selectedSpeaker)}
                    disabled={resending || !selectedSpeaker.attendee_email}
                    className="w-full"
                  >
                    {resending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4 mr-2" />
                    )}
                    {selectedSpeaker.custom_fields?.invitation_status === "sent" || selectedSpeaker.custom_fields?.invitation_status === "confirmed" ? "Resend Email" : "Send Email"}
                  </Button>
                  {selectedSpeaker.attendee_phone && (
                    <Button
                      variant="outline"
                      className="w-full border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/20"
                      onClick={() => resendWhatsApp(selectedSpeaker)}
                      disabled={resendingWhatsApp || !selectedSpeaker.custom_fields?.portal_token}
                    >
                      {resendingWhatsApp ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <MessageCircle className="h-4 w-4 mr-2" />
                      )}
                      Send WhatsApp
                    </Button>
                  )}
                  {selectedSpeaker.custom_fields?.portal_token && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => copyPortalLink(selectedSpeaker.custom_fields!.portal_token!)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Portal Link
                    </Button>
                  )}
                  <div className="flex gap-2">
                    {selectedSpeaker.attendee_phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        asChild
                      >
                        <a
                          href={`https://wa.me/${selectedSpeaker.attendee_phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Dear ${selectedSpeaker.attendee_name}, we have sent you a speaker invitation for our event. Please check your email (${selectedSpeaker.attendee_email}) for details.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="h-4 w-4 mr-1.5" />
                          WhatsApp
                        </a>
                      </Button>
                    )}
                    {selectedSpeaker.attendee_email && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        asChild
                      >
                        <a href={`mailto:${selectedSpeaker.attendee_email}`}>
                          <Mail className="h-4 w-4 mr-1.5" />
                          Email
                        </a>
                      </Button>
                    )}
                  </div>
                  {!selectedSpeaker.attendee_email && (
                    <p className="text-xs text-amber-500 text-center">Add an email address to send invitations</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </ResizableSheetContent>
      </Sheet>
    </div>
  )
}
