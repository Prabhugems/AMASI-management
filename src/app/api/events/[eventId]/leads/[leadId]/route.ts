import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/server"

type Params = { params: Promise<{ eventId: string; leadId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId, leadId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: lead, error } = await db
      .from("event_leads")
      .select("*")
      .eq("id", leadId)
      .eq("event_id", eventId)
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const { data: notes } = await db
      .from("event_lead_notes")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })

    return NextResponse.json({ data: { ...lead, notes: notes || [] } })
  } catch (error: any) {
    console.error("Error in GET /api/events/[eventId]/leads/[leadId]:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId, leadId } = await params
    const body = await request.json()

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }

    const allowedFields = ["name", "email", "phone", "source", "status", "notes", "utm_source", "utm_medium", "utm_campaign", "registration_id"]
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (body.status === "converted" && !body.converted_at) {
      updateData.converted_at = new Date().toISOString()
    }

    const { data, error } = await db
      .from("event_leads")
      .update(updateData)
      .eq("id", leadId)
      .eq("event_id", eventId)
      .select()
      .single()

    if (error) {
      console.error("Error updating lead:", error)
      return NextResponse.json({ error: "Failed to update lead" }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("Error in PATCH /api/events/[eventId]/leads/[leadId]:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId, leadId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { error } = await db
      .from("event_leads")
      .delete()
      .eq("id", leadId)
      .eq("event_id", eventId)

    if (error) {
      console.error("Error deleting lead:", error)
      return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error in DELETE /api/events/[eventId]/leads/[leadId]:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 500 })
  }
}
