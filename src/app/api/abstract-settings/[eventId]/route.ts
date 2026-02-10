import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// GET /api/abstract-settings/[eventId] - Get settings for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 }
      )
    }

    const supabase: SupabaseClient = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("abstract_settings")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle()

    if (error) {
      console.error("Error fetching abstract settings:", error)
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      )
    }

    // Return default settings if not found
    if (!data) {
      return NextResponse.json({
        event_id: eventId,
        submission_opens_at: null,
        submission_deadline: null,
        revision_deadline: null,
        notification_date: null,
        max_submissions_per_person: 3,
        max_authors: 10,
        word_limit: 300,
        require_registration: true,
        require_addon_id: null,
        allowed_file_types: ["pdf"],
        max_file_size_mb: 5,
        presentation_types: ["oral", "poster"],
        review_enabled: false,
        reviewers_per_abstract: 2,
        blind_review: true,
        submission_guidelines: null,
        author_guidelines: null,
        notify_on_submission: true,
        notify_on_decision: true,
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in GET /api/abstract-settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PUT /api/abstract-settings/[eventId] - Update settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const supabase: SupabaseClient = await createServerSupabaseClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Use admin client to bypass RLS
    const adminClient: SupabaseClient = await createAdminClient()

    // Team member authorization
    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .single()
    if (!teamMember) {
      return NextResponse.json(
        { error: "Only team members can update settings" },
        { status: 403 }
      )
    }

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Validate numeric fields are positive integers
    const numericFields: { key: string; label: string }[] = [
      { key: "max_submissions_per_person", label: "Max submissions per person" },
      { key: "max_authors", label: "Max authors" },
      { key: "word_limit", label: "Word limit" },
      { key: "max_file_size_mb", label: "Max file size (MB)" },
      { key: "reviewers_per_abstract", label: "Reviewers per abstract" },
    ]
    for (const { key, label } of numericFields) {
      if (body[key] !== undefined && body[key] !== null) {
        const val = Number(body[key])
        if (!Number.isInteger(val) || val < 1) {
          return NextResponse.json(
            { error: `${label} must be a positive integer` },
            { status: 400 }
          )
        }
      }
    }

    // Validate date ordering
    const submissionOpensAt = body.submission_opens_at ? new Date(body.submission_opens_at) : null
    const submissionDeadline = body.submission_deadline ? new Date(body.submission_deadline) : null
    const revisionDeadline = body.revision_deadline ? new Date(body.revision_deadline) : null

    if (submissionOpensAt && submissionDeadline && submissionOpensAt >= submissionDeadline) {
      return NextResponse.json(
        { error: "Submission opening date must be before the submission deadline" },
        { status: 400 }
      )
    }
    if (submissionDeadline && revisionDeadline && submissionDeadline >= revisionDeadline) {
      return NextResponse.json(
        { error: "Submission deadline must be before the revision deadline" },
        { status: 400 }
      )
    }

    const payload: Record<string, any> = {
      event_id: eventId,
    }

    // Only include fields that are provided
    if (body.submission_opens_at !== undefined) payload.submission_opens_at = body.submission_opens_at
    if (body.submission_deadline !== undefined) payload.submission_deadline = body.submission_deadline
    if (body.revision_deadline !== undefined) payload.revision_deadline = body.revision_deadline
    if (body.notification_date !== undefined) payload.notification_date = body.notification_date
    if (body.max_submissions_per_person !== undefined) payload.max_submissions_per_person = body.max_submissions_per_person
    if (body.max_authors !== undefined) payload.max_authors = body.max_authors
    if (body.word_limit !== undefined) payload.word_limit = body.word_limit
    if (body.require_registration !== undefined) payload.require_registration = body.require_registration
    if (body.require_addon_id !== undefined) payload.require_addon_id = body.require_addon_id
    if (body.allowed_file_types !== undefined) payload.allowed_file_types = body.allowed_file_types
    if (body.max_file_size_mb !== undefined) payload.max_file_size_mb = body.max_file_size_mb
    if (body.presentation_types !== undefined) payload.presentation_types = body.presentation_types
    if (body.review_enabled !== undefined) payload.review_enabled = body.review_enabled
    if (body.reviewers_per_abstract !== undefined) payload.reviewers_per_abstract = body.reviewers_per_abstract
    if (body.blind_review !== undefined) payload.blind_review = body.blind_review
    if (body.submission_guidelines !== undefined) payload.submission_guidelines = body.submission_guidelines
    if (body.author_guidelines !== undefined) payload.author_guidelines = body.author_guidelines
    if (body.notify_on_submission !== undefined) payload.notify_on_submission = body.notify_on_submission
    if (body.notify_on_decision !== undefined) payload.notify_on_decision = body.notify_on_decision

    const { data, error } = await adminClient
      .from("abstract_settings")
      .upsert(payload, { onConflict: "event_id" })
      .select()
      .single()

    if (error) {
      console.error("Error saving abstract settings:", error)
      return NextResponse.json(
        { error: "Failed to save settings" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PUT /api/abstract-settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
