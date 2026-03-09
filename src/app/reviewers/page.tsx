"use client"

import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Loader2,
  Users,
  Upload,
  Download,
  Plus,
  Trash2,
  Mail,
  Phone,
  Building,
  MapPin,
  Send,
  Award,
  GraduationCap,
  Star,
  Edit3,
  MoreVertical,
  Copy,
  UserPlus,
  RefreshCw,
  Eye,
  ClipboardList,
  Timer,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  Sparkles,
  Globe,
  Calendar,
  Hash,
  ToggleLeft,
  ToggleRight,
  Link2,
  ExternalLink,
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
  amasi_membership_number: string | number | null
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

const csvFields = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "phone", label: "Phone" },
  { key: "institution", label: "Institution" },
  { key: "city", label: "City" },
  { key: "specialty", label: "Specialty" },
  { key: "years_of_experience", label: "Experience" },
]

// Predefined specialties
const SPECIALTIES = [
  // GI & Abdominal Surgery
  "General & GI Surgery",
  "Bariatric & Metabolic Surgery",
  "Hepatobiliary & Pancreatic Surgery",
  "Colorectal Surgery",
  "Hernia Surgery",
  "Upper GI Surgery",
  "Esophageal Surgery",
  "Gastric Surgery",
  "Small Bowel Surgery",
  "Appendiceal Surgery",
  "Spleen Surgery",
  "Adrenal Surgery",

  // Oncology & Specialized Surgery
  "Surgical Oncology (Minimally invasive)",
  "Breast Surgery",
  "Head & Neck Surgery",
  "Thyroid & Parathyroid Surgery",

  // Advanced Minimal Access Techniques
  "Robotic Surgery",
  "Single Incision Laparoscopic Surgery (SILS)",
  "Natural Orifice Surgery (NOTES)",
  "Hand-Assisted Laparoscopic Surgery",
  "3D Laparoscopic Surgery",

  // Thoracic
  "Thoracic Surgery (VATS thoracoscopy)",
  "Mediastinal Surgery",
  "Lung Surgery",

  // Multi-specialty Minimal Access
  "Urological Minimal Access Surgery",
  "Gynecological Minimal Access Surgery",
  "Pediatric Minimal Access Surgery",
  "Neonatal Surgery",

  // Endoscopy
  "Endoscopy (Diagnostic & Therapeutic)",
  "Endoscopic Bariatric Procedures",
  "ERCP & Biliary Endoscopy",
  "EUS (Endoscopic Ultrasound)",
  "Capsule Endoscopy",
  "Colonoscopy",
  "Bronchoscopy",

  // Emergency & Trauma
  "Emergency Laparoscopy",
  "Trauma Surgery",
  "Acute Care Surgery",

  // Transplant & Vascular
  "Transplant Surgery",
  "Liver Transplant",
  "Kidney Transplant",
  "Vascular Surgery",
  "Endovascular Surgery",

  // Reconstructive & Cosmetic
  "Plastic & Reconstructive Surgery",
  "Cosmetic Surgery",

  // Other Surgical Specialties
  "Neurosurgery (Minimal Access)",
  "Spine Surgery (Minimal Access)",
  "Orthopedic Surgery",
  "Cardiac Surgery",
  "Ophthalmology",
  "ENT Surgery",

  // Research & Academic
  "Surgical Education & Training",
  "Clinical Research",
  "Basic Science Research",
  "Surgical Simulation",
  "Medical Device Innovation",

  // Allied Specialties
  "Anesthesiology",
  "Critical Care Medicine",
  "Gastroenterology (Medical)",
  "Interventional Radiology",
  "Surgical Pathology",
]

const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

const getAvatarGradient = (name: string) => {
  const gradients = [
    "from-blue-500 to-cyan-400",
    "from-purple-500 to-pink-400",
    "from-emerald-500 to-teal-400",
    "from-orange-500 to-amber-400",
    "from-rose-500 to-red-400",
    "from-indigo-500 to-violet-400",
  ]
  return gradients[name.charCodeAt(0) % gradients.length]
}

const BASE_URL = typeof window !== "undefined" ? window.location.origin : ""

export default function ReviewersPoolPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "members" | "faculty" | "available">("all")
  const [showImport, setShowImport] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedReviewer, setSelectedReviewer] = useState<Reviewer | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(380)
  const [isResizing, setIsResizing] = useState(false)
  const [specialtySearch, setSpecialtySearch] = useState("")
  const [showSpecialtyDropdown, setShowSpecialtyDropdown] = useState(false)
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])

  const [editForm, setEditForm] = useState({
    name: "", email: "", phone: "", institution: "", city: "",
    specialty: "", years_of_experience: "", status: "active", notes: "",
    available_for_review: true,
  })

  // Resize handlers
  const startResizing = useCallback(() => setIsResizing(true), [])
  const stopResizing = useCallback(() => setIsResizing(false), [])
  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX
      if (newWidth >= 320 && newWidth <= 500) setSidebarWidth(newWidth)
    }
  }, [isResizing])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize)
      window.addEventListener("mouseup", stopResizing)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    }
    return () => {
      window.removeEventListener("mousemove", resize)
      window.removeEventListener("mouseup", stopResizing)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing, resize, stopResizing])

  // Fetch reviewers
  const { data: reviewers = [], isLoading, refetch } = useQuery({
    queryKey: ["reviewers-pool"],
    queryFn: async () => {
      const res = await fetch("/api/reviewers-pool?check_duplicates=true")
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      return (json.reviewers || json) as Reviewer[]
    },
  })

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/reviewers-pool", {
        method: data.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save")
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      setShowAddDialog(false)
      setIsEditing(false)
      if (selectedReviewer && data) setSelectedReviewer(data)
      toast.success("Saved successfully")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reviewers-pool?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      setSelectedReviewer(null)
      toast.success("Reviewer removed")
    },
  })

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/reviewers-pool?action=sync-members", { method: "PATCH" })
      if (!res.ok) throw new Error((await res.json()).error || "Sync failed")
      return res.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      toast.success(result.message || `Synced ${result.synced} members`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const importMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const res = await fetch("/api/reviewers-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Import failed")
      return res.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
      setShowImport(false)
      toast.success(`Imported ${result.success} reviewers`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Filter reviewers
  const filtered = useMemo(() => {
    return reviewers.filter((r) => {
      if (filter === "members" && !r.is_amasi_member) return false
      if (filter === "faculty" && !r.is_amasi_faculty) return false
      if (filter === "available" && !r.available_for_review) return false
      if (search) {
        const s = search.toLowerCase()
        return r.name?.toLowerCase().includes(s) ||
          r.email?.toLowerCase().includes(s) ||
          r.institution?.toLowerCase().includes(s) ||
          r.specialty?.toLowerCase().includes(s) ||
          r.amasi_membership_number?.toString().includes(s)
      }
      return true
    })
  }, [reviewers, search, filter])

  // Stats
  const stats = useMemo(() => ({
    total: reviewers.length,
    members: reviewers.filter(r => r.is_amasi_member).length,
    faculty: reviewers.filter(r => r.is_amasi_faculty).length,
    available: reviewers.filter(r => r.available_for_review).length,
  }), [reviewers])

  const resetForm = () => {
    setSelectedSpecialties([])
    setSpecialtySearch("")
    setEditForm({
      name: "", email: "", phone: "", institution: "", city: "",
      specialty: "", years_of_experience: "", status: "active", notes: "",
      available_for_review: true,
    })
  }

  const startEditing = () => {
    if (!selectedReviewer) return
    const specs = selectedReviewer.specialty ? selectedReviewer.specialty.split(",").map(s => s.trim()) : []
    setSelectedSpecialties(specs)
    setEditForm({
      name: selectedReviewer.name || "",
      email: selectedReviewer.email || "",
      phone: selectedReviewer.phone || "",
      institution: selectedReviewer.institution || "",
      city: selectedReviewer.city || "",
      specialty: selectedReviewer.specialty || "",
      years_of_experience: selectedReviewer.years_of_experience || "",
      status: selectedReviewer.status || "active",
      notes: selectedReviewer.notes || "",
      available_for_review: selectedReviewer.available_for_review ?? true,
    })
    setSpecialtySearch("")
    setIsEditing(true)
  }

  // Filter specialties based on search
  const filteredSpecialties = useMemo(() => {
    const search = specialtySearch.toLowerCase()
    const existing = new Set(selectedSpecialties.map(s => s.toLowerCase()))
    return SPECIALTIES.filter(s =>
      s.toLowerCase().includes(search) && !existing.has(s.toLowerCase())
    )
  }, [specialtySearch, selectedSpecialties])

  const addSpecialty = (specialty: string) => {
    if (!selectedSpecialties.includes(specialty)) {
      const newSpecs = [...selectedSpecialties, specialty]
      setSelectedSpecialties(newSpecs)
      setEditForm({ ...editForm, specialty: newSpecs.join(",") })
    }
    setSpecialtySearch("")
    setShowSpecialtyDropdown(false)
  }

  const removeSpecialty = (specialty: string) => {
    const newSpecs = selectedSpecialties.filter(s => s !== specialty)
    setSelectedSpecialties(newSpecs)
    setEditForm({ ...editForm, specialty: newSpecs.join(",") })
  }

  const addCustomSpecialty = () => {
    if (specialtySearch.trim() && !selectedSpecialties.includes(specialtySearch.trim())) {
      addSpecialty(specialtySearch.trim())
    }
  }

  const exportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Institution", "City", "Specialty", "Experience", "AMASI #", "Status", "Available"]
    const rows = reviewers.map(r => [
      r.name, r.email, r.phone || "", r.institution || "", r.city || "",
      r.specialty || "", r.years_of_experience || "", r.amasi_membership_number || "",
      r.status, r.available_for_review ? "Yes" : "No"
    ])
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reviewers-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const toggleAvailability = (reviewer: Reviewer) => {
    saveMutation.mutate({ id: reviewer.id, available_for_review: !reviewer.available_for_review })
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied!`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-600">Loading reviewers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Reviewer Pool</h1>
                <p className="text-sm text-slate-500">{stats.total} reviewers registered</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="text-slate-600"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Sync AMASI
              </Button>

              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>

              <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>

              <Button
                size="sm"
                onClick={() => { resetForm(); setShowAddDialog(true) }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Reviewer
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-6 mt-4">
            <button
              onClick={() => setFilter("all")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === "all"
                  ? "bg-slate-900 text-white shadow-lg"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>{stats.total}</span>
              <span className="opacity-70">All</span>
            </button>

            <button
              onClick={() => setFilter("members")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === "members"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/25"
                  : "text-slate-600 hover:bg-violet-50"
              }`}
            >
              <Award className="h-4 w-4" />
              <span>{stats.members}</span>
              <span className="opacity-70">AMASI Members</span>
            </button>

            <button
              onClick={() => setFilter("faculty")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === "faculty"
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                  : "text-slate-600 hover:bg-amber-50"
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              <span>{stats.faculty}</span>
              <span className="opacity-70">Faculty</span>
            </button>

            <button
              onClick={() => setFilter("available")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === "available"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                  : "text-slate-600 hover:bg-emerald-50"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{stats.available}</span>
              <span className="opacity-70">Available</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto flex" style={{ height: "calc(100vh - 160px)" }}>
        {/* List Panel */}
        <div
          className="bg-white/60 backdrop-blur-sm border-r border-slate-200/60 flex flex-col relative"
          style={{ width: sidebarWidth }}
        >
          {/* Resize Handle */}
          <div
            onMouseDown={startResizing}
            className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 transition-colors ${
              isResizing ? "bg-blue-500" : "hover:bg-blue-400"
            }`}
          />

          {/* Search */}
          <div className="p-4 border-b border-slate-200/60">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search name, email, AMASI #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white/80 border-slate-200 focus:border-blue-400 focus:ring-blue-400/20"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">{filtered.length} reviewers</p>
          </div>

          {/* Reviewer List */}
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-slate-400" />
                </div>
                <p className="font-medium text-slate-700">No reviewers found</p>
                <p className="text-sm text-slate-500 mt-1">
                  {reviewers.length === 0 ? "Add reviewers to get started" : "Try adjusting your filters"}
                </p>
              </div>
            ) : (
              filtered.map((reviewer) => (
                <div
                  key={reviewer.id}
                  onClick={() => { setSelectedReviewer(reviewer); setIsEditing(false) }}
                  className={`group relative p-4 rounded-2xl cursor-pointer transition-all duration-200 ${
                    selectedReviewer?.id === reviewer.id
                      ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-lg shadow-blue-500/10"
                      : "bg-white hover:bg-slate-50 border border-slate-200/60 hover:border-slate-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {reviewer.photo_url ? (
                        <img
                          src={reviewer.photo_url}
                          alt={reviewer.name}
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${getAvatarGradient(reviewer.name)} flex items-center justify-center text-white font-semibold shadow-lg`}>
                          {getInitials(reviewer.name)}
                        </div>
                      )}
                      {/* Availability indicator */}
                      <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${
                        reviewer.available_for_review ? "bg-emerald-500" : "bg-slate-300"
                      }`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-900 truncate">{reviewer.name}</p>
                        {reviewer.is_amasi_member && (
                          <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-violet-100 text-violet-700 rounded-full">
                            <Award className="h-2.5 w-2.5" />
                            AMASI
                          </span>
                        )}
                        {reviewer.is_amasi_faculty && (
                          <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">
                            <GraduationCap className="h-2.5 w-2.5" />
                            Faculty
                          </span>
                        )}
                      </div>

                      {reviewer.amasi_membership_number && (
                        <p className="text-xs font-mono text-violet-600 mb-1">
                          #{reviewer.amasi_membership_number}
                        </p>
                      )}

                      <p className="text-sm text-slate-500 truncate">
                        {reviewer.institution || reviewer.specialty?.split(",")[0] || reviewer.email}
                      </p>
                    </div>

                    {/* Quick Toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleAvailability(reviewer) }}
                      className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                        reviewer.available_for_review
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                      title={reviewer.available_for_review ? "Click to mark unavailable" : "Click to mark available"}
                    >
                      {reviewer.available_for_review ? (
                        <ToggleRight className="h-5 w-5" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <ClipboardList className="h-3.5 w-3.5" />
                      <span>{reviewer.total_reviews_completed || 0} reviews</span>
                    </div>
                    {reviewer.avg_review_time_days && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Timer className="h-3.5 w-3.5" />
                        <span>{reviewer.avg_review_time_days}d avg</span>
                      </div>
                    )}
                    {reviewer.rating && (
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <Star className="h-3.5 w-3.5 fill-amber-400" />
                        <span>{reviewer.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50/50 to-white">
          {selectedReviewer ? (
            <div className="p-8">
              {/* Profile Header */}
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/50 overflow-hidden">
                {/* Cover gradient */}
                <div className="h-32 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />

                <div className="px-8 pb-8">
                  {/* Avatar & Name */}
                  <div className="flex items-end gap-6 -mt-12">
                    <div className="relative">
                      {selectedReviewer.photo_url ? (
                        <img
                          src={selectedReviewer.photo_url}
                          alt={selectedReviewer.name}
                          className="h-28 w-28 rounded-2xl object-cover border-4 border-white shadow-xl"
                        />
                      ) : (
                        <div className={`h-28 w-28 rounded-2xl bg-gradient-to-br ${getAvatarGradient(selectedReviewer.name)} flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-xl`}>
                          {getInitials(selectedReviewer.name)}
                        </div>
                      )}
                      {/* Status dot */}
                      <div className={`absolute bottom-2 right-2 h-5 w-5 rounded-full border-3 border-white ${
                        selectedReviewer.available_for_review ? "bg-emerald-500" : "bg-slate-400"
                      }`} />
                    </div>

                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-bold text-slate-900">{selectedReviewer.name}</h2>
                        {selectedReviewer.is_amasi_member && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-semibold bg-violet-100 text-violet-700 rounded-full">
                            <Award className="h-4 w-4" />
                            AMASI #{selectedReviewer.amasi_membership_number}
                          </span>
                        )}
                        {selectedReviewer.is_amasi_faculty && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-semibold bg-amber-100 text-amber-700 rounded-full">
                            <GraduationCap className="h-4 w-4" />
                            Faculty
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600">
                        {selectedReviewer.designation || selectedReviewer.institution || selectedReviewer.specialty?.split(",")[0]}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pb-2">
                      {/* Availability Toggle */}
                      <Button
                        variant={selectedReviewer.available_for_review ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleAvailability(selectedReviewer)}
                        className={selectedReviewer.available_for_review
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : ""
                        }
                      >
                        {selectedReviewer.available_for_review ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Available
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Unavailable
                          </>
                        )}
                      </Button>

                      <Button variant="outline" size="sm" onClick={startEditing}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => window.open(`mailto:${selectedReviewer.email}`)}>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Email
                          </DropdownMenuItem>
                          {selectedReviewer.phone && (
                            <DropdownMenuItem onClick={() => window.open(`tel:${selectedReviewer.phone}`)}>
                              <Phone className="h-4 w-4 mr-2" />
                              Call
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(selectedReviewer.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-4 gap-4 mt-8">
                    <div className="bg-slate-50 rounded-2xl p-4 text-center">
                      <div className="text-3xl font-bold text-slate-900">{selectedReviewer.total_reviews_completed || 0}</div>
                      <div className="text-sm text-slate-500 mt-1">Reviews Done</div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 text-center">
                      <div className="text-3xl font-bold text-slate-900">{selectedReviewer.avg_review_time_days || "—"}</div>
                      <div className="text-sm text-slate-500 mt-1">Avg Days</div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 text-center">
                      <div className="text-3xl font-bold text-slate-900">{selectedReviewer.years_of_experience || "—"}</div>
                      <div className="text-sm text-slate-500 mt-1">Years Exp</div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 text-center">
                      <div className="text-3xl font-bold text-slate-900">{selectedReviewer.rating?.toFixed(1) || "—"}</div>
                      <div className="text-sm text-slate-500 mt-1">Rating</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact & Details */}
              <div className="grid grid-cols-2 gap-6 mt-6">
                {/* Contact Info */}
                <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Contact Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl group">
                      <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-500">Email</p>
                        <p className="font-medium text-slate-900">{selectedReviewer.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(selectedReviewer.email, "Email")}
                        className="opacity-0 group-hover:opacity-100"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>

                    {selectedReviewer.phone && (
                      <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl group">
                        <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                          <Phone className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-slate-500">Phone</p>
                          <p className="font-medium text-slate-900">{selectedReviewer.phone}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(selectedReviewer.phone!, "Phone")}
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {selectedReviewer.institution && (
                      <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                        <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
                          <Building className="h-5 w-5 text-violet-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-slate-500">Institution</p>
                          <p className="font-medium text-slate-900">{selectedReviewer.institution}</p>
                        </div>
                      </div>
                    )}

                    {selectedReviewer.city && (
                      <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                        <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-slate-500">Location</p>
                          <p className="font-medium text-slate-900">{selectedReviewer.city}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expertise */}
                <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Expertise & Specializations</h3>
                  {selectedReviewer.specialty ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedReviewer.specialty.split(",").map((s, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 text-sm font-medium rounded-lg border border-blue-100"
                        >
                          {s.trim()}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No specializations added yet</p>
                  )}

                  {selectedReviewer.bio && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-slate-700 mb-2">Bio</h4>
                      <p className="text-slate-600 text-sm leading-relaxed">{selectedReviewer.bio}</p>
                    </div>
                  )}

                  {selectedReviewer.notes && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-slate-700 mb-2">Notes</h4>
                      <p className="text-slate-600 text-sm leading-relaxed">{selectedReviewer.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Reviewer Portal Link */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6 mt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                      <Link2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Reviewer Portal</h3>
                      <p className="text-sm text-slate-600">
                        {selectedReviewer.form_token
                          ? "Share this link with the reviewer - No login required"
                          : "Generate a portal link for this reviewer"
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedReviewer.form_token ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(`${BASE_URL}/reviewer-portal/${selectedReviewer.form_token}`, "Portal link")}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => window.open(`${BASE_URL}/reviewer-portal/${selectedReviewer.form_token}`, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Portal
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/reviewers-pool", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: selectedReviewer.id, generate_token: true }),
                            })
                            if (!res.ok) throw new Error("Failed to generate link")
                            const updated = await res.json()
                            queryClient.invalidateQueries({ queryKey: ["reviewers-pool"] })
                            setSelectedReviewer({ ...selectedReviewer, form_token: updated.form_token })
                            toast.success("Portal link generated!")
                          } catch (err) {
                            toast.error("Failed to generate link")
                          }
                        }}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Link
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6">
                <Eye className="h-12 w-12 text-slate-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-700">Select a Reviewer</h2>
              <p className="text-slate-500 mt-2 max-w-sm">
                Click on a reviewer from the list to view their profile, contact information, and review history.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog || isEditing} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); setIsEditing(false) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Reviewer" : "Add Reviewer"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  placeholder="City"
                />
              </div>
            </div>

            <div>
              <Label>Institution</Label>
              <Input
                value={editForm.institution}
                onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                placeholder="Hospital / University"
              />
            </div>

            <div>
              <Label>Specialty</Label>
              {/* Selected specialties */}
              {selectedSpecialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedSpecialties.map((spec, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg"
                    >
                      {spec}
                      <button
                        type="button"
                        onClick={() => removeSpecialty(spec)}
                        className="hover:bg-blue-200 rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* Search input with dropdown */}
              <div className="relative">
                <Input
                  value={specialtySearch}
                  onChange={(e) => {
                    setSpecialtySearch(e.target.value)
                    setShowSpecialtyDropdown(true)
                  }}
                  onFocus={() => setShowSpecialtyDropdown(true)}
                  placeholder="Search or type to add specialty..."
                />
                {showSpecialtyDropdown && (specialtySearch || filteredSpecialties.length > 0) && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                    {filteredSpecialties.length > 0 ? (
                      filteredSpecialties.map((spec, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => addSpecialty(spec)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          {spec}
                        </button>
                      ))
                    ) : specialtySearch.trim() ? (
                      <button
                        type="button"
                        onClick={addCustomSpecialty}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 text-green-700 flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add "{specialtySearch.trim()}"
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
              {/* Click outside to close */}
              {showSpecialtyDropdown && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSpecialtyDropdown(false)}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Years of Experience</Label>
                <Input
                  value={editForm.years_of_experience}
                  onChange={(e) => setEditForm({ ...editForm, years_of_experience: e.target.value })}
                  placeholder="e.g. 15"
                />
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label>Available for Review</Label>
                <Switch
                  checked={editForm.available_for_review}
                  onCheckedChange={(c) => setEditForm({ ...editForm, available_for_review: c })}
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Internal notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setIsEditing(false) }}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate(isEditing ? { id: selectedReviewer?.id, ...editForm } : editForm)}
              disabled={!editForm.name || !editForm.email || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Reviewer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-2xl">
          <CSVImportDynamic
            title="Import Reviewers"
            description="Upload a CSV file to import reviewers in bulk"
            standardFields={csvFields}
            onImport={async (data) => { await importMutation.mutateAsync(data); return { success: data.length, failed: 0, errors: [] } }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
