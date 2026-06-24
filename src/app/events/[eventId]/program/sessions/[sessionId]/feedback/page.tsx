"use client"

import React, { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Star,
  CheckCircle2,
  EyeOff,
  Eye,
  Trash2,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type FeedbackSummary = {
  session_id: string
  session_name: string | null
  session_date: string | null
  hall: string | null
  count: number
  avg_overall: number | null
  avg_content: number | null
  avg_delivery: number | null
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>
  recent_comments: Array<{
    id: string
    rating_overall: number
    comments: string
    is_anonymous: boolean
    created_at: string
  }>
}

type QaRow = {
  id: string
  session_id: string
  asked_by_name: string | null
  asked_by_email: string | null
  question: string
  answer: string | null
  is_anonymous: boolean
  is_published: boolean
  upvotes: number
  asked_at: string
  answered_at: string | null
  session?: { id: string; session_name: string | null } | null
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function StarsDisplay({ value }: { value: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3.5 w-3.5",
            n <= value
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  )
}

export default function SessionFeedbackAdminPage() {
  const params = useParams<{ eventId: string; sessionId: string }>()
  const eventId = params?.eventId as string
  const sessionId = params?.sessionId as string

  const queryClient = useQueryClient()

  const feedbackQ = useQuery({
    queryKey: ["session-feedback-admin", eventId, sessionId],
    queryFn: async () => {
      const res = await fetch(
        `/api/events/${eventId}/session-feedback?session_id=${sessionId}`
      )
      if (!res.ok) throw new Error("Failed to load feedback")
      const json = (await res.json()) as { data: FeedbackSummary[] }
      return json.data[0] ?? null
    },
    enabled: !!eventId && !!sessionId,
  })

  const qaQ = useQuery({
    queryKey: ["session-qa-admin", eventId, sessionId],
    queryFn: async () => {
      const res = await fetch(
        `/api/events/${eventId}/session-qa?session_id=${sessionId}`
      )
      if (!res.ok) throw new Error("Failed to load Q&A")
      const json = (await res.json()) as { data: QaRow[] }
      return json.data
    },
    enabled: !!eventId && !!sessionId,
  })

  const summary = feedbackQ.data
  const qa = qaQ.data ?? []

  const maxDist = useMemo(() => {
    if (!summary) return 0
    const vals = Object.values(summary.distribution)
    return Math.max(1, ...vals)
  }, [summary])

  const moderate = useMutation({
    mutationFn: async (vars: {
      ids: string[]
      action: "publish" | "unpublish" | "delete"
    }) => {
      const res = await fetch(`/api/events/${eventId}/session-qa`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || "Failed")
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.action === "delete"
          ? "Deleted"
          : vars.action === "publish"
          ? "Published"
          : "Unpublished"
      )
      queryClient.invalidateQueries({
        queryKey: ["session-qa-admin", eventId, sessionId],
      })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const [answerOpen, setAnswerOpen] = useState(false)
  const [answerTarget, setAnswerTarget] = useState<QaRow | null>(null)
  const [answerText, setAnswerText] = useState("")

  const openAnswer = (row: QaRow) => {
    setAnswerTarget(row)
    setAnswerText(row.answer ?? "")
    setAnswerOpen(true)
  }

  const submitAnswer = useMutation({
    mutationFn: async () => {
      if (!answerTarget) return
      const res = await fetch(
        `/api/events/${eventId}/session-qa/${answerTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer: answerText.trim() || null }),
        }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || "Failed to save answer")
      }
    },
    onSuccess: () => {
      toast.success("Answer saved")
      setAnswerOpen(false)
      setAnswerTarget(null)
      setAnswerText("")
      queryClient.invalidateQueries({
        queryKey: ["session-qa-admin", eventId, sessionId],
      })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (feedbackQ.isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-1/3 rounded bg-muted" />
          <div className="h-32 rounded bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {summary?.session_name || "Session feedback"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Feedback &amp; Q&amp;A from attendees
        </p>
      </div>

      <Tabs defaultValue="feedback">
        <TabsList>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="qa">
            Q&amp;A
            {qa.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs">
                {qa.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feedback" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total responses</CardDescription>
                <CardTitle className="text-3xl">{summary?.count ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg overall</CardDescription>
                <CardTitle className="flex items-baseline gap-1 text-3xl">
                  {summary?.avg_overall ?? "—"}
                  <span className="text-sm font-normal text-muted-foreground">
                    / 5
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg content</CardDescription>
                <CardTitle className="flex items-baseline gap-1 text-3xl">
                  {summary?.avg_content ?? "—"}
                  <span className="text-sm font-normal text-muted-foreground">
                    / 5
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg delivery</CardDescription>
                <CardTitle className="flex items-baseline gap-1 text-3xl">
                  {summary?.avg_delivery ?? "—"}
                  <span className="text-sm font-normal text-muted-foreground">
                    / 5
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rating distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {summary && summary.count > 0 ? (
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count =
                      summary.distribution[String(star) as "1" | "2" | "3" | "4" | "5"] ?? 0
                    const pct = (count / maxDist) * 100
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <div className="flex w-12 items-center gap-1 text-sm text-muted-foreground">
                          {star}
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        </div>
                        <div className="flex h-3 flex-1 overflow-hidden rounded bg-muted">
                          <div
                            className="bg-amber-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                          {count}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No responses yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recent comments
                {summary && summary.recent_comments.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({summary.recent_comments.length})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary && summary.recent_comments.length > 0 ? (
                <ul className="space-y-3">
                  {summary.recent_comments.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-md border bg-card p-3 text-sm"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <StarsDisplay value={c.rating_overall} />
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(c.created_at)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {c.comments}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qa" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Questions &amp; Answers
              </CardTitle>
              <CardDescription>
                Publish, hide, or answer questions submitted by attendees.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {qaQ.isLoading ? (
                <div className="h-20 animate-pulse rounded bg-muted" />
              ) : qa.length === 0 ? (
                <p className="text-sm text-muted-foreground">No questions yet.</p>
              ) : (
                <ul className="space-y-3">
                  {qa.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-md border bg-card p-3 text-sm"
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium">
                              {row.is_anonymous
                                ? "Anonymous"
                                : row.asked_by_name || "Anonymous"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(row.asked_at)}
                            </span>
                            {row.is_published ? (
                              <Badge variant="outline" className="text-[10px]">
                                Published
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                Hidden
                              </Badge>
                            )}
                            {row.answer && (
                              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
                                Answered
                              </Badge>
                            )}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap leading-relaxed">
                            {row.question}
                          </p>
                          {row.answer && (
                            <div className="mt-3 rounded border-l-2 border-emerald-400 bg-emerald-50/50 px-3 py-2">
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                Answer
                              </div>
                              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                {row.answer}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 border-t pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAnswer(row)}
                        >
                          <Send className="mr-1 h-3.5 w-3.5" />
                          {row.answer ? "Edit answer" : "Answer"}
                        </Button>
                        {row.is_published ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              moderate.mutate({
                                ids: [row.id],
                                action: "unpublish",
                              })
                            }
                          >
                            <EyeOff className="mr-1 h-3.5 w-3.5" /> Hide
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              moderate.mutate({
                                ids: [row.id],
                                action: "publish",
                              })
                            }
                          >
                            <Eye className="mr-1 h-3.5 w-3.5" /> Publish
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Delete this question?")) {
                              moderate.mutate({
                                ids: [row.id],
                                action: "delete",
                              })
                            }
                          }}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={answerOpen} onOpenChange={setAnswerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Answer question</DialogTitle>
            <DialogDescription>
              {answerTarget?.question}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="answer-text">Answer</Label>
            <Textarea
              id="answer-text"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              rows={6}
              placeholder="Write the response that will be shown alongside this question."
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAnswerOpen(false)}
              disabled={submitAnswer.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => submitAnswer.mutate()}
              disabled={submitAnswer.isPending}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              {submitAnswer.isPending ? "Saving…" : "Save answer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
