"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  Award,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Send,
  Star,
  Edit3,
  Save,
  X,
  ChevronRight,
  Calendar,
  ExternalLink,
  Download,
  GraduationCap,
  ClipboardList,
  Hash,
  Sparkles,
  Plus,
  ChevronDown,
  Video,
  FileIcon,
  Image,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { cn } from "@/lib/utils"

type Abstract = {
  id: string
  abstract_number: string
  title: string
  abstract_text: string
  keywords: string[] | null
  presentation_type: string
  // NOTE: Author info excluded for BLIND REVIEW
  status: string
  file_url: string | null
  file_name: string | null
  submitted_at: string
  category: { id: string; name: string } | null
  event: { id: string; name: string; short_name: string | null } | null
}

type Review = {
  id: string
  abstract_id: string
  reviewer_id: string | null
  review_type: string
  recommendation: string | null
  comments_to_author: string | null
  comments_private: string | null
  scores: Record<string, number> | null
  total_score: number | null
  max_possible_score: number | null
  reviewed_at: string | null
  created_at: string
  abstract: Abstract
}

type Reviewer = {
  id: string
  name: string
  email: string
  phone: string | null
  institution: string | null
  city: string | null
  specialty: string | null
  years_of_experience: string | null
  photo_url: string | null
  bio: string | null
  designation: string | null
  linkedin_url: string | null
  orcid_id: string | null
  publications_count: number
  research_interests: string | null
  available_for_review: boolean
  max_reviews_per_month: number
  total_reviews_completed: number
  avg_review_time_days: number | null
  rating: number | null
  is_amasi_member: boolean
  amasi_membership_number: string | number | null
  member_status: string | null
  form_completed_at: string | null
}

type PortalData = {
  reviewer: Reviewer
  reviews: Review[]
  stats: {
    total: number
    completed: number
    pending: number
  }
}

// Scoring criteria based on submission type
// Two modes: "award" (full scoring) and "simple" (just confirmation)
const SCORING_SCHEMAS = {
  // ========== AWARD CATEGORIES (Full Scoring) ==========

  // Best Paper Award & Young Scholar Award (same criteria)
  best_paper: {
    name: "Best Paper Award",
    mode: "award",
    maxPerCriteria: 10,
    criteria: [
      { key: "originality", label: "Originality & Novelty", description: "Novel approach, unique findings, innovative concept" },
      { key: "methodology", label: "Study Design & Methodology", description: "Randomized > Cohort > Case-control studies" },
      { key: "clinical_impact", label: "Clinical Impact / Relevance", description: "Practical applicability, impact on patient care" },
      { key: "data_quality", label: "Data Quality & Analysis", description: "Statistical rigor, appropriate analysis methods" },
      { key: "presentation", label: "Presentation & Clarity", description: "Clear communication, well-organized content" },
    ],
  },
  young_scholar: {
    name: "Young Scholar Award",
    mode: "award",
    maxPerCriteria: 10,
    criteria: [
      { key: "originality", label: "Originality & Novelty", description: "Novel approach, unique findings, innovative concept" },
      { key: "methodology", label: "Study Design & Methodology", description: "Randomized > Cohort > Case-control studies" },
      { key: "clinical_impact", label: "Clinical Impact / Relevance", description: "Practical applicability, impact on patient care" },
      { key: "data_quality", label: "Data Quality & Analysis", description: "Statistical rigor, appropriate analysis methods" },
      { key: "presentation", label: "Presentation & Clarity", description: "Clear communication, well-organized content" },
    ],
  },
  // Video Awards (Institutional & Faculty)
  video_award: {
    name: "Video Award",
    mode: "award",
    maxPerCriteria: 10,
    criteria: [
      { key: "originality", label: "Originality & Innovation", description: "Novel technique, creative approach" },
      { key: "scientific_content", label: "Scientific Content / Accuracy", description: "Factual correctness, evidence-based" },
      { key: "technical_quality", label: "Technical Quality of Video", description: "Resolution, audio clarity, editing quality" },
      { key: "explanation", label: "Step-wise Explanation & Clarity", description: "Clear narration, logical flow, teaching value" },
      { key: "clinical_relevance", label: "Clinical Relevance & Learning Value", description: "Practical applicability, educational impact" },
    ],
  },
  // Best Poster Award (10 criteria, max 5 each)
  poster_award: {
    name: "Best Poster Award",
    mode: "award",
    maxPerCriteria: 5,
    criteria: [
      { key: "title_relevance", label: "Title & Relevance", description: "Clear, descriptive, relevant to content" },
      { key: "originality", label: "Originality", description: "Novel concept or approach" },
      { key: "methodology", label: "Methodology / Case Details", description: "Appropriate methods, clear case presentation" },
      { key: "conclusions", label: "Conclusions & Clinical Relevance", description: "Valid conclusions, clinical applicability" },
      { key: "organization", label: "Organization & Structure", description: "Logical flow, clear sections" },
      { key: "layout", label: "Layout & Readability", description: "Font size, spacing, visual appeal" },
      { key: "visuals", label: "Images / Graphs / Tables", description: "Quality of visual elements, appropriate use" },
      { key: "innovation", label: "Innovation & Learning Value", description: "Educational contribution, new insights" },
      { key: "references", label: "References & Ethics", description: "Proper citations, ethical compliance" },
      { key: "overall_impact", label: "Overall Impact", description: "General impression, memorability" },
    ],
  },

  // ========== REGULAR SUBMISSIONS (Simple Confirmation) ==========

  // Free Paper - just confirm suitability
  oral: {
    name: "Free Paper",
    mode: "simple",
    maxPerCriteria: 0,
    criteria: [],
  },
  // Free Video - just confirm suitability
  video: {
    name: "Video Presentation",
    mode: "simple",
    maxPerCriteria: 0,
    criteria: [],
  },
  // Poster Presentation - just confirm suitability
  poster: {
    name: "Poster Presentation",
    mode: "simple",
    maxPerCriteria: 0,
    criteria: [],
  },
}

// Helper to detect scoring type from presentation_type, category, or abstract_number
const getScoringSchema = (presentationType: string, category?: string | null, abstractNumber?: string | null) => {
  const type = (presentationType || "").toLowerCase()
  const cat = (category || "").toLowerCase()
  const absNum = (abstractNumber || "").toUpperCase()

  // Check for AWARD categories first (these need full scoring)
  // Check by abstract number prefix
  if (absNum.startsWith("AWARD-BP") || absNum.includes("BEST-PAPER")) {
    return SCORING_SCHEMAS.best_paper
  }
  if (absNum.startsWith("AWARD-YS") || absNum.includes("YOUNG")) {
    return SCORING_SCHEMAS.young_scholar
  }
  if (absNum.startsWith("AWARD-VID") || absNum.includes("VIDEO-AWARD")) {
    return SCORING_SCHEMAS.video_award
  }
  if (absNum.startsWith("AWARD-POST") || absNum.includes("POSTER-AWARD")) {
    return SCORING_SCHEMAS.poster_award
  }

  // Check by category name
  if (cat.includes("best paper") || cat.includes("paper award")) {
    return SCORING_SCHEMAS.best_paper
  }
  if (cat.includes("young scholar") || cat.includes("young") && cat.includes("award")) {
    return SCORING_SCHEMAS.young_scholar
  }
  if (cat.includes("video award") || cat.includes("best video") || cat.includes("institutional video") || cat.includes("faculty video")) {
    return SCORING_SCHEMAS.video_award
  }
  if (cat.includes("poster award") || cat.includes("best poster")) {
    return SCORING_SCHEMAS.poster_award
  }

  // Regular submissions (simple confirmation only)
  if (type.includes("video") || type === "video") {
    return SCORING_SCHEMAS.video
  }
  if (type.includes("poster") || type === "poster") {
    return SCORING_SCHEMAS.poster
  }
  // Default to oral/free paper (simple)
  return SCORING_SCHEMAS.oral
}

const SPECIALTIES = [
  "General & GI Surgery",
  "Bariatric & Metabolic Surgery",
  "Hepatobiliary & Pancreatic Surgery",
  "Colorectal Surgery",
  "Hernia Surgery",
  "Upper GI Surgery",
  "Esophageal Surgery",
  "Gastric Surgery",
  "Surgical Oncology",
  "Robotic Surgery",
  "Single Incision Laparoscopic Surgery (SILS)",
  "Thoracic Surgery (VATS)",
  "Urological Minimal Access Surgery",
  "Gynecological Minimal Access Surgery",
  "Pediatric Minimal Access Surgery",
  "Endoscopy (Diagnostic & Therapeutic)",
  "ERCP & Biliary Endoscopy",
  "Emergency Laparoscopy",
  "Trauma Surgery",
  "Transplant Surgery",
  "Vascular Surgery",
  "Breast Surgery",
  "Head & Neck Surgery",
  "Thyroid & Parathyroid Surgery",
  "Plastic & Reconstructive Surgery",
  "Neurosurgery",
  "Spine Surgery",
  "Orthopedic Surgery",
  "Cardiac Surgery",
  "Anesthesiology",
  "Critical Care Medicine",
  "Surgical Education & Training",
  "Clinical Research",
]

// Recommendations for award categories (full review)
const AWARD_RECOMMENDATIONS = [
  { value: "accept", label: "Accept for Award", color: "bg-green-100 text-green-700" },
  { value: "accept_with_revisions", label: "Accept with Minor Revisions", color: "bg-blue-100 text-blue-700" },
  { value: "revise_and_resubmit", label: "Revise & Resubmit", color: "bg-amber-100 text-amber-700" },
  { value: "reject", label: "Reject", color: "bg-red-100 text-red-700" },
]

// Recommendations for regular submissions (simple confirmation)
const SIMPLE_RECOMMENDATIONS = [
  { value: "suitable", label: "Suitable for Presentation", color: "bg-green-100 text-green-700" },
  { value: "suitable_minor_changes", label: "Suitable with Minor Changes", color: "bg-blue-100 text-blue-700" },
  { value: "not_suitable", label: "Not Suitable for Presentation", color: "bg-red-100 text-red-700" },
]

// Legacy compatibility
const RECOMMENDATIONS = AWARD_RECOMMENDATIONS

const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

export default function ReviewerPortalPage() {
  const params = useParams()
  const token = params.token as string
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState("pending")
  const [editingProfile, setEditingProfile] = useState(false)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)

  // Review form state
  const [reviewForm, setReviewForm] = useState({
    scores: {} as Record<string, number>,
    recommendation: "",
    comments_to_author: "",
    comments_private: "",
  })

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    phone: "",
    institution: "",
    city: "",
    specialty: "",
    years_of_experience: "",
    bio: "",
    designation: "",
    available_for_review: true,
  })

  // Specialty dropdown state
  const [specialtySearch, setSpecialtySearch] = useState("")
  const [showSpecialtyDropdown, setShowSpecialtyDropdown] = useState(false)
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  const specialtyRef = useRef<HTMLDivElement>(null)

  // Filter specialties based on search
  const filteredSpecialties = useMemo(() => {
    const search = specialtySearch.toLowerCase()
    const existing = new Set(selectedSpecialties.map(s => s.toLowerCase()))
    return SPECIALTIES.filter(s =>
      s.toLowerCase().includes(search) && !existing.has(s.toLowerCase())
    )
  }, [specialtySearch, selectedSpecialties])

  // Add specialty
  const addSpecialty = (specialty: string) => {
    if (!selectedSpecialties.includes(specialty)) {
      const newSpecs = [...selectedSpecialties, specialty]
      setSelectedSpecialties(newSpecs)
      setProfileForm({ ...profileForm, specialty: newSpecs.join(", ") })
    }
    setSpecialtySearch("")
    setShowSpecialtyDropdown(false)
  }

  // Remove specialty
  const removeSpecialty = (specialty: string) => {
    const newSpecs = selectedSpecialties.filter(s => s !== specialty)
    setSelectedSpecialties(newSpecs)
    setProfileForm({ ...profileForm, specialty: newSpecs.join(", ") })
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (specialtyRef.current && !specialtyRef.current.contains(e.target as Node)) {
        setShowSpecialtyDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Fetch data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["reviewer-portal", token],
    queryFn: async () => {
      const response = await fetch(`/api/reviewer-portal/${token}`)
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to load portal")
      }
      return result as PortalData
    },
  })

  // Initialize profile form when data loads
  useEffect(() => {
    if (data?.reviewer) {
      setProfileForm({
        phone: data.reviewer.phone || "",
        institution: data.reviewer.institution || "",
        city: data.reviewer.city || "",
        specialty: data.reviewer.specialty || "",
        years_of_experience: data.reviewer.years_of_experience || "",
        bio: data.reviewer.bio || "",
        designation: data.reviewer.designation || "",
        available_for_review: data.reviewer.available_for_review,
      })
      // Initialize selected specialties from existing data
      if (data.reviewer.specialty) {
        setSelectedSpecialties(data.reviewer.specialty.split(",").map((s: string) => s.trim()).filter(Boolean))
      }
    }
  }, [data])

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: async (updates: typeof profileForm) => {
      const response = await fetch(`/api/reviewer-portal/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to update profile")
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success("Profile updated successfully")
      setEditingProfile(false)
      queryClient.invalidateQueries({ queryKey: ["reviewer-portal", token] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update profile")
    },
  })

  // Submit review mutation
  const submitReview = useMutation({
    mutationFn: async (reviewData: {
      reviewId: string
      scores: Record<string, number>
      recommendation: string
      comments_to_author: string
      comments_private: string
    }) => {
      const response = await fetch(`/api/reviewer-portal/${token}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewData),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to submit review")
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success("Review submitted successfully!")
      setReviewDialogOpen(false)
      setSelectedReview(null)
      queryClient.invalidateQueries({ queryKey: ["reviewer-portal", token] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit review")
    },
  })

  const openReviewDialog = (review: Review) => {
    setSelectedReview(review)
    setReviewForm({
      scores: review.scores || {},
      recommendation: review.recommendation || "",
      comments_to_author: review.comments_to_author || "",
      comments_private: review.comments_private || "",
    })
    setReviewDialogOpen(true)
  }

  const handleSubmitReview = () => {
    if (!selectedReview) return

    if (!reviewForm.recommendation) {
      toast.error("Please select a recommendation")
      return
    }

    // Get scoring schema for this abstract type
    const schema = getScoringSchema(
      selectedReview.abstract.presentation_type,
      selectedReview.abstract.category?.name,
      selectedReview.abstract.abstract_number
    )

    // Only check scores for award categories
    if (schema.mode === "award") {
      const hasAllScores = schema.criteria.every(c => reviewForm.scores[c.key] !== undefined)
      if (!hasAllScores) {
        toast.error("Please provide scores for all criteria")
        return
      }
    }

    submitReview.mutate({
      reviewId: selectedReview.id,
      ...reviewForm,
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your portal...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
            <CardTitle>Link Not Valid</CardTitle>
            <CardDescription>
              {error?.message || "This link is invalid or has expired. Please contact AMASI for assistance."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const { reviewer, reviews, stats } = data
  const pendingReviews = reviews.filter(r => !r.reviewed_at)
  const completedReviews = reviews.filter(r => r.reviewed_at)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                {getInitials(reviewer.name)}
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">{reviewer.name}</h1>
                <p className="text-sm text-gray-500">{reviewer.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {reviewer.is_amasi_member && (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                  <Award className="h-3 w-3 mr-1" />
                  AMASI #{reviewer.amasi_membership_number}
                </Badge>
              )}
              <Badge variant="outline" className="gap-1">
                <ClipboardList className="h-3 w-3" />
                {stats.completed}/{stats.total} Reviews
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Total Assigned</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <FileText className="h-10 w-10 text-blue-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">Pending</p>
                  <p className="text-3xl font-bold">{stats.pending}</p>
                </div>
                <Clock className="h-10 w-10 text-amber-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Completed</p>
                  <p className="text-3xl font-bold">{stats.completed}</p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-200" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-violet-500 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Avg. Time</p>
                  <p className="text-3xl font-bold">
                    {reviewer.avg_review_time_days ? `${reviewer.avg_review_time_days}d` : "-"}
                  </p>
                </div>
                <Star className="h-10 w-10 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left - Profile */}
          <div className="lg:col-span-1">
            <Card className="bg-white/70 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">My Profile</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingProfile(!editingProfile)}
                >
                  {editingProfile ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Edit3 className="h-4 w-4" />
                  )}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingProfile ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={profileForm.phone}
                        onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="9876543210"
                      />
                    </div>
                    <div>
                      <Label>Designation</Label>
                      <Input
                        value={profileForm.designation}
                        onChange={e => setProfileForm({ ...profileForm, designation: e.target.value })}
                        placeholder="Professor & HOD"
                      />
                    </div>
                    <div>
                      <Label>Institution</Label>
                      <Input
                        value={profileForm.institution}
                        onChange={e => setProfileForm({ ...profileForm, institution: e.target.value })}
                        placeholder="Apollo Hospital"
                      />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input
                        value={profileForm.city}
                        onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
                        placeholder="Chennai"
                      />
                    </div>
                    <div>
                      <Label>Years of Experience</Label>
                      <Input
                        value={profileForm.years_of_experience}
                        onChange={e => setProfileForm({ ...profileForm, years_of_experience: e.target.value })}
                        placeholder="15"
                      />
                    </div>
                    <div ref={specialtyRef}>
                      <Label>Specialty / Areas of Interest</Label>
                      {/* Selected specialties as tags */}
                      {selectedSpecialties.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2 mt-1">
                          {selectedSpecialties.map((spec, i) => (
                            <Badge key={i} variant="secondary" className="gap-1 pr-1">
                              {spec}
                              <button
                                type="button"
                                onClick={() => removeSpecialty(spec)}
                                className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      {/* Searchable dropdown */}
                      <div className="relative">
                        <Input
                          value={specialtySearch}
                          onChange={e => {
                            setSpecialtySearch(e.target.value)
                            setShowSpecialtyDropdown(true)
                          }}
                          onFocus={() => setShowSpecialtyDropdown(true)}
                          placeholder="Search or add specialty..."
                          className="pr-8"
                        />
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        {showSpecialtyDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredSpecialties.slice(0, 10).map((spec, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => addSpecialty(spec)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2"
                              >
                                <Plus className="h-3 w-3 text-blue-600" />
                                {spec}
                              </button>
                            ))}
                            {specialtySearch && !SPECIALTIES.some(s => s.toLowerCase() === specialtySearch.toLowerCase()) && (
                              <button
                                type="button"
                                onClick={() => addSpecialty(specialtySearch)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-green-50 flex items-center gap-2 border-t text-green-700"
                              >
                                <Plus className="h-3 w-3" />
                                Add "{specialtySearch}"
                              </button>
                            )}
                            {filteredSpecialties.length === 0 && !specialtySearch && (
                              <div className="px-3 py-2 text-sm text-gray-500">All specialties selected</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label>Bio</Label>
                      <Textarea
                        value={profileForm.bio}
                        onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })}
                        placeholder="Brief bio..."
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Available for Review</Label>
                      <Switch
                        checked={profileForm.available_for_review}
                        onCheckedChange={v => setProfileForm({ ...profileForm, available_for_review: v })}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => updateProfile.mutate(profileForm)}
                      disabled={updateProfile.isPending}
                    >
                      {updateProfile.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviewer.designation && (
                      <div className="flex items-center gap-3 text-sm">
                        <GraduationCap className="h-4 w-4 text-gray-400" />
                        <span>{reviewer.designation}</span>
                      </div>
                    )}
                    {reviewer.institution && (
                      <div className="flex items-center gap-3 text-sm">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span>{reviewer.institution}</span>
                      </div>
                    )}
                    {reviewer.city && (
                      <div className="flex items-center gap-3 text-sm">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>{reviewer.city}</span>
                      </div>
                    )}
                    {reviewer.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{reviewer.phone}</span>
                      </div>
                    )}
                    {reviewer.years_of_experience && (
                      <div className="flex items-center gap-3 text-sm">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{reviewer.years_of_experience} years experience</span>
                      </div>
                    )}
                    {reviewer.specialty && (
                      <div className="pt-3 border-t">
                        <p className="text-xs text-gray-500 mb-2">Specialties</p>
                        <div className="flex flex-wrap gap-1">
                          {reviewer.specialty.split(",").map((s, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {s.trim()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {reviewer.bio && (
                      <div className="pt-3 border-t">
                        <p className="text-xs text-gray-500 mb-1">About</p>
                        <p className="text-sm text-gray-600">{reviewer.bio}</p>
                      </div>
                    )}
                    <div className="pt-3 border-t flex items-center justify-between">
                      <span className="text-sm text-gray-600">Available for Review</span>
                      <Switch
                        checked={reviewer.available_for_review}
                        onCheckedChange={async (checked) => {
                          try {
                            const res = await fetch(`/api/reviewer-portal/${token}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ available_for_review: checked }),
                            })
                            if (!res.ok) throw new Error("Failed to update")
                            queryClient.invalidateQueries({ queryKey: ["reviewer-portal", token] })
                            toast.success(checked ? "You are now available for reviews" : "You are now unavailable for reviews")
                          } catch {
                            toast.error("Failed to update availability")
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right - Abstracts */}
          <div className="lg:col-span-2">
            <Card className="bg-white/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg">Assigned Abstracts</CardTitle>
                <CardDescription>Review and score assigned abstracts</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="pending" className="gap-2">
                      <Clock className="h-4 w-4" />
                      Pending ({pendingReviews.length})
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Completed ({completedReviews.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pending" className="space-y-3">
                    {pendingReviews.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Sparkles className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>No pending reviews</p>
                        <p className="text-sm">You're all caught up!</p>
                      </div>
                    ) : (
                      pendingReviews.map(review => (
                        <div
                          key={review.id}
                          className="p-4 rounded-xl border bg-white hover:shadow-md transition-all cursor-pointer"
                          onClick={() => openReviewDialog(review)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  #{review.abstract.abstract_number}
                                </Badge>
                                {review.abstract.event && (
                                  <Badge variant="secondary" className="text-xs">
                                    {review.abstract.event.short_name || review.abstract.event.name}
                                  </Badge>
                                )}
                                {/* File type badge */}
                                {review.abstract.file_url?.match(/\.(mp4|webm|mov|avi)$/i) ? (
                                  <Badge className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-100 gap-1">
                                    <Video className="h-3 w-3" /> Video
                                  </Badge>
                                ) : review.abstract.file_url?.match(/\.(pdf)$/i) ? (
                                  <Badge className="text-xs bg-red-100 text-red-700 hover:bg-red-100 gap-1">
                                    <FileIcon className="h-3 w-3" /> PDF
                                  </Badge>
                                ) : review.abstract.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                  <Badge className="text-xs bg-teal-100 text-teal-700 hover:bg-teal-100 gap-1">
                                    <Image className="h-3 w-3" /> Image
                                  </Badge>
                                ) : null}
                                <Badge className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-100">
                                  Pending
                                </Badge>
                              </div>
                              <h3 className="font-medium text-gray-900 line-clamp-2 mb-1">
                                {review.abstract.title}
                              </h3>
                              <p className="text-sm text-gray-500">
                                Abstract #{review.abstract.abstract_number}
                                {review.abstract.event?.short_name && (
                                  <span> • {review.abstract.event.short_name}</span>
                                )}
                              </p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="completed" className="space-y-3">
                    {completedReviews.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>No completed reviews yet</p>
                      </div>
                    ) : (
                      completedReviews.map(review => (
                        <div
                          key={review.id}
                          className="p-4 rounded-xl border bg-white/50 cursor-pointer hover:bg-white transition-all"
                          onClick={() => openReviewDialog(review)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  #{review.abstract.abstract_number}
                                </Badge>
                                {review.recommendation && (
                                  <Badge className={cn(
                                    "text-xs",
                                    RECOMMENDATIONS.find(r => r.value === review.recommendation)?.color
                                  )}>
                                    {RECOMMENDATIONS.find(r => r.value === review.recommendation)?.label}
                                  </Badge>
                                )}
                                {review.total_score !== null && review.max_possible_score && (
                                  <Badge variant="secondary" className="text-xs">
                                    Score: {review.total_score}/{review.max_possible_score}
                                  </Badge>
                                )}
                              </div>
                              <h3 className="font-medium text-gray-900 line-clamp-1 mb-1">
                                {review.abstract.title}
                              </h3>
                              <p className="text-xs text-gray-500">
                                Reviewed on {new Date(review.reviewed_at!).toLocaleDateString()}
                              </p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          {selectedReview && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">#{selectedReview.abstract.abstract_number}</Badge>
                  {selectedReview.abstract.category && (
                    <Badge variant="secondary">{selectedReview.abstract.category.name}</Badge>
                  )}
                  <Badge>{selectedReview.abstract.presentation_type}</Badge>
                </div>
                <DialogTitle className="text-xl pr-8">{selectedReview.abstract.title}</DialogTitle>
                <CardDescription className="flex items-center gap-2 text-amber-700">
                  <FileText className="h-4 w-4" />
                  Blind Review • Author details hidden
                </CardDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                {/* Left - Abstract Details */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Abstract</h4>
                    <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {selectedReview.abstract.abstract_text}
                    </div>
                  </div>

                  {selectedReview.abstract.keywords && selectedReview.abstract.keywords.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Keywords</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedReview.abstract.keywords.map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedReview.abstract.file_url && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-gray-700">Attachment</h4>
                      {/* Video Player */}
                      {selectedReview.abstract.file_url.match(/\.(mp4|webm|mov|avi)$/i) ? (
                        <div className="rounded-lg overflow-hidden border bg-gray-900 p-4">
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <video
                            key={selectedReview.id}
                            controls
                            controlsList="nodownload"
                            className="w-full bg-black"
                            style={{ maxHeight: '450px', minHeight: '300px' }}
                            src={selectedReview.abstract.file_url.startsWith('http')
                              ? selectedReview.abstract.file_url
                              : `${window.location.origin}${selectedReview.abstract.file_url}`}
                            onError={(e) => {
                              const video = e.target as HTMLVideoElement
                              console.error('Video error:', video.error?.message || 'Unknown error')
                            }}
                            onLoadedData={() => console.log('Video loaded successfully')}
                          />
                          <p className="text-xs text-gray-400 mt-2">
                            Video: {selectedReview.abstract.file_url}
                          </p>
                        </div>
                      ) : selectedReview.abstract.file_url.match(/\.(pdf)$/i) ? (
                        /* PDF Viewer */
                        <div className="rounded-lg overflow-hidden border">
                          <iframe
                            src={selectedReview.abstract.file_url}
                            className="w-full h-[550px]"
                            title="PDF Viewer"
                          />
                        </div>
                      ) : selectedReview.abstract.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        /* Image Viewer */
                        <div className="rounded-lg overflow-hidden border">
                          <img
                            src={selectedReview.abstract.file_url}
                            alt="Attachment"
                            className="w-full max-h-[550px] object-contain"
                          />
                        </div>
                      ) : null}
                      {/* Download Button */}
                      <Button variant="outline" size="sm" asChild>
                        <a href={selectedReview.abstract.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          {selectedReview.abstract.file_name || "Download Attachment"}
                        </a>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Right - Review Form */}
                <div className="space-y-4">
                  {(() => {
                    const schema = getScoringSchema(
                      selectedReview.abstract.presentation_type,
                      selectedReview.abstract.category?.name,
                      selectedReview.abstract.abstract_number
                    )

                    // Simple mode - just confirmation
                    if (schema.mode === "simple") {
                      return (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                          <div className="text-center mb-4">
                            <Badge className="bg-blue-100 text-blue-700 text-sm px-4 py-1">
                              {schema.name}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-gray-800 text-center mb-2">
                            Review Confirmation
                          </h4>
                          <p className="text-sm text-gray-600 text-center mb-4">
                            Please review the abstract and confirm if it is suitable for presentation at AMASICON 2026.
                          </p>
                          <div className="text-center text-xs text-gray-500">
                            No scoring required for regular submissions. Simply select your recommendation below.
                          </div>
                        </div>
                      )
                    }

                    // Award mode - full scoring
                    const totalScore = schema.criteria.reduce((sum, c) => sum + (reviewForm.scores[c.key] || 0), 0)
                    const maxScore = schema.criteria.length * schema.maxPerCriteria

                    return (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <Badge className="bg-amber-100 text-amber-700 mb-1">
                              {schema.name}
                            </Badge>
                            <p className="text-xs text-gray-500">
                              Score each criterion from 1-{schema.maxPerCriteria}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-lg font-semibold">
                            {totalScore} / {maxScore}
                          </Badge>
                        </div>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                          {schema.criteria.map(criteria => (
                            <div key={criteria.key} className="space-y-2 p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0 pr-3">
                                  <Label className="text-sm font-medium">{criteria.label}</Label>
                                  <p className="text-xs text-gray-500 line-clamp-2">{criteria.description}</p>
                                </div>
                                <span className="text-xl font-bold text-blue-600 w-10 text-center bg-white rounded-lg py-1 border">
                                  {reviewForm.scores[criteria.key] || "-"}
                                </span>
                              </div>
                              <Slider
                                value={[reviewForm.scores[criteria.key] || 0]}
                                onValueChange={([v]) =>
                                  setReviewForm({
                                    ...reviewForm,
                                    scores: { ...reviewForm.scores, [criteria.key]: v },
                                  })
                                }
                                max={schema.maxPerCriteria}
                                min={1}
                                step={1}
                                disabled={!!selectedReview.reviewed_at}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs text-gray-400">
                                <span>1</span>
                                <span>{schema.maxPerCriteria}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  <div>
                    <Label>Recommendation</Label>
                    {(() => {
                      const schema = getScoringSchema(
                        selectedReview.abstract.presentation_type,
                        selectedReview.abstract.category?.name,
                        selectedReview.abstract.abstract_number
                      )
                      const recommendations = schema.mode === "simple" ? SIMPLE_RECOMMENDATIONS : AWARD_RECOMMENDATIONS

                      return (
                        <Select
                          value={reviewForm.recommendation}
                          onValueChange={v => setReviewForm({ ...reviewForm, recommendation: v })}
                          disabled={!!selectedReview.reviewed_at}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select recommendation" />
                          </SelectTrigger>
                          <SelectContent>
                            {recommendations.map(rec => (
                              <SelectItem key={rec.value} value={rec.value}>
                                {rec.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    })()}
                  </div>

                  <div>
                    <Label>Comments to Author</Label>
                    <Textarea
                      value={reviewForm.comments_to_author}
                      onChange={e => setReviewForm({ ...reviewForm, comments_to_author: e.target.value })}
                      placeholder="Feedback that will be shared with the author..."
                      rows={3}
                      disabled={!!selectedReview.reviewed_at}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Private Notes (Editors only)</Label>
                    <Textarea
                      value={reviewForm.comments_private}
                      onChange={e => setReviewForm({ ...reviewForm, comments_private: e.target.value })}
                      placeholder="Confidential notes for editors..."
                      rows={2}
                      disabled={!!selectedReview.reviewed_at}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                  {selectedReview.reviewed_at ? "Close" : "Cancel"}
                </Button>
                {!selectedReview.reviewed_at && (
                  <Button onClick={handleSubmitReview} disabled={submitReview.isPending}>
                    {submitReview.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Submit Review
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <div className="text-center py-8 text-sm text-gray-500">
        <p>AMASI - Association of Minimal Access Surgeons of India</p>
        <p className="text-xs mt-1">If you have questions, please contact the AMASI team.</p>
      </div>
    </div>
  )
}
