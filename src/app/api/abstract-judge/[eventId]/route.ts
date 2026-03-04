import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/abstract-judge/[eventId] - Get event data for judge portal
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
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

    // Fetch event info
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, short_name, start_date, end_date, venue_name, city")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Fetch award categories with scoring criteria
    const { data: categories } = await supabase
      .from("abstract_categories")
      .select("id, name, scoring_criteria, is_award_category, award_name")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .eq("is_award_category", true)
      .order("sort_order", { ascending: true })

    // Only return categories that have scoring_criteria defined
    const scorableCategories = (categories || []).filter(
      (c: any) => c.scoring_criteria && Array.isArray(c.scoring_criteria) && c.scoring_criteria.length > 0
    )

    // Fetch accepted/podium-selected abstracts for these categories
    const categoryIds = scorableCategories.map((c: any) => c.id)
    let abstracts: any[] = []

    if (categoryIds.length > 0) {
      const { data: abstractsData, error: abstractsError } = await supabase
        .from("abstracts")
        .select(`
          id,
          abstract_number,
          title,
          presenting_author_name,
          presenting_author_affiliation,
          category_id,
          status,
          is_podium_selected,
          reviews:abstract_reviews(
            id, reviewer_name, reviewer_email, overall_score,
            scores, total_score, max_possible_score, review_type,
            reviewed_at
          )
        `)
        .eq("event_id", eventId)
        .in("status", ["accepted"])
        .in("category_id", categoryIds)
        .order("abstract_number", { ascending: true })

      if (abstractsError) {
        console.error("Judge abstracts fetch error:", abstractsError)
      } else {
        abstracts = abstractsData || []
      }
    }

    return NextResponse.json({
      event,
      categories: scorableCategories,
      abstracts,
    })
  } catch (error: any) {
    console.error("Abstract judge GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/abstract-judge/[eventId] - Submit a judge score
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
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

    const body = await request.json()
    const {
      abstract_id,
      judge_name,
      judge_email,
      scores,
      max_possible_score,
      comments_private,
    } = body

    // Validate required fields
    if (!abstract_id || !judge_name || !judge_email) {
      return NextResponse.json(
        { error: "abstract_id, judge_name, and judge_email are required" },
        { status: 400 }
      )
    }

    if (!scores || typeof scores !== "object" || Object.keys(scores).length === 0) {
      return NextResponse.json(
        { error: "scores are required" },
        { status: 400 }
      )
    }

    // Verify abstract belongs to the event
    const { data: abstract, error: abstractError } = await supabase
      .from("abstracts")
      .select("id, event_id, category_id")
      .eq("id", abstract_id)
      .eq("event_id", eventId)
      .single()

    if (abstractError || !abstract) {
      return NextResponse.json(
        { error: "Abstract not found for this event" },
        { status: 404 }
      )
    }

    // Insert judge score as a review with review_type = 'judge_score'
    const { data: review, error: reviewError } = await supabase
      .from("abstract_reviews")
      .insert({
        abstract_id,
        reviewer_name: judge_name,
        reviewer_email: judge_email,
        scores,
        max_possible_score: max_possible_score || null,
        review_type: "judge_score",
        comments_private: comments_private || null,
        reviewed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (reviewError) {
      console.error("Judge score insert error:", reviewError)
      return NextResponse.json(
        { error: "Failed to submit score" },
        { status: 500 }
      )
    }

    return NextResponse.json(review, { status: 201 })
  } catch (error: any) {
    console.error("Abstract judge POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
