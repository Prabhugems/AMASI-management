"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { Star, Check, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type SpeakerRow = {
  id: string
  faculty_name: string | null
  role: string | null
}

type SessionInfo = {
  id: string
  session_name: string | null
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall: string | null
  event_id: string
}

function StarRating({
  value,
  onChange,
  size = 36,
}: {
  value: number
  onChange: (v: number) => void
  size?: number
}) {
  const [hover, setHover] = useState<number>(0)
  return (
    <div className="flex items-center gap-1" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (hover || value) >= n
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Star
              className={cn(
                "transition-colors",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40"
              )}
              style={{ width: size, height: size }}
            />
          </button>
        )
      })}
      <span className="ml-2 text-sm tabular-nums text-muted-foreground">
        {value > 0 ? `${value}/5` : ""}
      </span>
    </div>
  )
}

function formatTime(t: string | null): string {
  if (!t) return ""
  // Expecting HH:MM or HH:MM:SS — display HH:MM
  return t.slice(0, 5)
}

function formatDate(d: string | null): string {
  if (!d) return ""
  try {
    return new Date(d).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return d
  }
}

export default function SessionFeedbackPage() {
  const params = useParams<{ sessionId: string }>()
  const sessionId = params?.sessionId as string

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [speakers, setSpeakers] = useState<SpeakerRow[]>([])

  const [ratingOverall, setRatingOverall] = useState(0)
  const [ratingContent, setRatingContent] = useState(0)
  const [ratingDelivery, setRatingDelivery] = useState(0)
  const [showMoreRatings, setShowMoreRatings] = useState(false)
  const [speakerId, setSpeakerId] = useState<string>("")
  const [comments, setComments] = useState("")
  const [question, setQuestion] = useState("")
  const [respondentEmail, setRespondentEmail] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const loadSession = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/session-feedback/${sessionId}`)
      const json = await res.json()
      if (!res.ok) {
        setLoadError(json?.error || "Failed to load session")
        return
      }
      setSession(json.session)
      setSpeakers(json.speakers ?? [])
    } catch {
      setLoadError("Failed to load session")
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) void loadSession()
  }, [sessionId, loadSession])

  const reset = () => {
    setRatingOverall(0)
    setRatingContent(0)
    setRatingDelivery(0)
    setSpeakerId("")
    setComments("")
    setQuestion("")
    setRespondentEmail("")
    setIsAnonymous(false)
    setShowMoreRatings(false)
    setSubmitted(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (ratingOverall < 1) {
      toast.error("Please give an overall rating")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/session-feedback/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating_overall: ratingOverall,
          rating_content: ratingContent > 0 ? ratingContent : null,
          rating_delivery: ratingDelivery > 0 ? ratingDelivery : null,
          comments: comments.trim() || null,
          session_speaker_id: speakerId || null,
          respondent_email: respondentEmail.trim() || null,
          is_anonymous: isAnonymous,
          question: question.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error || "Failed to submit feedback")
        return
      }
      toast.success("Thanks for your feedback!")
      setSubmitted(true)
    } catch {
      toast.error("Failed to submit feedback")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-3/4 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
          <div className="h-40 rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (loadError || !session) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Session not found</CardTitle>
            <CardDescription>
              {loadError || "We couldn't find this session."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-6 w-6" />
            </div>
            <CardTitle>Thank you!</CardTitle>
            <CardDescription>
              Your feedback has been recorded.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <button
              type="button"
              onClick={reset}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Submit another response
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const timeRange =
    session.start_time || session.end_time
      ? `${formatTime(session.start_time)}${
          session.end_time ? ` – ${formatTime(session.end_time)}` : ""
        }`
      : ""

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {session.session_name || "Session feedback"}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {session.session_date && <span>{formatDate(session.session_date)}</span>}
          {timeRange && <span>{timeRange}</span>}
          {session.hall && <span>{session.hall}</span>}
        </div>
        {speakers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {speakers.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {s.faculty_name}
                {s.role ? ` · ${s.role}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How was this session?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-2 block">
                Overall rating <span className="text-destructive">*</span>
              </Label>
              <StarRating value={ratingOverall} onChange={setRatingOverall} />
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowMoreRatings((v) => !v)}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {showMoreRatings ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                More ratings (optional)
              </button>
              {showMoreRatings && (
                <div className="mt-3 space-y-4">
                  <div>
                    <Label className="mb-2 block text-sm">Content quality</Label>
                    <StarRating
                      value={ratingContent}
                      onChange={setRatingContent}
                      size={28}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block text-sm">Delivery quality</Label>
                    <StarRating
                      value={ratingDelivery}
                      onChange={setRatingDelivery}
                      size={28}
                    />
                  </div>
                </div>
              )}
            </div>

            {speakers.length > 0 && (
              <div>
                <Label className="mb-2 block text-sm">
                  About a specific speaker? (optional)
                </Label>
                <Select
                  value={speakerId || "__none__"}
                  onValueChange={(v) => setSpeakerId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Whole session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Whole session</SelectItem>
                    {speakers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.faculty_name}
                        {s.role ? ` (${s.role})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="comments" className="mb-2 block text-sm">
                Comments (optional)
              </Label>
              <Textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="What worked well? What could be better?"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="question" className="mb-2 block text-sm">
                Got a question for the speaker? (optional)
              </Label>
              <Textarea
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Your question will be shared with the moderators."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="email" className="mb-2 block text-sm">
                Your email (optional)
              </Label>
              <Input
                id="email"
                type="email"
                value={respondentEmail}
                onChange={(e) => setRespondentEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={(v) => setIsAnonymous(v === true)}
              />
              <Label htmlFor="anonymous" className="text-sm font-normal">
                Submit anonymously
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || ratingOverall < 1}
            >
              {submitting ? "Submitting…" : "Submit feedback"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
