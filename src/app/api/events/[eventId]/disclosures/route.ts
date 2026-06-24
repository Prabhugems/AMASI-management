import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// GET /api/events/[eventId]/disclosures
// Admin compliance list. One row per faculty assigned to the event (event_faculty
// is the spine) joined with faculty details and the current speaker_disclosures row.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  try {
    const supabase = await createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: assignedRaw, error: assignedError } = await (supabase as any)
      .from('event_faculty')
      .select(`
        faculty_id,
        faculty:faculty(id, name, email, designation, institution)
      `)
      .eq('event_id', eventId)

    if (assignedError) {
      console.error('admin disclosures spine error:', { eventId, error: assignedError })
      return NextResponse.json({ error: 'Failed to load disclosures' }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assigned = (assignedRaw ?? []) as any[]

    // Dedupe by faculty_id (event_faculty should be 1:1 but guard anyway).
    const facultyMap = new Map<
      string,
      {
        id: string
        name: string
        email: string | null
        designation: string | null
        institution: string | null
      }
    >()
    for (const row of assigned) {
      const f = row.faculty
      if (!f || !f.id) continue
      if (!facultyMap.has(f.id)) {
        facultyMap.set(f.id, {
          id: f.id,
          name: f.name,
          email: f.email ?? null,
          designation: f.designation ?? null,
          institution: f.institution ?? null,
        })
      }
    }

    const facultyIds = Array.from(facultyMap.keys())

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let disclosureRows: any[] = []
    if (facultyIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: discRaw, error: discError } = await (supabase as any)
        .from('speaker_disclosures')
        .select('*')
        .eq('event_id', eventId)
        .eq('is_current', true)
        .in('faculty_id', facultyIds)
      if (discError) {
        console.error('admin disclosures fetch error:', { eventId, error: discError })
        return NextResponse.json({ error: 'Failed to load disclosures' }, { status: 500 })
      }
      disclosureRows = discRaw ?? []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const disclosureByFaculty = new Map<string, any>()
    for (const d of disclosureRows) {
      disclosureByFaculty.set(d.faculty_id, d)
    }

    const data = Array.from(facultyMap.values()).map((faculty) => ({
      faculty,
      disclosure: disclosureByFaculty.get(faculty.id) ?? null,
    }))

    const total = data.length
    const signed = data.filter((r) => r.disclosure).length
    const with_conflict = data.filter((r) => r.disclosure?.has_conflict === true).length
    const unsigned = total - signed

    return NextResponse.json({
      data,
      counts: { total, signed, with_conflict, unsigned },
    })
  } catch (e) {
    console.error('admin disclosures GET error:', { eventId, error: e })
    return NextResponse.json({ error: 'Failed to load disclosures' }, { status: 500 })
  }
}
