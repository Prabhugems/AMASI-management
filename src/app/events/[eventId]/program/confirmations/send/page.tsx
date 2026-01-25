"use client"

import { useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Search,
  Loader2,
  Mail,
  Send,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Users,
  AlertCircle,
  Eye,
  ChevronLeft,
} from "lucide-react"
import { toast } from "sonner"

type FacultyAssignment = {
  id: string
  session_id: string
  faculty_name: string
  faculty_email: string | null
  faculty_phone: string | null
  role: string
  status: string
  session_name: string
  session_date: string
  start_time: string
  end_time: string
  hall: string
  topic_title: string | null
  invitation_token: string | null
}

type Event = {
  id: string
  name: string
  short_name: string | null
}

const DEFAULT_EMAIL_TEMPLATE = `Dear {{faculty_name}},

Greetings from {{event_name}}!

We are pleased to invite you to participate in our upcoming conference as a {{role}}.

**Session Details:**
- Session: {{session_name}}
- Date: {{session_date}}
- Time: {{start_time}} - {{end_time}}
- Hall: {{hall}}

Please confirm your participation by clicking the link below:
{{confirmation_link}}

We look forward to your valuable contribution to our conference.

Best regards,
{{event_name}} Organizing Committee`

export default function SendInvitationsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [emailSubject, setEmailSubject] = useState("Invitation: {{event_name}} - {{role}} Confirmation")
  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_TEMPLATE)
  const [sending, setSending] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Fetch event
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name")
        .eq("id", eventId)
        .single()
      return data as Event | null
    },
  })

  // Fetch pending assignments (status = 'pending')
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["pending-assignments", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("faculty_assignments")
        .select("*")
        .eq("event_id", eventId)
        .eq("status", "pending")
        .not("faculty_email", "is", null)
        .order("session_date", { ascending: true })
        .order("faculty_name", { ascending: true })
      return (data || []) as FacultyAssignment[]
    },
  })

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    if (!assignments) return []

    return assignments.filter(a => {
      if (search) {
        const searchLower = search.toLowerCase()
        if (
          !a.faculty_name.toLowerCase().includes(searchLower) &&
          !(a.faculty_email || "").toLowerCase().includes(searchLower)
        ) {
          return false
        }
      }

      if (roleFilter !== "all" && a.role !== roleFilter) return false

      return true
    })
  }, [assignments, search, roleFilter])

  // Stats by role
  const stats = useMemo(() => {
    if (!filteredAssignments) return null

    return {
      total: filteredAssignments.length,
      speakers: filteredAssignments.filter(a => a.role === 'speaker').length,
      chairpersons: filteredAssignments.filter(a => a.role === 'chairperson').length,
      moderators: filteredAssignments.filter(a => a.role === 'moderator').length,
    }
  }, [filteredAssignments])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const formatTime = (time: string | null) => {
    if (!time) return ""
    return time.substring(0, 5)
  }

  // Preview email with substituted values
  const getPreviewEmail = (assignment: FacultyAssignment) => {
    const replacements: Record<string, string> = {
      "{{faculty_name}}": assignment.faculty_name,
      "{{event_name}}": event?.name || "Conference",
      "{{role}}": assignment.role.charAt(0).toUpperCase() + assignment.role.slice(1),
      "{{session_name}}": assignment.session_name || "",
      "{{session_date}}": formatDate(assignment.session_date),
      "{{start_time}}": formatTime(assignment.start_time),
      "{{end_time}}": formatTime(assignment.end_time),
      "{{hall}}": assignment.hall || "",
      "{{confirmation_link}}": `${window.location.origin}/respond/${assignment.invitation_token}`,
    }

    let subject = emailSubject
    let body = emailBody

    Object.entries(replacements).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(key, 'g'), value)
      body = body.replace(new RegExp(key, 'g'), value)
    })

    return { subject, body }
  }

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Select all
  const selectAll = () => {
    if (selectedIds.size === filteredAssignments.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredAssignments.map(a => a.id)))
    }
  }

  // Select by role
  const selectByRole = (role: string) => {
    const ids = filteredAssignments.filter(a => a.role === role).map(a => a.id)
    setSelectedIds(new Set(ids))
  }

  // Send invitations
  const sendInvitations = async () => {
    if (selectedIds.size === 0) {
      toast.error("No faculty selected")
      return
    }

    const selected = filteredAssignments.filter(a => selectedIds.has(a.id))

    setSending(true)
    try {
      const response = await fetch(`/api/events/${eventId}/program/send-invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentIds: Array.from(selectedIds),
          emailSubject,
          emailBody,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`Sent ${result.sent} invitations`)
        queryClient.invalidateQueries({ queryKey: ["pending-assignments", eventId] })
        queryClient.invalidateQueries({ queryKey: ["confirmations", eventId] })
        router.push(`/events/${eventId}/program/confirmations`)
      } else {
        const error = await response.json()
        toast.error(error.message || "Failed to send invitations")
      }
    } catch (error) {
      toast.error("Error sending invitations")
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

  const previewAssignment = selectedIds.size > 0
    ? filteredAssignments.find(a => selectedIds.has(a.id))
    : filteredAssignments[0]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/events/${eventId}/program/confirmations`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Send Invitations</h1>
          <p className="text-muted-foreground">Select faculty and send invitation emails</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Selection */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="cursor-pointer" onClick={() => setRoleFilter("all")}>
              All: {stats?.total || 0}
            </Badge>
            <Badge
              variant="outline"
              className={cn("cursor-pointer", roleFilter === 'speaker' && "bg-purple-100")}
              onClick={() => selectByRole('speaker')}
            >
              Speakers: {stats?.speakers || 0}
            </Badge>
            <Badge
              variant="outline"
              className={cn("cursor-pointer", roleFilter === 'chairperson' && "bg-blue-100")}
              onClick={() => selectByRole('chairperson')}
            >
              Chairpersons: {stats?.chairpersons || 0}
            </Badge>
            <Badge
              variant="outline"
              className={cn("cursor-pointer", roleFilter === 'moderator' && "bg-green-100")}
              onClick={() => selectByRole('moderator')}
            >
              Moderators: {stats?.moderators || 0}
            </Badge>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="speaker">Speaker</SelectItem>
                <SelectItem value="chairperson">Chairperson</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selection Actions */}
          <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedIds.size === filteredAssignments.length && filteredAssignments.length > 0}
                onCheckedChange={selectAll}
              />
              <span className="text-sm font-medium">
                {selectedIds.size} of {filteredAssignments.length} selected
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>

          {/* Faculty List */}
          <div className="border rounded-lg max-h-[400px] overflow-y-auto">
            {filteredAssignments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p>No pending invitations found</p>
                <p className="text-sm mt-1">All faculty have been invited or no faculty with emails</p>
              </div>
            ) : (
              filteredAssignments.map(assignment => (
                <div
                  key={assignment.id}
                  className={cn(
                    "flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/30 cursor-pointer",
                    selectedIds.has(assignment.id) && "bg-primary/5"
                  )}
                  onClick={() => toggleSelection(assignment.id)}
                >
                  <Checkbox
                    checked={selectedIds.has(assignment.id)}
                    onCheckedChange={() => toggleSelection(assignment.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{assignment.faculty_name}</div>
                    <div className="text-xs text-muted-foreground">{assignment.faculty_email}</div>
                  </div>
                  <Badge variant="outline" className="capitalize text-xs">
                    {assignment.role}
                  </Badge>
                  <div className="text-xs text-muted-foreground text-right">
                    <div>{assignment.session_name}</div>
                    <div>{assignment.hall}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Email Template */}
        <div className="space-y-4">
          <div className="bg-card border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Template
            </h3>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Body</Label>
              <Textarea
                id="body"
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                placeholder="Email body..."
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Available variables:</p>
              <p>{"{{faculty_name}}, {{event_name}}, {{role}}, {{session_name}}, {{session_date}}, {{start_time}}, {{end_time}}, {{hall}}, {{confirmation_link}}"}</p>
            </div>
          </div>

          {/* Preview */}
          {previewAssignment && (
            <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview
                </h4>
                <span className="text-xs text-muted-foreground">
                  For: {previewAssignment.faculty_name}
                </span>
              </div>
              <div className="bg-white border rounded p-3 space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground">Subject:</span>
                  <p className="font-medium">{getPreviewEmail(previewAssignment).subject}</p>
                </div>
                <hr />
                <div>
                  <span className="text-xs text-muted-foreground">Body:</span>
                  <pre className="text-sm whitespace-pre-wrap font-sans mt-1">
                    {getPreviewEmail(previewAssignment).body}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          {selectedIds.size > 0 ? (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {selectedIds.size} faculty will receive invitations
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Select faculty to send invitations
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/events/${eventId}/program/confirmations`}>
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button
            onClick={sendInvitations}
            disabled={selectedIds.size === 0 || sending}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send {selectedIds.size} Invitations
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
