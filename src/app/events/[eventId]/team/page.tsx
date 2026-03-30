"use client"

import { useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Users,
  Loader2,
  Mail,
  Phone,
  Shield,
  UserCog,
  Search,
  MoreHorizontal,
  UserPlus,
  Edit,
  Trash2,
  Link2,
  Plane,
  Hotel,
  Car,
  Train,
  Award,
  Calendar,
  ClipboardList,
  QrCode,
  Palette,
  CheckCircle,
  ChevronLeft,
  Send,
  Settings,
  MapPin,
  BookOpen,
  FileText,
  Clock,
  LogOut,
  Wifi,
  WifiOff,
  CircleDot,
  UserX,
  MessageCircle,
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { SkeletonTable } from "@/components/ui/skeleton"
import {
  PERMISSIONS as SHARED_PERMISSIONS,
  ROLE_PRESETS as SHARED_ROLE_PRESETS,
  ROLE_CONFIG as SHARED_ROLE_CONFIG,
  detectPreset as sharedDetectPreset,
} from "@/lib/team-constants"

// Type definitions
type TeamMember = {
  id: string
  email: string
  name: string
  phone: string | null
  role: string
  notes: string | null
  event_ids: string[] | null
  permissions: string[] | null
  is_active: boolean
  created_at: string
  last_login_at?: string | null
  last_active_at?: string | null
  logged_out_at?: string | null
  login_count?: number
}

type EventType = {
  id: string
  name: string
  short_name: string | null
}

// Map string icon names from shared constants to actual icon components
const ICON_MAP: Record<string, any> = {
  Users, Calendar, QrCode, Award, ClipboardList, BookOpen, Plane, Hotel, Car, Train,
  Shield, UserCog, CheckCircle, Settings, MapPin, Palette, FileText,
}

// Build local PERMISSIONS with React icon components from shared constants
const PERMISSIONS = SHARED_PERMISSIONS.map(p => ({
  ...p,
  icon: ICON_MAP[p.icon] || Users,
}))

// Build local ROLE_PRESETS with React icon components from shared constants
const ROLE_PRESETS = SHARED_ROLE_PRESETS.map(p => ({
  ...p,
  icon: ICON_MAP[p.icon] || Settings,
  // Keep allPermissions from shared, map allEvents -> not used here
}))

// Build local ROLE_CONFIG from shared constants (only need label, color, bg)
const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = Object.fromEntries(
  Object.entries(SHARED_ROLE_CONFIG).map(([key, val]) => [key, { label: val.label, color: val.color, bg: val.bg }])
)

function detectPreset(role: string, permissions: string[], allPermissions: boolean) {
  return sharedDetectPreset(permissions, role, { allPermissions })
}

// Login status helpers
function getLoginStatus(member: TeamMember): "online" | "away" | "logged_out" | "offline" | "pending" | "deactivated" {
  if (!member.is_active) return "deactivated"
  if (!member.last_login_at) return "pending"
  if (member.last_active_at) {
    const diff = Date.now() - new Date(member.last_active_at).getTime()
    if (diff < 15 * 60 * 1000) return "online"
    if (diff < 60 * 60 * 1000) return "away"
  }
  if (member.logged_out_at) return "logged_out"
  return "offline"
}

const LOGIN_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any; pulse?: boolean }> = {
  online: { label: "Online", color: "text-green-700", bgColor: "bg-green-100", icon: Wifi, pulse: true },
  away: { label: "Away", color: "text-amber-700", bgColor: "bg-amber-100", icon: Clock },
  logged_out: { label: "Logged out", color: "text-orange-700", bgColor: "bg-orange-100", icon: LogOut },
  offline: { label: "Offline", color: "text-slate-600", bgColor: "bg-slate-100", icon: WifiOff },
  pending: { label: "Pending", color: "text-blue-700", bgColor: "bg-blue-100", icon: CircleDot },
  deactivated: { label: "Deactivated", color: "text-red-700", bgColor: "bg-red-100", icon: UserX },
}

export default function EventTeamPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "coordinator",
    permissions: [] as string[],
    allPermissions: false,
    notes: "",
  })

  // Detect current preset from form state
  const detectedPreset = useMemo(() => {
    return detectPreset(formData.role, formData.permissions, formData.allPermissions)
  }, [formData.role, formData.permissions, formData.allPermissions])

  const applyPreset = (presetValue: string) => {
    const preset = ROLE_PRESETS.find(p => p.value === presetValue)
    if (!preset || preset.value === "custom") return
    setFormData(prev => ({
      ...prev,
      role: preset.role,
      permissions: preset.allPermissions ? [] : preset.permissions,
      allPermissions: preset.allPermissions,
    }))
  }

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event-details", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name")
        .eq("id", eventId)
        .maybeSingle()
      return data as EventType | null
    },
  })

  // Fetch team members for THIS event only
  const { data: eventTeam, isLoading: teamLoading } = useQuery({
    queryKey: ["event-team", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, email, name, phone, role, notes, event_ids, permissions, is_active, created_at")
        .order("created_at", { ascending: false })

      if (error) throw error

      const members = (data as TeamMember[] | null) || []
      const filtered = members.filter(m => m.event_ids?.includes(eventId))

      // Fetch login activity from users table by matching emails
      const emails = filtered.map(m => (m.email || "").toLowerCase())
      if (emails.length > 0) {
        const { data: users } = await (supabase as any)
          .from("users")
          .select("email, last_login_at, last_active_at, logged_out_at, login_count")
          .in("email", emails)
        if (users) {
          const userMap = new Map<string, any>(users.map((u: any) => [u.email?.toLowerCase(), u]))
          for (const member of filtered) {
            const user = userMap.get((member.email || "").toLowerCase())
            if (user) {
              member.last_login_at = user.last_login_at
              member.last_active_at = user.last_active_at
              member.logged_out_at = user.logged_out_at
              member.login_count = user.login_count ?? 0
            }
          }
        }
      }

      return filtered
    },
  })

  // Create new team member
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await (supabase as any)
        .from("team_members")
        .insert({
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone || null,
          role: data.role,
          permissions: data.allPermissions ? [] : data.permissions,
          notes: data.notes || null,
          event_ids: [eventId],
          is_active: true,
        })

      if (error) throw error
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ["event-team", eventId] })
      toast.success("Team member added successfully")
      // Auto-send invite email
      fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email.toLowerCase(),
          isInvite: true,
        }),
      }).then(res => {
        if (res.ok) toast.success("Invite email sent!")
        else toast.error("Member added but invite email failed")
      }).catch(() => {
        toast.error("Member added but invite email failed")
      })
      resetForm()
      setDialogOpen(false)
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("This email is already registered as a team member")
      } else {
        toast.error("Failed to add team member", { description: error.message })
      }
    },
  })

  // Update team member
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await (supabase as any)
        .from("team_members")
        .update({
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone || null,
          role: data.role,
          permissions: data.allPermissions ? [] : data.permissions,
          notes: data.notes || null,
        })
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-team", eventId] })
      toast.success("Team member updated")
      resetForm()
      setDialogOpen(false)
      setEditingMember(null)
    },
    onError: (error: any) => {
      toast.error("Failed to update", { description: error.message })
    },
  })

  // Delete team member
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("team_members")
        .delete()
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-team", eventId] })
      toast.success("Team member removed")
    },
    onError: (error: any) => {
      toast.error("Failed to remove", { description: error.message })
    },
  })

  // Send magic link
  const sendInvite = async (member: TeamMember) => {
    setSendingInvite(member.id)
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: member.email.toLowerCase(),
          redirectTo: '/team-portal',
        }),
      })
      if (res.ok) {
        toast.success("Login link sent!", { description: `Sent to ${member.email}` })
      } else {
        toast.error("Failed to send login link")
      }
    } catch {
      toast.error("Failed to send login link")
    } finally {
      setSendingInvite(null)
    }
  }

  // Send WhatsApp login link
  const sendWhatsApp = async (member: TeamMember) => {
    if (!member.phone) {
      toast.error("No phone number", { description: "This member doesn't have a phone number" })
      return
    }
    setSendingWhatsApp(member.id)
    try {
      const loginUrl = `${window.location.origin}/team-login`
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: member.phone,
          recipient_name: member.name,
          type: 'text',
          text: `Hi ${member.name},\n\nYou have been added as a team member. Use the link below to login:\n\n${loginUrl}\n\nUse your registered email: ${member.email}`,
        }),
      })
      if (res.ok) {
        toast.success("WhatsApp sent!", { description: `Login link sent to ${member.phone}` })
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error("Failed to send WhatsApp", { description: err.error || "Unknown error" })
      }
    } catch {
      toast.error("Failed to send WhatsApp")
    } finally {
      setSendingWhatsApp(null)
    }
  }

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("team_members")
        .update({ is_active })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ["event-team", eventId] })
      toast.success(v.is_active ? "Member activated" : "Member deactivated")
    },
  })

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      role: "coordinator",
      permissions: [],
      allPermissions: false,
      notes: "",
    })
  }

  const openEditDialog = (member: TeamMember) => {
    setEditingMember(member)
    const isFullAccess = member.role === "admin" || !member.permissions?.length
    setFormData({
      name: member.name,
      email: member.email,
      phone: member.phone || "",
      role: member.role,
      permissions: member.permissions || [],
      allPermissions: isFullAccess,
      notes: member.notes || "",
    })
    setDialogOpen(true)
  }

  const openCreateDialog = () => {
    setEditingMember(null)
    resetForm()
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!formData.name || !formData.email) {
      toast.error("Name and email are required")
      return
    }

    if (editingMember) {
      updateMutation.mutate({ id: editingMember.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const togglePermission = (perm: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm],
    }))
  }

  // Filter by search
  const filteredTeam = eventTeam?.filter(member =>
    member.name.toLowerCase().includes(search.toLowerCase()) ||
    member.email.toLowerCase().includes(search.toLowerCase())
  ) || []

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleConfig = (role: string) => {
    return ROLE_CONFIG[role] || { label: role, color: "text-gray-700", bg: "bg-gray-100" }
  }

  const getPresetForMember = (member: TeamMember) => {
    const isFullAccess = member.role === "admin" || !member.permissions?.length
    return detectPreset(member.role, member.permissions || [], isFullAccess)
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Event Team</h1>
          <p className="text-muted-foreground">
            Manage team members for {event?.short_name || event?.name || "this event"}
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Team Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">{eventTeam?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center">
                <Shield className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">
                  {eventTeam?.filter(m => m.role === "admin").length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <UserCog className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">
                  {eventTeam?.filter(m => m.role !== "admin").length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Coordinators</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Team Table */}
      <Card>
        <CardContent className="p-0">
          {teamLoading ? (
            <div className="p-6">
              <SkeletonTable rows={5} />
            </div>
          ) : filteredTeam.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No team members yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                Add team members to give them access to manage this event.
                They'll receive an invite email with a login link.
              </p>
              <Button onClick={openCreateDialog}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add First Member
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeam.map((member) => {
                  const roleConfig = getRoleConfig(member.role)
                  const presetValue = getPresetForMember(member)
                  const preset = ROLE_PRESETS.find(p => p.value === presetValue)
                  const loginStatus = getLoginStatus(member)
                  const statusConfig = LOGIN_STATUS_CONFIG[loginStatus]
                  const StatusIcon = statusConfig.icon
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                            {member.phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {member.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className={cn("text-xs", roleConfig.bg, roleConfig.color)}>
                                {preset && preset.value !== "custom" ? preset.label : roleConfig.label}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{preset?.description || roleConfig.label}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        {member.role === "admin" || !member.permissions?.length ? (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Full Access
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {member.permissions.map((perm) => {
                              const config = PERMISSIONS.find(p => p.value === perm)
                              if (!config) return null
                              const Icon = config.icon
                              return (
                                <Badge key={perm} variant="outline" className={cn("text-[11px] gap-1 py-0 px-1.5")}>
                                  <Icon className={cn("h-3 w-3", config.color)} />
                                  {config.label}
                                </Badge>
                              )
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("text-xs gap-1", statusConfig.bgColor, statusConfig.color)}>
                          <StatusIcon className={cn("h-3 w-3", statusConfig.pulse && "animate-pulse")} />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {member.last_active_at
                            ? formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })
                            : member.last_login_at
                              ? formatDistanceToNow(new Date(member.last_login_at), { addSuffix: true })
                              : "Never"
                          }
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(member)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Member
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => sendInvite(member)}
                              disabled={sendingInvite === member.id}
                            >
                              {sendingInvite === member.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4 mr-2" />
                              )}
                              Send Login Link
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`mailto:${member.email}`}>
                                <Mail className="h-4 w-4 mr-2" />
                                Send Email
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => sendWhatsApp(member)}
                              disabled={!member.phone || sendingWhatsApp === member.id}
                            >
                              {sendingWhatsApp === member.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <MessageCircle className="h-4 w-4 mr-2" />
                              )}
                              Send WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => toggleActiveMutation.mutate({
                                id: member.id,
                                is_active: !member.is_active,
                              })}
                            >
                              {member.is_active ? (
                                <>
                                  <UserCog className="h-4 w-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                if (confirm("Remove this team member?")) {
                                  deleteMutation.mutate(member.id)
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? "Edit Team Member" : "Add Team Member"}
            </DialogTitle>
            <DialogDescription>
              {editingMember
                ? "Update team member details and permissions"
                : "Add a new team member. They'll receive an invite email with a login link."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Role Presets */}
            <div className="space-y-3">
              <Label>Quick Role Preset</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ROLE_PRESETS.map((preset) => {
                  const Icon = preset.icon
                  const isSelected = detectedPreset === preset.value
                  return (
                    <button
                      key={preset.value}
                      onClick={() => preset.value !== "custom" ? applyPreset(preset.value) : null}
                      className={cn(
                        "relative flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center",
                        isSelected
                          ? `${preset.borderColor} ${preset.bgLight} ring-1 ring-offset-1`
                          : "border-muted hover:border-muted-foreground/30 hover:bg-muted/50",
                        preset.value === "custom" && "opacity-60 cursor-default"
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center bg-gradient-to-br text-white",
                        preset.gradient
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium leading-tight">{preset.label}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{preset.description}</span>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </div>

            {/* Permissions - only show if not full access */}
            {!formData.allPermissions && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Module Permissions</Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.permissions.length === 0
                      ? "Select at least one module"
                      : `${formData.permissions.length} selected`
                    }
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PERMISSIONS.map((perm) => {
                    const Icon = perm.icon
                    const isSelected = formData.permissions.includes(perm.value)
                    return (
                      <div
                        key={perm.value}
                        onClick={() => togglePermission(perm.value)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                          isSelected
                            ? "bg-primary/5 border-primary"
                            : "bg-background hover:bg-muted/50"
                        )}
                      >
                        <Checkbox checked={isSelected} />
                        <Icon className={cn("h-4 w-4", perm.color)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{perm.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{perm.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {formData.allPermissions && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-rose-700">
                  <Shield className="h-5 w-5" />
                  <span className="font-medium">Full Access</span>
                </div>
                <p className="text-sm text-rose-600 mt-1">
                  This member will have full access to all modules for this event
                </p>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes about this team member..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {editingMember ? "Save Changes" : "Add Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
