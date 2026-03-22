"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Bell,
  Send,
  Loader2,
  Clock,
  Mail,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Users,
  FileText,
  ChevronLeft,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import Link from "next/link"

type ReminderType = "review_deadline" | "revision_deadline" | "submission_deadline"
type Channel = "email" | "whatsapp"

interface Reminder {
  id: string
  event_id: string
  reminder_type: string
  recipient_type: string
  recipient_email: string
  recipient_name: string | null
  abstract_id: string | null
  sent_at: string
  channel: string
  delivery_status: string
}

export default function RemindersPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [selectedType, setSelectedType] = useState<ReminderType>("review_deadline")
  const [selectedChannel, setSelectedChannel] = useState<Channel>("email")

  // Fetch reminder history
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["abstract-reminders", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstracts/reminders?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch reminders")
      return res.json()
    },
  })

  // Send reminders mutation
  const sendMutation = useMutation({
    mutationFn: async ({ type, channel }: { type: ReminderType; channel: Channel }) => {
      const res = await fetch("/api/abstracts/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          reminder_type: type,
          channel,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to send reminders")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message || "Reminders sent!")
      queryClient.invalidateQueries({ queryKey: ["abstract-reminders", eventId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const reminderTypes: { value: ReminderType; label: string; icon: typeof Bell; description: string }[] = [
    {
      value: "review_deadline",
      label: "Review Deadline",
      icon: Users,
      description: "Remind reviewers with pending reviews",
    },
    {
      value: "revision_deadline",
      label: "Revision Deadline",
      icon: FileText,
      description: "Remind authors with pending revisions",
    },
  ]

  const channels: { value: Channel; label: string; icon: typeof Mail }[] = [
    { value: "email", label: "Email", icon: Mail },
    { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  ]

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href={`/events/${eventId}/abstracts`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Abstracts
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deadline Reminders</h1>
          <p className="text-muted-foreground">Send reminders to reviewers and authors</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Send Reminders Card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Send className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h2 className="font-semibold">Send Reminders</h2>
            <p className="text-sm text-muted-foreground">Select reminder type and channel</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Reminder Type Selection */}
          <div>
            <label className="text-sm font-medium mb-3 block">Reminder Type</label>
            <div className="space-y-2">
              {reminderTypes.map((type) => {
                const Icon = type.icon
                return (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    className={cn(
                      "w-full p-4 rounded-xl border-2 text-left transition-all",
                      selectedType === type.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                        : "border-border hover:border-blue-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn("h-5 w-5", selectedType === type.value ? "text-blue-500" : "text-muted-foreground")} />
                      <div>
                        <p className="font-medium">{type.label}</p>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Channel Selection */}
          <div>
            <label className="text-sm font-medium mb-3 block">Channel</label>
            <div className="flex gap-3 mb-6">
              {channels.map((channel) => {
                const Icon = channel.icon
                return (
                  <button
                    key={channel.value}
                    onClick={() => setSelectedChannel(channel.value)}
                    className={cn(
                      "flex-1 p-4 rounded-xl border-2 transition-all",
                      selectedChannel === channel.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                        : "border-border hover:border-blue-300",
                      channel.value === "whatsapp" && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={channel.value === "whatsapp"}
                  >
                    <Icon className={cn("h-6 w-6 mx-auto mb-2", selectedChannel === channel.value ? "text-blue-500" : "text-muted-foreground")} />
                    <p className="text-sm font-medium text-center">{channel.label}</p>
                    {channel.value === "whatsapp" && (
                      <p className="text-xs text-muted-foreground text-center mt-1">Coming soon</p>
                    )}
                  </button>
                )
              })}
            </div>

            <Button
              onClick={() => sendMutation.mutate({ type: selectedType, channel: selectedChannel })}
              disabled={sendMutation.isPending}
              className="w-full"
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Reminders
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {data?.stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Bell className="h-4 w-4" />
              <span className="text-sm">Total Sent</span>
            </div>
            <p className="text-2xl font-bold">{data.stats.total}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Review Reminders</span>
            </div>
            <p className="text-2xl font-bold">{data.stats.by_type?.review_deadline || 0}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-sm">Revision Reminders</span>
            </div>
            <p className="text-2xl font-bold">{data.stats.by_type?.revision_deadline || 0}</p>
          </div>
        </div>
      )}

      {/* Reminder History */}
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Reminder History
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.reminders || data.reminders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No reminders sent yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.reminders.slice(0, 50).map((reminder: Reminder) => (
              <div key={reminder.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center",
                    reminder.reminder_type === "review_deadline" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-amber-100 dark:bg-amber-900/30"
                  )}>
                    {reminder.reminder_type === "review_deadline" ? (
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{reminder.recipient_name || reminder.recipient_email}</p>
                    <p className="text-sm text-muted-foreground">
                      {reminder.reminder_type.replace("_", " ")} • {reminder.channel}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {reminder.delivery_status === "sent" ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Sent
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      Failed
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {formatDate(reminder.sent_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
