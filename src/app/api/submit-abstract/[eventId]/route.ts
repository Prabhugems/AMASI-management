import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { claimIdempotency } from "@/lib/idempotency"
import { sendAndLogAbstractNotification } from "@/lib/abstracts/notify"
import { buildAbstractVariables } from "@/lib/email-templates"
import { isEmailEnabled } from "@/lib/email"

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

  // File attachment — file_path is the Supabase Storage object path in the
  // private abstract-files bucket. Never a public URL.
  file_path?: string
  file_name?: string
  file_size?: number

  // Video URL (alternative to file)
  video_url?: string
  video_platform?: string // youtube, vimeo, google_drive, dropbox

  // Membership & declarations
  amasi_membership_number?: string
  submitter_metadata?: {
    date_of_birth?: string
    current_position?: string
  }
  declarations_accepted: boolean

  // Optional registration link
  registration_id?: string

  // Revision mode
  is_revision?: boolean
  revision_of?: string // Original abstract ID being revised
}

// POST /api/submit-abstract/[eventId] - Submit a new abstract
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    // Public endpoint — rate limit before doing any work
    const ip = getClientIp(request)
    const rl = checkRateLimit(ip, "public")
    if (!rl.success) return rateLimitExceededResponse(rl)

    const { eventId } = await params
    const body: SubmissionData = await request.json()
    const idemKey = request.headers.get("idempotency-key")
    const idemEndpoint = `submit-abstract:${eventId}`

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

    if (
      !Array.isArray(body.declarations_accepted) ||
      body.declarations_accepted.length === 0
    ) {
      return NextResponse.json(
        { error: "You must accept the declarations to submit" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Verify event exists and abstracts are enabled. The extra columns
    // (short_name, start_date, city, contact_email) feed the confirmation
    // email template variables — fetched here so we don't re-query later.
    const { data: event, error: eventError } = await (supabase as any)
      .from("events")
      .select("id, name, status, short_name, start_date, city, contact_email")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Module enablement: events can disable the abstracts module entirely
    // without dropping abstract_settings/categories rows.
    const { data: eventSettings } = await (supabase as any)
      .from("event_settings")
      .select("enable_abstracts")
      .eq("event_id", eventId)
      .maybeSingle()
    if (eventSettings && eventSettings.enable_abstracts === false) {
      return NextResponse.json(
        { error: "Abstract submission is disabled for this event" },
        { status: 400 }
      )
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

    // COI declaration: when required, the declarations array must contain an
    // entry whose text references conflict of interest. The wizard renders the
    // matching checkbox conditionally on settings.require_coi_declaration.
    if (settings.require_coi_declaration) {
      const hasCoi = (body.declarations_accepted as unknown as string[]).some(
        (d) => typeof d === "string" && /conflict of interest/i.test(d)
      )
      if (!hasCoi) {
        return NextResponse.json(
          { error: "A conflict-of-interest declaration is required for this event" },
          { status: 400 }
        )
      }
    }

    // Verify category exists (and pull category-level rules used below)
    const { data: category } = await (supabase as any)
      .from("abstract_categories")
      .select("id, name, required_file, eligibility_rules")
      .eq("id", body.category_id)
      .eq("event_id", eventId)
      .eq("is_active", true)
      .single()

    if (!category) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }

    // Category-level: a file is mandatory for some tracks (e.g. Best videos,
    // Young Scholar manuscripts). file_path is the canonical storage pointer;
    // file_url is the legacy fallback for pre-Phase-A rows / admin imports.
    if (category.required_file && !body.file_path) {
      return NextResponse.json(
        { error: `A file upload is required for the '${category.name}' category` },
        { status: 400 }
      )
    }

    // Category-level eligibility (currently used by Young Scholar Award tracks).
    // Rule shape: { max_age?: number, require_dob?: boolean, allowed_positions?: string[] }
    // Eligibility data lives in body.submitter_metadata; the wizard collects
    // these fields only when the rule requires them (admin path always allowed).
    if (category.eligibility_rules) {
      const rules = category.eligibility_rules as {
        max_age?: number
        require_dob?: boolean
        allowed_positions?: string[]
      }
      const meta = (body as unknown as { submitter_metadata?: { date_of_birth?: string; current_position?: string } })
        .submitter_metadata
      if (rules.require_dob && !meta?.date_of_birth) {
        return NextResponse.json(
          { error: `Date of birth is required for the '${category.name}' category` },
          { status: 400 }
        )
      }
      if (typeof rules.max_age === "number" && meta?.date_of_birth) {
        const dob = new Date(meta.date_of_birth)
        if (!isNaN(dob.getTime())) {
          const ageMs = Date.now() - dob.getTime()
          const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000)
          if (ageYears > rules.max_age) {
            return NextResponse.json(
              { error: `The '${category.name}' category is restricted to authors aged ${rules.max_age} or under` },
              { status: 400 }
            )
          }
        }
      }
      if (Array.isArray(rules.allowed_positions) && rules.allowed_positions.length > 0) {
        if (!meta?.current_position || !rules.allowed_positions.includes(meta.current_position)) {
          return NextResponse.json(
            { error: `The '${category.name}' category is restricted to: ${rules.allowed_positions.join(", ")}` },
            { status: 400 }
          )
        }
      }
    }

    // Handle revision submissions
    if (body.is_revision && body.revision_of) {
      // Get the original abstract
      const { data: originalAbstract, error: origError } = await (supabase as any)
        .from("abstracts")
        .select("id, abstract_number, status, presenting_author_email")
        .eq("id", body.revision_of)
        .eq("event_id", eventId)
        .single()

      if (origError || !originalAbstract) {
        return NextResponse.json({ error: "Original abstract not found" }, { status: 404 })
      }

      // Verify author owns this abstract
      if (originalAbstract.presenting_author_email.toLowerCase() !== body.presenting_author_email.toLowerCase()) {
        return NextResponse.json({ error: "You are not authorized to revise this abstract" }, { status: 403 })
      }

      // Verify abstract is in revision_requested status
      if (originalAbstract.status !== "revision_requested") {
        return NextResponse.json({ error: "This abstract is not awaiting revision" }, { status: 400 })
      }

      // Idempotency: claim a slot after revision-specific validations and
      // before the UPDATE. Critical here because revision_count is incremented
      // — a double-click would otherwise double-bump it.
      const revisionClaim = await claimIdempotency(idemEndpoint, idemKey, body)
      if (revisionClaim.kind === "cached") {
        return NextResponse.json(revisionClaim.body, { status: revisionClaim.status })
      }
      if (revisionClaim.kind === "in_progress") {
        return NextResponse.json(
          { error: "A revision with this Idempotency-Key is already being processed" },
          { status: 409 }
        )
      }
      if (revisionClaim.kind === "key_conflict") {
        return NextResponse.json(
          { error: "This Idempotency-Key was used for a different request body" },
          { status: 422 }
        )
      }

      // Update the existing abstract
      const { data: updatedAbstract, error: updateError } = await (supabase as any)
        .from("abstracts")
        .update({
          title: body.title.trim(),
          abstract_text: body.abstract_text.trim(),
          keywords: body.keywords || [],
          category_id: body.category_id,
          presentation_type: body.presentation_type,
          award_type: body.competition_type || 'free',
          presenting_author_name: body.presenting_author_name.trim(),
          presenting_author_phone: body.presenting_author_phone,
          presenting_author_affiliation: body.presenting_author_affiliation,
          file_path: body.file_path || originalAbstract.file_path,
          file_name: body.file_name || originalAbstract.file_name,
          submitter_metadata: body.submitter_metadata ?? null,
          status: "submitted", // Reset to submitted for re-review
          revision_count: (originalAbstract.revision_count || 0) + 1,
        })
        .eq("id", body.revision_of)
        .select()
        .single()

      if (updateError) {
        console.error("Error updating abstract:", updateError)
        await revisionClaim.release()
        return NextResponse.json({ error: "Failed to submit revision" }, { status: 500 })
      }

      // Update co-authors: delete old ones and insert new ones
      await (supabase as any)
        .from("abstract_authors")
        .delete()
        .eq("abstract_id", body.revision_of)

      if (body.authors && body.authors.length > 0) {
        const authorInserts = body.authors.map((author, index) => ({
          abstract_id: body.revision_of,
          author_order: index + 2,
          name: author.name.trim(),
          email: author.email?.toLowerCase().trim() || null,
          affiliation: author.affiliation || null,
          is_presenting: author.is_presenting || false,
        }))

        authorInserts.unshift({
          abstract_id: body.revision_of,
          author_order: 1,
          name: body.presenting_author_name.trim(),
          email: body.presenting_author_email.toLowerCase().trim(),
          affiliation: body.presenting_author_affiliation || null,
          is_presenting: true,
        })

        await (supabase as any)
          .from("abstract_authors")
          .insert(authorInserts)
      }

      // Sync-send revision-confirmation. Phase 3 incident fix: prior to
      // this, the row was inserted but no email was sent. Failure here
      // does NOT roll back the revision write — same wrapping rule as
      // committee-decision.
      let revisionNotification: { delivered: boolean; error?: string } = { delivered: false }
      if (settings.notify_on_submission && isEmailEnabled()) {
        const portalUrl = `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}/my`
        const variables = buildAbstractVariables(
          {
            abstract_number: originalAbstract.abstract_number,
            title: body.title,
            status: updatedAbstract.status,
            presenting_author_name: body.presenting_author_name,
            presenting_author_email: body.presenting_author_email,
            category_name: category.name,
          },
          {
            name: event.name,
            short_name: event.short_name ?? null,
            start_date: event.start_date ?? null,
            city: event.city ?? null,
          },
          portalUrl,
          event.contact_email ?? null
        )
        const fallbackHtml = buildSubmissionFallbackHtml({
          authorName: body.presenting_author_name,
          eventName: event.short_name || event.name,
          abstractNumber: originalAbstract.abstract_number,
          title: body.title,
          kind: "revision",
          portalUrl,
        })
        revisionNotification = await sendAndLogAbstractNotification({
          supabase,
          abstractId: body.revision_of,
          eventId,
          recipientEmail: body.presenting_author_email,
          recipientName: body.presenting_author_name,
          templateType: "abstract_revision_submitted",
          notificationType: "revision_submitted",
          templateVariables: variables,
          fallbackSubject: `Revision Submitted: ${originalAbstract.abstract_number}`,
          fallbackHtml,
          metadata: {
            abstract_number: originalAbstract.abstract_number,
            title: body.title,
            category: category.name,
            event_name: event.name,
          },
        })
      }

      const revisionBody = {
        success: true,
        abstract: {
          id: updatedAbstract.id,
          abstract_number: originalAbstract.abstract_number,
          title: updatedAbstract.title,
          status: updatedAbstract.status,
        },
        notification: {
          delivered: revisionNotification.delivered,
          error: revisionNotification.error,
        },
        message: "Revision submitted successfully",
      }
      await revisionClaim.commit(200, revisionBody)
      return NextResponse.json(revisionBody)
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

    // Idempotency: claim a slot after all validations and right before the
    // write. The leader inserts; followers either see the cached response or
    // are told the leader is still in-flight.
    const claim = await claimIdempotency(idemEndpoint, idemKey, body)
    if (claim.kind === "cached") {
      return NextResponse.json(claim.body, { status: claim.status })
    }
    if (claim.kind === "in_progress") {
      return NextResponse.json(
        { error: "A submission with this Idempotency-Key is already being processed" },
        { status: 409 }
      )
    }
    if (claim.kind === "key_conflict") {
      return NextResponse.json(
        { error: "This Idempotency-Key was used for a different request body" },
        { status: 422 }
      )
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
        file_path: body.file_path,
        file_name: body.file_name,
        file_size: body.file_size,
        amasi_membership_number: body.amasi_membership_number,
        submitter_metadata: body.submitter_metadata ?? null,
        declarations_accepted: body.declarations_accepted,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (createError) {
      console.error("Error creating abstract:", createError)
      // Release the idempotency slot so the caller can retry cleanly
      await claim.release()
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

    // Sync-send submission confirmation. Phase 3 incident fix: this was
    // the production defect — the row was being inserted (when settings
    // allowed) but no email was sent. Authors submitting to AMASICON were
    // getting a "we'll confirm by email" intent record and no confirmation.
    // Failure here does NOT roll back the abstract create.
    let submissionNotification: { delivered: boolean; error?: string } = { delivered: false }
    if (settings.notify_on_submission && isEmailEnabled()) {
      const portalUrl = `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}/my`
      const variables = buildAbstractVariables(
        {
          abstract_number: abstractNumber,
          title: body.title,
          status: abstract.status,
          presenting_author_name: body.presenting_author_name,
          presenting_author_email: body.presenting_author_email,
          category_name: category.name,
        },
        {
          name: event.name,
          short_name: event.short_name ?? null,
          start_date: event.start_date ?? null,
          city: event.city ?? null,
        },
        portalUrl,
        event.contact_email ?? null
      )
      const fallbackHtml = buildSubmissionFallbackHtml({
        authorName: body.presenting_author_name,
        eventName: event.short_name || event.name,
        abstractNumber,
        title: body.title,
        kind: "submission",
        portalUrl,
      })
      submissionNotification = await sendAndLogAbstractNotification({
        supabase,
        abstractId: abstract.id,
        eventId,
        recipientEmail: body.presenting_author_email,
        recipientName: body.presenting_author_name,
        templateType: "abstract_submission_confirmation",
        notificationType: "submission_confirmation",
        templateVariables: variables,
        fallbackSubject: `Abstract Submitted: ${abstractNumber}`,
        fallbackHtml,
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

    const successBody = {
      success: true,
      abstract: {
        id: abstract.id,
        abstract_number: abstractNumber,
        title: abstract.title,
        status: abstract.status,
      },
      notification: {
        delivered: submissionNotification.delivered,
        error: submissionNotification.error,
      },
      message: "Abstract submitted successfully",
    }
    // Cache the response keyed by the Idempotency-Key so the next request
    // with the same key returns this exact body.
    await claim.commit(200, successBody)
    return NextResponse.json(successBody)
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
      .select("id, name, short_name, start_date, end_date, venue_name, city")
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

    // Get categories — eligibility_rules and required_file feed the wizard's
    // conditional fields and client-side pre-validation. The server still
    // re-enforces both on submit (C.4); this is just the friendly pre-check.
    const { data: categories } = await (supabase as any)
      .from("abstract_categories")
      .select("id, name, description, scoring_criteria, is_award_category, award_name, eligibility_rules, required_file")
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
        venue: event.venue_name,
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

// Helper function to generate abstract number. Uses MAX(existing_number)+1
// rather than COUNT+1 so deleted abstracts don't leave a gap that would
// cause the next insert to collide with an earlier abstract.
async function generateAbstractNumber(supabase: ReturnType<typeof createAdminClient> extends Promise<infer T> ? T : never, eventId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ABS-${year}-`

  // The unique constraint on abstract_number is GLOBAL, not per-event, so we
  // must look across all events. Per-event prefixing belongs in Phase B work
  // alongside an `UNIQUE(event_id, abstract_number)` migration.
  const { data: existing } = await (supabase as any)
    .from("abstracts")
    .select("abstract_number")
    .ilike("abstract_number", `${prefix}%`)

  let maxNumber = 0
  for (const row of (existing || []) as Array<{ abstract_number: string | null }>) {
    const match = row.abstract_number?.match(/(\d+)$/)
    if (!match) continue
    const n = parseInt(match[1], 10)
    if (!isNaN(n) && n > maxNumber) maxNumber = n
  }

  const nextNumber = maxNumber + 1
  return `${prefix}${nextNumber.toString().padStart(3, "0")}`
}

// Fallback HTML used by the submission/revision confirmation emails when
// no event-scoped template is configured. Simple, defensive — the
// expected path is for the event admin to create a custom template later.
function buildSubmissionFallbackHtml(input: {
  authorName: string
  eventName: string
  abstractNumber: string
  title: string
  kind: "submission" | "revision"
  portalUrl: string
}): string {
  const isRevision = input.kind === "revision"
  const heading = isRevision
    ? `Your revision has been received.`
    : `Thank you for submitting your abstract.`
  const tail = isRevision
    ? `Your revision is now under review. We'll notify you when a decision is made.`
    : `Your abstract is now under review. We'll notify you when a decision is made.`
  return `<!doctype html><html><body style="font-family:-apple-system,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:20px">
    <h2>${escapeSubmissionHtml(input.eventName)}</h2>
    <p>Dear ${escapeSubmissionHtml(input.authorName)},</p>
    <p>${heading}</p>
    <p><strong>${escapeSubmissionHtml(input.abstractNumber)}</strong> — ${escapeSubmissionHtml(input.title)}</p>
    <p>${tail}</p>
    <p><a href="${escapeSubmissionHtml(input.portalUrl)}">View your submissions</a></p>
    <p style="color:#6b7280;font-size:13px">— The ${escapeSubmissionHtml(input.eventName)} Organizing Committee</p>
  </body></html>`
}

function escapeSubmissionHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
