"use client"

import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { SkeletonTable, SkeletonCard, SkeletonStats } from "@/components/ui/skeleton"
import { logAudit, createChangeDiff } from "@/lib/audit-log"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Plus,
  Loader2,
  Mail,
  Plane,
  Shield,
  UserCog,
  Edit,
  Trash2,
  CheckCircle,
  Search,
  Phone,
  Send,
  Calendar,
  Building,
  FileText,
  Copy,
  Hotel,
  Car,
  Train,
  Key,
  UserPlus,
  UserCheck,
  UserX,
  Sparkles,
  Link2,
  X,
  Award,
  Clock,
  RefreshCw,
  MailPlus,
  PhoneCall,
  Globe,
  MoreHorizontal,
  ChevronRight,
  ChevronLeft,
  Zap,
  Activity,
  TrendingUp,
  ExternalLink,
  LayoutGrid,
  List,
  BookOpen,
  Info,
  ArrowRight,
  Eye,
  Settings,
  Download,
  Upload,
  BarChart3,
  Palette,
  FolderOpen,
  ClipboardList,
  MapPin,
  QrCode,
  LogOut,
  Wifi,
  WifiOff,
  CircleDot,
} from "lucide-react"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

// Get login-aware status for a team member
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

// Login status badge config
const LOGIN_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any; pulse?: boolean }> = {
  online: { label: "Online", color: "text-green-700", bgColor: "bg-green-100", icon: Wifi, pulse: true },
  away: { label: "Away", color: "text-amber-700", bgColor: "bg-amber-100", icon: Clock },
  logged_out: { label: "Logged out", color: "text-orange-700", bgColor: "bg-orange-100", icon: LogOut },
  offline: { label: "Offline", color: "text-slate-600", bgColor: "bg-slate-100", icon: WifiOff },
  pending: { label: "Pending", color: "text-blue-700", bgColor: "bg-blue-100", icon: CircleDot },
  deactivated: { label: "Deactivated", color: "text-red-700", bgColor: "bg-red-100", icon: UserX },
}

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
}

const TRAVEL_PERMISSIONS = [
  {
    value: "flights",
    label: "Flights",
    icon: Plane,
    color: "text-sky-500",
    bg: "bg-sky-500",
    bgLight: "bg-sky-50 border-sky-200",
    description: "Manage flight bookings for faculty",
    access: [
      "View all flight bookings",
      "Create new flight bookings",
      "Edit existing bookings",
      "Cancel/delete bookings",
      "Export flight data",
    ],
    path: "/travel-dashboard → Flights"
  },
  {
    value: "hotels",
    label: "Hotels",
    icon: Hotel,
    color: "text-amber-500",
    bg: "bg-amber-500",
    bgLight: "bg-amber-50 border-amber-200",
    description: "Manage hotel accommodations",
    access: [
      "View all hotel bookings",
      "Create new reservations",
      "Edit booking details",
      "Cancel reservations",
      "Export hotel data",
    ],
    path: "/travel-dashboard → Hotels"
  },
  {
    value: "transfers",
    label: "Transfers",
    icon: Car,
    color: "text-emerald-500",
    bg: "bg-emerald-500",
    bgLight: "bg-emerald-50 border-emerald-200",
    description: "Manage ground transportation",
    access: [
      "View all transfer requests",
      "Schedule pickups/drops",
      "Assign vehicles",
      "Track transfer status",
      "Export transfer data",
    ],
    path: "/travel-dashboard → Transfers"
  },
  {
    value: "trains",
    label: "Trains",
    icon: Train,
    color: "text-orange-500",
    bg: "bg-orange-500",
    bgLight: "bg-orange-50 border-orange-200",
    description: "Manage train reservations",
    access: [
      "View all train bookings",
      "Create new bookings",
      "Edit booking details",
      "Cancel bookings",
      "Export train data",
    ],
    path: "/travel-dashboard → Trains"
  },
]

const EVENT_PERMISSIONS = [
  {
    value: "speakers",
    label: "Speakers",
    icon: Users,
    color: "text-cyan-500",
    bg: "bg-cyan-500",
    bgLight: "bg-cyan-50 border-cyan-200",
    description: "Manage event speakers/faculty",
    access: [
      "View all speakers list",
      "Add new speakers",
      "Edit speaker profiles",
      "Remove speakers",
      "Send communications",
      "Export speaker data",
    ],
    path: "/events/[id]/speakers"
  },
  {
    value: "program",
    label: "Program",
    icon: Calendar,
    color: "text-indigo-500",
    bg: "bg-indigo-500",
    bgLight: "bg-indigo-50 border-indigo-200",
    description: "Manage event program/schedule",
    access: [
      "View full program schedule",
      "Create sessions",
      "Edit session details",
      "Assign speakers to sessions",
      "Manage session timings",
      "Send confirmations",
    ],
    path: "/events/[id]/program"
  },
  {
    value: "checkin",
    label: "Check-in",
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-500",
    bgLight: "bg-green-50 border-green-200",
    description: "Handle attendee check-ins",
    access: [
      "Access check-in scanner",
      "Manual check-in attendees",
      "View check-in statistics",
      "Search attendees",
      "Print badges on-site",
    ],
    path: "/events/[id]/checkin"
  },
  {
    value: "badges",
    label: "Badges",
    icon: Award,
    color: "text-pink-500",
    bg: "bg-pink-500",
    bgLight: "bg-pink-50 border-pink-200",
    description: "Design and print badges",
    access: [
      "Access badge designer",
      "Create badge templates",
      "Generate badges",
      "Print badges (bulk/individual)",
      "Export badge PDFs",
    ],
    path: "/events/[id]/badges"
  },
  {
    value: "certificates",
    label: "Certificates",
    icon: FileText,
    color: "text-violet-500",
    bg: "bg-violet-500",
    bgLight: "bg-violet-50 border-violet-200",
    description: "Design and send certificates",
    access: [
      "Access certificate designer",
      "Create certificate templates",
      "Generate certificates",
      "Send certificates via email",
      "Verify certificates",
    ],
    path: "/events/[id]/certificates"
  },
  {
    value: "registrations",
    label: "Registrations",
    icon: ClipboardList,
    color: "text-teal-500",
    bg: "bg-teal-500",
    bgLight: "bg-teal-50 border-teal-200",
    description: "Manage event registrations",
    access: [
      "View all registrations",
      "Add/edit registrations",
      "Import registrations (CSV)",
      "Export registration data",
      "Send communications",
      "View reports & analytics",
    ],
    path: "/events/[id]/registrations"
  },
  {
    value: "abstracts",
    label: "Abstracts",
    icon: BookOpen,
    color: "text-orange-500",
    bg: "bg-orange-500",
    bgLight: "bg-orange-50 border-orange-200",
    description: "Manage abstract submissions & reviews",
    access: [
      "View all abstract submissions",
      "Review & score abstracts",
      "Accept/reject abstracts",
      "Configure abstract settings",
      "Manage abstract categories",
      "Export abstract data",
    ],
    path: "/events/[id]/abstracts"
  },
]

const PERMISSIONS = [...TRAVEL_PERMISSIONS, ...EVENT_PERMISSIONS]

const ROLE_DETAILS = [
  {
    value: "admin",
    label: "Administrator",
    icon: Shield,
    gradient: "from-purple-500 to-pink-500",
    color: "bg-purple-500",
    textColor: "text-purple-600",
    bgLight: "bg-gradient-to-br from-purple-50 to-pink-50",
    borderColor: "border-purple-300",
    description: "Full system access with all privileges",
    capabilities: [
      "Access to ALL modules without restrictions",
      "Manage team members (add/edit/remove)",
      "Assign permissions to other users",
      "Access all events (past, present, future)",
      "View system-wide reports & analytics",
      "Configure system settings",
    ],
    recommended: "For organization owners and senior managers"
  },
  {
    value: "coordinator",
    label: "Event Coordinator",
    icon: UserCog,
    gradient: "from-blue-500 to-indigo-500",
    color: "bg-blue-500",
    textColor: "text-blue-600",
    bgLight: "bg-gradient-to-br from-blue-50 to-indigo-50",
    borderColor: "border-blue-300",
    description: "Manages events and attendees",
    capabilities: [
      "Access based on assigned permissions",
      "Can only see assigned events",
      "Cannot manage team members",
      "Cannot change system settings",
      "Limited to their module access",
    ],
    recommended: "For event managers and on-ground coordinators"
  },
  {
    value: "travel",
    label: "Travel Coordinator",
    icon: Plane,
    gradient: "from-cyan-500 to-blue-500",
    color: "bg-cyan-500",
    textColor: "text-cyan-600",
    bgLight: "bg-gradient-to-br from-cyan-50 to-blue-50",
    borderColor: "border-cyan-300",
    description: "Manages travel and logistics",
    capabilities: [
      "Access based on assigned permissions",
      "Focused on travel-related modules",
      "Can only see assigned events",
      "Cannot manage team members",
      "Cannot change system settings",
    ],
    recommended: "For travel desk and logistics staff"
  },
]

type Event = {
  id: string
  name: string
  short_name: string
  start_date: string
}

const ROLES = ROLE_DETAILS.map(r => ({
  value: r.value,
  label: r.label,
  icon: r.icon,
  gradient: r.gradient,
  color: r.color,
  textColor: r.textColor,
  bgLight: r.bgLight,
  borderColor: r.borderColor,
  description: r.description,
}))

export default function TeamPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"grid" | "table">("table")
  const [currentPage, setCurrentPage] = useState(1)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const itemsPerPage = 10
  const allPermissionValues = PERMISSIONS.map(p => p.value)

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    phone: "",
    role: "travel",
    notes: "",
    event_ids: [] as string[],
    all_events: true,
    permissions: allPermissionValues,
    all_permissions: true,
  })

  const { data: teamMembers, isLoading, refetch } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("team_members")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      const members = data as TeamMember[]

      // Fetch login activity from users table by matching emails
      const emails = members.map(m => m.email.toLowerCase())
      if (emails.length > 0) {
        const { data: users } = await (supabase as any)
          .from("users")
          .select("email, last_login_at, last_active_at, logged_out_at, login_count")
          .in("email", emails)
        if (users) {
          const userMap = new Map<string, any>(users.map((u: any) => [u.email?.toLowerCase(), u]))
          for (const member of members) {
            const user = userMap.get(member.email.toLowerCase())
            if (user) {
              member.last_login_at = user.last_login_at
              member.last_active_at = user.last_active_at
              member.logged_out_at = user.logged_out_at
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
      const { data } = await (supabase as any)
        .from("events")
        .select("id, name, short_name, start_date")
        .order("start_date", { ascending: false })
      return (data || []) as Event[]
    },
  })

  const addMember = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await (supabase as any)
        .from("team_members")
        .insert({
          email: data.email.toLowerCase(),
          name: data.name,
          phone: data.phone || null,
          role: data.role,
          notes: data.notes || null,
          event_ids: data.all_events ? [] : data.event_ids,
          permissions: data.all_permissions ? [] : data.permissions,
          is_active: true,
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] })
      toast.success("Team member added successfully!")
      setIsAddOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.message?.includes("duplicate") ? "This email already exists" : error.message || "Failed to add")
    },
  })

  const updateMember = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      const { error } = await (supabase as any)
        .from("team_members")
        .update(data.updates)
        .eq("id", data.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] })
      toast.success("Updated successfully!")
      setIsEditing(false)
      setSelectedMember(null)
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update")
    },
  })

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("team_members")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] })
      toast.success("Member removed")
      setSelectedMember(null)
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("team_members")
        .update({ is_active })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] })
      toast.success(v.is_active ? "Member activated" : "Member deactivated")
    },
  })

  const sendMagicLink = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/team-portal` },
      })
      if (error) throw error
    },
    onSuccess: () => toast.success("Login link sent!"),
    onError: (error: any) => toast.error(error.message || "Failed to send"),
  })

  const resetForm = () => {
    setFormData({
      email: "", name: "", phone: "", role: "travel", notes: "",
      event_ids: [], all_events: true, permissions: allPermissionValues, all_permissions: true,
    })
  }

  const getRoleInfo = (role: string) => ROLES.find(r => r.value === role) || ROLES[0]
  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  const copyToClipboard = (text: string, msg: string) => { navigator.clipboard.writeText(text); toast.success(msg) }

  const filteredMembers = useMemo(() => {
    return (teamMembers || []).filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" && m.is_active) || (statusFilter === "inactive" && !m.is_active)
      return matchesSearch && matchesStatus
    })
  }, [teamMembers, searchQuery, statusFilter])

  // Pagination
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage)
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredMembers.slice(start, start + itemsPerPage)
  }, [filteredMembers, currentPage])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

  const totalMembers = teamMembers?.length || 0
  const activeMembers = teamMembers?.filter(m => m.is_active).length || 0

  const startEdit = (member: TeamMember) => {
    setFormData({
      email: member.email, name: member.name, phone: member.phone || "", role: member.role,
      notes: member.notes || "", event_ids: member.event_ids || [],
      all_events: !member.event_ids || member.event_ids.length === 0,
      permissions: member.permissions || [],
      all_permissions: !member.permissions || member.permissions.length === 0,
    })
    setIsEditing(true)
  }

  // Update selected member when teamMembers changes
  useEffect(() => {
    if (selectedMember && teamMembers) {
      const updated = teamMembers.find(m => m.id === selectedMember.id)
      if (updated) setSelectedMember(updated)
    }
  }, [teamMembers])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                <Users className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Team Management</h1>
                <p className="text-slate-400 text-xs sm:text-sm mt-0.5">Manage access, permissions and team members</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => refetch()} className="text-slate-400 hover:text-white hover:bg-white/10">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button onClick={() => setIsGuideOpen(true)} size="sm" className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
                <BookOpen className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Permission Guide</span>
              </Button>
              <Button onClick={() => copyToClipboard(`${window.location.origin}/team-login`, "Portal link copied!")} size="sm" className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
                <Link2 className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Portal Link</span>
              </Button>
              <Button onClick={() => { resetForm(); setIsAddOpen(true) }} size="sm" className="bg-white text-slate-900 hover:bg-slate-100 shadow-lg">
                <UserPlus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Add Member</span>
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 sm:mt-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalMembers}</p>
                  <p className="text-xs text-slate-400">Total Members</p>
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeMembers}</p>
                  <p className="text-xs text-slate-400">Active</p>
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <UserX className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalMembers - activeMembers}</p>
                  <p className="text-xs text-slate-400">Inactive</p>
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{teamMembers?.filter(m => m.role === "admin").length || 0}</p>
                  <p className="text-xs text-slate-400">Admins</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="bg-white shadow-sm border w-full sm:w-auto">
                <TabsTrigger value="all" className="flex-1 sm:flex-none data-[state=active]:bg-slate-900 data-[state=active]:text-white text-xs sm:text-sm">
                  All
                </TabsTrigger>
                <TabsTrigger value="active" className="flex-1 sm:flex-none data-[state=active]:bg-green-600 data-[state=active]:text-white text-xs sm:text-sm">
                  <span className="h-2 w-2 rounded-full bg-green-500 mr-1 sm:mr-2" />Active
                </TabsTrigger>
                <TabsTrigger value="inactive" className="flex-1 sm:flex-none data-[state=active]:bg-slate-600 data-[state=active]:text-white text-xs sm:text-sm">
                  <span className="h-2 w-2 rounded-full bg-slate-400 mr-1 sm:mr-2" />Inactive
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {filteredMembers.length} {filteredMembers.length === 1 ? "member" : "members"}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1 sm:w-72 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-white shadow-sm" />
            </div>
            <div className="flex bg-white border rounded-lg shadow-sm p-1">
              <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("table")} className="h-8 px-2 sm:px-3 hidden sm:flex">
                <List className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")} className="h-8 px-2 sm:px-3">
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Team List/Grid */}
        {isLoading ? (
          viewMode === "table" ? (
            <SkeletonTable rows={5} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Users className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{searchQuery ? "No matching members" : "No team members yet"}</h3>
            <p className="text-muted-foreground mb-6">{searchQuery ? "Try a different search term" : "Add your first team member to get started"}</p>
            {!searchQuery && (
              <Button onClick={() => setIsAddOpen(true)} size="lg">
                <UserPlus className="h-5 w-5 mr-2" />Add First Member
              </Button>
            )}
          </div>
        ) : viewMode === "table" ? (
          /* Table View */
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-[300px]">Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Logins</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedMembers.map((member) => {
                  const roleInfo = getRoleInfo(member.role)
                  const RoleIcon = roleInfo.icon
                  const hasFullAccess = !member.permissions || member.permissions.length === 0

                  return (
                    <TableRow key={member.id} className={cn("cursor-pointer hover:bg-slate-50", !member.is_active && "opacity-60")} onClick={() => setSelectedMember(member)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className={cn("text-sm font-semibold bg-gradient-to-br text-white", roleInfo.gradient)}>
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white", member.is_active ? "bg-green-500" : "bg-slate-400")} />
                          </div>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={cn("text-white text-xs bg-gradient-to-r", roleInfo.gradient)}>
                            <RoleIcon className="h-3 w-3 mr-1" />
                            {roleInfo.label.split(" ")[0]}
                          </Badge>
                          {/* Show event names for event-scoped users */}
                          {member.event_ids && member.event_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {member.event_ids.slice(0, 2).map(eventId => {
                                const event = events?.find(e => e.id === eventId)
                                return event ? (
                                  <Badge key={eventId} variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                    <Calendar className="h-2.5 w-2.5 mr-1" />
                                    {event.short_name || event.name.slice(0, 15)}
                                  </Badge>
                                ) : null
                              })}
                              {member.event_ids.length > 2 && (
                                <Badge variant="outline" className="text-[10px]">
                                  +{member.event_ids.length - 2} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasFullAccess ? (
                          <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 border-0">
                            <Sparkles className="h-3 w-3 mr-1" />Full Access
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1">
                            {member.permissions?.slice(0, 4).map(p => {
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
                            {(member.permissions?.length || 0) > 4 && (
                              <span className="text-xs text-muted-foreground ml-1">+{(member.permissions?.length || 0) - 4}</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const status = getLoginStatus(member)
                          const config = LOGIN_STATUS_CONFIG[status]
                          const StatusIcon = config.icon
                          return (
                            <Badge variant="secondary" className={cn("text-xs gap-1", config.bgColor, config.color)}>
                              {config.pulse ? (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                </span>
                              ) : (
                                <StatusIcon className="h-3 w-3" />
                              )}
                              {config.label}
                            </Badge>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const status = getLoginStatus(member)
                          if (status === "online") {
                            return (
                              <span className="text-sm text-green-600 font-medium">Active now</span>
                            )
                          }
                          if (status === "logged_out" && member.logged_out_at) {
                            return (
                              <span className="text-sm text-muted-foreground">
                                Logged out {formatDistanceToNow(new Date(member.logged_out_at), { addSuffix: true })}
                              </span>
                            )
                          }
                          if (member.last_active_at) {
                            return (
                              <span className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })}
                              </span>
                            )
                          }
                          if (member.last_login_at) {
                            return (
                              <span className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(member.last_login_at), { addSuffix: true })}
                              </span>
                            )
                          }
                          return <span className="text-sm text-muted-foreground/50">Never</span>
                        })()}
                      </TableCell>
                      <TableCell>
                        {(member.login_count ?? 0) > 0 ? (
                          <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700">
                            {member.login_count}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedMember(member) }}>
                              <Edit className="h-4 w-4 mr-2" />View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); sendMagicLink.mutate(member.email) }} disabled={!member.is_active}>
                              <MailPlus className="h-4 w-4 mr-2" />Send Login Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); copyToClipboard(member.email, "Email copied!") }}>
                              <Copy className="h-4 w-4 mr-2" />Copy Email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleActive.mutate({ id: member.id, is_active: !member.is_active }) }}>
                              {member.is_active ? <UserX className="h-4 w-4 mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                              {member.is_active ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); if(confirm(`Remove ${member.name}?`)) deleteMember.mutate(member.id) }}>
                              <Trash2 className="h-4 w-4 mr-2" />Remove
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
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedMembers.map((member) => {
              const roleInfo = getRoleInfo(member.role)
              const RoleIcon = roleInfo.icon
              const hasFullAccess = !member.permissions || member.permissions.length === 0

              return (
                <Card key={member.id} className={cn(
                  "group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer border-0 shadow-md",
                  !member.is_active && "opacity-70"
                )} onClick={() => setSelectedMember(member)}>
                  {/* Role gradient bar */}
                  <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", roleInfo.gradient)} />

                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <Avatar className={cn("h-14 w-14 ring-2 ring-offset-2", roleInfo.borderColor)}>
                          <AvatarFallback className={cn("text-lg font-bold bg-gradient-to-br", roleInfo.gradient, "text-white")}>
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn(
                          "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white",
                          getLoginStatus(member) === "online" ? "bg-green-500" :
                          getLoginStatus(member) === "away" ? "bg-amber-500" :
                          getLoginStatus(member) === "logged_out" ? "bg-orange-400" :
                          getLoginStatus(member) === "pending" ? "bg-blue-400" :
                          getLoginStatus(member) === "deactivated" ? "bg-red-400" :
                          "bg-slate-400"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">{member.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge className={cn("text-white text-xs bg-gradient-to-r", roleInfo.gradient)}>
                            <RoleIcon className="h-3 w-3 mr-1" />
                            {roleInfo.label.split(" ")[0]}
                          </Badge>
                          {hasFullAccess && (
                            <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 border-0">
                              <Sparkles className="h-3 w-3 mr-1" />Full Access
                            </Badge>
                          )}
                          {/* Show event names for event-scoped users */}
                          {member.event_ids && member.event_ids.length > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                              <Calendar className="h-2.5 w-2.5 mr-1" />
                              {member.event_ids.length} event{member.event_ids.length > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setSelectedMember(member) }}>
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>

                    {/* Quick stats */}
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                      {(() => {
                        const status = getLoginStatus(member)
                        const config = LOGIN_STATUS_CONFIG[status]
                        const StatusIcon = config.icon
                        return (
                          <div className="flex items-center gap-1.5 text-sm">
                            {config.pulse ? (
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                              </span>
                            ) : (
                              <StatusIcon className={cn("h-3.5 w-3.5", config.color)} />
                            )}
                            <span className={config.color}>
                              {status === "online" ? "Online now" :
                               status === "logged_out" && member.logged_out_at ? `Logged out ${formatDistanceToNow(new Date(member.logged_out_at), { addSuffix: true })}` :
                               status === "pending" ? "Never logged in" :
                               member.last_active_at ? formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true }) :
                               member.last_login_at ? formatDistanceToNow(new Date(member.last_login_at), { addSuffix: true }) :
                               config.label}
                            </span>
                          </div>
                        )
                      })()}
                      {(member.login_count ?? 0) > 0 && (
                        <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 ml-auto">
                          {member.login_count} login{member.login_count !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>

                    {/* Permissions preview */}
                    {!hasFullAccess && member.permissions && member.permissions.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-3">
                        {member.permissions.slice(0, 5).map(p => {
                          const perm = PERMISSIONS.find(x => x.value === p)
                          if (!perm) return null
                          return (
                            <TooltipProvider key={p}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center border", perm.bgLight)}>
                                    <perm.icon className={cn("h-3.5 w-3.5", perm.color)} />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{perm.label}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )
                        })}
                        {member.permissions.length > 5 && (
                          <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-slate-100 text-xs font-medium text-slate-600">
                            +{member.permissions.length - 5}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
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
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
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

      {/* Detail Sheet */}
      <Sheet open={!!selectedMember && !isEditing} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <ResizableSheetContent defaultWidth={512} minWidth={400} maxWidth={800} storageKey="team-member-sheet-width" className="p-0 overflow-y-auto">
          {selectedMember && (() => {
            const roleInfo = getRoleInfo(selectedMember.role)
            const RoleIcon = roleInfo.icon
            const hasFullAccess = !selectedMember.permissions || selectedMember.permissions.length === 0
            const hasAllEvents = !selectedMember.event_ids || selectedMember.event_ids.length === 0

            return (
              <>
                {/* Header */}
                <div className={cn("p-6 bg-gradient-to-br", roleInfo.bgLight)}>
                  <SheetHeader className="mb-0">
                    <SheetTitle className="sr-only">{selectedMember.name} - Team Member Details</SheetTitle>
                  </SheetHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className={cn("h-16 w-16 ring-4 ring-white shadow-lg")}>
                        <AvatarFallback className={cn("text-xl font-bold bg-gradient-to-br text-white", roleInfo.gradient)}>
                          {getInitials(selectedMember.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="text-xl font-bold">{selectedMember.name}</h2>
                        <Badge className={cn("text-white mt-1 bg-gradient-to-r", roleInfo.gradient)}>
                          <RoleIcon className="h-3 w-3 mr-1" />{roleInfo.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(selectedMember)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { if(confirm(`Remove ${selectedMember.name}?`)) deleteMember.mutate(selectedMember.id) }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:bg-primary hover:text-white transition-colors" onClick={() => sendMagicLink.mutate(selectedMember.email)} disabled={!selectedMember.is_active || sendMagicLink.isPending}>
                      {sendMagicLink.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <MailPlus className="h-5 w-5" />}
                      <span className="text-xs font-medium">Send Login Link</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:bg-slate-900 hover:text-white transition-colors" onClick={() => copyToClipboard(selectedMember.email, "Email copied!")}>
                      <Copy className="h-5 w-5" />
                      <span className="text-xs font-medium">Copy Email</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:bg-green-600 hover:text-white transition-colors" onClick={() => window.open(`mailto:${selectedMember.email}`)}>
                      <Mail className="h-5 w-5" />
                      <span className="text-xs font-medium">Send Email</span>
                    </Button>
                    {selectedMember.phone ? (
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:bg-blue-600 hover:text-white transition-colors" onClick={() => window.open(`tel:${selectedMember.phone}`)}>
                        <PhoneCall className="h-5 w-5" />
                        <span className="text-xs font-medium">Call Now</span>
                      </Button>
                    ) : (
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2" disabled>
                        <Phone className="h-5 w-5" />
                        <span className="text-xs font-medium">No Phone</span>
                      </Button>
                    )}
                  </div>

                  {/* Contact */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact Information</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 group">
                        <div className="h-10 w-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                          <Mail className="h-4 w-4 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{selectedMember.email}</p>
                          <p className="text-xs text-muted-foreground">Email Address</p>
                        </div>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8" onClick={() => copyToClipboard(selectedMember.email, "Copied!")}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {selectedMember.phone && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 group">
                          <div className="h-10 w-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                            <Phone className="h-4 w-4 text-slate-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{selectedMember.phone}</p>
                            <p className="text-xs text-muted-foreground">Phone Number</p>
                          </div>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8" onClick={() => copyToClipboard(selectedMember.phone!, "Copied!")}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Account Status</h4>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", selectedMember.is_active ? "bg-green-100" : "bg-slate-200")}>
                          {selectedMember.is_active ? <UserCheck className="h-5 w-5 text-green-600" /> : <UserX className="h-5 w-5 text-slate-500" />}
                        </div>
                        <div>
                          <p className="font-medium">{selectedMember.is_active ? "Active" : "Inactive"}</p>
                          <p className="text-xs text-muted-foreground">{selectedMember.is_active ? "Can access the portal" : "Portal access disabled"}</p>
                        </div>
                      </div>
                      <Switch checked={selectedMember.is_active} onCheckedChange={(checked) => toggleActive.mutate({ id: selectedMember.id, is_active: checked })} />
                    </div>
                    {/* Login Status */}
                    {(() => {
                      const status = getLoginStatus(selectedMember)
                      const config = LOGIN_STATUS_CONFIG[status]
                      const StatusIcon = config.icon
                      return (
                        <div className={cn("flex items-center gap-3 p-3 rounded-xl mt-2", config.bgColor)}>
                          {config.pulse ? (
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                            </span>
                          ) : (
                            <StatusIcon className={cn("h-4 w-4", config.color)} />
                          )}
                          <span className={cn("text-sm font-medium", config.color)}>
                            {config.label}
                            {status === "logged_out" && selectedMember.logged_out_at && (
                              <span className="font-normal"> {formatDistanceToNow(new Date(selectedMember.logged_out_at), { addSuffix: true })}</span>
                            )}
                          </span>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Permissions */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Module Access</h4>
                    {hasFullAccess ? (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                            <Sparkles className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-emerald-800">Full Access Granted</p>
                            <p className="text-sm text-emerald-600">Can access all modules and features</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {selectedMember.permissions?.map(p => {
                          const perm = PERMISSIONS.find(x => x.value === p)
                          if (!perm) return null
                          return (
                            <div key={p} className={cn("p-3 rounded-xl border text-center", perm.bgLight)}>
                              <perm.icon className={cn("h-5 w-5 mx-auto mb-1", perm.color)} />
                              <p className="text-xs font-medium">{perm.label}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Event Access */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Event Access</h4>
                    {hasAllEvents ? (
                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
                            <Globe className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-blue-800">All Events</p>
                            <p className="text-sm text-blue-600">Has access to all events</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {events?.filter(e => selectedMember.event_ids?.includes(e.id)).map(event => (
                          <div key={event.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{event.short_name || event.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {selectedMember.notes && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Notes</h4>
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <p className="text-sm text-amber-900 whitespace-pre-wrap">{selectedMember.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Login Activity */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Login Activity</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50">
                        <div className="flex items-center gap-2 mb-1">
                          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Last Login</p>
                        </div>
                        <p className="text-sm font-medium">
                          {selectedMember.last_login_at
                            ? formatDistanceToNow(new Date(selectedMember.last_login_at), { addSuffix: true })
                            : "Never"}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50">
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Last Active</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedMember.last_active_at && (new Date().getTime() - new Date(selectedMember.last_active_at).getTime()) < 15 * 60 * 1000 && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                          )}
                          <p className="text-sm font-medium">
                            {selectedMember.last_active_at
                              ? formatDistanceToNow(new Date(selectedMember.last_active_at), { addSuffix: true })
                              : "Never"}
                          </p>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50">
                        <div className="flex items-center gap-2 mb-1">
                          <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Last Logout</p>
                        </div>
                        <p className="text-sm font-medium">
                          {selectedMember.logged_out_at
                            ? formatDistanceToNow(new Date(selectedMember.logged_out_at), { addSuffix: true })
                            : "Never"}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Total Logins</p>
                        </div>
                        <p className="text-sm font-medium">{selectedMember.login_count ?? 0}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Member Since</p>
                        </div>
                        <p className="text-sm font-medium">{format(new Date(selectedMember.created_at), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="font-mono text-xs">{selectedMember.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </div>
              </>
            )
          })()}
        </ResizableSheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet open={isEditing} onOpenChange={(open) => { if(!open) { setIsEditing(false) } }}>
        <ResizableSheetContent defaultWidth={512} minWidth={400} maxWidth={800} storageKey="team-edit-sheet-width" className="overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />Edit Team Member
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="+91 98765 43210" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <div className="space-y-2">
                {ROLES.map((role) => {
                  const isSelected = formData.role === role.value
                  return (
                    <label key={role.value} className={cn("flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all", isSelected ? `${role.bgLight} ${role.borderColor}` : "border-slate-200 hover:border-slate-300")}>
                      <input type="radio" name="role" checked={isSelected} onChange={() => setFormData({ ...formData, role: role.value })} className="sr-only" />
                      <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br text-white flex items-center justify-center", role.gradient)}>
                        <role.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{role.label}</p>
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      </div>
                      {isSelected && <CheckCircle className={cn("h-5 w-5", role.textColor)} />}
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Event Access</Label>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Access to all events</span>
                </div>
                <Switch checked={formData.all_events} onCheckedChange={(checked) => setFormData({ ...formData, all_events: checked })} />
              </div>
              {!formData.all_events && events && (
                <div className="space-y-2 max-h-32 overflow-y-auto p-1">
                  {events.map((event) => (
                    <label key={event.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={formData.event_ids.includes(event.id)} onChange={(e) => {
                        setFormData({ ...formData, event_ids: e.target.checked ? [...formData.event_ids, event.id] : formData.event_ids.filter(id => id !== event.id) })
                      }} className="rounded" />
                      <span className="text-sm">{event.short_name || event.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label>Module Permissions</Label>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Full access to all modules</span>
                </div>
                <Switch checked={formData.all_permissions} onCheckedChange={(checked) => setFormData({ ...formData, all_permissions: checked, permissions: checked ? [] : allPermissionValues })} />
              </div>
              {!formData.all_permissions && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Travel & Logistics</p>
                    <div className="flex flex-wrap gap-2">
                      {TRAVEL_PERMISSIONS.map((perm) => {
                        const isSelected = formData.permissions.includes(perm.value)
                        return (
                          <label key={perm.value} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all", isSelected ? `${perm.bgLight}` : "border-slate-200 hover:border-slate-300")}>
                            <input type="checkbox" checked={isSelected} onChange={(e) => setFormData({ ...formData, permissions: e.target.checked ? [...formData.permissions, perm.value] : formData.permissions.filter(p => p !== perm.value) })} className="sr-only" />
                            <perm.icon className={cn("h-4 w-4", perm.color)} />
                            <span className="text-sm">{perm.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Event Management</p>
                    <div className="flex flex-wrap gap-2">
                      {EVENT_PERMISSIONS.map((perm) => {
                        const isSelected = formData.permissions.includes(perm.value)
                        return (
                          <label key={perm.value} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all", isSelected ? `${perm.bgLight}` : "border-slate-200 hover:border-slate-300")}>
                            <input type="checkbox" checked={isSelected} onChange={(e) => setFormData({ ...formData, permissions: e.target.checked ? [...formData.permissions, perm.value] : formData.permissions.filter(p => p !== perm.value) })} className="sr-only" />
                            <perm.icon className={cn("h-4 w-4", perm.color)} />
                            <span className="text-sm">{perm.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => {
                if (selectedMember) {
                  updateMember.mutate({
                    id: selectedMember.id,
                    updates: {
                      name: formData.name, phone: formData.phone || null, role: formData.role, notes: formData.notes || null,
                      event_ids: formData.all_events ? [] : formData.event_ids,
                      permissions: formData.all_permissions ? [] : formData.permissions,
                    },
                  })
                }
              }} disabled={updateMember.isPending}>
                {updateMember.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>
        </ResizableSheetContent>
      </Sheet>

      {/* Add Member Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              Add Team Member
            </DialogTitle>
            <DialogDescription>Add a new member and configure their permissions</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input placeholder="John Doe" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="+91 98765 43210" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input type="email" placeholder="john@company.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              <p className="text-xs text-muted-foreground">A magic link will be sent to this email for login</p>
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <div className="space-y-2">
                {ROLES.map((role) => {
                  const isSelected = formData.role === role.value
                  return (
                    <label key={role.value} className={cn("flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all", isSelected ? `${role.bgLight} ${role.borderColor}` : "border-slate-200 hover:border-slate-300")}>
                      <input type="radio" name="add-role" checked={isSelected} onChange={() => setFormData({ ...formData, role: role.value })} className="sr-only" />
                      <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br text-white flex items-center justify-center", role.gradient)}>
                        <role.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{role.label}</p>
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      </div>
                      {isSelected && <CheckCircle className={cn("h-5 w-5", role.textColor)} />}
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Event Access</Label>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Access to all events</span>
                </div>
                <Switch checked={formData.all_events} onCheckedChange={(checked) => setFormData({ ...formData, all_events: checked })} />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Module Permissions</Label>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Full access to all modules</span>
                </div>
                <Switch checked={formData.all_permissions} onCheckedChange={(checked) => setFormData({ ...formData, all_permissions: checked, permissions: checked ? [] : allPermissionValues })} />
              </div>
              {!formData.all_permissions && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Travel & Logistics</p>
                    <div className="flex flex-wrap gap-2">
                      {TRAVEL_PERMISSIONS.map((perm) => {
                        const isSelected = formData.permissions.includes(perm.value)
                        return (
                          <label key={perm.value} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all", isSelected ? `${perm.bgLight}` : "border-slate-200 hover:border-slate-300")}>
                            <input type="checkbox" checked={isSelected} onChange={(e) => setFormData({ ...formData, permissions: e.target.checked ? [...formData.permissions, perm.value] : formData.permissions.filter(p => p !== perm.value) })} className="sr-only" />
                            <perm.icon className={cn("h-4 w-4", perm.color)} />
                            <span className="text-sm">{perm.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Event Management</p>
                    <div className="flex flex-wrap gap-2">
                      {EVENT_PERMISSIONS.map((perm) => {
                        const isSelected = formData.permissions.includes(perm.value)
                        return (
                          <label key={perm.value} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all", isSelected ? `${perm.bgLight}` : "border-slate-200 hover:border-slate-300")}>
                            <input type="checkbox" checked={isSelected} onChange={(e) => setFormData({ ...formData, permissions: e.target.checked ? [...formData.permissions, perm.value] : formData.permissions.filter(p => p !== perm.value) })} className="sr-only" />
                            <perm.icon className={cn("h-4 w-4", perm.color)} />
                            <span className="text-sm">{perm.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Any additional information..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => addMember.mutate(formData)} disabled={!formData.name || !formData.email || addMember.isPending}>
              {addMember.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Add Member
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permission Guide Sheet */}
      <Sheet open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <ResizableSheetContent defaultWidth={672} minWidth={500} maxWidth={1000} storageKey="team-activity-sheet-width" className="overflow-y-auto p-0">
          <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6">
            <SheetHeader>
              <SheetTitle className="text-white flex items-center gap-3 text-xl">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5" />
                </div>
                Permission Guide
              </SheetTitle>
            </SheetHeader>
            <p className="text-slate-400 mt-2 text-sm">
              Understand what each role and permission grants access to
            </p>
          </div>

          <div className="p-6 space-y-8">
            {/* Roles Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold">User Roles</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Roles determine the type of user and their general purpose in the system.
              </p>
              <div className="space-y-4">
                {ROLE_DETAILS.map((role) => {
                  const RoleIcon = role.icon
                  return (
                    <div key={role.value} className={cn("rounded-xl border-2 overflow-hidden", role.borderColor)}>
                      <div className={cn("p-4", role.bgLight)}>
                        <div className="flex items-center gap-3">
                          <div className={cn("h-12 w-12 rounded-xl bg-gradient-to-br text-white flex items-center justify-center", role.gradient)}>
                            <RoleIcon className="h-6 w-6" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-lg">{role.label}</h4>
                            <p className="text-sm text-muted-foreground">{role.description}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-white">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Capabilities</p>
                        <ul className="space-y-1.5">
                          {role.capabilities.map((cap, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                              <span>{cap}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Recommended for:</span> {role.recommended}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Understanding Access Section */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <Info className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-amber-900">How Access Works</h4>
                  <ul className="mt-2 space-y-1 text-sm text-amber-800">
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" />
                      <span><strong>Admins</strong> have full access to everything - no permissions needed</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" />
                      <span><strong>Full Access toggle ON</strong> = User can access all modules</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" />
                      <span><strong>Full Access toggle OFF</strong> = User can only access selected modules</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" />
                      <span><strong>Event Access</strong> limits which events the user can see</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Travel Permissions Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                  <Plane className="h-4 w-4 text-cyan-600" />
                </div>
                <h3 className="text-lg font-semibold">Travel & Logistics Modules</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Permissions for managing travel arrangements and logistics.
              </p>
              <div className="grid gap-3">
                {TRAVEL_PERMISSIONS.map((perm) => {
                  const PermIcon = perm.icon
                  return (
                    <div key={perm.value} className={cn("rounded-xl border overflow-hidden", perm.bgLight)}>
                      <div className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-white", perm.bg)}>
                            <PermIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold">{perm.label}</h4>
                            <p className="text-xs text-muted-foreground">{perm.description}</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Access Includes</p>
                          <div className="grid grid-cols-2 gap-1">
                            {perm.access.map((item, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs">
                                <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 pt-2 border-t flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="font-mono">{perm.path}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Event Permissions Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold">Event Management Modules</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Permissions for managing event-related features.
              </p>
              <div className="grid gap-3">
                {EVENT_PERMISSIONS.map((perm) => {
                  const PermIcon = perm.icon
                  return (
                    <div key={perm.value} className={cn("rounded-xl border overflow-hidden", perm.bgLight)}>
                      <div className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-white", perm.bg)}>
                            <PermIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold">{perm.label}</h4>
                            <p className="text-xs text-muted-foreground">{perm.description}</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Access Includes</p>
                          <div className="grid grid-cols-2 gap-1">
                            {perm.access.map((item, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs">
                                <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 pt-2 border-t flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="font-mono">{perm.path}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Reference Table */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-slate-600" />
                </div>
                <h3 className="text-lg font-semibold">Quick Reference</h3>
              </div>
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
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
                              <div className={cn("h-7 w-7 rounded flex items-center justify-center", perm.bgLight)}>
                                <PermIcon className={cn("h-3.5 w-3.5", perm.color)} />
                              </div>
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
        </ResizableSheetContent>
      </Sheet>
    </div>
  )
}
