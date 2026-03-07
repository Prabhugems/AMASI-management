import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// PUT /api/reviewer-portal/[token]/review - Submit a review
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const { reviewId, scores, recommendation, comments_to_author, comments_private } = body

    if (!reviewId) {
      return NextResponse.json({ error: "Review ID is required" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createAdminClient()

    // Verify token and get reviewer
    const { data: reviewer } = await supabase
      .from("reviewers_pool")
      .select("id, email, name")
      .eq("form_token", token)
      .single()

    if (!reviewer) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })
    }

    // Verify the review belongs to this reviewer
    const { data: review } = await supabase
      .from("abstract_reviews")
      .select("id, reviewer_id, reviewer_email")
      .eq("id", reviewId)
      .single()

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 })
    }

    // Check if reviewer is authorized (by id or email)
    if (review.reviewer_id !== reviewer.id && review.reviewer_email !== reviewer.email) {
      return NextResponse.json({ error: "Not authorized to submit this review" }, { status: 403 })
    }

    // Calculate total score (sum of all scores provided)
    let totalScore = 0
    let criteriaCount = 0
    if (scores && typeof scores === "object") {
      for (const key in scores) {
        if (typeof scores[key] === "number") {
          totalScore += scores[key]
          criteriaCount++
        }
      }
    }

    // Determine max possible score based on criteria count
    // Paper/Video/Young Scholar: 5 criteria × 10 = 50
    // Poster: 10 criteria × 5 = 50
    // All award types have max 50 points
    const maxPossibleScore = criteriaCount <= 5 ? criteriaCount * 10 : criteriaCount * 5

    // Update the review
    const { data, error } = await supabase
      .from("abstract_reviews")
      .update({
        scores,
        total_score: totalScore,
        max_possible_score: maxPossibleScore,
        recommendation,
        comments_to_author,
        comments_private,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .select()
      .single()

    if (error) {
      console.error("Error submitting review:", error)
      return NextResponse.json({ error: "Failed to submit review" }, { status: 500 })
    }

    // Update reviewer stats
    const { data: reviewerStats } = await supabase
      .from("abstract_reviews")
      .select("id, reviewed_at, created_at")
      .or(`reviewer_id.eq.${reviewer.id},reviewer_email.eq.${reviewer.email}`)
      .not("reviewed_at", "is", null)

    const completedCount = reviewerStats?.length || 0

    // Calculate average review time
    let avgReviewTimeDays = null
    if (reviewerStats && reviewerStats.length > 0) {
      const totalDays = reviewerStats.reduce((sum: number, r: any) => {
        const created = new Date(r.created_at)
        const reviewed = new Date(r.reviewed_at)
        const days = (reviewed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
        return sum + days
      }, 0)
      avgReviewTimeDays = Math.round((totalDays / reviewerStats.length) * 10) / 10
    }

    await supabase
      .from("reviewers_pool")
      .update({
        total_reviews_completed: completedCount,
        avg_review_time_days: avgReviewTimeDays,
        last_review_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewer.id)

    return NextResponse.json({ success: true, review: data })
  } catch (error) {
    console.error("Error in PUT /api/reviewer-portal/[token]/review:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
