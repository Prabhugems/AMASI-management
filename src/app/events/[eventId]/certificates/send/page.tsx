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
  Users,
  Mail,
  Award,
  FileDown,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Attendee = {
  id: string
  attendee_name: string
  attendee_email: string
  certificate_generated_at: string | null
  certificate_url: string | null
  certificate_downloaded_at: string | null
  checked_in: boolean
  ticket_type?: { name: string }
  custom_fields: {
    certificate_generated?: boolean
    certificate_sent?: boolean
    certificate_sent_at?: string
  } | null
}

export default function SendCertificatesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "ready" | "sent">("all")
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [sendProgress, setSendProgress] = useState(0)
  const [sendTotal, setSendTotal] = useState(0)
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set())

  // Fetch attendees with generated certificates
  const { data: attendees, isLoading } = useQuery({
    queryKey: ["certificate-send-attendees", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, certificate_generated_at, certificate_url, certificate_downloaded_at, checked_in, custom_fields, ticket_type:ticket_types(name)")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .not("certificate_generated_at", "is", null)
        .order("attendee_name")

      return (data || []) as Attendee[]
    },
  })

  // Filter attendees
  const filteredAttendees = useMemo(() => {
    if (!attendees) return []
    return attendees.filter(a => {
      const matchesSearch =
        a.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
        a.attendee_email.toLowerCase().includes(search.toLowerCase())

      const sent = a.custom_fields?.certificate_sent
      const matchesFilter =
        filter === "all" ||
        (filter === "ready" && !sent) ||
        (filter === "sent" && sent)

      return matchesSearch && matchesFilter
    })
  }, [attendees, search, filter])

  // Stats
  const stats = useMemo(() => {
    if (!attendees) return { total: 0, sent: 0, ready: 0 }
    const sent = attendees.filter(a => a.custom_fields?.certificate_sent).length
    return {
      total: attendees.length,
      sent,
      ready: attendees.length - sent,
    }
  }, [attendees])

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedAttendees)
    if (newSelection.has(id)) newSelection.delete(id)
    else newSelection.add(id)
    setSelectedAttendees(newSelection)
  }

  const selectAllReady = () => {
    const ready = filteredAttendees.filter(a => !a.custom_fields?.certificate_sent)
    setSelectedAttendees(new Set(ready.map(a => a.id)))
  }

  const sendCertificates = async (retryOnly = false) => {
    const idsToSend = retryOnly ? failedIds : selectedAttendees
    if (idsToSend.size === 0) {
      toast.error(retryOnly ? "No failed sends to retry" : "Select attendees first")
      return
    }

    if (!retryOnly && !confirm(`Send certificates to ${idsToSend.size} selected attendee(s)?`)) {
      return
    }

    setSending(true)
    setSendProgress(0)
    setFailedIds(new Set())
    let successCount = 0
    const newFailedIds = new Set<string>()

    // Filter out already-sent attendees
    const idsArray = Array.from(idsToSend).filter(id => {
      const attendee = attendees?.find(a => a.id === id)
      return attendee && !attendee.custom_fields?.certificate_sent
    })
    setSendTotal(idsArray.length)

    if (idsArray.length === 0) {
      toast.info("All selected attendees have already been sent certificates")
      setSending(false)
      return
    }

    try {
      // Process in batches of 5 concurrent requests
      const batchSize = 5
      for (let i = 0; i < idsArray.length; i += batchSize) {
        const batch = idsArray.slice(i, i + batchSize)
        const results = await Promise.allSettled(
          batch.map(async (id) => {
            const attendee = attendees?.find(a => a.id === id)
            if (!attendee) throw new Error("Attendee not found")

            const response = await fetch("/api/certificates/email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                registration_id: id,
                event_id: eventId,
              }),
            })

            if (response.ok) {
              await (supabase as any)
                .from("registrations")
                .update({
                  custom_fields: {
                    ...attendee.custom_fields,
                    certificate_sent: true,
                    certificate_sent_at: new Date().toISOString(),
                  },
                })
                .eq("id", id)
              return { id, success: true }
            } else {
              throw new Error("Failed to send")
            }
          })
        )

        results.forEach((result, idx) => {
          if (result.status === "fulfilled") {
            successCount++
          } else {
            newFailedIds.add(batch[idx])
          }
        })
        setSendProgress(Math.min(i + batch.length, idsArray.length))
      }

      queryClient.invalidateQueries({ queryKey: ["certificate-send-attendees", eventId] })

      if (successCount > 0) {
        toast.success(`Sent certificates to ${successCount} attendee${successCount > 1 ? "s" : ""}`)
      }
      if (newFailedIds.size > 0) {
        setFailedIds(newFailedIds)
        toast.error(`Failed to send to ${newFailedIds.size} attendee${newFailedIds.size > 1 ? "s" : ""}`)
      }
      if (!retryOnly) setSelectedAttendees(new Set())
    } catch {
      toast.error("Failed to send certificates")
    } finally {
      setSending(false)
    }
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!attendees?.length) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No certificates to send</h3>
          <p className="text-muted-foreground">Generate certificates first before sending them.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Send Certificates</h1>
        <p className="text-muted-foreground">Email certificates to attendees</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "all" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("all")}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">With Certificates</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "sent" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("sent")}
        >
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Sent</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.sent}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "ready" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("ready")}
        >
          <div className="flex items-center gap-2 text-blue-500">
            <Mail className="h-4 w-4" />
            <span className="text-sm">Ready to Send</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats.ready}</p>
        </div>
      </div>

      {/* Actions */}
      {selectedAttendees.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Mail className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-800">
            {sending ? `Sending ${sendProgress}/${sendTotal}...` : `${selectedAttendees.size} selected`}
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setSelectedAttendees(new Set())} disabled={sending}>
            Clear
          </Button>
          <Button size="sm" onClick={() => sendCertificates(false)} disabled={sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? `Sending ${sendProgress}/${sendTotal}...` : "Send Emails"}
          </Button>
        </div>
      )}

      {/* Retry Failed */}
      {failedIds.size > 0 && !sending && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="font-medium text-red-800">{failedIds.size} failed to send</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setFailedIds(new Set())}>
            Dismiss
          </Button>
          <Button size="sm" variant="destructive" onClick={() => sendCertificates(true)}>
            <Send className="h-4 w-4 mr-2" />
            Retry {failedIds.size} Failed
          </Button>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search attendees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="sm" onClick={selectAllReady}>
          Select Ready ({stats.ready})
        </Button>
      </div>

      {/* Attendees Table */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedAttendees.size === filteredAttendees.length && filteredAttendees.length > 0}
                  onCheckedChange={() => {
                    if (selectedAttendees.size === filteredAttendees.length) {
                      setSelectedAttendees(new Set())
                    } else {
                      setSelectedAttendees(new Set(filteredAttendees.map(a => a.id)))
                    }
                  }}
                />
              </TableHead>
              <TableHead>Attendee</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Email Status</TableHead>
              <TableHead>Downloaded</TableHead>
              <TableHead>Sent At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAttendees.map((attendee) => {
              const sent = attendee.custom_fields?.certificate_sent

              return (
                <TableRow key={attendee.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedAttendees.has(attendee.id)}
                      onCheckedChange={() => toggleSelection(attendee.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{attendee.attendee_name}</TableCell>
                  <TableCell className="text-muted-foreground">{attendee.attendee_email}</TableCell>
                  <TableCell className="text-muted-foreground">{attendee.ticket_type?.name || "-"}</TableCell>
                  <TableCell>
                    {sent ? (
                      <Badge className="bg-green-500 text-white">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Sent
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-blue-500">
                        <Mail className="h-3 w-3 mr-1" />
                        Ready
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {attendee.certificate_downloaded_at ? (
                      <span className="flex items-center gap-1 text-purple-600 text-sm">
                        <FileDown className="h-3.5 w-3.5" />
                        {formatDate(attendee.certificate_downloaded_at)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(attendee.custom_fields?.certificate_sent_at)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
