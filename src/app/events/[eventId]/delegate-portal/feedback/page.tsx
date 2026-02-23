"use client"

import { useMemo, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Loader2, Download, MessageSquare, CheckCircle, XCircle, Search, Filter, Send, Mail } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

export default function DelegatePortalFeedbackPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sendingState, setSendingState] = useState<{ active: boolean; sent: number; total: number } | null>(null)

  // Fetch published feedback forms for this event
  const { data: forms, isLoading: formsLoading } = useQuery({
    queryKey: ["delegate-portal-feedback-forms", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("forms")
        .select("id, name")
        .eq("event_id", eventId)
        .eq("form_type", "feedback")
        .eq("status", "published")
        .order("name")
      return data || []
    },
  })

  // Fetch feedback details from server API (handles the anti-join)
  const activeFormId = selectedFormId || forms?.[0]?.id || null

  const { data: feedbackData, isLoading: feedbackLoading } = useQuery({
    queryKey: ["delegate-portal-feedback-details", eventId, activeFormId],
    queryFn: async () => {
      if (!activeFormId) return null
      const res = await fetch(`/api/events/${eventId}/delegate-portal/feedback?formId=${activeFormId}`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!activeFormId,
    refetchInterval: 60000,
  })

  // Per-form summary stats
  const { data: formSummaries } = useQuery({
    queryKey: ["delegate-portal-feedback-summaries", eventId, forms?.map((f: any) => f.id).join(",")],
    queryFn: async () => {
      if (!forms || forms.length === 0) return []
      const { count: totalConfirmed } = await (supabase as any)
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "confirmed")

      const summaries = await Promise.all(
        forms.map(async (form: any) => {
          const { count } = await (supabase as any)
            .from("form_submissions")
            .select("*", { count: "exact", head: true })
            .eq("form_id", form.id)
          return {
            formId: form.id,
            formName: form.name,
            submitted: count || 0,
            total: totalConfirmed || 0,
          }
        })
      )
      return summaries
    },
    enabled: !!forms && forms.length > 0,
    refetchInterval: 60000,
  })

  const filteredAttendees = useMemo(() => {
    if (!feedbackData?.attendees) return []
    return feedbackData.attendees.filter((att: any) => {
      if (statusFilter === "submitted" && !att.submitted) return false
      if (statusFilter === "not_submitted" && att.submitted) return false
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        att.attendee_name?.toLowerCase().includes(q) ||
        att.attendee_email?.toLowerCase().includes(q) ||
        att.registration_number?.toLowerCase().includes(q)
      )
    })
  }, [feedbackData?.attendees, statusFilter, searchQuery])

  const exportCSV = () => {
    if (filteredAttendees.length === 0) {
      toast.error("No rows to export")
      return
    }
    const formName = forms?.find((f: any) => f.id === activeFormId)?.name || "feedback"
    const headers = ["Reg Number", "Name", "Email", "Status", "Submitted At"]
    const rows = filteredAttendees.map((a: any) => [
      a.registration_number,
      `"${a.attendee_name || ""}"`,
      a.attendee_email,
      a.submitted ? "Submitted" : "Not Submitted",
      a.submitted_at ? format(new Date(a.submitted_at), "dd MMM yyyy HH:mm") : "",
    ])
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `feedback-${formName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    toast.success("Report exported")
  }

  // Only "Not Submitted" rows are selectable
  const selectableAttendees = filteredAttendees.filter((a: any) => !a.submitted)
  const allSelectableSelected = selectableAttendees.length > 0 && selectableAttendees.every((a: any) => selectedIds.has(a.registration_id))

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelectableSelected) {
        selectableAttendees.forEach((a: any) => next.delete(a.registration_id))
      } else {
        selectableAttendees.forEach((a: any) => next.add(a.registration_id))
      }
      return next
    })
  }, [allSelectableSelected, selectableAttendees])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const sendFeedbackReminder = async (registrationId: string) => {
    try {
      const formName = forms?.find((f: any) => f.id === activeFormId)?.name || "Feedback"
      const res = await fetch("/api/email/feedback-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: registrationId,
          event_id: eventId,
          form_id: activeFormId,
          form_name: formName,
        }),
      })
      if (!res.ok) throw new Error("Failed to send")
      return true
    } catch {
      return false
    }
  }

  const handleSendIndividual = async (att: any) => {
    toast.promise(sendFeedbackReminder(att.registration_id), {
      loading: `Sending reminder to ${att.attendee_name}...`,
      success: `Feedback reminder sent to ${att.attendee_email}`,
      error: `Failed to send reminder to ${att.attendee_name}`,
    })
  }

  const handleBulkSend = async (ids: string[]) => {
    if (ids.length === 0) return
    setSendingState({ active: true, sent: 0, total: ids.length })
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < ids.length; i++) {
      const ok = await sendFeedbackReminder(ids[i])
      if (ok) successCount++
      else failCount++
      setSendingState({ active: true, sent: i + 1, total: ids.length })
    }

    setSendingState(null)
    setSelectedIds(new Set())
    if (failCount === 0) {
      toast.success(`Feedback reminders sent to ${successCount} delegate${successCount > 1 ? "s" : ""}`)
    } else {
      toast.warning(`Sent ${successCount}, failed ${failCount} of ${ids.length}`)
    }
  }

  const handleSendSelected = () => {
    const ids = Array.from(selectedIds)
    handleBulkSend(ids)
  }

  const handleRemindNotSubmitted = () => {
    if (!feedbackData?.attendees) return
    const notSubmitted = feedbackData.attendees
      .filter((a: any) => !a.submitted)
      .map((a: any) => a.registration_id)
    if (notSubmitted.length === 0) {
      toast.info("All delegates have already submitted feedback")
      return
    }
    handleBulkSend(notSubmitted)
  }

  const isLoading = formsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!forms || forms.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-2">Feedback</h1>
        <p className="text-muted-foreground mb-6">Track feedback form submissions from delegates</p>
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No published feedback forms found for this event.</p>
          <p className="text-sm mt-1">Create a feedback form from the Forms section and publish it.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Feedback</h1>
          <p className="text-muted-foreground">Track feedback form submissions from delegates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRemindNotSubmitted} variant="outline" disabled={!!sendingState || !feedbackData?.attendees}>
            <Mail className="h-4 w-4 mr-2" />
            Remind Not Submitted
          </Button>
          <Button onClick={exportCSV} variant="outline" disabled={!feedbackData?.attendees}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Per-form summary cards */}
      {formSummaries && formSummaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {formSummaries.map((summary: any) => {
            const pct = summary.total > 0 ? ((summary.submitted / summary.total) * 100).toFixed(1) : "0"
            const isSelected = summary.formId === activeFormId
            return (
              <button
                key={summary.formId}
                onClick={() => setSelectedFormId(summary.formId)}
                className={`text-left bg-card border rounded-lg p-4 transition-all hover:shadow-md ${
                  isSelected ? "ring-2 ring-primary border-primary" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-purple-500" />
                  <h3 className="font-medium text-sm truncate">{summary.formName}</h3>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-bold">{summary.submitted}</span>
                  <span className="text-sm text-muted-foreground">/ {summary.total}</span>
                  <span className="text-sm text-muted-foreground">({pct}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all"
                    style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Filters */}
      {feedbackData?.attendees && (
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, reg #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Submission Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="not_submitted">Not Submitted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" onClick={handleSendSelected} disabled={!!sendingState}>
            <Send className="h-4 w-4 mr-2" />
            Send Reminder
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Sending Progress */}
      {sendingState && (
        <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
          <span className="text-sm text-purple-800 dark:text-purple-200">
            Sending {sendingState.sent}/{sendingState.total}...
          </span>
        </div>
      )}

      {/* Attendees Table */}
      {feedbackLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : feedbackData?.attendees ? (
        <div className="bg-card border rounded-lg overflow-x-auto">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold">{forms?.find((f: any) => f.id === activeFormId)?.name}</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelectableSelected && selectableAttendees.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Reg #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted At</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAttendees.map((att: any) => (
                <TableRow key={att.registration_id}>
                  <TableCell>
                    {!att.submitted ? (
                      <Checkbox
                        checked={selectedIds.has(att.registration_id)}
                        onCheckedChange={() => toggleSelect(att.registration_id)}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{att.registration_number}</TableCell>
                  <TableCell className="font-medium">{att.attendee_name}</TableCell>
                  <TableCell className="text-sm">{att.attendee_email}</TableCell>
                  <TableCell>
                    {att.submitted ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        Submitted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400">
                        <XCircle className="h-4 w-4" />
                        Not Submitted
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {att.submitted_at ? (
                      <span className="text-sm">{format(new Date(att.submitted_at), "dd MMM yyyy, h:mm a")}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!att.submitted && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleSendIndividual(att)}
                        disabled={!!sendingState}
                        title="Send feedback reminder"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredAttendees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {feedbackData.attendees.length === 0 ? "No confirmed registrations found" : "No results match your filters"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}
