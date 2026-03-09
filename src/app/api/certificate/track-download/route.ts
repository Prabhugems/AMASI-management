import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// POST /api/certificate/track-download - Track that a delegate downloaded their certificate
// Note: Called from public delegate portal, no admin auth required
// but validates registration_id format to prevent abuse
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { registration_id } = body

    if (!registration_id) {
      return NextResponse.json({ error: "registration_id is required" }, { status: 400 })
    }

    // Validate UUID format to prevent abuse
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(registration_id)) {
      return NextResponse.json({ error: "Invalid registration_id" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Only set the timestamp if not already set (first download)
    // Use try/catch for certificate_downloaded_at column which may not exist yet
    try {
      const { data: registration } = await (supabase as any)
        .from("registrations")
        .select("id, event_id, certificate_downloaded_at")
        .eq("id", registration_id)
        .maybeSingle()

      if (registration && !registration.certificate_downloaded_at) {
        await (supabase as any)
          .from("registrations")
          .update({ certificate_downloaded_at: new Date().toISOString() })
          .eq("id", registration_id)
      }

      // Track in delegate_portal_downloads
      if (registration) {
        try {
          await (supabase as any).from("delegate_portal_downloads").insert({
            registration_id: registration.id,
            event_id: registration.event_id,
            download_type: "certificate",
            ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
            user_agent: request.headers.get("user-agent") || null,
          })
        } catch {
          // Table may not exist yet - non-critical
        }
      }
    } catch {
      // certificate_downloaded_at column may not exist yet - non-critical
      // Verify the registration exists using core columns
      const { data: reg } = await (supabase as any)
        .from("registrations")
        .select("id")
        .eq("id", registration_id)
        .maybeSingle()

      if (!reg) {
        return NextResponse.json({ error: "Registration not found" }, { status: 404 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error tracking certificate download:", error)
    return NextResponse.json({ error: "Failed to track download" }, { status: 500 })
  }
}
