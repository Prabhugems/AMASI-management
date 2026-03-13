import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

// GET /api/events/[eventId]/abstracts/committee-queue
// Get abstracts ready for committee decision
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    await requireAdmin()
    const { eventId } = await params

    const supabase = await createAdminClient()

    // Get all abstracts for this event with review data
    const { data: abstracts, error } = await supabase
      .from("abstracts")
      .select(`
        id,
        abstract_number,
        title,
        presenting_author_name,
        presenting_author_email,
        presentation_type,
        status,
        workflow_stage,
        review_round,
        committee_decision,
        registration_verified,
        category:abstract_categories(id, name)
      `)
      .eq("event_id", eventId)
      .in("status", ["submitted", "under_review", "accepted", "rejected"])
      .order("submitted_at", { ascending: true })

    if (error) {
      console.error("Error fetching abstracts:", error)
      return NextResponse.json({ error: "Failed to fetch abstracts" }, { status: 500 })
    }

    // Get reviews for each abstract
    const abstractIds = abstracts?.map(a => a.id) || []

    const { data: reviews } = await supabase
      .from("abstract_reviews")
      .select(`
        id,
        abstract_id,
        reviewer_name,
        overall_score,
        recommendation,
        comments_to_author,
        reviewed_at
      `)
      .in("abstract_id", abstractIds)
      .order("reviewed_at", { ascending: false })

    // Get review assignments to check completion
    const { data: assignments } = await supabase
      .from("abstract_review_assignments")
      .select("abstract_id, status, review_round")
      .in("abstract_id", abstractIds)

    // Group reviews and assignments by abstract
    const reviewsByAbstract = new Map<string, typeof reviews>()
    const assignmentsByAbstract = new Map<string, typeof assignments>()

    reviews?.forEach(r => {
      const existing = reviewsByAbstract.get(r.abstract_id) || []
      existing.push(r)
      reviewsByAbstract.set(r.abstract_id, existing)
    })

    assignments?.forEach(a => {
      const existing = assignmentsByAbstract.get(a.abstract_id) || []
      existing.push(a)
      assignmentsByAbstract.set(a.abstract_id, existing)
    })

    // Enrich abstracts with review data
    const enrichedAbstracts = abstracts?.map(abstract => {
      const abstractReviews = reviewsByAbstract.get(abstract.id) || []
      const abstractAssignments = assignmentsByAbstract.get(abstract.id) || []

      // Filter to current review round
      const currentRoundAssignments = abstractAssignments.filter(
        a => a.review_round === (abstract.review_round || 1)
      )

      const reviewCount = abstractReviews.length
      const scores = abstractReviews.map(r => r.overall_score).filter(Boolean)
      const avgScore = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null

      const recommendations = abstractReviews
        .map(r => r.recommendation)
        .filter(Boolean)

      const allReviewsComplete = currentRoundAssignments.length > 0 &&
        currentRoundAssignments.every(a => a.status === 'completed')

      return {
        id: abstract.id,
        abstract_number: abstract.abstract_number,
        title: abstract.title,
        presenting_author_name: abstract.presenting_author_name,
        presenting_author_email: abstract.presenting_author_email,
        category_name: (abstract.category as { name: string } | null)?.name || 'Uncategorized',
        presentation_type: abstract.presentation_type,
        status: abstract.status,
        workflow_stage: abstract.workflow_stage,
        review_round: abstract.review_round || 1,
        committee_decision: abstract.committee_decision,
        registration_verified: abstract.registration_verified,
        review_count: reviewCount,
        avg_score: avgScore,
        recommendations,
        all_reviews_complete: allReviewsComplete,
        reviews: abstractReviews.map(r => ({
          id: r.id,
          reviewer_name: r.reviewer_name,
          overall_score: r.overall_score,
          recommendation: r.recommendation,
          comments_to_author: r.comments_to_author,
          reviewed_at: r.reviewed_at,
        })),
      }
    }) || []

    // Calculate stats
    const stats = {
      total: enrichedAbstracts.length,
      pending_decision: enrichedAbstracts.filter(
        a => (a.workflow_stage === 'committee' || a.all_reviews_complete) &&
             !['accepted', 'rejected'].includes(a.status)
      ).length,
      accepted: enrichedAbstracts.filter(a => a.status === 'accepted').length,
      rejected: enrichedAbstracts.filter(a => a.status === 'rejected').length,
      second_review: enrichedAbstracts.filter(a => a.review_round > 1).length,
    }

    return NextResponse.json({
      abstracts: enrichedAbstracts,
      stats,
    })
  } catch (error) {
    console.error("Error in committee queue:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
