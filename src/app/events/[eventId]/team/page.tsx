"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { SkeletonTable } from "@/components/ui/skeleton"

// Type definitions for Supabase queries
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
}

type EventType = {
  id: string
  name: string
  short_name: string | null
}

const PERMISSIONS = [
  { value: "flights", label: "Flights", icon: Plane, color: "text-sky-500", description: "Manage flight bookings" },
  { value: "hotels", label: "Hotels", icon: Hotel, color: "text-amber-500", description: "Manage hotel bookings" },
  { value: "transfers", label: "Transfers", icon: Car, color: "text-emerald-500", description: "Manage pickups/drops" },
  { value: "trains", label: "Trains", icon: Train, color: "text-orange-500", description: "Manage train bookings" },
  { value: "speakers", label: "Speakers", icon: Users, color: "text-purple-500", description: "Manage speakers" },
  { value: "program", label: "Program", icon: Calendar, color: "text-blue-500", description: "Manage schedule" },
  { value: "checkin", label: "Check-in", icon: QrCode, color: "text-green-500", description: "Manage check-in" },
  { value: "badges", label: "Badges", icon: Palette, color: "text-pink-500", description: "Design badges" },
  { value: "certificates", label: "Certificates", icon: Award, color: "text-indigo-500", description: "Manage certificates" },
  { value: "registrations", label: "Registrations", icon: ClipboardList, color: "text-cyan-500", description: "Manage attendees" },
]

const ROLES = [
  { value: "admin", label: "Event Admin", description: "Full access to this event" },
  { value: "travel", label: "Travel Coordinator", description: "Manage travel & accommodation" },
  { value: "coordinator", label: "Event Coordinator", description: "Manage event operations" },
]

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: "Event Admin", color: "text-rose-700", bg: "bg-rose-100" },
  travel: { label: "Travel Coordinator", color: "text-sky-700", bg: "bg-sky-100" },
  coordinator: { label: "Event Coordinator", color: "text-emerald-700", bg: "bg-emerald-100" },
}

export default function EventTeamPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "coordinator",
    permissions: [] as string[],
    notes: "",
  })

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event-details", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name")
        .eq("id", eventId)
        .single()
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

      // Filter members who have ONLY this event (event-specific members)
      // OR members explicitly assigned to this event
      const members = (data as TeamMember[] | null) || []
      return members.filter(m => m.event_ids?.includes(eventId))
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
          permissions: data.role === "admin" ? [] : data.permissions, // Admin gets full access
          notes: data.notes || null,
          event_ids: [eventId], // Only this event
          is_active: true,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-team", eventId] })
      toast.success("Team member added successfully")
      resetForm()
      setDialogOpen(false)
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("This email is already registered")
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
          permissions: data.role === "admin" ? [] : data.permissions,
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

  // Copy login info for team member
  const copyLoginInfo = async (member: TeamMember) => {
    const loginUrl = `${window.location.origin}/login`
    const info = `Login URL: ${loginUrl}\nEmail: ${member.email}\n\nThe team member can use their email to sign in.`

    // Copy to clipboard
    await navigator.clipboard.writeText(info)
    toast.success("Login info copied!", {
      description: "Share this with the team member to give them access",
    })
  }

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      role: "coordinator",
      permissions: [],
      notes: "",
    })
  }

  const openEditDialog = (member: TeamMember) => {
    setEditingMember(member)
    setFormData({
      name: member.name,
      email: member.email,
      phone: member.phone || "",
      role: member.role,
      permissions: member.permissions || [],
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
        : [...prev.permissions, perm]
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

  return (
    <div className="space-y-6">
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
                <p className="text-sm text-muted-foreground">Event Admins</p>
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
                They'll receive a magic link to login.
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
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeam.map((member) => {
                  const roleConfig = getRoleConfig(member.role)
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
                        <Badge variant="secondary" className={cn("text-xs", roleConfig.bg, roleConfig.color)}>
                          {roleConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.role === "admin" || !member.permissions?.length ? (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Full Access
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {member.permissions.slice(0, 3).map((perm) => {
                              const config = PERMISSIONS.find(p => p.value === perm)
                              if (!config) return null
                              const Icon = config.icon
                              return (
                                <Badge key={perm} variant="outline" className="text-xs gap-1">
                                  <Icon className={cn("h-3 w-3", config.color)} />
                                  {config.label}
                                </Badge>
                              )
                            })}
                            {member.permissions.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{member.permissions.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.is_active ? "default" : "secondary"} className="text-xs">
                          {member.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => copyLoginInfo(member)}>
                              <Link2 className="h-4 w-4 mr-2" />
                              Copy Login Info
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(member)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Member
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`mailto:${member.email}`}>
                                <Mail className="h-4 w-4 mr-2" />
                                Send Email
                              </a>
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
                : "Add a new team member who will have access to this event only"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <p className="font-medium">{role.label}</p>
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Permissions - only show if not admin */}
            {formData.role !== "admin" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Permissions</Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.permissions.length === 0
                      ? "No permissions = Full access"
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
                <p className="text-xs text-muted-foreground">
                  Leave empty to give full access to all modules
                </p>
              </div>
            )}

            {formData.role === "admin" && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-rose-700">
                  <Shield className="h-5 w-5" />
                  <span className="font-medium">Event Admin</span>
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
