import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkRateLimit, getClientIp, createRateLimitHeaders, rateLimitExceededResponse } from "@/lib/rate-limit"

// GET /api/members/lookup?email=xxx
export async function GET(request: NextRequest) {
  // Rate limit: strict tier to prevent email enumeration
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "strict")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }
  // Create client inside handler to ensure env vars are loaded
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
  )
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Lookup member by email (case-insensitive)
    const { data: members, error } = await supabase
      .from("members")
      .select("id, amasi_number, name, email, phone, membership_type, status, voting_eligible")
      .ilike("email", email.trim())
      .limit(1)

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({
        found: false,
        message: "Error looking up member"
      })
    }

    const member = members?.[0]

    if (!member) {
      return NextResponse.json({
        found: false,
        message: "No member found with this email"
      })
    }

    // Check if member is active
    const isActive = member.status === "active"

    // Mask phone number for privacy (show only last 4 digits)
    const maskPhone = (phone: string | null) => {
      if (!phone) return null
      const digits = phone.replace(/\D/g, '')
      if (digits.length < 4) return '****'
      return '******' + digits.slice(-4)
    }

    return NextResponse.json({
      found: true,
      is_active: isActive,
      member: {
        amasi_number: member.amasi_number,
        name: member.name,
        // Email is already known (they searched by it), so no privacy issue
        email: member.email,
        // Mask phone for privacy - prevents enumeration attacks
        phone: maskPhone(member.phone),
        membership_type: member.membership_type,
        // Don't expose detailed status - just active/inactive
        is_active: isActive,
        // Don't expose voting_eligible - sensitive membership info
      }
    })
  } catch (error) {
    console.error("Error in member lookup:", error)
    return NextResponse.json(
      { error: "Failed to lookup member" },
      { status: 500 }
    )
  }
}
