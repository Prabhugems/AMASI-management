"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Loader2,
  Trophy,
  Medal,
  Award,
  Save,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Abstract {
  id: string
  abstract_number: string
  title: string
  presenting_author_name: string
  presenting_author_email: string
  presenting_author_affiliation: string | null
  status: string
  amasi_membership_number: string | null
  award_rank: number | null
  award_type: string | null
  is_podium_selected: boolean
  category_id: string | null
  reviews?: { overall_score: number }[]
  category?: { id: string; name: string }
}

interface Category {
  id: string
  name: string
  is_award_category: boolean
  award_name: string | null
}

const awardTypeLabels: Record<string, { label: string; color: string }> = {
  medal: { label: "Medal", color: "bg-yellow-100 text-yellow-800" },
  certificate: { label: "Certificate", color: "bg-blue-100 text-blue-700" },
  bursary: { label: "Bursary", color: "bg-green-100 text-green-700" },
}

export default function AwardsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [rankings, setRankings] = useState<Record<string, number | null>>({})
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch categories (only award categories)
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["abstract-categories", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-categories?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch categories")
      return res.json() as Promise<Category[]>
    },
  })

  const awardCategories = categories.filter(c => c.is_award_category)
  const selectedCategory = awardCategories.find(c => c.id === selectedCategoryId)

  // Fetch accepted abstracts for selected category
  const { data: abstracts = [], isLoading: abstractsLoading } = useQuery({
    queryKey: ["abstracts-awards", eventId, selectedCategoryId],
    queryFn: async () => {
      if (!selectedCategoryId) return []
      const params = new URLSearchParams({
        event_id: eventId,
        status: "accepted",
        category_id: selectedCategoryId,
      })
      const res = await fetch(`/api/abstracts?${params}`)
      if (!res.ok) throw new Error("Failed to fetch abstracts")
      return res.json() as Promise<Abstract[]>
    },
    enabled: !!selectedCategoryId,
  })

  // Sort by average review score (descending), then by existing rank
  const sortedAbstracts = [...abstracts].sort((a, b) => {
    // First, sort by existing rank (ranked items first)
    if (a.award_rank && !b.award_rank) return -1
    if (!a.award_rank && b.award_rank) return 1
    if (a.award_rank && b.award_rank) return a.award_rank - b.award_rank

    // Then by average score
    const scoreA = getAvgScore(a.reviews)
    const scoreB = getAvgScore(b.reviews)
    return (scoreB || 0) - (scoreA || 0)
  })

  // Initialize rankings from data
  const initRankings = () => {
    const r: Record<string, number | null> = {}
    for (const a of abstracts) {
      r[a.id] = a.award_rank
    }
    setRankings(r)
    setHasChanges(false)
  }

  // Auto-initialize when abstracts change
  if (abstracts.length > 0 && Object.keys(rankings).length === 0) {
    initRankings()
  }

  function getAvgScore(reviews?: { overall_score: number }[]): number | null {
    if (!reviews || reviews.length === 0) return null
    const scores = reviews.filter(r => r.overall_score).map(r => r.overall_score)
    if (scores.length === 0) return null
    return scores.reduce((a, b) => a + b, 0) / scores.length
  }

  function getAwardType(rank: number | null): string | null {
    if (!rank) return null
    if (rank === 1) return "medal"
    if (rank <= 3) return "certificate"
    if (rank <= 10) return "bursary"
    return null
  }

  const setRank = (abstractId: string, rank: number | null) => {
    setRankings(prev => ({ ...prev, [abstractId]: rank }))
    setHasChanges(true)
  }

  // Auto-rank by score
  const autoRank = () => {
    const sorted = [...abstracts].sort((a, b) => {
      const scoreA = getAvgScore(a.reviews) || 0
      const scoreB = getAvgScore(b.reviews) || 0
      return scoreB - scoreA
    })

    const newRankings: Record<string, number | null> = {}
    sorted.forEach((a, i) => {
      newRankings[a.id] = i < 10 ? i + 1 : null
    })
    setRankings(newRankings)
    setHasChanges(true)
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const rankingsPayload = Object.entries(rankings).map(([abstract_id, rank]) => ({
        abstract_id,
        rank,
      }))

      const res = await fetch("/api/abstracts/awards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankings: rankingsPayload }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save rankings")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstracts-awards", eventId, selectedCategoryId] })
      setHasChanges(false)
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Award Rankings
          </h1>
          <p className="text-muted-foreground mt-1">
            Assign ranks to accepted abstracts in award categories
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={autoRank}
            disabled={!selectedCategoryId || abstracts.length === 0}
            className="gap-2"
          >
            <Medal className="h-4 w-4" />
            Auto-Rank by Score
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
            className="gap-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Rankings
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl">
        <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
          <strong>Award Assignment Rules:</strong>
        </p>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
            Rank 1 = Medal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-400"></span>
            Rank 2-3 = Certificate
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-400"></span>
            Rank 4-10 = Bursary
          </span>
        </div>
      </div>

      {/* Category Selector */}
      <div className="bg-card border rounded-xl p-4">
        <label className="text-sm font-medium mb-2 block">Select Award Category</label>
        <Select
          value={selectedCategoryId}
          onValueChange={(val) => {
            setSelectedCategoryId(val)
            setRankings({})
            setHasChanges(false)
          }}
        >
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Choose an award category..." />
          </SelectTrigger>
          <SelectContent>
            {awardCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name} {cat.award_name ? `(${cat.award_name})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {categoriesLoading && (
          <div className="mt-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}

        {!categoriesLoading && awardCategories.length === 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            No award categories found. Create categories with "Award Category" enabled.
          </p>
        )}
      </div>

      {/* Success/Error Messages */}
      {saveMutation.isSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700">
          <CheckCircle className="h-5 w-5" />
          Rankings saved successfully!
        </div>
      )}
      {saveMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {saveMutation.error.message}
        </div>
      )}

      {/* Rankings Table */}
      {selectedCategoryId && (
        <>
          {abstractsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : sortedAbstracts.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Accepted Abstracts</h3>
              <p className="text-muted-foreground">
                Accept abstracts in this category first before assigning rankings.
              </p>
            </div>
          ) : (
            <div className="bg-card border rounded-xl overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Rank</TableHead>
                    <TableHead>Abstract #</TableHead>
                    <TableHead className="min-w-[250px]">Title</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead className="text-center">Avg Score</TableHead>
                    <TableHead className="text-center">AMASI #</TableHead>
                    <TableHead className="text-center">Award</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAbstracts.map((abstract) => {
                    const rank = rankings[abstract.id] ?? abstract.award_rank
                    const avgScore = getAvgScore(abstract.reviews)
                    const awardType = getAwardType(rank ?? null)
                    const award = awardType ? awardTypeLabels[awardType] : null

                    return (
                      <TableRow
                        key={abstract.id}
                        className={cn(
                          rank === 1 && "bg-yellow-50",
                          rank && rank <= 3 && rank > 1 && "bg-blue-50/50",
                          rank && rank > 3 && rank <= 10 && "bg-green-50/30",
                        )}
                      >
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={rank ?? ""}
                            onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value) : null
                              setRank(abstract.id, val)
                            }}
                            className="w-16 text-center"
                            placeholder="—"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {abstract.abstract_number}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium truncate max-w-[250px]">{abstract.title}</p>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{abstract.presenting_author_name}</p>
                            <p className="text-xs text-muted-foreground">{abstract.presenting_author_affiliation || ""}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {avgScore ? (
                            <span className={cn(
                              "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                              avgScore >= 7 ? "bg-green-100 text-green-700" :
                              avgScore >= 5 ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                            )}>
                              {avgScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {abstract.amasi_membership_number ? (
                            <span className="text-xs font-mono">{abstract.amasi_membership_number}</span>
                          ) : (
                            <span className="text-xs text-amber-600">Missing</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {award ? (
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full",
                              award.color
                            )}>
                              {awardType === "medal" && <Medal className="h-3 w-3" />}
                              {awardType === "certificate" && <Award className="h-3 w-3" />}
                              {award.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
