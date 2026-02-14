import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// PUT /api/abstracts/awards - Batch update award rankings
export async function PUT(request: NextRequest) {
  try {
    const supabase: SupabaseClient = await createServerSupabaseClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient: SupabaseClient = await createAdminClient()

    // Team member authorization
    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .maybeSingle()

    if (!teamMember) {
      return NextResponse.json(
        { error: "Only team members can manage awards" },
        { status: 403 }
      )
    }

    const body = await request.json()

    if (!body.rankings || !Array.isArray(body.rankings)) {
      return NextResponse.json(
        { error: "rankings array is required" },
        { status: 400 }
      )
    }

    // Validate rankings structure
    for (const ranking of body.rankings) {
      if (!ranking.abstract_id) {
        return NextResponse.json(
          { error: "Each ranking must have an abstract_id" },
          { status: 400 }
        )
      }
      if (ranking.rank !== null && (ranking.rank < 1 || ranking.rank > 10)) {
        return NextResponse.json(
          { error: "Rank must be between 1 and 10" },
          { status: 400 }
        )
      }
    }

    // Auto-assign award types based on rank
    const getAwardType = (rank: number | null): string | null => {
      if (!rank) return null
      if (rank === 1) return "medal"
      if (rank <= 3) return "certificate"
      if (rank <= 10) return "bursary"
      return null
    }

    // Update each abstract's award info
    const results = []
    for (const ranking of body.rankings) {
      const updateData: Record<string, any> = {
        award_rank: ranking.rank,
        award_type: getAwardType(ranking.rank),
        is_podium_selected: ranking.rank !== null && ranking.rank <= 10,
      }

      const { data, error } = await adminClient
        .from("abstracts")
        .update(updateData)
        .eq("id", ranking.abstract_id)
        .select()
        .single()

      if (error) {
        console.error(`Error updating award for ${ranking.abstract_id}:`, error)
        results.push({ abstract_id: ranking.abstract_id, success: false, error: error.message })
      } else {
        results.push({ abstract_id: ranking.abstract_id, success: true, data })
      }
    }

    const failed = results.filter(r => !r.success)
    if (failed.length > 0) {
      return NextResponse.json({
        success: false,
        message: `${failed.length} of ${results.length} updates failed`,
        results,
      }, { status: 207 })
    }

    return NextResponse.json({
      success: true,
      updated: results.length,
      results,
    })
  } catch (error) {
    console.error("Error in PUT /api/abstracts/awards:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
