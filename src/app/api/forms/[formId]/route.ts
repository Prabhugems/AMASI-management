import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireFormAccess } from "@/lib/auth/api-auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// GET /api/forms/[formId] - Get a single form with fields
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params

    const { error: authError } = await requireFormAccess(formId)
    if (authError) return authError

    const supabase: SupabaseClient = await createServerSupabaseClient()

    const { data: form, error } = await supabase
      .from("forms")
      .select(`
        *,
        event:events(id, name, short_name),
        fields:form_fields(
          *
        ),
        sections:form_sections(
          *
        )
      `)
      .eq("id", formId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Form not found" },
          { status: 404 }
        )
      }
      console.error("Error fetching form:", error)
      return NextResponse.json(
        { error: "Failed to fetch form" },
        { status: 500 }
      )
    }

    // Sort fields by sort_order
    if (form.fields) {
      form.fields.sort((a: any, b: any) => a.sort_order - b.sort_order)
    }
    if (form.sections) {
      form.sections.sort((a: any, b: any) => a.sort_order - b.sort_order)
    }

    return NextResponse.json(form)
  } catch (error) {
    console.error("Error in GET /api/forms/[formId]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PATCH /api/forms/[formId] - Update a form
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params

    const { error: authError } = await requireFormAccess(formId)
    if (authError) return authError

    const body = await request.json()

    // Build update object with only provided fields
    const updates: Record<string, any> = {}
    const allowedFields = [
      "name", "description", "slug", "form_type", "event_id", "status",
      "is_public", "requires_auth", "allow_multiple_submissions",
      "is_member_form", "membership_required_strict",
      "submit_button_text", "success_message", "redirect_url",
      "logo_url", "header_image_url", "primary_color", "background_color",
      "notify_on_submission", "notification_emails",
      "max_submissions", "submission_deadline"
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS for form updates
    const adminClient: SupabaseClient = await createAdminClient()

    const { data: form, error } = await adminClient
      .from("forms")
      .update(updates)
      .eq("id", formId)
      .select()
      .single()

    if (error) {
      console.error("Error updating form:", error)
      console.error("Form ID:", formId)
      console.error("Updates:", JSON.stringify(updates))
      return NextResponse.json(
        { error: "Failed to update form" },
        { status: 500 }
      )
    }

    if (!form) {
      console.error("No form returned after update - form may not exist:", formId)
      return NextResponse.json(
        { error: "Form not found or update returned no data" },
        { status: 404 }
      )
    }

    return NextResponse.json(form)
  } catch (error) {
    console.error("Error in PATCH /api/forms/[formId]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/forms/[formId] - Delete a form
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params

    const { error: authError } = await requireFormAccess(formId)
    if (authError) return authError

    const adminClient: SupabaseClient = await createAdminClient()

    const { error } = await adminClient
      .from("forms")
      .delete()
      .eq("id", formId)

    if (error) {
      console.error("Error deleting form:", error)
      return NextResponse.json(
        { error: "Failed to delete form" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/forms/[formId]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
