"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Search,
  Loader2,
  Users,
  UserCheck,
  ClipboardCheck,
  BarChart3,
  Upload,
  Plus,
  Pencil,
  Trash2,
  Shield,
  Shuffle,
  RefreshCw,
  XCircle,
  CalendarClock,
  Sparkles,
  ChevronRight,
  Target,
  TrendingUp,
  Award,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Building,
  Link2,
  Send,
  Copy,
  Eye,
  EyeOff,
  MailOpen,
  Bell,
  Activity,
  AlertOctagon,
} from "lucide-react"
import { toast } from "sonner"
import { CSVImportDynamic } from "@/components/ui/csv-import-dynamic"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

type PoolReviewer = {
  id: string
  name: string
  email: string
  phone: string | null
  institution: string | null
  city: string | null
  specialty: string | null
  years_of_experience: string | null
  status: string
}

type ReviewerActivity = {
  last_login_at: string | null
  total_emails_sent: number
  total_emails_opened: number
  decline_count: number
  assignments_total: number
  assignments_opened: number
  assignments_viewed: number
  assignments_pending: number
  assignments_completed: number
  assignments_declined: number
  last_viewed_at: string | null
  reminders_sent: number
  activity_status: "never_active" | "active_today" | "active_recently" | "inactive_week" | "inactive_long" | "unknown"
}

type Reviewer = {
  id: string
  event_id: string
  name: string
  email: string
  phone: string | null
  institution: string | null
  city: string | null
  specialty: string | null
  years_of_experience: string | null
  status: string
  notes: string | null
  assigned_abstracts: string[]
  review_count: number
  created_at: string
  updated_at: string
  activity: ReviewerActivity | null
}

const csvFields = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "phone", label: "Phone Number" },
  { key: "institution", label: "Institution/Hospital" },
  { key: "city", label: "City" },
  { key: "specialty", label: "Specialty Interests" },
  { key: "years_of_experience", label: "Years of Experience" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Notes (Internal)" },
]

export default function ReviewersPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showImport, setShowImport] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addMode, setAddMode] = useState<"pool" | "manual">("pool")
  const [poolSearch, setPoolSearch] = useState("")
  const [selectedFromPool, setSelectedFromPool] = useState<string[]>([])
  const [editingReviewer, setEditingReviewer] = useState<Reviewer | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    institution: "",
    city: "",
    specialty: "",
    years_of_experience: "",
    status: "active",
    notes: "",
  })

  // Fetch reviewers
  const { data: reviewers = [], isLoading } = useQuery({
    queryKey: ["abstract-reviewers", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch reviewers")
      return res.json() as Promise<Reviewer[]>
    },
  })

  // Fetch settings for restrict_reviewers toggle
  const { data: settings } = useQuery({
    queryKey: ["abstract-settings", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-settings/${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch settings")
      return res.json()
    },
  })

  // Fetch global reviewers pool
  const { data: poolReviewers = [] } = useQuery({
    queryKey: ["reviewers-pool"],
    queryFn: async () => {
      const res = await fetch("/api/reviewers-pool")
      if (!res.ok) throw new Error("Failed to fetch pool")
      return res.json() as Promise<PoolReviewer[]>
    },
  })

  // Filter pool reviewers not already in event
  const availableFromPool = useMemo(() => {
    const eventEmails = new Set(reviewers.map(r => r.email.toLowerCase()))
    return poolReviewers
      .filter(p => p.status === "active" && !eventEmails.has(p.email.toLowerCase()))
      .filter(p => {
        if (!poolSearch) return true
        const s = poolSearch.toLowerCase()
        return p.name.toLowerCase().includes(s) ||
          p.email.toLowerCase().includes(s) ||
          (p.institution || "").toLowerCase().includes(s) ||
          (p.specialty || "").toLowerCase().includes(s)
      })
  }, [poolReviewers, reviewers, poolSearch])

  // Toggle restrict_reviewers
  const toggleRestrict = useMutation({
    mutationFn: async (value: boolean) => {
      const res = await fetch(`/api/abstract-settings/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restrict_reviewers: value }),
      })
      if (!res.ok) throw new Error("Failed to update settings")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-settings", eventId] })
      toast.success("Reviewer restriction updated")
    },
    onError: () => toast.error("Failed to update setting"),
  })

  // Update reviewer
  const updateReviewer = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update reviewer")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      toast.success("Reviewer updated")
      setEditingReviewer(null)
    },
    onError: () => toast.error("Failed to update reviewer"),
  })

  // Delete reviewer
  const deleteReviewer = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete reviewer")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      toast.success("Reviewer removed")
    },
    onError: () => toast.error("Failed to remove reviewer"),
  })

  // Auto-assign abstracts
  const autoAssign = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}/assign`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to auto-assign")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      toast.success(`Assigned ${data.total_abstracts} abstracts across ${data.total_reviewers} reviewers`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Reassign pending
  const reassignPending = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}/assign`, {
        method: "PUT",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to reassign")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      if (data.reassigned_count === 0) {
        toast.info("No unreviewed abstracts to reassign")
      } else {
        toast.success(`Reassigned ${data.reassigned_count} abstracts`)
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Clear all assignments
  const clearAssignments = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}/assign`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to clear assignments")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      toast.success("All assignments cleared")
    },
    onError: () => toast.error("Failed to clear assignments"),
  })

  // Update review deadline
  const updateDeadline = useMutation({
    mutationFn: async (deadline: string | null) => {
      const res = await fetch(`/api/abstract-settings/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_deadline: deadline }),
      })
      if (!res.ok) throw new Error("Failed to update deadline")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-settings", eventId] })
      toast.success("Review deadline updated")
    },
    onError: () => toast.error("Failed to update deadline"),
  })

  // Add reviewer (manual or from pool)
  const addReviewer = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch(`/api/abstract-reviewers/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to add reviewer")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      toast.success("Reviewer added")
      setShowAddDialog(false)
      setEditForm({
        name: "", email: "", phone: "", institution: "", city: "",
        specialty: "", years_of_experience: "", status: "active", notes: "",
      })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Add selected reviewers from pool
  const addFromPool = useMutation({
    mutationFn: async (poolIds: string[]) => {
      const selected = poolReviewers.filter(p => poolIds.includes(p.id))
      const toAdd = selected.map(p => ({
        name: p.name,
        email: p.email,
        phone: p.phone,
        institution: p.institution,
        city: p.city,
        specialty: p.specialty,
        years_of_experience: p.years_of_experience,
        status: "active",
      }))
      const res = await fetch(`/api/abstract-reviewers/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toAdd),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to add reviewers")
      }
      return res.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      toast.success(`Added ${result.success || selectedFromPool.length} reviewer(s)`)
      setShowAddDialog(false)
      setSelectedFromPool([])
      setPoolSearch("")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Add new reviewer to pool AND event
  const addNewToPoolAndEvent = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      // First add to global pool
      const poolRes = await fetch("/api/reviewers-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!poolRes.ok) {
        const err = await poolRes.json()
        throw new Error(err.error || "Failed to add to pool")
      }
      // Then add to event
      const eventRes = await fetch(`/api/abstract-reviewers/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!eventRes.ok) {
        const err = await eventRes.json()
        throw new Error(err.error || "Failed to add to event")
      }
      return eventRes.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      toast.success("Reviewer added to pool and event")
      setShowAddDialog(false)
      setAddMode("pool")
      setEditForm({
        name: "", email: "", phone: "", institution: "", city: "",
        specialty: "", years_of_experience: "", status: "active", notes: "",
      })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Filtered reviewers
  const filtered = useMemo(() => {
    return reviewers.filter((r) => {
      const matchesSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase()) ||
        (r.institution || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.specialty || "").toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === "all" || r.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [reviewers, search, statusFilter])

  // Stats
  const stats = useMemo(() => {
    const active = reviewers.filter((r) => r.status === "active").length
    const totalReviews = reviewers.reduce((sum, r) => sum + r.review_count, 0)
    const reviewersWithReviews = reviewers.filter((r) => r.review_count > 0).length
    const avgReviews = reviewersWithReviews > 0
      ? (totalReviews / reviewersWithReviews).toFixed(1)
      : "0"

    return {
      total: reviewers.length,
      active,
      totalReviews,
      avgReviews,
    }
  }, [reviewers])

  const handleEditClick = (reviewer: Reviewer) => {
    setEditingReviewer(reviewer)
    setEditForm({
      name: reviewer.name,
      email: reviewer.email,
      phone: reviewer.phone || "",
      institution: reviewer.institution || "",
      city: reviewer.city || "",
      specialty: reviewer.specialty || "",
      years_of_experience: reviewer.years_of_experience || "",
      status: reviewer.status,
      notes: reviewer.notes || "",
    })
  }

  const handleSaveEdit = () => {
    if (!editingReviewer) return
    updateReviewer.mutate({ id: editingReviewer.id, ...editForm })
  }

  const handleCSVImport = async (data: Record<string, any>[]) => {
    const res = await fetch(`/api/abstract-reviewers/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || "Import failed")
    }
    const result = await res.json()
    queryClient.invalidateQueries({ queryKey: ["abstract-reviewers", eventId] })
    return result
  }

  // Gradient colors for avatars
  const gradients = [
    "from-pink-500 to-rose-500",
    "from-violet-500 to-purple-500",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-orange-500 to-amber-500",
    "from-red-500 to-pink-500",
    "from-indigo-500 to-blue-500",
    "from-fuchsia-500 to-pink-500",
  ]

  const getGradient = (name: string) => {
    const index = name.charCodeAt(0) % gradients.length
    return gradients[index]
  }

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  }

  // Workload distribution with activity data
  const workloadData = useMemo(() => {
    const maxAssigned = Math.max(...reviewers.map(r => (r.assigned_abstracts || []).length), 1)
    return reviewers.map(r => ({
      ...r,
      assignedCount: (r.assigned_abstracts || []).length,
      pendingCount: Math.max(0, (r.assigned_abstracts || []).length - r.review_count),
      completedPercent: (r.assigned_abstracts || []).length > 0
        ? Math.round((r.review_count / (r.assigned_abstracts || []).length) * 100)
        : 0,
      workloadPercent: Math.round(((r.assigned_abstracts || []).length / maxAssigned) * 100),
      activity: r.activity,
    }))
  }, [reviewers])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin mx-auto" />
            <Sparkles className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-muted-foreground font-medium">Loading reviewers...</p>
        </div>
      </div>
    )
  }

  if (showImport) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={() => setShowImport(false)} className="mb-4">
          &larr; Back to Reviewers
        </Button>
        <CSVImportDynamic
          title="Import Reviewers"
          description="Upload a CSV file with reviewer details. Map the columns to the standard fields below."
          standardFields={csvFields}
          onImport={handleCSVImport}
          templateFileName="reviewers_template.csv"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Event Reviewers
              <Sparkles className="h-5 w-5 text-yellow-500" />
            </h1>
            <p className="text-sm text-muted-foreground">Manage and assign reviewers for this event</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Auto-assign abstracts to all active reviewers? This will distribute unassigned abstracts evenly.")) {
                autoAssign.mutate()
              }
            }}
            disabled={autoAssign.isPending}
            className="border-primary/20 hover:bg-primary/5"
          >
            {autoAssign.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shuffle className="h-4 w-4 mr-2 text-primary" />}
            Auto Assign
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Reassign all unreviewed abstracts to other reviewers?")) {
                reassignPending.mutate()
              }
            }}
            disabled={reassignPending.isPending}
            className="border-amber-500/20 hover:bg-amber-500/5"
          >
            {reassignPending.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2 text-amber-600" />}
            Reassign
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Clear ALL abstract assignments from all reviewers?")) {
                clearAssignments.mutate()
              }
            }}
            disabled={clearAssignments.isPending}
            className="border-red-500/20 hover:bg-red-500/5"
          >
            {clearAssignments.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2 text-red-500" />}
            Clear
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setEditForm({
                name: "", email: "", phone: "", institution: "", city: "",
                specialty: "", years_of_experience: "", status: "active", notes: "",
              })
              setShowAddDialog(true)
            }}
            className="border-green-500/20 hover:bg-green-500/5"
          >
            <Plus className="h-4 w-4 mr-2 text-green-600" />
            Add
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const link = `${window.location.origin}/abstract-reviewer/${eventId}`
              navigator.clipboard.writeText(link)
              toast.success("Review portal link copied!", { description: link })
            }}
            className="border-blue-500/20 hover:bg-blue-500/5"
          >
            <Link2 className="h-4 w-4 mr-2 text-blue-500" />
            Portal Link
          </Button>
          <Button onClick={() => setShowImport(true)} className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20 p-5 hover:shadow-lg hover:shadow-primary/10 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-bold text-primary">{stats.total}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Reviewers</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 p-5 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-bold text-emerald-600">{stats.active}</p>
              <p className="text-sm text-muted-foreground mt-1">Active</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserCheck className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 p-5 hover:shadow-lg hover:shadow-blue-500/10 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-bold text-blue-600">{stats.totalReviews}</p>
              <p className="text-sm text-muted-foreground mt-1">Reviews Done</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardCheck className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" />
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-5 hover:shadow-lg hover:shadow-purple-500/10 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-bold text-purple-600">{stats.avgReviews}</p>
              <p className="text-sm text-muted-foreground mt-1">Avg/Reviewer</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />
        </div>
      </div>

      {/* Settings Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Restrict toggle */}
        <div className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium">Restrict Portal Access</p>
              <p className="text-xs text-muted-foreground">
                Only registered reviewers can access
              </p>
            </div>
          </div>
          <Switch
            checked={settings?.restrict_reviewers ?? false}
            onCheckedChange={(checked) => toggleRestrict.mutate(checked)}
            disabled={toggleRestrict.isPending}
            className="data-[state=checked]:bg-amber-500"
          />
        </div>

        {/* Review Deadline */}
        <div className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border border-blue-500/20">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <CalendarClock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium">Review Deadline</p>
              <p className="text-xs text-muted-foreground">
                Auto-reassign after deadline
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              className="w-[200px] h-9 text-sm"
              value={settings?.review_deadline ? new Date(settings.review_deadline).toISOString().slice(0, 16) : ""}
              onChange={(e) => {
                const val = e.target.value
                updateDeadline.mutate(val ? new Date(val).toISOString() : null)
              }}
            />
            {settings?.review_deadline && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateDeadline.mutate(null)}
                className="h-9 w-9 p-0"
              >
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, institution..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-background"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-10 bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-sm px-3 py-1.5">
          {filtered.length} reviewer{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Reviewer Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed bg-muted/20">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Users className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No reviewers found</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {reviewers.length === 0
              ? "Import reviewers from CSV or add from the global pool to get started"
              : "Try adjusting your search or filters"}
          </p>
          {reviewers.length === 0 && (
            <div className="flex items-center justify-center gap-3">
              <Button onClick={() => setShowImport(true)} className="bg-gradient-to-r from-primary to-purple-600">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button variant="outline" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Reviewer
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {workloadData.filter(r => filtered.some(f => f.id === r.id)).map((reviewer) => (
            <div
              key={reviewer.id}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-5 transition-all hover:shadow-lg",
                reviewer.status === "active"
                  ? "bg-gradient-to-r from-background to-muted/30 hover:border-primary/30"
                  : "bg-muted/20 opacity-60"
              )}
            >
              <div className="flex items-center gap-5">
                {/* Avatar */}
                <div className={cn(
                  "h-14 w-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg shadow-lg",
                  getGradient(reviewer.name)
                )}>
                  {getInitials(reviewer.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{reviewer.name}</h3>
                    <Badge
                      variant={reviewer.status === "active" ? "default" : "secondary"}
                      className={cn(
                        "text-[10px] px-2",
                        reviewer.status === "active" && "bg-emerald-500/20 text-emerald-700 border-emerald-500/30"
                      )}
                    >
                      {reviewer.status === "active" ? <Zap className="h-3 w-3 mr-1" /> : null}
                      {reviewer.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3.5 w-3.5" />
                      {reviewer.email}
                    </span>
                    {reviewer.institution && (
                      <span className="flex items-center gap-1 truncate">
                        <Building className="h-3.5 w-3.5" />
                        {reviewer.institution}
                      </span>
                    )}
                  </div>
                  {reviewer.specialty && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {reviewer.specialty.split(",").slice(0, 3).map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                          {s.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6">
                  {/* Activity Status */}
                  {reviewer.activity && (
                    <div className="flex items-center gap-2">
                      {/* Email opened indicator */}
                      <div
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                          reviewer.activity.assignments_opened > 0
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        )}
                        title={reviewer.activity.assignments_opened > 0
                          ? `Opened ${reviewer.activity.assignments_opened} email(s)`
                          : "Email not opened"
                        }
                      >
                        {reviewer.activity.assignments_opened > 0 ? (
                          <MailOpen className="h-3.5 w-3.5" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                        {reviewer.activity.assignments_opened > 0 && reviewer.activity.assignments_opened}
                      </div>

                      {/* Viewed indicator */}
                      <div
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                          reviewer.activity.assignments_viewed > 0
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-500"
                        )}
                        title={reviewer.activity.assignments_viewed > 0
                          ? `Viewed ${reviewer.activity.assignments_viewed} abstract(s)`
                          : "No abstracts viewed"
                        }
                      >
                        {reviewer.activity.assignments_viewed > 0 ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                        {reviewer.activity.assignments_viewed > 0 && reviewer.activity.assignments_viewed}
                      </div>

                      {/* Reminders sent indicator */}
                      {reviewer.activity.reminders_sent > 0 && (
                        <div
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700"
                          title={`${reviewer.activity.reminders_sent} reminder(s) sent`}
                        >
                          <Bell className="h-3.5 w-3.5" />
                          {reviewer.activity.reminders_sent}
                        </div>
                      )}

                      {/* Activity status badge */}
                      <div
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                          reviewer.activity.activity_status === "active_today" && "bg-emerald-100 text-emerald-700",
                          reviewer.activity.activity_status === "active_recently" && "bg-blue-100 text-blue-700",
                          reviewer.activity.activity_status === "inactive_week" && "bg-amber-100 text-amber-700",
                          reviewer.activity.activity_status === "inactive_long" && "bg-red-100 text-red-700",
                          reviewer.activity.activity_status === "never_active" && "bg-gray-100 text-gray-500"
                        )}
                        title={
                          reviewer.activity.activity_status === "active_today" ? "Active today" :
                          reviewer.activity.activity_status === "active_recently" ? "Active in last 3 days" :
                          reviewer.activity.activity_status === "inactive_week" ? "Inactive for 3-7 days" :
                          reviewer.activity.activity_status === "inactive_long" ? "Inactive for 7+ days" :
                          "Never active"
                        }
                      >
                        <Activity className="h-3.5 w-3.5" />
                        {reviewer.activity.activity_status === "active_today" && "Today"}
                        {reviewer.activity.activity_status === "active_recently" && "Recent"}
                        {reviewer.activity.activity_status === "inactive_week" && "3-7d"}
                        {reviewer.activity.activity_status === "inactive_long" && "7d+"}
                        {reviewer.activity.activity_status === "never_active" && "Never"}
                      </div>

                      {/* Declined count */}
                      {reviewer.activity.assignments_declined > 0 && (
                        <div
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700"
                          title={`${reviewer.activity.assignments_declined} declined`}
                        >
                          <AlertOctagon className="h-3.5 w-3.5" />
                          {reviewer.activity.assignments_declined}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Workload Progress */}
                  <div className="w-40">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold">{reviewer.completedPercent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          reviewer.completedPercent >= 80 ? "bg-emerald-500" :
                          reviewer.completedPercent >= 50 ? "bg-amber-500" :
                          reviewer.completedPercent > 0 ? "bg-blue-500" : "bg-muted"
                        )}
                        style={{ width: `${reviewer.completedPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Assigned */}
                  <div className="text-center min-w-[60px]">
                    <p className="text-2xl font-bold">{reviewer.assignedCount}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Assigned</p>
                  </div>

                  {/* Pending */}
                  <div className="text-center min-w-[60px]">
                    <p className={cn(
                      "text-2xl font-bold",
                      reviewer.pendingCount > 0 ? "text-amber-500" : "text-muted-foreground"
                    )}>
                      {reviewer.pendingCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending</p>
                  </div>

                  {/* Completed */}
                  <div className="text-center min-w-[60px]">
                    <p className="text-2xl font-bold text-emerald-600">{reviewer.review_count}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Done</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Copy review link"
                      onClick={() => {
                        const link = `${window.location.origin}/abstract-reviewer/${eventId}`
                        const text = `Review Portal Link: ${link}\nEmail: ${reviewer.email}\n\nOpen the link and enter your email to access your assigned abstracts.`
                        navigator.clipboard.writeText(text)
                        toast.success("Review link copied!", { description: `Link + email for ${reviewer.name}` })
                      }}
                      className="h-9 w-9 rounded-xl hover:bg-blue-500/10"
                    >
                      <Copy className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit reviewer"
                      onClick={() => handleEditClick(reviewer)}
                      className="h-9 w-9 rounded-xl hover:bg-primary/10"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Remove reviewer"
                      onClick={() => {
                        if (confirm("Remove this reviewer from the event?")) {
                          deleteReviewer.mutate(reviewer.id)
                        }
                      }}
                      className="h-9 w-9 rounded-xl hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Workload Bar (background) */}
              <div
                className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-primary/50 to-purple-500/50 transition-all"
                style={{ width: `${reviewer.workloadPercent}%` }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Add Reviewer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open)
        if (!open) {
          setAddMode("pool")
          setPoolSearch("")
          setSelectedFromPool([])
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <Plus className="h-4 w-4 text-white" />
              </div>
              Add Reviewer
            </DialogTitle>
          </DialogHeader>

          {/* Mode Toggle */}
          <div className="flex gap-2 p-1 rounded-xl bg-muted/50">
            <button
              onClick={() => setAddMode("pool")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all",
                addMode === "pool"
                  ? "bg-background shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-4 w-4" />
              Select from Pool
            </button>
            <button
              onClick={() => setAddMode("manual")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all",
                addMode === "manual"
                  ? "bg-background shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Plus className="h-4 w-4" />
              Add New
            </button>
          </div>

          {addMode === "pool" ? (
            <>
              {/* Pool Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reviewers by name, email, specialty..."
                  value={poolSearch}
                  onChange={(e) => setPoolSearch(e.target.value)}
                  className="pl-10 h-11 rounded-xl"
                />
              </div>

              {/* Pool List */}
              <div className="rounded-xl border max-h-[320px] overflow-auto">
                {availableFromPool.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      {poolSearch ? "No matching reviewers found" : "No available reviewers in pool"}
                    </p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => setAddMode("manual")}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add new reviewer
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {availableFromPool.slice(0, 50).map((p) => (
                      <label
                        key={p.id}
                        className={cn(
                          "flex items-center gap-4 p-4 cursor-pointer transition-colors",
                          selectedFromPool.includes(p.id)
                            ? "bg-primary/5"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <Checkbox
                          checked={selectedFromPool.includes(p.id)}
                          onCheckedChange={(checked) => {
                            setSelectedFromPool(prev =>
                              checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                            )
                          }}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <div className={cn(
                          "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-semibold text-sm flex-shrink-0",
                          getGradient(p.name)
                        )}>
                          {getInitials(p.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{p.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{p.email}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                          {p.specialty && (
                            <p className="truncate max-w-[150px] px-2 py-0.5 rounded-full bg-muted">{p.specialty.split(",")[0]}</p>
                          )}
                          {p.institution && <p className="truncate max-w-[150px] mt-1">{p.institution}</p>}
                        </div>
                      </label>
                    ))}
                    {availableFromPool.length > 50 && (
                      <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30">
                        Showing first 50 of {availableFromPool.length} - refine your search
                      </p>
                    )}
                  </div>
                )}
              </div>

              {selectedFromPool.length > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <span className="text-sm">
                    <strong>{selectedFromPool.length}</strong> reviewer{selectedFromPool.length !== 1 ? "s" : ""} selected
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedFromPool([])}
                    className="text-xs"
                  >
                    Clear all
                  </Button>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={() => addFromPool.mutate(selectedFromPool)}
                  disabled={selectedFromPool.length === 0 || addFromPool.isPending}
                  className="rounded-xl bg-gradient-to-r from-primary to-purple-600"
                >
                  {addFromPool.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add {selectedFromPool.length || ""} Reviewer{selectedFromPool.length !== 1 ? "s" : ""}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              {/* Manual Add Form */}
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-900">New Reviewer</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        They will be added to the global pool and this event.
                        {!editForm.specialty && " A form will be sent to collect their specialty."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Name *</label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="Full name"
                      className="mt-1.5 h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email *</label>
                    <Input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="email@example.com"
                      className="mt-1.5 h-10 rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="Contact number"
                      className="mt-1.5 h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Institution</label>
                    <Input
                      value={editForm.institution}
                      onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                      placeholder="Hospital/University"
                      className="mt-1.5 h-10 rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">City</label>
                    <Input
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      placeholder="Location"
                      className="mt-1.5 h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Specialty</label>
                    <Input
                      value={editForm.specialty}
                      onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                      placeholder="Leave empty to send form"
                      className="mt-1.5 h-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={() => addNewToPoolAndEvent.mutate(editForm)}
                  disabled={!editForm.name.trim() || !editForm.email.trim() || addNewToPoolAndEvent.isPending}
                  className="rounded-xl bg-gradient-to-r from-primary to-purple-600"
                >
                  {addNewToPoolAndEvent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Reviewer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingReviewer} onOpenChange={(open) => !open && setEditingReviewer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {editingReviewer && (
                <div className={cn(
                  "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold",
                  getGradient(editingReviewer.name)
                )}>
                  {getInitials(editingReviewer.name)}
                </div>
              )}
              Edit Reviewer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
              <div>
                <label className="text-sm font-medium">City</label>
                <Input
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Institution</label>
              <Input
                value={editForm.institution}
                onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                className="mt-1.5 h-10 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Specialty</label>
                <Input
                  value={editForm.specialty}
                  onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Experience (Years)</label>
                <Input
                  value={editForm.years_of_experience}
                  onChange={(e) => setEditForm({ ...editForm, years_of_experience: e.target.value })}
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border">
              <label className="text-sm font-medium">Status</label>
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, status: "active" })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border transition-all",
                    editForm.status === "active"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
                      : "border-muted hover:border-muted-foreground/20"
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, status: "inactive" })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border transition-all",
                    editForm.status === "inactive"
                      ? "bg-gray-500/10 border-gray-500/30 text-gray-700"
                      : "border-muted hover:border-muted-foreground/20"
                  )}
                >
                  <Clock className="h-4 w-4" />
                  Inactive
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Internal Notes</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
                placeholder="Private notes about this reviewer..."
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setEditingReviewer(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateReviewer.isPending}
              className="rounded-xl bg-gradient-to-r from-primary to-purple-600"
            >
              {updateReviewer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
