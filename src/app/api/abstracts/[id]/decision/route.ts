import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// PUT /api/abstracts/[id]/decision - Make acceptance decision
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

    // Role-based authorization: verify user is an active team member
    const adminClient: SupabaseClient = await createAdminClient()
    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .maybeSingle()

    if (!teamMember) {
      return NextResponse.json({ error: "Only team members can make decisions" }, { status: 403 })
    }

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const body = await request.json()

    if (!body.decision) {
      return NextResponse.json(
        { error: "decision is required (accepted, rejected, revision_requested)" },
        { status: 400 }
      )
    }

    const validDecisions = ["accepted", "rejected", "revision_requested", "under_review", "redirected"]
    if (!validDecisions.includes(body.decision)) {
      return NextResponse.json(
        { error: `Invalid decision. Must be one of: ${validDecisions.join(", ")}` },
        { status: 400 }
      )
    }

    // Get current abstract
    const { data: abstract, error: fetchError } = await adminClient
      .from("abstracts")
      .select("*, event_id")
      .eq("id", id)
      .single()

    if (fetchError || !abstract) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    // Handle "Redirect to Free Session" decision
    if (body.decision === "redirected") {
      // Find the Free Paper/Video/Poster category for this event
      const { data: freeCategory } = await adminClient
        .from("abstract_categories")
        .select("id")
        .eq("event_id", abstract.event_id)
        .eq("is_award_category", false)
        .eq("is_active", true)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!freeCategory) {
        return NextResponse.json(
          { error: "No free session category found. Please create a non-award category first." },
          { status: 400 }
        )
      }

      const { data: redirectedData, error: redirectError } = await adminClient
        .from("abstracts")
        .update({
          status: "accepted",
          decision_date: new Date().toISOString(),
          decision_notes: body.decision_notes || "Redirected to free session",
          redirected_from_category_id: abstract.category_id,
          category_id: freeCategory.id,
          accepted_as: body.accepted_as || abstract.presentation_type || "oral",
        })
        .eq("id", id)
        .select()
        .single()

      if (redirectError) {
        console.error("Error redirecting abstract:", redirectError)
        return NextResponse.json({ error: "Failed to redirect abstract" }, { status: 500 })
      }

      return NextResponse.json(redirectedData)
    }

    // Build update payload
    const updateData: Record<string, any> = {
      status: body.decision,
      decision_date: new Date().toISOString(),
    }

    if (body.decision_notes !== undefined) {
      updateData.decision_notes = body.decision_notes
    }

    // For accepted abstracts, set the accepted_as (oral, poster, video)
    if (body.decision === "accepted" && body.accepted_as) {
      updateData.accepted_as = body.accepted_as
    }

    // For revision_requested, clear accepted_as
    if (body.decision === "revision_requested") {
      updateData.accepted_as = null
    }

    const { data, error } = await adminClient
      .from("abstracts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating abstract decision:", error)
      return NextResponse.json({ error: "Failed to update decision" }, { status: 500 })
    }

    // TODO: Send notification email to author based on event settings

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PUT /api/abstracts/[id]/decision:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/abstracts/[id]/decision/bulk - Bulk decision for multiple abstracts
export async function POST(
  request: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase: SupabaseClient = await createServerSupabaseClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Role-based authorization: verify user is an active team member
    const adminClient: SupabaseClient = await createAdminClient()
    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .maybeSingle()

    if (!teamMember) {
      return NextResponse.json({ error: "Only team members can make decisions" }, { status: 403 })
    }

    const body = await request.json()

    if (!body.abstract_ids || !Array.isArray(body.abstract_ids) || body.abstract_ids.length === 0) {
      return NextResponse.json({ error: "abstract_ids array is required" }, { status: 400 })
    }

    if (!body.decision) {
      return NextResponse.json({ error: "decision is required" }, { status: 400 })
    }

    const validDecisions = ["accepted", "rejected", "revision_requested", "under_review", "redirected"]
    if (!validDecisions.includes(body.decision)) {
      return NextResponse.json(
        { error: `Invalid decision. Must be one of: ${validDecisions.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate accepted_as values
    if (body.decision === "accepted" && body.accepted_as) {
      const validAcceptedAs = ["oral", "poster", "video"]
      if (!validAcceptedAs.includes(body.accepted_as)) {
        return NextResponse.json(
          { error: `Invalid accepted_as value. Must be one of: ${validAcceptedAs.join(", ")}` },
          { status: 400 }
        )
      }
    }

    // Verify all abstract_ids belong to the same event
    const { data: abstracts, error: fetchError } = await adminClient
      .from("abstracts")
      .select("id, event_id, category_id, presentation_type")
      .in("id", body.abstract_ids)

    if (fetchError || !abstracts || abstracts.length === 0) {
      return NextResponse.json({ error: "No abstracts found for the provided IDs" }, { status: 404 })
    }

    if (abstracts.length !== body.abstract_ids.length) {
      return NextResponse.json({ error: "Some abstract IDs were not found" }, { status: 404 })
    }

    const eventIds = new Set(abstracts.map((a: any) => a.event_id))
    if (eventIds.size > 1) {
      return NextResponse.json(
        { error: "All abstracts must belong to the same event for bulk decisions" },
        { status: 400 }
      )
    }

    // Handle bulk redirect to free session
    if (body.decision === "redirected") {
      const eventId = abstracts[0].event_id
      const { data: freeCategory } = await adminClient
        .from("abstract_categories")
        .select("id")
        .eq("event_id", eventId)
        .eq("is_award_category", false)
        .eq("is_active", true)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!freeCategory) {
        return NextResponse.json(
          { error: "No free session category found. Please create a non-award category first." },
          { status: 400 }
        )
      }

      // Update each abstract individually to preserve its original category_id
      const results = []
      for (const abstract of abstracts) {
        const { data: updated, error: updateErr } = await adminClient
          .from("abstracts")
          .update({
            status: "accepted",
            decision_date: new Date().toISOString(),
            decision_notes: body.decision_notes || "Redirected to free session",
            redirected_from_category_id: abstract.category_id,
            category_id: freeCategory.id,
            accepted_as: body.accepted_as || abstract.presentation_type || "oral",
          })
          .eq("id", abstract.id)
          .select()
          .single()

        if (updateErr) {
          console.error(`Error redirecting abstract ${abstract.id}:`, updateErr)
        } else {
          results.push(updated)
        }
      }

      return NextResponse.json({
        success: true,
        updated: results.length,
        abstracts: results,
      })
    }

    const updateData: Record<string, any> = {
      status: body.decision,
      decision_date: new Date().toISOString(),
    }

    if (body.decision_notes !== undefined) {
      updateData.decision_notes = body.decision_notes
    }

    if (body.decision === "accepted" && body.accepted_as) {
      updateData.accepted_as = body.accepted_as
    }

    const { data, error } = await adminClient
      .from("abstracts")
      .update(updateData)
      .in("id", body.abstract_ids)
      .select()

    if (error) {
      console.error("Error bulk updating abstract decisions:", error)
      return NextResponse.json({ error: "Failed to update decisions" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
      abstracts: data,
    })
  } catch (error) {
    console.error("Error in POST /api/abstracts/[id]/decision:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
