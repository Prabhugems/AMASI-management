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
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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
  category?: { id: string; name: string }
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
  }
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

  // Fetch data
  const { data: portalData, isLoading, error } = useQuery({
    queryKey: ["abstract-reviewer", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-reviewer/${eventId}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to load data")
      }
      return res.json() as Promise<PortalData>
    },
  })

  // Submit review mutation
  const submitReview = useMutation({
    mutationFn: async (abstractId: string) => {
      const res = await fetch(`/api/abstract-reviewer/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abstract_id: abstractId,
          reviewer_name: reviewerName,
          reviewer_email: reviewerEmail,
          ...reviewScores,
        }),
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
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const event = portalData?.event
  const settings = portalData?.settings
  const abstracts = portalData?.abstracts || []

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

  const overallScore = (
    (reviewScores.score_originality +
      reviewScores.score_methodology +
      reviewScores.score_relevance +
      reviewScores.score_clarity) / 4
  ).toFixed(1)

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading reviewer portal...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !event) {
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md mx-auto p-8 bg-white rounded-xl border shadow-sm">
          <div className="text-center mb-6">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ClipboardCheck className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Abstract Reviewer Portal</h1>
            <p className="text-muted-foreground mt-2">{event.name}</p>
            {event.start_date && (
              <p className="text-sm text-muted-foreground">
                {formatDate(event.start_date)} - {formatDate(event.end_date)}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Your Name</label>
              <Input
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="Enter your full name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Your Email</label>
              <Input
                type="email"
                value={reviewerEmail}
                onChange={(e) => setReviewerEmail(e.target.value)}
                placeholder="Enter your email"
                className="mt-1"
              />
            </div>
            <Button
              onClick={() => setHasEntered(true)}
              disabled={!reviewerName.trim() || !reviewerEmail.trim()}
              className="w-full"
            >
              Enter Portal
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Your name and email will be attached to reviews you submit.
          </p>
        </div>
      </div>
    )
  }

  // Main portal
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Abstract Reviewer Portal</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {event.name} {event.city ? `\u2022 ${event.city}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                {formatDate(event.start_date)} - {formatDate(event.end_date)}
              </Badge>
              <Badge variant="secondary" className="text-sm">
                <User className="h-3.5 w-3.5 mr-1" />
                {reviewerName}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total Abstracts</span>
            </div>
            <p className="text-3xl font-bold mt-2">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-sm text-muted-foreground">Pending Review</span>
            </div>
            <p className="text-3xl font-bold mt-2 text-amber-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Reviewed by Me</span>
            </div>
            <p className="text-3xl font-bold mt-2 text-green-600">{stats.reviewedByMe}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">Average Score</span>
            </div>
            <p className="text-3xl font-bold mt-2 text-blue-600">{stats.avgScore || "—"}</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, number, or author..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
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
              <SelectTrigger className="w-[180px]">
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
          <span className="text-sm text-muted-foreground">
            {filteredAbstracts.length} abstract{filteredAbstracts.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Abstracts List */}
        {filteredAbstracts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No abstracts found</h3>
            <p className="text-muted-foreground">
              {abstracts.length === 0
                ? "No abstracts have been submitted for this event yet"
                : "Try adjusting your search or filters"}
            </p>
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
                  onClick={() => setSelectedAbstract(abstract)}
                  className={cn(
                    "w-full text-left bg-white rounded-lg border p-4 transition-all hover:shadow-md hover:border-primary/30",
                    reviewed && "border-green-200 bg-green-50/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-primary">
                          {abstract.abstract_number}
                        </span>
                        <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full", status.bg, status.text)}>
                          {status.label}
                        </span>
                        {abstract.category && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            {abstract.category.name}
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-600 capitalize">
                          {abstract.presentation_type}
                        </span>
                        {reviewed && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3" />
                            Reviewed
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-base truncate">{abstract.title}</h3>
                      {!settings?.blind_review && abstract.presenting_author_name && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {abstract.presenting_author_name}
                          {abstract.presenting_author_affiliation && ` \u2022 ${abstract.presenting_author_affiliation}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Review count */}
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span className="text-sm">{reviewCount}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">reviews</p>
                      </div>
                      {/* Average score */}
                      {avgScore && (
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                          parseFloat(avgScore) >= 7 ? "bg-green-100 text-green-700" :
                          parseFloat(avgScore) >= 5 ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {avgScore}
                        </div>
                      )}
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
                              {review.overall_score && (
                                <span className={cn(
                                  "w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold",
                                  review.overall_score >= 7 ? "bg-green-100 text-green-700" :
                                  review.overall_score >= 5 ? "bg-yellow-100 text-yellow-700" :
                                  "bg-red-100 text-red-700"
                                )}>
                                  {review.overall_score.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
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
                        <span className="text-2xl font-bold text-primary">{overallScore}</span>
                      </div>
                    </div>

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

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedAbstract(null)}>
                  Close
                </Button>
                {!isReviewedByMe(selectedAbstract) && (
                  <Button
                    onClick={() => submitReview.mutate(selectedAbstract.id)}
                    disabled={submitReview.isPending}
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
    </div>
  )
}
