"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Mail,
  Loader2,
  Send,
  Users,
  CheckCircle,
  Clock,
  Filter,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function CommunicationsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [statusFilter, setStatusFilter] = useState<string>("confirmed")
  const [ticketFilter, setTicketFilter] = useState<string>("all")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  // Fetch registrations
  const { data: registrations, isLoading } = useQuery({
    queryKey: ["communications-registrations", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, status, ticket_type:ticket_types(name)")
        .eq("event_id", eventId)
        .order("attendee_name")

      return data || []
    },
  })

  // Fetch ticket types
  const { data: ticketTypes } = useQuery({
    queryKey: ["ticket-types", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ticket_types")
        .select("id, name")
        .eq("event_id", eventId)

      return data || []
    },
  })

  // Filter recipients
  const recipients = useMemo(() => {
    if (!registrations) return []
    return registrations.filter((r: any) => {
      const matchesStatus = statusFilter === "all" || r.status === statusFilter
      const matchesTicket = ticketFilter === "all" || r.ticket_type?.name === ticketFilter
      return matchesStatus && matchesTicket
    })
  }, [registrations, statusFilter, ticketFilter])

  // Stats
  const stats = useMemo(() => {
    if (!registrations) return { total: 0, confirmed: 0, pending: 0 }
    return {
      total: registrations.length,
      confirmed: registrations.filter((r: any) => r.status === "confirmed").length,
      pending: registrations.filter((r: any) => r.status === "pending").length,
    }
  }, [registrations])

  const sendEmails = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Subject and message are required")
      return
    }
    if (recipients.length === 0) {
      toast.error("No recipients selected")
      return
    }

    setSending(true)
    try {
      const response = await fetch("/api/email/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          subject: subject.trim(),
          message: message.trim(),
          recipient_ids: recipients.map((r: any) => r.id),
        }),
      })

      const result = await response.json()

      if (result.success) {
        const { sent, failed } = result.results
        if (failed > 0) {
          toast.warning(`Sent: ${sent}, Failed: ${failed}`)
        } else {
          toast.success(`Successfully sent to ${sent} recipients`)
        }
        setSubject("")
        setMessage("")
      } else {
        toast.error(result.error || "Failed to send emails")
      }
    } catch (error) {
      console.error("Error sending emails:", error)
      toast.error("Failed to send emails")
    } finally {
      setSending(false)
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Communications</h1>
        <p className="text-muted-foreground">Send emails to registrants</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            statusFilter === "all" && "ring-2 ring-primary"
          )}
          onClick={() => setStatusFilter("all")}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">All</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            statusFilter === "confirmed" && "ring-2 ring-primary"
          )}
          onClick={() => setStatusFilter("confirmed")}
        >
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Confirmed</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.confirmed}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            statusFilter === "pending" && "ring-2 ring-primary"
          )}
          onClick={() => setStatusFilter("pending")}
        >
          <div className="flex items-center gap-2 text-amber-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Pending</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.pending}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Compose */}
        <div className="md:col-span-2 bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Compose Email</h3>
          <div className="space-y-4">
            <div>
              <Label>Subject *</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message..."
                rows={10}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {"{{name}}"} to personalize with recipient's name
              </p>
            </div>
          </div>
        </div>

        {/* Recipients */}
        <div className="space-y-4">
          <div className="bg-card rounded-lg border p-4">
            <h3 className="font-semibold mb-4">Recipients</h3>

            <div className="space-y-3">
              <div>
                <Label>Ticket Type</Label>
                <Select value={ticketFilter} onValueChange={setTicketFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tickets</SelectItem>
                    {ticketTypes?.map((t: any) => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Selected Recipients</span>
                  <Badge variant="secondary">{recipients.length}</Badge>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1">
                {recipients.slice(0, 10).map((r: any) => (
                  <div key={r.id} className="text-sm py-1 flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{r.attendee_email}</span>
                  </div>
                ))}
                {recipients.length > 10 && (
                  <p className="text-xs text-muted-foreground pt-1">
                    +{recipients.length - 10} more
                  </p>
                )}
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={sendEmails}
            disabled={sending || recipients.length === 0 || !subject.trim() || !message.trim()}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to {recipients.length} Recipients
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
