"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { SkeletonTable } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Sheet,
  ResizableSheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  Users,
  Mail,
  Plane,
  Shield,
  UserCog,
  Edit,
  Trash2,
  CheckCircle,
  Search,
  Calendar,
  FileText,
  Copy,
  Hotel,
  Car,
  Train,
  UserPlus,
  UserCheck,
  UserX,
  Sparkles,
  Link2,
  Award,
  Clock,
  MoreHorizontal,
  ChevronRight,
  ChevronLeft,
  Activity,
  BookOpen,
  Info,
  ArrowRight,
  BarChart3,
  ClipboardList,
  MapPin,
  LogOut,
  Wifi,
  WifiOff,
  CircleDot,
  Settings,
  Download,
  Eye,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { PendingInvitations, Invitation } from "@/components/team/pending-invitations"
import { ActivityFeed } from "@/components/team/activity-feed"
import { DeviceTokens } from "@/components/team/device-tokens"
import { PreviewModal } from "@/components/team/preview-modal"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { InviteDialog } from "@/components/team/invite-dialog"
import { MemberDetailPanel } from "@/components/team/member-detail-panel"
import { ModulesCoverage } from "@/components/team/modules-coverage"

// ---------------------------------------------------------------------------
// Types & Constants
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
  logged_out_at?: string | null
  login_count?: number
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

type ActiveView =
  | "dashboard"
  | "all-members"
  | "admins"
  | "coordinators"
  | "travel"
  | "pending"
  | "accepted"
  | "activity-log"
  | "access-log"
  | "permissions-schema"
  | "role-presets"

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Asia/Kuala_Lumpur", label: "Asia/Kuala_Lumpur (MYT)" },
  { value: "America/New_York", label: "America/New_York (EST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
]

const TAG_SUGGESTIONS = ["logistics", "finance", "travel", "registration", "technical", "medical", "hospitality", "coordination"]

const TAG_COLORS: Record<string, string> = {
  logistics: "bg-blue-100 text-blue-700 border-blue-200",
  finance: "bg-emerald-100 text-emerald-700 border-emerald-200",
  travel: "bg-sky-100 text-sky-700 border-sky-200",
  registration: "bg-teal-100 text-teal-700 border-teal-200",
  technical: "bg-violet-100 text-violet-700 border-violet-200",
  medical: "bg-red-100 text-red-700 border-red-200",
  hospitality: "bg-amber-100 text-amber-700 border-amber-200",
  coordination: "bg-pink-100 text-pink-700 border-pink-200",
}

const TRAVEL_PERMISSIONS = [
  { value: "flights", label: "Flights", icon: Plane, color: "text-sky-500", bg: "bg-sky-500", bgLight: "bg-sky-50 border-sky-200", description: "Manage flight bookings for faculty", access: ["View all flight bookings", "Create new flight bookings", "Edit existing bookings", "Cancel/delete bookings", "Export flight data"], path: "/travel-dashboard -> Flights" },
  { value: "hotels", label: "Hotels", icon: Hotel, color: "text-amber-500", bg: "bg-amber-500", bgLight: "bg-amber-50 border-amber-200", description: "Manage hotel accommodations", access: ["View all hotel bookings", "Create new reservations", "Edit booking details", "Cancel reservations", "Export hotel data"], path: "/travel-dashboard -> Hotels" },
  { value: "transfers", label: "Transfers", icon: Car, color: "text-emerald-500", bg: "bg-emerald-500", bgLight: "bg-emerald-50 border-emerald-200", description: "Manage ground transportation", access: ["View all transfer requests", "Schedule pickups/drops", "Assign vehicles", "Track transfer status", "Export transfer data"], path: "/travel-dashboard -> Transfers" },
  { value: "trains", label: "Trains", icon: Train, color: "text-orange-500", bg: "bg-orange-500", bgLight: "bg-orange-50 border-orange-200", description: "Manage train reservations", access: ["View all train bookings", "Create new bookings", "Edit booking details", "Cancel bookings", "Export train data"], path: "/travel-dashboard -> Trains" },
]

const EVENT_PERMISSIONS = [
  { value: "speakers", label: "Speakers", icon: Users, color: "text-cyan-500", bg: "bg-cyan-500", bgLight: "bg-cyan-50 border-cyan-200", description: "Manage event speakers/faculty", access: ["View all speakers list", "Add new speakers", "Edit speaker profiles", "Remove speakers", "Send communications", "Export speaker data"], path: "/events/[id]/speakers" },
  { value: "program", label: "Program", icon: Calendar, color: "text-indigo-500", bg: "bg-indigo-500", bgLight: "bg-indigo-50 border-indigo-200", description: "Manage event program/schedule", access: ["View full program schedule", "Create sessions", "Edit session details", "Assign speakers to sessions", "Manage session timings", "Send confirmations"], path: "/events/[id]/program" },
  { value: "checkin", label: "Check-in", icon: CheckCircle, color: "text-green-500", bg: "bg-green-500", bgLight: "bg-green-50 border-green-200", description: "Handle attendee check-ins", access: ["Access check-in scanner", "Manual check-in attendees", "View check-in statistics", "Search attendees", "Print badges on-site"], path: "/events/[id]/checkin" },
  { value: "badges", label: "Badges", icon: Award, color: "text-pink-500", bg: "bg-pink-500", bgLight: "bg-pink-50 border-pink-200", description: "Design and print badges", access: ["Access badge designer", "Create badge templates", "Generate badges", "Print badges (bulk/individual)", "Export badge PDFs"], path: "/events/[id]/badges" },
  { value: "certificates", label: "Certificates", icon: FileText, color: "text-violet-500", bg: "bg-violet-500", bgLight: "bg-violet-50 border-violet-200", description: "Design and send certificates", access: ["Access certificate designer", "Create certificate templates", "Generate certificates", "Send certificates via email", "Verify certificates"], path: "/events/[id]/certificates" },
  { value: "registrations", label: "Registrations", icon: ClipboardList, color: "text-teal-500", bg: "bg-teal-500", bgLight: "bg-teal-50 border-teal-200", description: "Manage event registrations", access: ["View all registrations", "Add/edit registrations", "Import registrations (CSV)", "Export registration data", "Send communications", "View reports & analytics"], path: "/events/[id]/registrations" },
  { value: "abstracts", label: "Abstracts", icon: BookOpen, color: "text-orange-500", bg: "bg-orange-500", bgLight: "bg-orange-50 border-orange-200", description: "Manage abstract submissions & reviews", access: ["View all abstract submissions", "Review & score abstracts", "Accept/reject abstracts", "Configure abstract settings", "Manage abstract categories", "Export abstract data"], path: "/events/[id]/abstracts" },
]

const PERMISSIONS = [...TRAVEL_PERMISSIONS, ...EVENT_PERMISSIONS]

const ROLE_DETAILS = [
  { value: "admin", label: "Administrator", icon: Shield, gradient: "from-purple-500 to-pink-500", color: "bg-purple-500", textColor: "text-purple-600", bgLight: "bg-gradient-to-br from-purple-50 to-pink-50", borderColor: "border-purple-300", description: "Full system access with all privileges", capabilities: ["Access to ALL modules without restrictions", "Manage team members (add/edit/remove)", "Assign permissions to other users", "Access all events (past, present, future)", "View system-wide reports & analytics", "Configure system settings"], recommended: "For organization owners and senior managers" },
  { value: "coordinator", label: "Event Coordinator", icon: UserCog, gradient: "from-blue-500 to-indigo-500", color: "bg-blue-500", textColor: "text-blue-600", bgLight: "bg-gradient-to-br from-blue-50 to-indigo-50", borderColor: "border-blue-300", description: "Manages events and attendees", capabilities: ["Access based on assigned permissions", "Can only see assigned events", "Cannot manage team members", "Cannot change system settings", "Limited to their module access"], recommended: "For event managers and on-ground coordinators" },
  { value: "travel", label: "Travel Coordinator", icon: Plane, gradient: "from-cyan-500 to-blue-500", color: "bg-cyan-500", textColor: "text-cyan-600", bgLight: "bg-gradient-to-br from-cyan-50 to-blue-50", borderColor: "border-cyan-300", description: "Manages travel and logistics", capabilities: ["Access based on assigned permissions", "Focused on travel-related modules", "Can only see assigned events", "Cannot manage team members", "Cannot change system settings"], recommended: "For travel desk and logistics staff" },
]

const ROLES = ROLE_DETAILS.map(r => ({ value: r.value, label: r.label, icon: r.icon, gradient: r.gradient, color: r.color, textColor: r.textColor, bgLight: r.bgLight, borderColor: r.borderColor, description: r.description }))

const ROLE_PRESETS = [
  { value: "administrator", label: "Administrator", icon: Shield, description: "Full system access", role: "admin", permissions: [] as string[], allEvents: true, allPermissions: true, gradient: "from-purple-500 to-pink-500", borderColor: "border-purple-300", bgLight: "bg-purple-50" },
  { value: "event-manager", label: "Event Manager", icon: UserCog, description: "All event modules", role: "coordinator", permissions: ["speakers", "program", "checkin", "badges", "certificates", "registrations", "abstracts"], allEvents: false, allPermissions: false, gradient: "from-blue-500 to-indigo-500", borderColor: "border-blue-300", bgLight: "bg-blue-50" },
  { value: "registration-manager", label: "Registration Mgr", icon: ClipboardList, description: "Registrations only", role: "coordinator", permissions: ["registrations"], allEvents: false, allPermissions: false, gradient: "from-teal-500 to-emerald-500", borderColor: "border-teal-300", bgLight: "bg-teal-50" },
  { value: "program-coordinator", label: "Program Coord.", icon: Calendar, description: "Speakers & program", role: "coordinator", permissions: ["speakers", "program"], allEvents: false, allPermissions: false, gradient: "from-indigo-500 to-violet-500", borderColor: "border-indigo-300", bgLight: "bg-indigo-50" },
  { value: "checkin-staff", label: "Check-in Staff", icon: CheckCircle, description: "Check-in & badges", role: "coordinator", permissions: ["checkin", "badges"], allEvents: false, allPermissions: false, gradient: "from-green-500 to-emerald-500", borderColor: "border-green-300", bgLight: "bg-green-50" },
  { value: "badge-certificate", label: "Badge & Cert", icon: Award, description: "Badges & certificates", role: "coordinator", permissions: ["badges", "certificates"], allEvents: false, allPermissions: false, gradient: "from-pink-500 to-rose-500", borderColor: "border-pink-300", bgLight: "bg-pink-50" },
  { value: "travel-manager", label: "Travel Manager", icon: MapPin, description: "All travel modules", role: "travel", permissions: ["flights", "hotels", "transfers", "trains"], allEvents: false, allPermissions: false, gradient: "from-cyan-500 to-blue-500", borderColor: "border-cyan-300", bgLight: "bg-cyan-50" },
  { value: "hotel-coordinator", label: "Hotel Coord.", icon: Hotel, description: "Hotels only", role: "travel", permissions: ["hotels"], allEvents: false, allPermissions: false, gradient: "from-amber-500 to-orange-500", borderColor: "border-amber-300", bgLight: "bg-amber-50" },
  { value: "flight-coordinator", label: "Flight Coord.", icon: Plane, description: "Flights only", role: "travel", permissions: ["flights"], allEvents: false, allPermissions: false, gradient: "from-sky-500 to-blue-500", borderColor: "border-sky-300", bgLight: "bg-sky-50" },
  { value: "custom", label: "Custom", icon: Settings, description: "Configure manually", role: "", permissions: [] as string[], allEvents: false, allPermissions: false, gradient: "from-slate-400 to-slate-500", borderColor: "border-slate-300", bgLight: "bg-slate-50" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function detectPresetForMember(member: TeamMember) {
  const perms = Array.isArray(member.permissions) ? member.permissions : []
  const hasAllPerms = perms.length === 0
  const hasAllEvents = !member.event_ids || member.event_ids.length === 0
  const memberPerms = [...perms].sort()
  for (const preset of ROLE_PRESETS) {
    if (preset.value === "custom") continue
    if (preset.role !== member.role) continue
    if (preset.allPermissions !== hasAllPerms) continue
    if (preset.allEvents !== hasAllEvents) continue
    if (!preset.allPermissions) {
      const presetPerms = [...preset.permissions].sort()
      if (presetPerms.length !== memberPerms.length) continue
      if (presetPerms.some((p, i) => p !== memberPerms[i])) continue
    }
    return preset
  }
  return null
}

const getRoleInfo = (role: string) => ROLES.find(r => r.value === role) || ROLES[0]
const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
const copyToClipboard = (text: string, msg: string) => { navigator.clipboard.writeText(text); toast.success(msg) }

// ---------------------------------------------------------------------------
// Sidebar Navigation Config
// ---------------------------------------------------------------------------

const SIDEBAR_SECTIONS: { heading: string; items: { key: ActiveView; label: string; icon: any }[] }[] = [
  {
    heading: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "all-members", label: "All Members", icon: Users },
    ],
  },
  {
    heading: "By Role",
    items: [
      { key: "admins", label: "Admins", icon: Shield },
      { key: "coordinators", label: "Coordinators", icon: UserCog },
      { key: "travel", label: "Travel", icon: Plane },
    ],
  },
  {
    heading: "Invitations",
    items: [
      { key: "pending", label: "Pending", icon: Clock },
      { key: "accepted", label: "Accepted", icon: UserCheck },
    ],
  },
  {
    heading: "Activity",
    items: [
      { key: "activity-log", label: "Activity Log", icon: Activity },
      { key: "access-log", label: "Access Log", icon: Eye },
    ],
  },
  {
    heading: "Settings",
    items: [
      { key: "permissions-schema", label: "Permission Guide", icon: BookOpen },
      { key: "role-presets", label: "Role Presets", icon: Settings },
    ],
  },
]

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function TeamPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()

  // -- View state
  const [activeView, setActiveView] = useState<ActiveView>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // -- Dialog/sheet state
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [previewMemberId, setPreviewMemberId] = useState<string | null>(null)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [isAuditExportOpen, setIsAuditExportOpen] = useState(false)

  // -- Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [tagFilter, setTagFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // -- Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const clearSelection = () => setSelectedIds(new Set())

  // -- Audit export state
  const [auditFrom, setAuditFrom] = useState("")
  const [auditTo, setAuditTo] = useState("")
  const [auditActionType, setAuditActionType] = useState("")
  const [auditActorEmail, setAuditActorEmail] = useState("")

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: teamMembers, isLoading, refetch } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("team_members").select("*").order("created_at", { ascending: false })
      if (error) throw error
      const members = data as TeamMember[]
      const emails = members.map(m => (m.email || "").toLowerCase())
      if (emails.length > 0) {
        const { data: users } = await (supabase as any).from("users").select("email, last_login_at, last_active_at, login_count").in("email", emails)
        if (users) {
          const userMap = new Map<string, any>(users.map((u: any) => [u.email?.toLowerCase(), u]))
          for (const member of members) {
            const user = userMap.get((member.email || "").toLowerCase())
            if (user) {
              member.last_login_at = user.last_login_at
              member.last_active_at = user.last_active_at
              member.login_count = user.login_count ?? 0
            }
          }
        }
      }
      return members
    },
  })

  const { data: events } = useQuery({
    queryKey: ["events-list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("events").select("id, name, short_name, start_date, end_date, status").order("start_date", { ascending: false })
      return (data || []) as Event[]
    },
  })

  const { data: isSuperAdmin } = useQuery({
    queryKey: ["current-user-super-admin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false
      const { data: profile } = await (supabase as any).from("users").select("is_super_admin, platform_role").eq("id", user.id).maybeSingle()
      return profile?.is_super_admin === true || profile?.platform_role === "super_admin"
    },
  })

  const { data: invitations, isLoading: invitationsLoading } = useQuery({
    queryKey: ["team-invitations"],
    queryFn: async () => {
      const res = await fetch('/api/team/invite')
      if (!res.ok) return []
      const data = await res.json()
      return (data.invitations || []) as Invitation[]
    },
  })

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const resendInvite = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/team/${id}/resend-invite`, { method: 'POST' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to resend') }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data?.whatsapp_sent ? "Invitation resent via email + WhatsApp" : "Invitation resent with new link")
      queryClient.invalidateQueries({ queryKey: ["team-invitations"] })
    },
    onError: (error: any) => toast.error(error.message),
  })

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/team/invite/${id}/revoke`, { method: 'POST' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to revoke') }
    },
    onSuccess: () => { toast.success("Invitation revoked"); queryClient.invalidateQueries({ queryKey: ["team-invitations"] }) },
    onError: (error: any) => toast.error(error.message),
  })

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/team/${id}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to remove') }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["team-members"] }); toast.success("Member removed"); setSelectedMember(null) },
  })

  const bulkActivate = useMutation({
    mutationFn: async (ids: string[]) => { await Promise.all(ids.map(id => fetch(`/api/team/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: true }) }))) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["team-members"] }); toast.success(`${selectedIds.size} members activated`); clearSelection() },
  })

  const bulkDeactivate = useMutation({
    mutationFn: async (ids: string[]) => { await Promise.all(ids.map(id => fetch(`/api/team/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: false }) }))) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["team-members"] }); toast.success(`${selectedIds.size} members deactivated`); clearSelection() },
  })

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => { await Promise.all(ids.map(id => fetch(`/api/team/${id}`, { method: 'DELETE' }))) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["team-members"] }); toast.success(`${selectedIds.size} members removed`); clearSelection() },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from("team_members").update({ is_active }).eq("id", id)
      if (error) throw error
    },
    onSuccess: (_, v) => { queryClient.invalidateQueries({ queryKey: ["team-members"] }); toast.success(v.is_active ? "Member activated" : "Member deactivated") },
  })

  const sendMagicLink = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch('/api/auth/magic-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.toLowerCase(), redirectTo: '/team-portal' }) })
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Failed to send login link') }
    },
    onSuccess: () => toast.success("Login link sent!"),
    onError: (error: any) => toast.error(error.message || "Failed to send"),
  })

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  // Sync roleFilter when navigating to role-specific sidebar views
  useEffect(() => {
    if (activeView === "admins") setRoleFilter("admin")
    else if (activeView === "coordinators") setRoleFilter("coordinator")
    else if (activeView === "travel") setRoleFilter("travel")
    else if (activeView === "dashboard" || activeView === "all-members") setRoleFilter("all")
  }, [activeView])

  const filteredMembers = useMemo(() => {
    return (teamMembers || []).filter(m => {
      const matchesSearch = (m.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || (m.email || "").toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" && m.is_active) || (statusFilter === "inactive" && !m.is_active)
      const matchesRole = roleFilter === "all" || m.role === roleFilter
      const matchesTag = tagFilter === "all" || (Array.isArray(m.tags) && m.tags.includes(tagFilter))
      return matchesSearch && matchesStatus && matchesRole && matchesTag
    })
  }, [teamMembers, searchQuery, statusFilter, roleFilter, tagFilter])

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage)
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredMembers.slice(start, start + itemsPerPage)
  }, [filteredMembers, currentPage])

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMembers.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredMembers.map(m => m.id)))
  }

  useEffect(() => { setCurrentPage(1); setSelectedIds(new Set()) }, [searchQuery, statusFilter, roleFilter, tagFilter])

  useEffect(() => {
    if (selectedMember && teamMembers) {
      const updated = teamMembers.find(m => m.id === selectedMember.id)
      if (updated) setSelectedMember(updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMembers])

  const totalMembers = teamMembers?.length || 0
  const activeMembers = teamMembers?.filter(m => m.is_active).length || 0
  const pendingInviteCount = invitations?.filter(i => i.status === 'pending').length || 0

  const newThisMonth = useMemo(() => {
    if (!teamMembers) return 0
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    return teamMembers.filter(m => new Date(m.created_at).getTime() > thirtyDaysAgo).length
  }, [teamMembers])

  const onlineNowCount = useMemo(() => {
    if (!teamMembers) return 0
    return teamMembers.filter(m => {
      if (!m.is_active || !m.last_active_at) return false
      return Date.now() - new Date(m.last_active_at).getTime() < 15 * 60 * 1000
    }).length
  }, [teamMembers])

  const awayCount = useMemo(() => {
    if (!teamMembers) return 0
    return teamMembers.filter(m => {
      if (!m.is_active || !m.last_active_at) return false
      const diff = Date.now() - new Date(m.last_active_at).getTime()
      return diff >= 15 * 60 * 1000 && diff < 2 * 60 * 60 * 1000
    }).length
  }, [teamMembers])

  const expiringSoonCount = useMemo(() => {
    if (!invitations) return 0
    const soon = Date.now() + 48 * 60 * 60 * 1000
    return invitations.filter(i => i.status === "pending" && new Date(i.expires_at).getTime() < soon).length
  }, [invitations])

  const moduleCoverage = useMemo(() => {
    if (!teamMembers) return { covered: 0, total: PERMISSIONS.length }
    const coveredModules = new Set<string>()
    for (const m of teamMembers) {
      if (!m.is_active) continue
      if (!Array.isArray(m.permissions) || m.permissions.length === 0) {
        PERMISSIONS.forEach(p => coveredModules.add(p.value))
      } else {
        m.permissions.forEach(p => coveredModules.add(p))
      }
    }
    return { covered: coveredModules.size, total: PERMISSIONS.length }
  }, [teamMembers])

  const handleExportCSV = () => {
    fetch('/api/team/export')
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url
        a.download = `team-members-${new Date().toISOString().slice(0, 10)}.csv`
        a.click(); URL.revokeObjectURL(url); toast.success("Team data exported!")
      })
      .catch(() => toast.error("Export failed"))
  }

  const handleExportAudit = () => {
    const params = new URLSearchParams({ type: 'audit' })
    if (auditFrom) params.set('from', auditFrom)
    if (auditTo) params.set('to', auditTo)
    if (auditActionType) params.set('action_type', auditActionType)
    if (auditActorEmail) params.set('actor_email', auditActorEmail)
    fetch(`/api/team/export?${params.toString()}`)
      .then(res => { if (!res.ok) throw new Error('Export failed'); return res.blob() })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url
        a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`
        a.click(); URL.revokeObjectURL(url); toast.success("Audit trail exported!"); setIsAuditExportOpen(false)
      })
      .catch(() => toast.error("Audit export failed"))
  }

  // Determine if we should show overview (stats + coverage + table + bottom)
  const showOverview = activeView === "dashboard" || activeView === "all-members"
  const showRoleTable = activeView === "admins" || activeView === "coordinators" || activeView === "travel"

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ================================================================= */}
      {/* SIDEBAR                                                           */}
      {/* ================================================================= */}
      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-50 lg:z-auto h-screen w-[220px] flex-shrink-0 bg-[#185FA5] text-white flex flex-col transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Back + Logo area */}
        <div className="px-5 pt-4 pb-4">
          <button
            onClick={() => router.push("/events")}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs mb-3 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">AMASI</h1>
              <p className="text-[11px] text-white/60 mt-0.5">Team Management</p>
            </div>
            <button className="lg:hidden p-1 hover:bg-white/10 rounded" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 overflow-y-auto space-y-4">
          {SIDEBAR_SECTIONS.map(section => (
            <div key={section.heading}>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-2 mb-1.5">{section.heading}</p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon
                  const isActive = activeView === item.key
                  // Badge counts for specific items
                  let badge: number | undefined
                  if (item.key === "all-members") badge = totalMembers
                  else if (item.key === "pending") badge = pendingInviteCount
                  else if (item.key === "admins") badge = teamMembers?.filter(m => m.role === "admin").length
                  else if (item.key === "coordinators") badge = teamMembers?.filter(m => m.role === "coordinator").length
                  else if (item.key === "travel") badge = teamMembers?.filter(m => m.role === "travel").length

                  return (
                    <button
                      key={item.key}
                      onClick={() => { setActiveView(item.key); setSidebarOpen(false) }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        isActive
                          ? "bg-white/15 border-l-[3px] border-white"
                          : "hover:bg-white/10 border-l-[3px] border-transparent"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {badge !== undefined && badge > 0 && (
                        <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5 font-medium">{badge}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Quick Actions */}
        <div className="px-3 pb-6 space-y-2">
          <button
            onClick={() => { setIsInviteOpen(true); setSidebarOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-white/30 hover:bg-white/10 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => { setActiveView("permissions-schema"); setSidebarOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-white/30 hover:bg-white/10 transition-colors"
            >
              <Shield className="h-4 w-4" />
              Device Tokens
            </button>
          )}
        </div>
      </aside>

      {/* ================================================================= */}
      {/* MAIN CONTENT                                                      */}
      {/* ================================================================= */}
      <main className="flex-1 min-w-0 overflow-y-auto">

        {/* TOP BAR */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold truncate">Team Management</h2>
                <p className="text-xs text-muted-foreground truncate">
                  {events?.length || 0} events &middot; {totalMembers} members &middot; {pendingInviteCount} pending invites
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="hidden sm:flex">
                <Download className="h-4 w-4 mr-2" />Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsInviteOpen(true)} className="hidden sm:flex">
                <Users className="h-4 w-4 mr-2" />Bulk Invite
              </Button>
              <Button size="sm" className="bg-[#185FA5] hover:bg-[#14508c] text-white" onClick={() => setIsInviteOpen(true)}>
                <UserPlus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Invite Member</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* OVERVIEW / ALL-MEMBERS VIEW                                    */}
        {/* ============================================================= */}
        {(showOverview || showRoleTable) && (
          <>
            {/* Stats Row */}
            {showOverview && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6 py-4">
                <StatsCard
                  label="TOTAL MEMBERS"
                  value={totalMembers}
                  delta={newThisMonth > 0 ? `+${newThisMonth} this month` : undefined}
                  deltaType="positive"
                />
                <StatsCard
                  label="ONLINE NOW"
                  value={onlineNowCount}
                  delta={awayCount > 0 ? `${awayCount} away` : undefined}
                  deltaType="neutral"
                />
                <StatsCard
                  label="PENDING INVITES"
                  value={pendingInviteCount}
                  delta={expiringSoonCount > 0 ? `${expiringSoonCount} expiring soon` : undefined}
                  deltaType="negative"
                />
                <StatsCard
                  label="MODULES COVERED"
                  value={`${moduleCoverage.covered}/${moduleCoverage.total}`}
                  delta={moduleCoverage.covered < moduleCoverage.total ? `${moduleCoverage.total - moduleCoverage.covered} uncovered` : undefined}
                  deltaType={moduleCoverage.covered < moduleCoverage.total ? "negative" : "positive"}
                />
              </div>
            )}

            {/* Module Coverage Widget */}
            {showOverview && (
              <div className="px-6 pb-4">
                <ModulesCoverage
                  members={teamMembers || []}
                  eventId={events?.[0]?.id}
                />
              </div>
            )}

            {/* Filter Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { value: "all", label: "All" },
                  { value: "admin", label: "Admin" },
                  { value: "coordinator", label: "Coordinator" },
                  { value: "travel", label: "Travel" },
                  { value: "inactive", label: "Inactive" },
                ].map(chip => {
                  const isInactive = chip.value === "inactive"
                  const isActive = isInactive
                    ? statusFilter === "inactive"
                    : roleFilter === chip.value && statusFilter !== "inactive"

                  return (
                    <button
                      key={chip.value}
                      onClick={() => {
                        if (isInactive) {
                          setStatusFilter(statusFilter === "inactive" ? "all" : "inactive")
                          setRoleFilter("all")
                        } else {
                          setRoleFilter(chip.value)
                          setStatusFilter("all")
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                        isActive
                          ? "bg-[#185FA5] text-white border-[#185FA5]"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-[#185FA5]/50"
                      )}
                    >
                      {chip.label}
                    </button>
                  )
                })}
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 mx-6 mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">{selectedIds.size} selected</Badge>
                <div className="flex items-center gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={() => bulkActivate.mutate(Array.from(selectedIds))} disabled={bulkActivate.isPending}>
                    <UserCheck className="h-3.5 w-3.5 mr-1.5" />Activate
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => bulkDeactivate.mutate(Array.from(selectedIds))} disabled={bulkDeactivate.isPending}>
                    <UserX className="h-3.5 w-3.5 mr-1.5" />Deactivate
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { if (confirm(`Remove ${selectedIds.size} members? This cannot be undone.`)) bulkDelete.mutate(Array.from(selectedIds)) }} disabled={bulkDelete.isPending}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />Remove
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
                </div>
              </div>
            )}

            {/* Member Table */}
            <div className="px-6">
              {isLoading ? (
                <SkeletonTable rows={5} />
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-20">
                  <div className="h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-10 w-10 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{searchQuery ? "No matching members" : "No team members yet"}</h3>
                  <p className="text-muted-foreground mb-6">{searchQuery ? "Try a different search term" : "Add your first team member to get started"}</p>
                  {!searchQuery && <Button onClick={() => setIsInviteOpen(true)} size="lg"><UserPlus className="h-5 w-5 mr-2" />Add First Member</Button>}
                </div>
              ) : (
                <MemberTable
                  members={paginatedMembers}
                  allMembers={filteredMembers}
                  events={events}
                  selectedIds={selectedIds}
                  toggleSelect={toggleSelect}
                  toggleSelectAll={toggleSelectAll}
                  isSuperAdmin={isSuperAdmin}
                  onSelectMember={setSelectedMember}
                  onSendMagicLink={(email) => sendMagicLink.mutate(email)}
                  onToggleActive={(id, is_active) => toggleActive.mutate({ id, is_active })}
                  onDelete={(id, name) => { if (confirm(`Remove ${name}?`)) deleteMember.mutate(id) }}
                  onPreview={setPreviewMemberId}
                />
              )}

              {/* Pagination */}
              {filteredMembers.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-6 px-2">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredMembers.length)} of {filteredMembers.length} members
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4 mr-1" />Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) pageNum = i + 1
                        else if (currentPage <= 3) pageNum = i + 1
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
                        else pageNum = currentPage - 2 + i
                        return (
                          <Button key={pageNum} variant={currentPage === pageNum ? "default" : "outline"} size="sm" className="w-9 h-9" onClick={() => setCurrentPage(pageNum)}>
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      Next<ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Two Columns */}
            {showOverview && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 px-6 py-6">
                {/* Pending Invitations (60%) */}
                <div className="lg:col-span-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">Pending Invitations</h3>
                    {pendingInviteCount > 0 && (
                      <button onClick={() => setActiveView("pending")} className="text-xs text-[#185FA5] hover:underline font-medium flex items-center gap-1">
                        View all <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <PendingInvitations
                    invitations={(invitations?.filter(i => i.status === 'pending') || []).slice(0, 5)}
                    isLoading={invitationsLoading}
                    onResend={(id) => resendInvite.mutate(id)}
                    onRevoke={(id) => revokeInvite.mutate(id)}
                    isResending={resendInvite.isPending}
                  />
                </div>
                {/* Live Activity Feed (40%) */}
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">Live Activity</h3>
                    <button onClick={() => setActiveView("activity-log")} className="text-xs text-[#185FA5] hover:underline font-medium flex items-center gap-1">
                      View all <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border overflow-hidden" style={{ height: 360 }}>
                    <ActivityFeed onClose={() => {}} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ============================================================= */}
        {/* PENDING INVITATIONS VIEW                                       */}
        {/* ============================================================= */}
        {activeView === "pending" && (
          <div className="p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatsCard label="TOTAL SENT" value={invitations?.length || 0} delta="All time" deltaType="neutral" />
              <StatsCard label="ACCEPTED" value={invitations?.filter(i => i.status === 'accepted').length || 0} delta="Onboarded" deltaType="positive" />
              <StatsCard label="EXPIRED" value={invitations?.filter(i => i.status === 'expired').length || 0} delta="Need resending" deltaType="negative" />
              <StatsCard label="PENDING" value={pendingInviteCount} delta="Awaiting response" deltaType="neutral" />
            </div>
            <PendingInvitations
              invitations={invitations?.filter(i => i.status === 'pending') || []}
              isLoading={invitationsLoading}
              onResend={(id) => resendInvite.mutate(id)}
              onRevoke={(id) => revokeInvite.mutate(id)}
              isResending={resendInvite.isPending}
            />
          </div>
        )}

        {/* ============================================================= */}
        {/* ACCEPTED INVITATIONS VIEW                                      */}
        {/* ============================================================= */}
        {activeView === "accepted" && (
          <div className="p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatsCard label="TOTAL SENT" value={invitations?.length || 0} delta="All time" deltaType="neutral" />
              <StatsCard label="ACCEPTED" value={invitations?.filter(i => i.status === 'accepted').length || 0} delta="Onboarded" deltaType="positive" />
              <StatsCard label="EXPIRED" value={invitations?.filter(i => i.status === 'expired').length || 0} delta="Need resending" deltaType="negative" />
              <StatsCard label="PENDING" value={pendingInviteCount} delta="Awaiting response" deltaType="neutral" />
            </div>
            <PendingInvitations
              invitations={invitations?.filter(i => i.status === 'accepted') || []}
              isLoading={invitationsLoading}
              onResend={(id) => resendInvite.mutate(id)}
              onRevoke={(id) => revokeInvite.mutate(id)}
              isResending={resendInvite.isPending}
            />
          </div>
        )}

        {/* ============================================================= */}
        {/* ACTIVITY LOG VIEW                                              */}
        {/* ============================================================= */}
        {activeView === "activity-log" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-muted-foreground">Review team activity and access logs</p>
              {isSuperAdmin && (
                <Button variant="outline" size="sm" onClick={() => setIsAuditExportOpen(true)}>
                  <Download className="h-4 w-4 mr-2" />Export Audit Trail
                </Button>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-sm">Live Activity Feed</h3>
              </div>
              <div style={{ height: 500 }}>
                <ActivityFeed onClose={() => {}} />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* ACCESS LOG VIEW                                                */}
        {/* ============================================================= */}
        {activeView === "access-log" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-muted-foreground">Access log and login history</p>
              {isSuperAdmin && (
                <Button variant="outline" size="sm" onClick={() => setIsAuditExportOpen(true)}>
                  <Download className="h-4 w-4 mr-2" />Export Access Log
                </Button>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-sm">Access Log</h3>
              </div>
              <div style={{ height: 500 }}>
                <ActivityFeed onClose={() => {}} />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* PERMISSIONS SCHEMA VIEW                                        */}
        {/* ============================================================= */}
        {activeView === "permissions-schema" && (
          <div className="p-6 space-y-6">
            {/* Permission Guide card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Permission Guide</h3>
                    <p className="text-xs text-muted-foreground">Understand what each role and permission grants access to</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsGuideOpen(true)}>
                  <BookOpen className="h-4 w-4 mr-2" />Open Full Guide
                </Button>
              </div>
            </div>

            {/* Portal Link */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Link2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Team Portal Link</h3>
                    <p className="text-xs text-muted-foreground">Share this link so team members can log in</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${window.location.origin}/team-login`, "Portal link copied!")}>
                  <Copy className="h-4 w-4 mr-2" />Copy Link
                </Button>
              </div>
            </div>

            {/* Device Tokens (super_admin only) */}
            {isSuperAdmin && <DeviceTokens />}
          </div>
        )}

        {/* ============================================================= */}
        {/* ROLE PRESETS VIEW                                              */}
        {/* ============================================================= */}
        {activeView === "role-presets" && (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Settings className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Role Presets</h3>
                <p className="text-xs text-muted-foreground">Pre-configured permission sets for common team roles</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {ROLE_PRESETS.filter(p => p.value !== "custom").map(preset => {
                const PresetIcon = preset.icon
                return (
                  <div key={preset.value} className={cn("rounded-xl border-2 p-4", preset.borderColor, preset.bgLight)}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br text-white flex items-center justify-center", preset.gradient)}>
                        <PresetIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{preset.label}</h4>
                        <p className="text-xs text-muted-foreground">{preset.description}</p>
                      </div>
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground">
                      <p><span className="font-medium">Role:</span> {preset.role || "Custom"}</p>
                      <p><span className="font-medium">Permissions:</span> {preset.allPermissions ? "All" : preset.permissions.join(", ") || "None"}</p>
                      <p><span className="font-medium">Events:</span> {preset.allEvents ? "All Events" : "Assigned only"}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </main>

      {/* ================================================================= */}
      {/* DIALOGS & SHEETS                                                  */}
      {/* ================================================================= */}

      {/* Member Detail Panel */}
      <MemberDetailPanel
        open={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        member={selectedMember}
        events={events || []}
        allMembers={teamMembers || []}
        isSuperAdmin={!!isSuperAdmin}
      />

      {/* Preview Access Modal (super_admin only) */}
      <PreviewModal open={!!previewMemberId} onClose={() => setPreviewMemberId(null)} memberId={previewMemberId} />

      {/* Invite Dialog */}
      <InviteDialog
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        onComplete={() => { queryClient.invalidateQueries({ queryKey: ["team-invitations"] }); queryClient.invalidateQueries({ queryKey: ["team-members"] }) }}
      />

      {/* Permission Guide Sheet */}
      <Sheet open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <ResizableSheetContent defaultWidth={672} minWidth={500} maxWidth={1000} storageKey="team-activity-sheet-width" className="overflow-y-auto p-0">
          <PermissionGuideContent />
        </ResizableSheetContent>
      </Sheet>

      {/* Audit Trail Export Dialog */}
      <Dialog open={isAuditExportOpen} onOpenChange={setIsAuditExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Audit Trail</DialogTitle>
            <DialogDescription>Download team activity logs as CSV. Apply filters to narrow results.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="audit-from">From</Label><Input id="audit-from" type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="audit-to">To</Label><Input id="audit-to" type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-action-type">Action Type</Label>
              <select id="audit-action-type" value={auditActionType} onChange={(e) => setAuditActionType(e.target.value)} className="w-full h-10 px-3 rounded-lg border bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/20">
                <option value="">All Actions</option>
                <option value="team_member.created">Member Created</option>
                <option value="team_member.updated">Member Updated</option>
                <option value="team_member.deleted">Member Deleted</option>
                <option value="team_member.role_changed">Role Changed</option>
                <option value="team_member.activated">Member Activated</option>
                <option value="team_member.deactivated">Member Deactivated</option>
                <option value="team_member.permissions_changed">Permissions Changed</option>
                <option value="team_member.invited">Member Invited</option>
                <option value="team_member.invite_accepted">Invite Accepted</option>
                <option value="team_member.invite_resent">Invite Resent</option>
                <option value="team_member.invite_revoked">Invite Revoked</option>
                <option value="invite.token_fail">Invite Token Fail</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-actor-email">Actor Email (optional)</Label>
              <Input id="audit-actor-email" type="email" placeholder="e.g. admin@example.com" value={auditActorEmail} onChange={(e) => setAuditActorEmail(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsAuditExportOpen(false)}>Cancel</Button>
            <Button onClick={handleExportAudit}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===========================================================================
// Sub-components
// ===========================================================================

function StatsCard({ label, value, delta, deltaType }: {
  label: string
  value: number | string
  delta?: string
  deltaType?: "positive" | "negative" | "neutral"
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-medium mt-1">{value}</p>
      {delta && (
        <p className={cn(
          "text-xs mt-1",
          deltaType === "positive" && "text-green-600",
          deltaType === "negative" && "text-red-600",
          deltaType === "neutral" && "text-muted-foreground",
        )}>
          {delta}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MemberTable
// ---------------------------------------------------------------------------

function MemberTable({ members, allMembers, events, selectedIds, toggleSelect, toggleSelectAll, isSuperAdmin, onSelectMember, onSendMagicLink, onToggleActive, onDelete, onPreview }: {
  members: TeamMember[]
  allMembers: TeamMember[]
  events?: Event[]
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
  toggleSelectAll: () => void
  isSuperAdmin?: boolean
  onSelectMember: (m: TeamMember) => void
  onSendMagicLink: (email: string) => void
  onToggleActive: (id: string, is_active: boolean) => void
  onDelete: (id: string, name: string) => void
  onPreview: (id: string) => void
}) {
  const avatarColors: Record<string, string> = {
    admin: "from-purple-500 to-pink-500",
    coordinator: "from-blue-500 to-indigo-500",
    travel: "from-cyan-500 to-blue-500",
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <TableHead className="w-[40px]">
              <input type="checkbox" checked={selectedIds.size === allMembers.length && allMembers.length > 0} onChange={toggleSelectAll} className="rounded" />
            </TableHead>
            <TableHead className="w-[280px]">Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead>Event Access</TableHead>
            <TableHead>Last Active</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const roleInfo = getRoleInfo(member.role)
            const RoleIcon = roleInfo.icon
            const memberPermsArr = Array.isArray(member.permissions) ? member.permissions : []
            const hasFullAccess = memberPermsArr.length === 0
            const hasAllEvents = !member.event_ids || member.event_ids.length === 0
            const status = getLoginStatus(member)
            const statusConfig = LOGIN_STATUS_CONFIG[status]
            const StatusIcon = statusConfig.icon

            return (
              <TableRow key={member.id} className={cn("cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50", !member.is_active && "opacity-60")} onClick={() => onSelectMember(member)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(member.id)} onChange={() => toggleSelect(member.id)} className="rounded" />
                </TableCell>
                {/* Member: Avatar + Name + Email */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={cn("text-xs font-semibold bg-gradient-to-br text-white", avatarColors[member.role] || avatarColors.coordinator)}>
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>
                </TableCell>
                {/* Role pill */}
                <TableCell>
                  <Badge className={cn("text-white text-xs bg-gradient-to-r", roleInfo.gradient)}>
                    <RoleIcon className="h-3 w-3 mr-1" />
                    {roleInfo.label.split(" ")[0]}
                  </Badge>
                </TableCell>
                {/* Permissions: first 3 badges + "+N more" */}
                <TableCell>
                  {hasFullAccess ? (
                    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 border-0">
                      <Sparkles className="h-3 w-3 mr-1" />Full Access
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-1">
                      {memberPermsArr.slice(0, 3).map(p => {
                        const perm = PERMISSIONS.find(x => x.value === p)
                        if (!perm) return null
                        return (
                          <TooltipProvider key={p}>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className={cn("h-6 w-6 rounded flex items-center justify-center border", perm.bgLight)}>
                                  <perm.icon className={cn("h-3 w-3", perm.color)} />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>{perm.label}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )
                      })}
                      {memberPermsArr.length > 3 && <span className="text-xs text-muted-foreground ml-1">+{memberPermsArr.length - 3} more</span>}
                    </div>
                  )}
                </TableCell>
                {/* Event Access */}
                <TableCell>
                  {hasAllEvents ? (
                    <span className="text-xs text-muted-foreground">All Events</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{member.event_ids?.length || 0} event{(member.event_ids?.length || 0) !== 1 ? "s" : ""}</span>
                  )}
                </TableCell>
                {/* Last Active */}
                <TableCell>
                  {status === "online" ? (
                    <span className="text-xs text-green-600 font-medium">Active now</span>
                  ) : member.last_active_at ? (
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })}</span>
                  ) : member.last_login_at ? (
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(member.last_login_at), { addSuffix: true })}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">Never</span>
                  )}
                </TableCell>
                {/* Status: dot + label */}
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs gap-1", statusConfig.bgColor, statusConfig.color)}>
                    {statusConfig.pulse ? (
                      <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" /></span>
                    ) : (
                      <StatusIcon className="h-3 w-3" />
                    )}
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                {/* Actions dropdown */}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelectMember(member) }}>
                        <Edit className="h-4 w-4 mr-2" />Edit
                      </DropdownMenuItem>
                      {isSuperAdmin && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPreview(member.id) }}>
                          <Eye className="h-4 w-4 mr-2" />Preview
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleActive(member.id, !member.is_active) }}>
                        {member.is_active ? <UserX className="h-4 w-4 mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                        {member.is_active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      {isSuperAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(member.id, member.name) }}>
                            <Trash2 className="h-4 w-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PermissionGuideContent
// ---------------------------------------------------------------------------

function PermissionGuideContent() {
  return (
    <>
      <div className="sticky top-0 z-10 bg-gradient-to-r from-[#185FA5] via-[#185FA5] to-[#14508c] text-white p-6">
        <SheetHeader><SheetTitle className="text-white flex items-center gap-3 text-xl">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center"><BookOpen className="h-5 w-5" /></div>
          Permission Guide
        </SheetTitle></SheetHeader>
        <p className="text-white/60 mt-2 text-sm">Understand what each role and permission grants access to</p>
      </div>
      <div className="p-6 space-y-8">
        {/* Roles Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center"><Shield className="h-4 w-4 text-purple-600" /></div>
            <h3 className="text-lg font-semibold">User Roles</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Roles determine the type of user and their general purpose in the system.</p>
          <div className="space-y-4">
            {ROLE_DETAILS.map((role) => {
              const RoleIcon = role.icon
              return (
                <div key={role.value} className={cn("rounded-xl border-2 overflow-hidden", role.borderColor)}>
                  <div className={cn("p-4", role.bgLight)}>
                    <div className="flex items-center gap-3">
                      <div className={cn("h-12 w-12 rounded-xl bg-gradient-to-br text-white flex items-center justify-center", role.gradient)}><RoleIcon className="h-6 w-6" /></div>
                      <div><h4 className="font-semibold text-lg">{role.label}</h4><p className="text-sm text-muted-foreground">{role.description}</p></div>
                    </div>
                  </div>
                  <div className="p-4 bg-white dark:bg-slate-900">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Capabilities</p>
                    <ul className="space-y-1.5">
                      {role.capabilities.map((cap, i) => <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /><span>{cap}</span></li>)}
                    </ul>
                    <div className="mt-3 pt-3 border-t"><p className="text-xs text-muted-foreground"><span className="font-medium">Recommended for:</span> {role.recommended}</p></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* How Access Works */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0"><Info className="h-4 w-4 text-amber-600" /></div>
            <div>
              <h4 className="font-semibold text-amber-900">How Access Works</h4>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                <li className="flex items-start gap-2"><ArrowRight className="h-4 w-4 mt-0.5 shrink-0" /><span><strong>Admins</strong> have full access to everything - no permissions needed</span></li>
                <li className="flex items-start gap-2"><ArrowRight className="h-4 w-4 mt-0.5 shrink-0" /><span><strong>Full Access toggle ON</strong> = User can access all modules</span></li>
                <li className="flex items-start gap-2"><ArrowRight className="h-4 w-4 mt-0.5 shrink-0" /><span><strong>Full Access toggle OFF</strong> = User can only access selected modules</span></li>
                <li className="flex items-start gap-2"><ArrowRight className="h-4 w-4 mt-0.5 shrink-0" /><span><strong>Event Access</strong> limits which events the user can see</span></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Permission Sections */}
        {[
          { title: "Travel & Logistics Modules", icon: Plane, iconBg: "bg-cyan-100", iconColor: "text-cyan-600", perms: TRAVEL_PERMISSIONS },
          { title: "Event Management Modules", icon: Calendar, iconBg: "bg-indigo-100", iconColor: "text-indigo-600", perms: EVENT_PERMISSIONS },
        ].map(section => (
          <div key={section.title}>
            <div className="flex items-center gap-2 mb-4">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", section.iconBg)}><section.icon className={cn("h-4 w-4", section.iconColor)} /></div>
              <h3 className="text-lg font-semibold">{section.title}</h3>
            </div>
            <div className="grid gap-3">
              {section.perms.map((perm) => (
                <div key={perm.value} className={cn("rounded-xl border overflow-hidden", perm.bgLight)}>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-white", perm.bg)}><perm.icon className="h-5 w-5" /></div>
                      <div><h4 className="font-semibold">{perm.label}</h4><p className="text-xs text-muted-foreground">{perm.description}</p></div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Access Includes</p>
                      <div className="grid grid-cols-2 gap-1">
                        {perm.access.map((item, i) => <div key={i} className="flex items-center gap-1.5 text-xs"><CheckCircle className="h-3 w-3 text-green-500 shrink-0" /><span>{item}</span></div>)}
                      </div>
                      <div className="mt-2 pt-2 border-t flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /><span className="font-mono">{perm.path}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Quick Reference Table */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center"><BarChart3 className="h-4 w-4 text-slate-600" /></div>
            <h3 className="text-lg font-semibold">Quick Reference</h3>
          </div>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800">
                  <TableHead className="font-semibold">Permission</TableHead>
                  <TableHead className="font-semibold">Module Path</TableHead>
                  <TableHead className="font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PERMISSIONS.map((perm) => {
                  const PermIcon = perm.icon
                  return (
                    <TableRow key={perm.value}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-7 w-7 rounded flex items-center justify-center", perm.bgLight)}><PermIcon className={cn("h-3.5 w-3.5", perm.color)} /></div>
                          <span className="font-medium">{perm.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{perm.path}</TableCell>
                      <TableCell className="text-center">{perm.access.length}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  )
}
