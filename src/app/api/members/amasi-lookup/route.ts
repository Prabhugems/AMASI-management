import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// GET /api/members/amasi-lookup?email=xxx
export async function GET(request: NextRequest) {
  // Rate limit: strict tier to prevent abuse
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(`amasi-lookup:${ip}`, "strict")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get("email")?.trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 }
    )
  }

  try {
    // Query both sources in parallel
    const [externalResult, localResult] = await Promise.allSettled([
      fetchExternalAmasiApi(email),
      fetchLocalMember(email),
    ])

    const externalData = externalResult.status === "fulfilled" ? externalResult.value : null
    const localData = localResult.status === "fulfilled" ? localResult.value : null

    if (!externalData && !localData) {
      return NextResponse.json({ found: false })
    }

    // Merge: external API has richer personal data, local has AMASI number/status
    const member: Record<string, string | null> = {
      salutation: null,
      first_name: externalData?.first_name || null,
      last_name: externalData?.last_name || null,
      email,
      phone: externalData?.mobile || null,
      designation: externalData?.edu_postgrad_degree || null,
      institution: externalData?.edu_postgrad_college || null,
      city: externalData?.city || null,
      state: externalData?.state_name || null,
      country: externalData?.country_name || null,
      amasi_number: externalData?.membership_no || localData?.amasi_number || null,
      membership_type: externalData?.application_name || localData?.membership_type || null,
    }

    // If external didn't return a name but local has one, split it
    if (!member.first_name && localData?.name) {
      const parts = localData.name.trim().split(/\s+/)
      member.first_name = parts[0] || null
      member.last_name = parts.slice(1).join(" ") || null
    }

    // Determine source
    const source = externalData && localData
      ? "both"
      : externalData
        ? "external"
        : "local"

    return NextResponse.json({
      found: true,
      source,
      member,
    })
  } catch (error) {
    console.error("Error in AMASI lookup:", error)
    return NextResponse.json(
      { error: "Failed to lookup member" },
      { status: 500 }
    )
  }
}

async function fetchExternalAmasiApi(email: string): Promise<Record<string, string> | null> {
  try {
    const formData = new FormData()
    formData.append("email_or_phone", email)

    const response = await fetch("https://application.amasi.org/api/member_detail_data", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) return null

    const data = await response.json()

    // The API returns { status: true, data: [...] } on success
    if (!data || data.status === false || data.error) return null

    // Extract member from response: data.data is an array of members
    const members = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : null
    const member = members?.[0] || (typeof data.data === "object" && !Array.isArray(data.data) ? data.data : null)

    if (!member || !member.first_name) return null

    return member
  } catch (error) {
    console.error("External AMASI API error:", error)
    return null
  }
}

async function fetchLocalMember(email: string): Promise<Record<string, string> | null> {
  try {
    const supabaseClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = supabaseClient as any

    const { data: members, error } = await supabase
      .from("members")
      .select("amasi_number, name, email, phone, membership_type, status")
      .ilike("email", email)
      .limit(1)

    if (error || !members?.length) return null

    return members[0]
  } catch (error) {
    console.error("Local member lookup error:", error)
    return null
  }
}
