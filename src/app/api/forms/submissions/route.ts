import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { requireEventAccess } from "@/lib/auth/api-auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// GET /api/forms/submissions - Get submissions (with form_id filter)
export async function GET(request: NextRequest) {
  try {
    const supabase: SupabaseClient = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const formId = searchParams.get("form_id")
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    if (!formId) {
      return NextResponse.json(
        { error: "form_id is required" },
        { status: 400 }
      )
    }

    // First, get the form to check event_id for authorization
    const { data: form } = await supabase
      .from("forms")
      .select("event_id")
      .eq("id", formId)
      .single()

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 })
    }

    // Check authorization via event access
    if (form.event_id) {
      const { error: authError } = await requireEventAccess(form.event_id)
      if (authError) return authError
    } else {
      // Form not linked to event - require admin
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    let query = supabase
      .from("form_submissions")
      .select("*", { count: "exact" })
      .eq("form_id", formId)
      .order("submitted_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq("status", status)
    }

    const { data: submissions, error, count } = await query

    if (error) {
      console.error("Error fetching submissions:", error)
      return NextResponse.json(
        { error: "Failed to fetch submissions" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: submissions,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error("Error in GET /api/forms/submissions:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/forms/submissions - Submit a form (public endpoint)
export async function POST(request: NextRequest) {
  // Rate limit
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "public")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const supabaseClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = supabaseClient as any

    const body = await request.json()
    const { form_id, responses, submitter_email, submitter_name, verified_emails } = body

    if (!form_id || !responses) {
      return NextResponse.json(
        { error: "form_id and responses are required" },
        { status: 400 }
      )
    }

    // Verify form exists and is published (no join — keep it simple)
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select("id, name, status, allow_multiple_submissions, max_submissions, submission_deadline, notify_on_submission, notification_emails, event_id, release_certificate_on_submission, auto_email_certificate, require_check_in_for_submission")
      .eq("id", form_id)
      .single()

    if (formError || !form) {
      return NextResponse.json(
        { error: `Form not found: ${formError?.message || "no data"}` },
        { status: 404 }
      )
    }

    if (form.status !== "published") {
      return NextResponse.json(
        { error: "This form is not accepting submissions" },
        { status: 400 }
      )
    }

    // Check submission deadline
    if (form.submission_deadline && new Date(form.submission_deadline) < new Date()) {
      return NextResponse.json(
        { error: "The submission deadline has passed" },
        { status: 400 }
      )
    }

    // Check max submissions
    if (form.max_submissions) {
      const { count } = await supabase
        .from("form_submissions")
        .select("*", { count: "exact", head: true })
        .eq("form_id", form_id)

      if ((count || 0) >= form.max_submissions) {
        return NextResponse.json(
          { error: "This form has reached its maximum number of submissions" },
          { status: 400 }
        )
      }
    }

    // Check for duplicate submissions
    if (!form.allow_multiple_submissions && submitter_email) {
      const { data: existing } = await supabase
        .from("form_submissions")
        .select("id")
        .eq("form_id", form_id)
        .eq("submitter_email", submitter_email)
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: "You have already submitted this form" },
          { status: 400 }
        )
      }
    }

    // Check-in gate: if form requires check-in, verify participant is checked in
    if (form.require_check_in_for_submission && form.event_id && submitter_email) {
      const { data: registration } = await supabase
        .from("registrations")
        .select("id, checked_in")
        .eq("event_id", form.event_id)
        .eq("attendee_email", submitter_email)
        .limit(1)
        .maybeSingle()

      if (!registration) {
        return NextResponse.json(
          { error: "No registration found for this email. Please register for the event first." },
          { status: 400 }
        )
      }

      if (!registration.checked_in) {
        return NextResponse.json(
          { error: "You must be checked in at the event to submit this form" },
          { status: 400 }
        )
      }
    }

    // Get client info
    const headersList = await headers()
    const clientIp = headersList.get("x-forwarded-for")?.split(",")[0]
      || headersList.get("x-real-ip")
      || "unknown"
    const userAgent = headersList.get("user-agent") || "unknown"

    // Build submission metadata
    const submissionMetadata: Record<string, unknown> = {
      verified_emails: verified_emails || {},
      submitted_at: new Date().toISOString(),
    }

    // Insert submission — just INSERT, no select back
    const { error: insertError } = await supabase
      .from("form_submissions")
      .insert({
        form_id,
        submitter_email: submitter_email || null,
        submitter_name: submitter_name || null,
        submitter_ip: clientIp,
        user_agent: userAgent,
        responses: {
          ...responses,
          _metadata: submissionMetadata,
        },
        status: "pending",
      })

    if (insertError) {
      console.error("Error creating submission:", insertError)
      return NextResponse.json(
        { error: `Failed to submit: ${insertError.message}` },
        { status: 500 }
      )
    }

    // Send notification emails if enabled (async, don't block response)
    if (form.notify_on_submission && form.notification_emails?.length > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collegeofmas.org.in"
      const notificationEmails = Array.isArray(form.notification_emails)
        ? form.notification_emails
        : [form.notification_emails]

      fetch(`${baseUrl}/api/email/form-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: form.id,
          form_name: form.name,
          submitter_name: submitter_name || "Anonymous",
          submitter_email: submitter_email || "Not provided",
          notification_emails: notificationEmails,
          responses,
        }),
      }).catch(() => {})
    }

    // Certificate release: if enabled, release certificate for the participant
    if (form.release_certificate_on_submission && form.event_id && submitter_email) {
      try {
        // Find registration by email + event_id
        const { data: registration } = await supabase
          .from("registrations")
          .select("id, attendee_email, certificate_url, custom_fields")
          .eq("event_id", form.event_id)
          .eq("attendee_email", submitter_email)
          .limit(1)
          .maybeSingle()

        if (registration) {
          // Mark certificate as released in custom_fields
          const customFields = registration.custom_fields || {}
          await supabase
            .from("registrations")
            .update({
              custom_fields: {
                ...customFields,
                certificate_released: true,
                certificate_released_at: new Date().toISOString(),
                certificate_released_via: "form_submission",
              },
            })
            .eq("id", registration.id)

          // Update the submission metadata to record certificate release
          // (best-effort: find and update the just-inserted submission)
          const { data: latestSubmission } = await supabase
            .from("form_submissions")
            .select("id, responses")
            .eq("form_id", form_id)
            .eq("submitter_email", submitter_email)
            .order("submitted_at", { ascending: false })
            .limit(1)
            .maybeSingle()

          if (latestSubmission) {
            const updatedResponses = {
              ...latestSubmission.responses,
              _metadata: {
                ...(latestSubmission.responses as any)?._metadata,
                certificate_released: true,
              },
            }
            await supabase
              .from("form_submissions")
              .update({ responses: updatedResponses })
              .eq("id", latestSubmission.id)
          }

          // Auto-email certificate if enabled
          if (form.auto_email_certificate && registration.id) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collegeofmas.org.in"
            fetch(`${baseUrl}/api/certificates/email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                registration_id: registration.id,
                event_id: form.event_id,
              }),
            }).catch((err) => {
              console.error("Failed to send certificate email:", err)
            })
          }
        }
      } catch (certError) {
        // Best-effort: don't fail the submission if certificate release fails
        console.error("Error releasing certificate on submission:", certError)
      }
    }

    return NextResponse.json({ success: true, status: "pending" }, { status: 201 })
  } catch (error: any) {
    console.error("Error in POST /api/forms/submissions:", error)
    return NextResponse.json(
      { error: "Submission failed" },
      { status: 500 }
    )
  }
}
