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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Mail,
  MessageSquare,
  Phone,
  Send,
  Users,
  Loader2,
  CheckCircle,
  Clock,
  FileText,
  Eye,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Channel = "email" | "whatsapp" | "sms"

export default function ComposeMessagePage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [channel, setChannel] = useState<Channel>("email")
  const [templateId, setTemplateId] = useState<string>("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [ticketFilter, setTicketFilter] = useState<string>("all")
  const [designationFilter, setDesignationFilter] = useState<string>("all")
  const [sending, setSending] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Fetch communication settings
  const defaultSettings = {
    channels_enabled: { email: true, whatsapp: false, sms: false, webhook: false },
    email_provider: "default",
    whatsapp_provider: null,
    sms_provider: null,
  }
  const { data: settings } = useQuery({
    queryKey: ["communication-settings", eventId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/communications/settings?event_id=${eventId}`)
        if (!response.ok) return defaultSettings
        const result = await response.json()
        return result.settings || defaultSettings
      } catch {
        return defaultSettings
      }
    },
  })

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ["message-templates", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("message_templates")
        .select("*")
        .or(`event_id.eq.${eventId},event_id.is.null`)
        .eq("is_active", true)
        .order("name")

      return data || []
    },
  })

  // Fetch registrations
  const { data: registrations, isLoading: registrationsLoading } = useQuery({
    queryKey: ["compose-registrations", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, attendee_phone, status, attendee_designation, ticket_type:ticket_types(name)")
        .eq("event_id", eventId)
        .order("attendee_name")

      return data || []
    },
  })

  // Fetch ticket types
  const { data: ticketTypes } = useQuery({
    queryKey: ["ticket-types-compose", eventId],
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
      const matchesDesignation = designationFilter === "all" ||
        (designationFilter === "faculty" && (r.attendee_designation?.toLowerCase().includes("speaker") || r.attendee_designation?.toLowerCase().includes("faculty"))) ||
        (designationFilter === "delegate" && !r.attendee_designation?.toLowerCase().includes("speaker") && !r.attendee_designation?.toLowerCase().includes("faculty"))

      // For WhatsApp/SMS, filter only those with phone numbers
      if (channel !== "email" && !r.attendee_phone) return false

      return matchesStatus && matchesTicket && matchesDesignation
    })
  }, [registrations, statusFilter, ticketFilter, designationFilter, channel])

  // Available channels
  const channels = [
    { id: "email" as const, label: "Email", icon: Mail, color: "text-blue-500", enabled: settings?.channels_enabled?.email },
    { id: "whatsapp" as const, label: "WhatsApp", icon: MessageSquare, color: "text-green-500", enabled: settings?.channels_enabled?.whatsapp },
    { id: "sms" as const, label: "SMS", icon: Phone, color: "text-purple-500", enabled: settings?.channels_enabled?.sms },
  ]

  // Filter templates by channel
  const filteredTemplates = useMemo(() => {
    if (!templates) return []
    return templates.filter((t: any) => t.channel === channel || t.channel === "all")
  }, [templates, channel])

  // Apply template
  const applyTemplate = (templateId: string) => {
    const template = templates?.find((t: any) => t.id === templateId)
    if (template) {
      if (channel === "email") {
        setSubject(template.email_subject || "")
        setMessage(template.email_body || template.message_body || "")
      } else {
        setMessage(template.message_body || "")
      }
    }
    setTemplateId(templateId)
  }

  // Send messages
  const handleSend = async () => {
    if (recipients.length === 0) {
      toast.error("No recipients selected")
      return
    }

    if (channel === "email" && !subject.trim()) {
      toast.error("Subject is required for email")
      return
    }

    if (!message.trim()) {
      toast.error("Message is required")
      return
    }

    setSending(true)
    try {
      const response = await fetch("/api/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          channel,
          recipient_ids: recipients.map((r: any) => r.id),
          subject: subject.trim(),
          message: message.trim(),
          template_id: templateId || undefined,
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
        // Reset form
        setSubject("")
        setMessage("")
        setTemplateId("")
      } else {
        toast.error(result.error || "Failed to send messages")
      }
    } catch (error) {
      console.error("Error sending messages:", error)
      toast.error("Failed to send messages")
    } finally {
      setSending(false)
    }
  }

  // Preview message with personalization
  const previewMessage = useMemo(() => {
    const sampleRecipient = recipients[0]
    if (!sampleRecipient) return message
    return message.replace(/\{\{name\}\}/gi, sampleRecipient.attendee_name || "John Doe")
  }, [message, recipients])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Compose Message</h1>
        <p className="text-muted-foreground">Send messages via email, WhatsApp, or SMS</p>
      </div>

      {/* Channel Selector */}
      <div className="flex gap-2">
        {channels.map((ch) => {
          const Icon = ch.icon
          const isSelected = channel === ch.id
          const isEnabled = ch.enabled

          return (
            <button
              key={ch.id}
              onClick={() => isEnabled && setChannel(ch.id)}
              disabled={!isEnabled}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all",
                isSelected
                  ? "border-primary bg-primary/10"
                  : isEnabled
                  ? "border-border hover:border-muted-foreground/50"
                  : "border-border opacity-50 cursor-not-allowed"
              )}
            >
              <Icon className={cn("h-5 w-5", isSelected ? ch.color : "text-muted-foreground")} />
              <span className={isSelected ? "font-medium" : "text-muted-foreground"}>{ch.label}</span>
              {!isEnabled && (
                <Badge variant="secondary" className="text-[10px]">Off</Badge>
              )}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Compose Area */}
        <div className="col-span-2 space-y-4">
          <div className="bg-card rounded-lg border p-5 space-y-4">
            {/* Template Selector */}
            <div className="space-y-2">
              <Label>Template (Optional)</Label>
              <Select value={templateId || "none"} onValueChange={(val) => val === "none" ? setTemplateId("") : applyTemplate(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template or compose from scratch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {filteredTemplates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {t.name}
                        {t.is_system && <Badge variant="secondary" className="text-[10px]">System</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject (Email only) */}
            {channel === "email" && (
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject"
                />
              </div>
            )}

            {/* Message */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Message *</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {showPreview ? "Edit" : "Preview"}
                </Button>
              </div>

              {showPreview ? (
                <div className="min-h-[200px] p-4 rounded-lg border bg-secondary/30 whitespace-pre-wrap">
                  {previewMessage || <span className="text-muted-foreground">No message content</span>}
                </div>
              ) : (
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={channel === "email"
                    ? "Write your email message..."
                    : channel === "whatsapp"
                    ? "Write your WhatsApp message..."
                    : "Write your SMS (160 chars per segment)..."
                  }
                  rows={10}
                />
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <p>Use {"{{name}}"} to personalize with recipient&apos;s name</p>
                {channel === "sms" && (
                  <p>{message.length} / 160 characters ({Math.ceil(message.length / 160)} segment{Math.ceil(message.length / 160) !== 1 ? "s" : ""})</p>
                )}
              </div>
            </div>

            {/* Channel-specific warnings */}
            {channel === "whatsapp" && !settings?.whatsapp_provider && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm">WhatsApp is not configured. Go to Settings to set it up.</p>
              </div>
            )}

            {channel === "sms" && !settings?.sms_provider && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm">SMS is not configured. Go to Settings to set it up.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recipients Panel */}
        <div className="space-y-4">
          <div className="bg-card rounded-lg border p-5 space-y-4">
            <h3 className="font-semibold">Recipients</h3>

            {/* Filters */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Ticket Type</Label>
                <Select value={ticketFilter} onValueChange={setTicketFilter}>
                  <SelectTrigger>
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

              <div className="space-y-1">
                <Label className="text-xs">Designation</Label>
                <Select value={designationFilter} onValueChange={setDesignationFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="faculty">Faculty/Speakers</SelectItem>
                    <SelectItem value="delegate">Delegates</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selected Count */}
            <div className="flex items-center justify-between pt-3 border-t">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Selected</span>
              </div>
              <Badge variant="secondary" className="text-lg px-3">{recipients.length}</Badge>
            </div>

            {/* Preview List */}
            {registrationsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {recipients.slice(0, 10).map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm py-1">
                    {channel === "email" ? (
                      <Mail className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <Phone className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1">
                      {channel === "email" ? r.attendee_email : r.attendee_phone}
                    </span>
                    {r.status === "confirmed" ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Clock className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                ))}
                {recipients.length > 10 && (
                  <p className="text-xs text-muted-foreground pt-1">
                    +{recipients.length - 10} more recipients
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Send Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleSend}
            disabled={sending || recipients.length === 0 || !message.trim() || (channel === "email" && !subject.trim())}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to {recipients.length} Recipient{recipients.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
