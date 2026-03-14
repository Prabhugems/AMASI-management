import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/abstracts/analytics?event_id=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch all abstracts for this event
    const { data: abstracts, error } = await (supabase as any)
      .from("abstracts")
      .select(`
        id,
        status,
        accepted_as,
        presentation_type,
        submitted_at,
        updated_at,
        decision_notified_at,
        category:abstract_categories(id, name),
        reviews:abstract_reviews(id, overall_score, recommendation, reviewed_at)
      `)
      .eq("event_id", eventId)

    if (error) {
      console.error("Error fetching abstracts:", error)
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
    }

    // Calculate analytics
    const total = abstracts?.length || 0

    // Status distribution
    const statusCounts: Record<string, number> = {}
    const acceptedAsCounts: Record<string, number> = {}
    const categoryCounts: Record<string, number> = {}
    const submissionsByDate: Record<string, number> = {}
    const decisionsByDate: Record<string, number> = {}

    let totalReviews = 0
    let abstractsWithReviews = 0
    let totalScore = 0
    let scoreCount = 0
    const recommendationCounts: Record<string, number> = {}

    for (const abstract of abstracts || []) {
      // Status counts
      statusCounts[abstract.status] = (statusCounts[abstract.status] || 0) + 1

      // Accepted as counts
      if (abstract.accepted_as) {
        acceptedAsCounts[abstract.accepted_as] = (acceptedAsCounts[abstract.accepted_as] || 0) + 1
      }

      // Category counts
      const catName = abstract.category?.name || "Uncategorized"
      categoryCounts[catName] = (categoryCounts[catName] || 0) + 1

      // Submissions by date
      if (abstract.submitted_at) {
        const date = abstract.submitted_at.split("T")[0]
        submissionsByDate[date] = (submissionsByDate[date] || 0) + 1
      }

      // Decisions by date
      if (abstract.decision_notified_at) {
        const date = abstract.decision_notified_at.split("T")[0]
        decisionsByDate[date] = (decisionsByDate[date] || 0) + 1
      }

      // Review stats
      const reviews = abstract.reviews || []
      if (reviews.length > 0) {
        abstractsWithReviews++
        totalReviews += reviews.length

        for (const review of reviews) {
          if (review.overall_score) {
            totalScore += review.overall_score
            scoreCount++
          }
          if (review.recommendation) {
            recommendationCounts[review.recommendation] = (recommendationCounts[review.recommendation] || 0) + 1
          }
        }
      }
    }

    // Format for charts
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({
      name: formatStatus(name),
      value,
      status: name,
    }))

    const categoryData = Object.entries(categoryCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const acceptedAsData = Object.entries(acceptedAsCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }))

    // Submissions trend (last 30 days)
    const last30Days = getLast30Days()
    const submissionsTrend = last30Days.map((date) => ({
      date: formatDateShort(date),
      submissions: submissionsByDate[date] || 0,
      decisions: decisionsByDate[date] || 0,
    }))

    // Calculate rates
    const accepted = statusCounts["accepted"] || 0
    const rejected = statusCounts["rejected"] || 0
    const decided = accepted + rejected + (statusCounts["revision_requested"] || 0)
    const acceptanceRate = decided > 0 ? Math.round((accepted / decided) * 100) : 0
    const reviewProgress = total > 0 ? Math.round((abstractsWithReviews / total) * 100) : 0
    const avgScore = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : "—"

    // Recommendation breakdown
    const recommendationData = Object.entries(recommendationCounts).map(([name, value]) => ({
      name: formatRecommendation(name),
      value,
    }))

    return NextResponse.json({
      summary: {
        total,
        submitted: statusCounts["submitted"] || 0,
        under_review: statusCounts["under_review"] || 0,
        accepted,
        rejected,
        revision_requested: statusCounts["revision_requested"] || 0,
        withdrawn: statusCounts["withdrawn"] || 0,
        acceptance_rate: acceptanceRate,
        review_progress: reviewProgress,
        avg_score: avgScore,
        total_reviews: totalReviews,
        abstracts_with_reviews: abstractsWithReviews,
      },
      charts: {
        status: statusData,
        categories: categoryData,
        accepted_as: acceptedAsData,
        submissions_trend: submissionsTrend,
        recommendations: recommendationData,
      },
    })
  } catch (error) {
    console.error("Error in analytics:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    submitted: "Submitted",
    under_review: "Under Review",
    accepted: "Accepted",
    rejected: "Rejected",
    revision_requested: "Revision",
    withdrawn: "Withdrawn",
  }
  return labels[status] || status
}

function formatRecommendation(rec: string): string {
  const labels: Record<string, string> = {
    accept: "Accept",
    accept_oral: "Accept (Oral)",
    accept_poster: "Accept (Poster)",
    minor_revision: "Minor Revision",
    major_revision: "Major Revision",
    reject: "Reject",
  }
  return labels[rec] || rec
}

function getLast30Days(): string[] {
  const dates: string[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    dates.push(date.toISOString().split("T")[0])
  }
  return dates
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
