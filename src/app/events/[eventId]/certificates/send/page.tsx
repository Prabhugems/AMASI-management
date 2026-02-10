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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Attendee = {
  id: string
  attendee_name: string
  attendee_email: string
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

  // Fetch attendees with generated certificates
  const { data: attendees, isLoading } = useQuery({
    queryKey: ["certificate-send-attendees", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, custom_fields")
        .eq("event_id", eventId)
        .order("attendee_name")

      // Only return those with certificates generated
      return ((data || []) as Attendee[]).filter(a =>
        a.custom_fields?.certificate_generated
      )
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

  const sendCertificates = async () => {
    if (selectedAttendees.size === 0) {
      toast.error("Select attendees first")
      return
    }

    setSending(true)
    let successCount = 0
    let failCount = 0

    try {
      for (const id of selectedAttendees) {
        const attendee = attendees?.find(a => a.id === id)
        if (!attendee) continue

        try {
          const response = await fetch("/api/certificates/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              registration_id: id,
              event_id: eventId,
            }),
          })

          if (response.ok) {
            // Update registration record to mark certificate as sent
            await (supabase as any)
              .from("registrations")
              .update({
                custom_fields: {
                  ...attendee?.custom_fields,
                  certificate_sent: true,
                  certificate_sent_at: new Date().toISOString(),
                },
              })
              .eq("id", id)
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          console.error("Error sending certificate:", error)
          failCount++
        }
      }

      queryClient.invalidateQueries({ queryKey: ["certificate-send-attendees", eventId] })

      if (successCount > 0) {
        toast.success(`Sent certificates to ${successCount} attendee${successCount > 1 ? "s" : ""}`)
      }
      if (failCount > 0) {
        toast.error(`Failed to send to ${failCount} attendee${failCount > 1 ? "s" : ""}`)
      }
      setSelectedAttendees(new Set())
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Send Certificates</h1>
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
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
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
          <p className="text-2xl font-bold mt-1">{stats.sent}</p>
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
          <p className="text-2xl font-bold mt-1">{stats.ready}</p>
        </div>
      </div>

      {/* Actions */}
      {selectedAttendees.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Mail className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-800">{selectedAttendees.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setSelectedAttendees(new Set())}>
            Clear
          </Button>
          <Button size="sm" onClick={sendCertificates} disabled={sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Sending..." : "Send Emails"}
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
      <div className="bg-card rounded-lg border overflow-hidden">
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
              <TableHead>Status</TableHead>
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
