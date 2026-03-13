import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// POST /api/submit-abstract/[eventId]/draft - Save draft
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const body = await request.json()

    const { email, draft_data } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Check if draft exists
    const { data: existing } = await (supabase as any)
      .from("abstract_drafts")
      .select("id")
      .eq("event_id", eventId)
      .ilike("user_email", email)
      .maybeSingle()

    if (existing) {
      // Update existing draft
      const { error } = await (supabase as any)
        .from("abstract_drafts")
        .update({
          draft_data,
          last_saved_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      if (error) {
        console.error("Error updating draft:", error)
        return NextResponse.json({ error: "Failed to save draft" }, { status: 500 })
      }
    } else {
      // Create new draft
      const { error } = await (supabase as any)
        .from("abstract_drafts")
        .insert({
          event_id: eventId,
          user_email: email.toLowerCase(),
          draft_data,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        })

      if (error) {
        console.error("Error creating draft:", error)
        return NextResponse.json({ error: "Failed to save draft" }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: "Draft saved",
      saved_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error saving draft:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/submit-abstract/[eventId]/draft - Get saved draft
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { data: draft, error } = await (supabase as any)
      .from("abstract_drafts")
      .select("draft_data, last_saved_at")
      .eq("event_id", eventId)
      .ilike("user_email", email)
      .maybeSingle()

    if (error) {
      console.error("Error fetching draft:", error)
      return NextResponse.json({ error: "Failed to fetch draft" }, { status: 500 })
    }

    return NextResponse.json({
      draft: draft?.draft_data || null,
      last_saved_at: draft?.last_saved_at || null,
    })
  } catch (error) {
    console.error("Error fetching draft:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/submit-abstract/[eventId]/draft - Delete draft
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    await (supabase as any)
      .from("abstract_drafts")
      .delete()
      .eq("event_id", eventId)
      .ilike("user_email", email)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting draft:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
