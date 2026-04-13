"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Mail,
  Phone,
  Globe,
  Calendar,
  Tag,
  StickyNote,
  RefreshCcw,
  Send,
  PhoneCall,
  Trash2,
  Loader2,
  Clock,
  Link2,
} from "lucide-react"
import { SlideOver, SlideOverSection } from "@/components/ui/slide-over"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useConfirm } from "@/hooks/use-confirm"
import type { Lead, LeadNote, LeadStatus } from "./leads-types"
import { LEAD_STATUSES } from "./leads-types"

interface LeadDetailSheetProps {
  lead: Lead | null
  eventId: string
  open: boolean
  onClose: () => void
  onUpdate: () => void
}

const NOTE_TYPE_ICONS: Record<LeadNote["type"], typeof StickyNote> = {
  note: StickyNote,
  status_change: RefreshCcw,
  email_sent: Send,
  call: PhoneCall,
}

const NOTE_TYPE_LABELS: Record<LeadNote["type"], string> = {
  note: "Note",
  status_change: "Status Change",
  email_sent: "Email Sent",
  call: "Call",
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })
}

export function LeadDetailSheet({ lead, eventId, open, onClose, onUpdate }: LeadDetailSheetProps) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [noteContent, setNoteContent] = useState("")
  const [noteType, setNoteType] = useState<LeadNote["type"]>("note")

  // Fetch lead details with notes
  const { data: leadDetail, isLoading } = useQuery({
    queryKey: ["lead-detail", eventId, lead?.id],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/leads/${lead!.id}`)
      if (!res.ok) throw new Error("Failed to fetch lead details")
      const json = await res.json()
      return json.data as Lead & { notes: LeadNote[] }
    },
    enabled: open && !!lead?.id,
  })

  // Update lead status
  const updateStatus = useMutation({
    mutationFn: async (status: LeadStatus) => {
      const res = await fetch(`/api/events/${eventId}/leads/${lead!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-detail", eventId, lead?.id] })
      queryClient.invalidateQueries({ queryKey: ["event-leads", eventId] })
      onUpdate()
      toast.success("Status updated")
    },
    onError: () => toast.error("Failed to update status"),
  })

  // Add note
  const addNote = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/leads/${lead!.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent, type: noteType }),
      })
      if (!res.ok) throw new Error("Failed to add note")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-detail", eventId, lead?.id] })
      setNoteContent("")
      setNoteType("note")
      toast.success("Note added")
    },
    onError: () => toast.error("Failed to add note"),
  })

  // Delete lead
  const deleteLead = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/leads/${lead!.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete lead")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-leads", eventId] })
      onUpdate()
      onClose()
      toast.success("Lead deleted")
    },
    onError: () => toast.error("Failed to delete lead"),
  })

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Delete lead?",
      description: `This will permanently delete ${lead?.name || lead?.email || "this lead"} and all associated notes. This cannot be undone.`,
      variant: "destructive",
    })
    if (confirmed) {
      deleteLead.mutate()
    }
  }

  const currentStatus = LEAD_STATUSES.find((s) => s.value === (leadDetail?.status ?? lead?.status))

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={leadDetail?.name || lead?.name || lead?.email || "Lead Details"}
      subtitle={leadDetail?.email || lead?.email || undefined}
      width="xl"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : leadDetail ? (
        <div className="flex flex-col">
          {/* Header: Status + Delete */}
          <SlideOverSection>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Status:</span>
                <Select
                  value={leadDetail.status}
                  onValueChange={(val) => updateStatus.mutate(val as LeadStatus)}
                >
                  <SelectTrigger className="w-[160px] h-8 text-sm">
                    {currentStatus && (
                      <span className={`inline-flex items-center gap-1.5 ${currentStatus.color}`}>
                        <span className={`h-2 w-2 rounded-full ${currentStatus.bgColor.replace("bg-", "bg-")}`}
                              style={{ backgroundColor: "currentColor", opacity: 0.6 }} />
                        <SelectValue />
                      </span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className={`inline-flex items-center gap-1.5 ${s.color}`}>
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {updateStatus.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={deleteLead.isPending}
              >
                {deleteLead.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </SlideOverSection>

          {/* Contact Info */}
          <SlideOverSection title="Contact" icon={Mail}>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`mailto:${leadDetail.email}`}
                  className="text-sm text-primary hover:underline truncate"
                >
                  {leadDetail.email}
                </a>
              </div>
              {leadDetail.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a
                    href={`tel:${leadDetail.phone}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {leadDetail.phone}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground capitalize">
                  {leadDetail.source.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          </SlideOverSection>

          {/* UTM Tracking */}
          {(leadDetail.utm_source || leadDetail.utm_medium || leadDetail.utm_campaign) && (
            <SlideOverSection title="UTM Tracking" icon={Link2}>
              <div className="grid grid-cols-1 gap-2">
                {leadDetail.utm_source && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Source</span>
                    <span className="text-sm font-medium text-foreground bg-secondary px-2 py-0.5 rounded">
                      {leadDetail.utm_source}
                    </span>
                  </div>
                )}
                {leadDetail.utm_medium && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Medium</span>
                    <span className="text-sm font-medium text-foreground bg-secondary px-2 py-0.5 rounded">
                      {leadDetail.utm_medium}
                    </span>
                  </div>
                )}
                {leadDetail.utm_campaign && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Campaign</span>
                    <span className="text-sm font-medium text-foreground bg-secondary px-2 py-0.5 rounded">
                      {leadDetail.utm_campaign}
                    </span>
                  </div>
                )}
              </div>
            </SlideOverSection>
          )}

          {/* Dates */}
          <SlideOverSection title="Dates" icon={Calendar}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Created</span>
                <span className="text-sm text-foreground">
                  {new Date(leadDetail.created_at).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {leadDetail.converted_at && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Converted</span>
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    {new Date(leadDetail.converted_at).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>
          </SlideOverSection>

          {/* Quick Actions */}
          <SlideOverSection title="Quick Actions" icon={Globe}>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${leadDetail.email}`}>
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  Email
                </a>
              </Button>
              {leadDetail.phone && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${leadDetail.phone}`}>
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                    Call
                  </a>
                </Button>
              )}
              {leadDetail.status === "new" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatus.mutate("contacted")}
                  disabled={updateStatus.isPending}
                >
                  <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                  Mark Contacted
                </Button>
              )}
              {leadDetail.status === "contacted" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatus.mutate("qualified")}
                  disabled={updateStatus.isPending}
                >
                  <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                  Mark Qualified
                </Button>
              )}
              {leadDetail.status !== "converted" && leadDetail.status !== "unsubscribed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatus.mutate("converted")}
                  disabled={updateStatus.isPending}
                >
                  <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                  Mark Converted
                </Button>
              )}
            </div>
          </SlideOverSection>

          {/* Notes Timeline */}
          <SlideOverSection title="Activity" icon={Clock}>
            <div className="space-y-4">
              {/* Existing notes */}
              {leadDetail.notes && leadDetail.notes.length > 0 ? (
                <div className="space-y-3">
                  {leadDetail.notes.map((note) => {
                    const NoteIcon = NOTE_TYPE_ICONS[note.type] || StickyNote
                    return (
                      <div key={note.id} className="flex gap-3">
                        <div className="shrink-0 mt-0.5">
                          <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center">
                            <NoteIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-muted-foreground">
                              {NOTE_TYPE_LABELS[note.type]}
                            </span>
                            <span className="text-xs text-muted-foreground/60">
                              {formatRelativeTime(note.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                            {note.content}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity yet
                </p>
              )}

              {/* Add note form */}
              <div className="border-t border-border/50 pt-4 space-y-3">
                <Textarea
                  placeholder="Add a note..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                />
                <div className="flex items-center justify-between gap-3">
                  <Select
                    value={noteType}
                    onValueChange={(val) => setNoteType(val as LeadNote["type"])}
                  >
                    <SelectTrigger className="w-[150px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="email_sent">Email Sent</SelectItem>
                      <SelectItem value="status_change">Status Change</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => addNote.mutate()}
                    disabled={!noteContent.trim() || addNote.isPending}
                  >
                    {addNote.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Add Note
                  </Button>
                </div>
              </div>
            </div>
          </SlideOverSection>
        </div>
      ) : null}
    </SlideOver>
  )
}
