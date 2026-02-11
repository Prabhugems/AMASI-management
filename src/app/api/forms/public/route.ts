import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// GET /api/forms/public?event_id=X&email=Y - List public forms for an event with submission status
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "public")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const email = searchParams.get("email")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch published public forms for this event
    const { data: forms, error } = await (supabase as any)
      .from("forms")
      .select("id, name, slug, description, form_type, status, release_certificate_on_submission, require_check_in_for_submission")
      .eq("event_id", eventId)
      .eq("status", "published")
      .eq("is_public", true)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching forms:", error)
      return NextResponse.json({ error: "Failed to fetch forms" }, { status: 500 })
    }

    // Check submission status for each form if email provided
    const formsWithStatus = await Promise.all(
      (forms || []).map(async (form: any) => {
        let submitted = false
        if (email) {
          const { data: submission } = await (supabase as any)
            .from("form_submissions")
            .select("id, submitted_at")
            .eq("form_id", form.id)
            .eq("submitter_email", email)
            .limit(1)
            .maybeSingle()

          submitted = !!submission
        }
        return { ...form, submitted }
      })
    )

    return NextResponse.json({ forms: formsWithStatus })
  } catch (error) {
    console.error("Error in GET /api/forms/public:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
