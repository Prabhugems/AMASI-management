"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  Users,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  Send,
  AlertTriangle,
  Loader2,
} from "lucide-react"

interface Abstract {
  id: string
  abstract_number: string
  title: string
  presenting_author_name: string
  presenting_author_email: string
  category_name: string
  presentation_type: string
  review_round: number
  status: string
  workflow_stage: string
  review_count: number
  avg_score: number
  recommendations: string[]
  all_reviews_complete: boolean
  reviews: Review[]
}

interface Review {
  id: string
  reviewer_name: string
  overall_score: number
  recommendation: string
  comments_to_author: string
  reviewed_at: string
}

interface Stats {
  total: number
  pending_decision: number
  accepted: number
  rejected: number
  second_review: number
}

export default function CommitteeDecisionPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [abstracts, setAbstracts] = useState<Abstract[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending_decision: 0,
    accepted: 0,
    rejected: 0,
    second_review: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("pending")
  const [selectedAbstract, setSelectedAbstract] = useState<Abstract | null>(null)
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState("")

  // Decision form state
  const [decision, setDecision] = useState("")
  const [notes, setNotes] = useState("")
  const [feedbackToAuthor, setFeedbackToAuthor] = useState("")
  const [secondReviewReason, setSecondReviewReason] = useState("")
  const [sendNotification, setSendNotification] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchAbstracts()
  }, [eventId, filterStatus])

  const fetchAbstracts = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/events/${eventId}/abstracts/committee-queue`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setAbstracts(data.abstracts || [])
      setStats(data.stats || stats)
    } catch (error) {
      console.error("Error fetching abstracts:", error)
      toast.error("Failed to load abstracts")
    } finally {
      setLoading(false)
    }
  }

  const handleDecision = async () => {
    if (!selectedAbstract || !decision) return

    try {
      setSubmitting(true)
      const res = await fetch(`/api/abstracts/${selectedAbstract.id}/committee-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          notes,
          feedback_to_author: feedbackToAuthor,
          second_review_reason: secondReviewReason,
          send_notification: sendNotification,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save decision")
      }

      const result = await res.json()

      toast.success(`Abstract ${decision === 'reject' ? 'rejected' : decision === 'second_review' ? 'sent for second review' : 'accepted'}`)

      // Show registration status for accepted abstracts
      if (decision.startsWith('accept_') && result.registration_status) {
        if (!result.registration_status.is_registered) {
          toast.warning("Presenter is not registered for the event")
        }
      }

      // Reset form and refresh
      setDecisionDialogOpen(false)
      resetForm()
      fetchAbstracts()
    } catch (error) {
      console.error("Error saving decision:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save decision")
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setDecision("")
    setNotes("")
    setFeedbackToAuthor("")
    setSecondReviewReason("")
    setSendNotification(true)
    setSelectedAbstract(null)
  }

  const openDecisionDialog = (abstract: Abstract) => {
    setSelectedAbstract(abstract)
    setDecisionDialogOpen(true)
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 8) return "bg-green-100 text-green-800"
    if (score >= 6) return "bg-yellow-100 text-yellow-800"
    if (score >= 4) return "bg-orange-100 text-orange-800"
    return "bg-red-100 text-red-800"
  }

  const getRecommendationBadge = (rec: string) => {
    switch (rec?.toLowerCase()) {
      case 'accept':
        return <Badge className="bg-green-100 text-green-800">Accept</Badge>
      case 'reject':
        return <Badge className="bg-red-100 text-red-800">Reject</Badge>
      case 'revise':
        return <Badge className="bg-yellow-100 text-yellow-800">Revise</Badge>
      default:
        return <Badge variant="outline">{rec || 'Pending'}</Badge>
    }
  }

  const filteredAbstracts = abstracts.filter(a => {
    const matchesSearch = !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.abstract_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.presenting_author_name.toLowerCase().includes(searchQuery.toLowerCase())

    let matchesStatus = true
    if (filterStatus === 'pending') {
      matchesStatus = a.workflow_stage === 'committee' || (a.status === 'under_review' && a.all_reviews_complete)
    } else if (filterStatus === 'accepted') {
      matchesStatus = a.status === 'accepted'
    } else if (filterStatus === 'rejected') {
      matchesStatus = a.status === 'rejected'
    }

    return matchesSearch && matchesStatus
  })

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Committee Decision</h1>
          <p className="text-muted-foreground">Review and decide on submitted abstracts</p>
        </div>
        <Button onClick={fetchAbstracts} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Abstracts</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-700">{stats.pending_decision}</div>
            <div className="text-sm text-yellow-600">Pending Decision</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-700">{stats.accepted}</div>
            <div className="text-sm text-green-600">Accepted</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-700">{stats.rejected}</div>
            <div className="text-sm text-red-600">Rejected</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-700">{stats.second_review}</div>
            <div className="text-sm text-blue-600">Second Review</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, number, or author..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Tabs value={filterStatus} onValueChange={setFilterStatus}>
              <TabsList>
                <TabsTrigger value="pending">
                  Pending ({stats.pending_decision})
                </TabsTrigger>
                <TabsTrigger value="accepted">
                  Accepted ({stats.accepted})
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  Rejected ({stats.rejected})
                </TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Abstracts Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAbstracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No abstracts found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Abstract</TableHead>
                  <TableHead>Presenter</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Reviews</TableHead>
                  <TableHead className="text-center">Avg Score</TableHead>
                  <TableHead className="text-center">Recommendations</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAbstracts.map((abstract) => (
                  <>
                    <TableRow key={abstract.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedRow(expandedRow === abstract.id ? null : abstract.id)}
                        >
                          {expandedRow === abstract.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{abstract.abstract_number}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {abstract.title}
                          </div>
                          {abstract.review_round > 1 && (
                            <Badge variant="outline" className="mt-1">
                              Round {abstract.review_round}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{abstract.presenting_author_name}</div>
                        <div className="text-xs text-muted-foreground">{abstract.presenting_author_email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{abstract.category_name}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{abstract.review_count}</span>
                          {abstract.all_reviews_complete && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {abstract.avg_score ? (
                          <Badge className={getScoreBadgeColor(abstract.avg_score)}>
                            {abstract.avg_score.toFixed(1)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1 flex-wrap">
                          {abstract.recommendations?.map((rec, i) => (
                            <span key={i}>{getRecommendationBadge(rec)}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {abstract.status === 'accepted' ? (
                          <Badge className="bg-green-100 text-green-800">Accepted</Badge>
                        ) : abstract.status === 'rejected' ? (
                          <Badge className="bg-red-100 text-red-800">Rejected</Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => openDecisionDialog(abstract)}
                            disabled={!abstract.all_reviews_complete}
                          >
                            Decide
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {/* Expanded Row - Review Details */}
                    {expandedRow === abstract.id && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30">
                          <div className="p-4 space-y-4">
                            <h4 className="font-semibold">Review Details</h4>
                            {abstract.reviews?.length > 0 ? (
                              <div className="grid gap-4 md:grid-cols-2">
                                {abstract.reviews.map((review) => (
                                  <Card key={review.id}>
                                    <CardHeader className="pb-2">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <CardTitle className="text-sm">{review.reviewer_name}</CardTitle>
                                          <CardDescription>
                                            {new Date(review.reviewed_at).toLocaleDateString()}
                                          </CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Badge className={getScoreBadgeColor(review.overall_score)}>
                                            {review.overall_score?.toFixed(1)}
                                          </Badge>
                                          {getRecommendationBadge(review.recommendation)}
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <p className="text-sm text-muted-foreground">
                                        {review.comments_to_author || "No comments"}
                                      </p>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            ) : (
                              <p className="text-muted-foreground">No reviews yet</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Decision Dialog */}
      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Committee Decision</DialogTitle>
            <DialogDescription>
              {selectedAbstract?.abstract_number}: {selectedAbstract?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Summary */}
            <div className="bg-muted p-4 rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Presenter:</span>
                  <p className="font-medium">{selectedAbstract?.presenting_author_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Score:</span>
                  <p className="font-medium">{selectedAbstract?.avg_score?.toFixed(1) || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Recommendations:</span>
                  <div className="flex gap-1 mt-1">
                    {selectedAbstract?.recommendations?.map((rec, i) => (
                      <span key={i}>{getRecommendationBadge(rec)}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Decision Select */}
            <div className="space-y-2">
              <Label>Decision</Label>
              <Select value={decision} onValueChange={setDecision}>
                <SelectTrigger>
                  <SelectValue placeholder="Select decision" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accept_oral">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Accept - Oral Presentation
                    </div>
                  </SelectItem>
                  <SelectItem value="accept_poster">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Accept - Poster Presentation
                    </div>
                  </SelectItem>
                  <SelectItem value="accept_video">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Accept - Video Presentation
                    </div>
                  </SelectItem>
                  <SelectItem value="second_review">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-blue-500" />
                      Send for Second Review
                    </div>
                  </SelectItem>
                  <SelectItem value="reject">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Reject
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Second Review Reason */}
            {decision === 'second_review' && (
              <div className="space-y-2">
                <Label>Reason for Second Review</Label>
                <Textarea
                  placeholder="Why is a second review needed?"
                  value={secondReviewReason}
                  onChange={(e) => setSecondReviewReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* Feedback to Author (for rejection) */}
            {decision === 'reject' && (
              <div className="space-y-2">
                <Label>Feedback to Author</Label>
                <Textarea
                  placeholder="Constructive feedback for the author..."
                  value={feedbackToAuthor}
                  onChange={(e) => setFeedbackToAuthor(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* Committee Notes */}
            <div className="space-y-2">
              <Label>Committee Notes (Internal)</Label>
              <Textarea
                placeholder="Internal notes for the committee..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Send Notification */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendNotification"
                checked={sendNotification}
                onCheckedChange={(checked) => setSendNotification(checked as boolean)}
              />
              <Label htmlFor="sendNotification" className="text-sm">
                Send notification email to presenter
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDecision}
              disabled={!decision || submitting}
              className={
                decision === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                decision === 'second_review' ? 'bg-blue-600 hover:bg-blue-700' :
                'bg-green-600 hover:bg-green-700'
              }
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Confirm Decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
