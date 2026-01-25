"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Mail,
  MessageSquare,
  Phone,
  Webhook,
  Send,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Loader2,
  ArrowRight,
  FileText,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function CommunicationsOverviewPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch message stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["communications-stats", eventId],
    queryFn: async () => {
      // Get total messages by channel
      const { data: logs } = await (supabase as any)
        .from("message_logs")
        .select("channel, status")
        .eq("event_id", eventId)

      if (!logs) return { total: 0, byChannel: {}, byStatus: {} }

      const byChannel: Record<string, number> = {}
      const byStatus: Record<string, number> = {}

      logs.forEach((log: any) => {
        byChannel[log.channel] = (byChannel[log.channel] || 0) + 1
        byStatus[log.status] = (byStatus[log.status] || 0) + 1
      })

      return {
        total: logs.length,
        byChannel,
        byStatus,
      }
    },
  })

  // Fetch recent messages
  const { data: recentMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ["recent-messages", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("message_logs")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(5)

      return data || []
    },
  })

  // Fetch communication settings
  const defaultChannels = { email: true, whatsapp: false, sms: false, webhook: false }
  const { data: settings } = useQuery({
    queryKey: ["communication-settings-overview", eventId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/communications/settings?event_id=${eventId}`)
        if (!response.ok) {
          return { channels_enabled: defaultChannels }
        }
        const result = await response.json()
        return result.settings || { channels_enabled: defaultChannels }
      } catch {
        return { channels_enabled: defaultChannels }
      }
    },
  })

  // Fetch registrations count
  const { data: registrationsCount } = useQuery({
    queryKey: ["registrations-count", eventId],
    queryFn: async () => {
      const { count } = await supabase
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
      return count || 0
    },
  })

  const channelStats = [
    {
      label: "Email",
      icon: Mail,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      count: stats?.byChannel?.email || 0,
      enabled: settings?.channels_enabled?.email,
    },
    {
      label: "WhatsApp",
      icon: MessageSquare,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      count: stats?.byChannel?.whatsapp || 0,
      enabled: settings?.channels_enabled?.whatsapp,
    },
    {
      label: "SMS",
      icon: Phone,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      count: stats?.byChannel?.sms || 0,
      enabled: settings?.channels_enabled?.sms,
    },
    {
      label: "Webhook",
      icon: Webhook,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      count: stats?.byChannel?.webhook || 0,
      enabled: settings?.channels_enabled?.webhook,
    },
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
      case "read":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
      case "bounced":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-amber-500" />
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email":
        return <Mail className="h-4 w-4 text-blue-500" />
      case "whatsapp":
        return <MessageSquare className="h-4 w-4 text-green-500" />
      case "sms":
        return <Phone className="h-4 w-4 text-purple-500" />
      case "webhook":
        return <Webhook className="h-4 w-4 text-orange-500" />
      default:
        return <Mail className="h-4 w-4" />
    }
  }

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Communications Hub</h1>
          <p className="text-muted-foreground">Send and track messages across all channels</p>
        </div>
        <Button onClick={() => router.push(`/events/${eventId}/communications/compose`)}>
          <Send className="h-4 w-4 mr-2" />
          Compose Message
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users className="h-4 w-4" />
            <span className="text-sm">Recipients</span>
          </div>
          <p className="text-2xl font-bold">{registrationsCount}</p>
          <p className="text-xs text-muted-foreground">Total registrations</p>
        </div>

        {channelStats.map((channel) => {
          const Icon = channel.icon
          return (
            <div key={channel.label} className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", channel.color)} />
                  <span className="text-sm text-muted-foreground">{channel.label}</span>
                </div>
                <Badge variant={channel.enabled ? "default" : "secondary"} className="text-[10px]">
                  {channel.enabled ? "ON" : "OFF"}
                </Badge>
              </div>
              <p className="text-2xl font-bold">{channel.count}</p>
              <p className="text-xs text-muted-foreground">Messages sent</p>
            </div>
          )
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="col-span-2 space-y-6">
          <div className="bg-card rounded-lg border p-5">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => router.push(`/events/${eventId}/communications/compose`)}
                className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all group"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Send Message</p>
                  <p className="text-xs text-muted-foreground">Compose and send to recipients</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-foreground" />
              </button>

              <button
                onClick={() => router.push(`/events/${eventId}/communications/templates`)}
                className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all group"
              >
                <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center group-hover:bg-info/20">
                  <FileText className="h-5 w-5 text-info" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Templates</p>
                  <p className="text-xs text-muted-foreground">Manage message templates</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-foreground" />
              </button>

              <button
                onClick={() => router.push(`/events/${eventId}/communications/history`)}
                className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all group"
              >
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center group-hover:bg-success/20">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div className="text-left">
                  <p className="font-medium">View History</p>
                  <p className="text-xs text-muted-foreground">Track message delivery</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-foreground" />
              </button>

              <button
                onClick={() => router.push(`/events/${eventId}/communications/settings`)}
                className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-all group"
              >
                <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center group-hover:bg-warning/20">
                  <Settings className="h-5 w-5 text-warning" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Settings</p>
                  <p className="text-xs text-muted-foreground">Configure integrations</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-foreground" />
              </button>
            </div>
          </div>

          {/* Delivery Stats */}
          <div className="bg-card rounded-lg border p-5">
            <h3 className="font-semibold mb-4">Delivery Summary</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <p className="text-2xl font-bold text-green-500">{stats?.byStatus?.delivered || 0}</p>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <p className="text-2xl font-bold text-blue-500">{stats?.byStatus?.sent || 0}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <p className="text-2xl font-bold text-amber-500">{stats?.byStatus?.pending || 0}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <p className="text-2xl font-bold text-red-500">{stats?.byStatus?.failed || 0}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Messages</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/events/${eventId}/communications/history`)}
            >
              View All
            </Button>
          </div>

          {messagesLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentMessages && recentMessages.length > 0 ? (
            <div className="space-y-3">
              {recentMessages.map((msg: any) => (
                <div key={msg.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                  {getChannelIcon(msg.channel)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{msg.recipient}</p>
                    <p className="text-xs text-muted-foreground truncate">{msg.subject || msg.message_body?.slice(0, 50)}</p>
                  </div>
                  {getStatusIcon(msg.status)}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Mail className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No messages sent yet</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => router.push(`/events/${eventId}/communications/compose`)}
              >
                Send your first message
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
