import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// POST /api/forms/[formId]/publish - Publish a form
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params
    const supabase: SupabaseClient = await createServerSupabaseClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Verify form exists and has at least one field
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select(`
        id,
        name,
        status,
        form_fields(count)
      `)
      .eq("id", formId)
      .single()

    if (formError || !form) {
      return NextResponse.json(
        { error: "Form not found" },
        { status: 404 }
      )
    }

    const fieldCount = (form as any).form_fields?.[0]?.count || 0

    if (fieldCount === 0) {
      return NextResponse.json(
        { error: "Cannot publish a form without fields" },
        { status: 400 }
      )
    }

    // Update form status to published
    const { data: updatedForm, error } = await supabase
      .from("forms")
      .update({ status: "published" })
      .eq("id", formId)
      .select()
      .single()

    if (error) {
      console.error("Error publishing form:", error)
      return NextResponse.json(
        { error: "Failed to publish form" },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedForm)
  } catch (error) {
    console.error("Error in POST /api/forms/[formId]/publish:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/forms/[formId]/publish - Unpublish a form (set to draft)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params
    const supabase: SupabaseClient = await createServerSupabaseClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { data: form, error } = await supabase
      .from("forms")
      .update({ status: "draft" })
      .eq("id", formId)
      .select()
      .single()

    if (error) {
      console.error("Error unpublishing form:", error)
      return NextResponse.json(
        { error: "Failed to unpublish form" },
        { status: 500 }
      )
    }

    return NextResponse.json(form)
  } catch (error) {
    console.error("Error in DELETE /api/forms/[formId]/publish:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
