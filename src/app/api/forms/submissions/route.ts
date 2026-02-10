import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/server"
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
  // Rate limit: public tier for form submissions
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "public")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    // Use admin client to bypass RLS - anonymous users can't SELECT form_submissions
    // after inserting (no SELECT policy for anon), which causes .insert().select() to fail
    const supabase: SupabaseClient = await createAdminClient()
    const body = await request.json()

    const { form_id, responses, submitter_email, submitter_name, verified_emails } = body

    if (!form_id || !responses) {
      return NextResponse.json(
        { error: "form_id and responses are required" },
        { status: 400 }
      )
    }

    // Add email verification status to responses metadata
    const enhancedResponses = {
      ...responses,
      _metadata: {
        verified_emails: verified_emails || {},
        submitted_at: new Date().toISOString()
      }
    }

    // Verify form exists and is published
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select(`
        id,
        name,
        status,
        is_public,
        requires_auth,
        allow_multiple_submissions,
        max_submissions,
        submission_deadline,
        notify_on_submission,
        notification_emails,
        form_fields(*)
      `)
      .eq("id", form_id)
      .single()

    if (formError || !form) {
      return NextResponse.json(
        { error: "Form not found" },
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
        .single()

      if (existing) {
        return NextResponse.json(
          { error: "You have already submitted this form" },
          { status: 400 }
        )
      }
    }

    // Validate required fields
    const fields = (form as any).form_fields || []
    const missingRequired: string[] = []

    for (const field of fields) {
      if (field.is_required && !responses[field.id]) {
        missingRequired.push(field.label)
      }
    }

    if (missingRequired.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingRequired.join(", ")}` },
        { status: 400 }
      )
    }

    // Get client info
    const headersList = await headers()
    const forwardedFor = headersList.get("x-forwarded-for")
    const realIp = headersList.get("x-real-ip")
    const clientIp = forwardedFor?.split(",")[0] || realIp || "unknown"
    const userAgent = headersList.get("user-agent") || "unknown"

    // Create submission with enhanced responses (includes verification metadata)
    const submissionData = {
      form_id,
      submitter_email,
      submitter_name,
      submitter_ip: clientIp,
      user_agent: userAgent,
      responses: enhancedResponses,
      status: "pending",
    }

    const { data: submission, error } = await supabase
      .from("form_submissions")
      .insert(submissionData)
      .select()
      .single()

    if (error) {
      console.error("Error creating submission:", error)
      return NextResponse.json(
        { error: "Failed to submit form" },
        { status: 500 }
      )
    }

    // Send notification emails if enabled
    if (form.notify_on_submission && form.notification_emails?.length > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const notificationEmails = Array.isArray(form.notification_emails)
        ? form.notification_emails
        : [form.notification_emails]

      // Send notification asynchronously - don't block response
      fetch(`${baseUrl}/api/email/form-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: form.id,
          form_name: form.name,
          submission_id: submission.id,
          submitter_name: submitter_name || "Anonymous",
          submitter_email: submitter_email || "Not provided",
          notification_emails: notificationEmails,
          responses: enhancedResponses,
          submitted_at: submission.submitted_at,
        }),
      }).catch((err) => {
        console.error("Failed to send form notification email:", err)
      })
    }

    return NextResponse.json(submission, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/forms/submissions:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
