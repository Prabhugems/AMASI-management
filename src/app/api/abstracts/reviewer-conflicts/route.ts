import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/abstracts/reviewer-conflicts?reviewer_id=... - Get COI declarations for a reviewer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reviewerId = searchParams.get("reviewer_id")
    const eventId = searchParams.get("event_id")
    const token = searchParams.get("token") // Reviewer portal token

    if (!reviewerId && !token) {
      return NextResponse.json({ error: "reviewer_id or token is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    let actualReviewerId = reviewerId

    // If using token, verify and get reviewer ID
    if (token) {
      const { data: reviewer } = await (supabase as any)
        .from("abstract_reviewers")
        .select("id, event_id")
        .eq("portal_token", token)
        .single()

      if (!reviewer) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 })
      }
      actualReviewerId = reviewer.id
    }

    const { data: conflicts, error } = await (supabase as any)
      .from("reviewer_conflicts")
      .select("*")
      .eq("reviewer_id", actualReviewerId)
      .order("declared_at", { ascending: false })

    if (error) {
      console.error("Error fetching conflicts:", error)
      return NextResponse.json({ error: "Failed to fetch conflicts" }, { status: 500 })
    }

    return NextResponse.json({
      conflicts: conflicts || [],
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/abstracts/reviewer-conflicts - Declare COI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reviewer_id, event_id, conflict_type, conflict_value, conflict_reason, token } = body

    const supabase = await createAdminClient()

    let actualReviewerId = reviewer_id
    let actualEventId = event_id

    // If using token, verify and get reviewer ID
    if (token) {
      const { data: reviewer } = await (supabase as any)
        .from("abstract_reviewers")
        .select("id, event_id")
        .eq("portal_token", token)
        .single()

      if (!reviewer) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 })
      }
      actualReviewerId = reviewer.id
      actualEventId = reviewer.event_id
    }

    if (!actualReviewerId || !actualEventId || !conflict_type || !conflict_value) {
      return NextResponse.json({
        error: "reviewer_id, event_id, conflict_type, and conflict_value are required"
      }, { status: 400 })
    }

    // Validate conflict type
    const validTypes = ["institution", "co_author", "personal", "other"]
    if (!validTypes.includes(conflict_type)) {
      return NextResponse.json({
        error: `Invalid conflict_type. Must be one of: ${validTypes.join(", ")}`
      }, { status: 400 })
    }

    // Insert conflict
    const { data: conflict, error } = await (supabase as any)
      .from("reviewer_conflicts")
      .upsert({
        reviewer_id: actualReviewerId,
        event_id: actualEventId,
        conflict_type,
        conflict_value: conflict_value.trim().toLowerCase(),
        conflict_reason,
        declared_at: new Date().toISOString(),
      }, { onConflict: "reviewer_id,conflict_type,conflict_value" })
      .select()
      .single()

    if (error) {
      console.error("Error inserting conflict:", error)
      return NextResponse.json({ error: "Failed to declare conflict" }, { status: 500 })
    }

    // Update reviewer's coi_declared flag
    await (supabase as any)
      .from("abstract_reviewers")
      .update({
        coi_declared: true,
        coi_declared_at: new Date().toISOString(),
      })
      .eq("id", actualReviewerId)

    return NextResponse.json({
      success: true,
      conflict,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/abstracts/reviewer-conflicts - Remove COI declaration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conflictId = searchParams.get("id")
    const token = searchParams.get("token")

    if (!conflictId) {
      return NextResponse.json({ error: "Conflict ID is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Verify ownership if using token
    if (token) {
      const { data: reviewer } = await (supabase as any)
        .from("abstract_reviewers")
        .select("id")
        .eq("portal_token", token)
        .single()

      if (!reviewer) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 })
      }

      // Verify conflict belongs to this reviewer
      const { data: conflict } = await (supabase as any)
        .from("reviewer_conflicts")
        .select("reviewer_id")
        .eq("id", conflictId)
        .single()

      if (!conflict || conflict.reviewer_id !== reviewer.id) {
        return NextResponse.json({ error: "Not authorized to delete this conflict" }, { status: 403 })
      }
    }

    const { error } = await (supabase as any)
      .from("reviewer_conflicts")
      .delete()
      .eq("id", conflictId)

    if (error) {
      console.error("Error deleting conflict:", error)
      return NextResponse.json({ error: "Failed to delete conflict" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
