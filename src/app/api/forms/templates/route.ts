import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET /api/forms/templates - Get all form templates
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const category = searchParams.get("category")

    let query = supabase
      .from("form_templates")
      .select("*")
      .order("is_system", { ascending: false })
      .order("name", { ascending: true })

    if (category) {
      query = query.eq("category", category)
    }

    const { data: templates, error } = await query

    if (error) {
      console.error("Error fetching templates:", error)
      return NextResponse.json(
        { error: "Failed to fetch templates" },
        { status: 500 }
      )
    }

    return NextResponse.json(templates)
  } catch (error) {
    console.error("Error in GET /api/forms/templates:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
