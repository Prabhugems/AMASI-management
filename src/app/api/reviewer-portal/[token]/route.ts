import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// GET /api/reviewer-portal/[token] - Get reviewer profile and assigned abstracts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createAdminClient()

    // Get reviewer from pool by form_token
    const { data: reviewer, error: reviewerError } = await supabase
      .from("reviewers_pool")
      .select("*")
      .eq("form_token", token)
      .single()

    if (reviewerError || !reviewer) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })
    }

    // Get reviews assigned to this reviewer by email
    // NOTE: Author information is excluded for BLIND REVIEW
    const { data: reviews, error: reviewsError } = await supabase
      .from("abstract_reviews")
      .select(`
        id,
        abstract_id,
        reviewer_id,
        review_type,
        recommendation,
        comments_to_author,
        comments_private,
        scores,
        total_score,
        max_possible_score,
        reviewed_at,
        created_at,
        abstract:abstracts!abstract_id (
          id,
          abstract_number,
          title,
          abstract_text,
          keywords,
          presentation_type,
          status,
          file_url,
          file_name,
          submitted_at,
          category:abstract_categories!category_id (
            id,
            name
          ),
          event:events!event_id (
            id,
            name,
            short_name
          )
        )
      `)
      .eq("reviewer_email", reviewer.email)
      .order("created_at", { ascending: false })

    // Get review stats
    const completedReviews = reviews?.filter((r: any) => r.reviewed_at) || []
    const pendingReviews = reviews?.filter((r: any) => !r.reviewed_at) || []

    return NextResponse.json({
      reviewer: {
        id: reviewer.id,
        name: reviewer.name,
        email: reviewer.email,
        phone: reviewer.phone,
        institution: reviewer.institution,
        city: reviewer.city,
        specialty: reviewer.specialty,
        years_of_experience: reviewer.years_of_experience,
        photo_url: reviewer.photo_url,
        bio: reviewer.bio,
        designation: reviewer.designation,
        linkedin_url: reviewer.linkedin_url,
        orcid_id: reviewer.orcid_id,
        publications_count: reviewer.publications_count,
        research_interests: reviewer.research_interests,
        available_for_review: reviewer.available_for_review,
        max_reviews_per_month: reviewer.max_reviews_per_month,
        total_reviews_completed: reviewer.total_reviews_completed,
        avg_review_time_days: reviewer.avg_review_time_days,
        rating: reviewer.rating,
        is_amasi_member: reviewer.is_amasi_member,
        amasi_membership_number: reviewer.amasi_membership_number,
        member_status: reviewer.member_status,
        form_completed_at: reviewer.form_completed_at,
      },
      reviews: reviews || [],
      stats: {
        total: reviews?.length || 0,
        completed: completedReviews.length,
        pending: pendingReviews.length,
      },
    })
  } catch (error) {
    console.error("Error in GET /api/reviewer-portal/[token]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/reviewer-portal/[token] - Update reviewer profile
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

    const supabase: SupabaseClient = await createAdminClient()

    // Verify token exists
    const { data: existing } = await supabase
      .from("reviewers_pool")
      .select("id")
      .eq("form_token", token)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })
    }

    // Build update payload
    const allowedFields = [
      "phone", "institution", "city", "specialty", "years_of_experience",
      "bio", "designation", "linkedin_url", "orcid_id", "publications_count",
      "research_interests", "available_for_review", "max_reviews_per_month"
    ]

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        payload[field] = body[field]
      }
    }

    // Mark form as completed if filling required fields
    if (body.specialty && !body.form_completed_at) {
      payload.form_completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from("reviewers_pool")
      .update(payload)
      .eq("form_token", token)
      .select()
      .single()

    if (error) {
      console.error("Error updating reviewer:", error)
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PUT /api/reviewer-portal/[token]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
