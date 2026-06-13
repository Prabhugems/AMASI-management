// @ts-nocheck
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

// GET /api/events/[eventId]/abstracts/committee-queue
//
// Phase 4: the "reviews complete" predicate now compares completed-in-round
// assignments against `abstract_settings.reviewers_per_abstract`, not just
// "every assignment row is completed." The old check let an abstract surface
// as ready-for-decision after 1 review when the event wanted 2.
//
// review_round / committee_decision / registration_verified are now real
// columns (Phase 1b migration), so this route SELECTs them directly — no
// more `(abstract.review_round || 1)` fallback that silently masked the
// missing column.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    await requireAdmin()
    const { eventId } = await params

    const supabase = await createAdminClient()

    // Per-event setting that drives the X/Y gate. Default mirrors what the
    // settings UI defaults to (2) so events without a configured value
    // still behave predictably.
    const { data: settings } = await (supabase as any)
      .from("abstract_settings")
      .select("reviewers_per_abstract")
      .eq("event_id", eventId)
      .maybeSingle()
    const reviewersExpected: number =
      typeof settings?.reviewers_per_abstract === "number" && settings.reviewers_per_abstract > 0
        ? settings.reviewers_per_abstract
        : 2

    // Get all abstracts for this event. The category embed stays qualified
    // with !category_id to disambiguate from redirected_from_category_id —
    // PostgREST will 400 otherwise (PGRST201, the sweep we did before).
    const { data: abstracts, error } = await (supabase as any)
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
        category:abstract_categories!category_id(id, name)
      `)
      .eq("event_id", eventId)
      .in("status", ["submitted", "under_review", "accepted", "rejected"])
      .order("submitted_at", { ascending: true })

    if (error) {
      console.error("Error fetching abstracts:", error)
      return NextResponse.json({ error: "Failed to fetch abstracts" }, { status: 500 })
    }

    const abstractIds = abstracts?.map(a => a.id) || []

    const { data: reviews } = await (supabase as any)
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

    const { data: assignments } = await (supabase as any)
      .from("abstract_review_assignments")
      .select("abstract_id, status, review_round")
      .in("abstract_id", abstractIds)

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

    const enrichedAbstracts = abstracts?.map(abstract => {
      const abstractReviews = reviewsByAbstract.get(abstract.id) || []
      const abstractAssignments = assignmentsByAbstract.get(abstract.id) || []

      // review_round is now a real column with NOT NULL DEFAULT 1, so a
      // value is always present. No fallback.
      const currentRound: number = abstract.review_round
      const currentRoundAssignments = abstractAssignments.filter(
        a => a.review_round === currentRound
      )
      const completedInRound = currentRoundAssignments.filter(
        a => a.status === "completed"
      ).length

      const reviewCount = abstractReviews.length
      const scores = abstractReviews.map(r => r.overall_score).filter(Boolean)
      const avgScore = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null

      const recommendations = abstractReviews
        .map(r => r.recommendation)
        .filter(Boolean)

      // Phase 4 predicate: enough completed reviews in the CURRENT round to
      // satisfy the per-event expectation. The Review & Decide UI gates its
      // "Decide" action on this; getting it wrong = abstracts surface
      // either too early (incomplete reviews) or never (predicate too strict).
      const allReviewsComplete = completedInRound >= reviewersExpected

      return {
        id: abstract.id,
        abstract_number: abstract.abstract_number,
        title: abstract.title,
        presenting_author_name: abstract.presenting_author_name,
        presenting_author_email: abstract.presenting_author_email,
        category_name: (abstract.category as { name: string } | null)?.name || "Uncategorized",
        presentation_type: abstract.presentation_type,
        status: abstract.status,
        workflow_stage: abstract.workflow_stage,
        review_round: currentRound,
        committee_decision: abstract.committee_decision ?? null,
        registration_verified: abstract.registration_verified ?? false,
        review_count: reviewCount,
        avg_score: avgScore,
        recommendations,
        // The numbers the UI's X/Y badge keys off. Exposed explicitly so
        // the page doesn't have to recompute against the setting.
        reviews_completed_in_round: completedInRound,
        reviews_expected: reviewersExpected,
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

    const stats = {
      total: enrichedAbstracts.length,
      pending_decision: enrichedAbstracts.filter(
        a => (a.workflow_stage === "committee" || a.all_reviews_complete) &&
             !["accepted", "rejected"].includes(a.status)
      ).length,
      accepted: enrichedAbstracts.filter(a => a.status === "accepted").length,
      rejected: enrichedAbstracts.filter(a => a.status === "rejected").length,
      // review_round is a real int now; the > 1 check is meaningful.
      second_review: enrichedAbstracts.filter(a => a.review_round > 1).length,
    }

    return NextResponse.json({
      abstracts: enrichedAbstracts,
      stats,
      reviewers_expected: reviewersExpected,
    })
  } catch (error) {
    console.error("Error in committee queue:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
