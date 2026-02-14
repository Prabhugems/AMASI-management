"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Button } from "@/components/ui/button"
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
  ChevronLeft,
  Loader2,
  User,
  Mail,
  Building2,
  Phone,
  Tag,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Star,
  MessageSquare,
  Users,
  ExternalLink,
  ArrowRightLeft,
  Trophy,
  Medal,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Abstract {
  id: string
  event_id: string
  abstract_number: string
  title: string
  abstract_text: string
  keywords: string[]
  presentation_type: string
  presenting_author_name: string
  presenting_author_email: string
  presenting_author_affiliation: string | null
  presenting_author_phone: string | null
  status: string
  decision_date: string | null
  decision_notes: string | null
  accepted_as: string | null
  category_id: string | null
  file_url: string | null
  file_name: string | null
  submitted_at: string
  amasi_membership_number: string | null
  declarations_accepted: string[] | null
  submitter_metadata: { date_of_birth?: string; current_position?: string } | null
  award_rank: number | null
  award_type: string | null
  is_podium_selected: boolean
  redirected_from_category_id: string | null
  category?: { id: string; name: string; description: string; is_award_category?: boolean; award_name?: string }
  authors?: { id: string; name: string; email: string; affiliation: string; author_order: number; is_presenting: boolean }[]
  reviews?: {
    id: string
    reviewer_name: string
    score_originality: number
    score_methodology: number
    score_relevance: number
    score_clarity: number
    overall_score: number
    recommendation: string
    comments_to_author: string
    comments_private: string
    reviewed_at: string
  }[]
  registration?: { id: string; registration_number: string; attendee_name: string }
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  submitted: { bg: "bg-blue-100", text: "text-blue-700", label: "Submitted" },
  under_review: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Under Review" },
  revision_requested: { bg: "bg-orange-100", text: "text-orange-700", label: "Revision Requested" },
  accepted: { bg: "bg-green-100", text: "text-green-700", label: "Accepted" },
  rejected: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
  withdrawn: { bg: "bg-gray-100", text: "text-gray-600", label: "Withdrawn" },
}

export default function AbstractDetailPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const abstractId = params.abstractId as string
  const queryClient = useQueryClient()

  const [showDecisionDialog, setShowDecisionDialog] = useState(false)
  const [decisionType, setDecisionType] = useState<string>("")
  const [acceptedAs, setAcceptedAs] = useState<string>("oral")
  const [decisionNotes, setDecisionNotes] = useState("")

  // Review form state
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [reviewScores, setReviewScores] = useState({
    score_originality: 7,
    score_methodology: 7,
    score_relevance: 7,
    score_clarity: 7,
    recommendation: "undecided" as string,
    comments_to_author: "",
    comments_private: "",
  })

  // Fetch abstract details
  const { data: abstract, isLoading } = useQuery({
    queryKey: ["abstract", abstractId],
    queryFn: async () => {
      const res = await fetch(`/api/abstracts/${abstractId}`)
      if (!res.ok) throw new Error("Failed to fetch abstract")
      return res.json() as Promise<Abstract>
    },
  })

  // Decision mutation
  const decisionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/abstracts/${abstractId}/decision`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: decisionType,
          accepted_as: decisionType === "accepted" ? acceptedAs : null,
          decision_notes: decisionNotes,
        }),
      })
      if (!res.ok) throw new Error("Failed to update decision")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract", abstractId] })
      queryClient.invalidateQueries({ queryKey: ["abstracts", eventId] })
      setShowDecisionDialog(false)
      setDecisionNotes("")
      setDecisionType("")
      setAcceptedAs("oral")
    },
  })

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/abstracts/${abstractId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewScores),
      })
      if (!res.ok) throw new Error("Failed to submit review")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract", abstractId] })
      queryClient.invalidateQueries({ queryKey: ["abstracts", eventId] })
      setShowReviewDialog(false)
      // Reset form
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
  })

  const openDecisionDialog = (type: string) => {
    setDecisionType(type)
    setShowDecisionDialog(true)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const getAverageScore = () => {
    if (!abstract?.reviews || abstract.reviews.length === 0) return null
    const scores = abstract.reviews.filter((r) => r.overall_score).map((r) => r.overall_score)
    if (scores.length === 0) return null
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  }

  const wordCount = abstract?.abstract_text?.trim().split(/\s+/).length || 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!abstract) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Abstract not found</p>
      </div>
    )
  }

  const status = statusColors[abstract.status] || statusColors.submitted
  const avgScore = getAverageScore()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href={`/events/${eventId}/abstracts`}
            className="mt-1 p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-lg font-semibold text-primary">
                {abstract.abstract_number}
              </span>
              <span className={cn(
                "inline-flex px-3 py-1 text-sm font-medium rounded-full",
                status.bg, status.text
              )}>
                {status.label}
              </span>
              {abstract.accepted_as && (
                <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-emerald-100 text-emerald-700 capitalize">
                  {abstract.accepted_as}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">{abstract.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {abstract.status !== "accepted" && abstract.status !== "rejected" && abstract.status !== "withdrawn" && (
            <>
              <Button
                variant="outline"
                onClick={() => openDecisionDialog("accepted")}
                className="gap-2 text-green-600 border-green-200 hover:bg-green-50"
              >
                <CheckCircle className="h-4 w-4" />
                Accept
              </Button>
              <Button
                variant="outline"
                onClick={() => openDecisionDialog("rejected")}
                className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button
                variant="outline"
                onClick={() => openDecisionDialog("revision_requested")}
                className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                <AlertCircle className="h-4 w-4" />
                Request Revision
              </Button>
              <Button
                variant="outline"
                onClick={() => openDecisionDialog("redirected")}
                className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Redirect to Free Session
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Abstract Text */}
          <div className="bg-card border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Abstract
              </h2>
              <span className="text-sm text-muted-foreground">{wordCount} words</span>
            </div>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                {abstract.abstract_text}
              </p>
            </div>
            {abstract.keywords && abstract.keywords.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  {abstract.keywords.map((keyword, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-muted rounded-md text-sm"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Co-Authors */}
          {abstract.authors && abstract.authors.length > 0 && (
            <div className="bg-card border rounded-xl p-6">
              <h2 className="font-semibold flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-primary" />
                Co-Authors ({abstract.authors.length})
              </h2>
              <div className="space-y-3">
                {abstract.authors
                  .sort((a, b) => a.author_order - b.author_order)
                  .map((author) => (
                    <div
                      key={author.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {author.author_order}
                        </div>
                        <div>
                          <p className="font-medium">
                            {author.name}
                            {author.is_presenting && (
                              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                Presenting
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {author.affiliation || "No affiliation"}
                          </p>
                        </div>
                      </div>
                      {author.email && (
                        <span className="text-sm text-muted-foreground">{author.email}</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="bg-card border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Reviews ({abstract.reviews?.length || 0})
              </h2>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => setShowReviewDialog(true)}
                  className="gap-2"
                >
                  <Star className="h-4 w-4" />
                  Add Review
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span></span>
              {avgScore && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Average Score:</span>
                  <span className={cn(
                    "inline-flex items-center justify-center w-10 h-10 rounded-full text-lg font-bold",
                    parseFloat(avgScore) >= 7 ? "bg-green-100 text-green-700" :
                    parseFloat(avgScore) >= 5 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  )}>
                    {avgScore}
                  </span>
                </div>
              )}
            </div>

            {!abstract.reviews || abstract.reviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No reviews yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {abstract.reviews.map((review) => (
                  <div key={review.id} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{review.reviewer_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {review.recommendation && (
                          <span className={cn(
                            "px-2 py-1 text-xs font-medium rounded-full capitalize",
                            review.recommendation === "accept" ? "bg-green-100 text-green-700" :
                            review.recommendation === "reject" ? "bg-red-100 text-red-700" :
                            review.recommendation === "revise" ? "bg-orange-100 text-orange-700" :
                            "bg-gray-100 text-gray-600"
                          )}>
                            {review.recommendation}
                          </span>
                        )}
                        {review.overall_score && (
                          <span className="font-bold text-lg">{review.overall_score.toFixed(1)}</span>
                        )}
                      </div>
                    </div>

                    {/* Scores Grid */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { label: "Originality", score: review.score_originality },
                        { label: "Methodology", score: review.score_methodology },
                        { label: "Relevance", score: review.score_relevance },
                        { label: "Clarity", score: review.score_clarity },
                      ].map((item) => (
                        <div key={item.label} className="text-center p-2 bg-background rounded">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="font-semibold">{item.score || "—"}</p>
                        </div>
                      ))}
                    </div>

                    {review.comments_to_author && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Comments to Author</p>
                        <p className="text-sm">{review.comments_to_author}</p>
                      </div>
                    )}

                    {review.comments_private && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Private Comments (Admin only)</p>
                        <p className="text-sm italic text-muted-foreground">{review.comments_private}</p>
                      </div>
                    )}

                    {review.reviewed_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Reviewed on {formatDate(review.reviewed_at)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Presenting Author */}
          <div className="bg-card border rounded-xl p-6">
            <h2 className="font-semibold mb-4">Presenting Author</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{abstract.presenting_author_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${abstract.presenting_author_email}`} className="text-primary hover:underline">
                  {abstract.presenting_author_email}
                </a>
              </div>
              {abstract.presenting_author_affiliation && (
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{abstract.presenting_author_affiliation}</span>
                </div>
              )}
              {abstract.presenting_author_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{abstract.presenting_author_phone}</span>
                </div>
              )}
            </div>

            {abstract.registration && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">Linked Registration</p>
                <Link
                  href={`/events/${eventId}/registrations?search=${abstract.registration.registration_number}`}
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <span>{abstract.registration.registration_number}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>

          {/* Award Status */}
          {(abstract.award_rank || abstract.is_podium_selected || abstract.redirected_from_category_id) && (
            <div className="bg-card border rounded-xl p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Award Status
              </h2>
              <div className="space-y-3 text-sm">
                {abstract.redirected_from_category_id && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <p className="text-xs text-indigo-600 font-medium">Redirected from Award Category</p>
                    <p className="text-sm text-indigo-700">Moved to free session</p>
                  </div>
                )}
                {abstract.award_rank && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rank</span>
                    <span className="font-bold text-lg">{abstract.award_rank}</span>
                  </div>
                )}
                {abstract.award_type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Award</span>
                    <span className={cn(
                      "px-2 py-1 text-xs font-medium rounded-full capitalize",
                      abstract.award_type === "medal" ? "bg-yellow-100 text-yellow-800" :
                      abstract.award_type === "certificate" ? "bg-blue-100 text-blue-700" :
                      "bg-green-100 text-green-700"
                    )}>
                      {abstract.award_type}
                    </span>
                  </div>
                )}
                {abstract.is_podium_selected && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Podium</span>
                    <span className="text-green-600 font-medium">Selected</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AMASI Details */}
          {(abstract.amasi_membership_number || abstract.submitter_metadata?.date_of_birth || (abstract.declarations_accepted && abstract.declarations_accepted.length > 0)) && (
            <div className="bg-card border rounded-xl p-6">
              <h2 className="font-semibold mb-4">AMASI Details</h2>
              <div className="space-y-3 text-sm">
                {abstract.amasi_membership_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Membership #</span>
                    <span className="font-mono font-medium">{abstract.amasi_membership_number}</span>
                  </div>
                )}
                {abstract.submitter_metadata?.date_of_birth && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date of Birth</span>
                    <span className="font-medium">{new Date(abstract.submitter_metadata.date_of_birth).toLocaleDateString("en-IN")}</span>
                  </div>
                )}
                {abstract.submitter_metadata?.current_position && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Position</span>
                    <span className="font-medium">{abstract.submitter_metadata.current_position}</span>
                  </div>
                )}
                {abstract.declarations_accepted && abstract.declarations_accepted.length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Declarations Accepted ({abstract.declarations_accepted.length})</p>
                    <div className="space-y-1">
                      {abstract.declarations_accepted.map((decl, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-xs">{decl}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="bg-card border rounded-xl p-6">
            <h2 className="font-semibold mb-4">Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium">{abstract.category?.name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Presentation Type</span>
                <span className="font-medium capitalize">{abstract.presentation_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submitted</span>
                <span className="font-medium">{formatDate(abstract.submitted_at)}</span>
              </div>
              {abstract.decision_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Decision Date</span>
                  <span className="font-medium">{formatDate(abstract.decision_date)}</span>
                </div>
              )}
              {abstract.file_url && (
                <div className="pt-3 border-t">
                  <a
                    href={abstract.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    {abstract.file_name || "Download Attachment"}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Decision Notes */}
          {abstract.decision_notes && (
            <div className="bg-card border rounded-xl p-6">
              <h2 className="font-semibold mb-4">Decision Notes</h2>
              <p className="text-sm text-muted-foreground">{abstract.decision_notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Decision Dialog */}
      <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionType === "accepted" && "Accept Abstract"}
              {decisionType === "rejected" && "Reject Abstract"}
              {decisionType === "revision_requested" && "Request Revision"}
              {decisionType === "redirected" && "Redirect to Free Session"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {decisionType === "accepted" && (
              <div>
                <label className="text-sm font-medium">Accept As</label>
                <Select value={acceptedAs} onValueChange={setAcceptedAs}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oral">Oral Presentation</SelectItem>
                    <SelectItem value="poster">Poster / ePoster</SelectItem>
                    <SelectItem value="video">Video Presentation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder={
                  decisionType === "revision_requested"
                    ? "Describe the changes required..."
                    : "Add any notes about this decision..."
                }
                rows={4}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDecisionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => decisionMutation.mutate()}
              disabled={decisionMutation.isPending}
              className={cn(
                decisionType === "accepted" && "bg-green-600 hover:bg-green-700",
                decisionType === "rejected" && "bg-red-600 hover:bg-red-700",
                decisionType === "revision_requested" && "bg-orange-600 hover:bg-orange-700",
                decisionType === "redirected" && "bg-indigo-600 hover:bg-indigo-700"
              )}
            >
              {decisionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {decisionType === "accepted" && "Accept"}
              {decisionType === "rejected" && "Reject"}
              {decisionType === "revision_requested" && "Request Revision"}
              {decisionType === "redirected" && "Redirect to Free Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Scoring Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Add Review
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Abstract Info */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-mono text-sm text-muted-foreground">{abstract.abstract_number}</p>
              <p className="font-medium truncate">{abstract.title}</p>
            </div>

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
                        onChange={(e) => setReviewScores({
                          ...reviewScores,
                          [criterion.key]: parseInt(e.target.value)
                        })}
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

              {/* Overall Score Display */}
              <div className="p-4 bg-primary/5 rounded-lg flex items-center justify-between">
                <span className="font-medium">Overall Score (auto-calculated)</span>
                <span className="text-xl sm:text-2xl font-bold text-primary">
                  {(
                    (reviewScores.score_originality +
                      reviewScores.score_methodology +
                      reviewScores.score_relevance +
                      reviewScores.score_clarity) / 4
                  ).toFixed(1)}
                </span>
              </div>
            </div>

            {/* Recommendation */}
            <div>
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
            <div>
              <label className="text-sm font-medium">Comments to Author</label>
              <textarea
                value={reviewScores.comments_to_author}
                onChange={(e) => setReviewScores({ ...reviewScores, comments_to_author: e.target.value })}
                placeholder="Constructive feedback visible to the author..."
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
