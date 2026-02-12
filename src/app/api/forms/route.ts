import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/auth/api-auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// GET /api/forms - List all forms
export async function GET(request: NextRequest) {
  try {
    const { user: _authUser, error: authError } = await getApiUser()
    if (authError) return authError

    const supabase: SupabaseClient = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    // Get optional filters
    const eventId = searchParams.get("event_id")
    const status = searchParams.get("status")
    const formType = searchParams.get("form_type")
    const search = searchParams.get("search")

    let query = supabase
      .from("forms")
      .select(`
        *,
        event:events(id, name, short_name),
        form_fields(count),
        form_submissions(count)
      `)
      .order("created_at", { ascending: false })

    // Apply filters
    if (eventId) {
      query = query.eq("event_id", eventId)
    }
    if (status) {
      query = query.eq("status", status)
    }
    if (formType) {
      query = query.eq("form_type", formType)
    }
    if (search) {
      // Sanitize search input to prevent injection
      const sanitizedSearch = search
        .replace(/[%_\\]/g, '\\$&') // Escape SQL wildcards
        .replace(/['"`;]/g, '') // Remove dangerous characters
        .substring(0, 100) // Limit length
      query = query.or(`name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`)
    }

    const { data: forms, error } = await query

    if (error) {
      console.error("Error fetching forms:", error)
      return NextResponse.json(
        { error: "Failed to fetch forms" },
        { status: 500 }
      )
    }

    // Transform count objects to numbers
    const transformedForms = forms?.map((form: any) => ({
      ...form,
      _count: {
        fields: form.form_fields?.[0]?.count || 0,
        submissions: form.form_submissions?.[0]?.count || 0,
      },
      form_fields: undefined,
      form_submissions: undefined,
    }))

    return NextResponse.json(transformedForms)
  } catch (error) {
    console.error("Error in GET /api/forms:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/forms - Create a new form
export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authErr } = await getApiUser()
    if (authErr) return authErr

    const supabase: SupabaseClient = await createServerSupabaseClient()
    const user = { id: authUser!.id, email: authUser!.email }

    const body = await request.json()

    // Generate slug if not provided
    let slug = body.slug
    if (!slug && body.name) {
      slug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")

      // Check if slug exists and append number if needed
      const { data: existing } = await supabase
        .from("forms")
        .select("slug")
        .eq("slug", slug)
        .maybeSingle()

      if (existing) {
        slug = `${slug}-${Date.now()}`
      }
    }

    // Validate event_id is a valid UUID if provided
    const eventId = body.event_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (eventId && !uuidRegex.test(eventId)) {
      return NextResponse.json(
        { error: "Invalid event_id format" },
        { status: 400 }
      )
    }

    const formData = {
      name: body.name,
      description: body.description,
      slug,
      form_type: body.form_type || "standalone",
      event_id: eventId || null,
      status: body.status || "draft",
      is_public: body.is_public ?? true,
      requires_auth: body.requires_auth ?? false,
      allow_multiple_submissions: body.allow_multiple_submissions ?? false,
      release_certificate_on_submission: body.release_certificate_on_submission ?? false,
      auto_email_certificate: body.auto_email_certificate ?? false,
      require_check_in_for_submission: body.require_check_in_for_submission ?? false,
      submit_button_text: body.submit_button_text || "Submit",
      success_message: body.success_message || "Thank you for your submission!",
      redirect_url: body.redirect_url,
      logo_url: body.logo_url,
      header_image_url: body.header_image_url,
      primary_color: body.primary_color || "#8B5CF6",
      background_color: body.background_color,
      notify_on_submission: body.notify_on_submission ?? true,
      notification_emails: body.notification_emails || [],
      max_submissions: body.max_submissions,
      submission_deadline: body.submission_deadline,
      created_by: user.id,
    }

    // Use admin client to bypass RLS for form creation
    const adminClient: SupabaseClient = await createAdminClient()

    const { data: form, error } = await adminClient
      .from("forms")
      .insert(formData)
      .select()
      .single()

    if (error) {
      console.error("Error creating form:", error)
      return NextResponse.json(
        { error: "Failed to create form" },
        { status: 500 }
      )
    }

    // If template fields were provided, create them
    if (body.template_fields && Array.isArray(body.template_fields)) {
      const fieldsToInsert = body.template_fields.map((field: any, index: number) => ({
        form_id: form.id,
        field_type: field.field_type,
        label: field.label,
        placeholder: field.placeholder,
        help_text: field.help_text,
        is_required: field.is_required ?? false,
        min_length: field.min_length,
        max_length: field.max_length,
        min_value: field.min_value,
        max_value: field.max_value,
        pattern: field.pattern,
        options: field.options,
        conditional_logic: field.conditional_logic,
        sort_order: index,
        width: field.width || "full",
        settings: field.settings,
      }))

      const { error: fieldsError } = await adminClient
        .from("form_fields")
        .insert(fieldsToInsert)

      if (fieldsError) {
        console.error("Error creating form fields:", fieldsError)
        // Don't fail the whole request, form is created
      }
    }

    return NextResponse.json(form, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/forms:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
