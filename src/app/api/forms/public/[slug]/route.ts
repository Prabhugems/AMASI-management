import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase: SupabaseClient = await createServerSupabaseClient()
    const { slug } = await params

    // Fetch form by slug
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()

    if (formError || !form) {
      return NextResponse.json(
        { error: "Form not found or not published" },
        { status: 404 }
      )
    }

    // Check if form is public
    if (!form.is_public) {
      return NextResponse.json(
        { error: "This form is not public" },
        { status: 403 }
      )
    }

    // Fetch form fields
    const { data: fields, error: fieldsError } = await supabase
      .from("form_fields")
      .select("*")
      .eq("form_id", form.id)
      .order("sort_order", { ascending: true })

    if (fieldsError) {
      console.error("Error fetching fields:", fieldsError)
    }

    // Get submission count if max_submissions is set
    let submissionCount = 0
    if (form.max_submissions) {
      const { count } = await supabase
        .from("form_submissions")
        .select("*", { count: "exact", head: true })
        .eq("form_id", form.id)

      submissionCount = count || 0
    }

    return NextResponse.json({
      form,
      fields: fields || [],
      submissionCount,
    })
  } catch (error) {
    console.error("Error fetching public form:", error)
    return NextResponse.json(
      { error: "Failed to fetch form" },
      { status: 500 }
    )
  }
}
