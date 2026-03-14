import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

interface Author {
  name: string
  email?: string
  affiliation?: string
  is_presenting: boolean
}

interface SubmissionData {
  // Presenting author
  presenting_author_name: string
  presenting_author_email: string
  presenting_author_phone?: string
  presenting_author_affiliation?: string

  // Abstract content
  title: string
  abstract_text: string
  keywords: string[]
  category_id: string // Actually speciality_id (Bariatric, Robotic, etc.)
  presentation_type: string // Category: paper, video, poster
  competition_type?: string // best (award competition) or free (certificate only)

  // Co-authors
  authors: Author[]

  // File attachment
  file_url?: string
  file_name?: string
  file_size?: number

  // Video URL (alternative to file)
  video_url?: string
  video_platform?: string // youtube, vimeo, google_drive, dropbox

  // Membership & declarations
  amasi_membership_number?: string
  declarations_accepted: boolean

  // Optional registration link
  registration_id?: string
}

// POST /api/submit-abstract/[eventId] - Submit a new abstract
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const body: SubmissionData = await request.json()

    // Validate required fields
    const requiredFields = [
      'presenting_author_name',
      'presenting_author_email',
      'title',
      'abstract_text',
      'category_id',
      'presentation_type',
    ]

    for (const field of requiredFields) {
      if (!body[field as keyof SubmissionData]) {
        return NextResponse.json(
          { error: `${field.replace(/_/g, ' ')} is required` },
          { status: 400 }
        )
      }
    }

    if (!body.declarations_accepted) {
      return NextResponse.json(
        { error: "You must accept the declarations to submit" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Verify event exists and abstracts are enabled
    const { data: event, error: eventError } = await (supabase as any)
      .from("events")
      .select("id, name, status")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Check abstract settings
    const { data: settings } = await (supabase as any)
      .from("abstract_settings")
      .select("*")
      .eq("event_id", eventId)
      .single()

    if (!settings) {
      return NextResponse.json(
        { error: "Abstract submission is not enabled for this event" },
        { status: 400 }
      )
    }

    // Check submission deadline
    if (settings.submission_deadline) {
      const deadline = new Date(settings.submission_deadline)
      if (new Date() > deadline) {
        return NextResponse.json(
          { error: "Submission deadline has passed" },
          { status: 400 }
        )
      }
    }

    // Check if submission is open
    if (settings.submission_opens_at) {
      const opensAt = new Date(settings.submission_opens_at)
      if (new Date() < opensAt) {
        return NextResponse.json(
          { error: "Abstract submission is not yet open" },
          { status: 400 }
        )
      }
    }

    // Check max submissions per person
    if (settings.max_submissions_per_person) {
      const { count } = await (supabase as any)
        .from("abstracts")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .ilike("presenting_author_email", body.presenting_author_email)
        .neq("status", "withdrawn")

      if (count && count >= settings.max_submissions_per_person) {
        return NextResponse.json(
          { error: `You have reached the maximum of ${settings.max_submissions_per_person} submissions` },
          { status: 400 }
        )
      }
    }

    // Check word limit
    if (settings.word_limit) {
      const wordCount = body.abstract_text.trim().split(/\s+/).length
      if (wordCount > settings.word_limit) {
        return NextResponse.json(
          { error: `Abstract exceeds word limit of ${settings.word_limit} words` },
          { status: 400 }
        )
      }
    }

    // Check max authors
    const totalAuthors = (body.authors?.length || 0) + 1 // +1 for presenting author
    if (settings.max_authors && totalAuthors > settings.max_authors) {
      return NextResponse.json(
        { error: `Maximum ${settings.max_authors} authors allowed` },
        { status: 400 }
      )
    }

    // Verify category exists
    const { data: category } = await (supabase as any)
      .from("abstract_categories")
      .select("id, name")
      .eq("id", body.category_id)
      .eq("event_id", eventId)
      .eq("is_active", true)
      .single()

    if (!category) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }

    // Check if registration is required
    let registrationId = body.registration_id
    if (settings.require_registration && !registrationId) {
      // Try to find registration by email
      const { data: registration } = await (supabase as any)
        .from("registrations")
        .select("id")
        .eq("event_id", eventId)
        .ilike("attendee_email", body.presenting_author_email)
        .eq("status", "confirmed")
        .maybeSingle()

      if (!registration) {
        return NextResponse.json(
          { error: "You must be registered for the event to submit an abstract" },
          { status: 400 }
        )
      }
      registrationId = registration.id
    }

    // Generate abstract number
    const abstractNumber = await generateAbstractNumber(supabase, eventId)

    // Create abstract
    const { data: abstract, error: createError } = await (supabase as any)
      .from("abstracts")
      .insert({
        event_id: eventId,
        registration_id: registrationId,
        category_id: body.category_id, // This is speciality_id
        abstract_number: abstractNumber,
        title: body.title.trim(),
        abstract_text: body.abstract_text.trim(),
        keywords: body.keywords || [],
        presentation_type: body.presentation_type, // paper, video, poster
        award_type: body.competition_type || 'free', // best or free (stored in existing award_type column)
        presenting_author_name: body.presenting_author_name.trim(),
        presenting_author_email: body.presenting_author_email.toLowerCase().trim(),
        presenting_author_phone: body.presenting_author_phone,
        presenting_author_affiliation: body.presenting_author_affiliation,
        file_url: body.file_url,
        file_name: body.file_name,
        file_size: body.file_size,
        video_url: body.video_url,
        video_platform: body.video_platform,
        amasi_membership_number: body.amasi_membership_number,
        declarations_accepted: body.declarations_accepted,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (createError) {
      console.error("Error creating abstract:", createError)
      return NextResponse.json(
        { error: "Failed to submit abstract" },
        { status: 500 }
      )
    }

    // Add co-authors
    if (body.authors && body.authors.length > 0) {
      const authorInserts = body.authors.map((author, index) => ({
        abstract_id: abstract.id,
        author_order: index + 2, // Presenting author is 1
        name: author.name.trim(),
        email: author.email?.toLowerCase().trim() || null,
        affiliation: author.affiliation || null,
        is_presenting: author.is_presenting || false,
      }))

      // Also add presenting author as first author
      authorInserts.unshift({
        abstract_id: abstract.id,
        author_order: 1,
        name: body.presenting_author_name.trim(),
        email: body.presenting_author_email.toLowerCase().trim(),
        affiliation: body.presenting_author_affiliation || null,
        is_presenting: true,
      })

      const { error: authorError } = await (supabase as any)
        .from("abstract_authors")
        .insert(authorInserts)

      if (authorError) {
        console.error("Error adding authors:", authorError)
      }
    }

    // Log notification
    if (settings.notify_on_submission) {
      await (supabase as any)
        .from("abstract_notifications")
        .insert({
          abstract_id: abstract.id,
          notification_type: "submission_confirmation",
          recipient_email: body.presenting_author_email,
          recipient_name: body.presenting_author_name,
          subject: `Abstract Submitted: ${abstractNumber}`,
          metadata: {
            abstract_number: abstractNumber,
            title: body.title,
            category: category.name,
            event_name: event.name,
          },
        })
    }

    // Delete any saved draft
    await (supabase as any)
      .from("abstract_drafts")
      .delete()
      .eq("event_id", eventId)
      .ilike("user_email", body.presenting_author_email)

    return NextResponse.json({
      success: true,
      abstract: {
        id: abstract.id,
        abstract_number: abstractNumber,
        title: abstract.title,
        status: abstract.status,
      },
      message: "Abstract submitted successfully",
    })
  } catch (error) {
    console.error("Error in abstract submission:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/submit-abstract/[eventId] - Get submission settings and categories
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")

    const supabase = await createAdminClient()

    // Get event
    const { data: event, error: eventError } = await (supabase as any)
      .from("events")
      .select("id, name, short_name, start_date, end_date, venue, city")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Get settings
    const { data: settings } = await (supabase as any)
      .from("abstract_settings")
      .select("*")
      .eq("event_id", eventId)
      .single()

    if (!settings) {
      return NextResponse.json(
        { error: "Abstract submission is not enabled" },
        { status: 400 }
      )
    }

    // Get categories
    const { data: categories } = await (supabase as any)
      .from("abstract_categories")
      .select("id, name, description, scoring_criteria, is_award_category, award_name")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("sort_order")

    // Check submission status
    const now = new Date()
    let submissionStatus = "open"
    let statusMessage = ""

    if (settings.submission_opens_at && now < new Date(settings.submission_opens_at)) {
      submissionStatus = "not_yet_open"
      statusMessage = `Submissions open on ${new Date(settings.submission_opens_at).toLocaleDateString()}`
    } else if (settings.submission_deadline && now > new Date(settings.submission_deadline)) {
      submissionStatus = "closed"
      statusMessage = "Submission deadline has passed"
    }

    // Check existing submissions if email provided
    let existingSubmissions = 0
    let savedDraft = null

    if (email) {
      const { count } = await (supabase as any)
        .from("abstracts")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .ilike("presenting_author_email", email)
        .neq("status", "withdrawn")

      existingSubmissions = count || 0

      // Get saved draft
      const { data: draft } = await (supabase as any)
        .from("abstract_drafts")
        .select("draft_data, last_saved_at")
        .eq("event_id", eventId)
        .ilike("user_email", email)
        .maybeSingle()

      savedDraft = draft
    }

    return NextResponse.json({
      event: {
        id: event.id,
        name: event.name,
        short_name: event.short_name,
        dates: `${event.start_date} - ${event.end_date}`,
        venue: event.venue,
        city: event.city,
      },
      settings: {
        submission_deadline: settings.submission_deadline,
        max_submissions_per_person: settings.max_submissions_per_person,
        max_authors: settings.max_authors,
        word_limit: settings.word_limit,
        require_registration: settings.require_registration,
        presentation_types: settings.presentation_types || ["oral", "poster"],
        allowed_file_types: settings.allowed_file_types || ["pdf"],
        max_file_size_mb: settings.max_file_size_mb || 5,
        submission_guidelines: settings.submission_guidelines,
        author_guidelines: settings.author_guidelines,
        allow_video_url: settings.allow_video_url || false,
        allowed_video_platforms: settings.allowed_video_platforms || ["youtube", "vimeo"],
      },
      categories: categories || [],
      submission_status: submissionStatus,
      status_message: statusMessage,
      existing_submissions: existingSubmissions,
      remaining_submissions: settings.max_submissions_per_person
        ? settings.max_submissions_per_person - existingSubmissions
        : null,
      saved_draft: savedDraft,
    })
  } catch (error) {
    console.error("Error fetching submission info:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Helper function to generate abstract number
async function generateAbstractNumber(supabase: ReturnType<typeof createAdminClient> extends Promise<infer T> ? T : never, eventId: string): Promise<string> {
  const year = new Date().getFullYear()

  // Get count of existing abstracts
  const { count } = await (supabase as any)
    .from("abstracts")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)

  const nextNumber = (count || 0) + 1
  return `ABS-${year}-${nextNumber.toString().padStart(3, "0")}`
}
