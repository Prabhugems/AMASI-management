"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  UserPlus,
  Users,
  Trash2,
  Loader2,
  Mail,
  Crown,
  Shield,
  Eye,
  Pencil,
  QrCode,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface EventMember {
  id: string
  event_id: string
  user_id: string | null
  role: string
  invited_at: string | null
  accepted_at: string | null
  created_at: string
  name: string | null
  email: string | null
}

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
  { value: "checkin_staff", label: "Check-in Staff" },
] as const

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  editor: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  viewer: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  checkin_staff: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  editor: Pencil,
  viewer: Eye,
  checkin_staff: QrCode,
}

export function TeamSection({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("editor")

  // Fetch members
  const { data: members = [], isLoading } = useQuery<EventMember[]>({
    queryKey: ["event-members", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/members`)
      if (!res.ok) throw new Error("Failed to fetch members")
      return res.json()
    },
    enabled: !!eventId,
  })

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const res = await fetch(`/api/events/${eventId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to invite member")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-members", eventId] })
      setInviteEmail("")
      setInviteRole("editor")
      toast.success("Member invited successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ member_id, role }: { member_id: string; role: string }) => {
      const res = await fetch(`/api/events/${eventId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id, role }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update role")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-members", eventId] })
      toast.success("Role updated")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Remove mutation
  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/events/${eventId}/members?member_id=${memberId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to remove member")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-members", eventId] })
      toast.success("Member removed")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleInvite = () => {
    const email = inviteEmail.trim()
    if (!email) {
      toast.error("Please enter an email address")
      return
    }
    inviteMutation.mutate({ email, role: inviteRole })
  }

  const handleRemove = (member: EventMember) => {
    if (!confirm(`Remove ${member.name || member.email} from this event?`)) return
    removeMutation.mutate(member.id)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Team & Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Manage who has access to this event ({members.length} member{members.length !== 1 ? "s" : ""})
          </p>
        </div>
      </div>

      {/* Invite Form */}
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <label className="text-sm font-medium">Email address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleInvite() }}
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-40 space-y-1.5">
          <label className="text-sm font-medium">Role</label>
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.filter((r) => r.value !== "owner").map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleInvite}
          disabled={inviteMutation.isPending || !inviteEmail.trim()}
          className="gap-2"
        >
          {inviteMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Invite
        </Button>
      </div>

      {/* Members List */}
      {members.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No team members yet. Invite someone above.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {members.map((member) => {
            const isOwner = member.role === "owner"
            const RoleIcon = ROLE_ICONS[member.role] || Eye
            const isPending = !member.accepted_at

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 px-4 py-3 bg-background hover:bg-secondary/30 transition-colors"
              >
                {/* Avatar / Icon */}
                <div className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                  isOwner
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    : "bg-secondary text-muted-foreground"
                )}>
                  {member.name
                    ? member.name.charAt(0).toUpperCase()
                    : (member.email?.charAt(0).toUpperCase() || "?")}
                </div>

                {/* Name & Email */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.name || member.email}
                  </p>
                  {member.name && member.email && (
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  )}
                </div>

                {/* Status */}
                <div className="shrink-0">
                  {isPending ? (
                    <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                      Pending
                    </span>
                  ) : (
                    <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>

                {/* Invited date */}
                {member.invited_at && (
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                    {new Date(member.invited_at).toLocaleDateString()}
                  </span>
                )}

                {/* Role selector / badge */}
                <div className="shrink-0 w-36">
                  {isOwner ? (
                    <div className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full", ROLE_COLORS.owner)}>
                      <Crown className="h-3 w-3" />
                      Owner
                    </div>
                  ) : (
                    <Select
                      value={member.role}
                      onValueChange={(role) =>
                        updateRoleMutation.mutate({ member_id: member.id, role })
                      }
                      disabled={updateRoleMutation.isPending}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <div className="flex items-center gap-1.5">
                          <RoleIcon className="h-3 w-3" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.filter((r) => r.value !== "owner").map((r) => {
                          const Icon = ROLE_ICONS[r.value]
                          return (
                            <SelectItem key={r.value} value={r.value}>
                              <span className="flex items-center gap-1.5">
                                <Icon className="h-3 w-3" />
                                {r.label}
                              </span>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(member)}
                  disabled={isOwner || removeMutation.isPending}
                  title={isOwner ? "Cannot remove owner" : "Remove member"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
