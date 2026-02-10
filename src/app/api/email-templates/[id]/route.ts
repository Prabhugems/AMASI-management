import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// GET - Get single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { id } = await params

  try {
    const { data, error } = await (supabase as any)
      .from("email_templates")
      .select("*")
      .eq("id", id)
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error fetching email template:", error)
    return NextResponse.json({ error: "Failed to process email template request" }, { status: 500 })
  }
}

// PUT - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { id } = await params

  try {
    const body = await request.json()
    const {
      name,
      description,
      subject,
      body_html,
      body_text,
      variables_available,
      is_active,
      is_default,
    } = body

    // Get existing template to check event_id and category
    const { data: existing } = await (supabase as any)
      .from("email_templates")
      .select("event_id, category")
      .eq("id", id)
      .maybeSingle()

    // If setting as default, unset other defaults for this category
    if (is_default && existing?.event_id) {
      await (supabase as any)
        .from("email_templates")
        .update({ is_default: false })
        .eq("event_id", existing.event_id)
        .eq("category", existing.category)
        .neq("id", id)
    }

    const { data, error } = await (supabase as any)
      .from("email_templates")
      .update({
        name,
        description,
        subject,
        body_html,
        body_text,
        variables_available,
        is_active,
        is_default,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error updating email template:", error)
    return NextResponse.json({ error: "Failed to process email template request" }, { status: 500 })
  }
}

// DELETE - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { id } = await params

  try {
    // Don't allow deleting global default templates
    const { data: template } = await (supabase as any)
      .from("email_templates")
      .select("event_id, is_default")
      .eq("id", id)
      .maybeSingle()

    if (!template?.event_id && template?.is_default) {
      return NextResponse.json(
        { error: "Cannot delete global default templates" },
        { status: 400 }
      )
    }

    const { error } = await (supabase as any)
      .from("email_templates")
      .delete()
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting email template:", error)
    return NextResponse.json({ error: "Failed to process email template request" }, { status: 500 })
  }
}
