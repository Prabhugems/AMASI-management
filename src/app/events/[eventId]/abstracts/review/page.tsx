"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
  ChevronRight,
  FileText,
  User,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Abstract {
  id: string
  abstract_number: string
  title: string
  abstract_text: string
  presenting_author_name: string
  presenting_author_email: string
  status: string
  category?: { id: string; name: string }
  reviews?: { id: string; overall_score: number; recommendation: string }[]
}

export default function ReviewPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [showDecisionDialog, setShowDecisionDialog] = useState(false)
  const [decisionType, setDecisionType] = useState("")
  const [acceptedAs, setAcceptedAs] = useState("oral")
  const [decisionNotes, setDecisionNotes] = useState("")

  // Fetch abstracts pending decision
  const { data: abstracts = [], isLoading } = useQuery({
    queryKey: ["abstracts-for-review", eventId],
    queryFn: async () => {
      // Fetch submitted and under_review abstracts
      const params = new URLSearchParams({ event_id: eventId })
      const res = await fetch(`/api/abstracts?${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const all = await res.json() as Abstract[]
      // Filter to those needing decision
      return all.filter((a) => ["submitted", "under_review"].includes(a.status))
    },
  })

  // Decision mutation
  const decisionMutation = useMutation({
    mutationFn: async (abstractId: string) => {
      const res = await fetch(`/api/abstracts/${abstractId}/decision`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: decisionType,
          accepted_as: decisionType === "accepted" ? acceptedAs : null,
          decision_notes: decisionNotes,
        }),
      })
      if (!res.ok) throw new Error("Failed to update")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstracts-for-review", eventId] })
      queryClient.invalidateQueries({ queryKey: ["abstracts", eventId] })
      setShowDecisionDialog(false)
      setDecisionNotes("")
      setDecisionType("")
      setAcceptedAs("oral")
      // Advance to next undecided abstract, or stay at current index
      // (the list will shrink after refetch since decided abstracts are filtered out)
      if (currentIndex >= abstracts.length - 1) {
        setCurrentIndex(Math.max(0, abstracts.length - 2))
      }
    },
  })

  const currentAbstract = abstracts[currentIndex]

  const getAverageScore = (reviews?: Abstract["reviews"]) => {
    if (!reviews || reviews.length === 0) return null
    const scores = reviews.filter((r) => r.overall_score).map((r) => r.overall_score)
    if (scores.length === 0) return null
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  }

  const makeDecision = (type: string) => {
    setDecisionType(type)
    setShowDecisionDialog(true)
  }

  const wordCount = currentAbstract?.abstract_text?.trim().split(/\s+/).length || 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (abstracts.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed">
          <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">All Caught Up!</h2>
          <p className="text-muted-foreground mb-4">
            No abstracts pending review or decision.
          </p>
          <Button onClick={() => router.push(`/events/${eventId}/abstracts`)}>
            View All Abstracts
          </Button>
        </div>
      </div>
    )
  }

  const avgScore = getAverageScore(currentAbstract?.reviews)

  return (
    <div className="p-6 space-y-6">
      {/* Header with Progress */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Queue</h1>
          <p className="text-muted-foreground mt-1">
            {abstracts.length} abstract{abstracts.length !== 1 ? "s" : ""} awaiting decision
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Progress:</span>
            <span className="font-medium">{currentIndex + 1} / {abstracts.length}</span>
          </div>
          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((currentIndex + 1) / abstracts.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {abstracts.map((abs, i) => (
          <button
            key={abs.id}
            onClick={() => setCurrentIndex(i)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-mono whitespace-nowrap transition-colors",
              i === currentIndex
                ? "bg-primary text-white"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            {abs.abstract_number}
          </button>
        ))}
      </div>

      {currentAbstract && (
        <div className="grid grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="col-span-2 space-y-6">
            {/* Abstract Card */}
            <div className="bg-card border rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="font-mono text-sm text-primary">{currentAbstract.abstract_number}</span>
                  <h2 className="text-xl font-bold mt-1">{currentAbstract.title}</h2>
                </div>
                {avgScore && (
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <span className={cn(
                      "text-2xl font-bold",
                      parseFloat(avgScore) >= 7 ? "text-green-600" :
                      parseFloat(avgScore) >= 5 ? "text-yellow-600" :
                      "text-red-600"
                    )}>
                      {avgScore}
                    </span>
                  </div>
                )}
              </div>

              <div className="prose prose-sm max-w-none mb-4">
                <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                  {currentAbstract.abstract_text}
                </p>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{currentAbstract.category?.name || "No category"}</span>
              </div>
            </div>

            {/* Decision Buttons */}
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4">Make Decision</h3>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => makeDecision("accepted")}
                  className="p-6 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 transition-colors text-center group"
                >
                  <CheckCircle className="h-10 w-10 mx-auto text-green-600 mb-2 group-hover:scale-110 transition-transform" />
                  <p className="font-semibold text-green-700">Accept</p>
                  <p className="text-xs text-green-600 mt-1">Approve for presentation</p>
                </button>
                <button
                  onClick={() => makeDecision("revision_requested")}
                  className="p-6 rounded-xl border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors text-center group"
                >
                  <AlertCircle className="h-10 w-10 mx-auto text-orange-600 mb-2 group-hover:scale-110 transition-transform" />
                  <p className="font-semibold text-orange-700">Request Revision</p>
                  <p className="text-xs text-orange-600 mt-1">Ask for changes</p>
                </button>
                <button
                  onClick={() => makeDecision("rejected")}
                  className="p-6 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-center group"
                >
                  <XCircle className="h-10 w-10 mx-auto text-red-600 mb-2 group-hover:scale-110 transition-transform" />
                  <p className="font-semibold text-red-700">Reject</p>
                  <p className="text-xs text-red-600 mt-1">Decline submission</p>
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Author Info */}
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Author
              </h3>
              <div className="space-y-2">
                <p className="font-medium">{currentAbstract.presenting_author_name}</p>
                <p className="text-sm text-muted-foreground">{currentAbstract.presenting_author_email}</p>
              </div>
            </div>

            {/* Reviews Summary */}
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Reviews ({currentAbstract.reviews?.length || 0})
              </h3>
              {currentAbstract.reviews && currentAbstract.reviews.length > 0 ? (
                <div className="space-y-3">
                  {currentAbstract.reviews.map((review, i) => (
                    <div key={review.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <span className="text-sm">Review {i + 1}</span>
                      <div className="flex items-center gap-2">
                        {review.recommendation && (
                          <span className={cn(
                            "px-2 py-0.5 text-xs rounded-full capitalize",
                            review.recommendation === "accept" ? "bg-green-100 text-green-700" :
                            review.recommendation === "reject" ? "bg-red-100 text-red-700" :
                            review.recommendation === "revise" ? "bg-orange-100 text-orange-700" :
                            "bg-gray-100 text-gray-600"
                          )}>
                            {review.recommendation}
                          </span>
                        )}
                        {review.overall_score && (
                          <span className="font-bold">{review.overall_score.toFixed(1)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No reviews yet
                </p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => router.push(`/events/${eventId}/abstracts/${currentAbstract.id}`)}
                >
                  View Full Details
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => {
                    if (currentIndex < abstracts.length - 1) {
                      setCurrentIndex(currentIndex + 1)
                    }
                  }}
                  disabled={currentIndex >= abstracts.length - 1}
                >
                  Skip to Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decision Dialog */}
      <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionType === "accepted" && "Accept Abstract"}
              {decisionType === "rejected" && "Reject Abstract"}
              {decisionType === "revision_requested" && "Request Revision"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-mono text-sm text-muted-foreground">{currentAbstract?.abstract_number}</p>
              <p className="font-medium truncate">{currentAbstract?.title}</p>
            </div>

            {decisionType === "accepted" && (
              <div>
                <label className="text-sm font-medium">Accept As *</label>
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
              <label className="text-sm font-medium">
                {decisionType === "revision_requested" ? "Revision Comments *" : "Notes (optional)"}
              </label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder={
                  decisionType === "revision_requested"
                    ? "Describe the changes required..."
                    : "Add any notes..."
                }
                rows={4}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required={decisionType === "revision_requested"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDecisionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => currentAbstract && decisionMutation.mutate(currentAbstract.id)}
              disabled={decisionMutation.isPending || (decisionType === "revision_requested" && !decisionNotes)}
              className={cn(
                decisionType === "accepted" && "bg-green-600 hover:bg-green-700",
                decisionType === "rejected" && "bg-red-600 hover:bg-red-700",
                decisionType === "revision_requested" && "bg-orange-600 hover:bg-orange-700"
              )}
            >
              {decisionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
