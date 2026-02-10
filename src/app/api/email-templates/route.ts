import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// GET - List email templates
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")
  const category = searchParams.get("category")

  try {
    let query = (supabase as any)
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: false })

    // Get event-specific templates OR global templates (event_id is NULL)
    if (eventId) {
      query = query.or(`event_id.eq.${eventId},event_id.is.null`)
    }

    if (category) {
      query = query.eq("category", category)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error("Error fetching email templates:", error)
    return NextResponse.json({ error: "Failed to process email template request" }, { status: 500 })
  }
}

// POST - Create new email template
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "authenticated")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  const supabase = await createServerSupabaseClient()

  try {
    const body = await request.json()
    const {
      event_id,
      name,
      category,
      slug,
      description,
      subject,
      body_html,
      body_text,
      variables_available,
      is_active = true,
      is_default = false,
    } = body

    // Validate required fields
    if (!name || !category || !subject || !body_html) {
      return NextResponse.json(
        { error: "Missing required fields: name, category, subject, body_html" },
        { status: 400 }
      )
    }

    // Generate slug if not provided
    const templateSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    // If setting as default, unset other defaults for this category
    if (is_default && event_id) {
      await (supabase as any)
        .from("email_templates")
        .update({ is_default: false })
        .eq("event_id", event_id)
        .eq("category", category)
    }

    const { data, error } = await (supabase as any)
      .from("email_templates")
      .insert({
        event_id,
        name,
        slug: templateSlug,
        category,
        description,
        subject,
        body_html,
        body_text,
        variables_available: variables_available || [],
        is_active,
        is_default,
        created_by: user?.id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error creating email template:", error)
    return NextResponse.json({ error: "Failed to process email template request" }, { status: 500 })
  }
}
