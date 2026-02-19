"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useTheme } from "next-themes"
import {
  GraduationCap,
  Mail,
  MoreHorizontal,
  Search,
  Filter,
  ChevronRight,
  Edit,
  Trash2,
  Eye,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  UserPlus,
  ArrowUpRight,
  Copy,
  Calendar,
  Loader2,
  Building2,
  Phone,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ============================================
// STATUS BADGE
// ============================================
function StatusBadge({ status, isDark }: { status: string; isDark: boolean }) {
  const config: Record<string, { bg: string; text: string; icon: typeof CheckCircle; label: string }> = {
    confirmed: {
      bg: isDark ? "bg-emerald-500/20" : "bg-emerald-100",
      text: isDark ? "text-emerald-400" : "text-emerald-700",
      icon: CheckCircle,
      label: "Confirmed",
    },
    active: {
      bg: isDark ? "bg-emerald-500/20" : "bg-emerald-100",
      text: isDark ? "text-emerald-400" : "text-emerald-700",
      icon: CheckCircle,
      label: "Active",
    },
    pending: {
      bg: isDark ? "bg-amber-500/20" : "bg-amber-100",
      text: isDark ? "text-amber-400" : "text-amber-700",
      icon: Clock,
      label: "Pending",
    },
    declined: {
      bg: isDark ? "bg-rose-500/20" : "bg-rose-100",
      text: isDark ? "text-rose-400" : "text-rose-700",
      icon: XCircle,
      label: "Declined",
    },
    inactive: {
      bg: isDark ? "bg-slate-500/20" : "bg-gray-100",
      text: isDark ? "text-slate-400" : "text-gray-600",
      icon: XCircle,
      label: "Inactive",
    },
  }

  const statusConfig = config[status] || config.pending
  const Icon = statusConfig.icon

  return (
    <span
      className={`
      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
      ${statusConfig.bg} ${statusConfig.text}
      transition-all duration-300
    `}
    >
      <Icon className="w-3.5 h-3.5" />
      {statusConfig.label}
    </span>
  )
}

// ============================================
// ROLE BADGE
// ============================================
function _RoleBadge({ role, isDark }: { role: string; isDark: boolean }) {
  const config: Record<string, { bg: string; text: string }> = {
    Faculty: {
      bg: "bg-primary-20",
      text: "text-primary",
    },
    Moderator: {
      bg: isDark ? "bg-blue-500/20" : "bg-blue-100",
      text: isDark ? "text-blue-400" : "text-blue-700",
    },
    Panelist: {
      bg: isDark ? "bg-cyan-500/20" : "bg-cyan-100",
      text: isDark ? "text-cyan-400" : "text-cyan-700",
    },
    Chairperson: {
      bg: isDark ? "bg-amber-500/20" : "bg-amber-100",
      text: isDark ? "text-amber-400" : "text-amber-700",
    },
    Speaker: {
      bg: isDark ? "bg-rose-500/20" : "bg-rose-100",
      text: isDark ? "text-rose-400" : "text-rose-700",
    },
  }

  const roleConfig = config[role] || {
    bg: isDark ? "bg-slate-500/20" : "bg-gray-100",
    text: isDark ? "text-slate-400" : "text-gray-600",
  }

  return (
    <span
      className={`
      inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold
      ${roleConfig.bg} ${roleConfig.text}
    `}
    >
      {role || "Faculty"}
    </span>
  )
}

// ============================================
// AVATAR
// ============================================
function Avatar({
  name,
  color,
  size = "md",
  isDark: _isDark,
}: {
  name: string
  color: string
  size?: "sm" | "md" | "lg"
  isDark: boolean
}) {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  }[size]

  const colors: Record<string, string> = {
    violet: "bg-gradient-primary",
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600",
    rose: "from-rose-500 to-pink-600",
    blue: "from-blue-500 to-cyan-600",
    indigo: "from-indigo-500 to-blue-600",
    cyan: "from-cyan-500 to-teal-600",
  }

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  // Assign color based on name hash if not provided
  const colorKeys = Object.keys(colors)
  const nameHash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const selectedColor = color || colorKeys[nameHash % colorKeys.length]
  const isViolet = selectedColor === "violet"

  return (
    <div
      className={`
      ${sizes} rounded-xl
      ${isViolet ? "bg-gradient-primary" : `bg-gradient-to-br ${colors[selectedColor]}`}
      flex items-center justify-center
      font-bold text-white
      shadow-lg
    `}
    >
      {initials}
    </div>
  )
}

// ============================================
// FACULTY ROW
// ============================================
interface FacultyMember {
  id: string
  name: string
  email: string
  designation: string | null
  institution: string | null
  status: string | null
  role?: string
  sessions?: number
  color?: string
  isNew?: boolean
}

function FacultyRow({
  faculty,
  index,
  isDark,
  isLast,
}: {
  faculty: FacultyMember
  index: number
  isDark: boolean
  isLast: boolean
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 100)
    return () => clearTimeout(timer)
  }, [index])

  // Assign color based on name
  const colorKeys = ["violet", "emerald", "amber", "rose", "blue", "indigo", "cyan"]
  const nameHash = faculty.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const color = faculty.color || colorKeys[nameHash % colorKeys.length]

  return (
    <tr
      className={`
        group
        transition-all duration-500 ease-out
        ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}
        ${isHovered ? (isDark ? "bg-slate-800/80" : "bg-gray-50") : ""}
        ${!isLast ? (isDark ? "border-b border-slate-700/50" : "border-b border-gray-100") : ""}
      `}
      style={{ transitionDelay: `${index * 100}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setShowMenu(false)
      }}
    >
      {/* Name & Avatar */}
      <td className="py-4 px-6">
        <div className="flex items-center gap-4">
          <div
            className={`
            transition-all duration-300
            ${isHovered ? "scale-110 rotate-3" : ""}
          `}
          >
            <Avatar name={faculty.name} color={color} size="md" isDark={isDark} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3
                className={`font-bold transition-all duration-300 ${isDark ? "text-white" : "text-gray-900"} ${isHovered ? "translate-x-1" : ""}`}
              >
                {faculty.name}
              </h3>
              {faculty.isNew && (
                <span
                  className={`
                  px-1.5 py-0.5 rounded text-[10px] font-bold uppercase
                  ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"}
                `}
                >
                  New
                </span>
              )}
              <ArrowUpRight
                className={`
                w-4 h-4 transition-all duration-300 text-primary
                ${isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}
              `}
              />
            </div>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
              {faculty.designation || faculty.institution || "—"}
            </p>
          </div>
        </div>
      </td>

      {/* Email */}
      <td className="py-4 px-4">
        <a
          href={`mailto:${faculty.email}`}
          className={`
            flex items-center gap-2 text-sm transition-colors duration-300
            ${isDark ? "text-slate-400" : "text-gray-500"} hover:text-primary
          `}
        >
          <Mail className="w-4 h-4" />
          <span className="truncate max-w-[180px]">{faculty.email}</span>
        </a>
      </td>

      {/* Institution */}
      <td className="py-4 px-4">
        <span className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
          {faculty.institution || "—"}
        </span>
      </td>

      {/* Status */}
      <td className="py-4 px-4">
        <StatusBadge status={faculty.status || "pending"} isDark={isDark} />
      </td>

      {/* Actions */}
      <td className="py-4 px-4">
        <div className="relative flex items-center gap-2">
          {/* Quick Actions on Hover */}
          <div
            className={`
            flex items-center gap-1 transition-all duration-300
            ${isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"}
          `}
          >
            <button
              className={`
              p-2 rounded-lg transition-colors
              ${
                isDark
                  ? "hover:bg-slate-700 text-slate-400 hover:text-emerald-400"
                  : "hover:bg-gray-200 text-gray-400 hover:text-emerald-600"
              }
            `}
            >
              <Send className="w-4 h-4" />
            </button>
            <button
              className={`
              p-2 rounded-lg transition-colors
              ${
                isDark
                  ? "hover:bg-slate-700 text-slate-400 hover:text-blue-400"
                  : "hover:bg-gray-200 text-gray-400 hover:text-blue-600"
              }
            `}
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`
              p-2 rounded-lg transition-all duration-300
              ${
                isDark
                  ? "hover:bg-slate-700 text-slate-400 hover:text-white"
                  : "hover:bg-gray-200 text-gray-400 hover:text-gray-700"
              }
            `}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div
              className={`
              absolute right-0 top-full mt-2 w-48 rounded-xl overflow-hidden z-50
              ${
                isDark
                  ? "bg-slate-800 border border-slate-700 shadow-xl shadow-black/30"
                  : "bg-white border border-gray-200 shadow-xl shadow-gray-200/50"
              }
              animate-fade-in
            `}
            >
              {[
                { icon: Eye, label: "View Profile", color: "blue" },
                { icon: Send, label: "Send Reminder", color: "emerald" },
                { icon: Edit, label: "Edit Details", color: "amber" },
                { icon: Copy, label: "Copy Email", color: "violet" },
                { icon: Calendar, label: "Assign Session", color: "cyan" },
                { icon: Trash2, label: "Remove", color: "rose" },
              ].map((item, i) => (
                <button
                  key={i}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-sm font-medium
                    transition-colors duration-200
                    ${isDark ? "text-slate-300 hover:bg-slate-700 hover:text-white" : "text-gray-700 hover:bg-gray-50"}
                    ${item.color === "rose" ? (isDark ? "hover:text-rose-400" : "hover:text-rose-600") : ""}
                  `}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ============================================
// TABLE HEADER
// ============================================
function TableHeader({ isDark }: { isDark: boolean }) {
  const headers = [
    { label: "Name", width: "min-w-[250px]" },
    { label: "Email", width: "min-w-[200px]" },
    { label: "Institution", width: "min-w-[150px]" },
    { label: "Status", width: "min-w-[120px]" },
    { label: "", width: "w-[120px]" },
  ]

  return (
    <thead>
      <tr className={isDark ? "bg-slate-800/50" : "bg-gray-50"}>
        {headers.map((header, i) => (
          <th
            key={i}
            className={`
              py-4 ${i === 0 ? "px-6" : "px-4"} text-xs font-bold uppercase tracking-wider
              ${header.width}
              text-left
              ${isDark ? "text-slate-400" : "text-gray-500"}
            `}
          >
            {header.label}
          </th>
        ))}
      </tr>
    </thead>
  )
}

// ============================================
// SECTION HEADER
// ============================================
function SectionHeader({
  isDark,
  totalCount,
}: {
  isDark: boolean
  totalCount: number
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={`
        flex items-center justify-between p-5 rounded-t-2xl
        ${isDark ? "bg-slate-800/50" : "bg-gray-50"}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-4">
        <div
          className={`
          relative p-3 rounded-xl bg-primary-20
          transition-all duration-300
          ${isHovered ? "scale-110 rotate-6" : ""}
        `}
        >
          {/* Glow */}
          <div
            className={`
            absolute inset-0 rounded-xl bg-primary/30 blur-lg
            transition-opacity duration-300
            ${isHovered ? "opacity-100" : "opacity-0"}
          `}
          />
          <GraduationCap className="relative w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Recent Faculty</h2>
          <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
            Recently added faculty members • {totalCount} total
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
            transition-all duration-300 hover:scale-105
            ${
              isDark
                ? "bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600"
                : "bg-white border border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm"
            }
          `}
        >
          <Download className="w-4 h-4" />
          Export
        </button>
        <button
          className="relative overflow-hidden flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-primary text-white shadow-primary-glow transition-all duration-300 hover:scale-105 hover:shadow-primary-glow-lg"
        >
          <Send className="w-4 h-4" />
          Send Reminders
          {/* Shine */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700 skew-x-12" />
        </button>
      </div>
    </div>
  )
}

// ============================================
// STATS ROW
// ============================================
function StatsRow({ counts, isDark }: { counts: { active: number; pending: number; inactive: number }; isDark: boolean }) {
  const stats = [
    { label: "Active", value: counts.active, color: "emerald", icon: CheckCircle },
    { label: "Pending", value: counts.pending, color: "amber", icon: Clock },
    { label: "Inactive", value: counts.inactive, color: "rose", icon: XCircle },
  ]

  return (
    <div className="flex items-center gap-4 p-4">
      {stats.map((stat, i) => (
        <StatPill key={i} {...stat} isDark={isDark} index={i} />
      ))}
    </div>
  )
}

function StatPill({
  label,
  value,
  color,
  icon: Icon,
  isDark,
  index,
}: {
  label: string
  value: number
  color: string
  icon: typeof CheckCircle
  isDark: boolean
  index: number
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 100)
    return () => clearTimeout(timer)
  }, [index])

  const colors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    emerald: {
      bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50",
      border: isDark ? "border-emerald-500/30" : "border-emerald-200",
      text: isDark ? "text-emerald-400" : "text-emerald-700",
      icon: isDark ? "text-emerald-500" : "text-emerald-600",
    },
    amber: {
      bg: isDark ? "bg-amber-500/10" : "bg-amber-50",
      border: isDark ? "border-amber-500/30" : "border-amber-200",
      text: isDark ? "text-amber-400" : "text-amber-700",
      icon: isDark ? "text-amber-500" : "text-amber-600",
    },
    rose: {
      bg: isDark ? "bg-rose-500/10" : "bg-rose-50",
      border: isDark ? "border-rose-500/30" : "border-rose-200",
      text: isDark ? "text-rose-400" : "text-rose-700",
      icon: isDark ? "text-rose-500" : "text-rose-600",
    },
  }

  const colorConfig = colors[color]

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border
        transition-all duration-500 ease-out cursor-default
        ${colorConfig.bg} ${colorConfig.border}
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        ${isHovered ? "scale-105 shadow-lg" : ""}
      `}
      style={{ transitionDelay: `${index * 100}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Icon className={`w-5 h-5 ${colorConfig.icon}`} />
      <div>
        <span className={`text-2xl font-black ${colorConfig.text}`}>{value}</span>
        <span className={`ml-2 text-sm font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}>{label}</span>
      </div>
    </div>
  )
}

// ============================================
// SEARCH & FILTER BAR
// ============================================
function SearchFilterBar({ isDark, onAddClick }: { isDark: boolean; onAddClick: () => void }) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <div className="flex items-center gap-4 p-4 pt-0">
      {/* Search */}
      <div
        className={`
        flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl
        transition-all duration-300
        ${isDark ? "bg-slate-800/50 border border-slate-700" : "bg-white border border-gray-200"}
        ${isFocused ? "border-primary/50 ring-2 ring-primary/20" : ""}
      `}
      >
        <Search className={`w-5 h-5 ${isDark ? "text-slate-400" : "text-gray-400"}`} />
        <input
          type="text"
          placeholder="Search faculty by name, email, or institution..."
          className={`
            flex-1 bg-transparent outline-none text-sm
            ${isDark ? "text-white placeholder-slate-500" : "text-gray-900 placeholder-gray-400"}
          `}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </div>

      {/* Filter */}
      <button
        className={`
        flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm
        transition-all duration-300
        ${isDark ? "bg-slate-800 border border-slate-700 text-slate-300 hover:text-white" : "bg-white border border-gray-200 text-gray-600 hover:text-gray-900"}
      `}
      >
        <Filter className="w-4 h-4" />
        Filter
      </button>

      {/* Add Faculty */}
      <button
        onClick={onAddClick}
        className={`
        flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm
        bg-gradient-to-r from-emerald-500 to-teal-600
        text-white shadow-lg shadow-emerald-500/30
        transition-all duration-300 hover:scale-105
      `}
      >
        <UserPlus className="w-4 h-4" />
        Add Faculty
      </button>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================
export function RecentFacultyTable() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Add Faculty Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newFaculty, setNewFaculty] = useState({
    title: "",
    name: "",
    email: "",
    phone: "",
    designation: "",
    institution: "",
    specialty: "",
    city: "",
  })

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === "dark" : false

  // Fetch faculty stats and recent faculty from API
  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard-faculty-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/faculty-stats")
      if (!res.ok) throw new Error("Failed to fetch faculty stats")
      return await res.json()
    },
  })

  const facultyData = (dashboardData?.recent as FacultyMember[]) || []

  // Add faculty mutation
  const addFacultyMutation = useMutation({
    mutationFn: async () => {
      if (!newFaculty.name || !newFaculty.email) {
        throw new Error("Name and Email are required")
      }

      const { data, error } = await supabase
        .from("faculty")
        .insert({
          title: newFaculty.title || null,
          name: newFaculty.name,
          email: newFaculty.email,
          phone: newFaculty.phone || null,
          designation: newFaculty.designation || null,
          institution: newFaculty.institution || null,
          specialty: newFaculty.specialty || null,
          city: newFaculty.city || null,
          status: "active",
        } as any)
        .select()
        .maybeSingle()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success("Faculty added successfully!")
      queryClient.invalidateQueries({ queryKey: ["recent-faculty-table"] })
      queryClient.invalidateQueries({ queryKey: ["faculty-total-count"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      setIsAddModalOpen(false)
      setNewFaculty({
        title: "",
        name: "",
        email: "",
        phone: "",
        designation: "",
        institution: "",
        specialty: "",
        city: "",
      })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Fallback data for display
  const fallbackFaculty: FacultyMember[] = [
    {
      id: "1",
      name: "Dr. Kalpesh Jani",
      email: "kalpesh@hospital.com",
      designation: "Laparoscopic Surgery",
      institution: "Apollo Hospital",
      status: "active",
      isNew: true,
    },
    {
      id: "2",
      name: "Dr. Priya Sharma",
      email: "priya@medical.org",
      designation: "General Surgery",
      institution: "AIIMS Delhi",
      status: "pending",
      isNew: true,
    },
    {
      id: "3",
      name: "Dr. Arvind Kumar",
      email: "arvind@clinic.in",
      designation: "Bariatric Surgery",
      institution: "Max Healthcare",
      status: "active",
    },
    {
      id: "4",
      name: "Dr. Meena Patel",
      email: "meena@aiims.edu",
      designation: "Robotic Surgery",
      institution: "AIIMS Ahmedabad",
      status: "inactive",
    },
    {
      id: "5",
      name: "Dr. Suresh Reddy",
      email: "suresh@apollo.com",
      designation: "Hernia Surgery",
      institution: "Apollo Hospital",
      status: "active",
    },
  ]

  const faculty = facultyData && facultyData.length > 0 ? facultyData : fallbackFaculty
  const totalCount = dashboardData?.total || 0
  const facultyCounts = {
    active: dashboardData?.active || 0,
    pending: dashboardData?.pending || 0,
    inactive: dashboardData?.inactive || 0,
  }

  return (
    <div
      className={`
      rounded-2xl overflow-hidden
      ${isDark ? "bg-slate-900/50 border border-slate-800 backdrop-blur-sm" : "bg-white border border-gray-200 shadow-xl shadow-gray-200/50"}
    `}
    >
      {/* Header */}
      <SectionHeader isDark={isDark} totalCount={totalCount || faculty.length} />

      {/* Stats Row */}
      <StatsRow counts={facultyCounts} isDark={isDark} />

      {/* Search & Filters */}
      <SearchFilterBar isDark={isDark} onAddClick={() => setIsAddModalOpen(true)} />

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <TableHeader isDark={isDark} />
          <tbody>
            {faculty.map((f, index) => (
              <FacultyRow key={f.id} faculty={f} index={index} isDark={isDark} isLast={index === faculty.length - 1} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        className={`
        flex items-center justify-between px-6 py-4
        ${isDark ? "bg-slate-800/50 border-t border-slate-700/50" : "bg-gray-50 border-t border-gray-100"}
      `}
      >
        <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
          Showing {faculty.length} of {totalCount || faculty.length} faculty members
        </p>
        <Link
          href="/faculty"
          className={`
          flex items-center gap-2 text-sm font-semibold
          text-primary hover:text-primary/80
          transition-colors duration-300
        `}
        >
          View all faculty
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Add Faculty Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add New Faculty
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Select
                  value={newFaculty.title}
                  onValueChange={(v) => setNewFaculty({ ...newFaculty, title: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Dr." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dr.">Dr.</SelectItem>
                    <SelectItem value="Prof.">Prof.</SelectItem>
                    <SelectItem value="Mr.">Mr.</SelectItem>
                    <SelectItem value="Ms.">Ms.</SelectItem>
                    <SelectItem value="Mrs.">Mrs.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3 space-y-2">
                <Label>Name *</Label>
                <Input
                  placeholder="Full name"
                  value={newFaculty.name}
                  onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    className="pl-9"
                    value={newFaculty.email}
                    onChange={(e) => setNewFaculty({ ...newFaculty, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="+91 98765 43210"
                    className="pl-9"
                    value={newFaculty.phone}
                    onChange={(e) => setNewFaculty({ ...newFaculty, phone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input
                  placeholder="e.g. Senior Consultant"
                  value={newFaculty.designation}
                  onChange={(e) => setNewFaculty({ ...newFaculty, designation: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Specialty</Label>
                <Input
                  placeholder="e.g. Laparoscopic Surgery"
                  value={newFaculty.specialty}
                  onChange={(e) => setNewFaculty({ ...newFaculty, specialty: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Institution</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hospital / Medical College"
                  className="pl-9"
                  value={newFaculty.institution}
                  onChange={(e) => setNewFaculty({ ...newFaculty, institution: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>City</Label>
              <Input
                placeholder="e.g. Mumbai, Delhi"
                value={newFaculty.city}
                onChange={(e) => setNewFaculty({ ...newFaculty, city: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addFacultyMutation.mutate()}
              disabled={addFacultyMutation.isPending || !newFaculty.name || !newFaculty.email}
            >
              {addFacultyMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Add Faculty
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
