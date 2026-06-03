import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { isValidUUID } from "@/lib/validation"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// Allowed Medical Council (State) values - must match the form field options
// (form_fields id 388a7c42-4ccd-4bb7-b9e7-8a3edcfc9af9 on the TechnoSurg form)
const ALLOWED_COUNCILS = new Set([
  "tnmc", "andhra_pradesh", "telangana", "karnataka", "kerala", "maharashtra",
  "gujarat", "goa", "delhi", "madhya_pradesh", "chhattisgarh", "rajasthan",
  "uttar_pradesh", "uttarakhand", "west_bengal", "odisha", "bihar", "jharkhand",
  "punjab", "haryana", "himachal_pradesh", "assam", "jammu_kashmir",
  "pondicherry", "nmc", "other",
])

const COUNCIL_FIELD_ID = "388a7c42-4ccd-4bb7-b9e7-8a3edcfc9af9"
const REGNUM_FIELD_ID = "e6f89c4a-0de9-4f1b-a85e-99c099a09b41"

// POST - Public (delegate portal) update of a registration's medical council details.
// Used to backfill the TNMC-required council field before certificate download.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "public")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const body = await request.json()
    const { registration_id, medical_council, registration_number } = body

    if (!registration_id || !isValidUUID(registration_id)) {
      return NextResponse.json({ error: "Invalid registration" }, { status: 400 })
    }

    if (!medical_council || !ALLOWED_COUNCILS.has(medical_council)) {
      return NextResponse.json({ error: "Please select a valid medical council" }, { status: 400 })
    }

    const regNum = typeof registration_number === "string" ? registration_number.trim() : ""

    const supabase = await createAdminClient()

    // Load existing custom_fields so we merge rather than overwrite
    const { data: registration, error: fetchError } = await (supabase as any)
      .from("registrations")
      .select("id, custom_fields")
      .eq("id", registration_id)
      .maybeSingle()

    if (fetchError || !registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    const existing = registration.custom_fields || {}
    const updatedCustomFields = {
      ...existing,
      [COUNCIL_FIELD_ID]: medical_council,
      // Only overwrite the registration number if one was provided
      ...(regNum ? { [REGNUM_FIELD_ID]: regNum } : {}),
    }

    const { error: updateError } = await (supabase as any)
      .from("registrations")
      .update({ custom_fields: updatedCustomFields })
      .eq("id", registration_id)

    if (updateError) {
      return NextResponse.json({ error: "Failed to save details" }, { status: 500 })
    }

    return NextResponse.json({ success: true, custom_fields: updatedCustomFields })
  } catch {
    return NextResponse.json({ error: "Failed to save details" }, { status: 500 })
  }
}
