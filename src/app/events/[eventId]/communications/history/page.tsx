"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Mail,
  MessageSquare,
  Phone,
  Webhook,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  RefreshCw,
  Download,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type MessageLog = {
  id: string
  channel: string
  provider: string
  recipient: string
  recipient_name: string
  subject: string | null
  message_body: string
  status: string
  provider_message_id: string | null
  error_message: string | null
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  failed_at: string | null
  created_at: string
}

export default function HistoryPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [search, setSearch] = useState("")
  const [channelFilter, setChannelFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedLog, setSelectedLog] = useState<MessageLog | null>(null)

  // Fetch message logs
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["message-logs", eventId, channelFilter, statusFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from("message_logs")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(100)

      if (channelFilter !== "all") {
        query = query.eq("channel", channelFilter)
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      const { data } = await query
      return (data || []) as MessageLog[]
    },
  })

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />Delivered</Badge>
      case "read":
        return <Badge className="bg-blue-500 text-white"><Eye className="h-3 w-3 mr-1" />Read</Badge>
      case "sent":
        return <Badge className="bg-sky-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>
      case "failed":
      case "bounced":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case "pending":
      case "queued":
        return <Badge variant="outline" className="text-amber-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const filteredLogs = logs?.filter((log) => {
    if (!search) return true
    return (
      log.recipient.toLowerCase().includes(search.toLowerCase()) ||
      log.recipient_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.subject?.toLowerCase().includes(search.toLowerCase())
    )
  })

  const exportCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      toast.error("No data to export")
      return
    }

    const headers = ["Date", "Channel", "Recipient", "Name", "Subject", "Status", "Provider"]
    const rows = filteredLogs.map((log) => [
      formatDate(log.created_at),
      log.channel,
      log.recipient,
      log.recipient_name || "",
      log.subject || "",
      log.status,
      log.provider || "",
    ])

    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `message-logs-${eventId}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exported to CSV")
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Message History</h1>
          <p className="text-muted-foreground">Track all sent messages and their delivery status</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by recipient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-card rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold">{logs?.length || 0}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="bg-card rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-green-500">
            {logs?.filter((l) => l.status === "delivered" || l.status === "read").length || 0}
          </p>
          <p className="text-xs text-muted-foreground">Delivered</p>
        </div>
        <div className="bg-card rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-sky-500">
            {logs?.filter((l) => l.status === "sent").length || 0}
          </p>
          <p className="text-xs text-muted-foreground">Sent</p>
        </div>
        <div className="bg-card rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-amber-500">
            {logs?.filter((l) => l.status === "pending" || l.status === "queued").length || 0}
          </p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="bg-card rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-red-500">
            {logs?.filter((l) => l.status === "failed" || l.status === "bounced").length || 0}
          </p>
          <p className="text-xs text-muted-foreground">Failed</p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Channel</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Subject/Message</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs?.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getChannelIcon(log.channel)}
                    <span className="capitalize text-sm">{log.channel}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-medium">{log.recipient_name || "-"}</p>
                  <p className="text-xs text-muted-foreground">{log.recipient}</p>
                </TableCell>
                <TableCell>
                  <p className="truncate max-w-[200px]">
                    {log.subject || log.message_body?.slice(0, 50) || "-"}
                  </p>
                </TableCell>
                <TableCell>{getStatusBadge(log.status)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(log.sent_at || log.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLog(log)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredLogs?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No messages found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog && getChannelIcon(selectedLog.channel)}
              Message Details
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Recipient</p>
                  <p className="font-medium">{selectedLog.recipient_name || "-"}</p>
                  <p className="text-sm">{selectedLog.recipient}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
              </div>

              {selectedLog.subject && (
                <div>
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <p className="font-medium">{selectedLog.subject}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground">Message</p>
                <p className="text-sm whitespace-pre-wrap bg-secondary/30 p-3 rounded-lg mt-1">
                  {selectedLog.message_body}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Sent At</p>
                  <p>{formatDate(selectedLog.sent_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Delivered At</p>
                  <p>{formatDate(selectedLog.delivered_at)}</p>
                </div>
                {selectedLog.read_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Read At</p>
                    <p>{formatDate(selectedLog.read_at)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Provider</p>
                  <p className="capitalize">{selectedLog.provider || "-"}</p>
                </div>
              </div>

              {selectedLog.error_message && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 text-red-600">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Error</p>
                    <p className="text-sm">{selectedLog.error_message}</p>
                  </div>
                </div>
              )}

              {selectedLog.provider_message_id && (
                <div>
                  <p className="text-xs text-muted-foreground">Message ID</p>
                  <p className="text-xs font-mono">{selectedLog.provider_message_id}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
