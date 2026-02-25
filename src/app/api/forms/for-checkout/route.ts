import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

/**
 * GET /api/forms/for-checkout?form_id=xxx
 * Public endpoint - no auth required.
 * Fetches a published form + its fields for the registration checkout flow.
 * Uses admin client to bypass RLS (the form is linked to a ticket type,
 * so it should always be accessible during checkout regardless of is_public).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const formId = searchParams.get("form_id")

  if (!formId) {
    return NextResponse.json({ error: "form_id is required" }, { status: 400 })
  }

  try {
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Fetch the form (must be published)
    const { data: form, error: formError } = await db
      .from("forms")
      .select("*")
      .eq("id", formId)
      .eq("status", "published")
      .maybeSingle()

    if (formError) {
      console.error("Error fetching form for checkout:", formError)
      return NextResponse.json({ error: "Failed to fetch form" }, { status: 500 })
    }

    if (!form) {
      return NextResponse.json({ form: null, fields: [] })
    }

    // Fetch form fields
    const { data: fields, error: fieldsError } = await db
      .from("form_fields")
      .select("*")
      .eq("form_id", formId)
      .order("sort_order", { ascending: true })

    if (fieldsError) {
      console.error("Error fetching form fields for checkout:", fieldsError)
      return NextResponse.json({ error: "Failed to fetch form fields" }, { status: 500 })
    }

    return NextResponse.json({ form, fields: fields || [] })
  } catch (error) {
    console.error("Error in GET /api/forms/for-checkout:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
