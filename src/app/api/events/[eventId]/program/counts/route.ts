import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { fetchConflictInputs } from "@/lib/agenda-conflict-inputs"
import { getAllConflicts } from "@/lib/agenda-conflicts"

// The numbers on the Programme sidebar.
//
// The point of a badge is to answer "where do I need to go?" without clicking
// into six screens. So only counts whose meaning is unambiguous are returned —
// a badge whose definition has to be explained is worse than no badge, because
// the reader trusts it and acts on it.
//
//   conflicts     blocking clashes only (hall double-bookings). Warnings —
//                 unconfirmed speakers, faculty double-booked across halls —
//                 are deliberately excluded: they are normal mid-planning and
//                 would leave a permanent red number nobody can clear.
//   unconfirmed   assignments still awaiting a yes. This is the chase list.
//
// Deliberately NOT returned: a "changes" count. program_change_log holds 243
// rows with no notion of read or reviewed, so any number would be invented
// rather than measured.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any

  try {
    const inputs = await fetchConflictInputs(supabase, eventId)
    const { blockingCount } = getAllConflicts(inputs)

    // "Awaiting a yes" — declined and cancelled are resolved, not outstanding.
    const unconfirmed = inputs.assignments.filter(
      (a) => !["confirmed", "declined", "cancelled"].includes((a.status ?? "").toLowerCase())
    ).length

    return NextResponse.json({
      data: { conflicts: blockingCount, unconfirmed },
    })
  } catch (error) {
    console.error("program counts error", { eventId, error })
    // A sidebar must render regardless. Zeroes hide a badge rather than
    // breaking navigation.
    return NextResponse.json({ data: { conflicts: 0, unconfirmed: 0 } })
  }
}
