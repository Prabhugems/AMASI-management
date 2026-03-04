import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabaseClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = supabaseClient as any
    const { eventId } = await params

    if (!uuidRegex.test(eventId)) {
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      )
    }

    // Fetch event info
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, short_name, start_date, end_date, venue_name, city")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      )
    }

    // Check for email query param (for filtering assigned abstracts)
    const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() || ""

    // Fetch abstract settings
    const { data: settings } = await supabase
      .from("abstract_settings")
      .select("blind_review, review_enabled, reviewers_per_abstract, restrict_reviewers")
      .eq("event_id", eventId)
      .maybeSingle()

    // If restrict_reviewers is ON and email provided, look up assigned abstracts
    let assignedIds: string[] | null = null
    if (settings?.restrict_reviewers && email) {
      const { data: reviewer } = await supabase
        .from("abstract_reviewers")
        .select("assigned_abstracts")
        .eq("event_id", eventId)
        .eq("email", email)
        .eq("status", "active")
        .maybeSingle()

      if (reviewer?.assigned_abstracts?.length > 0) {
        assignedIds = reviewer.assigned_abstracts
      } else {
        // Reviewer has no assignments — return empty list
        assignedIds = []
      }
    }

    // Fetch categories with scoring criteria
    const { data: categories } = await supabase
      .from("abstract_categories")
      .select("id, name, scoring_criteria, is_award_category, award_name")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    // Fetch abstracts with relations
    let abstractsQuery = supabase
      .from("abstracts")
      .select(`
        id,
        abstract_number,
        title,
        abstract_text,
        keywords,
        presentation_type,
        status,
        category_id,
        presenting_author_name,
        presenting_author_email,
        presenting_author_affiliation,
        file_url,
        file_name,
        submitted_at,
        category:abstract_categories(id, name, scoring_criteria),
        authors:abstract_authors(id, name, email, affiliation, author_order, is_presenting),
        reviews:abstract_reviews(id, reviewer_name, reviewer_email, score_originality, score_methodology, score_relevance, score_clarity, overall_score, scores, total_score, max_possible_score, review_type, recommendation, comments_to_author, reviewed_at)
      `)
      .eq("event_id", eventId)

    // Filter to only assigned abstracts when restriction is active
    if (assignedIds !== null) {
      if (assignedIds.length === 0) {
        // No assignments — return empty
        return NextResponse.json({
          event,
          settings: {
            blind_review: settings?.blind_review ?? false,
            review_enabled: settings?.review_enabled ?? false,
            reviewers_per_abstract: settings?.reviewers_per_abstract ?? 2,
            restrict_reviewers: settings?.restrict_reviewers ?? false,
          },
          categories: categories || [],
          abstracts: [],
        })
      }
      abstractsQuery = abstractsQuery.in("id", assignedIds)
    }

    const { data: abstracts, error: abstractsError } = await abstractsQuery
      .order("abstract_number", { ascending: true })

    if (abstractsError) {
      console.error("Abstracts fetch error:", abstractsError)
      return NextResponse.json(
        { error: "Failed to fetch abstracts" },
        { status: 500 }
      )
    }

    // If blind review, strip author info
    const isBlindReview = settings?.blind_review ?? false
    const processedAbstracts = (abstracts || []).map((abstract: any) => {
      if (isBlindReview) {
        return {
          ...abstract,
          presenting_author_name: undefined,
          presenting_author_email: undefined,
          presenting_author_affiliation: undefined,
          authors: abstract.authors?.map((a: any) => ({
            ...a,
            name: `Author ${a.author_order}`,
            email: undefined,
            affiliation: undefined,
          })),
        }
      }
      return abstract
    })

    return NextResponse.json({
      event,
      settings: {
        blind_review: isBlindReview,
        review_enabled: settings?.review_enabled ?? false,
        reviewers_per_abstract: settings?.reviewers_per_abstract ?? 2,
        restrict_reviewers: settings?.restrict_reviewers ?? false,
      },
      categories: categories || [],
      abstracts: processedAbstracts,
    })
  } catch (error: any) {
    console.error("Abstract reviewer GET error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabaseClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = supabaseClient as any
    const { eventId } = await params

    if (!uuidRegex.test(eventId)) {
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      abstract_id,
      reviewer_name,
      reviewer_email,
      score_originality,
      score_methodology,
      score_relevance,
      score_clarity,
      scores: dynamicScores,
      max_possible_score,
      review_type,
      recommendation,
      comments_to_author,
      comments_private,
    } = body

    // Validate required fields
    if (!abstract_id || !reviewer_name || !reviewer_email) {
      return NextResponse.json(
        { error: "abstract_id, reviewer_name, and reviewer_email are required" },
        { status: 400 }
      )
    }

    // Validate recommendation
    const validRecommendations = ["accept", "reject", "revise", "undecided"]
    if (recommendation && !validRecommendations.includes(recommendation)) {
      return NextResponse.json(
        { error: "Invalid recommendation value" },
        { status: 400 }
      )
    }

    // Verify abstract belongs to the event
    const { data: abstract, error: abstractError } = await supabase
      .from("abstracts")
      .select("id, status, event_id, category_id")
      .eq("id", abstract_id)
      .eq("event_id", eventId)
      .single()

    if (abstractError || !abstract) {
      return NextResponse.json(
        { error: "Abstract not found for this event" },
        { status: 404 }
      )
    }

    // Build insert data - supports both dynamic JSONB scores and legacy fixed scores
    const insertData: Record<string, any> = {
      abstract_id,
      reviewer_name,
      reviewer_email,
      recommendation: recommendation || "undecided",
      comments_to_author: comments_to_author || null,
      comments_private: comments_private || null,
      reviewed_at: new Date().toISOString(),
      review_type: review_type || "review",
    }

    if (dynamicScores && typeof dynamicScores === "object" && Object.keys(dynamicScores).length > 0) {
      // Dynamic scoring path
      insertData.scores = dynamicScores
      insertData.max_possible_score = max_possible_score || null
      // total_score and overall_score are auto-calculated by DB trigger
    } else {
      // Legacy fixed-column scoring path
      const legacyScores = [score_originality, score_methodology, score_relevance, score_clarity]
      for (const score of legacyScores) {
        if (score !== undefined && score !== null) {
          if (typeof score !== "number" || score < 1 || score > 10) {
            return NextResponse.json(
              { error: "Scores must be between 1 and 10" },
              { status: 400 }
            )
          }
        }
      }
      insertData.score_originality = score_originality || null
      insertData.score_methodology = score_methodology || null
      insertData.score_relevance = score_relevance || null
      insertData.score_clarity = score_clarity || null
      // overall_score is auto-calculated by DB trigger
    }

    // Insert review
    const { data: review, error: reviewError } = await supabase
      .from("abstract_reviews")
      .insert(insertData)
      .select()
      .single()

    if (reviewError) {
      console.error("Review insert error:", reviewError)
      return NextResponse.json(
        { error: "Failed to submit review" },
        { status: 500 }
      )
    }

    // Auto-update abstract status to under_review if currently submitted
    if (abstract.status === "submitted") {
      await supabase
        .from("abstracts")
        .update({ status: "under_review" })
        .eq("id", abstract_id)
    }

    return NextResponse.json(review, { status: 201 })
  } catch (error: any) {
    console.error("Abstract reviewer POST error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
