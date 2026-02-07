import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// GET /api/abstracts/[id]/review - Get reviews for an abstract
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createServerSupabaseClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is an active team member
    const adminClient: SupabaseClient = await createAdminClient()
    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .single()

    const isTeamMember = !!teamMember

    const { data, error } = await supabase
      .from("abstract_reviews")
      .select("*")
      .eq("abstract_id", id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching reviews:", error)
      return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 })
    }

    // Calculate average scores
    let reviews = data || []

    // If not a team member, strip private comments from each review
    if (!isTeamMember) {
      reviews = reviews.map((r: any) => {
        const { comments_private, ...rest } = r
        return rest
      })
    }

    const avgScores = {
      originality: 0,
      methodology: 0,
      relevance: 0,
      clarity: 0,
      overall: 0,
    }

    if (reviews.length > 0) {
      const reviewsWithScores = reviews.filter((r: any) => r.overall_score !== null)
      if (reviewsWithScores.length > 0) {
        avgScores.originality = reviewsWithScores.reduce((sum: number, r: any) => sum + (r.score_originality || 0), 0) / reviewsWithScores.length
        avgScores.methodology = reviewsWithScores.reduce((sum: number, r: any) => sum + (r.score_methodology || 0), 0) / reviewsWithScores.length
        avgScores.relevance = reviewsWithScores.reduce((sum: number, r: any) => sum + (r.score_relevance || 0), 0) / reviewsWithScores.length
        avgScores.clarity = reviewsWithScores.reduce((sum: number, r: any) => sum + (r.score_clarity || 0), 0) / reviewsWithScores.length
        avgScores.overall = reviewsWithScores.reduce((sum: number, r: any) => sum + (r.overall_score || 0), 0) / reviewsWithScores.length
      }
    }

    return NextResponse.json({
      reviews,
      average_scores: avgScores,
      total_reviews: reviews.length,
      completed_reviews: reviews.filter((r: any) => r.reviewed_at !== null).length,
    })
  } catch (error) {
    console.error("Error in GET /api/abstracts/[id]/review:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/abstracts/[id]/review - Add a review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase: SupabaseClient = await createServerSupabaseClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json({ error: "abstract id is required" }, { status: 400 })
    }

    const body = await request.json()

    // Validate scores (1-10)
    const scoreFields = ["score_originality", "score_methodology", "score_relevance", "score_clarity"]
    for (const field of scoreFields) {
      if (body[field] !== undefined) {
        const score = parseInt(body[field])
        if (isNaN(score) || score < 1 || score > 10) {
          return NextResponse.json(
            { error: `${field} must be between 1 and 10` },
            { status: 400 }
          )
        }
      }
    }

    const validRecommendations = ["accept", "reject", "revise", "undecided"]
    if (body.recommendation && !validRecommendations.includes(body.recommendation)) {
      return NextResponse.json(
        { error: `recommendation must be one of: ${validRecommendations.join(", ")}` },
        { status: 400 }
      )
    }

    const adminClient: SupabaseClient = await createAdminClient()

    // Verify user is an active team member to add reviews
    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id, name, email")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .single()

    if (!teamMember) {
      return NextResponse.json({ error: "Only active team members can add reviews" }, { status: 403 })
    }

    // Get reviewer info from team_members
    const reviewerInfo = {
      reviewer_id: teamMember.id,
      reviewer_name: teamMember.name || user.email,
      reviewer_email: teamMember.email || user.email,
    }

    const { data, error } = await adminClient
      .from("abstract_reviews")
      .insert({
        abstract_id: id,
        reviewer_id: reviewerInfo.reviewer_id,
        reviewer_name: reviewerInfo.reviewer_name,
        reviewer_email: reviewerInfo.reviewer_email,
        score_originality: body.score_originality || null,
        score_methodology: body.score_methodology || null,
        score_relevance: body.score_relevance || null,
        score_clarity: body.score_clarity || null,
        // overall_score is auto-calculated by trigger
        recommendation: body.recommendation || null,
        comments_to_author: body.comments_to_author || null,
        comments_private: body.comments_private || null,
        reviewed_at: body.score_originality ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating review:", error)
      return NextResponse.json({ error: "Failed to create review" }, { status: 500 })
    }

    // Update abstract status to under_review if it was submitted
    await adminClient
      .from("abstracts")
      .update({ status: "under_review" })
      .eq("id", id)
      .eq("status", "submitted")

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in POST /api/abstracts/[id]/review:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/abstracts/[id]/review - Update a review
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase: SupabaseClient = await createServerSupabaseClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    if (!body.review_id) {
      return NextResponse.json({ error: "review_id is required" }, { status: 400 })
    }

    const adminClient: SupabaseClient = await createAdminClient()

    // Verify user is the original reviewer or an active team member
    const { data: existingReview } = await adminClient
      .from("abstract_reviews")
      .select("reviewer_email")
      .eq("id", body.review_id)
      .single()

    if (!existingReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 })
    }

    const isOriginalReviewer = existingReview.reviewer_email?.toLowerCase() === user.email?.toLowerCase()

    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .single()

    if (!isOriginalReviewer && !teamMember) {
      return NextResponse.json({ error: "Only the original reviewer or team members can update reviews" }, { status: 403 })
    }

    const updateData: Record<string, any> = {}

    if (body.score_originality !== undefined) updateData.score_originality = body.score_originality
    if (body.score_methodology !== undefined) updateData.score_methodology = body.score_methodology
    if (body.score_relevance !== undefined) updateData.score_relevance = body.score_relevance
    if (body.score_clarity !== undefined) updateData.score_clarity = body.score_clarity
    if (body.recommendation !== undefined) updateData.recommendation = body.recommendation
    if (body.comments_to_author !== undefined) updateData.comments_to_author = body.comments_to_author
    if (body.comments_private !== undefined) updateData.comments_private = body.comments_private

    // Mark as reviewed if all scores are provided (use !== undefined to handle score of 0)
    if (body.score_originality !== undefined && body.score_methodology !== undefined && body.score_relevance !== undefined && body.score_clarity !== undefined) {
      updateData.reviewed_at = new Date().toISOString()
    }

    const { data, error } = await adminClient
      .from("abstract_reviews")
      .update(updateData)
      .eq("id", body.review_id)
      .select()
      .single()

    if (error) {
      console.error("Error updating review:", error)
      return NextResponse.json({ error: "Failed to update review" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PUT /api/abstracts/[id]/review:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
