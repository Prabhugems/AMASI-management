import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Use service role for public reviewer access (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
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

    // Fetch abstract settings
    const { data: settings } = await supabase
      .from("abstract_settings")
      .select("blind_review, review_enabled, reviewers_per_abstract")
      .eq("event_id", eventId)
      .single()

    // Fetch abstracts with relations
    const { data: abstracts, error: abstractsError } = await supabase
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
        category:abstract_categories(id, name),
        authors:abstract_authors(id, name, email, affiliation, author_order, is_presenting),
        reviews:abstract_reviews(id, reviewer_name, reviewer_email, score_originality, score_methodology, score_relevance, score_clarity, overall_score, recommendation, comments_to_author, reviewed_at)
      `)
      .eq("event_id", eventId)
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
      },
      abstracts: processedAbstracts,
    })
  } catch (error: any) {
    console.error("Abstract reviewer GET error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
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

    // Validate scores (1-10)
    const scores = [score_originality, score_methodology, score_relevance, score_clarity]
    for (const score of scores) {
      if (score !== undefined && score !== null) {
        if (typeof score !== "number" || score < 1 || score > 10) {
          return NextResponse.json(
            { error: "Scores must be between 1 and 10" },
            { status: 400 }
          )
        }
      }
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
      .select("id, status, event_id")
      .eq("id", abstract_id)
      .eq("event_id", eventId)
      .single()

    if (abstractError || !abstract) {
      return NextResponse.json(
        { error: "Abstract not found for this event" },
        { status: 404 }
      )
    }

    // Calculate overall score
    const validScores = scores.filter((s) => s !== undefined && s !== null) as number[]
    const overall_score =
      validScores.length > 0
        ? parseFloat((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2))
        : null

    // Insert review
    const { data: review, error: reviewError } = await supabase
      .from("abstract_reviews")
      .insert({
        abstract_id,
        reviewer_name,
        reviewer_email,
        score_originality: score_originality || null,
        score_methodology: score_methodology || null,
        score_relevance: score_relevance || null,
        score_clarity: score_clarity || null,
        overall_score,
        recommendation: recommendation || "undecided",
        comments_to_author: comments_to_author || null,
        comments_private: comments_private || null,
        reviewed_at: new Date().toISOString(),
      })
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
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
