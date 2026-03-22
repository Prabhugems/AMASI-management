"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  FileText,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  User,
  Calendar,
  Tag,
  ExternalLink,
  Users,
  MessageSquare,
  ClipboardCheck,
  Sparkles,
  Trophy,
  ChevronRight,
  Zap,
  Target,
  TrendingUp,
  Filter,
  RefreshCw,
  Ban,
  AlertOctagon,
  Shield,
  Plus,
  X,
  Building2,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type ScoringCriterion = {
  label: string
  description: string
  max_score: number
}

type CategoryData = {
  id: string
  name: string
  scoring_criteria: ScoringCriterion[] | null
  is_award_category: boolean
  award_name: string | null
}

type AbstractData = {
  id: string
  abstract_number: string
  title: string
  abstract_text: string
  keywords: string[] | null
  presentation_type: string
  status: string
  category_id: string | null
  presenting_author_name?: string
  presenting_author_email?: string
  presenting_author_affiliation?: string
  file_url: string | null
  file_name: string | null
  submitted_at: string
  category?: { id: string; name: string; scoring_criteria?: ScoringCriterion[] | null }
  authors?: { id: string; name: string; email?: string; affiliation?: string; author_order: number; is_presenting: boolean }[]
  reviews?: {
    id: string
    reviewer_name: string
    reviewer_email: string
    score_originality: number
    score_methodology: number
    score_relevance: number
    score_clarity: number
    overall_score: number
    scores: Record<string, number> | null
    total_score: number | null
    max_possible_score: number | null
    review_type: string
    recommendation: string
    comments_to_author: string
    reviewed_at: string
  }[]
}

type PortalData = {
  event: {
    id: string
    name: string
    short_name: string
    start_date: string
    end_date: string
    venue_name: string
    city: string
  }
  settings: {
    blind_review: boolean
    review_enabled: boolean
    reviewers_per_abstract: number
    restrict_reviewers: boolean
  }
  categories: CategoryData[]
  abstracts: AbstractData[]
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  submitted: { bg: "bg-blue-100", text: "text-blue-700", label: "Submitted" },
  under_review: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Under Review" },
  revision_requested: { bg: "bg-orange-100", text: "text-orange-700", label: "Revision Requested" },
  accepted: { bg: "bg-green-100", text: "text-green-700", label: "Accepted" },
  rejected: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
  withdrawn: { bg: "bg-gray-100", text: "text-gray-600", label: "Withdrawn" },
}

export default function AbstractReviewerPortal() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  // Entry screen state
  const [reviewerName, setReviewerName] = useState("")
  const [reviewerEmail, setReviewerEmail] = useState("")
  const [hasEntered, setHasEntered] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationError, setValidationError] = useState("")

  // Portal state
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [selectedAbstract, setSelectedAbstract] = useState<AbstractData | null>(null)

  // Review form state
  const [reviewScores, setReviewScores] = useState({
    score_originality: 7,
    score_methodology: 7,
    score_relevance: 7,
    score_clarity: 7,
    recommendation: "undecided",
    comments_to_author: "",
    comments_private: "",
  })
  const [dynamicScores, setDynamicScores] = useState<Record<string, number>>({})

  // Decline dialog state
  const [showDeclineDialog, setShowDeclineDialog] = useState(false)
  const [declineReason, setDeclineReason] = useState("")
  const [declineNotes, setDeclineNotes] = useState("")
  const [decliningAbstract, setDecliningAbstract] = useState<AbstractData | null>(null)

  // COI declaration state
  const [showCoiSection, setShowCoiSection] = useState(false)
  const [newCoiType, setNewCoiType] = useState<"institution" | "co_author" | "personal" | "other">("institution")
  const [newCoiValue, setNewCoiValue] = useState("")
  const [newCoiReason, setNewCoiReason] = useState("")
  const [addingCoi, setAddingCoi] = useState(false)

  // Fetch COI conflicts for this reviewer
  const { data: coiConflicts = [], refetch: refetchCoi } = useQuery({
    queryKey: ["reviewer-coi", eventId, reviewerEmail],
    queryFn: async () => {
      const res = await fetch(`/api/abstracts/reviewer-conflicts?event_id=${eventId}&email=${encodeURIComponent(reviewerEmail.trim())}`)
      if (!res.ok) return []
      const data = await res.json()
      return data.conflicts || []
    },
    enabled: hasEntered && !!reviewerEmail,
  })

  // Add COI mutation
  const addCoiMutation = useMutation({
    mutationFn: async (conflict: { conflict_type: string; conflict_value: string; conflict_reason?: string }) => {
      const res = await fetch("/api/abstracts/reviewer-conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          email: reviewerEmail.trim(),
          ...conflict,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to add conflict")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Conflict of interest declared")
      refetchCoi()
      setNewCoiValue("")
      setNewCoiReason("")
      setAddingCoi(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Remove COI mutation
  const removeCoiMutation = useMutation({
    mutationFn: async (conflictId: string) => {
      const res = await fetch(`/api/abstracts/reviewer-conflicts?id=${conflictId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to remove conflict")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Conflict removed")
      refetchCoi()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Fetch data — only after entry, pass email for server-side filtering
  const { data: portalData, isLoading, error } = useQuery({
    queryKey: ["abstract-reviewer", eventId, reviewerEmail],
    queryFn: async () => {
      const url = reviewerEmail
        ? `/api/abstract-reviewer/${eventId}?email=${encodeURIComponent(reviewerEmail.trim())}`
        : `/api/abstract-reviewer/${eventId}`
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to load data")
      }
      return res.json() as Promise<PortalData>
    },
    enabled: hasEntered,
  })

  // Helper: get scoring criteria for a given abstract
  const getCriteriaForAbstract = (abstract: AbstractData | null): ScoringCriterion[] | null => {
    if (!abstract?.category?.scoring_criteria?.length) return null
    return abstract.category.scoring_criteria
  }

  // Decline assignment mutation
  const declineAssignment = useMutation({
    mutationFn: async (abstractId: string) => {
      const res = await fetch(`/api/abstracts/${abstractId}/reviewer-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "decline",
          reviewer_id: null, // Server will look up by email
          reviewer_token: null,
          reason: declineReason,
          declined_notes: declineNotes,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to decline")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Assignment declined. The committee will reassign this abstract.")
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewer", eventId] })
      setShowDeclineDialog(false)
      setDecliningAbstract(null)
      setDeclineReason("")
      setDeclineNotes("")
      setSelectedAbstract(null)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Submit review mutation
  const submitReview = useMutation({
    mutationFn: async (abstractId: string) => {
      const abstract = abstracts.find(a => a.id === abstractId)
      const criteria = getCriteriaForAbstract(abstract || null)
      const useDynamic = criteria && criteria.length > 0

      const payload: Record<string, any> = {
        abstract_id: abstractId,
        reviewer_name: reviewerName,
        reviewer_email: reviewerEmail,
        recommendation: reviewScores.recommendation,
        comments_to_author: reviewScores.comments_to_author,
        comments_private: reviewScores.comments_private,
      }

      if (useDynamic) {
        payload.scores = dynamicScores
        payload.max_possible_score = criteria.reduce((s, c) => s + c.max_score, 0)
      } else {
        payload.score_originality = reviewScores.score_originality
        payload.score_methodology = reviewScores.score_methodology
        payload.score_relevance = reviewScores.score_relevance
        payload.score_clarity = reviewScores.score_clarity
      }

      const res = await fetch(`/api/abstract-reviewer/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to submit review")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Review submitted successfully!")
      queryClient.invalidateQueries({ queryKey: ["abstract-reviewer", eventId] })
      setSelectedAbstract(null)
      setReviewScores({
        score_originality: 7,
        score_methodology: 7,
        score_relevance: 7,
        score_clarity: 7,
        recommendation: "undecided",
        comments_to_author: "",
        comments_private: "",
      })
      setDynamicScores({})
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const event = portalData?.event
  const settings = portalData?.settings
  const abstracts = useMemo(() => portalData?.abstracts || [], [portalData?.abstracts])

  // Categories list for filter
  const categories = useMemo(() => {
    const cats = new Map<string, string>()
    abstracts.forEach((a) => {
      if (a.category) cats.set(a.category.id, a.category.name)
    })
    return Array.from(cats.entries())
  }, [abstracts])

  // Filtered abstracts
  const filteredAbstracts = useMemo(() => {
    return abstracts.filter((a) => {
      const matchesSearch =
        !search ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.abstract_number.toLowerCase().includes(search.toLowerCase()) ||
        (a.presenting_author_name || "").toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === "all" || a.status === statusFilter
      const matchesCategory = categoryFilter === "all" || a.category?.id === categoryFilter

      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [abstracts, search, statusFilter, categoryFilter])

  // Stats
  const stats = useMemo(() => {
    const reviewedByMe = abstracts.filter((a) =>
      a.reviews?.some((r) => r.reviewer_email === reviewerEmail)
    ).length

    const avgScores = abstracts
      .flatMap((a) => a.reviews || [])
      .filter((r) => r.overall_score)
      .map((r) => r.overall_score)

    const avgScore =
      avgScores.length > 0
        ? (avgScores.reduce((a, b) => a + b, 0) / avgScores.length).toFixed(1)
        : null

    return {
      total: abstracts.length,
      pending: abstracts.filter((a) => !a.reviews?.some((r) => r.reviewer_email === reviewerEmail)).length,
      reviewedByMe,
      avgScore,
    }
  }, [abstracts, reviewerEmail])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const isReviewedByMe = (abstract: AbstractData) => {
    return abstract.reviews?.some((r) => r.reviewer_email === reviewerEmail)
  }

  const getAbstractAvgScore = (abstract: AbstractData) => {
    const scores = (abstract.reviews || []).filter((r) => r.overall_score).map((r) => r.overall_score)
    if (scores.length === 0) return null
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  }

  const legacyOverallScore = (
    (reviewScores.score_originality +
      reviewScores.score_methodology +
      reviewScores.score_relevance +
      reviewScores.score_clarity) / 4
  ).toFixed(1)

  const getDynamicTotal = () => {
    return Object.values(dynamicScores).reduce((a, b) => a + b, 0)
  }

  const getDynamicMax = (criteria: ScoringCriterion[]) => {
    return criteria.reduce((s, c) => s + c.max_score, 0)
  }

  // We need event info for the entry screen — fetch it separately (lightweight)
  const { data: eventInfo } = useQuery({
    queryKey: ["abstract-reviewer-event", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-reviewer/${eventId}`)
      if (!res.ok) return null
      const data = await res.json()
      return { event: data.event, settings: data.settings }
    },
  })

  // Use either the full portal data or the lightweight event info
  const eventForDisplay = portalData?.event || eventInfo?.event
  const settingsForDisplay = portalData?.settings || eventInfo?.settings

  // Loading state (only show after entry)
  if (hasEntered && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading reviewer portal...</p>
        </div>
      </div>
    )
  }

  // Error state (only show after entry)
  if (hasEntered && (error || !portalData?.event)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-muted-foreground">
            This reviewer link is invalid or has expired. Please contact the event organizer for a new link.
          </p>
        </div>
      </div>
    )
  }

  // Entry screen
  if (!hasEntered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
          <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: "2s" }} />
        </div>

        <div className="relative z-10 w-full max-w-md mx-auto p-8 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl">
          <div className="text-center mb-8">
            <div className="relative inline-block">
              <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-purple-500/30">
                <ClipboardCheck className="h-10 w-10 text-white" />
              </div>
              <Sparkles className="h-6 w-6 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Abstract Reviewer Portal</h1>
            <p className="text-purple-200 text-lg">{eventForDisplay?.name || "Loading..."}</p>
            {eventForDisplay?.start_date && (
              <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full bg-white/10 border border-white/20">
                <Calendar className="h-4 w-4 text-purple-300" />
                <span className="text-sm text-purple-200">
                  {formatDate(eventForDisplay.start_date)} - {formatDate(eventForDisplay.end_date)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-purple-200 mb-2 block">Your Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-400" />
                <Input
                  value={reviewerName}
                  onChange={(e) => { setReviewerName(e.target.value); setValidationError("") }}
                  placeholder="Enter your full name"
                  className="pl-12 h-12 bg-white/5 border-white/20 text-white placeholder:text-purple-300/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-purple-200 mb-2 block">Your Email</label>
              <div className="relative">
                <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-400" />
                <Input
                  type="email"
                  value={reviewerEmail}
                  onChange={(e) => { setReviewerEmail(e.target.value); setValidationError("") }}
                  placeholder="Enter your email"
                  className="pl-12 h-12 bg-white/5 border-white/20 text-white placeholder:text-purple-300/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            {validationError && (
              <div className="flex items-start gap-3 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-sm text-red-200">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-400" />
                <span>{validationError}</span>
              </div>
            )}
            <Button
              onClick={async () => {
                if (settingsForDisplay?.restrict_reviewers) {
                  setValidating(true)
                  setValidationError("")
                  try {
                    const res = await fetch(`/api/abstract-reviewers/${eventId}/validate`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email: reviewerEmail.trim() }),
                    })
                    const data = await res.json()
                    if (!data.valid) {
                      setValidationError("This email is not registered as a reviewer for this event. Please contact the organizers.")
                      setValidating(false)
                      return
                    }
                    if (data.reviewer?.name) {
                      setReviewerName(data.reviewer.name)
                    }
                  } catch {
                    setValidationError("Failed to validate. Please try again.")
                    setValidating(false)
                    return
                  }
                  setValidating(false)
                }
                setHasEntered(true)
              }}
              disabled={!reviewerName.trim() || !reviewerEmail.trim() || validating}
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl shadow-lg shadow-purple-500/25 font-semibold text-base"
            >
              {validating && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
              <Zap className="h-5 w-5 mr-2" />
              Enter Portal
            </Button>
          </div>

          <p className="text-xs text-purple-300/60 text-center mt-6 flex items-center justify-center gap-2">
            <User className="h-3 w-3" />
            Your name and email will be attached to reviews you submit.
          </p>
        </div>
      </div>
    )
  }

  // Main portal
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-purple-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <ClipboardCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">Abstract Reviewer Portal</h1>
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {event?.name} {event?.city ? `• ${event.city}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 border border-purple-100">
                <Calendar className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium text-purple-700">
                  {event?.start_date && formatDate(event.start_date)} - {event?.end_date && formatDate(event.end_date)}
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">{reviewerName}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Progress & Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20 p-5 hover:shadow-lg hover:shadow-primary/10 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold text-primary">{stats.total}</p>
                <p className="text-sm text-muted-foreground mt-1">Total Abstracts</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
          </div>

          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-5 hover:shadow-lg hover:shadow-amber-500/10 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold text-amber-600">{stats.pending}</p>
                <p className="text-sm text-muted-foreground mt-1">Pending Review</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
            {stats.pending > 0 && (
              <div className="absolute top-3 right-3">
                <div className="h-3 w-3 bg-amber-500 rounded-full animate-pulse" />
              </div>
            )}
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl" />
          </div>

          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 p-5 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold text-emerald-600">{stats.reviewedByMe}</p>
                <p className="text-sm text-muted-foreground mt-1">Reviewed by Me</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
          </div>

          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 p-5 hover:shadow-lg hover:shadow-blue-500/10 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold text-blue-600">{stats.avgScore || "—"}</p>
                <p className="text-sm text-muted-foreground mt-1">Average Score</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" />
          </div>
        </div>

        {/* Progress Bar */}
        {stats.total > 0 && (
          <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-purple-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-500" />
                <span className="font-medium">Your Progress</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {stats.reviewedByMe} of {stats.total} reviewed ({Math.round((stats.reviewedByMe / stats.total) * 100)}%)
              </span>
            </div>
            <div className="h-3 rounded-full bg-purple-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${Math.round((stats.reviewedByMe / stats.total) * 100)}%` }}
              />
            </div>
            {stats.reviewedByMe === stats.total && stats.total > 0 && (
              <div className="flex items-center gap-2 mt-3 text-emerald-600">
                <Trophy className="h-5 w-5" />
                <span className="font-medium">All abstracts reviewed! Great work!</span>
              </div>
            )}
          </div>
        )}

        {/* COI Declaration Section */}
        <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-purple-100 overflow-hidden">
          <button
            onClick={() => setShowCoiSection(!showCoiSection)}
            className="w-full p-4 flex items-center justify-between hover:bg-purple-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Shield className="h-5 w-5 text-amber-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Conflict of Interest Declaration</h3>
                <p className="text-sm text-muted-foreground">
                  {coiConflicts.length > 0
                    ? `${coiConflicts.length} conflict${coiConflicts.length !== 1 ? "s" : ""} declared`
                    : "Declare any conflicts of interest"}
                </p>
              </div>
            </div>
            <ChevronDown className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              showCoiSection && "rotate-180"
            )} />
          </button>

          {showCoiSection && (
            <div className="p-4 border-t border-purple-100 space-y-4">
              <p className="text-sm text-muted-foreground">
                Declare any conflicts of interest (e.g., co-authors, same institution, personal relationships).
                Abstracts from declared conflicts will be flagged for reassignment.
              </p>

              {/* Existing conflicts */}
              {coiConflicts.length > 0 && (
                <div className="space-y-2">
                  {coiConflicts.map((conflict: { id: string; conflict_type: string; conflict_value: string; conflict_reason?: string }) => (
                    <div
                      key={conflict.id}
                      className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold",
                          conflict.conflict_type === "institution" ? "bg-blue-100 text-blue-700" :
                          conflict.conflict_type === "co_author" ? "bg-purple-100 text-purple-700" :
                          conflict.conflict_type === "personal" ? "bg-pink-100 text-pink-700" :
                          "bg-gray-100 text-gray-700"
                        )}>
                          {conflict.conflict_type === "institution" ? <Building2 className="h-4 w-4" /> :
                           conflict.conflict_type === "co_author" ? <Users className="h-4 w-4" /> :
                           conflict.conflict_type === "personal" ? <User className="h-4 w-4" /> :
                           <AlertCircle className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{conflict.conflict_value}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {conflict.conflict_type.replace("_", " ")}
                            {conflict.conflict_reason && ` • ${conflict.conflict_reason}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCoiMutation.mutate(conflict.id)}
                        disabled={removeCoiMutation.isPending}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new conflict form */}
              {addingCoi ? (
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Conflict Type</label>
                      <Select value={newCoiType} onValueChange={(v: "institution" | "co_author" | "personal" | "other") => setNewCoiType(v)}>
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="institution">
                            <span className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" /> Same Institution
                            </span>
                          </SelectItem>
                          <SelectItem value="co_author">
                            <span className="flex items-center gap-2">
                              <Users className="h-4 w-4" /> Co-author
                            </span>
                          </SelectItem>
                          <SelectItem value="personal">
                            <span className="flex items-center gap-2">
                              <User className="h-4 w-4" /> Personal Relationship
                            </span>
                          </SelectItem>
                          <SelectItem value="other">
                            <span className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" /> Other
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        {newCoiType === "institution" ? "Institution Name" :
                         newCoiType === "co_author" ? "Author Name/Email" :
                         newCoiType === "personal" ? "Person Name" : "Conflict Details"}
                      </label>
                      <Input
                        value={newCoiValue}
                        onChange={(e) => setNewCoiValue(e.target.value)}
                        placeholder={
                          newCoiType === "institution" ? "e.g., ABC Medical College" :
                          newCoiType === "co_author" ? "e.g., Dr. John Doe" :
                          newCoiType === "personal" ? "e.g., Spouse, Family member" :
                          "Describe the conflict"
                        }
                        className="bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Reason (optional)</label>
                    <Input
                      value={newCoiReason}
                      onChange={(e) => setNewCoiReason(e.target.value)}
                      placeholder="Additional context about this conflict..."
                      className="bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAddingCoi(false)
                        setNewCoiValue("")
                        setNewCoiReason("")
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => addCoiMutation.mutate({
                        conflict_type: newCoiType,
                        conflict_value: newCoiValue,
                        conflict_reason: newCoiReason || undefined,
                      })}
                      disabled={!newCoiValue.trim() || addCoiMutation.isPending}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      {addCoiMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Declare Conflict
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setAddingCoi(true)}
                  className="w-full border-dashed border-purple-300 text-purple-600 hover:bg-purple-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Conflict of Interest
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl bg-white/80 backdrop-blur-sm border border-purple-100">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-400" />
            <Input
              placeholder="Search by title, number, or author..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-11 bg-white border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-11 bg-white border-purple-100 rounded-xl">
                <Filter className="h-4 w-4 mr-2 text-purple-400" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {categories.length > 0 && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px] h-11 bg-white border-purple-100 rounded-xl">
                  <Tag className="h-4 w-4 mr-2 text-purple-400" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Badge variant="secondary" className="px-4 py-2 bg-purple-100 text-purple-700 border-0 rounded-xl">
            {filteredAbstracts.length} abstract{filteredAbstracts.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Abstracts List */}
        {filteredAbstracts.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border-2 border-dashed border-purple-200 bg-white/50">
            <div className="h-20 w-20 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-10 w-10 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No abstracts found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {abstracts.length === 0
                ? "No abstracts have been submitted for this event yet"
                : "Try adjusting your search or filters"}
            </p>
            {search || statusFilter !== "all" || categoryFilter !== "all" ? (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => { setSearch(""); setStatusFilter("all"); setCategoryFilter("all") }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAbstracts.map((abstract) => {
              const status = statusColors[abstract.status] || statusColors.submitted
              const reviewed = isReviewedByMe(abstract)
              const avgScore = getAbstractAvgScore(abstract)
              const reviewCount = abstract.reviews?.length || 0

              return (
                <button
                  key={abstract.id}
                  onClick={() => {
                    setSelectedAbstract(abstract)
                    const criteria = getCriteriaForAbstract(abstract)
                    if (criteria && criteria.length > 0) {
                      const initial: Record<string, number> = {}
                      criteria.forEach(c => { initial[c.label] = 0 })
                      setDynamicScores(initial)
                    } else {
                      setDynamicScores({})
                    }
                  }}
                  className={cn(
                    "w-full text-left rounded-2xl border p-5 transition-all hover:shadow-lg group",
                    reviewed
                      ? "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 hover:border-emerald-300"
                      : "bg-white/80 backdrop-blur-sm border-purple-100 hover:border-purple-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-mono text-sm font-bold px-3 py-1 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                          {abstract.abstract_number}
                        </span>
                        <span className={cn("px-3 py-1 text-xs font-semibold rounded-lg", status.bg, status.text)}>
                          {status.label}
                        </span>
                        {abstract.category && (
                          <span className="px-3 py-1 text-xs font-medium rounded-lg bg-purple-100 text-purple-700">
                            {abstract.category.name}
                          </span>
                        )}
                        <span className="px-3 py-1 text-xs font-medium rounded-lg bg-blue-100 text-blue-700 capitalize">
                          {abstract.presentation_type}
                        </span>
                        {reviewed && (
                          <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-500 text-white">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Reviewed
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-base line-clamp-2 group-hover:text-purple-700 transition-colors">
                        {abstract.title}
                      </h3>
                      {!settings?.blind_review && abstract.presenting_author_name && (
                        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {abstract.presenting_author_name}
                          {abstract.presenting_author_affiliation && ` • ${abstract.presenting_author_affiliation}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {/* Review count */}
                      <div className="text-center px-4 py-2 rounded-xl bg-purple-50">
                        <div className="flex items-center justify-center gap-1.5 text-purple-600">
                          <MessageSquare className="h-4 w-4" />
                          <span className="font-bold">{reviewCount}</span>
                        </div>
                        <p className="text-[10px] uppercase tracking-wide text-purple-400 mt-0.5">reviews</p>
                      </div>
                      {/* Average score */}
                      {avgScore && (
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm",
                          parseFloat(avgScore) >= 7 ? "bg-gradient-to-br from-emerald-400 to-green-500 text-white" :
                          parseFloat(avgScore) >= 5 ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white" :
                          "bg-gradient-to-br from-red-400 to-pink-500 text-white"
                        )}>
                          {avgScore}
                        </div>
                      )}
                      <ChevronRight className={cn(
                        "h-5 w-5 transition-transform",
                        reviewed ? "text-emerald-400" : "text-purple-300 group-hover:text-purple-500 group-hover:translate-x-1"
                      )} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {/* Review Dialog */}
      <Dialog open={!!selectedAbstract} onOpenChange={(open) => !open && setSelectedAbstract(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedAbstract && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="font-mono text-primary">{selectedAbstract.abstract_number}</span>
                  <span className={cn(
                    "px-2 py-0.5 text-xs font-medium rounded-full",
                    statusColors[selectedAbstract.status]?.bg,
                    statusColors[selectedAbstract.status]?.text
                  )}>
                    {statusColors[selectedAbstract.status]?.label}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Abstract Content */}
                <div>
                  <h2 className="text-lg font-bold mb-3">{selectedAbstract.title}</h2>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Abstract Text</span>
                      <span className="text-xs text-muted-foreground">
                        {selectedAbstract.abstract_text?.trim().split(/\s+/).length || 0} words
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {selectedAbstract.abstract_text}
                    </p>
                  </div>
                </div>

                {/* Keywords */}
                {selectedAbstract.keywords && selectedAbstract.keywords.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {selectedAbstract.keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-1 bg-muted rounded-md text-sm">{kw}</span>
                    ))}
                  </div>
                )}

                {/* Authors (if not blind) */}
                {!settings?.blind_review && selectedAbstract.authors && selectedAbstract.authors.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-primary" />
                      Authors
                    </h3>
                    <div className="space-y-2">
                      {selectedAbstract.authors
                        .sort((a, b) => a.author_order - b.author_order)
                        .map((author) => (
                          <div key={author.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg text-sm">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                              {author.author_order}
                            </div>
                            <span className="font-medium">{author.name}</span>
                            {author.is_presenting && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                Presenting
                              </span>
                            )}
                            {author.affiliation && (
                              <span className="text-muted-foreground">{author.affiliation}</span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Blind review notice */}
                {settings?.blind_review && selectedAbstract.authors && selectedAbstract.authors.length > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Blind review is enabled. Author identities are hidden.
                  </div>
                )}

                {/* File attachment */}
                {selectedAbstract.file_url && (
                  <div>
                    <a
                      href={selectedAbstract.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      {selectedAbstract.file_name || "Download Attachment"}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {/* Existing Reviews Summary */}
                {selectedAbstract.reviews && selectedAbstract.reviews.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <Star className="h-4 w-4 text-yellow-500" />
                      Existing Reviews ({selectedAbstract.reviews.length})
                    </h3>
                    <div className="space-y-3">
                      {selectedAbstract.reviews.map((review) => (
                        <div key={review.id} className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{review.reviewer_name}</span>
                            <div className="flex items-center gap-2">
                              {review.recommendation && (
                                <span className={cn(
                                  "px-2 py-0.5 text-xs font-medium rounded-full capitalize",
                                  review.recommendation === "accept" ? "bg-green-100 text-green-700" :
                                  review.recommendation === "reject" ? "bg-red-100 text-red-700" :
                                  review.recommendation === "revise" ? "bg-orange-100 text-orange-700" :
                                  "bg-gray-100 text-gray-600"
                                )}>
                                  {review.recommendation}
                                </span>
                              )}
                              {review.total_score != null && review.max_possible_score ? (
                                <span className="text-sm font-bold">
                                  {review.total_score}/{review.max_possible_score}
                                </span>
                              ) : review.overall_score ? (
                                <span className={cn(
                                  "w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold",
                                  review.overall_score >= 7 ? "bg-green-100 text-green-700" :
                                  review.overall_score >= 5 ? "bg-yellow-100 text-yellow-700" :
                                  "bg-red-100 text-red-700"
                                )}>
                                  {review.overall_score.toFixed(1)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {review.scores && Object.keys(review.scores).length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                              {Object.entries(review.scores).map(([label, score]) => (
                                <div key={label} className="text-center p-1.5 bg-background rounded">
                                  <p className="text-muted-foreground truncate">{label}</p>
                                  <p className="font-semibold">{score as number}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            {[
                              { label: "Originality", score: review.score_originality },
                              { label: "Methodology", score: review.score_methodology },
                              { label: "Relevance", score: review.score_relevance },
                              { label: "Clarity", score: review.score_clarity },
                            ].map((item) => (
                              <div key={item.label} className="text-center p-1.5 bg-background rounded">
                                <p className="text-muted-foreground">{item.label}</p>
                                <p className="font-semibold">{item.score || "\u2014"}</p>
                              </div>
                            ))}
                          </div>
                          )}
                          {review.comments_to_author && (
                            <p className="text-sm text-muted-foreground mt-2 italic">
                              &ldquo;{review.comments_to_author}&rdquo;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Review Form */}
                {isReviewedByMe(selectedAbstract) ? (
                  <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">You have already reviewed this abstract.</span>
                  </div>
                ) : (
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <Star className="h-5 w-5 text-yellow-500" />
                      Submit Your Review
                    </h3>

                    {/* Scoring Criteria */}
                    {(() => {
                      const criteria = getCriteriaForAbstract(selectedAbstract)
                      if (criteria && criteria.length > 0) {
                        // Dynamic scoring based on category criteria
                        const maxTotal = getDynamicMax(criteria)
                        const currentTotal = getDynamicTotal()
                        return (
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              Rate each criterion using the slider (0 to max score)
                            </p>
                            {criteria.map((criterion) => {
                              const score = dynamicScores[criterion.label] ?? 0
                              return (
                                <div key={criterion.label} className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <label className="font-medium">{criterion.label}</label>
                                      <p className="text-xs text-muted-foreground">{criterion.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="range"
                                        min="0"
                                        max={criterion.max_score}
                                        value={score}
                                        onChange={(e) =>
                                          setDynamicScores({
                                            ...dynamicScores,
                                            [criterion.label]: parseInt(e.target.value),
                                          })
                                        }
                                        className="w-32 accent-primary"
                                      />
                                      <span className={cn(
                                        "w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm",
                                        score >= criterion.max_score * 0.7 ? "bg-green-100 text-green-700" :
                                        score >= criterion.max_score * 0.5 ? "bg-yellow-100 text-yellow-700" :
                                        "bg-red-100 text-red-700"
                                      )}>
                                        {score}
                                      </span>
                                      <span className="text-xs text-muted-foreground">/{criterion.max_score}</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                            {/* Total Score */}
                            <div className="p-4 bg-primary/5 rounded-lg flex items-center justify-between">
                              <span className="font-medium">Total Score</span>
                              <span className="text-2xl font-bold text-primary">{currentTotal} / {maxTotal}</span>
                            </div>
                          </div>
                        )
                      }
                      // Fallback: Legacy 4 fixed criteria
                      return (
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Rate each criterion from 1 (Poor) to 10 (Excellent)
                          </p>
                          {[
                            { key: "score_originality", label: "Originality", desc: "Novelty and innovation of the research" },
                            { key: "score_methodology", label: "Methodology", desc: "Quality and rigor of methods used" },
                            { key: "score_relevance", label: "Relevance", desc: "Importance and relevance to the field" },
                            { key: "score_clarity", label: "Clarity", desc: "Quality of writing and presentation" },
                          ].map((criterion) => (
                            <div key={criterion.key} className="space-y-2">
                              <div className="flex justify-between items-center">
                                <div>
                                  <label className="font-medium">{criterion.label}</label>
                                  <p className="text-xs text-muted-foreground">{criterion.desc}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={reviewScores[criterion.key as keyof typeof reviewScores] as number}
                                    onChange={(e) =>
                                      setReviewScores({
                                        ...reviewScores,
                                        [criterion.key]: parseInt(e.target.value),
                                      })
                                    }
                                    className="w-32 accent-primary"
                                  />
                                  <span className={cn(
                                    "w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm",
                                    (reviewScores[criterion.key as keyof typeof reviewScores] as number) >= 7 ? "bg-green-100 text-green-700" :
                                    (reviewScores[criterion.key as keyof typeof reviewScores] as number) >= 5 ? "bg-yellow-100 text-yellow-700" :
                                    "bg-red-100 text-red-700"
                                  )}>
                                    {reviewScores[criterion.key as keyof typeof reviewScores]}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {/* Overall Score */}
                          <div className="p-4 bg-primary/5 rounded-lg flex items-center justify-between">
                            <span className="font-medium">Overall Score (auto-calculated)</span>
                            <span className="text-2xl font-bold text-primary">{legacyOverallScore}</span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Recommendation */}
                    <div className="mt-4">
                      <label className="text-sm font-medium">Recommendation</label>
                      <Select
                        value={reviewScores.recommendation}
                        onValueChange={(val) => setReviewScores({ ...reviewScores, recommendation: val })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="accept">
                            <span className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Accept
                            </span>
                          </SelectItem>
                          <SelectItem value="revise">
                            <span className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                              Accept with Revisions
                            </span>
                          </SelectItem>
                          <SelectItem value="reject">
                            <span className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-red-500" />
                              Reject
                            </span>
                          </SelectItem>
                          <SelectItem value="undecided">
                            <span className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-500" />
                              Undecided
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Comments */}
                    <div className="mt-4">
                      <label className="text-sm font-medium">Comments to Author</label>
                      <textarea
                        value={reviewScores.comments_to_author}
                        onChange={(e) => setReviewScores({ ...reviewScores, comments_to_author: e.target.value })}
                        placeholder="Constructive feedback visible to the author..."
                        rows={3}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>

                    <div className="mt-4">
                      <label className="text-sm font-medium">Private Comments (Admin only)</label>
                      <textarea
                        value={reviewScores.comments_private}
                        onChange={(e) => setReviewScores({ ...reviewScores, comments_private: e.target.value })}
                        placeholder="Notes for the committee, not visible to author..."
                        rows={2}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button variant="outline" onClick={() => setSelectedAbstract(null)}>
                    Close
                  </Button>
                  {!isReviewedByMe(selectedAbstract) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDecliningAbstract(selectedAbstract)
                        setShowDeclineDialog(true)
                      }}
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Decline
                    </Button>
                  )}
                </div>
                {!isReviewedByMe(selectedAbstract) && (
                  <Button
                    onClick={() => submitReview.mutate(selectedAbstract.id)}
                    disabled={submitReview.isPending}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    {submitReview.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Submit Review
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Decline Assignment Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={(open) => {
        if (!open) {
          setShowDeclineDialog(false)
          setDecliningAbstract(null)
          setDeclineReason("")
          setDeclineNotes("")
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-red-600">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertOctagon className="h-5 w-5 text-red-600" />
              </div>
              Decline Assignment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              You are about to decline reviewing abstract{" "}
              <strong className="text-foreground">{decliningAbstract?.abstract_number}</strong>.
              Please select a reason.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for declining *</label>
              <div className="space-y-2">
                {[
                  { value: "not_my_specialty", label: "Not in my specialty", icon: "🔬", desc: "This abstract is outside my area of expertise" },
                  { value: "conflict_of_interest", label: "Conflict of interest", icon: "⚠️", desc: "I have a conflict with the author(s)" },
                  { value: "no_time", label: "No time available", icon: "⏰", desc: "I cannot complete the review in time" },
                  { value: "other", label: "Other reason", icon: "📝", desc: "Another reason (please specify below)" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDeclineReason(option.value)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                      declineReason === option.value
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <span className="text-xl">{option.icon}</span>
                    <div className="flex-1">
                      <p className={cn(
                        "font-medium text-sm",
                        declineReason === option.value ? "text-red-700" : "text-foreground"
                      )}>
                        {option.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
                    </div>
                    {declineReason === option.value && (
                      <CheckCircle className="h-5 w-5 text-red-500 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {(declineReason === "other" || declineReason === "not_my_specialty") && (
              <div>
                <label className="text-sm font-medium">
                  {declineReason === "not_my_specialty" ? "What specialty would be appropriate?" : "Additional details"}
                </label>
                <textarea
                  value={declineNotes}
                  onChange={(e) => setDeclineNotes(e.target.value)}
                  placeholder={declineReason === "not_my_specialty"
                    ? "e.g., This abstract is about Robotic Surgery, suggest a reviewer with that expertise..."
                    : "Please provide details..."
                  }
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>The committee will be notified and will reassign this abstract to another reviewer.</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => decliningAbstract && declineAssignment.mutate(decliningAbstract.id)}
              disabled={!declineReason || declineAssignment.isPending}
            >
              {declineAssignment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
