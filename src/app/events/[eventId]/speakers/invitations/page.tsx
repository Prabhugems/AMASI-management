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
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Speaker = {
  id: string
  attendee_name: string
  attendee_email: string
  attendee_designation?: string
  custom_fields: {
    invitation_status?: string
    invitation_sent_at?: string
    portal_token?: string
  } | null
}

export default function SpeakerInvitationsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "pending" | "sent" | "confirmed">("all")
  const [selectedSpeakers, setSelectedSpeakers] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [lastSendResult, setLastSendResult] = useState<{ sent: number; failed: number; skipped: number; errors: string[]; provider?: string } | null>(null)

  // Fetch speakers
  const { data: speakers, isLoading } = useQuery({
    queryKey: ["speaker-invitations", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, attendee_designation, custom_fields")
        .eq("event_id", eventId)
        .or("attendee_designation.ilike.%speaker%,attendee_designation.ilike.%faculty%,attendee_designation.ilike.%chairperson%,attendee_designation.ilike.%moderator%")
        .order("attendee_name")

      return (data || []) as Speaker[]
    },
  })

  // Filter speakers
  const filteredSpeakers = useMemo(() => {
    if (!speakers) return []
    return speakers.filter(s => {
      const matchesSearch =
        s.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
        s.attendee_email.toLowerCase().includes(search.toLowerCase())

      const status = s.custom_fields?.invitation_status || "pending"
      const matchesFilter =
        filter === "all" ||
        (filter === "pending" && status === "pending") ||
        (filter === "sent" && status === "sent") ||
        (filter === "confirmed" && status === "confirmed")

      return matchesSearch && matchesFilter
    })
  }, [speakers, search, filter])

  // Stats
  const stats = useMemo(() => {
    if (!speakers) return { total: 0, pending: 0, sent: 0, confirmed: 0 }
    const pending = speakers.filter(s => !s.custom_fields?.invitation_status || s.custom_fields?.invitation_status === "pending").length
    const sent = speakers.filter(s => s.custom_fields?.invitation_status === "sent").length
    const confirmed = speakers.filter(s => s.custom_fields?.invitation_status === "confirmed").length
    return { total: speakers.length, pending, sent, confirmed }
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
      // Server generates portal tokens if missing, so just send the IDs
      const speakersToSend = Array.from(selectedSpeakers)

      // Call the bulk email API
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
        // Server already updated custom_fields with invitation_status, invitation_sent, etc.
        // Just refresh the data from the server
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
    } catch (error) {
      console.error("Error sending invitations:", error)
      toast.error("Failed to send invitations")
    } finally {
      setSending(false)
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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
      </div>

      {/* Actions */}
      {selectedSpeakers.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Send className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-800">{selectedSpeakers.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setSelectedSpeakers(new Set())}>
            Clear
          </Button>
          <Button size="sm" onClick={sendInvitations} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {sending ? "Sending..." : "Send Invitations"}
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search speakers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSpeakers.map((speaker) => (
              <TableRow key={speaker.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedSpeakers.has(speaker.id)}
                    onCheckedChange={() => toggleSelection(speaker.id)}
                  />
                </TableCell>
                <TableCell>
                  <p className="font-medium">{speaker.attendee_name}</p>
                  <p className="text-xs text-muted-foreground">{speaker.attendee_email}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {speaker.attendee_designation || "-"}
                </TableCell>
                <TableCell>
                  {getStatusBadge(speaker.custom_fields?.invitation_status)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
