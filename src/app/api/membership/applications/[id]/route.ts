import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// GET /api/membership/applications/[id] - Get application detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "authenticated")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createAdminClient()

    const { data, error } = await (supabase as any)
      .from("membership_applications")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error in GET /api/membership/applications/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/membership/applications/[id] - Approve or reject application
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "authenticated")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, amasi_number, review_notes } = body

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get the application
    const { data: application, error: fetchError } = await (supabase as any)
      .from("membership_applications")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError || !application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    if (application.status !== "pending") {
      return NextResponse.json({ error: "Application already processed" }, { status: 400 })
    }

    if (action === "approve") {
      if (!amasi_number) {
        return NextResponse.json({ error: "AMASI number is required for approval" }, { status: 400 })
      }

      // Check if AMASI number already exists
      const { data: existingMember } = await (supabase as any)
        .from("members")
        .select("id")
        .eq("amasi_number", amasi_number)
        .maybeSingle()

      if (existingMember) {
        return NextResponse.json({ error: "This AMASI number is already assigned" }, { status: 409 })
      }

      // Determine voting eligibility
      const isLifeMember = application.membership_type?.includes("Life Member [LM]")

      // Create member record
      const { data: member, error: memberError } = await (supabase as any)
        .from("members")
        .insert({
          amasi_number: parseInt(amasi_number),
          name: application.name,
          email: application.email,
          phone: application.phone ? parseInt(String(application.phone).replace(/\D/g, "")) || null : null,
          membership_type: application.membership_type,
          status: "active",
          voting_eligible: isLifeMember || false,
          father_name: application.father_name,
          date_of_birth: application.date_of_birth,
          nationality: application.nationality,
          gender: application.gender,
          application_no: application.application_number,
          application_date: new Date().toISOString().split("T")[0],
          mobile_code: application.mobile_code,
          landline: application.landline,
          std_code: application.std_code,
          street_address_1: application.street_address_1,
          street_address_2: application.street_address_2,
          city: application.city,
          state: application.state,
          country: application.country,
          postal_code: application.postal_code,
          ug_college: application.ug_college,
          ug_university: application.ug_university,
          ug_year: application.ug_year,
          pg_degree: application.pg_degree,
          pg_college: application.pg_college,
          pg_university: application.pg_university,
          pg_year: application.pg_year,
          mci_council_number: application.mci_council_number,
          mci_council_state: application.mci_council_state,
          imr_registration_no: application.imr_registration_no,
          asi_membership_no: application.asi_membership_no,
          asi_state: application.asi_state,
          other_intl_org: application.other_intl_org,
          other_intl_org_value: application.other_intl_org_value,
        })
        .select("id")
        .single()

      if (memberError) {
        console.error("Error creating member:", memberError)
        return NextResponse.json({ error: "Failed to create member record" }, { status: 500 })
      }

      // Update application status
      const { error: updateError } = await (supabase as any)
        .from("membership_applications")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: review_notes || null,
          assigned_amasi_number: parseInt(amasi_number),
          member_id: member.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (updateError) {
        console.error("Error updating application:", updateError)
        return NextResponse.json({ error: "Failed to update application" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Application approved. Member created with AMASI #${amasi_number}`,
        member_id: member.id,
      })
    }

    // Reject
    const { error: rejectError } = await (supabase as any)
      .from("membership_applications")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: review_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (rejectError) {
      console.error("Error rejecting application:", rejectError)
      return NextResponse.json({ error: "Failed to reject application" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Application rejected",
    })
  } catch (error: any) {
    console.error("Error in PUT /api/membership/applications/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
