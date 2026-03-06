"use client"

import { useState, useMemo, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Search,
  Loader2,
  Users,
  UserCheck,
  Upload,
  Download,
  Plus,
  Trash2,
  Mail,
  CheckCircle,
  X,
  Phone,
  Building,
  MapPin,
  Clock,
  FileText,
  Send,
  ExternalLink,
  Award,
  GraduationCap,
  Crown,
  Camera,
  Linkedin,
  BookOpen,
  Globe,
  Star,
  BarChart3,
  Calendar,
  MessageSquare,
  Edit3,
  Link2,
  User,
  Briefcase,
  Target,
  Activity,
  AlertTriangle,
  Sparkles,
  Zap,
  TrendingUp,
  Eye,
  Filter,
  LayoutGrid,
  List,
  ChevronRight,
  Heart,
  Shield,
  Verified,
} from "lucide-react"
import { toast } from "sonner"
import { CSVImportDynamic } from "@/components/ui/csv-import-dynamic"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

type Reviewer = {
  id: string
  name: string
  email: string
  phone: string | null
  institution: string | null
  city: string | null
  specialty: string | null
  years_of_experience: string | null
  status: string
  notes: string | null
  form_token: string | null
  form_completed_at: string | null
  created_at: string
  updated_at: string
  amasi_membership_number: string | null
  is_amasi_member: boolean
  member_status: string | null
  is_amasi_faculty: boolean
  photo_url: string | null
  bio: string | null
  designation: string | null
  linkedin_url: string | null
  orcid_id: string | null
  publications_count: number
  research_interests: string | null
  languages: string[] | null
  available_for_review: boolean
  max_reviews_per_month: number
  total_reviews_completed: number
  avg_review_time_days: number | null
  last_review_at: string | null
  rating: number | null
}

type DuplicateGroup = {
  name: string
  reviewers: Reviewer[]
}

const csvFields = [
  { key: "name", label: "Name", required: true, description: "Full name" },
  { key: "email", label: "Email", required: true, description: "Email address" },
  { key: "phone", label: "Phone Number", description: "Contact number" },
  { key: "institution", label: "Institution/Hospital", description: "Organization" },
  { key: "city", label: "City", description: "City location" },
  { key: "specialty", label: "Specialty Interests", description: "Areas of expertise" },
  { key: "years_of_experience", label: "Years of Experience", description: "Years in field" },
  { key: "status", label: "Availability Status", description: "Yes/Maybe = active" },
  { key: "notes", label: "Notes (Internal)", description: "Internal notes" },
]

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

export default function ReviewersPoolPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [showImport, setShowImport] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedReviewer, setSelectedReviewer] = useState<Reviewer | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false)
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
    bio: "",
    designation: "",
    linkedin_url: "",
    orcid_id: "",
    research_interests: "",
    publications_count: 0,
    available_for_review: true,
    max_reviews_per_month: 5,
  })

  // Fetch all reviewers with duplicate check
  const { data: reviewers = [], isLoading } = useQuery({
    queryKey: ["reviewers-pool"],
    queryFn: async () => {
      const res = await fetch("/api/reviewers-pool?check_duplicates=true")
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      if (json.reviewers && Array.isArray(json.duplicates)) {
        setDuplicates(json.duplicates)
        return json.reviewers as Reviewer[]
      }
      return json as Reviewer[]
    },
  })

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const method = data.id ? "PUT" : "POST"
      const res = await fetch("/api/reviewers-pool", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      setShowAddDialog(false)
      setIsEditing(false)
      if (selectedReviewer) {
        setSelectedReviewer(data)
      }
      toast.success("Saved successfully")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reviewers-pool?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      setSelectedReviewer(null)
      toast.success("Reviewer deleted")
    },
    onError: () => toast.error("Failed to delete"),
  })

  // Clear all mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/reviewers-pool?id=all`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to clear")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      setSelectedReviewer(null)
      toast.success("All reviewers cleared")
    },
    onError: () => toast.error("Failed to clear"),
  })

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const res = await fetch("/api/reviewers-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Import failed")
      }
      return res.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      setShowImport(false)
      toast.success(`Imported ${result.success} reviewers`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Photo upload
  const handlePhotoUpload = async (file: File) => {
    if (!selectedReviewer) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "reviewer-photos")
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) throw new Error("Upload failed")
      const { url } = await res.json()
      await saveMutation.mutateAsync({ id: selectedReviewer.id, photo_url: url })
      toast.success("Photo uploaded!")
    } catch (err) {
      toast.error("Failed to upload photo")
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Filter reviewers
  const filtered = useMemo(() => {
    return reviewers.filter((r) => {
      if (statusFilter === "active" && r.status !== "active") return false
      if (statusFilter === "inactive" && r.status !== "inactive") return false
      if (statusFilter === "pending" && !(r.form_token && !r.form_completed_at)) return false
      if (statusFilter === "members" && !r.is_amasi_member) return false
      if (statusFilter === "faculty" && !r.is_amasi_faculty) return false
      if (showOnlyAvailable && !r.available_for_review) return false

      if (search) {
        const s = search.toLowerCase()
        if (
          !r.name?.toLowerCase().includes(s) &&
          !r.email?.toLowerCase().includes(s) &&
          !r.institution?.toLowerCase().includes(s) &&
          !r.specialty?.toLowerCase().includes(s) &&
          !r.city?.toLowerCase().includes(s)
        ) {
          return false
        }
      }
      return true
    })
  }, [reviewers, search, statusFilter, showOnlyAvailable])

  // Stats
  const stats = useMemo(() => ({
    total: reviewers.length,
    active: reviewers.filter((r) => r.status === "active").length,
    members: reviewers.filter((r) => r.is_amasi_member).length,
    faculty: reviewers.filter((r) => r.is_amasi_faculty).length,
    available: reviewers.filter((r) => r.available_for_review).length,
  }), [reviewers])

  const resetForm = () => {
    setEditForm({
      name: "", email: "", phone: "", institution: "", city: "",
      specialty: "", years_of_experience: "", status: "active", notes: "",
      bio: "", designation: "", linkedin_url: "", orcid_id: "",
      research_interests: "", publications_count: 0,
      available_for_review: true, max_reviews_per_month: 5,
    })
  }

  const startEditing = () => {
    if (selectedReviewer) {
      setEditForm({
        name: selectedReviewer.name,
        email: selectedReviewer.email,
        phone: selectedReviewer.phone || "",
        institution: selectedReviewer.institution || "",
        city: selectedReviewer.city || "",
        specialty: selectedReviewer.specialty || "",
        years_of_experience: selectedReviewer.years_of_experience || "",
        status: selectedReviewer.status,
        notes: selectedReviewer.notes || "",
        bio: selectedReviewer.bio || "",
        designation: selectedReviewer.designation || "",
        linkedin_url: selectedReviewer.linkedin_url || "",
        orcid_id: selectedReviewer.orcid_id || "",
        research_interests: selectedReviewer.research_interests || "",
        publications_count: selectedReviewer.publications_count || 0,
        available_for_review: selectedReviewer.available_for_review ?? true,
        max_reviews_per_month: selectedReviewer.max_reviews_per_month || 5,
      })
      setIsEditing(true)
    }
  }

  const exportCSV = () => {
    if (filtered.length === 0) return toast.error("No reviewers to export")
    const headers = ["Name", "Email", "Phone", "Institution", "City", "Specialty", "Experience", "Status", "Member", "Faculty"]
    const rows = filtered.map((r) => [
      `"${r.name}"`, r.email, r.phone || "", `"${r.institution || ""}"`,
      r.city || "", `"${r.specialty || ""}"`, r.years_of_experience || "",
      r.status, r.is_amasi_member ? "Yes" : "No", r.is_amasi_faculty ? "Yes" : "No",
    ])
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `reviewers-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    toast.success(`Exported ${filtered.length} reviewers`)
  }

  const getFormUrl = (token: string) => `${window.location.origin}/reviewer-form/${token}`

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  }

  const getRatingStars = (rating: number | null) => {
    if (!rating) return null
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
      />
    ))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin mx-auto" />
            <Sparkles className="h-8 w-8 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-purple-300 font-medium">Loading reviewers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-2000" />
      </div>

      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-white/10 bg-black/20 backdrop-blur-xl px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  Reviewers Pool
                  <Sparkles className="h-5 w-5 text-yellow-400" />
                </h1>
                <p className="text-sm text-purple-300">Manage expert reviewers across all events</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {duplicates.length > 0 && (
                <Button
                  onClick={() => setShowDuplicates(true)}
                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {duplicates.length} Duplicates
                </Button>
              )}
              {reviewers.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                  onClick={() => {
                    if (confirm(`Delete ALL ${reviewers.length} reviewers?`)) {
                      clearAllMutation.mutate()
                    }
                  }}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              )}
              <Button
                onClick={exportCSV}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={() => setShowImport(true)}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/25"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button
                onClick={() => { resetForm(); setShowAddDialog(true) }}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Reviewer
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-5 gap-4 mt-6">
            <button
              onClick={() => setStatusFilter("all")}
              className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 ${
                statusFilter === "all"
                  ? "bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/25 scale-105"
                  : "bg-white/5 hover:bg-white/10 border border-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-3xl font-bold ${statusFilter === "all" ? "text-white" : "text-white"}`}>{stats.total}</p>
                  <p className={`text-sm ${statusFilter === "all" ? "text-white/80" : "text-purple-300"}`}>Total Reviewers</p>
                </div>
                <Users className={`h-8 w-8 ${statusFilter === "all" ? "text-white/50" : "text-purple-400"}`} />
              </div>
              {statusFilter === "all" && <div className="absolute inset-0 bg-white/10 animate-pulse" />}
            </button>

            <button
              onClick={() => setStatusFilter("active")}
              className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 ${
                statusFilter === "active"
                  ? "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25 scale-105"
                  : "bg-white/5 hover:bg-white/10 border border-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-3xl font-bold ${statusFilter === "active" ? "text-white" : "text-white"}`}>{stats.active}</p>
                  <p className={`text-sm ${statusFilter === "active" ? "text-white/80" : "text-emerald-300"}`}>Active</p>
                </div>
                <UserCheck className={`h-8 w-8 ${statusFilter === "active" ? "text-white/50" : "text-emerald-400"}`} />
              </div>
            </button>

            <button
              onClick={() => setStatusFilter("members")}
              className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 ${
                statusFilter === "members"
                  ? "bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25 scale-105"
                  : "bg-white/5 hover:bg-white/10 border border-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-3xl font-bold ${statusFilter === "members" ? "text-white" : "text-white"}`}>{stats.members}</p>
                  <p className={`text-sm ${statusFilter === "members" ? "text-white/80" : "text-violet-300"}`}>AMASI Members</p>
                </div>
                <Award className={`h-8 w-8 ${statusFilter === "members" ? "text-white/50" : "text-violet-400"}`} />
              </div>
            </button>

            <button
              onClick={() => setStatusFilter("faculty")}
              className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 ${
                statusFilter === "faculty"
                  ? "bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25 scale-105"
                  : "bg-white/5 hover:bg-white/10 border border-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-3xl font-bold ${statusFilter === "faculty" ? "text-white" : "text-white"}`}>{stats.faculty}</p>
                  <p className={`text-sm ${statusFilter === "faculty" ? "text-white/80" : "text-orange-300"}`}>Faculty</p>
                </div>
                <GraduationCap className={`h-8 w-8 ${statusFilter === "faculty" ? "text-white/50" : "text-orange-400"}`} />
              </div>
            </button>

            <div className="relative overflow-hidden rounded-2xl p-4 bg-white/5 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-white">{stats.available}</p>
                  <p className="text-sm text-green-300">Available Now</p>
                </div>
                <Zap className="h-8 w-8 text-green-400" />
              </div>
              <div className="absolute top-2 right-2">
                <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* List Panel */}
          <div className="w-[420px] border-r border-white/10 flex flex-col bg-black/20 backdrop-blur-sm">
            {/* Search & Filters */}
            <div className="p-4 border-b border-white/10 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-400" />
                <Input
                  placeholder="Search by name, email, specialty..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-purple-300/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <Switch
                      checked={showOnlyAvailable}
                      onCheckedChange={setShowOnlyAvailable}
                      className="data-[state=checked]:bg-green-500"
                    />
                    <span className="text-sm text-purple-300">Available only</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-purple-500 text-white" : "text-purple-300 hover:text-white"}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? "bg-purple-500 text-white" : "text-purple-300 hover:text-white"}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Reviewer List */}
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <div className="h-20 w-20 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                    <Users className="h-10 w-10 text-purple-400" />
                  </div>
                  <p className="text-white font-medium">{reviewers.length === 0 ? "No reviewers yet" : "No matches found"}</p>
                  <p className="text-purple-300 text-sm mt-1">
                    {reviewers.length === 0 ? "Import a CSV or add manually" : "Try different search terms"}
                  </p>
                  {reviewers.length === 0 && (
                    <Button
                      onClick={() => setShowImport(true)}
                      className="mt-4 bg-gradient-to-r from-purple-500 to-pink-500"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import CSV
                    </Button>
                  )}
                </div>
              ) : (
                filtered.map((reviewer) => (
                  <button
                    key={reviewer.id}
                    onClick={() => { setSelectedReviewer(reviewer); setIsEditing(false); setActiveTab("profile") }}
                    className={`w-full text-left p-4 rounded-2xl transition-all duration-300 group ${
                      selectedReviewer?.id === reviewer.id
                        ? "bg-gradient-to-r from-purple-500/30 to-pink-500/30 border-2 border-purple-500/50 shadow-lg shadow-purple-500/20"
                        : "bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/20"
                    }`}
                  >
                    <div className="flex gap-4">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {reviewer.photo_url ? (
                          <img
                            src={reviewer.photo_url}
                            alt={reviewer.name}
                            className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white/20"
                          />
                        ) : (
                          <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${getGradient(reviewer.name)} flex items-center justify-center text-white font-bold shadow-lg`}>
                            {getInitials(reviewer.name)}
                          </div>
                        )}
                        {reviewer.available_for_review && (
                          <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-green-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                            <Zap className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white truncate">{reviewer.name}</p>
                          {reviewer.is_amasi_member && (
                            <div className="h-5 w-5 rounded-full bg-violet-500/30 flex items-center justify-center">
                              <Award className="h-3 w-3 text-violet-400" />
                            </div>
                          )}
                          {reviewer.is_amasi_faculty && (
                            <div className="h-5 w-5 rounded-full bg-orange-500/30 flex items-center justify-center">
                              <GraduationCap className="h-3 w-3 text-orange-400" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-purple-300 truncate">
                          {reviewer.designation || reviewer.institution || reviewer.email}
                        </p>
                        {reviewer.specialty && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {reviewer.specialty.split(",").slice(0, 2).map((s, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                {s.trim()}
                              </span>
                            ))}
                            {reviewer.specialty.split(",").length > 2 && (
                              <span className="text-[10px] text-purple-400">+{reviewer.specialty.split(",").length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Arrow */}
                      <ChevronRight className={`h-5 w-5 text-purple-400 transition-transform ${selectedReviewer?.id === reviewer.id ? "translate-x-1" : "group-hover:translate-x-1"}`} />
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-black/20">
              <div className="flex items-center justify-between text-sm">
                <span className="text-purple-300">
                  Showing <span className="text-white font-semibold">{filtered.length}</span> of <span className="text-white font-semibold">{reviewers.length}</span>
                </span>
                {search && (
                  <button onClick={() => setSearch("")} className="text-purple-400 hover:text-purple-300 flex items-center gap-1">
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Detail Panel */}
          <div className="flex-1 overflow-auto">
            {selectedReviewer ? (
              <div className="p-6 max-w-4xl mx-auto">
                {isEditing ? (
                  /* Edit Form */
                  <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Edit3 className="h-6 w-6 text-purple-400" />
                        Edit Profile
                      </h2>
                      <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)} className="text-purple-300 hover:text-white hover:bg-white/10">
                        <X className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {/* Basic Info */}
                      <div className="col-span-2 p-6 rounded-2xl bg-white/5 border border-white/10">
                        <h3 className="text-sm font-semibold text-purple-300 mb-4 flex items-center gap-2">
                          <User className="h-4 w-4" /> Basic Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-purple-300">Name *</Label>
                            <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="bg-white/5 border-white/20 text-white mt-1" />
                          </div>
                          <div>
                            <Label className="text-purple-300">Email *</Label>
                            <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="bg-white/5 border-white/20 text-white mt-1" />
                          </div>
                          <div>
                            <Label className="text-purple-300">Designation</Label>
                            <Input value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} placeholder="e.g., Senior Consultant" className="bg-white/5 border-white/20 text-white placeholder:text-purple-300/50 mt-1" />
                          </div>
                          <div>
                            <Label className="text-purple-300">Phone</Label>
                            <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="bg-white/5 border-white/20 text-white mt-1" />
                          </div>
                        </div>
                      </div>

                      {/* Institution */}
                      <div className="col-span-2 p-6 rounded-2xl bg-white/5 border border-white/10">
                        <h3 className="text-sm font-semibold text-purple-300 mb-4 flex items-center gap-2">
                          <Building className="h-4 w-4" /> Institution
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-purple-300">Institution/Hospital</Label>
                            <Input value={editForm.institution} onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })} className="bg-white/5 border-white/20 text-white mt-1" />
                          </div>
                          <div>
                            <Label className="text-purple-300">City</Label>
                            <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="bg-white/5 border-white/20 text-white mt-1" />
                          </div>
                        </div>
                      </div>

                      {/* Expertise */}
                      <div className="col-span-2 p-6 rounded-2xl bg-white/5 border border-white/10">
                        <h3 className="text-sm font-semibold text-purple-300 mb-4 flex items-center gap-2">
                          <Target className="h-4 w-4" /> Expertise
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-purple-300">Specialty (comma separated)</Label>
                            <Textarea value={editForm.specialty} onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })} rows={2} className="bg-white/5 border-white/20 text-white mt-1" />
                          </div>
                          <div>
                            <Label className="text-purple-300">Research Interests</Label>
                            <Textarea value={editForm.research_interests} onChange={(e) => setEditForm({ ...editForm, research_interests: e.target.value })} rows={2} className="bg-white/5 border-white/20 text-white mt-1" />
                          </div>
                          <div>
                            <Label className="text-purple-300">Years of Experience</Label>
                            <Input value={editForm.years_of_experience} onChange={(e) => setEditForm({ ...editForm, years_of_experience: e.target.value })} className="bg-white/5 border-white/20 text-white mt-1" />
                          </div>
                          <div>
                            <Label className="text-purple-300">Publications Count</Label>
                            <Input type="number" value={editForm.publications_count} onChange={(e) => setEditForm({ ...editForm, publications_count: parseInt(e.target.value) || 0 })} className="bg-white/5 border-white/20 text-white mt-1" />
                          </div>
                        </div>
                      </div>

                      {/* Links */}
                      <div className="col-span-2 p-6 rounded-2xl bg-white/5 border border-white/10">
                        <h3 className="text-sm font-semibold text-purple-300 mb-4 flex items-center gap-2">
                          <Link2 className="h-4 w-4" /> Online Profiles
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-purple-300">LinkedIn URL</Label>
                            <Input value={editForm.linkedin_url} onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." className="bg-white/5 border-white/20 text-white placeholder:text-purple-300/50 mt-1" />
                          </div>
                          <div>
                            <Label className="text-purple-300">ORCID ID</Label>
                            <Input value={editForm.orcid_id} onChange={(e) => setEditForm({ ...editForm, orcid_id: e.target.value })} placeholder="0000-0000-0000-0000" className="bg-white/5 border-white/20 text-white placeholder:text-purple-300/50 mt-1" />
                          </div>
                        </div>
                      </div>

                      {/* Bio */}
                      <div className="col-span-2">
                        <Label className="text-purple-300">Bio / About</Label>
                        <Textarea value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} rows={3} placeholder="Brief professional bio..." className="bg-white/5 border-white/20 text-white placeholder:text-purple-300/50 mt-1" />
                      </div>

                      {/* Review Settings */}
                      <div className="col-span-2 p-6 rounded-2xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                        <h3 className="text-sm font-semibold text-green-300 mb-4 flex items-center gap-2">
                          <Zap className="h-4 w-4" /> Availability Settings
                        </h3>
                        <div className="flex items-center gap-8">
                          <div className="flex items-center gap-3">
                            <Switch checked={editForm.available_for_review} onCheckedChange={(c) => setEditForm({ ...editForm, available_for_review: c })} className="data-[state=checked]:bg-green-500" />
                            <Label className="text-green-300">Available for Review</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <Label className="text-green-300">Max Reviews/Month:</Label>
                            <Input type="number" className="w-20 bg-white/5 border-green-500/30 text-white" value={editForm.max_reviews_per_month} onChange={(e) => setEditForm({ ...editForm, max_reviews_per_month: parseInt(e.target.value) || 5 })} />
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="col-span-2">
                        <Label className="text-purple-300">Internal Notes</Label>
                        <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} className="bg-white/5 border-white/20 text-white mt-1" />
                      </div>
                    </div>

                    <div className="flex gap-4 mt-8 pt-6 border-t border-white/10">
                      <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1 border-white/20 text-white hover:bg-white/10">
                        Cancel
                      </Button>
                      <Button onClick={() => saveMutation.mutate({ ...editForm, id: selectedReviewer.id })} disabled={saveMutation.isPending} className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                        {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Profile View */
                  <div className="space-y-6">
                    {/* Profile Header Card */}
                    <div className="relative overflow-hidden rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
                      {/* Cover Gradient */}
                      <div className="h-32 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 relative">
                        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-30" />
                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
                      </div>

                      <div className="px-8 pb-8">
                        <div className="flex items-end gap-6 -mt-16 relative z-10">
                          {/* Avatar */}
                          <div className="relative group">
                            {selectedReviewer.photo_url ? (
                              <img
                                src={selectedReviewer.photo_url}
                                alt={selectedReviewer.name}
                                className="h-32 w-32 rounded-3xl object-cover ring-4 ring-slate-900 shadow-2xl"
                              />
                            ) : (
                              <div className={`h-32 w-32 rounded-3xl bg-gradient-to-br ${getGradient(selectedReviewer.name)} flex items-center justify-center text-white text-4xl font-bold ring-4 ring-slate-900 shadow-2xl`}>
                                {getInitials(selectedReviewer.name)}
                              </div>
                            )}
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                            />
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="absolute inset-0 rounded-3xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              disabled={uploadingPhoto}
                            >
                              {uploadingPhoto ? <Loader2 className="h-8 w-8 text-white animate-spin" /> : <Camera className="h-8 w-8 text-white" />}
                            </button>
                            {selectedReviewer.available_for_review && (
                              <div className="absolute -bottom-2 -right-2 h-8 w-8 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/50">
                                <Zap className="h-4 w-4 text-white" />
                              </div>
                            )}
                          </div>

                          {/* Name & Title */}
                          <div className="flex-1 pb-2">
                            <div className="flex items-center gap-3 mb-1">
                              <h1 className="text-3xl font-bold text-white">{selectedReviewer.name}</h1>
                              {selectedReviewer.is_amasi_member && (
                                <div className="px-3 py-1 rounded-full bg-violet-500/30 border border-violet-500/50 flex items-center gap-1">
                                  <Award className="h-4 w-4 text-violet-400" />
                                  <span className="text-xs font-semibold text-violet-300">Member</span>
                                </div>
                              )}
                              {selectedReviewer.is_amasi_faculty && (
                                <div className="px-3 py-1 rounded-full bg-orange-500/30 border border-orange-500/50 flex items-center gap-1">
                                  <GraduationCap className="h-4 w-4 text-orange-400" />
                                  <span className="text-xs font-semibold text-orange-300">Faculty</span>
                                </div>
                              )}
                            </div>
                            <p className="text-purple-300 text-lg">{selectedReviewer.designation || selectedReviewer.institution}</p>
                            {selectedReviewer.rating && (
                              <div className="flex items-center gap-1 mt-2">{getRatingStars(selectedReviewer.rating)}</div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-3 pb-2">
                            <Button onClick={startEditing} className="bg-white/10 hover:bg-white/20 text-white border border-white/20">
                              <Edit3 className="h-4 w-4 mr-2" />
                              Edit Profile
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              onClick={() => confirm("Delete this reviewer?") && deleteMutation.mutate(selectedReviewer.id)}
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-4 gap-4 mt-8">
                          <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                            <p className="text-3xl font-bold text-white">{selectedReviewer.total_reviews_completed || 0}</p>
                            <p className="text-sm text-purple-300">Reviews Done</p>
                          </div>
                          <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
                            <p className="text-3xl font-bold text-white">{selectedReviewer.years_of_experience || 0}</p>
                            <p className="text-sm text-green-300">Years Exp.</p>
                          </div>
                          <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                            <p className="text-3xl font-bold text-white">{selectedReviewer.publications_count || 0}</p>
                            <p className="text-sm text-blue-300">Publications</p>
                          </div>
                          <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30">
                            <p className="text-3xl font-bold text-white">{selectedReviewer.avg_review_time_days || "—"}</p>
                            <p className="text-sm text-orange-300">Avg Days</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="bg-white/5 border border-white/10 rounded-2xl p-1.5 w-full justify-start">
                        <TabsTrigger value="profile" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white text-purple-300">
                          <User className="h-4 w-4 mr-2" />
                          Profile
                        </TabsTrigger>
                        <TabsTrigger value="expertise" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white text-purple-300">
                          <Target className="h-4 w-4 mr-2" />
                          Expertise
                        </TabsTrigger>
                        <TabsTrigger value="reviews" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white text-purple-300">
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Reviews
                        </TabsTrigger>
                        <TabsTrigger value="contact" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white text-purple-300">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Contact
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="profile" className="mt-6 space-y-6">
                        {/* Bio */}
                        {selectedReviewer.bio && (
                          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                              <User className="h-5 w-5 text-purple-400" /> About
                            </h3>
                            <p className="text-purple-200 leading-relaxed">{selectedReviewer.bio}</p>
                          </div>
                        )}

                        {/* AMASI Status */}
                        {(selectedReviewer.is_amasi_member || selectedReviewer.is_amasi_faculty) && (
                          <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-amber-500/30">
                            <h3 className="font-semibold text-amber-300 mb-4 flex items-center gap-2">
                              <Crown className="h-5 w-5" /> AMASI Association
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              {selectedReviewer.is_amasi_member && (
                                <div className="p-4 rounded-xl bg-violet-500/20 border border-violet-500/30">
                                  <div className="flex items-center gap-2 text-violet-300 mb-2">
                                    <Verified className="h-5 w-5" />
                                    <span className="font-medium">AMASI Member</span>
                                  </div>
                                  <p className="text-2xl font-bold text-white">
                                    {selectedReviewer.amasi_membership_number ? `#${selectedReviewer.amasi_membership_number}` : "Active"}
                                  </p>
                                </div>
                              )}
                              {selectedReviewer.is_amasi_faculty && (
                                <div className="p-4 rounded-xl bg-orange-500/20 border border-orange-500/30">
                                  <div className="flex items-center gap-2 text-orange-300 mb-2">
                                    <GraduationCap className="h-5 w-5" />
                                    <span className="font-medium">Faculty Status</span>
                                  </div>
                                  <p className="text-2xl font-bold text-white">AMASI Faculty</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Availability */}
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-purple-400" /> Availability
                          </h3>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`h-4 w-4 rounded-full ${selectedReviewer.available_for_review ? "bg-green-500 shadow-lg shadow-green-500/50" : "bg-gray-500"}`} />
                              <span className={`font-medium ${selectedReviewer.available_for_review ? "text-green-400" : "text-gray-400"}`}>
                                {selectedReviewer.available_for_review ? "Available for Review" : "Not Available"}
                              </span>
                            </div>
                            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                              <span className="text-purple-300">Max <span className="text-white font-bold">{selectedReviewer.max_reviews_per_month || 5}</span> reviews/month</span>
                            </div>
                          </div>
                          {selectedReviewer.last_review_at && (
                            <p className="text-sm text-purple-400 mt-4">
                              Last review: {new Date(selectedReviewer.last_review_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>

                        {/* Links */}
                        {(selectedReviewer.linkedin_url || selectedReviewer.orcid_id) && (
                          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                              <Globe className="h-5 w-5 text-purple-400" /> Online Profiles
                            </h3>
                            <div className="flex gap-4">
                              {selectedReviewer.linkedin_url && (
                                <a href={selectedReviewer.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors border border-blue-500/30">
                                  <Linkedin className="h-5 w-5" />
                                  LinkedIn Profile
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                              {selectedReviewer.orcid_id && (
                                <a href={`https://orcid.org/${selectedReviewer.orcid_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-xl bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors border border-green-500/30">
                                  <BookOpen className="h-5 w-5" />
                                  ORCID
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="expertise" className="mt-6 space-y-6">
                        {/* Specialties */}
                        {selectedReviewer.specialty && (
                          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                              <Target className="h-5 w-5 text-purple-400" /> Specialties
                            </h3>
                            <div className="flex flex-wrap gap-3">
                              {selectedReviewer.specialty.split(",").map((s, i) => (
                                <span key={i} className="px-5 py-2.5 rounded-2xl text-sm font-medium bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-200 border border-purple-500/30 hover:border-purple-400/50 transition-colors cursor-default">
                                  {s.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Research Interests */}
                        {selectedReviewer.research_interests && (
                          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                              <BookOpen className="h-5 w-5 text-purple-400" /> Research Interests
                            </h3>
                            <p className="text-purple-200 leading-relaxed">{selectedReviewer.research_interests}</p>
                          </div>
                        )}

                        {/* Experience & Publications */}
                        <div className="grid grid-cols-2 gap-6">
                          <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30">
                            <div className="flex items-center gap-4">
                              <div className="h-16 w-16 rounded-2xl bg-green-500/20 flex items-center justify-center">
                                <Briefcase className="h-8 w-8 text-green-400" />
                              </div>
                              <div>
                                <p className="text-4xl font-bold text-white">{selectedReviewer.years_of_experience || 0}</p>
                                <p className="text-green-300">Years Experience</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
                            <div className="flex items-center gap-4">
                              <div className="h-16 w-16 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                                <FileText className="h-8 w-8 text-blue-400" />
                              </div>
                              <div>
                                <p className="text-4xl font-bold text-white">{selectedReviewer.publications_count || 0}</p>
                                <p className="text-blue-300">Publications</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="reviews" className="mt-6 space-y-6">
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                          <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-purple-400" /> Review Statistics
                          </h3>
                          <div className="grid grid-cols-3 gap-6">
                            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                              <p className="text-5xl font-bold text-white">{selectedReviewer.total_reviews_completed || 0}</p>
                              <p className="text-purple-300 mt-2">Total Reviews</p>
                            </div>
                            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
                              <p className="text-5xl font-bold text-white">{selectedReviewer.avg_review_time_days || "—"}</p>
                              <p className="text-green-300 mt-2">Avg Days</p>
                            </div>
                            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border border-yellow-500/30">
                              <div className="flex justify-center mb-2">{getRatingStars(selectedReviewer.rating)}</div>
                              <p className="text-3xl font-bold text-white">{selectedReviewer.rating || "—"}</p>
                              <p className="text-yellow-300 mt-1">Rating</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                          <h3 className="font-semibold text-white mb-4">Recent Activity</h3>
                          <div className="text-center py-12">
                            <Activity className="h-12 w-12 mx-auto mb-4 text-purple-500/50" />
                            <p className="text-purple-300">No recent review activity</p>
                            <p className="text-sm text-purple-400 mt-1">Activity will appear here once reviews are assigned</p>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="contact" className="mt-6 space-y-6">
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                          <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-purple-400" /> Contact Information
                          </h3>
                          <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 group hover:border-purple-500/50 transition-colors">
                              <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <Mail className="h-6 w-6 text-purple-400" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-purple-400">Email</p>
                                <p className="font-medium text-white">{selectedReviewer.email}</p>
                              </div>
                              <Button
                                onClick={() => window.open(`mailto:${selectedReviewer.email}`)}
                                className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30"
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Send Email
                              </Button>
                            </div>
                            {selectedReviewer.phone && (
                              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className="h-12 w-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                  <Phone className="h-6 w-6 text-green-400" />
                                </div>
                                <div>
                                  <p className="text-sm text-green-400">Phone</p>
                                  <p className="font-medium text-white">{selectedReviewer.phone}</p>
                                </div>
                              </div>
                            )}
                            {selectedReviewer.institution && (
                              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                  <Building className="h-6 w-6 text-blue-400" />
                                </div>
                                <div>
                                  <p className="text-sm text-blue-400">Institution</p>
                                  <p className="font-medium text-white">{selectedReviewer.institution}</p>
                                </div>
                              </div>
                            )}
                            {selectedReviewer.city && (
                              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className="h-12 w-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                  <MapPin className="h-6 w-6 text-orange-400" />
                                </div>
                                <div>
                                  <p className="text-sm text-orange-400">Location</p>
                                  <p className="font-medium text-white">{selectedReviewer.city}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Form Status */}
                        {selectedReviewer.form_token && (
                          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                            <h3 className="font-semibold text-white mb-4">Registration Form</h3>
                            {selectedReviewer.form_completed_at ? (
                              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/20 border border-green-500/30">
                                <CheckCircle className="h-6 w-6 text-green-400" />
                                <span className="text-green-300">Completed on {new Date(selectedReviewer.form_completed_at).toLocaleDateString()}</span>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/20 border border-amber-500/30">
                                  <Clock className="h-6 w-6 text-amber-400" />
                                  <span className="text-amber-300">Awaiting response</span>
                                </div>
                                <div className="flex gap-3">
                                  <Button onClick={() => { navigator.clipboard.writeText(getFormUrl(selectedReviewer.form_token!)); toast.success("Copied!") }} className="bg-white/10 hover:bg-white/20 text-white border border-white/20">
                                    Copy Link
                                  </Button>
                                  <Button onClick={() => window.open(`mailto:${selectedReviewer.email}?subject=Complete Your AMASI Registration&body=Please complete: ${getFormUrl(selectedReviewer.form_token!)}`)} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                                    <Send className="h-4 w-4 mr-2" />
                                    Send Reminder
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Notes */}
                        {selectedReviewer.notes && (
                          <div className="p-6 rounded-2xl bg-yellow-500/10 border border-yellow-500/30">
                            <h3 className="font-semibold text-yellow-300 mb-3 flex items-center gap-2">
                              <FileText className="h-5 w-5" />
                              Internal Notes
                            </h3>
                            <p className="text-yellow-200">{selectedReviewer.notes}</p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-12">
                <div className="relative">
                  <div className="h-32 w-32 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-6">
                    <Users className="h-16 w-16 text-purple-400" />
                  </div>
                  <Sparkles className="h-8 w-8 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Select a Reviewer</h2>
                <p className="text-purple-300 max-w-md">
                  Click on a reviewer from the list to view their detailed profile, expertise, and review statistics.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowAddDialog(open) }}>
        <DialogContent className="max-w-lg bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-400" />
              Add New Reviewer
            </DialogTitle>
            <DialogDescription className="text-purple-300">
              Add a new reviewer to the global pool.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-purple-300">Name *</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="bg-white/5 border-white/20 text-white mt-1" />
              </div>
              <div>
                <Label className="text-purple-300">Email *</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="bg-white/5 border-white/20 text-white mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-purple-300">Designation</Label>
                <Input value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} placeholder="Senior Consultant" className="bg-white/5 border-white/20 text-white placeholder:text-purple-300/50 mt-1" />
              </div>
              <div>
                <Label className="text-purple-300">Institution</Label>
                <Input value={editForm.institution} onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })} className="bg-white/5 border-white/20 text-white mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-purple-300">Specialty</Label>
              <Input value={editForm.specialty} onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })} placeholder="Leave empty to send registration form" className="bg-white/5 border-white/20 text-white placeholder:text-purple-300/50 mt-1" />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="border-white/20 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate(editForm)} disabled={saveMutation.isPending || !editForm.name || !editForm.email} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Reviewer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-white/10">
          <CSVImportDynamic
            title="Import Reviewers"
            description="Upload a CSV file with reviewer information"
            standardFields={csvFields}
            templateFileName="reviewers-template.csv"
            onImport={async (data) => {
              const result = await importMutation.mutateAsync(data)
              return { success: result.success || 0, failed: result.failed || 0, errors: [] }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Duplicates Dialog */}
      <Dialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
              Potential Duplicates Found
            </DialogTitle>
            <DialogDescription className="text-purple-300">
              These reviewers have the same name. Review and delete duplicates if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {duplicates.map((group, i) => (
              <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <h3 className="font-semibold text-lg text-white mb-4 capitalize flex items-center gap-2">
                  <User className="h-5 w-5 text-purple-400" />
                  {group.name}
                  <span className="text-sm px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {group.reviewers.length} entries
                  </span>
                </h3>
                <div className="space-y-3">
                  {group.reviewers.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-purple-500/50 transition-all group"
                      onClick={() => { setSelectedReviewer(r); setShowDuplicates(false) }}
                    >
                      <div className="flex items-center gap-4">
                        {r.photo_url ? (
                          <img src={r.photo_url} alt={r.name} className="h-12 w-12 rounded-xl object-cover" />
                        ) : (
                          <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${getGradient(r.name)} flex items-center justify-center text-white font-bold`}>
                            {getInitials(r.name)}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-white">{r.name}</p>
                          <p className="text-sm text-purple-300">{r.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-purple-300 text-sm">{r.institution || "No institution"}</p>
                        {r.specialty && (
                          <p className="text-xs text-cyan-400 truncate max-w-[200px]">{r.specialty.split(",")[0]}</p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {duplicates.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-400" />
              <p className="font-medium text-white text-xl">No duplicates found!</p>
              <p className="text-purple-300 mt-1">All reviewers have unique names.</p>
            </div>
          )}
          <DialogFooter className="mt-6">
            <Button onClick={() => setShowDuplicates(false)} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
