"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { CategoryPermissionPicker } from "@/components/team/category-permission-picker"
import {
  Shield,
  UserCog,
  Plane,
  Save,
  Loader2,
  ChevronDown,
  AlertTriangle,
  Trash2,
  UserX,
  UserCheck,
  Clock,
  CheckCircle,
  XCircle,
  Edit3,
  Mail,
  Phone,
  Globe,
  Tag,
  Users,
  Activity,
  ArrowRight,
  Plus,
  Minus,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TeamMember = {
  id: string
  email: string
  name: string
  phone?: string
  role: string
  notes?: string
  event_ids?: string[]
  permissions?: string[]
  is_active: boolean
  created_at: string
  last_login_at?: string | null
  last_active_at?: string | null
  needs_review?: boolean
  last_reviewed_at?: string | null
  timezone?: string
  tags?: string[]
  backup_member_id?: string | null
}

type Event = {
  id: string
  name: string
  short_name: string
  start_date: string
  end_date: string | null
  status: string | null
}

type ActivityEntry = {
  id: string
  actor_email: string
  action: string
  target_email?: string
  metadata?: Record<string, any>
  created_at: string
}

type MemberDetailPanelProps = {
  open: boolean
  onClose: () => void
  member: TeamMember | null
  events: Event[]
  allMembers: TeamMember[]
  isSuperAdmin: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrator", icon: Shield, color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "coordinator", label: "Coordinator", icon: UserCog, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "travel", label: "Travel", icon: Plane, color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
]

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "IST (Kolkata)" },
  { value: "Europe/London", label: "GMT (London)" },
  { value: "Asia/Kuala_Lumpur", label: "MYT (KL)" },
  { value: "America/New_York", label: "EST (New York)" },
  { value: "Asia/Dubai", label: "GST (Dubai)" },
]

const TAG_SUGGESTIONS = ["logistics", "finance", "travel", "registration", "technical", "medical", "hospitality", "coordination"]

const TAG_COLORS: Record<string, string> = {
  logistics: "bg-blue-100 text-blue-700",
  finance: "bg-emerald-100 text-emerald-700",
  travel: "bg-sky-100 text-sky-700",
  registration: "bg-teal-100 text-teal-700",
  technical: "bg-violet-100 text-violet-700",
  medical: "bg-red-100 text-red-700",
  hospitality: "bg-amber-100 text-amber-700",
  coordination: "bg-pink-100 text-pink-700",
}

const ACTION_ICONS: Record<string, { icon: typeof Activity; color: string }> = {
  "team_member.created": { icon: UserCheck, color: "text-green-600" },
  "team_member.updated": { icon: Edit3, color: "text-blue-600" },
  "team_member.role_changed": { icon: Shield, color: "text-purple-600" },
  "team_member.activated": { icon: UserCheck, color: "text-green-600" },
  "team_member.deactivated": { icon: UserX, color: "text-orange-600" },
  "team_member.deleted": { icon: Trash2, color: "text-red-600" },
  "team_member.invited": { icon: Mail, color: "text-blue-600" },
  "team_member.invite_accepted": { icon: CheckCircle, color: "text-teal-600" },
  "team_member.reviewed": { icon: CheckCircle, color: "text-green-600" },
  "team_member.permissions_changed": { icon: Shield, color: "text-indigo-600" },
  "team_member.email_synced": { icon: Mail, color: "text-cyan-600" },
}

const PERMISSION_LABELS: Record<string, string> = {
  flights: "Flights", hotels: "Hotels", transfers: "Transfers", trains: "Trains",
  speakers: "Speakers", program: "Program", checkin: "Check-in", badges: "Badges",
  certificates: "Certificates", registrations: "Registrations", abstracts: "Abstracts",
  forms: "Forms", surveys: "Surveys", leads: "Leads", addons: "Add-ons",
  waitlist: "Waitlist", delegate_portal: "Delegate Portal", print_station: "Print Station",
  sponsors: "Sponsors", budget: "Budget", visa_letters: "Visa Letters", meals: "Meals",
  examination: "Examination",
}

const getInitials = (name: string) => name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?"
const getRoleColor = (role: string) => ROLE_OPTIONS.find(r => r.value === role)?.color || "bg-slate-100 text-slate-700 border-slate-200"
const getRoleLabel = (role: string) => ROLE_OPTIONS.find(r => r.value === role)?.label || role

function formatActionLabel(action: string): string {
  const parts = action.split(".")
  const act = parts[parts.length - 1] || action
  return act.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MemberDetailPanel({ open, onClose, member, events, allMembers, isSuperAdmin }: MemberDetailPanelProps) {
  const queryClient = useQueryClient()

  // -- Editable fields
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState("coordinator")
  const [notes, setNotes] = useState("")
  const [permissions, setPermissions] = useState<string[]>([])
  const [allAccess, setAllAccess] = useState(false)
  const [eventIds, setEventIds] = useState<string[]>([])
  const [allEvents, setAllEvents] = useState(true)
  const [timezone, setTimezone] = useState("Asia/Kolkata")
  const [tags, setTags] = useState<string[]>([])
  const [backupMemberId, setBackupMemberId] = useState("")
  const [dangerOpen, setDangerOpen] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [diffModalOpen, setDiffModalOpen] = useState(false)
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, any> | null>(null)

  // -- Sync form state when member changes
  useEffect(() => {
    if (member) {
      setName(member.name || "")
      setPhone(member.phone || "")
      setRole(member.role || "coordinator")
      setNotes(member.notes || "")
      const perms = Array.isArray(member.permissions) ? member.permissions : []
      setPermissions(perms)
      setAllAccess(perms.length === 0)
      setEventIds(member.event_ids || [])
      setAllEvents(!member.event_ids || member.event_ids.length === 0)
      setTimezone(member.timezone || "Asia/Kolkata")
      setTags(Array.isArray(member.tags) ? member.tags : [])
      setBackupMemberId(member.backup_member_id || "")
      setDangerOpen(false)
      setDeleteConfirmName("")
      setDeleteDialogOpen(false)
      setDiffModalOpen(false)
      setPendingUpdates(null)
    }
  }, [member])

  // -- Activity timeline
  const { data: activityData } = useQuery({
    queryKey: ["member-activity", member?.id],
    queryFn: async () => {
      if (!member?.id) return { logs: [] }
      const res = await fetch(`/api/team/${member.id}/activity?limit=5`)
      if (!res.ok) return { logs: [] }
      return res.json()
    },
    enabled: !!member?.id && open,
    staleTime: 30_000,
  })

  const activityLogs: ActivityEntry[] = activityData?.logs || []

  // -- Mutations
  const updateMember = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const res = await fetch(`/api/team/${member!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to update")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] })
      queryClient.invalidateQueries({ queryKey: ["member-activity", member?.id] })
      toast.success("Member updated successfully")
    },
    onError: (error: any) => toast.error(error.message || "Update failed"),
  })

  const deleteMember = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/team/${member!.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to delete")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] })
      toast.success("Member removed")
      setDeleteDialogOpen(false)
      onClose()
    },
    onError: (error: any) => toast.error(error.message || "Delete failed"),
  })

  const markReviewed = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/team/${member!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_reviewed: true }),
      })
      if (!res.ok) throw new Error("Failed to mark as reviewed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] })
      toast.success("Permissions reviewed and confirmed")
    },
  })

  // -- Diff computation
  const computeDiff = useCallback(() => {
    if (!member) return null
    const oldPerms = Array.isArray(member.permissions) ? member.permissions : []
    const newPerms = allAccess ? [] : permissions
    const oldEvents = member.event_ids || []
    const newEvents = allEvents ? [] : eventIds
    const oldAllEvents = !member.event_ids || member.event_ids.length === 0
    const newAllEvents = allEvents

    const addedPerms = newPerms.filter(p => !oldPerms.includes(p))
    const removedPerms = oldPerms.filter(p => !newPerms.includes(p))
    const unchangedPerms = newPerms.filter(p => oldPerms.includes(p))
    const roleChanged = role !== member.role
    const permsChanged = addedPerms.length > 0 || removedPerms.length > 0 || (oldPerms.length === 0) !== (newPerms.length === 0)
    const addedEvents = newEvents.filter(e => !oldEvents.includes(e))
    const removedEvents = oldEvents.filter(e => !newEvents.includes(e))
    const eventsChanged = addedEvents.length > 0 || removedEvents.length > 0 || oldAllEvents !== newAllEvents

    return { addedPerms, removedPerms, unchangedPerms, roleChanged, permsChanged, eventsChanged, addedEvents, removedEvents, oldAllEvents, newAllEvents, oldPerms, newPerms }
  }, [member, permissions, allAccess, eventIds, allEvents, role])

  // -- Save handler
  const handleSave = useCallback(() => {
    if (!member) return

    // Name validation
    if (!name.trim()) {
      toast.error("Name cannot be empty")
      return
    }

    const diff = computeDiff()
    const needsDiffReview = diff && (diff.roleChanged || diff.permsChanged || diff.eventsChanged)

    if (needsDiffReview) {
      // Build updates and show diff modal
      const finalPermissions = allAccess ? [] : permissions
      setPendingUpdates({
        name: name.trim(),
        phone: phone.trim() || null,
        role,
        notes: notes.trim() || null,
        permissions: finalPermissions,
        event_ids: allEvents ? [] : eventIds,
        timezone,
        tags,
        backup_member_id: backupMemberId || null,
        // Metadata for activity log
        _diff: {
          added_permissions: diff.addedPerms,
          removed_permissions: diff.removedPerms,
          ...(diff.roleChanged ? { previous_role: member.role, new_role: role } : {}),
          ...(diff.eventsChanged ? { added_events: diff.addedEvents, removed_events: diff.removedEvents } : {}),
        },
      })
      setDiffModalOpen(true)
    } else {
      // No permission/role/event changes — save directly
      executeSave({
        name: name.trim(),
        phone: phone.trim() || null,
        role,
        notes: notes.trim() || null,
        permissions: allAccess ? [] : permissions,
        event_ids: allEvents ? [] : eventIds,
        timezone,
        tags,
        backup_member_id: backupMemberId || null,
      })
    }
  }, [member, name, phone, role, notes, permissions, allAccess, eventIds, allEvents, timezone, tags, backupMemberId, computeDiff])

  const executeSave = useCallback(async (updates: Record<string, any>) => {
    setSaving(true)
    try {
      await updateMember.mutateAsync(updates)
    } finally {
      setSaving(false)
      setDiffModalOpen(false)
      setPendingUpdates(null)
    }
  }, [updateMember])

  const handleConfirmDiff = useCallback(() => {
    if (pendingUpdates) executeSave(pendingUpdates)
  }, [pendingUpdates, executeSave])

  // -- Close handler with unsaved changes guard
  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm("You have unsaved changes. Discard them?")
      if (!confirmed) return
    }
    onClose()
  }, [hasChanges, onClose])

  // -- Derived
  const hasChanges = useMemo(() => {
    if (!member) return false
    const origPerms = Array.isArray(member.permissions) ? member.permissions : []
    const origEvents = member.event_ids || []
    const origAllEvents = !member.event_ids || member.event_ids.length === 0
    const origAllAccess = origPerms.length === 0
    const currentPerms = allAccess ? [] : permissions

    return (
      name.trim() !== (member.name || "") ||
      (phone.trim() || "") !== (member.phone || "") ||
      role !== member.role ||
      (notes.trim() || "") !== (member.notes || "") ||
      JSON.stringify([...currentPerms].sort()) !== JSON.stringify([...origPerms].sort()) ||
      allAccess !== origAllAccess ||
      allEvents !== origAllEvents ||
      JSON.stringify([...eventIds].sort()) !== JSON.stringify([...origEvents].sort()) ||
      timezone !== (member.timezone || "Asia/Kolkata") ||
      JSON.stringify(tags) !== JSON.stringify(Array.isArray(member.tags) ? member.tags : []) ||
      (backupMemberId || "") !== (member.backup_member_id || "")
    )
  }, [member, name, phone, role, notes, permissions, allAccess, eventIds, allEvents, timezone, tags, backupMemberId])

  const categorizedEvents = useMemo(() => {
    const now = new Date()
    const live: Event[] = []
    const completed: Event[] = []
    for (const event of events) {
      const endDate = event.end_date ? new Date(event.end_date) : null
      const isCompleted = event.status === "completed" || event.status === "cancelled" || (endDate && endDate < now)
      if (isCompleted) completed.push(event); else live.push(event)
    }
    return { live, completed }
  }, [events])

  const backupMember = allMembers.find(m => m.id === backupMemberId)
  const lastActive = member?.last_active_at
    ? formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })
    : member?.last_login_at
      ? formatDistanceToNow(new Date(member.last_login_at), { addSuffix: true })
      : "Never"

  if (!member) return null

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
        <SheetContent
          side="right"
          className="w-full sm:w-[480px] sm:max-w-[480px] p-0 overflow-y-auto flex flex-col"
        >
          {/* Accessible title (visually hidden) */}
          <SheetTitle className="sr-only">Edit Team Member</SheetTitle>

          {/* ----------------------------------------------------------------- */}
          {/* 1. HEADER                                                         */}
          {/* ----------------------------------------------------------------- */}
          <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b px-6 pt-6 pb-4">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <Avatar className="h-14 w-14 flex-shrink-0">
                <AvatarFallback className={cn(
                  "text-lg font-bold text-white",
                  role === "admin" ? "bg-purple-500" : role === "coordinator" ? "bg-[#185FA5]" : "bg-cyan-500"
                )}>
                  {getInitials(name || member.name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                {/* Editable name */}
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-lg font-bold border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                  placeholder="Name"
                />

                {/* Email (read-only) */}
                <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{member.email}</span>
                </div>

                {/* Editable phone */}
                <div className="flex items-center gap-1.5 mt-1">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="text-sm border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-muted-foreground"
                    placeholder="Add phone..."
                  />
                </div>
              </div>
            </div>

            {/* Status row */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge variant="outline" className={getRoleColor(role)}>
                {getRoleLabel(role)}
              </Badge>

              <Badge variant="outline" className={cn(
                member.is_active
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-red-50 text-red-700 border-red-200"
              )}>
                <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5", member.is_active ? "bg-green-500" : "bg-red-500")} />
                {member.is_active ? "Active" : "Inactive"}
              </Badge>

              {member.needs_review && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  <Clock className="h-3 w-3 mr-1" />
                  Review Due
                </Badge>
              )}

              <span className="text-xs text-muted-foreground ml-auto">
                Last active {lastActive}
              </span>
            </div>

            {/* Review due banner */}
            {member.needs_review && (
              <div className="mt-3 flex items-center justify-between bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 rounded-lg px-3 py-2">
                <span className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
                  Permissions haven&apos;t been reviewed in 90+ days
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-yellow-300 hover:bg-yellow-100"
                  onClick={() => markReviewed.mutate()}
                  disabled={markReviewed.isPending}
                >
                  {markReviewed.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark Reviewed"}
                </Button>
              </div>
            )}
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* SCROLLABLE CONTENT                                                */}
          {/* ----------------------------------------------------------------- */}
          <div className="flex-1 overflow-y-auto">

            {/* --------------------------------------------------------------- */}
            {/* 2. ROLE & PERMISSIONS                                            */}
            {/* --------------------------------------------------------------- */}
            <section className="px-6 py-5 border-b">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Role & Permissions
              </h3>

              {/* Role selector */}
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Role</Label>
                <div className="flex gap-2">
                  {ROLE_OPTIONS.map((r) => {
                    const Icon = r.icon
                    return (
                      <button
                        key={r.value}
                        onClick={() => setRole(r.value)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                          role === r.value
                            ? "border-[#185FA5] bg-[#185FA5]/5 text-[#185FA5] ring-1 ring-[#185FA5]/20"
                            : "border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-slate-300"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {r.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Full access banner */}
              {allAccess && (
                <div className="mb-3 flex items-center gap-2 bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">
                    Full Access — this member can access all modules
                  </span>
                </div>
              )}

              {/* Permission picker */}
              <CategoryPermissionPicker
                selectedPermissions={permissions}
                onChange={setPermissions}
                allAccess={allAccess}
                onAllAccessChange={setAllAccess}
              />
            </section>

            {/* --------------------------------------------------------------- */}
            {/* 3. EVENT ACCESS                                                  */}
            {/* --------------------------------------------------------------- */}
            <section className="px-6 py-5 border-b">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Event Access
              </h3>

              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm">All Events</Label>
                <Switch checked={allEvents} onCheckedChange={setAllEvents} />
              </div>

              {!allEvents && (
                <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border p-2">
                  {categorizedEvents.live.length > 0 && (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1 pt-1">Live Events</p>
                      {categorizedEvents.live.map((event) => (
                        <label key={event.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={eventIds.includes(event.id)}
                            onChange={(e) => {
                              if (e.target.checked) setEventIds([...eventIds, event.id])
                              else setEventIds(eventIds.filter(id => id !== event.id))
                            }}
                            className="rounded border-slate-300"
                          />
                          <span className="truncate">{event.short_name || event.name}</span>
                        </label>
                      ))}
                    </>
                  )}
                  {categorizedEvents.completed.length > 0 && (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1 pt-2">Past Events</p>
                      {categorizedEvents.completed.map((event) => (
                        <label key={event.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={eventIds.includes(event.id)}
                            onChange={(e) => {
                              if (e.target.checked) setEventIds([...eventIds, event.id])
                              else setEventIds(eventIds.filter(id => id !== event.id))
                            }}
                            className="rounded border-slate-300"
                          />
                          <span className="truncate">{event.short_name || event.name}</span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )}
            </section>

            {/* --------------------------------------------------------------- */}
            {/* ADDITIONAL FIELDS: Timezone, Tags, Backup, Notes                 */}
            {/* --------------------------------------------------------------- */}
            <section className="px-6 py-5 border-b space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Details
              </h3>

              {/* Timezone */}
              <div>
                <Label className="text-xs text-muted-foreground">Timezone</Label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>

              {/* Backup member */}
              <div>
                <Label className="text-xs text-muted-foreground">Backup / Deputy</Label>
                <select
                  value={backupMemberId}
                  onChange={(e) => setBackupMemberId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                >
                  <option value="">No backup assigned</option>
                  {allMembers
                    .filter(m => m.id !== member.id && m.is_active)
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                    ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <Label className="text-xs text-muted-foreground">Tags</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setTags(tags.filter(t => t !== tag))}
                      className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border cursor-pointer hover:opacity-70", TAG_COLORS[tag] || "bg-slate-100 text-slate-700")}
                    >
                      {tag} ×
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {TAG_SUGGESTIONS.filter(t => !tags.includes(t)).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setTags([...tags, tag])}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-slate-300 text-muted-foreground hover:border-[#185FA5] hover:text-[#185FA5] transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes about this member..."
                  className="mt-1 min-h-[60px] text-sm resize-none"
                />
              </div>
            </section>

            {/* --------------------------------------------------------------- */}
            {/* 4. DANGER ZONE                                                   */}
            {/* --------------------------------------------------------------- */}
            <section className="px-6 py-5 border-b">
              <button
                className="flex items-center justify-between w-full"
                onClick={() => setDangerOpen(!dangerOpen)}
                aria-expanded={dangerOpen}
              >
                <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Danger Zone
                </h3>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", dangerOpen && "rotate-180")} />
              </button>
              {dangerOpen && (
                <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  {/* Deactivate / Activate */}
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start",
                      member.is_active
                        ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                        : "border-green-300 text-green-700 hover:bg-green-50"
                    )}
                    onClick={() => {
                      updateMember.mutate({ is_active: !member.is_active })
                    }}
                    disabled={updateMember.isPending}
                  >
                    {member.is_active ? (
                      <><UserX className="h-4 w-4 mr-2" /> Deactivate Member</>
                    ) : (
                      <><UserCheck className="h-4 w-4 mr-2" /> Activate Member</>
                    )}
                  </Button>

                  {/* Delete (super_admin only) */}
                  {isSuperAdmin && (
                    <Button
                      variant="outline"
                      className="w-full justify-start border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Permanently Delete
                    </Button>
                  )}
                </div>
              )}
            </section>

            {/* --------------------------------------------------------------- */}
            {/* 5. ACTIVITY TIMELINE                                             */}
            {/* --------------------------------------------------------------- */}
            <section className="px-6 py-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Recent Activity
              </h3>

              {activityLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No activity recorded yet</p>
              ) : (
                <div className="space-y-0">
                  {activityLogs.map((log, i) => {
                    const actionCfg = ACTION_ICONS[log.action] || { icon: Activity, color: "text-slate-500" }
                    const Icon = actionCfg.icon
                    const isLast = i === activityLogs.length - 1

                    return (
                      <div key={log.id} className="flex gap-3">
                        {/* Timeline line + dot */}
                        <div className="flex flex-col items-center">
                          <div className={cn("flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex-shrink-0")}>
                            <Icon className={cn("h-3.5 w-3.5", actionCfg.color)} />
                          </div>
                          {!isLast && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-1" />}
                        </div>

                        {/* Content */}
                        <div className={cn("pb-4 flex-1 min-w-0", isLast && "pb-0")}>
                          <p className="text-sm font-medium leading-tight">
                            {formatActionLabel(log.action)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            by {log.actor_email?.split("@")[0]} · {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </p>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">
                              {log.metadata.role_changed
                                ? `Role: ${log.metadata.old_role} → ${log.metadata.new_role}`
                                : log.metadata.full_access_granted
                                  ? "Full access granted"
                                  : log.metadata.sessions_terminated
                                    ? "Sessions terminated"
                                    : null}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* STICKY SAVE FOOTER                                                */}
          {/* ----------------------------------------------------------------- */}
          <div className="sticky bottom-0 z-10 bg-white dark:bg-slate-900 border-t px-6 py-3 flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#185FA5] hover:bg-[#14508c] text-white"
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Review Changes (Diff) Modal */}
      <Dialog open={diffModalOpen} onOpenChange={(v) => { if (!v) { setDiffModalOpen(false); setPendingUpdates(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#185FA5]" />
              Review Changes
            </DialogTitle>
            <DialogDescription>
              Review the permission and role changes before saving.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const diff = computeDiff()
            if (!diff) return null
            const getPermLabel = (p: string) => PERMISSION_LABELS[p] || p
            const getEventName = (id: string) => events.find(e => e.id === id)?.short_name || events.find(e => e.id === id)?.name || id.slice(0, 8)

            return (
              <div className="space-y-4 pt-2">
                {/* Role change */}
                {diff.roleChanged && (
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">Role:</span>
                    <Badge variant="outline" className={getRoleColor(member.role)}>{getRoleLabel(member.role)}</Badge>
                    <ArrowRight className="h-4 w-4 text-[#185FA5]" />
                    <Badge variant="outline" className={getRoleColor(role)}>{getRoleLabel(role)}</Badge>
                  </div>
                )}

                {/* Permission changes */}
                {diff.permsChanged && (
                  <div>
                    <p className="text-sm font-medium mb-2">Permissions</p>

                    {/* Full access transitions */}
                    {diff.oldPerms.length === 0 && diff.newPerms.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                        <p className="text-xs font-medium text-amber-700">Restricting from Full Access to specific modules</p>
                      </div>
                    )}
                    {diff.oldPerms.length > 0 && diff.newPerms.length === 0 && (
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg px-3 py-2 mb-2">
                        <p className="text-xs font-medium text-green-700">Upgrading to Full Access (all modules)</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {/* Before column */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Before</p>
                        <div className="space-y-1">
                          {diff.oldPerms.length === 0 ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">Full Access</Badge>
                          ) : (
                            <>
                              {diff.removedPerms.map(p => (
                                <div key={p} className="flex items-center gap-1.5">
                                  <Minus className="h-3 w-3 text-red-500 flex-shrink-0" />
                                  <span className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">{getPermLabel(p)}</span>
                                </div>
                              ))}
                              {diff.unchangedPerms.map(p => (
                                <div key={p} className="flex items-center gap-1.5">
                                  <span className="w-3" />
                                  <span className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{getPermLabel(p)}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>

                      {/* After column */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">After</p>
                        <div className="space-y-1">
                          {diff.newPerms.length === 0 ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">Full Access</Badge>
                          ) : (
                            <>
                              {diff.addedPerms.map(p => (
                                <div key={p} className="flex items-center gap-1.5">
                                  <Plus className="h-3 w-3 text-green-500 flex-shrink-0" />
                                  <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5">{getPermLabel(p)}</span>
                                </div>
                              ))}
                              {diff.unchangedPerms.map(p => (
                                <div key={p} className="flex items-center gap-1.5">
                                  <span className="w-3" />
                                  <span className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{getPermLabel(p)}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Event changes */}
                {diff.eventsChanged && (
                  <div>
                    <p className="text-sm font-medium mb-2">Event Access</p>
                    {diff.oldAllEvents !== diff.newAllEvents && (
                      <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-2 mb-2">
                        <span className="text-xs">{diff.oldAllEvents ? "All Events" : "Specific Events"}</span>
                        <ArrowRight className="h-3 w-3 text-[#185FA5]" />
                        <span className="text-xs">{diff.newAllEvents ? "All Events" : "Specific Events"}</span>
                      </div>
                    )}
                    {diff.addedEvents.length > 0 && (
                      <div className="space-y-1 mb-1">
                        {diff.addedEvents.map(id => (
                          <div key={id} className="flex items-center gap-1.5">
                            <Plus className="h-3 w-3 text-green-500" />
                            <span className="text-xs text-green-700">{getEventName(id)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {diff.removedEvents.length > 0 && (
                      <div className="space-y-1">
                        {diff.removedEvents.map(id => (
                          <div key={id} className="flex items-center gap-1.5">
                            <Minus className="h-3 w-3 text-red-500" />
                            <span className="text-xs text-red-700">{getEventName(id)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setDiffModalOpen(false); setPendingUpdates(null) }}>
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-[#185FA5] hover:bg-[#14508c] text-white" onClick={handleConfirmDiff} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Confirm Changes
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Team Member
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All permissions and access will be revoked immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800 dark:text-red-200">
                You are about to permanently delete <strong>{member.name}</strong> ({member.email}).
              </p>
            </div>

            <div>
              <Label className="text-sm">
                Type <strong>{member.name}</strong> to confirm:
              </Label>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={member.name}
                className="mt-1.5"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmName("") }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteConfirmName !== member.name || deleteMember.isPending}
                onClick={() => deleteMember.mutate()}
              >
                {deleteMember.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete Permanently
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
