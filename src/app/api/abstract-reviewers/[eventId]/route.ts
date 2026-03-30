import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/abstract-reviewers/[eventId] - List reviewers with review counts and activity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

    const { error: authError } = await requireEventAndPermission(eventId, 'abstracts')
    if (authError) return authError

    const supabase: SupabaseClient = await createAdminClient()

    // Fetch reviewers
    const { data: reviewers, error } = await supabase
      .from("abstract_reviewers")
      .select("*")
      .eq("event_id", eventId)
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching reviewers:", error)
      return NextResponse.json({ error: "Failed to fetch reviewers" }, { status: 500 })
    }

    // Fetch review counts per reviewer email for this event
    const { data: reviews } = await supabase
      .from("abstract_reviews")
      .select("reviewer_email, abstract_id, abstracts!inner(event_id)")
      .eq("abstracts.event_id", eventId)

    // Count reviews per email
    const reviewCounts: Record<string, number> = {}
    if (reviews) {
      for (const r of reviews) {
        const email = (r.reviewer_email || "").toLowerCase()
        reviewCounts[email] = (reviewCounts[email] || 0) + 1
      }
    }

    // Fetch activity tracking from abstract_reviewer_pool and assignments
    const reviewerEmails = (reviewers || []).map((r: any) => r.email.toLowerCase())

    // Get pool data for tracking info
    const { data: poolData } = await supabase
      .from("abstract_reviewer_pool")
      .select("email, last_login_at, total_emails_sent, total_emails_opened, decline_count")
      .eq("event_id", eventId)
      .in("email", reviewerEmails)

    // Get assignment activity
    const { data: assignments } = await supabase
      .from("abstract_review_assignments")
      .select(`
        id,
        abstract_id,
        status,
        assigned_at,
        email_opened_at,
        last_viewed_at,
        reminder_count,
        declined_reason,
        abstract_reviewer_pool!inner (email, event_id)
      `)
      .eq("abstract_reviewer_pool.event_id", eventId)

    // Build activity tracking map by email
    const activityByEmail: Record<string, {
      last_login_at: string | null
      total_emails_sent: number
      total_emails_opened: number
      decline_count: number
      assignments_total: number
      assignments_opened: number
      assignments_viewed: number
      assignments_pending: number
      assignments_completed: number
      assignments_declined: number
      last_viewed_at: string | null
      reminders_sent: number
      activity_status: string
    }> = {}

    // Initialize from pool data
    if (poolData) {
      for (const p of poolData) {
        const email = p.email.toLowerCase()
        activityByEmail[email] = {
          last_login_at: p.last_login_at,
          total_emails_sent: p.total_emails_sent || 0,
          total_emails_opened: p.total_emails_opened || 0,
          decline_count: p.decline_count || 0,
          assignments_total: 0,
          assignments_opened: 0,
          assignments_viewed: 0,
          assignments_pending: 0,
          assignments_completed: 0,
          assignments_declined: 0,
          last_viewed_at: null,
          reminders_sent: 0,
          activity_status: "unknown",
        }
      }
    }

    // Aggregate assignment data
    if (assignments) {
      for (const a of assignments) {
        const email = ((a.abstract_reviewer_pool as any)?.email || "").toLowerCase()
        if (!activityByEmail[email]) {
          activityByEmail[email] = {
            last_login_at: null,
            total_emails_sent: 0,
            total_emails_opened: 0,
            decline_count: 0,
            assignments_total: 0,
            assignments_opened: 0,
            assignments_viewed: 0,
            assignments_pending: 0,
            assignments_completed: 0,
            assignments_declined: 0,
            last_viewed_at: null,
            reminders_sent: 0,
            activity_status: "unknown",
          }
        }
        const act = activityByEmail[email]
        act.assignments_total++
        if (a.email_opened_at) act.assignments_opened++
        if (a.last_viewed_at) {
          act.assignments_viewed++
          if (!act.last_viewed_at || new Date(a.last_viewed_at) > new Date(act.last_viewed_at)) {
            act.last_viewed_at = a.last_viewed_at
          }
        }
        if (a.status === "pending") act.assignments_pending++
        if (a.status === "completed") act.assignments_completed++
        if (a.status === "declined") act.assignments_declined++
        act.reminders_sent += a.reminder_count || 0
      }
    }

    // Calculate activity status
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    for (const email of Object.keys(activityByEmail)) {
      const act = activityByEmail[email]
      const lastActivity = act.last_viewed_at || act.last_login_at

      if (!lastActivity) {
        act.activity_status = "never_active"
      } else {
        const lastDate = new Date(lastActivity)
        if (lastDate > oneDayAgo) {
          act.activity_status = "active_today"
        } else if (lastDate > threeDaysAgo) {
          act.activity_status = "active_recently"
        } else if (lastDate > sevenDaysAgo) {
          act.activity_status = "inactive_week"
        } else {
          act.activity_status = "inactive_long"
        }
      }
    }

    // Merge review counts and activity into reviewers
    const reviewersWithCounts = (reviewers || []).map((reviewer: any) => {
      const email = reviewer.email.toLowerCase()
      return {
        ...reviewer,
        review_count: reviewCounts[email] || 0,
        activity: activityByEmail[email] || null,
      }
    })

    return NextResponse.json(reviewersWithCounts)
  } catch (error) {
    console.error("Error in GET /api/abstract-reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/abstract-reviewers/[eventId] - Add single or bulk reviewers
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

    const { error: authError } = await requireEventAndPermission(eventId, 'abstracts')
    if (authError) return authError

    const supabase: SupabaseClient = await createAdminClient()

    const body = await request.json()
    const reviewers = Array.isArray(body) ? body : [body]

    if (reviewers.length === 0) {
      return NextResponse.json({ error: "No reviewers provided" }, { status: 400 })
    }

    const toInsert = reviewers.map((r: any) => ({
      event_id: eventId,
      name: (r.name || "").trim(),
      email: (r.email || "").trim().toLowerCase(),
      phone: r.phone?.trim() || null,
      institution: r.institution?.trim() || null,
      city: r.city?.trim() || null,
      specialty: r.specialty?.trim() || null,
      years_of_experience: r.years_of_experience?.toString().trim() || null,
      status: r.status?.trim() || "active",
      notes: r.notes?.trim() || null,
    })).filter((r: any) => r.name && r.email)

    if (toInsert.length === 0) {
      return NextResponse.json({ error: "No valid reviewers (name and email required)" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("abstract_reviewers")
      .upsert(toInsert, { onConflict: "event_id,email", ignoreDuplicates: false })
      .select()

    if (error) {
      console.error("Error inserting reviewers:", error)
      return NextResponse.json({ error: "Failed to import reviewers" }, { status: 500 })
    }

    return NextResponse.json({
      success: data?.length || 0,
      failed: toInsert.length - (data?.length || 0),
      errors: [],
    })
  } catch (error) {
    console.error("Error in POST /api/abstract-reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/abstract-reviewers/[eventId] - Update a reviewer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

    const { error: putAuthError } = await requireEventAndPermission(eventId, 'abstracts')
    if (putAuthError) return putAuthError

    const supabase: SupabaseClient = await createAdminClient()
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "Reviewer ID is required" }, { status: 400 })
    }

    const payload: Record<string, any> = { updated_at: new Date().toISOString() }
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.email !== undefined) payload.email = updates.email.toLowerCase()
    if (updates.phone !== undefined) payload.phone = updates.phone
    if (updates.institution !== undefined) payload.institution = updates.institution
    if (updates.city !== undefined) payload.city = updates.city
    if (updates.specialty !== undefined) payload.specialty = updates.specialty
    if (updates.years_of_experience !== undefined) payload.years_of_experience = updates.years_of_experience
    if (updates.status !== undefined) payload.status = updates.status
    if (updates.notes !== undefined) payload.notes = updates.notes
    if (updates.assigned_abstracts !== undefined) payload.assigned_abstracts = updates.assigned_abstracts

    const { data, error } = await supabase
      .from("abstract_reviewers")
      .update(payload)
      .eq("id", id)
      .eq("event_id", eventId)
      .select()
      .single()

    if (error) {
      console.error("Error updating reviewer:", error)
      return NextResponse.json({ error: "Failed to update reviewer" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PUT /api/abstract-reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/abstract-reviewers/[eventId] - Remove a reviewer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

    const { error: delAuthError } = await requireEventAndPermission(eventId, 'abstracts')
    if (delAuthError) return delAuthError

    const supabase: SupabaseClient = await createAdminClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Reviewer ID is required" }, { status: 400 })
    }

    const { error } = await supabase
      .from("abstract_reviewers")
      .delete()
      .eq("id", id)
      .eq("event_id", eventId)

    if (error) {
      console.error("Error deleting reviewer:", error)
      return NextResponse.json({ error: "Failed to delete reviewer" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/abstract-reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
