import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

interface Reviewer {
  id: string
  name: string
  email: string
  expertise_areas: string[]
  specialty: string
  max_assignments: number
  current_assignments: number
  completed_reviews: number
  avg_review_time_hours: number
  status: string
}

interface Abstract {
  id: string
  event_id: string
  category_id: string
  keywords: string[]
  title: string
  presenting_author_email: string
}

// Calculate match score between reviewer expertise and abstract
function calculateMatchScore(
  reviewer: Reviewer,
  abstract: Abstract,
  categoryKeywords: string[]
): number {
  let score = 0
  const abstractKeywords = [
    ...(abstract.keywords || []).map(k => k.toLowerCase()),
    ...categoryKeywords.map(k => k.toLowerCase())
  ]
  const titleWords = abstract.title.toLowerCase().split(/\s+/)

  // Match expertise areas (highest weight)
  const reviewerExpertise = (reviewer.expertise_areas || []).map(e => e.toLowerCase())
  for (const expertise of reviewerExpertise) {
    // Direct keyword match
    if (abstractKeywords.some(k => k.includes(expertise) || expertise.includes(k))) {
      score += 30
    }
    // Title word match
    if (titleWords.some(w => w.includes(expertise) || expertise.includes(w))) {
      score += 15
    }
  }

  // Match specialty
  if (reviewer.specialty) {
    const specialty = reviewer.specialty.toLowerCase()
    if (abstractKeywords.some(k => k.includes(specialty) || specialty.includes(k))) {
      score += 25
    }
    if (titleWords.some(w => w.includes(specialty) || specialty.includes(w))) {
      score += 10
    }
  }

  // Availability bonus (prefer reviewers with capacity)
  const capacityRatio = (reviewer.max_assignments - reviewer.current_assignments) / reviewer.max_assignments
  score += Math.round(capacityRatio * 20)

  // Experience bonus (completed reviews)
  if (reviewer.completed_reviews > 10) score += 10
  else if (reviewer.completed_reviews > 5) score += 5

  // Speed bonus (fast reviewers)
  if (reviewer.avg_review_time_hours && reviewer.avg_review_time_hours < 24) score += 5

  return score
}

// POST /api/abstracts/[id]/assign-reviewers - Auto-assign or manually assign reviewers
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getApiUser()
    if (!user || authError) {
      return authError || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: abstractId } = await params
    const body = await request.json()
    const {
      mode = "auto", // "auto" or "manual"
      reviewer_ids, // For manual assignment
      num_reviewers = 2, // For auto assignment
      review_round = 1,
      due_date,
    } = body

    const supabase = await createAdminClient()

    // Get abstract details
    const { data: abstract, error: abstractError } = await supabase
      .from("abstracts")
      .select(`
        id,
        event_id,
        category_id,
        keywords,
        title,
        presenting_author_email,
        abstract_categories (
          name,
          keywords
        )
      `)
      .eq("id", abstractId)
      .single()

    if (abstractError || !abstract) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    let selectedReviewerIds: string[] = []

    if (mode === "manual" && reviewer_ids?.length) {
      // Manual assignment
      selectedReviewerIds = reviewer_ids
    } else {
      // Auto-matching based on expertise
      const { data: reviewers, error: reviewersError } = await supabase
        .from("abstract_reviewer_pool")
        .select("*")
        .eq("event_id", (abstract as any).event_id)
        .eq("status", "active")

      if (reviewersError || !reviewers?.length) {
        return NextResponse.json(
          { error: "No available reviewers in the pool" },
          { status: 400 }
        )
      }

      // Get existing assignments for this abstract (to avoid duplicates)
      const { data: existingAssignments } = await supabase
        .from("abstract_review_assignments")
        .select("reviewer_id")
        .eq("abstract_id", abstractId)
        .eq("review_round", review_round)

      const assignedReviewerIds = new Set(
        existingAssignments?.map((a: any) => a.reviewer_id) || []
      )

      // Filter out already assigned reviewers and those with conflict of interest
      const availableReviewers = (reviewers as any[]).filter((r: any) => {
        // Not already assigned
        if (assignedReviewerIds.has(r.id)) return false
        // Not the author
        if (r.email.toLowerCase() === (abstract as any).presenting_author_email?.toLowerCase()) return false
        // Has capacity
        if (r.current_assignments >= r.max_assignments) return false
        return true
      })

      if (availableReviewers.length === 0) {
        return NextResponse.json(
          { error: "No available reviewers with capacity" },
          { status: 400 }
        )
      }

      // Calculate match scores
      const categoryKeywords = (abstract as any).abstract_categories?.keywords || []
      const scoredReviewers = availableReviewers.map((reviewer: any) => ({
        reviewer,
        score: calculateMatchScore(reviewer, abstract as any, categoryKeywords),
      }))

      // Sort by score (highest first)
      scoredReviewers.sort((a, b) => b.score - a.score)

      // Select top N reviewers
      const numToAssign = Math.min(num_reviewers, scoredReviewers.length)
      selectedReviewerIds = scoredReviewers
        .slice(0, numToAssign)
        .map(sr => sr.reviewer.id)

      // If no good matches found (all scores are 0), still assign but flag for review
      const hasGoodMatches = scoredReviewers.slice(0, numToAssign).some(sr => sr.score > 10)
      if (!hasGoodMatches) {
        console.warn(`No strong expertise match for abstract ${abstractId}`)
      }
    }

    if (selectedReviewerIds.length === 0) {
      return NextResponse.json(
        { error: "No reviewers selected for assignment" },
        { status: 400 }
      )
    }

    // Create assignments
    const assignments = selectedReviewerIds.map(reviewerId => ({
      abstract_id: abstractId,
      reviewer_id: reviewerId,
      review_round,
      assigned_by: user.id,
      due_date: due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days default
      status: "pending",
    }))

    const { data: createdAssignments, error: assignError } = await supabase
      .from("abstract_review_assignments")
      .insert(assignments as any)
      .select(`
        id,
        reviewer_id,
        status,
        due_date,
        abstract_reviewer_pool (
          name,
          email,
          expertise_areas
        )
      `)

    if (assignError) {
      console.error("Assignment error:", assignError)
      return NextResponse.json({ error: "Failed to create assignments" }, { status: 500 })
    }

    // Update abstract status to under_review
    await supabase
      .from("abstracts")
      .update({
        status: "under_review",
        workflow_stage: "review",
        review_round,
      })
      .eq("id", abstractId)

    return NextResponse.json({
      success: true,
      assignments: createdAssignments,
      message: `${createdAssignments?.length} reviewer(s) assigned successfully`,
    })
  } catch (error) {
    console.error("Error assigning reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/abstracts/[id]/assign-reviewers - Get suggested reviewers with match scores
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getApiUser()
    if (!user || authError) {
      return authError || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: abstractId } = await params
    const supabase = await createAdminClient()

    // Get abstract details
    const { data: abstract, error: abstractError } = await supabase
      .from("abstracts")
      .select(`
        id,
        event_id,
        category_id,
        keywords,
        title,
        presenting_author_email,
        abstract_categories (
          name,
          keywords
        )
      `)
      .eq("id", abstractId)
      .single()

    if (abstractError || !abstract) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    // Get all active reviewers
    const { data: reviewers, error: reviewersError } = await supabase
      .from("abstract_reviewer_pool")
      .select("*")
      .eq("event_id", (abstract as any).event_id)
      .eq("status", "active")

    if (reviewersError) {
      return NextResponse.json({ error: "Failed to fetch reviewers" }, { status: 500 })
    }

    // Get existing assignments
    const { data: existingAssignments } = await supabase
      .from("abstract_review_assignments")
      .select("reviewer_id, review_round, status")
      .eq("abstract_id", abstractId)

    const assignedReviewerIds = new Set(
      existingAssignments?.map((a: any) => a.reviewer_id) || []
    )

    // Calculate match scores
    const categoryKeywords = (abstract as any).abstract_categories?.keywords || []
    const scoredReviewers = ((reviewers || []) as any[]).map((reviewer: any) => {
      const score = calculateMatchScore(reviewer, abstract as any, categoryKeywords)
      const isAssigned = assignedReviewerIds.has(reviewer.id)
      const isAuthor = reviewer.email.toLowerCase() === (abstract as any).presenting_author_email?.toLowerCase()
      const hasCapacity = reviewer.current_assignments < reviewer.max_assignments

      return {
        ...reviewer,
        match_score: score,
        match_level: score >= 50 ? "high" : score >= 25 ? "medium" : "low",
        is_assigned: isAssigned,
        is_author: isAuthor,
        has_capacity: hasCapacity,
        is_eligible: !isAssigned && !isAuthor && hasCapacity,
      }
    })

    // Sort by match score
    scoredReviewers.sort((a, b) => b.match_score - a.match_score)

    return NextResponse.json({
      abstract: {
        id: (abstract as any).id,
        title: (abstract as any).title,
        keywords: (abstract as any).keywords,
        category: (abstract as any).abstract_categories?.name,
      },
      reviewers: scoredReviewers,
      summary: {
        total: scoredReviewers.length,
        eligible: scoredReviewers.filter(r => r.is_eligible).length,
        high_match: scoredReviewers.filter(r => r.match_level === "high" && r.is_eligible).length,
        already_assigned: existingAssignments?.length || 0,
      },
    })
  } catch (error) {
    console.error("Error getting reviewer suggestions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
