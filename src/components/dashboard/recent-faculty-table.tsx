"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
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

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { cls: string; icon: typeof CheckCircle; label: string }> = {
    confirmed: { cls: "bg-emerald-50 text-emerald-700", icon: CheckCircle, label: "Confirmed" },
    active: { cls: "bg-emerald-50 text-emerald-700", icon: CheckCircle, label: "Active" },
    pending: { cls: "bg-amber-50 text-amber-700", icon: Clock, label: "Pending" },
    declined: { cls: "bg-rose-50 text-rose-700", icon: XCircle, label: "Declined" },
    inactive: { cls: "bg-muted text-muted-foreground", icon: XCircle, label: "Inactive" },
  }
  const c = config[status] || config.pending
  const Icon = c.icon

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.cls}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  )
}

function Avatar({ name, color }: { name: string; color: string }) {
  const colors: Record<string, string> = {
    violet: "from-violet-500 to-purple-600",
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600",
    rose: "from-rose-500 to-pink-600",
    blue: "from-blue-500 to-cyan-600",
    indigo: "from-indigo-500 to-blue-600",
    cyan: "from-cyan-500 to-teal-600",
  }
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  const colorKeys = Object.keys(colors)
  const nameHash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const selectedColor = color || colorKeys[nameHash % colorKeys.length]

  return (
    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${colors[selectedColor] || colors.cyan} flex items-center justify-center text-xs font-bold text-white`}>
      {initials}
    </div>
  )
}

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

function FacultyRow({ faculty, index, isLast }: { faculty: FacultyMember; index: number; isLast: boolean }) {
  const [isVisible, setIsVisible] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 80)
    return () => clearTimeout(timer)
  }, [index])

  const colorKeys = ["violet", "emerald", "amber", "rose", "blue", "indigo", "cyan"]
  const nameHash = faculty.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const color = faculty.color || colorKeys[nameHash % colorKeys.length]

  return (
    <tr
      className={`
        group transition-all duration-400 ease-out
        ${isVisible ? "opacity-100" : "opacity-0 translate-y-2"}
        hover:bg-accent
        ${!isLast ? "border-b border-border" : ""}
      `}
      style={{ transitionDelay: `${index * 80}ms` }}
      onMouseLeave={() => setShowMenu(false)}
    >
      <td className="py-3.5 px-5">
        <div className="flex items-center gap-3">
          <Avatar name={faculty.name} color={color} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground truncate">{faculty.name}</h3>
              {faculty.isNew && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-cyan-50 text-cyan-700">
                  New
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 truncate">{faculty.designation || faculty.institution || "—"}</p>
          </div>
        </div>
      </td>

      <td className="py-3.5 px-4">
        <a
          href={`mailto:${faculty.email}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan-600 transition-colors"
        >
          <Mail className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate max-w-[160px]">{faculty.email}</span>
        </a>
      </td>

      <td className="py-3.5 px-4">
        <span className="text-xs text-gray-400">{faculty.institution || "—"}</span>
      </td>

      <td className="py-3.5 px-4">
        <StatusBadge status={faculty.status || "pending"} />
      </td>

      <td className="py-3.5 px-4">
        <div className="relative flex items-center gap-1">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-cyan-600 hover:bg-muted transition-colors">
              <Send className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-cyan-600 hover:bg-muted transition-colors">
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-xl overflow-hidden z-50 bg-card border border-border shadow-xl">
              {[
                { icon: Eye, label: "View Profile" },
                { icon: Send, label: "Send Reminder" },
                { icon: Edit, label: "Edit Details" },
                { icon: Copy, label: "Copy Email" },
                { icon: Calendar, label: "Assign Session" },
                { icon: Trash2, label: "Remove" },
              ].map((item, i) => (
                <button
                  key={i}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors ${
                    item.label === "Remove" ? "hover:text-rose-600" : ""
                  }`}
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

function SectionHeader({ totalCount }: { totalCount: number }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-border">
      <div className="flex items-center gap-3">
        <div className="p-2 sm:p-2.5 rounded-lg bg-muted">
          <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-foreground">Recent Faculty</h2>
          <p className="text-xs text-gray-400">{totalCount} total members</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-border transition-colors">
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm">
          <Send className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">Send Reminders</span>
        </button>
      </div>
    </div>
  )
}

function StatsRow({ counts }: { counts: { active: number; pending: number; inactive: number } }) {
  const stats = [
    { label: "Active", value: counts.active, cls: "bg-emerald-50 border-emerald-200/60 text-emerald-700", icon: CheckCircle, iconCls: "text-emerald-500" },
    { label: "Pending", value: counts.pending, cls: "bg-amber-50 border-amber-200/60 text-amber-700", icon: Clock, iconCls: "text-amber-500" },
    { label: "Inactive", value: counts.inactive, cls: "bg-rose-50 border-rose-200/60 text-rose-700", icon: XCircle, iconCls: "text-rose-500" },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-4 sm:p-5 pt-3 sm:pt-4">
      {stats.map((stat) => (
        <div key={stat.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${stat.cls}`}>
          <stat.icon className={`w-4 h-4 ${stat.iconCls}`} />
          <span className="text-base sm:text-lg font-bold tabular-nums">{stat.value}</span>
          <span className="text-xs font-medium opacity-70">{stat.label}</span>
        </div>
      ))}
    </div>
  )
}

function SearchFilterBar({ onAddClick }: { onAddClick: () => void }) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 px-4 sm:px-5 pb-4">
      <div
        className={`flex-1 flex items-center gap-2.5 px-3.5 py-2 rounded-lg border transition-colors ${
          isFocused
            ? "border-cyan-400/50 ring-2 ring-cyan-400/10"
            : "border-border"
        } bg-card`}
      >
        <Search className="w-4 h-4 shrink-0 text-gray-400" />
        <input
          type="text"
          placeholder="Search faculty..."
          className="flex-1 bg-transparent outline-none text-sm min-w-0 text-foreground placeholder-muted-foreground"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </div>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-border transition-colors">
          <Filter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Filter</span>
        </button>
        <button
          onClick={onAddClick}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Faculty</span>
        </button>
      </div>
    </div>
  )
}

export function RecentFacultyTable() {
  const supabase = createClient()
  const queryClient = useQueryClient()

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

  const { data: dashboardData, isLoading: isFacultyLoading } = useQuery({
    queryKey: ["dashboard-faculty-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/faculty-stats")
      if (!res.ok) throw new Error("Failed to fetch faculty stats")
      return await res.json()
    },
    staleTime: 2 * 60 * 1000,
  })

  const facultyData = (dashboardData?.recent as FacultyMember[]) || []

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
      queryClient.invalidateQueries({ queryKey: ["dashboard-faculty-stats"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      setIsAddModalOpen(false)
      setNewFaculty({ title: "", name: "", email: "", phone: "", designation: "", institution: "", specialty: "", city: "" })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const faculty = facultyData || []
  const totalCount = dashboardData?.total || 0
  const facultyCounts = {
    active: dashboardData?.active || 0,
    pending: dashboardData?.pending || 0,
    inactive: dashboardData?.inactive || 0,
  }

  const headers = [
    { label: "Name", width: "min-w-[220px]" },
    { label: "Email", width: "min-w-[180px]" },
    { label: "Institution", width: "min-w-[130px]" },
    { label: "Status", width: "min-w-[100px]" },
    { label: "", width: "w-[100px]" },
  ]

  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border">
      <SectionHeader totalCount={totalCount || faculty.length} />
      <StatsRow counts={facultyCounts} />
      <SearchFilterBar onAddClick={() => setIsAddModalOpen(true)} />

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {headers.map((header, i) => (
                <th
                  key={i}
                  className={`py-3 ${i === 0 ? "px-5" : "px-4"} text-[11px] font-semibold uppercase tracking-wider text-left text-gray-400 ${header.width}`}
                >
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isFacultyLoading ? (
              [1, 2, 3, 4].map((i) => (
                <tr key={i} className="animate-pulse border-b border-border">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted" />
                      <div className="space-y-2">
                        <div className="w-28 h-4 rounded bg-muted" />
                        <div className="w-20 h-3 rounded bg-muted/60" />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4"><div className="w-32 h-4 rounded bg-muted" /></td>
                  <td className="py-3.5 px-4"><div className="w-24 h-4 rounded bg-muted" /></td>
                  <td className="py-3.5 px-4"><div className="w-16 h-5 rounded-full bg-muted" /></td>
                  <td className="py-3.5 px-4"><div className="w-12 h-6 rounded bg-muted" /></td>
                </tr>
              ))
            ) : faculty.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="inline-flex p-5 rounded-full mb-4 bg-muted">
                    <GraduationCap className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-lg text-foreground">No faculty added yet</p>
                  <p className="text-sm mt-1 max-w-xs mx-auto text-gray-400">
                    Add faculty members to your database to manage them across events
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add First Faculty
                  </button>
                </td>
              </tr>
            ) : (
              faculty.map((f, index) => (
                <FacultyRow key={f.id} faculty={f} index={index} isLast={index === faculty.length - 1} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-border">
        <p className="text-xs text-gray-400">
          Showing {faculty.length} of {totalCount || faculty.length}
        </p>
        <Link
          href="/faculty"
          className="flex items-center gap-1.5 text-sm font-semibold text-cyan-600 hover:text-cyan-500 transition-colors"
        >
          View all faculty
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Add Faculty Modal — unchanged */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-cyan-500" />
              Add New Faculty
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Select value={newFaculty.title} onValueChange={(v) => setNewFaculty({ ...newFaculty, title: v })}>
                  <SelectTrigger><SelectValue placeholder="Dr." /></SelectTrigger>
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
                <Input placeholder="Full name" value={newFaculty.name} onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="email@example.com" className="pl-9" value={newFaculty.email} onChange={(e) => setNewFaculty({ ...newFaculty, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="+91 98765 43210" className="pl-9" value={newFaculty.phone} onChange={(e) => setNewFaculty({ ...newFaculty, phone: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input placeholder="e.g. Senior Consultant" value={newFaculty.designation} onChange={(e) => setNewFaculty({ ...newFaculty, designation: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Specialty</Label>
                <Input placeholder="e.g. Laparoscopic Surgery" value={newFaculty.specialty} onChange={(e) => setNewFaculty({ ...newFaculty, specialty: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Institution</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Hospital / Medical College" className="pl-9" value={newFaculty.institution} onChange={(e) => setNewFaculty({ ...newFaculty, institution: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>City</Label>
              <Input placeholder="e.g. Mumbai, Delhi" value={newFaculty.city} onChange={(e) => setNewFaculty({ ...newFaculty, city: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button onClick={() => addFacultyMutation.mutate()} disabled={addFacultyMutation.isPending || !newFaculty.name || !newFaculty.email}>
              {addFacultyMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Add Faculty
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
