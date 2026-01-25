import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("event_id", eventId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Clear error:", error)
    return NextResponse.json(
      { error: error.message || "Clear failed" },
      { status: 500 }
    )
  }
}
