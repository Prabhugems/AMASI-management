import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { membershipApplicationSchema, formatZodError } from "@/lib/schemas"

// POST /api/membership/apply - Public endpoint for membership applications
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "public")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const body = await request.json()

    // Validate with Zod schema
    const result = membershipApplicationSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(formatZodError(result.error), { status: 400 })
    }

    const data = result.data
    const supabase = await createAdminClient()

    // Check for duplicate pending applications with same email
    const { data: existing } = await (supabase as any)
      .from("membership_applications")
      .select("id, status")
      .eq("email", data.email)
      .eq("status", "pending")
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: "An application with this email is already pending review." },
        { status: 409 }
      )
    }

    // Generate application number: APP-YYYYMMDD-XXXX
    const now = new Date()
    const dateStr = now.toISOString().split("T")[0].replace(/-/g, "")
    const random = Math.floor(1000 + Math.random() * 9000)
    const applicationNumber = `APP-${dateStr}-${random}`

    // Insert application
    const { data: application, error: insertError } = await (supabase as any)
      .from("membership_applications")
      .insert({
        name: data.name,
        father_name: data.father_name || null,
        date_of_birth: data.date_of_birth || null,
        nationality: data.nationality || "Indian",
        gender: data.gender || null,
        membership_type: data.membership_type || null,
        email: data.email,
        phone: data.phone || null,
        mobile_code: data.mobile_code || "+91",
        landline: data.landline || null,
        std_code: data.std_code || null,
        street_address_1: data.street_address_1 || null,
        street_address_2: data.street_address_2 || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || "India",
        postal_code: data.postal_code || null,
        ug_college: data.ug_college || null,
        ug_university: data.ug_university || null,
        ug_year: data.ug_year || null,
        pg_degree: data.pg_degree || null,
        pg_college: data.pg_college || null,
        pg_university: data.pg_university || null,
        pg_year: data.pg_year || null,
        mci_council_number: data.mci_council_number || null,
        mci_council_state: data.mci_council_state || null,
        imr_registration_no: data.imr_registration_no || null,
        asi_membership_no: data.asi_membership_no || null,
        asi_state: data.asi_state || null,
        other_intl_org: data.other_intl_org || null,
        other_intl_org_value: data.other_intl_org_value || null,
        status: "pending",
        application_number: applicationNumber,
      })
      .select("id, application_number")
      .single()

    if (insertError) {
      console.error("Error creating application:", insertError)
      return NextResponse.json(
        { error: "Failed to submit application. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      application_number: application.application_number,
      message: "Your membership application has been submitted successfully.",
    })
  } catch (error: any) {
    console.error("Error in POST /api/membership/apply:", error)
    return NextResponse.json(
      { error: "Failed to process application" },
      { status: 500 }
    )
  }
}
