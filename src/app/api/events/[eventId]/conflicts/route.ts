import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { getAllConflicts } from "@/lib/agenda-conflicts"
import { fetchConflictInputs } from "@/lib/agenda-conflict-inputs"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any

  let inputs
  try {
    inputs = await fetchConflictInputs(supabase, eventId)
  } catch {
    return NextResponse.json({ error: "Failed to fetch conflict inputs" }, { status: 500 })
  }

  const result = getAllConflicts(inputs)

  return NextResponse.json({
    success: true,
    summary: {
      total_conflicts: result.conflicts.length,
      blocking_count: result.blockingCount,
      warning_count: result.warningCount,
    },
    conflicts: result.conflicts,
  })
}
