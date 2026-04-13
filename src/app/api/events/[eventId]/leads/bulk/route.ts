import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const body = await request.json()
    const { lead_ids, status } = body

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return NextResponse.json({ error: "lead_ids array is required" }, { status: 400 })
    }

    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === "converted") {
      updateData.converted_at = new Date().toISOString()
    }

    const { data, error } = await db
      .from("event_leads")
      .update(updateData)
      .eq("event_id", eventId)
      .in("id", lead_ids)
      .select()

    if (error) {
      console.error("Error bulk updating leads:", error)
      return NextResponse.json({ error: "Failed to update leads" }, { status: 500 })
    }

    return NextResponse.json({ data, updated: (data || []).length })
  } catch (error: any) {
    console.error("Error in PATCH /api/events/[eventId]/leads/bulk:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const body = await request.json()
    const { lead_ids } = body

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return NextResponse.json({ error: "lead_ids array is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { error } = await db
      .from("event_leads")
      .delete()
      .eq("event_id", eventId)
      .in("id", lead_ids)

    if (error) {
      console.error("Error bulk deleting leads:", error)
      return NextResponse.json({ error: "Failed to delete leads" }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: lead_ids.length })
  } catch (error: any) {
    console.error("Error in DELETE /api/events/[eventId]/leads/bulk:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 500 })
  }
}
