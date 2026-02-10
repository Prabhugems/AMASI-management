import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ABSTRACT_NUMBER_RETRIES = 3

// GET /api/abstracts - List abstracts with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const status = searchParams.get("status")
    const categoryId = searchParams.get("category_id")
    const presentationType = searchParams.get("presentation_type")
    const search = searchParams.get("search")
    const email = searchParams.get("email") // For delegate portal - get their abstracts

    if (!eventId) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      )
    }

    // Auth check: allow authenticated team members to list all abstracts,
    // or allow public access only when filtered by email (delegate portal).
    const supabase: SupabaseClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    let isTeamMember = false

    if (user && !authError) {
      const adminClient: SupabaseClient = await createAdminClient()
      const { data: teamMember } = await adminClient
        .from("team_members")
        .select("id, name, email, role")
        .eq("email", user.email?.toLowerCase())
        .eq("is_active", true)
        .maybeSingle()

      if (teamMember) {
        isTeamMember = true
      }
    }

    // If not a team member, require email filter (delegate portal use case)
    if (!isTeamMember && !email) {
      return NextResponse.json(
        { error: "Authentication required, or provide email filter for delegate portal access" },
        { status: 401 }
      )
    }

    const queryClient: SupabaseClient = await createServerSupabaseClient()

    let query = queryClient
      .from("abstracts")
      .select(`
        *,
        category:abstract_categories(id, name),
        authors:abstract_authors(id, name, email, affiliation, author_order, is_presenting),
        reviews:abstract_reviews(id, overall_score, recommendation, reviewer_name, reviewed_at)
      `)
      .eq("event_id", eventId)
      .order("submitted_at", { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq("status", status)
    }
    if (categoryId) {
      query = query.eq("category_id", categoryId)
    }
    if (presentationType) {
      query = query.eq("presentation_type", presentationType)
    }
    if (email) {
      query = query.eq("presenting_author_email", email.toLowerCase())
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,abstract_number.ilike.%${search}%,presenting_author_name.ilike.%${search}%,presenting_author_email.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching abstracts:", error)
      return NextResponse.json(
        { error: "Failed to fetch abstracts" },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error in GET /api/abstracts:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/abstracts - Submit a new abstract
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }
    if (!body.title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }
    if (!body.abstract_text) {
      return NextResponse.json({ error: "abstract_text is required" }, { status: 400 })
    }
    if (!body.presenting_author_name) {
      return NextResponse.json({ error: "presenting_author_name is required" }, { status: 400 })
    }
    if (!body.presenting_author_email) {
      return NextResponse.json({ error: "presenting_author_email is required" }, { status: 400 })
    }

    // Validate email format
    if (!EMAIL_REGEX.test(body.presenting_author_email)) {
      return NextResponse.json(
        { error: "Invalid email format for presenting_author_email" },
        { status: 400 }
      )
    }

    const adminClient: SupabaseClient = await createAdminClient()

    // Get abstract settings
    const { data: settings } = await adminClient
      .from("abstract_settings")
      .select("*")
      .eq("event_id", body.event_id)
      .single()

    // Check if submissions are open
    if (settings?.submission_opens_at) {
      const opensAt = new Date(settings.submission_opens_at)
      if (new Date() < opensAt) {
        return NextResponse.json(
          { error: "Abstract submissions are not open yet" },
          { status: 400 }
        )
      }
    }

    // Check deadline
    if (settings?.submission_deadline) {
      const deadline = new Date(settings.submission_deadline)
      if (new Date() > deadline) {
        return NextResponse.json(
          { error: "Abstract submission deadline has passed" },
          { status: 400 }
        )
      }
    }

    // Check word limit
    if (settings?.word_limit) {
      const wordCount = body.abstract_text.trim().split(/\s+/).length
      if (wordCount > settings.word_limit) {
        return NextResponse.json(
          { error: `Abstract exceeds word limit of ${settings.word_limit} words` },
          { status: 400 }
        )
      }
    }

    // Check max submissions per person
    if (settings?.max_submissions_per_person) {
      const { count } = await adminClient
        .from("abstracts")
        .select("*", { count: "exact", head: true })
        .eq("event_id", body.event_id)
        .eq("presenting_author_email", body.presenting_author_email.toLowerCase())
        .neq("status", "withdrawn")

      if (count && count >= settings.max_submissions_per_person) {
        return NextResponse.json(
          { error: `You have reached the maximum of ${settings.max_submissions_per_person} submissions` },
          { status: 400 }
        )
      }
    }

    // Check if registration is required
    if (settings?.require_registration) {
      const { data: registration } = await adminClient
        .from("registrations")
        .select("id")
        .eq("event_id", body.event_id)
        .eq("attendee_email", body.presenting_author_email.toLowerCase())
        .eq("status", "confirmed")
        .maybeSingle()

      if (!registration) {
        return NextResponse.json(
          { error: "You must have a confirmed registration to submit an abstract" },
          { status: 400 }
        )
      }

      body.registration_id = registration.id
    }

    // Generate abstract number using DB function with retry loop to handle race conditions.
    // The DB function `generate_abstract_number` atomically generates unique numbers.
    let abstract = null
    let lastError = null

    for (let attempt = 0; attempt < MAX_ABSTRACT_NUMBER_RETRIES; attempt++) {
      const { data: numberResult, error: rpcError } = await adminClient.rpc(
        'generate_abstract_number',
        { p_event_id: body.event_id }
      )

      if (rpcError) {
        console.error(`Error generating abstract number (attempt ${attempt + 1}):`, rpcError)
        lastError = rpcError
        continue
      }

      const abstractNumber = numberResult as string

      // Create abstract
      const { data: insertedAbstract, error: insertError } = await adminClient
        .from("abstracts")
        .insert({
          event_id: body.event_id,
          registration_id: body.registration_id || null,
          category_id: body.category_id || null,
          abstract_number: abstractNumber,
          title: body.title,
          abstract_text: body.abstract_text,
          keywords: body.keywords || [],
          presentation_type: body.presentation_type || "either",
          presenting_author_name: body.presenting_author_name,
          presenting_author_email: body.presenting_author_email.toLowerCase(),
          presenting_author_affiliation: body.presenting_author_affiliation || null,
          presenting_author_phone: body.presenting_author_phone || null,
          status: "submitted",
          file_url: body.file_url || null,
          file_name: body.file_name || null,
          file_size: body.file_size || null,
        })
        .select()
        .single()

      if (insertError) {
        // Check for unique constraint violation on abstract_number — retry if so
        if (insertError.code === '23505' && insertError.message?.includes('abstract_number')) {
          console.warn(`Abstract number collision (attempt ${attempt + 1}), retrying...`)
          lastError = insertError
          continue
        }
        // Non-retryable insert error
        console.error("Error creating abstract:", insertError)
        return NextResponse.json(
          { error: "Failed to submit abstract" },
          { status: 500 }
        )
      }

      abstract = insertedAbstract
      break
    }

    if (!abstract) {
      console.error("Failed to create abstract after retries:", lastError)
      return NextResponse.json(
        { error: "Failed to submit abstract" },
        { status: 500 }
      )
    }

    // Add co-authors if provided, with error handling
    if (body.authors && body.authors.length > 0) {
      const authorInserts = body.authors.map((author: any, index: number) => ({
        abstract_id: abstract.id,
        author_order: index + 1,
        name: author.name,
        email: author.email || null,
        affiliation: author.affiliation || null,
        is_presenting: author.is_presenting || false,
      }))

      const { error: authorsError } = await adminClient
        .from("abstract_authors")
        .insert(authorInserts)

      if (authorsError) {
        // Log the error but still return the abstract — the core submission succeeded
        console.error(
          `Failed to insert authors for abstract ${abstract.id}:`,
          authorsError
        )
      }
    }

    return NextResponse.json(abstract)
  } catch (error) {
    console.error("Error in POST /api/abstracts:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
