"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

type EventSession = {
  id: string
  session_name: string | null
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall: string | null
  specialty_track: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  eventId: string
  faculty: {
    id: string
    name: string
    email: string | null
    phone?: string | null
  }
}

const ROLES = [
  { value: "speaker", label: "Speaker" },
  { value: "chairperson", label: "Chairperson" },
  { value: "moderator", label: "Moderator" },
  { value: "panelist", label: "Panelist" },
  { value: "keynote", label: "Keynote" },
  { value: "discussant", label: "Discussant" },
] as const

export function AddToEventDialog({ open, onClose, eventId, faculty }: Props) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = useState<string>("")
  const [role, setRole] = useState<string>("speaker")
  const [topicTitle, setTopicTitle] = useState("")
  const [topicDescription, setTopicDescription] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [sessionSearch, setSessionSearch] = useState<string>("")

  // Reset state each open (or when faculty changes)
  useEffect(() => {
    if (open) {
      setSessionId("")
      setRole("speaker")
      setTopicTitle("")
      setTopicDescription("")
      setErrorMsg(null)
      setSessionSearch("")
    }
  }, [open, faculty.id])

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["event-sessions-for-add", eventId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, session_name, session_date, start_time, end_time, hall, specialty_track")
        .eq("event_id", eventId)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
      if (error) throw error
      return (data ?? []) as EventSession[]
    },
  })

  const filteredSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter((s) =>
      (s.session_name ?? "").toLowerCase().includes(q)
      || (s.hall ?? "").toLowerCase().includes(q)
      || (s.specialty_track ?? "").toLowerCase().includes(q)
    )
  }, [sessions, sessionSearch])

  const groupedSessions = useMemo(() => {
    const groups = new Map<string, EventSession[]>()
    for (const s of filteredSessions) {
      const key = s.session_date ?? "Unscheduled"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(s)
    }
    return Array.from(groups.entries())
  }, [filteredSessions])

  // Duplicate-assignment check
  const { data: dupCheck } = useQuery<{ id: string; status: string | null } | null>({
    queryKey: ["dup-check", sessionId, role, faculty.id, faculty.email],
    enabled: !!sessionId && !!role && (!!faculty.id || !!faculty.email),
    queryFn: async () => {
      let q = supabase
        .from("faculty_assignments")
        .select("id, status")
        .eq("session_id", sessionId)
        .eq("role", role)
      if (faculty.email) q = q.eq("faculty_email", faculty.email)
      else q = q.eq("faculty_id", faculty.id)
      const { data } = await q
      const row = data?.[0] as { id: string; status: string | null } | undefined
      return row ?? null
    },
  })

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/session-speakers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          faculty_id: faculty.id,
          faculty_name: faculty.name,
          faculty_email: faculty.email,
          faculty_phone: faculty.phone ?? null,
          role,
          topic_title: topicTitle || null,
          topic_description: topicDescription || null,
          status: "invited",
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to assign")
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faculty-session-counts", eventId] })
      queryClient.invalidateQueries({ queryKey: ["session-speakers-for-faculty", eventId] })
      toast.success(`${faculty.name} added to session`)
      onClose()
    },
    onError: (err) => setErrorMsg((err as Error).message),
  })

  const canSubmit = !!sessionId && !!role && !submit.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submit.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add {faculty.name} to this event</DialogTitle>
          <DialogDescription>
            Pick a session and a role. The speaker will land in the invited state, ready for outreach.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) submit.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label>Session</Label>
            {sessionsLoading ? (
              <Skeleton className="h-10 w-full rounded-md" />
            ) : sessions.length === 0 ? (
              <div className="h-10 rounded-md border border-dashed flex items-center px-3 text-sm text-muted-foreground">
                No sessions in this event yet. Create one in Program first.
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.length > 8 && (
                  <Input
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    placeholder="Search sessions by name, hall, or track…"
                    className="h-9"
                  />
                )}
                <Select value={sessionId} onValueChange={setSessionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a session…" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupedSessions.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        No sessions match “{sessionSearch}”.
                      </div>
                    ) : (
                      groupedSessions.map(([date, group]) => (
                        <div key={date}>
                          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {date === "Unscheduled" ? "Unscheduled" : formatDate(date)}
                          </div>
                          {group.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex flex-col text-left">
                                <span className="font-medium truncate max-w-[28rem]">
                                  {s.session_name || "Untitled"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {[s.start_time && (s.end_time ? `${s.start_time}–${s.end_time}` : s.start_time), s.hall, s.specialty_track]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Topic title <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              placeholder="e.g., Robotic anterior resection — pearls and pitfalls"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Topic notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={topicDescription}
              onChange={(e) => setTopicDescription(e.target.value)}
              rows={2}
              placeholder="Internal notes for the speaker / program team."
            />
          </div>

          {dupCheck && (
            <p className="text-sm text-amber-600 dark:text-amber-500">
              ⚠ Already assigned as {ROLES.find((r) => r.value === role)?.label ?? role} to this session
              {dupCheck.status ? ` (status: ${dupCheck.status})` : ""}.
            </p>
          )}

          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={submit.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add to event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}
