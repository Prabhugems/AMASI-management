"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  AlertCircle,
  CheckCircle,
  Trophy,
  User,
  Gavel,
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
  scoring_criteria: ScoringCriterion[]
  is_award_category: boolean
  award_name: string | null
}

type AbstractData = {
  id: string
  abstract_number: string
  title: string
  presenting_author_name: string
  presenting_author_affiliation: string | null
  category_id: string | null
  status: string
  is_podium_selected: boolean
  reviews?: {
    id: string
    reviewer_name: string
    reviewer_email: string
    overall_score: number
    scores: Record<string, number> | null
    total_score: number | null
    max_possible_score: number | null
    review_type: string
    reviewed_at: string
  }[]
}

type JudgePortalData = {
  event: {
    id: string
    name: string
    short_name: string
    start_date: string
    end_date: string
    venue_name: string
    city: string
  }
  categories: CategoryData[]
  abstracts: AbstractData[]
}

export default function JudgePortal() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  // Entry state
  const [judgeName, setJudgeName] = useState("")
  const [judgeEmail, setJudgeEmail] = useState("")
  const [hasEntered, setHasEntered] = useState(false)

  // Portal state
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [selectedAbstract, setSelectedAbstract] = useState<AbstractData | null>(null)
  const [dynamicScores, setDynamicScores] = useState<Record<string, number>>({})
  const [remarks, setRemarks] = useState("")

  // Fetch data
  const { data: portalData, isLoading, error } = useQuery({
    queryKey: ["abstract-judge", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-judge/${eventId}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to load data")
      }
      return res.json() as Promise<JudgePortalData>
    },
  })

  // Submit score mutation
  const submitScore = useMutation({
    mutationFn: async (abstractId: string) => {
      const category = portalData?.categories.find(c => c.id === selectedCategoryId)
      const maxScore = category?.scoring_criteria.reduce((s, c) => s + c.max_score, 0) || 0

      const res = await fetch(`/api/abstract-judge/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abstract_id: abstractId,
          judge_name: judgeName,
          judge_email: judgeEmail,
          scores: dynamicScores,
          max_possible_score: maxScore,
          comments_private: remarks || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to submit score")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Score submitted successfully!")
      queryClient.invalidateQueries({ queryKey: ["abstract-judge", eventId] })
      setSelectedAbstract(null)
      setDynamicScores({})
      setRemarks("")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const event = portalData?.event
  const categories = portalData?.categories || []
  const selectedCategory = categories.find(c => c.id === selectedCategoryId)

  // Abstracts filtered by selected category
  const categoryAbstracts = useMemo(() => {
    if (!selectedCategoryId || !portalData?.abstracts) return []
    return portalData.abstracts.filter(a => a.category_id === selectedCategoryId)
  }, [portalData?.abstracts, selectedCategoryId])

  const isScoredByMe = (abstract: AbstractData) => {
    return abstract.reviews?.some(
      r => r.reviewer_email === judgeEmail && r.review_type === "judge_score"
    )
  }

  const getJudgeScoreCount = (abstract: AbstractData) => {
    return (abstract.reviews || []).filter(r => r.review_type === "judge_score").length
  }

  const getAvgJudgeScore = (abstract: AbstractData) => {
    const judgeReviews = (abstract.reviews || []).filter(
      r => r.review_type === "judge_score" && r.total_score != null && r.max_possible_score
    )
    if (judgeReviews.length === 0) return null
    const avg = judgeReviews.reduce((sum, r) => sum + (r.total_score || 0), 0) / judgeReviews.length
    const max = judgeReviews[0].max_possible_score || 1
    return { avg: avg.toFixed(1), max }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const currentTotal = Object.values(dynamicScores).reduce((a, b) => a + b, 0)
  const maxTotal = selectedCategory?.scoring_criteria.reduce((s, c) => s + c.max_score, 0) || 0

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading judge portal...</p>
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
            This judge scoring link is invalid or has expired. Please contact the event organizer.
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
              <Gavel className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Judge Scoring Portal</h1>
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
                value={judgeName}
                onChange={(e) => setJudgeName(e.target.value)}
                placeholder="Enter your full name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Your Email</label>
              <Input
                type="email"
                value={judgeEmail}
                onChange={(e) => setJudgeEmail(e.target.value)}
                placeholder="Enter your email"
                className="mt-1"
              />
            </div>
            <Button
              onClick={() => setHasEntered(true)}
              disabled={!judgeName.trim() || !judgeEmail.trim()}
              className="w-full"
            >
              Enter Portal
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Your name and email will be attached to scores you submit.
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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Gavel className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Judge Scoring Portal</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{event.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {judgeName}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Category Selector */}
        <div className="bg-white rounded-lg border p-4">
          <label className="text-sm font-medium mb-2 block">Select Award Category</label>
          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Choose a category to score..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span className="flex items-center gap-2">
                    <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                    {cat.name}
                    {cat.award_name && <span className="text-muted-foreground">({cat.award_name})</span>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              No award categories with scoring criteria are available for this event.
            </p>
          )}

          {selectedCategory && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{selectedCategory.scoring_criteria.length} criteria</span>
              <span>&middot;</span>
              <span>{maxTotal} pts total</span>
              <span>&middot;</span>
              <span>{categoryAbstracts.length} abstract{categoryAbstracts.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Abstracts List */}
        {selectedCategoryId && (
          <>
            {categoryAbstracts.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-dashed">
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Abstracts</h3>
                <p className="text-muted-foreground">
                  No accepted abstracts in this category yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {categoryAbstracts.map((abstract) => {
                  const scored = isScoredByMe(abstract)
                  const judgeCount = getJudgeScoreCount(abstract)
                  const avgScore = getAvgJudgeScore(abstract)

                  return (
                    <button
                      key={abstract.id}
                      onClick={() => {
                        setSelectedAbstract(abstract)
                        // Initialize scores
                        if (selectedCategory) {
                          const initial: Record<string, number> = {}
                          selectedCategory.scoring_criteria.forEach(c => { initial[c.label] = 0 })
                          setDynamicScores(initial)
                        }
                        setRemarks("")
                      }}
                      className={cn(
                        "w-full text-left bg-white rounded-lg border p-4 transition-all hover:shadow-md hover:border-primary/30",
                        scored && "border-green-200 bg-green-50/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-sm font-semibold text-primary">
                              {abstract.abstract_number}
                            </span>
                            {abstract.is_podium_selected && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                                Podium
                              </span>
                            )}
                            {scored && (
                              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                <CheckCircle className="h-3 w-3" />
                                Scored
                              </span>
                            )}
                          </div>
                          <h3 className="font-medium text-base">{abstract.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {abstract.presenting_author_name}
                            {abstract.presenting_author_affiliation && ` \u2022 ${abstract.presenting_author_affiliation}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-center">
                            <span className="text-sm font-medium">{judgeCount}</span>
                            <p className="text-xs text-muted-foreground">scores</p>
                          </div>
                          {avgScore && (
                            <div className="text-center">
                              <span className="text-sm font-bold">{avgScore.avg}</span>
                              <p className="text-xs text-muted-foreground">/{avgScore.max}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Scoring Dialog */}
      <Dialog open={!!selectedAbstract} onOpenChange={(open) => !open && setSelectedAbstract(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedAbstract && selectedCategory && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Gavel className="h-5 w-5 text-primary" />
                  Score Abstract
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Abstract info */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-primary font-semibold">{selectedAbstract.abstract_number}</span>
                    <span className="text-xs text-muted-foreground">{selectedCategory.name}</span>
                  </div>
                  <p className="font-medium">{selectedAbstract.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedAbstract.presenting_author_name}</p>
                </div>

                {/* Already scored notice */}
                {isScoredByMe(selectedAbstract) && (
                  <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">You have already scored this abstract. You can submit another score.</span>
                  </div>
                )}

                {/* Dynamic Scoring */}
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Rate each criterion using the slider
                  </p>

                  {selectedCategory.scoring_criteria.map((criterion) => {
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

                  {/* Total */}
                  <div className="p-4 bg-primary/5 rounded-lg flex items-center justify-between">
                    <span className="font-medium">Total Score</span>
                    <span className="text-2xl font-bold text-primary">{currentTotal} / {maxTotal}</span>
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="text-sm font-medium">Remarks (optional)</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Any additional notes..."
                    rows={2}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedAbstract(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => submitScore.mutate(selectedAbstract.id)}
                  disabled={submitScore.isPending}
                >
                  {submitScore.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Score
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
