import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/abstract-reviewers/[eventId]/validate - Check if email is a registered reviewer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

    const body = await request.json()
    const email = (body.email || "").trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createAdminClient()

    const { data: reviewer, error } = await supabase
      .from("abstract_reviewers")
      .select("id, name, email, status, assigned_abstracts")
      .eq("event_id", eventId)
      .eq("email", email)
      .eq("status", "active")
      .maybeSingle()

    if (error) {
      console.error("Error validating reviewer:", error)
      return NextResponse.json({ error: "Failed to validate reviewer" }, { status: 500 })
    }

    if (!reviewer) {
      return NextResponse.json({ valid: false })
    }

    return NextResponse.json({
      valid: true,
      reviewer: { name: reviewer.name, email: reviewer.email, assigned_abstracts: reviewer.assigned_abstracts || [] },
    })
  } catch (error) {
    console.error("Error in POST /api/abstract-reviewers/validate:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
